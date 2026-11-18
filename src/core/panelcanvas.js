// Draws Boeing-style cockpit light plates (switches, knobs, annunciators, gauges, windows) onto
// canvas textures. Layouts are declared as rows of controls; the painter spaces them automatically.
//
// Two layers can be painted at once:
//   - the albedo canvas (what the panel looks like under flood or day light), and
//   - an optional glow canvas (added on top of the panel: lit lights, digital windows and, at night,
//     the backlit engraved legends).
// With `solid: true` the painter only draws the bases of toggles, guards and knobs so the caller can
// place real 3D levers and caps on top (positions come back in the returned control list).
import * as THREE from 'three';

const PX_PER_M = 1500;
const COLORS = {
  panel: '#5d656e',
  panelEdge: '#474e57',
  ink: '#f4f3ee',
  dim: '#c9ccc8',
  screw: '#3d434b',
  dark: '#15181c',
  amber: '#ffb000',
  green: '#35e07a',
  blue: '#5cb6ff',
  red: '#ff3b2f',
  white: '#f4f4f0',
};
// legend colour of a backlit engraved label at night (incandescent-white)
const BACKLIGHT = 'rgba(255, 238, 205, 0.92)';

export function makeCanvas(wM, hM, ppm = PX_PER_M) {
  const c = document.createElement('canvas');
  c.width = Math.max(64, Math.round(wM * ppm));
  c.height = Math.max(64, Math.round(hM * ppm));
  return c;
}

