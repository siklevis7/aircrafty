// Registry of system extensions, in compute order (later ones may read earlier results).
import pressurization from './pressurization.js';
import oxygen from './oxygen.js';
import fire from './fire.js';
import antiice from './antiice.js';
import gearbrakes from './gearbrakes.js';

export const extensions = [pressurization, oxygen, fire, antiice, gearbrakes];
