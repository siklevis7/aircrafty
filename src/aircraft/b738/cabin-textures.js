// Procedural canvas textures for the 737-800 cabin: fabrics, carpet, plastics,
// normal maps derived from height fields, window sky, placards and panel faces.
// Everything is generated once at build time and cached.
import * as THREE from 'three';

const cache = new Map();
const memo = (key, fn) => { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); };

// Small deterministic PRNG so textures look the same on every load.
function rng(seed = 1) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function tex(canvas, { repeat = [1, 1], srgb = true, wrap = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (wrap) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = aniso;
  return t;
}

/** Tangent-space normal map from a grey height canvas (wraps at the edges). */
function normalFromHeight(src, strength = 2) {
  const w = src.width, h = src.height;
  const sd = src.getContext('2d').getImageData(0, 0, w, h).data;
  const out = makeCanvas(w, h);
  const octx = out.getContext('2d');
  const od = octx.createImageData(w, h);
  const H = (x, y) => sd[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * w + x) * 4;
      od.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      od.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      od.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      od.data[i + 3] = 255;
    }
  }
  octx.putImageData(od, 0, 0);
  return out;
}

function noiseHeight(w, h, seed, { blobs = 0, blobSize = 6, grain = 0.5, base = 128 } = {}) {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  g.fillStyle = `rgb(${base},${base},${base})`;
  g.fillRect(0, 0, w, h);
  const r = rng(seed);
  for (let i = 0; i < blobs; i++) {
    const x = r() * w, y = r() * h, s = blobSize * (0.4 + r());
    const v = Math.round(base + (r() - 0.5) * 120);
    g.fillStyle = `rgba(${v},${v},${v},0.25)`;
    for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) {
      g.beginPath(); g.arc(x + ox, y + oy, s, 0, Math.PI * 2); g.fill();
    }
  }
  if (grain) {
    const d = g.getImageData(0, 0, w, h);
    for (let i = 0; i < d.data.length; i += 4) {
      const n = (r() - 0.5) * 255 * grain;
      d.data[i] = d.data[i + 1] = d.data[i + 2] = Math.max(0, Math.min(255, d.data[i] + n));
    }
    g.putImageData(d, 0, 0);
  }
  return c;
}

// ---- fabrics -----------------------------------------------------------------------
/** Woven seat fabric with a subtle tonal motif. Returns { map, normalMap }. */
export function fabric(key, base = '#2b3a55', accent = '#3a4d6e', seed = 3) {
  return memo(`fabric-${key}`, () => {
    const S = 256;
    const c = makeCanvas(S, S), g = c.getContext('2d');
    const hc = makeCanvas(S, S), hg = hc.getContext('2d');
    g.fillStyle = base; g.fillRect(0, 0, S, S);
    hg.fillStyle = '#808080'; hg.fillRect(0, 0, S, S);
    const r = rng(seed);
    // weave: alternating warp/weft threads
    for (let y = 0; y < S; y += 4) {
      for (let x = 0; x < S; x += 4) {
        const over = ((x >> 2) + (y >> 2)) % 2 === 0;
        const v = 0.85 + r() * 0.3;
        g.fillStyle = over ? `rgba(255,255,255,${0.05 * v})` : `rgba(0,0,0,${0.12 * v})`;
        g.fillRect(x, y, 4, 4);
        hg.fillStyle = over ? '#b0b0b0' : '#505050';
        hg.fillRect(x + (over ? 0 : 1), y + (over ? 1 : 0), over ? 4 : 2, over ? 2 : 4);
      }
    }
    // tonal motif: small offset squares
    g.fillStyle = accent;
    g.globalAlpha = 0.35;
    for (let y = 0; y < S; y += 32) {
      for (let x = (y / 32) % 2 ? 16 : 0; x < S; x += 32) {
        g.fillRect(x + 12, y + 12, 8, 8);
      }
    }
    g.globalAlpha = 1;
    // fibre noise
    const d = g.getImageData(0, 0, S, S);
    for (let i = 0; i < d.data.length; i += 4) {
      const n = (r() - 0.5) * 18;
      d.data[i] += n; d.data[i + 1] += n; d.data[i + 2] += n;
    }
    g.putImageData(d, 0, 0);
    return { map: tex(c, { repeat: [3, 3] }), normalMap: tex(normalFromHeight(hc, 3), { repeat: [3, 3], srgb: false }) };
  });
}

