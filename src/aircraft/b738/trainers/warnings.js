// Trainer: Warning systems — GPWS/EGPWS modes, look-ahead terrain, TCAS, configuration warnings,
// stall/buffet, overspeed and cabin altitude, each as an interactive explainer with live alert text.
import './warnings.css';
import { P, createAudio } from './warnings-ui.js';
import { mountGpws, mountTerrain } from './warnings-gpws.js';
import { mountTcas } from './warnings-tcas.js';
import { mountTakeoff, mountGear, mountStall, mountOverspeed, mountCabin } from './warnings-config.js';

const TABS = [
  { id: 'gpws', label: 'GPWS modes', mount: mountGpws },
  { id: 'terrain', label: 'Look-ahead terrain', mount: mountTerrain },
  { id: 'tcas', label: 'TCAS', mount: mountTcas },
  { id: 'takeoff', label: 'Takeoff config', mount: mountTakeoff },
  { id: 'gear', label: 'Landing gear', mount: mountGear },
  { id: 'stall', label: 'Stall & buffet', mount: mountStall },
  { id: 'overspeed', label: 'Overspeed', mount: mountOverspeed },
  { id: 'cabin', label: 'Cabin altitude', mount: mountCabin },
];

export default {
  id: 'warnings',
  title: 'Warning systems',
  group: 'Systems',
  summary: 'GPWS modes 1–7, look-ahead terrain, TCAS TA/RA, takeoff and gear configuration, stall, overspeed and cabin altitude, with live alerts.',
  mount(el, ctx = {}) {
    const audio = createAudio();
    let cur = null, sub = null;
    el.innerHTML = `<div class="${P}root">
      <header class="${P}head">
        <div>
          <div class="${P}eyebrow">Training · Systems</div>
          <h2 class="${P}title">Warning systems</h2>
          <p class="${P}lede">What triggers each alert, what you see and hear, and the first response. Drag, slide and toggle to explore the logic.</p>
        </div>
        <label class="${P}sound"><input type="checkbox" data-sound> <span>Alert tones</span><em>off by default · approximate sounds</em></label>
      </header>
      <nav class="${P}tabs" role="tablist">${TABS.map((t) => `<button type="button" role="tab" data-tab="${t.id}">${t.label}</button>`).join('')}</nav>
      <section class="${P}body" data-body></section>
      <p class="${P}caveat">Generic study material for the typical 737 NG. Alert logic, thresholds and aural messages vary with installation and operator options. Your FCOM, QRH and FCTM take precedence.</p>
    </div>`;
    const body = el.querySelector('[data-body]');
    const sh = { sound: (k) => audio.set(k), toast: ctx.toast };
    function open(id) {
      if (id === cur) return;
      try { sub?.unmount?.(); } catch (e) { console.error(e); }
      audio.set(null);
      cur = id;
      el.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === id)));
      body.innerHTML = '';
      const host = document.createElement('div');
      host.className = `${P}pane`;
      body.appendChild(host);
      sub = TABS.find((t) => t.id === id).mount(host, sh, ctx) || null;
    }
    const onTab = (e) => { const b = e.target.closest('[data-tab]'); if (b) open(b.dataset.tab); };
    const onSound = (e) => audio.setEnabled(e.target.checked);
    el.querySelector(`.${P}tabs`).addEventListener('click', onTab);
    el.querySelector('[data-sound]').addEventListener('change', onSound);
    open('gpws');
    return {
      tick(dt) { sub?.tick?.(Math.min(dt, 0.1)); },
      unmount() {
        try { sub?.unmount?.(); } catch (e) { console.error(e); }
        audio.dispose();
        el.innerHTML = '';
      },
    };
  },
};
