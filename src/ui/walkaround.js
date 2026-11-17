// Guided exterior inspection: station checklist, camera "walk", route state and local progress.
import { store } from '../core/storage.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function createWalkaround(root, { data, parts, aircraftId, viewer, onOpenPart }) {
  const key = `${aircraftId}:walkaround`;
  const saved = store.get(key, {});
  const state = {
    current: Number.isInteger(saved.current) ? Math.min(saved.current, data.stations.length - 1) : 0,
    checked: saved.checked || {},
    started: saved.started || null,
  };
  const partName = (id) => parts.find((p) => p.id === id)?.name || id;
  const save = () => store.set(key, state);
  const totalItems = data.stations.reduce((n, s) => n + s.items.length, 0);
  const checkedOf = (s) => new Set(state.checked[s.id] || []);
  const isDone = (s) => checkedOf(s).size === s.items.length;
  const doneSet = () => new Set(data.stations.map((s, i) => (isDone(s) ? i : -1)).filter((i) => i >= 0));
  const allDone = () => data.stations.every(isDone);
  let active = false;

  // The camera stands behind the pilot's position (over-the-shoulder) so the area fills the view
  // without the screen turning into a wall of fuselage.
  const BACK = data.cameraBack ?? 1.8;
  function cameraFor(s) {
    const [x, z] = s.at;
    const eye = s.eye ?? 1.7;
    const [lx, ly, lz] = s.look;
    return {
      position: [lx + (x - lx) * BACK, Math.max(0.6, ly + (eye - ly) * BACK), lz + (z - lz) * BACK],
      target: s.look,
    };
  }

  function go(i, { instant = false } = {}) {
    state.current = Math.max(0, Math.min(data.stations.length - 1, i));
    if (!state.started) state.started = Date.now();
    save();
    const s = data.stations[state.current];
    const cam = cameraFor(s);
    const V = viewer.camera.position.constructor;
    const to = new V(...cam.position);
    const dist = viewer.camera.position.distanceTo(to);
    viewer.flyTo(to, new V(...cam.target), instant ? 0.01 : Math.min(2.4, 1.1 + dist / 25), { arc: dist > 10 ? Math.min(8, dist / 4) : 0 });
    viewer.setHighlightSet(s.parts);
    viewer.setMarkerFilter((id) => s.parts.includes(id));
    render();
  }

  function toggle(itemIndex) {
    const s = data.stations[state.current];
    const set = checkedOf(s);
    if (set.has(itemIndex)) set.delete(itemIndex); else set.add(itemIndex);
    state.checked[s.id] = [...set];
    save();
    render();
  }

  function checkAllAndNext() {
    const s = data.stations[state.current];
    state.checked[s.id] = s.items.map((_, i) => i);
    save();
    if (state.current < data.stations.length - 1) go(state.current + 1); else render();
  }

  function restart() {
    state.checked = {};
    state.started = Date.now();
    save();
    go(0);
  }

  function render() {
    if (!active) return;
    const s = data.stations[state.current];
    const checked = checkedOf(s);
    const nChecked = Object.values(state.checked).reduce((n, a) => n + a.length, 0);
    const done = doneSet();
    const next = data.stations[state.current + 1];
    const prev = data.stations[state.current - 1];
    const finished = allDone();
    viewer.setRouteState(state.current, done);

    root.innerHTML = `
      <div class="walk-head">
        <div class="eyebrow">${esc(data.title)}</div>
        <div class="walk-progress"><b>${done.size}</b> of ${data.stations.length} stops · <b>${nChecked}</b>/${totalItems} checks</div>
        <div class="progress-bar"><i style="width:${(nChecked / totalItems) * 100}%"></i></div>
      </div>
      <div class="walk-body">
        ${finished ? `
          <section class="walk-done">
            <div class="walk-done-mark" aria-hidden="true">✓</div>
            <h2>Walkaround complete</h2>
            <p>All ${data.stations.length} stops and ${totalItems} checks are done.</p>
            <button type="button" class="walk-btn walk-btn--primary" data-act="restart">Start a new walkaround</button>
          </section>` : ''}
        <section class="walk-card">
          <div class="walk-step"><span class="walk-num">${state.current + 1}</span> Stop ${state.current + 1} of ${data.stations.length}</div>
          <h2 class="walk-title">${esc(s.title)}</h2>
          <ul class="walk-items">
            ${s.items.map((t, i) => `
              <li><label class="walk-item${checked.has(i) ? ' is-checked' : ''}">
                <input type="checkbox" data-item="${i}" ${checked.has(i) ? 'checked' : ''}>
                <span class="walk-box" aria-hidden="true"></span><span>${esc(t)}</span>
              </label></li>`).join('')}
          </ul>
          <div class="walk-parts">
            <span class="walk-parts-label">On the model</span>
            ${s.parts.map((id) => `<button type="button" class="chip-btn" data-part="${id}">${esc(partName(id))}</button>`).join('')}
          </div>
          <div class="walk-nav">
            <button type="button" class="walk-btn" data-act="prev" ${prev ? '' : 'disabled'} aria-label="Previous stop">←</button>
            ${next
              ? `<button type="button" class="walk-btn walk-btn--primary" data-act="ok">${checked.size === s.items.length ? 'Next' : 'Checked'}: ${esc(next.title)} →</button>`
              : `<button type="button" class="walk-btn walk-btn--primary" data-act="ok">${finished ? 'Done' : 'Checked: finish walkaround'}</button>`}
          </div>
        </section>
        <ol class="walk-list">
          ${data.stations.map((st, i) => `
            <li><button type="button" class="walk-stop${i === state.current ? ' is-current' : ''}${done.has(i) ? ' is-done' : ''}" data-go="${i}">
              <span class="walk-stop-num">${done.has(i) ? '✓' : i + 1}</span><span>${esc(st.title)}</span>
            </button></li>`).join('')}
        </ol>
        <p class="walk-note">${esc(data.disclaimer)}</p>
        <button type="button" class="walk-link" data-act="restart">Reset progress</button>
      </div>`;

    root.querySelectorAll('[data-item]').forEach((el) => el.addEventListener('change', () => toggle(+el.dataset.item)));
    root.querySelectorAll('[data-part]').forEach((el) => el.addEventListener('click', () => onOpenPart(el.dataset.part)));
    root.querySelectorAll('[data-go]').forEach((el) => el.addEventListener('click', () => go(+el.dataset.go)));
    root.querySelector('[data-act="prev"]')?.addEventListener('click', () => go(state.current - 1));
    root.querySelector('[data-act="ok"]')?.addEventListener('click', checkAllAndNext);
    root.querySelectorAll('[data-act="restart"]').forEach((el) => el.addEventListener('click', restart));
    root.querySelector('.walk-stop.is-current')?.scrollIntoView({ block: 'nearest' });
  }

  return {
    start() {
      active = true;
      root.hidden = false;
      viewer.setFov(52);
      viewer.setRoute(data.stations.map((s) => s.at), { onPick: (i) => go(i) });
      go(state.current);
    },
    stop() {
      active = false;
      root.hidden = true;
      viewer.setFov(38);
      viewer.clearRoute();
      viewer.setHighlightSet([]);
    },
    next() { go(state.current + 1); },
    prev() { go(state.current - 1); },
    get active() { return active; },
  };
}
