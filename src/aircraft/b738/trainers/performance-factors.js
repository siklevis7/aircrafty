// Performance concepts: factors affecting takeoff. Sliders move qualitative "required" bars.
// The model is a toy designed only to show direction and rough relative size of each effect.
import { esc, clamp, sliderHTML, segHTML, bindSeg } from './performance-util.js';

const FACT = {
  weight: { t: 'Weight', d: 'A heavier aeroplane needs higher V-speeds and accelerates more slowly, so all distances grow. Climb gradient falls because excess thrust is shared over more mass.' },
  temp: { t: 'Temperature', d: 'Hotter air is less dense. The same indicated speed means a higher true and ground speed, so the run is longer. Above the engine\'s flat-rate temperature, available thrust also falls, hurting distance and climb sharply.' },
  alt: { t: 'Pressure altitude', d: 'Higher airports have thinner air, with the same effects as heat: more true airspeed for a given IAS and less thrust. Temperature and altitude together set density altitude.' },
  wind: { t: 'Wind', d: 'A headwind lowers ground speed at a given IAS, so distances shrink. A tailwind does the opposite. Performance rules credit no more than 50% of the reported headwind and account for at least 150% of a tailwind. Tailwind is limited by the AFM/FCOM and by runway policy.' },
  slope: { t: 'Runway slope', d: 'Uphill: gravity slows acceleration, so takeoff distance grows, but it helps stopping. Downhill: the reverse. The approved data include slope corrections.' },
  surface: { t: 'Runway condition', d: 'Wet: braking is reduced, so accelerate-stop distance grows. The continued case may use a lower screen height. Contaminated (slush, standing water): extra drag during acceleration and much poorer braking. Operator limits and reduced-thrust restrictions apply.' },
  flap: { t: 'Takeoff flap', d: 'More flap gives lower V-speeds and a shorter runway requirement, but more drag and a lower climb gradient. Less flap does the reverse. The best flap depends on whether runway or climb/obstacles limit the takeoff.' },
  air: { t: 'Bleeds & anti-ice', d: 'Bleed air taken from the engines reduces available thrust. Packs-off takeoffs (where approved) improve performance slightly; engine or wing anti-ice adds a penalty. Use the matching corrections in the data.' },
};

const FLAP = { 1: [1.1, 1.08, 1.12], 5: [1, 1, 1], 10: [0.96, 0.97, 0.95], 15: [0.93, 0.95, 0.9], 25: [0.9, 0.93, 0.82] };
const SURF = { dry: [1, 1], wet: [1.02, 1.2], contam: [1.16, 1.42] };
const AIR = { on: [1, 1], off: [0.97, 1.04], ai: [1.04, 0.95] };

function model(s) {
  const w = s.weight / 100;
  const fW = Math.pow(0.7 + 0.6 * w, 1.6);
  const t = s.temp / 100;                       // -1 cold … 0 ISA … +1 hot
  const fT = t <= 0.25 ? 1 + 0.06 * t : 1.015 + 0.3 * (t - 0.25);
  const a = s.alt / 100;
  const fA = 1 + 0.34 * a;
  const eff = s.wind > 0 ? 0.5 * s.wind : 1.5 * s.wind;
  const fWind = 1 - 0.011 * eff;
  const sl = s.slope / 100;
  const [sT, sA] = SURF[s.surface];
  const [flT, flA, flC] = FLAP[s.flap];
  const [aT, aC] = AIR[s.air];
  const tod = fW * fT * fA * fWind * (1 + 0.07 * sl) * sT * flT * aT;
  const asd = fW * fT * fA * fWind * (1 - 0.06 * sl) * sA * flA * aT;
  const climb = Math.pow(0.7 + 0.6 * w, -1.3) * (1 - 0.32 * Math.max(0, t - 0.25) - 0.03 * Math.max(0, t)) * (1 - 0.22 * a) * flC * aC;
  return { tod, asd, climb };
}

