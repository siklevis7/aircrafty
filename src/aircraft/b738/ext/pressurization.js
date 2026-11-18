// System extension: cabin pressurization (737-800 NG).
//
// Simplified but physical model. The cabin is a volume whose pressure rises with pack inflow and
// falls with outflow (outflow valve + normal hull leakage + an optional failure leak), each term
// scaling with the square root of the differential pressure. In AUTO/ALTN a controller positions
// the outflow valve to follow a schedule; in MAN the crew drives the valve directly.
//
// Study simplifications:
// - Aircraft altitude jumps instantly (scenario bar). When it does and the system is healthy, the
//   cabin is placed where the schedule would have it after a normal climb/descent; with a fault the
//   cabin keeps its pressure (clamped between ambient and the relief limit) and evolves from there.
// - Rates and flow coefficients are tuned to look plausible, not taken from Boeing data.
// - Only one controller channel failure is modelled (fail.press.auto -> ALTN). Dual failure isn't.

const P0 = 14.696; // psi, ISA sea level
const TROPO = 36089; // ft
const P_TROPO = 3.2825; // psi at the tropopause

/** ISA static pressure (psi) at pressure altitude h (ft). */
const pAt = (h) => (h <= TROPO ? P0 * Math.pow(1 - 6.8756e-6 * h, 5.2559) : P_TROPO * Math.exp(-(h - TROPO) / 20806));
/** Pressure altitude (ft) for a static pressure (psi). */
const altAt = (p) => (p >= P_TROPO ? (1 - Math.pow(p / P0, 1 / 5.2559)) / 6.8756e-6 : TROPO - 20806 * Math.log(p / P_TROPO));

// Scheduled max differential by selected FLT ALT (FCOM-style bands): 8.35 psid gives ~8,000 ft at FL410.
const schedDiff = (fltAlt) => (fltAlt <= 28000 ? 7.45 : fltAlt <= 37000 ? 7.8 : 8.35);
const RELIEF = 9.0; // psid where the safety relief valves hold the cabin (structural limit ~9.1)
const HIGH_CABIN_TRIP = 15800; // ft: AUTO controller declares a fault above this cabin altitude (simplified)
const WARN_ALT = 10000; // ft: cabin altitude warning
const MAX_ALT = 41000; // ft: certified ceiling

// flow model (arbitrary units: one pack = 1)
const K = 0.0154; // psi per second per unit net flow (cabin volume)
const C_LEAK = 0.215; // normal hull leakage
const C_HOLE = 1.5; // failure leak (door seal / structural)
const C_OFV = 6.0; // outflow valve fully open
const CLIMB_FPM = 500, DESC_FPM = 300; // controller cabin rate limits (typical, simplified)
const MAN_STEPS = [0, 0.02, 0.04, 0.06, 0.08, 0.1, 0.15, 0.2, 0.3, 0.5, 0.75, 1];

// per-systems-instance dynamic state (not part of systems.state: it isn't a switch position)
const sims = new WeakMap();
function sim(s) {
  let m = sims.get(s);
  if (!m) {
    m = {
      pc: pAt(s['press.landAlt'] || 0), ofv: 1, rate: 0, packs: 2, packsAt: -1,
      wasGround: s.onGround, toAlt: s['press.landAlt'] || 0, cruiseReached: true,
      offSched: false, trip: false, relief: false, negRelief: false,
    };
    sims.set(s, m);
  }
  return m;
}

const airborne = (s) => !s.onGround;
const ctrlMode = (s) => s['press.mode'];
const autoFailRaw = (s, m) => !!s['fail.press.auto'] || m.trip;

function refreshPacks(api, m, force) {
  if (!force && api.time - m.packsAt < 0.5 && m.packsAt >= 0) return;
  const b = api.panel().bleed; // also refreshes m.packs via compute()
  m.packs = (b.packL ? 1 : 0) + (b.packR ? 1 : 0);
  m.packsAt = api.time;
}

/** Cabin pressure the automatic schedule wants right now. */
function targetPc(s, m) {
  const pa = pAt(s.altitude);
  const land = m.offSched ? m.toAlt : (s['press.landAlt'] || 0);
  return Math.min(pAt(land), pa + schedDiff(s['press.fltAlt']));
}

