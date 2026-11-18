// Trainer: FMC preflight. A CDU replica with a guided 737 NG preflight on a fictional example flight.
import './fmc.css';
import { createData, eff, rteActive, EXAMPLE, gw } from './fmc-pages.js';
import { PAGES } from './fmc-screens.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------------------------------------------------------------- guidance content
const STEPS = [
  { id: 'ident', title: 'Check IDENT', hint: 'Push INIT REF, then <IDENT (L1) on the index if needed. Check aircraft model, engine rating and that the active nav database dates cover today.', keys: ['INITREF', 'L1'], check: (d) => d.identSeen },
  { id: 'ref', title: 'POS INIT: reference airport ESSA', hint: 'From IDENT push POS INIT> (R6). Type ESSA and push L2 (REF AIRPORT).', keys: ['R6', 'L2'], check: (d) => d.pos.ref === 'ESSA' },
  { id: 'irs', title: 'POS INIT: set the IRS position', hint: 'Push R2 to copy the airport position into the scratchpad (or R1 for LAST POS, or a GPS position from page 2), then push R4 (SET IRS POS).', keys: ['R2', 'R4'], check: (d) => d.pos.irs && Math.abs(d.pos.irs.lat - 59.65) < 0.1 && Math.abs(d.pos.irs.lon - 17.92) < 0.15 },
  { id: 'od', title: 'RTE: origin ESSA, destination EKCH', hint: 'ROUTE> (R6) or the RTE key. ESSA → L1, EKCH → R1.', keys: ['RTE', 'L1', 'R1'], check: (d) => eff(d).rte.origin === 'ESSA' && eff(d).rte.dest === 'EKCH' },
  { id: 'flt', title: 'RTE: flight number ACY123', hint: 'Type ACY123 and push R2 (FLT NO.).', keys: ['R2'], check: (d) => d.rte.flt === 'ACY123' },
  { id: 'legs', title: 'RTE page 2: NOSLI, T317 to TEBRA, ELMIN', hint: 'NEXT PAGE. NOSLI → R1 (TO; VIA fills with DIRECT). T317 → L2 (VIA), TEBRA → R2. ELMIN → R3.', keys: ['NEXT', 'R1', 'L2', 'R2', 'R3'], check: (d) => legsOk(eff(d)) },
  { id: 'act', title: 'ACTIVATE the route and EXEC', hint: 'Push ACTIVATE> (R6) — the EXEC light comes on — then push EXEC.', keys: ['R6', 'EXEC'], check: (d) => rteActive(d) },
  { id: 'dep', title: 'DEP/ARR: runway 19R, SID NOSLI1C, EXEC', hint: 'DEP ARR key → <DEP (L1). Select 19R on the right, NOSLI1C on the left. The title shows MOD: check RTE/LEGS, then EXEC.', keys: ['DEPARR', 'L1', 'EXEC'], check: (d) => !d.pending && d.dep.rwy === '19R' && d.dep.sid === 'NOSLI1C' },
  { id: 'perf', title: 'PERF INIT: ZFW, reserves, cost index, cruise altitude', hint: 'From RTE push PERF INIT> (R6) or INIT REF → <PERF. ZFW 58.4 → L3, reserves 2.6 → L4, cost index 30 → L5, FL350 (or 350) → R1.', keys: ['L3', 'L4', 'L5', 'R1'], check: (d) => d.perf.zfw === EXAMPLE.zfw && d.perf.reserves === EXAMPLE.reserves && d.perf.ci === EXAMPLE.ci && d.perf.crz === EXAMPLE.crz },
  { id: 'n1', title: 'N1 LIMIT: TO-1 derate and assumed temperature 40°C', hint: 'N1 LIMIT> (R6 from PERF INIT) or the N1 LIMIT key. Push <TO-1 (L3) — CLB-1 is selected with it. Type 40 → L1 (SEL).', keys: ['N1LIMIT', 'L3', 'L1'], check: (d) => d.n1.to === 'TO-1' && d.n1.sel === EXAMPLE.sel },
  { id: 'tod', title: 'TAKEOFF REF: flaps 5 and CG 25.0%', hint: 'TAKEOFF> (R6). 5 → L1 (FLAPS), 25 → L3 (CG). The stabilizer trim appears next to the CG.', keys: ['R6', 'L1', 'L3'], check: (d) => d.to.flaps === EXAMPLE.flaps && d.to.cg === EXAMPLE.cg },
  { id: 'vs', title: 'TAKEOFF REF: select V1, VR and V2', hint: 'With an empty scratchpad push R1, R2 and R3 to accept each QRH speed. (Your airline may require speeds from its own performance tool instead.)', keys: ['R1', 'R2', 'R3'], check: (d) => d.to.v1 && d.to.vr && d.to.v2 },
];
function legsOk(e) {
  const L = e.rte.legs.map(([v, t]) => `${v}>${t}`);
  const want = ['NOSLI', 'T317>TEBRA', 'DIRECT>ELMIN'];
  return L.length === 3 && (L[0] === 'DIRECT>NOSLI' || L[0] === `${e.dep.sid}>NOSLI`) && L[1] === want[1] && L[2] === want[2];
}

