// Trainer: Simulator prep. Animated, scrubbable side-view profiles of the classic type-rating sim events,
// with a synchronized phase timeline, generic callouts / decision points, key principles and examiner focus.
// Content is generic FCTM-style study material (paraphrased); the operator's FCTM / SOP takes precedence.
import './simprep.css';
import { SCENARIOS, WHO } from './simprep-scenarios.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const GROUND = 318;          // scene y of the ground line (h = 0)
const SPEEDS = [0.5, 1, 1.5, 2];
const STORE_KEY = 'aircrafty:b738:simprep';
const TEXT_KEYS = ['spd', 'alt', 'thr', 'cfg'];
const FLAG_KEYS = ['gear', 'flaps', 'eng', 'rev', 'spdbrk', 'ap'];

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmtT = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

function readStore() { try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; } }
function writeStore(v) { try { localStorage.setItem(STORE_KEY, JSON.stringify(v)); } catch { /* ignore */ } }

// ---------- Profile maths ----------
// Resolve carried-forward text/flags at each keyframe, then sample a Catmull-Rom path through the keyframes.
function prepare(sc) {
  const keys = [];
  let acc = {};
  for (const k of sc.keys) {
    acc = { ...acc };
    for (const f of [...TEXT_KEYS, ...FLAG_KEYS]) if (f in k) acc[f] = k[f];
    keys.push({ ...k, ...acc });
  }
  const duration = keys[keys.length - 1].t;
  const pos = (t) => {
    t = clamp(t, 0, duration);
    let i = 0;
    while (i < keys.length - 2 && t > keys[i + 1].t) i++;
    const k0 = keys[Math.max(0, i - 1)], k1 = keys[i], k2 = keys[i + 1], k3 = keys[Math.min(keys.length - 1, i + 2)];
    const u = k2.t === k1.t ? 0 : (t - k1.t) / (k2.t - k1.t);
    const cr = (a, b, c, d) => {
      // Centripetal-free uniform Catmull-Rom, tangents scaled to keyframe spacing to limit overshoot.
      const m1 = (c - a) / Math.max(1e-6, k2.t - k0.t) * (k2.t - k1.t);
      const m2 = (d - b) / Math.max(1e-6, k3.t - k1.t) * (k2.t - k1.t);
      const u2 = u * u, u3 = u2 * u;
      return (2 * u3 - 3 * u2 + 1) * b + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * c + (u3 - u2) * m2;
    };
    let x = cr(k0.x, k1.x, k2.x, k3.x);
    let h = cr(k0.h, k1.h, k2.h, k3.h);
    if (k1.h === 0 && k2.h === 0) h = 0;
    if (k1.x === k2.x) x = k1.x;
    h = Math.max(0, h);
    const p = k1.p + (k2.p - k1.p) * u;
    return { x, h, p, k: t >= k2.t ? k2 : k1 };
  };
  const samples = [];
  for (let t = 0; t <= duration + 1e-6; t += 0.05) samples.push(pos(t));
  let len = 0;
  const cum = [0];
  for (let i = 1; i < samples.length; i++) {
    len += Math.hypot(samples[i].x - samples[i - 1].x, samples[i].h - samples[i - 1].h);
    cum.push(len);
  }
  const d = samples.map((s, i) => `${i ? 'L' : 'M'}${s.x.toFixed(1)},${(GROUND - s.h).toFixed(1)}`).join('');
  return { ...sc, keys, duration, pos, pathD: d, cum, total: len };
}

// ---------- SVG helpers ----------
function el(tag, attrs = {}, parent) {
  const n = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
}

