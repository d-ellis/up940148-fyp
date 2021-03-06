import { loadSTL } from '../stl-loader.js';
import { flightPath } from '../path.js';
import * as Rad from '../../radiosity/index.js';
import Transform3 from '../transform3.js';
import * as Cube from '../cube.js';
import * as Plane from '../singleface.js';
import * as Cylinder from '../cylinder.js';
import * as TreeLoader from '../json-tree-loader.js';
let retrieve;


const defaultReflectance = new Rad.Spectra(0.5, 0.5, 0.5);
const defaultEmittance = new Rad.Spectra(0, 0, 0);
const floorReflectance = new Rad.Spectra(0.0001, 0.0001, 0.0001);

const defaultCubeReflectance = [
  defaultReflectance,
  defaultReflectance,
  defaultReflectance,
  defaultReflectance,
  defaultReflectance,
  defaultReflectance,
];
const defaultCubeEmittance = [
  defaultEmittance,
  defaultEmittance,
  defaultEmittance,
  defaultEmittance,
  defaultEmittance,
  defaultEmittance,
];
const cubeLightReflectance = [
  new Rad.Spectra(0, 0, 0),
  new Rad.Spectra(0, 0, 0),
  new Rad.Spectra(0, 0, 0),
  new Rad.Spectra(0, 0, 0),
  new Rad.Spectra(0, 0, 0),
  new Rad.Spectra(0, 0, 0),
];
const cubeLightEmittance = [
  new Rad.Spectra(255, 255, 255),
  new Rad.Spectra(255, 255, 255),
  new Rad.Spectra(255, 255, 255),
  new Rad.Spectra(255, 255, 255),
  new Rad.Spectra(255, 255, 255),
  new Rad.Spectra(255, 255, 255),
];

export default async function createScene() {
  if (typeof window === 'undefined') {
    retrieve = await import('../retrieve-json-file.js');
    retrieve = retrieve.default;
  }

  const floor = makePlane(floorReflectance, defaultEmittance, 32);
  const floorxForm = new Transform3();
  floorxForm.translate(-0.5, -0.5, 0);
  floorxForm.scale(105, 105, 1);
  floorxForm.transform(floor);

  const objects = [floor];

  let treeData;
  try {
    const treeResponse = await fetch('../modeling/test-models/poisson-tree-samples.json');
    treeData = await treeResponse.json();
  } catch {
    treeData = retrieve('../modeling/test-models/poisson-tree-samples.json');
  } finally {
    let t = 0;
    while (t < treeData.length) {
      const tree = await TreeLoader.load('../modeling/trees/r20N2000.json', true);
      // const tree = makeCube(cubeLightReflectance, cubeLightEmittance);
      const transform = new Transform3();
      // Center on 0, 0
      transform.translate(-0.5, -0.5, 0);
      transform.scale(0.5, 0.5, 0.5);
      transform.translate(treeData[t].x, treeData[t].y, 0);
      transform.transform(tree);

      objects.push(tree);

      t++;
    }
  }

  return new Rad.Environment(objects);
}


function setActiveTime(subject, time) {
  for (const surface of subject.surfaces) {
    surface.activeTime = time;
  }
}

function makeLight(subject) {
  for (const surface of subject.surfaces) {
    surface.isLight = true;
  }
}

function makePlane(reflectance = defaultReflectance, emittance = defaultEmittance, subDivs = [1, 1]) {
  // Return value will be plane object
  const retval = Plane.singleFace(reflectance, emittance, subDivs);

  return retval;
}

function makeCube(reflectance = defaultCubeReflectance, emittance = defaultCubeEmittance, subDivs = 1) {
  // Return value will be cube object
  const retval = Cube.unitCubeMultiSurface(subDivs);

  // Add reflectance and emittance values
  for (let i = 0; i < 6; i++) {
    retval.surfaces[i].reflectance.add(reflectance[i]);
    retval.surfaces[i].emittance.add(emittance[i]);
  }

  return retval;
}
