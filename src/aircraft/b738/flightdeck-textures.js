// Procedural textures for the 737 flight deck: tileable noise, normal maps from height fields,
// fabric, carpet, sheepskin, leather, paint, circuit-breaker panels and the outside world.
import * as THREE from 'three';

// ---- tileable value noise ----------------------------------------------------------------
function hash(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function vnoise(x, y, period, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const p = (n) => ((n % period) + period) % period;
  const a = hash(p(xi), p(yi), seed), b = hash(p(xi + 1), p(yi), seed);
  const c = hash(p(xi), p(yi + 1), seed), d = hash(p(xi + 1), p(yi + 1), seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
/** Fractal noise field (0..1), tileable over `size`. */
export function fbmField(size, { cells = 8, octaves = 4, seed = 1, gain = 0.5 } = {}) {
  const f = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let amp = 1, sum = 0, norm = 0, per = cells;
      for (let o = 0; o < octaves; o++) {
        sum += amp * vnoise((x / size) * per, (y / size) * per, per, seed + o * 17);
        norm += amp; amp *= gain; per *= 2;
      }
      f[y * size + x] = sum / norm;
    }
  }
  return f;
}

function canvasOf(size, fn) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const [r, g, b] = fn(i, i % size, Math.floor(i / size));
    img.data[i * 4] = r; img.data[i * 4 + 1] = g; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function tex(canvas, { srgb = true, repeat = [1, 1] } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Normal map canvas from a tileable height field. */
function normalCanvas(h, size, strength = 2) {
  return canvasOf(size, (i, x, y) => {
    const at = (xx, yy) => h[((yy + size) % size) * size + ((xx + size) % size)];
    const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
    const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
    const l = Math.hypot(dx, dy, 1);
    return [(-dx / l * 0.5 + 0.5) * 255, (dy / l * 0.5 + 0.5) * 255, (1 / l * 0.5 + 0.5) * 255];
  });
}
const mix = (a, b, t) => a + (b - a) * t;
const lerp3 = (c1, c2, t) => [mix(c1[0], c2[0], t), mix(c1[1], c2[1], t), mix(c1[2], c2[2], t)];

// ---- material texture sets -----------------------------------------------------------------
const cache = new Map();
function once(key, fn) { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); }

/** Fine orange-peel paint (Boeing grey panels, sidewall lining). */
export const paintSet = () => once('paint', () => {
  const S = 256;
  const h = fbmField(S, { cells: 32, octaves: 3, seed: 3 });
  const rough = canvasOf(S, (i) => { const v = 150 + (h[i] - 0.5) * 70; return [v, v, v]; });
  return { normal: tex(normalCanvas(h, S, 1.2), { srgb: false }), rough: tex(rough, { srgb: false }) };
});

/** Woven glareshield / headliner fabric. */
export const fabricSet = (base = [30, 32, 35]) => once(`fabric${base}`, () => {
  const S = 256;
  const n = fbmField(S, { cells: 16, octaves: 3, seed: 7 });
  const h = new Float32Array(S * S);
  const P = 64; // threads per tile
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = (x / S) * P, v = (y / S) * P;
    const warp = Math.sin(u * Math.PI * 2) * 0.5 + 0.5, weft = Math.sin(v * Math.PI * 2) * 0.5 + 0.5;
    const over = (Math.floor(u) + Math.floor(v)) % 2 ? warp : weft;
    h[y * S + x] = over * 0.7 + n[y * S + x] * 0.3;
  }
  const map = canvasOf(S, (i) => { const k = 0.85 + h[i] * 0.25 + (n[i] - 0.5) * 0.2; return base.map((c) => c * k); });
  return { map: tex(map), normal: tex(normalCanvas(h, S, 3), { srgb: false }) };
});

/** Short-pile carpet. */
export const carpetSet = () => once('carpet', () => {
  const S = 256;
  const n = fbmField(S, { cells: 64, octaves: 2, seed: 11 });
  const m = fbmField(S, { cells: 6, octaves: 3, seed: 12 });
  const map = canvasOf(S, (i) => { const k = 0.7 + n[i] * 0.5 + (m[i] - 0.5) * 0.25; return [44 * k, 47 * k, 55 * k]; });
  return { map: tex(map), normal: tex(normalCanvas(n, S, 4), { srgb: false }) };
});

