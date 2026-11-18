// Controls for the DA42 exterior model and the logic that drives the moving parts.
// Same controller API as the 737 (state, get, set, apply, update, annunciators, readout,
// panel, settle, subscribe) so the dock, "Try it" buttons, walkaround and later modules
// (G1000 flight deck, schematics, failures, trainers) can plug in. Rates are sped up.
//
// Extensions (optional, same pattern as the 737): { id, state, set(key, value, api), update(dt, api),
// compute(state, out, api), ann(result, state, out), cats(result, state, out) }.
import * as THREE from 'three';
import { DEG, clamp } from '../../core/geometry.js';

export const FLAP_POSITIONS = ['UP', 'APP', 'LDG'];
export const FLAP_DEG = { UP: 0, APP: 20, LDG: 42 }; // TCDS flap settings

/** Generic control-panel schema rendered by the dock. */
export const controlPanel = [
  {
    id: 'phase', title: 'Phase',
    items: [{ type: 'segmented', key: 'onGround', vertical: true, options: [{ value: true, label: 'Ground' }, { value: false, label: 'Flight' }] }],
  },
  {
    id: 'flaps', title: 'Flaps',
    items: [
      { type: 'detent', key: 'flapLever', options: FLAP_POSITIONS.map((v) => ({ value: v, label: v })) },
      { type: 'readout', key: 'flapGauge', label: 'Flap pos' },
    ],
    annunciators: ['flapUp', 'flapApp', 'flapLdg'],
  },
  {
    id: 'gear', title: 'Landing gear',
    items: [{ type: 'segmented', key: 'gearLever', vertical: true, options: [{ value: 'UP', label: 'UP' }, { value: 'DN', label: 'DOWN' }] }],
    annunciators: ['gearL', 'gearN', 'gearR', 'gearUnsafe'],
  },
  {
    id: 'engines', title: 'Engines & props',
    items: [
      { type: 'toggle', key: 'eng1', label: 'L engine' },
      { type: 'toggle', key: 'eng2', label: 'R engine' },
      { type: 'toggle', key: 'feather1', label: 'L feather' },
      { type: 'toggle', key: 'feather2', label: 'R feather' },
    ],
    annunciators: ['engL', 'engR'],
  },
  {
    id: 'controls', title: 'Flight controls',
    items: [
      { type: 'slider', key: 'roll', label: 'Stick roll', min: -1, max: 1, step: 0.01, center: 0, ends: ['L', 'R'] },
      { type: 'slider', key: 'pitch', label: 'Stick pitch', min: -1, max: 1, step: 0.01, center: 0, ends: ['PUSH', 'PULL'] },
      { type: 'slider', key: 'yaw', label: 'Rudder', min: -1, max: 1, step: 0.01, center: 0, ends: ['L', 'R'] },
      { type: 'slider', key: 'elevTrim', label: 'Elev trim', min: -1, max: 1, step: 0.02, center: 0, ends: ['NOSE DN', 'NOSE UP'], readout: 'elevTrim' },
      { type: 'slider', key: 'rudderTrim', label: 'Rudder trim', min: -1, max: 1, step: 0.02, center: 0, ends: ['L', 'R'], readout: 'rudderTrim' },
    ],
  },
  {
    id: 'lights', title: 'Exterior lights',
    items: [
      { type: 'toggle', key: 'light.nav', label: 'Position' },
      { type: 'toggle', key: 'light.strobe', label: 'Strobe' },
      { type: 'toggle', key: 'light.landing', label: 'Landing' },
      { type: 'toggle', key: 'light.taxi', label: 'Taxi' },
      { type: 'toggle', key: 'light.ice', label: 'Ice light' },
    ],
  },
  {
    id: 'doors', title: 'Canopy & doors',
    items: [
      { type: 'toggle', key: 'canopy', label: 'Front canopy' },
      { type: 'toggle', key: 'rearDoor', label: 'Rear door' },
      { type: 'toggle', key: 'noseBaggage', label: 'Nose baggage' },
    ],
    annunciators: ['doorAnn'],
  },
];

const approach = (cur, target, rate, dt) => {
  const d = target - cur;
  const step = rate * dt;
  return Math.abs(d) <= step ? target : cur + Math.sign(d) * step;
};
// Accept the 737-style numeric flap values used by shared code (0 = UP) as well as detent names.
const normFlap = (v) => {
  if (FLAP_POSITIONS.includes(v)) return v;
  if (typeof v === 'number') return v <= 0 ? 'UP' : v < 30 ? 'APP' : 'LDG';
  return null;
};

