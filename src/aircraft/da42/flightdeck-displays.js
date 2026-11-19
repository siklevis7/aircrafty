// Canvas drawers for the DA42 NG flight deck: Garmin G1000 PFD and MFD (moving map with the
// twin-engine Engine Indication System strip), the GDU 1040 bezels, and the standby airspeed,
// attitude and altimeter. Layouts follow the general Garmin look; values are representative.
// Speeds: typical DA42 NG airspeed indicator markings in KIAS (exact values vary with serial
// number and modifications: always use the approved AFM).
import { rrect } from '../../core/panelcanvas.js';

export const SPEEDS = { white: [56, 111], green: [62, 151], yellow: [151, 188], vne: 188, vmca: 71, vyse: 85 };

const SANS = 'Arial, "Helvetica Neue", sans-serif';
const CYAN = '#2fd9ff', MAGENTA = '#ff3df5', GREEN = '#28e05a', AMBER = '#ffcc00', RED = '#ff2a20', WHITE = '#ffffff';
const fnt = (ctx, px, w = 700) => { ctx.font = `${w} ${px}px ${SANS}`; };
function txt(ctx, t, x, y, px, color = WHITE, align = 'center', base = 'middle', w = 700) {
  fnt(ctx, px, w); ctx.textAlign = align; ctx.textBaseline = base;
  ctx.lineWidth = Math.max(2, px * 0.18); ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineJoin = 'round';
  ctx.strokeText(t, x, y);
  ctx.fillStyle = color; ctx.fillText(t, x, y);
}
const plain = (ctx, t, x, y, px, color = WHITE, align = 'center', base = 'middle', w = 700) => {
  fnt(ctx, px, w); ctx.textAlign = align; ctx.textBaseline = base; ctx.fillStyle = color; ctx.fillText(t, x, y);
};
const pad3 = (n) => String(Math.round(((n % 360) + 360) % 360) || 360).padStart(3, '0');
const fmtFreq = (f, d = 2) => Number(f).toFixed(d);

// ---------------------------------------------------------------------- shared top bar & keys
function topBar(ctx, W, H, s, { title } = {}) {
  const h = H * 0.075;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, h);
  ctx.fillStyle = '#5a5f66'; ctx.fillRect(0, h - 2, W, 2);
  const px = h * 0.34;
  const l1 = h * 0.3, l2 = h * 0.72;
  // NAV (left): standby left, active right; COM (right): active left, standby right
  const nav = s.nav || [[108.0, 117.95], [108.0, 117.95]];
  const com = s.com || [[118.0, 136.975], [118.0, 136.975]];
  plain(ctx, 'NAV1', W * 0.005, l1, px * 0.85, WHITE, 'left');
  plain(ctx, 'NAV2', W * 0.005, l2, px * 0.85, WHITE, 'left');
  [0, 1].forEach((i) => {
    const y = i ? l2 : l1;
    const ok = i === 0 || s.avionics;
    if (!ok) { redX(ctx, W * 0.055, y - px * 0.6, W * 0.16, px * 1.2); return; }
    if (i === 0) { ctx.strokeStyle = CYAN; ctx.lineWidth = 2; ctx.strokeRect(W * 0.056, y - px * 0.62, W * 0.075, px * 1.24); }
    plain(ctx, fmtFreq(nav[i][0]), W * 0.094, y, px, WHITE);
    plain(ctx, '↔', W * 0.148, y, px * 0.9, WHITE);
    plain(ctx, fmtFreq(nav[i][1]), W * 0.198, y, px, i === 0 ? GREEN : WHITE);
  });
  [0, 1].forEach((i) => {
    const y = i ? l2 : l1;
    const ok = i === 0 || s.avionics;
    plain(ctx, i ? 'COM2' : 'COM1', W * 0.995, y, px * 0.85, WHITE, 'right');
    if (!ok) { redX(ctx, W * 0.735, y - px * 0.6, W * 0.19, px * 1.2); return; }
    plain(ctx, fmtFreq(com[i][0], 3), W * 0.772, y, px, i === 0 ? GREEN : WHITE);
    plain(ctx, '↔', W * 0.822, y, px * 0.9, WHITE);
    if (i === 0) { ctx.strokeStyle = CYAN; ctx.lineWidth = 2; ctx.strokeRect(W * 0.836, y - px * 0.62, W * 0.085, px * 1.24); }
    plain(ctx, fmtFreq(com[i][1], 3), W * 0.878, y, px, WHITE);
  });
  // navigation status (centre)
  if (title !== undefined) {
    plain(ctx, title, W * 0.5, l1, px * 0.95, WHITE);
  } else {
    plain(ctx, s.wpt ? `→ ${s.wpt}` : '', W * 0.39, l1, px, MAGENTA);
    plain(ctx, `DIS ${s.dis ?? '12.4'}NM`, W * 0.52, l1, px, MAGENTA);
    plain(ctx, `DTK ${pad3(s.dtk ?? 93)}°`, W * 0.64, l1, px, MAGENTA);
    plain(ctx, `TRK ${pad3(s.trk ?? 93)}°`, W * 0.52, l2, px * 0.92, WHITE);
  }
  return h;
}
function redX(ctx, x, y, w, h) {
  ctx.strokeStyle = RED; ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y + h); ctx.moveTo(x + w, y); ctx.lineTo(x, y + h); ctx.stroke();
}
function softkeys(ctx, W, H, labels, active = []) {
  const y0 = H * 0.955;
  ctx.fillStyle = '#000'; ctx.fillRect(0, y0, W, H - y0);
  const kw = W / 12;
  labels.forEach((l, i) => {
    if (i) { ctx.fillStyle = '#4a4f55'; ctx.fillRect(i * kw - 1, y0 + 3, 2, H - y0 - 6); }
    if (!l) return;
    if (active.includes(l)) { ctx.fillStyle = '#d8dde2'; ctx.fillRect(i * kw + 3, y0 + 3, kw - 6, H - y0 - 6); }
    plain(ctx, l, i * kw + kw / 2, (y0 + H) / 2 + 1, (H - y0) * 0.5, active.includes(l) ? '#000' : WHITE);
  });
}

// ---------------------------------------------------------------------- PFD
export const PFD_SOFTKEYS = ['INSET', '', 'PFD', 'OBS', 'CDI', 'DME', 'XPDR', 'IDENT', 'TMR/REF', 'NRST', '', 'ALERTS'];
/** Rectangles (fractions of the screen) of PFD areas that also exist as separate study zones. */
export const PFD_AREAS = {
  airspeed: { x: 0.14, y: 0.16, w: 0.13, h: 0.5 },
  hsi: { x: 0.31, y: 0.6, w: 0.38, h: 0.355 },
  cas: { x: 0.865, y: 0.16, w: 0.13, h: 0.34 },
};

