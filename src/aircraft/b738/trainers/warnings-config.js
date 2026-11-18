// Configuration and flight-envelope warnings: takeoff config, landing gear, stall/buffet, overspeed, cabin altitude.
import { P, esc, clamp, alertBox, setAlert, slider, seg, bindSeg, bindSlider } from './warnings-ui.js';

const FLAPS = ['0', '1', '2', '5', '10', '15', '25', '30', '40'];
const flapLabel = (f) => (f === '0' ? 'UP' : f);
const check = (ok, text) => `<li class="${ok ? 'is-ok' : 'is-bad'}"><i>${ok ? '✓' : '✕'}</i>${esc(text)}</li>`;

// ---------------------------------------------------------------- takeoff configuration
export function mountTakeoff(el, sh) {
  const st = { flaps: '5', trim: 5.5, sb: 'DOWN', park: 'RELEASED', leFault: false, thrust: 0, band: [3.0, 8.5] };
  el.innerHTML = `<div class="${P}split">
    <div class="${P}stack">
      <div class="${P}modehead"><span class="${P}modetag">On the ground</span><h3>Takeoff configuration warning</h3></div>
      <p class="${P}p">Armed on the ground when either forward thrust lever is advanced for takeoff. An <b>intermittent horn</b> sounds if the airplane is not configured for takeoff. Many NGs also have a red TAKEOFF CONFIG light. The horn stops when the configuration is corrected or the thrust levers are retarded.</p>
      <div class="${P}card"><h4>The horn sounds if any of these is true</h4><ul class="${P}checks" data-checks></ul></div>
      <div data-alert>${alertBox()}</div>
      <p class="${P}fine">The stab trim green band here is illustrative. In the airplane, the takeoff range depends on the model and, on many airplanes, on the CG. Some airplanes have extra conditions (for example, flap skew or asymmetry). Check your FCOM.</p>
    </div>
    <div class="${P}stack">
      <div class="${P}cockpit">
        <div class="${P}cp-item"><span class="${P}slabel">Flap lever</span><div class="${P}seg ${P}seg-flaps" data-seg="flaps">${FLAPS.map((f) => `<button type="button" data-v="${f}" class="${f === st.flaps ? 'is-on' : ''}">${flapLabel(f)}</button>`).join('')}</div></div>
        <div class="${P}cp-item">${slider('trim', 'Stabilizer trim', 0, 17, 0.25, st.trim, ' units')}
          <svg class="${P}trimbar" viewBox="0 0 340 30" data-trimbar></svg></div>
        <div class="${P}cp-row">
          ${seg('sb', 'Speed brake lever', [['DOWN', 'Down'], ['ARMED', 'Armed'], ['FLT', 'Flight detent'], ['UP', 'Up']], st.sb)}
          ${seg('park', 'Parking brake', [['RELEASED', 'Released'], ['SET', 'Set']], st.park)}
        </div>
        <div class="${P}cp-row">
          ${seg('le', 'Leading edge devices', [['ok', 'Normal'], ['fault', 'Fault: not in takeoff position']], 'ok')}
        </div>
        <div class="${P}cp-item ${P}cp-thrust">${slider('thrust', 'Thrust levers', 0, 100, 1, 0, '%')}
          <div class="${P}fine">Advance the thrust levers past about a third of their travel to arm the warning.</div></div>
        <div class="${P}lights"><div class="${P}light ${P}light-red" data-tocfg>TAKEOFF<br>CONFIG</div><div class="${P}light ${P}light-blue" data-le>LE FLAPS<br>EXT</div><div class="${P}light ${P}light-red" data-park>PARKING<br>BRAKE</div></div>
      </div>
    </div>
  </div>`;
  const alertEl = el.querySelector(`[data-alert] .${P}alert`);
  bindSeg(el, 'flaps', (v) => { st.flaps = v; draw(); });
  bindSeg(el, 'sb', (v) => { st.sb = v; draw(); });
  bindSeg(el, 'park', (v) => { st.park = v; draw(); });
  bindSeg(el, 'le', (v) => { st.leFault = v === 'fault'; draw(); });
  bindSlider(el, 'trim', (v) => { st.trim = v; draw(); }, (v) => `${v.toFixed(2)} units`);
  bindSlider(el, 'thrust', (v) => { st.thrust = v; draw(); }, (v) => `${v}%`);
  function draw() {
    const f = +st.flaps;
    const flapsOk = f >= 1 && f <= 25;
    const leOk = !st.leFault && f >= 1;
    const trimOk = st.trim >= st.band[0] && st.trim <= st.band[1];
    const sbOk = st.sb === 'DOWN';
    const parkOk = st.park === 'RELEASED';
    el.querySelector('[data-checks]').innerHTML =
      check(flapsOk, `Trailing edge flaps not in the takeoff range (flaps 1–25)`) +
      check(leOk, 'Leading edge devices not in the takeoff position') +
      check(trimOk, 'Stabilizer trim not in the takeoff (green band) range') +
      check(sbOk, 'Speed brake lever not in the DOWN detent') +
      check(parkOk, 'Parking brake set');
    const armed = st.thrust > 33;
    const bad = !(flapsOk && leOk && trimOk && sbOk && parkOk);
    const horn = armed && bad;
    setAlert(alertEl, horn ? 'TAKEOFF CONFIG' : armed ? 'Configured for takeoff' : bad ? 'Not configured (warning not armed yet)' : 'Configured · advance thrust to test', horn ? 'warning' : armed ? 'ok' : bad ? 'caution' : 'ok', horn ? 'intermittent horn' : '');
    sh.sound(horn ? 'horn' : null);
    el.querySelector('[data-tocfg]').classList.toggle('is-on', horn);
    el.querySelector('[data-le]').classList.toggle('is-on', leOk);
    el.querySelector('[data-park]').classList.toggle('is-on', !parkOk);
    const sx = (u) => 10 + (u / 17) * 320;
    el.querySelector('[data-trimbar]').innerHTML = `<rect x="10" y="9" width="320" height="8" rx="2" class="${P}trim-track"/>
      <rect x="${sx(st.band[0])}" y="9" width="${sx(st.band[1]) - sx(st.band[0])}" height="8" class="${P}trim-green"/>
      ${[0, 5, 10, 15].map((u) => `<text x="${sx(u)}" y="26" text-anchor="middle" class="${P}tiny">${u}</text>`).join('')}
      <path d="M${sx(st.trim)} 8 l-5 -7 h10z" class="${P}trim-ptr ${trimOk ? '' : `${P}trim-bad`}"/>`;
  }
  draw();
  return { unmount() {} };
}