/** Soft leather for the business-class seats. */
export function leather() {
  return memo('leather', () => {
    const S = 256;
    const hc = noiseHeight(S, S, 11, { blobs: 900, blobSize: 3, grain: 0.35 });
    const c = makeCanvas(S, S), g = c.getContext('2d');
    g.fillStyle = '#2a2420'; g.fillRect(0, 0, S, S);
    g.globalAlpha = 0.18; g.drawImage(hc, 0, 0); g.globalAlpha = 1;
    return { map: tex(c, { repeat: [2, 2] }), normalMap: tex(normalFromHeight(hc, 1.6), { repeat: [2, 2], srgb: false }) };
  });
}

/** Headrest cover (antimacassar): light fabric with a woven stripe. */
export function headrestCover() {
  return memo('headrest', () => {
    const c = makeCanvas(128, 128), g = c.getContext('2d');
    g.fillStyle = '#d9dad5'; g.fillRect(0, 0, 128, 128);
    const r = rng(5);
    for (let y = 0; y < 128; y += 2) { g.fillStyle = `rgba(0,0,0,${0.03 + r() * 0.03})`; g.fillRect(0, y, 128, 1); }
    g.fillStyle = '#7d8aa3'; g.fillRect(0, 96, 128, 8);
    g.fillStyle = '#a7b0c2'; g.fillRect(0, 106, 128, 3);
    return { map: tex(c, { wrap: false }) };
  });
}

// ---- floor -------------------------------------------------------------------------
export function carpet() {
  return memo('carpet', () => {
    const S = 512;
    const c = makeCanvas(S, S), g = c.getContext('2d');
    g.fillStyle = '#3a4150'; g.fillRect(0, 0, S, S);
    const r = rng(21);
    // speckled tufts
    for (let i = 0; i < 26000; i++) {
      const v = r();
      g.fillStyle = v < 0.45 ? 'rgba(20,24,32,0.55)' : v < 0.85 ? 'rgba(90,100,118,0.45)' : 'rgba(150,120,90,0.35)';
      g.fillRect(r() * S, r() * S, 1.6, 1.6);
    }
    // subtle geometric pattern
    g.strokeStyle = 'rgba(120,135,160,0.18)'; g.lineWidth = 3;
    for (let y = 0; y <= S; y += 128) for (let x = 0; x <= S; x += 128) {
      g.beginPath(); g.moveTo(x, y + 64); g.lineTo(x + 64, y); g.lineTo(x + 128, y + 64); g.lineTo(x + 64, y + 128); g.closePath(); g.stroke();
    }
    const hc = noiseHeight(256, 256, 22, { grain: 0.9 });
    return { map: tex(c, { repeat: [1, 1] }), normalMap: tex(normalFromHeight(hc, 1.2), { repeat: [4, 4], srgb: false }) };
  });
}

export function aisleCarpet() {
  return memo('aisle', () => {
    const W = 128, H = 512;
    const c = makeCanvas(W, H), g = c.getContext('2d');
    g.fillStyle = '#2b3140'; g.fillRect(0, 0, W, H);
    const r = rng(31);
    for (let i = 0; i < 9000; i++) {
      g.fillStyle = r() < 0.5 ? 'rgba(10,12,18,0.5)' : 'rgba(80,90,110,0.35)';
      g.fillRect(r() * W, r() * H, 1.5, 1.5);
    }
    g.fillStyle = 'rgba(140,150,175,0.35)';
    g.fillRect(8, 0, 3, H); g.fillRect(W - 11, 0, 3, H);
    for (let y = 0; y < H; y += 64) { g.fillStyle = 'rgba(140,150,175,0.12)'; g.fillRect(20, y, W - 40, 2); }
    return { map: tex(c, { repeat: [1, 1] }) };
  });
}

// ---- plastics ------------------------------------------------------------------------
/** Fine plastic grain normal map (shared by sidewalls, bins, galley). */
export function plasticGrain() {
  return memo('grain', () => {
    const hc = noiseHeight(256, 256, 41, { blobs: 1400, blobSize: 1.6, grain: 0.25 });
    return { normalMap: tex(normalFromHeight(hc, 0.9), { repeat: [6, 6], srgb: false }) };
  });
}

