// System extension: fire protection (id `fire`) for the 737-800 (NG).
// Simplified, rule-based study model of the typical NG installation:
//  - engines: two detector loops each (fire + overheat), a fire switch per engine, two engine
//    bottles (L and R) that can each be discharged into either engine;
//  - APU: single detector loop, APU fire switch, one APU bottle, automatic APU shutdown on fire;
//  - cargo: forward and aft smoke detection, ARMED switches, DISCH switch and the cargo
//    bottle(s) (one or two depending on configuration; shown here as one DISCH indication);
//  - main wheel well: fire detection only (no extinguishing);
//  - OVHT/FIRE test and bell cutout.
// Detector temperatures, agent quantities and timings are not simulated. Operator documents take precedence.

const ENG_HANDLE = ['IN', 'PULLED', 'L', 'R'];
const APU_HANDLE = ['IN', 'PULLED', 'DISCH'];
const SOURCES = ['eng1', 'eng2', 'apu', 'cargoFwd', 'cargoAft', 'wheelwell', 'test'];
const FIRE_FLAG = { eng1: 'fail.fire.eng1', eng2: 'fail.fire.eng2', apu: 'fail.fire.apu', cargoFwd: 'fail.fire.cargoFwd', cargoAft: 'fail.fire.cargoAft', wheelwell: 'fail.fire.wheelwell' };
const FLAG_ZONE = Object.fromEntries(Object.entries(FIRE_FLAG).map(([z, f]) => [f, z]));

const TEST_TIME = 3; // s the OVHT/FIRE test lights stay on (the real switch is held)
const EXT_TIME = 3; // s from discharge until the fire warning goes out (study model)
const CARGO_EXT_TIME = 5;
const DISCH_SHOW = 4; // s the discharge line stays animated
const WHEELWELL_COOL = 15; // s with the gear down until the wheel well warning clears (study model)

// ---- shared logic (used by update, compute and set, so it reads raw state only)
/** A zone is on fire while its failure flag is set and it hasn't been extinguished. */
const burning = (s, z) => !!s[FIRE_FLAG[z]] && !s[`fire.out.${z}`];
const testing = (s) => (s['fire.testT'] || 0) > 0;
/** Fire warning sources currently active (the master FIRE WARN lights and bell follow these). */
function activeSources(s) {
  const t = testing(s);
  return {
    eng1: burning(s, 'eng1'), eng2: burning(s, 'eng2'), apu: burning(s, 'apu'),
    cargoFwd: burning(s, 'cargoFwd'), cargoAft: burning(s, 'cargoAft'), wheelwell: burning(s, 'wheelwell'),
    test: t,
  };
}
const handleOut = (v) => v && v !== 'IN';
const ok = { ok: true };

