// Shared helpers for the Performance concepts trainer (SVG building, escaping, small maths).
export const SVGNS = 'http://www.w3.org/2000/svg';

export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, u) => a + (b - a) * u;

export function svgEl(tag, attrs = {}, parent, text) {
  const n = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) n.setAttribute(k, v);
  if (text !== undefined) n.textContent = text;
  if (parent) parent.appendChild(n);
  return n;
}

// Horizontal dimension line with end ticks and a centred label.
export function dimLine(parent, x1, x2, y, label, cls = '') {
  const g = svgEl('g', { class: `tr-perf-dim ${cls}` }, parent);
  svgEl('line', { x1, x2, y1: y, y2: y, class: 'dim-line' }, g);
  svgEl('line', { x1, x2: x1, y1: y - 7, y2: y + 7, class: 'dim-tick' }, g);
  svgEl('line', { x1: x2, x2, y1: y - 7, y2: y + 7, class: 'dim-tick' }, g);
  const w = label.length * 8 + 16;
  const cx = (x1 + x2) / 2;
  svgEl('rect', { x: cx - w / 2, y: y - 10, width: w, height: 20, rx: 4, class: 'dim-pill' }, g);
  svgEl('text', { x: cx, y: y + 4.5, 'text-anchor': 'middle', class: 'dim-text' }, g, label);
  return g;
}

// A labelled range input row. Returns the <input>.
export function sliderHTML({ id, label, min = 0, max = 100, step = 1, value = 50, left = '', right = '' }) {
  return `
    <label class="tr-perf-slider">
      <span class="tr-perf-slider-top"><b>${esc(label)}</b><output data-out="${id}"></output></span>
      <input type="range" data-in="${id}" min="${min}" max="${max}" step="${step}" value="${value}">
      <span class="tr-perf-slider-ends"><span>${esc(left)}</span><span>${esc(right)}</span></span>
    </label>`;
}

export function segHTML(id, options, value) {
  return `<div class="tr-perf-seg" role="group" data-seg="${id}">
    ${options.map(([v, l]) => `<button type="button" data-v="${esc(v)}" class="${String(v) === String(value) ? 'is-on' : ''}">${esc(l)}</button>`).join('')}
  </div>`;
}

// Wire a segmented control: calls fn(value) on change.
export function bindSeg(root, id, fn) {
  const seg = root.querySelector(`[data-seg="${id}"]`);
  seg.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-v]');
    if (!b) return;
    seg.querySelectorAll('button').forEach((x) => x.classList.toggle('is-on', x === b));
    fn(b.dataset.v);
  });
}

export const CONCEPT_NOTE = 'Conceptual illustration only: shapes and proportions are qualitative. Never use for real performance calculations. Use your operator\'s approved performance data, EFB tools and FCOM/FPPM.';
