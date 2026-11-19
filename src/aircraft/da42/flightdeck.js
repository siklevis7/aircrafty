// Procedural Diamond DA42 NG cockpit with a Garmin G1000. Local coordinates: cabin floor at y = 0,
// +x forward, +z to the right seat; the pilot sits at z ≈ -0.32. Each clickable zone is a mesh with
// userData.partId matching flightdeck-parts.js. Switch plates are painted canvases (albedo plus an
// additive glow layer) with real 3D toggles and knobs instanced on top, and they drive the shared
// systems controller (systems.set). The G1000 displays are live canvases drawn every frame.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { makeCanvas, canvasTexture, paintPanel, drawLabel, rrect } from '../../core/panelcanvas.js';
import { createControlKit, buildOutside } from '../b738/flightdeck-geometry.js';
import { paintSet, cbPanelCanvas } from '../b738/flightdeck-textures.js';
import { FLAP_POSITIONS } from './systems.js';
import { VOTER_POSITIONS, FUEL_POSITIONS } from './flightdeck-systems.js';
import * as D from './flightdeck-displays.js';
import {
  makeMaterials, buildShell, buildGlareshield, buildFrontSeat, buildRearBench, buildStick, buildPedals,
  buildAirframeOutside, buildCompass, noRay,
} from './flightdeck-geometry.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const PPM = 3000; // switch plate canvas resolution (px per metre)
const PPM_DU = 3800; // display screens

// ---- layout item helpers -------------------------------------------------------------------
const T = (label, extra = {}) => ({ t: 'toggle', label, ...extra });
const G = (label, extra = {}) => ({ t: 'guard', label, ...extra });
const K = (label, extra = {}) => ({ t: 'knob', label, ...extra });
const A = (text, color = 'amber', extra = {}) => ({ t: 'annun', text, color, ...extra });
const B = (text, extra = {}) => ({ t: 'button', text, ...extra });
const ONOFF = ['ON', 'OFF'];
const PLATE = '#2e3135'; // DA42 switch plates: dark grey with white legends

const LAYOUTS = {
  elec: { bg: PLATE, screws: false, rows: [[
    T('ELECT.\nMASTER', { key: 'elec.master', marks: ONOFF, scale: 0.9 }),
    T('ALT L', { key: 'elec.alt1', marks: ONOFF, scale: 0.9 }),
    T('ALT R', { key: 'elec.alt2', marks: ONOFF, scale: 0.9 }),
    T('AVIONIC\nMASTER', { key: 'elec.avionics', marks: ONOFF, scale: 0.9 }),
    G('ESS BUS', { key: 'elec.essBus', marks: ONOFF, scale: 0.9 }),
  ]] },
  engine: { bg: PLATE, screws: false, rows: [[
    T('ENGINE\nMASTER L', { key: 'engMaster1', marks: ONOFF, scale: 0.9 }),
    T('ENGINE\nMASTER R', { key: 'engMaster2', marks: ONOFF, scale: 0.9 }),
    B('START\nL', { key: 'start1', ts: 0.2, bw: 1.0, bh: 0.9, name: 'START L', litFn: (S) => (S.c?.engines?.[0]?.run && S.c.engines[0].rpm < 850 ? '#e8e2c8' : null) }),
    B('START\nR', { key: 'start2', ts: 0.2, bw: 1.0, bh: 0.9, name: 'START R', litFn: (S) => (S.c?.engines?.[1]?.run && S.c.engines[1].rpm < 850 ? '#e8e2c8' : null) }),
  ]] },
  ecu: { bg: PLATE, screws: false, rows: [[
    T('VOTER L', { key: 'voter1', values: VOTER_POSITIONS, marks: ['AUTO', 'A', 'B'], scale: 0.9 }),
    B('ECU\nTEST L', { key: 'ecuTest1', ts: 0.19, bw: 1.0, bh: 0.9, name: 'ECU TEST L', litFn: (S) => (S.c?.engines?.[0]?.test ? '#ffb000' : null) }),
    B('ECU\nTEST R', { key: 'ecuTest2', ts: 0.19, bw: 1.0, bh: 0.9, name: 'ECU TEST R', litFn: (S) => (S.c?.engines?.[1]?.test ? '#ffb000' : null) }),
    T('VOTER R', { key: 'voter2', values: VOTER_POSITIONS, marks: ['AUTO', 'A', 'B'], scale: 0.9 }),
  ]] },
  fuelPitot: { bg: PLATE, screws: false, rows: [[
    T('FUEL PUMP\nL', { key: 'fuelPump1', marks: ONOFF }),
    T('FUEL PUMP\nR', { key: 'fuelPump2', marks: ONOFF }),
  ]] },
  pitot: { bg: PLATE, screws: false, rows: [[T('PITOT\nHEAT', { key: 'pitotHeat', marks: ONOFF })]] },
  extLights: { bg: PLATE, screws: false, rows: [[
    T('LANDING', { key: 'light.landing', marks: ONOFF, scale: 0.9 }),
    T('TAXI', { key: 'light.taxi', marks: ONOFF, scale: 0.9 }),
    T('POSITION', { key: 'light.nav', marks: ONOFF, scale: 0.9 }),
    T('STROBE', { key: 'light.strobe', marks: ONOFF, scale: 0.9 }),
  ]] },
  intLights: { bg: PLATE, screws: false, rows: [[
    T('INSTR\nLIGHT', { key: 'light.panel', marks: ONOFF, scale: 0.9 }),
    T('FLOOD', { key: 'light.flood', marks: ONOFF, scale: 0.9 }),
    K('DIM', { angle: 0.6, style: 'round', scale: 0.8, marks: [{ a: -1.2, t: 'MIN' }, { a: 1.2, t: 'MAX' }] }),
  ]] },
  emergency: { bg: PLATE, screws: false, rows: [[
    G('EMERG', { key: 'elec.emergency', marks: ONOFF, name: 'EMERGENCY switch' }),
    A('EMERG\nON', 'amber', { lit: (S) => !!S.s('elec.emergency'), ts: 0.17, aw: 1.1 }),
  ]] },
  flaps: { bg: PLATE, screws: false, rowH: [1.1, 2.2], rows: [
    [A('UP', 'green', { lit: (S) => S.a.flapUp.state !== 'off', ts: 0.24, aw: 1.1, ah: 0.5 }), A('APP', 'amber', { lit: (S) => S.a.flapApp.state !== 'off', ts: 0.24, aw: 1.1, ah: 0.5 }), A('LDG', 'amber', { lit: (S) => S.a.flapLdg.state !== 'off', ts: 0.24, aw: 1.1, ah: 0.5 })],
    [T('FLAPS', { key: 'flapLever', values: FLAP_POSITIONS, marks: ['UP', 'APP', 'LDG'], scale: 1.0 })],
  ] },
};

