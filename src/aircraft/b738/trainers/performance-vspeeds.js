// Performance concepts: takeoff V-speeds on an animated takeoff run, and the balanced-field concept
// (accelerate-go vs accelerate-stop as V1 varies). Qualitative only.
import { svgEl, esc, clamp, lerp, sliderHTML, segHTML, bindSeg } from './performance-util.js';

const SPEEDS = {
  vmcg: { label: 'VMCG', name: 'Minimum control speed on the ground',
    def: 'The lowest speed on the takeoff roll at which, if the critical engine suddenly fails, directional control can be kept using primary aerodynamic controls only (no nosewheel steering) and the takeoff continued safely.' },
  vef: { label: 'VEF', name: 'Engine failure speed',
    def: 'The speed at which the critical engine is assumed to fail for certification. It may not be less than VMCG.' },
  v1: { label: 'V1', name: 'Takeoff decision speed',
    def: 'The maximum speed by which the first action to reject must be taken, and the minimum speed from which the takeoff can be continued after an engine failure and still reach screen height within the takeoff distance. It includes the speed gained while the pilot recognises the failure.' },
  vr: { label: 'VR', name: 'Rotation speed',
    def: 'The speed at which rotation begins. It is set so that, even with an engine failed, V2 is reached by screen height. VR may not be less than V1 or 1.05 × VMCA.' },
  vlof: { label: 'VLOF', name: 'Lift-off speed',
    def: 'The speed at which the aeroplane first becomes airborne. It is constrained by minimum unstick speed (VMU) and tail clearance.' },
  v2: { label: 'V2', name: 'Takeoff safety speed',
    def: 'The target climb speed with an engine failed, to be reached by screen height. V2 is at least 1.13 × VSR (reference stall speed) and 1.10 × VMCA.' },
  vmca: { label: 'VMCA', name: 'Minimum control speed in the air',
    def: 'The lowest airborne speed at which control can be kept with the critical engine inoperative and the other at takeoff thrust, using up to about 5° of bank toward the live engine. It feeds into the minimums for VR and V2.' },
};

const MODES = {
  all: { label: 'All engines', events: [['vmcg', 0.29], ['v1', 0.38], ['vr', 0.44], ['vlof', 0.50]], screen: 0.58,
    keys: [[0, 0.04, 0], [0.62, 0.44, 0], [0.70, 0.50, 0], [0.80, 0.58, 1], [1, 0.75, 3]] },
  go: { label: 'Engine fail → continue', fail: 0.35, events: [['vmcg', 0.29], ['vef', 0.35], ['v1', 0.38], ['vr', 0.47], ['vlof', 0.545]], screen: 0.68,
    keys: [[0, 0.04, 0], [0.55, 0.35, 0], [0.62, 0.40, 0], [0.73, 0.47, 0], [0.82, 0.545, 0], [0.93, 0.68, 1], [1, 0.76, 1.6]] },
  stop: { label: 'Engine fail → reject', fail: 0.35, events: [['vmcg', 0.29], ['vef', 0.35], ['v1', 0.38]], stop: 0.62,
    keys: [[0, 0.04, 0], [0.55, 0.35, 0], [0.60, 0.385, 0], [0.70, 0.46, 0], [0.80, 0.54, 0], [0.90, 0.595, 0], [1, 0.62, 0]] },
};

const X0 = 40, X1 = 960, GY = 190, HS = 46; // runway span, ground y, height scale for 35 ft