/** Sheepskin seat covers: curly wool. */
export const sheepskinSet = () => once('sheep', () => {
  const S = 512;
  const a = fbmField(S, { cells: 48, octaves: 3, seed: 21 });
  const b = fbmField(S, { cells: 12, octaves: 3, seed: 22 });
  const h = new Float32Array(S * S);
  for (let i = 0; i < S * S; i++) h[i] = Math.abs(Math.sin((a[i] * 5 + b[i] * 2) * Math.PI)) * 0.8 + a[i] * 0.2;
  const map = canvasOf(S, (i) => lerp3([150, 138, 116], [236, 226, 204], Math.min(1, h[i] * 0.75 + b[i] * 0.35)));
  return { map: tex(map), normal: tex(normalCanvas(h, S, 5), { srgb: false }) };
});

/** Grained leather / vinyl. */
export const leatherSet = (base = [38, 42, 50]) => once(`leather${base}`, () => {
  const S = 256;
  const g = fbmField(S, { cells: 40, octaves: 3, seed: 31 });
  const h = new Float32Array(S * S);
  for (let i = 0; i < S * S; i++) h[i] = Math.pow(Math.abs(g[i] - 0.5) * 2, 0.6);
  const map = canvasOf(S, (i) => base.map((c) => c * (0.9 + g[i] * 0.2)));
  const rough = canvasOf(S, (i) => { const v = 120 + h[i] * 90; return [v, v, v]; });
  return { map: tex(map), normal: tex(normalCanvas(h, S, 2.5), { srgb: false }), rough: tex(rough, { srgb: false }) };
});

/** Ribbed rubber (rudder pedal faces, floor mats). */
export const rubberSet = () => once('rubber', () => {
  const S = 128;
  const n = fbmField(S, { cells: 16, octaves: 2, seed: 41 });
  const h = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) h[y * S + x] = (Math.sin((y / S) * Math.PI * 2 * 8) > 0.2 ? 1 : 0) * 0.85 + n[y * S + x] * 0.15;
  const map = canvasOf(S, (i) => { const k = 0.8 + h[i] * 0.3; return [26 * k, 27 * k, 29 * k]; });
  return { map: tex(map), normal: tex(normalCanvas(h, S, 6), { srgb: false }) };
});

/** Brushed metal streaks. */
export const brushedSet = () => once('brushed', () => {
  const S = 256;
  const h = new Float32Array(S * S);
  for (let y = 0; y < S; y++) { const r = hash(y, 1, 5); for (let x = 0; x < S; x++) h[y * S + x] = r * 0.6 + hash(x, y, 6) * 0.4; }
  const rough = canvasOf(S, (i) => { const v = 70 + h[i] * 60; return [v, v, v]; });
  return { rough: tex(rough, { srgb: false }) };
});

// ---- circuit breaker panels -------------------------------------------------------------------
const CB_GROUPS = ['FUEL', 'ELECTRICAL', 'HYDRAULIC', 'LIGHTING', 'NAVIGATION', 'COMMUNICATION', 'FLIGHT CONTROLS', 'ENGINE', 'AIR CONDITIONING', 'ANTI-ICE', 'INSTRUMENTS', 'LANDING GEAR'];
/**
 * Paints a circuit-breaker panel and returns the breaker positions (normalized) so 3D breaker
 * buttons can be instanced on top. The group titles are generic system names (not a real panel map).
 */
