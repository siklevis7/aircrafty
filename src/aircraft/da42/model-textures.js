// Procedural canvas textures for the DA42 exterior: a smooth white composite finish with
// subtle seams, a fictional AirCrafty livery, walkway areas, tires, hubs and decals.
// Everything is generated at load time — no image assets.
import * as THREE from 'three';

const canvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
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

function tex(c, { srgb = false, repeat = false, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.flipY = false;
  t.anisotropy = aniso;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
}

/** Grey height canvas (128 = flat) -> tangent-space normal map. */
function heightToNormal(hc, strength = 2, wrap = false) {
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

export const LIVERY = { navy: '#1d2c54', accent: '#e4572e', white: '#f6f7f4' };

// ------------------------------------------------------------------ fuselage
/**
 * Fuselage maps in (X, theta) space: u = (X − X0) / (X1 − X0) nose → tail,
 * v = theta / 2π (0 top, 0.25 right, 0.5 bottom, 0.75 left).
 * `thetaAt(X, Y, side)` converts a height on the skin to theta so livery lines follow real heights.
 * `seams`: [[X, Y0, Y1]] vertical panel joints drawn on both sides; `panels`: [[X0, X1, Y0, Y1, side]].
 */
export function fuselageMaps({ X0, X1, thetaAt, seams = [], panels = [], hi = true }) {
  const W = hi ? 2048 : 1024, H = hi ? 1024 : 512;
  const px = (X) => ((X - X0) / (X1 - X0)) * W;
  const py = (th) => (((th % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * H;
  const rand = rng(42);

  const col = canvas(W, H);
  const c = col.getContext('2d');
  c.fillStyle = LIVERY.white;
  c.fillRect(0, 0, W, H);

  // Livery band: a navy sweep rising from the lower nose towards the tail boom, with an accent pin-stripe.
  // Drawn per side as a polygon in (X, Y) mapped to (u, theta).
  const band = (side, yLow, yHigh, color) => {
    c.fillStyle = color;
    c.beginPath();
    const N = 80;
    for (let i = 0; i <= N; i++) {
      const X = X0 + 0.25 + (i / N) * (X1 - X0 - 0.4);
      const th = thetaAt(X, yHigh(X), side);
      if (i === 0) c.moveTo(px(X), py(th)); else c.lineTo(px(X), py(th));
    }
    for (let i = N; i >= 0; i--) {
      const X = X0 + 0.25 + (i / N) * (X1 - X0 - 0.4);
      c.lineTo(px(X), py(thetaAt(X, yLow(X), side)));
    }
    c.closePath();
    c.fill();
  };
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  // heights (m) of the band edges along the fuselage: low at the nose, sweeping up over the tail boom
  const mid = (X) => 0.74 + 0.5 * smooth(3.4, 7.6, X) - 0.06 * smooth(0.2, 1.6, X);
  const fade = (X) => 0.07 * smooth(0.3, 1.4, X) * (1 - 0.5 * smooth(6.8, 8.1, X));
  for (const side of [-1, 1]) {
    band(side, (X) => mid(X) - fade(X), (X) => mid(X) + fade(X), LIVERY.navy);
    band(side, (X) => mid(X) + fade(X) + 0.012, (X) => mid(X) + fade(X) + 0.012 + 0.022 * smooth(0.6, 1.6, X), LIVERY.accent);
  }
  // soft exhaust staining is on the nacelles, not here; a light belly grime gradient only
  const g = c.createLinearGradient(0, H * 0.38, 0, H * 0.5);
  g.addColorStop(0, 'rgba(80,74,66,0)');
  g.addColorStop(1, 'rgba(80,74,66,0.07)');
  c.fillStyle = g;
  c.fillRect(0, H * 0.38, W, H * 0.12);
  c.save(); c.translate(0, H); c.scale(1, -1); c.fillRect(0, H * 0.38, W, H * 0.12); c.restore();
  speckle(c, W, H, hi ? 3000 : 1200, 2, 0.03, '#6b655c', rand);

  // ---- height: composite skin is smooth; only panel joints and access panels show
  const hc = canvas(W, H);
  const h = hc.getContext('2d');
  h.fillStyle = 'rgb(128,128,128)';
  h.fillRect(0, 0, W, H);
  const groove = (pts) => {
    h.strokeStyle = 'rgb(96,96,96)'; h.lineWidth = hi ? 2 : 1.4;
    h.beginPath(); pts.forEach(([x, y], i) => (i ? h.lineTo(x, y) : h.moveTo(x, y))); h.stroke();
  };
  for (const side of [-1, 1]) {
    for (const [X, Y0, Y1] of seams) {
      const pts = [];
      for (let k = 0; k <= 12; k++) { const Y = Y0 + ((Y1 - Y0) * k) / 12; pts.push([px(X), py(thetaAt(X, Y, side))]); }
      groove(pts);
    }
  }
  for (const [Xa, Xb, Ya, Yb, side] of panels) {
    const pts = [];
    for (let k = 0; k <= 8; k++) { const X = Xa + ((Xb - Xa) * k) / 8; pts.push([px(X), py(thetaAt(X, Ya, side))]); }
    for (let k = 0; k <= 8; k++) { const Y = Ya + ((Yb - Ya) * k) / 8; pts.push([px(Xb), py(thetaAt(Xb, Y, side))]); }
    for (let k = 8; k >= 0; k--) { const X = Xa + ((Xb - Xa) * k) / 8; pts.push([px(X), py(thetaAt(X, Yb, side))]); }
    for (let k = 8; k >= 0; k--) { const Y = Ya + ((Yb - Ya) * k) / 8; pts.push([px(Xa), py(thetaAt(Xa, Y, side))]); }
    groove(pts);
  }
  // the fuselage is built as two shells bonded on the centreline: a faint seam top and bottom
  h.strokeStyle = 'rgb(118,118,118)'; h.lineWidth = 1;
  for (const y of [1, H / 2, H - 1]) { h.beginPath(); h.moveTo(0, y); h.lineTo(W, y); h.stroke(); }
  const normal = heightToNormal(hc, hi ? 2 : 1.5);

  // ---- roughness: glossy paint, slightly duller belly
  const rc = canvas(W / 4, H / 4);
  const r = rc.getContext('2d');
  r.fillStyle = 'rgb(70,70,70)';
  r.fillRect(0, 0, W / 4, H / 4);
  const rg = r.createLinearGradient(0, 0, 0, H / 4);
  rg.addColorStop(0.36, 'rgba(120,120,120,0)');
  rg.addColorStop(0.5, 'rgba(120,120,120,0.8)');
  rg.addColorStop(0.64, 'rgba(120,120,120,0)');
  r.fillStyle = rg;
  r.fillRect(0, 0, W / 4, H / 4);
  speckle(r, W / 4, H / 4, 600, 4, 0.06, '#a0a0a0', rand);

  return { map: tex(col, { srgb: true }), normalMap: tex(normal), roughnessMap: tex(rc) };
}

// ------------------------------------------------------------------ lifting surfaces
/**
 * Composite lifting-surface maps (tile spanwise every 4 m; y: 0 upper TE → 0.5 LE → 1 lower TE).
 * Smooth skin, a faint spar-cap line and a slightly glossier leading edge.
 */
export function surfaceMaps({ hi = true } = {}) {
  const W = hi ? 512 : 256, H = hi ? 512 : 256;
  const rand = rng(7);
  const hc = canvas(W, H);
  const h = hc.getContext('2d');
  h.fillStyle = 'rgb(128,128,128)';
  h.fillRect(0, 0, W, H);
  // small inspection covers on the lower surface (y > 0.5)
  h.strokeStyle = 'rgb(100,100,100)'; h.lineWidth = 1.5;
  for (let k = 0; k < 2; k++) {
    const x = (k / 2 + 0.15) * W;
    h.beginPath(); h.ellipse(x, H * 0.72, W * 0.035, H * 0.03, 0, 0, Math.PI * 2); h.stroke();
  }
  const normal = heightToNormal(hc, 1.6, true);
  const rc = canvas(W / 2, H / 2);
  const r = rc.getContext('2d');
  r.fillStyle = 'rgb(78,78,78)';
  r.fillRect(0, 0, W / 2, H / 2);
  speckle(r, W / 2, H / 2, 500, 4, 0.06, '#9a9a9a', rand);
  // bug-strike dulling just aft of the leading edge
  const le = r.createLinearGradient(0, H / 2 * 0.45, 0, H / 2 * 0.55);
  le.addColorStop(0, 'rgba(130,130,130,0)');
  le.addColorStop(0.5, 'rgba(130,130,130,0.6)');
  le.addColorStop(1, 'rgba(130,130,130,0)');
  r.fillStyle = le;
  r.fillRect(0, H / 2 * 0.45, W / 2, H / 2 * 0.1);
  return { normalMap: tex(normal, { repeat: true }), roughnessMap: tex(rc, { repeat: true }) };
}

/**
 * Colour map for the stub wing: non-slip walkway on the upper surface next to the fuselage,
 * with "NO STEP" edging. uv as liftingPiece (x = span / 4 m, y = chord position).
 * `s0`, `s1`: walkway span range in metres from the centreline.
 */
export function walkwayMap({ s0 = 0.6, s1 = 1.2, t0 = 0.12, t1 = 0.62, side = 1 } = {}) {
  const W = 512, H = 512;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  g.fillStyle = LIVERY.white;
  g.fillRect(0, 0, W, H);
  // uv x spans 0..1 per 4 m of span; the stub wing spans 0..~2 m → x 0..0.5
  const X = (s) => (s / 4) * W;
  const Y = (t) => (0.5 - t * 0.5) * H; // upper surface
  g.fillStyle = '#3a3e44';
  g.fillRect(X(s0), Y(t1), X(s1) - X(s0), Y(t0) - Y(t1));
  // grit texture
  const rand = rng(11);
  speckle(g, W, H, 0, 1, 0, '#000', rand);
  g.fillStyle = 'rgba(255,255,255,0.08)';
  for (let i = 0; i < 1400; i++) g.fillRect(X(s0) + rand() * (X(s1) - X(s0)), Y(t1) + rand() * (Y(t0) - Y(t1)), 1, 1);
  // red border line
  g.strokeStyle = '#c23b22'; g.lineWidth = 3;
  g.strokeRect(X(s1) + 3, Y(t1) - 3, 1, Y(t0) - Y(t1) + 6);
  // NO STEP stencil outboard of the walkway
  g.save();
  g.translate(X(s1) + 18, (Y(t0) + Y(t1)) / 2);
  g.rotate(side > 0 ? Math.PI / 2 : -Math.PI / 2);
  g.fillStyle = '#c23b22';
  g.font = '700 15px Arial, sans-serif';
  g.textAlign = 'center';
  g.fillText('NO STEP', 0, 0);
  g.restore();
  return tex(c, { srgb: true, repeat: true });
}

// ------------------------------------------------------------------ wheels
/** Tire tread: circumferential grooves (lathe uv). */
export function tireMaps(grooves = 3) {
  const W = 8, H = 256;
  const hc = canvas(W, H);
  const h = hc.getContext('2d');
  h.fillStyle = 'rgb(128,128,128)';
  h.fillRect(0, 0, W, H);
  for (let i = 0; i < grooves; i++) {
    const y = H * (0.38 + (0.24 * (i + 0.5)) / grooves);
    h.fillStyle = 'rgb(40,40,40)';
    h.fillRect(0, y - 3, W, 6);
  }
  const rc = canvas(W, H);
  const r = rc.getContext('2d');
  r.fillStyle = 'rgb(225,225,225)';
  r.fillRect(0, 0, W, H);
  return { normalMap: tex(heightToNormal(hc, 3, true), { repeat: true }), roughnessMap: tex(rc, { repeat: true }) };
}

/** Light-aircraft wheel hub: split rim with bolt circle. */
export function hubMap() {
  const S = 256;
  const c = canvas(S, S);
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0, '#c9ced3');
  grd.addColorStop(0.3, '#e2e5e8');
  grd.addColorStop(0.75, '#b5bbc1');
  grd.addColorStop(0.9, '#d4d8dc');
  grd.addColorStop(1, '#7d848b');
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
  g.fillStyle = '#4a5057';
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    g.beginPath(); g.arc(S / 2 + Math.cos(a) * S * 0.24, S / 2 + Math.sin(a) * S * 0.24, S * 0.03, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = '#9aa1a8';
  g.beginPath(); g.arc(S / 2, S / 2, S * 0.1, 0, Math.PI * 2); g.fill();
  return tex(c, { srgb: true });
}

// ------------------------------------------------------------------ decals
const BRAND = 'M16 2l3 11 11 5v3l-11-2-1 7 4 3v2l-6-2-6 2v-2l4-3-1-7-11 2v-3l11-5z';

/** Fin decal: navy sweep with an accent stripe and the AirCrafty plane mark. uv x = chord fraction, y = up the fin. */
export function finLogo() {
  const W = 1024, H = 1024;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  g.clearRect(0, 0, W, H);
  // navy sweep filling the lower aft corner (row 0 = bottom of the fin)
  g.fillStyle = LIVERY.navy;
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(W * 0.05, 0);
  g.bezierCurveTo(W * 0.4, H * 0.15, W * 0.7, H * 0.35, W, H * 0.62);
  g.lineTo(W, 0);
  g.closePath();
  g.fill();
  g.fillStyle = LIVERY.accent;
  g.beginPath();
  g.moveTo(W * 0.05, 0);
  g.bezierCurveTo(W * 0.4, H * 0.15, W * 0.7, H * 0.35, W, H * 0.62);
  g.lineTo(W, H * 0.68);
  g.bezierCurveTo(W * 0.68, H * 0.42, W * 0.36, H * 0.2, 0, H * 0.04);
  g.closePath();
  g.fill();
  // plane mark in the white upper part, climbing forward
  g.save();
  g.translate(W * 0.48, H * 0.66);
  g.rotate(-Math.PI / 2 - 0.35);
  g.scale(9, 9);
  g.translate(-16, -16);
  g.fillStyle = LIVERY.navy;
  g.fill(new Path2D(BRAND));
  g.restore();
  return tex(c, { srgb: true });
}

/** Small AirCrafty title for the tail boom, readable on either side. uv x = fore→aft, y = bottom→top. */
export function titleDecal(side) {
  const W = 1024, H = 160;
  const c = canvas(W, H);
  const t = tex(c, { srgb: true });
  const draw = () => {
    const g = c.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, H);
    g.translate(side > 0 ? W : 0, H);
    g.scale(side > 0 ? -1 : 1, -1);
    g.textBaseline = 'middle';
    g.font = `700 ${H * 0.78}px 'Barlow Condensed', 'Arial Narrow', sans-serif`;
    const w1 = g.measureText('AIR').width;
    g.fillStyle = LIVERY.navy;
    g.fillText('AIR', 8, H * 0.54);
    g.fillStyle = LIVERY.accent;
    g.fillText('CRAFTY', 8 + w1 + 6, H * 0.54);
    t.needsUpdate = true;
  };
  draw();
  document.fonts?.ready.then(draw).catch(() => {});
  return t;
}

/** Propeller blade: dark composite blade with a white tip band (uv y = root → tip). */
export function bladeMap() {
  const c = canvas(16, 256);
  const g = c.getContext('2d');
  g.fillStyle = '#2a2d31';
  g.fillRect(0, 0, 16, 256);
  g.fillStyle = '#f2f2ee';
  g.fillRect(0, 256 * 0.9, 16, 256 * 0.1);
  // erosion sheath sheen is in the geometry/material; a faint root band
  g.fillStyle = '#3a3e44';
  g.fillRect(0, 0, 16, 256 * 0.08);
  return tex(c, { srgb: true });
}
