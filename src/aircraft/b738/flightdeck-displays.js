// Canvas painters for the 737 NG flight deck displays and custom-drawn panels:
// PFD, ND (expanded MAP), upper DU (primary engine + fuel), lower DU (secondary engine), ISFD,
// CDU, MCP, master caution / six-pack, gear lights, flap indicator, clock and round gauges.
// Each painter takes (ctx, W, H, state) and an optional glow context for lit elements.
import { FLAP_DETENTS } from './systems.js';
import { rrect, drawLabel } from '../../core/panelcanvas.js';

const DU = '"Barlow", "Arial", sans-serif';
const MONO = '"JetBrains Mono", monospace';
const C = {
  white: '#f2f2f2', green: '#3cf57a', magenta: '#ff5bf0', cyan: '#5fe6ff', amber: '#ffb21a', red: '#ff3b30',
  sky: '#2f87e6', ground: '#9a5b25', tape: '#4b5259', grey: '#9aa2aa',
};
const f = (ctx, size, w = 600, fam = DU) => { ctx.font = `${w} ${size}px ${fam}`; };
const txt = (ctx, s, x, y, size, color = C.white, align = 'center', w = 600, fam = DU) => {
  f(ctx, size, w, fam); ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y);
};
const line = (ctx, pts, color = C.white, lw = 2) => {
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
};
const pad3 = (n) => String(Math.round(((n % 360) + 360) % 360) || 360).padStart(3, '0');