const fire = {
  id: 'fire',
  state: {
    'fire.handle.eng1': 'IN', 'fire.handle.eng2': 'IN', 'fire.handle.apu': 'IN',
    'fire.bottle.L': false, 'fire.bottle.R': false, 'fire.bottle.apu': false, 'fire.bottle.cargo': false,
    'fire.cargo.armFwd': false, 'fire.cargo.armAft': false,
    'fail.fire.eng1': false, 'fail.fire.eng2': false, 'fail.fire.apu': false,
    'fail.fire.cargoFwd': false, 'fail.fire.cargoAft': false, 'fail.fire.wheelwell': false,
    'fail.fire.ovht1': false, 'fail.fire.ovht2': false,
    // internal: extinguished flags, timers, bell cutout memory, discharge animation
    'fire.out.eng1': false, 'fire.out.eng2': false, 'fire.out.apu': false,
    'fire.out.cargoFwd': false, 'fire.out.cargoAft': false, 'fire.out.wheelwell': false,
    'fire.extT.eng1': 0, 'fire.extT.eng2': 0, 'fire.extT.apu': 0, 'fire.extT.cargoFwd': 0, 'fire.extT.cargoAft': 0,
    'fire.wwT': 0, 'fire.testT': 0,
    'fire.dischT.L': 0, 'fire.dischT.R': 0, 'fire.dischT.apu': 0, 'fire.dischT.cargo': 0,
    'fire.dischTo.L': '', 'fire.dischTo.R': '', 'fire.dischTo.cargo': '',
    'fire.cut.eng1': false, 'fire.cut.eng2': false, 'fire.cut.apu': false, 'fire.cut.cargoFwd': false,
    'fire.cut.cargoAft': false, 'fire.cut.wheelwell': false, 'fire.cut.test': false,
  },

  set(key, value, api) {
    const s = api.state;
    // APU start is refused while its fire switch is out or an APU fire is detected
    if (key === 'apu') {
      if (!value) return undefined;
      if (handleOut(s['fire.handle.apu'])) return api.deny('The APU fire switch is pulled: APU fuel is shut off. Push the switch in first.');
      if (burning(s, 'apu')) return api.deny('APU fire detected: the APU shuts down automatically and won\'t start.');
      return undefined;
    }
    if (key in FLAG_ZONE) {
      const z = FLAG_ZONE[key];
      s[key] = !!value;
      s[`fire.out.${z}`] = false;
      s[`fire.cut.${z}`] = false;
      if (z !== 'wheelwell') s[`fire.extT.${z}`] = 0;
      else s['fire.wwT'] = 0;
      if (z === 'apu' && value && s.apu) {
        api.set('apu', false);
        api.emit({ type: 'info', message: 'APU fire detected: the APU shuts down automatically.' });
      }
      return ok;
    }
    if (key === 'fail.fire.ovht1' || key === 'fail.fire.ovht2') { s[key] = !!value; return ok; }

    if (key === 'fire.handle.eng1' || key === 'fire.handle.eng2') {
      const n = key.slice(-1);
      const z = `eng${n}`;
      const cur = s[key];
      if (!ENG_HANDLE.includes(value)) return api.deny(`Engine fire switch positions: ${ENG_HANDLE.join(', ')}.`);
      if (value === cur) return ok;
      if (value === 'IN') { s[key] = 'IN'; return ok; }
      if (value === 'PULLED') {
        if (cur === 'IN' && !burning(s, z)) {
          api.emit({ type: 'info', message: `Engine ${n} fire switch is locked without a fire warning. Pulled using the manual override: fuel, bleed and hydraulic shutoff valves close and generator ${n} trips.` });
        }
        s[key] = 'PULLED';
        return ok;
      }
      // rotate L or R: discharge that bottle into this engine
      if (cur === 'IN') return api.deny(`Pull the engine ${n} fire switch before rotating it.`);
      s[key] = value;
      const b = `fire.bottle.${value}`;
      if (s[b]) {
        api.emit({ type: 'info', message: `The ${value} engine bottle is already discharged. Rotate the other way to use the other bottle.` });
        return ok;
      }
      s[b] = true;
      s[`fire.dischT.${value}`] = DISCH_SHOW;
      s[`fire.dischTo.${value}`] = z;
      if (burning(s, z) && !(s[`fire.extT.${z}`] > 0)) s[`fire.extT.${z}`] = EXT_TIME;
      api.emit({ type: 'info', message: `${value} engine bottle discharged into engine ${n}. BOTTLE DISCHARGE light on.` });
      return ok;
    }

    if (key === 'fire.handle.apu') {
      const cur = s[key];
      if (!APU_HANDLE.includes(value)) return api.deny(`APU fire switch positions: ${APU_HANDLE.join(', ')}.`);
      if (value === cur) return ok;
      if (value === 'IN') { s[key] = 'IN'; return ok; }
      if (value === 'PULLED') {
        if (cur === 'IN' && !burning(s, 'apu')) {
          api.emit({ type: 'info', message: 'APU fire switch pulled using the manual override (no fire warning): APU fuel and bleed close, the inlet door closes and the APU generator trips.' });
        }
        s[key] = 'PULLED';
        if (s.apu) api.set('apu', false);
        return ok;
      }
      // DISCH
      if (cur === 'IN') return api.deny('Pull the APU fire switch before rotating it.');
      s[key] = 'DISCH';
      if (s['fire.bottle.apu']) {
        api.emit({ type: 'info', message: 'The APU bottle is already discharged.' });
        return ok;
      }
      s['fire.bottle.apu'] = true;
      s['fire.dischT.apu'] = DISCH_SHOW;
      if (burning(s, 'apu') && !(s['fire.extT.apu'] > 0)) s['fire.extT.apu'] = EXT_TIME;
      api.emit({ type: 'info', message: 'APU bottle discharged into the APU compartment. APU BOTTLE DISCHARGE light on.' });
      return ok;
    }

    if (key === 'fire.cargo.armFwd' || key === 'fire.cargo.armAft') { s[key] = !!value; return ok; }

    if (key === 'act.fire.cargoDisch') {
      const fwd = s['fire.cargo.armFwd'], aft = s['fire.cargo.armAft'];
      if (!fwd && !aft) return api.deny('Arm the FWD or AFT cargo fire switch first. DISCH only fires into an armed compartment.');
      if (s['fire.bottle.cargo']) return api.deny('The cargo fire bottle(s) are already discharged (DISCH light on).');
      s['fire.bottle.cargo'] = true;
      s['fire.dischT.cargo'] = DISCH_SHOW;
      s['fire.dischTo.cargo'] = fwd && aft ? 'both' : fwd ? 'fwd' : 'aft';
      for (const [z, armed] of [['cargoFwd', fwd], ['cargoAft', aft]]) {
        if (armed && burning(s, z) && !(s[`fire.extT.${z}`] > 0)) s[`fire.extT.${z}`] = CARGO_EXT_TIME;
      }
      api.emit({ type: 'info', message: `Cargo fire extinguisher discharged into the ${fwd && aft ? 'armed' : fwd ? 'forward' : 'aft'} compartment.` });
      return ok;
    }

    if (key === 'act.fire.test') {
      s['fire.testT'] = TEST_TIME;
      s['fire.cut.test'] = false;
      return ok;
    }

    if (key === 'act.fire.bellCutout') {
      const a = activeSources(s);
      for (const z of SOURCES) if (a[z]) s[`fire.cut.${z}`] = true;
      return ok;
    }

    if (key.startsWith('fire.bottle.')) {
      // true = discharged without a target; false = bottle serviced (reset)
      if (!(key in s)) return api.deny(`Unknown control ${key}`);
      s[key] = !!value;
      return ok;
    }
    if (key.startsWith('fire.')) {
      if (!(key in s)) return api.deny(`Unknown control ${key}`);
      s[key] = value;
      return ok;
    }
    return undefined;
  },

  update(dt, api) {
    const s = api.state;
    let changed = false;
    const tick = (k) => {
      if (!(s[k] > 0)) return false;
      s[k] = Math.max(0, s[k] - dt);
      return s[k] === 0;
    };
    if (tick('fire.testT')) changed = true;
    for (const b of ['L', 'R', 'apu', 'cargo']) if (tick(`fire.dischT.${b}`)) changed = true;
    for (const z of ['eng1', 'eng2', 'apu', 'cargoFwd', 'cargoAft']) {
      if (tick(`fire.extT.${z}`) && s[FIRE_FLAG[z]]) {
        s[`fire.out.${z}`] = true;
        changed = true;
      }
    }
    // wheel well: lowering the gear lets airflow cool the well (no extinguisher)
    if (burning(s, 'wheelwell')) {
      const gearDown = s.gearLever === 'DN' && api.gearPos <= 0.001;
      if (gearDown && !s.onGround) {
        s['fire.wwT'] = (s['fire.wwT'] || 0) + dt;
        if (s['fire.wwT'] >= WHEELWELL_COOL) { s['fire.out.wheelwell'] = true; changed = true; }
      } else s['fire.wwT'] = 0;
    }
    // APU fire: automatic shutdown (also covers an APU left running when the flag was set)
    if (burning(s, 'apu') && s.apu) { api.set('apu', false); changed = true; }
    // bell cutout memory resets once a source clears, so a new warning rings again
    const a = activeSources(s);
    for (const z of SOURCES) if (!a[z] && s[`fire.cut.${z}`]) { s[`fire.cut.${z}`] = false; changed = true; }
    if (changed) api.emit({ type: 'state' });
  },

  compute(s, out) {
    const a = activeSources(s);
    const t = a.test;
    const warnSrc = SOURCES.filter((z) => a[z] && !s[`fire.cut.${z}`]);
    const ovht1 = (!!s['fail.fire.ovht1'] && out.eng.run1) || t;
    const ovht2 = (!!s['fail.fire.ovht2'] && out.eng.run2) || t;
    return {
      // contract
      warn: warnSrc.length > 0,
      bell: warnSrc.length > 0,
      eng1: a.eng1 || t, eng2: a.eng2 || t, apu: a.apu || t,
      cargoFwd: a.cargoFwd, cargoAft: a.cargoAft,
      bottleL: !!s['fire.bottle.L'], bottleR: !!s['fire.bottle.R'],
      bottleApu: !!s['fire.bottle.apu'], bottleCargo: !!s['fire.bottle.cargo'],
      testing: t,
      // extras
      wheelwell: a.wheelwell || t, ovht1, ovht2,
      fire: { eng1: a.eng1, eng2: a.eng2, apu: a.apu, cargoFwd: a.cargoFwd, cargoAft: a.cargoAft, wheelwell: a.wheelwell },
      out: { eng1: !!s['fire.out.eng1'], eng2: !!s['fire.out.eng2'], apu: !!s['fire.out.apu'], cargoFwd: !!s['fire.out.cargoFwd'], cargoAft: !!s['fire.out.cargoAft'], wheelwell: !!s['fire.out.wheelwell'] },
      handle: { eng1: s['fire.handle.eng1'], eng2: s['fire.handle.eng2'], apu: s['fire.handle.apu'] },
      unlocked: { eng1: a.eng1, eng2: a.eng2, apu: a.apu },
      discharging: { L: s['fire.dischT.L'] > 0, R: s['fire.dischT.R'] > 0, apu: s['fire.dischT.apu'] > 0, cargo: s['fire.dischT.cargo'] > 0 },
      dischTo: { L: s['fire.dischTo.L'], R: s['fire.dischTo.R'], cargo: s['fire.dischTo.cargo'] },
      armed: { fwd: !!s['fire.cargo.armFwd'], aft: !!s['fire.cargo.armAft'] },
      cutout: SOURCES.some((z) => a[z] && s[`fire.cut.${z}`]),
    };
  },

  ann(r) {
    return {
      'fire.warn': r.warn, 'fire.eng1': r.eng1, 'fire.eng2': r.eng2, 'fire.apu': r.apu,
      'fire.cargoFwd': r.cargoFwd, 'fire.cargoAft': r.cargoAft,
      'fire.bottleL': r.bottleL, 'fire.bottleR': r.bottleR, 'fire.bottleApu': r.bottleApu, 'fire.bottleCargo': r.bottleCargo,
      'fire.wheelwell': r.wheelwell, 'fire.ovht1': r.ovht1, 'fire.ovht2': r.ovht2,
    };
  },

  cats(r) { return r.ovht1 || r.ovht2 ? ['OVHT/DET'] : []; },

  categories: [{ id: 'sys-fire', label: 'Fire Protection' }],

  labels: {
    'fire.warn': ['FIRE WARN', 'red'],
    'fire.eng1': ['ENG 1 FIRE SWITCH', 'red'], 'fire.eng2': ['ENG 2 FIRE SWITCH', 'red'], 'fire.apu': ['APU FIRE SWITCH', 'red'],
    'fire.cargoFwd': ['FWD CARGO FIRE', 'red'], 'fire.cargoAft': ['AFT CARGO FIRE', 'red'],
    'fire.wheelwell': ['WHEEL WELL FIRE', 'red'],
    'fire.ovht1': ['ENG 1 OVERHEAT', 'amber'], 'fire.ovht2': ['ENG 2 OVERHEAT', 'amber'],
    'fire.bottleL': ['L BOTTLE DISCHARGE', 'amber'], 'fire.bottleR': ['R BOTTLE DISCHARGE', 'amber'],
    'fire.bottleApu': ['APU BOTTLE DISCHARGE', 'amber'], 'fire.bottleCargo': ['CARGO FIRE DISCH', 'amber'],
  },

  // Failures mode resets the fire panel to this before every scenario (bottles serviced, switches in).
  normal: {
    'fire.handle.eng1': 'IN', 'fire.handle.eng2': 'IN', 'fire.handle.apu': 'IN',
    'fire.bottle.L': false, 'fire.bottle.R': false, 'fire.bottle.apu': false, 'fire.bottle.cargo': false,
    'fire.cargo.armFwd': false, 'fire.cargo.armAft': false,
  },
  scenario: [],
};

