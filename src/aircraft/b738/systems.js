// Cockpit-style controls for the 737-800 exterior model and the logic that
// drives the moving surfaces. Rates are sped up for demonstration.
import * as THREE from 'three';
import { DEG, clamp } from '../../core/geometry.js';

export const FLAP_DETENTS = [0, 1, 2, 5, 10, 15, 25, 30, 40];

/** Generic control-panel schema. The UI renders these without knowing the aircraft. */
export const controlPanel = [
  {
    id: 'phase', title: 'Phase',
    items: [{ type: 'segmented', key: 'onGround', vertical: true, options: [{ value: true, label: 'Ground' }, { value: false, label: 'Flight' }] }],
  },
  {
    id: 'flaps', title: 'Flap lever',
    items: [
      { type: 'detent', key: 'flapLever', options: FLAP_DETENTS.map((v) => ({ value: v, label: v === 0 ? 'UP' : String(v) })) },
      { type: 'readout', key: 'flapGauge', label: 'Flap pos' },
    ],
    annunciators: ['leTransit', 'leExt'],
  },
  {
    id: 'gear', title: 'Landing gear',
    items: [{ type: 'segmented', key: 'gearLever', vertical: true, options: [{ value: 'UP', label: 'UP' }, { value: 'OFF', label: 'OFF' }, { value: 'DN', label: 'DN' }] }],
    annunciators: ['gearL', 'gearN', 'gearR'],
  },
  {
    id: 'speedbrake', title: 'Speed brake',
    items: [{ type: 'segmented', key: 'speedbrake', vertical: true, options: [
      { value: 'DOWN', label: 'DOWN' }, { value: 'ARMED', label: 'ARMED' }, { value: 'FLIGHT', label: 'FLT DET' }, { value: 'UP', label: 'UP' },
    ] }],
    annunciators: ['sbArmed', 'sbExt'],
  },
  {
    id: 'controls', title: 'Flight controls',
    items: [
      { type: 'slider', key: 'roll', label: 'Wheel', min: -1, max: 1, step: 0.01, center: 0, ends: ['L', 'R'] },
      { type: 'slider', key: 'pitch', label: 'Column', min: -1, max: 1, step: 0.01, center: 0, ends: ['PUSH', 'PULL'] },
      { type: 'slider', key: 'yaw', label: 'Rudder', min: -1, max: 1, step: 0.01, center: 0, ends: ['L', 'R'] },
      { type: 'slider', key: 'stabTrim', label: 'Stab trim', min: 0, max: 17, step: 0.25, center: 5, ends: ['NOSE DN', 'NOSE UP'], readout: 'stabUnits' },
    ],
  },
  {
    id: 'engines', title: 'Engines & APU',
    items: [
      { type: 'toggle', key: 'reversers', label: 'Reverse thrust' },
      { type: 'toggle', key: 'apu', label: 'APU' },
      { type: 'toggle', key: 'doors', label: 'Doors open' },
    ],
    annunciators: ['rev', 'apuGen', 'doorsAnn'],
  },
  {
    id: 'lights', title: 'Exterior lights',
    items: [
      { type: 'toggle', key: 'light.nav', label: 'Position' },
      { type: 'toggle', key: 'light.strobe', label: 'Strobe' },
      { type: 'toggle', key: 'light.beacon', label: 'Anti-coll' },
      { type: 'toggle', key: 'light.landing', label: 'Landing' },
      { type: 'toggle', key: 'light.turnoff', label: 'Turnoff' },
      { type: 'toggle', key: 'light.taxi', label: 'Taxi' },
      { type: 'toggle', key: 'light.logo', label: 'Logo' },
      { type: 'toggle', key: 'light.wing', label: 'Wing' },
    ],
  },
];

const approach = (cur, target, rate, dt) => {
  const d = target - cur;
  const step = rate * dt;
  return Math.abs(d) <= step ? target : cur + Math.sign(d) * step;
};

