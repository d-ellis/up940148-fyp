import * as Rad from '../radiosity/index.js';
import Transform3 from './transform3.js';
import * as Tri from './tri-prism.js';
import * as Face from './singleface.js';


export async function load(filepath, isTree = true, colour = false) {
  let branchReflectance;
  let leafReflectance;
  // Set coloured or greyscale
  if (colour) {
    branchReflectance = new Rad.Spectra(0.1804, 0.1098, 0.0627);
    leafReflectance = isTree ? new Rad.Spectra(0.2118, 0.4510, 0.1882) : new Rad.Spectra(0.0667, 0.1255, 0.0627);
  } else {
    branchReflectance = new Rad.Spectra(0.4, 0.4, 0.4);
    leafReflectance = isTree ? new Rad.Spectra(0.8, 0.8, 0.8) : new Rad.Spectra(0.7, 0.7, 0.7);
  }

  const tree = await getObject(filepath);

  let surfaces = [];

  if (isTree) {
    let b = 0;
    while (b < tree.branches.length) {
      if (tree.branches[b].width > 0.7) {
        const object = createBranch(tree.branches[b], branchReflectance);
        surfaces = surfaces.concat(object.surfaces);
      }
      b++;
    }
  }

  let l = 0;
  while (l < tree.leaves.length) {
    const objects = createLeaf(tree.leaves[l], isTree, leafReflectance);
    let o = 0;
    while (o < objects.length) {
      if (objects[o]) {
        surfaces = surfaces.concat(objects[o].surfaces);
      }
      o++;
    }
    l++;
  }

  return new Rad.Instance(surfaces);
}


async function getObject(file) {
  let obj;
  try {
    const response = await fetch(file);

    obj = await response.json();
  } catch {
    const { default: retrieve } = await import('./retrieve-json-file.js');
    obj = retrieve(file);
  }


  return obj;
}


function createBranch(branch, branchReflectance) {
  const retVal = Tri.prismFromPoints(branch.start, branch.end, branch.width, branchReflectance, new Rad.Spectra(0, 0, 0));

  // Add reflectance values
  let s = 0;
  while (s < retVal.surfaces.length) {
    retVal.surfaces[s].reflectance.add(branchReflectance);
    s++;
  }

  return retVal;
}

function createLeaf(leaf, isTree, leafReflectance) {
  if (leaf === '') return 0;

  const original = Face.triangle(leafReflectance, new Rad.Spectra(0, 0, 0));
  const mirror = Face.triangle(leafReflectance, new Rad.Spectra(0, 0, 0));
  const mirrorX = new Transform3();
  mirrorX.rotate(180, 0, 0);
  mirrorX.transform(mirror);


  const xForm = new Transform3();
  xForm.scale(12, 8, 1);
  if (isTree) {
    xForm.scale(leaf.scale, leaf.scale, 1);
  }
  xForm.rotate(leaf.rotation.x, leaf.rotation.y, leaf.rotation.z);
  xForm.translate(leaf.translation.x, leaf.translation.y, leaf.translation.z);
  if (!isTree) {
    xForm.translate(0, 0, -1.5 * leaf.translation.z);
    xForm.rotate(0, 180, 0);
  }
  xForm.transform(original);
  xForm.transform(mirror);


  return [original, mirror];
}