function acSilhouette(parent) {
  const g = svgEl('g', { class: 'tr-perf-ac' }, parent);
  svgEl('path', { class: 'ac-fin', d: 'M-35,-17.6 L-46,-31.5 L-51,-31.5 L-47.5,-17 Z' }, g);
  svgEl('path', { class: 'ac-body', d: 'M-47.5,-17 L27,-18.6 C33,-18.6 37,-16.2 38.4,-13.2 C37.2,-10.6 33,-9.5 27,-9.5 L-29,-9.5 C-38,-10 -44.5,-12.8 -47.5,-17 Z' }, g);
  svgEl('path', { class: 'ac-wing', d: 'M-9,-11.2 L11,-12.4 L13,-10.6 L-8,-10.2 Z' }, g);
  svgEl('path', { class: 'ac-nac', d: 'M-1.6,-10.6 L12.4,-10.6 Q14.6,-10.6 14.6,-8.4 L14.6,-6.4 L-0.2,-6.4 Q-2.8,-6.4 -2.8,-8.6 Q-2.8,-10.6 -1.6,-10.6 Z' }, g);
  svgEl('path', { class: 'ac-win', d: 'M30.5,-16.4 L34.4,-15.8 L36.2,-14.2 L31.2,-14.2 Z' }, g);
  const fail = svgEl('circle', { cx: 6, cy: -8.5, r: 7, class: 'ac-fail' }, g);
  const gear = svgEl('g', { class: 'ac-gear' }, g);
  svgEl('line', { x1: 0, y1: -9.6, x2: 0, y2: -3.2 }, gear);
  svgEl('circle', { cx: 0, cy: -2, r: 2 }, gear);
  svgEl('line', { x1: 29, y1: -9.6, x2: 29, y2: -3.4 }, gear);
  svgEl('circle', { cx: 29, cy: -1.8, r: 1.8 }, gear);
  return { g, fail };
}