// ================================================================== schematic
const engStatus = (c, n) => {
  const z = `eng${n}`;
  const f = c.fire;
  if (f.fire[z]) return handleOut(f.handle[z]) ? 'FIRE · SHUT OFF' : 'FIRE';
  if (f.out[z]) return handleOut(f.handle[z]) ? 'FIRE OUT · SHUT OFF' : 'FIRE OUT';
  if (f[`ovht${n}`] && !f.testing) return 'OVERHEAT';
  if (handleOut(f.handle[z])) return 'SHUT OFF';
  return c.eng[`run${n}`] ? 'RUNNING' : 'OFF';
};
const loopStatus = (c, z, ovht) => (c.fire.testing ? 'TEST' : c.fire.fire[z] ? 'FIRE' : ovht ? 'OVHT' : 'NORMAL');
const switchStatus = (c, z) => {
  const h = c.fire.handle[z];
  if (h === 'IN') return c.fire.unlocked[z] ? 'IN · UNLOCKED' : 'IN · LOCKED';
  if (h === 'PULLED') return 'PULLED · ARMED';
  return h === 'DISCH' ? 'DISCH' : `ROTATED ${h}`;
};
const bottleStatus = (c, b, discharged) => (c.fire.discharging[b] ? 'DISCHARGING' : discharged ? 'DISCHARGED' : '');
const into = (c, b, target) => c.fire.discharging[b] && c.fire.dischTo[b] === target;
const cargoInto = (c, comp) => c.fire.discharging.cargo && (c.fire.dischTo.cargo === comp || c.fire.dischTo.cargo === 'both');

