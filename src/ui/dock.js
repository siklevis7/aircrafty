// Bottom control dock rendered from an aircraft's controlPanel schema.
import { toast } from './toast.js';

export function createDock(root, { schema, systems }) {
  const syncers = [];
  const annEls = new Map();
  const readoutEls = [];

  const attempt = (key, value) => {
    const r = systems.set(key, value);
    if (!r.ok) toast(r.message, 'warn');
  };

  const body = document.createElement('div');
  body.className = 'dock-body';

  for (const group of schema) {
    const mod = document.createElement('section');
    mod.className = `dock-mod dock-mod--${group.id}`;
    mod.innerHTML = `<h4 class="dock-title">${group.title}</h4><div class="dock-items"></div>`;
    const items = mod.querySelector('.dock-items');

    for (const it of group.items) {
      if (it.type === 'segmented' || it.type === 'detent') {
        const wrap = document.createElement('div');
        wrap.className = `seg ${it.vertical ? 'seg--v' : ''} ${it.type === 'detent' ? 'seg--detent' : ''}`;
        wrap.setAttribute('role', 'radiogroup');
        wrap.setAttribute('aria-label', group.title);
        for (const o of it.options) {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'seg-btn';
          b.textContent = o.label;
          b.setAttribute('role', 'radio');
          b.addEventListener('click', () => attempt(it.key, o.value));
          wrap.appendChild(b);
          syncers.push(() => {
            const on = systems.get(it.key) === o.value;
            b.classList.toggle('is-on', on);
            b.setAttribute('aria-checked', on);
          });
        }
        items.appendChild(wrap);
      } else if (it.type === 'readout') {
        const el = document.createElement('div');
        el.className = 'readout';
        el.innerHTML = `<span class="readout-label">${it.label}</span><span class="readout-val">—</span>`;
        items.appendChild(el);
        readoutEls.push([el.lastChild, it.key]);
      } else if (it.type === 'slider') {
        const el = document.createElement('label');
        el.className = 'slider';
        el.innerHTML = `
          <span class="slider-top"><span class="slider-label">${it.label}</span><span class="slider-val"></span></span>
          <input type="range" min="${it.min}" max="${it.max}" step="${it.step}">
          <span class="slider-ends"><span>${it.ends[0]}</span><span>${it.ends[1]}</span></span>`;
        const input = el.querySelector('input');
        const val = el.querySelector('.slider-val');
        input.addEventListener('input', () => attempt(it.key, Number(input.value)));
        input.addEventListener('dblclick', () => attempt(it.key, it.center));
        el.title = 'Double-click to center';
        items.appendChild(el);
        syncers.push(() => { input.value = systems.get(it.key); });
        if (it.readout) readoutEls.push([val, it.readout]);
        else syncers.push(() => { val.textContent = `${Math.round(systems.get(it.key) * 100)}%`; });
      } else if (it.type === 'toggle') {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'switch';
        b.innerHTML = `<span class="switch-track" aria-hidden="true"><span class="switch-knob"></span></span><span class="switch-label">${it.label}</span>`;
        b.addEventListener('click', () => attempt(it.key, !systems.get(it.key)));
        items.appendChild(b);
        syncers.push(() => {
          const on = !!systems.get(it.key);
          b.classList.toggle('is-on', on);
          b.setAttribute('aria-pressed', on);
        });
      }
    }

    if (group.annunciators?.length) {
      const ann = document.createElement('div');
      ann.className = 'ann-row';
      for (const id of group.annunciators) {
        const a = document.createElement('div');
        a.className = 'ann';
        ann.appendChild(a);
        annEls.set(id, a);
      }
      mod.appendChild(ann);
    }
    body.appendChild(mod);
  }

  const head = document.createElement('button');
  head.type = 'button';
  head.className = 'dock-handle';
  head.innerHTML = '<span>Controls</span><span class="dock-chev" aria-hidden="true"></span>';
  head.setAttribute('aria-expanded', 'true');
  head.addEventListener('click', () => {
    const collapsed = root.classList.toggle('is-collapsed');
    head.setAttribute('aria-expanded', String(!collapsed));
  });
  root.append(head, body);

  const sync = () => syncers.forEach((f) => f());
  systems.subscribe((msg) => {
    if (msg.type === 'info') toast(msg.message, 'info');
    sync();
  });
  sync();

  let last = '';
  return {
    sync,
    tick() {
      for (const [el, key] of readoutEls) {
        const v = systems.readout(key);
        if (el.textContent !== v) el.textContent = v;
      }
      const anns = systems.annunciators();
      const sig = JSON.stringify(anns);
      if (sig === last) return;
      last = sig;
      annEls.forEach((el, id) => {
        const a = anns[id];
        if (!a) return;
        el.textContent = a.label;
        el.dataset.state = a.state;
      });
    },
  };
}