// ---- PFD -------------------------------------------------------------------------------------
export function drawPFD(ctx, W, H, s) {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const lw = W * 0.005;
  const cx = W * 0.47, cy = H * 0.47, aw = W * 0.42, ah = H * 0.5;
  const ppd = ah / 40; // px per degree of pitch
  // attitude
  ctx.save();
  rrect(ctx, cx - aw / 2, cy - ah / 2, aw, ah, W * 0.04); ctx.clip();
  ctx.translate(cx, cy); ctx.rotate((-s.bank * Math.PI) / 180);
  const py = s.pitch * ppd;
  ctx.fillStyle = C.sky; ctx.fillRect(-W, -H * 2 + py, W * 2, H * 2);
  ctx.fillStyle = C.ground; ctx.fillRect(-W, py, W * 2, H * 2);
  line(ctx, [[-W, py], [W, py]], C.white, lw);
  for (let p = -30; p <= 30; p += 2.5) {
    if (!p) continue;
    const y = py - p * ppd;
    const len = p % 10 === 0 ? aw * 0.3 : p % 5 === 0 ? aw * 0.17 : aw * 0.08;
    line(ctx, [[-len / 2, y], [len / 2, y]], C.white, lw * 0.8);
    if (p % 10 === 0) { txt(ctx, String(Math.abs(p)), -len / 2 - W * 0.025, y, W * 0.028); txt(ctx, String(Math.abs(p)), len / 2 + W * 0.025, y, W * 0.028); }
  }
  ctx.restore();
  // bank scale
  ctx.save(); ctx.translate(cx, cy);
  const br = ah * 0.46;
  ctx.strokeStyle = C.white; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.arc(0, 0, br, -Math.PI / 2 - Math.PI / 3, -Math.PI / 2 + Math.PI / 3); ctx.stroke();
  for (const d of [-60, -45, -30, -20, -10, 10, 20, 30, 45, 60]) {
    const a = (d * Math.PI) / 180 - Math.PI / 2, l = Math.abs(d) % 30 === 0 ? H * 0.03 : H * 0.017;
    line(ctx, [[Math.cos(a) * br, Math.sin(a) * br], [Math.cos(a) * (br + l), Math.sin(a) * (br + l)]], C.white, lw);
  }
  ctx.fillStyle = C.white; ctx.beginPath(); ctx.moveTo(0, -br); ctx.lineTo(-W * 0.012, -br - H * 0.022); ctx.lineTo(W * 0.012, -br - H * 0.022); ctx.closePath(); ctx.fill();
  ctx.rotate((-s.bank * Math.PI) / 180);
  ctx.beginPath(); ctx.moveTo(0, -br + 2); ctx.lineTo(-W * 0.014, -br + H * 0.024); ctx.lineTo(W * 0.014, -br + H * 0.024); ctx.closePath(); ctx.stroke();
  ctx.restore();
  // flight director bars
  if (s.fd) {
    ctx.strokeStyle = C.magenta; ctx.lineWidth = lw * 1.5;
    line(ctx, [[cx - aw * 0.28, cy - s.fdP * ppd], [cx + aw * 0.28, cy - s.fdP * ppd]], C.magenta, lw * 1.5);
    line(ctx, [[cx + s.fdR * aw * 0.2, cy - ah * 0.3], [cx + s.fdR * aw * 0.2, cy + ah * 0.3]], C.magenta, lw * 1.5);
  }
  // aircraft symbol
  ctx.fillStyle = '#000'; ctx.strokeStyle = C.white; ctx.lineWidth = lw;
  for (const sg of [-1, 1]) {
    ctx.beginPath();
    const x0 = cx + sg * aw * 0.13, x1 = cx + sg * aw * 0.33;
    ctx.moveTo(x1, cy - H * 0.009); ctx.lineTo(x0, cy - H * 0.009); ctx.lineTo(x0, cy + H * 0.035); ctx.lineTo(x0 + sg * W * 0.015, cy + H * 0.035); ctx.lineTo(x0 + sg * W * 0.015, cy + H * 0.009); ctx.lineTo(x1, cy + H * 0.009); ctx.closePath();
    ctx.fill(); ctx.stroke();
  }
  ctx.fillRect(cx - W * 0.011, cy - W * 0.011, W * 0.022, W * 0.022); ctx.strokeRect(cx - W * 0.011, cy - W * 0.011, W * 0.022, W * 0.022);

  // speed tape
  const tx = W * 0.05, tw = W * 0.12, ty = cy - ah / 2, th = ah;
  const spdPx = th / 80; // 80 kt visible
  ctx.save(); ctx.beginPath(); ctx.rect(tx, ty, tw, th); ctx.clip();
  ctx.fillStyle = C.tape; ctx.fillRect(tx, ty, tw, th);
  const sp = Math.max(30, s.speed);
  for (let v = Math.floor((sp - 50) / 10) * 10; v <= sp + 50; v += 10) {
    if (v < 30) continue;
    const y = cy - (v - sp) * spdPx;
    line(ctx, [[tx + tw - W * 0.018, y], [tx + tw, y]], C.white, lw * 0.8);
    if (v % 20 === 0) txt(ctx, String(v), tx + tw * 0.48, y, W * 0.036, C.white, 'center', 600);
  }
  // selected speed bug
  { const y = Math.max(ty, Math.min(ty + th, cy - (s.selSpd - sp) * spdPx));
    ctx.strokeStyle = C.magenta; ctx.lineWidth = lw; ctx.strokeRect(tx + tw - W * 0.012, y - H * 0.012, W * 0.012, H * 0.024); }
  ctx.restore();
  // current speed box
  ctx.fillStyle = '#000'; ctx.strokeStyle = C.white; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.moveTo(tx + W * 0.005, cy - H * 0.03); ctx.lineTo(tx + tw - W * 0.02, cy - H * 0.03); ctx.lineTo(tx + tw - W * 0.005, cy); ctx.lineTo(tx + tw - W * 0.02, cy + H * 0.03); ctx.lineTo(tx + W * 0.005, cy + H * 0.03); ctx.closePath(); ctx.fill(); ctx.stroke();
  txt(ctx, s.onGround && s.speed < 30 ? '' : String(Math.round(s.speed)), tx + tw * 0.45, cy + 1, W * 0.045, C.white, 'center', 700);
  txt(ctx, String(s.selSpd), tx + tw / 2, ty - H * 0.03, W * 0.04, C.magenta, 'center', 600);
  if (!s.onGround) txt(ctx, `.${String(Math.round(s.mach * 1000)).padStart(3, '0')}`, tx + tw / 2, ty + th + H * 0.03, W * 0.036, C.white);

  // altitude tape
  const ax = W * 0.78, awd = W * 0.12;
  const altPx = th / 800;
  ctx.save(); ctx.beginPath(); ctx.rect(ax, ty, awd, th); ctx.clip();
  ctx.fillStyle = C.tape; ctx.fillRect(ax, ty, awd, th);
  for (let v = Math.floor((s.alt - 500) / 100) * 100; v <= s.alt + 500; v += 100) {
    const y = cy - (v - s.alt) * altPx;
    line(ctx, [[ax, y], [ax + W * 0.016, y]], C.white, lw * 0.8);
    if (v % 200 === 0) txt(ctx, String(v), ax + awd * 0.58, y, W * 0.032, C.white);
  }
  { const y = Math.max(ty, Math.min(ty + th, cy - (s.selAlt - s.alt) * altPx));
    ctx.strokeStyle = C.magenta; ctx.lineWidth = lw * 1.2; ctx.strokeRect(ax, y - H * 0.016, W * 0.014, H * 0.032); }
  ctx.restore();
  ctx.fillStyle = '#000'; ctx.strokeStyle = C.white; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.moveTo(ax - W * 0.008, cy); ctx.lineTo(ax + W * 0.006, cy - H * 0.03); ctx.lineTo(ax + awd + W * 0.005, cy - H * 0.03); ctx.lineTo(ax + awd + W * 0.005, cy + H * 0.03); ctx.lineTo(ax + W * 0.006, cy + H * 0.03); ctx.closePath(); ctx.fill(); ctx.stroke();
  txt(ctx, String(Math.round(s.alt)), ax + awd * 0.56, cy + 1, W * 0.04, C.white, 'center', 700);
  txt(ctx, String(s.selAlt), ax + awd / 2, ty - H * 0.03, W * 0.04, C.magenta, 'center', 600);
  txt(ctx, s.alt > 18000 ? 'STD' : '29.92 IN', ax + awd / 2, ty + th + H * 0.03, W * 0.034, C.green);
  // vertical speed
  const vx = W * 0.925, vh = th * 0.8;
  ctx.fillStyle = '#3a3f45';
  ctx.beginPath(); ctx.moveTo(vx, cy - vh / 2); ctx.lineTo(vx + W * 0.04, cy - vh / 2 + H * 0.06); ctx.lineTo(vx + W * 0.04, cy + vh / 2 - H * 0.06); ctx.lineTo(vx, cy + vh / 2); ctx.closePath(); ctx.fill();
  for (const [v, t] of [[1, '1'], [2, '2'], [6, '6'], [-1, '1'], [-2, '2'], [-6, '6']]) {
    const k = Math.sign(v) * (Math.abs(v) <= 2 ? Math.abs(v) / 2 * 0.7 : 1);
    const y = cy - k * vh * 0.45;
    line(ctx, [[vx + W * 0.004, y], [vx + W * 0.014, y]], C.white, lw * 0.7);
    txt(ctx, t, vx + W * 0.024, y, W * 0.024);
  }
  { const k = Math.max(-1, Math.min(1, s.vs / 2000 * 0.7)); line(ctx, [[vx + W * 0.06, cy], [vx + W * 0.008, cy - k * vh * 0.45]], C.white, lw * 1.2); }

  // heading rose
  const hr = H * 0.34, hcx = cx, hcy = H * 1.16;
  ctx.save(); ctx.beginPath(); ctx.rect(0, H * 0.79, W, H); ctx.clip();
  ctx.fillStyle = '#3a3f45'; ctx.beginPath(); ctx.arc(hcx, hcy, hr, 0, Math.PI * 2); ctx.fill();
  for (let d = -40; d <= 40; d += 5) {
    const hd = Math.round(s.hdg / 5) * 5 + d, a = ((hd - s.hdg) * Math.PI) / 180;
    const l = hd % 10 === 0 ? H * 0.025 : H * 0.014;
    line(ctx, [[hcx + Math.sin(a) * hr, hcy - Math.cos(a) * hr], [hcx + Math.sin(a) * (hr - l), hcy - Math.cos(a) * (hr - l)]], C.white, lw * 0.8);
    if (hd % 30 === 0) txt(ctx, String(((hd % 360) + 360) % 360 / 10), hcx + Math.sin(a) * (hr - H * 0.05), hcy - Math.cos(a) * (hr - H * 0.05), W * 0.032);
  }
  { const a = (((s.selHdg - s.hdg + 540) % 360) - 180) * Math.PI / 180;
    ctx.save(); ctx.translate(hcx, hcy); ctx.rotate(Math.max(-0.7, Math.min(0.7, a)));
    ctx.strokeStyle = C.magenta; ctx.lineWidth = lw * 1.2; ctx.strokeRect(-W * 0.016, -hr, W * 0.032, H * 0.018); ctx.restore(); }
  ctx.restore();
  ctx.fillStyle = '#000'; ctx.fillRect(hcx - W * 0.045, H * 0.795, W * 0.09, H * 0.045);
  ctx.strokeStyle = C.white; ctx.lineWidth = lw; ctx.strokeRect(hcx - W * 0.045, H * 0.795, W * 0.09, H * 0.045);
  txt(ctx, pad3(s.hdg), hcx, H * 0.818, W * 0.036, C.white, 'center', 700);
  txt(ctx, 'MAG', hcx + W * 0.09, H * 0.818, W * 0.028, C.green);
  txt(ctx, `${pad3(s.selHdg)} H`, hcx - W * 0.16, H * 0.818, W * 0.03, C.magenta);

  // flight mode annunciations
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = lw * 0.6;
  for (const x of [0.36, 0.58]) line(ctx, [[W * x, H * 0.01], [W * x, H * 0.1]], 'rgba(255,255,255,0.7)', lw * 0.6);
  [[0.26, 0], [0.47, 1], [0.69, 2]].forEach(([x, i]) => {
    if (s.fma[i]) txt(ctx, s.fma[i], W * x, H * 0.035, W * 0.036, C.green, 'center', 600);
    if (s.armed?.[i]) txt(ctx, s.armed[i], W * x, H * 0.075, W * 0.03, C.white, 'center', 600);
  });
  if (s.cmd) txt(ctx, s.cmd, cx, cy - ah / 2 + H * 0.05, W * 0.05, C.green, 'center', 700);
  if (s.onGround) txt(ctx, 'RA 0', cx, cy + ah / 2 - H * 0.04, W * 0.03, C.white);
  // DH/MINS
  txt(ctx, 'BARO', W * 0.82, H * 0.14, W * 0.026, C.green); txt(ctx, '200', W * 0.82, H * 0.17, W * 0.03, C.green);
}

