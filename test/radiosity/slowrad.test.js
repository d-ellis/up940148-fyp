import SlowRad from '../../radiosity/slowrad.js';
import Point3 from '../../radiosity/point3.js';
import Patch3 from '../../radiosity/patch3.js';
import Vertex3 from '../../radiosity/vertex3.js';
import Surface3 from '../../radiosity/surface3.js';
import Environment from '../../radiosity/environment.js';
import Instance from '../../radiosity/instance.js';

test('calcPatchElementDistances()', () => {
  // set up the environment

  // vertices for patch0, center (0, 0, 0)
  const vertices0 = [
    new Point3(-1, 1, 0),
    new Point3(-1, -1, 0),
    new Point3(1, -1, 0),
    new Point3(1, 1, 0),
  ].map(p => new Vertex3(p));

  // patch1, center (0, 3, 0)
  const vertices1 = [
    new Point3(-1, 4, 0),
    new Point3(-1, 2, 0),
    new Point3(1, 2, 0),
    new Point3(1, 4, 0),
  ].map(p => new Vertex3(p));

  // patch2, center (0, 3, 4)
  const vertices2 = [
    new Point3(-1, 4, 4),
    new Point3(-1, 2, 4),
    new Point3(1, 2, 4),
    new Point3(1, 4, 4),
  ].map(p => new Vertex3(p));

  // patch3, center (3, 3, 4)
  const vertices3 = [
    new Point3(2, 4, 4),
    new Point3(2, 2, 4),
    new Point3(4, 2, 4),
    new Point3(4, 4, 4),
  ].map(p => new Vertex3(p));

  const patch0 = new Patch3(vertices0);
  const patch1 = new Patch3(vertices1);
  const patch2 = new Patch3(vertices2);
  const patch3 = new Patch3(vertices3);

  const surfaces = [
    new Surface3(null, null, [patch0, patch1]),
    new Surface3(null, null, [patch2, patch3]),
  ];

  const env = new Environment([new Instance(surfaces)]);

  const rad = new SlowRad();
  rad.open(env);

  expect(patch0.distArray).toStrictEqual([null, 3, 5, Math.sqrt(34)]);
  expect(patch1.distArray).toStrictEqual([3, null, 4, 5]);
  expect(patch2.distArray).toStrictEqual([5, 4, null, 3]);
  expect(patch3.distArray).toStrictEqual([Math.sqrt(34), 5, 3, null]);
});
