import './styles.css';
import { Viewer } from './core/viewer.js';
import { store, createProgress } from './core/storage.js';
import { aircraftRegistry, getAircraft } from './aircraft/registry.js';
import { createIndex } from './ui/partsIndex.js';
import { createPanel } from './ui/panel.js';
import { createDock } from './ui/dock.js';
import { createWalkaround } from './ui/walkaround.js';
import { createSchematicView } from './ui/schematic.js';
import { createFailures } from './ui/failures.js';
import { createTraining } from './ui/training.js';
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

const MODE_HASH = { explore: '', walkaround: '#walkaround', flightdeck: '#flightdeck', systems: '#systems', failures: '#failures', cabin: '#cabin', training: '#training' };
const modeFromHash = () => Object.keys(MODE_HASH).find((m) => MODE_HASH[m] && MODE_HASH[m] === location.hash) || 'explore';

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

  select.addEventListener('change', () => {
    if (!select.value || select.value === store.get('aircraft', 'b738')) return;
    store.set('aircraft', select.value);
    location.reload();
  });

  const ac = await getAircraft(acId).load();
  document.body.dataset.aircraft = ac.meta.id;
  $('#ac-name').textContent = ac.meta.name;
  if (ac.meta.disclaimer) $('.disclaimer').textContent = ac.meta.disclaimer;
  $('#specs').innerHTML = ac.meta.specs.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');

  viewer = new Viewer($('#stage'), {
    onSelect: (id) => select3d(id),
    onInteract: (r) => { if (r.ok === false && r.message) toast(r.message, 'warn'); },
  });
  const { root, systems } = ac.build();

  // Each dataset is a 3D scene plus its own clickable parts, categories, progress and camera views.
  const datasets = {
    exterior: {
      key: 'exterior', root, parts: ac.parts, categories: ac.categories, camera: ac.camera,
      progress: createProgress(ac.meta.id), family: ac.meta.family,
    },
  };
  let deck = null;
  if (ac.flightDeck) {
    deck = ac.flightDeck.build(systems);
    datasets.flightdeck = {
      key: 'flightdeck', root: deck.root, parts: ac.flightDeck.parts, categories: ac.flightDeck.categories,
      camera: ac.flightDeck.camera, progress: createProgress(`${ac.meta.id}-flightdeck`), family: 'Flight deck',
    };
  }

  let cabin = null;
  if (ac.cabin) {
    cabin = ac.cabin.build(systems);
    datasets.cabin = {
      key: 'cabin', root: cabin.root, parts: ac.cabin.parts, categories: ac.cabin.categories,
      camera: ac.cabin.camera, progress: createProgress(`${ac.meta.id}-cabin`), family: 'Cabin & emergency',
    };
  }
  if (ac.schematics) {
    datasets.systems = {
      key: 'systems', root: null, parts: ac.schematics.parts, categories: ac.schematics.categories,
      camera: ac.camera, progress: createProgress(`${ac.meta.id}-systems`), family: 'Systems',
    };
  }

  let ds = null;
  let selected = null;
  let mode = 'explore';
  let index = null;
  let panel = null;

  function select3d(id, opts = {}) {
    selected = id;
    viewer.select(id, opts);
    index?.setSelected(id);
    if (id) {
      panel.show(id);
      if (ds.progress.add(id)) { index.refresh(); updateProgress(); }
    } else panel?.hide();
    if (ds?.key === 'systems') schem?.highlight(id);
    document.body.classList.toggle('has-selection', !!id);
    updateInsets();
  }
  function updateInsets() {
    const wide = window.innerWidth > 820;
    const right = selected && wide ? $('#info').offsetWidth + 32 : 0;
    const bottom = $('#dock').offsetHeight * 0.85;
    viewer?.setInsets({ right, bottom });
  }
  window.addEventListener('resize', updateInsets);

  const onTry = (t) => {
    const r = t.toggle ? systems.set(t.toggle, !systems.get(t.toggle)) : systems.apply(t.set);
    if (!r.ok) toast(r.message, 'warn');
  };

  function updateProgress() {
    const n = ds.progress.count(), total = ds.parts.length;
    $('#progress-count').textContent = n;
    $('#progress-total').textContent = total;
    $('#progress-bar').style.width = `${(n / total) * 100}%`;
  }

  function renderViews() {
    const names = Object.keys(ds.camera.views);
    $('#views').innerHTML = names.map((n, i) => `<button class="vt-btn" type="button" data-view="${n}" title="${n} (${i + 1})">${n}</button>`).join('');
  }
  $('#views').addEventListener('click', (e) => {
    const b = e.target.closest('[data-view]');
    if (b) viewer.setView(ds.camera.views[b.dataset.view]);
  });

  function useDataset(key, { fly = true } = {}) {
    if (ds?.key === key) return;
    select3d(null);
    ds = datasets[key];
    if (ds.root) viewer.load(ds.root, ds.parts, ds.camera);
    viewer.setPaused(!ds.root);
    index = createIndex($('#index'), {
      categories: ds.categories, parts: ds.parts, progress: ds.progress,
      onSelect: (id) => select3d(id),
      onFilter: (fn) => { if (mode !== 'walkaround') viewer.setMarkerFilter(fn); },
    });
    panel = createPanel($('#info'), {
      categories: ds.categories, parts: ds.parts, onTry,
      onClose: () => select3d(null),
      onSelect: (id) => select3d(id),
      getToggle: (k) => systems.get(k),
    });
    $('#search').value = '';
    $('#ac-family').textContent = ds.family;
    updateProgress();
    renderViews();
    if (fly && ds.root) {
      const V = viewer.camera.position.constructor;
      if (key === 'flightdeck') {
        viewer.camera.position.set(...ds.camera.home.position);
        viewer.controls.target.set(...ds.camera.home.target);
      } else viewer.flyTo(new V(...ds.camera.home.position), new V(...ds.camera.home.target), 1.4);
    }
  }

  useDataset('exterior', { fly: false });
  applySceneTheme();

  const dock = createDock($('#dock'), { schema: ac.controlPanel, systems });
  $('#dock .dock-handle').addEventListener('click', () => setTimeout(updateInsets, 380));
  updateInsets();
  const schem = ac.schematics
    ? createSchematicView($('#schem'), {
      schematics: ac.schematics.systems, scenario: ac.schematics.scenario, systems,
      onSelect: (id) => select3d(id), onWarn: (m) => toast(m, 'warn'),
    })
    : null;
  viewer.addTicker((dt) => { systems.update(dt); deck?.update(dt); dock.tick(); schem?.tick(); });
  const failures = ac.failures && schem
    ? createFailures($('#fail'), {
      scenarios: ac.failures.scenarios, normal: ac.failures.normal, labels: ac.failures.labels, systems,
      showSystem: (id) => schem.setSystem(id),
      openFlightDeck: () => setMode('flightdeck'),
      onWarn: (m) => toast(m, 'warn'),
      onInject: () => deck?.ackCautions?.(),
    })
    : null;
  // A dot on the Failures tab while any failure is active (failures persist across modes).
  const training = ac.trainers?.length
    ? createTraining($('#train'), $('#training'), {
      trainers: ac.trainers, aircraftId: ac.meta.id,
      ctx: { systems, toast, viewer, aircraft: ac },
    })
    : null;
  viewer.addTicker((dt) => { cabin?.update?.(dt); training?.tick(dt); });
  const failTab = document.querySelector('.mode[data-mode="failures"]');
  viewer.addTicker(() => {
    if (!failures) return;
    failTab?.classList.toggle('has-alert', failures.anyActive());
    failures.tick();
  });
  if (import.meta.env.DEV) window.__aircrafty = { viewer, systems, select: (id) => select3d(id), datasets };

  // ---------------------------------------------------------------- modes
  const walk = ac.walkaround
    ? createWalkaround($('#walk'), { data: ac.walkaround, parts: ac.parts, aircraftId: ac.meta.id, viewer, onOpenPart: (id) => select3d(id, { focus: false }) })
    : null;
  const modeButtons = document.querySelectorAll('.mode[data-mode]');
  if (!walk) document.querySelector('.mode[data-mode="walkaround"]')?.setAttribute('disabled', '');
  if (!deck) document.querySelector('.mode[data-mode="flightdeck"]')?.setAttribute('disabled', '');
  if (!schem) document.querySelector('.mode[data-mode="systems"]')?.setAttribute('disabled', '');
  if (!cabin) document.querySelector('.mode[data-mode="cabin"]')?.setAttribute('disabled', '');
  if (!training) document.querySelector('.mode[data-mode="training"]')?.setAttribute('disabled', '');
  if (!failures) document.querySelector('.mode[data-mode="failures"]')?.setAttribute('disabled', '');

  function parkForWalkaround() {
    // A walkaround happens on the ground with the aircraft parked and configured normally.
    systems.set('reversers', false);
    systems.set('speedbrake', 'DOWN');
    systems.set('gearLever', 'DN');
    systems.set('doors', false);
    systems.set('flapLever', 0);
    ['roll', 'pitch', 'yaw'].forEach((k) => systems.set(k, 0));
    const land = () => { if (mode === 'walkaround' && !systems.set('onGround', true).ok) setTimeout(land, 300); };
    land();
  }

  const HINTS = {
    explore: 'Click any part · drag to orbit · scroll to zoom',
    walkaround: 'Follow the numbered route · ← → to move between stops',
    flightdeck: 'Click any panel · drag to look around · scroll to lean in',
    systems: '',
    failures: '',
    cabin: 'Click any item · drag to look around · scroll to move closer',
    training: '',
  };

  function setMode(next, { initial = false } = {}) {
    if ((next === 'walkaround' && !walk) || (next === 'flightdeck' && !deck) || (next === 'systems' && !schem)
      || (next === 'failures' && !failures) || (next === 'cabin' && !cabin) || (next === 'training' && !training)) next = 'explore';
    if (next === mode && !initial) return;
    const prev = mode;
    mode = next;
    document.body.dataset.mode = mode;
    modeButtons.forEach((b) => {
      const on = b.dataset.mode === mode;
      b.classList.toggle('is-active', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    select3d(null);
    if (prev === 'walkaround') walk?.stop();
    if (prev === 'failures') failures?.stop();
    if (prev === 'training') training?.stop();
    const dockEl = $('#dock');
    $('.stage-hint').textContent = HINTS[mode];

    viewer.setLightScale(mode === 'flightdeck' && night ? 0.1 : 1);
    $('#schem').hidden = mode !== 'systems' && mode !== 'failures';
    if (mode === 'systems' || mode === 'failures') {
      useDataset('systems');
      dockEl.classList.add('is-collapsed');
      if (mode === 'failures') {
        failures.start();
        if (window.innerWidth <= 820) document.body.classList.remove('sidebar-collapsed');
      }
      schem.tick();
    } else if (mode === 'training') {
      useDataset('systems');
      dockEl.classList.add('is-collapsed');
      training.start();
      if (window.innerWidth <= 820) document.body.classList.remove('sidebar-collapsed');
    } else if (mode === 'cabin') {
      useDataset('cabin');
      dockEl.classList.add('is-collapsed');
    } else if (mode === 'flightdeck') {
      useDataset('flightdeck');
      dockEl.classList.add('is-collapsed');
    } else {
      useDataset('exterior', { fly: mode === 'explore' && !initial });
      if (mode === 'walkaround') {
        $('#ac-family').textContent = ac.walkaround.title;
        dockEl.classList.add('is-collapsed');
        parkForWalkaround();
        walk.start();
        if (window.innerWidth <= 820) document.body.classList.remove('sidebar-collapsed');
      } else {
        dockEl.classList.remove('is-collapsed');
        $('#ac-family').textContent = ds.family;
        index.refresh();
        if (prev !== 'explore' && prev !== 'flightdeck') viewer.setView(ac.camera.home);
      }
    }
    setTimeout(updateInsets, 380);
    const hash = MODE_HASH[mode];
    if (location.hash !== hash) history.replaceState(null, '', hash || location.pathname + location.search);
  }
  modeButtons.forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
  window.addEventListener('hashchange', () => setMode(modeFromHash()));

  const nightBtn = $('#t-night');
  let night = false;
  const setNight = (on) => {
    night = on;
    deck?.setNight(on);
    nightBtn.setAttribute('aria-pressed', on);
    if (mode === 'flightdeck') viewer.setLightScale(on ? 0.1 : 1);
  };
  nightBtn.addEventListener('click', () => setNight(!night));

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
    const viewNames = Object.keys(ds.camera.views);
    if (k === 'Escape') { if (!help.hidden) { help.hidden = true; return; } select3d(null); }
    else if (mode === 'walkaround' && (k === 'ArrowRight' || k === 'ArrowLeft')) { e.preventDefault(); k === 'ArrowRight' ? walk.next() : walk.prev(); }
    else if (k === 'h' || k === 'H') setHot(hotBtn.getAttribute('aria-pressed') !== 'true');
    else if (k === 'i' || k === 'I') setIso(isoBtn.getAttribute('aria-pressed') !== 'true');
    else if ((k === 'n' || k === 'N') && mode === 'flightdeck') setNight(!night);
    else if (k === '/') { e.preventDefault(); $('#search').focus(); }
    else if (k === '[' || k === ']') {
      const det = ac.controlPanel.find((g) => g.id === 'flaps')?.items[0].options.map((o) => o.value) || [];
      const i = det.indexOf(systems.get('flapLever'));
      const n = det[Math.max(0, Math.min(det.length - 1, i + (k === ']' ? 1 : -1)))];
      if (n !== undefined) systems.set('flapLever', n);
    } else if (k === 'g' || k === 'G') {
      const r = systems.set('gearLever', systems.get('gearLever') === 'UP' ? 'DN' : 'UP');
      if (!r.ok) toast(r.message, 'warn');
    } else if (/^[1-9]$/.test(k) && viewNames[+k - 1]) viewer.setView(ds.camera.views[viewNames[+k - 1]]);
  });

  // start in the mode named by the URL, with an intro camera move on the exterior
  const startMode = modeFromHash();
  if (startMode !== 'explore') setMode(startMode, { initial: true });
  else {
    document.body.dataset.mode = 'explore';
    const V = viewer.camera.position.constructor;
    viewer.flyTo(new V(...ac.camera.home.position), new V(...ac.camera.home.target), 2.4);
  }
  $('#loading').classList.add('is-done');
  document.body.classList.add('is-ready');
}

boot().catch((err) => {
  console.error(err);
  $('#loading').innerHTML = `<span>Couldn't load the aircraft. ${err.message}</span>`;
});