const ABOUT = {
  index: ['INIT/REF INDEX', 'The menu of initialization and reference pages. During preflight the FMC usually leads you page to page with the R6 prompt at the bottom right.'],
  ident: ['IDENT', 'Confirms the aircraft model, engine thrust rating, the FMC software and which navigation database is active. Check the active database dates include today — the database is updated every 28 days (AIRAC cycle).'],
  pos: ['POS INIT', 'Gives the inertial reference systems their starting position during alignment. Enter the departure airport (and gate if available) for a reference position, then copy the most accurate position into SET IRS POS. The IRS must be in ALIGN for the entry to be used.'],
  rte: ['RTE', 'Page 1 holds origin, destination, flight number and runway. Page 2 onwards lists the route as VIA (airway or DIRECT) and TO (the waypoint where that segment ends). A route must be ACTIVATED and EXECuted before LNAV/VNAV can use it.'],
  deparr: ['DEP/ARR INDEX', 'Gateway to the departure (runways, SIDs, transitions) and arrival (STARs, approaches) procedures for the origin and destination of the route.'],
  dep: ['DEPARTURES', 'Select the departure runway and SID from the database. Choices show <SEL> while they are a modification, and <ACT> once executed. Selecting creates a MOD route: review it on RTE/LEGS, then EXEC — or ERASE to undo.'],
  arr: ['ARRIVALS', 'STARs and approaches for the destination. These are normally selected in flight before descent planning, once the landing runway is known.'],
  legs: ['LEGS', 'Every waypoint of the route in sequence, with course and distance between them and any speed/altitude constraints on the right. The active waypoint is shown in magenta once the route is active.'],
  perf: ['PERF INIT', 'Weights, reserves, cost index and cruise altitude. With these the FMC computes gross weight, VNAV profiles and economy speeds. Weights here are in 1000 kg (example values from a fictional loadsheet). Fuel on board comes from the fuel quantity system.'],
  n1: ['N1 LIMIT', 'Choose the takeoff thrust: full rating or a fixed derate (TO-1/TO-2), optionally combined with an assumed temperature (SEL) for further reduction. Selecting a takeoff derate also selects the matching climb derate. N1 values shown are illustrative only.'],
  takeoff: ['TAKEOFF REF', 'Takeoff flaps, CG (gives the stabilizer trim setting) and the V-speeds. QRH speeds appear in small font when flaps and gross weight are known; pushing the key selects them into large font. Changing flaps, weight or thrust after selection deletes the speeds.'],
  clb: ['CLIMB', 'Climb page: target speed, speed restriction and cruise altitude. Mostly used once airborne; the cruise altitude can also be entered here.'],
  crz: ['CRUISE', 'Cruise page: cruise altitude, economy target speed and step climbs. Used in flight.'],
  des: ['DESCENT', 'Descent page: end of descent altitude, target speed and restrictions. Used in flight.'],
  hold: ['HOLD', 'Builds holding patterns at a waypoint or present position. Not part of preflight.'],
  prog: ['PROGRESS', 'Flight progress: distance and ETA to the next waypoints and destination, fuel predictions. Useful once the route is active.'],
  fix: ['FIX INFO', 'Draws reference circles and radials from a fix on the ND. Not part of preflight.'],
  menu: ['MENU', 'Selects which system the CDU talks to (FMC, ACARS and others).'],
};

// ---------------------------------------------------------------- CDU markup
const LSK = (side, n) => `<button type="button" class="tr-fmc-lsk tr-fmc-lsk-${side}" data-k="${side}${n}" style="--r:${n}" aria-label="Line select key ${side}${n}"></button>`;
const FK = (k, label, extra = '') => `<button type="button" class="tr-fmc-key tr-fmc-fn ${extra}" data-k="${k}">${label}</button>`;
const CK = (k, label = k, extra = '') => `<button type="button" class="tr-fmc-key tr-fmc-ch ${extra}" data-k="${k}">${label}</button>`;