/** Brushed stainless steel (galley inserts, sinks). */
export function brushed() {
  return memo('brushed', () => {
    const W = 256, H = 256;
    const c = makeCanvas(W, H), g = c.getContext('2d');
    g.fillStyle = '#a9adb1'; g.fillRect(0, 0, W, H);
    const r = rng(51);
    for (let i = 0; i < 1600; i++) {
      const v = 140 + r() * 90;
      g.fillStyle = `rgba(${v},${v},${v + 4},0.18)`;
      g.fillRect(0, r() * H, W, 1);
    }
    return { map: tex(c, { repeat: [2, 2] }) };
  });
}

// ---- windows / sky -------------------------------------------------------------------
export function windowSky() {
  return memo('pane', () => {
    const W = 128, H = 192;
    const c = makeCanvas(W, H), g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#5f9bd8'); grd.addColorStop(0.55, '#b8d4ee'); grd.addColorStop(0.7, '#eef3f6'); grd.addColorStop(1, '#c7cfd6');
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    const r = rng(61);
    for (let i = 0; i < 26; i++) {
      g.fillStyle = `rgba(255,255,255,${0.25 + r() * 0.4})`;
      g.beginPath(); g.ellipse(r() * W, H * (0.55 + r() * 0.4), 12 + r() * 30, 4 + r() * 8, 0, 0, Math.PI * 2); g.fill();
    }
    return { map: tex(c, { wrap: false }) };
  });
}