// ---------------------------------------------------------------- landing gear configuration
export function mountGear(el, sh) {
  const st = { flaps: '15', ra: 1200, l: 'IDLE', r: 'IDLE', gear: 'UP', cut: false };
  el.innerHTML = `<div class="${P}split">
    <div class="${P}stack">
      <div class="${P}modehead"><span class="${P}modetag">In flight</span><h3>Landing gear configuration warning</h3></div>
      <p class="${P}p">A steady horn warns that you may be about to land with the gear not down and locked. The trigger depends on flap position, thrust lever position and radio altitude. How it can be silenced depends on the flaps.</p>
      <table class="${P}table"><thead><tr><th>Flaps</th><th>Horn when gear not down and locked and</th><th>Silence?</th></tr></thead><tbody>
        <tr data-row="a"><td>UP – 10</td><td>Radio altitude below 800 ft and either thrust lever near idle</td><td>Yes, with the HORN CUTOUT switch</td></tr>
        <tr data-row="b"><td>15 – 25</td><td>Either thrust lever near idle</td><td>No. Lower the gear or advance thrust.</td></tr>
        <tr data-row="c"><td>30 – 40</td><td>Any thrust lever position</td><td>No. Lower the gear.</td></tr></tbody></table>
      <div data-alert>${alertBox()}</div>
      <p class="${P}fine">Typical NG logic, simplified. The exact thrust lever angle and altitude conditions (and whether the cutout works close to the ground) vary by airplane. Check your FCOM.</p>
    </div>
    <div class="${P}stack">
      <div class="${P}cockpit">
        <div class="${P}cp-item"><span class="${P}slabel">Flap lever</span><div class="${P}seg ${P}seg-flaps" data-seg="flaps">${FLAPS.map((f) => `<button type="button" data-v="${f}" class="${f === st.flaps ? 'is-on' : ''}">${flapLabel(f)}</button>`).join('')}</div></div>
        <div class="${P}cp-item">${slider('ra', 'Radio altitude', 0, 2500, 10, st.ra, ' ft')}</div>
        <div class="${P}cp-row">
          ${seg('l', 'Thrust lever 1', [['IDLE', 'Idle'], ['FWD', 'Advanced']], st.l)}
          ${seg('r', 'Thrust lever 2', [['IDLE', 'Idle'], ['FWD', 'Advanced']], st.r)}
        </div>
        <div class="${P}cp-row">
          ${seg('gear', 'Gear lever', [['UP', 'UP'], ['DN', 'DOWN']], st.gear)}
          <div class="${P}segwrap"><span class="${P}slabel">Horn cutout</span><button type="button" class="${P}btn" data-cut>Push</button></div>
        </div>
        <div class="${P}geargroup"><span class="${P}slabel">Gear indication</span>
          <div class="${P}lights">${['NOSE', 'LEFT', 'RIGHT'].map((g) => `<div class="${P}gearpair"><div class="${P}light ${P}light-red" data-red>${g}<br>GEAR</div><div class="${P}light ${P}light-green" data-green>${g}<br>GEAR</div></div>`).join('')}</div></div>
      </div>
    </div>
  </div>`;
  const alertEl = el.querySelector(`[data-alert] .${P}alert`);
  const reset = () => { st.cut = false; };
  bindSeg(el, 'flaps', (v) => { st.flaps = v; reset(); draw(); });
  bindSeg(el, 'l', (v) => { st.l = v; if (v === 'FWD') reset(); draw(); });
  bindSeg(el, 'r', (v) => { st.r = v; if (v === 'FWD') reset(); draw(); });
  bindSeg(el, 'gear', (v) => { st.gear = v; draw(); });
  bindSlider(el, 'ra', (v) => { st.ra = v; if (v >= 800) reset(); draw(); }, (v) => `${v} ft`);
  el.querySelector('[data-cut]').addEventListener('click', () => { st.cut = true; draw(); });
  function draw() {
    const f = +st.flaps, idle = st.l === 'IDLE' || st.r === 'IDLE', down = st.gear === 'DN';
    const row = f <= 10 ? 'a' : f <= 25 ? 'b' : 'c';
    const cond = row === 'a' ? st.ra < 800 && idle : row === 'b' ? idle : true;
    const horn = !down && cond && !(row === 'a' && st.cut);
    el.querySelectorAll('[data-row]').forEach((r) => r.classList.toggle('is-active', r.dataset.row === row));
    let text = '', level = 'ok';
    if (horn) { text = 'GEAR HORN'; level = 'warning'; }
    else if (!down && cond && st.cut) { text = 'Horn silenced (cutout)'; level = 'caution'; }
    else if (down) text = 'Gear down and locked';
    setAlert(alertEl, text, level, horn ? 'steady horn' : '');
    sh.sound(horn ? 'steady' : null);
    const red = !down && st.ra < 800 && idle;
    el.querySelectorAll('[data-red]').forEach((x) => x.classList.toggle('is-on', red || (!down && horn)));
    el.querySelectorAll('[data-green]').forEach((x) => x.classList.toggle('is-on', down));
    el.querySelector('[data-cut]').disabled = row !== 'a';
  }
  draw();
  return { unmount() {} };
}

