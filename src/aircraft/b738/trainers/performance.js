// Trainer: Performance concepts. Interactive, qualitative diagrams of takeoff and landing performance ideas:
// declared distances, V-speeds and balanced field, factors, reduced thrust, climb/obstacles and landing distance.
// No real performance data: never usable for real calculations.
import './performance.css';
import { CONCEPT_NOTE, esc } from './performance-util.js';
import { mountRunway } from './performance-runway.js';
import { mountVSpeeds } from './performance-vspeeds.js';
import { mountFactors } from './performance-factors.js';
import { mountThrust } from './performance-thrust.js';
import { mountClimb } from './performance-climb.js';
import { mountLanding } from './performance-landing.js';

const STORE_KEY = 'aircrafty:b738:performance';

const TOPICS = [
  { id: 'runway', label: 'Declared distances', title: 'Runway declared distances', mount: mountRunway,
    blurb: 'TORA, TODA, ASDA and LDA: what each one measures, and how stopways, clearways and displaced thresholds change them.' },
  { id: 'vspeeds', label: 'V-speeds & balanced field', title: 'V-speeds and the balanced field', mount: mountVSpeeds,
    blurb: 'The takeoff speeds in order along the takeoff run, then how V1 trades accelerate-go against accelerate-stop.' },
  { id: 'factors', label: 'Factors', title: 'Factors affecting takeoff', mount: mountFactors,
    blurb: 'Weight, temperature, altitude, wind, slope, runway condition, flap and bleeds: the direction and rough size of each effect.' },
  { id: 'thrust', label: 'Reduced thrust', title: 'Reduced takeoff thrust', mount: mountThrust,
    blurb: 'Flat rating, assumed temperature and fixed derates: how each lowers takeoff thrust and what it means for control speeds and restrictions.' },
  { id: 'climb', label: 'Climb & obstacles', title: 'Climb gradient and obstacle clearance', mount: mountClimb,
    blurb: 'The engine-out takeoff flight path segments, gross versus net, and clearing obstacles.' },
  { id: 'landing', label: 'Landing distance', title: 'Landing distance', mount: mountLanding,
    blurb: 'Dispatch factors versus time-of-arrival assessment, and how braking mode, reverse, speedbrake and runway condition change the stop.' },
];

function readStore() { try { return localStorage.getItem(STORE_KEY); } catch { return null; } }
function writeStore(v) { try { localStorage.setItem(STORE_KEY, v); } catch { /* ignore */ } }

export default {
  id: 'performance',
  title: 'Performance concepts',
  group: 'Performance',
  summary: 'Declared distances, V-speeds, balanced field, factors, reduced thrust, climb and landing. Conceptual only.',
  mount(host) {
    let topic = TOPICS.find((t) => t.id === readStore()) || TOPICS[0];
    let active = null;

    host.innerHTML = `
      <div class="tr-perf">
        <header class="tr-perf-head">
          <div>
            <div class="eyebrow">Performance · concepts</div>
            <h2 class="tr-perf-title"></h2>
            <p class="tr-perf-blurb"></p>
          </div>
          <div class="tr-perf-caveat"><b>Conceptual only</b>No real performance data. Not for operational use.</div>
        </header>
        <nav class="tr-perf-tabs" role="tablist" aria-label="Performance topics">
          ${TOPICS.map((t, i) => `<button type="button" role="tab" class="tr-perf-tab" data-topic="${t.id}"><i>${String(i + 1).padStart(2, '0')}</i>${esc(t.label)}</button>`).join('')}
        </nav>
        <div class="tr-perf-body"></div>
        <p class="tr-perf-foot">${esc(CONCEPT_NOTE)}</p>
      </div>`;

    const body = host.querySelector('.tr-perf-body');

    function open(id) {
      topic = TOPICS.find((t) => t.id === id) || TOPICS[0];
      writeStore(topic.id);
      active?.unmount?.();
      body.innerHTML = '';
      host.querySelectorAll('.tr-perf-tab').forEach((b) => {
        const on = b.dataset.topic === topic.id;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-selected', String(on));
      });
      host.querySelector('.tr-perf-title').textContent = topic.title;
      host.querySelector('.tr-perf-blurb').textContent = topic.blurb;
      const pane = document.createElement('div');
      pane.className = 'tr-perf-pane';
      body.appendChild(pane);
      active = topic.mount(pane) || null;
    }

    host.querySelector('.tr-perf-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-topic]');
      if (b && b.dataset.topic !== topic.id) open(b.dataset.topic);
    });
    open(topic.id);

    return {
      tick(dt) { active?.tick?.(dt); },
      unmount() { active?.unmount?.(); active = null; host.innerHTML = ''; },
    };
  },
};