export function drawPFD(ctx, W, H, s) {
  ctx.save();
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  if (!s.on) { ctx.restore(); return; }
  const cx = W * 0.5, cy = H * 0.37;
  const ppd = H * 0.0125; // pixels per degree of pitch
  // ---- attitude: sky / ground over the whole display
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-s.bank * Math.PI / 180);
  ctx.translate(0, s.pitch * ppd);
  const big = W * 2;
  const sky = ctx.createLinearGradient(0, -H * 0.9, 0, 0);
  sky.addColorStop(0, '#0d3fa8'); sky.addColorStop(1, '#3d8ff0');
  ctx.fillStyle = sky; ctx.fillRect(-big, -big, big * 2, big);
  const gnd = ctx.createLinearGradient(0, 0, 0, H * 0.9);
  gnd.addColorStop(0, '#8c5a24'); gnd.addColorStop(1, '#4d2e10');
  ctx.fillStyle = gnd; ctx.fillRect(-big, 0, big * 2, big);
  ctx.fillStyle = WHITE; ctx.fillRect(-big, -1, big * 2, 2);
  // pitch ladder (clipped to a central window)
  ctx.save();
  ctx.beginPath(); ctx.rect(-W * 0.16, -s.pitch * ppd - H * 0.2, W * 0.32, H * 0.4); ctx.clip();
  for (let p = -30; p <= 30; p += 2.5) {
    if (!p) continue;
    const y = -p * ppd;
    const major = p % 10 === 0, mid = p % 5 === 0;
    const hw = major ? W * 0.07 : mid ? W * 0.035 : W * 0.018;
    ctx.fillStyle = WHITE; ctx.fillRect(-hw, y - 1, hw * 2, 2);
    if (major) { plain(ctx, String(Math.abs(p)), -hw - W * 0.02, y, H * 0.03); plain(ctx, String(Math.abs(p)), hw + W * 0.02, y, H * 0.03); }
  }
  ctx.restore();
  ctx.restore();
  // ---- roll scale
  const rr = H * 0.25;
  ctx.save(); ctx.translate(cx, cy);
  ctx.strokeStyle = WHITE; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, rr, -Math.PI / 2 - Math.PI / 3, -Math.PI / 2 + Math.PI / 3); ctx.stroke();
  for (const a of [-60, -45, -30, -20, -10, 10, 20, 30, 45, 60]) {
    const r = a * Math.PI / 180, len = Math.abs(a) % 30 === 0 ? H * 0.03 : H * 0.017;
    ctx.beginPath(); ctx.moveTo(Math.sin(r) * rr, -Math.cos(r) * rr); ctx.lineTo(Math.sin(r) * (rr + len), -Math.cos(r) * (rr + len)); ctx.stroke();
  }
  ctx.fillStyle = WHITE; ctx.beginPath(); ctx.moveTo(0, -rr); ctx.lineTo(-H * 0.014, -rr - H * 0.026); ctx.lineTo(H * 0.014, -rr - H * 0.026); ctx.fill();
  // roll pointer and slip/skid indicator rotate with the bank
  ctx.rotate(-s.bank * Math.PI / 180);
  ctx.beginPath(); ctx.moveTo(0, -rr + 2); ctx.lineTo(-H * 0.016, -rr + H * 0.028); ctx.lineTo(H * 0.016, -rr + H * 0.028); ctx.closePath(); ctx.fill();
  const sk = (s.slip || 0) * H * 0.02;
  ctx.fillRect(-H * 0.018 + sk, -rr + H * 0.033, H * 0.036, H * 0.009);
  ctx.restore();
  // ---- flight director (magenta command bars) and aircraft symbol (yellow delta)
  ctx.save(); ctx.translate(cx, cy);
  if (s.fd) {
    ctx.save(); ctx.rotate(-(s.fdBank ?? s.bank) * Math.PI / 180 * 0.4); ctx.translate(0, -(s.fdPitch ?? 0) * ppd);
    ctx.fillStyle = MAGENTA; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(sd * W * 0.11, H * 0.05); ctx.lineTo(sd * W * 0.1, H * 0.062); ctx.lineTo(0, H * 0.012); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    ctx.restore();
  }
  ctx.fillStyle = AMBER; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
  for (const sd of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(sd * W * 0.1, H * 0.06); ctx.lineTo(sd * W * 0.06, H * 0.06); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillRect(sd > 0 ? W * 0.17 : -W * 0.21, -H * 0.006, W * 0.04, H * 0.012); ctx.strokeRect(sd > 0 ? W * 0.17 : -W * 0.21, -H * 0.006, W * 0.04, H * 0.012);
  }
  ctx.restore();

  const barH = topBar(ctx, W, H, s);
  // ---- AFCS status bar
  if (s.afcs && s.afcs.show) {
    const y0 = barH, h = H * 0.045;
    ctx.fillStyle = 'rgba(0,0,0,0.9)'; ctx.fillRect(W * 0.2, y0, W * 0.6, h);
    ctx.fillStyle = '#5a5f66'; ctx.fillRect(W * 0.2, y0 + h - 1, W * 0.6, 1);
    const px = h * 0.6;
    plain(ctx, s.afcs.lat || '', W * 0.3, y0 + h / 2, px, GREEN);
    if (s.afcs.latArm) plain(ctx, s.afcs.latArm, W * 0.38, y0 + h / 2, px * 0.9, WHITE);
    plain(ctx, s.afcs.ap ? 'AP' : '', W * 0.5, y0 + h / 2, px, GREEN);
    plain(ctx, s.afcs.vert || '', W * 0.6, y0 + h / 2, px, GREEN);
    if (s.afcs.vertRef) plain(ctx, s.afcs.vertRef, W * 0.69, y0 + h / 2, px * 0.9, GREEN);
    if (s.afcs.vertArm) plain(ctx, s.afcs.vertArm, W * 0.765, y0 + h / 2, px * 0.9, WHITE);
  }
  // ---- airspeed tape
  speedTape(ctx, W, H, s);
  altTape(ctx, W, H, s);
  hsi(ctx, W, H, s);
  // ---- OAT / wind / transponder / time
  const by = H * 0.905;
  ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(0, by, W * 0.15, H * 0.05);
  plain(ctx, `OAT ${Math.round(s.oat ?? 15)}°C`, W * 0.075, by + H * 0.025, H * 0.03);
  ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(W * 0.17, H * 0.74, W * 0.12, H * 0.06);
  if (s.air) {
    ctx.save(); ctx.translate(W * 0.19, H * 0.77); ctx.rotate(((s.windDir ?? 270) - s.hdg + 180) * Math.PI / 180);
    ctx.strokeStyle = WHITE; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -H * 0.02); ctx.lineTo(0, H * 0.02); ctx.moveTo(-H * 0.01, H * 0.008); ctx.lineTo(0, H * 0.02); ctx.lineTo(H * 0.01, H * 0.008); ctx.stroke();
    ctx.restore();
    plain(ctx, `${pad3(s.windDir ?? 270)}°`, W * 0.25, H * 0.758, H * 0.024);
    plain(ctx, `${s.windSpd ?? 12}KT`, W * 0.25, H * 0.784, H * 0.024);
  } else plain(ctx, 'NO WIND DATA', W * 0.23, H * 0.77, H * 0.019);
  ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(W * 0.8, by, W * 0.2, H * 0.05);
  plain(ctx, `XPDR ${s.squawk ?? '7000'}`, W * 0.805, by + H * 0.016, H * 0.024, GREEN, 'left');
  plain(ctx, s.air ? 'ALT' : 'GND', W * 0.99, by + H * 0.016, H * 0.024, GREEN, 'right');
  plain(ctx, `LCL ${s.time ?? '10:42:00'}`, W * 0.805, by + H * 0.039, H * 0.022, WHITE, 'left');
  // ---- crew alerting window
  casWindow(ctx, W, H, s.cas || []);
  softkeys(ctx, W, H, PFD_SOFTKEYS, s.cas?.length ? ['ALERTS'] : []);
  ctx.restore();
}

