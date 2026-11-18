// Trainer: Engine start — CFM56-7B normal ground start and abnormal-start recognition on a
// replica of the overhead air/start panels, the start levers and the upper/lower engine display.
// The engine model is a simplified, plausible simulation for procedural practice — not a performance model.
import './enginestart.css';
import { dial, ductGauge, pol } from './enginestart-gauges.js';

const P = 'tr-enginestart-';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const sm = (x, a, b) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lag = (v, target, tau, dt) => v + (target - v) * (1 - Math.exp(-dt / Math.max(tau, 1e-3)));

// Approximate reference values (CFM56-7B, ISA sea level, typical) — used by the model and the coach.
const IDLE = { n1: 20, n2: 59, egt: 410, ff: 270 };
const START_LIMIT = 725;   // EGT start limit, °C
const CUTOUT = 56;         // starter cutout, % N2 (NG)
const FUEL_N2 = 25;        // normal fuel introduction, % N2
const FUEL_MIN = 20;       // minimum N2 for fuel at max motoring
const LIGHTOFF_S = 10;     // EGT rise expected within this many seconds of start lever to IDLE
const AMBIENT = 15;
const APU_START_S = 14;    // shortened for the trainer

const SCENARIOS = [
  { id: 'normal', label: 'Normal start' },
  { id: 'hot', label: 'Hot start' },
  { id: 'wet', label: 'Wet start (no light-off)' },
  { id: 'hung', label: 'Hung start' },
  { id: 'cutout', label: 'Starter does not cut out' },
  { id: 'surprise', label: 'Surprise me' },
];

const PHASES = [
  { id: 'air', t: 'Bleed air available', d: 'APU running, APU BLEED on, packs off (most operators) so the full duct pressure goes to the starter. Check duct pressure on the gauge.' },
  { id: 'valve', t: 'Start switch to GRD', d: 'The start valve opens: START VALVE OPEN shows, duct pressure drops as air flows to the starter, and N2 begins to rise.' },
  { id: 'rot', t: 'N1 rotation, oil pressure', d: 'Before fuel is introduced, confirm the fan (N1) is turning and oil pressure is starting to rise.' },
  { id: 'fuel', t: 'Start lever to IDLE', d: `At ${FUEL_N2}% N2, or at max motoring if ${FUEL_N2}% cannot be reached (but not below ${FUEL_MIN}% N2). The selected igniter(s) fire and fuel flow shows.` },
  { id: 'lit', t: 'Light-off', d: `EGT should rise within ${LIGHTOFF_S} seconds. Watch EGT against the red start-limit radial (${START_LIMIT} °C) throughout the start.` },
  { id: 'cutout', t: 'Starter cutout', d: `At about ${CUTOUT}% N2 the start switch returns to OFF by itself, the start valve closes and START VALVE OPEN goes out.` },
  { id: 'idle', t: 'Stabilised at idle', d: `Roughly ${IDLE.n1}% N1 and ${IDLE.n2}% N2 at sea level. Check that oil pressure, temperature and the other secondary parameters are normal.` },
];

const ABNORMALS = [
  { id: 'hot', t: 'Hot start', see: 'EGT climbing unusually fast after light-off and heading for the start limit.', why: 'Too much fuel for the airflow: fuel introduced too early or at low N2, tailwind, weak starter air, or a fuel-control fault.', act: 'Don\'t wait for the limit. Start lever to CUTOFF, keep motoring with the starter to cool the engine, then follow the QRH.' },
  { id: 'wet', t: 'Wet start (no light-off)', see: `Fuel flow is showing but EGT hasn't risen within ${LIGHTOFF_S} s of the start lever going to IDLE.`, why: 'Ignition fault, or fuel that isn\'t igniting. Unburnt fuel builds up in the combustor and tailpipe.', act: 'Start lever to CUTOFF. Keep motoring to clear the fuel, then follow the QRH and observe starter duty-cycle limits before a retry.' },
  { id: 'hung', t: 'Hung start', see: 'After light-off, N2 stops accelerating (or creeps very slowly) below idle while EGT keeps rising.', why: 'Not enough energy to accelerate: low starter air pressure, early starter cutout, or a fuel-scheduling or compressor problem.', act: 'Start lever to CUTOFF before EGT reaches the limit. Motor as directed, then follow the QRH.' },
  { id: 'cutout', t: 'Starter does not cut out', see: `Above about ${CUTOUT}% N2 the start switch stays in GRD and START VALVE OPEN stays lit.`, why: 'The switch holding solenoid or the start valve didn\'t release. A starter driven well above its design speed can be damaged.', act: 'Move the start switch to OFF manually. If START VALVE OPEN is still lit, remove the air supply as the QRH directs.' },
];

const SWITCH_POS = ['GRD', 'OFF', 'CONT', 'FLT'];

function newEngine() {
  return {
    n1: 0, n2: 0, egt: AMBIENT, ff: 0, oilP: 0, oilT: AMBIENT, oilQ: 17.0, vib: 0,
    sw: 'OFF', lever: 'CUTOFF', valve: false, lit: false, running: false,
    fuelT: 0, lightDelay: 3.6, grdT: 0, tIdle: null, tLit: null, tValve: null, tCut: null, tStable: null,
    n2AtFuel: null, peakEgt: AMBIENT, exceed: false, early: false, fault: null, maxMot: false,
    hist: [], egtRate: 0, hangT: 0, cutFired: false, aborted: false,
    mark: {},
  };
}

function initialState(scenario, focus) {
  let actual = scenario;
  if (scenario === 'surprise') actual = ['normal', 'hot', 'wet', 'hung', 'cutout'][Math.floor(Math.random() * 5)];
  const s = {
    t: 0, speed: 1, paused: false, scenario, actual, focus,
    apu: 'RUN', apuT: 0, bleed: { apu: true, e1: true, e2: true }, pack: { L: 'AUTO', R: 'AUTO' }, iso: 'AUTO', ign: 'BOTH',
    eng: { 1: newEngine(), 2: newEngine() }, duct: { L: 0, R: 0 }, cues: [], log: [], done: false,
  };
  s.eng[focus].fault = actual === 'normal' ? null : actual;
  if (actual === 'hot') s.eng[focus].lightDelay = 2.4;
  return s;
}