// ---- builder -------------------------------------------------------------------------------------
export function buildFlightDeck(systems) {
  const root = new THREE.Group();
  root.name = 'da42-flightdeck';
  const mats = makeMaterials();
  const kit = createControlKit(mats);
  const paintNormal = paintSet().normal;
  let night = false;

  const getS = (k) => systems.state[k];
  const trySet = (k, v) => systems.set(k, v);

  // one systems snapshot per frame, shared by every zone
  let S = null;
  const snap = () => {
    if (S) return S;
    const p = systems.panel();
    S = { p, c: p.cockpit, a: systems.annunciators(), s: getS };
    return S;
  };
  const backlit = () => night && !!getS('light.panel') && !!getS('elec.master');

  // ---- world and cabin
  const outside = buildOutside(root);
  outside.group.position.y = 1.85; // apron ~0.75 m below the cabin floor
  outside.setNight(false);
  const shell = buildShell(root, mats);
  buildGlareshield(root, mats);
  const airframe = buildAirframeOutside(root, mats);

  // ---- lights
  const hemi = new THREE.HemisphereLight(0xeaf2fb, 0x5a564f, 0.35);
  root.add(hemi);
  const spot = (pos, target, color, angle = 0.8, dist = 2.5) => {
    const l = new THREE.SpotLight(color, 0, dist, angle, 0.7, 2);
    l.position.copy(pos); l.target.position.copy(target); root.add(l, l.target); return l;
  };
  // LED flood light in the roll-over bar behind the front seats, aimed at the panel
  const flood = spot(V(-0.62, 1.1, 0), V(0.5, 0.55, 0), 0xfff1de, 0.75, 2.6);
  const floodLeds = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.18), new THREE.MeshStandardMaterial({ color: '#222', emissive: '#fff4e0', emissiveIntensity: 0 }));
  floodLeds.position.set(-0.6, 1.11, 0); root.add(noRay(floodLeds));
  // glareshield lip strip light washing down the panel at night (instrument lighting)
  const panelWash = [-0.25, 0.25].map((z) => spot(V(0.47, 0.84, z), V(0.52, 0.45, z), 0xffe6c4, 1.0, 0.9));

  // ---- zone helpers
  const zones = []; // { mesh, refresh(force) }
  function facing(pos, dir, parent = root) {
    const g = new THREE.Group(); g.position.copy(pos); parent.add(g);
    g.lookAt(pos.clone().add(dir.clone().normalize()));
    return g;
  }
  const overlayMat = (tex) => {
    const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    m.color.setScalar(1.6);
    return m;
  };

  /**
   * A painted zone. `drawer` is a layout object (rows of controls) or a function (ctx, W, H, state, glowCtx).
   * opts: { screen, state(), regions, side, ppm, z, subs: [{ partId, area }] }
   */
  function zone(parent, partId, w, h, x, y, drawer, opts = {}) {
    const layout = typeof drawer === 'function' ? null : drawer;
    const ppm = opts.ppm || (opts.screen ? PPM_DU : PPM);
    const canvas = makeCanvas(w, h, ppm);
    const tex = canvasTexture(canvas);
    const glowCanvas = opts.screen || opts.noGlow ? null : makeCanvas(w, h, ppm);
    const glowTex = glowCanvas ? canvasTexture(glowCanvas) : null;
    const overrides = {};
    let controls = [];
    const slots = new Map();
    const normal = paintNormal.clone(); normal.repeat.set(w / 0.05, h / 0.05); normal.needsUpdate = true;
    const z0 = opts.z ?? 0.004;
    const mat = opts.screen
      ? new THREE.MeshStandardMaterial({ color: '#000000', roughness: 0.25, metalness: 0, emissive: new THREE.Color('#ffffff'), emissiveMap: tex, emissiveIntensity: 1.1 })
      : new THREE.MeshStandardMaterial({ map: tex, roughness: 0.62, metalness: 0.04, normalMap: normal, normalScale: new THREE.Vector2(0.25, 0.25), emissive: new THREE.Color('#121212'), emissiveMap: tex });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(x, y, z0);
    m.receiveShadow = true;
    if (partId) { m.userData.partId = partId; m.userData.side = opts.side || 'C'; }
    parent.add(m);
    if (!opts.screen && !opts.flat) {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(w + 0.003, h + 0.003, 0.005), mats.panelDark);
      edge.position.set(x, y, z0 - 0.0028); parent.add(edge);
    }
    if (glowTex) {
      const overlay = noRay(new THREE.Mesh(new THREE.PlaneGeometry(w, h), overlayMat(glowTex)));
      overlay.position.set(x, y, z0 + 0.0006); overlay.renderOrder = 1;
      parent.add(overlay);
    }
    // sub-zones: separate study zones showing a copy of part of this canvas
    const subs = (opts.subs || []).map((sb) => {
      const a = sb.area;
      const c = document.createElement('canvas');
      c.width = Math.max(16, Math.round(canvas.width * a.w)); c.height = Math.max(16, Math.round(canvas.height * a.h));
      const t = canvasTexture(c);
      const sm = opts.screen
        ? new THREE.MeshStandardMaterial({ color: '#000000', roughness: 0.25, emissive: new THREE.Color('#ffffff'), emissiveMap: t, emissiveIntensity: 1.1 })
        : new THREE.MeshStandardMaterial({ map: t, roughness: 0.62, emissive: new THREE.Color('#121212'), emissiveMap: t });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w * a.w, h * a.h), sm);
      mesh.position.set(x + (a.x + a.w / 2 - 0.5) * w, y + (0.5 - a.y - a.h / 2) * h, z0 + 0.0004);
      mesh.userData.partId = sb.partId; mesh.userData.side = opts.side || 'C';
      parent.add(mesh);
      // clicks and hints fall through to the parent zone's controls
      const conv = (uv) => uv && { x: a.x + uv.x * a.w, y: 1 - (a.y + (1 - uv.y) * a.h) };
      mesh.userData.hint = (uv) => m.userData.hint?.(conv(uv)) ?? null;
      mesh.userData.interact = (ev) => (m.userData.interact ? m.userData.interact({ ...ev, uv: conv(ev.uv) }) : null);
      mesh.userData.wheel = (ev) => (m.userData.wheel ? m.userData.wheel({ ...ev, uv: conv(ev.uv) }) : null);
      return { a, c, t, mesh };
    });

    let last = null;
    function paint(force = false) {
      if (layout) {
        const res = resolveLayout(layout, snap(), overrides);
        const lit = backlit();
        const sig = res.sig + (lit ? 'N' : 'D');
        if (!force && sig === last) return;
        last = sig;
        controls = paintPanel(canvas, res.layout, { glow: glowCanvas, night: lit, solid: true });
        place3D();
      } else {
        const st = { ...(opts.state ? opts.state() : {}), night, backlight: backlit() };
        const sig = JSON.stringify(st);
        if (!force && sig === last) return;
        last = sig;
        drawer(canvas.getContext('2d'), canvas.width, canvas.height, st, glowCanvas?.getContext('2d'));
      }
      tex.needsUpdate = true;
      if (glowTex) glowTex.needsUpdate = true;
      for (const sb of subs) {
        const cx = sb.c.getContext('2d');
        cx.clearRect(0, 0, sb.c.width, sb.c.height);
        cx.drawImage(canvas, sb.a.x * canvas.width, sb.a.y * canvas.height, sb.a.w * canvas.width, sb.a.h * canvas.height, 0, 0, sb.c.width, sb.c.height);
        sb.t.needsUpdate = true;
      }
    }
    function place3D() {
      const px2m = w / canvas.width;
      controls.forEach((c, i) => {
        const t = c.it.t;
        if (t !== 'toggle' && t !== 'guard' && t !== 'knob') return;
        let sl = slots.get(i);
        const lx = x + (c.x - 0.5) * w, ly = y + (0.5 - c.y) * h, lz = z0 + 0.001;
        const sc = c.u * px2m;
        if (!sl) {
          sl = {};
          if (t === 'knob') {
            if (c.it.style === 'round') sl.knob = kit.add('knobRound', parent, lx, ly, lz, sc * 0.8);
            else { sl.knob = kit.add('knob', parent, lx, ly, lz, sc); sl.line = kit.add('knobLine', parent, lx, ly, lz, sc); }
          } else {
            sl.nut = kit.add('nut', parent, lx, ly, lz, sc);
            sl.lever = kit.add('lever', parent, lx, ly, lz, sc * 1.05);
            if (t === 'guard') sl.guard = kit.add('guard', parent, lx, ly + sc * 0.62, lz, sc);
          }
          slots.set(i, sl);
        }
        if (t === 'knob') {
          const a = c.it.angle ?? -0.6;
          sl.knob.set(0, -a); sl.line?.set(0, -a);
        } else {
          const pos = c.it.pos !== undefined ? c.it.pos : c.it.on ? 1 : -1;
          sl.nut.set(0, 0);
          sl.lever.set(-0.5 * pos, 0);
          if (sl.guard) sl.guard.set(pos === 1 ? -1.95 : 0, 0); // guard lifts while the switch is ON
        }
      });
    }
    paint(true);

    if (layout) {
      const OPERABLE = new Set(['toggle', 'guard', 'knob', 'button']);
      const hit = (uv) => {
        if (!uv) return null;
        const px = uv.x, py = 1 - uv.y;
        const c = controls.find((cc) => OPERABLE.has(cc.it.t) && ((px - cc.x) / cc.rx) ** 2 + ((py - cc.y) / cc.ry) ** 2 <= 1);
        return c ? { c, upper: py < c.y, src: layout.rows[c.ri][c.ci], id: `${c.ri},${c.ci}` } : null;
      };
      m.userData.hint = (uv) => { const hh = hit(uv); return hh ? hintFor(hh.src, overrides[hh.id]) : null; };
      m.userData.interact = ({ uv, shift }) => {
        const hh = hit(uv);
        if (!hh) return null;
        const r = operate(hh.src, hh.id, overrides, { shift, upper: hh.upper, repaint: () => { S = null; paint(true); } }) || {};
        S = null; paint(true);
        return { handled: true, ok: r.ok !== false, message: r.message };
      };
      m.userData.wheel = ({ uv, dir }) => {
        const hh = hit(uv);
        if (!hh || !(hh.src.t === 'knob' && hh.src.values)) return null;
        operate(hh.src, hh.id, overrides, { shift: dir < 0, wheel: true });
        S = null; paint(true);
        return { handled: true };
      };
    }
    if (opts.regions) {
      const find = (uv) => {
        if (!uv) return null;
        const px = uv.x, py = 1 - uv.y;
        return opts.regions.find((r) => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) || null;
      };
      m.userData.hint = (uv) => { const r = find(uv); return r ? (typeof r.hint === 'function' ? r.hint() : r.hint) : null; };
      m.userData.interact = ({ uv, shift }) => {
        const r = find(uv);
        if (!r?.act) return null;
        const res = r.act(shift) || {};
        S = null; paint(true);
        return { handled: true, ok: res.ok !== false, message: res.message };
      };
      m.userData.wheel = ({ uv, dir }) => {
        const r = find(uv);
        if (!r?.wheel) return null;
        r.wheel(dir); S = null; paint(true);
        return { handled: true };
      };
    }
    const dynamic = !!(layout || opts.state);
    const z = { mesh: m, refresh: (force) => { if (dynamic || force) paint(force); }, every: opts.every || 0, acc: 0 };
    zones.push(z);
    return m;
  }

  // ---- layout resolution: live values for every control
  function resolveLayout(layout, S0, overrides) {
    const sig = [];
    const rows = layout.rows.map((row, ri) => row.map((it, ci) => {
      const o = overrides[`${ri},${ci}`] || {};
      const out = { ...it };
      let val;
      if (it.key && it.values) val = S0.s(it.key);
      else if (it.values) val = o.v ?? it.v ?? it.values[0];
      if (it.values && (it.t === 'toggle' || it.t === 'guard')) {
        const i = Math.max(0, it.values.indexOf(val));
        out.pos = it.values.length === 3 ? [1, 0, -1][i] : i === 0 ? 1 : -1;
      } else if (it.t === 'toggle' || it.t === 'guard') {
        if (it.key) out.on = !!S0.s(it.key);
        else if (o.on !== undefined) out.on = o.on;
      }
      if (it.t === 'knob') {
        if (it.values) {
          const n = it.values.length, i = Math.max(0, it.values.indexOf(val)), sw = it.sweep ?? 1.6;
          out.angle = n === 1 ? 0 : -sw / 2 + (i / (n - 1)) * sw;
          if (!it.marks) out.marks = it.values;
        } else if (o.angle !== undefined) out.angle = o.angle;
      }
      if (it.t === 'annun') out.lit = it.lit ? !!it.lit(S0) : false;
      if (it.t === 'button') out.lit = o.lit !== undefined ? o.lit : it.litFn ? it.litFn(S0) : it.lit ?? null;
      sig.push(out.pos ?? '', out.on ? 1 : 0, out.angle ?? '', out.lit ?? '');
      return out;
    }));
    return { layout: { ...layout, rows }, sig: sig.join('|') };
  }
  const nm = (it) => String(it.name || it.label || (typeof it.text === 'string' ? it.text : '') || '').replace(/\n/g, ' ').trim() || 'Switch';
  function curValue(src, o) {
    if (src.values) return src.key ? getS(src.key) : (o?.v ?? src.v ?? src.values[0]);
    if (src.key) return getS(src.key);
    return null;
  }
  function hintFor(src, o) {
    const k = src.key || '';
    const live = k ? ' (live systems)' : '';
    const v = curValue(src, o);
    let pos = '';
    if (src.values) pos = ` · ${String(v)}`;
    else if ((src.t === 'toggle' || src.t === 'guard') && k) pos = ` · ${v ? (src.marks?.[0] || 'ON') : (src.marks?.[1] || 'OFF')}`;
    if (src.t === 'knob' && src.values) return `${nm(src)}${pos} · click next, Shift+click back, or scroll${live}`;
    if ((src.t === 'toggle' || src.t === 'guard') && src.values?.length === 3) return `${nm(src)}${pos} · click upper half to move up, lower half to move down${live}`;
    return `${nm(src)}${pos} · click to ${src.t === 'button' ? 'press' : src.t === 'knob' ? 'turn' : 'switch'}${src.t === 'guard' ? ' (guarded)' : ''}${live}`;
  }
  function operate(src, id, overrides, { shift, upper, wheel, repaint }) {
    const o = (overrides[id] = overrides[id] || {});
    const step = (list, cur, d) => list[Math.max(0, Math.min(list.length - 1, list.indexOf(cur) + d))];
    if (src.t === 'button') {
      const r = src.key ? trySet(src.key, true) : { ok: true };
      if (!src.litFn || r.ok === false) { o.lit = '#e8e2c8'; setTimeout(() => { delete o.lit; repaint?.(); }, 250); }
      return r;
    }
    if (src.values) {
      const cur = curValue(src, o);
      let next;
      if ((src.t === 'toggle' || src.t === 'guard') && src.values.length === 3) next = step(src.values, cur, upper ? -1 : 1);
      else if (src.t === 'toggle' || src.t === 'guard') next = src.values[(src.values.indexOf(cur) + 1) % src.values.length];
      else next = wheel || shift ? step(src.values, cur, shift ? -1 : 1) : src.values[(src.values.indexOf(cur) + 1) % src.values.length];
      if (src.key) return trySet(src.key, next);
      o.v = next; return { ok: true };
    }
    if (src.key) return trySet(src.key, !getS(src.key));
    if (src.t === 'toggle' || src.t === 'guard') { o.on = !(o.on ?? src.on ?? false); return { ok: true }; }
    if (src.t === 'knob') { const cur = o.angle ?? src.angle ?? 0; o.angle = cur >= 1.1 ? -1.2 : cur + 0.6; }
    return { ok: true };
  }

  // ---- cockpit-only state: flight picture, G1000 settings, autopilot
  const FIELD = 1180; // ft
  const fd = {
    t: 0, hdg: 93, hdgBug: 93, crs: 93, selAlt: 6000, baro: 29.92, alt: FIELD, ias: 0, vs: 0, bank: 0, pitch: 0, slip: 0,
    pos: [0.4, 0.3], range: 10,
    nav: [[110.6, 113.65], [108.2, 116.4]], com: [[121.6, 118.825], [119.7, 121.5]],
    ap: false, fdOn: false, lat: 'ROL', vert: 'PIT', vsTgt: 500, flcSpd: 110, latArm: '', vertArm: '', holdAlt: 0,
  };
  const wrap = (d) => ((d % 360) + 360) % 360;
  const angDiff = (a, b) => ((a - b + 540) % 360) - 180;
  const air = () => !getS('onGround');
  function pressAP(id) {
    const c = snap().c;
    if (!c?.avionics) return { ok: false, message: 'The autopilot keys need the AVIONIC MASTER ON (GFC 700 servos and the second integrated avionics unit).' };
    const vertDefault = () => { fd.vert = 'PIT'; };
    switch (id) {
      case 'AP':
        fd.ap = !fd.ap;
        if (fd.ap) { fd.fdOn = true; if (!['HDG', 'GPS', 'BC'].includes(fd.lat)) fd.lat = 'ROL'; if (fd.vert === 'PIT') { fd.vert = 'ALT'; fd.holdAlt = Math.round(fd.alt / 10) * 10; } }
        return { ok: true, message: fd.ap ? 'AP engaged (GFC 700). The mode annunciations appear in the AFCS status bar on the PFD.' : 'AP disengaged (the real system sounds the disconnect tone).' };
      case 'FD':
        if (fd.ap) return { ok: false, message: 'The flight director stays on while the autopilot is engaged.' };
        fd.fdOn = !fd.fdOn; if (fd.fdOn) { fd.lat = 'ROL'; vertDefault(); }
        return { ok: true };
      case 'HDG': fd.fdOn = true; fd.lat = fd.lat === 'HDG' ? 'ROL' : 'HDG'; return { ok: true };
      case 'NAV': fd.fdOn = true; fd.lat = fd.lat === 'GPS' ? 'ROL' : 'GPS'; fd.latArm = ''; return { ok: true };
      case 'APR': fd.fdOn = true; fd.lat = 'GPS'; fd.vertArm = fd.vertArm === 'GP' ? '' : 'GP'; return { ok: true };
      case 'BC': fd.fdOn = true; fd.lat = fd.lat === 'BC' ? 'ROL' : 'BC'; return { ok: true };
      case 'ALT': fd.fdOn = true; if (fd.vert === 'ALT') vertDefault(); else { fd.vert = 'ALT'; fd.holdAlt = Math.round(fd.alt / 10) * 10; } return { ok: true };
      case 'VS': fd.fdOn = true; fd.vert = fd.vert === 'VS' ? 'PIT' : 'VS'; fd.vsTgt = Math.round(fd.vs / 100) * 100 || 500; return { ok: true };
      case 'FLC': fd.fdOn = true; fd.vert = fd.vert === 'FLC' ? 'PIT' : 'FLC'; fd.flcSpd = Math.round(Math.max(85, fd.ias || 110)); return { ok: true };
      case 'VNV': fd.fdOn = true; fd.vertArm = fd.vertArm === 'VPTH' ? '' : 'VPTH'; return { ok: true, message: 'Vertical navigation follows the flight plan profile (armed only in this study model).' };
      case 'UP': case 'DN': {
        const d = id === 'UP' ? 1 : -1;
        if (fd.vert === 'VS') fd.vsTgt = Math.max(-1500, Math.min(1500, fd.vsTgt + d * 100));
        else if (fd.vert === 'FLC') fd.flcSpd = Math.max(80, Math.min(160, fd.flcSpd - d));
        else if (fd.vert === 'PIT') return { ok: true, message: 'NOSE UP / DN change the pitch reference in PIT mode.' };
        else return { ok: true, message: 'NOSE UP / DN adjust the VS or FLC reference.' };
        return { ok: true };
      }
      default: return { ok: true };
    }
  }
  const afcsState = () => ({
    show: fd.ap || fd.fdOn,
    ap: fd.ap,
    lat: fd.lat, latArm: fd.latArm,
    vert: fd.vert,
    vertRef: fd.vert === 'ALT' ? `${fd.holdAlt}FT` : fd.vert === 'VS' ? `${fd.vsTgt}FPM` : fd.vert === 'FLC' ? `${fd.flcSpd}KT` : '',
    vertArm: fd.vertArm || (fd.vert !== 'ALT' && fd.fdOn ? 'ALTS' : ''),
  });

  const timeStr = () => { const d = new Date(); return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':'); };
  const q = (v, s) => Math.round(v / s) * s; // quantise display values so canvases only repaint on change
  const pfdState = () => {
    const c = snap().c || {};
    return {
      on: !!c.pfd, avionics: !!c.avionics, air: air(),
      pitch: q(fd.pitch, 0.1), bank: q(fd.bank, 0.2), slip: q(fd.slip, 0.05), ias: q(fd.ias, 0.5), tas: q(fd.ias * (1 + fd.alt / 1000 * 0.02), 1),
      alt: q(fd.alt, 5), vs: q(fd.vs, 10), hdg: q(fd.hdg, 0.5), hdgBug: fd.hdgBug, crs: fd.crs, selAlt: fd.selAlt,
      baroText: `${fd.baro.toFixed(2)}IN`, oat: Math.round(15 - (fd.alt - FIELD) / 500), windDir: 270, windSpd: 12,
      cdi: q(Math.sin(fd.t * 0.05) * 0.4 + (air() ? angDiff(fd.crs, fd.hdg) / 40 : 0), 0.02),
      nav: fd.nav, com: fd.com, wpt: 'ALPHA', dtk: fd.crs, trk: q(fd.hdg, 1), dis: air() ? (8.6 - (fd.t % 60) / 10).toFixed(1) : '12.4',
      fd: (fd.fdOn || fd.ap) && air(), fdBank: fd.ap ? 0 : fd.bank * 0.4, fdPitch: 0,
      afcs: afcsState(), cas: c.cas || [], squawk: '7000', time: timeStr(),
    };
  };
  const mfdState = () => {
    const c = snap().c || {};
    const r = (e) => e && ({ ...e, load: q(e.load, 1), rpm: q(e.rpm, 10), ff: q(e.ff, 0.1), oilP: q(e.oilP, 0.1), oilT: q(e.oilT, 1), cool: q(e.cool, 1), gbox: q(e.gbox, 1), fuelT: q(e.fuelT, 1), volts: q(e.volts, 0.1), amps: q(e.amps, 1) });
    return {
      on: !!c.mfd, avionics: !!c.avionics, nav: fd.nav, com: fd.com,
      engines: (c.engines || []).map(r), gs: q(air() ? fd.ias * 1.04 : fd.ias, 1), dtk: fd.crs, trk: q(fd.hdg, 1), hdg: q(fd.hdg, 1),
      pos: [q(fd.pos[0], 0.01), q(fd.pos[1], 0.01)], range: fd.range,
    };
  };

  // ---- instrument panel
  const panel = facing(V(0.5, 0.62, 0), V(-1, 0.14, 0));
  {
    const s = new THREE.Shape();
    const W2 = 0.53, top = 0.205, bot = -0.205, r = 0.05;
    s.moveTo(-W2 + 0.02, bot); s.lineTo(W2 - 0.02, bot); s.lineTo(W2, top - r); s.quadraticCurveTo(W2, top, W2 - r, top);
    s.lineTo(-W2 + r, top); s.quadraticCurveTo(-W2, top, -W2, top - r); s.closePath();
    const body = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2 }), mats.panel);
    body.position.z = -0.036; body.castShadow = true; body.receiveShadow = true;
    panel.add(body);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 1.0), mats.panelDark);
    back.position.set(0.8, 0.6, 0); root.add(back);
  }
  const GDU_W = D.GDU.w, GDU_H = D.GDU.h;
  const PFD_X = -0.29, MFD_X = 0.06, GDU_Y = 0.0;
  // GDU bezels with live controls
  function gdu(cx, side, isPfd) {
    // housing behind the bezel
    const house = new THREE.Mesh(new RoundedBoxGeometry(GDU_W + 0.006, GDU_H + 0.006, 0.02, 3, 0.008), mats.black);
    house.position.set(cx, GDU_Y, -0.004); house.castShadow = true; panel.add(house);
    const regions = [];
    const reg = (it, w, h, hint, act, wheel) => regions.push({ x: it.x - w / 2, y: it.y - h / 2, w, h, hint, act, wheel });
    const KNOB = {
      navVol: { hint: 'NAV volume / ID knob · study only' },
      comVol: { hint: 'COM volume / squelch knob · study only' },
      nav: { hint: () => `NAV tuning knob · standby ${fd.nav[0][0].toFixed(2)} · click +0.05, Shift+click −0.05, or scroll`, f: (d) => { fd.nav[0][0] = Math.round((108 + ((fd.nav[0][0] - 108 + d * 0.05 + 10) % 10)) * 100) / 100; } },
      com: { hint: () => `COM tuning knob · standby ${fd.com[0][1].toFixed(3)} · click +25 kHz, Shift+click −25 kHz, or scroll`, f: (d) => { fd.com[0][1] = Math.round((118 + ((fd.com[0][1] - 118 + d * 0.025 + 19) % 19)) * 1000) / 1000; } },
      hdg: { hint: () => `HDG knob · bug ${String(fd.hdgBug).padStart(3, '0')}° · click +1°, Shift+click −1°, scroll ±5°`, f: (d, wh) => { fd.hdgBug = wrap(fd.hdgBug + d * (wh ? 5 : 1)) || 360; } },
      alt: { hint: () => `ALT selector · ${fd.selAlt} ft · click +100, Shift+click −100, or scroll`, f: (d) => { fd.selAlt = Math.max(0, Math.min(18000, fd.selAlt + d * 100)); } },
      crs: { hint: () => `CRS / BARO knob · CRS ${String(fd.crs).padStart(3, '0')}° · click ±1° CRS · scroll: BARO ${fd.baro.toFixed(2)}`, f: (d, wh) => { if (wh) fd.baro = Math.round((fd.baro + d * 0.01) * 100) / 100; else fd.crs = wrap(fd.crs + d) || 360; } },
      range: { hint: () => `RANGE joystick · map range ${fd.range} NM · click to zoom out, Shift+click to zoom in, or scroll`, f: (d) => { const R = [2, 5, 10, 20, 50]; fd.range = R[Math.max(0, Math.min(R.length - 1, R.indexOf(fd.range) + d))]; } },
      fms: { hint: 'FMS knob · pages, cursor and data entry · study only' },
    };
    for (const k of D.GDU.knobs) {
      const def = KNOB[k.id];
      const kr = k.r * 1.2;
      reg(k, kr * 2, kr * 2 * GDU_W / GDU_H, def.hint, def.f ? (sh) => { def.f(sh ? -1 : 1); return {}; } : null, def.f ? (d) => def.f(d, true) : null);
      // 3D knob (concentric dual knobs where fitted)
      const lx = cx + (k.x - 0.5) * GDU_W, ly = GDU_Y + (0.5 - k.y) * GDU_H;
      const R = k.r * GDU_W;
      const parts = [];
      const outer = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 1.04, 0.012, 28), mats.plastic);
      outer.rotation.x = Math.PI / 2; outer.position.set(lx, ly, 0.014); parts.push(outer);
      if (k.dual) { const inner = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.62, R * 0.64, 0.01, 24), mats.black); inner.rotation.x = Math.PI / 2; inner.position.set(lx, ly, 0.025); parts.push(inner); }
      if (k.joy) { const st = new THREE.Mesh(new THREE.SphereGeometry(R * 0.7, 16, 12), mats.black); st.position.set(lx, ly, 0.018); parts.push(st); }
      for (const p of parts) {
        p.castShadow = true; p.userData.partId = 'da42fd-gdu-bezel'; p.userData.side = side;
        p.userData.hint = () => (typeof def.hint === 'function' ? def.hint() : def.hint);
        if (def.f) {
          p.userData.interact = ({ shift }) => { def.f(shift ? -1 : 1); S = null; return { handled: true, ok: true }; };
          p.userData.wheel = ({ dir }) => { def.f(dir, true); return { handled: true }; };
        }
        panel.add(p);
      }
    }
    const KEY = {
      navSwap: ['NAV frequency transfer · swaps active and standby', () => { fd.nav[0].reverse(); }],
      comSwap: ['COM frequency transfer · swaps active and standby', () => { fd.com[0].reverse(); }],
      direct: ['Direct-To key · study only', null], menu: ['MENU key · study only', null], fpl: ['FPL key · flight plan page · study only', null],
      proc: ['PROC key · departures, arrivals, approaches · study only', null], clr: ['CLR key · study only', null], ent: ['ENT key · study only', null],
    };
    for (const k of D.GDU.keys) {
      const [hint, f] = KEY[k.id];
      reg(k, 0.065, 0.05, hint, f ? () => { f(); return {}; } : null);
    }
    for (const k of D.GDU.ap) {
      const id = k.t;
      reg(k, 0.063, 0.045, () => `${id} key (GFC 700 autopilot) · click to press`, () => pressAP(id));
    }
    regions.push({ ...D.SOFTKEY_AREA, hint: `${isPfd ? 'PFD' : 'MFD'} softkeys · their labels change with the page shown on the screen above (study only)` });
    zone(panel, 'da42fd-gdu-bezel', GDU_W, GDU_H, cx, GDU_Y, D.drawBezel, {
      side, regions, z: 0.006, state: () => ({ ap: fd.ap, fd: fd.fdOn }), noGlow: true, flat: true,
      subs: [{ partId: 'da42fd-afcs', area: D.AP_AREA }],
    });
    const sc = D.GDU.screen;
    const sx = cx + (sc.x + sc.w / 2 - 0.5) * GDU_W, sy = GDU_Y + (0.5 - sc.y - sc.h / 2) * GDU_H;
    const glass = noRay(new THREE.Mesh(new THREE.PlaneGeometry(sc.w * GDU_W, sc.h * GDU_H), new THREE.MeshPhysicalMaterial({ color: '#0a0c0e', transparent: true, opacity: 0.08, roughness: 0.08, depthWrite: false, envMapIntensity: 0.6 })));
    glass.position.set(sx, sy, 0.0095); glass.renderOrder = 3; panel.add(glass);
    return { sx, sy, sw: sc.w * GDU_W, sh: sc.h * GDU_H };
  }
  const pfdScr = gdu(PFD_X, 'L', true);
  const mfdScr = gdu(MFD_X, 'C', false);
  zone(panel, 'da42fd-pfd', pfdScr.sw, pfdScr.sh, pfdScr.sx, pfdScr.sy, D.drawPFD, {
    screen: true, z: 0.0075, side: 'L', state: pfdState,
    subs: [{ partId: 'da42fd-pfd-airspeed', area: D.PFD_AREAS.airspeed }, { partId: 'da42fd-hsi', area: D.PFD_AREAS.hsi }, { partId: 'da42fd-cas', area: D.PFD_AREAS.cas }],
  });
  zone(panel, 'da42fd-mfd', mfdScr.sw, mfdScr.sh, mfdScr.sx, mfdScr.sy, D.drawMFD, {
    screen: true, z: 0.0075, state: mfdState, subs: [{ partId: 'da42fd-eis', area: D.MFD_AREAS.eis }],
  });

  // standby instruments: top centre of the panel
  const stbyY = 0.158;
  const stby = (partId, x, size, drawer, state) => {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.47, size * 0.5, 0.018, 36), mats.black);
    ring.rotation.x = Math.PI / 2; ring.position.set(x, stbyY, 0.004); ring.userData.partId = partId; panel.add(ring);
    zone(panel, partId, size, size, x, stbyY, drawer, { z: 0.0135, state, noGlow: true, flat: true, ppm: 5200 });
    const glass = noRay(new THREE.Mesh(new THREE.CircleGeometry(size * 0.44, 32), new THREE.MeshPhysicalMaterial({ color: '#0a0c0e', transparent: true, opacity: 0.12, roughness: 0.05, depthWrite: false })));
    glass.position.set(x, stbyY, 0.016); glass.renderOrder = 3; panel.add(glass);
  };
  stby('da42fd-stby-asi', -0.088, 0.072, D.drawStbyASI, () => ({ ias: q(fd.ias, 0.5) }));
  stby('da42fd-stby-att', -0.008, 0.078, D.drawStbyAtt, () => {
    const c = snap().c || {};
    return { pitch: q(fd.pitch, 0.2), bank: q(fd.bank, 0.3), powered: !!c.stbyAtt, onEmerg: !c.master && !!getS('elec.emergency') };
  });
  stby('da42fd-stby-alt', 0.072, 0.072, D.drawStbyAlt, () => ({ alt: q(fd.alt, 5), baroStby: fd.baro.toFixed(2) }));

  // switch plates
  zone(panel, 'da42fd-ext-lights', 0.2, 0.072, -0.39, 0.16, LAYOUTS.extLights, { side: 'L' });
  zone(panel, 'da42fd-int-lights', 0.125, 0.072, -0.205, 0.16, LAYOUTS.intLights, { side: 'L' });
  zone(panel, 'da42fd-emergency', 0.105, 0.072, 0.175, 0.16, LAYOUTS.emergency);
  zone(panel, 'da42fd-flaps', 0.13, 0.13, 0.38, 0.125, LAYOUTS.flaps, { side: 'R' });
  zone(panel, 'da42fd-fuel-pumps', 0.13, 0.08, 0.38, 0.015, LAYOUTS.fuelPitot, { side: 'R' });
  zone(panel, 'da42fd-pitot-heat', 0.11, 0.085, 0.27 + 0.055 - 0.13, -0.16, LAYOUTS.pitot, { side: 'C' });
  zone(panel, 'da42fd-elec-master', 0.22, 0.078, -0.41, -0.16, LAYOUTS.elec, { side: 'L' });
  zone(panel, 'da42fd-engine-master', 0.17, 0.078, -0.21, -0.16, LAYOUTS.engine, { side: 'L' });
  zone(panel, 'da42fd-ecu', 0.165, 0.078, 0.055, -0.16, LAYOUTS.ecu);
  // circuit breaker panel (right side of the panel)
  {
    const w = 0.16, h = 0.135, cx = 0.43, cy = -0.12;
    const { texture, points } = cbPanelCanvas(w, h, 3, 2600);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: texture, roughness: 0.65, color: '#8a8f96' }));
    face.position.set(cx, cy, 0.004); face.userData.partId = 'da42fd-circuit-breakers'; face.userData.side = 'R'; panel.add(face);
    const cap = new THREE.CylinderGeometry(0.0045, 0.0045, 0.01, 12); cap.rotateX(Math.PI / 2);
    const caps = new THREE.InstancedMesh(cap, mats.plastic, points.length);
    const mm = new THREE.Matrix4();
    points.forEach(([u, v], i) => { mm.makeTranslation(cx + (u - 0.5) * w, cy + (0.5 - v) * h, 0.009 + (i % 41 === 0 ? 0.004 : 0)); caps.setMatrixAt(i, mm); });
    noRay(caps); panel.add(caps);
  }

  // gear control: lever with a wheel-shaped knob, three green + red unsafe lights
  const GEAR_X = -0.07, GEAR_Y = -0.16;
  zone(panel, 'da42fd-gear', 0.095, 0.078, GEAR_X, GEAR_Y, (ctx, W, H, st, glow) => {
    ctx.fillStyle = PLATE; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 3; ctx.strokeRect(1, 1, W - 2, H - 2);
    glow.fillStyle = '#000'; glow.fillRect(0, 0, W, H);
    const ink = st.backlight ? '#fff2d6' : '#f2f2ee';
    drawLabel(ctx, 'GEAR', W * 0.28, H * 0.13, H * 0.12, ink);
    drawLabel(ctx, 'UP', W * 0.28, H * 0.3, H * 0.1, ink);
    drawLabel(ctx, 'DOWN', W * 0.28, H * 0.9, H * 0.1, ink);
    ctx.fillStyle = '#0c0d0f'; rrect(ctx, W * 0.23, H * 0.36, W * 0.1, H * 0.46, 6); ctx.fill();
    const lamp = (x, y, on, col) => {
      ctx.fillStyle = '#0c0d0f'; ctx.beginPath(); ctx.arc(x, y, H * 0.085, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = on ? col : '#2a302c'; ctx.beginPath(); ctx.arc(x, y, H * 0.065, 0, Math.PI * 2); ctx.fill();
      if (on) { glow.fillStyle = col; glow.beginPath(); glow.arc(x, y, H * 0.065, 0, Math.PI * 2); glow.fill(); }
    };
    lamp(W * 0.72, H * 0.22, st.n, '#35e07a');
    lamp(W * 0.6, H * 0.48, st.l, '#35e07a');
    lamp(W * 0.84, H * 0.48, st.r, '#35e07a');
    lamp(W * 0.72, H * 0.76, st.red, '#ff3b2f');
    drawLabel(ctx, 'L', W * 0.6, H * 0.63, H * 0.08, ink); drawLabel(ctx, 'R', W * 0.84, H * 0.63, H * 0.08, ink); drawLabel(ctx, 'N', W * 0.72, H * 0.07, H * 0.08, ink);
    drawLabel(ctx, 'UNSAFE', W * 0.72, H * 0.93, H * 0.075, ink);
  }, { state: () => { const a = snap().a, on = !!snap().c?.master || !!getS('elec.essBus'); return { l: on && a.gearL.state !== 'off', n: on && a.gearN.state !== 'off', r: on && a.gearR.state !== 'off', red: on && a.gearUnsafe.state !== 'off' }; } });
  const gearLever = new THREE.Group(); gearLever.position.set(GEAR_X - 0.0195, GEAR_Y, 0.006); panel.add(gearLever);
  {
    const stem = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.006, 0.04), mats.chrome); stem.position.z = 0.02;
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.012, 24), mats.white); knob.rotation.x = Math.PI / 2; knob.position.z = 0.042;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.0025, 8, 24), mats.white); rim.position.z = 0.042;
    [stem, knob, rim].forEach((m) => { m.userData.partId = 'da42fd-gear'; m.castShadow = true; gearLever.add(m); });
  }

  // ---- glareshield items: compass
  buildCompass(root, mats, 'da42fd-compass');

  // ---- centre console
  const consoleG = new THREE.Group(); root.add(consoleG);
  {
    const prof = new THREE.Shape();
    prof.moveTo(-0.36, 0); prof.lineTo(0.5, 0); prof.lineTo(0.5, 0.42); prof.lineTo(0.43, 0.33); prof.lineTo(-0.36, 0.33); prof.closePath();
    const geo = new THREE.ExtrudeGeometry(prof, { depth: 0.18, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 3 });
    geo.translate(0, 0, -0.09);
    const body = new THREE.Mesh(geo, mats.panel); body.castShadow = true; body.receiveShadow = true; consoleG.add(body);
    // painted top placard
    const cw = 0.79, ch = 0.18;
    const c = makeCanvas(cw, ch, 2400); const ctx = c.getContext('2d'); const W = c.width, H = c.height;
    ctx.fillStyle = '#2b2e32'; ctx.fillRect(0, 0, W, H);
    const xu = (x) => W * ((x - (0.43 - cw)) / cw); // canvas u runs aft -> forward
    const zv = (z) => H * (0.5 + z / ch);
    const lab = (t, x, z, sz = 0.012, rot = Math.PI / 2) => { ctx.save(); ctx.translate(xu(x), zv(z)); ctx.rotate(rot); drawLabel(ctx, t, 0, 0, sz * 2400, '#f2f2ee'); ctx.restore(); };
    // power lever slots and legends
    for (const z of [-0.035, 0.035]) { ctx.fillStyle = '#0b0c0e'; ctx.fillRect(xu(0.42), zv(z) - 6, xu(0.24) - xu(0.42), 12); }
    lab('MAX', 0.415, 0.0, 0.009); lab('IDLE', 0.26, 0.0, 0.009); lab('POWER', 0.33, -0.075, 0.011);
    // trim indicator scale beside the wheel
    ctx.fillStyle = '#0b0c0e'; ctx.fillRect(xu(0.25), zv(0.045), xu(0.09) - xu(0.25), H * 0.12);
    ctx.fillStyle = '#35e07a'; ctx.fillRect(xu(0.18) - 4, zv(0.045), 8, H * 0.12);
    lab('NOSE DN', 0.245, 0.075, 0.008); lab('T/O', 0.17, 0.075, 0.008); lab('NOSE UP', 0.105, 0.075, 0.008);
    lab('RUDDER TRIM', 0.03, -0.065, 0.009); lab('L', 0.03, -0.03, 0.009); lab('R', 0.03, 0.03, 0.009);
    lab('HEAT', -0.06, -0.075, 0.009); lab('DEFROST', -0.06, 0.075, 0.009);
    // fuel selector placards
    for (const [z, sd] of [[-0.045, 'LH'], [0.045, 'RH']]) {
      lab(`FUEL ${sd}`, -0.27, z, 0.009);
      ctx.strokeStyle = '#f2f2ee'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(xu(-0.19), zv(z), H * 0.17, 0, Math.PI * 2); ctx.stroke();
      lab('ON', -0.135, z, 0.008); lab('X-FEED', -0.19, z + (z < 0 ? 0.034 : -0.034), 0.007); lab('OFF', -0.245, z, 0.008);
    }
    const top = new THREE.Mesh(new THREE.PlaneGeometry(cw, ch), new THREE.MeshStandardMaterial({ map: canvasTexture(c), roughness: 0.6 }));
    top.rotation.x = -Math.PI / 2; top.position.set(0.43 - cw / 2, 0.3385, 0); top.receiveShadow = true;
    consoleG.add(noRay(top));
  }
  // power levers (single lever per engine: FADEC sets fuel, boost and propeller speed)
  const powerLevers = [1, 2].map((n) => {
    const z = n === 1 ? -0.035 : 0.035;
    const g = new THREE.Group(); g.position.set(0.33, 0.29, z); root.add(g);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.12, 0.01), mats.chrome); arm.position.y = 0.06;
    const knob = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.036, 0.034, 3, 0.01), mats.black); knob.position.y = 0.125;
    const c = makeCanvas(0.02, 0.02, 4000); const cx = c.getContext('2d'); cx.fillStyle = '#121315'; cx.fillRect(0, 0, c.width, c.height); drawLabel(cx, n === 1 ? 'L' : 'R', c.width / 2, c.height / 2, c.height * 0.7, '#f2f2ee');
    const cap = new THREE.Mesh(new THREE.PlaneGeometry(0.02, 0.02), new THREE.MeshStandardMaterial({ map: canvasTexture(c), roughness: 0.5 }));
    cap.rotation.x = -Math.PI / 2; cap.position.y = 0.1435;
    [arm, knob, cap].forEach((m) => { m.userData.partId = 'da42fd-power-levers'; m.userData.side = n === 1 ? 'L' : 'R'; m.castShadow = true; g.add(m); });
    return { g, n };
  });
  // elevator trim wheel (rotates fore and aft through the console top)
  const trimWheel = new THREE.Group(); trimWheel.position.set(0.17, 0.28, -0.02); root.add(trimWheel);
  {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.022, 40), mats.black); w.rotation.x = Math.PI / 2;
    trimWheel.add(w);
    for (let i = 0; i < 24; i++) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.01, 0.024), mats.plastic); const a = (i / 24) * Math.PI * 2; r.position.set(Math.cos(a) * 0.075, Math.sin(a) * 0.075, 0); r.rotation.z = a; trimWheel.add(r); }
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.03, 0.023), mats.white); mark.position.set(0, 0.06, 0); trimWheel.add(mark);
    trimWheel.traverse((m) => { if (m.isMesh) { m.userData.partId = 'da42fd-elevator-trim'; m.castShadow = true; } });
  }
  const trimPointer = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.004, 0.02), mats.white); trimPointer.position.set(0.17, 0.341, 0.045); trimPointer.userData.partId = 'da42fd-elevator-trim'; root.add(trimPointer);
  // rudder trim knob
  const rudderKnob = new THREE.Group(); rudderKnob.position.set(0.03, 0.34, 0); root.add(rudderKnob);
  {
    const k = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.022, 24), mats.black); k.position.y = 0.011;
    const ptr = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.006, 0.006), mats.white); ptr.position.set(0, 0.023, 0);
    [k, ptr].forEach((m) => { m.userData.partId = 'da42fd-rudder-trim'; m.castShadow = true; rudderKnob.add(m); });
  }
  // cabin heat and defrost levers
  const heatLevers = [['cabinHeat', -0.04], ['defrost', 0.04]].map(([key, z]) => {
    const g = new THREE.Group(); g.position.set(-0.06, 0.335, z); root.add(g);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.05, 0.008), mats.chrome); arm.position.y = 0.025;
    const k = new THREE.Mesh(new THREE.SphereGeometry(0.011, 12, 10), key === 'cabinHeat' ? mats.red : mats.plastic); k.position.y = 0.05;
    [arm, k].forEach((m) => { m.userData.partId = 'da42fd-cabin-heat'; m.castShadow = true; g.add(m); });
    return { g, key };
  });
  // fuel selector valves (ON / CROSSFEED / OFF)
  const fuelKnobs = [1, 2].map((n) => {
    const z = n === 1 ? -0.045 : 0.045;
    const g = new THREE.Group(); g.position.set(-0.19, 0.34, z); root.add(g);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.024, 0.01, 24), mats.metal); base.position.y = 0.005;
    const handle = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.022, 0.016, 2, 0.006), mats.red); handle.position.y = 0.02;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.016, 10), mats.white); tip.rotation.z = -Math.PI / 2; tip.position.set(0.034, 0.02, 0);
    [base, handle, tip].forEach((m) => { m.userData.partId = 'da42fd-fuel-selectors'; m.userData.side = n === 1 ? 'L' : 'R'; m.castShadow = true; g.add(m); });
    return { g, n };
  });
  // under the panel: parking brake, alternate static valve, alternate air, emergency gear extension
  const tHandle = (partId, x, y, z, mat, side) => {
    const g = new THREE.Group(); g.position.set(x, y, z); root.add(g);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.04, 8), mats.chrome); shaft.rotation.z = Math.PI / 2; shaft.position.x = -0.02;
    const grip = new THREE.Mesh(new RoundedBoxGeometry(0.014, 0.018, 0.05, 2, 0.005), mat); grip.position.x = -0.042;
    [shaft, grip].forEach((m) => { m.userData.partId = partId; m.userData.side = side; m.castShadow = true; g.add(m); });
    return g;
  };
  const parkHandle = tHandle('da42fd-parking-brake', 0.47, 0.37, -0.115, mats.red, 'L');
  const altStatic = tHandle('da42fd-alt-static', 0.47, 0.42, -0.5, mats.black, 'L');
  const altAir = [tHandle('da42fd-alt-air', 0.47, 0.39, -0.17, mats.black, 'L'), tHandle('da42fd-alt-air', 0.47, 0.39, 0.15, mats.black, 'R')];
  const emerGear = new THREE.Group(); emerGear.position.set(0.44, 0.24, -0.1); root.add(emerGear);
  {
    const cover = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.07, 0.012, 2, 0.004), mats.panelDark); cover.rotation.y = Math.PI / 2;
    const grip = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.004, 8, 18, Math.PI), mats.red); grip.rotation.y = Math.PI / 2; grip.position.set(-0.008, -0.01, 0);
    [cover, grip].forEach((m) => { m.userData.partId = 'da42fd-emergency-gear'; m.castShadow = true; emerGear.add(m); });
  }
  // small placards under the panel
  const placard = (text, x, y, z, w = 0.06) => {
    const c = makeCanvas(w, 0.016, 4000); const cx = c.getContext('2d'); cx.fillStyle = '#1b1c1f'; cx.fillRect(0, 0, c.width, c.height); drawLabel(cx, text, c.width / 2, c.height / 2, c.height * 0.55, '#f2f2ee');
    const m = noRay(new THREE.Mesh(new THREE.PlaneGeometry(w, 0.016), new THREE.MeshStandardMaterial({ map: canvasTexture(c), roughness: 0.6 })));
    m.position.set(x, y, z); m.rotation.y = -Math.PI / 2; root.add(m);
  };
  placard('PARKING BRAKE', 0.475, 0.395, -0.115, 0.07); placard('ALTERNATE STATIC', 0.475, 0.445, -0.5, 0.08);
  placard('ALT AIR L', 0.475, 0.412, -0.17); placard('ALT AIR R', 0.475, 0.412, 0.15); placard('EMERG GEAR', 0.445, 0.29, -0.1);

  // ---- seats, sticks, pedals
  buildFrontSeat(root, mats, -0.32, 'da42fd-front-seats');
  buildFrontSeat(root, mats, 0.32, 'da42fd-front-seats');
  buildRearBench(root, mats, 'da42fd-rear-seats');
  const sticks = [-0.32, 0.32].map((z) => buildStick(root, mats, z, 'da42fd-sticks'));
  const pedalSets = [-0.32, 0.32].map((z) => buildPedals(root, mats, z, 'da42fd-pedals'));
  // pedal adjustment crank handle (between the pedal sets, under the panel)
  const crank = new THREE.Group(); crank.position.set(0.5, 0.2, 0.0); root.add(crank);
  {
    const c1 = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.004, 8, 20), mats.black); c1.rotation.y = Math.PI / 2;
    const k = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.02, 8), mats.black); k.rotation.z = Math.PI / 2; k.position.set(-0.01, 0.02, 0);
    [c1, k].forEach((m) => { m.userData.partId = 'da42fd-pedals'; crank.add(m); });
  }

  kit.finalize(root);
  // indoors the studio environment map isn't occluded by the shell: tone it down so the canopy light and the flood carry the scene
  root.traverse((o) => {
    if (!o.isMesh && !o.isInstancedMesh) return;
    for (const m of [].concat(o.material)) if (m && m.isMeshStandardMaterial && !m.isMeshPhysicalMaterial && m.envMapIntensity === 1 && (m.emissiveIntensity ?? 1) <= 1) m.envMapIntensity = 0.5;
  });

  // ---- direct manipulation of 3D controls
  const operable = (obj, hint, act, wheel) => obj.traverse((m) => {
    if (!m.isMesh || !m.userData.partId) return;
    m.userData.hint = typeof hint === 'function' ? hint : () => hint;
    m.userData.interact = ({ shift }) => { const r = act(shift); S = null; return { handled: true, ok: r?.ok !== false, message: r?.message }; };
    if (wheel) m.userData.wheel = ({ dir }) => { wheel(dir); S = null; return { handled: true }; };
  });
  operable(gearLever, () => `Gear lever · ${getS('gearLever') === 'UP' ? 'UP' : 'DOWN'} · click to select ${getS('gearLever') === 'UP' ? 'DOWN' : 'UP'} (pull the knob out, then move it)`,
    () => systems.set('gearLever', systems.get('gearLever') === 'UP' ? 'DN' : 'UP'));
  powerLevers.forEach(({ g, n }) => {
    const key = `power${n}`;
    operable(g, () => `${n === 1 ? 'Left' : 'Right'} power lever · ${Math.round((getS(key) || 0) * 100)}% · click +10%, Shift+click −10%, or scroll`,
      (shift) => systems.set(key, Math.round(((getS(key) || 0) + (shift ? -0.1 : 0.1)) * 10) / 10),
      (dir) => systems.set(key, Math.round(((getS(key) || 0) + dir * 0.05) * 20) / 20));
  });
  operable(trimWheel, () => `Elevator trim wheel · ${systems.readout('elevTrim')} · click: nose up · Shift+click: nose down · or scroll`,
    (shift) => systems.set('elevTrim', (getS('elevTrim') || 0) + (shift ? -0.1 : 0.1)),
    (dir) => systems.set('elevTrim', (getS('elevTrim') || 0) + dir * 0.05));
  operable(trimPointer, () => `Elevator trim indicator · ${systems.readout('elevTrim')}`, () => ({ ok: true }));
  operable(rudderKnob, () => `Rudder trim knob · ${systems.readout('rudderTrim')} · click: right · Shift+click: left · or scroll`,
    (shift) => systems.set('rudderTrim', (getS('rudderTrim') || 0) + (shift ? -0.1 : 0.1)),
    (dir) => systems.set('rudderTrim', (getS('rudderTrim') || 0) + dir * 0.05));
  heatLevers.forEach(({ g, key }) => operable(g, () => `${key === 'cabinHeat' ? 'Cabin heat' : 'Defrost'} lever · ${getS(key) ? 'OPEN' : 'CLOSED'} · click to ${getS(key) ? 'close' : 'open'}`, () => systems.set(key, !getS(key))));
  fuelKnobs.forEach(({ g, n }) => {
    const key = `fuelSel${n}`;
    operable(g, () => `${n === 1 ? 'Left' : 'Right'} fuel selector · ${getS(key)} · click: next (ON → CROSSFEED → OFF) · Shift+click: back`, (shift) => {
      const i = FUEL_POSITIONS.indexOf(getS(key));
      return systems.set(key, FUEL_POSITIONS[Math.max(0, Math.min(2, i + (shift ? -1 : 1)))]);
    });
  });
  operable(parkHandle, () => `Parking brake · ${getS('parkBrake') ? 'SET' : 'RELEASED'} · click to ${getS('parkBrake') ? 'release' : 'set'}`, () => systems.set('parkBrake', !getS('parkBrake')));
  operable(altStatic, () => `Alternate static valve · ${getS('altStatic') ? 'OPEN (cabin static)' : 'CLOSED (normal)'} · click to ${getS('altStatic') ? 'close' : 'open'}`, () => systems.set('altStatic', !getS('altStatic')));
  altAir.forEach((h, i) => { const key = `altAir${i + 1}`; operable(h, () => `${i ? 'Right' : 'Left'} alternate air · ${getS(key) ? 'OPEN' : 'CLOSED'} · click to ${getS(key) ? 'close' : 'open'}`, () => systems.set(key, !getS(key))); });
  operable(emerGear, 'Emergency gear extension handle · used only per the AFM if normal extension fails (not simulated)', () => ({ ok: true, message: 'Emergency gear extension isn\'t simulated. With the gear lever DOWN it releases the gear to free-fall and lock (per the AFM).' }));
  sticks.forEach((s) => operable(s.pivot, () => (fd.ap ? 'Control stick · click the red AP DISC / TRIM button to disconnect the autopilot' : 'Control stick · PTT trigger, red AP disconnect / trim interrupt button, electric pitch trim hat'), () => {
    if (fd.ap) { fd.ap = false; return { ok: true, message: 'Autopilot disconnected with the AP DISC button on the stick.' }; }
    return { ok: true };
  }));
  operable(crank, () => `Pedal adjustment crank · ${getS('pedalAdjust') > 0.5 ? 'aft' : 'forward'} · click to move the pedals ${getS('pedalAdjust') > 0.5 ? 'forward' : 'aft'}`, () => systems.set('pedalAdjust', getS('pedalAdjust') > 0.5 ? 0.2 : 0.8));
  shell.latches.forEach((l) => operable(l.group, () => `Canopy locking handle · ${getS('canopy') ? 'OPEN' : 'CLOSED & LOCKED'} · click to ${getS('canopy') ? 'close and lock' : 'unlock and open'}`, () => systems.set('canopy', !getS('canopy'))));
  operable(shell.door, () => `Rear passenger door (left) · ${getS('rearDoor') ? 'OPEN' : 'CLOSED & LOCKED'} · click the handle to ${getS('rearDoor') ? 'close' : 'open'}`, () => systems.set('rearDoor', !getS('rearDoor')));

  // ---- day / night
  function applyLights() {
    const fl = !!getS('light.flood') || (!!getS('elec.emergency') && !getS('elec.master'));
    flood.intensity = fl ? (night ? 0.8 : 0.6) : 0;
    floodLeds.material.emissiveIntensity = fl ? 2.0 : 0;
    const wash = backlit() ? 0.35 : 0;
    panelWash.forEach((l) => { l.intensity = wash; });
  }
  function setNight(on) {
    night = on;
    outside.setNight(on);
    hemi.intensity = on ? 0.03 : 0.35;
    for (const z of zones) {
      const m = z.mesh;
      if (m.material.emissiveIntensity > 1) continue; // screens keep their brightness
      const base = m.userData.baseEmissive || (m.userData.baseEmissive = m.material.emissive.clone());
      base.set(on ? '#050505' : '#121212');
      if (!m.userData.hl) m.material.emissive.copy(base);
    }
    applyLights();
    S = null;
    zones.forEach((z) => z.refresh(true));
  }
  document.fonts?.ready?.then(() => { S = null; zones.forEach((z) => z.refresh(true)); });

  // ---- simulation of the flight picture and animation from systems
  const cur = { roll: 0, pitch: 0, yaw: 0, gear: 0, pl: [0, 0], trim: 0, rtrim: 0, fuel: [0, 0], canopy: 0, door: 0, pedal: 0.5, heat: [0, 0], spin: [0, 0] };
  const k8 = (dt) => 1 - Math.exp(-dt * 8);
  const toward = (a, b, k) => a + (b - a) * k;
  const FUEL_ANG = { ON: 0, CROSSFEED: Math.PI / 2, OFF: Math.PI };
  let lastAir = null;
  function simulate(dt) {
    const st = systems.state;
    const isAir = !st.onGround;
    const c = snap().c || {};
    const run = [st.eng1, st.eng2];
    const thrust = (run[0] ? st.power1 : 0) + (run[1] ? st.power2 : 0);
    if (isAir !== lastAir) {
      if (isAir) { fd.alt = Math.max(fd.alt, 4500); fd.ias = 130; fd.holdAlt = Math.round(fd.alt / 10) * 10; } else { fd.alt = FIELD; fd.vs = 0; fd.bank = 0; fd.pitch = 0; fd.ap = false; }
      lastAir = isAir; outside.setAirborne(isAir);
    }
    if (isAir) {
      // autopilot or stick
      let bankT = st.roll * 30;
      if (fd.ap) {
        if (fd.lat === 'HDG') bankT = Math.max(-20, Math.min(20, angDiff(fd.hdgBug, fd.hdg) * 1.5));
        else if (fd.lat === 'GPS' || fd.lat === 'BC') bankT = Math.max(-20, Math.min(20, angDiff(fd.crs, fd.hdg) * 1.5));
        else bankT = 0;
      }
      fd.bank = toward(fd.bank, bankT, 1 - Math.exp(-dt * 1.5));
      let vsT = st.pitch * 1500 + (thrust - 1.3) * 900;
      if (fd.ap) {
        if (fd.vert === 'ALT') vsT = Math.max(-700, Math.min(700, (fd.holdAlt - fd.alt) * 2));
        else if (fd.vert === 'VS') vsT = fd.vsTgt;
        else if (fd.vert === 'FLC') vsT = Math.max(-1000, Math.min(1200, (fd.ias - fd.flcSpd) * 40 + (thrust - 1.3) * 600));
        else vsT = 0;
        // capture the selected altitude
        if (fd.vert !== 'ALT' && Math.abs(fd.selAlt - fd.alt) < Math.abs(fd.vs) * 0.15 + 30) { fd.vert = 'ALT'; fd.holdAlt = fd.selAlt; }
      }
      fd.vs = toward(fd.vs, vsT, 1 - Math.exp(-dt * 1.2));
      if (fd.alt <= 1500 && fd.vs < 0) fd.vs = toward(fd.vs, 0, 0.2);
      fd.alt = Math.max(1400, Math.min(18000, fd.alt + (fd.vs / 60) * dt));
      const iasT = Math.max(62, Math.min(185, 55 + 52 * thrust - fd.vs / 60));
      fd.ias = toward(fd.ias, iasT, 1 - Math.exp(-dt * 0.5));
      fd.pitch = toward(fd.pitch, 2 + fd.vs / 350, 1 - Math.exp(-dt * 2));
      const asym = (run[0] ? st.power1 : 0) - (run[1] ? st.power2 : 0);
      fd.slip = toward(fd.slip, Math.max(-1, Math.min(1, -asym * 0.8 + st.yaw * 0.6 + st.rudderTrim * 0.4)), 1 - Math.exp(-dt * 2));
      fd.hdg = wrap(fd.hdg + (1091 * Math.tan(fd.bank * Math.PI / 180) / Math.max(60, fd.ias)) * dt + fd.slip * 0.3 * dt);
      const gs = fd.ias * 1.04;
      fd.pos[0] += Math.sin(fd.hdg * Math.PI / 180) * gs / 3600 * dt * 8;
      fd.pos[1] += Math.cos(fd.hdg * Math.PI / 180) * gs / 3600 * dt * 8;
    } else {
      fd.ias = toward(fd.ias, st.parkBrake ? 0 : Math.min(15, thrust * 20), 1 - Math.exp(-dt));
      fd.pitch = toward(fd.pitch, st.pitch * 0.5, k8(dt)); fd.bank = 0; fd.vs = 0; fd.slip = toward(fd.slip, st.yaw * 0.3, k8(dt));
      fd.alt = FIELD;
    }
    void c;
  }
  function update(dt) {
    fd.t += dt;
    S = null;
    simulate(dt);
    const st = systems.state;
    const k = k8(dt);
    // gear lever up / down
    cur.gear = toward(cur.gear, st.gearLever === 'UP' ? 1 : 0, k);
    gearLever.position.y = GEAR_Y - 0.022 + cur.gear * 0.044;
    // power levers: idle aft (+) to max forward (-)
    [st.power1, st.power2].forEach((p, i) => { cur.pl[i] = toward(cur.pl[i], p, k); powerLevers[i].g.rotation.z = 0.6 - cur.pl[i] * 1.1; });
    cur.trim = toward(cur.trim, st.elevTrim || 0, k);
    trimWheel.rotation.z = -cur.trim * 4;
    trimPointer.position.x = 0.17 - cur.trim * 0.07;
    cur.rtrim = toward(cur.rtrim, st.rudderTrim || 0, k);
    rudderKnob.rotation.y = -cur.rtrim * 1.4;
    fuelKnobs.forEach(({ g, n }) => { const fa = st[`fuelSel${n}`] === 'CROSSFEED' ? (n === 1 ? -1 : 1) * Math.PI / 2 : FUEL_ANG[st[`fuelSel${n}`]] ?? 0; cur.fuel[n - 1] = toward(cur.fuel[n - 1], fa, k); g.rotation.y = cur.fuel[n - 1]; });
    heatLevers.forEach(({ g, key }, i) => { cur.heat[i] = toward(cur.heat[i], st[key] ? 1 : 0, k); g.rotation.z = 0.4 - cur.heat[i] * 0.8; });
    parkHandle.position.x = 0.47 - (st.parkBrake ? 0.025 : 0);
    altStatic.position.x = 0.47 - (st.altStatic ? 0.025 : 0);
    altAir.forEach((h, i) => { h.position.x = 0.47 - (st[`altAir${i + 1}`] ? 0.025 : 0); });
    // flight controls
    cur.roll = toward(cur.roll, fd.ap && !st.onGround ? fd.bank / 60 : st.roll, k);
    cur.pitch = toward(cur.pitch, st.pitch, k);
    cur.yaw = toward(cur.yaw, st.yaw, k);
    sticks.forEach((s) => { s.pivot.rotation.x = cur.roll * 0.3; s.pivot.rotation.z = cur.pitch * 0.25; });
    cur.pedal = toward(cur.pedal, st.pedalAdjust ?? 0.5, k);
    pedalSets.forEach((ps) => {
      ps.carriage.position.x = 0.92 + cur.pedal * 0.07;
      ps.pedals.forEach((p) => { p.g.rotation.z = p.p * cur.yaw * 0.25; });
    });
    // canopy and rear door
    cur.canopy = toward(cur.canopy, st.canopy ? 1 : 0, 1 - Math.exp(-dt * 2.2));
    shell.canopy.rotation.z = -52 * Math.PI / 180 * cur.canopy;
    shell.latches.forEach((l) => { l.lever.rotation.z = 0.25 + (st.canopy ? 0.9 : 0); });
    cur.door = toward(cur.door, st.rearDoor ? 1 : 0, 1 - Math.exp(-dt * 2.2));
    shell.door.rotation.x = 78 * Math.PI / 180 * cur.door;
    // propellers seen through the canopy
    const panelSt = snap().c?.engines || [];
    airframe.props.forEach((p, i) => {
      const e = panelSt[p.side < 0 ? 0 : 1];
      const rpm = e?.rpm || 0;
      cur.spin[i] += (rpm / 60) * Math.PI * 2 * dt * 0.08;
      p.hub.rotation.x = cur.spin[i];
      const fast = rpm > 500;
      p.blades.forEach((b) => { b.visible = !fast; b.parent.children.forEach((ch) => { ch.visible = !fast; }); });
      p.disc.material.opacity = fast ? 0.28 : 0;
      const feather = st[`feather${p.side < 0 ? 1 : 2}`];
      p.blades.forEach((b) => { b.rotation.y = feather ? 1.4 : 0.3; });
    });
    applyLights();
    zones.forEach((z) => z.refresh(false));
  }

  return { root, update, setNight };
}