function speedTape(ctx, W, H, s) {
  const A = PFD_AREAS.airspeed;
  const x = W * A.x, y = H * A.y, w = W * A.w, h = H * A.h;
  const mid = y + h / 2;
  const ias = s.ias || 0;
  const ref = Math.max(ias, 20);
  const ppk = h / 70;
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = 'rgba(40,44,50,0.62)'; ctx.fillRect(x, y, w, h);
  const ky = (k) => mid - (k - ref) * ppk;
  // colour bands on the right edge
  const bx = x + w - W * 0.018, bw = W * 0.018;
  const band = (a, b, color, xx = bx, ww = bw) => { ctx.fillStyle = color; ctx.fillRect(xx, ky(b), ww, ky(a) - ky(b)); };
  band(20, SPEEDS.white[0], '#d81e16');
  band(SPEEDS.white[0], SPEEDS.white[1], '#ffffff', bx, bw * 0.45);
  band(SPEEDS.green[0], SPEEDS.green[1], '#16c43c', bx + bw * 0.45, bw * 0.55);
  band(SPEEDS.yellow[0], SPEEDS.yellow[1], '#f2c400', bx + bw * 0.45, bw * 0.55);
  // red / white barber pole above VNE
  for (let k = SPEEDS.vne; k < SPEEDS.vne + 60; k += 4) band(k, k + 2, (k / 2) % 2 ? '#ffffff' : '#d81e16');
  // VMCA (red) and VYSE (blue) lines across the tape edge
  ctx.fillStyle = '#ff2a20'; ctx.fillRect(x + w * 0.45, ky(SPEEDS.vmca) - 2, w * 0.55, 4);
  ctx.fillStyle = '#2a8cff'; ctx.fillRect(x + w * 0.45, ky(SPEEDS.vyse) - 2, w * 0.55, 4);
  // ticks and numbers
  for (let k = Math.floor((ref - 40) / 5) * 5; k <= ref + 40; k += 5) {
    if (k < 20) continue;
    const yy = ky(k);
    ctx.fillStyle = WHITE; ctx.fillRect(bx - (k % 10 ? W * 0.012 : W * 0.022), yy - 1, k % 10 ? W * 0.012 : W * 0.022, 2);
    if (k % 10 === 0) plain(ctx, String(k), bx - W * 0.03, yy, H * 0.034, WHITE, 'right');
  }
  ctx.restore();
  // pointer box
  const bh = H * 0.065;
  ctx.fillStyle = '#000'; ctx.strokeStyle = WHITE; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x + 2, mid - bh / 2); ctx.lineTo(x + w * 0.74, mid - bh / 2); ctx.lineTo(x + w * 0.74, mid - bh * 0.18); ctx.lineTo(x + w * 0.86, mid); ctx.lineTo(x + w * 0.74, mid + bh * 0.18); ctx.lineTo(x + w * 0.74, mid + bh / 2); ctx.lineTo(x + 2, mid + bh / 2); ctx.closePath(); ctx.fill(); ctx.stroke();
  const vColor = ias >= SPEEDS.vne ? RED : ias >= SPEEDS.yellow[0] ? AMBER : WHITE;
  plain(ctx, ias < 20 ? '---' : String(Math.round(ias)), x + w * 0.4, mid + 1, H * 0.05, vColor);
  // TAS box
  ctx.fillStyle = '#000'; ctx.fillRect(x, y + h, w, H * 0.04);
  ctx.strokeStyle = '#5a5f66'; ctx.lineWidth = 1; ctx.strokeRect(x, y + h, w, H * 0.04);
  plain(ctx, `TAS ${Math.round(s.tas || 0)}KT`, x + w / 2, y + h + H * 0.02, H * 0.026);
}

function altTape(ctx, W, H, s) {
  const x = W * 0.7, y = H * 0.16, w = W * 0.115, h = H * 0.5;
  const mid = y + h / 2;
  const alt = s.alt || 0;
  const ppf = h / 600;
  // selected altitude box above
  ctx.fillStyle = '#000'; ctx.fillRect(x, y - H * 0.045, w, H * 0.045);
  ctx.strokeStyle = '#5a5f66'; ctx.lineWidth = 1; ctx.strokeRect(x, y - H * 0.045, w, H * 0.045);
  plain(ctx, String(s.selAlt ?? 6000), x + w * 0.58, y - H * 0.022, H * 0.032, CYAN);
  ctx.fillStyle = CYAN; ctx.fillRect(x + w * 0.08, y - H * 0.03, w * 0.12, H * 0.016);
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = 'rgba(40,44,50,0.62)'; ctx.fillRect(x, y, w, h);
  const fy = (f) => mid - (f - alt) * ppf;
  for (let f = Math.floor((alt - 360) / 20) * 20; f <= alt + 360; f += 20) {
    const yy = fy(f);
    const major = f % 100 === 0;
    ctx.fillStyle = WHITE; ctx.fillRect(x, yy - 1, major ? W * 0.02 : W * 0.01, 2);
    if (major) plain(ctx, String(f), x + w * 0.62, yy, H * 0.03);
  }
  // altitude bug
  const by = Math.max(y, Math.min(y + h, fy(s.selAlt ?? 6000)));
  ctx.fillStyle = CYAN; ctx.fillRect(x, by - H * 0.014, W * 0.008, H * 0.028);
  ctx.restore();
  // pointer box
  const bh = H * 0.075;
  ctx.fillStyle = '#000'; ctx.strokeStyle = WHITE; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x - W * 0.012, mid); ctx.lineTo(x + W * 0.006, mid - bh * 0.25); ctx.lineTo(x + W * 0.006, mid - bh / 2); ctx.lineTo(x + w - 2, mid - bh / 2); ctx.lineTo(x + w - 2, mid + bh / 2); ctx.lineTo(x + W * 0.006, mid + bh / 2); ctx.lineTo(x + W * 0.006, mid + bh * 0.25); ctx.closePath(); ctx.fill(); ctx.stroke();
  const a = Math.round(alt);
  const hund = Math.floor(Math.abs(a) / 100);
  const tens = Math.abs(a) % 100;
  plain(ctx, String(hund), x + w * 0.6, mid + 1, H * 0.046, WHITE, 'right');
  plain(ctx, String(Math.round(tens / 20) * 20 % 100).padStart(2, '0'), x + w * 0.62, mid + 1, H * 0.034, WHITE, 'left');
  // barometric setting box below
  ctx.fillStyle = '#000'; ctx.fillRect(x, y + h, w, H * 0.04);
  ctx.strokeStyle = '#5a5f66'; ctx.lineWidth = 1; ctx.strokeRect(x, y + h, w, H * 0.04);
  plain(ctx, s.baroText || '29.92IN', x + w / 2, y + h + H * 0.02, H * 0.028, CYAN);
  // vertical speed indicator
  const vx = x + w + W * 0.004, vw = W * 0.042;
  ctx.fillStyle = 'rgba(40,44,50,0.62)';
  ctx.beginPath(); ctx.moveTo(vx, y + h * 0.1); ctx.lineTo(vx + vw, y + h * 0.16); ctx.lineTo(vx + vw, y + h * 0.84); ctx.lineTo(vx, y + h * 0.9); ctx.closePath(); ctx.fill();
  const vy = (v) => mid - Math.max(-2000, Math.min(2000, v)) / 2000 * h * 0.38;
  for (const v of [-2000, -1500, -1000, -500, 0, 500, 1000, 1500, 2000]) {
    ctx.fillStyle = WHITE; ctx.fillRect(vx, vy(v) - 1, v % 1000 ? W * 0.007 : W * 0.012, 2);
    if (v && v % 1000 === 0) plain(ctx, String(Math.abs(v / 1000)), vx + W * 0.022, vy(v), H * 0.026);
  }
  const vs = s.vs || 0;
  const py = vy(vs);
  ctx.fillStyle = '#000'; ctx.strokeStyle = WHITE; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(vx + 1, py); ctx.lineTo(vx + W * 0.01, py - H * 0.018); ctx.lineTo(vx + vw + W * 0.012, py - H * 0.018); ctx.lineTo(vx + vw + W * 0.012, py + H * 0.018); ctx.lineTo(vx + W * 0.01, py + H * 0.018); ctx.closePath(); ctx.fill(); ctx.stroke();
  if (Math.abs(vs) >= 100) plain(ctx, String(Math.round(vs / 50) * 50), vx + W * 0.031, py + 1, H * 0.022);
}

