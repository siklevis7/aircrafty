// GPWS / EGPWS modes 1–7 and the look-ahead terrain function for the warning systems trainer.
// Envelope shapes are illustrative (they show the idea of each mode), not certified alert boundaries.
import { P, esc, clamp, alertBox, setAlert, slider, seg, bindSeg, bindSlider, pointInPoly, dragOn } from './warnings-ui.js';

const PULLUP_RESPONSE = 'Respond immediately: fly the terrain-avoidance manoeuvre in your QRH (in essence maximum thrust, wings level, pitch up firmly, speedbrakes retracted) until the alert stops and terrain clearance is assured.';

const MODES = [
  {
    id: '1', name: 'Mode 1', title: 'Excessive descent rate',
    intro: 'Compares descent rate with radio altitude. The closer you are to the ground, the lower the descent rate needed to trigger an alert. Works in any configuration.',
    x: { label: 'Descent rate (ft/min)', max: 8000, ticks: [0, 2000, 4000, 6000, 8000] },
    y: { label: 'Radio altitude (ft)', max: 2500, ticks: [0, 500, 1000, 1500, 2000, 2500] },
    start: [1500, 1600],
    zones: () => [
      { level: 'warning', text: 'PULL UP', aural: 'PULL UP', poly: [[1710, 30], [3000, 900], [7125, 2450], [8000, 2450], [8000, 30]] },
      { level: 'caution', text: 'SINK RATE', aural: 'SINK RATE, SINK RATE', poly: [[964, 30], [5007, 2450], [8000, 2450], [8000, 30]] },
    ],
    respond: 'SINK RATE: reduce the descent rate. PULL UP: ' + PULLUP_RESPONSE,
  },
  {
    id: '2', name: 'Mode 2', title: 'Excessive terrain closure rate',
    intro: 'Watches how fast the radio altitude is decreasing, so it catches rising terrain under the aircraft. With flaps not in the landing position (2A) the envelope is larger. In landing configuration (2B) it is desensitised.',
    x: { label: 'Terrain closure rate (ft/min)', max: 10000, ticks: [0, 2000, 4000, 6000, 8000, 10000] },
    y: { label: 'Radio altitude (ft)', max: 2500, ticks: [0, 500, 1000, 1500, 2000, 2500] },
    start: [2500, 1900],
    opts: [['cfg', 'Configuration', [['A', '2A · flaps not landing'], ['B', '2B · landing flaps']], 'A']],
    zones: (o) => o.cfg === 'B'
      ? [{ level: 'caution', text: 'TERRAIN', aural: 'TERRAIN, TERRAIN', poly: [[2200, 200], [3300, 790], [10000, 790], [10000, 200]] }]
      : [
        { level: 'warning', text: 'PULL UP', aural: 'TERRAIN, TERRAIN … PULL UP', poly: [[2600, 30], [4600, 1100], [6400, 1550], [10000, 1550], [10000, 30]] },
        { level: 'caution', text: 'TERRAIN', aural: 'TERRAIN, TERRAIN', poly: [[2000, 30], [4000, 1200], [5800, 1650], [10000, 1650], [10000, 30]] },
      ],
    respond: '“TERRAIN” comes first, followed by PULL UP if the closure continues. ' + PULLUP_RESPONSE,
  },
  {
    id: '3', name: 'Mode 3', title: 'Altitude loss after takeoff',
    intro: 'Active after takeoff or a go-around until a safe height is reached. It alerts if you lose height instead of climbing, for example by pitching down or retracting flaps too early. The altitude loss it allows grows with height.',
    x: { label: 'Altitude lost since climb began (ft)', max: 200, ticks: [0, 50, 100, 150, 200] },
    y: { label: 'Radio altitude (ft)', max: 1600, ticks: [0, 400, 800, 1200, 1600] },
    start: [20, 900],
    zones: () => [{ level: 'caution', text: "DON'T SINK", aural: "DON'T SINK, DON'T SINK", poly: [[8, 30], [143, 1500], [200, 1500], [200, 30]] }],
    respond: 'Stop the descent and re-establish a positive climb.',
  },
  {
    id: '4', name: 'Mode 4', title: 'Unsafe terrain clearance',
    intro: 'Alerts when you are close to the ground without being in landing configuration. 4A applies with the gear up, 4B with the gear down but flaps not in landing position. At higher speeds both give TOO LOW TERRAIN.',
    x: { label: 'Airspeed (kt)', min: 100, max: 320, ticks: [100, 150, 200, 250, 300] },
    y: { label: 'Radio altitude (ft)', max: 1200, ticks: [0, 300, 600, 900, 1200] },
    start: [170, 800],
    opts: [['cfg', 'Configuration', [['gu', 'Gear up'], ['gd', 'Gear down, flaps up'], ['ld', 'Gear down, landing flaps']], 'gu']],
    zones: (o) => o.cfg === 'gu'
      ? [
        { level: 'caution', text: 'TOO LOW GEAR', aural: 'TOO LOW, GEAR', poly: [[100, 30], [190, 30], [190, 500], [100, 500]] },
        { level: 'caution', text: 'TOO LOW TERRAIN', aural: 'TOO LOW, TERRAIN', poly: [[190, 30], [320, 30], [320, 1000], [250, 1000], [190, 500]] },
      ]
      : o.cfg === 'gd'
        ? [
          { level: 'caution', text: 'TOO LOW FLAPS', aural: 'TOO LOW, FLAPS', poly: [[100, 30], [159, 30], [159, 245], [100, 245]] },
          { level: 'caution', text: 'TOO LOW TERRAIN', aural: 'TOO LOW, TERRAIN', poly: [[159, 30], [320, 30], [320, 1000], [250, 1000], [159, 245]] },
        ]
        : [],
    respond: 'Correct the configuration if a landing is intended, or climb away from the terrain. An intentional flaps-up landing uses the flap inhibit switch.',
  },
  {
    id: '5', name: 'Mode 5', title: 'Below glideslope',
    intro: 'On an ILS approach below about 1,000 ft RA with the gear down, it alerts when you go too far below the glideslope. The soft alert is quieter. The hard alert (lower and further below) is louder. The amber BELOW G/S light comes on with either.',
    x: { label: 'Deviation below glideslope (dots)', max: 4, ticks: [0, 1, 2, 3, 4] },
    y: { label: 'Radio altitude (ft)', max: 1100, ticks: [0, 250, 500, 750, 1000] },
    start: [0.6, 700],
    zones: () => [
      { level: 'caution', text: 'GLIDESLOPE', aural: 'GLIDESLOPE (louder, repeated)', poly: [[2, 30], [2, 300], [4, 300], [4, 30]], hard: true },
      { level: 'caution', text: 'GLIDESLOPE', aural: 'glideslope (soft)', poly: [[1.3, 30], [1.3, 1000], [4, 1000], [4, 30]] },
    ],
    respond: 'Correct back to the glideslope. Pressing the BELOW G/S light inhibits the alert when the deviation is intentional (for example, visual with the runway below the minimum glideslope height).',
  },
];

