// Registry of training modules shown in Training mode, in display order.
import afds from './afds.js';
import fmc from './fmc.js';
import enginestart from './enginestart.js';
import warnings from './warnings.js';
import simprep from './simprep.js';
import performance from './performance.js';

export const trainers = [afds, fmc, enginestart, warnings, simprep, performance];