function hsi(ctx, W, H, s) {
  const cx = W * 0.5, cy = H * 0.835, r = H * 0.2;
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, W, H * 0.955); ctx.clip();
  ctx.fillStyle = 'rgba(30,33,38,0.78)';
  ctx.beginPath(); ctx.arc(cx, cy, r * 1.04, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(-s.hdg * Math.PI / 180);
  for (let d = 0; d < 360; d += 5) {
    const a = d * Math.PI / 180, len = d % 10 ? r * 0.06 : r * 0.11;
    ctx.strokeStyle = WHITE; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(Math.sin(a) * r, -Math.cos(a) * r); ctx.lineTo(Math.sin(a) * (r - len), -Math.cos(a) * (r - len)); ctx.stroke();
    if (d % 30 === 0) {
      const lab = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[d] ?? String(d / 10);
      ctx.save(); ctx.translate(Math.sin(a) * r * 0.76, -Math.cos(a) * r * 0.76); ctx.rotate(a);
      plain(ctx, lab, 0, 0, r * 0.15); ctx.restore();
    }
  }
  // heading bug (cyan)
  ctx.save(); ctx.rotate((s.hdgBug ?? 90) * Math.PI / 180);
  ctx.fillStyle = CYAN; ctx.beginPath(); ctx.moveTo(-r * 0.07, -r); ctx.lineTo(-r * 0.07, -r * 1.06); ctx.lineTo(r * 0.07, -r * 1.06); ctx.lineTo(r * 0.07, -r); ctx.lineTo(0, -r * 0.94); ctx.closePath(); ctx.fill();
  ctx.restore();
  // course pointer and CDI (magenta: GPS source)
  ctx.save(); ctx.rotate((s.crs ?? 93) * Math.PI / 180);
  ctx.strokeStyle = MAGENTA; ctx.fillStyle = MAGENTA; ctx.lineWidth = r * 0.045;
  ctx.beginPath(); ctx.moveTo(0, -r * 0.88); ctx.lineTo(0, -r * 0.4); ctx.moveTo(0, r * 0.4); ctx.lineTo(0, r * 0.88); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -r * 0.92); ctx.lineTo(-r * 0.07, -r * 0.76); ctx.lineTo(r * 0.07, -r * 0.76); ctx.closePath(); ctx.fill();
  for (const dd of [-2, -1, 1, 2]) { ctx.strokeStyle = WHITE; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(dd * r * 0.16, 0, r * 0.03, 0, Math.PI * 2); ctx.stroke(); }
  const dev = Math.max(-2.2, Math.min(2.2, s.cdi ?? 0));
  ctx.strokeStyle = MAGENTA; ctx.lineWidth = r * 0.045;
  ctx.beginPath(); ctx.moveTo(dev * r * 0.16, -r * 0.36); ctx.lineTo(dev * r * 0.16, r * 0.36); ctx.stroke();
  ctx.restore();
  ctx.restore();
  // aircraft symbol
  ctx.save(); ctx.translate(cx, cy); ctx.fillStyle = WHITE;
  ctx.fillRect(-r * 0.02, -r * 0.16, r * 0.04, r * 0.3); ctx.fillRect(-r * 0.16, -r * 0.05, r * 0.32, r * 0.04); ctx.fillRect(-r * 0.07, r * 0.11, r * 0.14, r * 0.03);
  ctx.restore();
  plain(ctx, 'GPS', cx - r * 0.42, cy - r * 0.18, r * 0.11, MAGENTA);
  plain(ctx, 'ENR', cx + r * 0.42, cy - r * 0.18, r * 0.11, MAGENTA);
  // lubber line + heading box
  ctx.fillStyle = '#000'; ctx.strokeStyle = WHITE; ctx.lineWidth = 2;
  const hb = r * 0.4;
  ctx.fillRect(cx - hb / 2, cy - r - H * 0.075, hb, H * 0.05); ctx.strokeRect(cx - hb / 2, cy - r - H * 0.075, hb, H * 0.05);
  plain(ctx, `${pad3(s.hdg)}°`, cx, cy - r - H * 0.05, H * 0.035);
  ctx.fillStyle = WHITE; ctx.beginPath(); ctx.moveTo(cx, cy - r + r * 0.02); ctx.lineTo(cx - r * 0.05, cy - r - H * 0.022); ctx.lineTo(cx + r * 0.05, cy - r - H * 0.022); ctx.closePath(); ctx.fill();
  ctx.restore();
  // selected heading and course windows
  const wy = H * 0.665;
  ctx.fillStyle = '#000'; ctx.fillRect(W * 0.31, wy, W * 0.1, H * 0.04); ctx.fillRect(W * 0.59, wy, W * 0.1, H * 0.04);
  plain(ctx, 'HDG', W * 0.315, wy + H * 0.02, H * 0.024, WHITE, 'left');
  plain(ctx, `${pad3(s.hdgBug ?? 90)}°`, W * 0.405, wy + H * 0.02, H * 0.026, CYAN, 'right');
  plain(ctx, 'CRS', W * 0.595, wy + H * 0.02, H * 0.024, WHITE, 'left');
  plain(ctx, `${pad3(s.crs ?? 93)}°`, W * 0.685, wy + H * 0.02, H * 0.026, MAGENTA, 'right');
}