function cduHTML() {
  const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  return `
  <div class="tr-fmc-cdu" data-cdu tabindex="0" aria-label="Control display unit. Click to focus, then type on your keyboard.">
    <div class="tr-fmc-top">
      <div class="tr-fmc-lsks">${[1, 2, 3, 4, 5, 6].map((n) => LSK('L', n)).join('')}</div>
      <div class="tr-fmc-screen" data-screen></div>
      <div class="tr-fmc-lsks">${[1, 2, 3, 4, 5, 6].map((n) => LSK('R', n)).join('')}</div>
    </div>
    <div class="tr-fmc-fnrow">
      ${FK('INITREF', 'INIT<br>REF')}${FK('RTE', 'RTE')}${FK('CLB', 'CLB')}${FK('CRZ', 'CRZ')}${FK('DES', 'DES')}
      <div class="tr-fmc-brt" title="Brightness (not modelled)"><span>BRT</span><i></i></div>
    </div>
    <div class="tr-fmc-fnrow">
      ${FK('MENU', 'MENU')}${FK('LEGS', 'LEGS')}${FK('DEPARR', 'DEP<br>ARR')}${FK('HOLD', 'HOLD')}${FK('PROG', 'PROG')}
      <button type="button" class="tr-fmc-key tr-fmc-fn tr-fmc-exec" data-k="EXEC"><i class="tr-fmc-execbar"></i>EXEC</button>
    </div>
    <div class="tr-fmc-fnrow tr-fmc-fnrow3">
      ${FK('N1LIMIT', 'N1<br>LIMIT')}${FK('FIX', 'FIX')}<span></span><span></span><span></span><span></span>
    </div>
    <div class="tr-fmc-fnrow tr-fmc-fnrow4">
      ${FK('PREV', 'PREV<br>PAGE')}${FK('NEXT', 'NEXT<br>PAGE')}
    </div>
    <div class="tr-fmc-pad">
      <div class="tr-fmc-ann"><i data-ann="msg">M<br>S<br>G</i><i data-ann="fail">F<br>A<br>I<br>L</i></div>
      <div class="tr-fmc-num">
        ${['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'].map((c) => CK(c)).join('')}${CK('+/-', '+/−')}
      </div>
      <div class="tr-fmc-alpha">
        ${alpha.map((c) => CK(c)).join('')}${CK('SP', 'SP', 'is-sm')}${CK('DEL', 'DEL', 'is-sm')}${CK('/', '/')}${CK('CLR', 'CLR', 'is-sm')}
      </div>
      <div class="tr-fmc-ann"><i data-ann="dspy">D<br>S<br>P<br>Y</i><i data-ann="ofst">O<br>F<br>S<br>T</i></div>
    </div>
  </div>`;
}