export function canvasTexture(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function font(ctx, size, weight = 600, family = '"Barlow Condensed", "Arial Narrow", sans-serif') {
  ctx.font = `${weight} ${size}px ${family}`;
}

function label(ctx, text, x, y, size, color = COLORS.ink, weight = 600) {
  font(ctx, size, weight);
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lines = String(text).split('\n');
  lines.forEach((l, i) => ctx.fillText(l, x, y + (i - (lines.length - 1) / 2) * size * 1.04));
}

function rrect(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Engraved legend: white paint fill with a faint dark lower edge. At night the same legend is drawn
// into the glow layer so it reads as backlit.
function legend(env, text, x, y, size, color = COLORS.ink, weight = 600) {
  if (!text) return;
  const { ctx, glow, night } = env;
  label(ctx, text, x, y + size * 0.06, size, 'rgba(0,0,0,0.35)', weight);
  label(ctx, text, x, y, size, color, weight);
  if (glow && night && color === COLORS.ink) label(glow, text, x, y, size, BACKLIGHT, weight);
}

function screw(ctx, x, y, r) {
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, '#9aa1a8'); g.addColorStop(1, '#3a4047');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(20,22,26,0.85)'; ctx.lineWidth = r * 0.28;
  ctx.beginPath(); ctx.moveTo(x - r * 0.65, y - r * 0.25); ctx.lineTo(x + r * 0.65, y + r * 0.25); ctx.stroke();
}

// ---- primitives (u = unit size in px) ------------------------------------------------

function toggleBase(ctx, x, y, u) {
  // dark recess with a hex lock nut
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.arc(x + u * 0.04, y + u * 0.05, u * 0.3, 0, Math.PI * 2); ctx.fill();
  const g = ctx.createLinearGradient(x - u * 0.25, y - u * 0.25, x + u * 0.25, y + u * 0.25);
  g.addColorStop(0, '#c4c9ce'); g.addColorStop(1, '#5d646b');
  ctx.fillStyle = g;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const px = x + Math.cos(a) * u * 0.26, py = y + Math.sin(a) * u * 0.26;
    if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#16191d';
  ctx.beginPath(); ctx.arc(x, y, u * 0.13, 0, Math.PI * 2); ctx.fill();
}

const togglePos = (it) => (it.pos !== undefined ? it.pos : it.on ? 1 : -1);

function toggleMarks(env, x, y, u, it) {
  if (!it.marks) return;
  const s = Math.max(9, u * 0.22);
  const [up, a, b] = it.marks;
  const down = it.marks.length === 3 ? b : a;
  legend(env, up, x, y - u * 0.62, s);
  if (it.marks.length === 3 && a) legend(env, a, x + u * 0.5, y, s * 0.9);
  if (down) legend(env, down, x, y + u * 0.6, s);
}

const prim = {
  toggle(env, x, y, u, it) {
    const { ctx } = env;
    toggleBase(ctx, x, y, u);
    toggleMarks(env, x, y, u, it);
    if (env.solid) return;
    const p = togglePos(it);
    const g = ctx.createLinearGradient(x - u * 0.12, 0, x + u * 0.12, 0);
    g.addColorStop(0, '#f1f3f5'); g.addColorStop(1, '#8b9299');
    ctx.fillStyle = g;
    const len = u * 0.55;
    if (p === 0) { ctx.beginPath(); ctx.arc(x, y, u * 0.12, 0, Math.PI * 2); ctx.fill(); return; }
    rrect(ctx, x - u * 0.09, p > 0 ? y - len : y, u * 0.18, len, u * 0.09);
    ctx.fill();
  },
  guard(env, x, y, u, it) {
    prim.toggle(env, x, y, u, it);
    if (env.solid) {
      // hinge block of the guard at the top of the switch
      env.ctx.fillStyle = '#6f1914';
      env.ctx.fillRect(x - u * 0.4, y - u * 0.66, u * 0.8, u * 0.1);
      return;
    }
    const { ctx } = env;
    ctx.strokeStyle = 'rgba(214,48,40,0.95)';
    ctx.lineWidth = u * 0.08;
    rrect(ctx, x - u * 0.42, y - u * 0.62, u * 0.84, u * 1.1, u * 0.12);
    ctx.stroke();
  },
  knob(env, x, y, u, it) {
    const { ctx } = env;
    // position marks around the knob
    if (it.marks) {
      const n = it.marks.length;
      const sweep = it.sweep ?? 1.6;
      const s = Math.max(8, u * (it.markSize ?? 0.2));
      it.marks.forEach((m, i) => {
        const a = typeof m === 'object' ? m.a : n === 1 ? 0 : -sweep / 2 + (i / (n - 1)) * sweep;
        const t = typeof m === 'object' ? m.t : m;
        ctx.strokeStyle = COLORS.ink; ctx.lineWidth = Math.max(1, u * 0.04);
        ctx.beginPath();
        ctx.moveTo(x + Math.sin(a) * u * 0.5, y - Math.cos(a) * u * 0.5);
        ctx.lineTo(x + Math.sin(a) * u * 0.6, y - Math.cos(a) * u * 0.6);
        ctx.stroke();
        const r = u * (it.markR ?? 0.86);
        legend(env, t, x + Math.sin(a) * r, y - Math.cos(a) * r, s);
      });
    }
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.arc(x + u * 0.04, y + u * 0.05, u * 0.46, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0d0f12';
    ctx.beginPath(); ctx.arc(x, y, u * 0.44, 0, Math.PI * 2); ctx.fill();
    if (env.solid) return;
    const angle = it.angle ?? -0.6;
    ctx.fillStyle = '#23272c';
    ctx.beginPath(); ctx.arc(x, y, u * 0.36, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = COLORS.white;
    ctx.lineWidth = u * 0.09;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.sin(angle) * u * 0.42, y - Math.cos(angle) * u * 0.42);
    ctx.stroke();
  },
  button(env, x, y, u, it) {
    const { ctx, glow } = env;
    const w = u * (it.bw ?? 1.1), h = u * (it.bh ?? 0.72);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    rrect(ctx, x - w / 2 + u * 0.04, y - h / 2 + u * 0.05, w, h, u * 0.1); ctx.fill();
    const g = ctx.createLinearGradient(0, y - h / 2, 0, y + h / 2);
    g.addColorStop(0, it.lit ? it.lit : '#3a4047'); g.addColorStop(1, it.lit ? it.lit : '#24282d');
    ctx.fillStyle = g;
    rrect(ctx, x - w / 2, y - h / 2, w, h, u * 0.1);
    ctx.fill();
    ctx.strokeStyle = '#121418'; ctx.lineWidth = u * 0.05; ctx.stroke();
    const ts = u * (it.ts ?? 0.24);
    if (it.lit && glow) {
      glow.fillStyle = it.lit; rrect(glow, x - w / 2, y - h / 2, w, h, u * 0.1); glow.fill();
      label(glow, it.text || '', x, y, ts, '#000');
    }
    if (it.text) {
      if (it.lit) label(ctx, it.text, x, y, ts, '#111');
      else legend(env, it.text, x, y, ts, COLORS.ink);
    }
  },
  annun(env, x, y, u, it) {
    const { ctx, glow } = env;
    const c = COLORS[it.color] || it.color || COLORS.amber;
    const w = u * (it.aw ?? 1.24), h = u * (it.ah ?? 0.6);
    // black bezel, then the lens
    ctx.fillStyle = '#0c0d0f';
    rrect(ctx, x - w / 2 - u * 0.05, y - h / 2 - u * 0.05, w + u * 0.1, h + u * 0.1, u * 0.06); ctx.fill();
    ctx.fillStyle = it.lit ? c : '#1d2024';
    rrect(ctx, x - w / 2, y - h / 2, w, h, u * 0.04);
    ctx.fill();
    const ts = u * (it.ts ?? 0.19);
    if (it.lit) {
      if (glow) {
        glow.fillStyle = c; rrect(glow, x - w / 2, y - h / 2, w, h, u * 0.04); glow.fill();
        label(glow, it.text || '', x, y, ts, 'rgba(0,0,0,0.85)', 700);
      }
      label(ctx, it.text || '', x, y, ts, '#121212', 700);
    } else {
      // unlit Boeing lens: legend just readable through the dark glass
      const tint = { amber: 'rgba(255,200,110,0.30)', green: 'rgba(150,255,190,0.26)', blue: 'rgba(150,200,255,0.30)', red: 'rgba(255,140,120,0.32)' }[it.color] || 'rgba(255,255,255,0.26)';
      label(ctx, it.text || '', x, y, ts, tint, 700);
    }
  },
  light(env, x, y, u, it) { // small round indicator light
    const { ctx, glow } = env;
    const c = COLORS[it.color] || it.color || COLORS.green;
    ctx.fillStyle = '#0c0d0f'; ctx.beginPath(); ctx.arc(x, y, u * 0.24, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = it.lit ? c : '#26302a'; ctx.beginPath(); ctx.arc(x, y, u * 0.17, 0, Math.PI * 2); ctx.fill();
    if (it.lit && glow) { glow.fillStyle = c; glow.beginPath(); glow.arc(x, y, u * 0.17, 0, Math.PI * 2); glow.fill(); }
  },
  gauge(env, x, y, u, it) {
    const { ctx } = env;
    const r = u * (it.gr ?? 0.6);
    ctx.fillStyle = '#2b3036';
    ctx.beginPath(); ctx.arc(x, y, r * 1.12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0b0d10';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    if (it.face) { it.face(ctx, x, y, r, env); return; }
    ctx.strokeStyle = COLORS.white; ctx.lineWidth = u * 0.035;
    for (let i = 0; i <= 10; i++) {
      const a = -Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
      ctx.beginPath();
      ctx.moveTo(x + Math.sin(a) * r * (i % 5 ? 0.8 : 0.72), y - Math.cos(a) * r * (i % 5 ? 0.8 : 0.72));
      ctx.lineTo(x + Math.sin(a) * r * 0.92, y - Math.cos(a) * r * 0.92);
      ctx.stroke();
    }
    if (it.scale) {
      font(ctx, r * 0.24); ctx.fillStyle = COLORS.white; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      it.scale.forEach((t, i) => {
        const a = -Math.PI * 0.75 + (i / (it.scale.length - 1)) * Math.PI * 1.5;
        ctx.fillText(t, x + Math.sin(a) * r * 0.55, y - Math.cos(a) * r * 0.55);
      });
    }
    if (it.title) { font(ctx, r * 0.2); ctx.fillStyle = COLORS.dim; ctx.fillText(it.title, x, y + r * 0.42); }
    const a = -Math.PI * 0.75 + Math.max(0, Math.min(1, it.value ?? 0.35)) * Math.PI * 1.5;
    ctx.strokeStyle = COLORS.white; ctx.lineWidth = u * 0.07; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - Math.sin(a) * r * 0.15, y + Math.cos(a) * r * 0.15); ctx.lineTo(x + Math.sin(a) * r * 0.82, y - Math.cos(a) * r * 0.82); ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.fillStyle = '#30353b'; ctx.beginPath(); ctx.arc(x, y, r * 0.1, 0, Math.PI * 2); ctx.fill();
  },
  screen(env, x, y, u, it) {
    const { ctx, glow } = env;
    const w = u * (it.sw ?? 1.4), h = u * (it.sh ?? 0.6);
    ctx.fillStyle = '#2a2f35';
    rrect(ctx, x - w / 2 - u * 0.06, y - h / 2 - u * 0.06, w + u * 0.12, h + u * 0.12, u * 0.06); ctx.fill();
    ctx.fillStyle = '#050607';
    rrect(ctx, x - w / 2, y - h / 2, w, h, u * 0.04);
    ctx.fill();
    const color = it.color || COLORS.amber;
    const size = u * (it.ts ?? 0.34);
    const draw = (c, col) => {
      c.font = `600 ${size}px "JetBrains Mono", monospace`;
      c.fillStyle = col; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(it.text ?? '', x, y + u * 0.02);
    };
    draw(ctx, color);
    if (glow) draw(glow, color);
  },
  text(env, x, y, u, it) { legend(env, it.text, x, y, u * (it.ts ?? 0.24), it.color || COLORS.ink); },
  gap() {},
};

/**
 * Paint a panel from a declarative layout.
 * layout = { title, rows: [[{ t:'toggle', label, on }, ...], ...], rowH?: [weights] }
 * opts   = { glow: canvas, night: bool, solid: bool }
 * Returns normalized control positions for hit testing and for placing 3D parts.
 */
export function paintPanel(canvas, layout, opts = {}) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const glow = opts.glow ? opts.glow.getContext('2d') : null;
  if (glow) { glow.fillStyle = '#000'; glow.fillRect(0, 0, W, H); }
  const env = { ctx, glow, night: !!opts.night, solid: !!opts.solid };
  // light plate: subtle vertical sheen, bevelled edge and four Dzus screws
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  const base = layout.bg || COLORS.panel;
  bg.addColorStop(0, shade(base, 0.06)); bg.addColorStop(1, shade(base, -0.05));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const m = Math.min(W, H);
  ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = Math.max(2, m * 0.012);
  ctx.strokeRect(m * 0.006, m * 0.006, W - m * 0.012, H - m * 0.012);
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = Math.max(2, m * 0.01);
  ctx.strokeRect(1, 1, W - 2, H - 2);
  if (layout.screws !== false) {
    const sr = Math.max(3, m * 0.018);
    for (const [sx, sy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) screw(ctx, sx ? W - sr * 2.2 : sr * 2.2, sy ? H - sr * 2.2 : sr * 2.2, sr);
  }
  const titleH = layout.title ? Math.min(H * 0.12, Math.max(16, W * 0.075)) : 0;
  if (layout.title) {
    const ts = titleH * 0.52, ty = titleH * 0.62;
    legend(env, layout.title, W / 2, ty, ts);
    // Boeing bracket lines running out from the title
    font(ctx, ts);
    const tw = ctx.measureText(layout.title).width;
    const lw = Math.max(1.5, W * 0.006);
    const line = (c, color) => {
      c.strokeStyle = color; c.lineWidth = lw;
      c.beginPath();
      c.moveTo(W * 0.06, ty + titleH * 0.5); c.lineTo(W * 0.06, ty); c.lineTo(W / 2 - tw / 2 - W * 0.025, ty);
      c.moveTo(W / 2 + tw / 2 + W * 0.025, ty); c.lineTo(W * 0.94, ty); c.lineTo(W * 0.94, ty + titleH * 0.5);
      c.stroke();
    };
    line(ctx, 'rgba(244,243,238,0.8)');
    if (glow && env.night) line(glow, 'rgba(255,238,205,0.6)');
  }
  const rows = layout.rows || [];
  const top = titleH * 1.12 + H * 0.01, avail = H - top - H * 0.03;
  const weights = layout.rowH || rows.map(() => 1);
  const wsum = weights.reduce((a, b) => a + b, 0) || 1;
  const controls = [];
  let yAcc = top;
  rows.forEach((row, ri) => {
    const rowH = (avail * weights[ri]) / wsum;
    const cy = yAcc + rowH * 0.45;
    yAcc += rowH;
    const cw = row.map((it) => it.w ?? 1);
    const csum = cw.reduce((a, b) => a + b, 0) || 1;
    const padX = W * 0.03;
    let xAcc = padX;
    row.forEach((it, ci) => {
      const colW = ((W - padX * 2) * cw[ci]) / csum;
      const cx = xAcc + colW / 2;
      xAcc += colW;
      const u = Math.min((colW / (it.w ?? 1)) * 0.62, rowH * 0.5) * (it.scale ?? 1);
      const y = cy + (it.dy ?? 0) * u;
      const draw = prim[it.t];
      if (draw) draw(env, cx, y, u, it);
      if (it.top) legend(env, it.top, cx, y - u * (it.t === 'screen' ? 0.55 : 0.8), Math.max(9, u * 0.22));
      if (it.label) legend(env, it.label, cx, y + u * (it.t === 'gauge' ? (it.gr ?? 0.6) + 0.32 : it.t === 'toggle' || it.t === 'guard' ? (it.marks ? 0.9 : 0.66) : 0.78), Math.max(9, u * (it.ls ?? 0.24)));
      controls.push({ x: cx / W, y: y / H, rx: (u * 0.75) / W, ry: (u * 0.75) / H, u, uW: u / W, uH: u / H, ri, ci, it });
    });
  });
  if (layout.after) layout.after(ctx, W, H, env, controls);
  return controls; // normalized positions for hit-testing clicks and placing 3D parts
}

function shade(hex, k) {
  const c = new THREE.Color(hex);
  if (k > 0) c.lerp(new THREE.Color('#ffffff'), k); else c.lerp(new THREE.Color('#000000'), -k);
  return `#${c.getHexString()}`;
}

export { COLORS, label as drawLabel, rrect, legend as drawLegend, screw as drawScrew };
