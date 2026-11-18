// Shared bits for the warning systems trainer: optional WebAudio tones, alert boxes, small form helpers.
export const P = 'tr-warnings-';
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** Tone generator. Off until enabled; one alert sound at a time. Patterns approximate the character of each alert. */
export function createAudio() {
  let ctx = null, enabled = false, kind = null, timer = null, gain = null;
  const ensure = () => {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      gain = ctx.createGain(); gain.gain.value = 0.12; gain.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };
  const beep = (freq, dur, type = 'square', at = 0, vol = 1) => {
    const c = ctx; if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq;
    const t0 = c.currentTime + at;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.008);
    g.gain.setValueAtTime(vol, t0 + dur - 0.02); g.gain.linearRampToValueAtTime(0, t0 + dur);
    o.connect(g); g.connect(gain); o.start(t0); o.stop(t0 + dur + 0.02);
  };
  const PATTERNS = {
    horn: { every: 0.5, play: () => beep(420, 0.26, 'square') },                     // intermittent horn
    steady: { every: 0.5, play: () => beep(420, 0.5, 'square') },                    // continuous horn
    clacker: { every: 0.12, play: () => beep(1400, 0.03, 'square', 0, 0.8) },        // overspeed clacker
    tone: { every: 1.2, play: () => { beep(880, 0.16, 'sine'); beep(660, 0.22, 'sine', 0.2); } }, // voice-alert placeholder
    whoop: { every: 1.4, play: () => { beep(500, 0.35, 'sawtooth', 0, 0.6); beep(900, 0.25, 'sawtooth', 0.35, 0.6); } },
    siren: { every: 1.0, play: () => { beep(700, 0.45, 'triangle'); beep(1000, 0.45, 'triangle', 0.5); } },
    shaker: { every: 0.25, play: () => beep(38, 0.22, 'sawtooth', 0, 1) },
    chime: { every: 2.5, play: () => beep(1050, 0.5, 'sine') },
  };
  function stop() { clearInterval(timer); timer = null; }
  function start() {
    stop();
    if (!enabled || !kind || !PATTERNS[kind] || !ensure()) return;
    const p = PATTERNS[kind];
    p.play();
    timer = setInterval(() => p.play(), p.every * 1000);
  }
  return {
    get enabled() { return enabled; },
    setEnabled(v) { enabled = v; if (v) ensure(); start(); },
    set(k) { if (k === kind) return; kind = k; start(); },
    dispose() { stop(); try { ctx?.close(); } catch { /* ignore */ } ctx = null; },
  };
}

/** PFD/EICAS-style alert box: level 'warning' (red) | 'caution' (amber) | 'advisory' | 'ok' | ''. */
export function alertBox(text = '', level = '', aural = '') {
  return `<div class="${P}alert" data-level="${level}"><div class="${P}alert-text">${esc(text || 'NO ALERT')}</div>${aural ? `<div class="${P}alert-aural">Aural: “${esc(aural)}”</div>` : `<div class="${P}alert-aural">&nbsp;</div>`}</div>`;
}
export function setAlert(el, text, level, aural) {
  if (!el) return;
  const key = `${text}|${level}|${aural}`;
  if (el.dataset.key === key) return;
  el.dataset.key = key;
  el.dataset.level = level || '';
  el.querySelector(`.${P}alert-text`).textContent = text || 'NO ALERT';
  el.querySelector(`.${P}alert-aural`).innerHTML = aural ? `Aural: “${esc(aural)}”` : '&nbsp;';
}

export function slider(key, label, min, max, step, value, unit = '') {
  return `<label class="${P}slider"><span class="${P}slabel">${esc(label)} <b data-out="${key}">${value}${unit}</b></span>
    <input type="range" data-in="${key}" min="${min}" max="${max}" step="${step}" value="${value}"></label>`;
}
export function seg(key, label, options, value) {
  return `<div class="${P}segwrap"><span class="${P}slabel">${esc(label)}</span><div class="${P}seg" data-seg="${key}">
    ${options.map(([v, t]) => `<button type="button" data-v="${v}" class="${String(v) === String(value) ? 'is-on' : ''}">${esc(t)}</button>`).join('')}</div></div>`;
}
export function bindSeg(root, key, fn) {
  const w = root.querySelector(`[data-seg="${key}"]`);
  w.addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    w.querySelectorAll('button').forEach((x) => x.classList.toggle('is-on', x === b));
    fn(b.dataset.v);
  });
}
export function bindSlider(root, key, fn, fmt = (v) => v) {
  const i = root.querySelector(`[data-in="${key}"]`), o = root.querySelector(`[data-out="${key}"]`);
  const upd = () => { const v = +i.value; if (o) o.textContent = fmt(v); fn(v); };
  i.addEventListener('input', upd);
  return { set(v) { i.value = v; upd(); }, get: () => +i.value };
}
export function pointInPoly([x, y], poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
export function svgPoint(svg, ev) {
  const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
  const m = svg.getScreenCTM(); if (!m) return { x: 0, y: 0 };
  const p = pt.matrixTransform(m.inverse()); return { x: p.x, y: p.y };
}
/** Pointer-drag helper: calls fn({x,y}) in SVG coordinates while dragging. Returns cleanup. */
export function dragOn(svg, target, fn) {
  let on = false;
  const down = (e) => { on = true; svg.setPointerCapture?.(e.pointerId); fn(svgPoint(svg, e)); e.preventDefault(); };
  const move = (e) => { if (on) fn(svgPoint(svg, e)); };
  const up = () => { on = false; };
  target.addEventListener('pointerdown', down);
  svg.addEventListener('pointermove', move);
  svg.addEventListener('pointerup', up);
  svg.addEventListener('pointercancel', up);
  return () => { target.removeEventListener('pointerdown', down); svg.removeEventListener('pointermove', move); svg.removeEventListener('pointerup', up); svg.removeEventListener('pointercancel', up); };
}