// ------------------------------------------------------------------ simulation
function airSupply(s) {
  const e1 = s.eng[1], e2 = s.eng[2];
  const apuAir = s.apu === 'RUN' && s.bleed.apu ? 42 : 0;
  const engAir = (e, on) => (on && e.lit && e.n2 > 50 ? 28 + (e.n2 - 59) * 0.4 : 0);
  const packOn = { L: s.pack.L !== 'OFF', R: s.pack.R !== 'OFF' };
  const isoOpen = s.iso === 'OPEN' || (s.iso === 'AUTO' && (!packOn.L || !packOn.R || !s.bleed.e1 || !s.bleed.e2));
  let L0 = Math.max(apuAir, engAir(e1, s.bleed.e1));
  let R0 = engAir(e2, s.bleed.e2);
  const drawL = (packOn.L ? (s.pack.L === 'HIGH' ? 9 : 7) : 0) + (e1.valve ? 9 : 0);
  const drawR = (packOn.R ? (s.pack.R === 'HIGH' ? 9 : 7) : 0) + (e2.valve ? 9 : 0);
  let L, R;
  if (isoOpen) {
    const S = Math.max(L0, R0);
    L = R = S > 0 ? Math.max(0, S - drawL - drawR) : 0;
  } else {
    L = L0 > 0 ? Math.max(0, L0 - drawL) : 0;
    R = R0 > 0 ? Math.max(0, R0 - drawR) : 0;
  }
  return { L, R, isoOpen };
}

function stepEngine(s, n, dt) {
  const e = s.eng[n];
  const p = n === 1 ? s.duct.L : s.duct.R;
  e.valve = e.sw === 'GRD';
  const starter = e.valve && p > 5;
  const ign = e.sw !== 'OFF';
  const motorMax = clamp(8 + p * 0.6, 0, 30);

  // fuel and light-off
  if (e.lever === 'IDLE') {
    e.fuelT += dt;
    if (!e.lit && ign && e.n2 > 12 && e.fault !== 'wet' && e.fuelT >= e.lightDelay) {
      e.lit = true; e.tLit = s.t;
      if (e.n2AtFuel != null && e.n2AtFuel < FUEL_MIN) e.early = true;
    }
  } else {
    if (e.lit) { e.lit = false; }
    e.fuelT = 0;
  }
  if (e.lit && e.n2 < 10) e.lit = false; // flame-out at very low rpm

  // N2 dynamics
  let dn2;
  if (!e.lit) {
    const target = starter ? motorMax : 0;
    dn2 = target > e.n2 ? (target - e.n2) * 0.065 : (target - e.n2) * 0.05 - (e.n2 > 0 ? 0.12 : 0);
  } else if (e.fault === 'hung') {
    dn2 = ((starter ? 40 : 36) - e.n2) * 0.09;
  } else {
    const comb = 1.25 * Math.max(0, 1 - ((e.n2 - 42) / 22) ** 2) + 0.15;
    dn2 = comb + (starter ? 0.35 : 0);
    if (e.n2 > 52) dn2 = Math.min(dn2, (IDLE.n2 - e.n2) * 0.35 + (starter ? 0.25 : 0));
  }
  e.n2 = clamp(e.n2 + dn2 * dt, 0, 64);

  // starter cutout
  if (e.sw === 'GRD' && e.n2 >= CUTOUT && e.fault !== 'cutout') {
    e.sw = 'OFF'; e.valve = false; e.tCut = s.t;
  }
  if (e.valve) e.grdT += dt;

  // N1 follows N2
  e.n1 = lag(e.n1, e.n2 < 9 ? 0 : (e.n2 - 9) * 0.4, 1.4, dt);

  // fuel flow (kg/h)
  const ffT = e.lever !== 'IDLE' ? 0 : e.lit ? 120 + clamp((e.n2 - 20) / 39, 0, 1) * 150 + (e.fault === 'hot' ? 60 : 0) : 120;
  e.ff = lag(e.ff, ffT, e.lever === 'IDLE' ? 1.2 : 0.4, dt);

  // EGT
  let egtT, tau;
  if (e.lit) {
    e.running = e.n2 > IDLE.n2 - 1.2;
    if (e.fault === 'hot') { egtT = e.running ? IDLE.egt + 90 : 960; tau = e.running ? 8 : 4.2; }
    else if (e.fault === 'hung') { e.hangT += dt; egtT = 560 + Math.min(320, e.hangT * 9); tau = 3; }
    else {
      egtT = e.running ? IDLE.egt : 500 + 130 * sm(e.n2, 20, 32) - 150 * sm(e.n2, 40, 58);
      if (e.early) egtT += 150 * (1 - sm(e.n2, 30, 50));
      tau = e.running ? 6 : 2.6;
    }
  } else {
    e.running = false;
    egtT = AMBIENT + e.n2 * 0.3;
    tau = e.egt > 200 ? (e.n2 > 15 ? 5 : 9) : 12;
  }
  const before = e.egt;
  e.egt = lag(e.egt, egtT, tau, dt);
  e.egtRate = lag(e.egtRate, (e.egt - before) / Math.max(dt, 1e-3), 0.5, dt);
  e.peakEgt = Math.max(e.peakEgt, e.egt);
  if (e.egt > START_LIMIT && !e.running) e.exceed = true;

  // oil
  const oilT = e.n2 < 4 ? 0 : 38 * Math.pow(clamp(e.n2 / IDLE.n2, 0, 1.1), 1.3);
  e.oilP = lag(e.oilP, oilT, 1.3, dt);
  e.oilT = lag(e.oilT, e.lit ? 75 : AMBIENT + e.n2 * 0.1, e.lit ? 240 : 400, dt);
  e.oilQ = lag(e.oilQ, 17 - 3.2 * clamp(e.n2 / IDLE.n2, 0, 1), 18, dt);
  e.vib = lag(e.vib, e.n1 * (e.lit ? 0.018 : 0.012), 1.5, dt);

  // N2 history for max-motoring / hung detection (1 sample / 0.5 s sim)
  e.histT = (e.histT || 0) + dt;
  if (e.histT >= 0.5) { e.histT = 0; e.hist.push(e.n2); if (e.hist.length > 12) e.hist.shift(); }
  const rate5 = e.hist.length >= 11 ? e.hist[e.hist.length - 1] - e.hist[e.hist.length - 11] : 99;
  e.maxMot = !e.lit && e.valve && e.n2 > 8 && rate5 < 1;
  e.rate5 = rate5;
}