// ---------------------------------------------------------------- standard atmosphere helpers
const T0 = 288.15, P0 = 101325, A0 = 340.294;
function pressureRatio(ft) {
  const h = ft * 0.3048;
  if (h <= 11000) return Math.pow(1 - 2.25577e-5 * h, 5.25588);
  return 0.22336 * Math.exp(-(h - 11000) / 6341.62);
}
function machFromCas(kcas, ft) {
  const v = kcas * 0.514444;
  const qc = P0 * (Math.pow(1 + 0.2 * (v / A0) ** 2, 3.5) - 1);
  const p = P0 * pressureRatio(ft);
  return Math.sqrt(5 * (Math.pow(qc / p + 1, 2 / 7) - 1));
}
function casFromMach(m, ft) {
  const p = P0 * pressureRatio(ft);
  const qc = p * (Math.pow(1 + 0.2 * m * m, 3.5) - 1);
  return (A0 * Math.sqrt(5 * (Math.pow(qc / P0 + 1, 2 / 7) - 1))) / 0.514444;
}

function speedTape({ ias, bands, ptr }) {
  // ias at centre; 1 kt = 3 px; bands: [{from,to,cls}]
  const k = 3, cy = 170;
  const y = (v) => cy - (v - ias) * k;
  const ticks = [];
  for (let v = Math.ceil((ias - 60) / 10) * 10; v <= ias + 60; v += 10) {
    if (v < 0) continue;
    ticks.push(`<line x1="64" y1="${y(v)}" x2="74" y2="${y(v)}" class="${P}tape-tk"/>${v % 20 === 0 ? `<text x="58" y="${y(v) + 5}" text-anchor="end" class="${P}tape-num">${v}</text>` : ''}`);
  }
  return `<svg class="${P}tape" viewBox="0 0 120 364" role="img" aria-label="Airspeed tape">
    <defs><clipPath id="${P}tapeclip"><rect x="0" y="0" width="120" height="340"/></clipPath>
      <pattern id="${P}barber" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#000"/><rect width="12" height="6" fill="#e3261b"/></pattern></defs>
    <rect x="0" y="0" width="120" height="340" class="${P}tape-bg"/>
    <g clip-path="url(#${P}tapeclip)">${ticks.join('')}
      ${bands.map((b) => { const y1 = y(Math.max(b.from, b.to)), y2 = y(Math.min(b.from, b.to)); return `<rect x="${b.cls === 'barber' ? 76 : 78}" y="${y1}" width="${b.cls === 'barber' ? 10 : 5}" height="${Math.max(0, y2 - y1)}" ${b.cls === 'barber' ? `fill="url(#${P}barber)"` : `class="${P}tape-${b.cls}"`}/>`; }).join('')}
    </g>
    <path d="M4 156 H70 L80 170 L70 184 H4 Z" class="${P}tape-box"/>
    <text x="64" y="178" text-anchor="end" class="${P}tape-cur">${Math.round(ias)}</text>
    ${ptr ? `<rect x="0" y="340" width="120" height="24" fill="#000"/><text x="60" y="357" text-anchor="middle" class="${P}tape-mach">${ptr}</text>` : ''}
  </svg>`;
}

