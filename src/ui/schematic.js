// Generic animated system schematic renderer (SVG). Aircraft-agnostic: each system is
// declared as nodes + lines with live predicates evaluated against systems.panel().
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function createSchematicView(root, { schematics, scenario = [], systems, onSelect, onWarn }) {
  let current = schematics[0];
  let svg, nodeEls = [], lineEls = [], lastSig = '';
  let highlighted = null;

  root.innerHTML = `
    <div class="schem-head">
      <div class="schem-tabs" role="tablist" aria-label="Systems">
        ${schematics.map((s) => `<button type="button" role="tab" class="schem-tab" data-sys="${s.id}">${esc(s.title)}</button>`).join('')}
      </div>
      <div class="schem-scenario">
        ${scenario.map((g) => `
          <div class="scn"><span class="scn-label">${esc(g.label)}</span><div class="scn-opts">
            ${g.options.map((o, i) => `<button type="button" class="scn-btn" data-key="${g.key}" data-i="${i}">${esc(o.label)}</button>`).join('')}
          </div></div>`).join('')}
      </div>
    </div>
    <p class="schem-intro"></p>
    <div class="schem-canvas"></div>
    <div class="schem-legend">
      <span><i class="lg lg-live"></i>Flow / powered</span>
      <span><i class="lg lg-dead"></i>No flow</span>
      <span><i class="lg lg-ctrl"></i>Click to operate</span>
      <span class="schem-note">Simplified study model: who powers what is accurate, pressures and quantities aren't simulated.</span>
    </div>`;
  const canvas = root.querySelector('.schem-canvas');
  const intro = root.querySelector('.schem-intro');

  root.querySelectorAll('.schem-tab').forEach((b) => b.addEventListener('click', () => setSystem(b.dataset.sys)));
  root.querySelectorAll('.scn-btn').forEach((b) => b.addEventListener('click', () => {
    const g = scenario.find((x) => x.key === b.dataset.key);
    const r = systems.set(g.key, g.options[+b.dataset.i].value);
    if (!r.ok) onWarn?.(r.message);
    lastSig = '';
  }));

  const zoneOf = (sys, x, override) => {
    if (sys.color !== 'hyd') return sys.color;
    if (override) return `hyd-${override}`;
    return x < 400 ? 'hyd-a' : x > 600 ? 'hyd-b' : 'hyd-s';
  };

  function build() {
    canvas.innerHTML = '';
    svg = el('svg', { viewBox: '0 0 1000 640', class: `schem-svg sys-${current.color}`, role: 'img', 'aria-label': `${current.title} schematic` }, canvas);
    const gLines = el('g', { class: 'lines' }, svg);
    const gNodes = el('g', { class: 'nodes' }, svg);
    lineEls = current.lines.map((ln) => {
      const d = ln.pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
      const p = el('path', { d, class: `ln z-${zoneOf(current, ln.pts[0][0], ln.sys)}${ln.kind ? ` ln-${ln.kind}` : ''}` }, gLines);
      return { ln, p };
    });
    nodeEls = current.nodes.map((n) => {
      const g = el('g', { class: `nd nd-${n.kind} z-${zoneOf(current, n.x + (n.w || 0) / 2)}${n.control ? ' is-ctrl' : ''}${n.part ? ' has-part' : ''}`, 'data-id': n.id }, gNodes);
      if (n.part) g.dataset.part = n.part;
      const title = el('title', {}, g);
      title.textContent = n.control ? `${n.label.replace(/\n/g, ' ')} · click to operate` : `${n.label.replace(/\n/g, ' ')} · click for details`;
      const parts = {};
      if (n.kind === 'tank') {
        el('rect', { x: n.x, y: n.y, width: n.w, height: n.h, rx: 10, class: 'shape' }, g);
        parts.label = el('text', { x: n.x + 12, y: n.y + 20, class: 'lbl' }, g);
        if (n.sub) { const t = el('text', { x: n.x + n.w - 12, y: n.y + 20, class: 'sub end' }, g); t.textContent = n.sub; }
        if (n.status) parts.status = el('text', { x: n.x + 12, y: n.y + n.h - 8, class: 'st st-alert' }, g);
      } else if (n.kind === 'pump') {
        const r = n.r || 30;
        el('circle', { cx: n.x, cy: n.y, r, class: 'shape' }, g);
        el('path', { d: `M${n.x - r * 0.45} ${n.y + r * 0.35} L${n.x} ${n.y - r * 0.5} L${n.x + r * 0.45} ${n.y + r * 0.35} Z`, class: 'icon' }, g);
        parts.label = el('text', { x: n.x, y: n.y + r + 16, class: 'lbl mid' }, g);
        parts.status = el('text', { x: n.x, y: n.y + r + 30, class: 'st mid' }, g);
      } else if (n.kind === 'valve') {
        el('circle', { cx: n.x, cy: n.y, r: 20, class: 'shape' }, g);
        parts.bar = el('line', { class: 'bar' }, g);
        parts.label = el('text', { x: n.x + 28, y: n.y - 6, class: 'lbl' }, g);
        parts.status = el('text', { x: n.x + 28, y: n.y + 10, class: 'st' }, g);
      } else if (n.kind === 'bus') {
        el('rect', { x: n.x, y: n.y, width: n.w, height: n.h || 12, rx: 3, class: 'shape' }, g);
        parts.label = el('text', { x: n.x + 4, y: n.y - 7, class: 'lbl' }, g);
      } else if (n.kind === 'label') {
        parts.label = el('text', { x: n.x, y: n.y, class: 'lbl faint' }, g);
      } else {
        el('rect', { x: n.x, y: n.y, width: n.w, height: n.h, rx: n.kind === 'annun' ? 4 : 8, class: 'shape' }, g);
        parts.label = el('text', { x: n.x + 10, y: n.y + (n.h > 40 ? 20 : n.h / 2 + 4), class: `lbl${n.kind === 'annun' ? ' mid' : ''}` }, g);
        if (n.kind === 'annun') parts.label.setAttribute('x', n.x + n.w / 2);
        if (n.status || n.control) parts.status = el('text', { x: n.x + n.w - 10, y: n.y + (n.h > 40 ? n.h - 12 : n.h / 2 + 4), class: 'st end' }, g);
      }
      parts.label.textContent = n.label;
      g.addEventListener('click', () => clickNode(n));
      return { n, g, parts };
    });
    root.querySelectorAll('.schem-tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.sys === current.id)));
    intro.textContent = current.intro;
    lastSig = '';
    if (highlighted) applyHighlight();
  }

  function clickNode(n) {
    if (n.control) {
      const c = n.control;
      let r;
      if (c.type === 'toggle') r = systems.set(c.key, !systems.get(c.key));
      else if (c.type === 'cycle') {
        const i = c.values.indexOf(systems.get(c.key));
        r = systems.set(c.key, c.values[(i + 1) % c.values.length]);
      } else r = systems.set(c.key, true);
      if (r && !r.ok) onWarn?.(r.message);
      lastSig = '';
      return;
    }
    if (n.part) onSelect?.(n.part);
  }

  function update() {
    const c = { ...systems.panel(), s: systems.state };
    const lineStates = lineEls.map(({ ln }) => !!ln.live(c));
    const nodeStates = nodeEls.map(({ n }) => {
      const on = !!n.active?.(c);
      let status = n.status ? n.status(c) : '';
      if (n.control && !n.status) {
        const v = systems.get(n.control.key);
        if (n.control.type === 'toggle') status = v ? (n.control.on || 'ON') : (n.control.off || 'OFF');
        else if (n.control.type === 'cycle') status = v;
      }
      return [on, status];
    });
    const scn = scenario.map((g) => systems.get(g.key));
    const sig = JSON.stringify([lineStates, nodeStates, scn]);
    if (sig === lastSig) return;
    lastSig = sig;
    lineEls.forEach(({ p }, i) => p.classList.toggle('is-live', lineStates[i]));
    nodeEls.forEach(({ n, g, parts }, i) => {
      const [on, status] = nodeStates[i];
      g.classList.toggle('is-on', on);
      if (parts.status) parts.status.textContent = status;
      if (parts.bar) {
        const open = on;
        const horiz = (n.orient === 'h') === open;
        const len = 15;
        parts.bar.setAttribute('x1', horiz ? n.x - len : n.x);
        parts.bar.setAttribute('x2', horiz ? n.x + len : n.x);
        parts.bar.setAttribute('y1', horiz ? n.y : n.y - len);
        parts.bar.setAttribute('y2', horiz ? n.y : n.y + len);
      }
    });
    root.querySelectorAll('.scn-btn').forEach((b) => {
      const g = scenario.find((x) => x.key === b.dataset.key);
      b.classList.toggle('is-on', systems.get(g.key) === g.options[+b.dataset.i].value);
    });
  }

  function applyHighlight() {
    nodeEls.forEach(({ g, n }) => g.classList.toggle('is-hl', !!highlighted && n.part === highlighted));
  }

  function setSystem(id) {
    const next = schematics.find((s) => s.id === id);
    if (!next) return;
    current = next;
    build();
    update();
  }

  build();
  return {
    tick: () => { if (!root.hidden) update(); },
    setSystem,
    highlight(partId) {
      highlighted = partId;
      if (partId && !current.nodes.some((n) => n.part === partId)) {
        const sys = schematics.find((s) => s.nodes.some((n) => n.part === partId));
        if (sys) { setSystem(sys.id); return; }
      }
      applyHighlight();
    },
    get current() { return current.id; },
  };
}
