// Trainer: Automatic flight (AFDS). 2D NG mode control panel, PFD with FMA, map ND,
// a simplified flight model and guided exercises with a "Why did that happen?" log.
import './afds.css';
import { createSim } from './afds-sim.js';
import { createPFD, createND } from './afds-displays.js';
import { EXERCISES } from './afds-exercises.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const DONE_KEY = 'aircrafty:b738:afds:done';
const loadDone = () => { try { return new Set(JSON.parse(localStorage.getItem(DONE_KEY) || '[]')); } catch { return new Set(); } };
const saveDone = (set) => { try { localStorage.setItem(DONE_KEY, JSON.stringify([...set])); } catch { /* storage unavailable */ } };

const FREE = {
  id: 'free', title: 'Free play', level: 'Sandbox',
  brief: 'Level at 6000 ft, 250 kt, CMD A in HDG SEL / ALT HOLD. An FMC route (fictional waypoints) leads to the runway 27 ILS. Try anything: LNAV, VNAV, LVL CHG, V/S, CWS, APP, dual channel.',
  init: () => ({
    onGround: false, x: -26, y: 9, alt: 6000, holdAlt: 6000, altHoldAtSel: true, ias: 250, hdg: 40, route: true, leg: 1, crzAlt: 14000,
    at: 'MCP SPD', roll: 'HDG SEL', pitch: 'ALT HOLD',
    mcp: { cmdA: true, alt: 6000, spd: 250, hdg: 40, crsL: 270, crsR: 270 },
  }),
  steps: [],
};

// ---------------------------------------------------------------- MCP markup
const lampBtn = (id, label, extra = '') => `<button type="button" class="tr-afds-btn ${extra}" data-btn="${id}" aria-pressed="false"><i class="tr-afds-lamp"></i><span>${label}</span></button>`;
const knob = (id, label, cls = '') => `<div class="tr-afds-knob ${cls}" data-knob="${id}" role="slider" tabindex="0" aria-label="${label}" title="${label}: click left/right half, drag, or scroll (Shift = big steps)"><i></i></div>`;
const win = (id, label, w = 3) => `<div class="tr-afds-win" data-win="${id}" style="--d:${w}"><b data-val>${'8'.repeat(w)}</b></div><div class="tr-afds-cap">${label}</div>`;
const toggle = (id, label, lamp) => `
  <div class="tr-afds-tog-wrap">
    ${lamp ? `<i class="tr-afds-ma" data-lamp="${lamp}">${lamp.startsWith('MA') ? 'MA' : 'ARM'}</i>` : ''}
    <button type="button" class="tr-afds-tog" data-btn="${id}" aria-pressed="false" aria-label="${label}"><span></span></button>
    <div class="tr-afds-tog-lbl"><em>ON</em><em>OFF</em></div>
    <div class="tr-afds-cap">${label}</div>
  </div>`;