// ------------------------------------------------------------------ markup helpers
function toggleSw(key, label, positions, small = '') {
  return `<div class="${P}sw" data-key="${key}">
    <div class="${P}swlabel">${label}</div>
    <div class="${P}swbody">
      <svg viewBox="0 0 30 60" aria-hidden="true"><circle cx="15" cy="30" r="9" class="${P}swbase"/><circle cx="15" cy="30" r="5.5" class="${P}swnut"/>
        <line data-lev x1="15" y1="30" x2="15" y2="8" class="${P}swlever"/><circle data-knob cx="15" cy="8" r="5" class="${P}swknob"/></svg>
      <div class="${P}swpos">${positions.map((v) => `<button type="button" data-v="${v}">${v}</button>`).join('')}</div>
    </div>${small ? `<div class="${P}swsmall">${small}</div>` : ''}
  </div>`;
}

function rotary(key, label, positions, angles, opts = {}) {
  const r = opts.r || 40;
  return `<div class="${P}rot" data-key="${key}">
    <svg viewBox="0 0 120 104" aria-label="${label}">
      ${positions.map((v, i) => {
        const [x, y] = pol(60, 64, r, angles[i]);
        const [tx, ty] = pol(60, 64, 25, angles[i]);
        const [tx2, ty2] = pol(60, 64, 30, angles[i]);
        return `<line x1="${tx}" y1="${ty}" x2="${tx2}" y2="${ty2}" class="${P}rottick"/>
          <text x="${x}" y="${y + 3}" text-anchor="middle" data-v="${v}" class="${P}rotlbl">${v}</text>`;
      }).join('')}
      <g data-knob style="transform-origin:60px 64px"><circle cx="60" cy="64" r="17" class="${P}rotknob"/>
        <rect x="56.5" y="44" width="7" height="40" rx="3" class="${P}rotbar"/><path d="M60 46 l-3 7 h6z" class="${P}rotptr"/></g>
    </svg>
    <div class="${P}rotname">${label}</div>
  </div>`;
}

function startLever(n) {
  return `<div class="${P}lever" data-key="lever.${n}">
    <svg viewBox="0 0 64 150" aria-label="Engine ${n} start lever">
      <text x="32" y="12" text-anchor="middle" class="${P}levlbl" data-v="IDLE">IDLE</text>
      <rect x="27" y="22" width="10" height="106" rx="4" class="${P}levslot"/>
      <line x1="18" y1="30" x2="46" y2="30" class="${P}levdet"/><line x1="18" y1="120" x2="46" y2="120" class="${P}levdet"/>
      <g data-handle style="transition:transform .35s cubic-bezier(.3,.8,.3,1)">
        <rect x="14" y="20" width="36" height="20" rx="5" class="${P}levknob"/>
        <line x1="20" y1="26" x2="44" y2="26" class="${P}levgrip"/><line x1="20" y1="30" x2="44" y2="30" class="${P}levgrip"/><line x1="20" y1="34" x2="44" y2="34" class="${P}levgrip"/>
      </g>
      <text x="32" y="144" text-anchor="middle" class="${P}levlbl" data-v="CUTOFF">CUTOFF</text>
    </svg>
    <div class="${P}levname">${n}</div>
  </div>`;
}

