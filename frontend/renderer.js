import * as THREE from '../lib/three.module.js';
import { OrbitControls } from '../lib/OrbitControls.js';
import { flightPath } from '../modeling/path.js';

import * as Rad from '../radiosity/index.js';
import * as Modeling from '../modeling/index.js';


import * as axes from './tools/axes.js';
import * as components from './tools/basic-components.js';
import * as stats from './tools/stats.js';

export const viewParameters = {
  // the current view is either vertex (radiosity) or shaded
  viewOutput: new components.Toggle('view radiosity output', false),

  // global camera sees light as it reaches surfaces, local camera waits for the light to reach the camera
  viewGlobalCamera: new components.Toggle('global camera', false),

  viewWireframe: new components.Toggle('wireframe view', false),
  includeAmbient: new components.Toggle('show ambient light', false),
  gamma: new components.Range('gamma', 1, 100, 35), // scaled by 10, so 0.1-10, default 2.2
  exposure: new components.Range('exposure', -50, 50, 0), // exposure factor is 1.1^(exposure/10)
};

let renderer;
let camera;
let flightCam;
let scene;
let controls;
let material;
let geometry;
const camToggle = document.getElementById('camera-toggle');

let environment;

export function setup() {
  if (renderer) return; // already initialized

  renderer = new THREE.WebGLRenderer({
    // Enabled so canvases can be saved as images
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  document.body.append(renderer.domElement);

  camera = new THREE.PerspectiveCamera(100, 1, 0.1, 1000);
  // camera = new THREE.OrthographicCamera( window.innerWidth / -1, window.innerWidth / 1, window.innerHeight / 2, window.innerHeight / -2, -1000, 1000 );

  // Create camera object for flight cam and camera helper
  flightCam = new THREE.PerspectiveCamera(84, window.innerWidth / window.innerHeight, 0.01, 1000);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableKeys = false;

  material = new THREE.MeshBasicMaterial({
    vertexColors: THREE.FaceColors,
    wireframe: viewParameters.viewWireframe.value,
  });

  setViewSizeToScreenSize();
  window.addEventListener('resize', setViewSizeToScreenSize);

  axes.setup();

  // react to view parameters changes
  viewParameters.gamma.addEventListener('change', updateColors);
  viewParameters.exposure.addEventListener('change', updateColors);
  viewParameters.viewOutput.addEventListener('change', updateColors);
  viewParameters.includeAmbient.addEventListener('change', updateColors);
  viewParameters.viewWireframe.addEventListener('change', () => {
    material.wireframe = viewParameters.viewWireframe.value;
  });

  animate();
}

function setViewSizeToScreenSize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

export function showEnvironment(theEnvironment) {
  environment = theEnvironment;
  viewParameters.viewOutput.setTo(false);

  // translate coordinates (once) so the environment is the right way up for THREE.js
  if (!environment._coordinatesTranslated) {
    Modeling.coordinates.xyFloorToView(environment);
    environment._coordinatesTranslated = true;
  }

  scene = new THREE.Scene();
  const bgColor = window.getComputedStyle(document.body).getPropertyValue('--bg').trim();
  scene.background = new THREE.Color(bgColor);
  geometry = new THREE.Geometry();

  for (const instance of environment.instances) {
    const vertices = instance.vertices;

    // * Read vertices
    for (const vertex of vertices) {
      const threeVertex = new THREE.Vector3(
        vertex.pos.x,
        vertex.pos.y,
        vertex.pos.z,
      );

      vertex._threeIndex = geometry.vertices.length;
      vertex._threeVertex = threeVertex;
      geometry.vertices.push(threeVertex);
    }

    // * Read faces
    for (const surface of instance.surfaces) {
      // If current surface is a light source, skip
      if (surface.isLight) {
        continue;
      }
      for (const patch of surface.patches) {
        for (const element of patch.elements) {
          addFace(geometry, element, [0, 1, 2]);
          if (element.isQuad) {
            addFace(geometry, element, [0, 2, 3]);
          }
        }
      }
    }
  }
  scene.add(new THREE.Mesh(geometry, material));

  updateControlsForEnvironment();
  updateColors();
}

function addFace(geometry, element, vertexIndices) {
  const face = new THREE.Face3(
    element.vertices[vertexIndices[0]]._threeIndex,
    element.vertices[vertexIndices[1]]._threeIndex,
    element.vertices[vertexIndices[2]]._threeIndex,
  );
  geometry.faces.push(face);

  for (let i = 0; i < 3; i += 1) {
    face.vertexColors[i] = new THREE.Color();
  }

  // add a backlink so we can get to the three.js faces from the element
  if (!element._threeFaces) element._threeFaces = [];
  element._threeFaces.push(face);

  // add a backlink so we can get to Rad vertices from three.js faces
  face._radVertices = [
    element.vertices[vertexIndices[0]],
    element.vertices[vertexIndices[1]],
    element.vertices[vertexIndices[2]],
  ];
}

function updateControlsForEnvironment() {
  const bounds = environment.boundingBox;
  const roomCenter = new Rad.Point3(
    (bounds[0].x + bounds[1].x) / 2,
    (bounds[0].y + bounds[1].y) / 2,
    (bounds[0].z + bounds[1].z) / 2,
  );

  const diagonal = new Rad.Vector3(bounds[0], bounds[1]);

  camera.position.x = roomCenter.x;
  camera.position.y = roomCenter.y;
  camera.position.z = roomCenter.z + 8;

  controls.target = new THREE.Vector3(roomCenter.x, roomCenter.y, roomCenter.z);
  controls.maxDistance = diagonal.length * 2;
  controls.minDistance = diagonal.length / 10;
  controls.panBBox = {
    min: {
      x: bounds[0].x,
      y: bounds[0].y,
      z: bounds[0].z,
    },
    max: {
      x: bounds[1].x,
      y: bounds[1].y,
      z: bounds[1].z,
    },
  };
  controls.update();
}

export function updateColors() {
  if (!environment) return; // not set up yet

  const deltaAmbient = (viewParameters.includeAmbient.value && environment.ambient) ? new Rad.Spectra() : undefined;
  const surfaceColor = new Rad.Spectra();

  for (const surface of environment.surfaces) {
    // If current surface is a light source, skip
    if (surface.isLight) {
      continue;
    }

    if (deltaAmbient) {
      deltaAmbient.setTo(environment.ambient);
      deltaAmbient.multiply(surface.reflectance);
    }

    if (!viewParameters.viewOutput.value) {
      surfaceColor.setTo(surface.emittance);
      surfaceColor.add(surface.reflectance);
    }

    for (const patch of surface.patches) {
      for (const element of patch.elements) {
        for (const face of element._threeFaces) {
          for (let i = 0; i < 3; i += 1) {
            if (viewParameters.viewOutput.value) {
              surfaceColor.setTo(face._radVertices[i].exitance);
              if (deltaAmbient) surfaceColor.add(deltaAmbient);
              surfaceColor.scale(1.1 ** viewParameters.exposure.value);
              surfaceColor.exp(10 / viewParameters.gamma.value);
            }
            face.vertexColors[i].setRGB(surfaceColor.r, surfaceColor.g, surfaceColor.b);
          }
        }
      }
    }
  }
  geometry.colorsNeedUpdate = true;
}

function animate() {
  requestAnimationFrame(animate);
  if (!scene) return; // nothing to show

  const currentStep = parseInt(stats.get('current-step')) - 1;
  // Make t value relative to max value, this will create a smooth loop

  /*
    ThreeJS co-ordinates:
    x: x
    y: z
    z: -y
  */
  const [x, y, z] = flightPath(currentStep);
  flightCam.position.x = x;
  flightCam.position.y = z;
  flightCam.position.z = -y;

  const [lookX, lookY, lookZ] = flightPath(currentStep + 2);
  flightCam.lookAt(lookX, lookZ, -lookY);

  if (camToggle.dataset.enabled) {
    controls.enabled = false;
    renderer.render(scene, flightCam);
    axes.update(flightCam, new THREE.Vector3());
  } else {
    controls.enabled = true;
    renderer.render(scene, camera);
    axes.update(camera, controls.target);
  }
  axes.render();
}

export function getCameraPosition() {
  if (camToggle.dataset.enabled) {
    return flightCam.position;
  } else {
    return camera.position;
  }
}

export function displayGamma(gamma) {
  return (gamma / 10).toFixed(1);
}

export function displayExposure(exposure) {
  return (exposure > 0 ? '+' : '') + (exposure / 10).toFixed(1);
}
