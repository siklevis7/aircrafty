// Draws stylized cockpit panels (switches, knobs, annunciators, gauges) onto canvas textures.
// Layouts are declared as rows of controls; the painter spaces them automatically.
import * as THREE from 'three';

const PX_PER_M = 1500;
const COLORS = {
  panel: '#5f6873',
  panelEdge: '#4b535d',
  ink: '#f2f2ee',
  dim: '#c9ccc8',
  screw: '#3d434b',
  dark: '#15181c',
  amber: '#ffb000',
  green: '#2bd46a',
  blue: '#46a8ff',
  red: '#ff3b2f',
  white: '#f4f4f0',
};

export function makeCanvas(wM, hM) {
  const c = document.createElement('canvas');
  c.width = Math.max(64, Math.round(wM * PX_PER_M));
  c.height = Math.max(64, Math.round(hM * PX_PER_M));
  return c;
}

export function canvasTexture(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function font(ctx, size, weight = 600) {
  ctx.font = `${weight} ${size}px "Barlow Condensed", "Arial Narrow", sans-serif`;
}

function label(ctx, text, x, y, size, color = COLORS.ink) {
  font(ctx, size);
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lines = String(text).split('\n');
  lines.forEach((l, i) => ctx.fillText(l, x, y + (i - (lines.length - 1) / 2) * size * 1.05));
}

function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---- primitives (u = unit size in px) ------------------------------------------------

const prim = {
  toggle(ctx, x, y, u, { on = false } = {}) {
    ctx.fillStyle = COLORS.dark;
    ctx.beginPath(); ctx.arc(x, y, u * 0.42, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#9aa1a8';
    ctx.beginPath(); ctx.arc(x, y, u * 0.24, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createLinearGradient(x - u * 0.12, 0, x + u * 0.12, 0);
    g.addColorStop(0, '#e9ecef'); g.addColorStop(1, '#8b9299');
    ctx.fillStyle = g;
    rrect(ctx, x - u * 0.11, on ? y - u * 0.62 : y - u * 0.04, u * 0.22, u * 0.66, u * 0.1);
    ctx.fill();
  },
  guard(ctx, x, y, u, opts) {
    prim.toggle(ctx, x, y, u, opts);
    ctx.strokeStyle = 'rgba(214,48,40,0.95)';
    ctx.lineWidth = u * 0.08;
    rrect(ctx, x - u * 0.5, y - u * 0.75, u, u * 1.25, u * 0.12);
    ctx.stroke();
  },
  knob(ctx, x, y, u, { angle = -0.6 } = {}) {
    ctx.fillStyle = '#0d0f12';
    ctx.beginPath(); ctx.arc(x, y, u * 0.46, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#23272c';
    ctx.beginPath(); ctx.arc(x, y, u * 0.36, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = COLORS.white;
    ctx.lineWidth = u * 0.09;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.sin(angle) * u * 0.42, y - Math.cos(angle) * u * 0.42);
    ctx.stroke();
  },
  button(ctx, x, y, u, { text = '', lit = null } = {}) {
    ctx.fillStyle = lit ? lit : '#2a2f35';
    rrect(ctx, x - u * 0.55, y - u * 0.36, u * 1.1, u * 0.72, u * 0.12);
    ctx.fill();
    ctx.strokeStyle = '#1a1d21'; ctx.lineWidth = u * 0.06; ctx.stroke();
    if (text) label(ctx, text, x, y, u * 0.26, lit ? '#111' : COLORS.dim);
  },
  annun(ctx, x, y, u, { text = '', color = 'amber', lit = false } = {}) {
    const c = COLORS[color] || color;
    ctx.fillStyle = lit ? c : '#1e2125';
    rrect(ctx, x - u * 0.62, y - u * 0.3, u * 1.24, u * 0.6, u * 0.06);
    ctx.fill();
    label(ctx, text, x, y, u * 0.2, lit ? '#111' : 'rgba(255,255,255,0.28)');
  },
  gauge(ctx, x, y, u, { value = 0.35 } = {}) {
    const r = u * 0.6;
    ctx.fillStyle = '#0b0d10';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = COLORS.white; ctx.lineWidth = u * 0.04;
    for (let i = 0; i <= 10; i++) {
      const a = -Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
      ctx.beginPath();
      ctx.moveTo(x + Math.sin(a) * r * 0.78, y - Math.cos(a) * r * 0.78);
      ctx.lineTo(x + Math.sin(a) * r * 0.92, y - Math.cos(a) * r * 0.92);
      ctx.stroke();
    }
    const a = -Math.PI * 0.75 + value * Math.PI * 1.5;
    ctx.strokeStyle = COLORS.white; ctx.lineWidth = u * 0.07;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.sin(a) * r * 0.75, y - Math.cos(a) * r * 0.75); ctx.stroke();
  },
  screen(ctx, x, y, u, { text = '', color = COLORS.amber } = {}) {
    ctx.fillStyle = '#07090b';
    rrect(ctx, x - u * 0.7, y - u * 0.3, u * 1.4, u * 0.6, u * 0.05);
    ctx.fill();
    ctx.font = `600 ${u * 0.34}px "JetBrains Mono", monospace`;
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + u * 0.02);
  },
};

/**
 * Paint a panel from a declarative layout.
 * layout = { title, rows: [[{ t:'toggle', label, on }, ...], ...] }
 */
export function paintPanel(canvas, layout) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.fillStyle = COLORS.panel;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = COLORS.panelEdge;
  ctx.lineWidth = Math.max(3, W * 0.012);
  ctx.strokeRect(1, 1, W - 2, H - 2);
  // corner screws
  ctx.fillStyle = COLORS.screw;
  for (const [sx, sy] of [[0.04, 0.05], [0.96, 0.05], [0.04, 0.95], [0.96, 0.95]]) {
    ctx.beginPath(); ctx.arc(sx * W, sy * H, Math.min(W, H) * 0.014, 0, Math.PI * 2); ctx.fill();
  }
  const titleH = layout.title ? Math.min(H * 0.13, 46) : 0;
  if (layout.title) {
    label(ctx, layout.title, W / 2, titleH * 0.62, titleH * 0.5, COLORS.white);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(W * 0.12, titleH * 1.02); ctx.lineTo(W * 0.88, titleH * 1.02); ctx.stroke();
  }
  const rows = layout.rows || [];
  const top = titleH * 1.15, avail = H - top - H * 0.03;
  const rowH = avail / Math.max(1, rows.length);
  rows.forEach((row, ri) => {
    const cy = top + rowH * (ri + 0.45);
    const n = row.length;
    const colW = W / n;
    const u = Math.min(colW * 0.62, rowH * 0.5);
    row.forEach((it, ci) => {
      const cx = colW * (ci + 0.5);
      const draw = prim[it.t];
      if (draw) draw(ctx, cx, cy, u, it);
      if (it.label) label(ctx, it.label, cx, cy + u * 0.82 + (it.t === 'gauge' ? u * 0.1 : 0), Math.max(12, u * 0.27), COLORS.ink);
    });
  });
}

export { COLORS, label as drawLabel, rrect };