function casWindow(ctx, W, H, cas) {
  if (!cas.length) return;
  const A = PFD_AREAS.cas;
  const x = W * A.x, y = H * A.y, w = W * A.w;
  const lh = H * 0.034;
  const n = Math.min(cas.length, 9);
  ctx.fillStyle = '#000'; ctx.fillRect(x, y, w, lh * n + 6);
  ctx.strokeStyle = '#8a9099'; ctx.lineWidth = 1.5; ctx.strokeRect(x, y, w, lh * n + 6);
  cas.slice(0, n).forEach((c, i) => {
    const col = c.lvl === 'warn' ? RED : c.lvl === 'caut' ? AMBER : WHITE;
    plain(ctx, c.t, x + w / 2, y + 3 + lh * (i + 0.5), lh * 0.62, col);
  });
}

// ---------------------------------------------------------------------- MFD (EIS + map)
export const MFD_SOFTKEYS = ['ENGINE', '', 'MAP', '', '', '', '', '', '', '', 'DCLTR', 'CHKLIST'];
export const MFD_AREAS = { eis: { x: 0, y: 0.075, w: 0.205, h: 0.88 } };

let terrain = null;
function terrainCanvas() {
  if (terrain) return terrain;
  const N = 512;
  const c = document.createElement('canvas'); c.width = N; c.height = N;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(N, N);
  const hash = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
  const vn = (x, y, p, s) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const P = (n) => ((n % p) + p) % p;
    const a = hash(P(xi), P(yi), s), b = hash(P(xi + 1), P(yi), s), cc = hash(P(xi), P(yi + 1), s), d = hash(P(xi + 1), P(yi + 1), s);
    return a + (b - a) * u + (cc - a) * v + (a - b - cc + d) * u * v;
  };
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let e = 0, amp = 1, per = 4, norm = 0;
      for (let o = 0; o < 5; o++) { e += amp * vn((x / N) * per, (y / N) * per, per, 7 + o); norm += amp; amp *= 0.5; per *= 2; }
      e /= norm;
      let r, g, b;
      if (e < 0.33) { r = 30; g = 70; b = 150; } // water
      else if (e < 0.45) { r = 40; g = 95; b = 40; }
      else if (e < 0.55) { r = 70; g = 110; b = 45; }
      else if (e < 0.63) { r = 120; g = 115; b = 55; }
      else if (e < 0.72) { r = 125; g = 90; b = 50; }
      else { r = 150; g = 120; b = 95; }
      const k = 0.55 + 0.25 * (e - 0.5);
      const i = (y * N + x) * 4;
      img.data[i] = r * k; img.data[i + 1] = g * k; img.data[i + 2] = b * k; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  terrain = c;
  return c;
}

// flight plan and airports in map NM (x east, y north), drawn over the terrain
const FPL = [[0, 0], [6, 9], [18, 14], [30, 12]];
const FIXES = [{ id: 'HOME', p: [0, 0], apt: true }, { id: 'ALPHA', p: [6, 9] }, { id: 'DIAMO', p: [18, 14] }, { id: 'DEST', p: [30, 12], apt: true }, { id: 'NORTH', p: [-8, 16], apt: true }];

