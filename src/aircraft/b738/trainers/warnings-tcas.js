// TCAS II trainer: ND traffic symbology, TA vs RA, RA types and vertical speed RA guidance.
// Logic is a simplified teaching model of TCAS II v7.1 thresholds (tau, ZTHR, ALIM), not the real CAS algorithm.
import { P, esc, clamp, alertBox, setAlert, slider, seg, bindSeg, bindSlider, dragOn } from './warnings-ui.js';

// sensitivity levels (simplified): tau in seconds, vertical thresholds in ft
const SL = {
  3: { name: '1,000–2,350 ft AGL', ta: 25, ra: 15, zta: 850, zra: 600, alim: 300, dmodTa: 0.33, dmodRa: 0.2 },
  4: { name: '2,350–5,000 ft', ta: 30, ra: 20, zta: 850, zra: 600, alim: 300, dmodTa: 0.48, dmodRa: 0.35 },
  5: { name: '5,000–10,000 ft', ta: 40, ra: 25, zta: 850, zra: 600, alim: 350, dmodTa: 0.75, dmodRa: 0.55 },
  6: { name: '10,000–20,000 ft', ta: 45, ra: 30, zta: 850, zra: 600, alim: 400, dmodTa: 1.0, dmodRa: 0.8 },
  7: { name: '20,000–42,000 ft', ta: 48, ra: 35, zta: 850, zra: 700, alim: 600, dmodTa: 1.3, dmodRa: 1.1 },
};
const KPX = 24; // px per nm on the ND
const OX = 200, OY = 318;

function vsY(v) { // Boeing-style non-linear VSI: 0–1000 fpm gets half the scale
  const a = Math.abs(v), s = Math.sign(v);
  const y = a <= 1000 ? (a / 1000) * 70 : a <= 2000 ? 70 + ((a - 1000) / 1000) * 40 : 110 + ((Math.min(a, 6000) - 2000) / 4000) * 40;
  return 160 - s * y;
}

