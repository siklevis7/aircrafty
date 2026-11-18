// Training mode shell: lists trainer modules in the sidebar and mounts the chosen one
// into the full-stage area. Each trainer is { id, title, group, summary, mount(el, ctx) }.
import { store } from '../core/storage.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function createTraining(sidebar, stage, { trainers, ctx, aircraftId }) {
  const key = `${aircraftId}:training`;
  let currentId = store.get(key, trainers[0]?.id);
  let mounted = null;
  let shown = false;

  function renderList() {
    const groups = [...new Set(trainers.map((t) => t.group || 'Training'))];
    sidebar.innerHTML = `
      <div class="walk-head">
        <div class="eyebrow">Training</div>
        <div class="walk-progress">Interactive trainers for the topics that trip people up.</div>
      </div>
      <div class="walk-body">
        ${groups.map((g) => `
          <h3 class="fail-group">${esc(g)}</h3>
          <div class="fail-list">
            ${trainers.filter((t) => (t.group || 'Training') === g).map((t) => `
              <button type="button" class="train-item${t.id === currentId ? ' is-active' : ''}" data-id="${t.id}">
                <b>${esc(t.title)}</b><span>${esc(t.summary || '')}</span>
              </button>`).join('')}
          </div>`).join('')}
        <p class="walk-note">Generic study material. Your operator's FCOM, FCTM and QRH take precedence.</p>
      </div>`;
    sidebar.querySelectorAll('[data-id]').forEach((b) => b.addEventListener('click', () => open(b.dataset.id)));
  }

  function open(id) {
    const t = trainers.find((x) => x.id === id) || trainers[0];
    if (!t) return;
    mounted?.unmount?.();
    mounted = null;
    currentId = t.id;
    store.set(key, currentId);
    stage.innerHTML = '';
    const host = document.createElement('div');
    host.className = 'trainer-host';
    host.dataset.trainer = t.id;
    stage.appendChild(host);
    try {
      mounted = t.mount(host, ctx) || null;
    } catch (err) {
      console.error(err);
      host.innerHTML = `<p class="trainer-error">This trainer failed to load: ${esc(err.message)}</p>`;
    }
    renderList();
  }

  return {
    start() {
      shown = true;
      sidebar.hidden = false;
      stage.hidden = false;
      renderList();
      if (!mounted) open(currentId);
    },
    stop() {
      shown = false;
      sidebar.hidden = true;
      stage.hidden = true;
      mounted?.unmount?.();
      mounted = null;
      stage.innerHTML = '';
    },
    tick(dt) { if (shown) mounted?.tick?.(dt); },
    open,
  };
}