const engCol = (n, x) => {
  const z = `eng${n}`;
  const ov = (c) => !!c.s[`fail.fire.ovht${n}`] && c.eng[`run${n}`];
  return [
    { id: `${z}-loopA`, kind: 'box', label: `ENG ${n} LOOP A`, x, y: 30, w: 180, h: 30, part: 'sys-fire-eng-det', active: (c) => c.fire.fire[z] || ov(c) || c.fire.testing, status: (c) => loopStatus(c, z, ov(c)) },
    { id: `${z}-loopB`, kind: 'box', label: `ENG ${n} LOOP B`, x, y: 68, w: 180, h: 30, part: 'sys-fire-eng-det', active: (c) => c.fire.fire[z] || ov(c) || c.fire.testing, status: (c) => loopStatus(c, z, ov(c)) },
    { id: `${z}-sw`, kind: 'box', label: `ENG ${n} FIRE SWITCH`, x, y: 120, w: 180, h: 46, part: 'sys-fire-eng-switch', active: (c) => c.fire[z],
      control: { key: `fire.handle.${z}`, type: 'cycle', values: ENG_HANDLE }, status: (c) => switchStatus(c, z) },
    { id: z, kind: 'box', label: `ENGINE ${n}`, x, y: 195, w: 180, h: 100, part: 'sys-fire-eng-switch', active: (c) => c.fire.fire[z] || c.fire[`ovht${n}`], status: (c) => engStatus(c, n) },
  ];
};