// ---------------------------------------------------------------- stall / buffet
export function mountStall(el, sh) {
  const st = { ias: 210, alt: 10000, wt: 65, bank: 0, flaps: 'UP' };
  const FLAP_VS = { UP: 150, 1: 132, 5: 124, 15: 116, 30: 110, 40: 106 }; // illustrative 1 g shaker speeds at 65 t, low altitude
  el.innerHTML = `<div class="${P}split">
    <div class="${P}stack">
      <div class="${P}modehead"><span class="${P}modetag">Envelope</span><h3>Stall warning and buffet margin</h3></div>
      <p class="${P}p">Two stall management/yaw damper computers (SMYDs) use angle of attack, flap position and other data to drive the <b>stick shaker</b> before the stall. The NG also has an elevator feel shift that increases column force near the stall. The speed tape shows the margin:</p>
      <ul class="${P}ul">
        <li><b>Red and black barber pole (bottom)</b>: stick shaker speed for the current load factor.</li>
        <li><b>Amber bar (bottom)</b>: its top is the minimum manoeuvring speed, which gives a 1.3 g margin to the stick shaker (or to initial buffet at high altitude). That is roughly a 40° bank turn in level flight.</li>
        <li><b>Amber bar (top)</b>: maximum manoeuvring speed (1.3 g margin to high-speed buffet). The barber pole above it is VMO/MMO.</li>
      </ul>
      <div class="${P}grid2">
        ${slider('ias', 'Indicated airspeed', 100, 340, 1, st.ias, ' kt')}
        ${slider('bank', 'Bank angle (level turn)', 0, 60, 1, st.bank, '°')}
        ${slider('alt', 'Altitude', 0, 41000, 500, st.alt, ' ft')}
        ${slider('wt', 'Gross weight', 45, 79, 1, st.wt, ' t')}
      </div>
      ${seg('flaps', 'Flaps', Object.keys(FLAP_VS).map((f) => [f, f]), st.flaps)}
      <div data-alert>${alertBox()}</div>
      <div class="${P}readout" data-read></div>
      <div class="${P}card"><h4>Recognise and respond</h4><p>At the first sign of an approach to stall (buffet, stick shaker, or a speed in the amber band and falling) recover per your QRH/FCTM. In essence: reduce the angle of attack first (nose down until the shaker and buffet stop), roll wings level, then adjust thrust and return to the desired path.</p></div>
      <p class="${P}fine">Speeds here come from a simple illustrative model to show the relationships (weight, altitude, load factor). They are not 737 performance data.</p>
    </div>
    <div class="${P}figure ${P}tapefig" data-tape></div>
  </div>`;
  const alertEl = el.querySelector(`[data-alert] .${P}alert`);
  for (const [k, u] of [['ias', ' kt'], ['bank', '°'], ['alt', ' ft'], ['wt', ' t']]) bindSlider(el, k, (v) => { st[k] = v; draw(); }, (v) => `${v}${u}`);
  bindSeg(el, 'flaps', (v) => { st.flaps = v; draw(); });
  function draw() {
    const n = 1 / Math.cos((st.bank * Math.PI) / 180);
    const altF = 1 + (st.alt / 41000) ** 2 * 0.55; // compressibility raises low-speed buffet IAS at altitude
    const vs1 = FLAP_VS[st.flaps] * Math.sqrt(st.wt / 65) * (st.flaps === 'UP' ? altF : 1);
    const shaker = vs1 * Math.sqrt(n);
    const minMan = vs1 * Math.sqrt(1.3 * n);
    const vmoIas = Math.min(340, casFromMach(0.82, st.alt));
    const hsb = Math.min(vmoIas + 25, casFromMach(0.86 - 0.03 * (st.wt - 45) / 34 - (st.alt > 30000 ? (st.alt - 30000) / 11000 * 0.04 : 0), st.alt));
    const maxMan = hsb / Math.sqrt(1.3);
    const shake = st.ias < shaker;
    const gMargin = (st.ias / vs1) ** 2;
    const inAmber = !shake && st.ias < minMan;
    setAlert(alertEl, shake ? 'STICK SHAKER' : inAmber ? 'Buffet margin below 1.3 g' : '', shake ? 'warning' : inAmber ? 'caution' : 'ok', shake ? 'stick shaker (column vibrates)' : '');
    sh.sound(shake ? 'shaker' : null);
    el.classList.toggle(`${P}shaking`, shake);
    const bankMax = gMargin > 1 ? Math.round((Math.acos(1 / gMargin) * 180) / Math.PI) : 0;
    el.querySelector('[data-read]').innerHTML = `<span>Load factor</span><b>${n.toFixed(2)} g</b><span>Stick shaker speed</span><b>${Math.round(shaker)} kt</b>
      <span>Min manoeuvre speed</span><b>${Math.round(minMan)} kt</b><span>Margin to shaker</span><b>${gMargin.toFixed(2)} g ≈ ${bankMax}° bank</b>`;
    el.querySelector('[data-tape]').innerHTML = speedTape({ ias: st.ias, ptr: `M ${machFromCas(st.ias, st.alt).toFixed(3).replace(/^0/, '')}`, bands: [
      { from: 0, to: shaker, cls: 'barber' },
      { from: shaker, to: minMan, cls: 'amber' },
      ...(st.flaps === 'UP' ? [{ from: maxMan, to: vmoIas, cls: 'amber' }, { from: vmoIas, to: 500, cls: 'barber' }] : []),
    ] }) + `<div class="${P}yoke ${shake ? 'is-shaking' : ''}"><svg viewBox="0 0 120 70"><path d="M10 20 Q10 6 24 6 H96 Q110 6 110 20 V34 Q110 44 98 44 H76 L70 64 H50 L44 44 H22 Q10 44 10 34 Z" class="${P}yoke-shape"/></svg><span>Control column</span></div>`;
  }
  draw();
  return { unmount() {} };
}

