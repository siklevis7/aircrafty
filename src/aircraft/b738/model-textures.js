// Procedural canvas textures for the 737-800 exterior: panel lines, rivets, wear,
// a fictional neutral livery and small details (tires, spinner, doors, decals).
// Everything is generated at load time — no image assets.
import * as THREE from 'three';

const canvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  // CPU-backed: these canvases are read back (normal maps) and drawn with many small primitives
  c.getContext('2d', { willReadFrequently: true });
  return c;
};

// Small deterministic PRNG so the textures look the same on every load.
function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function tex(c, { srgb = false, repeat = false, flipY = false, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.flipY = flipY;
  t.anisotropy = aniso;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
}

/** Convert a grey height canvas (128 = flat) into a tangent-space normal map. */
export function heightToNormal(hc, strength = 2, wrap = false) {
  const w = hc.width, h = hc.height;
  const src = hc.getContext('2d').getImageData(0, 0, w, h).data;
  const out = canvas(w, h);
  const ctx = out.getContext('2d');
  const img = ctx.createImageData(w, h);
  const d = img.data;
  const k = strength / 255;
  for (let y = 0; y < h; y++) {
    const ym = wrap ? (y - 1 + h) % h : Math.max(0, y - 1);
    const yp = wrap ? (y + 1) % h : Math.min(h - 1, y + 1);
    for (let x = 0; x < w; x++) {
      const xm = wrap ? (x - 1 + w) % w : Math.max(0, x - 1);
      const xp = wrap ? (x + 1) % w : Math.min(w - 1, x + 1);
      const dx = (src[(y * w + xp) * 4] - src[(y * w + xm) * 4]) * k;
      const dy = (src[(yp * w + x) * 4] - src[(ym * w + x) * 4]) * k;
      const il = 127.5 / Math.sqrt(dx * dx + dy * dy + 1);
      const i = (y * w + x) * 4;
      d[i] = 127.5 - dx * il;
      d[i + 1] = 127.5 - dy * il;
      d[i + 2] = 127.5 + il;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

function speckle(ctx, w, h, n, r, alpha, color, rand) {
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    ctx.globalAlpha = alpha * rand();
    ctx.fillRect(rand() * w, rand() * h, r * (0.5 + rand()), r * (0.5 + rand()));
  }
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------------------ fuselage
/**
 * Fuselage maps in the fuselage's own (X, theta) parameter space:
 * u = (X − X0) / (X1 − X0) (nose → tail), v = theta / 2π (0 top, 0.25 right, 0.5 bottom, 0.75 left).
 * `bellyCos`: cos(theta) below which the belly is painted grey.
 */
export function fuselageMaps({ X0, X1, frames = [], laps = [], bellyCos = -0.36, hi = true }) {
  const W = hi ? 4096 : 2048, Hh = hi ? 1024 : 512;
  const px = (X) => ((X - X0) / (X1 - X0)) * W;
  const py = (th) => (th / (Math.PI * 2)) * Hh;
  const thB = Math.acos(bellyCos); // belly line angle from top
  const rand = rng(737);

  // ---- colour (livery + wear)
  const col = canvas(W, Hh);
  const c = col.getContext('2d');
  c.fillStyle = '#f3f4f1';
  c.fillRect(0, 0, W, Hh);
  // grey belly
  c.fillStyle = '#c3c8cd';
  c.fillRect(0, py(thB), W, py(Math.PI * 2 - thB) - py(thB));
  // accent cheatline pair just above the belly line on both sides, fading in at the nose and out at the tail cone
  const stripe = (th0, th1, color) => {
    for (const side of [1, -1]) {
      const a = side > 0 ? th0 : Math.PI * 2 - th1;
      const b = side > 0 ? th1 : Math.PI * 2 - th0;
      const g = c.createLinearGradient(px(2.2), 0, px(36.5), 0);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.04, color);
      g.addColorStop(0.93, color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.fillRect(px(2.2), py(a), px(36.5) - px(2.2), py(b) - py(a));
    }
  };
  stripe(thB - 0.075, thB - 0.035, '#1d2c54');
  stripe(thB - 0.03, thB - 0.012, '#e4572e');
  // belly grime: darker towards the bottom centre and aft of the wing (gear bay, drains, APU)
  for (let i = 0; i < 3; i++) {
    const g = c.createLinearGradient(0, py(Math.PI - 0.9 + i * 0.1), 0, py(Math.PI));
    g.addColorStop(0, 'rgba(70,64,56,0)');
    g.addColorStop(1, 'rgba(70,64,56,0.10)');
    c.fillStyle = g;
    c.fillRect(0, py(Math.PI - 0.9 + i * 0.1), W, py(Math.PI) - py(Math.PI - 0.9 + i * 0.1));
    c.save();
    c.translate(0, py(Math.PI * 2));
    c.scale(1, -1);
    c.fillRect(0, py(Math.PI - 0.9 + i * 0.1), W, py(Math.PI) - py(Math.PI - 0.9 + i * 0.1));
    c.restore();
  }
  // streaks running aft from the wing root / drain masts
  c.strokeStyle = 'rgba(60,55,48,0.05)';
  for (let i = 0; i < 90; i++) {
    const x = px(12 + rand() * 20), th = Math.PI + (rand() - 0.5) * 1.3;
    c.lineWidth = 1 + rand() * 4;
    c.beginPath(); c.moveTo(x, py(th)); c.lineTo(x + px(X0 + 2 + rand() * 6), py(th + (rand() - 0.5) * 0.04)); c.stroke();
  }
  // soot near the APU exhaust (tail cone)
  const apu = c.createLinearGradient(px(36.5), 0, px(X1), 0);
  apu.addColorStop(0, 'rgba(40,38,36,0)');
  apu.addColorStop(1, 'rgba(40,38,36,0.28)');
  c.fillStyle = apu;
  c.fillRect(px(36.5), 0, W - px(36.5), Hh);
  speckle(c, W, Hh, hi ? 9000 : 3000, 2, 0.05, '#6b655c', rand);

  // ---- height (panel lines + rivets)
  const hc = canvas(W, Hh);
  const h = hc.getContext('2d');
  h.fillStyle = 'rgb(128,128,128)';
  h.fillRect(0, 0, W, Hh);
  // circumferential rivet rows on every other frame (10 in frame pitch on the 737 fuselage)
  h.fillStyle = 'rgb(150,150,150)';
  for (let X = X0; X < X1; X += 0.508) {
    const x = px(X);
    for (let y = 0; y < Hh; y += hi ? 5 : 3) h.fillRect(x, y, 1, 1);
  }
  // longitudinal rivet rows along stringers
  for (let k = 0; k < 28; k++) {
    const y = (k / 28) * Hh;
    for (let x = 0; x < W; x += hi ? 6 : 3) h.fillRect(x, y, 1, 1);
  }
  // skin lap joints (slightly raised edge + groove)
  const groove = (x0, y0, x1, y1) => {
    h.strokeStyle = 'rgb(92,92,92)'; h.lineWidth = hi ? 2 : 1.2;
    h.beginPath(); h.moveTo(x0, y0); h.lineTo(x1, y1); h.stroke();
    h.strokeStyle = 'rgb(146,146,146)'; h.lineWidth = 1;
    h.beginPath(); h.moveTo(x0 + 2, y0 + 2); h.lineTo(x1 + 2, y1 + 2); h.stroke();
  };
  frames.forEach((X) => groove(px(X), 0, px(X), Hh));
  laps.forEach((th) => groove(0, py(th), W, py(th)));
  // a few access panels on the belly
  const panel = (Xa, Xb, tha, thb) => {
    h.strokeStyle = 'rgb(96,96,96)'; h.lineWidth = hi ? 2 : 1.2;
    h.strokeRect(px(Xa), py(tha), px(Xb) - px(Xa), py(thb) - py(tha));
    h.fillStyle = 'rgb(140,140,140)';
    for (let x = px(Xa) + 6; x < px(Xb) - 4; x += 9) { h.fillRect(x, py(tha) + 4, 2, 2); h.fillRect(x, py(thb) - 6, 2, 2); }
  };
  panel(6.0, 6.9, Math.PI - 0.12, Math.PI + 0.12); // forward E&E access
  panel(11.2, 11.9, Math.PI - 0.1, Math.PI + 0.1);
  panel(28.0, 29.0, Math.PI - 0.14, Math.PI + 0.14);
  // lightning-diverter-like small panels near the nose
  const normal = heightToNormal(hc, hi ? 2.2 : 1.6);

  // ---- roughness: paint ~0.35, belly a bit rougher, grime patches
  const rc = canvas(W / 2, Hh / 2);
  const r = rc.getContext('2d');
  r.fillStyle = 'rgb(92,92,92)';
  r.fillRect(0, 0, W / 2, Hh / 2);
  const rg = r.createLinearGradient(0, 0, 0, Hh / 2);
  rg.addColorStop(0, 'rgba(150,150,150,0)');
  rg.addColorStop(0.35, 'rgba(150,150,150,0)');
  rg.addColorStop(0.5, 'rgba(150,150,150,0.8)');
  rg.addColorStop(0.65, 'rgba(150,150,150,0)');
  r.fillStyle = rg;
  r.fillRect(0, 0, W / 2, Hh / 2);
  speckle(r, W / 2, Hh / 2, hi ? 4000 : 1500, 6, 0.08, '#b0b0b0', rand);

  return {
    map: tex(col, { srgb: true }),
    normalMap: tex(normal),
    roughnessMap: tex(rc),
  };
}

// ------------------------------------------------------------------ lifting surfaces
/**
 * Tiling panel maps for wings and tail, matching geometry.liftingPiece uvs:
 * x = span / 4 m (tiles), y: 0 upper trailing edge → 0.5 leading edge → 1 lower trailing edge.
 */
export function surfaceMaps({ hi = true } = {}) {
  const W = hi ? 1024 : 512, H = hi ? 1024 : 512;
  const rand = rng(4);
  const hc = canvas(W, H);
  const h = hc.getContext('2d');
  h.fillStyle = 'rgb(128,128,128)';
  h.fillRect(0, 0, W, H);
  const yOf = (t, upper) => (upper ? 0.5 - t * 0.5 : 0.5 + t * 0.5) * H;
  const line = (x0, y0, x1, y1, w = 2) => {
    h.strokeStyle = 'rgb(96,96,96)'; h.lineWidth = w;
    h.beginPath(); h.moveTo(x0, y0); h.lineTo(x1, y1); h.stroke();
  };
  const rivets = (x0, y0, x1, y1, step = 7) => {
    const n = Math.hypot(x1 - x0, y1 - y0) / step;
    h.fillStyle = 'rgb(150,150,150)';
    for (let i = 0; i <= n; i++) h.fillRect(x0 + ((x1 - x0) * i) / n - 0.5, y0 + ((y1 - y0) * i) / n - 0.5, 1.5, 1.5);
  };
  for (const upper of [true, false]) {
    // spar lines and a mid-box skin joint, rivet rows along stringers
    for (const t of [0.13, 0.62, 0.74]) { const y = yOf(t, upper); line(0, y, W, y); rivets(0, y + 4, W, y + 4); }
    for (let t = 0.18; t < 0.6; t += 0.06) { const y = yOf(t, upper); rivets(0, y, W, y, 9); }
    // rib-wise joints every 1 m (4 per tile) between the spars
    for (let k = 0; k < 4; k++) {
      const x = (k / 4) * W + 2;
      line(x, yOf(0.13, upper), x, yOf(0.62, upper), 1.5);
      rivets(x + 4, yOf(0.13, upper), x + 4, yOf(0.62, upper));
    }
    // small inspection panels near the leading edge
    for (let k = 0; k < 2; k++) {
      const x = (k / 2 + 0.2) * W, y = yOf(0.06, upper);
      h.strokeStyle = 'rgb(100,100,100)'; h.lineWidth = 1.5;
      h.strokeRect(x, Math.min(y, yOf(0.1, upper)), W * 0.08, Math.abs(yOf(0.1, upper) - y));
    }
  }
  const normal = heightToNormal(hc, 2, true);

  // roughness: painted ~0.45, polished leading edge, a little streaking
  const rc = canvas(W / 2, H / 2);
  const r = rc.getContext('2d');
  r.fillStyle = 'rgb(118,118,118)';
  r.fillRect(0, 0, W / 2, H / 2);
  speckle(r, W / 2, H / 2, 1600, 5, 0.1, '#a0a0a0', rand);
  for (let i = 0; i < 60; i++) {
    r.fillStyle = `rgba(150,150,150,${0.05 + rand() * 0.06})`;
    r.fillRect(rand() * W / 2, 0.5 * H / 2 + rand() * H / 4, 2 + rand() * 4, rand() * H / 5);
  }
  const le = r.createLinearGradient(0, H / 2 * 0.47, 0, H / 2 * 0.53);
  le.addColorStop(0, 'rgba(60,60,60,0)');
  le.addColorStop(0.3, 'rgba(60,60,60,1)');
  le.addColorStop(0.7, 'rgba(60,60,60,1)');
  le.addColorStop(1, 'rgba(60,60,60,0)');
  r.fillStyle = le;
  r.fillRect(0, H / 2 * 0.47, W / 2, H / 2 * 0.06);

  // metalness: bare leading edge on the wing
  const mc = canvas(16, 256);
  const m = mc.getContext('2d');
  m.fillStyle = 'rgb(30,30,30)';
  m.fillRect(0, 0, 16, 256);
  const mg = m.createLinearGradient(0, 256 * 0.465, 0, 256 * 0.535);
  mg.addColorStop(0, 'rgb(30,30,30)');
  mg.addColorStop(0.25, 'rgb(235,235,235)');
  mg.addColorStop(0.75, 'rgb(235,235,235)');
  mg.addColorStop(1, 'rgb(30,30,30)');
  m.fillStyle = mg;
  m.fillRect(0, 256 * 0.465, 16, 256 * 0.07);

  return {
    normalMap: tex(normal, { repeat: true }),
    roughnessMap: tex(rc, { repeat: true }),
    metalnessMap: tex(mc, { repeat: true }),
  };
}

// ------------------------------------------------------------------ doors
/**
 * Door skin maps (uv: x = fore→aft, y = bottom→top). kind: 'entry' | 'exit' | 'cargo' | 'panel'.
 * `aspect` = door width / height, used to keep corner radii round.
 */
export function doorMaps(kind, aspect = 0.5) {
  const H = 512, W = Math.max(64, Math.round(H * aspect));
  const hc = canvas(W, H);
  const h = hc.getContext('2d');
  const col = canvas(W, H);
  const c = col.getContext('2d');
  h.fillStyle = 'rgb(128,128,128)';
  h.fillRect(0, 0, W, H);
  c.fillStyle = '#ffffff';
  c.fillRect(0, 0, W, H);
  const rr = (ctx, x, y, w, hh, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, hh, r); };
  // seam gap around the edge
  const inset = 6, rad = Math.min(W, H) * 0.16;
  h.strokeStyle = 'rgb(60,60,60)'; h.lineWidth = 7;
  rr(h, inset, inset, W - 2 * inset, H - 2 * inset, rad); h.stroke();
  c.strokeStyle = 'rgba(40,44,50,0.75)'; c.lineWidth = 4;
  rr(c, inset, inset, W - 2 * inset, H - 2 * inset, rad); c.stroke();
  // rivet line just inside the seam
  h.fillStyle = 'rgb(150,150,150)';
  for (let y = inset + 16; y < H - inset - 16; y += 10) { h.fillRect(inset + 9, y, 2, 2); h.fillRect(W - inset - 11, y, 2, 2); }
  if (kind === 'entry' || kind === 'exit') {
    // viewing window (entry doors) / cabin window (overwing exit) — upper part of the door
    const ww = kind === 'exit' ? W * 0.42 : W * 0.26, wh = kind === 'exit' ? H * 0.2 : H * 0.11;
    const wx = W / 2 - ww / 2, wy = kind === 'exit' ? H * 0.54 : H * 0.7;
    c.fillStyle = '#9ea4aa'; rr(c, wx - 5, wy - 5, ww + 10, wh + 10, ww * 0.45); c.fill();
    c.fillStyle = '#0e1822'; rr(c, wx, wy, ww, wh, ww * 0.4); c.fill();
    h.fillStyle = 'rgb(100,100,100)'; rr(h, wx - 3, wy - 3, ww + 6, wh + 6, ww * 0.45); h.fill();
  }
  // flush handle recess
  const hx = kind === 'cargo' ? W * 0.5 : W * 0.62, hy = H * (kind === 'exit' ? 0.82 : 0.48);
  const hw = W * (kind === 'cargo' ? 0.22 : 0.26), hh = H * 0.045;
  h.fillStyle = 'rgb(84,84,84)'; rr(h, hx - hw / 2, hy, hw, hh, hh / 2); h.fill();
  c.fillStyle = '#5b636b'; rr(c, hx - hw / 2, hy, hw, hh, hh / 2); c.fill();
  c.fillStyle = '#c23b22'; c.fillRect(hx - hw / 2 - 2, hy - 8, hw + 4, 3); // red outline marking above the handle
  return { map: tex(col, { srgb: true }), normalMap: tex(heightToNormal(hc, 2.5)) };
}

// ------------------------------------------------------------------ wheels
/** Tire tread: circumferential grooves. uv x = around the tire, y = across the section (0..1). */
export function tireMaps(grooves = 4) {
  const W = 8, H = 256;
  const hc = canvas(W, H);
  const h = hc.getContext('2d');
  h.fillStyle = 'rgb(128,128,128)';
  h.fillRect(0, 0, W, H);
  // lathe profile: the tread occupies the middle band of v
  for (let i = 0; i < grooves; i++) {
    const y = H * (0.36 + (0.28 * (i + 0.5)) / grooves);
    h.fillStyle = 'rgb(40,40,40)';
    h.fillRect(0, y - 3, W, 6);
  }
  const rc = canvas(W, H);
  const r = rc.getContext('2d');
  r.fillStyle = 'rgb(225,225,225)';
  r.fillRect(0, 0, W, H);
  r.fillStyle = 'rgb(200,200,200)';
  r.fillRect(0, H * 0.36, W, H * 0.28);
  return { normalMap: tex(heightToNormal(hc, 3, true), { repeat: true }), roughnessMap: tex(rc, { repeat: true }) };
}

/** Wheel hub face: rim, bolt circle and a vented centre. */
export function hubMap() {
  const S = 256;
  const c = canvas(S, S);
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0, '#9aa1a8');
  grd.addColorStop(0.55, '#c9ced3');
  grd.addColorStop(0.8, '#8d949b');
  grd.addColorStop(0.92, '#b8bec4');
  grd.addColorStop(1, '#5f666d');
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
  g.fillStyle = '#3b4046';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.beginPath(); g.arc(S / 2 + Math.cos(a) * S * 0.3, S / 2 + Math.sin(a) * S * 0.3, S * 0.022, 0, Math.PI * 2); g.fill();
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    g.beginPath(); g.ellipse(S / 2 + Math.cos(a) * S * 0.18, S / 2 + Math.sin(a) * S * 0.18, S * 0.04, S * 0.025, a, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = '#d8dce0';
  g.beginPath(); g.arc(S / 2, S / 2, S * 0.08, 0, Math.PI * 2); g.fill();
  return tex(c, { srgb: true });
}

// ------------------------------------------------------------------ engine
/** Spinner swirl (uv x = around, y = along the cone from tip to base). */
export function spinnerMap() {
  const W = 512, H = 256;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  g.fillStyle = '#b9bfc5';
  g.fillRect(0, 0, W, H);
  // a single spiral "comma" — sweeps once around from tip to base
  g.fillStyle = '#16191d';
  for (let y = 0; y < H; y++) {
    const v = y / H;
    const x = ((v * 0.9) % 1) * W;
    const w = W * (0.02 + 0.1 * v);
    g.fillRect(x, y, w, 1);
    if (x + w > W) g.fillRect(x - W, y, w, 1);
  }
  g.fillStyle = '#16191d';
  g.fillRect(0, 0, W, H * 0.06); // dark tip
  return tex(c, { srgb: true });
}

// ------------------------------------------------------------------ decals
const BRAND = 'M16 2l3 11 11 5v3l-11-2-1 7 4 3v2l-6-2-6 2v-2l4-3-1-7-11 2v-3l11-5z';

/** Tail mark: the AirCrafty plane mark with an accent swoosh. uv x = chord fraction, y = up the fin. */
export function tailLogo(mirror = false) {
  const W = 1024, H = 1024;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  g.clearRect(0, 0, W, H);
  if (mirror) { g.translate(W, 0); g.scale(-1, 1); }
  // with flipY = false, canvas row 0 is the bottom of the decal (v = 0), so drawing y already runs up the fin
  // accent swoosh rising towards the trailing edge
  g.fillStyle = '#e4572e';
  g.beginPath();
  g.moveTo(W * 0.0, H * 0.22);
  g.bezierCurveTo(W * 0.35, H * 0.27, W * 0.65, H * 0.38, W * 1.0, H * 0.62);
  g.lineTo(W * 1.0, H * 0.7);
  g.bezierCurveTo(W * 0.62, H * 0.45, W * 0.32, H * 0.33, W * 0.0, H * 0.29);
  g.closePath();
  g.fill();
  // plane mark, nose pointing forward (towards the leading edge = x 0) and climbing
  g.save();
  g.translate(W * 0.5, H * 0.52);
  g.rotate(-Math.PI / 2 - 0.35);
  g.scale(15, 15);
  g.translate(-16, -16);
  g.fillStyle = '#ffffff';
  g.fill(new Path2D(BRAND));
  g.restore();
  return tex(c, { srgb: true, aniso: 8 });
}

/** Fuselage title, drawn so it reads correctly on the given side. uv x = fore→aft, y = bottom→top. */
export function titleDecal(side) {
  const W = 1024, H = 192;
  const c = canvas(W, H);
  const t = tex(c, { srgb: true });
  const draw = () => {
    const g = c.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, H);
    // canvas y down = decal v up → flip vertically; the right side reads tail → nose → flip horizontally too
    g.translate(side > 0 ? W : 0, H);
    g.scale(side > 0 ? -1 : 1, -1);
    g.fillStyle = '#1d2c54';
    g.textBaseline = 'middle';
    g.font = `700 ${H * 0.78}px 'Barlow Condensed', 'Arial Narrow', sans-serif`;
    const word1 = 'AIR', word2 = 'CRAFTY';
    const w1 = g.measureText(word1).width;
    g.letterSpacing = '6px';
    g.fillText(word1, 8, H * 0.54);
    g.fillStyle = '#e4572e';
    g.fillText(word2, 8 + w1 + 10, H * 0.54);
    t.needsUpdate = true;
  };
  draw();
  document.fonts?.ready.then(draw).catch(() => {});
  return t;
}