export function mountTcas(el, sh) {
  const st = { range: 8, brg: 15, rel: 600, ivs: -1000, ovs: 0, closure: 480, sl: 6, run: false, clearT: 0, wasRa: false, lastRange: 8 };
  el.innerHTML = `<div class="${P}split ${P}split-tcas">
    <div class="${P}stack">
      <div class="${P}modehead"><span class="${P}modetag">TCAS II</span><h3>Traffic alerts and resolution advisories</h3></div>
      <p class="${P}p">TCAS interrogates other aircraft's transponders and predicts the closest point of approach (CPA). Alerts are based mainly on <b>time to CPA</b> (tau) rather than distance. A <b>TA</b> warns you to look out. An <b>RA</b> commands a vertical manoeuvre, coordinated with the other aircraft if it also has TCAS II.</p>
      ${seg('sl', 'Own altitude band (sensitivity level)', Object.entries(SL).map(([k, v]) => [k, v.name]), st.sl)}
      <div class="${P}grid2">
        ${slider('rel', 'Intruder relative altitude', -2500, 2500, 50, st.rel, ' ft')}
        ${slider('ivs', 'Intruder vertical speed', -3000, 3000, 100, st.ivs, ' fpm')}
        ${slider('ovs', 'Own vertical speed', -3000, 3000, 100, st.ovs, ' fpm')}
        ${slider('closure', 'Closure speed', 120, 900, 10, st.closure, ' kt')}
      </div>
      <div class="${P}row"><button type="button" class="${P}btn ${P}btn-accent" data-run>Run encounter</button><button type="button" class="${P}btn" data-reset>Reset</button>
        <span class="${P}fine">Drag the intruder on the ND to set bearing and range.</span></div>
      <div data-alert>${alertBox()}</div>
      <div class="${P}readout" data-read></div>
    </div>
    <div class="${P}stack">
      <div class="${P}tcasfig">
        <div class="${P}figure ${P}ndwrap"><svg class="${P}nd" viewBox="0 0 400 340" data-nd role="img" aria-label="Navigation display traffic"></svg></div>
        <div class="${P}figure ${P}vsiwrap"><svg class="${P}vsi" viewBox="0 0 90 320" data-vsi role="img" aria-label="Vertical speed indicator with RA guidance"></svg><div class="${P}vsicap">PFD V/S</div></div>
      </div>
      <div class="${P}symbols">
        <div><svg viewBox="-10 -10 20 20"><path d="M0 -7 L7 0 L0 7 L-7 0Z" class="${P}sym-other"/></svg><b>Other traffic</b><span>Hollow diamond. Outside proximate range.</span></div>
        <div><svg viewBox="-10 -10 20 20"><path d="M0 -7 L7 0 L0 7 L-7 0Z" class="${P}sym-prox"/></svg><b>Proximate</b><span>Filled diamond. Within about 6 nm and ±1,200 ft.</span></div>
        <div><svg viewBox="-10 -10 20 20"><circle r="6.5" class="${P}sym-ta"/></svg><b>Traffic advisory</b><span>Filled amber circle. “TRAFFIC, TRAFFIC”.</span></div>
        <div><svg viewBox="-10 -10 20 20"><rect x="-6" y="-6" width="12" height="12" class="${P}sym-ra"/></svg><b>Resolution advisory</b><span>Filled red square. Vertical manoeuvre commanded.</span></div>
      </div>
    </div>
  </div>
  <div class="${P}cols3">
    <div class="${P}card"><h4>Data tag</h4><p>The number is relative altitude in hundreds of feet: <b>+05</b> above the symbol means 500 ft above you, <b>−07</b> below the symbol means 700 ft below. An arrow appears when the intruder is climbing or descending at about 500 ft/min or more. Traffic without altitude reporting shows no tag and can only cause TAs.</p></div>
    <div class="${P}card"><h4>RA types</h4><ul class="${P}ul">
      <li><b>Corrective</b>: “CLIMB, CLIMB” / “DESCEND, DESCEND”. Change V/S into the green band, typically 1,500–2,000 ft/min.</li>
      <li><b>Level off</b>: “LEVEL OFF, LEVEL OFF” (version 7.1 replaced “ADJUST VERTICAL SPEED”). Reduce V/S toward zero.</li>
      <li><b>Preventive</b>: “MONITOR VERTICAL SPEED”. Keep the V/S out of the red band. No manoeuvre is needed.</li>
      <li><b>Others</b>: “MAINTAIN VERTICAL SPEED”, “INCREASE CLIMB/DESCENT”, crossing (“CLIMB, CROSSING CLIMB”) and reversals (“CLIMB, CLIMB NOW”). Then “CLEAR OF CONFLICT”.</li></ul></div>
    <div class="${P}card"><h4>Response (general principles)</h4><ul class="${P}ul">
      <li>TA: look for the traffic and get ready. Don't manoeuvre on a TA alone.</li>
      <li>RA: follow it promptly and smoothly, even if it conflicts with an ATC instruction. Never manoeuvre opposite to it. Use the autopilot/autothrottle technique in your FCOM.</li>
      <li>Tell ATC about the RA. After “CLEAR OF CONFLICT”, return promptly to your clearance.</li>
      <li>Stall, windshear and GPWS warnings take priority over an RA.</li></ul></div>
  </div>
  <p class="${P}fine">Thresholds shown are simplified from TCAS II version 7.1 (RAs inhibited at the lowest heights; TA-only below about 1,000 ft AGL). Real RA selection is far more complex. Follow your FCOM and company procedures.</p>`;

  const alertEl = el.querySelector(`[data-alert] .${P}alert`);
  const nd = el.querySelector('[data-nd]'), vsi = el.querySelector('[data-vsi]');
  const sliders = {};
  for (const [k, u] of [['rel', ' ft'], ['ivs', ' fpm'], ['ovs', ' fpm'], ['closure', ' kt']]) {
    sliders[k] = bindSlider(el, k, (v) => { st[k] = v; draw(); }, (v) => `${k === 'rel' && v > 0 ? '+' : ''}${v}${u}`);
  }
  bindSeg(el, 'sl', (v) => { st.sl = +v; draw(); });
  const relIn = el.querySelector('[data-in="rel"]'), relOut = el.querySelector('[data-out="rel"]');

  // static ND furniture
  nd.innerHTML = `<rect x="0" y="0" width="400" height="340" class="${P}nd-bg"/>
    <path d="M${OX - 7.5 * KPX} ${OY} A${7.5 * KPX} ${7.5 * KPX} 0 0 1 ${OX + 7.5 * KPX} ${OY}" class="${P}nd-ring"/>
    ${Array.from({ length: 12 }, (_, i) => { const a = (i * 30 * Math.PI) / 180; return `<circle cx="${OX + 3 * KPX * Math.sin(a)}" cy="${OY - 3 * KPX * Math.cos(a)}" r="1.8" class="${P}nd-dot"/>`; }).join('')}
    <text x="${OX + 7.5 * KPX * 0.72}" y="${OY - 7.5 * KPX * 0.72}" class="${P}nd-txt">7.5</text>
    <text x="10" y="18" class="${P}nd-txt">TFC</text><text x="390" y="18" text-anchor="end" class="${P}nd-txt">RANGE 15</text>
    <path d="M${OX} ${OY - 14} L${OX - 8} ${OY + 6} L${OX + 8} ${OY + 6} Z" class="${P}nd-own"/>
    <text data-ndalert x="200" y="40" text-anchor="middle" class="${P}nd-alert"></text>
    <g data-intr style="cursor:grab"><circle r="16" fill="transparent"/><g data-sym></g><text data-tag x="0" y="-12" text-anchor="middle" class="${P}nd-tag"></text><text data-arrow x="12" y="5" class="${P}nd-tag"></text></g>`;
  const intr = nd.querySelector('[data-intr]');
  const cleanup = dragOn(nd, intr, ({ x, y }) => {
    const dx = (x - OX) / KPX, dy = (OY - y) / KPX;
    st.range = clamp(Math.hypot(dx, dy), 0.3, 13); st.brg = (Math.atan2(dx, dy) * 180) / Math.PI;
    st.run = false; st.clearT = 0; st.wasRa = false; draw();
  });

  function evaluate() {
    const s = SL[st.sl];
    const approaching = st.run ? st.range > 0 && st.lastRange >= st.range : true;
    const tau = approaching ? (st.range / st.closure) * 3600 : Infinity;
    const vrate = st.ivs - st.ovs; // fpm, change of relative altitude
    const vclose = st.rel * vrate < 0 ? Math.abs(vrate) : 0;
    const vtau = vclose > 0 ? (Math.abs(st.rel) / vclose) * 60 : Infinity;
    const proj = (ovs) => st.rel + ((st.ivs - ovs) / 60) * Math.min(tau, 60);
    let level = 'other';
    if (st.range < 6 && Math.abs(st.rel) < 1200) level = 'prox';
    const taT = tau < s.ta || st.range < s.dmodTa;
    const raT = tau < s.ra || st.range < s.dmodRa;
    if (taT && (Math.abs(st.rel) < s.zta || vtau < s.ta)) level = 'ta';
    if (st.sl >= 3 && raT && (Math.abs(st.rel) < s.zra || vtau < s.ra) && Math.abs(proj(st.ovs)) < s.alim * 1.8) level = 'ra';
    let ra = null;
    if (level === 'ra') {
      const climb = Math.abs(proj(1500)) >= Math.abs(proj(-1500)) ? 1 : -1; // sense giving more separation
      const sense = st.rel > 150 ? -1 : st.rel < -150 ? 1 : climb;
      const okNow = Math.abs(proj(st.ovs)) >= s.alim && Math.sign(proj(st.ovs)) === Math.sign(st.rel || -sense);
      const okLevel = Math.abs(proj(0)) >= s.alim && Math.sign(proj(0)) === Math.sign(st.rel || -sense);
      if (okNow && st.ovs * sense >= 0) ra = { type: 'monitor', text: 'MONITOR V/S', aural: 'MONITOR VERTICAL SPEED' };
      else if (okLevel && st.ovs * sense < 0) ra = { type: 'level', text: 'LEVEL OFF', aural: 'LEVEL OFF, LEVEL OFF' };
      else ra = sense > 0 ? { type: 'climb', text: 'CLIMB', aural: 'CLIMB, CLIMB' } : { type: 'descend', text: 'DESCEND', aural: 'DESCEND, DESCEND' };
      ra.sense = sense;
      // red band: own V/S values that would not achieve ALIM
      const bad = [];
      for (let v = -6000; v <= 6000; v += 50) {
        const p = proj(v);
        if (Math.abs(p) < s.alim || Math.sign(p) !== Math.sign(st.rel || -sense)) bad.push(v);
      }
      ra.red = bad.length ? [bad[0], bad[bad.length - 1]] : null;
      ra.green = ra.type === 'climb' ? [1500, 2000] : ra.type === 'descend' ? [-2000, -1500] : ra.type === 'level' ? (sense > 0 ? [0, 300] : [-300, 0]) : null;
    }
    return { level, tau, vtau, ra, s, proj: proj(st.ovs) };
  }

  function draw() {
    const ev = evaluate();
    if (ev.level === 'ra') st.wasRa = true;
    const clear = st.clearT > 0;
    // ND intruder
    const x = OX + st.range * KPX * Math.sin((st.brg * Math.PI) / 180), y = OY - st.range * KPX * Math.cos((st.brg * Math.PI) / 180);
    intr.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
    const sym = { other: `<path d="M0 -7 L7 0 L0 7 L-7 0Z" class="${P}sym-other"/>`, prox: `<path d="M0 -7 L7 0 L0 7 L-7 0Z" class="${P}sym-prox"/>`, ta: `<circle r="6.5" class="${P}sym-ta"/>`, ra: `<rect x="-6" y="-6" width="12" height="12" class="${P}sym-ra"/>` }[ev.level];
    intr.querySelector('[data-sym]').innerHTML = sym;
    const tag = intr.querySelector('[data-tag]');
    const h = Math.round(Math.abs(st.rel) / 100);
    tag.textContent = `${st.rel >= 0 ? '+' : '−'}${String(h).padStart(2, '0')}`;
    tag.setAttribute('y', st.rel >= 0 ? -12 : 20);
    tag.dataset.level = ev.level;
    const ar = intr.querySelector('[data-arrow]');
    ar.textContent = Math.abs(st.ivs) >= 500 ? (st.ivs > 0 ? '↑' : '↓') : '';
    ar.dataset.level = ev.level;
    const nda = nd.querySelector('[data-ndalert]');
    nda.textContent = ev.level === 'ra' ? 'TRAFFIC' : ev.level === 'ta' ? 'TRAFFIC' : '';
    nda.dataset.level = ev.level;
    // alert
    if (clear && ev.level !== 'ra') setAlert(alertEl, 'CLEAR OF CONFLICT', 'advisory', 'CLEAR OF CONFLICT');
    else if (ev.level === 'ra') setAlert(alertEl, `RA: ${ev.ra.text}`, 'warning', ev.ra.aural);
    else if (ev.level === 'ta') setAlert(alertEl, 'TRAFFIC', 'caution', 'TRAFFIC, TRAFFIC');
    else setAlert(alertEl, ev.level === 'prox' ? 'Proximate traffic (no alert)' : '', 'ok', '');
    sh.sound(ev.level === 'ra' ? 'tone' : ev.level === 'ta' ? 'chime' : null);
    const t = (v) => (Number.isFinite(v) ? `${Math.round(v)} s` : '—');
    el.querySelector('[data-read]').innerHTML = `<span>Range</span><b>${st.range.toFixed(1)} nm</b><span>Tau (range / closure)</span><b>${t(ev.tau)}</b>
      <span>TA / RA tau at this level</span><b>${ev.s.ta} s / ${ev.s.ra} s</b><span>Predicted vertical miss</span><b>${Number.isFinite(ev.tau) ? `${Math.round(Math.abs(ev.proj))} ft` : '—'}</b>`;
    // VSI
    const ra = ev.ra;
    const band = (r, cls) => r ? `<rect x="38" y="${Math.min(vsY(r[0]), vsY(r[1]))}" width="16" height="${Math.max(2, Math.abs(vsY(r[0]) - vsY(r[1])))}" class="${cls}"/>` : '';
    vsi.innerHTML = `<rect x="0" y="0" width="90" height="320" rx="6" class="${P}nd-bg"/>
      <path d="M36 10 L56 10 L56 310 L36 310" class="${P}vsi-scale"/>
      ${band(ra?.red, `${P}vsi-red`)}${band(ra?.green, `${P}vsi-green`)}
      ${[-6000, -2000, -1000, -500, 0, 500, 1000, 2000, 6000].map((v) => `<line x1="${v % 1000 ? 50 : 46}" y1="${vsY(v)}" x2="56" y2="${vsY(v)}" class="${P}vsi-tk"/>${v % 1000 === 0 ? `<text x="32" y="${vsY(v) + 4}" text-anchor="end" class="${P}vsi-lbl">${Math.abs(v / 1000)}</text>` : ''}`).join('')}
      <line x1="84" y1="160" x2="56" y2="${vsY(st.ovs)}" class="${P}vsi-ptr"/>
      <text x="45" y="8" text-anchor="middle" class="${P}vsi-lbl">${st.ovs > 0 ? Math.round(st.ovs / 50) * 50 : ''}</text>`;
  }

  function reset() { Object.assign(st, { range: 8, brg: 15, run: false, clearT: 0, wasRa: false, lastRange: 8 }); draw(); }
  el.querySelector('[data-run]').addEventListener('click', () => { if (st.range < 1.5) st.range = 8; st.run = true; st.wasRa = false; st.clearT = 0; st.dir = -1; st.lastRange = st.range + 0.01; });
  el.querySelector('[data-reset]').addEventListener('click', reset);
  draw();

  return {
    tick(dt) {
      if (st.clearT > 0) { st.clearT -= dt; if (st.clearT <= 0) draw(); }
      if (!st.run) return;
      const sim = dt * 4; // time compression ×4
      st.lastRange = st.range;
      // approach along the bearing line until CPA, then recede on the far side
      if (st.dir < 0) { st.range -= (st.closure / 3600) * sim; if (st.range <= 0.15) { st.range = 0.15; st.dir = 1; st.brg += 180; } }
      else st.range += (st.closure / 3600) * sim;
      st.rel = clamp(st.rel + ((st.ivs - st.ovs) / 60) * sim, -2500, 2500);
      relIn.value = st.rel;
      relOut.textContent = `${st.rel > 0 ? '+' : ''}${Math.round(st.rel)} ft`;
      if (st.dir > 0 && st.wasRa && st.clearT <= 0) { st.clearT = 4; st.wasRa = false; }
      if (st.range > 10) st.run = false;
      draw();
    },
    unmount() { cleanup(); },
  };
}