export function createSystems(rig) {
  const state = {
    onGround: true,
    flapLever: 0,
    gearLever: 'DN',
    speedbrake: 'DOWN',
    roll: 0, pitch: 0, yaw: 0, stabTrim: 5,
    reversers: false, apu: false, doors: false,
    'light.nav': true, 'light.strobe': false, 'light.beacon': false, 'light.landing': false,
    'light.turnoff': false, 'light.taxi': false, 'light.logo': false, 'light.wing': false,
  };
  // animated values
  const cur = {
    flap: 0, slat: 0, krueger: 0, gear: 0, noseDoor: 1,
    ail: 0, elev: 0, rud: 0, stab: 5, fs: [0, 0, 0, 0, 0, 0, 0, 0], gs: 0,
    rev: 0, doors: 0, apuDoor: 0, apuSpool: 0, lift: 0,
  };
  const listeners = new Set();
  const emit = (msg) => listeners.forEach((fn) => fn(msg));

  const deny = (message) => ({ ok: false, message });
  const gearDownLocked = () => cur.gear <= 0.0001 && state.gearLever !== 'UP';

  function set(key, value) {
    switch (key) {
      case 'onGround': {
        if (value === state.onGround) return { ok: true };
        if (value) {
          if (!gearDownLocked()) return deny('Gear isn\'t down and locked. Select gear DN before landing.');
          state.onGround = true;
          if (state.speedbrake === 'ARMED') {
            state.speedbrake = 'UP';
            emit({ type: 'info', message: 'Touchdown with speed brake ARMED: the lever drives to UP and all spoilers deploy.' });
          }
        } else {
          if (state.reversers) return deny('Stow the thrust reversers before takeoff.');
          if (state.doors) return deny('Close all doors before takeoff.');
          state.onGround = false;
          if (state.speedbrake === 'UP') state.speedbrake = 'DOWN';
        }
        break;
      }
      case 'gearLever':
        if (value === 'UP' && state.onGround) {
          return deny('Gear lever lock: the lever can\'t be raised with weight on wheels. An override trigger exists, but don\'t use it here.');
        }
        state.gearLever = value;
        if (value === 'OFF') emit({ type: 'info', message: 'Gear lever OFF: hydraulic pressure is removed from the gear system. The gear stays where it is.' });
        break;
      case 'speedbrake':
        if (value === 'UP' && !state.onGround) emit({ type: 'info', message: 'In flight only the flight spoilers rise. The ground spoilers stay locked down. Beyond the flight detent you\'ll feel buffet.' });
        state.speedbrake = value;
        break;
      case 'reversers':
        if (value && !state.onGround) return deny('Reversers deploy only on the ground (air/ground sensing or RA below about 10 ft).');
        state.reversers = value;
        break;
      case 'doors':
        if (value && !state.onGround) return deny('Doors can\'t be opened in flight: the cabin is pressurized and the plug doors are locked.');
        state.doors = value;
        break;
      case 'flapLever':
        state.flapLever = FLAP_DETENTS.includes(value) ? value : 0;
        break;
      case 'roll': case 'pitch': case 'yaw':
        state[key] = clamp(Number(value), -1, 1);
        break;
      case 'stabTrim':
        state.stabTrim = clamp(Number(value), 0, 17);
        break;
      default:
        if (key in state) state[key] = value;
        else return deny(`Unknown control ${key}`);
    }
    emit({ type: 'state' });
    return { ok: true };
  }

  /** Apply several settings in order (used by "Try it" buttons). */
  function apply(settings) {
    for (const [k, v] of Object.entries(settings)) {
      if (k === 'gearLever' && v === 'UP' && settings.onGround === false) continue; // set after takeoff below
      const r = set(k, v);
      if (!r.ok) return r;
    }
    if (settings.gearLever === 'UP' && settings.onGround === false) return set('gearLever', 'UP');
    return { ok: true };
  }

  // ------------------------------------------------------------------ simulation
  const q = new THREE.Quaternion();
  const hinge = (h, angle) => h.pivot.quaternion.setFromAxisAngle(h.axis, angle);
  let t = 0;

  function update(dt) {
    t += dt;
    // flaps (deg/s) and LE devices
    cur.flap = approach(cur.flap, state.flapLever, 7, dt);
    const slatTarget = state.flapLever === 0 ? 0 : state.flapLever <= 5 ? 0.55 : 1;
    // autoslat-style: LE devices extend as soon as flaps leave UP, retract once flaps are up
    const leGo = state.flapLever > 0 || cur.flap < 0.4;
    cur.slat = approach(cur.slat, leGo ? slatTarget : cur.slat, 0.45, dt);
    cur.krueger = approach(cur.krueger, leGo ? (state.flapLever > 0 ? 1 : 0) : cur.krueger, 0.6, dt);

    // landing gear sequence: 0 = down & locked, 1 = up & locked
    if (state.gearLever === 'UP') {
      cur.noseDoor = cur.gear < 0.98 ? approach(cur.noseDoor, 1, 2, dt) : cur.noseDoor;
      if (cur.noseDoor >= 0.999 || cur.gear > 0) cur.gear = approach(cur.gear, 1, 0.3, dt);
      if (cur.gear >= 1) cur.noseDoor = approach(cur.noseDoor, 0, 1.4, dt);
    } else if (state.gearLever === 'DN') {
      cur.noseDoor = approach(cur.noseDoor, 1, 1.6, dt);
      if (cur.noseDoor >= 0.999) cur.gear = approach(cur.gear, 0, 0.32, dt);
    }

    // speed brake / spoilers
    const ground = state.onGround;
    let fsBase = 0, gsTarget = 0;
    if (state.speedbrake === 'FLIGHT') fsBase = 0.45;
    if (state.speedbrake === 'UP') { fsBase = ground ? 1 : 0.75; gsTarget = ground ? 1 : 0; }
    cur.gs = approach(cur.gs, gsTarget, 1.5, dt);
    // roll: positive = roll right
    cur.ail = approach(cur.ail, state.roll, 2.5, dt);
    const assist = Math.max(0, (Math.abs(cur.ail) - 0.12) / 0.88) * 0.8;
    const rollSide = Math.sign(cur.ail); // +1 right wing spoilers rise
    let fi = 0;
    for (const sp of rig.flightSpoilers) {
      const extra = rollSide === sp.side ? assist : 0;
      const target = clamp(fsBase + extra, 0, 1);
      cur.fs[fi] = approach(cur.fs[fi], target, 2.2, dt);
      hinge(sp, -cur.fs[fi] * 42 * DEG);
      fi++;
    }
    for (const sp of rig.groundSpoilers) hinge(sp, -cur.gs * 46 * DEG);

    // ailerons: right roll -> right aileron up (negative), left aileron down
    for (const a of rig.ailerons) {
      const cmd = cur.ail * a.side; // + means TE up on this wing
      hinge(a, cmd > 0 ? -cmd * 20 * DEG : -cmd * 15 * DEG);
    }

    cur.elev = approach(cur.elev, state.pitch, 2.5, dt);
    for (const e of rig.elevators) hinge(e, cur.elev > 0 ? -cur.elev * 22 * DEG : -cur.elev * 15 * DEG);
    cur.rud = approach(cur.rud, state.yaw, 2.2, dt);
    if (rig.rudder) hinge(rig.rudder, cur.rud * 26 * DEG);
    cur.stab = approach(cur.stab, state.stabTrim, 3, dt);
    if (rig.stab) hinge(rig.stab, -(cur.stab - 4.2) * 0.9 * DEG);

    // flaps: Fowler motion (translate aft first, then rotate)
    const fl = cur.flap;
    const travel = Math.min(1, fl / 15);
    for (const f of rig.flaps) {
      const fc = 0.25 * f.chord;
      f.pivot.position.copy(f.base).add(new THREE.Vector3(-fc * 0.55 * travel, -fc * 0.12 * travel, 0));
      hinge(f, Math.min(fl, 40) * DEG);
    }
    for (const s of rig.slats) {
      const sc = 0.14 * s.chord;
      s.pivot.position.copy(s.base).add(new THREE.Vector3(sc * 0.65 * cur.slat, -sc * 0.35 * cur.slat, 0));
      hinge(s, -cur.slat * 22 * DEG);
    }
    for (const k of rig.kruegers) hinge(k, cur.krueger * 112 * DEG);

    // gear
    for (const g of rig.mainGear) hinge(g, g.side * cur.gear * 88 * DEG);
    if (rig.noseGear) hinge(rig.noseGear, cur.gear * 96 * DEG);
    for (const d of rig.noseDoors) hinge(d, d.angle * cur.noseDoor);

    // reversers, doors, APU
    cur.rev = approach(cur.rev, state.reversers ? 1 : 0, 1.0, dt);
    for (const r of rig.reversers) r.sleeve.position.x = -0.62 * cur.rev;
    cur.doors = approach(cur.doors, state.doors ? 1 : 0, 0.7, dt);
    for (const d of rig.doors) hinge(d, d.angle * cur.doors);
    cur.apuDoor = approach(cur.apuDoor, state.apu ? 1 : 0, 0.6, dt);
    cur.apuSpool = state.apu ? (cur.apuDoor >= 1 ? approach(cur.apuSpool, 1, 0.25, dt) : cur.apuSpool) : approach(cur.apuSpool, 0, 0.5, dt);
    if (rig.apuDoor) hinge(rig.apuDoor, rig.apuDoor.angle * cur.apuDoor);

    // aircraft height (lift off / touch down)
    cur.lift = approach(cur.lift, ground ? 0 : 1, 0.5, dt);
    const e = cur.lift * cur.lift * (3 - 2 * cur.lift);
    rig.airframe.position.y = e * 3.2;

    updateLights();
  }

  function setBulb(L, on, k = 1) {
    const base = L.mesh.userData.baseEmissive || (L.mesh.userData.baseEmissive = new THREE.Color());
    base.copy(L.color).multiplyScalar(on ? 2.2 * k : 0);
    if (!L.mesh.userData.hl) L.mesh.material.emissive.copy(base);
    L.sprite.visible = on && k > 0.05;
    L.sprite.material.opacity = Math.min(1, k);
    if (L.spot) L.spot.intensity = on ? 60 * k : 0;
  }

  function updateLights() {
    const lt = rig.lights;
    const strobePhase = t % 1.2;
    const strobeOn = strobePhase < 0.06 || (strobePhase > 0.16 && strobePhase < 0.22);
    const beaconK = Math.max(0, Math.sin(t * Math.PI * 2 * 0.9)) ** 3;
    lt.nav.forEach((L) => setBulb(L, state['light.nav']));
    lt.strobe.forEach((L) => setBulb(L, state['light.strobe'] && strobeOn));
    lt.beacon.forEach((L) => setBulb(L, state['light.beacon'], beaconK));
    lt.landing.forEach((L) => setBulb(L, state['light.landing']));
    lt.turnoff.forEach((L) => setBulb(L, state['light.turnoff']));
    lt.taxi.forEach((L) => setBulb(L, state['light.taxi'] && cur.gear < 0.05));
    lt.logo.forEach((L) => setBulb(L, state['light.logo']));
    lt.wing.forEach((L) => setBulb(L, state['light.wing']));
  }

  // ------------------------------------------------------------------ indications
  function annunciators() {
    const leMoving = Math.abs(cur.slat - (state.flapLever === 0 ? 0 : state.flapLever <= 5 ? 0.55 : 1)) > 0.01
      || Math.abs(cur.krueger - (state.flapLever > 0 ? 1 : 0)) > 0.01;
    const leExtended = cur.slat > 0.5 && cur.krueger > 0.99;
    const gearTransit = cur.gear > 0.0001 && cur.gear < 0.9999;
    const disagree = (state.gearLever === 'UP' && cur.gear < 0.9999) || (state.gearLever === 'DN' && cur.gear > 0.0001);
    const gearState = cur.gear <= 0.0001 ? 'green' : gearTransit || disagree ? 'red' : 'off';
    return {
      leTransit: { label: 'LE FLAPS TRANSIT', state: leMoving ? 'amber' : 'off' },
      leExt: { label: 'LE FLAPS EXT', state: !leMoving && leExtended ? 'green' : 'off' },
      gearL: { label: 'LEFT GEAR', state: gearState },
      gearN: { label: 'NOSE GEAR', state: gearState },
      gearR: { label: 'RIGHT GEAR', state: gearState },
      sbArmed: { label: 'SPEED BRAKE ARMED', state: state.speedbrake === 'ARMED' ? 'green' : 'off' },
      sbExt: { label: 'SPEEDBRAKE EXTENDED', state: !state.onGround && Math.max(...cur.fs) > 0.3 && state.speedbrake !== 'DOWN' && state.speedbrake !== 'ARMED' ? 'amber' : 'off' },
      rev: { label: 'REV', state: cur.rev > 0.999 ? 'green' : cur.rev > 0.001 ? 'amber' : 'off' },
      apuGen: { label: 'APU GEN OFF BUS', state: cur.apuSpool >= 0.999 ? 'blue' : 'off' },
      doorsAnn: { label: 'DOORS', state: cur.doors > 0.001 ? 'amber' : 'off' },
    };
  }

  function readout(key) {
    if (key === 'flapGauge') return cur.flap < 0.05 ? 'UP' : cur.flap.toFixed(cur.flap < 9.95 ? 1 : 0);
    if (key === 'stabUnits') return cur.stab.toFixed(1);
    return '';
  }

  return {
    state,
    get: (k) => state[k],
    set,
    apply,
    update,
    annunciators,
    readout,
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
  };
}
