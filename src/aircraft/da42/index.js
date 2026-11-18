// Aircraft module contract (same shape as ../b738/index.js) for the Diamond DA42 NG.
// Part 1 provides the exterior model, study parts, walkaround and controls. Later modules plug in
// by adding these optional keys (main.js disables the matching tab while a key is absent):
//   flightDeck: { parts, categories, build(systems) -> { root, update, setNight }, camera }
//   cabin:      { parts, categories, build(systems) -> { root, update }, camera }
//   schematics: { systems, parts, categories, scenario }
//   failures:   { scenarios, normal, labels }   (needs schematics)
//   trainers:   [ ... ]
// System logic grows through createSystems(rig, extensions): see systems.js.
import { buildModel } from './model.js';
import { createSystems, controlPanel } from './systems.js';
import { parts, categories, meta } from './parts.js';
import { walkaround } from './walkaround.js';

const extensions = [];

export default {
  meta,
  parts,
  categories,
  controlPanel,
  walkaround,
  build() {
    const { root, rig } = buildModel();
    const systems = createSystems(rig, extensions);
    return { root, systems };
  },
  camera: {
    home: { position: [10.5, 4.6, -12], target: [-1.0, 1.0, 0] },
    views: {
      'Three-quarter': { position: [10.5, 4.6, -12], target: [-1.0, 1.0, 0] },
      Front: { position: [13, 1.5, 0], target: [0, 1.1, 0] },
      Side: { position: [-1.3, 1.5, -16.5], target: [-1.3, 1.2, 0] },
      Top: { position: [-1.29, 25, 0], target: [-1.3, 1.0, 0] },
      Belly: { position: [2.5, -5, -6.5], target: [-0.8, 0.7, 0] },
      Tail: { position: [-12.5, 3.8, 6.5], target: [-4.0, 1.4, 0] },
      'Nose & canopy': { position: [6.2, 3.2, -4.6], target: [1.0, 1.2, 0] },
    },
    // A 13.4 m aircraft: closer zoom limits, nearer clip plane and tighter part focus than the 737.
    limits: { minDistance: 1.2, maxDistance: 45, near: 0.1, fov: 38 },
    focus: { scale: 1.9, add: 0.9, min: 1.6, max: 18 },
  },
};