const BASE = { weight: 50, temp: 0, alt: 0, wind: 0, slope: 0, surface: 'dry', flap: '5', air: 'on' };

export function mountFactors(root) {
  const s = { ...BASE };
  let last = 'weight';
  const base = model(BASE);

  root.innerHTML = `
    <div class="tr-perf-grid">
      <section class="tr-perf-card tr-perf-vis">
        <div class="tr-perf-cardhead">
          <h3 class="tr-perf-h3">What changes the numbers</h3>
          <button type="button" class="tr-perf-btn" data-reset>Reset to baseline</button>
        </div>
        <div class="tr-perf-bars">
          <div class="tr-perf-barrow" data-bar="tod"><span class="lbl">Takeoff distance required<small>accelerate-go / all-engine</small></span><div class="track"><i class="base"></i><b class="fill c-b"></b><em class="avail" title="Distance available"></em></div><span class="delta"></span></div>
          <div class="tr-perf-barrow" data-bar="asd"><span class="lbl">Accelerate-stop distance required<small>reject at V1</small></span><div class="track"><i class="base"></i><b class="fill c-c"></b><em class="avail"></em></div><span class="delta"></span></div>
          <div class="tr-perf-barrow" data-bar="climb"><span class="lbl">Climb gradient capability<small>engine-out, takeoff segment</small></span><div class="track"><i class="base"></i><b class="fill c-a"></b><em class="avail req"></em></div><span class="delta"></span></div>
          <div class="tr-perf-barlegend"><span><i class="lg-base"></i>Baseline</span><span><i class="lg-avail"></i>Runway available</span><span><i class="lg-req"></i>Gradient required</span></div>
        </div>
        <div class="tr-perf-sliders">
          ${sliderHTML({ id: 'weight', label: 'Weight', min: 0, max: 100, value: s.weight, left: 'Light', right: 'Heavy' })}
          ${sliderHTML({ id: 'temp', label: 'Temperature', min: -100, max: 100, value: s.temp, left: 'Cold', right: 'Hot' })}
          ${sliderHTML({ id: 'alt', label: 'Pressure altitude', min: 0, max: 100, value: s.alt, left: 'Sea level', right: 'High airport' })}
          ${sliderHTML({ id: 'wind', label: 'Wind component', min: -15, max: 30, value: s.wind, left: 'Tailwind', right: 'Headwind' })}
          ${sliderHTML({ id: 'slope', label: 'Runway slope', min: -100, max: 100, value: s.slope, left: 'Downhill', right: 'Uphill' })}
          <div class="tr-perf-segrow"><b>Runway</b>${segHTML('surface', [['dry', 'Dry'], ['wet', 'Wet'], ['contam', 'Contaminated']], s.surface)}</div>
          <div class="tr-perf-segrow"><b>Takeoff flap</b>${segHTML('flap', ['1', '5', '10', '15', '25'].map((f) => [f, f]), s.flap)}</div>
          <div class="tr-perf-segrow"><b>Bleeds</b>${segHTML('air', [['on', 'Packs on'], ['off', 'Packs off'], ['ai', 'Anti-ice on']], s.air)}</div>
        </div>
      </section>
      <aside class="tr-perf-card tr-perf-info"><div class="tr-perf-info-body" data-info></div></aside>
    </div>`;

  const info = root.querySelector('[data-info]');
  const MAXD = 2.1, MAXC = 1.9;
  const fmt = {
    weight: (v) => ['Light', 'Light-medium', 'Medium', 'Medium-heavy', 'Heavy'][Math.min(4, Math.floor(v / 20.01))],
    temp: (v) => (v < -30 ? 'Cold' : v <= 25 ? 'Around ISA' : v < 60 ? 'Warm (above flat-rate)' : 'Hot'),
    alt: (v) => (v < 15 ? 'Near sea level' : v < 55 ? 'Elevated' : 'High'),
    wind: (v) => (v === 0 ? 'Calm' : v > 0 ? `${v} kt head` : `${-v} kt tail`),
    slope: (v) => (Math.abs(v) < 10 ? 'Level' : v > 0 ? 'Uphill' : 'Downhill'),
  };

  function setBar(key, val, baseVal, max, availVal, invert) {
    const row = root.querySelector(`[data-bar="${key}"]`);
    row.querySelector('.fill').style.width = `${clamp(val / max, 0, 1) * 100}%`;
    row.querySelector('.base').style.left = `${(baseVal / max) * 100}%`;
    row.querySelector('.avail').style.left = `${(availVal / max) * 100}%`;
    const r = val / baseVal - 1;
    const d = row.querySelector('.delta');
    const bad = invert ? r < -0.015 : r > 0.015;
    const good = invert ? r > 0.015 : r < -0.015;
    d.className = `delta${bad ? ' is-bad' : good ? ' is-good' : ''}`;
    d.textContent = Math.abs(r) < 0.015 ? 'Baseline' : invert ? (r > 0 ? '▲ Better' : '▼ Worse') : (r > 0 ? '▲ Longer' : '▼ Shorter');
    const over = invert ? val < availVal : val > availVal;
    row.classList.toggle('is-limit', over);
  }

  function render() {
    const m = model(s);
    setBar('tod', m.tod, base.tod, MAXD, 1.55, false);
    setBar('asd', m.asd, base.asd, MAXD, 1.55, false);
    setBar('climb', m.climb, base.climb, MAXC, 0.62, true);
    root.querySelectorAll('[data-in]').forEach((inp) => {
      const k = inp.dataset.in;
      root.querySelector(`[data-out="${k}"]`).textContent = fmt[k](Number(inp.value));
    });
    const limits = [];
    if (m.tod > 1.55) limits.push('takeoff distance');
    if (m.asd > 1.55) limits.push('accelerate-stop distance');
    if (m.climb < 0.62) limits.push('climb gradient');
    const f = FACT[last];
    info.innerHTML = `
      <div class="tr-perf-kicker">Last changed</div>
      <h4 class="tr-perf-h4">${esc(f.t)}</h4>
      <p class="tr-perf-lead">${esc(f.d)}</p>
      ${limits.length ? `<p class="tr-perf-verdict is-bad"><b>Limiting:</b> ${limits.join(', ')}. In reality the maximum takeoff weight would be lower, or another configuration would be chosen.</p>`
    : '<p class="tr-perf-verdict is-ok"><b>Within limits</b> in this toy example.</p>'}
      <h5 class="tr-perf-h5">All factors</h5>
      <div class="tr-perf-factlist">
        ${Object.entries(FACT).map(([k, x]) => `<button type="button" data-fact="${k}" class="${k === last ? 'is-on' : ''}">${esc(x.t)}</button>`).join('')}
      </div>
      <p class="tr-perf-hint">The real maximum takeoff weight is the lowest of several limits: field length, climb, obstacles, tyre speed, brake energy and structural. Each factor moves those limits differently.</p>`;
  }

  root.querySelectorAll('[data-in]').forEach((inp) => inp.addEventListener('input', () => {
    s[inp.dataset.in] = Number(inp.value);
    last = inp.dataset.in;
    render();
  }));
  for (const [id, key] of [['surface', 'surface'], ['flap', 'flap'], ['air', 'air']]) {
    bindSeg(root, id, (v) => { s[key] = v; last = key; render(); });
  }
  info.addEventListener('click', (e) => { const b = e.target.closest('[data-fact]'); if (b) { last = b.dataset.fact; render(); } });
  root.querySelector('[data-reset]').addEventListener('click', () => {
    Object.assign(s, BASE);
    root.querySelectorAll('[data-in]').forEach((inp) => { inp.value = String(BASE[inp.dataset.in]); });
    for (const k of ['surface', 'flap', 'air']) {
      root.querySelectorAll(`[data-seg="${k}"] button`).forEach((b) => b.classList.toggle('is-on', b.dataset.v === String(BASE[k])));
    }
    render();
  });
  render();
  return { unmount() {} };
}