// ---------------------------------------------------------------- overspeed
export function mountOverspeed(el, sh) {
  const st = { ias: 300, alt: 20000 };
  const cross = (() => { let lo = 0, hi = 41000; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (machFromCas(340, m) < 0.82) lo = m; else hi = m; } return Math.round(lo / 100) * 100; })();
  el.innerHTML = `<div class="${P}split">
    <div class="${P}stack">
      <div class="${P}modehead"><span class="${P}modetag">Envelope</span><h3>Overspeed warning</h3></div>
      <p class="${P}p">The 737 NG limit is <b>VMO 340 kt</b> (indicated) or <b>MMO 0.82</b>, whichever you reach first. Above the limit a <b>clacker</b> sounds. The red and black barber pole on the speed tape marks the current limit.</p>
      <p class="${P}p">At low altitude VMO is the limit. Climbing at a constant 340 kt the Mach number rises, and at the <b>crossover altitude</b> (about <b data-cross>${cross.toLocaleString()}</b> ft in the standard atmosphere) MMO takes over. Above that, the indicated airspeed for M 0.82 keeps falling as you climb.</p>
      <div class="${P}grid2">${slider('ias', 'Indicated airspeed', 200, 380, 1, st.ias, ' kt')}${slider('alt', 'Altitude', 0, 41000, 500, st.alt, ' ft')}</div>
      <div data-alert>${alertBox()}</div>
      <div class="${P}readout" data-read></div>
      <div class="${P}card"><h4>Recognise and respond</h4><p>Reduce thrust and, if needed, raise the nose smoothly. Consider the speedbrake. In turbulence, fly the recommended turbulence speed instead of chasing the airspeed. Report an exceedance as your operator requires.</p></div>
    </div>
    <div class="${P}stack"><div class="${P}figure ${P}tapefig" data-tape></div><div class="${P}figure"><svg class="${P}env" viewBox="0 0 640 260" data-chart role="img" aria-label="VMO/MMO against altitude"></svg></div></div>
  </div>`;
  const alertEl = el.querySelector(`[data-alert] .${P}alert`);
  for (const [k, u] of [['ias', ' kt'], ['alt', ' ft']]) bindSlider(el, k, (v) => { st[k] = v; draw(); }, (v) => `${v}${u}`);
  // limit chart: IAS limit vs altitude
  const sx = (v) => 60 + ((v - 200) / 160) * 560, sy = (a) => 230 - (a / 42000) * 210;
  let lim = '';
  for (let a = 0; a <= 41000; a += 500) lim += `${a ? ' L' : 'M'}${sx(Math.min(340, casFromMach(0.82, a))).toFixed(1)} ${sy(a).toFixed(1)}`;
  function draw() {
    const m = machFromCas(st.ias, st.alt);
    const limIas = Math.min(340, casFromMach(0.82, st.alt));
    const over = st.ias > 340 || m > 0.82;
    setAlert(alertEl, over ? 'OVERSPEED' : '', over ? 'warning' : 'ok', over ? 'clacker' : '');
    sh.sound(over ? 'clacker' : null);
    el.querySelector('[data-read]').innerHTML = `<span>Mach</span><b>M ${m.toFixed(3)}</b><span>Limit here</span><b>${st.alt >= cross ? 'MMO 0.82' : 'VMO 340 kt'} = ${Math.round(limIas)} kt IAS</b>`;
    el.querySelector('[data-tape]').innerHTML = speedTape({ ias: st.ias, ptr: `M ${m.toFixed(3).replace(/^0/, '')}`, bands: [{ from: limIas, to: 600, cls: 'barber' }] });
    el.querySelector('[data-chart]').innerHTML = `<rect x="0" y="0" width="640" height="260" class="${P}env-bg"/>
      ${[200, 240, 280, 320, 360].map((v) => `<line x1="${sx(v)}" y1="20" x2="${sx(v)}" y2="230" class="${P}grid"/><text x="${sx(v)}" y="248" text-anchor="middle" class="${P}axis">${v} kt</text>`).join('')}
      ${[0, 10000, 20000, 30000, 40000].map((a) => `<line x1="60" y1="${sy(a)}" x2="620" y2="${sy(a)}" class="${P}grid"/><text x="54" y="${sy(a) + 4}" text-anchor="end" class="${P}axis">FL${String(a / 100).padStart(3, '0')}</text>`).join('')}
      <path d="${lim} L620 ${sy(41000)} L620 ${sy(0)} Z" class="${P}zone ${P}zone-warning"/>
      <path d="${lim}" class="${P}limline"/>
      <line x1="60" y1="${sy(cross)}" x2="620" y2="${sy(cross)}" class="${P}crossline"/><text x="616" y="${sy(cross) - 5}" text-anchor="end" class="${P}tiny">crossover ≈ FL${Math.round(cross / 100)}</text>
      <text x="${sx(342)}" y="${sy(6000)}" class="${P}zonelbl ${P}zonelbl-warning">VMO</text><text x="${sx(300)}" y="${sy(38000)}" class="${P}zonelbl ${P}zonelbl-warning">MMO</text>
      <circle cx="${sx(clamp(st.ias, 200, 360))}" cy="${sy(st.alt)}" r="7" class="${P}dot ${over ? `${P}dot-bad` : ''}"/>`;
  }
  draw();
  return { unmount() {} };
}

