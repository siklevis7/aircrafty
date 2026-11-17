// Left sidebar: searchable component index grouped by category.
export function createIndex(root, { categories, parts, progress, onSelect, onFilter }) {
  let query = '';
  let selected = null;
  const collapsed = new Set();

  const matches = (p) => {
    if (!query) return true;
    const hay = `${p.name} ${p.where} ${p.what}`.toLowerCase();
    return query.split(/\s+/).every((w) => hay.includes(w));
  };

  function render() {
    const frag = document.createDocumentFragment();
    let any = false;
    for (const cat of categories) {
      const items = parts.filter((p) => p.category === cat.id && matches(p));
      if (!items.length) continue;
      any = true;
      const seen = items.filter((p) => progress.has(p.id)).length;
      const group = document.createElement('section');
      group.className = 'idx-group';
      const open = query || !collapsed.has(cat.id);
      group.innerHTML = `
        <button class="idx-head" type="button" aria-expanded="${open}">
          <span class="idx-chev" aria-hidden="true"></span>
          <span class="idx-title">${cat.label}</span>
          <span class="idx-count">${seen}/${items.length}</span>
        </button>`;
      group.querySelector('.idx-head').addEventListener('click', () => {
        if (collapsed.has(cat.id)) collapsed.delete(cat.id); else collapsed.add(cat.id);
        render();
      });
      if (open) {
        const ul = document.createElement('ul');
        ul.className = 'idx-list';
        for (const p of items) {
          const li = document.createElement('li');
          li.innerHTML = `<button type="button" class="idx-item${p.id === selected ? ' is-selected' : ''}${progress.has(p.id) ? ' is-seen' : ''}" data-id="${p.id}">
              <span class="idx-dot" aria-hidden="true"></span><span class="idx-name"></span>${p.review ? '<span class="idx-flag" title="Needs pilot review">⚑</span>' : ''}
            </button>`;
          li.querySelector('.idx-name').textContent = p.name;
          li.firstChild.addEventListener('click', () => onSelect(p.id));
          ul.appendChild(li);
        }
        group.appendChild(ul);
      }
      frag.appendChild(group);
    }
    root.innerHTML = '';
    if (!any) {
      root.innerHTML = '<p class="idx-empty">No components match that search.</p>';
    } else root.appendChild(frag);
    onFilter?.((id) => {
      const p = parts.find((x) => x.id === id);
      return p ? matches(p) : true;
    });
  }

  render();
  return {
    setQuery(q) { query = q.trim().toLowerCase(); render(); },
    setSelected(id) {
      selected = id;
      root.querySelectorAll('.idx-item').forEach((b) => b.classList.toggle('is-selected', b.dataset.id === id));
      root.querySelector('.idx-item.is-selected')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    },
    refresh: render,
  };
}