const fireSchematic = {
  id: 'fire', category: 'sys-fire', title: 'Fire Protection', color: 'fire',
  intro: 'Fire and overheat detection for the engines, APU, cargo compartments and main wheel well, with two engine bottles, an APU bottle and the cargo extinguisher. Click a fire switch to cycle IN, PULLED, rotate L, rotate R.',
  nodes: [
    ...engCol(1, 40),
    ...engCol(2, 780),
    // centre: warning, test, cutout
    { id: 'warn', kind: 'annun', label: 'FIRE WARN', x: 420, y: 30, w: 160, h: 34, part: 'sys-fire-warn', active: (c) => c.fire.warn },
    { id: 'test', kind: 'box', label: 'OVHT/FIRE TEST', x: 420, y: 74, w: 160, h: 30, part: 'sys-fire-test', active: (c) => c.fire.testing, control: { key: 'act.fire.test', type: 'action' }, status: (c) => (c.fire.testing ? 'ON' : '') },
    { id: 'bell', kind: 'box', label: 'BELL CUTOUT', x: 420, y: 112, w: 160, h: 30, part: 'sys-fire-warn', active: (c) => c.fire.bell, control: { key: 'act.fire.bellCutout', type: 'action' }, status: (c) => (c.fire.bell ? 'BELL' : c.fire.cutout ? 'SILENCED' : '') },
    // engine bottles
    { id: 'botL', kind: 'tank', label: 'L ENG BOTTLE', x: 290, y: 220, w: 170, h: 46, part: 'sys-fire-eng-bottles', active: (c) => !c.fire.bottleL, status: (c) => bottleStatus(c, 'L', c.fire.bottleL) },
    { id: 'botR', kind: 'tank', label: 'R ENG BOTTLE', x: 540, y: 220, w: 170, h: 46, part: 'sys-fire-eng-bottles', active: (c) => !c.fire.bottleR, status: (c) => bottleStatus(c, 'R', c.fire.bottleR) },
    { id: 'ww', kind: 'box', label: 'WHEEL WELL DET', x: 400, y: 336, w: 200, h: 30, part: 'sys-fire-wheelwell', active: (c) => c.fire.wheelwell, status: (c) => (c.fire.testing ? 'TEST' : c.fire.fire.wheelwell ? 'FIRE' : c.fire.out.wheelwell ? 'COOLED' : 'NORMAL') },
    { id: 'gear', kind: 'box', label: 'GEAR LEVER', x: 400, y: 374, w: 200, h: 30, part: 'sys-fire-wheelwell', active: (c) => c.s.gearLever === 'DN', control: { key: 'gearLever', type: 'cycle', values: ['UP', 'DN'] } },
    // APU block
    { id: 'lblApu', kind: 'label', label: 'APU', x: 40, y: 432 },
    { id: 'apuLoop', kind: 'box', label: 'APU DET LOOP', x: 40, y: 444, w: 200, h: 30, part: 'sys-fire-apu', active: (c) => c.fire.apu, status: (c) => (c.fire.testing ? 'TEST' : c.fire.fire.apu ? 'FIRE' : 'NORMAL') },
    { id: 'apuSw', kind: 'box', label: 'APU FIRE SWITCH', x: 40, y: 490, w: 200, h: 46, part: 'sys-fire-apu', active: (c) => c.fire.apu,
      control: { key: 'fire.handle.apu', type: 'cycle', values: APU_HANDLE }, status: (c) => switchStatus(c, 'apu') },
    { id: 'apuBot', kind: 'tank', label: 'APU BOTTLE', x: 40, y: 556, w: 200, h: 46, part: 'sys-fire-apu-bottle', active: (c) => !c.fire.bottleApu, status: (c) => bottleStatus(c, 'apu', c.fire.bottleApu) },
    { id: 'apuUnit', kind: 'box', label: 'APU', x: 280, y: 490, w: 160, h: 112, part: 'sys-fire-apu', active: (c) => c.fire.fire.apu,
      status: (c) => (c.fire.fire.apu ? 'FIRE' : c.fire.out.apu ? 'FIRE OUT' : c.s.apu ? (handleOut(c.fire.handle.apu) ? 'SHUT OFF' : 'RUNNING') : 'OFF') },
    // cargo block
    { id: 'lblCargo', kind: 'label', label: 'CARGO', x: 500, y: 432 },
    { id: 'fwdDet', kind: 'box', label: 'FWD SMOKE DET', x: 500, y: 444, w: 200, h: 30, part: 'sys-fire-cargo-det', active: (c) => c.fire.cargoFwd, status: (c) => (c.fire.fire.cargoFwd ? 'SMOKE' : 'NORMAL') },
    { id: 'aftDet', kind: 'box', label: 'AFT SMOKE DET', x: 760, y: 444, w: 200, h: 30, part: 'sys-fire-cargo-det', active: (c) => c.fire.cargoAft, status: (c) => (c.fire.fire.cargoAft ? 'SMOKE' : 'NORMAL') },
    { id: 'fwdArm', kind: 'box', label: 'FWD ARM', x: 500, y: 482, w: 200, h: 30, part: 'sys-fire-cargo-ext', active: (c) => c.fire.armed.fwd || c.fire.cargoFwd, control: { key: 'fire.cargo.armFwd', type: 'toggle', on: 'ARMED', off: 'NORM' } },
    { id: 'aftArm', kind: 'box', label: 'AFT ARM', x: 760, y: 482, w: 200, h: 30, part: 'sys-fire-cargo-ext', active: (c) => c.fire.armed.aft || c.fire.cargoAft, control: { key: 'fire.cargo.armAft', type: 'toggle', on: 'ARMED', off: 'NORM' } },
    { id: 'fwdComp', kind: 'box', label: 'FWD COMPARTMENT', x: 500, y: 520, w: 200, h: 30, part: 'sys-fire-cargo-det', active: (c) => c.fire.fire.cargoFwd, status: (c) => (c.fire.fire.cargoFwd ? 'FIRE' : c.fire.out.cargoFwd ? 'SUPPRESSED' : '') },
    { id: 'aftComp', kind: 'box', label: 'AFT COMPARTMENT', x: 760, y: 520, w: 200, h: 30, part: 'sys-fire-cargo-det', active: (c) => c.fire.fire.cargoAft, status: (c) => (c.fire.fire.cargoAft ? 'FIRE' : c.fire.out.cargoAft ? 'SUPPRESSED' : '') },
    { id: 'disch', kind: 'box', label: 'DISCH', x: 500, y: 576, w: 110, h: 34, part: 'sys-fire-cargo-ext', active: (c) => c.fire.discharging.cargo, control: { key: 'act.fire.cargoDisch', type: 'action' }, status: () => 'PUSH' },
    { id: 'cargoBot', kind: 'tank', label: 'CARGO BOTTLE(S)', x: 650, y: 570, w: 200, h: 46, part: 'sys-fire-cargo-ext', active: (c) => !c.fire.bottleCargo, status: (c) => bottleStatus(c, 'cargo', c.fire.bottleCargo) },
  ],
  lines: [
    // detection → fire switch light
    { pts: [[130, 98], [130, 120]], live: (c) => c.fire.eng1 },
    { pts: [[870, 98], [870, 120]], live: (c) => c.fire.eng2 },
    { pts: [[140, 474], [140, 490]], live: (c) => c.fire.apu },
    // L bottle: top route to both engines
    { pts: [[375, 220], [375, 182], [130, 182], [130, 195]], live: (c) => into(c, 'L', 'eng1') },
    { pts: [[375, 182], [870, 182], [870, 195]], live: (c) => into(c, 'L', 'eng2') },
    // R bottle: bottom route to both engines
    { pts: [[625, 266], [625, 318], [130, 318], [130, 295]], live: (c) => into(c, 'R', 'eng1') },
    { pts: [[625, 318], [870, 318], [870, 295]], live: (c) => into(c, 'R', 'eng2') },
    // APU bottle → APU
    { pts: [[240, 579], [280, 579]], live: (c) => c.fire.discharging.apu },
    // cargo
    { pts: [[600, 474], [600, 482]], live: (c) => c.fire.cargoFwd },
    { pts: [[860, 474], [860, 482]], live: (c) => c.fire.cargoAft },
    { pts: [[750, 570], [750, 562], [600, 562], [600, 550]], live: (c) => cargoInto(c, 'fwd') },
    { pts: [[750, 562], [860, 562], [860, 550]], live: (c) => cargoInto(c, 'aft') },
    { pts: [[610, 593], [650, 593]], live: (c) => c.fire.discharging.cargo },
  ],
};
fire.schematics = [fireSchematic];