// ---- ND (expanded MAP) --------------------------------------------------------------------------
export function drawND(ctx, W, H, s) {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const lw = W * 0.0045;
  const trk = s.trk ?? 10;
  const cx = W / 2, cy = H * 0.8, r = H * 0.66;
  ctx.strokeStyle = C.white; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2 - 0.82, -Math.PI / 2 + 0.82); ctx.stroke();
  for (let d = -45; d <= 45; d += 5) {
    const hd = Math.round(trk / 5) * 5 + d, a = ((hd - trk) * Math.PI) / 180;
    if (Math.abs(a) > 0.82) continue;
    const l = hd % 10 === 0 ? H * 0.028 : H * 0.015;
    line(ctx, [[cx + Math.sin(a) * r, cy - Math.cos(a) * r], [cx + Math.sin(a) * (r - l), cy - Math.cos(a) * (r - l)]], C.white, lw);
    if (hd % 10 === 0) {
      const n = (((hd % 360) + 360) % 360) / 10;
      txt(ctx, String(n), cx + Math.sin(a) * (r - H * 0.055), cy - Math.cos(a) * (r - H * 0.055), W * (n % 3 === 0 ? 0.04 : 0.03));
    }
  }
  // range ring (dashed) and range label
  ctx.setLineDash([W * 0.012, W * 0.014]);
  ctx.beginPath(); ctx.arc(cx, cy, r / 2, -Math.PI / 2 - 0.9, -Math.PI / 2 + 0.9); ctx.stroke();
  ctx.setLineDash([]);
  txt(ctx, String((s.range ?? 20) / 2), cx - r * 0.5 * Math.sin(0.9) - W * 0.03, cy - r * 0.5 * Math.cos(0.9), W * 0.028);
  // heading box
  ctx.strokeStyle = C.white; ctx.strokeRect(cx - W * 0.05, H * 0.035, W * 0.1, H * 0.06);
  txt(ctx, pad3(trk), cx, H * 0.066, W * 0.04, C.white, 'center', 700);
  txt(ctx, 'TRK', cx - W * 0.1, H * 0.066, W * 0.03, C.green); txt(ctx, 'MAG', cx + W * 0.1, H * 0.066, W * 0.03, C.green);
  // route (track-up, scale nm -> px)
  const nm = r / (s.range ?? 20);
  const wpts = [['RW01', 0, 1.2], ['ALPHA', 2.5, 8], ['BRAVO', -3, 14.5], ['CHARL', -1, 22]];
  const toXY = ([, x, y]) => [cx + x * nm, cy - y * nm];
  ctx.strokeStyle = C.magenta; ctx.lineWidth = lw * 1.4;
  ctx.beginPath(); ctx.moveTo(cx, cy); wpts.forEach((w) => ctx.lineTo(...toXY(w))); ctx.stroke();
  wpts.forEach((w, i) => {
    const [x, y] = toXY(w);
    if (y < H * 0.1) return;
    const col = i === 1 ? C.magenta : C.white;
    ctx.fillStyle = col; ctx.beginPath();
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2, rr = k % 2 ? W * 0.006 : W * 0.018; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill();
    txt(ctx, w[0], x + W * 0.03, y, W * 0.032, col, 'left');
  });
  // airport symbol
  ctx.strokeStyle = C.cyan; ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(cx - W * 0.2, cy - H * 0.2, W * 0.016, 0, Math.PI * 2); ctx.stroke();
  txt(ctx, 'KXYZ', cx - W * 0.2, cy - H * 0.16, W * 0.028, C.cyan);
  // selected heading bug and dashed line
  { const d = (((s.hdg - trk + 540) % 360) - 180); const a = Math.max(-0.82, Math.min(0.82, (d * Math.PI) / 180));
    if (s.hdgSel) { ctx.setLineDash([W * 0.015, W * 0.012]); line(ctx, [[cx, cy], [cx + Math.sin(a) * r, cy - Math.cos(a) * r]], C.magenta, lw); ctx.setLineDash([]); }
    ctx.save(); ctx.translate(cx + Math.sin(a) * r, cy - Math.cos(a) * r); ctx.rotate(a);
    ctx.strokeStyle = C.magenta; ctx.lineWidth = lw * 1.4;
    ctx.beginPath(); ctx.moveTo(-W * 0.025, 0); ctx.lineTo(-W * 0.025, -H * 0.025); ctx.lineTo(-W * 0.008, -H * 0.025); ctx.lineTo(0, -H * 0.008); ctx.lineTo(W * 0.008, -H * 0.025); ctx.lineTo(W * 0.025, -H * 0.025); ctx.lineTo(W * 0.025, 0); ctx.closePath(); ctx.stroke();
    ctx.restore(); }
  // own aircraft
  line(ctx, [[cx, cy - H * 0.05], [cx, cy + H * 0.025]], C.white, lw * 1.4);
  line(ctx, [[cx - W * 0.025, cy - H * 0.02], [cx + W * 0.025, cy - H * 0.02]], C.white, lw * 1.4);
  line(ctx, [[cx - W * 0.012, cy + H * 0.02], [cx + W * 0.012, cy + H * 0.02]], C.white, lw * 1.4);
  // data
  txt(ctx, `GS ${Math.round(s.gs ?? 0)}  TAS ${Math.round(s.tas ?? 0)}`, W * 0.03, H * 0.04, W * 0.032, C.white, 'left');
  if (s.tas > 0) { txt(ctx, '270°/ 25', W * 0.03, H * 0.085, W * 0.03, C.white, 'left'); line(ctx, [[W * 0.06, H * 0.11], [W * 0.06, H * 0.16]], C.white, lw); }
  txt(ctx, 'ALPHA', W * 0.97, H * 0.04, W * 0.034, C.magenta, 'right');
  txt(ctx, '1432.5z', W * 0.97, H * 0.08, W * 0.03, C.white, 'right');
  txt(ctx, '8.2 NM', W * 0.97, H * 0.12, W * 0.03, C.white, 'right');
  txt(ctx, 'VOR L', W * 0.03, H * 0.93, W * 0.028, C.green, 'left'); txt(ctx, 'ABC', W * 0.03, H * 0.965, W * 0.028, C.green, 'left');
  txt(ctx, 'VOR R', W * 0.97, H * 0.93, W * 0.028, C.green, 'right'); txt(ctx, 'XYZ', W * 0.97, H * 0.965, W * 0.028, C.green, 'right');
}