// 737-style side silhouette, nose to the right, origin at main-gear wheel contact.
function buildAircraft(parent, cls = 'tr-simprep-ac') {
  const g = el('g', { class: cls }, parent);
  const body = el('g', {}, g);
  el('path', { class: 'ac-fin', d: 'M-35,-17.6 L-46,-31.5 L-51,-31.5 L-47.5,-17 Z' }, body);
  el('path', { class: 'ac-body', d: 'M-47.5,-17 L27,-18.6 C33,-18.6 37,-16.2 38.4,-13.2 C37.2,-10.6 33,-9.5 27,-9.5 L-29,-9.5 C-38,-10 -44.5,-12.8 -47.5,-17 Z' }, body);
  el('path', { class: 'ac-stab', d: 'M-39,-15.6 L-53,-17.4 L-51,-14.4 Z' }, body);
  el('path', { class: 'ac-win', d: 'M30.5,-16.4 L34.4,-15.8 L36.2,-14.2 L31.2,-14.2 Z' }, body);
  el('line', { class: 'ac-cabin', x1: -36, y1: -15.2, x2: 26, y2: -15.6 }, body);
  const flap = el('path', { class: 'ac-flap', d: 'M-8,-10.6 L-14.5,-6.4 L-12.5,-6 Z' }, body);
  el('path', { class: 'ac-wing', d: 'M-9,-11.2 L11,-12.4 L13,-10.6 L-8,-10.2 Z' }, body);
  const spoiler = el('path', { class: 'ac-spoiler', d: 'M-1,-12 L-6.5,-17.5 L-7.6,-16.6 L-3,-11.8 Z' }, body);
  el('path', { class: 'ac-nac', d: 'M-1.6,-10.6 L12.4,-10.6 Q14.6,-10.6 14.6,-8.4 L14.6,-6.4 L-0.2,-6.4 Q-2.8,-6.4 -2.8,-8.6 Q-2.8,-10.6 -1.6,-10.6 Z' }, body);
  const fail = el('g', { class: 'ac-fail' }, body);
  el('circle', { cx: 6, cy: -8.5, r: 7.5, class: 'ac-fail-glow' }, fail);
  el('path', { d: 'M3,-11.5 L9,-5.5 M9,-11.5 L3,-5.5', class: 'ac-fail-x' }, fail);
  const fire = el('g', { class: 'ac-fire' }, body);
  el('circle', { cx: 6, cy: -8.5, r: 8, class: 'ac-fire-glow' }, fire);
  el('path', { d: 'M-4,-8 Q-9,-12 -14,-9 Q-10,-8 -14,-5.5 Q-8,-5 -4,-7 Z', class: 'ac-fire-plume' }, fire);
  const rev = el('g', { class: 'ac-rev' }, body);
  el('path', { d: 'M15,-11.5 l7,-3 m-7,3 l2.2,-3.6 m-2.2,3.6 l3.8,0.8 M15,-5.4 l7,3 m-7,-3 l2.2,3.6 m-2.2,-3.6 l3.8,-0.8' }, rev);
  const gear = el('g', { class: 'ac-gear' }, body);
  el('line', { x1: 0, y1: -9.6, x2: 0, y2: -3.2 }, gear);
  el('circle', { cx: 0, cy: -2, r: 2 }, gear);
  el('line', { x1: 29, y1: -9.6, x2: 29, y2: -3.4 }, gear);
  el('circle', { cx: 29, cy: -1.8, r: 1.8 }, gear);
  return { g, flap, spoiler, fail, fire, rev, gear };
}

function arrow(parent, x1, y1, x2, y2, cls) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const hx = x2 - Math.cos(a) * 7, hy = y2 - Math.sin(a) * 7;
  const px = Math.cos(a + Math.PI / 2) * 4, py = Math.sin(a + Math.PI / 2) * 4;
  el('path', { class: cls, d: `M${x1},${y1} L${hx},${hy} M${x2},${y2} L${hx + px},${hy + py} L${hx - px},${hy - py} Z` }, parent);
}