// ---------------------------------------------------------------- cabin altitude
export function mountCabin(el, sh, ctx) {
  const st = { cab: 8000, cut: false };
  el.innerHTML = `<div class="${P}split">
    <div class="${P}stack">
      <div class="${P}modehead"><span class="${P}modetag">Pressurisation</span><h3>Cabin altitude warning</h3></div>
      <p class="${P}p">If the cabin altitude climbs above <b>10,000 ft</b>, an <b>intermittent horn</b> sounds. On airplanes that have it, a red CABIN ALTITUDE light also comes on. The ALT HORN CUTOUT switch on the pressurisation panel silences the horn. If the cabin keeps climbing (to about 14,000 ft), the passenger oxygen masks drop automatically.</p>
      <div class="${P}card ${P}card-warn"><h4>Same horn as the takeoff configuration warning</h4><p>The cabin altitude warning and the takeoff configuration warning use the same intermittent horn. Crews have mistaken one for the other, with fatal results (the 2005 Helios 737 accident). In the climb, treat the horn as a cabin altitude warning until proven otherwise. Later NGs added separate red CABIN ALTITUDE and TAKEOFF CONFIG lights so the two can be told apart.</p></div>
      ${slider('cab', 'Cabin altitude', 0, 16000, 100, st.cab, ' ft')}
      <div class="${P}row"><button type="button" class="${P}btn" data-cut>ALT HORN CUTOUT</button><button type="button" class="${P}btn" data-sys>Use the airplane's cabin altitude</button></div>
      <div data-alert>${alertBox()}</div>
      <div class="${P}card"><h4>Recognise and respond</h4><p>Put on crew oxygen and establish communication first, then follow the QRH. The pressurisation fault may be fixable, but an emergency descent may be needed. Time of useful consciousness at high cabin altitudes can be very short.</p></div>
    </div>
    <div class="${P}stack">
      <div class="${P}figure"><svg class="${P}env" viewBox="0 0 640 320" data-cabfig role="img" aria-label="Cabin altitude scale"></svg></div>
      <div class="${P}lights ${P}lights-c"><div class="${P}light ${P}light-red" data-cablt>CABIN<br>ALTITUDE</div><div class="${P}light ${P}light-amber" data-pax>PASS<br>OXY ON</div></div>
    </div>
  </div>`;
  const alertEl = el.querySelector(`[data-alert] .${P}alert`);
  const s = bindSlider(el, 'cab', (v) => { if (v <= 10000) st.cut = false; st.cab = v; draw(); }, (v) => `${v.toLocaleString()} ft`);
  el.querySelector('[data-cut]').addEventListener('click', () => { st.cut = true; draw(); });
  const sysBtn = el.querySelector('[data-sys]');
  const sysCab = () => ctx?.systems?.panel?.()?.pressurization?.cabinAlt;
  if (typeof sysCab() !== 'number') sysBtn.hidden = true;
  sysBtn.addEventListener('click', () => { const v = sysCab(); if (typeof v === 'number') s.set(Math.round(clamp(v, 0, 16000) / 100) * 100); });
  function draw() {
    const warn = st.cab > 10000;
    const horn = warn && !st.cut;
    const masks = st.cab >= 14000;
    setAlert(alertEl, warn ? (st.cut ? 'CABIN ALTITUDE (horn silenced)' : 'CABIN ALTITUDE') : '', warn ? 'warning' : 'ok', horn ? 'intermittent horn' : '');
    sh.sound(horn ? 'horn' : null);
    el.querySelector('[data-cablt]').classList.toggle('is-on', warn);
    el.querySelector('[data-pax]').classList.toggle('is-on', masks);
    const sy = (a) => 290 - (a / 16000) * 270;
    el.querySelector('[data-cabfig]').innerHTML = `<rect x="0" y="0" width="640" height="320" class="${P}env-bg"/>
      <rect x="250" y="${sy(16000)}" width="60" height="${sy(10000) - sy(16000)}" class="${P}zone ${P}zone-warning"/>
      <rect x="250" y="${sy(10000)}" width="60" height="${sy(8000) - sy(10000)}" class="${P}zone ${P}zone-caution"/>
      ${[0, 2000, 4000, 6000, 8000, 10000, 12000, 14000, 16000].map((a) => `<line x1="240" y1="${sy(a)}" x2="320" y2="${sy(a)}" class="${P}grid"/><text x="232" y="${sy(a) + 4}" text-anchor="end" class="${P}axis">${a.toLocaleString()}</text>`).join('')}
      <line x1="250" y1="${sy(10000)}" x2="560" y2="${sy(10000)}" class="${P}limline"/><text x="330" y="${sy(10000) - 6}" class="${P}tiny">10,000 ft: horn (and CABIN ALTITUDE light)</text>
      <line x1="250" y1="${sy(14000)}" x2="560" y2="${sy(14000)}" class="${P}crossline"/><text x="330" y="${sy(14000) - 6}" class="${P}tiny">≈14,000 ft: passenger masks deploy</text>
      <text x="330" y="${sy(8000) + 4}" class="${P}tiny">≈8,000 ft: typical maximum cabin altitude in normal operation</text>
      <path d="M244 ${sy(st.cab)} l-14 -8 v16z" class="${P}cabptr ${warn ? `${P}cabptr-bad` : ''}"/>
      <text x="80" y="${sy(st.cab) + 6}" class="${P}cabval ${warn ? `${P}cabval-bad` : ''}">${st.cab.toLocaleString()} ft</text>`;
  }
  draw();
  return { unmount() {} };
}