function mcpHTML() {
  return `
  <div class="tr-afds-mcp" data-mcp>
    <div class="tr-afds-sec tr-afds-crs">${win('CRSL', 'COURSE')}${knob('CRSL', 'Course (captain)')}</div>
    <div class="tr-afds-sec tr-afds-fd">${toggle('FDL', 'F/D', 'MAL')}</div>
    <div class="tr-afds-sec tr-afds-at">
      ${toggle('ATARM', 'A/T ARM', 'ATARM')}
      <div class="tr-afds-col">${lampBtn('N1', 'N1')}${lampBtn('SPEED', 'SPEED')}</div>
    </div>
    <div class="tr-afds-sec tr-afds-spd">
      ${win('SPD', 'IAS/MACH', 3)}
      <div class="tr-afds-row">
        <button type="button" class="tr-afds-mini" data-btn="CO">C/O</button>
        ${knob('SPD', 'Speed')}
        <button type="button" class="tr-afds-mini" data-btn="SPDINTV">SPD<br>INTV</button>
      </div>
    </div>
    <div class="tr-afds-sec tr-afds-col tr-afds-vcol">${lampBtn('VNAV', 'VNAV')}${lampBtn('LVLCHG', 'LVL<br>CHG')}</div>
    <div class="tr-afds-sec tr-afds-hdg">
      ${win('HDG', 'HEADING')}
      <div class="tr-afds-row tr-afds-hdgrow">
        <div class="tr-afds-bank" data-knob="BANK" role="slider" tabindex="0" aria-label="Bank angle limit" title="Bank angle limit: click or scroll the outer ring">
          <span class="tr-afds-bank-val" data-bank>25</span>
          ${knob('HDG', 'Heading', 'is-hdg')}
        </div>
      </div>
      ${lampBtn('HDGSEL', 'HDG<br>SEL')}
    </div>
    <div class="tr-afds-sec tr-afds-col tr-afds-lcol">${lampBtn('LNAV', 'LNAV')}${lampBtn('VORLOC', 'VOR<br>LOC')}${lampBtn('APP', 'APP')}</div>
    <div class="tr-afds-sec tr-afds-alt">
      ${win('ALT', 'ALTITUDE', 5)}
      <div class="tr-afds-row">${knob('ALT', 'Altitude')}<button type="button" class="tr-afds-mini" data-btn="ALTINTV">ALT<br>INTV</button></div>
      ${lampBtn('ALTHLD', 'ALT<br>HLD')}
    </div>
    <div class="tr-afds-sec tr-afds-vs">
      ${win('VS', 'VERT SPEED', 5)}
      <div class="tr-afds-wheel" data-knob="VS" role="slider" tabindex="0" aria-label="Vertical speed thumbwheel" title="V/S wheel: click UP/DN half, drag, or scroll (down = UP)">
        <span class="tr-afds-wheel-dn">DN</span><div class="tr-afds-wheel-face"><i></i></div><span class="tr-afds-wheel-up">UP</span>
      </div>
      ${lampBtn('VS', 'V/S')}
    </div>
    <div class="tr-afds-sec tr-afds-ap">
      <div class="tr-afds-cap tr-afds-ap-cap">A/P ENGAGE</div>
      <div class="tr-afds-grid2">
        ${lampBtn('CMDA', 'CMD A', 'is-ap')}${lampBtn('CMDB', 'CMD B', 'is-ap')}
        ${lampBtn('CWSA', 'CWS A', 'is-ap')}${lampBtn('CWSB', 'CWS B', 'is-ap')}
      </div>
      <button type="button" class="tr-afds-bar" data-btn="DISCBAR" aria-pressed="false"><span>DISENGAGE</span></button>
    </div>
    <div class="tr-afds-sec tr-afds-fd">${toggle('FDR', 'F/D', 'MAR')}</div>
    <div class="tr-afds-sec tr-afds-crs">${win('CRSR', 'COURSE')}${knob('CRSR', 'Course (first officer)')}</div>
  </div>`;
}

// ---------------------------------------------------------------- input helpers
function bindKnob(el, onStep, { vertical = false, invert = false } = {}) {
  let down = null, acc = 0, moved = false;
  const big = (e) => e.shiftKey;
  const onDown = (e) => {
    if (e.button !== 0) return;
    e.stopPropagation(); e.preventDefault();
    down = { x: e.clientX, y: e.clientY, shift: e.shiftKey }; acc = 0; moved = false;
    el.setPointerCapture?.(e.pointerId);
    el.classList.add('is-grab');
  };
  const onMove = (e) => {
    if (!down) return;
    const d = vertical ? (e.clientY - down.y) * (invert ? -1 : 1) : (e.clientX - down.x) - (e.clientY - down.y);
    const n = Math.trunc(d / 9);
    if (n !== acc) { onStep(n - acc, e.shiftKey); acc = n; moved = true; }
  };
  const onUp = (e) => {
    if (!down) return;
    el.classList.remove('is-grab');
    if (!moved) {
      const r = el.getBoundingClientRect();
      const s = vertical ? ((e.clientY - r.top) > r.height / 2 ? 1 : -1) * (invert ? -1 : 1) : ((e.clientX - r.left) > r.width / 2 ? 1 : -1);
      onStep(s, down.shift);
    }
    down = null;
  };
  const onWheel = (e) => {
    e.preventDefault(); e.stopPropagation();
    const dir = e.deltaY < 0 ? 1 : -1;
    onStep(vertical && invert ? -dir : dir, big(e));
  };
  const onKey = (e) => {
    const map = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 1, PageDown: -1 };
    if (map[e.key] == null) return;
    e.preventDefault(); e.stopPropagation();
    onStep(map[e.key] * (vertical && invert ? -1 : 1), e.shiftKey || e.key.startsWith('Page'));
  };
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', () => { down = null; el.classList.remove('is-grab'); });
  el.addEventListener('wheel', onWheel, { passive: false });
  el.addEventListener('keydown', onKey);
}