// ================================================================== study content
fire.parts = [
  { id: 'sys-fire-eng-det', category: 'sys-fire', name: 'Engine Fire & Overheat Detection', where: 'Each engine nacelle',
    what: 'Two detector loops (A and B) run through each engine and sense both overheat and fire. Detection is powered from the battery bus.',
    how: 'With the OVHT DET selector in NORMAL both loops must agree before a warning is given. If one loop fails it is dropped automatically and the other works alone; the selector can also choose loop A or B. A fire lights both master FIRE WARN lights, the engine fire switch and rings the bell. An overheat lights ENG OVERHEAT, MASTER CAUTION and OVHT/DET.',
    notes: ['The light stays on until the loop cools below its alarm temperature, so treat the fire as still burning while the light is on.', 'In this model the detection loops never fail and the overheat clears once that engine stops.'] },
  { id: 'sys-fire-eng-switch', category: 'sys-fire', name: 'Engine Fire Switches', where: 'Fire protection panel (aft electronic panel)',
    what: 'One switch per engine. It is mechanically locked in until that engine has a fire warning, or until the manual override underneath is used.',
    how: 'Pulling it closes the engine and spar fuel shutoff valves, the engine bleed valve and the hydraulic fluid shutoff valve to the engine-driven pump, disables the thrust reverser, trips the generator and arms one squib on each engine bottle. Rotating it left or right then discharges the L or R bottle into that engine.',
    notes: ['Follow your QRH: many operators treat the engine fire procedure as memory items.', 'Here the schematic cycles IN, PULLED, rotate L, rotate R. Going from R back to IN pushes the switch in.', 'Simplification: there are no start levers here, so pushing a switch back in lets the engine run again.'] },
  { id: 'sys-fire-eng-bottles', category: 'sys-fire', name: 'Engine Fire Bottles', where: 'Main wheel well',
    what: 'Two engine fire extinguisher bottles (L and R). Either bottle can be discharged into either engine, so one engine can receive both.',
    how: 'Rotating a pulled engine fire switch toward L or R fires that bottle\'s squib for this engine. Each bottle has a BOTTLE DISCHARGE light that comes on when it has been discharged.',
    notes: ['Here one bottle puts the fire out a few seconds after discharge. In reality the procedure allows for a second bottle if the warning persists after a set time: see your QRH.'] },
  { id: 'sys-fire-apu', category: 'sys-fire', name: 'APU Fire Detection & Switch', where: 'APU compartment / fire protection panel',
    what: 'A single detector loop protects the APU. An APU fire lights the master FIRE WARN lights and the APU fire switch, rings the bell and shuts the APU down automatically.',
    how: 'The APU fire switch unlocks with an APU fire. Pulling it backs up the automatic shutdown, closes the APU fuel and bleed valves and the air inlet door, trips the APU generator and arms the bottle. Rotating it either way discharges the APU bottle.',
    notes: ['On the ground a warning horn also sounds and a light flashes in the main wheel well, and there is a ground-crew APU fire control panel there.', 'The APU won\'t restart here while its fire switch is pulled or the fire is still detected.'] },
  { id: 'sys-fire-apu-bottle', category: 'sys-fire', name: 'APU Fire Bottle', where: 'Tail, near the APU',
    what: 'One extinguisher bottle dedicated to the APU compartment.',
    how: 'Discharged by rotating the pulled APU fire switch (either direction). The APU BOTTLE DISCHARGE light comes on once it has been fired.',
    notes: [] },
  { id: 'sys-fire-cargo-det', category: 'sys-fire', name: 'Cargo Smoke Detection', where: 'Forward and aft cargo compartment ceilings',
    what: 'Smoke detectors in the forward and aft compartments, arranged in two loops per compartment.',
    how: 'Smoke detected in a compartment lights both master FIRE WARN lights and the FWD or AFT cargo fire light and rings the bell. A DETECTOR FAULT light and loop selectors cover detector failures.',
    notes: ['Detector faults and the separate cargo fire test are not modelled here.'] },
  { id: 'sys-fire-cargo-ext', category: 'sys-fire', name: 'Cargo Fire Extinguishing', where: 'Cargo fire panel',
    what: 'The cargo extinguisher bottle(s): one or two depending on the aircraft configuration. With two, the first discharges fully and the second follows at a reduced, metered rate to keep the fire suppressed.',
    how: 'Push the ARM switch for the affected compartment (FWD or AFT), then push DISCH. The amber DISCH light shows the bottle has discharged.',
    notes: ['Cargo extinguishing suppresses the fire rather than guaranteeing it is out: land at the nearest suitable airport per your QRH.', 'Here a single DISCH indication represents the cargo bottle(s).'] },
  { id: 'sys-fire-wheelwell', category: 'sys-fire', name: 'Wheel Well Fire Detection', where: 'Main wheel well ceiling',
    what: 'A single detector loop senses a fire in the main wheel well (typically hot brakes after a rejected takeoff or heavy braking). It needs AC power to work and test.',
    how: 'A fire lights both master FIRE WARN lights and the WHEEL WELL fire light and rings the bell. There is no extinguisher: extending the gear lets the airflow cool the wheel well.',
    notes: ['Mind the gear extension speed limits. Follow your QRH.', 'Here the warning clears after the gear has been down for about 15 seconds in flight (a study simplification).'] },
  { id: 'sys-fire-warn', category: 'sys-fire', name: 'FIRE WARN Lights & Bell', where: 'Glareshield (both pilots) and fire panel',
    what: 'Two red master FIRE WARN lights and the fire bell call attention to any engine, APU, cargo or wheel well fire warning.',
    how: 'Pushing either FIRE WARN light or the BELL CUTOUT switch silences the bell and turns off the master FIRE WARN lights, and resets the system so a new warning triggers them again. The individual fire lights (fire switch, cargo, wheel well) stay on while the fire is detected.',
    notes: [] },
  { id: 'sys-fire-test', category: 'sys-fire', name: 'Detection Test', where: 'Fire protection panel',
    what: 'The TEST switch checks the detection circuits. OVHT/FIRE tests the overheat and fire detection; FAULT/INOP tests the fault monitoring.',
    how: 'OVHT/FIRE should light the master FIRE WARN lights and bell, both engine fire switches, the APU fire switch, the WHEEL WELL light (with AC power), both ENG OVERHEAT lights, MASTER CAUTION and OVHT/DET.',
    notes: ['Here the test lights the indications for about 3 seconds. The separate extinguisher (squib) test and the cargo fire test are not modelled.'] },
];