function buildScene(svg, sc) {
  svg.innerHTML = '';
  const S = sc.scene || {};
  el('rect', { x: 0, y: 0, width: 1000, height: 360, class: 'tr-simprep-sky' }, svg);
  const grid = el('g', { class: 'tr-simprep-grid' }, svg);
  for (let y = GROUND - 50; y > 0; y -= 50) el('line', { x1: 0, x2: 1000, y1: y, y2: y }, grid);
  for (let x = 100; x < 1000; x += 100) el('line', { x1: x, x2: x, y1: 0, y2: S.sky ? 360 : GROUND }, grid);

  if (S.microburst) {
    const { x, w } = S.microburst;
    const mb = el('g', { class: 'tr-simprep-mb' }, svg);
    el('ellipse', { cx: x, cy: 70, rx: w * 0.55, ry: 34, class: 'mb-cloud' }, mb);
    el('path', { class: 'mb-shaft', d: `M${x - w * 0.28},92 L${x - w * 0.36},${GROUND} L${x + w * 0.36},${GROUND} L${x + w * 0.28},92 Z` }, mb);
    for (let i = -2; i <= 2; i++) arrow(mb, x + i * 26, 120 + Math.abs(i) * 6, x + i * 30, 220, 'mb-arrow');
    arrow(mb, x - 40, GROUND - 14, x - w * 0.62, GROUND - 26, 'mb-arrow');
    arrow(mb, x + 40, GROUND - 14, x + w * 0.62, GROUND - 26, 'mb-arrow');
    // Wind felt along the approach: headwind first, then downdraft, then tailwind.
    arrow(mb, x - w * 0.42, 172, x - w * 0.62, 168, 'mb-wind');
    arrow(mb, x + w * 0.38, 150, x + w * 0.62, 146, 'mb-wind');
    const t1 = el('text', { x: x - w * 0.62, y: 160, class: 'mb-label' }, mb); t1.textContent = 'HEADWIND';
    const t2 = el('text', { x: x + w * 0.38, y: 138, class: 'mb-label' }, mb); t2.textContent = 'TAILWIND';
    const t3 = el('text', { x: x + 10, y: 240, class: 'mb-label' }, mb); t3.textContent = 'DOWNDRAFT';
    const t4 = el('text', { x, y: 74, class: 'mb-title', 'text-anchor': 'middle' }, mb); t4.textContent = 'MICROBURST';
  }

  if (!S.sky) {
    el('rect', { x: 0, y: GROUND, width: 1000, height: 360 - GROUND, class: 'tr-simprep-ground' }, svg);
    el('line', { x1: 0, x2: 1000, y1: GROUND, y2: GROUND, class: 'tr-simprep-horizon' }, svg);
  } else {
    const cl = el('g', { class: 'tr-simprep-clouds' }, svg);
    [[140, 70, 70], [520, 300, 90], [820, 90, 60], [300, 250, 50]].forEach(([cx, cy, r]) => {
      el('ellipse', { cx, cy, rx: r, ry: r * 0.28 }, cl);
      el('ellipse', { cx: cx + r * 0.3, cy: cy - r * 0.12, rx: r * 0.55, ry: r * 0.26 }, cl);
    });
    el('line', { x1: 0, x2: 1000, y1: GROUND - 160, y2: GROUND - 160, class: 'tr-simprep-level' }, svg);
    const lt = el('text', { x: 10, y: GROUND - 166, class: 'tr-simprep-marktext' }, svg);
    lt.textContent = 'CLEARED LEVEL';
  }

  if (S.terrain) {
    const pts = S.terrain.map(([x, h]) => `${x},${GROUND - h}`).join(' ');
    el('polygon', { points: `0,${GROUND + 1} ${pts} 1000,${GROUND + 1}`, class: 'tr-simprep-terrain' }, svg);
  }

  if (S.glide) {
    const [[x1, h1], [x2, h2]] = S.glide;
    el('line', { x1, y1: GROUND - h1, x2, y2: GROUND - h2, class: 'tr-simprep-glide' }, svg);
    const gt = el('text', { x: x1 + 14, y: GROUND - h1 + 22, class: 'tr-simprep-marktext' }, svg);
    gt.textContent = 'GLIDE PATH';
  }

  if (S.runway) {
    const [a, b] = S.runway;
    const rw = el('g', { class: 'tr-simprep-runway' }, svg);
    el('rect', { x: a, y: GROUND - 1, width: b - a, height: 7, rx: 1.5, class: 'rw-surface' }, rw);
    el('line', { x1: a + 26, x2: b - 4, y1: GROUND + 2.5, y2: GROUND + 2.5, class: 'rw-cl' }, rw);
    for (let i = 0; i < 4; i++) el('rect', { x: a + 4 + i * 5, y: GROUND, width: 3, height: 5, class: 'rw-thr' }, rw);
    if (b < 1000) {
      el('rect', { x: b - 6, y: GROUND - 1, width: 6, height: 7, class: 'rw-end' }, rw);
      const et = el('text', { x: b, y: GROUND + 24, class: 'tr-simprep-marktext', 'text-anchor': 'end' }, rw);
      et.textContent = 'RUNWAY END';
    }
  }
  for (const m of S.markers || []) {
    const mg = el('g', { class: 'tr-simprep-marker' }, svg);
    el('line', { x1: m.x, x2: m.x, y1: GROUND - 34, y2: GROUND, class: 'mk-post' }, mg);
    el('rect', { x: m.x - 18, y: GROUND - 50, width: 36, height: 17, rx: 3, class: 'mk-board' }, mg);
    const t = el('text', { x: m.x, y: GROUND - 38, 'text-anchor': 'middle', class: 'mk-text' }, mg);
    t.textContent = m.label;
  }

  const ghost = el('path', { d: sc.pathD, class: 'tr-simprep-path-ghost' }, svg);
  const trail = el('path', { d: sc.pathD, class: 'tr-simprep-path' }, svg);
  trail.style.strokeDasharray = `0 ${sc.total + 10}`;

  let intruder = null;
  if (S.intruder) {
    const ig = el('g', { class: 'tr-simprep-intruder' }, svg);
    const inner = el('g', { transform: 'scale(-0.9,0.9)' }, ig);
    const parts = buildAircraft(inner, 'tr-simprep-ac tr-simprep-ac--intruder');
    parts.gear.style.display = 'none';
    parts.flap.style.display = 'none';
    parts.spoiler.style.display = 'none';
    parts.fail.style.display = 'none';
    parts.fire.style.display = 'none';
    parts.rev.style.display = 'none';
    const it = el('text', { x: 0, y: 18, 'text-anchor': 'middle', class: 'tr-simprep-intruder-tag' }, ig);
    it.textContent = 'TRAFFIC';
    intruder = ig;
  }

  const acWrap = el('g', {}, svg);
  const ac = buildAircraft(acWrap);
  const tags = el('g', { class: 'tr-simprep-tags' }, svg);
  const notScale = el('text', { x: 992, y: 352, 'text-anchor': 'end', class: 'tr-simprep-ns' }, svg);
  notScale.textContent = 'SIDE VIEW · NOT TO SCALE';
  return { acWrap, ac, tags, trail, ghost, intruder };
}