const fmtT = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

export default {
  id: 'afds',
  title: 'Automatic flight (AFDS)',
  group: 'Automation',
  summary: 'MCP, FMA and autothrottle modes: fly guided exercises and see why each mode change happens.',
  mount(el, ctx) {
    const done = loadDone();
    let current = null; // exercise
    let stepIdx = 0, finished = false, showHint = false;
    let speed = 1, paused = false;
    const pressed = new Set();
    const log = [];
    const sim = createSim((e) => onEvent(e));
    const rotations = {};

    el.innerHTML = `
    <div class="tr-afds">
      <header class="tr-afds-head">
        <div>
          <div class="eyebrow">Automation · 737 NG</div>
          <h2>Automatic flight <span>AFDS · A/T</span></h2>
          <p>Mode control panel, flight mode annunciations and autothrottle logic on a simplified flight model. Pick an exercise or fly freely.</p>
        </div>
        <div class="tr-afds-exlist" data-exlist></div>
      </header>

      <div class="tr-afds-mcpwrap" data-mcpwrap>${mcpHTML()}</div>

      <div class="tr-afds-main">
        <div class="tr-afds-displays">
          <figure class="tr-afds-du"><canvas data-pfd width="470" height="470" aria-label="Primary flight display"></canvas><figcaption>PFD · FMA</figcaption></figure>
          <figure class="tr-afds-du"><canvas data-nd width="420" height="470" aria-label="Navigation display"></canvas><figcaption>ND · MAP <button type="button" class="tr-afds-link" data-range>range</button></figcaption></figure>
          <div class="tr-afds-ped">
            <div class="tr-afds-ped-grp">
              <div class="tr-afds-cap2">Thrust levers</div>
              <div class="tr-afds-lever"><input type="range" min="0" max="100" step="1" data-lever aria-label="Thrust levers (manual)"><div class="tr-afds-n1" data-n1>N1 —</div></div>
              <div class="tr-afds-ped-btns">
                <button type="button" class="tr-afds-hw is-toga" data-btn="TOGA" title="TO/GA switch (on the thrust levers)">TO/GA</button>
                <button type="button" class="tr-afds-hw" data-btn="ATDISC" title="A/T disconnect switch (on the thrust levers)">A/T DISC</button>
              </div>
            </div>
            <div class="tr-afds-ped-grp">
              <div class="tr-afds-cap2">Control wheel</div>
              <button type="button" class="tr-afds-hw is-red" data-btn="APDISC" title="A/P disconnect switch (control wheel)">A/P DISC</button>
            </div>
            <div class="tr-afds-ped-grp">
              <div class="tr-afds-cap2">Autoflight status</div>
              <div class="tr-afds-asa"><i data-asa="ap">A/P</i><i data-asa="at">A/T</i><i data-asa="fmc">FMC</i></div>
            </div>
            <div class="tr-afds-ped-grp tr-afds-simctl">
              <div class="tr-afds-cap2">Simulation</div>
              <div class="tr-afds-seg" data-speed>
                <button type="button" data-sp="0">❚❚</button><button type="button" data-sp="1" class="is-on">1×</button><button type="button" data-sp="2">2×</button><button type="button" data-sp="4">4×</button>
              </div>
              <button type="button" class="tr-afds-reset" data-reset>Restart</button>
            </div>
          </div>
        </div>

        <aside class="tr-afds-side">
          <section class="tr-afds-card" data-excard></section>
          <section class="tr-afds-card tr-afds-logcard">
            <div class="tr-afds-cardhead"><h3>Why did that happen?</h3><button type="button" class="tr-afds-link" data-clearlog>clear</button></div>
            <ol class="tr-afds-log" data-log></ol>
          </section>
        </aside>
      </div>

      <section class="tr-afds-ref">
        <details>
          <summary>Reading the FMA and the MCP</summary>
          <div class="tr-afds-refgrid">
            <div><h4>FMA columns</h4><p>Left: autothrottle. Middle: roll. Right: pitch. Active modes are green on the top line; armed modes are white underneath. A box is drawn round a mode for about 10 seconds after it changes. The autopilot status (CMD, FD, SINGLE CH) sits above the attitude display.</p></div>
            <div><h4>Speed on pitch vs. speed on thrust</h4><p>LVL CHG, VNAV SPD and TO/GA hold speed with the elevator and use fixed thrust (N1, or idle via RETARD → ARM). V/S, ALT ACQ, ALT HOLD, VNAV PTH and G/S fly a path with pitch and leave the speed to the autothrottle (MCP SPD / FMC SPD).</p></div>
            <div><h4>Switch lights</h4><p>A lit MCP switch means the mode is selected and can normally be deselected by pushing it again or by choosing another mode. Some lights go out when the AFDS takes over automatically — e.g. ALT HLD after an automatic capture of the selected altitude, or APP once both LOC and G/S are captured.</p></div>
            <div><h4>Autothrottle modes</h4><p><b>N1</b> fixed thrust limit · <b>MCP SPD / FMC SPD</b> hold a speed · <b>RETARD</b> levers moving to idle · <b>ARM</b> no active mode, levers free · <b>THR HLD</b> servos inhibited on the takeoff roll from 84 kt · <b>GA</b> go-around thrust.</p></div>
          </div>
          <p class="tr-afds-note">Simplified teaching model: thrust, climb and turn numbers are illustrative, and some behaviours (VNAV descent, speed reversions, alpha floor, Mach changeover logic) are omitted. Annunciations and lighting can differ with FCC software and operator options. Your operator's FCOM and FCTM take precedence.</p>
        </details>
      </section>
    </div>`;

    const $ = (sel) => el.querySelector(sel);
    const $$ = (sel) => [...el.querySelectorAll(sel)];
    const pfd = createPFD($('[data-pfd]'));
    const nd = createND($('[data-nd]'));

    // ---------------- MCP scaling (designed at 1180 px) ----------------
    const mcpWrap = $('[data-mcpwrap]'), mcp = $('[data-mcp]');
    const fitMcp = () => {
      const w = mcpWrap.clientWidth || 1180;
      const k = Math.min(1.25, w / 1180);
      mcp.style.transform = `scale(${k})`;
      mcpWrap.style.height = `${mcp.offsetHeight * k}px`;
    };
    const ro = new ResizeObserver(fitMcp);
    ro.observe(mcpWrap);
    fitMcp();

    // ---------------- events ----------------
    function onEvent(e) {
      if (e.kind === 'deny') { ctx.toast?.(e.text, 'warn'); }
      log.unshift(e);
      if (log.length > 60) log.pop();
      renderLog();
    }
    function renderLog() {
      const ol = $('[data-log]');
      if (!log.length) { ol.innerHTML = '<li class="tr-afds-empty">Mode changes and their reasons appear here.</li>'; return; }
      ol.innerHTML = log.map((e, i) => `
        <li class="is-${e.kind}${i === 0 ? ' is-new' : ''}">
          <time>${fmtT(e.t)}</time>
          <div><b>${esc(e.text)}</b>${e.why ? `<p>${esc(e.why)}</p>` : ''}</div>
        </li>`).join('');
    }

    // ---------------- buttons ----------------
    $$('[data-btn]').forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.btn;
      pressed.add(id);
      const r = sim.press(id);
      b.classList.add('is-press'); setTimeout(() => b.classList.remove('is-press'), 140);
      if (r && r.ok === false) b.classList.add('is-deny'), setTimeout(() => b.classList.remove('is-deny'), 400);
      refresh(true);
    }));
    $$('[data-knob]').forEach((k) => {
      const id = k.dataset.knob;
      const vertical = id === 'VS';
      bindKnob(k, (n, big) => {
        if (!n) return;
        sim.turn(id, n, big);
        rotations[id] = (rotations[id] || 0) + n * (id === 'BANK' ? 30 : 12);
        const face = id === 'VS' ? k.querySelector('.tr-afds-wheel-face i') : k.querySelector(':scope > i');
        if (face) face.style.transform = id === 'VS' ? `translateY(${((rotations[id] % 24) + 24) % 24 - 12}px)` : `rotate(${rotations[id]}deg)`;
        refresh(true);
      }, { vertical, invert: false });
    });
    const lever = $('[data-lever]');
    lever.addEventListener('input', () => {
      if (!sim.setManualLever(lever.value / 100)) ctx.toast?.('The autothrottle is driving the levers. Disconnect it (or wait for ARM / THR HLD) to move them by hand.', 'warn');
    });
    $('[data-range]').addEventListener('click', (e) => { e.target.textContent = `${nd.cycleRange()} NM`; });
    $('[data-range]').textContent = '20 NM';
    $$('[data-sp]').forEach((b) => b.addEventListener('click', () => {
      const v = +b.dataset.sp;
      paused = v === 0; if (v) speed = v;
      $$('[data-sp]').forEach((x) => x.classList.toggle('is-on', x === b));
    }));
    $('[data-reset]').addEventListener('click', () => start(current));
    $('[data-clearlog]').addEventListener('click', () => { log.length = 0; renderLog(); });

    // ---------------- exercises ----------------
    function renderExList() {
      const all = [...EXERCISES, FREE];
      $('[data-exlist]').innerHTML = all.map((x, i) => `
        <button type="button" class="tr-afds-ex${current?.id === x.id ? ' is-active' : ''}${done.has(x.id) ? ' is-done' : ''}" data-ex="${x.id}">
          <span class="tr-afds-exn">${x.id === 'free' ? '∞' : i + 1}</span><span>${esc(x.title)}</span>
        </button>`).join('');
      $$('[data-ex]').forEach((b) => b.addEventListener('click', () => start(all.find((x) => x.id === b.dataset.ex))));
    }
    function renderCard() {
      const x = current;
      const card = $('[data-excard]');
      const steps = x.steps;
      card.innerHTML = `
        <div class="tr-afds-cardhead"><h3>${esc(x.title)}</h3><span class="tr-afds-lvl">${esc(x.level)}</span></div>
        <p class="tr-afds-brief">${esc(x.brief)}</p>
        ${steps.length ? `
          <div class="tr-afds-prog"><i style="width:${(stepIdx / steps.length) * 100}%"></i></div>
          <ol class="tr-afds-steps">
            ${steps.map((st, i) => `<li class="${i < stepIdx ? 'is-done' : i === stepIdx && !finished ? 'is-cur' : ''}">
              <span class="tr-afds-chk">${i < stepIdx ? '✓' : i + 1}</span>
              <div>${esc(st.text)}${i === stepIdx && !finished && showHint ? `<p class="tr-afds-hint">${esc(st.hint)}</p>` : ''}</div></li>`).join('')}
          </ol>
          ${finished ? `<div class="tr-afds-success"><b>Exercise complete</b><p>${esc(x.done)}</p></div>`
            : `<button type="button" class="tr-afds-link" data-hint>${showHint ? 'Hide hint' : 'Show hint'}</button>`}`
          : '<p class="tr-afds-free">No checklist — experiment freely. Every automatic change is explained in the log below.</p>'}
        ${sim.s.stopped && sim.s.stopped !== 'landed' ? '<div class="tr-afds-stop">Simulation stopped — press Restart.</div>' : ''}`;
      card.querySelector('[data-hint]')?.addEventListener('click', () => { showHint = !showHint; renderCard(); });
    }
    function start(x) {
      current = x || EXERCISES[0];
      sim.load(current.init());
      pfd.reset();
      stepIdx = 0; finished = false; showHint = false; pressed.clear();
      log.length = 0;
      onEvent({ t: 0, kind: 'info', text: `Exercise loaded: ${current.title}`, why: current.brief });
      renderExList(); renderCard(); refresh(true);
      lever.value = Math.round(sim.s.lever * 100);
    }

    // ---------------- per-frame refresh ----------------
    const cache = {};
    const setText = (key, node, v) => { if (cache[key] !== v) { cache[key] = v; node.textContent = v; } };
    const winEls = Object.fromEntries($$('[data-win]').map((w) => [w.dataset.win, w.querySelector('[data-val]')]));
    const btnEls = Object.fromEntries($$('[data-btn]').map((b) => [b.dataset.btn, b]));
    const lampEls = Object.fromEntries($$('[data-lamp]').map((b) => [b.dataset.lamp, b]));
    let lastStopped = null;
    function refresh(force) {
      const s = sim.s, m = s.mcp, L = sim.lights();
      const pad = (v, n) => String(v).padStart(n, ' ');
      setText('crsl', winEls.CRSL, String(m.crsL).padStart(3, '0'));
      setText('crsr', winEls.CRSR, String(m.crsR).padStart(3, '0'));
      setText('hdg', winEls.HDG, String(m.hdg).padStart(3, '0'));
      setText('alt', winEls.ALT, pad(m.alt, 5));
      let spdTxt = '';
      if (!(s.vnav && !m.spdIntv)) {
        if (m.mach) { const mach = m.spd * (1 + s.alt / 1000 * 0.018) / (661.5 * Math.sqrt(1 - Math.min(36000, s.alt) * 6.875e-6)); spdTxt = `.${Math.round(mach * 1000).toString().padStart(3, '0').slice(-3)}`; }
        else spdTxt = pad(m.spd, 3);
      }
      setText('spd', winEls.SPD, spdTxt);
      setText('vs', winEls.VS, s.pitch === 'V/S' ? `${m.vs > 0 ? '+' : m.vs < 0 ? '-' : ' '}${pad(Math.abs(m.vs), 4)}` : '');
      setText('bank', $('[data-bank]'), String(m.bank));
      const bankEl = $('.tr-afds-bank');
      bankEl.style.setProperty('--bank', `${(m.bank - 20) * 9}deg`);
      for (const [k, b] of Object.entries(btnEls)) {
        if (k in L) { const on = !!L[k]; if (cache[`l${k}`] !== on) { cache[`l${k}`] = on; b.classList.toggle('is-lit', on); b.setAttribute('aria-pressed', String(on)); } }
      }
      for (const k of ['FDL', 'FDR', 'ATARM']) {
        const on = k === 'ATARM' ? m.atArm : m[k === 'FDL' ? 'fdL' : 'fdR'];
        btnEls[k].classList.toggle('is-on', on); btnEls[k].setAttribute('aria-pressed', String(on));
      }
      lampEls.MAL?.classList.toggle('is-lit', L.MAL);
      lampEls.MAR?.classList.toggle('is-lit', L.MAR);
      lampEls.ATARM?.classList.toggle('is-lit', L.ATARM);
      btnEls.DISCBAR.classList.toggle('is-down', m.discBar);
      btnEls.DISCBAR.setAttribute('aria-pressed', String(m.discBar));
      // ASA
      const blink = Math.floor(performance.now() / 400) % 2 === 0;
      $('[data-asa="ap"]').classList.toggle('is-red', s.warnAP && blink);
      $('[data-asa="at"]').classList.toggle('is-red', s.warnAT && blink);
      setText('n1', $('[data-n1]'), `N1 ${s.n1.toFixed(1)}%`);
      if (document.activeElement !== lever) lever.value = Math.round(s.lever * 100);
      lever.classList.toggle('is-auto', !sim.canMoveLevers());
      if (s.stopped !== lastStopped) { lastStopped = s.stopped; renderCard(); }
      if (force) { pfd.draw(sim, s.t); nd.draw(sim); }
    }

    function checkSteps() {
      if (!current || finished || !current.steps.length) return;
      let changed = false;
      while (stepIdx < current.steps.length && current.steps[stepIdx].check(sim.s, { pressed })) { stepIdx++; changed = true; showHint = false; }
      if (stepIdx >= current.steps.length) {
        finished = true; changed = true;
        if (!done.has(current.id)) { done.add(current.id); saveDone(done); }
        ctx.toast?.(`Exercise complete: ${current.title}`, 'info');
        renderExList();
      }
      if (changed) renderCard();
    }

    start(EXERCISES[0]);

    return {
      tick(dt) {
        if (!paused) sim.tick(Math.min(dt, 0.1) * speed);
        checkSteps();
        refresh(false);
        pfd.draw(sim, sim.s.t);
        nd.draw(sim);
      },
      unmount() { ro.disconnect(); el.innerHTML = ''; },
    };
  },
};