// ================================================================== failure scenarios
const L = (text, good) => ({ text, state: good ? 'ok' : 'lost' });
const I = (text) => ({ text, state: 'info' });
const IN_FLIGHT = { onGround: false, engines: true, gearLever: 'UP' };
const handleText = (h) => (h === 'IN' ? 'in' : h === 'PULLED' ? 'pulled' : h === 'DISCH' ? 'rotated (discharge)' : `rotated ${h}`);

function engineFireEffects(c, n) {
  const z = `eng${n}`;
  const f = c.fire;
  const h = f.handle[z];
  const bottle = (b) => `${b} engine bottle${f[`bottle${b}`] ? ` discharged${f.dischTo[b] ? ` into engine ${f.dischTo[b].slice(-1)}` : ''}` : ' charged'}`;
  const next = f.fire[z]
    ? (h === 'IN' ? `Fire switch ${n} is unlocked. Click ENG ${n} FIRE SWITCH in the schematic to pull it.` : h === 'PULLED' ? 'Click the switch again to rotate it and discharge a bottle.' : 'Bottle discharged: the warning should go out in a few seconds.')
    : f.out[z] ? 'Fire out: the engine stays shut down and both its generator and engine-driven pump are lost.' : 'No fire warning.';
  return [
    L(f.fire[z] ? `Engine ${n} fire warning ON` : `Engine ${n} fire warning out`, !f.fire[z]),
    L(f.bell ? 'Fire bell ringing (press FIRE WARN or BELL CUTOUT)' : 'Fire bell silent', !f.bell),
    I(`Engine ${n} fire switch ${handleText(h)}`),
    L(`Engine ${n} running`, c.eng[`run${n}`]),
    L(`Generator ${n}`, c.elec.avail[`gen${n}`]),
    L(`AC transfer bus ${n}${c.elec[`bus${n}`] === `gen${3 - n}` ? ` (powered by GEN ${3 - n} via bus transfer)` : ''}`, c.elec[`tbus${n}`]),
    L(`System ${n === 1 ? 'A' : 'B'} engine-driven pump`, c.hyd.pumps[z]),
    L(`System ${n === 1 ? 'A' : 'B'} pressure (electric pump)`, n === 1 ? c.hyd.A : c.hyd.B),
    L(`Engine ${n} bleed air`, c.bleed[`eb${n}`]),
    L(bottle('L'), !f.bottleL),
    L(bottle('R'), !f.bottleR),
    I(next),
  ];
}

const ENG_KNOW = [
  'Follow your QRH. Many operators treat the engine fire procedure as memory items, done after positive control and at a safe height.',
  'Confirm the correct engine before pulling a fire switch: both pilots should agree on the switch that is lit.',
  'Pulling the switch shuts off fuel, bleed and hydraulic fluid to that engine and trips its generator. Rotating it fires a bottle.',
  'Two engine bottles serve both engines. Using one leaves one bottle for the other engine, or a second shot into the same engine if the warning persists.',
  'The master FIRE WARN lights and bell can be cancelled, but the fire switch light stays on while the fire is detected.',
];