// ------------------------------------------------------------------ engine display
function buildDisplays() {
  const up = [], lo = [];
  const X = { 1: 115, 2: 345 };
  for (const n of [1, 2]) {
    up.push(dial({ id: `n1-${n}`, cx: X[n], cy: 104, r: 62, min: 0, max: 110, ticks: [0, 20, 40, 60, 80, 100], tickLabels: [0, 2, 4, 6, 8, 10], red: 104, digits: 1 }));
    up.push(dial({ id: `egt-${n}`, cx: X[n], cy: 250, r: 58, min: 0, max: 1100, ticks: [0, 200, 400, 600, 800, 1000], red: 950, startRed: START_LIMIT, digits: 0 }));
    lo.push(dial({ id: `n2-${n}`, cx: X[n], cy: 86, r: 50, min: 0, max: 110, ticks: [0, 20, 40, 60, 80, 100], red: 105, digits: 1 }));
    const sx = n === 1 ? 100 : 360, side = n === 1 ? 'left' : 'right';
    lo.push(dial({ id: `oilp-${n}`, cx: sx, cy: 228, r: 25, min: 0, max: 100, ticks: [0, 50, 100], red: 13, redSide: 'low', digits: 0, small: side }));
    lo.push(dial({ id: `oilt-${n}`, cx: sx, cy: 308, r: 25, min: 0, max: 175, ticks: [0, 175], red: 155, digits: 0, small: side }));
    lo.push(dial({ id: `vib-${n}`, cx: sx, cy: 418, r: 25, min: 0, max: 5, ticks: [0, 5], digits: 1, small: side, nofill: true }));
  }
  const tx = (x, y, t, cls = 'lbl', anchor = 'middle', extra = '') => `<text x="${x}" y="${y}" text-anchor="${anchor}" class="${P}d-${cls}" ${extra}>${t}</text>`;
  const upper = `<svg class="${P}disp" viewBox="0 0 460 330" role="img" aria-label="Upper engine display">
    <rect x="0" y="0" width="460" height="330" class="${P}d-bg"/>
    ${up.join('')}
    ${tx(230, 108, 'N1')}${tx(230, 254, 'EGT')}
    ${[1, 2].map((n) => tx(X[n], 300, 'START VALVE', 'alert', 'middle', `data-alert="svo-${n}"`) + tx(X[n], 314, 'OPEN', 'alert', 'middle', `data-alert="svo2-${n}"`)).join('')}
    <g data-alert="sl" class="${P}d-legend">${tx(230, 322, 'RED RADIAL = START LIMIT', 'hint')}</g>
  </svg>`;
  const ff = (n) => `<rect x="${X[n] - 34}" y="146" width="68" height="26" rx="2" class="${P}d-ffbox"/>${tx(X[n] + 26, 165, '0.00', 'num', 'end', `data-ff="${n}"`)}`;
  const oq = (n) => tx(n === 1 ? 100 : 360, 372, '17', 'num', 'middle', `data-oq="${n}"`);
  const lower = `<svg class="${P}disp" viewBox="0 0 460 456" role="img" aria-label="Lower engine display">
    <rect x="0" y="0" width="460" height="456" class="${P}d-bg"/>
    ${lo.join('')}
    ${tx(230, 90, 'N2')}${ff(1)}${ff(2)}${tx(230, 160, 'FF')}${tx(230, 174, 'KG/H ×1000', 'unit')}
    ${tx(230, 226, 'OIL', 'lbl2')}${tx(230, 240, 'PRESS', 'lbl2')}${tx(230, 306, 'OIL', 'lbl2')}${tx(230, 320, 'TEMP', 'lbl2')}
    ${oq(1)}${oq(2)}${tx(230, 366, 'OIL', 'lbl2')}${tx(230, 380, 'QTY', 'lbl2')}${tx(230, 422, 'VIB')}
    ${tx(100, 258, 'LOW OIL', 'alert', 'middle', 'data-alert="lop-1"')}${tx(100, 270, 'PRESSURE', 'alert', 'middle', 'data-alert="lop2-1"')}
    ${tx(360, 258, 'LOW OIL', 'alert', 'middle', 'data-alert="lop-2"')}${tx(360, 270, 'PRESSURE', 'alert', 'middle', 'data-alert="lop2-2"')}
  </svg>`;
  return { upper, lower, dials: [...up, ...lo] };
}

