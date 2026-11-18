// Canvas PFD (with FMA) and map-mode ND for the Automatic flight trainer.
// Display units are always dark like the real ones, independent of the site theme.
import { RWY, ROUTE, ROUTE_START, wrap360, angDiff } from './afds-sim.js';

const C = {
  bg: '#05080b', white: '#f2f5f7', green: '#3fe07a', magenta: '#ff5ce1', cyan: '#3fd7ff', amber: '#ffb31a',
  grey: '#59626b', sky: '#2c6fb3', ground: '#7a4d27', red: '#ff3b30',
};
const FONT = '"JetBrains Mono", ui-monospace, monospace';
const rad = (d) => (d * Math.PI) / 180;

function setup(canvas, w, h) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== w * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return g;
}
function txt(g, s, x, y, color, size = 13, align = 'center', weight = 600) {
  g.font = `${weight} ${size}px ${FONT}`;
  g.fillStyle = color; g.textAlign = align; g.textBaseline = 'middle';
  g.fillText(s, x, y);
}

export function createPFD(canvas) {
  const W = 470, H = 470;
  const boxes = {}; // slot -> { text, until }
  function hl(slot, text, now) {
    const b = boxes[slot];
    if (!b) { boxes[slot] = { text, until: 0 }; return false; }
    if (b.text !== text) { b.text = text; b.until = text ? now + 10 : 0; }
    return now < b.until;
  }
  function reset() { for (const k of Object.keys(boxes)) delete boxes[k]; }

  function draw(sim, now) {
    const g = setup(canvas, W, H);
    const s = sim.s, f = sim.fma();
    g.fillStyle = C.bg; g.fillRect(0, 0, W, H);

    // ---------------- ADI ----------------
    const cx = 232, cy = 222, aw = 112, ah = 118;
    const ppd = 6.4; // px per degree pitch
    g.save();
    g.beginPath(); g.roundRect(cx - aw, cy - ah, aw * 2, ah * 2, 18); g.clip();
    g.translate(cx, cy); g.rotate(rad(-s.bank));
    const off = s.pitchAtt * ppd;
    g.fillStyle = C.sky; g.fillRect(-400, -800 + off, 800, 800);
    g.fillStyle = C.ground; g.fillRect(-400, off, 800, 800);
    g.strokeStyle = C.white; g.lineWidth = 2;
    g.beginPath(); g.moveTo(-400, off); g.lineTo(400, off); g.stroke();
    g.lineWidth = 1.5;
    for (let p = -30; p <= 30; p += 2.5) {
      if (p === 0) continue;
      const y = off - p * ppd;
      if (y < -ah - 20 || y > ah + 20) continue;
      const major = p % 10 === 0, mid = p % 5 === 0;
      const hw = major ? 34 : mid ? 18 : 9;
      g.beginPath(); g.moveTo(-hw, y); g.lineTo(hw, y); g.stroke();
      if (major) { txt(g, String(Math.abs(p)), -hw - 13, y, C.white, 11); txt(g, String(Math.abs(p)), hw + 13, y, C.white, 11); }
    }
    g.restore();
    // bank scale
    g.save(); g.translate(cx, cy);
    g.strokeStyle = C.white; g.lineWidth = 1.5;
    const R = ah - 10;
    for (const a of [-60, -45, -30, -20, -10, 10, 20, 30, 45, 60]) {
      const l = Math.abs(a) % 30 === 0 ? 12 : 7;
      g.beginPath();
      g.moveTo(Math.sin(rad(a)) * R, -Math.cos(rad(a)) * R);
      g.lineTo(Math.sin(rad(a)) * (R + l), -Math.cos(rad(a)) * (R + l)); g.stroke();
    }
    g.fillStyle = C.white;
    g.beginPath(); g.moveTo(0, -R); g.lineTo(-6, -R - 9); g.lineTo(6, -R - 9); g.closePath(); g.fill();
    g.rotate(rad(-s.bank));
    g.beginPath(); g.moveTo(0, -R + 1); g.lineTo(-7, -R + 11); g.lineTo(7, -R + 11); g.closePath(); g.stroke();
    g.restore();
    // F/D bars (magenta) or aircraft symbol
    const fdOn = (s.mcp.fdL || s.mcp.fdR) && (s.pitch || s.roll) && !f.cwsP;
    if (fdOn) {
      g.save(); g.strokeStyle = C.magenta; g.lineWidth = 3;
      const pe = Math.max(-60, Math.min(60, -(s.fdPitchErr ?? 0)));
      const re = Math.max(-60, Math.min(60, (s.fdRollErr ?? 0)));
      g.beginPath(); g.moveTo(cx - 60, cy + pe); g.lineTo(cx + 60, cy + pe); g.stroke();
      g.beginPath(); g.moveTo(cx + re, cy - 60); g.lineTo(cx + re, cy + 60); g.stroke();
      g.restore();
    }
    g.save(); g.strokeStyle = '#000'; g.fillStyle = '#111'; g.lineWidth = 2;
    const wing = (x0, dir) => { g.beginPath(); g.rect(x0, cy - 3, 46 * dir, 6); g.fill(); g.strokeStyle = C.white; g.stroke(); };
    wing(cx - 78, 1); wing(cx + 78, -1);
    g.fillStyle = '#111'; g.fillRect(cx - 4, cy - 4, 8, 8); g.strokeStyle = C.white; g.strokeRect(cx - 4, cy - 4, 8, 8);
    g.restore();

    // ILS deviation
    if (s.appMode || s.roll === 'VOR/LOC' || s.armRoll === 'VOR/LOC') {
      const G = sim.ilsGeom();
      g.save(); g.strokeStyle = C.white; g.lineWidth = 1.5;
      for (const d of [-2, -1, 1, 2]) { g.beginPath(); g.arc(cx + d * 34, cy + ah + 14, 3.5, 0, 7); g.stroke(); g.beginPath(); g.arc(cx + aw + 16, cy + d * 34, 3.5, 0, 7); g.stroke(); }
      g.fillStyle = C.magenta;
      const lx = cx - G.locDots * 34, gy = cy + G.gsDots * 34;
      const dia = (x, y) => { g.beginPath(); g.moveTo(x, y - 7); g.lineTo(x + 6, y); g.lineTo(x, y + 7); g.lineTo(x - 6, y); g.closePath(); g.fill(); };
      if (G.along > 0) { dia(lx, cy + ah + 14); dia(cx + aw + 16, gy); }
      txt(g, `${RWY.ident} / 110.30`, cx - aw + 2, cy - ah + 12, C.white, 10, 'left');
      g.restore();
    }
    // radio altitude
    const ra = sim.ra();
    if (ra < 2500 && !s.onGround) txt(g, String(Math.round(ra / (ra > 100 ? 10 : 5)) * (ra > 100 ? 10 : 5)), cx, cy + ah - 18, C.white, 15, 'center', 700);

    // ---------------- speed tape ----------------
    const tx = 22, tw = 62, ty = cy - 150, th = 300;
    g.save();
    g.fillStyle = '#1a2129'; g.fillRect(tx, ty, tw, th);
    g.beginPath(); g.rect(tx, ty, tw, th); g.clip();
    const kpp = 3.2; // px per kt
    g.strokeStyle = C.white; g.lineWidth = 1.5;
    for (let v = Math.floor((s.ias - 50) / 10) * 10; v < s.ias + 50; v += 10) {
      if (v < 30) continue;
      const y = cy - (v - s.ias) * kpp;
      g.beginPath(); g.moveTo(tx + tw - 10, y); g.lineTo(tx + tw, y); g.stroke();
      if (v % 20 === 0) txt(g, String(v), tx + tw - 14, y, C.white, 13, 'right');
    }
    const bug = sim.tgtSpd();
    const by = Math.max(ty + 4, Math.min(ty + th - 4, cy - (bug - s.ias) * kpp));
    g.strokeStyle = C.magenta; g.lineWidth = 2;
    g.beginPath(); g.moveTo(tx + tw, by); g.lineTo(tx + tw - 8, by - 7); g.lineTo(tx + tw - 8 - 6, by - 7); g.lineTo(tx + tw - 14, by + 7); g.lineTo(tx + tw - 8, by + 7); g.closePath(); g.stroke();
    g.restore();
    g.fillStyle = '#000'; g.strokeStyle = C.white; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(tx - 2, cy - 15); g.lineTo(tx + tw - 8, cy - 15); g.lineTo(tx + tw, cy); g.lineTo(tx + tw - 8, cy + 15); g.lineTo(tx - 2, cy + 15); g.closePath(); g.fill(); g.stroke();
    txt(g, String(Math.round(s.ias)), tx + tw - 12, cy, C.white, 17, 'right', 700);
    txt(g, s.vnav && !s.mcp.spdIntv ? String(Math.round(bug)) : String(Math.round(bug)), tx + tw / 2, ty - 12, C.magenta, 15, 'center', 700);

    // ---------------- altitude tape ----------------
    const ax = 362, aw2 = 74;
    g.save();
    g.fillStyle = '#1a2129'; g.fillRect(ax, ty, aw2, th);
    g.beginPath(); g.rect(ax, ty, aw2, th); g.clip();
    const fpp = 0.28; // px per ft
    g.strokeStyle = C.white; g.lineWidth = 1.5;
    for (let a = Math.floor((s.alt - 600) / 100) * 100; a < s.alt + 600; a += 100) {
      const y = cy - (a - s.alt) * fpp;
      g.beginPath(); g.moveTo(ax, y); g.lineTo(ax + 9, y); g.stroke();
      if (a % 200 === 0) txt(g, String(a), ax + 14, y, C.white, 12, 'left');
    }
    // selected altitude bug
    const sy = cy - (s.mcp.alt - s.alt) * fpp;
    const syc = Math.max(ty + 6, Math.min(ty + th - 6, sy));
    g.strokeStyle = C.magenta; g.lineWidth = 2;
    g.strokeRect(ax + 1, syc - 14, 10, 28);
    g.restore();
    g.fillStyle = '#000'; g.strokeStyle = C.white; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(ax - 8, cy); g.lineTo(ax, cy - 15); g.lineTo(ax + aw2 + 2, cy - 15); g.lineTo(ax + aw2 + 2, cy + 15); g.lineTo(ax, cy + 15); g.closePath(); g.fill(); g.stroke();
    txt(g, String(Math.round(s.alt / 10) * 10), ax + aw2 - 4, cy, C.white, 16, 'right', 700);
    txt(g, String(s.mcp.alt), ax + aw2 / 2, ty - 12, C.magenta, 15, 'center', 700);
    // VSI
    const vx = 446;
    g.fillStyle = '#1a2129'; g.fillRect(vx, cy - 110, 18, 220);
    g.strokeStyle = C.white; g.lineWidth = 1;
    for (const v of [-6, -2, -1, 1, 2, 6]) { const y = cy - Math.sign(v) * Math.min(100, Math.abs(v) <= 2 ? Math.abs(v) * 35 : 100); g.beginPath(); g.moveTo(vx, y); g.lineTo(vx + 6, y); g.stroke(); }
    const vsy = cy - Math.sign(s.vs) * Math.min(100, Math.abs(s.vs) <= 2000 ? Math.abs(s.vs) / 1000 * 35 : 70 + (Math.abs(s.vs) - 2000) / 4000 * 30);
    g.strokeStyle = C.white; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(vx + 26, cy); g.lineTo(vx + 4, vsy); g.stroke();
    if (Math.abs(s.vs) > 400) txt(g, String(Math.round(s.vs / 50) * 50), vx + 9, s.vs > 0 ? cy - 122 : cy + 122, C.white, 11);
    if (s.pitch === 'V/S') { const by2 = cy - Math.sign(s.mcp.vs) * Math.min(100, Math.abs(s.mcp.vs) <= 2000 ? Math.abs(s.mcp.vs) / 1000 * 35 : 70 + (Math.abs(s.mcp.vs) - 2000) / 4000 * 30); g.fillStyle = C.magenta; g.fillRect(vx, by2 - 2, 10, 4); }

    // ---------------- heading arc ----------------
    const hy = H - 12;
    g.save();
    g.beginPath(); g.rect(110, cy + ah + 30, 245, 70); g.clip();
    g.strokeStyle = C.white; g.lineWidth = 1.5;
    const Rr = 170, hcx = cx, hcy = hy + 120;
    g.beginPath(); g.arc(hcx, hcy, Rr, rad(-150), rad(-30)); g.stroke();
    for (let d = Math.floor(s.hdg / 5) * 5 - 40; d <= s.hdg + 40; d += 5) {
      const a = rad(angDiff(wrap360(d), s.hdg) * 1.4 - 90);
      const l = d % 10 === 0 ? 10 : 5;
      g.beginPath(); g.moveTo(hcx + Math.cos(a) * Rr, hcy + Math.sin(a) * Rr); g.lineTo(hcx + Math.cos(a) * (Rr - l), hcy + Math.sin(a) * (Rr - l)); g.stroke();
      if (d % 30 === 0) txt(g, String(wrap360(d) / 10 | 0), hcx + Math.cos(a) * (Rr - 20), hcy + Math.sin(a) * (Rr - 20), C.white, 11);
    }
    const ba = rad(Math.max(-60, Math.min(60, angDiff(s.mcp.hdg, s.hdg) * 1.4)) - 90);
    g.fillStyle = C.magenta; g.save(); g.translate(hcx + Math.cos(ba) * Rr, hcy + Math.sin(ba) * Rr); g.rotate(ba + Math.PI / 2);
    g.fillRect(-7, -6, 14, 6); g.restore();
    g.restore();
    g.fillStyle = '#000'; g.strokeStyle = C.white; g.lineWidth = 1.5;
    g.fillRect(cx - 26, cy + ah + 30, 52, 20); g.strokeRect(cx - 26, cy + ah + 30, 52, 20);
    txt(g, String(Math.round(s.hdg) % 360 || 360).padStart(3, '0'), cx, cy + ah + 40, C.white, 14, 'center', 700);
    txt(g, `${String(s.mcp.hdg).padStart(3, '0')} H`, cx - 34, cy + ah + 40, C.magenta, 13, 'right', 700);

    // ---------------- FMA ----------------
    g.fillStyle = '#0b1117'; g.fillRect(0, 0, W, 54);
    g.strokeStyle = C.grey; g.lineWidth = 1;
    for (const x of [W * 0.33, W * 0.62]) { g.beginPath(); g.moveTo(x, 4); g.lineTo(x, 50); g.stroke(); }
    const slots = [
      ['at', f.at, W * 0.165, f.at === 'ARM' ? C.white : C.green, ''],
      ['roll', f.roll, W * 0.475, f.cwsR ? C.amber : C.green, f.armRoll],
      ['pitch', f.pitch, W * 0.81, f.cwsP ? C.amber : C.green, f.armPitch],
    ];
    for (const [k, v, x, col, arm] of slots) {
      const boxed = hl(k, v, now);
      if (v) txt(g, v, x, 17, col, 15, 'center', 700);
      if (boxed && v) { g.strokeStyle = C.white; g.lineWidth = 1.5; g.font = `700 15px ${FONT}`; const w = g.measureText(v).width + 12; g.strokeRect(x - w / 2, 6, w, 22); }
      const boxedArm = hl(`${k}-arm`, arm, now);
      if (arm) txt(g, arm, x, 40, C.white, 13);
      if (boxedArm && arm) { g.font = `600 13px ${FONT}`; const w = g.measureText(arm).width + 10; g.strokeStyle = C.white; g.strokeRect(x - w / 2, 31, w, 18); }
    }
    // A/P status
    const st = f.status;
    const stCol = st === 'SINGLE CH' ? C.amber : C.green;
    const boxedSt = hl('status', st, now);
    if (st) {
      txt(g, st, cx, cy - ah - 18, stCol, st === 'SINGLE CH' ? 14 : 19, 'center', 700);
      if (boxedSt) { g.font = `700 19px ${FONT}`; const w = g.measureText(st).width + 14; g.strokeStyle = C.white; g.lineWidth = 1.5; g.strokeRect(cx - w / 2, cy - ah - 32, w, 28); }
    }
    // ASA style warning lights on PFD corner
    if (s.warnAP && Math.floor(now * 2.5) % 2 === 0) txt(g, 'A/P', 26, 70, C.red, 13, 'left', 700);
    if (s.warnAT && Math.floor(now * 2.5) % 2 === 0) txt(g, 'A/T', 64, 70, C.red, 13, 'left', 700);
    if (s.mcp.mach) {
      const mach = sim.tas() / (661.5 * Math.sqrt(1 - Math.min(36000, s.alt) * 6.875e-6) );
      txt(g, `M ${mach.toFixed(3).slice(1)}`, tx + tw / 2, ty + th + 14, C.white, 12);
    } else txt(g, `GS ${Math.round(s.onGround ? s.ias : sim.tas())}`, tx + tw / 2, ty + th + 14, C.white, 11);
  }
  return { draw, reset, W, H };
}