fire.failures = [
  {
    id: 'fire-eng1-cruise', title: 'Engine 1 fire in flight', system: 'fire', group: 'Fire',
    setup: { ...IN_FLIGHT, flapLever: 0 }, flags: ['fail.fire.eng1'],
    summary: 'Both detection loops on engine 1 sense a fire: FIRE WARN lights, the bell and the engine 1 fire switch light come on and the switch unlocks. Pull it, then rotate it to fire a bottle.',
    effects: (c) => engineFireEffects(c, 1),
    know: ENG_KNOW,
  },
  {
    id: 'fire-eng2-takeoff', title: 'Engine 2 fire after takeoff', system: 'fire', group: 'Fire',
    setup: { ...IN_FLIGHT, flapLever: 5 }, flags: ['fail.fire.eng2'],
    summary: 'Engine 2 fire warning during the climb with flaps 5. Shutting engine 2 down loses the system B engine-driven pump, generator 2 and engine 2 bleed. Watch the PTU come in on the Hydraulics tab.',
    effects: (c) => [
      ...engineFireEffects(c, 2),
      L(c.eng.run2 ? 'System B LE devices (engine 2 pump)' : 'System B LE devices via the PTU', c.eng.run2 || c.hyd.ptu),
    ],
    know: [
      'Fly the aircraft first. Many operators do not action an engine fire below a set height after takeoff: follow your SOPs.',
      ...ENG_KNOW.slice(1, 4),
      'With engine 2 shut down and flaps between UP and 15, the PTU uses system A pressure to drive system B\'s leading-edge devices.',
    ],
  },
  {
    id: 'fire-apu-ground', title: 'APU fire on the ground', system: 'fire', group: 'Fire',
    setup: [{ gearLever: 'DN', flapLever: 0 }, 'settle', { onGround: true, engines: false, 'elec.bus1': 'ext', 'elec.bus2': 'ext', apu: true }, 'settle'], flags: ['fail.fire.apu'],
    summary: 'The APU detection loop senses a fire on the stand. FIRE WARN, the bell and the APU fire switch light come on, and the APU shuts itself down. Pull the switch and rotate it to fire the APU bottle.',
    effects: (c) => {
      const f = c.fire;
      return [
        L(f.fire.apu ? 'APU fire warning ON' : 'APU fire warning out', !f.fire.apu),
        L(f.bell ? 'Fire bell ringing' : 'Fire bell silent', !f.bell),
        I(c.s.apu ? 'APU still running' : 'APU shut down (automatic shutdown on fire)'),
        L('APU generator available', c.elec.avail.apu),
        I(`APU fire switch ${handleText(f.handle.apu)}`),
        L(f.bottleApu ? 'APU bottle discharged' : 'APU bottle charged', !f.bottleApu),
        L('AC buses (ground power)', c.elec.tbus1 && c.elec.tbus2),
        I(f.fire.apu ? (f.handle.apu === 'IN' ? 'Click APU FIRE SWITCH to pull it, then again to discharge.' : f.handle.apu === 'PULLED' ? 'Click the switch again to discharge the APU bottle.' : 'Bottle fired: the warning should go out shortly.') : f.out.apu ? 'Fire out. The APU stays off.' : 'No fire warning.'),
      ];
    },
    know: [
      'The APU shuts down automatically when its fire detector triggers. Pulling the switch backs that up and arms the bottle.',
      'On the ground a horn sounds and a light flashes in the main wheel well to alert ground crew, who can use the APU fire control panel there.',
      'There is one APU bottle: rotating the pulled switch in either direction fires it.',
      'Follow your QRH, and coordinate with ground crew and the fire services.',
    ],
  },
  {
    id: 'fire-cargo-fwd', title: 'Forward cargo fire', system: 'fire', group: 'Fire',
    setup: { ...IN_FLIGHT, flapLever: 0 }, flags: ['fail.fire.cargoFwd'],
    summary: 'Smoke detected in the forward cargo compartment. FIRE WARN, the bell and the FWD cargo fire light come on. Arm FWD, then push DISCH.',
    effects: (c) => {
      const f = c.fire;
      return [
        L(f.fire.cargoFwd ? 'FWD cargo fire warning ON' : 'FWD cargo fire warning out', !f.fire.cargoFwd),
        L(f.bell ? 'Fire bell ringing' : 'Fire bell silent', !f.bell),
        I(f.armed.fwd ? 'FWD cargo fire switch ARMED' : 'FWD cargo fire switch not armed'),
        f.armed.aft ? L('AFT armed as well (wrong compartment?)', false) : I('AFT not armed'),
        L(f.bottleCargo ? 'Cargo bottle(s) discharged (DISCH light)' : 'Cargo bottle(s) charged', !f.bottleCargo),
        L('Both engines still running', c.eng.run1 && c.eng.run2),
        I(f.fire.cargoFwd ? (!f.armed.fwd ? 'Click FWD ARM, then DISCH.' : !f.bottleCargo ? 'Click DISCH to fire the extinguisher.' : 'Agent discharged: the warning should go out shortly.') : 'Fire suppressed. Real procedures still call for landing at the nearest suitable airport.'),
      ];
    },
    know: [
      'Arm only the compartment that has the warning, then discharge. Follow your QRH.',
      'The cargo extinguisher suppresses the fire for a limited time; it does not guarantee it is out. Plan to land at the nearest suitable airport.',
      'Depending on configuration there are one or two cargo bottles: with two, the second meters agent in after the first to keep the fire suppressed.',
      'The cargo system shares no bottles with the engines or the APU.',
    ],
  },
  {
    id: 'fire-eng1-ovht', title: 'Engine 1 overheat', system: 'fire', group: 'Fire',
    setup: { ...IN_FLIGHT, flapLever: 0 }, flags: ['fail.fire.ovht1'],
    summary: 'Engine 1 detection loops sense an overheat, not a fire: ENG 1 OVERHEAT, MASTER CAUTION and OVHT/DET. There is no fire bell and the fire switch stays locked.',
    effects: (c) => {
      const f = c.fire;
      return [
        L(f.ovht1 ? 'ENG 1 OVERHEAT light ON' : 'ENG 1 OVERHEAT light out', !f.ovht1),
        L('No fire warning: master FIRE WARN and bell stay off', !f.warn),
        L(f.handle.eng1 === 'IN' ? 'Engine 1 fire switch locked (no fire warning)' : 'Engine 1 fire switch pulled (override)', f.handle.eng1 === 'IN'),
        L('Engine 1 running', c.eng.run1),
        L('Generator 1', c.elec.avail.gen1),
        L('Engine 1 bleed air', c.bleed.eb1),
        I('There are no thrust or start levers in this model: the light stays on while engine 1 runs. Pulling the switch with the override shows the shutdown effects.'),
      ];
    },
    know: [
      'An overheat is a caution (amber), not a fire warning: MASTER CAUTION and OVHT/DET, no bell, and the fire switch stays locked.',
      'Typical actions reduce thrust first, and shut the engine down if the light stays on. Follow your QRH.',
      'If a fire warning follows, the engine fire procedure applies.',
      'Overheat and fire are sensed by the same two loops, at different alarm temperatures.',
    ],
  },
  {
    id: 'fire-wheelwell', title: 'Wheel well fire after takeoff', system: 'fire', group: 'Fire',
    setup: { ...IN_FLIGHT, flapLever: 1 }, flags: ['fail.fire.wheelwell'],
    summary: 'The main wheel well detector senses a fire after the gear was retracted, typically from hot brakes. FIRE WARN, the bell and the WHEEL WELL light come on. There is no extinguisher.',
    effects: (c) => {
      const f = c.fire;
      return [
        L(f.fire.wheelwell ? 'WHEEL WELL fire warning ON' : 'WHEEL WELL fire warning out', !f.fire.wheelwell),
        L(f.bell ? 'Fire bell ringing' : 'Fire bell silent', !f.bell),
        I(`Gear lever ${c.s.gearLever}`),
        L('Engine bottles unaffected', !f.bottleL && !f.bottleR),
        I(f.fire.wheelwell ? (c.s.gearLever === 'DN' ? 'Gear down: airflow is cooling the wheel well.' : 'Click GEAR LEVER in the schematic to extend the gear.') : 'Warning cleared after the gear was extended.'),
      ];
    },
    know: [
      'No extinguisher covers the wheel well: extending the gear lets airflow cool it. Observe the gear extension speed limits.',
      'The detection loop needs AC power.',
      'Follow your QRH, including any guidance on keeping the gear down afterwards.',
    ],
  },
];

export default fire;