// ---- upper DU: primary engine indications + fuel --------------------------------------------------
function engDial(ctx, W, x, y, r, frac, val, redline = 1, color = C.white) {
  const a0 = Math.PI * 0.75, span = Math.PI * 1.15;
  const lw = W * 0.005;
  const a = a0 + Math.max(0, Math.min(1.05, frac)) * span;
  ctx.fillStyle = 'rgba(200,200,200,0.22)';
  ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, r, a0, a); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = C.white; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.arc(x, y, r, a0, a0 + span * redline); ctx.stroke();
  ctx.strokeStyle = C.red; ctx.lineWidth = lw * 1.6;
  const ar = a0 + span * redline;
  line(ctx, [[x + Math.cos(ar) * r * 0.82, y + Math.sin(ar) * r * 0.82], [x + Math.cos(ar) * r * 1.12, y + Math.sin(ar) * r * 1.12]], C.red, lw * 1.6);
  for (let i = 0; i <= 10; i += 2) {
    const ai = a0 + (i / 10) * span;
    line(ctx, [[x + Math.cos(ai) * r * 0.86, y + Math.sin(ai) * r * 0.86], [x + Math.cos(ai) * r, y + Math.sin(ai) * r]], C.white, lw * 0.8);
  }
  line(ctx, [[x, y], [x + Math.cos(a) * r * 0.95, y + Math.sin(a) * r * 0.95]], color, lw * 1.3);
  ctx.fillStyle = '#000'; ctx.fillRect(x - r * 0.05, y - r * 0.68, r * 1.05, r * 0.46);
  ctx.strokeStyle = C.white; ctx.lineWidth = lw * 0.8; ctx.strokeRect(x - r * 0.05, y - r * 0.68, r * 1.05, r * 0.46);
  txt(ctx, val, x + r * 0.92, y - r * 0.44, r * 0.36, color, 'right', 600);
}
export function drawEngines(ctx, W, H, s) {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const r = W * 0.14;
  const n1L = s.n1L ?? 0, n1R = s.n1R ?? 0, egtL = s.egtL ?? 0, egtR = s.egtR ?? 0;
  txt(ctx, s.thrMode || 'TO', W * 0.5, H * 0.045, W * 0.04, C.green);
  txt(ctx, 'TAT +15c', W * 0.82, H * 0.045, W * 0.032);
  engDial(ctx, W, W * 0.27, H * 0.24, r, n1L / 110, n1L.toFixed(1), 104 / 110);
  engDial(ctx, W, W * 0.73, H * 0.24, r, n1R / 110, n1R.toFixed(1), 104 / 110);
  txt(ctx, 'N1', W * 0.5, H * 0.24, W * 0.04, C.cyan);
  engDial(ctx, W, W * 0.27, H * 0.55, r * 0.82, egtL / 1000, String(Math.round(egtL)), 0.95);
  engDial(ctx, W, W * 0.73, H * 0.55, r * 0.82, egtR / 1000, String(Math.round(egtR)), 0.95);
  txt(ctx, 'EGT', W * 0.5, H * 0.55, W * 0.04, C.cyan);
  if (s.rev) {
    const col = s.rev === 'green' ? C.green : C.amber;
    for (const x of [0.27, 0.73]) { ctx.strokeStyle = col; ctx.lineWidth = W * 0.004; ctx.strokeRect(W * (x - 0.05), H * 0.085, W * 0.1, H * 0.045); txt(ctx, 'REV', W * x, H * 0.108, W * 0.034, col); }
  }
  if (s.fire1) txt(ctx, 'FIRE', W * 0.27, H * 0.38, W * 0.04, C.red, 'center', 700);
  if (s.fire2) txt(ctx, 'FIRE', W * 0.73, H * 0.38, W * 0.04, C.red, 'center', 700);
  // fuel
  txt(ctx, 'FUEL', W / 2, H * 0.74, W * 0.034, C.cyan);
  const tank = (x, y, w, h, lab, val) => {
    ctx.strokeStyle = C.white; ctx.lineWidth = W * 0.004;
    ctx.beginPath(); ctx.arc(x, y, w, 0, Math.PI * 2); ctx.stroke();
    txt(ctx, val, x, y, W * 0.036, C.white, 'center', 600);
    txt(ctx, lab, x, y + w + H * 0.03, W * 0.03, C.cyan);
  };
  tank(W * 0.22, H * 0.84, W * 0.055, 0, '1', s.fuel?.[0] ?? '3.9');
  tank(W * 0.5, H * 0.84, W * 0.055, 0, 'CTR', s.fuel?.[1] ?? '6.2');
  tank(W * 0.78, H * 0.84, W * 0.055, 0, '2', s.fuel?.[2] ?? '3.9');
  txt(ctx, 'KG X 1000', W / 2, H * 0.97, W * 0.026, C.cyan);
}

// ---- lower DU: secondary engine indications --------------------------------------------------
export function drawLowerDU(ctx, W, H, s) {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const run = [s.run1, s.run2];
  const n2 = run.map((r) => (r ? (s.air ? 94.2 : 61.3) : 0));
  const ff = run.map((r) => (r ? (s.air ? 1.25 : 0.3) : 0));
  const r = W * 0.1;
  [0.27, 0.73].forEach((x, i) => {
    engDial(ctx, W, W * x, H * 0.16, r, n2[i] / 110, n2[i].toFixed(1), 105 / 110);
    ctx.strokeStyle = C.white; ctx.lineWidth = W * 0.004; ctx.strokeRect(W * (x - 0.08), H * 0.3, W * 0.16, H * 0.07);
    txt(ctx, ff[i].toFixed(2), W * x, H * 0.335, W * 0.04);
    // oil pressure / temperature bars
    const bar = (bx, val, frac, lab) => {
      ctx.strokeStyle = C.white; ctx.strokeRect(W * bx, H * 0.47, W * 0.04, H * 0.2);
      ctx.fillStyle = C.white; ctx.fillRect(W * bx - W * 0.012, H * (0.67 - 0.2 * frac) - 2, W * 0.012, 4);
      txt(ctx, val, W * (bx + 0.02), H * 0.43, W * 0.032);
      if (i === 0) txt(ctx, lab, W * 0.5, H * (lab === 'OIL P' ? 0.53 : 0.61), W * 0.03, C.cyan);
    };
    bar(x - 0.09, run[i] ? '52' : '0', run[i] ? 0.55 : 0, 'OIL P');
    bar(x + 0.05, run[i] ? '85' : '20', run[i] ? 0.5 : 0.1, 'OIL T');
    txt(ctx, run[i] ? '82' : '84', W * x, H * 0.78, W * 0.04);
    txt(ctx, run[i] ? '0.4' : '0.0', W * x, H * 0.9, W * 0.04);
  });
  txt(ctx, 'N2', W * 0.5, H * 0.16, W * 0.034, C.cyan);
  txt(ctx, 'FF/FU', W * 0.5, H * 0.335, W * 0.03, C.cyan);
  txt(ctx, 'OIL Q %', W * 0.5, H * 0.78, W * 0.03, C.cyan);
  txt(ctx, 'VIB', W * 0.5, H * 0.9, W * 0.03, C.cyan);
}

// ---- ISFD -------------------------------------------------------------------------------------
export function drawISFD(ctx, W, H, s) {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const cx = W * 0.5, cy = H * 0.46;
  ctx.save(); ctx.beginPath(); ctx.rect(W * 0.2, H * 0.12, W * 0.6, H * 0.66); ctx.clip();
  ctx.translate(cx, cy); ctx.rotate((-(s.bank || 0) * Math.PI) / 180);
  const py = (s.pitch || 0) * H * 0.02;
  ctx.fillStyle = C.sky; ctx.fillRect(-W, -H * 2 + py, W * 2, H * 2);
  ctx.fillStyle = C.ground; ctx.fillRect(-W, py, W * 2, H * 2);
  line(ctx, [[-W, py], [W, py]], C.white, W * 0.01);
  for (const p of [-10, -5, 5, 10]) line(ctx, [[-W * 0.08, py - p * H * 0.02], [W * 0.08, py - p * H * 0.02]], C.white, W * 0.008);
  ctx.restore();
  ctx.fillStyle = '#ffd400';
  ctx.fillRect(cx - W * 0.2, cy - H * 0.012, W * 0.12, H * 0.024); ctx.fillRect(cx + W * 0.08, cy - H * 0.012, W * 0.12, H * 0.024);
  ctx.fillRect(cx - W * 0.015, cy - H * 0.015, W * 0.03, H * 0.03);
  ctx.fillStyle = C.tape; ctx.fillRect(0, H * 0.12, W * 0.18, H * 0.66); ctx.fillRect(W * 0.82, H * 0.12, W * 0.18, H * 0.66);
  txt(ctx, String(Math.round(s.speed || 0)), W * 0.09, cy, W * 0.08, C.white, 'center', 700);
  txt(ctx, String(Math.round(s.alt || 0)), W * 0.91, cy, W * 0.07, C.white, 'center', 700);
  txt(ctx, `${pad3(s.hdg || 10)}`, cx, H * 0.86, W * 0.08);
  txt(ctx, s.alt > 18000 ? 'STD' : '29.92 IN', cx, H * 0.95, W * 0.07, C.cyan);
  txt(ctx, 'ATT', W * 0.12, H * 0.06, W * 0.06, C.green);
}

