// Aircraft module contract: every aircraft exports the same shape so the
// engine and UI stay aircraft-agnostic.
import { buildModel } from './model.js';
import { createSystems, controlPanel } from './systems.js';
import { parts, categories, meta } from './parts.js';

export default {
  meta,
  parts,
  categories,
  controlPanel,
  build() {
    const { root, rig } = buildModel();
    const systems = createSystems(rig);
    return { root, systems };
  },
  camera: {
    home: { position: [33, 15, -37], target: [-1, 1.2, 0] },
    views: {
      'Three-quarter': { position: [33, 15, -37], target: [-1, 1.2, 0] },
      Front: { position: [42, 4.5, 0], target: [0, 3.5, 0] },
      Side: { position: [0, 4, -52], target: [0, 3.5, 0] },
      Top: { position: [0.01, 60, 0], target: [0, 2, 0] },
      Belly: { position: [6, -18, -16], target: [0, 1.5, 0] },
      Tail: { position: [-34, 9, 18], target: [-14, 4, 0] },
    },
  },
};