export function mountVSpeeds(root) {
  let mode = 'go';
  let p = 0;
  let playing = true;
  let focus = null;
  const bfl = { w: 70, v1: 50, stopway: false, clearway: false };

  root.innerHTML = `
    <div class="tr-perf-grid">
      <section class="tr-perf-card tr-perf-vis">
        <div class="tr-perf-cardhead">
          <h3 class="tr-perf-h3">Takeoff speeds along the run</h3>
          ${segHTML('mode', Object.entries(MODES).map(([k, m]) => [k, m.label]), mode)}
        </div>
        <svg viewBox="0 0 1000 250" class="tr-perf-svg" data-svg="run" role="img" aria-label="Animated takeoff run with V-speeds"></svg>
        <div class="tr-perf-playrow">
          <button type="button" class="tr-perf-play" data-play aria-label="Pause"><svg viewBox="0 0 20 20" class="i-play"><path d="M6 3.5v13l11-6.5z"/></svg><svg viewBox="0 0 20 20" class="i-pause"><path d="M5.5 3.5h3v13h-3zM11.5 3.5h3v13h-3z"/></svg></button>
          <input type="range" min="0" max="1000" value="0" data-scrub aria-label="Takeoff progress">
          <span class="tr-perf-readout" data-runread></span>
        </div>
        <div class="tr-perf-ladder">
          ${['vmcg', 'vef', 'v1', 'vr', 'vlof', 'v2'].map((k, i) => `${i ? `<i>${{ vef: '≤', v1: '&lt;', vr: '≤', vlof: '&lt;', v2: '&lt;' }[k]}</i>` : ''}<button type="button" data-sp="${k}">${SPEEDS[k].label}</button>`).join('')}
          <span class="tr-perf-ladder-note">V1 ≤ VMBE (brake energy) · VR ≥ 1.05 VMCA · V2 ≥ 1.13 VSR and ≥ 1.10 VMCA</span>
        </div>
      </section>
      <aside class="tr-perf-card tr-perf-info"><div class="tr-perf-info-body" data-info="sp"></div></aside>
    </div>

    <div class="tr-perf-grid">
      <section class="tr-perf-card tr-perf-vis">
        <div class="tr-perf-cardhead">
          <h3 class="tr-perf-h3">Balanced field concept</h3>
          <div class="tr-perf-toggles">
            <label class="tr-perf-check"><input type="checkbox" data-bopt="stopway"><span>Add stopway</span></label>
            <label class="tr-perf-check"><input type="checkbox" data-bopt="clearway"><span>Add clearway</span></label>
          </div>
        </div>
        <svg viewBox="0 0 1000 400" class="tr-perf-svg" data-svg="bfl" role="img" aria-label="Accelerate-go and accelerate-stop distances against V1"></svg>
        <div class="tr-perf-sliders tr-perf-sliders--2">
          ${sliderHTML({ id: 'v1', label: 'Selected V1', min: 0, max: 100, value: bfl.v1, left: 'Low (toward VMCG)', right: 'High (toward VR)' })}
          ${sliderHTML({ id: 'w', label: 'Takeoff weight', min: 0, max: 100, value: bfl.w, left: 'Light', right: 'Heavy' })}
        </div>
      </section>
      <aside class="tr-perf-card tr-perf-info"><div class="tr-perf-info-body" data-info="bfl"></div></aside>
    </div>`;

  const runSvg = root.querySelector('[data-svg="run"]');
  const bflSvg = root.querySelector('[data-svg="bfl"]');
  const scrub = root.querySelector('[data-scrub]');
  const playBtn = root.querySelector('[data-play]');
  const spInfo = root.querySelector('[data-info="sp"]');
  const bflInfo = root.querySelector('[data-info="bfl"]');
  let run = null;

  // ---------- takeoff run ----------
  const X = (f) => X0 + f * (X1 - X0);
  function buildRun() {
    const M = MODES[mode];
    runSvg.innerHTML = '';
    svgEl('rect', { x: 0, y: 0, width: 1000, height: 250, class: 'tr-perf-sky' }, runSvg);
    svgEl('rect', { x: 0, y: GY, width: 1000, height: 60, class: 'tr-perf-ground' }, runSvg);
    svgEl('rect', { x: X0, y: GY - 1, width: X1 - X0, height: 7, rx: 1.5, class: 'tr-perf-rwy' }, runSvg);
    for (let x = X0 + 30; x < X1 - 10; x += 30) svgEl('line', { x1: x, x2: x + 14, y1: GY + 2.5, y2: GY + 2.5, class: 'tr-perf-cl' }, runSvg);
    // screen height reference
    svgEl('line', { x1: X0, x2: X1, y1: GY - HS, y2: GY - HS, class: 'tr-perf-screen' }, runSvg);
    svgEl('text', { x: X1, y: GY - HS - 6, 'text-anchor': 'end', class: 'tr-perf-small' }, runSvg, 'SCREEN HEIGHT (35 FT DRY)');
    const marks = svgEl('g', {}, runSvg);
    const evs = [...M.events];
    if (M.screen) evs.push(['v2', M.screen]);
    evs.forEach(([k, f], i) => {
      const x = X(f);
      const lift = k === 'v2' ? HS : 0;
      const row = i % 2;
      const g = svgEl('g', { class: `tr-perf-spmark${k === 'v1' ? ' is-v1' : ''}`, 'data-sp': k }, marks);
      svgEl('line', { x1: x, x2: x, y1: GY - lift, y2: 40 + row * 34 + 10, class: 'spm-line' }, g);
      const w = SPEEDS[k].label.length * 9 + 14;
      svgEl('rect', { x: x - w / 2, y: 28 + row * 34, width: w, height: 22, rx: 5, class: 'spm-pill' }, g);
      svgEl('text', { x, y: 43.5 + row * 34, 'text-anchor': 'middle', class: 'spm-text' }, g, SPEEDS[k].label);
    });
    if (M.stop) {
      const x = X(M.stop);
      svgEl('rect', { x: X(0.04), y: GY + 16, width: x - X(0.04), height: 6, rx: 3, class: 'tr-perf-bar c-c' }, runSvg);
      svgEl('text', { x: x + 8, y: GY + 23, class: 'tr-perf-small' }, runSvg, 'ACCELERATE-STOP DISTANCE');
    }
    if (M.screen) {
      const x = X(M.screen);
      svgEl('rect', { x: X(0.04), y: GY + 16, width: x - X(0.04), height: 6, rx: 3, class: `tr-perf-bar ${mode === 'all' ? 'c-a' : 'c-b'}` }, runSvg);
      svgEl('text', { x: x + 8, y: GY + 23, class: 'tr-perf-small' }, runSvg, mode === 'all' ? 'ALL-ENGINE DISTANCE TO 35 FT' : 'ACCELERATE-GO DISTANCE (TO 35 FT)');
    }
    const trail = svgEl('path', { class: 'tr-perf-trail' }, runSvg);
    const ac = acSilhouette(svgEl('g', {}, runSvg));
    svgEl('text', { x: 992, y: 244, 'text-anchor': 'end', class: 'tr-perf-ns' }, runSvg, 'SIDE VIEW · NOT TO SCALE');
    run = { ac, trail };
    paintRun();
    highlightSp();
  }

  function posAt(q) {
    const K = MODES[mode].keys;
    let i = 0;
    while (i < K.length - 2 && q > K[i + 1][0]) i++;
    const [t0, x0, h0] = K[i], [t1, x1, h1] = K[i + 1];
    const u = clamp((q - t0) / (t1 - t0), 0, 1);
    const us = mode === 'stop' && i >= 2 ? 1 - (1 - u) * (1 - u) : u;
    return { f: lerp(x0, x1, mode === 'stop' && i >= 2 ? lerp(u, us, 0.5) : u), h: lerp(h0, h1, u) };
  }

  function paintRun() {
    const M = MODES[mode];
    const { f, h } = posAt(p);
    const x = X(f), y = GY - h * HS;
    const pitch = h > 0 ? 9 : (M.screen && f > M.events.find((e) => e[0] === 'vr')[1] ? Math.min(8, (f - M.events.find((e) => e[0] === 'vr')[1]) * 260) : 0);
    run.ac.g.setAttribute('transform', `translate(${x.toFixed(1)},${y.toFixed(1)}) rotate(${-pitch}) scale(1.15)`);
    run.ac.fail.style.display = M.fail && f >= M.fail ? '' : 'none';
    const pts = [];
    for (let q = 0; q <= p; q += 0.01) { const s = posAt(q); pts.push(`${X(s.f).toFixed(1)},${(GY - s.h * HS).toFixed(1)}`); }
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    run.trail.setAttribute('d', `M${pts.join('L')}`);
    // Readout: last passed speed
    let last = null;
    const evs = [...M.events, ...(M.screen ? [['v2', M.screen]] : [])];
    for (const [k, ef] of evs) if (f >= ef - 1e-3) last = k;
    runSvg.querySelectorAll('.tr-perf-spmark').forEach((g) => {
      const ef = evs.find((e) => e[0] === g.dataset.sp)[1];
      g.classList.toggle('is-past', f >= ef - 1e-3);
    });
    let txt = last ? `Passed ${SPEEDS[last].label}` : 'Accelerating';
    if (mode === 'stop' && p >= 0.999) txt = 'Stopped: accelerate-stop complete';
    else if (mode === 'stop' && f > 0.385) txt = 'Rejecting: max braking, speedbrake, reverse';
    else if (M.screen && p >= 0.999) txt = mode === 'all' ? 'Climbing' : 'Climbing at V2 (one engine)';
    root.querySelector('[data-runread]').textContent = txt;
    scrub.value = String(Math.round(p * 1000));
    playBtn.classList.toggle('is-playing', playing);
  }

  function highlightSp() {
    runSvg.querySelectorAll('.tr-perf-spmark').forEach((g) => g.classList.toggle('is-focus', g.dataset.sp === focus));
    root.querySelectorAll('.tr-perf-ladder [data-sp]').forEach((b) => b.classList.toggle('is-on', b.dataset.sp === focus));
    const s = focus ? SPEEDS[focus] : null;
    spInfo.innerHTML = s ? `
      <div class="tr-perf-kicker">${s.label}</div>
      <h4 class="tr-perf-h4">${esc(s.name)}</h4>
      <p class="tr-perf-lead">${esc(s.def)}</p>` : `
      <div class="tr-perf-kicker">V-speeds</div>
      <h4 class="tr-perf-h4">An ordered set of speeds</h4>
      <p class="tr-perf-lead">Takeoff speeds come out of the performance calculation for each takeoff, and their order is fixed by certification rules.</p>
      <ul class="tr-perf-bullets">
        <li><b>Engine fail → continue:</b> after V1 the aeroplane reaches screen height at V2 within the takeoff distance.</li>
        <li><b>Engine fail → reject:</b> a reject started by V1 stops within the accelerate-stop distance.</li>
        <li>Wet runways permit a lower screen height for the continued case (15 ft), so V1 can be lower.</li>
      </ul>
      <p class="tr-perf-hint">Hover a speed on the drawing or in the ladder for its definition. VMCA is airborne: <button type="button" class="tr-perf-link" data-sp="vmca">VMCA</button></p>`;
  }

  bindSeg(root, 'mode', (v) => { mode = v; p = 0; playing = true; buildRun(); });
  playBtn.addEventListener('click', () => { if (!playing && p >= 1) p = 0; playing = !playing; paintRun(); });
  scrub.addEventListener('input', () => { playing = false; p = Number(scrub.value) / 1000; paintRun(); });
  const spOver = (e) => { const g = e.target.closest('[data-sp]'); if (g && g.dataset.sp !== focus) { focus = g.dataset.sp; highlightSp(); } };
  runSvg.addEventListener('mouseover', spOver);
  root.querySelector('.tr-perf-ladder').addEventListener('mouseover', spOver);
  root.querySelector('.tr-perf-ladder').addEventListener('click', spOver);
  spInfo.addEventListener('click', spOver);

  // ---------- balanced field ----------
  const PX0 = 90, PX1 = 960, PY0 = 40, PY1 = 330; // plot box
  const YMIN = 0.55, YMAX = 1.3;
  const px = (v) => PX0 + v * (PX1 - PX0);
  const py = (d) => PY1 - ((d - YMIN) / (YMAX - YMIN)) * (PY1 - PY0);
  const scaleW = () => 0.62 + 0.42 * (bfl.w / 100);
  const agd = (v) => scaleW() * (1.18 - 0.3 * v);
  const asd = (v) => scaleW() * (0.8 + 0.42 * Math.pow(v, 1.3));
  const avail = () => ({ toda: bfl.clearway ? 1.12 : 1.0, asda: bfl.stopway ? 1.1 : 1.0 });

  function drawBfl() {
    const v = bfl.v1 / 100;
    const A = avail();
    bflSvg.innerHTML = '';
    svgEl('rect', { x: 0, y: 0, width: 1000, height: 400, class: 'tr-perf-bg' }, bflSvg);
    // valid V1 range
    let lo = null, hi = null, bal = null;
    for (let i = 0; i <= 400; i++) {
      const u = i / 400;
      if (agd(u) <= A.toda && asd(u) <= A.asda) { if (lo === null) lo = u; hi = u; }
      if (bal === null && asd(u) >= agd(u)) bal = u;
    }
    if (lo !== null) {
      svgEl('rect', { x: px(lo), y: PY0, width: Math.max(2, px(hi) - px(lo)), height: PY1 - PY0, class: 'tr-perf-range' }, bflSvg);
      svgEl('text', { x: (px(lo) + px(hi)) / 2, y: PY0 + 16, 'text-anchor': 'middle', class: 'tr-perf-small tr-perf-range-t' }, bflSvg, 'PERMISSIBLE V1 RANGE');
    }
    // axes
    svgEl('line', { x1: PX0, x2: PX1, y1: PY1, y2: PY1, class: 'tr-perf-axis' }, bflSvg);
    svgEl('line', { x1: PX0, x2: PX0, y1: PY0, y2: PY1, class: 'tr-perf-axis' }, bflSvg);
    svgEl('text', { x: PX0, y: PY1 + 22, class: 'tr-perf-axl' }, bflSvg, 'VMCG');
    svgEl('text', { x: PX1, y: PY1 + 22, 'text-anchor': 'end', class: 'tr-perf-axl' }, bflSvg, 'VR');
    svgEl('text', { x: (PX0 + PX1) / 2, y: PY1 + 44, 'text-anchor': 'middle', class: 'tr-perf-axl' }, bflSvg, 'SELECTED V1 →');
    svgEl('text', { x: 26, y: (PY0 + PY1) / 2, 'text-anchor': 'middle', class: 'tr-perf-axl', transform: `rotate(-90 26 ${(PY0 + PY1) / 2})` }, bflSvg, 'DISTANCE REQUIRED →');
    // available lines
    const availLine = (d, label, cls, dy) => {
      svgEl('line', { x1: PX0, x2: PX1, y1: py(d), y2: py(d), class: `tr-perf-avail ${cls}` }, bflSvg);
      svgEl('text', { x: PX0 + 8, y: py(d) + dy, class: `tr-perf-small ${cls}-t` }, bflSvg, label);
    };
    if (A.toda === A.asda) availLine(A.toda, 'TODA = ASDA (no stopway / clearway)', 'c-n', -6);
    else { availLine(A.toda, 'TODA', 'c-b', A.toda > A.asda ? -6 : 14); availLine(A.asda, 'ASDA', 'c-c', A.asda > A.toda ? -6 : 14); }
    // curves
    const curve = (fn) => Array.from({ length: 101 }, (_, i) => `${i ? 'L' : 'M'}${px(i / 100).toFixed(1)},${py(fn(i / 100)).toFixed(1)}`).join('');
    svgEl('path', { d: curve(agd), class: 'tr-perf-curve c-b' }, bflSvg);
    svgEl('path', { d: curve(asd), class: 'tr-perf-curve c-c' }, bflSvg);
    svgEl('text', { x: px(0.05), y: py(agd(0.05)) - 10, class: 'tr-perf-cl-t c-b-t' }, bflSvg, 'ACCELERATE-GO');
    svgEl('text', { x: px(0.97), y: py(asd(0.97)) - 10, 'text-anchor': 'end', class: 'tr-perf-cl-t c-c-t' }, bflSvg, 'ACCELERATE-STOP');
    // balanced point
    if (bal !== null) {
      svgEl('circle', { cx: px(bal), cy: py(agd(bal)), r: 5, class: 'tr-perf-bal' }, bflSvg);
      svgEl('text', { x: px(bal), y: py(agd(bal)) + 24, 'text-anchor': 'middle', class: 'tr-perf-small' }, bflSvg, 'BALANCED');
    }
    // selected V1
    const g = svgEl('g', { class: 'tr-perf-v1sel' }, bflSvg);
    svgEl('line', { x1: px(v), x2: px(v), y1: PY0, y2: PY1, class: 'v1-line' }, g);
    svgEl('circle', { cx: px(v), cy: py(agd(v)), r: 6, class: `v1-dot ${agd(v) > A.toda ? 'is-bad' : ''}` }, g);
    svgEl('circle', { cx: px(v), cy: py(asd(v)), r: 6, class: `v1-dot ${asd(v) > A.asda ? 'is-bad' : ''}` }, g);
    svgEl('rect', { x: px(v) - 20, y: PY1 - 22, width: 40, height: 18, rx: 4, class: 'v1-pill' }, g);
    svgEl('text', { x: px(v), y: PY1 - 9, 'text-anchor': 'middle', class: 'v1-text' }, g, 'V1');

    // info
    const goOk = agd(v) <= A.toda, stopOk = asd(v) <= A.asda;
    let verdict;
    if (lo === null) verdict = '<p class="tr-perf-verdict is-bad"><b>Field-length limited.</b> No V1 satisfies both cases at this weight. Reduce weight, or use more thrust or a different flap setting.</p>';
    else if (goOk && stopOk) verdict = '<p class="tr-perf-verdict is-ok"><b>This V1 works.</b> Both the continued and the rejected takeoff fit within what is available.</p>';
    else verdict = `<p class="tr-perf-verdict is-bad"><b>${!goOk ? 'Accelerate-go exceeds TODA' : 'Accelerate-stop exceeds ASDA'}.</b> Move V1 ${!goOk ? 'up' : 'down'} into the permissible range.</p>`;
    bflInfo.innerHTML = `
      <div class="tr-perf-kicker">Balanced field</div>
      <h4 class="tr-perf-h4">Trading go against stop</h4>
      <p class="tr-perf-lead">A <b>higher V1</b> leaves less runway for stopping, so accelerate-stop grows. It also means the engine fails later, closer to rotation, so accelerate-go shrinks.</p>
      ${verdict}
      <ul class="tr-perf-bullets">
        <li>Where the curves cross, both distances are equal: the <b>balanced</b> V1 and balanced field length.</li>
        <li>With a stopway or clearway, ASDA and TODA differ. An <b>unbalanced</b> V1 can then allow more weight.</li>
        <li>V1 is also bounded by VMCG (lower), VR and brake energy limits (upper).</li>
      </ul>`;
  }

  root.querySelectorAll('[data-bopt]').forEach((c) => c.addEventListener('change', () => { bfl[c.dataset.bopt] = c.checked; drawBfl(); }));
  root.querySelectorAll('[data-in]').forEach((inp) => {
    const out = root.querySelector(`[data-out="${inp.dataset.in}"]`);
    const upd = () => {
      bfl[inp.dataset.in] = Number(inp.value);
      out.textContent = inp.dataset.in === 'w' ? ['Light', 'Medium', 'Heavy', 'Very heavy'][Math.min(3, Math.floor(inp.value / 26))] : '';
      drawBfl();
    };
    inp.addEventListener('input', upd);
    upd();
  });

  buildRun();
  drawBfl();
  let hold = 0;
  return {
    tick(dt) {
      if (!playing) return;
      if (p >= 1) { hold += dt; if (hold > 1.6) { hold = 0; p = 0; } else return; }
      p = Math.min(1, p + dt / 7);
      paintRun();
    },
    unmount() {},
  };
}