export function drawMFD(ctx, W, H, s) {
  ctx.save();
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  if (!s.on) { ctx.restore(); return; }
  const barH = topBar(ctx, W, H, s, { title: '' });
  // data fields in the top bar
  const px = barH * 0.32;
  const fields = [['GS', `${Math.round(s.gs || 0)}KT`], ['DTK', `${pad3(s.dtk ?? 93)}°`], ['TRK', `${pad3(s.trk ?? 93)}°`], ['ETE', s.gs > 30 ? '04:52' : '__:__']];
  fields.forEach(([k, v], i) => {
    const x = W * (0.3 + i * 0.105);
    plain(ctx, k, x, barH * 0.3, px * 0.8, WHITE);
    plain(ctx, v, x, barH * 0.72, px, MAGENTA);
  });
  // ---- map
  const mx = W * MFD_AREAS.eis.w, my = barH, mw = W - mx, mh = H * 0.955 - my;
  ctx.save();
  ctx.beginPath(); ctx.rect(mx, my, mw, mh); ctx.clip();
  const ox = mx + mw * 0.5, oy = my + mh * 0.62; // ownship
  const range = s.range || 10; // NM across the upper half
  const ppn = (mh * 0.55) / range;
  const tex = terrainCanvas();
  const tileNM = 60;
  ctx.save();
  ctx.translate(ox, oy);
  ctx.rotate(-(s.trk ?? s.hdg ?? 93) * Math.PI / 180);
  const px0 = s.pos?.[0] ?? 0, py0 = s.pos?.[1] ?? 0;
  ctx.save();
  ctx.scale(ppn * tileNM / tex.width, ppn * tileNM / tex.height);
  const pat = ctx.createPattern(tex, 'repeat');
  const tx = -(px0 / tileNM) * tex.width, ty = (py0 / tileNM) * tex.height;
  ctx.translate(tx, ty);
  ctx.fillStyle = pat;
  ctx.fillRect(-tx - tex.width * 3, -ty - tex.height * 3, tex.width * 6, tex.height * 6);
  ctx.restore();
  // map features (north-up NM coords -> screen)
  const P = (p) => [(p[0] - px0) * ppn, -(p[1] - py0) * ppn];
  ctx.strokeStyle = MAGENTA; ctx.lineWidth = 3;
  ctx.beginPath(); FPL.forEach((p, i) => { const [x, y] = P(p); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.stroke();
  for (const f of FIXES) {
    const [x, y] = P(f.p);
    ctx.save(); ctx.translate(x, y); ctx.rotate((s.trk ?? s.hdg ?? 93) * Math.PI / 180);
    if (f.apt) {
      ctx.strokeStyle = '#d7e4ff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#d7e4ff'; ctx.fillRect(-1.5, -10, 3, 20);
    } else {
      ctx.fillStyle = WHITE; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(6, 4); ctx.lineTo(-6, 4); ctx.closePath(); ctx.fill();
    }
    txt(ctx, f.id, 0, 16, H * 0.026);
    ctx.restore();
  }
  ctx.restore();
  // range ring
  ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 6]);
  ctx.beginPath(); ctx.arc(ox, oy, range / 2 * ppn, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke(); ctx.setLineDash([]);
  txt(ctx, `${range / 2}NM`, ox - range / 2 * ppn * 0.72, oy - range / 2 * ppn * 0.72, H * 0.026);
  // ownship
  ctx.save(); ctx.translate(ox, oy); ctx.fillStyle = WHITE; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(3, -4); ctx.lineTo(14, 2); ctx.lineTo(14, 5); ctx.lineTo(3, 2); ctx.lineTo(2, 10); ctx.lineTo(6, 13); ctx.lineTo(6, 15); ctx.lineTo(0, 13); ctx.lineTo(-6, 15); ctx.lineTo(-6, 13); ctx.lineTo(-2, 10); ctx.lineTo(-3, 2); ctx.lineTo(-14, 5); ctx.lineTo(-14, 2); ctx.lineTo(-3, -4); ctx.closePath(); ctx.stroke(); ctx.fill();
  ctx.restore();
  // map orientation and range labels
  ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(mx + mw - W * 0.13, my + 4, W * 0.125, H * 0.04);
  plain(ctx, 'TRACK UP', mx + mw - W * 0.068, my + 4 + H * 0.02, H * 0.024);
  ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(mx + mw - W * 0.09, my + mh - H * 0.05, W * 0.085, H * 0.042);
  plain(ctx, `${range}NM`, mx + mw - W * 0.048, my + mh - H * 0.03, H * 0.026);
  // page group indicator
  ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(mx + 4, my + 4, W * 0.24, H * 0.04);
  plain(ctx, 'MAP - NAVIGATION MAP', mx + 4 + W * 0.12, my + 4 + H * 0.02, H * 0.022);
  ctx.restore();
  // ---- EIS strip
  drawEIS(ctx, W, H, s);
  softkeys(ctx, W, H, MFD_SOFTKEYS, ['MAP']);
  ctx.restore();
}

// Representative DA42 NG (AE300) EIS ranges. [min, max, bands[[from, to, color]]]
const C = { g: '#16c43c', y: '#f2c400', r: '#e0251c', w: '#ffffff' };
export const EIS_SCALES = {
  ff: { label: 'FFLOW GPH', min: 0, max: 10, bands: [[0, 10, C.g]], dp: 1 },
  oilP: { label: 'OIL PRES', min: 0, max: 8, bands: [[0, 1, C.r], [1, 2.5, C.y], [2.5, 5.2, C.g], [5.2, 6.5, C.y], [6.5, 8, C.r]], dp: 1 },
  oilT: { label: 'OIL TEMP', min: -40, max: 160, bands: [[-40, -30, C.r], [-30, 50, C.y], [50, 125, C.g], [125, 140, C.y], [140, 160, C.r]], dp: 0 },
  cool: { label: 'COOLANT TEMP', min: -40, max: 120, bands: [[-40, -30, C.r], [-30, 60, C.y], [60, 95, C.g], [95, 105, C.y], [105, 120, C.r]], dp: 0 },
  gbox: { label: 'GEARBOX TEMP', min: -40, max: 140, bands: [[-40, -30, C.r], [-30, 115, C.g], [115, 120, C.y], [120, 140, C.r]], dp: 0 },
  fuelT: { label: 'FUEL TEMP', min: -40, max: 90, bands: [[-40, -30, C.r], [-30, -20, C.y], [-20, 55, C.g], [55, 60, C.y], [60, 90, C.r]], dp: 0 },
  qty: { label: 'FUEL QTY GAL', min: 0, max: 25, bands: [[0, 1, C.r], [1, 5, C.y], [5, 25, C.g]], dp: 0 },
  volts: { label: 'VOLTS', min: 20, max: 34, bands: [[20, 24.1, C.r], [24.1, 25, C.y], [25, 32, C.g], [32, 34, C.r]], dp: 1 },
  amps: { label: 'AMPS', min: 0, max: 70, bands: [[0, 60, C.g], [60, 70, C.r]], dp: 0 },
};

function drawEIS(ctx, W, H, s) {
  const A = MFD_AREAS.eis;
  const x0 = W * A.x, y0 = H * A.y, w = W * A.w, h = H * A.h;
  ctx.fillStyle = '#000'; ctx.fillRect(x0, y0, w, h);
  ctx.fillStyle = '#5a5f66'; ctx.fillRect(x0 + w - 2, y0, 2, h);
  const eng = s.engines || [];
  const L = eng[0] || {}, R = eng[1] || {};
  const cxL = x0 + w * 0.27, cxR = x0 + w * 0.73;
  const ts = H * 0.024;
  // round dials: LOAD % and RPM
  const dial = (cy, label, key, max, bands, fmt) => {
    plain(ctx, label, x0 + w / 2, cy - w * 0.2 - H * 0.016, ts, WHITE);
    [[L, cxL, 'L'], [R, cxR, 'R']].forEach(([e, cx, sd]) => {
      const r = w * 0.16;
      const a0 = Math.PI * 0.8, a1 = Math.PI * 2.2;
      const ang = (v) => a0 + (Math.max(0, Math.min(max, v)) / max) * (a1 - a0);
      for (const [f, t, col] of bands) { ctx.strokeStyle = col; ctx.lineWidth = r * 0.16; ctx.beginPath(); ctx.arc(cx, cy, r, ang(f), ang(t)); ctx.stroke(); }
      const v = e[key] || 0;
      const a = ang(v);
      ctx.strokeStyle = WHITE; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * r * 1.08, cy + Math.sin(a) * r * 1.08); ctx.stroke();
      plain(ctx, sd, cx - r * 0.75, cy + r * 0.85, ts * 0.8, '#b8bec6');
      const live = e.master || e.run;
      plain(ctx, live ? fmt(v) : '---', cx, cy + r * 0.62, ts * 1.05, WHITE);
    });
  };
  dial(y0 + h * 0.105, 'LOAD %', 'load', 110, [[0, 100, C.g], [100, 110, C.r]], (v) => String(Math.round(v)));
  dial(y0 + h * 0.275, 'RPM', 'rpm', 2600, [[0, 2300, C.g], [2300, 2500, C.y], [2500, 2600, C.r]], (v) => String(Math.round(v / 10) * 10));
  // horizontal scales with L (above) and R (below) pointers
  const keys = ['ff', 'oilP', 'oilT', 'cool', 'gbox', 'fuelT', 'qty', 'volts', 'amps'];
  const top = y0 + h * 0.355, step = (h * 0.64) / keys.length;
  keys.forEach((k, i) => {
    const sc = EIS_SCALES[k];
    const yy = top + step * (i + 0.5);
    plain(ctx, sc.label, x0 + w / 2, yy - step * 0.36, ts * 0.74, WHITE);
    const bx = x0 + w * 0.2, bw = w * 0.6, bh = step * 0.12;
    const vx = (v) => bx + ((Math.max(sc.min, Math.min(sc.max, v)) - sc.min) / (sc.max - sc.min)) * bw;
    for (const [f, t, col] of sc.bands) { ctx.fillStyle = col; ctx.fillRect(vx(f), yy - bh / 2, vx(t) - vx(f), bh); }
    const fmtv = (e) => {
      const live = k === 'volts' || k === 'qty' ? s.on : e.master || e.run;
      return live ? (e[k] ?? 0).toFixed(sc.dp) : '---';
    };
    plain(ctx, fmtv(L), x0 + w * 0.1, yy, ts * 0.78, WHITE);
    plain(ctx, fmtv(R), x0 + w * 0.9, yy, ts * 0.78, WHITE);
    [[L, -1, 'L'], [R, 1, 'R']].forEach(([e, d, sd]) => {
      if (!(e.master || e.run || k === 'volts' || k === 'qty')) return;
      const px2 = vx(e[k] ?? sc.min);
      ctx.fillStyle = WHITE; ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(px2, yy + d * bh * 0.5); ctx.lineTo(px2 - step * 0.09, yy + d * step * 0.24); ctx.lineTo(px2 + step * 0.09, yy + d * step * 0.24); ctx.closePath(); ctx.fill(); ctx.stroke();
      plain(ctx, sd, px2, yy + d * step * 0.18, step * 0.12, '#000');
    });
  });
}