/** Place the cabin after an instant altitude change (see header). */
function settleCabin(s, m) {
  if (!airborne(s)) { m.pc = pAt(s['press.landAlt'] || 0); m.rate = 0; return; }
  const pa = pAt(s.altitude);
  const healthy = m.packs > 0 && !s['fail.press.leak'] && ctrlMode(s) !== 'MAN';
  if (healthy) {
    m.pc = targetPc(s, m);
    const d = Math.max(0, m.pc - pa);
    m.ofv = d > 0.01 ? Math.min(1, Math.max(0, (m.packs - C_LEAK * Math.sqrt(d)) / (C_OFV * Math.sqrt(d)))) : 1;
  } else {
    m.pc = Math.min(Math.max(m.pc, pa), pa + RELIEF);
  }
  m.rate = 0;
}

function step(s, m, h) {
  const pa = pAt(s.altitude);
  const d = Math.max(0, m.pc - pa);
  const sq = Math.sqrt(d);
  const leak = C_LEAK * sq + (s['fail.press.leak'] ? C_HOLE * sq : 0);
  const qin = m.packs;
  if (ctrlMode(s) === 'MAN') {
    const cmd = s['press.outflowCmd'];
    const dv = 0.08 * h; // valve motor speed (full travel ~12 s)
    m.ofv = Math.abs(cmd - m.ofv) <= dv ? cmd : m.ofv + Math.sign(cmd - m.ofv) * dv;
  } else {
    // controller: move cabin altitude toward the schedule within the rate limits
    const hc = altAt(m.pc), ht = altAt(targetPc(s, m));
    const lim = (ht > hc ? CLIMB_FPM : DESC_FPM) / 60 * h;
    const hn = Math.abs(ht - hc) <= lim ? ht : hc + Math.sign(ht - hc) * lim;
    const wantDot = (pAt(hn) - m.pc) / h;
    const need = qin - leak - wantDot / K; // flow the outflow valve must pass
    m.ofv = sq < 0.05 ? (need > 0 ? 1 : 0) : Math.min(1, Math.max(0, need / (C_OFV * sq)));
  }
  const net = qin - leak - C_OFV * m.ofv * sq;
  let pc = m.pc + K * net * h;
  m.relief = false; m.negRelief = false;
  if (pc > pa + RELIEF) { pc = pa + RELIEF; m.relief = true; }
  if (pc < pa) { pc = pa; m.negRelief = net < 0 && d < 0.02 && pc < m.pc; }
  m.pc = pc;
}

const fmtFt = (v) => `${Math.round(v / 10) * 10 < 0 ? '-' : ''}${Math.abs(Math.round(v / 10) * 10).toLocaleString('en-US')} FT`;
const fmtFL = (v) => (v >= 18000 ? `FL${String(Math.round(v / 100)).padStart(3, '0')}` : `${Math.round(v).toLocaleString('en-US')} FT`);
const fmtRate = (r) => { const v = Math.round(r / 10) * 10; return `${v > 0 ? '+' : ''}${v.toLocaleString('en-US')} FPM`; };

const L = (text, ok) => ({ text, state: ok ? 'ok' : 'lost' });
const I = (text) => ({ text, state: 'info' });
const IN_FLIGHT = { onGround: false, engines: true, gearLever: 'UP', flapLever: 0, altitude: 35000 };
const P = (c) => c.pressurization;

