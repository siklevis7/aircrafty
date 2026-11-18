// Performance concepts: runway declared distances (TORA, TODA, ASDA, LDA) on a drawn runway.
import { svgEl, dimLine, esc } from './performance-util.js';

const DIST = {
  tora: { label: 'TORA', name: 'Take-off run available', color: 'a',
    def: 'The runway length declared available and suitable for the ground run of an aeroplane taking off.',
    note: 'Starts where the runway is usable for takeoff (an intersection takeoff shortens it) and ends at the far runway end. Operators also account for the distance used lining up.' },
  toda: { label: 'TODA', name: 'Take-off distance available', color: 'b',
    def: 'TORA plus the length of any clearway.',
    note: 'The airborne part of the takeoff, up to screen height, may continue over the clearway. Regulations limit how much clearway can be credited.' },
  asda: { label: 'ASDA', name: 'Accelerate-stop distance available', color: 'c',
    def: 'TORA plus the length of any stopway.',
    note: 'Used for the accelerate-stop case: accelerate to V1, then reject and stop. A stopway may only be used for stopping after a rejected takeoff.' },
  lda: { label: 'LDA', name: 'Landing distance available', color: 'd',
    def: 'The runway length declared available and suitable for the ground run of an aeroplane landing.',
    note: 'Measured from the landing threshold. A displaced threshold shortens the LDA, though that paved section usually stays available for takeoff and for rollout in the other direction.' },
};

const FEATURES = {
  stopway: 'Stopway: a prepared area beyond the end of the TORA, able to support the aeroplane during a rejected takeoff. Not for normal takeoff or landing. Typically marked with yellow chevrons.',
  clearway: 'Clearway: a defined area beyond the runway end, controlled by the airport, free of obstacles above a gently rising plane. The aeroplane may fly part of its initial climb over it. It needs no load-bearing surface (it can be grass or water).',
  displaced: 'Displaced threshold: the landing threshold is moved down the runway, for example because of approach obstacles. Arrows mark the displaced section; landing starts beyond the threshold bar.',
};