export function cbPanelCanvas(wM, hM, seed = 1, ppm = 900) {
  const c = document.createElement('canvas');
  c.width = Math.round(wM * ppm); c.height = Math.round(hM * ppm);
  const ctx = c.getContext('2d');
  const W = c.width, H = c.height;
  ctx.fillStyle = '#5a626b'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 4; ctx.strokeRect(2, 2, W - 4, H - 4);
  const pts = [];
  const cols = Math.floor(wM / 0.024), rowsPerBlock = 4;
  const blockH = 0.17 * ppm;
  let gi = seed;
  for (let by = 0.04 * ppm; by + blockH < H - 0.02 * ppm; by += blockH) {
    const title = CB_GROUPS[gi++ % CB_GROUPS.length];
    ctx.font = `600 ${0.012 * ppm}px "Barlow Condensed", sans-serif`;
    ctx.fillStyle = '#f2f2ee'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(title, W / 2, by + 0.008 * ppm);
    ctx.strokeStyle = 'rgba(242,242,238,0.7)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(W * 0.04, by + 0.008 * ppm); ctx.lineTo(W / 2 - ctx.measureText(title).width / 2 - 8, by + 0.008 * ppm);
    ctx.moveTo(W / 2 + ctx.measureText(title).width / 2 + 8, by + 0.008 * ppm); ctx.lineTo(W * 0.96, by + 0.008 * ppm); ctx.stroke();
    for (let r = 0; r < rowsPerBlock; r++) {
      const y = by + 0.03 * ppm + r * 0.034 * ppm;
      for (let i = 0; i < cols; i++) {
        if (hash(i, r + by, seed) < 0.12) continue; // blank positions
        const x = (i + 0.5) * (W / cols);
        ctx.fillStyle = '#2b3036'; ctx.beginPath(); ctx.arc(x, y, 0.0075 * ppm, 0, Math.PI * 2); ctx.fill();
        // tiny legend strip under each breaker (illegible at this scale, like the real placards)
        ctx.fillStyle = 'rgba(240,240,236,0.55)';
        ctx.fillRect(x - 0.008 * ppm, y + 0.011 * ppm, 0.016 * ppm, 0.0025 * ppm);
        pts.push([x / W, y / H]);
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return { texture: t, points: pts };
}

// ---- outside world -------------------------------------------------------------------------
/** Sky dome texture (equirectangular-ish, v = elevation) with soft cumulus near the horizon. */
export function skyCanvas(night = false) {
  const W = 1024, H = 512;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, H);
  if (night) {
    g.addColorStop(0, '#03060d'); g.addColorStop(0.42, '#0b1426'); g.addColorStop(0.5, '#1d2a40'); g.addColorStop(0.52, '#0a0d12'); g.addColorStop(1, '#050608');
  } else {
    g.addColorStop(0, '#2f6db3'); g.addColorStop(0.3, '#5d95cf'); g.addColorStop(0.46, '#b8d3ea'); g.addColorStop(0.5, '#e6eef4'); g.addColorStop(0.52, '#8d969c'); g.addColorStop(1, '#5d6468');
  }
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const n = fbmField(256, { cells: 6, octaves: 5, seed: night ? 91 : 90 });
  const img = ctx.getImageData(0, 0, W, H);
  for (let y = 0; y < H * 0.5; y++) {
    const el = 1 - y / (H * 0.5); // 0 at horizon, 1 at zenith
    const band = Math.exp(-((el - 0.12) ** 2) / 0.012) * 0.9 + Math.exp(-((el - 0.35) ** 2) / 0.03) * 0.35;
    for (let x = 0; x < W; x++) {
      const v = n[(Math.floor(y * 256 / H * 1.6) % 256) * 256 + Math.floor(x * 256 / W)];
      let a = Math.max(0, (v - 0.52) * 3.2) * band;
      if (night) a *= 0.25;
      if (a <= 0) continue;
      const i = (y * W + x) * 4;
      const shadeK = night ? 40 : 255 - Math.max(0, (v - 0.6)) * 160;
      img.data[i] = mix(img.data[i], shadeK, Math.min(1, a));
      img.data[i + 1] = mix(img.data[i + 1], shadeK, Math.min(1, a));
      img.data[i + 2] = mix(img.data[i + 2], night ? 55 : shadeK + 4, Math.min(1, a));
    }
  }
  if (night) { // stars
    for (let i = 0; i < 900; i++) {
      const x = Math.floor(hash(i, 1, 77) * W), y = Math.floor(hash(i, 2, 77) * H * 0.45);
      const b = 120 + hash(i, 3, 77) * 135;
      const k = (y * W + x) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = b;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Airport surface seen from the gate area: apron concrete, taxi line, grass beyond. */
export function apronCanvas() {
  const S = 2048;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d');
  const n = fbmField(256, { cells: 24, octaves: 4, seed: 61 });
  // grass everywhere (a small noise tile scaled up), then paved areas
  const grass = canvasOf(256, (i) => [70 + n[i] * 40, 92 + n[i] * 46, 52 + n[i] * 22]);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(grass, 0, 0, S, S);
  const m = S / 160; // px per metre (texture covers 160 m)
  const cx = S / 2, cy = S / 2;
  const concrete = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(cx + x * m, cy + y * m, w * m, h * m); };
  concrete(-80, -30, 160, 60, '#9a9c98'); // apron around the aircraft (texture y = world x forward)
  concrete(-80, -80, 160, 50, '#7f817e'); // taxiway band ahead
  // concrete slab joints
  ctx.strokeStyle = 'rgba(60,62,60,0.35)'; ctx.lineWidth = 2;
  for (let i = -80; i <= 80; i += 7.5) { ctx.beginPath(); ctx.moveTo(cx + i * m, cy - 30 * m); ctx.lineTo(cx + i * m, cy + 30 * m); ctx.stroke(); }
  for (let j = -30; j <= 30; j += 7.5) { ctx.beginPath(); ctx.moveTo(cx - 80 * m, cy + j * m); ctx.lineTo(cx + 80 * m, cy + j * m); ctx.stroke(); }
  // yellow lead-in / taxi centreline straight ahead, curving onto the taxiway
  ctx.strokeStyle = '#e8b81c'; ctx.lineWidth = 0.3 * m;
  ctx.beginPath(); ctx.moveTo(cx, cy + 30 * m); ctx.lineTo(cx, cy - 40 * m); ctx.quadraticCurveTo(cx, cy - 55 * m, cx - 15 * m, cy - 55 * m); ctx.lineTo(cx - 80 * m, cy - 55 * m);
  ctx.moveTo(cx, cy - 55 * m); ctx.lineTo(cx + 80 * m, cy - 55 * m); ctx.stroke();
  // taxiway edge lines (double yellow)
  ctx.lineWidth = 0.15 * m;
  for (const e of [-79, -78.4, -31.6, -31]) { ctx.beginPath(); ctx.moveTo(cx - 80 * m, cy + e * m); ctx.lineTo(cx + 80 * m, cy + e * m); ctx.stroke(); }
  // stand markings: stop bar and red safety line
  ctx.strokeStyle = '#d33a2c'; ctx.lineWidth = 0.2 * m;
  ctx.strokeRect(cx - 22 * m, cy - 8 * m, 44 * m, 36 * m);
  ctx.fillStyle = '#f2f2f2'; ctx.fillRect(cx - 3 * m, cy - 26 * m, 6 * m, 0.4 * m);
  // tyre marks
  ctx.strokeStyle = 'rgba(30,30,30,0.18)'; ctx.lineWidth = 0.8 * m;
  for (const o of [-3, 3]) { ctx.beginPath(); ctx.moveTo(cx + o * m, cy + 30 * m); ctx.lineTo(cx + o * m, cy - 45 * m); ctx.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

/** Cloud deck seen from cruise altitude. */
export function cloudDeckCanvas() {
  const S = 512;
  const n = fbmField(S, { cells: 5, octaves: 6, seed: 71 });
  const c = canvasOf(S, (i) => { const v = Math.max(0, Math.min(1, (n[i] - 0.38) * 2.4)); return lerp3([88, 116, 150], [244, 246, 250], v); });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 6);
  return t;
}

/** Building facade with window rows (terminal, hangars). */
export function facadeCanvas(seed = 1) {
  const W = 512, H = 128;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = seed % 2 ? '#c9ccc9' : '#b7bcc2'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#56636f';
  for (let x = 6; x < W - 10; x += 22) ctx.fillRect(x, 26, 16, 34);
  ctx.fillStyle = '#3d4852'; ctx.fillRect(0, 70, W, 30);
  ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(0, 70, W, 3);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