export default {
  id: 'fmc',
  title: 'FMC preflight',
  group: 'Automation',
  summary: 'A working CDU: set up IDENT, POS INIT, RTE, DEP/ARR, PERF INIT, N1 LIMIT and TAKEOFF REF for an example flight.',
  mount(el, ctx) {
    let d = createData();
    let page = 'ident', sub = 0;
    let sp = '', msg = null, focused = false, showAll = false;
    let clrTimer = null, clrLong = false;
    const doneSet = new Set();

    el.innerHTML = `
    <div class="tr-fmc">
      <header class="tr-fmc-head">
        <div>
          <div class="eyebrow">Automation · 737 NG</div>
          <h2>FMC preflight <span>CDU</span></h2>
          <p>Initialise the flight management computer for an example flight, page by page, as you would before engine start. Click the CDU and type on your keyboard, or use the keys.</p>
        </div>
        <div class="tr-fmc-headbtns">
          <button type="button" class="tr-fmc-btn" data-reset>Reset FMC</button>
        </div>
      </header>
      <div class="tr-fmc-main">
        <div class="tr-fmc-cduwrap" data-cduwrap>${cduHTML()}</div>
        <div class="tr-fmc-side">
          <section class="tr-fmc-card tr-fmc-flight">
            <div class="tr-fmc-cardhead"><h3>Example flight</h3><span class="tr-fmc-tag">Fictional · example values</span></div>
            <dl class="tr-fmc-dl">
              <dt>Flight</dt><dd>ACY123 · ESSA → EKCH</dd>
              <dt>Route</dt><dd>NOSLI1C NOSLI T317 TEBRA DCT ELMIN</dd>
              <dt>Departure</dt><dd>RWY 19R · SID NOSLI1C</dd>
              <dt>Cruise</dt><dd>FL350 · cost index 30</dd>
              <dt>Loadsheet</dt><dd>ZFW 58.4 t · fuel 9.4 t · reserves 2.6 t</dd>
              <dt>Takeoff</dt><dd>Flaps 5 · CG 25.0% · TO-1 + assumed 40°C · OAT +12°C</dd>
            </dl>
            <p class="tr-fmc-fine">Airports are real; waypoints, airways and procedures are invented for training. Not for navigation. Performance figures are illustrative only.</p>
          </section>
          <section class="tr-fmc-card">
            <div class="tr-fmc-cardhead"><h3>Preflight</h3><span class="tr-fmc-count" data-count></span></div>
            <div class="tr-fmc-prog"><i data-prog></i></div>
            <ol class="tr-fmc-steps" data-steps></ol>
            <label class="tr-fmc-keyshow"><input type="checkbox" data-showkeys checked> Highlight the keys for the current step</label>
          </section>
          <section class="tr-fmc-card tr-fmc-about" data-about></section>
          <section class="tr-fmc-card tr-fmc-conv">
            <h3>Screen conventions</h3>
            <ul>
              <li><span class="tr-fmc-sw"><b class="tr-fmc-box">□□□</b></span> Boxes: required entry.</li>
              <li><span class="tr-fmc-sw"><b>---</b></span> Dashes: optional entry.</li>
              <li><span class="tr-fmc-sw"><b class="tr-fmc-sm">LABEL</b></span> Small font: labels, computed or default values.</li>
              <li><span class="tr-fmc-sw"><b>DATA</b></span> Large font: entered or selected data.</li>
              <li><span class="tr-fmc-sw"><b class="tr-fmc-g">&lt;ACT&gt;</b></span> Active / selected item. <b class="tr-fmc-mg">Magenta</b>: active waypoint.</li>
              <li><span class="tr-fmc-sw"><b>MOD</b></span> Title prefix: a change waiting for EXEC.</li>
            </ul>
            <p class="tr-fmc-fine">Keyboard: letters and digits type into the scratchpad · Backspace = CLR (hold to clear all) · Delete = DEL · Enter = EXEC · PgUp / PgDn = PREV / NEXT PAGE · Esc releases the keyboard. Colours and some layouts vary with CDU type and FMC software; follow your operator's FCOM.</p>
          </section>
        </div>
      </div>
    </div>`;

    const $ = (s) => el.querySelector(s);
    const $$ = (s) => [...el.querySelectorAll(s)];
    const cdu = $('[data-cdu]'), screen = $('[data-screen]');
    const keyEls = Object.fromEntries($$('[data-k]').map((b) => [b.dataset.k, b]));

    // ---------------- api for page handlers ----------------
    const api = {
      get sp() { return msg ? '' : sp; },
      clear() { sp = ''; },
      copy(t) { if (!msg && !sp) sp = t; },
      go(p, s = 0) { page = p; sub = s; },
      note(m) { msg = m; },
      info(text) { ctx.toast?.(text, 'info'); },
    };

    // ---------------- rendering ----------------
    let cur = null;
    function render() {
      cur = PAGES[page](d, sub);
      const rowsHTML = [];
      const pg = cur.pg ? `<span class="tr-fmc-pg">${cur.pg}</span>` : '';
      rowsHTML.push(`<div class="tr-fmc-row tr-fmc-title"><span class="tr-fmc-c"><span class="tr-fmc-l">${esc(cur.title)}</span></span><span class="tr-fmc-r">${pg}</span></div>`);
      cur.rows.forEach((r, i) => {
        const lab = (t) => (t ? (t.startsWith('<span') ? t : `<span class="tr-fmc-s">${esc(t)}</span>`) : '');
        if (r.sep && !r.L[0] && !r.R[0] && !r.C[0]) {
          rowsHTML.push(`<div class="tr-fmc-row tr-fmc-lab"><span class="tr-fmc-c"><span class="tr-fmc-s">------------------------</span></span></div>`);
        } else {
          rowsHTML.push(`<div class="tr-fmc-row tr-fmc-lab"><span class="tr-fmc-lft">${lab(r.L[0])}</span><span class="tr-fmc-c">${r.sep ? '<span class="tr-fmc-s">--------</span>' : ''}${lab(r.C[0])}</span><span class="tr-fmc-r">${lab(r.R[0])}</span></div>`);
        }
        rowsHTML.push(`<div class="tr-fmc-row tr-fmc-dat" data-row="${i + 1}"><span class="tr-fmc-lft">${r.L[1] || ''}</span><span class="tr-fmc-c">${r.C[1] || ''}</span><span class="tr-fmc-r">${r.R[1] || ''}</span></div>`);
      });
      const spText = msg || sp;
      rowsHTML.push(`<div class="tr-fmc-row tr-fmc-sp${msg ? ' is-msg' : ''}"><span class="tr-fmc-lft"><span class="tr-fmc-l">${esc(spText)}</span>${focused && !msg ? '<span class="tr-fmc-caret"></span>' : ''}</span></div>`);
      screen.innerHTML = rowsHTML.join('');
      const execLit = d.rte.state === 'armed' || !!d.pending;
      keyEls.EXEC.classList.toggle('is-lit', execLit);
      $('[data-ann="msg"]').classList.toggle('is-lit', !!msg);
      // LSKs that do something on this page
      for (const s of ['L', 'R']) for (let n = 1; n <= 6; n++) keyEls[`${s}${n}`].classList.toggle('is-live', !!cur.keys[`${s}${n}`]);
      renderSide();
    }

    function renderSide() {
      // steps
      STEPS.forEach((s) => { if (s.check(d)) doneSet.add(s.id); else doneSet.delete(s.id); });
      const firstOpen = STEPS.findIndex((s) => !doneSet.has(s.id));
      $('[data-steps]').innerHTML = STEPS.map((s, i) => {
        const isDone = doneSet.has(s.id), isCur = i === firstOpen;
        return `<li class="${isDone ? 'is-done' : ''}${isCur ? ' is-cur' : ''}">
          <span class="tr-fmc-chk">${isDone ? '✓' : i + 1}</span>
          <div><b>${esc(s.title)}</b>${isCur ? `<p>${esc(s.hint)}</p>` : ''}</div></li>`;
      }).join('') + (firstOpen === -1 ? '<li class="tr-fmc-allok"><b>Preflight complete.</b><p>All pages are set. On TAKEOFF REF the PRE-FLT status is complete. In the aircraft, cross-check every entry with the other pilot and against the flight plan and loadsheet.</p></li>' : '');
      $('[data-count]').textContent = `${doneSet.size}/${STEPS.length}`;
      $('[data-prog]').style.width = `${(doneSet.size / STEPS.length) * 100}%`;
      const hlOn = $('[data-showkeys]').checked;
      $$('.tr-fmc-key.is-hint, .tr-fmc-lsk.is-hint').forEach((k) => k.classList.remove('is-hint'));
      if (hlOn && firstOpen >= 0) STEPS[firstOpen].keys.forEach((k) => keyEls[k]?.classList.add('is-hint'));
      // about
      const [t, body] = ABOUT[page] || ['', ''];
      $('[data-about]').innerHTML = `<div class="tr-fmc-cardhead"><h3>On this page: ${esc(t)}</h3></div><p>${esc(body)}</p>`;
    }

    // ---------------- key handling ----------------
    function press(k) {
      const b = keyEls[k];
      if (b) { b.classList.add('is-press'); setTimeout(() => b.classList.remove('is-press'), 110); }
      if (/^[LR][1-6]$/.test(k)) {
        const h = cur.keys[k];
        if (h) {
          const r = h(api);
          if (typeof r === 'string') { msg = r; }
        }
      } else if (/^[A-Z0-9./]$/.test(k)) {
        if (msg) return render();
        if (sp === 'DELETE') sp = '';
        if (sp.length < 24) sp += k;
      } else if (k === 'SP') { if (!msg && sp !== 'DELETE' && sp.length < 24) sp += ' '; }
      else if (k === '+/-') {
        if (msg) return render();
        if (sp.endsWith('-')) sp = `${sp.slice(0, -1)}+`;
        else if (sp.endsWith('+')) sp = `${sp.slice(0, -1)}-`;
        else if (sp.length < 24) sp += '-';
      } else if (k === 'DEL') { if (!msg && !sp) sp = 'DELETE'; }
      else if (k === 'CLR') {
        if (msg) msg = null;
        else if (sp === 'DELETE') sp = '';
        else sp = sp.slice(0, -1);
      } else if (k === 'EXEC') {
        if (d.rte.state === 'armed') { d.rte.state = 'active'; ctx.toast?.('Route activated: the title now reads ACT RTE 1.', 'info'); }
        else if (d.pending) { d.rte = { ...d.pending.rte, state: 'active' }; d.dep = d.pending.dep; d.pending = null; }
      } else if (k === 'PREV' || k === 'NEXT') {
        const total = parseInt((cur.pg || '1/1').split('/')[1], 10) || 1;
        sub = ((sub + (k === 'NEXT' ? 1 : -1)) % total + total) % total;
      } else {
        const map = { INITREF: initRefPage(), RTE: 'rte', CLB: 'clb', CRZ: 'crz', DES: 'des', MENU: 'menu', LEGS: 'legs', DEPARR: 'deparr', HOLD: 'hold', PROG: 'prog', N1LIMIT: 'n1', FIX: 'fix' };
        if (map[k]) { page = map[k]; sub = 0; }
      }
      render();
    }
    function initRefPage() {
      if (!d.identSeen) return 'ident';
      if (!d.pos.irs) return 'pos';
      if (!(d.perf.zfw != null && d.perf.reserves != null && d.perf.ci != null && d.perf.crz != null) && rteActive(d)) return 'perf';
      if (gw(d) != null) return 'takeoff';
      return 'index';
    }

    $$('[data-k]').forEach((b) => {
      const k = b.dataset.k;
      if (k === 'CLR') {
        b.addEventListener('pointerdown', () => { clrLong = false; clrTimer = setTimeout(() => { clrLong = true; msg = null; sp = ''; render(); }, 650); });
        const end = () => clearTimeout(clrTimer);
        b.addEventListener('pointerup', end); b.addEventListener('pointerleave', end);
        b.addEventListener('click', () => { if (!clrLong) press('CLR'); cdu.focus({ preventScroll: true }); });
      } else b.addEventListener('click', () => { press(k); cdu.focus({ preventScroll: true }); });
    });

    // physical keyboard (capture phase, so global shortcuts don't fire while the CDU has focus)
    let bsTimer = null;
    const onKey = (e) => {
      if (!focused || e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key;
      let k = null;
      if (/^[a-zA-Z0-9./]$/.test(key)) k = key.toUpperCase();
      else if (key === ' ') k = 'SP';
      else if (key === '-' || key === '+') k = '+/-';
      else if (key === 'Backspace') k = 'CLR';
      else if (key === 'Delete') k = 'DEL';
      else if (key === 'Enter') k = 'EXEC';
      else if (key === 'PageUp') k = 'PREV';
      else if (key === 'PageDown') k = 'NEXT';
      else if (key === 'Escape') { cdu.blur(); e.stopPropagation(); return; }
      if (!k) return;
      e.preventDefault(); e.stopPropagation();
      if (k === 'CLR') {
        if (e.repeat) { if (!bsTimer) bsTimer = setTimeout(() => { msg = null; sp = ''; render(); }, 300); return; }
      }
      press(k);
    };
    const onKeyUp = (e) => { if (e.key === 'Backspace') { clearTimeout(bsTimer); bsTimer = null; } };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('keyup', onKeyUp, true);
    const onFocus = () => { focused = true; cdu.classList.add('is-focus'); render(); };
    const onBlur = () => { focused = false; cdu.classList.remove('is-focus'); render(); };
    cdu.addEventListener('focus', onFocus);
    cdu.addEventListener('blur', onBlur);
    $('[data-showkeys]').addEventListener('change', renderSide);
    $('[data-reset]').addEventListener('click', () => {
      d = createData(); page = 'ident'; sub = 0; sp = ''; msg = null; render();
      ctx.toast?.('FMC reset: all preflight entries cleared.', 'info');
    });

    // scale the CDU to the column
    const wrap = $('[data-cduwrap]');
    const fit = () => {
      const k = Math.min(1.15, Math.max(0.6, (wrap.clientWidth || 520) / 520));
      cdu.style.transform = `scale(${k})`;
      wrap.style.height = `${cdu.offsetHeight * k}px`;
    };
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);

    render();
    fit();
    return {
      unmount() {
        document.removeEventListener('keydown', onKey, true);
        document.removeEventListener('keyup', onKeyUp, true);
        clearTimeout(clrTimer); clearTimeout(bsTimer);
        ro.disconnect();
        el.innerHTML = '';
      },
    };
  },
};