// ---------------------------------------------------------------------- GDU 1040 bezel
// Positions in fractions of the bezel (x across, y down). Screen opening and controls.
export const GDU = {
  w: 0.34, h: 0.235,
  screen: { x: 0.19, y: 0.06, w: 0.62, h: 0.672 },
  knobs: [
    { id: 'navVol', x: 0.095, y: 0.085, r: 0.024, label: 'NAV', small: true },
    { id: 'nav', x: 0.095, y: 0.29, r: 0.034, label: 'NAV', dual: true },
    { id: 'hdg', x: 0.095, y: 0.44, r: 0.028, label: 'HDG' },
    { id: 'alt', x: 0.095, y: 0.9, r: 0.034, label: 'ALT', dual: true },
    { id: 'comVol', x: 0.905, y: 0.085, r: 0.024, label: 'COM', small: true },
    { id: 'com', x: 0.905, y: 0.29, r: 0.034, label: 'COM', dual: true },
    { id: 'crs', x: 0.905, y: 0.44, r: 0.034, label: 'CRS  BARO', dual: true },
    { id: 'range', x: 0.905, y: 0.56, r: 0.026, label: 'RANGE', joy: true },
    { id: 'fms', x: 0.905, y: 0.9, r: 0.036, label: 'FMS', dual: true },
  ],
  keys: [
    { id: 'navSwap', x: 0.095, y: 0.18, t: '↔' },
    { id: 'comSwap', x: 0.905, y: 0.18, t: '↔' },
    { id: 'direct', x: 0.865, y: 0.67, t: 'D→' }, { id: 'menu', x: 0.945, y: 0.67, t: 'MENU' },
    { id: 'fpl', x: 0.865, y: 0.735, t: 'FPL' }, { id: 'proc', x: 0.945, y: 0.735, t: 'PROC' },
    { id: 'clr', x: 0.865, y: 0.8, t: 'CLR' }, { id: 'ent', x: 0.945, y: 0.8, t: 'ENT' },
  ],
  // GFC 700 autopilot keys on the left side of the bezel
  ap: [['AP', 'FD'], ['HDG', 'ALT'], ['NAV', 'VNV'], ['APR', 'BC'], ['VS', 'FLC'], ['UP', 'DN']].flatMap(([a, b], i) => [
    { id: `ap-${a}`, x: 0.06, y: 0.515 + i * 0.05, t: a }, { id: `ap-${b}`, x: 0.13, y: 0.515 + i * 0.05, t: b },
  ]),
  softkeyY: 0.795,
};
export const AP_AREA = { x: 0.02, y: 0.5, w: 0.15, h: 0.33 };
export const SOFTKEY_AREA = { x: 0.185, y: 0.765, w: 0.63, h: 0.065 };