export function createSystems(rig, extensions = []) {
  const state = {
    onGround: true,
    flapLever: 'UP',
    gearLever: 'DN',
    eng1: false, eng2: false,
    feather1: false, feather2: false,
    roll: 0, pitch: 0, yaw: 0, elevTrim: 0, rudderTrim: 0,
    'light.nav': false, 'light.strobe': false, 'light.landing': false, 'light.taxi': false, 'light.ice': false,
    canopy: false, rearDoor: false, noseBaggage: false,
  };
  for (const ext of extensions) Object.assign(state, ext.state || {});

  const cur = {
    flap: 0, gear: 0, noseDoor: 1, ail: 0, elev: 0, rud: 0, eTrim: 0, rTrim: 0,
    canopy: 0, rearDoor: 0, noseBaggage: 0, lift: 0,
    rpm: [0, 0], spin: [0, 0], pitch: [15, 15],
  };
  const listeners = new Set();
  const emit = (msg) => listeners.forEach((fn) => fn(msg));
  const deny = (message) => ({ ok: false, message });
  const info = (message) => emit({ type: 'info', message });
  const gearDownLocked = () => cur.gear <= 0.0001 && state.gearLever === 'DN';
  const anyDoor = () => state.canopy || state.rearDoor || state.noseBaggage;

  function setEngine(n, on) {
    const k = `eng${n}`;
    if (on === state[k]) return { ok: true };
    const other = state[`eng${3 - n}`];
    if (!on && !state.onGround && !other) return deny('Shutting down the only running engine in flight isn\'t simulated here. Land first, or restart the other engine.');
    if (on && !state.onGround && state[`feather${n}`]) {
      state[`feather${n}`] = false;
      info(`${n === 1 ? 'Left' : 'Right'} engine air restart: the propeller is brought out of feather (unfeathering accumulator where fitted) and the starter turns the engine. Follow the AFM restart procedure and limits.`);
    }
    state[k] = !!on;
    if (!on && !state.onGround) {
      state[`feather${n}`] = true;
      info(`${n === 1 ? 'Left' : 'Right'} engine shut down in flight: with the ENGINE MASTER off, the governor loses control oil pressure and the propeller feathers on its own (as long as it is still turning fast enough).`);
    }
    return { ok: true };
  }

  function set(key, value) {
    for (const ext of extensions) {
      const r = ext.set?.(key, value, api);
      if (r) { if (r.ok) emit({ type: 'state' }); return r; }
    }
    switch (key) {
      case 'onGround': {
        if (value === state.onGround) return { ok: true };
        if (value) {
          if (!gearDownLocked()) return deny('The gear isn\'t down and locked. Select gear DOWN and wait for three green before landing.');
          state.onGround = true;
        } else {
          if (anyDoor()) return deny('Close and lock the canopy, rear door and nose baggage doors before takeoff. The DOOR warning would be on.');
          if (state.flapLever === 'LDG') return deny('LDG flaps aren\'t a takeoff setting. The DA42 takes off with flaps UP or APP (per the AFM).');
          state.onGround = false;
          // flying implies both engines running with props unfeathered
          state.eng1 = true; state.eng2 = true; state.feather1 = false; state.feather2 = false;
        }
        break;
      }
      case 'gearLever':
        if (value !== 'UP' && value !== 'DN') return deny('The gear lever has two positions: UP and DOWN.');
        if (value === 'UP' && state.onGround) return deny('Weight on wheels: the gear can\'t be retracted on the ground (a safety switch on the gear prevents it).');
        state.gearLever = value;
        break;
      case 'flapLever': {
        const v = normFlap(value);
        if (!v) return deny('Flap positions are UP, APP and LDG.');
        if (!state.onGround && v !== 'UP' && v !== state.flapLever) {
          info(v === 'APP'
            ? 'Flaps APP (20°): check you are at or below VFE APP, about 137 KIAS on the NG (see your AFM).'
            : 'Flaps LDG (42°): check you are at or below VFE LDG, about 111 KIAS on the NG (see your AFM).');
        }
        state.flapLever = v;
        break;
      }
      case 'eng1': case 'eng2': {
        const r = setEngine(key === 'eng1' ? 1 : 2, !!value);
        if (!r.ok) return r;
        break;
      }
      case 'engines': {
        if (!value && !state.onGround) return deny('Both engines can\'t be shut down in flight here. Land first.');
        state.eng1 = !!value; state.eng2 = !!value;
        if (value) { state.feather1 = false; state.feather2 = false; }
        break;
      }
      case 'feather1': case 'feather2': {
        const n = key === 'feather1' ? 1 : 2;
        if (!!value === state[key]) return { ok: true };
        if (value) {
          if (state.onGround) return deny('On the ground the start-lock pins hold the blades near fine pitch when the engine stops, so the propeller doesn\'t feather.');
          if (state[`eng${n}`]) return deny('The AE300 propeller feathers when that engine is shut down (ENGINE MASTER off) in flight. Shut the engine down to feather it.');
          state[key] = true;
        } else {
          if (!state.onGround && !state[`eng${n}`]) {
            info('Unfeathering in flight is part of the air restart: switching that engine back on brings the blades out of feather.');
            return { ok: true };
          }
          state[key] = false;
        }
        break;
      }
      case 'roll': case 'pitch': case 'yaw': case 'elevTrim': case 'rudderTrim':
        state[key] = clamp(Number(value) || 0, -1, 1);
        break;
      case 'canopy': case 'rearDoor': case 'noseBaggage':
        if (value && !state.onGround) return deny('Doors stay closed and locked in flight. If a canopy or door ever unlocks in flight, follow the AFM procedure.');
        if (key === 'canopy' && value && (state.eng1 || state.eng2)) info('Canopy open with an engine running: keep clear of the propellers and only taxi with the canopy as your AFM allows.');
        state[key] = !!value;
        break;
      case 'doors':
        // aggregate used by shared code: closes (or opens) the canopy and both door sets
        if (value && !state.onGround) return deny('Doors stay closed and locked in flight.');
        state.canopy = !!value; state.rearDoor = !!value; state.noseBaggage = !!value;
        break;
      default:
        if (key in state) state[key] = value;
        else return deny(`The DA42 doesn't have a "${key}" control.`);
    }
    emit({ type: 'state' });
    return { ok: true };
  }

  const get = (k) => {
    if (k === 'engines') return state.eng1 && state.eng2;
    if (k === 'doors') return anyDoor();
    return state[k];
  };

  /** Minimal systems snapshot. Later modules (electrical, fuel, gear hydraulics...) extend this. */
  function panel() {
    const eng = { run1: state.eng1, run2: state.eng2, feather1: state.feather1, feather2: state.feather2 };
    const ann = {
      'gear.unsafe': annunciators().gearUnsafe.state === 'red',
      'door.open': anyDoor(),
      'eng1.off': !state.eng1, 'eng2.off': !state.eng2,
    };
    const cats = new Set();
    const out = { eng, gear: { pos: cur.gear, lever: state.gearLever }, flaps: { pos: cur.flap, lever: state.flapLever }, ann, cats };
    for (const ext of extensions) {
      if (!ext.compute) continue;
      out[ext.id] = ext.compute(state, out, api);
      Object.assign(ann, ext.ann?.(out[ext.id], state, out) || {});
      for (const c of ext.cats?.(out[ext.id], state, out) || []) cats.add(c);
    }
    return out;
  }

  /** Jump animated parts to their commanded positions (scenario setup). */
  function settle() {
    cur.gear = state.gearLever === 'UP' ? 1 : 0;
    cur.noseDoor = cur.gear >= 1 ? 0 : 1;
    cur.flap = FLAP_DEG[state.flapLever];
    cur.lift = state.onGround ? 0 : 1;
    cur.canopy = state.canopy ? 1 : 0;
    cur.rearDoor = state.rearDoor ? 1 : 0;
    cur.noseBaggage = state.noseBaggage ? 1 : 0;
  }

  /** Apply several settings in order (used by "Try it" buttons). */
  function apply(settings) {
    for (const [k, v] of Object.entries(settings)) {
      if (k === 'gearLever' && v === 'UP' && settings.onGround === false) continue; // after takeoff, below
      const r = set(k, v);
      if (!r.ok) return r;
    }
    if (settings.gearLever === 'UP' && settings.onGround === false) return set('gearLever', 'UP');
    return { ok: true };
  }

  // ------------------------------------------------------------------ simulation
  const hinge = (h, angle) => h?.pivot.quaternion.setFromAxisAngle(h.axis, angle);
  const tmp = new THREE.Vector3();
  let t = 0;

  function update(dt) {
    t += dt;
    for (const ext of extensions) ext.update?.(dt, api);

    // flaps (electric, sped up): Fowler-like aft travel then rotation
    cur.flap = approach(cur.flap, FLAP_DEG[state.flapLever], 14, dt);
    const travel = Math.min(1, cur.flap / 20);
    for (const f of rig.flaps) {
      const k = 0.07 * f.chord * travel;
      f.pivot.position.copy(f.base).add(tmp.set(-k, -k * 0.25, 0));
      hinge(f, cur.flap * DEG);
    }

    // primary controls (TCDS throws: aileron 25 up / 15 down, elevator 15.5 up / 13 down, rudder 27 L / 29 R)
    cur.ail = approach(cur.ail, state.roll, 2.5, dt);
    for (const a of rig.ailerons) {
      const cmd = cur.ail * a.side; // + = trailing edge up on this wing
      hinge(a, cmd > 0 ? -cmd * 25 * DEG : -cmd * 15 * DEG);
    }
    cur.elev = approach(cur.elev, state.pitch, 2.5, dt);
    for (const e of rig.elevators) hinge(e, cur.elev > 0 ? -cur.elev * 15.5 * DEG : -cur.elev * 13 * DEG);
    cur.rud = approach(cur.rud, state.yaw, 2.2, dt);
    hinge(rig.rudder, cur.rud > 0 ? cur.rud * 29 * DEG : cur.rud * 27 * DEG);
    // trim tabs move opposite to the surface they trim: nose-up trim = tab trailing edge down
    cur.eTrim = approach(cur.eTrim, state.elevTrim, 1.2, dt);
    hinge(rig.elevatorTab, cur.eTrim * 26 * DEG);
    cur.rTrim = approach(cur.rTrim, state.rudderTrim, 1.2, dt);
    hinge(rig.rudderTab, -cur.rTrim * 30 * DEG);

    // gear: 0 = down & locked, 1 = up & locked (electro-hydraulic, sped up)
    if (state.gearLever === 'UP') {
      cur.gear = approach(cur.gear, 1, 0.33, dt);
      if (cur.gear >= 1) cur.noseDoor = approach(cur.noseDoor, 0, 1.6, dt);
    } else {
      cur.noseDoor = approach(cur.noseDoor, 1, 2.2, dt);
      cur.gear = approach(cur.gear, 0, 0.36, dt);
    }
    for (const g of rig.mainGear) hinge(g, g.side * cur.gear * 90 * DEG);
    hinge(rig.noseGear, cur.gear * 95 * DEG);
    for (const d of rig.noseDoors) hinge(d, d.angle * cur.noseDoor);
    // the open wheel bays only show while the gear is out of its wells
    for (const w of rig.gearWells || []) w.visible = cur.gear < 0.995;

    // propellers: spin while running; blade angle fine pitch (running), start lock (stopped on ground), feather
    const run = [state.eng1, state.eng2];
    const feath = [state.feather1, state.feather2];
    rig.props.forEach((p, i) => {
      const n = p.side < 0 ? 0 : 1;
      cur.rpm[n] = approach(cur.rpm[n], run[n] ? 1 : 0, run[n] ? 0.8 : 0.45, dt);
      cur.spin[n] += cur.rpm[n] * 26 * dt;
      p.spin.rotation.x = cur.spin[n];
      const target = feath[n] ? 80 : run[n] ? 18 : 15;
      cur.pitch[n] = approach(cur.pitch[n], target, 60, dt);
      for (const b of p.blades) b.rotation.y = cur.pitch[n] * DEG;
      void i;
    });

    // canopy and doors
    for (const k of ['canopy', 'rearDoor', 'noseBaggage']) cur[k] = approach(cur[k], state[k] ? 1 : 0, 0.9, dt);
    hinge(rig.canopy, rig.canopy?.angle * cur.canopy);
    hinge(rig.rearDoor, rig.rearDoor?.angle * cur.rearDoor);
    for (const d of rig.noseBaggage) hinge(d, d.angle * cur.noseBaggage);

    // aircraft height (lift off / touch down)
    cur.lift = approach(cur.lift, state.onGround ? 0 : 1, 0.5, dt);
    const e = cur.lift * cur.lift * (3 - 2 * cur.lift);
    rig.airframe.position.y = e * 1.6;

    updateLights();
  }

  function setBulb(L, on, k = 1) {
    const base = L.mesh.userData.baseEmissive || (L.mesh.userData.baseEmissive = new THREE.Color());
    base.copy(L.color).multiplyScalar(on ? 2.2 * k : 0);
    if (!L.mesh.userData.hl) L.mesh.material.emissive.copy(base);
    L.sprite.visible = on && k > 0.05;
    L.sprite.material.opacity = Math.min(1, k);
    if (L.spot) L.spot.intensity = on ? 25 * k : 0;
  }

  function updateLights() {
    const lt = rig.lights;
    const ph = t % 1.1;
    const strobeOn = ph < 0.05 || (ph > 0.14 && ph < 0.19);
    lt.nav.forEach((L) => setBulb(L, state['light.nav']));
    lt.strobe.forEach((L) => setBulb(L, state['light.strobe'] && strobeOn));
    lt.landing.forEach((L) => setBulb(L, state['light.landing']));
    lt.taxi.forEach((L) => setBulb(L, state['light.taxi']));
    lt.ice.forEach((L) => setBulb(L, state['light.ice']));
  }

  // ------------------------------------------------------------------ indications
  function annunciators() {
    const transit = cur.gear > 0.0001 && cur.gear < 0.9999;
    const disagree = (state.gearLever === 'UP' && cur.gear < 0.9999) || (state.gearLever === 'DN' && cur.gear > 0.0001);
    const green = cur.gear <= 0.0001 ? 'green' : 'off';
    // gear warning: landing flaps selected with the gear not down (simplified; the real horn also uses power lever position)
    const warn = !state.onGround && state.flapLever === 'LDG' && cur.gear > 0.0001;
    const flapAt = (pos) => {
      const tgt = FLAP_DEG[pos];
      if (Math.abs(cur.flap - tgt) < 0.05) return pos === 'UP' ? 'green' : 'amber';
      return state.flapLever === pos ? (Math.floor(t * 3) % 2 ? 'amber' : 'off') : 'off'; // flashes while moving
    };
    const engAnn = (n) => {
      const r = state[`eng${n}`], f = state[`feather${n}`];
      const side = n === 1 ? 'L' : 'R';
      if (f) return { label: `${side} FEATHERED`, state: 'amber' };
      return { label: `${side} ENG ${r ? 'RUN' : 'OFF'}`, state: r ? 'green' : 'off' };
    };
    return {
      flapUp: { label: 'FLAPS UP', state: flapAt('UP') },
      flapApp: { label: 'APP', state: flapAt('APP') },
      flapLdg: { label: 'LDG', state: flapAt('LDG') },
      gearL: { label: 'L', state: green },
      gearN: { label: 'N', state: green },
      gearR: { label: 'R', state: green },
      gearUnsafe: { label: warn ? 'CHECK GEAR' : 'GEAR UNSAFE', state: transit || disagree || warn ? 'red' : 'off' },
      engL: engAnn(1),
      engR: engAnn(2),
      doorAnn: { label: 'DOOR', state: cur.canopy > 0.001 || cur.rearDoor > 0.001 || cur.noseBaggage > 0.001 ? 'red' : 'off' },
    };
  }

  function readout(key) {
    if (key === 'flapGauge') {
      const f = cur.flap;
      for (const p of FLAP_POSITIONS) if (Math.abs(f - FLAP_DEG[p]) < 0.05) return `${p} ${FLAP_DEG[p]}°`;
      return `${f.toFixed(0)}°`;
    }
    if (key === 'elevTrim') {
      const v = cur.eTrim;
      return Math.abs(v) < 0.03 ? 'T/O' : `${v > 0 ? 'UP' : 'DN'} ${Math.round(Math.abs(v) * 100)}%`;
    }
    if (key === 'rudderTrim') {
      const v = cur.rTrim;
      return Math.abs(v) < 0.03 ? 'NEUT' : `${v > 0 ? 'R' : 'L'} ${Math.round(Math.abs(v) * 100)}%`;
    }
    return '';
  }

  // read-only view handed to extensions
  const api = {
    state, emit, deny,
    set: (k, v) => set(k, v),
    get,
    panel: () => panel(),
    get gearPos() { return cur.gear; },
    get flapPos() { return cur.flap; },
    get eng1Run() { return state.eng1; },
    get eng2Run() { return state.eng2; },
    get propRpm() { return [...cur.rpm]; },
    get time() { return t; },
  };

  return {
    state,
    get,
    set,
    apply,
    update,
    annunciators,
    readout,
    panel,
    settle,
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
  };
}