const W = 640, H = 400, X0 = 74, X1 = 616, Y0 = 18, Y1 = 346;

function envelopeView(m, o) {
  const xmin = m.x.min || 0;
  const sx = (v) => X0 + ((v - xmin) / (m.x.max - xmin)) * (X1 - X0);
  const sy = (v) => Y1 - (v / m.y.max) * (Y1 - Y0);
  const zones = m.zones(o);
  const poly = (z) => z.poly.map(([x, y]) => `${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join(' ');
  const order = [...zones].reverse(); // draw cautions underneath warnings
  return {
    sx, sy, zones,
    svg: `<svg class="${P}env" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(m.title)} envelope">
      <rect x="${X0}" y="${Y0}" width="${X1 - X0}" height="${Y1 - Y0}" class="${P}env-bg"/>
      ${m.x.ticks.map((t) => `<line x1="${sx(t)}" y1="${Y0}" x2="${sx(t)}" y2="${Y1}" class="${P}grid"/><text x="${sx(t)}" y="${Y1 + 18}" text-anchor="middle" class="${P}axis">${t}</text>`).join('')}
      ${m.y.ticks.map((t) => `<line x1="${X0}" y1="${sy(t)}" x2="${X1}" y2="${sy(t)}" class="${P}grid"/><text x="${X0 - 8}" y="${sy(t) + 4}" text-anchor="end" class="${P}axis">${t}</text>`).join('')}
      ${order.map((z, i) => `<polygon points="${poly(z)}" class="${P}zone ${P}zone-${z.level}${z.hard ? ` ${P}zone-hard` : ''}" data-z="${zones.length - 1 - i}"/>`).join('')}
      ${zones.map((z, i) => `<g transform="translate(${X0 + 12} ${Y0 + 14 + i * 22})"><rect x="0" y="-11" width="14" height="14" rx="2" class="${P}zone ${P}zone-${z.level}${z.hard ? ` ${P}zone-hard` : ''}"/>
        <text x="22" y="1" class="${P}zonelbl ${P}zonelbl-${z.level}">${esc(z.text)}${z.hard ? ' (hard alert)' : z.level === 'caution' && zones.some((o) => o.hard) ? ' (soft alert)' : ''}</text></g>`).join('')}
      ${zones.length ? '' : `<text x="${(X0 + X1) / 2}" y="${(Y0 + Y1) / 2}" text-anchor="middle" class="${P}zonelbl">No mode 4 alerts in landing configuration</text>`}
      <text x="${(X0 + X1) / 2}" y="${H - 6}" text-anchor="middle" class="${P}axislbl">${esc(m.x.label)}</text>
      <text x="16" y="${(Y0 + Y1) / 2}" text-anchor="middle" transform="rotate(-90 16 ${(Y0 + Y1) / 2})" class="${P}axislbl">${esc(m.y.label)}</text>
      <g data-ac class="${P}ac"><line data-gx class="${P}ac-guide"/><line data-gy class="${P}ac-guide"/>
        <circle r="15" class="${P}ac-halo"/><path d="M0 -10 L2.2 -3 L10 1 L10 3.5 L2.2 1.5 L1.6 7 L4.5 9.5 L4.5 11 L0 9.6 L-4.5 11 L-4.5 9.5 L-1.6 7 L-2.2 1.5 L-10 3.5 L-10 1 L-2.2 -3 Z" class="${P}ac-icon" transform="rotate(90)"/></g>
    </svg>`,
  };
}

function mountEnvelope(host, m, sh) {
  const o = Object.fromEntries((m.opts || []).map(([k, , , d]) => [k, d]));
  let pt = [...m.start];
  let cleanup = null, view = null;
  host.innerHTML = `<div class="${P}split">
    <div class="${P}stack">
      <div class="${P}modehead"><span class="${P}modetag">${esc(m.name)}</span><h3>${esc(m.title)}</h3></div>
      <p class="${P}p">${esc(m.intro)}</p>
      ${(m.opts || []).map(([k, l, opts, d]) => seg(k, l, opts, d)).join('')}
      <div data-alert>${alertBox()}</div>
      <div class="${P}readout" data-read></div>
      <div class="${P}card"><h4>Recognise and respond</h4><p>${esc(m.respond)}</p></div>
      <p class="${P}fine">Drag the aircraft around the graph. Envelope shapes are illustrative of the logic, not exact certified boundaries.</p>
    </div>
    <div class="${P}figure" data-fig></div>
  </div>`;
  const fig = host.querySelector('[data-fig]');
  const alertEl = host.querySelector(`[data-alert] .${P}alert`);
  const xmin = m.x.min || 0;
  function draw() {
    cleanup?.();
    view = envelopeView(m, o);
    fig.innerHTML = view.svg;
    const svg = fig.querySelector('svg');
    cleanup = dragOn(svg, svg, ({ x, y }) => {
      const vx = xmin + ((clamp(x, X0, X1) - X0) / (X1 - X0)) * (m.x.max - xmin);
      const vy = ((Y1 - clamp(y, Y0, Y1)) / (Y1 - Y0)) * m.y.max;
      pt = [vx, vy]; update();
    });
    update();
  }
  function update() {
    const svg = fig.querySelector('svg');
    const ac = svg.querySelector('[data-ac]');
    const X = view.sx(pt[0]), Y = view.sy(pt[1]);
    ac.setAttribute('transform', `translate(${X.toFixed(1)} ${Y.toFixed(1)})`);
    const gx = ac.querySelector('[data-gx]'), gy = ac.querySelector('[data-gy]');
    gx.setAttribute('x1', 0); gx.setAttribute('y1', 0); gx.setAttribute('x2', 0); gx.setAttribute('y2', Y1 - Y);
    gy.setAttribute('x1', 0); gy.setAttribute('y1', 0); gy.setAttribute('x2', X0 - X); gy.setAttribute('y2', 0);
    const hit = view.zones.findIndex((z) => pointInPoly(pt, z.poly));
    svg.querySelectorAll('[data-z]').forEach((p) => p.classList.toggle('is-hit', +p.dataset.z === hit));
    const z = view.zones[hit];
    setAlert(alertEl, z ? z.text : '', z ? z.level : 'ok', z ? z.aural : '');
    ac.dataset.level = z ? z.level : '';
    sh.sound(z ? (z.level === 'warning' ? 'whoop' : 'tone') : null);
    const dig = m.x.max <= 10 ? 1 : 0;
    host.querySelector('[data-read]').innerHTML = `<span>${esc(m.x.label)}</span><b>${pt[0].toFixed(dig)}</b><span>${esc(m.y.label)}</span><b>${Math.round(pt[1])}</b>`;
  }
  (m.opts || []).forEach(([k]) => bindSeg(host, k, (v) => { o[k] = v; draw(); }));
  draw();
  return { unmount() { cleanup?.(); } };
}

// ---------------------------------------------------------------- mode 6
function mountMode6(host, sh) {
  const CALLS = [[500, 'FIVE HUNDRED'], [100, 'ONE HUNDRED'], [50, 'FIFTY'], [40, 'FORTY'], [30, 'THIRTY'], [20, 'TWENTY'], [10, 'TEN']];
  let ra = 700, flying = false, dh = 200, last = Infinity, callout = '', calloutT = 0, bank = 0;
  host.innerHTML = `<div class="${P}split">
    <div class="${P}stack">
      <div class="${P}modehead"><span class="${P}modetag">Mode 6</span><h3>Altitude callouts and bank angle</h3></div>
      <p class="${P}p">Mode 6 gives advisory callouts on approach, based on radio altitude and the decision height you set. The set of callouts is an operator option, and a common one is shown. Mode 6 also includes the BANK ANGLE alert when roll becomes excessive (about 35° on many installations).</p>
      <div class="${P}card"><h4>Altitude callouts</h4>
        ${slider('dh', 'Decision height (RA)', 50, 400, 10, dh, ' ft')}
        <div class="${P}row"><button type="button" class="${P}btn ${P}btn-accent" data-fly>Fly the approach</button><span class="${P}fine">Radio altitude counts down to touchdown.</span></div>
        <div class="${P}callout"><div><span class="${P}slabel">Radio altitude</span><b data-ra>700</b></div><div class="${P}calltext" data-call>—</div></div>
      </div>
      <div class="${P}card"><h4>Bank angle</h4>${slider('bank', 'Bank angle', -60, 60, 1, 0, '°')}
        <div data-alert>${alertBox()}</div></div>
    </div>
    <div class="${P}figure">
      <svg class="${P}adi" viewBox="0 0 300 300" role="img" aria-label="Attitude indicator">
        <defs><clipPath id="${P}adiclip"><circle cx="150" cy="150" r="128"/></clipPath></defs>
        <g clip-path="url(#${P}adiclip)"><g data-horizon>
          <rect x="-200" y="-200" width="700" height="350" class="${P}adi-sky"/><rect x="-200" y="150" width="700" height="350" class="${P}adi-gnd"/>
          <line x1="-200" y1="150" x2="500" y2="150" class="${P}adi-hz"/>
          ${[-20, -10, 10, 20].map((p) => `<line x1="${150 - (Math.abs(p) === 10 ? 22 : 34)}" y1="${150 - p * 3}" x2="${150 + (Math.abs(p) === 10 ? 22 : 34)}" y2="${150 - p * 3}" class="${P}adi-pl"/>`).join('')}
        </g></g>
        <circle cx="150" cy="150" r="128" class="${P}adi-rim"/>
        ${[-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60].map((a) => { const t = (a * Math.PI) / 180; const r0 = 128, r1 = a % 30 === 0 ? 112 : 118; return `<line x1="${150 + r0 * Math.sin(t)}" y1="${150 - r0 * Math.cos(t)}" x2="${150 + r1 * Math.sin(t)}" y2="${150 - r1 * Math.cos(t)}" class="${P}adi-tk"/>`; }).join('')}
        ${[-35, 35].map((a) => { const t = (a * Math.PI) / 180; return `<line x1="${150 + 128 * Math.sin(t)}" y1="${150 - 128 * Math.cos(t)}" x2="${150 + 108 * Math.sin(t)}" y2="${150 - 108 * Math.cos(t)}" class="${P}adi-lim"/>`; }).join('')}
        <g data-ptr><path d="M150 26 l-7 12 h14z" class="${P}adi-ptr"/></g>
        <path d="M150 22 l-6 -10 h12z" class="${P}adi-idx"/>
        <path d="M86 150 h40 v8 M214 150 h-40 v8" class="${P}adi-wing"/><rect x="146" y="146" width="8" height="8" class="${P}adi-dot"/>
        <text x="150" y="292" text-anchor="middle" class="${P}adi-cap">Amber marks ≈ 35°</text>
      </svg>
    </div>
  </div>`;
  const alertEl = host.querySelector(`[data-alert] .${P}alert`);
  bindSlider(host, 'dh', (v) => { dh = v; }, (v) => `${v} ft`);
  bindSlider(host, 'bank', (v) => { bank = v; upBank(); }, (v) => `${v}°`);
  host.querySelector('[data-fly]').addEventListener('click', () => { ra = 700; last = Infinity; flying = true; callout = ''; });
  function upBank() {
    host.querySelector('[data-horizon]').setAttribute('transform', `rotate(${-bank} 150 150)`);
    host.querySelector('[data-ptr]').setAttribute('transform', `rotate(${-bank} 150 150)`);
    const on = Math.abs(bank) > 35;
    setAlert(alertEl, on ? 'BANK ANGLE' : '', on ? 'caution' : 'ok', on ? 'BANK ANGLE, BANK ANGLE' : '');
    sh.sound(on ? 'tone' : null);
  }
  upBank();
  return {
    tick(dt) {
      if (calloutT > 0) { calloutT -= dt; if (calloutT <= 0) host.querySelector('[data-call]').textContent = flying ? '—' : 'Touchdown'; }
      if (!flying) return;
      const rate = ra > 100 ? 26 : 13; // ft/s on the display (accelerated above 100 ft)
      ra = Math.max(0, ra - rate * dt);
      const events = CALLS.map(([h, t]) => [h, t]);
      if (dh > 10) events.push([dh, 'MINIMUMS']);
      for (const [h, t] of events.sort((a, b) => b[0] - a[0])) {
        if (last > h && ra <= h) { callout = t; calloutT = 1.4; host.querySelector('[data-call]').textContent = `“${t}”`; }
      }
      last = ra;
      host.querySelector('[data-ra]').textContent = Math.round(ra);
      if (ra <= 0) flying = false;
    },
    unmount() {},
  };
}

// ---------------------------------------------------------------- mode 7
function mountMode7(host, sh) {
  let x = 0, running = false, alertOn = false;
  const gp = (u) => 1500 * (1 - u); // ft on the glidepath
  const C = 0.52; // microburst centre (fraction of the profile)
  const wind = (u) => {
    const d = (u - C) / 0.14;
    return { hw: 22 * d * Math.exp(-d * d / 1.2) * -1, dd: 18 * Math.exp(-d * d * 1.5) }; // hw > 0 = headwind (outflow towards the aircraft first)
  };
  host.innerHTML = `<div class="${P}split">
    <div class="${P}stack">
      <div class="${P}modehead"><span class="${P}modetag">Mode 7</span><h3>Windshear</h3></div>
      <p class="${P}p"><b>Reactive windshear</b> (a GPWS mode) works at low altitude during takeoff and approach, below about 1,500 ft RA. It detects a shear that is already reducing performance: a sudden loss of headwind or gain of tailwind, often with a downdraft. You get a red WINDSHEAR on both attitude displays, a siren and “WINDSHEAR” three times.</p>
      <p class="${P}p"><b>Predictive windshear</b> (from the weather radar, where fitted) looks ahead for microburst signatures. It gives a warning (“WINDSHEAR AHEAD” or “GO AROUND, WINDSHEAR AHEAD”) or a caution (“MONITOR RADAR DISPLAY”), with an icon on the ND.</p>
      <div class="${P}row"><button type="button" class="${P}btn ${P}btn-accent" data-run>Fly through a microburst</button><button type="button" class="${P}btn" data-reset>Reset</button></div>
      <div data-alert>${alertBox()}</div>
      <div class="${P}readout"><span>Height</span><b data-h>1500</b><span>Airspeed change</span><b data-ias>+0 kt</b></div>
      <div class="${P}card"><h4>Recognise and respond</h4><p>An encounter typically starts with a gain in airspeed (performance-increasing headwind), then a big loss with a downdraft. On a windshear warning, apply the windshear escape manoeuvre in your QRH (in essence maximum thrust, wings level, pitch toward the target attitude, follow the flight director guidance, don't change configuration) until clear. Avoid known windshear.</p></div>
    </div>
    <div class="${P}figure">
      <svg class="${P}env" viewBox="0 0 640 360" role="img" aria-label="Microburst on approach">
        <rect x="0" y="0" width="640" height="360" class="${P}env-bg"/>
        <path d="M0 330 H640 V360 H0Z" class="${P}ground"/>
        <path d="M40 40 L600 330" class="${P}gpath"/>
        <ellipse cx="${40 + C * 560}" cy="120" rx="70" ry="40" class="${P}cloud"/>
        ${[-1, -0.5, 0, 0.5, 1].map((k) => `<path d="M${40 + C * 560 + k * 40} 160 v120" class="${P}wind-arrow" marker-end="url(#${P}arr)"/>`).join('')}
        <path d="M${40 + C * 560 - 30} 300 q-60 10 -110 -10" class="${P}wind-arrow" marker-end="url(#${P}arr)"/>
        <path d="M${40 + C * 560 + 30} 300 q60 10 110 -10" class="${P}wind-arrow" marker-end="url(#${P}arr)"/>
        <defs><marker id="${P}arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10z" class="${P}arrowhead"/></marker></defs>
        <text x="${40 + C * 560 - 150}" y="292" class="${P}tiny">headwind</text><text x="${40 + C * 560 + 110}" y="292" class="${P}tiny">tailwind</text>
        <text x="${40 + C * 560 + 46}" y="230" class="${P}tiny">downdraft</text>
        <path data-track d="" class="${P}track"/>
        <g data-plane><circle r="9" class="${P}ac-halo"/><path d="M-10 0 L8 0 M0 -6 L-3 0 L0 6" class="${P}plane-line"/></g>
      </svg>
    </div>
  </div>`;
  const alertEl = host.querySelector(`[data-alert] .${P}alert`);
  const plane = host.querySelector('[data-plane]'), track = host.querySelector('[data-track]');
  let dev = 0, pts = [];
  function reset() { x = 0; dev = 0; pts = []; running = false; alertOn = false; draw(); }
  function draw() {
    const w = wind(x);
    const h = Math.max(0, gp(x) - dev);
    const X = 40 + x * 560, Y = 40 + (1 - h / 1500) * 290;
    plane.setAttribute('transform', `translate(${X.toFixed(1)} ${Y.toFixed(1)})`);
    pts.push(`${X.toFixed(1)},${Y.toFixed(1)}`);
    track.setAttribute('d', pts.length > 1 ? `M${pts.join(' L')}` : '');
    host.querySelector('[data-h]').textContent = Math.round(h);
    const ias = Math.round(w.hw);
    host.querySelector('[data-ias]').textContent = `${ias >= 0 ? '+' : ''}${ias} kt`;
    setAlert(alertEl, alertOn ? 'WINDSHEAR' : '', alertOn ? 'warning' : 'ok', alertOn ? 'WINDSHEAR, WINDSHEAR, WINDSHEAR' : '');
    sh.sound(alertOn ? 'siren' : null);
  }
  host.querySelector('[data-run]').addEventListener('click', () => { reset(); running = true; });
  host.querySelector('[data-reset]').addEventListener('click', reset);
  draw();
  return {
    tick(dt) {
      if (!running) return;
      const prev = wind(x);
      x = Math.min(0.97, x + dt * 0.045);
      const w = wind(x);
      dev += w.dd * dt * 1.6;
      const shear = (prev.hw - w.hw) / dt; // headwind loss rate (kt/s on this time scale)
      if (gp(x) - dev < 1500 && (shear > 3.5 || (w.dd > 12 && w.hw < 0))) alertOn = true;
      if (alertOn && w.hw > -2 && x > C + 0.25) alertOn = false;
      draw();
      if (x >= 0.97) running = false;
    },
    unmount() {},
  };
}

export function mountGpws(el, sh) {
  let cur = '1', sub = null;
  el.innerHTML = `<div class="${P}subtabs" role="tablist">${[...MODES.map((m) => [m.id, `${m.name} · ${m.title}`]), ['6', 'Mode 6 · Callouts & bank'], ['7', 'Mode 7 · Windshear']]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([id, t]) => `<button type="button" role="tab" data-mode="${id}">${esc(t)}</button>`).join('')}</div>
    <div data-host></div>
    <p class="${P}fine">EGPWS on the 737 NG is typically a Honeywell system. Modes, aural messages and inhibits depend on the installation and operator options. Your FCOM is the reference.</p>`;
  const host = el.querySelector('[data-host]');
  function open(id) {
    sub?.unmount?.(); sh.sound(null);
    cur = id;
    el.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.mode === id)));
    if (id === '6') sub = mountMode6(host, sh);
    else if (id === '7') sub = mountMode7(host, sh);
    else sub = mountEnvelope(host, MODES.find((m) => m.id === id), sh);
  }
  el.querySelector(`.${P}subtabs`).addEventListener('click', (e) => { const b = e.target.closest('[data-mode]'); if (b) open(b.dataset.mode); });
  open(cur);
  return { tick: (dt) => sub?.tick?.(dt), unmount: () => sub?.unmount?.() };
}

// ---------------------------------------------------------------- look-ahead terrain
export function mountTerrain(el, sh) {
  const st = { alt: 6000, gs: 250, vs: -500, ridge: 6000, dist: 4.4 };
  const NM = 8; // profile range (nm)
  const terrain = (d) => 600 + (st.ridge - 600) * Math.exp(-(((d - st.dist) / 1.3) ** 2)) + 300 * Math.sin(d * 1.7) * Math.exp(-(((d - st.dist) / 3) ** 2));
  el.innerHTML = `<div class="${P}split">
    <div class="${P}stack">
      <div class="${P}modehead"><span class="${P}modetag">EGPWS</span><h3>Look-ahead terrain alerting</h3></div>
      <p class="${P}p">Classic GPWS modes only see straight down (radio altitude). The enhanced function compares your GPS/FMC position and projected flight path with a worldwide terrain database, so it warns about terrain <i>ahead</i>, and paints terrain on the ND relative to your altitude. The look-ahead distance grows with ground speed, so alerts are based on time to impact.</p>
      ${slider('alt', 'Aircraft altitude', 1000, 12000, 100, st.alt, ' ft')}
      ${slider('vs', 'Vertical speed', -3000, 2500, 100, st.vs, ' fpm')}
      ${slider('gs', 'Ground speed', 140, 350, 5, st.gs, ' kt')}
      ${slider('ridge', 'Ridge elevation', 2000, 11000, 100, st.ridge, ' ft')}
      ${slider('dist', 'Ridge distance ahead', 2, 7.5, 0.1, st.dist, ' nm')}
      <div data-alert>${alertBox()}</div>
      <div class="${P}readout" data-read></div>
      <div class="${P}card"><h4>Two levels</h4><p><b class="${P}amber">CAUTION TERRAIN</b>: terrain conflict roughly a minute ahead. Solid amber on the ND. Adjust the flight path. <b class="${P}red">TERRAIN, TERRAIN, PULL UP</b>: roughly half a minute ahead. Solid red on the ND and a red PULL UP on the PFD. ${esc(PULLUP_RESPONSE)}</p></div>
    </div>
    <div class="${P}stack">
      <div class="${P}figure"><svg class="${P}env" viewBox="0 0 640 300" data-prof role="img" aria-label="Terrain profile ahead"></svg></div>
      <div class="${P}figure ${P}ndwrap"><svg class="${P}nd" viewBox="0 0 400 260" data-nd role="img" aria-label="Navigation display with terrain"></svg>
        <div class="${P}legend"><span><i class="${P}lg-r"></i>well above you</span><span><i class="${P}lg-y"></i>near your altitude</span><span><i class="${P}lg-g"></i>below you</span><span><i class="${P}lg-sa"></i>caution area</span><span><i class="${P}lg-sr"></i>warning area</span></div></div>
    </div>
  </div>`;
  const alertEl = el.querySelector(`[data-alert] .${P}alert`);
  ['alt', 'vs', 'gs', 'ridge', 'dist'].forEach((k) => bindSlider(el, k, (v) => { st[k] = v; draw(); }, (v) => `${v}${k === 'gs' ? ' kt' : k === 'vs' ? ' fpm' : k === 'dist' ? ' nm' : ' ft'}`));
  function conflict() {
    for (let t = 0; t <= 90; t += 0.5) {
      const d = (st.gs * t) / 3600, a = st.alt + (st.vs * t) / 60;
      if (d > NM) break;
      if (a < terrain(d) + 300) return { t, d };
    }
    return null;
  }
  function draw() {
    const c = conflict();
    const level = c && c.t <= 30 ? 'warning' : c && c.t <= 60 ? 'caution' : 'ok';
    setAlert(alertEl, level === 'warning' ? 'PULL UP' : level === 'caution' ? 'CAUTION TERRAIN' : '', level, level === 'warning' ? 'TERRAIN, TERRAIN, PULL UP' : level === 'caution' ? 'CAUTION TERRAIN, CAUTION TERRAIN' : '');
    sh.sound(level === 'warning' ? 'whoop' : level === 'caution' ? 'tone' : null);
    el.querySelector('[data-read]').innerHTML = `<span>Time to terrain conflict</span><b>${c ? `${Math.round(c.t)} s` : 'none within 90 s'}</b><span>Distance covered in 60 s</span><b>${((st.gs * 60) / 3600).toFixed(1)} nm</b>`;
    // profile
    const sx = (d) => 30 + (d / NM) * 590, sy = (a) => 270 - (a / 13000) * 250;
    let tp = `M${sx(0)} ${sy(0)}`;
    for (let d = 0; d <= NM; d += 0.1) tp += ` L${sx(d).toFixed(1)} ${sy(terrain(d)).toFixed(1)}`;
    tp += ` L${sx(NM)} ${sy(0)} Z`;
    const pathEnd = (t) => [sx((st.gs * t) / 3600), sy(st.alt + (st.vs * t) / 60)];
    const [x30, y30] = pathEnd(30), [x60, y60] = pathEnd(60), [x90, y90] = pathEnd(90);
    el.querySelector('[data-prof]').innerHTML = `
      <rect x="0" y="0" width="640" height="300" class="${P}env-bg"/>
      ${[0, 2, 4, 6, 8].map((d) => `<line x1="${sx(d)}" y1="20" x2="${sx(d)}" y2="270" class="${P}grid"/><text x="${sx(d)}" y="288" text-anchor="middle" class="${P}axis">${d} nm</text>`).join('')}
      ${[0, 4000, 8000, 12000].map((a) => `<text x="34" y="${sy(a) - 3}" class="${P}axis">${a / 1000}k ft</text>`).join('')}
      <path d="${tp}" class="${P}terrain"/>
      <path d="M${sx(0)} ${sy(st.alt)} L${x60} ${y60 - 22} L${x60} ${y60 + 22} Z" class="${P}la-caution"/>
      <path d="M${sx(0)} ${sy(st.alt)} L${x30} ${y30 - 14} L${x30} ${y30 + 14} Z" class="${P}la-warning"/>
      <line x1="${sx(0)}" y1="${sy(st.alt)}" x2="${x90}" y2="${y90}" class="${P}fpv"/>
      <text x="${x60 + 4}" y="${y60 - 26}" class="${P}tiny">60 s</text><text x="${x30 + 4}" y="${y30 - 18}" class="${P}tiny">30 s</text>
      ${c ? `<circle cx="${sx(c.d)}" cy="${sy(terrain(c.d))}" r="6" class="${P}hitpt ${P}hitpt-${level}"/>` : ''}
      <g transform="translate(${sx(0)} ${sy(st.alt)})"><circle r="8" class="${P}ac-halo"/><path d="M-10 0 L8 0 M0 -6 L-3 0 L0 6" class="${P}plane-line"/></g>`;
    // ND
    const cells = [];
    const cx = 200, cy = 240, R = 210, step = 9;
    for (let gy = 20; gy < 240; gy += step) {
      for (let gx = 10; gx < 390; gx += step) {
        const dx = gx - cx, dy = cy - gy; const r = Math.hypot(dx, dy);
        if (r > R || dy < 0) continue;
        const d = (dy / R) * NM; const lat = dx / R * NM;
        const h = terrain(d) * Math.exp(-((lat / 9) ** 2)) + 200 * Math.sin(lat * 0.8 + d);
        const rel = h - st.alt;
        let cls = '';
        const along = Math.abs(lat) < 1.2 && c;
        if (along && d >= c.d - 0.6 && rel > -300) cls = level === 'warning' ? 'sr' : level === 'caution' ? 'sa' : '';
        if (!cls) cls = rel > 2000 ? 'r' : rel > 1000 ? 'yh' : rel > -500 ? 'y' : rel > -1000 ? 'gh' : rel > -2000 ? 'g' : '';
        if (cls) cells.push(`<rect x="${gx}" y="${gy}" width="${cls.startsWith('s') ? step : 4}" height="${cls.startsWith('s') ? step : 4}" class="${P}nd-${cls}"/>`);
      }
    }
    el.querySelector('[data-nd]').innerHTML = `<rect x="0" y="0" width="400" height="260" class="${P}nd-bg"/>
      <defs><clipPath id="${P}ndclip"><path d="M${cx - R} ${cy} A${R} ${R} 0 0 1 ${cx + R} ${cy} Z"/></clipPath></defs>
      <g clip-path="url(#${P}ndclip)">${cells.join('')}</g>
      <path d="M${cx - R} ${cy} A${R} ${R} 0 0 1 ${cx + R} ${cy}" class="${P}nd-ring"/><path d="M${cx - R / 2} ${cy} A${R / 2} ${R / 2} 0 0 1 ${cx + R / 2} ${cy}" class="${P}nd-ring ${P}nd-ring-d"/>
      <text x="${cx + R / 2 * 0.72 + 4}" y="${cy - R / 2 * 0.7}" class="${P}nd-txt">${NM / 2}</text>
      <path d="M${cx} ${cy - 14} L${cx - 8} ${cy + 4} L${cx + 8} ${cy + 4} Z" class="${P}nd-own"/>
      <text x="8" y="16" class="${P}nd-txt">TERR</text><text x="392" y="16" text-anchor="end" class="${P}nd-txt">${NM} NM</text>`;
  }
  draw();
  return { unmount() {} };
}