// ---- CDU --------------------------------------------------------------------------------------
const CDU_FUNC = [['INIT\nREF', 'RTE', 'CLB', 'CRZ', 'DES', ''], ['MENU', 'LEGS', 'DEP\nARR', 'HOLD', 'PROG', 'EXEC'], ['N1\nLIMIT', 'FIX', 'PREV\nPAGE', 'NEXT\nPAGE', '', '']];
export function drawCDU(ctx, W, H, s = {}) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#4a5058'); g.addColorStop(1, '#3a4047');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // screen
  const sx = W * 0.15, sy = H * 0.04, sw = W * 0.7, sh = H * 0.38;
  ctx.fillStyle = '#1b1e22'; rrect(ctx, sx - W * 0.02, sy - H * 0.01, sw + W * 0.04, sh + H * 0.02, W * 0.02); ctx.fill();
  ctx.fillStyle = '#020304'; ctx.fillRect(sx, sy, sw, sh);
  const fs = sh / 15;
  const lines = [
    ['           IDENT', C.white, 'L'], ['', ''], [' MODEL', C.white, 's'], [' 737-800W', C.white, 'L'], [' ENG RATING', C.white, 's'], [' 26K', C.white, 'L'],
    [' NAV DATA', C.white, 's'], [' ---------', C.white, 'L'], ['', ''], [' OP PROGRAM', C.white, 's'], [' U12.0', C.white, 'L'], ['', ''], ['--------------------', C.white, 'L'], ['<INDEX    POS INIT>', C.white, 'L'],
  ];
  lines.forEach(([t, col, k], i) => {
    if (!t) return;
    ctx.font = `${k === 's' ? 500 : 600} ${k === 's' ? fs * 0.75 : fs}px ${MONO}`;
    ctx.fillStyle = col === C.white && k !== 's' && i > 2 && i < 12 ? C.green : col; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(t, sx + sw * 0.03, sy + fs * (i + 0.9));
  });
  // line select keys
  const key = (x, y, w, h, t, ts = h * 0.32, lit = false) => {
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; rrect(ctx, x + 2, y + 3, w, h, h * 0.15); ctx.fill();
    const kg = ctx.createLinearGradient(0, y, 0, y + h);
    kg.addColorStop(0, '#5a6068'); kg.addColorStop(1, '#2e3338');
    ctx.fillStyle = kg; rrect(ctx, x, y, w, h, h * 0.15); ctx.fill();
    if (lit) { ctx.fillStyle = '#e8e0c0'; ctx.fillRect(x + w * 0.2, y + h * 0.08, w * 0.6, h * 0.12); }
    if (t) drawLabel(ctx, t, x + w / 2, y + h / 2 + (lit ? h * 0.06 : 0), ts, '#f2f2ee');
  };
  for (let i = 0; i < 6; i++) {
    const y = sy + sh * (0.12 + i * 0.145);
    key(W * 0.02, y, W * 0.09, H * 0.032, '');
    key(W * 0.89, y, W * 0.09, H * 0.032, '');
  }
  // function keys
  CDU_FUNC.forEach((row, ri) => row.forEach((t, ci) => {
    if (!t && !(ri === 0 && ci === 5)) return;
    key(W * (0.06 + ci * 0.15), H * (0.46 + ri * 0.065), W * 0.13, H * 0.05, t, H * 0.014, t === 'EXEC');
  }));
  // numeric keys
  const nums = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '+/-'];
  nums.forEach((t, i) => {
    const c = i % 3, r = Math.floor(i / 3);
    ctx.fillStyle = '#2e3338';
    ctx.beginPath(); ctx.arc(W * (0.12 + c * 0.11), H * (0.7 + r * 0.075), W * 0.042, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4c535b'; ctx.beginPath(); ctx.arc(W * (0.12 + c * 0.11), H * (0.7 + r * 0.075) - 1, W * 0.038, 0, Math.PI * 2); ctx.fill();
    drawLabel(ctx, t, W * (0.12 + c * 0.11), H * (0.7 + r * 0.075), H * 0.022, '#fff');
  });
  // alpha keys
  const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').concat(['SP', 'DEL', '/', 'CLR']);
  alpha.forEach((t, i) => {
    const c = i % 5, r = Math.floor(i / 5);
    key(W * (0.46 + c * 0.104), H * (0.665 + r * 0.054), W * 0.09, H * 0.045, t, H * (t.length > 1 ? 0.014 : 0.02));
  });
  // annunciators at the bottom corners
  [['EXEC', 0.05], ['MSG', 0.05], ['OFST', 0.05]].forEach(([t], i) => drawLabel(ctx, t, W * 0.04, H * (0.62 + i * 0.03), H * 0.012, 'rgba(255,190,80,0.4)'));
}

