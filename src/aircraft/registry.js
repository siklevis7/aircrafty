// Add new aircraft here. Each entry lazy-loads a module with the same contract
// as ./b738/index.js (meta, parts, categories, controlPanel, build(), camera).
export const aircraftRegistry = [
  {
    id: 'b738',
    name: 'Boeing 737-800',
    family: '737 Next Generation',
    load: () => import('./b738/index.js').then((m) => m.default),
  },
  { id: 'da42', name: 'Diamond DA42', family: 'DA42 Twin Star', load: () => import('./da42/index.js').then((m) => m.default) },
];

export const getAircraft = (id) => aircraftRegistry.find((a) => a.id === id) || aircraftRegistry[0];