export function createND(canvas) {
  const W = 420, H = 470;
  let range = 20;
  function draw(sim) {
    const g = setup(canvas, W, H);
    const s = sim.s;
    g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
    const ox = W / 2, oy = H - 70, R = 300;
    const ppn = R / range;
    const toScreen = (x, y) => {
      const dx = x - s.x, dy = y - s.y;
      const a = rad(-s.hdg);
      const rx = dx * Math.cos(a) - dy * Math.sin(a);
      const ry = dx * Math.sin(a) + dy * Math.cos(a);
      return [ox + rx * ppn, oy - ry * ppn];
    };
    g.save();
    g.beginPath(); g.rect(0, 40, W, H - 40); g.clip();
    // range arcs
    g.strokeStyle = C.white; g.lineWidth = 1.5;
    g.beginPath(); g.arc(ox, oy, R, rad(-140), rad(-40)); g.stroke();
    g.setLineDash([3, 6]); g.strokeStyle = '#8a949c';
    g.beginPath(); g.arc(ox, oy, R / 2, rad(-150), rad(-30)); g.stroke(); g.setLineDash([]);
    txt(g, String(range / 2), ox - R / 2 * Math.cos(rad(30)) - 14, oy - R / 2 * Math.sin(rad(30)), C.white, 11);
    // compass ticks
    for (let d = 0; d < 360; d += 5) {
      const rel = angDiff(d, s.hdg);
      if (Math.abs(rel) > 52) continue;
      const a = rad(rel - 90), l = d % 10 === 0 ? 12 : 6;
      g.beginPath(); g.moveTo(ox + Math.cos(a) * R, oy + Math.sin(a) * R); g.lineTo(ox + Math.cos(a) * (R - l), oy + Math.sin(a) * (R - l)); g.stroke();
      if (d % 30 === 0) txt(g, String(d / 10), ox + Math.cos(a) * (R - 24), oy + Math.sin(a) * (R - 24), C.white, 13);
    }
    // runway + localizer course
    if (s.ils) {
      const [x1, y1] = toScreen(RWY.x, RWY.y);
      const ex = RWY.x - Math.sin(rad(RWY.crs)) * -RWY.len, ey = RWY.y - Math.cos(rad(RWY.crs)) * -RWY.len;
      const [x2, y2] = toScreen(ex, ey);
      g.strokeStyle = C.white; g.lineWidth = 4; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
      const fx = RWY.x - Math.sin(rad(RWY.crs)) * 16, fy = RWY.y - Math.cos(rad(RWY.crs)) * 16;
      const [x3, y3] = toScreen(fx, fy);
      g.strokeStyle = s.roll === 'VOR/LOC' ? C.magenta : C.white; g.lineWidth = 1.2; g.setLineDash([10, 6]);
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x3, y3); g.stroke(); g.setLineDash([]);
      txt(g, `RW${RWY.name}`, x1 + 18, y1 + 14, C.white, 11);
    }
    // route
    if (s.route) {
      const pts = [ROUTE_START, ...ROUTE];
      g.lineWidth = 2;
      for (let i = 1; i < pts.length; i++) {
        const [ax, ay] = toScreen(pts[i - 1].x, pts[i - 1].y), [bx, by] = toScreen(pts[i].x, pts[i].y);
        g.strokeStyle = i >= s.leg ? C.magenta : '#7d4373';
        g.setLineDash(s.roll === 'LNAV' || i < s.leg ? [] : [8, 5]);
        g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
      }
      g.setLineDash([]);
      pts.slice(1).forEach((p, i) => {
        const [x, y] = toScreen(p.x, p.y);
        const active = i + 1 === s.leg;
        g.strokeStyle = active ? C.magenta : C.white; g.lineWidth = 1.5;
        g.beginPath(); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, r = k % 2 ? 3 : 8; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath(); g.stroke();
        txt(g, p.id, x + 12, y - 10, active ? C.magenta : C.white, 11, 'left');
      });
    }
    // heading bug + selected heading line
    const rel = angDiff(s.mcp.hdg, s.hdg);
    const ba = rad(Math.max(-55, Math.min(55, rel)) - 90);
    g.save(); g.translate(ox + Math.cos(ba) * R, oy + Math.sin(ba) * R); g.rotate(ba + Math.PI / 2);
    g.strokeStyle = C.magenta; g.lineWidth = 2; g.strokeRect(-9, -2, 18, 9); g.restore();
    if (s.roll === 'HDG SEL') { g.strokeStyle = C.magenta; g.setLineDash([4, 6]); g.lineWidth = 1; g.beginPath(); g.moveTo(ox, oy); g.lineTo(ox + Math.cos(rad(rel - 90)) * R, oy + Math.sin(rad(rel - 90)) * R); g.stroke(); g.setLineDash([]); }
    // track line
    g.strokeStyle = C.white; g.lineWidth = 1; g.beginPath(); g.moveTo(ox, oy - 20); g.lineTo(ox, oy - R); g.stroke();
    // trend vector
    const tr = 1091 * Math.tan(rad(s.bank)) / Math.max(100, sim.tas());
    g.strokeStyle = C.white; g.lineWidth = 2; g.beginPath();
    let px = 0, py = 0, h = 0; g.moveTo(ox, oy);
    for (let t = 0; t <= 90; t += 5) { h += tr * 5; px += Math.sin(rad(h)) * sim.tas() / 3600 * 5; py += Math.cos(rad(h)) * sim.tas() / 3600 * 5; if (t % 30 === 0) {} g.lineTo(ox + px * ppn, oy - py * ppn); }
    g.stroke();
    g.restore();
    // aircraft symbol
    g.strokeStyle = C.white; g.lineWidth = 2;
    g.beginPath(); g.moveTo(ox, oy - 14); g.lineTo(ox, oy + 14); g.moveTo(ox - 12, oy - 2); g.lineTo(ox + 12, oy - 2); g.moveTo(ox - 5, oy + 12); g.lineTo(ox + 5, oy + 12); g.stroke();
    // header
    g.fillStyle = '#000'; g.fillRect(ox - 34, 4, 68, 24); g.strokeStyle = C.white; g.lineWidth = 1.5; g.strokeRect(ox - 34, 4, 68, 24);
    txt(g, String(Math.round(s.hdg) % 360 || 360).padStart(3, '0'), ox, 16, C.white, 16, 'center', 700);
    txt(g, 'HDG', ox - 60, 16, C.green, 12); txt(g, 'MAG', ox + 60, 16, C.green, 12);
    const gs = Math.round(s.onGround ? s.ias : sim.tas());
    txt(g, `GS ${gs}  TAS ${Math.round(sim.tas())}`, 10, 16, C.white, 11, 'left');
    const L = sim.routeLeg();
    if (L) { txt(g, L.b.id, W - 10, 14, C.magenta, 13, 'right', 700); txt(g, `${L.dist.toFixed(1)} NM`, W - 10, 32, C.white, 11, 'right'); }
    txt(g, `RANGE ${range}`, 10, H - 16, C.cyan, 11, 'left');
    txt(g, 'MAP', W - 10, H - 16, C.green, 11, 'right');
  }
  return {
    draw, W, H,
    cycleRange() { const r = [10, 20, 40, 80]; range = r[(r.indexOf(range) + 1) % r.length]; return range; },
  };
}
