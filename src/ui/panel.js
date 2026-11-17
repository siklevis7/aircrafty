// Right-hand info panel for the selected component.
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function createPanel(root, { categories, parts, onClose, onSelect, onTry, getToggle }) {
  const catLabel = (id) => categories.find((c) => c.id === id)?.label || id;

  function show(id) {
    const p = parts.find((x) => x.id === id);
    if (!p) { hide(); return; }
    const siblings = parts.filter((x) => x.category === p.category);
    const i = siblings.indexOf(p);
    const prev = siblings[(i - 1 + siblings.length) % siblings.length];
    const next = siblings[(i + 1) % siblings.length];

    root.innerHTML = `
      <header class="info-head">
        <div class="info-eyebrow"><span class="chip">${esc(catLabel(p.category))}</span><span class="info-pos">${i + 1} / ${siblings.length}</span></div>
        <button class="icon-btn info-close" type="button" aria-label="Close panel" title="Close (Esc)">×</button>
        <h2 class="info-title">${esc(p.name)}</h2>
        <p class="info-where">${esc(p.where || '')}</p>
      </header>
      <div class="info-body">
        <section><h3>What it does</h3><p>${esc(p.what)}</p></section>
        <section><h3>How it works</h3><p>${esc(p.how)}</p></section>
        ${p.notes?.length ? `<section><h3>Study notes</h3><ul class="notes">${p.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></section>` : ''}
        ${p.tryIt?.length ? `<section><h3>Try it on the model</h3><div class="try">${p.tryIt.map((t, k) => `<button type="button" class="try-btn" data-k="${k}">${esc(t.label)}</button>`).join('')}</div></section>` : ''}
        ${p.review ? `<aside class="review"><strong>⚑ Pilot review pending</strong><span>${esc(p.review)}</span></aside>` : ''}
      </div>
      <footer class="info-foot">
        <button type="button" class="nav-btn" data-go="${prev.id}"><span aria-hidden="true">←</span> ${esc(prev.name)}</button>
        <button type="button" class="nav-btn nav-btn--next" data-go="${next.id}">${esc(next.name)} <span aria-hidden="true">→</span></button>
      </footer>`;

    root.querySelector('.info-close').addEventListener('click', onClose);
    root.querySelectorAll('.nav-btn').forEach((b) => b.addEventListener('click', () => onSelect(b.dataset.go)));
    root.querySelectorAll('.try-btn').forEach((b) => {
      const t = p.tryIt[+b.dataset.k];
      if (t.toggle) b.classList.toggle('is-on', !!getToggle(t.toggle));
      b.addEventListener('click', () => {
        onTry(t);
        if (t.toggle) b.classList.toggle('is-on', !!getToggle(t.toggle));
      });
    });
    root.classList.add('is-open');
    root.scrollTop = 0;
    root.querySelector('.info-body').scrollTop = 0;
  }

  function hide() { root.classList.remove('is-open'); }
  return { show, hide };
}