// ---- MCP --------------------------------------------------------------------------------------
// Layout in normalized canvas coordinates; shared by the painter, the click regions and the 3D knobs.
export const MCP = {
  windows: [
    { id: 'crsL', key: 'crs', x: 0.012, w: 0.058, label: 'COURSE' },
    { id: 'spd', key: 'spd', x: 0.165, w: 0.082, label: 'IAS/MACH' },
    { id: 'hdg', key: 'hdg', x: 0.405, w: 0.06, label: 'HEADING' },
    { id: 'alt', key: 'alt', x: 0.585, w: 0.09, label: 'ALTITUDE' },
    { id: 'vs', key: 'vs', x: 0.705, w: 0.08, label: 'VERT SPEED' },
    { id: 'crsR', key: 'crs', x: 0.93, w: 0.058, label: 'COURSE' },
  ],
  knobs: [ // 3D knob centres (x, y) and radius (fraction of height)
    { id: 'crsL', x: 0.041, y: 0.66, r: 0.16 }, { id: 'spd', x: 0.206, y: 0.66, r: 0.17 },
    { id: 'hdg', x: 0.435, y: 0.64, r: 0.15, ring: true }, { id: 'alt', x: 0.63, y: 0.66, r: 0.18 },
    { id: 'vs', x: 0.8, y: 0.3, r: 0.12, wheel: true }, { id: 'crsR', x: 0.959, y: 0.66, r: 0.16 },
  ],
  buttons: [
    ['N1', 0.265, 0.42], ['SPEED', 0.265, 0.72], ['VNAV', 0.318, 0.42], ['LVL CHG', 0.318, 0.72],
    ['HDG SEL', 0.483, 0.72], ['LNAV', 0.535, 0.42], ['VOR LOC', 0.535, 0.72], ['APP', 0.483, 0.42],
    ['ALT HLD', 0.69, 0.72], ['V/S', 0.745, 0.72],
    ['CMD A', 0.835, 0.42], ['CMD B', 0.885, 0.42], ['CWS A', 0.835, 0.72], ['CWS B', 0.885, 0.72],
  ],
  btnW: 0.042, btnH: 0.24,
  toggles: [['fdL', 'F/D', 0.093], ['at', 'A/T ARM', 0.135], ['fdR', 'F/D', 0.912]],
  winY: 0.14, winH: 0.22,
};
export function drawMCP(ctx, W, H, s, glow) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#5f666f'); g.addColorStop(1, '#4d545c');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = H * 0.02; ctx.strokeRect(0, 0, W, H);
  if (glow) { glow.fillStyle = '#000'; glow.fillRect(0, 0, W, H); }
  const night = !!s.night;
  const leg = (t, x, y, size, col = '#f4f3ee') => {
    drawLabel(ctx, t, x, y, size, col);
    if (glow && night) drawLabel(glow, t, x, y, size, 'rgba(255,238,205,0.9)');
  };
  // section dividers
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = W * 0.0015;
  for (const x of [0.08, 0.155, 0.36, 0.575, 0.82, 0.92]) line(ctx, [[W * x, H * 0.05], [W * x, H * 0.95]], 'rgba(0,0,0,0.35)', W * 0.0015);
  const text = {
    crs: pad3(s.crs), spd: String(s.spd), hdg: pad3(s.hdg), alt: String(s.alt),
    vs: s.modes.includes('V/S') ? `${s.vs > 0 ? '+' : s.vs < 0 ? '-' : ''}${String(Math.abs(s.vs)).padStart(4, ' ')}` : '',
  };
  for (const w of MCP.windows) {
    ctx.fillStyle = '#26292d'; rrect(ctx, W * w.x - H * 0.02, H * MCP.winY - H * 0.02, W * w.w + H * 0.04, H * MCP.winH + H * 0.04, H * 0.03); ctx.fill();
    ctx.fillStyle = '#060708'; ctx.fillRect(W * w.x, H * MCP.winY, W * w.w, H * MCP.winH);
    const draw = (c) => { c.fillStyle = '#ffb21a'; c.font = `600 ${H * 0.17}px ${MONO}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text[w.key], W * (w.x + w.w / 2), H * (MCP.winY + MCP.winH / 2 + 0.01)); };
    draw(ctx); if (glow) draw(glow);
    leg(w.label, W * (w.x + w.w / 2), H * 0.065, H * 0.075);
  }
  // knob bases and bank angle ring
  for (const k of MCP.knobs) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.arc(W * k.x, H * k.y, H * k.r * 1.15, 0, Math.PI * 2); ctx.fill();
    if (k.ring) {
      ['10', '15', '20', '25', '30'].forEach((t, i) => { const a = -0.9 + i * 0.45; leg(t, W * k.x + Math.sin(a) * H * 0.27, H * k.y - Math.cos(a) * H * 0.27, H * 0.055); });
      leg('BANK\nANGLE', W * (k.x - 0.035), H * 0.9, H * 0.05);
    }
    if (k.wheel) { leg('DN', W * (k.x + 0.02), H * 0.18, H * 0.05); leg('UP', W * (k.x + 0.02), H * 0.42, H * 0.05); }
  }
  leg('C/O', W * 0.168, H * 0.62, H * 0.05); leg('SPD INTV', W * 0.247, H * 0.9, H * 0.05);
  leg('ALT INTV', W * 0.675, H * 0.42, H * 0.05);
  // buttons with mode bars
  for (const [t, x, y] of MCP.buttons) {
    const on = t === 'CMD A' ? s.cmdA : t === 'CMD B' ? s.cmdB : t.startsWith('CWS') ? false : s.modes.includes(t);
    const bx = W * (x - MCP.btnW / 2), by = H * (y - MCP.btnH / 2), bw = W * MCP.btnW, bh = H * MCP.btnH;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; rrect(ctx, bx + 2, by + 3, bw, bh, H * 0.03); ctx.fill();
    const bg = ctx.createLinearGradient(0, by, 0, by + bh);
    bg.addColorStop(0, '#e9ebe6'); bg.addColorStop(1, '#b8bbb6');
    ctx.fillStyle = bg; rrect(ctx, bx, by, bw, bh, H * 0.03); ctx.fill();
    const lb = [bx + bw * 0.14, by + bh * 0.1, bw * 0.72, bh * 0.2];
    ctx.fillStyle = on ? '#4dff8e' : '#5d6b62'; ctx.fillRect(...lb);
    if (on && glow) { glow.fillStyle = '#3cf57a'; glow.fillRect(...lb); }
    drawLabel(ctx, t, bx + bw / 2, by + bh * 0.64, H * 0.06, '#1d1f22');
  }
  // F/D and A/T ARM switches with their lights
  for (const [key, lab, x] of MCP.toggles) {
    const cx = W * x, cy = H * 0.66;
    leg(lab, cx, H * 0.92, H * 0.06);
    leg('ON', cx + W * 0.018, H * 0.5, H * 0.045); leg('OFF', cx + W * 0.018, H * 0.8, H * 0.045);
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(cx, cy, H * 0.07, 0, Math.PI * 2); ctx.fill();
    const lit = key === 'at' ? s.at : s[key];
    const ly = H * 0.3;
    ctx.fillStyle = lit ? '#4dff8e' : '#203026'; ctx.beginPath(); ctx.arc(cx, ly, H * 0.035, 0, Math.PI * 2); ctx.fill();
    if (lit && glow) { glow.fillStyle = '#3cf57a'; glow.beginPath(); glow.arc(cx, ly, H * 0.035, 0, Math.PI * 2); glow.fill(); }
    leg(key === 'at' ? 'ARM' : 'MA', cx, H * 0.2, H * 0.045);
  }
  // A/P disengage bar
  ctx.fillStyle = '#c9ccc7'; rrect(ctx, W * 0.83, H * 0.86, W * 0.08, H * 0.08, H * 0.02); ctx.fill();
  leg('DISENGAGE', W * 0.87, H * 0.97, H * 0.04);
}

// ---- master caution / fire warning / six-pack --------------------------------------------------
export const SIX = {
  L: ['FLT CONT', 'IRS', 'FUEL', 'ELEC', 'APU', 'OVHT/DET'],
  R: ['ANTI-ICE', 'HYD', 'DOORS', 'ENG', 'OVERHEAD', 'AIR COND'],
};
export function drawMasterCaution(ctx, W, H, s, glow) {
  ctx.fillStyle = '#4f565e'; ctx.fillRect(0, 0, W, H);
  if (glow) { glow.fillStyle = '#000'; glow.fillRect(0, 0, W, H); }
  const lamp = (x, y, w, h, lit, on, off, text, ts, tc) => {
    ctx.fillStyle = '#0c0d0f'; rrect(ctx, x - W * 0.012, y - W * 0.012, w + W * 0.024, h + W * 0.024, W * 0.02); ctx.fill();
    ctx.fillStyle = lit ? on : off; rrect(ctx, x, y, w, h, W * 0.015); ctx.fill();
    if (lit && glow) { glow.fillStyle = on; rrect(glow, x, y, w, h, W * 0.015); glow.fill(); drawLabel(glow, text, x + w / 2, y + h / 2, ts, 'rgba(0,0,0,0.8)'); }
    drawLabel(ctx, text, x + w / 2, y + h / 2, ts, lit ? '#1a0d00' : tc);
  };
  lamp(W * 0.08, H * 0.08, W * 0.38, H * 0.38, s.fire, '#ff2a1c', '#3a0b08', 'FIRE\nWARN', H * 0.11, 'rgba(255,120,100,0.4)');
  lamp(W * 0.54, H * 0.08, W * 0.38, H * 0.38, s.mc, '#ffb000', '#3d2a00', 'MASTER\nCAUTION', H * 0.095, 'rgba(255,200,90,0.4)');
  SIX[s.side].forEach((t, i) => {
    const lit = s.six.includes(t);
    const x = W * (0.08 + (i % 3) * 0.29), y = H * (0.57 + Math.floor(i / 3) * 0.2);
    lamp(x, y, W * 0.26, H * 0.15, lit, '#ffb000', '#1d2024', t, H * 0.068, 'rgba(255,190,60,0.32)');
  });
}

// ---- gear indicator lights (P2 right) ---------------------------------------------------------
export function drawGearPanel(ctx, W, H, s, glow) {
  ctx.fillStyle = '#5d656e'; ctx.fillRect(0, 0, W, H);
  if (glow) { glow.fillStyle = '#000'; glow.fillRect(0, 0, W, H); }
  const night = !!s.night;
  const leg = (t, x, y, size) => { drawLabel(ctx, t, x, y, size, '#f4f3ee'); if (glow && night) drawLabel(glow, t, x, y, size, 'rgba(255,238,205,0.9)'); };
  const light = (x, y, w, h, on, color, text) => {
    ctx.fillStyle = '#0c0d0f'; rrect(ctx, x - 3, y - 3, w + 6, h + 6, 4); ctx.fill();
    ctx.fillStyle = on ? color : '#1e2125'; rrect(ctx, x, y, w, h, 3); ctx.fill();
    drawLabel(ctx, text, x + w / 2, y + h / 2, h * 0.26, on ? '#111' : 'rgba(255,255,255,0.25)');
    if (on && glow) { glow.fillStyle = color; rrect(glow, x, y, w, h, 3); glow.fill(); drawLabel(glow, text, x + w / 2, y + h / 2, h * 0.26, '#000'); }
  };
  const g = s.gear;
  const pos = [['NOSE\nGEAR', 0.37, 0.04], ['LEFT\nGEAR', 0.06, 0.2], ['RIGHT\nGEAR', 0.68, 0.2]];
  pos.forEach(([t, x, y]) => {
    light(W * x, H * y, W * 0.26, H * 0.07, g === 'red', '#ff3b2f', t);
    light(W * x, H * (y + 0.08), W * 0.26, H * 0.07, g === 'green', '#35e07a', t);
  });
  leg('LANDING GEAR', W / 2, H * 0.43, H * 0.035);
  leg('UP', W * 0.5, H * 0.48, H * 0.032); leg('OFF', W * 0.82, H * 0.62, H * 0.032); leg('DN', W * 0.5, H * 0.86, H * 0.032);
  // lever slot
  ctx.fillStyle = '#101215'; rrect(ctx, W * 0.46, H * 0.5, W * 0.08, H * 0.34, W * 0.03); ctx.fill();
  ctx.fillStyle = '#1b1e22'; ctx.fillRect(W * 0.53, H * 0.66, W * 0.18, H * 0.03);
  // lock override button
  ctx.fillStyle = '#2a2f35'; ctx.beginPath(); ctx.arc(W * 0.2, H * 0.62, W * 0.05, 0, Math.PI * 2); ctx.fill();
  leg('LOCK\nOVRD', W * 0.2, H * 0.72, H * 0.026);
  ctx.fillStyle = '#d8d9d4'; ctx.fillRect(W * 0.06, H * 0.92, W * 0.88, H * 0.06);
  drawLabel(ctx, 'LIMIT  270K / .82M', W / 2, H * 0.95, H * 0.03, '#202020');
}

// ---- flap position indicator + LE lights (P2 left) ------------------------------------------------
export function drawFlapPanel(ctx, W, H, s, glow) {
  ctx.fillStyle = '#5d656e'; ctx.fillRect(0, 0, W, H);
  if (glow) { glow.fillStyle = '#000'; glow.fillRect(0, 0, W, H); }
  const night = !!s.night;
  const cx = W * 0.5, cy = H * 0.42, r = Math.min(W, H) * 0.36;
  ctx.fillStyle = '#2b3036'; ctx.beginPath(); ctx.arc(cx, cy, r * 1.1, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#0b0d10'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  const marks = [0, 1, 2, 5, 10, 15, 25, 30, 40];
  const angOf = (v) => { let i = 0; while (i < FLAP_DETENTS.length - 1 && v > FLAP_DETENTS[i + 1]) i++; const t = i >= FLAP_DETENTS.length - 1 ? 0 : (v - FLAP_DETENTS[i]) / (FLAP_DETENTS[i + 1] - FLAP_DETENTS[i]); return -Math.PI * 0.62 + ((i + Math.min(1, t)) / (FLAP_DETENTS.length - 1)) * Math.PI * 1.45; };
  marks.forEach((d) => {
    const a = angOf(d);
    line(ctx, [[cx + Math.sin(a) * r * 0.8, cy - Math.cos(a) * r * 0.8], [cx + Math.sin(a) * r * 0.95, cy - Math.cos(a) * r * 0.95]], '#fff', W * 0.012);
    drawLabel(ctx, d === 0 ? '0' : String(d), cx + Math.sin(a) * r * 0.63, cy - Math.cos(a) * r * 0.63, r * 0.17, '#fff');
  });
  // L and R needles (split shows asymmetry; they move together here)
  for (const [lab, off] of [['L', -0.03], ['R', 0.03]]) {
    const a = angOf(s.flap) + off;
    line(ctx, [[cx, cy], [cx + Math.sin(a) * r * 0.86, cy - Math.cos(a) * r * 0.86]], '#fff', W * 0.022);
    drawLabel(ctx, lab, cx + Math.sin(a) * r * 0.42, cy - Math.cos(a) * r * 0.42, r * 0.11, '#000');
  }
  ctx.fillStyle = '#30353b'; ctx.beginPath(); ctx.arc(cx, cy, r * 0.1, 0, Math.PI * 2); ctx.fill();
  drawLabel(ctx, 'FLAPS', cx, cy + r * 0.45, r * 0.15, '#fff');
  const light = (x, y, w, h, on, color, text) => {
    ctx.fillStyle = '#0c0d0f'; rrect(ctx, x - 3, y - 3, w + 6, h + 6, 4); ctx.fill();
    ctx.fillStyle = on ? color : '#1e2125'; rrect(ctx, x, y, w, h, 3); ctx.fill();
    drawLabel(ctx, text, x + w / 2, y + h / 2, h * 0.3, on ? '#111' : 'rgba(255,255,255,0.25)');
    if (on && glow) { glow.fillStyle = color; rrect(glow, x, y, w, h, 3); glow.fill(); drawLabel(glow, text, x + w / 2, y + h / 2, h * 0.3, '#000'); }
  };
  light(W * 0.06, H * 0.84, W * 0.42, H * 0.11, s.leTransit, '#ffb000', 'LE FLAPS\nTRANSIT');
  light(W * 0.52, H * 0.84, W * 0.42, H * 0.11, s.leExt, '#35e07a', 'LE FLAPS\nEXT');
  if (glow && night) drawLabel(glow, 'FLAPS', cx, cy + r * 0.45, r * 0.15, 'rgba(255,238,205,0.6)');
}

// ---- clock -------------------------------------------------------------------------------------
export function drawClock(ctx, W, H, s) {
  ctx.fillStyle = '#5d656e'; ctx.fillRect(0, 0, W, H);
  const cx = W / 2, cy = H / 2, r = Math.min(W, H) * 0.45;
  ctx.fillStyle = '#2b3036'; ctx.beginPath(); ctx.arc(cx, cy, r * 1.04, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#0b0d10'; ctx.beginPath(); ctx.arc(cx, cy, r * 0.95, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    line(ctx, [[cx + Math.sin(a) * r * (i % 5 ? 0.86 : 0.78), cy - Math.cos(a) * r * (i % 5 ? 0.86 : 0.78)], [cx + Math.sin(a) * r * 0.92, cy - Math.cos(a) * r * 0.92]], '#fff', i % 5 ? 1 : 2.5);
    if (i % 10 === 0) drawLabel(ctx, String(i || 60), cx + Math.sin(a) * r * 0.66, cy - Math.cos(a) * r * 0.66, r * 0.13, '#fff');
  }
  ctx.fillStyle = '#000'; ctx.fillRect(cx - r * 0.42, cy - r * 0.38, r * 0.84, r * 0.24); ctx.fillRect(cx - r * 0.42, cy + r * 0.16, r * 0.84, r * 0.24);
  const t = s.time || new Date();
  const z = (n) => String(n).padStart(2, '0');
  txt(ctx, `${z(t.getUTCHours())}:${z(t.getUTCMinutes())}`, cx, cy - r * 0.26, r * 0.2, '#e8e8e8', 'center', 600, MONO);
  txt(ctx, 'UTC', cx, cy + r * 0.05, r * 0.11, '#e8e8e8');
  txt(ctx, `${z(t.getUTCDate())} ${z(t.getUTCMonth() + 1)}`, cx, cy + r * 0.28, r * 0.17, '#e8e8e8', 'center', 600, MONO);
  const a = (t.getUTCSeconds() / 60) * Math.PI * 2;
  line(ctx, [[cx, cy], [cx + Math.sin(a) * r * 0.85, cy - Math.cos(a) * r * 0.85]], '#fff', 2);
}

// ---- round gauge faces used by panel layouts --------------------------------------------------------
const needle = (ctx, x, y, r, a, col = '#fff', len = 0.82, w = 0.06) => {
  ctx.strokeStyle = col; ctx.lineWidth = r * w; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x - Math.sin(a) * r * 0.15, y + Math.cos(a) * r * 0.15); ctx.lineTo(x + Math.sin(a) * r * len, y - Math.cos(a) * r * len); ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.fillStyle = '#30353b'; ctx.beginPath(); ctx.arc(x, y, r * 0.1, 0, Math.PI * 2); ctx.fill();
};
const ticks = (ctx, x, y, r, n, a0, a1, labels, ls = 0.2, every = 1) => {
  for (let i = 0; i <= n; i++) {
    const a = a0 + (i / n) * (a1 - a0);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = r * (i % every ? 0.025 : 0.045);
    ctx.beginPath(); ctx.moveTo(x + Math.sin(a) * r * (i % every ? 0.84 : 0.76), y - Math.cos(a) * r * (i % every ? 0.84 : 0.76)); ctx.lineTo(x + Math.sin(a) * r * 0.93, y - Math.cos(a) * r * 0.93); ctx.stroke();
  }
  labels?.forEach(([t, k]) => { const a = a0 + k * (a1 - a0); drawLabel(ctx, t, x + Math.sin(a) * r * 0.58, y - Math.cos(a) * r * 0.58, r * ls, '#fff'); });
};
export const faces = {
  /** Cabin altitude (outer, 0-50 x1000 ft) with differential pressure (inner, 0-10 psi). */
  cabinAlt: (v) => (ctx, x, y, r) => {
    const a0 = -Math.PI * 0.8, a1 = Math.PI * 0.8;
    ticks(ctx, x, y, r, 25, a0, a1, [['0', 0], ['10', 0.2], ['20', 0.4], ['30', 0.6], ['40', 0.8], ['50', 1]], 0.17, 5);
    drawLabel(ctx, 'CABIN ALT', x, y + r * 0.32, r * 0.13, '#fff'); drawLabel(ctx, 'DIFF PRESS', x, y - r * 0.3, r * 0.11, '#9fd0ff');
    needle(ctx, x, y, r, a0 + Math.min(1, (v.alt || 0) / 50000) * (a1 - a0), '#fff', 0.85);
    needle(ctx, x, y, r, a0 + Math.min(1, (v.diff || 0) / 10) * (a1 - a0), '#9fd0ff', 0.55, 0.05);
  },
  /** Cabin rate of climb (+/- 4000 fpm, zero at 9 o'clock). */
  cabinRate: (v) => (ctx, x, y, r) => {
    const a0 = -Math.PI / 2 - Math.PI * 0.8, a1 = -Math.PI / 2 + Math.PI * 0.8;
    ticks(ctx, x, y, r, 16, a0, a1, [['4', 0], ['2', 0.25], ['0', 0.5], ['2', 0.75], ['4', 1]], 0.18, 4);
    drawLabel(ctx, 'UP', x + r * 0.28, y - r * 0.4, r * 0.12, '#fff'); drawLabel(ctx, 'DN', x + r * 0.28, y + r * 0.4, r * 0.12, '#fff');
    drawLabel(ctx, 'CABIN\nCLIMB', x + r * 0.2, y, r * 0.11, '#fff');
    const k = Math.max(-1, Math.min(1, (v.rate || 0) / 4000));
    needle(ctx, x, y, r, -Math.PI / 2 + k * Math.PI * 0.8, '#fff', 0.85);
  },
  /** Outflow valve position: CLOSE (left) .. OPEN (right). */
  valve: (v) => (ctx, x, y, r) => {
    const a0 = -Math.PI * 0.6, a1 = Math.PI * 0.6;
    ticks(ctx, x, y, r, 4, a0, a1, null);
    drawLabel(ctx, 'CLOSE', x - r * 0.5, y + r * 0.35, r * 0.17, '#fff'); drawLabel(ctx, 'OPEN', x + r * 0.5, y + r * 0.35, r * 0.17, '#fff');
    needle(ctx, x, y, r, a0 + Math.max(0, Math.min(1, v.pos ?? 0.5)) * (a1 - a0), '#fff', 0.8);
  },
  /** Crew oxygen cylinder pressure (0-2000 psi). */
  oxygen: (v) => (ctx, x, y, r) => {
    const a0 = -Math.PI * 0.75, a1 = Math.PI * 0.75;
    ticks(ctx, x, y, r, 20, a0, a1, [['0', 0], ['5', 0.25], ['10', 0.5], ['15', 0.75], ['20', 1]], 0.18, 5);
    drawLabel(ctx, 'PSI\nX100', x, y + r * 0.42, r * 0.12, '#fff');
    needle(ctx, x, y, r, a0 + Math.max(0, Math.min(1, (v.psi || 0) / 2000)) * (a1 - a0), '#fff', 0.85);
  },
  /** Hydraulic brake pressure (0-4 x1000 psi). */
  brake: (v) => (ctx, x, y, r) => {
    const a0 = -Math.PI * 0.75, a1 = Math.PI * 0.25;
    ticks(ctx, x, y, r, 8, a0, a1, [['0', 0], ['1', 0.25], ['2', 0.5], ['3', 0.75], ['4', 1]], 0.18, 2);
    drawLabel(ctx, 'BRAKE\nPRESS', x - r * 0.05, y + r * 0.45, r * 0.12, '#fff');
    needle(ctx, x, y, r, a0 + Math.max(0, Math.min(1, (v.psi || 0) / 4000)) * (a1 - a0), '#fff', 0.85);
  },
  /** Generic needle 0..1 with a caption. */
  plain: (v) => (ctx, x, y, r) => {
    const a0 = -Math.PI * 0.75, a1 = Math.PI * 0.75;
    ticks(ctx, x, y, r, 10, a0, a1, v.labels, 0.2, 5);
    if (v.caption) drawLabel(ctx, v.caption, x, y + r * 0.42, r * 0.14, '#fff');
    needle(ctx, x, y, r, a0 + Math.max(0, Math.min(1, v.value ?? 0)) * (a1 - a0), '#fff', 0.82);
  },
};
