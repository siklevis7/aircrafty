// Aircraft module contract: every aircraft exports the same shape so the
// engine and UI stay aircraft-agnostic.
import { buildModel } from './model.js';
import { createSystems, controlPanel } from './systems.js';
import { parts, categories, meta } from './parts.js';
import { walkaround } from './walkaround.js';
import { fdParts, fdCategories } from './flightdeck-parts.js';
import { buildFlightDeck, flightDeckCamera } from './flightdeck.js';
import { schematics, schematicParts, schematicCategories, schematicScenario } from './schematics.js';
import { failureScenarios, normalFlightConfig, annunciatorLabels } from './failures.js';
import { extensions } from './ext/index.js';
import { trainers } from './trainers/index.js';
import { buildCabin, cabinCamera } from './cabin.js';
import { cabinParts, cabinCategories } from './cabin-parts.js';

// System extensions add schematics, study content, failures, lights and scenario controls.
const fromExt = (key) => extensions.flatMap((e) => e[key] || []);
const mergeExt = (key) => Object.assign({}, ...extensions.map((e) => e[key] || {}));

export default {
  meta,
  parts,
  categories,
  controlPanel,
  walkaround,
  trainers,
  failures: {
    scenarios: [...failureScenarios, ...fromExt('failures')],
    normal: { ...normalFlightConfig, ...mergeExt('normal') },
    labels: { ...annunciatorLabels, ...mergeExt('labels') },
  },
  schematics: {
    systems: [...schematics, ...fromExt('schematics')],
    parts: [...schematicParts, ...fromExt('parts')],
    categories: [...schematicCategories, ...fromExt('categories')],
    scenario: [...schematicScenario, ...fromExt('scenario')],
  },
  flightDeck: {
    parts: fdParts,
    categories: fdCategories,
    build: (systems) => buildFlightDeck(systems),
    camera: flightDeckCamera,
  },
  cabin: {
    parts: cabinParts,
    categories: cabinCategories,
    build: (systems) => buildCabin(systems),
    camera: cabinCamera,
  },
  build() {
    const { root, rig } = buildModel();
    const systems = createSystems(rig, extensions);
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
