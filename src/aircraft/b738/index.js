// Aircraft module contract: every aircraft exports the same shape so the
// engine and UI stay aircraft-agnostic.
import { buildModel } from './model.js';
import { createSystems, controlPanel } from './systems.js';
import { parts, categories, meta } from './parts.js';
import { walkaround } from './walkaround.js';
import { fdParts, fdCategories } from './flightdeck-parts.js';
import { buildFlightDeck } from './flightdeck.js';
import { schematics, schematicParts, schematicCategories, schematicScenario } from './schematics.js';

export default {
  meta,
  parts,
  categories,
  controlPanel,
  walkaround,
  schematics: { systems: schematics, parts: schematicParts, categories: schematicCategories, scenario: schematicScenario },
  flightDeck: {
    parts: fdParts,
    categories: fdCategories,
    build: (systems) => buildFlightDeck(systems),
    camera: {
      home: { position: [0.02, 1.17, -0.5], target: [0.86, 0.86, -0.3] },
      views: {
        Captain: { position: [0.02, 1.17, -0.5], target: [0.86, 0.86, -0.3] },
        'First Officer': { position: [0.02, 1.17, 0.5], target: [0.86, 0.86, 0.3] },
        Overhead: { position: [-0.45, 1.05, 0], target: [0.25, 1.85, 0] },
        Pedestal: { position: [-0.6, 1.45, 0], target: [0.2, 0.58, 0] },
        Glareshield: { position: [0.05, 1.2, 0], target: [0.66, 1.0, 0] },
        Jumpseat: { position: [-1.1, 1.5, 0.3], target: [0.6, 1.0, 0] },
      },
      env: { ground: false, fog: false },
      limits: { minDistance: 0.12, maxDistance: 2.4, near: 0.03, fov: 62 },
      bounds: { min: [-1.15, 0.25, -0.98], max: [0.95, 1.95, 0.98] },
      focus: { scale: 1.6, add: 0.22, min: 0.3, max: 1.4 },
    },
  },
  build() {
    const { root, rig } = buildModel();
    const systems = createSystems(rig);
    return { root, systems };
  },
  camera: {
    home: { position: [33, 16, -37], target: [-1, 2.0, 0] },
    views: {
      'Three-quarter': { position: [33, 16, -37], target: [-1, 2.0, 0] },
      Front: { position: [42, 5.3, 0], target: [0, 4.3, 0] },
      Side: { position: [0, 4.8, -52], target: [0, 4.3, 0] },
      Top: { position: [0.01, 60, 0], target: [0, 2.8, 0] },
      Belly: { position: [6, -17, -16], target: [0, 2.3, 0] },
      Tail: { position: [-34, 10, 18], target: [-14, 4.8, 0] },
    },
  },
};
