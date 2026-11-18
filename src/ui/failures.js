// Failures mode: pick a scenario, inject it into the shared systems logic and watch the
// effects live on the schematics and in the flight deck. Failures persist until cleared.
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function createFailures(root, { scenarios, normal, labels, systems, showSystem, openFlightDeck, onWarn, onInject }) {
  let activeId = null;
  let shown = false;
  let lastSig = '';
  const failKeys = () => Object.keys(systems.state).filter((k) => k.startsWith('fail.'));

  function clearFlags() { failKeys().forEach((k) => systems.set(k, false)); }

  function apply(sc) {
    clearFlags();
    // a clean, normal aircraft first: on the ground stowed and closed, then normal switch positions
    systems.set('reversers', false);
    systems.set('doors', false);
    systems.set('speedbrake', 'DOWN');
    ['roll', 'pitch', 'yaw'].forEach((k) => systems.set(k, 0));
    let r = systems.apply(normal);
    // setup is either one settings object (snapped into place) or a list of steps, where
    // 'settle' snaps the gear/flaps and later steps play out live (e.g. gear retracting)
    const steps = Array.isArray(sc.setup) ? sc.setup : [sc.setup, 'settle'];
    for (const step of steps) {
      if (!r.ok) break;
      if (step === 'settle') systems.settle();
      else r = systems.apply(step);
    }
    if (!r.ok) { onWarn?.(r.message); return; }
    onInject?.(); // the clean in-flight state is "normal": cautions from here on are new
    sc.flags.forEach((f) => systems.set(f, true));
    activeId = sc.id;
    showSystem(sc.system);
    lastSig = '';
    render();
  }

  function clear() {
    clearFlags();
    activeId = null;
    lastSig = '';
    render();
  }

  function liveData() {
    const p = systems.panel();
    const c = { ...p, s: systems.state };
    const lights = Object.entries(p.ann).filter(([, on]) => on).map(([k]) => labels[k]).filter(Boolean);
    const sc = scenarios.find((s) => s.id === activeId);
    return { cats: [...p.cats], lights, effects: sc ? sc.effects(c) : [] };
  }

  function render() {
    if (!shown) return;
    const sc = scenarios.find((s) => s.id === activeId);
    const d = liveData();
    lastSig = JSON.stringify(d);
    const groups = [...new Set(scenarios.map((s) => s.group))];
    root.innerHTML = `
      <div class="walk-head">
        <div class="eyebrow">Failures</div>
        <div class="walk-progress">${sc ? `<b>Active:</b> ${esc(sc.title)}` : 'Pick a failure to inject it into the aircraft systems.'}</div>
      </div>
      <div class="walk-body">
        ${sc ? `
          <section class="walk-card fail-card">
            <div class="walk-step"><span class="fail-dot" aria-hidden="true"></span>${esc(sc.group)} failure</div>
            <h2 class="walk-title">${esc(sc.title)}</h2>
            <p class="fail-summary">${esc(sc.summary)}</p>
            <h3 class="fail-sub">Indications now</h3>
            <div class="fail-lights">
              ${d.cats.length ? `<span class="fail-light fail-light--mc">MASTER CAUTION</span>${d.cats.map((k) => `<span class="fail-light fail-light--amber">${esc(k)}</span>`).join('')}` : ''}
              ${d.lights.map(([t, col]) => `<span class="fail-light fail-light--${col}">${esc(t)}</span>`).join('') || '<span class="fail-none">No caution lights</span>'}
            </div>
            <h3 class="fail-sub">Effects (live)</h3>
            <ul class="fail-effects">
              ${d.effects.map((e) => `<li class="is-${e.state}"><span class="fail-ico" aria-hidden="true">${e.state === 'ok' ? '✓' : e.state === 'lost' ? '✕' : 'i'}</span><span>${esc(e.text)}</span></li>`).join('')}
            </ul>
            <h3 class="fail-sub">Things to know</h3>
            <ul class="notes">${sc.know.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
            <div class="walk-nav fail-actions">
              <button type="button" class="walk-btn walk-btn--primary" data-act="deck">See it in the flight deck →</button>
              <button type="button" class="walk-btn" data-act="clear">Clear</button>
            </div>
          </section>` : ''}
        ${groups.map((g) => `
          <h3 class="fail-group">${esc(g)}</h3>
          <div class="fail-list">
            ${scenarios.filter((s) => s.group === g).map((s) => `
              <button type="button" class="fail-item${s.id === activeId ? ' is-active' : ''}" data-id="${s.id}">
                <span class="fail-item-dot" aria-hidden="true"></span><span>${esc(s.title)}</span>
              </button>`).join('')}
          </div>`).join('')}
        <p class="walk-note">Failures stay active in every mode until you clear them. Effects come from a simplified study model. Always use your QRH and FCOM.</p>
      </div>`;
    root.querySelectorAll('[data-id]').forEach((b) => b.addEventListener('click', () => apply(scenarios.find((s) => s.id === b.dataset.id))));
    root.querySelector('[data-act="clear"]')?.addEventListener('click', clear);
    root.querySelector('[data-act="deck"]')?.addEventListener('click', openFlightDeck);
  }

  return {
    start() {
      shown = true;
      root.hidden = false;
      const sc = scenarios.find((s) => s.id === activeId);
      if (sc) showSystem(sc.system);
      render();
    },
    stop() { shown = false; root.hidden = true; },
    tick() {
      if (!shown) return;
      if (JSON.stringify(liveData()) !== lastSig) render();
    },
    anyActive: () => failKeys().some((k) => systems.state[k]),
  };
}