export function skyDome() {
  return memo('dome', () => {
    const W = 1024, H = 512;
    const c = makeCanvas(W, H), g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#2f6fb8'); grd.addColorStop(0.4, '#89b7e3'); grd.addColorStop(0.5, '#e6eef3');
    grd.addColorStop(0.505, '#8d948f'); grd.addColorStop(0.6, '#6f7770'); grd.addColorStop(1, '#4f5550');
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    const r = rng(71);
    for (let i = 0; i < 140; i++) {
      const y = H * (0.3 + r() * 0.19);
      g.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.45})`;
      g.beginPath(); g.ellipse(r() * W, y, 20 + r() * 70, 4 + r() * 10, 0, 0, Math.PI * 2); g.fill();
    }
    // apron / taxiway markings below the horizon
    g.fillStyle = 'rgba(230,200,60,0.55)';
    for (let x = 0; x < W; x += 60) g.fillRect(x, H * 0.62, 34, 3);
    const t = tex(c, { wrap: false });
    t.wrapS = THREE.RepeatWrapping;
    return { map: t };
  });
}

// ---- gradients -----------------------------------------------------------------------
/** 1×N vertical gradient used as an emissive "light wash" map on swept surfaces. */
export function washGradient(key, fn, N = 256) {
  return memo(`wash-${key}`, () => {
    const c = makeCanvas(4, N), g = c.getContext('2d');
    for (let i = 0; i < N; i++) {
      const v = Math.max(0, Math.min(1, fn(i / (N - 1))));
      const k = Math.round(v * 255);
      g.fillStyle = `rgb(${k},${k},${k})`;
      g.fillRect(0, N - 1 - i, 4, 1);
    }
    const t = tex(c, { wrap: false, srgb: true });
    t.wrapS = THREE.RepeatWrapping;
    return t;
  });
}

// ---- placards & panels -----------------------------------------------------------------
function rrect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function text(g, s, x, y, size, color, weight = 700, align = 'center') {
  g.font = `${weight} ${size}px "Barlow Condensed", "Arial Narrow", sans-serif`;
  g.fillStyle = color;
  g.textAlign = align;
  g.textBaseline = 'middle';
  String(s).split('\n').forEach((l, i, a) => g.fillText(l, x, y + (i - (a.length - 1) / 2) * size * 1.05));
}

/** Simple placard: text on a colored background with optional border. */
export function placard(key, lines, { w = 256, h = 96, bg = '#f4f2ea', fg = '#1b1d20', border = null, size = null, radius = 8 } = {}) {
  return memo(`placard-${key}`, () => {
    const c = makeCanvas(w, h), g = c.getContext('2d');
    g.fillStyle = bg; rrect(g, 0, 0, w, h, radius); g.fill();
    if (border) { g.strokeStyle = border; g.lineWidth = Math.max(3, h * 0.05); rrect(g, g.lineWidth, g.lineWidth, w - g.lineWidth * 2, h - g.lineWidth * 2, radius); g.stroke(); }
    const n = String(lines).split('\n').length;
    text(g, lines, w / 2, h / 2, size || Math.min(h * 0.62 / n, w * 0.16), fg);
    return tex(c, { wrap: false });
  });
}

/** EXIT sign: red lettering on a light face; with arrow when asked. */
export function exitSign(key, arrow = 0) {
  return memo(`exit-${key}`, () => {
    const w = 256, h = 96;
    const c = makeCanvas(w, h), g = c.getContext('2d');
    g.fillStyle = '#f1efe6'; g.fillRect(0, 0, w, h);
    text(g, 'EXIT', w / 2 + arrow * 18, h / 2 + 2, 70, '#d0141a', 800);
    if (arrow) {
      g.fillStyle = '#d0141a';
      const ax = arrow < 0 ? 30 : w - 30;
      g.beginPath(); g.moveTo(ax + arrow * 18, h / 2); g.lineTo(ax - arrow * 10, h / 2 - 22); g.lineTo(ax - arrow * 10, h / 2 + 22); g.closePath(); g.fill();
    }
    return tex(c, { wrap: false });
  });
}

/** Passenger service unit face: reading lights, call button, signs, oxygen door, speaker. */
export function psuFace() {
  return memo('psu', () => {
    const W = 512, H = 384; // u along the cabin, v across (aisle at v=1)
    const c = makeCanvas(W, H), g = c.getContext('2d');
    g.fillStyle = '#e7e6e0'; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 3; g.strokeRect(2, 2, W - 4, H - 4);
    // oxygen door (outboard half, v 0..0.45)
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2;
    rrect(g, 30, 14, W - 60, H * 0.38, 10); g.stroke();
    g.fillStyle = 'rgba(0,0,0,0.05)'; rrect(g, 30, 14, W - 60, H * 0.38, 10); g.fill();
    // speaker grille
    g.fillStyle = 'rgba(0,0,0,0.35)';
    for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) { g.beginPath(); g.arc(70 + i * 12, H * 0.55 + j * 12, 3, 0, Math.PI * 2); g.fill(); }
    // seatbelt / no smoking sign lens
    g.fillStyle = '#2a2d31'; rrect(g, 190, H * 0.5, 130, 54, 8); g.fill();
    g.strokeStyle = '#d8d8d8'; g.lineWidth = 3;
    // no-smoking symbol
    g.beginPath(); g.arc(225, H * 0.5 + 27, 18, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(212, H * 0.5 + 14); g.lineTo(238, H * 0.5 + 40); g.stroke();
    // seat belt symbol
    g.beginPath(); g.moveTo(268, H * 0.5 + 27); g.lineTo(306, H * 0.5 + 27); g.stroke();
    g.strokeRect(280, H * 0.5 + 19, 14, 16);
    // reading lights row (aisle side) + call button
    for (let i = 0; i < 3; i++) {
      const x = 120 + i * 110, y = H * 0.84;
      const rg = g.createRadialGradient(x, y, 2, x, y, 20);
      rg.addColorStop(0, '#ffffff'); rg.addColorStop(0.6, '#cfd2d4'); rg.addColorStop(1, '#8c9196');
      g.fillStyle = rg; g.beginPath(); g.arc(x, y, 20, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#4a4f55'; rrect(g, x + 28, y - 9, 18, 18, 4); g.fill(); // light switch
    }
    g.fillStyle = '#5a6068'; g.beginPath(); g.arc(W - 70, H * 0.84, 15, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff'; g.font = '700 16px Barlow, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('☺', W - 70, H * 0.84);
    // emergency light lens and row strip
    g.fillStyle = '#c9cbc4'; rrect(g, 360, H * 0.52, 110, 40, 6); g.fill();
    return tex(c, { wrap: false });
  });
}

/** Attendant panel face (generic layout — not an operator-specific panel). */
export function attendantPanel(key, aft = false) {
  return memo(`attn-${key}`, () => {
    const W = 512, H = 320;
    const c = makeCanvas(W, H), g = c.getContext('2d');
    g.fillStyle = '#2b2f35'; rrect(g, 0, 0, W, H, 14); g.fill();
    g.fillStyle = '#3a3f46'; rrect(g, 10, 10, W - 20, H - 20, 10); g.fill();
    text(g, aft ? 'AFT ATTENDANT PANEL' : 'FWD ATTENDANT PANEL', W / 2, 32, 24, '#e8e8e2');
    const sw = (x, y, l) => {
      g.fillStyle = '#15181c'; g.beginPath(); g.arc(x, y, 14, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#c3c8cc'; rrect(g, x - 4, y - 22, 8, 22, 3); g.fill();
      text(g, l, x, y + 32, 15, '#e8e8e2', 600);
    };
    const btn = (x, y, l, col = '#5a636c') => { g.fillStyle = col; rrect(g, x - 34, y - 18, 68, 36, 6); g.fill(); text(g, l, x, y, 14, '#fff', 700); };
    if (!aft) {
      text(g, 'LIGHTS', 120, 70, 17, '#9fb2c6');
      sw(60, 110, 'ENTRY'); sw(120, 110, 'WINDOW'); sw(180, 110, 'CEILING');
      sw(60, 190, 'WORK'); sw(120, 190, 'GND SVC'); sw(180, 190, 'NIGHT');
      text(g, 'CALL', 330, 70, 17, '#9fb2c6');
      btn(290, 110, 'CAPTAIN'); btn(370, 110, 'ATTEND'); btn(330, 165, 'RESET', '#46505a');
      // guarded emergency exit lights switch
      g.strokeStyle = '#d6302a'; g.lineWidth = 4; rrect(g, 268, 210, 120, 76, 8); g.stroke();
      sw(328, 238, 'EMER EXIT LIGHTS');
      text(g, 'PA', 450, 110, 18, '#e8e8e2');
      g.fillStyle = '#15181c'; g.beginPath(); g.arc(450, 160, 26, 0, Math.PI * 2); g.fill();
    } else {
      text(g, 'LIGHTS', 120, 70, 17, '#9fb2c6');
      sw(70, 110, 'ENTRY'); sw(150, 110, 'WORK');
      text(g, 'CALL', 330, 70, 17, '#9fb2c6');
      btn(290, 110, 'CAPTAIN'); btn(370, 110, 'ATTEND'); btn(330, 165, 'RESET', '#46505a');
      g.fillStyle = '#7a1612'; rrect(g, 40, 200, 150, 44, 6); g.fill();
      text(g, 'LAV SMOKE', 115, 222, 18, '#ffb0a8');
      g.fillStyle = '#1b1e22'; rrect(g, 230, 200, 230, 70, 6); g.fill();
      text(g, 'WATER QTY', 345, 214, 13, '#9fb2c6', 600);
      for (let i = 0; i < 5; i++) { g.fillStyle = i < 4 ? '#2bd46a' : '#264034'; g.fillRect(250 + i * 42, 232, 34, 22); }
    }
    return tex(c, { wrap: false });
  });
}

/** Galley front: trolley bays, ovens, beverage makers, stowage boxes. */
export function galleyFace(key, cols) {
  return memo(`galley-${key}`, () => {
    const W = 512, H = 768;
    const c = makeCanvas(W, H), g = c.getContext('2d');
    g.fillStyle = '#d9dad5'; g.fillRect(0, 0, W, H);
    const colW = W / cols.length;
    cols.forEach((col, ci) => {
      const x0 = ci * colW;
      col.forEach(([kind, y0, y1, lbl]) => {
        const y = y0 * H, h = (y1 - y0) * H;
        if (kind === 'cart') {
          g.fillStyle = '#9ea3a8'; g.fillRect(x0 + 6, y, colW - 12, h);
          g.fillStyle = '#b8bcc0'; g.fillRect(x0 + 12, y + 8, colW - 24, h - 16);
          g.fillStyle = '#d23a2a'; g.fillRect(x0 + colW / 2 - 18, y + 16, 36, 10); // latch
          g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2;
          for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(x0 + 14, y + (h * k) / 4); g.lineTo(x0 + colW - 14, y + (h * k) / 4); g.stroke(); }
        } else if (kind === 'oven') {
          g.fillStyle = '#7f858b'; g.fillRect(x0 + 8, y, colW - 16, h);
          g.fillStyle = '#1d2024'; g.fillRect(x0 + 18, y + h * 0.18, colW - 36, h * 0.58);
          g.fillStyle = '#2bd46a'; g.fillRect(x0 + 22, y + 8, 30, 10);
          g.fillStyle = '#ccc'; g.fillRect(x0 + 18, y + h * 0.84, colW - 36, 8);
        } else if (kind === 'coffee') {
          g.fillStyle = '#6f757b'; g.fillRect(x0 + 8, y, colW - 16, h);
          g.fillStyle = '#1d2024'; g.fillRect(x0 + colW * 0.3, y + h * 0.35, colW * 0.4, h * 0.5);
          g.fillStyle = '#ffb000'; g.fillRect(x0 + 18, y + 10, 14, 8);
          g.fillStyle = '#2bd46a'; g.fillRect(x0 + 38, y + 10, 14, 8);
        } else if (kind === 'box') {
          g.fillStyle = '#c4c6c2'; g.fillRect(x0 + 6, y + 2, colW - 12, h - 4);
          g.fillStyle = '#80868c'; g.fillRect(x0 + colW / 2 - 14, y + h / 2 - 4, 28, 8);
        } else if (kind === 'counter') {
          g.fillStyle = '#9aa0a6'; g.fillRect(x0, y, colW, h);
        } else if (kind === 'cb') {
          g.fillStyle = '#3a3f46'; g.fillRect(x0 + 10, y, colW - 20, h);
          for (let k = 0; k < 10; k++) { g.fillStyle = '#c9cdd1'; g.beginPath(); g.arc(x0 + 26 + (k % 5) * ((colW - 52) / 4), y + h * (k < 5 ? 0.35 : 0.7), 5, 0, Math.PI * 2); g.fill(); }
        }
        if (lbl) text(g, lbl, x0 + colW / 2, y + h * 0.5, 18, kind === 'oven' || kind === 'coffee' || kind === 'cb' ? '#eee' : '#33373b', 700);
      });
    });
    return tex(c, { wrap: false });
  });
}

/** Overwing exit hatch lining: window cut-out is geometry; this paints handle and placards. */
export function hatchFace() {
  return memo('hatch', () => {
    const W = 256, H = 512;
    const c = makeCanvas(W, H), g = c.getContext('2d');
    g.fillStyle = '#e9e8e2'; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 2; g.strokeRect(6, 6, W - 12, H - 12);
    // handle cover at top
    g.fillStyle = '#1e2125'; rrect(g, 58, 26, 140, 54, 10); g.fill();
    g.fillStyle = '#d0141a'; rrect(g, 76, 40, 104, 26, 6); g.fill();
    text(g, 'PULL', W / 2, 53, 20, '#fff', 800);
    // (window cut-out occupies roughly y 97–287 of this canvas)
    text(g, 'EMERGENCY EXIT', W / 2, 316, 24, '#d0141a', 800);
    g.fillStyle = '#f6f4ec'; rrect(g, 24, 342, W - 48, 138, 8); g.fill();
    g.strokeStyle = '#d0141a'; g.lineWidth = 3; rrect(g, 24, 342, W - 48, 138, 8); g.stroke();
    text(g, '1  PULL HANDLE\n2  HATCH OPENS\n     UP & OUT', W / 2, 411, 22, '#1b1d20', 700);
    return tex(c, { wrap: false });
  });
}

/** Door lining with arming placard and handle arrows. */
export function doorFace(key) {
  return memo(`door-${key}`, () => {
    const W = 256, H = 512;
    const c = makeCanvas(W, H), g = c.getContext('2d');
    g.fillStyle = '#e4e3dd'; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(0,0,0,0.1)'; g.lineWidth = 2;
    rrect(g, 12, 12, W - 24, H - 24, 14); g.stroke();
    // handle arc placard
    g.strokeStyle = '#d0141a'; g.lineWidth = 5;
    g.beginPath(); g.arc(W / 2, H * 0.47, 56, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
    text(g, 'OPEN', W / 2, H * 0.47 - 74, 22, '#d0141a', 800);
    // arming instructions
    g.fillStyle = '#f6f4ec'; rrect(g, 28, H * 0.6, W - 56, 86, 8); g.fill();
    g.strokeStyle = '#1b1d20'; g.lineWidth = 2; rrect(g, 28, H * 0.6, W - 56, 86, 8); g.stroke();
    text(g, 'GIRT BAR IN FLOOR\nBRACKETS = ARMED', W / 2, H * 0.6 + 43, 19, '#1b1d20', 700);
    return tex(c, { wrap: false });
  });
}
