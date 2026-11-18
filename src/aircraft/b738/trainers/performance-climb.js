// Performance concepts: engine-out takeoff flight path, climb gradients and obstacle clearance (gross vs net).
// Regulatory minimum gradients shown are those for two-engine aeroplanes; geometry is qualitative.
import { svgEl, sliderHTML } from './performance-util.js';

const LEN = 50000;       // ft of horizontal distance across the plot (not labelled; vertical exaggeration applies)
const HMAX = 1600;       // ft at the top of the plot
const NET_DECR = 0.008;  // twin: net = gross gradient minus 0.8%
const ACC_H = 800;       // illustrative acceleration height (min 400 ft)

export function mountClimb(root) {
  const s = { cap: 55, obX: 45, obH: 480 };

  root.innerHTML = `
    <div class="tr-perf-grid">
      <section class="tr-perf-card tr-perf-vis">
        <div class="tr-perf-cardhead">
          <h3 class="tr-perf-h3">Engine-out takeoff flight path</h3>
          <div class="tr-perf-legend"><span class="tr-perf-lg c-a">Gross path</span><span class="tr-perf-lg c-c">Net path</span><span class="tr-perf-lg c-r">Obstacle + 35 ft</span></div>
        </div>
        <svg viewBox="0 0 1000 400" class="tr-perf-svg" role="img" aria-label="Takeoff flight path segments and obstacle clearance"></svg>
        <div class="tr-perf-sliders">
          ${sliderHTML({ id: 'cap', label: 'Climb capability (weight, temperature, altitude)', min: 0, max: 100, value: s.cap, left: 'Heavy / hot / high', right: 'Light / cool' })}
          ${sliderHTML({ id: 'obX', label: 'Obstacle distance', min: 8, max: 95, value: s.obX, left: 'Close', right: 'Far' })}
          ${sliderHTML({ id: 'obH', label: 'Obstacle height', min: 0, max: 1200, step: 10, value: s.obH, left: 'Low', right: 'High' })}
        </div>
      </section>
      <aside class="tr-perf-card tr-perf-info"><div class="tr-perf-info-body" data-info></div></aside>
    </div>`;

  const svg = root.querySelector('svg');
  const info = root.querySelector('[data-info]');
  const P = { x0: 60, x1: 980, y0: 30, y1: 330 };
  const X = (d) => P.x0 + (d / LEN) * (P.x1 - P.x0);
  const Y = (h) => P.y1 - (h / HMAX) * (P.y1 - P.y0);

  // Build a path profile: returns function h(d) for a set of gradients.
  function profile(g2, gF, decr) {
    const g1 = Math.max(0.002, g2 * 0.3) - decr * 0.5;
    const seg = [];
    let d = 0, h = 35;
    const d1 = 3500;
    seg.push([d, h]);
    d += d1; h += d1 * g1; seg.push([d, h]);
    const gg2 = g2 - decr;
    const dAcc = gg2 > 0 ? Math.max(0, (ACC_H - h) / gg2) : LEN;
    const d2 = Math.min(dAcc, LEN - d);
    d += d2; h += d2 * gg2; seg.push([d, h]);
    if (d < LEN) { const d3 = Math.min(9000, LEN - d); d += d3; seg.push([d, h]); }
    if (d < LEN) { const dF = LEN - d; h += dF * (gF - decr); d += dF; seg.push([d, h]); }
    const at = (x) => {
      for (let i = 1; i < seg.length; i++) {
        if (x <= seg[i][0]) { const [a, ha] = seg[i - 1], [b, hb] = seg[i]; return ha + (hb - ha) * ((x - a) / Math.max(1, b - a)); }
      }
      return seg[seg.length - 1][1];
    };
    return { seg, at };
  }

  function render() {
    const k = 0.92 + (s.cap / 100) * 0.9;           // multiplier on the minimum gradients
    const g2 = 0.024 * k, gF = 0.012 * k * 1.15;
    const gross = profile(g2, gF, 0);
    const net = profile(g2, gF, NET_DECR);
    const obD = (s.obX / 100) * LEN;
    const netAt = net.at(obD);
    const clear = netAt >= s.obH + 35;
    const meets2 = g2 >= 0.024;

    svg.innerHTML = '';
    svgEl('rect', { x: 0, y: 0, width: 1000, height: 400, class: 'tr-perf-sky' }, svg);
    svgEl('rect', { x: 0, y: P.y1, width: 1000, height: 400 - P.y1, class: 'tr-perf-ground' }, svg);
    // segment bands (from gross path)
    const names = ['1ST SEGMENT', '2ND SEGMENT', 'ACCELERATION', 'FINAL SEGMENT'];
    const notes = ['Gear retracting', 'Gear up · T/O flap · V2', 'Level · flaps up', 'Clean · MCT'];
    gross.seg.slice(1).forEach(([d], i) => {
      const a = gross.seg[i][0];
      svgEl('rect', { x: X(a), y: P.y0, width: X(d) - X(a), height: P.y1 - P.y0, class: `tr-perf-band${i % 2 ? ' alt' : ''}` }, svg);
      if (X(d) - X(a) > 46) {
        svgEl('text', { x: (X(a) + X(d)) / 2, y: P.y0 + 16, 'text-anchor': 'middle', class: 'tr-perf-axl' }, svg, names[i]);
        if (X(d) - X(a) > 110) svgEl('text', { x: (X(a) + X(d)) / 2, y: P.y0 + 32, 'text-anchor': 'middle', class: 'tr-perf-small' }, svg, notes[i]);
      }
    });
    // reference lines
    svgEl('line', { x1: P.x0, x2: P.x1, y1: Y(400), y2: Y(400), class: 'tr-perf-guide' }, svg);
    svgEl('text', { x: P.x1 - 4, y: Y(400) - 6, 'text-anchor': 'end', class: 'tr-perf-small' }, svg, '400 FT: LOWEST ACCELERATION HEIGHT');
    svgEl('text', { x: P.x0 + 4, y: Y(35) + 16, class: 'tr-perf-small' }, svg, '35 FT AT END OF TAKEOFF DISTANCE');
    // obstacle
    const ox = X(obD);
    svgEl('path', { d: `M${ox - 16},${P.y1} L${ox - 4},${Y(s.obH)} L${ox + 4},${Y(s.obH)} L${ox + 16},${P.y1} Z`, class: 'tr-perf-obstacle' }, svg);
    svgEl('line', { x1: ox - 24, x2: ox + 24, y1: Y(s.obH + 35), y2: Y(s.obH + 35), class: 'tr-perf-clr' }, svg);
    // paths
    const pd = (pr) => pr.seg.map(([d, h], i) => `${i ? 'L' : 'M'}${X(d).toFixed(1)},${Y(h).toFixed(1)}`).join('');
    svgEl('path', { d: pd(gross), class: 'tr-perf-curve c-a' }, svg);
    svgEl('path', { d: pd(net), class: 'tr-perf-curve c-c tr-perf-dash' }, svg);
    svgEl('circle', { cx: ox, cy: Y(netAt), r: 5.5, class: `tr-perf-dot ${clear ? 'c-ok' : 'c-bad'}` }, svg);
    svgEl('text', { x: 992, y: 394, 'text-anchor': 'end', class: 'tr-perf-ns' }, svg, 'VERTICAL SCALE EXAGGERATED');

    info.innerHTML = `
      <div class="tr-perf-kicker">Climb & obstacles</div>
      <h4 class="tr-perf-h4">Gross, net and the obstacle</h4>
      <p class="tr-perf-lead">The <b>gross</b> path is what an average aeroplane achieves with an engine failed. The <b>net</b> path removes a safety margin (0.8% gradient for twins). The net path must clear every obstacle in the departure area by at least 35 ft, or the procedure must turn away from it.</p>
      ${clear ? '<p class="tr-perf-verdict is-ok"><b>Obstacle cleared</b> by the net path with the required margin.</p>'
    : '<p class="tr-perf-verdict is-bad"><b>Obstacle limited.</b> Reduce weight, choose different flap or thrust, or use an engine-out procedure that avoids the obstacle.</p>'}
      ${meets2 ? '' : '<p class="tr-perf-verdict is-bad"><b>Climb limited.</b> The second segment no longer meets the 2.4% gross minimum for a twin.</p>'}
      <ul class="tr-perf-bullets">
        <li><b>Second segment</b> (gear up, takeoff flap, V2) is usually the critical one: at least 2.4% gross for a twin.</li>
        <li><b>First segment</b> must be positive; the <b>final segment</b> (clean, max continuous thrust) at least 1.2%.</li>
        <li>Acceleration and flap retraction happen no lower than 400 ft, at the height the obstacle analysis allows.</li>
        <li>Climb-limited weight is independent of runway length; obstacle-limited weight depends on the obstacles and the engine-out procedure.</li>
      </ul>`;
  }

  root.querySelectorAll('[data-in]').forEach((inp) => {
    const out = root.querySelector(`[data-out="${inp.dataset.in}"]`);
    const upd = () => {
      s[inp.dataset.in] = Number(inp.value);
      if (inp.dataset.in === 'obH') out.textContent = `${s.obH} ft`;
      else if (inp.dataset.in === 'cap') out.textContent = s.cap < 9 ? 'Below minimum' : s.cap < 15 ? 'Near minimum' : s.cap < 50 ? 'Marginal' : 'Good';
      else out.textContent = '';
      render();
    };
    inp.addEventListener('input', upd);
    upd();
  });
  render();
  return { unmount() {} };
}