// ---------- Trainer ----------
export default {
  id: 'simprep',
  title: 'Simulator prep',
  group: 'Simulator prep',
  summary: 'Animated profiles of the classic sim events: callouts, decision points, what examiners look for.',
  mount(host) {
    const saved = readStore();
    const prepared = SCENARIOS.map(prepare);
    let sc = prepared.find((s) => s.id === saved.id) || prepared[0];
    let t = 0;
    let playing = false;
    let speed = SPEEDS.includes(saved.speed) ? saved.speed : 1;
    let scene = null;
    let lastStepIdx = -2;
    let lastTagKey = '';
    let dragging = false;

    host.innerHTML = `
      <div class="tr-simprep">
        <header class="tr-simprep-head">
          <div>
            <div class="eyebrow">Simulator prep · type rating</div>
            <h2 class="tr-simprep-title"></h2>
            <p class="tr-simprep-blurb"></p>
          </div>
          <div class="tr-simprep-caveat"><b>Generic profiles</b>Paraphrased FCTM-style technique for study. Follow your operator's FCTM, QRH and SOP.</div>
        </header>
        <nav class="tr-simprep-tabs" role="tablist" aria-label="Scenarios">
          ${prepared.map((s, i) => `<button type="button" role="tab" class="tr-simprep-tab" data-id="${s.id}"><i>${String(i + 1).padStart(2, '0')}</i>${esc(s.short)}</button>`).join('')}
        </nav>
        <div class="tr-simprep-main">
          <section class="tr-simprep-card tr-simprep-stagecard">
            <div class="tr-simprep-scene">
              <svg viewBox="0 0 1000 360" class="tr-simprep-svg" role="img" aria-label="Side-view animation of the flight profile"></svg>
              <div class="tr-simprep-callout" aria-live="polite"><span class="who"></span><b></b></div>
            </div>
            <div class="tr-simprep-hud">
              <div><span>Phase</span><b data-hud="phase"></b></div>
              <div><span>Speed</span><b data-hud="spd"></b></div>
              <div><span>Height</span><b data-hud="alt"></b></div>
              <div><span>Thrust</span><b data-hud="thr"></b></div>
              <div><span>Configuration</span><b data-hud="cfg"></b></div>
            </div>
            <div class="tr-simprep-controls">
              <button type="button" class="tr-simprep-btn" data-act="restart" title="Restart" aria-label="Restart">
                <svg viewBox="0 0 20 20"><path d="M5 4v12M15 4 7 10l8 6z"/></svg></button>
              <button type="button" class="tr-simprep-btn" data-act="prev" title="Previous step (←)" aria-label="Previous step">
                <svg viewBox="0 0 20 20"><path d="M13 4 6 10l7 6z"/></svg></button>
              <button type="button" class="tr-simprep-btn tr-simprep-play" data-act="play" title="Play / pause (Space)" aria-label="Play">
                <svg viewBox="0 0 20 20" class="i-play"><path d="M6 3.5v13l11-6.5z"/></svg>
                <svg viewBox="0 0 20 20" class="i-pause"><path d="M5.5 3.5h3v13h-3zM11.5 3.5h3v13h-3z"/></svg></button>
              <button type="button" class="tr-simprep-btn" data-act="next" title="Next step (→)" aria-label="Next step">
                <svg viewBox="0 0 20 20"><path d="M7 4l7 6-7 6z"/></svg></button>
              <span class="tr-simprep-time"><b data-time="cur">0:00</b> / <span data-time="dur"></span></span>
              <div class="tr-simprep-speed" role="group" aria-label="Playback speed">
                ${SPEEDS.map((s) => `<button type="button" data-speed="${s}">${s}×</button>`).join('')}
              </div>
            </div>
            <div class="tr-simprep-tl" tabindex="0" role="slider" aria-label="Timeline" aria-valuemin="0">
              <div class="tr-simprep-tl-phases"></div>
              <div class="tr-simprep-tl-ticks"></div>
              <div class="tr-simprep-tl-fill"></div>
              <div class="tr-simprep-tl-head"><span></span></div>
            </div>
          </section>
          <section class="tr-simprep-card tr-simprep-stepscard">
            <h3 class="tr-simprep-h3">Callouts &amp; actions <span>Click a step to jump to it</span></h3>
            <ol class="tr-simprep-steps"></ol>
          </section>
        </div>
        <div class="tr-simprep-cards">
          <section class="tr-simprep-card"><h3 class="tr-simprep-h3">Key principles</h3><ul class="tr-simprep-list" data-list="principles"></ul></section>
          <section class="tr-simprep-card tr-simprep-card--exam"><h3 class="tr-simprep-h3">What examiners look for</h3><ul class="tr-simprep-list" data-list="examiner"></ul></section>
        </div>
        <p class="tr-simprep-foot">Profiles are schematic and time-compressed; heights and distances are not to scale. Callouts shown are generic examples. Exact wording, who calls what, and the actions themselves come from your operator's SOP, FCTM and QRH. No memory items are reproduced here.</p>
      </div>`;

    const $ = (s) => host.querySelector(s);
    const svg = $('.tr-simprep-svg');
    const tl = $('.tr-simprep-tl');
    const stepsEl = $('.tr-simprep-steps');
    const callout = $('.tr-simprep-callout');
    const hud = Object.fromEntries([...host.querySelectorAll('[data-hud]')].map((n) => [n.dataset.hud, n]));
    const playBtn = $('[data-act="play"]');

    function loadScenario(id) {
      sc = prepared.find((s) => s.id === id) || prepared[0];
      writeStore({ id: sc.id, speed });
      t = 0;
      playing = false;
      lastStepIdx = -2;
      lastTagKey = '';
      host.querySelectorAll('.tr-simprep-tab').forEach((b) => {
        const on = b.dataset.id === sc.id;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-selected', String(on));
      });
      $('.tr-simprep-title').textContent = sc.title;
      $('.tr-simprep-blurb').textContent = sc.blurb;
      $('[data-time="dur"]').textContent = fmtT(sc.duration);
      tl.setAttribute('aria-valuemax', String(sc.duration));
      scene = buildScene(svg, sc);
      // Crop empty sky for low profiles (e.g. the rejected takeoff) so the action fills the frame.
      const S = sc.scene || {};
      const peak = Math.max(...sc.keys.map((k) => k.h), ...(S.terrain || []).map((p) => p[1]), S.glide ? S.glide[0][1] : 0);
      const top = S.sky || S.microburst ? 0 : clamp(GROUND - peak - 100, 0, GROUND - 130);
      svg.setAttribute('viewBox', `0 ${top} 1000 ${360 - top}`);

      const phases = sc.phases.map((p, i) => ({ ...p, end: sc.phases[i + 1]?.t ?? sc.duration }));
      $('.tr-simprep-tl-phases').innerHTML = phases.map((p, i) => `
        <div class="tr-simprep-ph${i % 2 ? ' alt' : ''}" data-ph="${i}" style="left:${(p.t / sc.duration) * 100}%;width:${((p.end - p.t) / sc.duration) * 100}%">
          <span>${esc(p.label)}</span></div>`).join('');
      $('.tr-simprep-tl-ticks').innerHTML = sc.steps.map((s, i) => `
        <i class="tr-simprep-tick${s.decision ? ' is-dec' : ''}" data-tick="${i}" style="left:${(s.t / sc.duration) * 100}%" title="${esc(s.call || WHO[s.who])}"></i>`).join('');

      stepsEl.innerHTML = sc.steps.map((s, i) => `
        <li class="tr-simprep-step${s.decision ? ' is-dec' : ''}" data-step="${i}">
          <button type="button">
            <span class="st-t">${fmtT(s.t)}</span>
            <span class="st-body">
              <span class="st-top"><em class="who who--${s.who.toLowerCase()}">${esc(s.who === 'AURAL' ? 'Aural' : s.who === 'CREW' ? 'Crew' : s.who)}</em>
                ${s.call ? `<q>${esc(s.call)}</q>` : ''}${s.decision ? '<span class="st-dec">Decision point</span>' : ''}</span>
              <span class="st-note">${esc(s.note)}</span>
            </span>
          </button>
        </li>`).join('');
      stepsEl.scrollTop = 0;
      host.querySelector('[data-list="principles"]').innerHTML = sc.principles.map((p) => `<li>${esc(p)}</li>`).join('');
      host.querySelector('[data-list="examiner"]').innerHTML = sc.examiner.map((p) => `<li>${esc(p)}</li>`).join('');
      render();
    }

    function stepIndexAt(time) {
      let idx = -1;
      sc.steps.forEach((s, i) => { if (s.t <= time + 1e-6) idx = i; });
      return idx;
    }

    function render() {
      const s = sc.pos(t);
      const y = GROUND - s.h;
      const k = s.k;
      scene.acWrap.setAttribute('transform', `translate(${s.x.toFixed(2)},${y.toFixed(2)}) rotate(${(-s.p).toFixed(2)}) scale(1.25)`);
      const A = scene.ac;
      A.gear.style.display = k.gear ? '' : 'none';
      A.flap.style.display = k.flaps ? '' : 'none';
      A.spoiler.style.display = k.spdbrk ? '' : 'none';
      A.rev.style.display = k.rev ? '' : 'none';
      A.fail.style.display = k.eng === 'fail' ? '' : 'none';
      A.fire.style.display = k.eng === 'fire' ? '' : 'none';

      // Travelled trail
      const idx = clamp(Math.round(t / 0.05), 0, sc.cum.length - 1);
      scene.trail.style.strokeDasharray = `${sc.cum[idx].toFixed(1)} ${(sc.total + 10).toFixed(1)}`;

      // Status pills above the aircraft
      const tagList = [];
      if (k.eng === 'fail') tagList.push(['ENG FAIL', 'amber']);
      if (k.eng === 'fire') tagList.push(['ENG FIRE', 'red']);
      if (k.ap) tagList.push(['A/P', 'green']);
      if (k.spdbrk) tagList.push(['SPD BRK', 'blue']);
      if (k.rev) tagList.push(['REV', 'green']);
      const tagKey = tagList.map((x) => x[0]).join('|');
      if (tagKey !== lastTagKey) {
        lastTagKey = tagKey;
        scene.tags.innerHTML = '';
        let w = 0;
        const widths = tagList.map(([txt]) => txt.length * 6.1 + 12);
        const totalW = widths.reduce((a, b) => a + b, 0) + Math.max(0, tagList.length - 1) * 4;
        tagList.forEach(([txt, col], i) => {
          const g = el('g', { class: `tr-simprep-tag tag--${col}`, transform: `translate(${w - totalW / 2},0)` }, scene.tags);
          el('rect', { x: 0, y: -11, width: widths[i], height: 15, rx: 3 }, g);
          const tx = el('text', { x: widths[i] / 2, y: 0, 'text-anchor': 'middle' }, g);
          tx.textContent = txt;
          w += widths[i] + 4;
        });
      }
      const tagX = clamp(s.x, 60, 940);
      scene.tags.setAttribute('transform', `translate(${tagX.toFixed(1)},${(y - 56).toFixed(1)})`);

      if (scene.intruder) {
        const I = sc.scene.intruder;
        const ix = I.x0 + I.vx * t;
        const ih = Math.min(I.hMax, I.h0 + I.vh * t);
        scene.intruder.setAttribute('transform', `translate(${ix.toFixed(1)},${(GROUND - ih).toFixed(1)}) rotate(-3)`);
        scene.intruder.classList.toggle('is-ta', t >= 8 && t < 14);
        scene.intruder.classList.toggle('is-ra', t >= 14 && t < 25);
      }

      // HUD
      const phIdx = sc.phases.reduce((acc, p, i) => (p.t <= t + 1e-6 ? i : acc), 0);
      hud.phase.textContent = sc.phases[phIdx].label;
      hud.spd.textContent = k.spd || '—';
      hud.alt.textContent = k.alt || '—';
      hud.thr.textContent = k.thr || '—';
      hud.cfg.textContent = k.cfg || '—';
      host.querySelectorAll('.tr-simprep-ph').forEach((n, i) => n.classList.toggle('is-on', i === phIdx));

      // Timeline
      const f = (t / sc.duration) * 100;
      $('.tr-simprep-tl-head').style.left = `${f}%`;
      $('.tr-simprep-tl-fill').style.width = `${f}%`;
      tl.setAttribute('aria-valuenow', t.toFixed(1));
      $('[data-time="cur"]').textContent = fmtT(t);

      // Steps + callout banner
      const si = stepIndexAt(t);
      if (si !== lastStepIdx) {
        lastStepIdx = si;
        stepsEl.querySelectorAll('.tr-simprep-step').forEach((n, i) => {
          n.classList.toggle('is-past', i < si);
          n.classList.toggle('is-on', i === si);
        });
        host.querySelectorAll('.tr-simprep-tick').forEach((n, i) => n.classList.toggle('is-past', i <= si));
        const cur = stepsEl.querySelector('.tr-simprep-step.is-on');
        if (cur) {
          const top = cur.offsetTop - stepsEl.offsetTop;
          const want = top - stepsEl.clientHeight / 2 + cur.offsetHeight / 2;
          stepsEl.scrollTo({ top: Math.max(0, want), behavior: playing ? 'smooth' : 'auto' });
        }
      }
      const cs = si >= 0 ? sc.steps[si] : null;
      const showCall = cs && cs.call && t - cs.t < 3.2;
      callout.classList.toggle('is-on', !!showCall);
      if (cs && cs.call) {
        callout.querySelector('.who').textContent = WHO[cs.who] || cs.who;
        callout.querySelector('b').textContent = cs.call;
        callout.dataset.who = cs.who.toLowerCase();
      }

      playBtn.classList.toggle('is-playing', playing);
      playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
      host.querySelectorAll('[data-speed]').forEach((b) => b.classList.toggle('is-on', Number(b.dataset.speed) === speed));
    }

    function seek(time, keepPlaying = false) {
      t = clamp(time, 0, sc.duration);
      if (!keepPlaying) playing = false;
      render();
    }
    function togglePlay() {
      if (!playing && t >= sc.duration - 1e-3) t = 0;
      playing = !playing;
      render();
    }
    function jumpStep(dir) {
      const times = sc.steps.map((s) => s.t);
      if (dir > 0) {
        const nxt = times.find((x) => x > t + 0.05);
        seek(nxt ?? sc.duration);
      } else {
        const prev = [...times].reverse().find((x) => x < t - 0.3);
        seek(prev ?? 0);
      }
    }

    // ---- events ----
    host.querySelector('.tr-simprep-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-id]');
      if (b && b.dataset.id !== sc.id) loadScenario(b.dataset.id);
    });
    host.querySelector('.tr-simprep-controls').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.speed) {
        speed = Number(b.dataset.speed);
        writeStore({ id: sc.id, speed });
        render();
        return;
      }
      const act = b.dataset.act;
      if (act === 'play') togglePlay();
      else if (act === 'restart') { t = 0; playing = true; lastStepIdx = -2; render(); }
      else if (act === 'prev') jumpStep(-1);
      else if (act === 'next') jumpStep(1);
    });
    stepsEl.addEventListener('click', (e) => {
      const li = e.target.closest('[data-step]');
      if (li) seek(sc.steps[Number(li.dataset.step)].t + 0.001);
    });
    const tlTime = (e) => {
      const r = tl.getBoundingClientRect();
      return clamp((e.clientX - r.left) / r.width, 0, 1) * sc.duration;
    };
    let wasPlaying = false;
    tl.addEventListener('pointerdown', (e) => {
      dragging = true;
      wasPlaying = playing;
      tl.setPointerCapture(e.pointerId);
      seek(tlTime(e));
    });
    tl.addEventListener('pointermove', (e) => { if (dragging) seek(tlTime(e)); });
    const endDrag = () => { if (dragging) { dragging = false; if (wasPlaying && t < sc.duration) { playing = true; render(); } } };
    tl.addEventListener('pointerup', endDrag);
    tl.addEventListener('pointercancel', endDrag);
    tl.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { seek(t - 1); e.preventDefault(); e.stopPropagation(); }
      if (e.key === 'ArrowRight') { seek(t + 1); e.preventDefault(); e.stopPropagation(); }
    });
    const onKey = (e) => {
      if (!host.isConnected || e.defaultPrevented) return;
      const tag = (e.target.tagName || '').toLowerCase();
      if (['input', 'textarea', 'select'].includes(tag) || e.target.isContentEditable) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.code === 'Space' && !(tag === 'button' && host.contains(e.target))) { e.preventDefault(); togglePlay(); }
      else if (e.key === 'ArrowRight' && e.target === document.body) { e.preventDefault(); jumpStep(1); }
      else if (e.key === 'ArrowLeft' && e.target === document.body) { e.preventDefault(); jumpStep(-1); }
    };
    document.addEventListener('keydown', onKey);

    loadScenario(sc.id);

    return {
      tick(dt) {
        if (!playing || dragging) return;
        t += Math.min(dt, 0.1) * speed;
        if (t >= sc.duration) { t = sc.duration; playing = false; }
        render();
      },
      unmount() {
        document.removeEventListener('keydown', onKey);
        playing = false;
        host.innerHTML = '';
      },
    };
  },
};