export default {
  id: 'pressurization',
  state: {
    altitude: 0,
    'press.mode': 'AUTO',
    'press.fltAlt': 35000,
    'press.landAlt': 0,
    'press.outflowCmd': 0.5,
    'fail.press.auto': false,
    'fail.press.leak': false,
  },

  set(key, value, api) {
    const s = api.state;
    switch (key) {
      case 'altitude': {
        if (s.onGround) return api.deny('The aircraft is on the ground. Select Flight first, then pick a cruise altitude.');
        const m = sim(s);
        const v = Math.min(MAX_ALT, Math.max(1000, Math.round(Number(value) || 0)));
        const prev = s.altitude;
        // a descent before reaching the planned cruise level: OFF SCHED DESCENT (auto modes)
        if (v < prev - 500 && !m.cruiseReached && ctrlMode(s) !== 'MAN') {
          m.offSched = true;
          api.emit({ type: 'info', message: 'Descent started before reaching the FLT ALT set on the pressurization panel: OFF SCHED DESCENT. The controller now schedules the cabin back to the takeoff field elevation.' });
        }
        s.altitude = v;
        if (v > s['press.fltAlt']) s['press.fltAlt'] = v; // crew would have set FLT ALT to the cruise level
        if (v >= s['press.fltAlt'] - 1000) m.cruiseReached = true;
        refreshPacks(api, m, true);
        settleCabin(s, m);
        return { ok: true };
      }
      case 'press.mode': {
        if (!['AUTO', 'ALTN', 'MAN'].includes(value)) return api.deny('Pressurization mode is AUTO, ALTN or MAN.');
        const m = sim(s);
        if (value === 'MAN' && s['press.mode'] !== 'MAN') {
          s['press.outflowCmd'] = m.ofv; // take over from wherever the valve is
          api.emit({ type: 'info', message: 'MAN: the controllers are bypassed. Use MAN OPEN / MAN CLOSE to drive the outflow valve and watch cabin rate.' });
        }
        s['press.mode'] = value;
        return { ok: true };
      }
      case 'press.fltAlt': {
        const m = sim(s);
        s['press.fltAlt'] = Math.min(MAX_ALT, Math.max(0, Number(value) || 0));
        if (airborne(s)) {
          if (s['press.fltAlt'] > s.altitude + 1000) m.cruiseReached = false; // still climbing to the new cruise level
          else { m.cruiseReached = true; m.offSched = false; }
        }
        return { ok: true };
      }
      case 'press.landAlt':
        s['press.landAlt'] = Math.min(14000, Math.max(-1000, Number(value) || 0));
        if (s.onGround) sim(s).pc = pAt(s['press.landAlt']);
        return { ok: true };
      case 'press.outflowCmd':
        s['press.outflowCmd'] = Math.min(1, Math.max(0, Number(value) || 0));
        return { ok: true };
      case 'act.press.ofvOpen':
      case 'act.press.ofvClose': {
        if (s['press.mode'] !== 'MAN') return api.deny('The outflow valve switch only works in MAN. Set the mode selector to MAN first.');
        const cur = s['press.outflowCmd'];
        const next = key.endsWith('Open') ? (MAN_STEPS.find((x) => x > cur + 1e-6) ?? 1)
          : ([...MAN_STEPS].reverse().find((x) => x < cur - 1e-6) ?? 0);
        s['press.outflowCmd'] = next;
        return { ok: true };
      }
      case 'act.press.reset': { // part of the normal config: a clean, scheduled cabin
        const m = sim(s);
        m.offSched = false; m.trip = false; m.cruiseReached = true;
        refreshPacks(api, m, true);
        settleCabin(s, m);
        return { ok: true };
      }
      default:
        return undefined;
    }
  },

  update(dt, api) {
    const s = api.state;
    const m = sim(s);
    if (!(dt > 0)) return;
    dt = Math.min(dt, 0.5);
    if (s.onGround) {
      if (!m.wasGround) { m.offSched = false; m.trip = false; m.cruiseReached = true; }
      m.wasGround = true;
      s.altitude = 0;
      m.pc = pAt(s['press.landAlt'] || 0);
      m.ofv = Math.min(1, m.ofv + 0.2 * dt); // outflow valve drives fully open on the ground
      m.rate = 0;
      return;
    }
    refreshPacks(api, m, m.wasGround);
    if (m.wasGround) { // just took off: put the aircraft at cruise (study shortcut)
      m.wasGround = false;
      m.toAlt = s['press.landAlt'] || 0;
      if (!s.altitude) s.altitude = 35000;
      if (s.altitude > s['press.fltAlt']) s['press.fltAlt'] = s.altitude;
      m.cruiseReached = s.altitude >= s['press.fltAlt'] - 1000;
      settleCabin(s, m);
      return;
    }
    const h0 = altAt(m.pc);
    let left = dt;
    while (left > 1e-6) { const h = Math.min(0.1, left); step(s, m, h); left -= h; }
    const h1 = altAt(m.pc);
    const inst = ((h1 - h0) / dt) * 60;
    m.rate += (inst - m.rate) * Math.min(1, dt / 0.8);
    if (ctrlMode(s) === 'AUTO' && h1 > HIGH_CABIN_TRIP) m.trip = true;
  },

  compute(s, out) {
    const m = sim(s);
    m.packs = (out.bleed.packL ? 1 : 0) + (out.bleed.packR ? 1 : 0);
    const air = airborne(s);
    const ambientAlt = air ? s.altitude : (s['press.landAlt'] || 0);
    const pa = pAt(ambientAlt);
    const cabinAlt = altAt(m.pc);
    const diff = Math.max(0, m.pc - pa);
    const mode = s['press.mode'];
    const fail = autoFailRaw(s, m);
    const leak = !!s['fail.press.leak'];
    return {
      cabinAlt,
      diff,
      rate: Math.abs(m.rate) < 15 ? 0 : m.rate,
      outflow: m.ofv,
      autoFail: fail && mode === 'AUTO',
      offSched: air && m.offSched && mode !== 'MAN',
      altn: mode === 'ALTN' || (mode === 'AUTO' && fail),
      manual: mode === 'MAN',
      warn: air && cabinAlt > WARN_ALT,
      // extras for the schematic and failures
      altitude: air ? s.altitude : 0,
      ambientAlt, ambientP: pa, cabinP: m.pc,
      packs: m.packs, inflow: m.packs > 0,
      leak: leak && air && diff > 0.05,
      relief: air && m.relief, negRelief: air && m.negRelief,
      target: air ? altAt(targetPc(s, m)) : ambientAlt,
      schedDiff: schedDiff(s['press.fltAlt']),
      controller: mode === 'MAN' ? 'MAN' : mode === 'AUTO' && fail ? 'ALTN' : mode,
      pressurized: air && diff > 0.3,
    };
  },

  ann(r) {
    return {
      'press.autoFail': r.autoFail,
      'press.offSched': r.offSched,
      'press.altn': r.altn,
      'press.manual': r.manual,
      'press.cabinAlt': r.warn,
    };
  },

  // AUTO FAIL and OFF SCHED DESCENT repeat on the AIR COND master caution annunciator.
  cats(r) { return r.autoFail || r.offSched ? ['AIR COND'] : []; },

  labels: {
    'press.autoFail': ['AUTO FAIL', 'amber'],
    'press.offSched': ['OFF SCHED DESCENT', 'amber'],
    'press.altn': ['ALTN (pressurization)', 'green'],
    'press.manual': ['MANUAL (pressurization)', 'green'],
    'press.cabinAlt': ['CABIN ALTITUDE (warning horn)', 'red'],
  },

  normal: {
    'press.mode': 'AUTO', 'press.fltAlt': 35000, 'press.landAlt': 0, 'press.outflowCmd': 0.5,
    'act.press.reset': true,
  },

  scenario: [
    { label: 'Altitude', key: 'altitude', options: [10000, 25000, 35000, 41000].map((v) => ({ value: v, label: `FL${v / 100}` })) },
  ],

  categories: [{ id: 'sys-pressurization', label: 'Pressurization' }],

  schematics: [{
    id: 'pressurization', category: 'sys-pressurization', title: 'Pressurization', color: 'press',
    intro: 'Pack air fills the cabin and the outflow valve lets it out. The controller positions the valve to follow a schedule set by FLT ALT and LAND ALT. Go to Flight, pick an altitude, then try the mode selector, the packs or MAN.',
    nodes: [
      { id: 'packL', kind: 'box', label: 'LEFT PACK', x: 60, y: 40, w: 170, h: 50, active: (c) => c.bleed.packL, part: 'sys-bleed-packs', control: { key: 'sw.pack.l', type: 'toggle', on: 'AUTO', off: 'OFF' }, status: (c) => (c.s['fail.pack.l'] ? 'PACK TRIP' : c.s['sw.pack.l'] ? (c.bleed.packL ? 'AUTO' : 'NO BLEED') : 'OFF') },
      { id: 'mix', kind: 'box', label: 'MIX MANIFOLD', x: 390, y: 40, w: 220, h: 50, active: (c) => P(c).inflow, part: 'sys-press-cabin', status: (c) => `${P(c).packs} PACK${P(c).packs === 1 ? '' : 'S'}` },
      { id: 'packR', kind: 'box', label: 'RIGHT PACK', x: 770, y: 40, w: 170, h: 50, active: (c) => c.bleed.packR, part: 'sys-bleed-packs', control: { key: 'sw.pack.r', type: 'toggle', on: 'AUTO', off: 'OFF' }, status: (c) => (c.s['fail.pack.r'] ? 'PACK TRIP' : c.s['sw.pack.r'] ? (c.bleed.packR ? 'AUTO' : 'NO BLEED') : 'OFF') },

      { id: 'cabin', kind: 'tank', label: 'PRESSURIZED CABIN', x: 300, y: 150, w: 400, h: 190, active: (c) => P(c).pressurized, part: 'sys-press-cabin', status: (c) => (P(c).warn ? 'CABIN ALTITUDE WARNING' : P(c).leak ? 'PRESSURE LEAK' : '') },
      { id: 'rCab', kind: 'box', label: 'CABIN ALT', x: 318, y: 190, w: 116, h: 50, active: (c) => P(c).pressurized, part: 'sys-press-cabin', status: (c) => fmtFt(P(c).cabinAlt) },
      { id: 'rDiff', kind: 'box', label: 'DIFF PRESS', x: 442, y: 190, w: 116, h: 50, active: (c) => P(c).pressurized, part: 'sys-press-cabin', status: (c) => `${P(c).diff.toFixed(2)} PSI` },
      { id: 'rRate', kind: 'box', label: 'CABIN RATE', x: 566, y: 190, w: 116, h: 50, active: (c) => P(c).pressurized, part: 'sys-press-cabin', status: (c) => fmtRate(P(c).rate) },
      { id: 'rTgt', kind: 'box', label: 'SCHEDULED', x: 318, y: 252, w: 178, h: 50, active: (c) => P(c).pressurized && !P(c).manual, part: 'sys-press-fltland', status: (c) => (P(c).manual ? 'MANUAL' : fmtFt(P(c).target)) },
      { id: 'rAmb', kind: 'box', label: 'OUTSIDE', x: 504, y: 252, w: 178, h: 50, active: (c) => !c.s.onGround, part: 'sys-press-cabin', status: (c) => `${P(c).ambientP.toFixed(2)} PSI` },

      { id: 'ctrl', kind: 'box', label: 'PRESSURE CONTROLLER', x: 40, y: 150, w: 210, h: 60, active: (c) => !P(c).manual, part: 'sys-press-controller', control: { key: 'press.mode', type: 'cycle', values: ['AUTO', 'ALTN', 'MAN'] }, status: (c) => (P(c).autoFail ? 'AUTO FAIL → ALTN' : c.s['press.mode'] === 'AUTO' && P(c).altn ? 'AUTO → ALTN' : c.s['press.mode']) },
      { id: 'flt', kind: 'box', label: 'FLT ALT', x: 40, y: 236, w: 210, h: 44, active: (c) => !P(c).manual, part: 'sys-press-fltland', control: { key: 'press.fltAlt', type: 'cycle', values: [10000, 25000, 35000, 37000, 41000] }, status: (c) => fmtFL(c.s['press.fltAlt']) },
      { id: 'land', kind: 'box', label: 'LAND ALT', x: 40, y: 296, w: 210, h: 44, active: (c) => !P(c).manual, part: 'sys-press-fltland', control: { key: 'press.landAlt', type: 'cycle', values: [0, 500, 2000, 5000] }, status: (c) => fmtFt(c.s['press.landAlt']) },
      { id: 'acAlt', kind: 'box', label: 'AIRCRAFT', x: 40, y: 356, w: 210, h: 44, active: (c) => !c.s.onGround, part: 'sys-press-cabin', status: (c) => (c.s.onGround ? 'ON GROUND' : fmtFL(c.s.altitude)) },

      { id: 'autoFail', kind: 'annun', label: 'AUTO FAIL', x: 780, y: 150, w: 170, h: 34, active: (c) => P(c).autoFail, part: 'sys-press-lights' },
      { id: 'offSched', kind: 'annun', label: 'OFF SCHED DESCENT', x: 780, y: 194, w: 170, h: 34, active: (c) => P(c).offSched, part: 'sys-press-lights' },
      { id: 'warn', kind: 'tank', label: 'CABIN ALT WARNING', x: 780, y: 240, w: 170, h: 50, active: (c) => P(c).warn, part: 'sys-press-warn', status: (c) => (P(c).warn ? 'HORN · ABOVE 10,000 FT' : '') },
      { id: 'lightsLbl', kind: 'label', label: 'PANEL LIGHTS', x: 780, y: 138 },

      { id: 'ofv', kind: 'valve', label: 'OUTFLOW VALVE', x: 420, y: 430, orient: 'v', active: (c) => P(c).outflow > 0.01, part: 'sys-press-ofv', status: (c) => `${Math.round(P(c).outflow * 100)}% OPEN` },
      { id: 'manOpen', kind: 'box', label: 'MAN OPEN', x: 450, y: 470, w: 100, h: 32, active: (c) => P(c).manual, part: 'sys-press-modes', control: { key: 'act.press.ofvOpen', type: 'action' }, status: () => '' },
      { id: 'manClose', kind: 'box', label: 'MAN CLOSE', x: 560, y: 470, w: 100, h: 32, active: (c) => P(c).manual, part: 'sys-press-modes', control: { key: 'act.press.ofvClose', type: 'action' }, status: () => '' },
      { id: 'safety', kind: 'box', label: 'SAFETY RELIEF', x: 700, y: 410, w: 125, h: 44, active: (c) => P(c).relief, part: 'sys-press-relief', status: (c) => (P(c).relief ? 'OPEN' : 'CLOSED') },
      { id: 'neg', kind: 'box', label: 'NEG RELIEF', x: 835, y: 410, w: 115, h: 44, active: (c) => P(c).negRelief, part: 'sys-press-relief', status: (c) => (P(c).negRelief ? 'OPEN' : 'CLOSED') },
      { id: 'ovbd', kind: 'box', label: 'OVERBOARD', x: 300, y: 560, w: 650, h: 44, active: (c) => !c.s.onGround, part: 'sys-press-ofv', status: (c) => (c.s.onGround ? `FIELD ${fmtFt(P(c).ambientAlt)}` : `AMBIENT ${fmtFL(P(c).ambientAlt)}`) },
      { id: 'leakLbl', kind: 'label', label: 'LEAK', x: 330, y: 470 },
    ],
    lines: [
      { pts: [[230, 65], [390, 65]], live: (c) => c.bleed.packL },
      { pts: [[770, 65], [610, 65]], live: (c) => c.bleed.packR },
      { pts: [[500, 90], [500, 150]], live: (c) => P(c).inflow },
      // controller signal to the outflow valve (not in MAN)
      { pts: [[250, 180], [270, 180], [270, 430], [400, 430]], live: (c) => !P(c).manual && !c.s.onGround, kind: 'tie' },
      { pts: [[420, 340], [420, 410]], live: (c) => P(c).outflow > 0.01 && P(c).diff > 0.02 },
      { pts: [[420, 450], [420, 560]], live: (c) => P(c).outflow > 0.01 && P(c).diff > 0.02 },
      // relief valves
      { pts: [[650, 340], [650, 380], [762, 380], [762, 410]], live: (c) => P(c).relief },
      { pts: [[762, 380], [892, 380], [892, 410]], live: (c) => P(c).negRelief },
      { pts: [[762, 454], [762, 560]], live: (c) => P(c).relief },
      { pts: [[892, 454], [892, 560]], live: (c) => P(c).negRelief },
      // failure leak path
      { pts: [[320, 340], [320, 560]], live: (c) => P(c).leak, kind: 'feed' },
    ],
  }],

  parts: [
    { id: 'sys-press-cabin', category: 'sys-pressurization', name: 'Pressurized Cabin', where: 'Fuselage pressure vessel',
      what: 'The flight deck, cabin, cargo holds and electronics bay form one pressure vessel. Cabin altitude is the pressure altitude inside it; differential pressure is the inside-minus-outside pressure.',
      how: 'Pack air enters through the mix manifold. Pressure is set by how much air the outflow valve lets out. Small amounts also leak through seals. The overhead panel shows cabin altitude, differential pressure and cabin rate of climb.',
      notes: ['Here the readouts are live: try turning both packs off in flight and watch the cabin climb.', 'One pack can keep the aircraft pressurized.'] },
    { id: 'sys-press-controller', category: 'sys-pressurization', name: 'Cabin Pressure Controllers', where: 'Electronics bay, set from the overhead pressurization panel',
      what: 'Two digital controllers. One normally runs the system in AUTO, the other is the alternate (ALTN) channel. Each drives the outflow valve to follow the pressurization schedule.',
      how: 'They use the selected FLT ALT and LAND ALT and the aircraft\'s air data to build a schedule: the cabin climbs and descends gently with the aircraft and holds a constant differential at cruise. Cabin rates are normally a few hundred feet per minute.',
      notes: ['Click the controller here to cycle AUTO → ALTN → MAN.'] },
    { id: 'sys-press-modes', category: 'sys-pressurization', name: 'Mode Selector: AUTO, ALTN, MAN', where: 'Pressurization panel',
      what: 'AUTO uses the primary controller. ALTN uses the second controller. MAN bypasses both, so the crew drives the outflow valve directly with the spring-loaded outflow valve switch (OPEN/CLOSE) while watching the valve position indicator.',
      how: 'The green ALTN light shows the alternate channel in use (selected, or after an automatic transfer). The green MANUAL light shows MAN. In MAN, small valve movements make large rate changes at altitude, so it\'s a slow, careful technique.',
      notes: ['Here, in MAN, use MAN OPEN / MAN CLOSE and watch CABIN RATE. Fully closed at altitude drives the cabin down until the safety relief valves open.', 'Follow your operator\'s QRH/FCOM for manual pressurization.'] },
    { id: 'sys-press-ofv', category: 'sys-pressurization', name: 'Outflow Valve', where: 'Aft fuselage',
      what: 'The main valve that controls cabin pressure by regulating how much cabin air is exhausted overboard.',
      how: 'Driven by the controller in AUTO/ALTN and by the outflow valve switch in MAN. It is nearly closed at cruise and fully open on the ground, so the aircraft can\'t stay pressurized after landing. A position indicator on the panel shows it.',
      notes: ['Closing the valve raises cabin pressure (cabin descends). Opening it lowers cabin pressure (cabin climbs).'] },
    { id: 'sys-press-relief', category: 'sys-pressurization', name: 'Safety & Negative Relief Valves', where: 'Fuselage',
      what: 'Two safety relief valves stop the differential pressure exceeding the structural limit (about 9.1 psi on the NG). A negative relief valve stops outside pressure from exceeding cabin pressure, for example in a fast descent.',
      how: 'Both work mechanically, independent of the controllers, so they protect the fuselage even if the control system misbehaves.',
      notes: ['Here, the safety relief opens if you hold the outflow valve closed in MAN at altitude.'] },
    { id: 'sys-press-fltland', category: 'sys-pressurization', name: 'FLT ALT & LAND ALT', where: 'Pressurization panel',
      what: 'FLT ALT is the planned cruise altitude, LAND ALT the destination field elevation. They are set before takeoff.',
      how: 'The FLT ALT sets the cruise differential: about 7.45 psid up to 28,000 ft, 7.80 psid up to 37,000 ft and 8.35 psid above that, which gives a cabin of about 8,000 ft at FL410. LAND ALT lets the controller bring the cabin to the destination elevation during descent.',
      notes: ['Try it: in flight, set FLT ALT to FL410 while at FL350, then descend to FL250: OFF SCHED DESCENT.', 'Here, picking a higher altitude in the scenario bar raises FLT ALT automatically, as the crew would.'] },
    { id: 'sys-press-lights', category: 'sys-pressurization', name: 'AUTO FAIL & OFF SCHED DESCENT', where: 'Pressurization panel',
      what: 'AUTO FAIL (amber): the automatic system has a fault, for example a controller failure, loss of power or an abnormally high cabin altitude or rate. OFF SCHED DESCENT (amber): the aircraft started descending before reaching the FLT ALT set.',
      how: 'With a single controller fault in AUTO, control transfers automatically to ALTN and the ALTN light comes on with AUTO FAIL. After OFF SCHED DESCENT, the controller schedules the cabin back to the takeoff field elevation. Both repeat on the AIR COND master caution annunciator.',
      notes: ['Here, selecting ALTN after an AUTO FAIL clears the AUTO FAIL light. Dual controller failure (MAN required) isn\'t modelled.'] },
    { id: 'sys-press-warn', category: 'sys-pressurization', name: 'Cabin Altitude Warning', where: 'Flight deck aural warning and lights',
      what: 'An intermittent warning horn sounds when cabin altitude exceeds 10,000 ft. Many NGs (later production or modified) also show red CABIN ALTITUDE lights in front of the pilots.',
      how: 'It\'s independent of the pressure controllers. The ALT HORN CUTOUT switch silences the horn.',
      notes: ['Masks on and establish crew communication first. Follow your operator\'s QRH/FCOM.'] },
  ],

  failures: [
    {
      id: 'press-leak', title: 'Loss of pressurization at FL350', system: 'pressurization', group: 'Pressurization',
      setup: IN_FLIGHT, flags: ['fail.press.leak'],
      summary: 'A leak (for example a door seal) lets cabin air escape faster than the packs can replace it. The outflow valve closes fully, but the cabin still climbs toward outside pressure.',
      effects: (c) => [
        L(`Cabin altitude ${fmtFt(P(c).cabinAlt)}${P(c).rate > 100 ? ` (climbing ${fmtRate(P(c).rate)})` : ''}`, !P(c).warn),
        L(`Differential pressure ${P(c).diff.toFixed(2)} psi`, P(c).diff > 6),
        L(`Outflow valve ${Math.round(P(c).outflow * 100)}% open${P(c).outflow < 0.01 ? ': fully closed, trying to hold' : ''}`, P(c).outflow > 0.01),
        L('Cabin altitude warning (above 10,000 ft)', !P(c).warn),
        L(`Passenger masks ${c.oxygen?.masksDeployed ? 'DEPLOYED' : 'stowed'}`, !c.oxygen?.masksDeployed),
        I('Pick FL100 in the scenario bar to see what an emergency descent does to the cabin.'),
      ],
      know: [
        'The cabin altitude warning horn sounds above 10,000 ft cabin, independent of the controllers.',
        'Passenger masks drop automatically at about 14,000 ft cabin altitude.',
        'Crew oxygen masks on and crew communication first. Time of useful consciousness drops quickly with altitude.',
        'An emergency descent may be needed. Follow your operator\'s QRH/FCOM.',
      ],
    },
    {
      id: 'press-auto-fail', title: 'Pressure controller failure (AUTO FAIL)', system: 'pressurization', group: 'Pressurization',
      setup: IN_FLIGHT, flags: ['fail.press.auto'],
      summary: 'The primary controller fails in cruise. AUTO FAIL comes on and control transfers automatically to the alternate channel, so the cabin stays on schedule.',
      effects: (c) => [
        L('Primary (AUTO) controller', !c.s['fail.press.auto']),
        L(`Controller in use: ${P(c).controller}`, P(c).controller !== 'MAN'),
        L(`Cabin altitude ${fmtFt(P(c).cabinAlt)} on schedule`, Math.abs(P(c).cabinAlt - P(c).target) < 300),
        L('AUTO FAIL light', !P(c).autoFail),
        I(c.s['press.mode'] === 'AUTO' ? 'Click the controller on the schematic to select ALTN: AUTO FAIL goes out, ALTN stays on.' : `Mode selector in ${c.s['press.mode']}.`),
      ],
      know: [
        'A single controller fault in AUTO transfers control to ALTN automatically: AUTO FAIL and ALTN are lit together.',
        'AUTO FAIL repeats on the AIR COND master caution annunciator.',
        'If the alternate channel also fails, the crew controls the outflow valve in MAN.',
        'Follow your operator\'s QRH/FCOM.',
      ],
    },
    {
      id: 'press-packs-off', title: 'Both packs inoperative at altitude', system: 'pressurization', group: 'Pressurization',
      setup: IN_FLIGHT, flags: ['fail.pack.l', 'fail.pack.r'],
      summary: 'Both packs trip at FL350. No air enters the cabin, so even with the outflow valve closed the normal leakage makes the cabin climb slowly.',
      effects: (c) => [
        L(`Supply air: ${P(c).packs} pack${P(c).packs === 1 ? '' : 's'}`, P(c).inflow),
        L(`Cabin altitude ${fmtFt(P(c).cabinAlt)}${P(c).rate > 100 ? ` (climbing ${fmtRate(P(c).rate)})` : ''}`, !P(c).warn),
        L(`Outflow valve ${Math.round(P(c).outflow * 100)}% open`, P(c).outflow > 0.01),
        L('Cabin altitude warning (above 10,000 ft)', !P(c).warn),
        I('A pack trip can often be reset once it cools. Here: clear the failure, or descend with the scenario bar.'),
      ],
      know: [
        'One pack is enough to keep the aircraft pressurized; losing both means no inflow.',
        'The cabin climb rate depends on fuselage leakage, so it is much slower than a structural leak.',
        'PACK lights repeat on the AIR COND master caution annunciator.',
        'Follow your operator\'s QRH/FCOM for pack trips and loss of pressurization.',
      ],
    },
  ],
};
