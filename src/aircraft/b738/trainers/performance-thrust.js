// Performance concepts: reduced takeoff thrust. Assumed temperature vs fixed derate (and both combined).
import { svgEl, esc, clamp, sliderHTML, segHTML, bindSeg } from './performance-util.js';

const RATINGS = { TO: 1, 'TO-1': 0.9, 'TO-2': 0.8 };   // conceptual proportions, not real values
const TF = 0.42;                                       // flat-rate temperature on the normalised axis

const thrust = (r, T) => RATINGS[r] * (T <= TF ? 1 : 1 - 0.95 * (T - TF));

export function mountThrust(root) {
  const s = { oat: 25, assumed: 40, rating: 'TO', useAssumed: true };

  root.innerHTML = `
    <div class="tr-perf-grid">
      <section class="tr-perf-card tr-perf-vis">
        <div class="tr-perf-cardhead">
          <h3 class="tr-perf-h3">Takeoff thrust vs outside air temperature</h3>
          <div class="tr-perf-segrow tr-perf-segrow--inline"><b>Rating</b>${segHTML('rating', Object.keys(RATINGS).map((k) => [k, k === 'TO' ? 'TO (full)' : k]), s.rating)}</div>
        </div>
        <svg viewBox="0 0 1000 380" class="tr-perf-svg" role="img" aria-label="Thrust versus temperature with flat rating, derates and assumed temperature"></svg>
        <div class="tr-perf-sliders tr-perf-sliders--2">
          ${sliderHTML({ id: 'oat', label: 'Actual OAT', min: 0, max: 60, value: s.oat, left: 'Cold', right: 'Hot' })}
          ${sliderHTML({ id: 'assumed', label: 'Assumed temperature', min: 0, max: 100, value: s.assumed, left: 'At OAT', right: 'Max assumed' })}
        </div>
        <label class="tr-perf-check tr-perf-check--row"><input type="checkbox" data-use checked><span>Use an assumed temperature</span></label>
      </section>
      <aside class="tr-perf-card tr-perf-info"><div class="tr-perf-info-body" data-info></div></aside>
    </div>
    <section class="tr-perf-card">
      <h3 class="tr-perf-h3">Assumed temperature vs fixed derate</h3>
      <div class="tr-perf-tablewrap">
        <table class="tr-perf-table">
          <thead><tr><th></th><th>Assumed temperature</th><th>Fixed derate (e.g. TO-1, TO-2)</th><th>Derate + assumed temperature</th></tr></thead>
          <tbody>
            <tr><th>What it is</th><td>Performance is calculated as if it were hotter than it is. The engine is set to the thrust it would make at that assumed temperature.</td><td>A separate, certified lower takeoff rating with its own performance data and limits.</td><td>A derate selected, with an assumed temperature for further reduction from that derated rating.</td></tr>
            <tr><th>Minimum control speeds</th><td>Based on full rated thrust (conservative), because full thrust could be selected.</td><td>Based on the derated thrust, so they are lower. That can allow a lower V1 and more weight on short or slippery runways.</td><td>Based on the derate.</td></tr>
            <tr><th>Adding thrust</th><td>Thrust levers can be advanced to full rated thrust if needed, since control speeds already allow for it.</td><td>Thrust above the derate limit at low speed with an engine failed may exceed the control speeds the data relied on. Follow the FCOM.</td><td>As for the derate.</td></tr>
            <tr><th>Contaminated runway</th><td>Not normally permitted.</td><td>Permitted where approved data exist.</td><td>Derate only, where permitted; follow operator policy.</td></tr>
            <tr><th>Why use it</th><td>Lower EGT and engine wear, better reliability and cost.</td><td>Same, plus a performance benefit when VMCG limits.</td><td>Greatest reduction where performance allows.</td></tr>
          </tbody>
        </table>
      </div>
      <p class="tr-perf-hint">The 737 NG FMC offers takeoff derates and an assumed (selected) temperature on its takeoff thrust page; climb derates are a separate feature. The exact options depend on engine rating and operator. See your FCOM.</p>
    </section>`;

  const svg = root.querySelector('svg');
  const info = root.querySelector('[data-info]');
  const P = { x0: 90, x1: 960, y0: 36, y1: 310 };
  const X = (T) => P.x0 + T * (P.x1 - P.x0);
  const Y = (f) => P.y1 - (f / 1.12) * (P.y1 - P.y0);

  function render() {
    const oatT = s.oat / 100;
    const asmT = s.useAssumed ? Math.max(oatT, oatT + (s.assumed / 100) * (0.98 - oatT)) : oatT;
    const full = thrust('TO', oatT);
    const used = thrust(s.rating, asmT);
    const red = 1 - used / full;
    svg.innerHTML = '';
    svgEl('rect', { x: 0, y: 0, width: 1000, height: 380, class: 'tr-perf-bg' }, svg);
    svgEl('line', { x1: X(TF), x2: X(TF), y1: P.y0, y2: P.y1, class: 'tr-perf-guide' }, svg);
    svgEl('text', { x: X(TF) + 6, y: P.y1 - 8, class: 'tr-perf-small' }, svg, 'FLAT-RATE TEMPERATURE');
    svgEl('text', { x: X(0.12), y: Y(1.06), class: 'tr-perf-small' }, svg, 'FLAT-RATED: CONSTANT THRUST');
    svgEl('text', { x: X(0.84), y: Y(0.55), 'text-anchor': 'middle', class: 'tr-perf-small' }, svg, 'EGT-LIMITED: THRUST FALLS');
    // axes
    svgEl('line', { x1: P.x0, x2: P.x1, y1: P.y1, y2: P.y1, class: 'tr-perf-axis' }, svg);
    svgEl('line', { x1: P.x0, x2: P.x0, y1: P.y0, y2: P.y1, class: 'tr-perf-axis' }, svg);
    svgEl('text', { x: (P.x0 + P.x1) / 2, y: P.y1 + 30, 'text-anchor': 'middle', class: 'tr-perf-axl' }, svg, 'OUTSIDE AIR TEMPERATURE →');
    svgEl('text', { x: 30, y: (P.y0 + P.y1) / 2, 'text-anchor': 'middle', class: 'tr-perf-axl', transform: `rotate(-90 30 ${(P.y0 + P.y1) / 2})` }, svg, 'MAX TAKEOFF THRUST →');
    // rating curves
    for (const r of Object.keys(RATINGS)) {
      const d = Array.from({ length: 101 }, (_, i) => `${i ? 'L' : 'M'}${X(i / 100).toFixed(1)},${Y(thrust(r, i / 100)).toFixed(1)}`).join('');
      svgEl('path', { d, class: `tr-perf-curve ${r === s.rating ? 'c-a' : 'c-n is-faint'}` }, svg);
      svgEl('text', { x: P.x0 + 6, y: Y(thrust(r, 0)) - 6, class: `tr-perf-small ${r === s.rating ? 'c-a-t' : ''}` }, svg, r);
    }
    // OAT marker + full thrust
    svgEl('line', { x1: X(oatT), x2: X(oatT), y1: Y(full), y2: P.y1, class: 'tr-perf-guide c-n' }, svg);
    svgEl('circle', { cx: X(oatT), cy: Y(full), r: 6, class: 'tr-perf-dot c-n' }, svg);
    svgEl('text', { x: X(oatT), y: P.y1 + 14, 'text-anchor': 'middle', class: 'tr-perf-small' }, svg, 'OAT');
    // Assumed temperature marker
    if (s.useAssumed && asmT > oatT + 0.005) {
      svgEl('line', { x1: X(asmT), x2: X(asmT), y1: Y(used), y2: P.y1, class: 'tr-perf-guide c-a' }, svg);
      svgEl('text', { x: X(asmT), y: P.y1 + 14, 'text-anchor': 'middle', class: 'tr-perf-small c-a-t' }, svg, 'ASSUMED');
      svgEl('path', { d: `M${X(oatT)},${Y(used)} L${X(asmT)},${Y(used)}`, class: 'tr-perf-guide c-a' }, svg);
    }
    // reduction bracket
    if (red > 0.004) {
      const bx = Math.max(X(oatT), X(asmT)) + 28;
      svgEl('path', { d: `M${bx - 6},${Y(full)} L${bx},${Y(full)} L${bx},${Y(used)} L${bx - 6},${Y(used)}`, class: 'tr-perf-bracket' }, svg);
      svgEl('text', { x: bx + 8, y: (Y(full) + Y(used)) / 2 + 4, class: 'tr-perf-small c-a-t' }, svg, 'REDUCTION');
    }
    svgEl('circle', { cx: X(asmT), cy: Y(used), r: 7, class: 'tr-perf-dot c-a' }, svg);

    // Info
    const noEffect = s.useAssumed && asmT <= TF && s.rating === 'TO';
    const big = red > 0.25;
    info.innerHTML = `
      <div class="tr-perf-kicker">Reduced thrust</div>
      <h4 class="tr-perf-h4">Use only the thrust you need</h4>
      <p class="tr-perf-lead">When the runway and climb allow it, a lower takeoff thrust cuts engine wear and EGT. Performance must still be met at the reduced setting.</p>
      <div class="tr-perf-meter"><span>Thrust used vs full rated at this OAT</span><div class="track"><b style="width:${(used / full) * 100}%"></b><em style="left:75%" title="Common regulatory limit"></em></div>
      <small>${red < 0.004 ? 'Full rated thrust' : 'Reduced'}${big ? ' · beyond the common 25% limit' : ''}</small></div>
      ${noEffect ? '<p class="tr-perf-verdict is-bad"><b>No reduction yet.</b> Below the flat-rate temperature the engine makes the same thrust, so an assumed temperature in that band changes nothing.</p>' : ''}
      ${big ? '<p class="tr-perf-verdict is-bad"><b>Too much reduction.</b> Regulations commonly cap assumed-temperature reduction at 25% below the selected rating, and the data/FMC enforce a maximum assumed temperature.</p>' : ''}
      <ul class="tr-perf-bullets">
        <li><b>Built-in margin:</b> the real air is colder and denser than assumed, so actual TAS is lower and real performance slightly better than computed.</li>
        <li><b>Derate</b> moves the whole curve down: a different rating, not a pretend temperature.</li>
        <li>Both methods are restricted in some conditions (e.g. contaminated runways, some MEL items, windshear expected). Follow the FCOM and operator policy.</li>
      </ul>`;
  }

  root.querySelectorAll('[data-in]').forEach((inp) => {
    const out = root.querySelector(`[data-out="${inp.dataset.in}"]`);
    const upd = () => {
      s[inp.dataset.in] = Number(inp.value);
      out.textContent = inp.dataset.in === 'oat'
        ? (s.oat / 100 <= TF ? 'Below flat-rate temp' : 'Above flat-rate temp')
        : (s.useAssumed ? (s.assumed < 5 ? 'Same as OAT' : 'Above OAT') : 'Not used');
      render();
    };
    inp.addEventListener('input', upd);
    upd();
  });
  bindSeg(root, 'rating', (v) => { s.rating = v; render(); });
  root.querySelector('[data-use]').addEventListener('change', (e) => {
    s.useAssumed = e.target.checked;
    root.querySelector('[data-in="assumed"]').disabled = !s.useAssumed;
    root.querySelector('[data-out="assumed"]').textContent = s.useAssumed ? 'Above OAT' : 'Not used';
    render();
  });
  render();
  return { unmount() {} };
}