export function drawBezel(ctx, W, H, s) {
  // moulded dark-grey bezel with a slight sheen
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#3a3e44'); g.addColorStop(0.5, '#2c2f34'); g.addColorStop(1, '#25282c');
  ctx.fillStyle = g; rrect(ctx, 0, 0, W, H, H * 0.04); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 3; rrect(ctx, 2, 2, W - 4, H - 4, H * 0.04); ctx.stroke();
  const sc = GDU.screen;
  ctx.fillStyle = '#050607'; rrect(ctx, W * sc.x - 4, H * sc.y - 4, W * sc.w + 8, H * sc.h + 8, 6); ctx.fill();
  const legend = (t, x, y, px, col = '#e9ecef') => { fnt(ctx, px, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = col; ctx.fillText(t, x, y); };
  const lit = s.night && s.backlight;
  const ink = lit ? '#fff2d6' : '#e9ecef';
  // knob recesses and legends (the knobs themselves are 3D)
  for (const k of GDU.knobs) {
    ctx.fillStyle = '#151719'; ctx.beginPath(); ctx.arc(W * k.x, H * k.y, W * k.r * 1.18, 0, Math.PI * 2); ctx.fill();
    const ly = k.y < 0.15 ? H * (k.y + 0.075) : H * (k.y - 0.085);
    legend(k.label, W * k.x, ly, H * 0.028, ink);
  }
  // keys
  const key = (k, w = 0.062, h = 0.045) => {
    const x = W * k.x, y = H * k.y, kw = W * w, kh = H * h;
    ctx.fillStyle = '#121416'; rrect(ctx, x - kw / 2 - 2, y - kh / 2 - 2, kw + 4, kh + 4, 5); ctx.fill();
    const kg = ctx.createLinearGradient(0, y - kh / 2, 0, y + kh / 2); kg.addColorStop(0, '#4a4f56'); kg.addColorStop(1, '#2e3237');
    ctx.fillStyle = kg; rrect(ctx, x - kw / 2, y - kh / 2, kw, kh, 4); ctx.fill();
    legend(k.t, x, y + 1, kh * 0.5, ink);
  };
  GDU.keys.forEach((k) => key(k));
  GDU.ap.forEach((k) => key(k, 0.06, 0.042));
  legend('GARMIN', W * 0.5, H * 0.955, H * 0.032, '#c8ccd1');
  // softkeys under the screen
  const kw = (W * sc.w) / 12;
  for (let i = 0; i < 12; i++) key({ x: (W * sc.x + kw * (i + 0.5)) / W, y: GDU.softkeyY, t: '' }, (kw * 0.78) / W, 0.04);
}

// ---------------------------------------------------------------------- standby instruments
function dialFace(ctx, W, H) {
  ctx.fillStyle = '#16181b'; rrect(ctx, 0, 0, W, H, W * 0.08); ctx.fill();
  for (const [sx, sy] of [[0.1, 0.1], [0.9, 0.1], [0.1, 0.9], [0.9, 0.9]]) {
    ctx.fillStyle = '#3c4148'; ctx.beginPath(); ctx.arc(W * sx, H * sy, W * 0.035, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#050505'; ctx.beginPath(); ctx.arc(W / 2, H / 2, W * 0.44, 0, Math.PI * 2); ctx.fill();
}
const nightTint = (s, col) => (s.night ? (s.backlight ? col : '#5b5b5b') : col);

export function drawStbyASI(ctx, W, H, s) {
  dialFace(ctx, W, H);
  const cx = W / 2, cy = H / 2, r = W * 0.4;
  const max = 220, min = 40;
  // 40 kt at the top-left start, sweeping ~330°
  const ang = (v) => -Math.PI / 2 + ((Math.max(min * 0.6, Math.min(max, v)) - min * 0.6) / (max - min * 0.6)) * Math.PI * 1.85;
  const arc = (a, b, col, rad, wid) => { ctx.strokeStyle = col; ctx.lineWidth = wid; ctx.beginPath(); ctx.arc(cx, cy, rad, ang(a), ang(b)); ctx.stroke(); };
  arc(SPEEDS.white[0], SPEEDS.white[1], '#f2f2f2', r * 0.82, r * 0.07);
  arc(SPEEDS.green[0], SPEEDS.green[1], '#1dbb3c', r * 0.92, r * 0.09);
  arc(SPEEDS.yellow[0], SPEEDS.yellow[1], '#f2c400', r * 0.92, r * 0.09);
  const radial = (v, col) => { const a = ang(v); ctx.strokeStyle = col; ctx.lineWidth = r * 0.05; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r * 0.78, cy + Math.sin(a) * r * 0.78); ctx.lineTo(cx + Math.cos(a) * r * 1.0, cy + Math.sin(a) * r * 1.0); ctx.stroke(); };
  radial(SPEEDS.vne, '#e0251c'); radial(SPEEDS.vmca, '#e0251c'); radial(SPEEDS.vyse, '#2a8cff');
  const ink = nightTint(s, '#f4f4f0');
  for (let v = 40; v <= 220; v += 10) {
    const a = ang(v);
    ctx.strokeStyle = ink; ctx.lineWidth = v % 20 ? 1.5 : 2.5;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r * (v % 20 ? 0.8 : 0.74), cy + Math.sin(a) * r * (v % 20 ? 0.8 : 0.74)); ctx.lineTo(cx + Math.cos(a) * r * 0.86, cy + Math.sin(a) * r * 0.86); ctx.stroke();
    if (v % 40 === 0) plain(ctx, String(v), cx + Math.cos(a) * r * 0.58, cy + Math.sin(a) * r * 0.58, r * 0.2, ink);
  }
  plain(ctx, 'KNOTS', cx, cy + r * 0.3, r * 0.14, ink, 'center', 'middle', 600);
  needle(ctx, cx, cy, ang(Math.max(min * 0.6, s.ias || 0)), r * 0.82);
}
export function drawStbyAlt(ctx, W, H, s) {
  dialFace(ctx, W, H);
  const cx = W / 2, cy = H / 2, r = W * 0.4;
  const ink = nightTint(s, '#f4f4f0');
  for (let i = 0; i < 50; i++) {
    const a = -Math.PI / 2 + (i / 50) * Math.PI * 2;
    ctx.strokeStyle = ink; ctx.lineWidth = i % 5 ? 1.5 : 2.5;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r * (i % 5 ? 0.88 : 0.8), cy + Math.sin(a) * r * (i % 5 ? 0.88 : 0.8)); ctx.lineTo(cx + Math.cos(a) * r * 0.96, cy + Math.sin(a) * r * 0.96); ctx.stroke();
    if (i % 5 === 0) plain(ctx, String(i / 5), cx + Math.cos(a) * r * 0.66, cy + Math.sin(a) * r * 0.66, r * 0.2, ink);
  }
  // Kollsman window
  ctx.fillStyle = '#000'; ctx.fillRect(cx + r * 0.22, cy - r * 0.1, r * 0.5, r * 0.2);
  plain(ctx, s.baroStby || '29.92', cx + r * 0.47, cy, r * 0.13, ink);
  const alt = s.alt || 0;
  needle(ctx, cx, cy, -Math.PI / 2 + ((alt / 10000) % 1) * Math.PI * 2, r * 0.45, 0.06, '#cfd3d6');
  needle(ctx, cx, cy, -Math.PI / 2 + ((alt / 1000) % 10) / 10 * Math.PI * 2, r * 0.5, 0.09);
  needle(ctx, cx, cy, -Math.PI / 2 + ((alt % 1000) / 1000) * Math.PI * 2, r * 0.86, 0.05);
}
function needle(ctx, cx, cy, a, len, wid = 0.05, col = '#f4f4f0') {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(-len * 0.15, -len * wid); ctx.lineTo(len, 0); ctx.lineTo(-len * 0.15, len * wid); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(0, 0, len * 0.08 + 3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
export function drawStbyAtt(ctx, W, H, s) {
  dialFace(ctx, W, H);
  const cx = W / 2, cy = H / 2, r = W * 0.42;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
  ctx.translate(cx, cy); ctx.rotate(-(s.bank || 0) * Math.PI / 180); ctx.translate(0, (s.pitch || 0) * r * 0.045);
  ctx.fillStyle = '#2d7fd6'; ctx.fillRect(-W, -W, W * 2, W);
  ctx.fillStyle = '#6b4320'; ctx.fillRect(-W, 0, W * 2, W);
  ctx.fillStyle = '#fff'; ctx.fillRect(-W, -1.5, W * 2, 3);
  for (const p of [-20, -10, 10, 20]) { const y = -p * r * 0.045; ctx.fillRect(-r * (Math.abs(p) === 10 ? 0.25 : 0.4), y - 1, r * (Math.abs(p) === 10 ? 0.5 : 0.8), 2); }
  ctx.restore();
  // fixed bank marks and the orange aircraft symbol
  ctx.save(); ctx.translate(cx, cy);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
  for (const a of [-60, -30, -20, -10, 0, 10, 20, 30, 60]) { const ra = a * Math.PI / 180; ctx.beginPath(); ctx.moveTo(Math.sin(ra) * r * 0.86, -Math.cos(ra) * r * 0.86); ctx.lineTo(Math.sin(ra) * r * 0.98, -Math.cos(ra) * r * 0.98); ctx.stroke(); }
  ctx.fillStyle = '#ff8c1a';
  ctx.fillRect(-r * 0.55, -2.5, r * 0.38, 5); ctx.fillRect(r * 0.17, -2.5, r * 0.38, 5);
  ctx.beginPath(); ctx.arc(0, 0, r * 0.05, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // power-off flag when the gyro has no power
  if (!s.powered) {
    ctx.save(); ctx.translate(cx + r * 0.45, cy - r * 0.45); ctx.rotate(0.5);
    ctx.fillStyle = '#e0251c'; ctx.fillRect(-r * 0.28, -r * 0.1, r * 0.56, r * 0.2);
    plain(ctx, 'OFF', 0, 1, r * 0.14, '#fff');
    ctx.restore();
  }
  // emergency battery test / status lamp under the gauge
  ctx.fillStyle = s.onEmerg ? '#ffb000' : '#3a3a3a'; ctx.beginPath(); ctx.arc(W * 0.86, H * 0.86, W * 0.03, 0, Math.PI * 2); ctx.fill();
}