// Camera presets, limits and focus behaviour for the cockpit scene (~1.2 m wide cabin).
export const flightDeckCamera = {
  home: { position: [-0.22, 0.98, -0.32], target: [0.5, 0.64, -0.24] },
  views: {
    Pilot: { position: [-0.22, 0.98, -0.32], target: [0.5, 0.64, -0.24] },
    Copilot: { position: [-0.22, 0.98, 0.32], target: [0.5, 0.64, 0.05] },
    Panel: { position: [-0.32, 0.9, 0.0], target: [0.5, 0.62, 0.0] },
    'Centre console': { position: [-0.1, 0.9, 0.12], target: [0.15, 0.33, 0.0] },
    'Switch panel': { position: [0.12, 0.66, -0.2], target: [0.5, 0.47, -0.18] },
    'Rear seat': { position: [-1.15, 1.04, 0.0], target: [0.45, 0.62, -0.08] },
    Canopy: { position: [-0.4, 0.95, 0.35], target: [0.4, 1.05, -0.2] },
  },
  env: { ground: false, fog: false },
  limits: { minDistance: 0.06, maxDistance: 1.4, near: 0.02, fov: 64 },
  bounds: { min: [-1.5, 0.25, -0.46], max: [0.42, 1.08, 0.46] },
  focus: { scale: 1.4, add: 0.14, min: 0.16, max: 0.9 },
};
