import './styles.css';
import { Viewer } from './core/viewer.js';
import { store, createProgress } from './core/storage.js';
import { aircraftRegistry, getAircraft } from './aircraft/registry.js';
import { createIndex } from './ui/partsIndex.js';
import { createPanel } from './ui/panel.js';
import { createDock } from './ui/dock.js';
import { toast } from './ui/toast.js';

const $ = (s) => document.querySelector(s);

const SCENE_THEMES = {
  light: { fog: '#e7e9e3', gridMajor: '#a3abb2', gridMinor: '#cdd2d5', gridOpacity: 0.6, shadow: 0.2, accent: '#e4572e', hover: '#1673b8', exposure: 1.0 },
  dark: { fog: '#0c1117', gridMajor: '#2b3c4b', gridMinor: '#17222c', gridOpacity: 0.85, shadow: 0.5, accent: '#ffad33', hover: '#3cc8ff', exposure: 0.92 },
};

// ---------------------------------------------------------------- theme
const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
const currentTheme = () => document.documentElement.dataset.theme || (systemDark.matches ? 'dark' : 'light');
let viewer;
function applySceneTheme() { viewer?.setTheme(SCENE_THEMES[currentTheme()]); }
$('#theme-toggle').addEventListener('click', () => {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  store.set('theme', next);
  applySceneTheme();
});
systemDark.addEventListener('change', applySceneTheme);

// ---------------------------------------------------------------- boot
async function boot() {
  if (window.innerWidth <= 820) document.body.classList.add('sidebar-collapsed');
  const select = $('#aircraft');
  aircraftRegistry.forEach((a) => select.add(new Option(a.name, a.id)));
  const more = new Option('More aircraft coming…', '');
  more.disabled = true;
  select.add(more);
  const acId = store.get('aircraft', 'b738');
  select.value = getAircraft(acId).id;

  const ac = await getAircraft(acId).load();
  const progress = createProgress(ac.meta.id);
  const { parts, categories } = ac;

  $('#ac-family').textContent = ac.meta.family;
  $('#ac-name').textContent = ac.meta.name;
  $('#specs').innerHTML = ac.meta.specs.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');

  let selected = null;
  const select3d = (id, opts = {}) => {
    selected = id;
    viewer.select(id, opts);
    index.setSelected(id);
    if (id) {
      panel.show(id);
      if (progress.add(id)) { index.refresh(); updateProgress(); }
    } else panel.hide();
    document.body.classList.toggle('has-selection', !!id);
    updateInsets();
  };
  const updateInsets = () => {
    const wide = window.innerWidth > 820;
    const right = selected && wide ? $('#info').offsetWidth + 32 : 0;
    const bottom = $('#dock').offsetHeight * 0.85;
    viewer?.setInsets({ right, bottom });
  };
  window.addEventListener('resize', updateInsets);

  viewer = new Viewer($('#stage'), { onSelect: (id) => select3d(id) });
  const { root, systems } = ac.build();
  viewer.load(root, parts, ac.camera);
  applySceneTheme();

  const index = createIndex($('#index'), {
    categories, parts, progress,
    onSelect: (id) => select3d(id),
    onFilter: (fn) => viewer.setMarkerFilter(fn),
  });
  const panel = createPanel($('#info'), {
    categories, parts,
    onClose: () => select3d(null),
    onSelect: (id) => select3d(id),
    onTry: (t) => {
      const r = t.toggle ? systems.set(t.toggle, !systems.get(t.toggle)) : systems.apply(t.set);
      if (!r.ok) toast(r.message, 'warn');
    },
    getToggle: (k) => systems.get(k),
  });
  const dock = createDock($('#dock'), { schema: ac.controlPanel, systems });
  $('#dock .dock-handle').addEventListener('click', () => setTimeout(updateInsets, 380));
  updateInsets();
  viewer.addTicker((dt) => { systems.update(dt); dock.tick(); });
  if (import.meta.env.DEV) window.__aircrafty = { viewer, systems, select: select3d };

  function updateProgress() {
    $('#progress-count').textContent = progress.count();
    $('#progress-total').textContent = parts.length;
    $('#progress-bar').style.width = `${(progress.count() / parts.length) * 100}%`;
  }
  updateProgress();

  // view buttons
  const viewNames = Object.keys(ac.camera.views);
  $('#views').innerHTML = viewNames.map((n, i) => `<button class="vt-btn" type="button" data-view="${n}" title="${n} (${i + 1})">${n}</button>`).join('');
  $('#views').addEventListener('click', (e) => {
    const b = e.target.closest('[data-view]');
    if (b) viewer.setView(ac.camera.views[b.dataset.view]);
  });

  const hotBtn = $('#t-hotspots'), isoBtn = $('#t-isolate');
  const setHot = (on) => { viewer.setHotspots(on); hotBtn.setAttribute('aria-pressed', on); store.set('hotspots', on); };
  const setIso = (on) => { viewer.setIsolate(on); isoBtn.setAttribute('aria-pressed', on); };
  hotBtn.addEventListener('click', () => setHot(hotBtn.getAttribute('aria-pressed') !== 'true'));
  isoBtn.addEventListener('click', () => setIso(isoBtn.getAttribute('aria-pressed') !== 'true'));
  setHot(store.get('hotspots', true));

  $('#search').addEventListener('input', (e) => index.setQuery(e.target.value));
  $('#sidebar-toggle').addEventListener('click', () => document.body.classList.toggle('sidebar-collapsed'));
  const help = $('#help'), helpBtn = $('#help-toggle');
  helpBtn.addEventListener('click', () => {
    help.hidden = !help.hidden;
    helpBtn.setAttribute('aria-expanded', String(!help.hidden));
  });

  // keyboard
  window.addEventListener('keydown', (e) => {
    if (e.target.matches('input[type=search], input[type=text], select')) {
      if (e.key === 'Escape') e.target.blur();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    if (k === 'Escape') { if (!help.hidden) { help.hidden = true; return; } select3d(null); }
    else if (k === 'h' || k === 'H') setHot(hotBtn.getAttribute('aria-pressed') !== 'true');
    else if (k === 'i' || k === 'I') setIso(isoBtn.getAttribute('aria-pressed') !== 'true');
    else if (k === '/') { e.preventDefault(); $('#search').focus(); }
    else if (k === '[' || k === ']') {
      const det = ac.controlPanel.find((g) => g.id === 'flaps')?.items[0].options.map((o) => o.value) || [];
      const i = det.indexOf(systems.get('flapLever'));
      const n = det[Math.max(0, Math.min(det.length - 1, i + (k === ']' ? 1 : -1)))];
      if (n !== undefined) systems.set('flapLever', n);
    } else if (k === 'g' || k === 'G') {
      const r = systems.set('gearLever', systems.get('gearLever') === 'UP' ? 'DN' : 'UP');
      if (!r.ok) toast(r.message, 'warn');
    } else if (/^[1-9]$/.test(k) && viewNames[+k - 1]) viewer.setView(ac.camera.views[viewNames[+k - 1]]);
  });

  // intro camera move
  viewer.flyTo(
    new (viewer.camera.position.constructor)(...ac.camera.home.position),
    new (viewer.camera.position.constructor)(...ac.camera.home.target),
    2.4,
  );
  $('#loading').classList.add('is-done');
  document.body.classList.add('is-ready');
  void selected;
}

boot().catch((err) => {
  console.error(err);
  $('#loading').innerHTML = `<span>Couldn't load the aircraft. ${err.message}</span>`;
});