export function mountRunway(root) {
  const opts = { stopway: true, clearway: true, displaced: true };
  let focus = null;
  let pinned = null;

  root.innerHTML = `
    <div class="tr-perf-grid">
      <section class="tr-perf-card tr-perf-vis">
        <div class="tr-perf-cardhead">
          <h3 class="tr-perf-h3">Runway 09 · declared distances</h3>
          <div class="tr-perf-toggles">
            <label class="tr-perf-check"><input type="checkbox" data-opt="stopway" checked><span>Stopway</span></label>
            <label class="tr-perf-check"><input type="checkbox" data-opt="clearway" checked><span>Clearway</span></label>
            <label class="tr-perf-check"><input type="checkbox" data-opt="displaced" checked><span>Displaced threshold</span></label>
          </div>
        </div>
        <svg viewBox="0 0 1000 400" class="tr-perf-svg" role="img" aria-label="Runway plan view with declared distances"></svg>
        <div class="tr-perf-chips">
          ${Object.entries(DIST).map(([k, d]) => `<button type="button" class="tr-perf-chip c-${d.color}" data-dist="${k}"><b>${d.label}</b>${esc(d.name)}</button>`).join('')}
        </div>
      </section>
      <aside class="tr-perf-card tr-perf-info">
        <div class="tr-perf-info-body"></div>
      </aside>
    </div>`;

  const svg = root.querySelector('svg');
  const info = root.querySelector('.tr-perf-info-body');

  function geometry() {
    const rwA = 70, rwB = 740;
    return {
      rwA, rwB,
      thr: opts.displaced ? 190 : rwA,
      swB: opts.stopway ? 820 : rwB,
      cwB: opts.clearway ? 930 : rwB,
    };
  }

  function draw() {
    const G = geometry();
    svg.innerHTML = '';
    const Y0 = 70, H = 70, YC = Y0 + H / 2;
    svgEl('rect', { x: 0, y: 0, width: 1000, height: 400, class: 'tr-perf-bg' }, svg);
    svgEl('rect', { x: 0, y: Y0 - 40, width: 1000, height: H + 80, class: 'tr-perf-grass' }, svg);

    // Clearway (drawn first, wider than the runway)
    if (opts.clearway) {
      svgEl('rect', { x: G.rwB, y: Y0 - 28, width: G.cwB - G.rwB, height: H + 56, class: 'tr-perf-clearway', 'data-feat': 'clearway' }, svg);
      svgEl('text', { x: (G.rwB + G.cwB) / 2 + (opts.stopway ? 40 : 0), y: Y0 - 34, 'text-anchor': 'middle', class: 'tr-perf-feat' }, svg, 'CLEARWAY');
    }
    // Stopway
    if (opts.stopway) {
      svgEl('rect', { x: G.rwB, y: Y0, width: G.swB - G.rwB, height: H, class: 'tr-perf-stopway', 'data-feat': 'stopway' }, svg);
      for (let x = G.rwB + 10; x < G.swB - 10; x += 22) {
        svgEl('path', { d: `M${x},${Y0 + 12} L${x + 14},${YC} L${x},${Y0 + H - 12}`, class: 'tr-perf-chevron' }, svg);
      }
      svgEl('text', { x: (G.rwB + G.swB) / 2, y: Y0 + H + 20, 'text-anchor': 'middle', class: 'tr-perf-feat' }, svg, 'STOPWAY');
    }
    // Runway
    svgEl('rect', { x: G.rwA, y: Y0, width: G.rwB - G.rwA, height: H, class: 'tr-perf-rwy' }, svg);
    for (let x = G.thr + 70; x < G.rwB - 60; x += 38) svgEl('line', { x1: x, x2: x + 20, y1: YC, y2: YC, class: 'tr-perf-cl' }, svg);
    // Threshold piano keys
    for (let i = 0; i < 6; i++) {
      svgEl('rect', { x: G.thr + 6, y: Y0 + 6 + i * 10, width: 26, height: 5, class: 'tr-perf-mark' }, svg);
    }
    svgEl('text', { x: G.thr + 52, y: YC + 7, class: 'tr-perf-rwnum', transform: `rotate(90 ${G.thr + 52} ${YC})`, 'text-anchor': 'middle' }, svg, '09');
    // Displaced section arrows + threshold bar
    if (opts.displaced) {
      for (let x = G.rwA + 14; x < G.thr - 24; x += 34) {
        svgEl('path', { d: `M${x},${YC} L${x + 18},${YC} M${x + 12},${YC - 6} L${x + 20},${YC} L${x + 12},${YC + 6}`, class: 'tr-perf-arrowmark' }, svg);
      }
      svgEl('rect', { x: G.thr - 3, y: Y0, width: 4, height: H, class: 'tr-perf-mark' }, svg);
      svgEl('text', { x: (G.rwA + G.thr) / 2, y: Y0 - 8, 'text-anchor': 'middle', class: 'tr-perf-feat' }, svg, 'DISPLACED');
    }
    svgEl('rect', { x: G.rwB - 3, y: Y0, width: 3, height: H, class: 'tr-perf-mark' }, svg);
    svgEl('text', { x: G.rwB - 40, y: YC + 7, class: 'tr-perf-rwnum', transform: `rotate(-90 ${G.rwB - 40} ${YC})`, 'text-anchor': 'middle' }, svg, '27');

    // Direction of operation
    svgEl('path', { d: `M${G.rwA + 4},${Y0 + H + 28} l60,0 m-10,-6 l10,6 l-10,6`, class: 'tr-perf-dir' }, svg);
    svgEl('text', { x: G.rwA + 72, y: Y0 + H + 32, class: 'tr-perf-feat' }, svg, 'TAKEOFF & LANDING DIRECTION');

    // Highlight overlay for the focused distance
    const spans = { tora: [G.rwA, G.rwB], toda: [G.rwA, G.cwB], asda: [G.rwA, G.swB], lda: [G.thr, G.rwB] };
    if (focus) {
      const [a, b] = spans[focus];
      svgEl('rect', { x: a, y: Y0 - 30, width: b - a, height: H + 60, rx: 6, class: `tr-perf-hl c-${DIST[focus].color}` }, svg);
    }

    // Dimension lines
    const rows = [['tora', 200], ['toda', 245], ['asda', 290], ['lda', 335]];
    for (const [k, y] of rows) {
      const [a, b] = spans[k];
      const g = dimLine(svg, a, b, y, DIST[k].label, `c-${DIST[k].color}${focus && focus !== k ? ' is-dim' : ''}${focus === k ? ' is-on' : ''}`);
      g.dataset.dist = k;
      g.style.cursor = 'pointer';
      svgEl('line', { x1: a, x2: a, y1: Y0 + H, y2: y, class: 'tr-perf-leader' }, svg);
      svgEl('line', { x1: b, x2: b, y1: Y0 + H, y2: y, class: 'tr-perf-leader' }, svg);
    }
    svgEl('text', { x: 992, y: 392, 'text-anchor': 'end', class: 'tr-perf-ns' }, svg, 'PLAN VIEW · NOT TO SCALE');

    root.querySelectorAll('[data-dist].tr-perf-chip').forEach((b) => b.classList.toggle('is-on', b.dataset.dist === focus));
    renderInfo();
  }

  function renderInfo() {
    if (focus) {
      const d = DIST[focus];
      info.innerHTML = `
        <div class="tr-perf-kicker c-${d.color}">${d.label}</div>
        <h4 class="tr-perf-h4">${esc(d.name)}</h4>
        <p class="tr-perf-lead">${esc(d.def)}</p>
        <p>${esc(d.note)}</p>
        <button type="button" class="tr-perf-link" data-clear>Show all distances</button>`;
      return;
    }
    const active = Object.entries(opts).filter(([, v]) => v).map(([k]) => k);
    info.innerHTML = `
      <div class="tr-perf-kicker">Declared distances</div>
      <h4 class="tr-perf-h4">Four numbers, one runway</h4>
      <p class="tr-perf-lead">The aerodrome publishes these distances (in the AIP) for each runway direction. Performance calculations compare what the aeroplane <em>requires</em> against what is <em>available</em>.</p>
      <ul class="tr-perf-bullets">
        <li><b>Takeoff run</b> required ≤ TORA</li>
        <li><b>Takeoff distance</b> required ≤ TODA</li>
        <li><b>Accelerate-stop distance</b> required ≤ ASDA</li>
        <li><b>Landing distance</b> required ≤ LDA</li>
      </ul>
      ${active.map((k) => `<p class="tr-perf-feature">${esc(FEATURES[k])}</p>`).join('')}
      <p class="tr-perf-hint">Hover or tap a distance to highlight it. Toggle the features to see which distances change.</p>`;
  }

  // Events
  const onOver = (e) => {
    const g = e.target.closest('[data-dist]');
    if (g && g.dataset.dist !== focus) { focus = g.dataset.dist; draw(); }
  };
  svg.addEventListener('mouseover', onOver);
  const pin = (k) => { pinned = pinned === k ? null : k; focus = pinned; draw(); };
  svg.addEventListener('click', (e) => { const g = e.target.closest('[data-dist]'); if (g) pin(g.dataset.dist); });
  root.querySelector('.tr-perf-chips').addEventListener('mouseover', onOver);
  root.querySelector('.tr-perf-chips').addEventListener('click', (e) => { const b = e.target.closest('[data-dist]'); if (b) pin(b.dataset.dist); });
  root.querySelector('.tr-perf-vis').addEventListener('mouseleave', () => { if (focus !== pinned) { focus = pinned; draw(); } });
  info.addEventListener('click', (e) => { if (e.target.closest('[data-clear]')) { focus = pinned = null; draw(); } });
  root.querySelectorAll('[data-opt]').forEach((c) => c.addEventListener('change', () => { opts[c.dataset.opt] = c.checked; draw(); }));

  draw();
  return { unmount() {} };
}