// ------------------------------------------------------------------ trainer
export default {
  id: 'enginestart',
  title: 'Engine start',
  group: 'Systems',
  summary: 'CFM56-7B ground start in real time: duct pressure, start switch, start lever, light-off, cutout, and four abnormal starts to recognise.',
  mount(el, ctx = {}) {
    let s = initialState('normal', 2);
    let speed = 1;
    let dispAcc = 0;

    const disp = buildDisplays();
    const duct = ductGauge(`${P}duct`);

    el.innerHTML = `<div class="${P}root">
      <header class="${P}head">
        <div>
          <div class="${P}eyebrow">Training · Systems</div>
          <h2 class="${P}title">Engine start</h2>
          <p class="${P}lede">Normal ground start of the CFM56-7B with APU bleed air, and abnormal starts to practise recognising. Times and values are representative, not certified data.</p>
        </div>
        <div class="${P}bar">
          <label class="${P}field"><span>Scenario</span>
            <select data-act="scenario">${SCENARIOS.map((x) => `<option value="${x.id}">${esc(x.label)}</option>`).join('')}</select></label>
          <div class="${P}field"><span>Practise on</span>
            <div class="${P}seg" data-act="focus"><button type="button" data-val="1">ENG 1</button><button type="button" data-val="2">ENG 2</button></div></div>
          <div class="${P}field"><span>Speed</span>
            <div class="${P}seg" data-act="speed"><button type="button" data-val="1">1×</button><button type="button" data-val="2">2×</button><button type="button" data-val="4">4×</button></div></div>
          <div class="${P}field"><span>Sim time</span><div class="${P}clock" data-clock>0:00</div></div>
          <button type="button" class="${P}btn" data-act="pause">Pause</button>
          <button type="button" class="${P}btn ${P}btn-accent" data-act="reset">Reset</button>
        </div>
      </header>

      <div class="${P}grid">
        <section class="${P}col ${P}controls">
          <div class="${P}cardtitle">Overhead</div>
          <div class="${P}panel">
            <div class="${P}panelname">Air conditioning · bleed</div>
            <div class="${P}ductrow">${duct.svg}
              <div class="${P}ductinfo"><b>Duct pressure</b><span>L <i data-dl>0</i> · R <i data-dr>0</i> psi</span><em data-ductnote></em></div>
            </div>
            <div class="${P}swrow">
              ${toggleSw('pack.L', 'L PACK', ['HIGH', 'AUTO', 'OFF'])}
              ${toggleSw('iso', 'ISOLATION VALVE', ['OPEN', 'AUTO', 'CLOSE'])}
              ${toggleSw('pack.R', 'R PACK', ['HIGH', 'AUTO', 'OFF'])}
            </div>
            <div class="${P}swrow">
              ${toggleSw('bleed.e1', '1 BLEED', ['ON', 'OFF'])}
              ${toggleSw('bleed.apu', 'APU BLEED', ['ON', 'OFF'])}
              ${toggleSw('bleed.e2', '2 BLEED', ['ON', 'OFF'])}
            </div>
          </div>
          <div class="${P}panel ${P}panel-row">
            <div><div class="${P}panelname">APU</div>${rotary('apu', 'APU', ['OFF', 'ON', 'START'], [-45, 0, 45], { r: 40 })}
              <div class="${P}apustat" data-apu></div></div>
            <div class="${P}panelsep"></div>
            <div><div class="${P}panelname">Ignition select</div>${rotary('ign', 'IGNITION', ['IGN L', 'BOTH', 'IGN R'], [-50, 0, 50], { r: 41 })}</div>
          </div>
          <div class="${P}panel">
            <div class="${P}panelname">Engine start</div>
            <div class="${P}swrow ${P}swrow-2">
              ${rotary('start.1', 'ENGINE 1', SWITCH_POS, [-80, -30, 18, 62], { r: 42 })}
              ${rotary('start.2', 'ENGINE 2', SWITCH_POS, [-80, -30, 18, 62], { r: 42 })}
            </div>
            <p class="${P}panelhint">Click a position label (or the knob) to select. GRD is held by a solenoid until starter cutout.</p>
          </div>
          <div class="${P}cardtitle">Control stand</div>
          <div class="${P}panel ${P}pedestal">
            <div class="${P}panelname">Engine start levers</div>
            <div class="${P}levers">${startLever(1)}${startLever(2)}</div>
            <div class="${P}startinfo" data-starter></div>
          </div>
        </section>

        <section class="${P}col ${P}displays">
          <div class="${P}cardtitle">Engine display <span class="${P}cardsub">upper</span></div>
          <div class="${P}bezel">${disp.upper}</div>
          <div class="${P}cardtitle">Engine display <span class="${P}cardsub">lower (secondary)</span></div>
          <div class="${P}bezel">${disp.lower}</div>
          <p class="${P}note">Display layout simplified. Oil quantity units and fuel-flow units depend on the airplane; many show fuel flow in kg/h ×1000.</p>
        </section>

        <section class="${P}col ${P}coach">
          <div class="${P}cardtitle">Coach <span class="${P}cardsub" data-scen></span></div>
          <div class="${P}now" data-now></div>
          <div class="${P}cues" data-cues></div>
          <ol class="${P}phases" data-phases>${PHASES.map((p, i) => `<li data-ph="${p.id}"><span class="${P}phn">${i + 1}</span><div><b>${esc(p.t)}</b><p>${esc(p.d)}</p></div></li>`).join('')}</ol>
          <div class="${P}cardtitle">Event log</div>
          <ul class="${P}log" data-log></ul>
        </section>
      </div>

      <section class="${P}abn">
        <div class="${P}cardtitle">Abnormal starts: what to notice</div>
        <div class="${P}abngrid">${ABNORMALS.map((a) => `<article class="${P}abncard" data-abn="${a.id}">
          <h3>${esc(a.t)}</h3>
          <dl><dt>You see</dt><dd>${esc(a.see)}</dd><dt>Likely cause</dt><dd>${esc(a.why)}</dd><dt>Generic response</dt><dd>${esc(a.act)}</dd></dl>
          <button type="button" class="${P}btn ${P}btn-sm" data-try="${a.id}">Practise this</button>
        </article>`).join('')}</div>
        <p class="${P}caveat">General principles only. Aborted-start criteria and actions (including motoring and starter duty cycle) come from your operator's QRH, FCOM and limitations. Follow them, not this page.</p>
      </section>
    </div>`;

    const root = el.firstElementChild;
    const q = (sel) => root.querySelector(sel);
    const binders = Object.fromEntries(disp.dials.map((d) => [d.id, d.bind(root)]));
    const ductUpd = duct.bind(root);
    const alertEl = Object.fromEntries([...root.querySelectorAll('[data-alert]')].map((x) => [x.dataset.alert, x]));

    // ---------------------------------------------------------------- log / cues
    const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
    function log(msg, kind = '') {
      s.log.unshift({ t: s.t, msg, kind });
      if (s.log.length > 40) s.log.pop();
      renderLog();
    }
    function renderLog() {
      q('[data-log]').innerHTML = s.log.length
        ? s.log.map((l) => `<li class="${l.kind ? `is-${l.kind}` : ''}"><time>${fmt(l.t)}</time><span>${esc(l.msg)}</span></li>`).join('')
        : `<li class="is-empty"><span>Nothing yet. Start with the air supply.</span></li>`;
    }
    function cue(id, level, title, text) {
      if (s.cues.some((c) => c.id === id)) return;
      s.cues.unshift({ id, level, title, text });
      log(title, level === 'ok' ? 'ok' : level === 'warn' ? 'warn' : 'caution');
      renderCues();
    }
    function renderCues() {
      q('[data-cues]').innerHTML = s.cues.slice(0, 3).map((c) => `<div class="${P}cue is-${c.level}"><b>${esc(c.title)}</b><p>${esc(c.text)}</p></div>`).join('');
    }

    // ---------------------------------------------------------------- controls
    function setControl(key, v) {
      const [k, sub] = key.split('.');
      if (k === 'pack') s.pack[sub] = v;
      else if (k === 'iso') s.iso = v;
      else if (k === 'bleed') s.bleed[sub] = v === 'ON';
      else if (k === 'ign') s.ign = v;
      else if (k === 'apu') {
        if (v === 'START') {
          if (s.apu === 'OFF') { s.apu = 'STARTING'; s.apuT = 0; log('APU start initiated'); }
        } else if (v === 'OFF') { if (s.apu !== 'OFF') log('APU shut down'); s.apu = 'OFF'; }
      } else if (k === 'start') {
        const e = s.eng[sub];
        if (v === 'GRD' && e.sw !== 'GRD') {
          if (e.n2 > 20) { ctx.toast?.(`ENG ${sub}: don't engage the starter above 20% N2. Let N2 run down first.`, 'warn'); return; }
          if (!e.valve) { e.tValve = s.t; log(`ENG ${sub} start switch GRD: start valve opens`); }
        }
        if (e.sw === 'GRD' && v !== 'GRD') log(`ENG ${sub} start switch moved to ${v}`);
        e.sw = v;
      } else if (k === 'lever') {
        const e = s.eng[sub];
        if (v === e.lever) return;
        e.lever = v;
        if (v === 'IDLE') {
          e.tIdle = s.t; e.n2AtFuel = e.n2; e.aborted = false;
          log(`ENG ${sub} start lever IDLE at ${e.n2.toFixed(1)}% N2`);
        } else {
          log(`ENG ${sub} start lever CUTOFF: fuel off`);
          if (!e.running) e.aborted = true;
        }
      }
      renderControls();
    }

    function cycleRot(key) {
      const opts = { 'start.1': SWITCH_POS, 'start.2': SWITCH_POS, ign: ['IGN L', 'BOTH', 'IGN R'], apu: ['OFF', 'ON', 'START'] }[key];
      const cur = getVal(key);
      setControl(key, opts[(opts.indexOf(cur) + 1) % opts.length]);
    }
    function getVal(key) {
      const [k, sub] = key.split('.');
      if (k === 'pack') return s.pack[sub];
      if (k === 'iso') return s.iso;
      if (k === 'bleed') return s.bleed[sub] ? 'ON' : 'OFF';
      if (k === 'ign') return s.ign;
      if (k === 'apu') return s.apu === 'OFF' ? 'OFF' : s.apu === 'STARTING' && s.apuT < 1.2 ? 'START' : 'ON';
      if (k === 'start') return s.eng[sub].sw;
      if (k === 'lever') return s.eng[sub].lever;
      return '';
    }

    function renderControls() {
      root.querySelectorAll(`.${P}sw`).forEach((w) => {
        const opts = [...w.querySelectorAll('[data-v]')].map((b) => b.dataset.v);
        const cur = getVal(w.dataset.key);
        const i = opts.indexOf(cur);
        const ys = opts.length === 2 ? [9, 51] : [9, 30, 51];
        const y = ys[i] ?? 30;
        w.querySelector('[data-lev]').setAttribute('y2', y);
        const kn = w.querySelector('[data-knob]');
        kn.setAttribute('cy', y); kn.setAttribute('r', y === 30 ? 6.5 : 5);
        w.querySelectorAll('[data-v]').forEach((b) => b.classList.toggle('is-on', b.dataset.v === cur));
      });
      root.querySelectorAll(`.${P}rot`).forEach((w) => {
        const labels = [...w.querySelectorAll('[data-v]')];
        const cur = getVal(w.dataset.key);
        const angles = { 'start.1': [-80, -30, 18, 62], 'start.2': [-80, -30, 18, 62], ign: [-50, 0, 50], apu: [-45, 0, 45] }[w.dataset.key];
        const i = labels.findIndex((l) => l.dataset.v === cur);
        w.querySelector('[data-knob]').style.transform = `rotate(${angles[Math.max(0, i)]}deg)`;
        labels.forEach((l) => l.classList.toggle('is-on', l.dataset.v === cur));
      });
      root.querySelectorAll(`.${P}lever`).forEach((w) => {
        const cur = getVal(w.dataset.key);
        w.querySelector('[data-handle]').style.transform = `translateY(${cur === 'IDLE' ? 0 : 90}px)`;
        w.querySelectorAll('[data-v]').forEach((l) => l.classList.toggle('is-on', l.dataset.v === cur));
      });
      root.querySelectorAll('[data-act="focus"] button').forEach((b) => b.classList.toggle('is-on', +b.dataset.val === s.focus));
      root.querySelectorAll('[data-act="speed"] button').forEach((b) => b.classList.toggle('is-on', +b.dataset.val === speed));
      q('[data-act="pause"]').textContent = s.paused ? 'Resume' : 'Pause';
      q('[data-act="pause"]').classList.toggle('is-on', s.paused);
    }

    function reset(scenario = s.scenario, focus = s.focus) {
      s = initialState(scenario, focus);
      q('[data-act="scenario"]').value = scenario;
      renderCues(); renderLog(); renderControls();
      const label = SCENARIOS.find((x) => x.id === scenario)?.label || '';
      q('[data-scen]').textContent = `${scenario === 'surprise' ? 'Surprise (hidden)' : label} · ENG ${focus}`;
      root.querySelectorAll('[data-abn]').forEach((c) => c.classList.toggle('is-active', scenario !== 'surprise' && c.dataset.abn === scenario));
      render(true);
    }

    function onClick(ev) {
      const act = ev.target.closest('[data-act]');
      const t = ev.target.closest('[data-try]');
      if (t) { reset(t.dataset.try, s.focus); root.scrollIntoView?.({ behavior: 'smooth', block: 'start' }); return; }
      if (act && act.tagName !== 'SELECT') {
        const a = act.dataset.act;
        const val = ev.target.closest('[data-val]')?.dataset.val;
        if (a === 'reset') reset();
        else if (a === 'pause') { s.paused = !s.paused; renderControls(); }
        else if (a === 'speed' && val) { speed = +val; renderControls(); }
        else if (a === 'focus' && val) reset(s.scenario, +val);
        return;
      }
      const ctl = ev.target.closest('[data-key]');
      if (!ctl) return;
      const v = ev.target.closest('[data-v]')?.dataset.v;
      const key = ctl.dataset.key;
      if (v) setControl(key, v);
      else if (ctl.classList.contains(`${P}rot`) && ev.target.closest('[data-knob]')) cycleRot(key);
      else if (ctl.classList.contains(`${P}lever`) && ev.target.closest('[data-handle]')) setControl(key, getVal(key) === 'IDLE' ? 'CUTOFF' : 'IDLE');
      else if (ctl.classList.contains(`${P}sw`) && ev.target.closest('svg')) {
        const opts = [...ctl.querySelectorAll('[data-v]')].map((b) => b.dataset.v);
        setControl(key, opts[(opts.indexOf(getVal(key)) + 1) % opts.length]);
      }
    }
    function onChange(ev) {
      if (ev.target.matches('[data-act="scenario"]')) reset(ev.target.value, s.focus);
    }
    root.addEventListener('click', onClick);
    root.addEventListener('change', onChange);

    // ---------------------------------------------------------------- coach logic
    function coach() {
      const n = s.focus, e = s.eng[n];
      const p = n === 1 ? s.duct.L : s.duct.R;
      const m = e.mark;
      if (!m.air && (p >= 25 || e.valve)) m.air = true;
      if (!m.valve && e.valve) m.valve = true;
      if (!m.rot && e.n1 > 0.5 && e.oilP > 3) m.rot = true;
      if (!m.fuel && e.lever === 'IDLE') m.fuel = true;
      if (!m.lit && e.lit) { m.lit = true; log(`ENG ${n} light-off ${(e.tLit - e.tIdle).toFixed(1)} s after fuel`, 'ok'); }
      if (!m.cutout && e.tCut != null) { m.cutout = true; log(`ENG ${n} starter cutout at ${e.n2.toFixed(1)}% N2: start switch to OFF`, 'ok'); }
      if (!m.idle && e.running && e.lit && Math.abs(e.n2 - IDLE.n2) < 0.6 && !e.valve) {
        m.idle = true; e.tStable = s.t;
        const fault = e.exceed ? ' EGT exceedance recorded.' : '';
        cue('idle', e.exceed ? 'caution' : 'ok', `ENG ${n} stabilised at idle`, `Light-off ${(e.tLit - e.tIdle).toFixed(1)} s after fuel, peak EGT ${Math.round(e.peakEgt)} °C (limit ${START_LIMIT} °C), fuel at ${e.n2AtFuel.toFixed(1)}% N2, ${Math.round(s.t - (e.tValve ?? 0))} s from GRD to idle.${fault}`);
        if (s.actual === 'cutout' && e.fault === 'cutout') cue('cutout-ok', 'ok', 'Starter released', 'With the start valve closed the starter is protected.');
      }

      // learning cues
      if (e.valve && p < 5 && e.grdT > 2) {
        cue('noair', 'caution', `No air at the ENG ${n} starter`, n === 2 && !s.isoOpen && s.apu === 'RUN' && s.bleed.apu
          ? 'APU bleed air enters the left side of the isolation valve. With both packs and both engine bleeds on, the AUTO isolation valve stays closed, so no air reaches the right side. Switch a pack OFF (or open the isolation valve).'
          : 'There is no bleed air in the duct. Check the APU is running and APU BLEED is on.');
      }
      if (e.valve && !e.lit && p < 22 && e.n2 > 6 && e.maxMot) cue('lowp', 'caution', 'Low duct pressure', `Max motoring is below ${FUEL_MIN}% N2. With the packs on, much of the APU air goes to them. Packs OFF raises duct pressure.`);
      if (e.maxMot && e.n2 >= FUEL_MIN && e.lever === 'CUTOFF' && e.n2 < FUEL_N2) cue('maxmot', 'info', 'Max motoring', `N2 has risen less than 1% in about 5 s. Fuel can be introduced now (at least ${FUEL_MIN}% N2).`);
      if (e.lever === 'IDLE' && e.n2AtFuel != null && e.n2AtFuel < FUEL_MIN && !e.mark.earlyCue) { e.mark.earlyCue = true; cue('early', 'caution', `Fuel below ${FUEL_MIN}% N2`, 'Fuel introduced too early. Low airflow raises the hot-start risk. Watch EGT closely.'); }
      if (e.lever === 'IDLE' && !e.lit && e.tIdle != null && s.t - e.tIdle > LIGHTOFF_S) cue('nolight', 'warn', `No EGT rise in ${LIGHTOFF_S} s`, 'That is an abort criterion: start lever CUTOFF, keep motoring to clear the fuel, then follow the QRH.');
      if (e.lever === 'IDLE' && !e.lit && e.sw === 'OFF' && e.tIdle != null && s.t - e.tIdle > 2) cue('noign', 'caution', 'No ignition', 'The start switch is OFF, so the igniters are not powered. Fuel without ignition gives a wet start.');
      if (e.lit && !e.running && e.egt > 520 && e.egtRate > 40 && e.egt + e.egtRate * 3 > START_LIMIT) cue('hotrise', 'warn', 'EGT rising very fast', `EGT is heading for the ${START_LIMIT} °C start limit. Abort before it gets there: start lever CUTOFF.`);
      if (e.exceed) cue('exceed', 'warn', 'EGT start limit exceeded', 'The start limit has been exceeded. In the airplane this is an exceedance to record and report. Start lever CUTOFF, then follow the QRH.');
      if (e.lit && !e.running && e.tLit != null && s.t - e.tLit > 8 && e.n2 > 25 && e.n2 < 54 && e.rate5 < 1) cue('hung', 'warn', 'N2 has stopped accelerating', 'Hung start: N2 stuck below idle while EGT rises. Start lever CUTOFF before the EGT limit.');
      if (e.valve && e.n2 > CUTOUT + 1.5) cue('nocut', 'warn', 'Starter has not cut out', `N2 is above ${CUTOUT}% and START VALVE OPEN is still lit. Move the start switch to OFF manually.`);
      if (e.grdT > 120 && e.valve) cue('duty', 'caution', 'Starter engaged over 2 minutes', 'Check the starter duty-cycle limits in your FCOM before continuing or retrying.');
      if (e.aborted && e.lever === 'CUTOFF' && !e.lit && !e.mark.abortCue && (s.cues.some((c) => ['nolight', 'hotrise', 'exceed', 'hung'].includes(c.id)))) {
        e.mark.abortCue = true;
        cue('aborted', 'ok', 'Start aborted', e.valve ? 'Fuel is off and the starter is still motoring the engine, which clears fuel and cools it. Watch EGT come down, then follow the QRH and the starter limits.' : 'Fuel is off. The QRH may call for motoring the engine (start switch GRD) to clear fuel and cool it. Follow your operator\'s procedure.');
        if (s.scenario === 'surprise') q('[data-scen]').textContent = `Surprise: it was "${SCENARIOS.find((x) => x.id === s.actual).label}" · ENG ${n}`;
      }
    }

    function phaseState() {
      const m = s.eng[s.focus].mark;
      const order = ['air', 'valve', 'rot', 'fuel', 'lit', 'cutout', 'idle'];
      const cur = order.find((id) => !m[id]);
      return { m, cur };
    }

    function renderCoach() {
      const n = s.focus, e = s.eng[n];
      const { m, cur } = phaseState();
      root.querySelectorAll('[data-ph]').forEach((li) => {
        li.classList.toggle('is-done', !!m[li.dataset.ph]);
        li.classList.toggle('is-cur', li.dataset.ph === cur);
      });
      const p = n === 1 ? s.duct.L : s.duct.R;
      let now;
      switch (cur) {
        case 'air': now = s.apu !== 'RUN' ? 'Start the APU (APU switch to START) and wait for it to run.' : !s.bleed.apu ? 'Switch the APU BLEED air on.' : (s.pack.L !== 'OFF' || s.pack.R !== 'OFF') ? `Duct pressure ${Math.round(p)} psi. Most operators switch the packs OFF for start to give the starter maximum air.` : `Duct pressure ${Math.round(p)} psi.`; break;
        case 'valve': now = `Duct pressure ${Math.round(p)} psi. Turn the ENGINE ${n} start switch to GRD. Watch for START VALVE OPEN and a drop in duct pressure.`; break;
        case 'rot': now = `N2 ${e.n2.toFixed(1)}%. Check N1 starts rotating and oil pressure starts rising before you introduce fuel.`; break;
        case 'fuel': now = e.n2 >= FUEL_N2 - 0.05 ? `N2 ${e.n2.toFixed(1)}%. Move start lever ${n} to IDLE now.` : e.maxMot && e.n2 >= FUEL_MIN ? `Max motoring at ${e.n2.toFixed(1)}% N2. Start lever ${n} to IDLE.` : `N2 ${e.n2.toFixed(1)}%. Wait for ${FUEL_N2}% N2 (or max motoring, not below ${FUEL_MIN}%).`; break;
        case 'lit': now = e.tIdle != null ? `Fuel on ${(s.t - e.tIdle).toFixed(1)} s. Expect an EGT rise within ${LIGHTOFF_S} s.` : 'Waiting for fuel.'; break;
        case 'cutout': now = `N2 ${e.n2.toFixed(1)}%, EGT ${Math.round(e.egt)} °C. Watch EGT against the start limit and for starter cutout at about ${CUTOUT}% N2.`; break;
        case 'idle': now = `N2 ${e.n2.toFixed(1)}%. Engine accelerating to idle: check the oil and secondary parameters.`; break;
        default: now = `ENG ${n} running at idle. Try the other engine, or pick an abnormal scenario to practise.`;
      }
      q('[data-now]').innerHTML = `<span class="${P}nowtag">${cur ? `Step ${['air', 'valve', 'rot', 'fuel', 'lit', 'cutout', 'idle'].indexOf(cur) + 1}` : 'Done'}</span><p>${esc(now)}</p>`;
    }

    // ---------------------------------------------------------------- display render
    function render(force = false) {
      for (const n of [1, 2]) {
        const e = s.eng[n];
        const egtState = e.egt > START_LIMIT && !e.running ? 'red' : e.egt > 950 ? 'red' : '';
        binders[`n1-${n}`](e.n1, '');
        binders[`egt-${n}`](e.egt, egtState, { startRed: !e.running });
        binders[`n2-${n}`](e.n2, '');
        binders[`oilp-${n}`](e.oilP, e.oilP < 13 ? 'red' : '');
        binders[`oilt-${n}`](e.oilT, '');
        binders[`vib-${n}`](e.vib, '');
        root.querySelector(`[data-ff="${n}"]`).textContent = (e.ff / 1000).toFixed(2);
        root.querySelector(`[data-oq="${n}"]`).textContent = e.oilQ.toFixed(0);
        const svo = e.valve;
        alertEl[`svo-${n}`].classList.toggle('is-on', svo);
        alertEl[`svo2-${n}`].classList.toggle('is-on', svo);
        const lop = e.oilP < 13;
        alertEl[`lop-${n}`].classList.toggle('is-on', lop);
        alertEl[`lop2-${n}`].classList.toggle('is-on', lop);
      }
      alertEl.sl.classList.toggle('is-on', !s.eng[1].running || !s.eng[2].running);
      ductUpd(s.duct.L, s.duct.R);
      q('[data-dl]').textContent = Math.round(s.duct.L);
      q('[data-dr]').textContent = Math.round(s.duct.R);
      q('[data-ductnote]').textContent = s.apu === 'STARTING' ? 'APU starting…' : s.apu === 'OFF' ? 'APU off' : !s.bleed.apu ? 'APU bleed off' : '';
      q('[data-apu]').innerHTML = s.apu === 'RUN' ? `<span class="${P}led is-green"></span>APU running` : s.apu === 'STARTING' ? `<span class="${P}led is-amber"></span>Starting ${Math.round((s.apuT / APU_START_S) * 100)}%` : `<span class="${P}led"></span>APU off`;
      const e = s.eng[s.focus];
      q('[data-starter]').innerHTML = `<span>ENG ${s.focus} starter</span><b class="${e.grdT > 120 ? 'is-warn' : ''}">${e.valve ? 'engaged' : 'off'} · ${fmt(e.grdT)}</b>`;
      q('[data-clock]').textContent = fmt(s.t);
      renderCoach();
      if (force) renderControls();
    }

    function step(dt) {
      s.t += dt;
      if (s.apu === 'STARTING') {
        s.apuT += dt;
        if (s.apuT >= APU_START_S) { s.apu = 'RUN'; log('APU running: bleed air available', 'ok'); renderControls(); }
      }
      const air = airSupply(s);
      s.isoOpen = air.isoOpen;
      s.duct.L = lag(s.duct.L, air.L, 0.8, dt);
      s.duct.R = lag(s.duct.R, air.R, 0.8, dt);
      const swBefore = [s.eng[1].sw, s.eng[2].sw];
      stepEngine(s, 1, dt);
      stepEngine(s, 2, dt);
      if (swBefore[0] !== s.eng[1].sw || swBefore[1] !== s.eng[2].sw) renderControls();
      coach();
    }

    reset('normal', 2);

    return {
      tick(dt) {
        if (s.paused) return;
        let simDt = Math.min(dt, 0.1) * speed;
        while (simDt > 0) { const h = Math.min(simDt, 0.05); step(h); simDt -= h; }
        dispAcc += dt;
        if (dispAcc > 1 / 30) { dispAcc = 0; render(); }
      },
      unmount() {
        root.removeEventListener('click', onClick);
        root.removeEventListener('change', onChange);
        el.innerHTML = '';
      },
    };
  },
};
