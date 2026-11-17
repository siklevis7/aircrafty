// Procedural 737-800 flight deck. Local coordinates: floor at y = 0, +x forward,
// +z to the First Officer's side (right), captain at z ≈ -0.53.
// Each clickable zone is a mesh with userData.partId matching flightdeck-parts.js.
import * as THREE from 'three';
import { makeCanvas, canvasTexture, paintPanel, COLORS, drawLabel, rrect } from '../../core/panelcanvas.js';
import { FLAP_DETENTS } from './systems.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---- overhead panel layouts --------------------------------------------------------
const T = (label, extra = {}) => ({ t: 'toggle', label, ...extra });
const G = (label, extra = {}) => ({ t: 'guard', label, ...extra });
const K = (label, extra = {}) => ({ t: 'knob', label, ...extra });
const A = (text, color = 'amber', extra = {}) => ({ t: 'annun', text, color, ...extra });
const GA = (label, extra = {}) => ({ t: 'gauge', label, ...extra });
const B = (text, extra = {}) => ({ t: 'button', text, ...extra });

const LAYOUTS = {
  'fd-flight-controls': { title: 'FLIGHT CONTROL', rows: [[G('FLT CONTROL A', { on: true }), G('FLT CONTROL B', { on: true })], [A('LOW PRESS'), A('LOW PRESS')], [G('SPOILER A', { on: true }), G('SPOILER B', { on: true })], [G('ALTN FLAPS'), T('UP / DN')], [T('YAW DAMPER', { on: true }), A('YAW DAMPER')]] },
  'fd-nav-displays': { title: 'NAVIGATION / DISPLAYS', rows: [[K('VHF NAV'), K('IRS'), K('FMC'), K('DISPLAYS'), K('CONTROL')]] },
  'fd-fuel': { title: 'FUEL', rows: [[GA('FUEL TEMP'), A('VALVE\nOPEN', 'blue'), K('CROSSFEED'), A('VALVE\nOPEN', 'blue')], [T('AFT 1', { on: true }), T('FWD 1', { on: true }), T('CTR L'), T('CTR R'), T('FWD 2', { on: true }), T('AFT 2', { on: true })], [A('LOW\nPRESS'), A('LOW\nPRESS'), A('LOW\nPRESS'), A('LOW\nPRESS'), A('LOW\nPRESS'), A('LOW\nPRESS')]] },
  'fd-electrical': { title: 'ELECTRICAL', rows: [[GA('DC'), GA('AC')], [K('DC SEL'), G('BAT', { on: true }), K('AC SEL')], [A('TRANSFER\nBUS OFF'), A('SOURCE\nOFF'), A('TRANSFER\nBUS OFF')], [G('STANDBY\nPOWER', { on: true }), T('GRD PWR'), T('BUS XFR', { on: true })], [T('GEN 1'), T('APU GEN'), T('GEN 2')]] },
  'fd-apu': { title: 'APU', rows: [[GA('APU EGT'), A('MAINT', 'blue'), A('LOW OIL\nPRESS')], [A('FAULT'), A('OVER\nSPEED'), K('APU', { key: 'apu' })], [A('APU GEN\nOFF BUS', 'blue', { key: 'apuGen' })]] },
  'fd-cabin-signs': { title: 'CABIN / EQUIP', rows: [[T('EQUIP COOL\nSUPPLY'), T('EQUIP COOL\nEXHAUST')], [G('EMER EXIT\nLIGHTS', { on: true }), A('NOT\nARMED')], [T('NO SMOKING', { on: true }), T('FASTEN BELTS', { on: true })], [B('ATTEND'), B('GRD CALL')]] },
  'fd-window-probe-heat': { title: 'WINDOW / PROBE HEAT', rows: [[A('ON', 'green', { lit: true }), A('ON', 'green', { lit: true }), A('ON', 'green', { lit: true }), A('ON', 'green', { lit: true })], [T('L SIDE', { on: true }), T('L FWD', { on: true }), T('R FWD', { on: true }), T('R SIDE', { on: true })], [T('PROBE A'), T('TEST'), T('PROBE B')], [A('CAPT\nPITOT'), A('L ELEV\nPITOT'), A('F/O\nPITOT'), A('TEMP\nPROBE')]] },
  'fd-anti-ice': { title: 'ANTI-ICE', rows: [[A('WING\nANTI-ICE', 'blue'), A('COWL\nANTI-ICE'), A('COWL\nANTI-ICE')], [T('WING'), T('ENG 1'), T('ENG 2')]] },
  'fd-hydraulics': { title: 'HYDRAULIC PUMPS', rows: [[A('OVER\nHEAT'), A('LOW\nPRESS'), A('LOW\nPRESS'), A('OVER\nHEAT')], [T('ELEC 2', { on: true }), T('ENG 1', { on: true }), T('ENG 2', { on: true }), T('ELEC 1', { on: true })], [A('LOW\nPRESS'), A('LOW\nPRESS'), A('LOW\nPRESS'), A('LOW\nPRESS')]] },
  'fd-air-conditioning': { title: 'AIR CONDITIONING', rows: [[GA('TEMP'), K('TEMP SEL')], [K('CONT CAB'), K('FWD CAB'), K('AFT CAB')], [T('L RECIRC', { on: true }), T('R RECIRC', { on: true })]] },
  'fd-bleed-air': { title: 'BLEED AIR', rows: [[GA('DUCT PRESS'), A('DUAL\nBLEED')], [A('PACK'), A('WING-BODY\nOVHT'), A('BLEED\nTRIP OFF')], [T('L PACK', { on: true }), K('ISOLATION'), T('R PACK', { on: true })], [T('BLEED 1', { on: true }), T('APU BLEED'), T('BLEED 2', { on: true })]] },
  'fd-pressurization': { title: 'PRESSURIZATION', rows: [[{ t: 'screen', text: '35000', label: 'FLT ALT' }, { t: 'screen', text: '00000', label: 'LAND ALT' }], [GA('VALVE'), K('MODE'), T('MAN')]] },
  'fd-exterior-lights': { title: '', rows: [[T('L LANDING', { key: 'light.landing' }), T('R LANDING', { key: 'light.landing' }), T('L TURNOFF', { key: 'light.turnoff' }), T('R TURNOFF', { key: 'light.turnoff' }), T('TAXI', { key: 'light.taxi' })]] },
  'fd-exterior-lights-2': { title: '', rows: [[T('LOGO', { key: 'light.logo' }), T('POSITION', { key: 'light.nav' }), T('STROBE', { key: 'light.strobe' }), T('ANTI COLL', { key: 'light.beacon' }), T('WING', { key: 'light.wing' })]] },
  'fd-engine-start': { title: 'ENGINE START', rows: [[K('ENG 1', { angle: 0 }), K('IGN', { angle: 0 }), K('ENG 2', { angle: 0 })]] },
  'fd-irs': { title: 'IRS', rows: [[A('ALIGN', 'white'), A('ON DC'), A('ALIGN', 'white'), A('ON DC')], [A('FAULT'), A('DC FAIL'), A('FAULT'), A('DC FAIL')], [K('L IRS', { angle: 0.5 }), K('R IRS', { angle: 0.5 })]] },
  'fd-le-devices': { title: 'LE DEVICES', rows: [[A('', 'green', { key: 'le', i: 0 }), A('', 'green', { key: 'le', i: 1 }), A('', 'green', { key: 'le', i: 2 }), A('', 'green', { key: 'le', i: 3 }), A('', 'green', { key: 'le', i: 4 }), A('', 'green', { key: 'le', i: 5 })], [A('', 'green', { key: 'le', i: 6 }), A('', 'green', { key: 'le', i: 7 }), A('', 'green', { key: 'le', i: 8 }), A('', 'green', { key: 'le', i: 9 }), A('', 'green', { key: 'le', i: 10 }), A('', 'green', { key: 'le', i: 11 })]] },
  'fd-engine-eec': { title: 'ENGINE', rows: [[A('REVERSER'), A('REVERSER')], [A('ENGINE\nCONTROL'), A('ENGINE\nCONTROL')], [B('EEC ON'), B('EEC ON')]] },
  'fd-efis-panels': { title: 'EFIS', rows: [[K('MINS'), K('BARO')], [K('MODE'), K('RANGE')], [B('WXR'), B('STA'), B('WPT'), B('ARPT'), B('TERR')]] },
  'fd-radios': { title: 'RADIO / AUDIO', rows: [[{ t: 'screen', text: '118.70', color: COLORS.white }, { t: 'screen', text: '121.50', color: COLORS.white }], [{ t: 'screen', text: '2000', color: COLORS.white, label: 'ATC' }, K('TCAS')], [B('VHF1'), B('VHF2'), B('PA'), B('INT')]] },
  'fd-fire-panel': { title: 'FIRE PROTECTION', rows: [[{ t: 'button', text: 'ENG 1', lit: '#b8231c' }, { t: 'button', text: 'APU', lit: '#b8231c' }, { t: 'button', text: 'ENG 2', lit: '#b8231c' }], [T('OVHT/FIRE TEST'), B('BELL CUTOUT'), T('EXT TEST')]] },
  'fd-trim-panel': { title: 'TRIM', rows: [[K('RUDDER TRIM', { angle: 0 }), T('AILERON'), T('AILERON')]] },
};

// ---- displays -----------------------------------------------------------------------
function drawPFD(ctx, W, H, s) {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const cx = W * 0.5, cy = H * 0.5, aw = W * 0.5, ah = H * 0.56;
  ctx.save();
  rrect(ctx, cx - aw / 2, cy - ah / 2, aw, ah, W * 0.03); ctx.clip();
  const pitchPx = (s.pitch * 8) * (ah / 40);
  ctx.translate(cx, cy);
  ctx.rotate((-s.bank * Math.PI) / 180);
  ctx.fillStyle = '#2f80d1'; ctx.fillRect(-W, -H * 2 + pitchPx, W * 2, H * 2);
  ctx.fillStyle = '#8b5a2b'; ctx.fillRect(-W, pitchPx, W * 2, H * 2);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = W * 0.006;
  ctx.beginPath(); ctx.moveTo(-W, pitchPx); ctx.lineTo(W, pitchPx); ctx.stroke();
  for (let p = -20; p <= 20; p += 2.5) {
    if (p === 0) continue;
    const y = pitchPx - p * (ah / 40);
    const len = p % 10 === 0 ? aw * 0.28 : p % 5 === 0 ? aw * 0.16 : aw * 0.08;
    ctx.beginPath(); ctx.moveTo(-len / 2, y); ctx.lineTo(len / 2, y); ctx.stroke();
  }
  ctx.restore();
  // aircraft symbol
  ctx.fillStyle = '#000'; ctx.strokeStyle = '#fff'; ctx.lineWidth = W * 0.008;
  for (const sgn of [-1, 1]) { ctx.fillRect(cx + sgn * aw * 0.12 - (sgn < 0 ? aw * 0.18 : 0), cy - H * 0.01, aw * 0.18, H * 0.02); ctx.strokeRect(cx + sgn * aw * 0.12 - (sgn < 0 ? aw * 0.18 : 0), cy - H * 0.01, aw * 0.18, H * 0.02); }
  ctx.fillRect(cx - W * 0.012, cy - W * 0.012, W * 0.024, W * 0.024); ctx.strokeRect(cx - W * 0.012, cy - W * 0.012, W * 0.024, W * 0.024);
  // tapes
  const tape = (x, w, value, step, fmt) => {
    ctx.fillStyle = '#5b6168'; ctx.fillRect(x, cy - ah / 2, w, ah);
    ctx.fillStyle = '#fff'; ctx.font = `600 ${W * 0.042}px "JetBrains Mono", monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = -3; i <= 3; i++) {
      const v = Math.round(value / step) * step + i * step;
      if (v < 0) continue;
      ctx.fillText(fmt(v), x + w / 2, cy - (v - value) * (ah / (step * 7)));
    }
    ctx.fillStyle = '#000'; ctx.fillRect(x - W * 0.005, cy - H * 0.04, w + W * 0.01, H * 0.08);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = W * 0.005; ctx.strokeRect(x - W * 0.005, cy - H * 0.04, w + W * 0.01, H * 0.08);
    ctx.fillStyle = '#fff'; ctx.font = `700 ${W * 0.05}px "JetBrains Mono", monospace`;
    ctx.fillText(fmt(value), x + w / 2, cy + H * 0.002);
  };
  tape(W * 0.06, W * 0.14, s.speed, 20, (v) => String(v));
  tape(W * 0.79, W * 0.15, s.alt, 200, (v) => String(v));
  // heading arc
  ctx.fillStyle = '#5b6168';
  ctx.beginPath(); ctx.arc(cx, H * 1.12, H * 0.33, Math.PI * 1.2, Math.PI * 1.8); ctx.lineTo(cx, H * 1.12); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = `600 ${W * 0.04}px "JetBrains Mono", monospace`; ctx.textAlign = 'center';
  ctx.fillText(String(s.hdg).padStart(3, '0'), cx, H * 0.86);
  // FMA
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1;
  ctx.font = `600 ${W * 0.04}px "JetBrains Mono", monospace`; ctx.fillStyle = '#2bd46a';
  s.fma.forEach((m, i) => ctx.fillText(m, W * (0.25 + i * 0.25), H * 0.07));
  if (s.cmd) { ctx.fillStyle = '#2bd46a'; ctx.font = `700 ${W * 0.05}px "JetBrains Mono", monospace`; ctx.fillText('CMD', cx, H * 0.17); }
}

function drawND(ctx, W, H) {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const cx = W / 2, cy = H * 0.84, r = H * 0.66;
  ctx.strokeStyle = '#fff'; ctx.lineWidth = W * 0.005;
  ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI * 1.17, Math.PI * 1.83); ctx.stroke();
  ctx.setLineDash([W * 0.02, W * 0.02]);
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.5, Math.PI * 1.17, Math.PI * 1.83); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#fff'; ctx.font = `600 ${W * 0.04}px "JetBrains Mono", monospace`; ctx.textAlign = 'center';
  for (let d = -50; d <= 50; d += 10) {
    const a = (d * Math.PI) / 180;
    const x1 = cx + Math.sin(a) * r, y1 = cy - Math.cos(a) * r;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(cx + Math.sin(a) * r * 0.95, cy - Math.cos(a) * r * 0.95); ctx.stroke();
    if (d % 30 === 0) ctx.fillText(String(((360 + d) % 360) / 10), cx + Math.sin(a) * r * 0.86, cy - Math.cos(a) * r * 0.86);
  }
  // route
  ctx.strokeStyle = '#ff4fd8'; ctx.lineWidth = W * 0.008;
  const pts = [[cx, cy], [cx + W * 0.04, cy - H * 0.3], [cx - W * 0.1, cy - H * 0.52], [cx - W * 0.06, cy - H * 0.78]];
  ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
  ctx.fillStyle = '#ff4fd8'; ctx.font = `600 ${W * 0.038}px "JetBrains Mono", monospace`; ctx.textAlign = 'left';
  [['RW01', 1], ['ALPHA', 2], ['BRAVO', 3]].forEach(([n, i]) => { const [x, y] = pts[i]; ctx.fillText(n, x + W * 0.025, y); });
  // aircraft
  ctx.strokeStyle = '#fff'; ctx.lineWidth = W * 0.008;
  ctx.beginPath(); ctx.moveTo(cx, cy - H * 0.04); ctx.lineTo(cx - W * 0.03, cy + H * 0.03); ctx.lineTo(cx + W * 0.03, cy + H * 0.03); ctx.closePath(); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.font = `600 ${W * 0.04}px "JetBrains Mono", monospace`;
  ctx.fillText('GS  0  TAS  0', W * 0.04, H * 0.07);
  ctx.textAlign = 'center'; ctx.fillText('TRK 010 MAG', cx, H * 0.07);
  ctx.fillStyle = '#ff4fd8'; ctx.textAlign = 'right'; ctx.fillText('ALPHA', W * 0.96, H * 0.07);
}

function drawEngines(ctx, W, H, s) {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const dial = (x, y, r, frac, val, lab) => {
    ctx.strokeStyle = '#fff'; ctx.lineWidth = W * 0.006;
    ctx.beginPath(); ctx.arc(x, y, r, Math.PI * 0.75, Math.PI * 2.25); ctx.stroke();
    const a = Math.PI * 0.75 + frac * Math.PI * 1.5;
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, r, Math.PI * 0.75, a); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); ctx.stroke();
    ctx.fillStyle = '#000'; ctx.fillRect(x - r * 0.1, y - r * 0.62, r * 1.05, r * 0.42);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = W * 0.004; ctx.strokeRect(x - r * 0.1, y - r * 0.62, r * 1.05, r * 0.42);
    ctx.fillStyle = '#fff'; ctx.font = `600 ${r * 0.32}px "JetBrains Mono", monospace`; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(val, x + r * 0.9, y - r * 0.41);
    ctx.textAlign = 'center'; ctx.fillStyle = '#7fd3ff'; ctx.font = `600 ${r * 0.26}px "JetBrains Mono", monospace`;
    if (lab) ctx.fillText(lab, W / 2, y);
  };
  const r = W * 0.15;
  dial(W * 0.28, H * 0.25, r, s.n1 / 110, s.n1.toFixed(1), 'N1');
  dial(W * 0.72, H * 0.25, r, s.n1 / 110, s.n1.toFixed(1), '');
  dial(W * 0.28, H * 0.58, r * 0.8, s.egt / 1000, String(Math.round(s.egt)), 'EGT');
  dial(W * 0.72, H * 0.58, r * 0.8, s.egt / 1000, String(Math.round(s.egt)), '');
  if (s.rev) {
    ctx.font = `700 ${W * 0.05}px "JetBrains Mono", monospace`; ctx.fillStyle = s.rev === 'green' ? '#2bd46a' : '#ffb000';
    ctx.fillText('REV', W * 0.28, H * 0.09); ctx.fillText('REV', W * 0.72, H * 0.09);
  }
  ctx.fillStyle = '#fff'; ctx.font = `600 ${W * 0.042}px "JetBrains Mono", monospace`;
  ctx.fillText('FUEL', W / 2, H * 0.8);
  [['1', '3.9', 0.25], ['CTR', '6.2', 0.5], ['2', '3.9', 0.75]].forEach(([n, v, x]) => {
    ctx.fillStyle = '#7fd3ff'; ctx.fillText(n, W * x, H * 0.86); ctx.fillStyle = '#fff'; ctx.fillText(v, W * x, H * 0.93);
  });
}

function drawLowerDU(ctx, W, H) {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#7fd3ff'; ctx.font = `600 ${W * 0.06}px "JetBrains Mono", monospace`; ctx.textAlign = 'center';
  ctx.fillText('HYDRAULIC', W / 2, H * 0.12);
  ['A', 'B'].forEach((n, i) => {
    const x = W * (0.3 + i * 0.4);
    ctx.fillStyle = '#7fd3ff'; ctx.fillText(n, x, H * 0.3);
    ctx.fillStyle = '#fff'; ctx.fillText('3000', x, H * 0.48); ctx.fillText('100%', x, H * 0.66);
  });
  ctx.fillStyle = '#7fd3ff'; ctx.font = `600 ${W * 0.045}px "JetBrains Mono", monospace`;
  ctx.fillText('PRESS', W / 2, H * 0.48); ctx.fillText('QTY', W / 2, H * 0.66);
}

function drawISFD(ctx, W, H) {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#2f80d1'; ctx.fillRect(W * 0.2, H * 0.15, W * 0.6, H * 0.35);
  ctx.fillStyle = '#8b5a2b'; ctx.fillRect(W * 0.2, H * 0.5, W * 0.6, H * 0.35);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = W * 0.012; ctx.beginPath(); ctx.moveTo(W * 0.2, H * 0.5); ctx.lineTo(W * 0.8, H * 0.5); ctx.stroke();
  ctx.fillStyle = '#ffd400'; ctx.fillRect(W * 0.35, H * 0.49, W * 0.3, H * 0.025);
  ctx.fillStyle = '#fff'; ctx.font = `600 ${W * 0.09}px "JetBrains Mono", monospace`; ctx.textAlign = 'center';
  ctx.fillText('0', W * 0.1, H * 0.52); ctx.fillText('0', W * 0.9, H * 0.52); ctx.fillText('29.92', W * 0.5, H * 0.95);
}

function drawCDU(ctx, W, H) {
  ctx.fillStyle = '#3c4249'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#05080a'; ctx.fillRect(W * 0.12, H * 0.05, W * 0.76, H * 0.42);
  ctx.font = `600 ${W * 0.05}px "JetBrains Mono", monospace`; ctx.textAlign = 'left';
  const lines = [['     IDENT', '#fff'], [' MODEL', '#9aa'], [' 737-800W', '#2bd46a'], [' ENG RATING', '#9aa'], [' 26K', '#2bd46a'], [' NAV DATA', '#9aa'], [' ---------', '#fff'], ['<INDEX   POS INIT>', '#fff']];
  lines.forEach(([t, c], i) => { ctx.fillStyle = c; ctx.fillText(t, W * 0.15, H * (0.1 + i * 0.045)); });
  ctx.fillStyle = '#d9dcd8';
  for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) {
    rrect(ctx, W * (0.1 + c * 0.135), H * (0.52 + r * 0.075), W * 0.11, H * 0.055, W * 0.01); ctx.fill();
  }
  for (let i = 0; i < 6; i++) { ctx.fillRect(W * 0.03, H * (0.09 + i * 0.06), W * 0.06, H * 0.03); ctx.fillRect(W * 0.91, H * (0.09 + i * 0.06), W * 0.06, H * 0.03); }
}

function drawMCP(ctx, W, H) {
  ctx.fillStyle = '#40464d'; ctx.fillRect(0, 0, W, H);
  const win = (x, w, text, lab) => {
    ctx.fillStyle = '#07090b'; ctx.fillRect(W * x, H * 0.2, W * w, H * 0.28);
    ctx.fillStyle = '#ffb21a'; ctx.font = `600 ${H * 0.2}px "JetBrains Mono", monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, W * (x + w / 2), H * 0.34);
    drawLabel(ctx, lab, W * (x + w / 2), H * 0.1, H * 0.1, '#fff');
  };
  win(0.02, 0.06, '010', 'COURSE');
  win(0.15, 0.08, '250', 'IAS/MACH');
  win(0.37, 0.06, '010', 'HEADING');
  win(0.55, 0.09, '10000', 'ALTITUDE');
  win(0.7, 0.08, '', 'VERT SPEED');
  win(0.92, 0.06, '010', 'COURSE');
  const btn = (x, text) => {
    ctx.fillStyle = '#d6d9d5'; rrect(ctx, W * x, H * 0.62, W * 0.045, H * 0.24, H * 0.03); ctx.fill();
    drawLabel(ctx, text, W * (x + 0.0225), H * 0.74, H * 0.075, '#222');
  };
  [['N1', 0.1], ['SPEED', 0.15], ['LVL CHG', 0.2], ['VNAV', 0.25], ['HDG SEL', 0.31], ['LNAV', 0.36], ['VOR LOC', 0.41], ['APP', 0.46], ['ALT HLD', 0.55], ['V/S', 0.6], ['CMD A', 0.79], ['CMD B', 0.84]]
    .forEach(([t, x]) => btn(x, t));
  drawLabel(ctx, 'A/T ARM', W * 0.1, H * 0.92, H * 0.08, '#fff');
  drawLabel(ctx, 'F/D', W * 0.04, H * 0.62, H * 0.08, '#fff');
  drawLabel(ctx, 'F/D', W * 0.96, H * 0.62, H * 0.08, '#fff');
}

function drawMasterCaution(ctx, W, H) {
  ctx.fillStyle = '#2d3238'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#5c0d0a'; rrect(ctx, W * 0.08, H * 0.08, W * 0.38, H * 0.38, W * 0.03); ctx.fill();
  drawLabel(ctx, 'FIRE\nWARN', W * 0.27, H * 0.27, H * 0.11, 'rgba(255,90,80,0.65)');
  ctx.fillStyle = '#4d3500'; rrect(ctx, W * 0.54, H * 0.08, W * 0.38, H * 0.38, W * 0.03); ctx.fill();
  drawLabel(ctx, 'MASTER\nCAUTION', W * 0.73, H * 0.27, H * 0.1, 'rgba(255,190,60,0.65)');
  const six = ['FLT CONT', 'IRS', 'FUEL', 'ELEC', 'APU', 'OVHT/DET'];
  six.forEach((t, i) => {
    const x = W * (0.08 + (i % 3) * 0.29), y = H * (0.56 + Math.floor(i / 3) * 0.2);
    ctx.fillStyle = '#1d2024'; ctx.fillRect(x, y, W * 0.26, H * 0.16);
    drawLabel(ctx, t, x + W * 0.13, y + H * 0.08, H * 0.07, 'rgba(255,190,60,0.35)');
  });
}

function drawGearPanel(ctx, W, H, s) {
  ctx.fillStyle = '#5f6873'; ctx.fillRect(0, 0, W, H);
  const light = (x, y, w, h, on, color, text) => {
    ctx.fillStyle = on ? color : '#1e2125'; ctx.fillRect(x, y, w, h);
    drawLabel(ctx, text, x + w / 2, y + h / 2, h * 0.28, on ? '#111' : 'rgba(255,255,255,0.25)');
  };
  const g = s.gear;
  ['LEFT\nGEAR', 'NOSE\nGEAR', 'RIGHT\nGEAR'].forEach((t, i) => {
    const x = W * (0.06 + i * 0.31);
    light(x, H * 0.04, W * 0.26, H * 0.09, g === 'red', '#ff3b2f', t);
    light(x, H * 0.15, W * 0.26, H * 0.09, g === 'green', '#2bd46a', t);
  });
  // flap indicator
  const cx = W * 0.5, cy = H * 0.5, r = W * 0.3;
  ctx.fillStyle = '#0b0d10'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff'; ctx.lineWidth = W * 0.01;
  FLAP_DETENTS.forEach((d, i) => {
    const a = -Math.PI * 0.6 + (i / (FLAP_DETENTS.length - 1)) * Math.PI * 1.45;
    ctx.beginPath(); ctx.moveTo(cx + Math.sin(a) * r * 0.8, cy - Math.cos(a) * r * 0.8); ctx.lineTo(cx + Math.sin(a) * r * 0.95, cy - Math.cos(a) * r * 0.95); ctx.stroke();
    drawLabel(ctx, d === 0 ? '0' : String(d), cx + Math.sin(a) * r * 0.62, cy - Math.cos(a) * r * 0.62, r * 0.17, '#fff');
  });
  const idx = (() => { for (let i = 0; i < FLAP_DETENTS.length - 1; i++) { if (s.flap <= FLAP_DETENTS[i + 1]) return i + (s.flap - FLAP_DETENTS[i]) / (FLAP_DETENTS[i + 1] - FLAP_DETENTS[i]); } return FLAP_DETENTS.length - 1; })();
  const a = -Math.PI * 0.6 + (idx / (FLAP_DETENTS.length - 1)) * Math.PI * 1.45;
  ctx.strokeStyle = '#fff'; ctx.lineWidth = W * 0.02;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.sin(a) * r * 0.85, cy - Math.cos(a) * r * 0.85); ctx.stroke();
  drawLabel(ctx, 'FLAPS', cx, cy + r * 0.45, r * 0.16, '#fff');
  light(W * 0.06, H * 0.84, W * 0.42, H * 0.07, s.leTransit, '#ffb000', 'LE FLAPS\nTRANSIT');
  light(W * 0.52, H * 0.84, W * 0.42, H * 0.07, s.leExt, '#2bd46a', 'LE FLAPS\nEXT');
  drawLabel(ctx, 'AUTO BRAKE', W * 0.5, H * 0.97, H * 0.03, '#fff');
}

// ---- builder -------------------------------------------------------------------------
export function buildFlightDeck(systems) {
  const root = new THREE.Group();
  root.name = 'b738-flightdeck';
  const mats = {
    wall: new THREE.MeshStandardMaterial({ color: '#c3c5c0', roughness: 0.85 }),
    trim: new THREE.MeshStandardMaterial({ color: '#8e9398', roughness: 0.7 }),
    glare: new THREE.MeshStandardMaterial({ color: '#1f2226', roughness: 0.95 }),
    floor: new THREE.MeshStandardMaterial({ color: '#3a3e44', roughness: 0.95 }),
    panel: new THREE.MeshStandardMaterial({ color: COLORS.panel, roughness: 0.75 }),
    seat: new THREE.MeshStandardMaterial({ color: '#2c3036', roughness: 0.9 }),
    metal: new THREE.MeshStandardMaterial({ color: '#c9ced3', roughness: 0.35, metalness: 0.7 }),
    black: new THREE.MeshStandardMaterial({ color: '#111316', roughness: 0.6 }),
    glass: new THREE.MeshBasicMaterial({ color: '#bcd8f0', transparent: true, opacity: 0.08, depthWrite: false }),
  };
  const box = (w, h, d, mat, pos, parent = root) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(...pos);
    parent.add(m);
    return m;
  };

  // sky dome
  {
    const c = document.createElement('canvas'); c.width = 4; c.height = 256;
    const g = c.getContext('2d'); const grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, '#3f7fc4'); grd.addColorStop(0.45, '#a9cbe8'); grd.addColorStop(0.5, '#e4ecf1'); grd.addColorStop(0.52, '#7b8085'); grd.addColorStop(1, '#4d5257');
    g.fillStyle = grd; g.fillRect(0, 0, 4, 256);
    const sky = new THREE.Mesh(new THREE.SphereGeometry(80, 32, 16), new THREE.MeshBasicMaterial({ map: canvasTexture(c), side: THREE.BackSide, fog: false }));
    sky.position.y = 1.2;
    sky.raycast = () => {};
    root.add(sky);
  }
  const amb = new THREE.HemisphereLight(0xffffff, 0x666a70, 0.9);
  root.add(amb);
  const dome = new THREE.PointLight(0xfff3e0, 1.2, 4, 1.5);
  dome.position.set(-0.3, 1.9, 0);
  root.add(dome);

  // shell
  box(2.3, 0.04, 2.1, mats.floor, [-0.15, -0.02, 0]);
  box(1.6, 0.04, 1.9, mats.wall, [-0.5, 2.04, 0]);
  for (const s of [-1, 1]) {
    box(2.1, 1.0, 0.04, mats.wall, [-0.2, 0.5, s * 1.04]);
    box(1.4, 0.45, 0.04, mats.wall, [-0.55, 1.25, s * 1.04]);
    box(2.1, 0.5, 0.04, mats.wall, [-0.2, 1.8, s * 1.04]);
    box(0.08, 0.5, 0.04, mats.trim, [0.86, 1.25, s * 1.04]);
    const sideGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.46), mats.glass);
    sideGlass.position.set(0.5, 1.27, s * 1.035); sideGlass.rotation.y = Math.PI / 2; sideGlass.raycast = () => {};
    root.add(sideGlass);
  }
  box(0.04, 2.1, 2.1, mats.wall, [-1.25, 1.0, 0]);
  // windshield frame + glass
  const wsBottom = V(1.12, 1.06, 0), wsTop = V(0.72, 1.66, 0);
  const wsMid = wsBottom.clone().add(wsTop).multiplyScalar(0.5);
  const wsLen = wsBottom.distanceTo(wsTop);
  const wsAngle = Math.atan2(wsTop.y - wsBottom.y, wsTop.x - wsBottom.x);
  for (const z of [0, -0.56, 0.56, -1.0, 1.0]) {
    const post = box(z === 0 ? 0.035 : 0.05, wsLen, 0.045, mats.glare, [wsMid.x, wsMid.y, z]);
    post.rotation.z = wsAngle - Math.PI / 2;
  }
  // window sill along the top of the glareshield and the header
  box(0.05, 0.035, 2.06, mats.glare, [wsBottom.x - 0.02, wsBottom.y + 0.01, 0]);
  box(0.05, 0.035, 2.06, mats.glare, [wsTop.x + 0.01, wsTop.y, 0]);
  const wsGlass = new THREE.Mesh(new THREE.PlaneGeometry(2.0, wsLen), mats.glass);
  wsGlass.position.copy(wsMid);
  wsGlass.lookAt(wsMid.clone().add(V(-Math.sin(wsAngle), Math.cos(wsAngle), 0)));
  wsGlass.raycast = () => {};
  root.add(wsGlass);
  box(0.7, 0.05, 2.06, mats.trim, [0.6, 1.98, 0]); // header above windshield

  // ---- zones helpers
  const zoneMeshes = [];
  const dynamic = [];
  const nightables = [];
  function facing(pos, dir) {
    const g = new THREE.Group();
    g.position.copy(pos);
    root.add(g);
    g.lookAt(pos.clone().add(dir.clone().normalize()));
    return g;
  }
  function zone(parent, partId, w, h, x, y, drawer, opts = {}) {
    const canvas = makeCanvas(w, h);
    const tex = canvasTexture(canvas);
    const overrides = {}; // local positions of switches that aren't linked to aircraft systems
    let controls = [];
    const redraw = (state) => {
      const ctx = canvas.getContext('2d');
      if (typeof drawer === 'function') drawer(ctx, canvas.width, canvas.height, state);
      else controls = paintPanel(canvas, resolveLayout(drawer, state, overrides));
      tex.needsUpdate = true;
    };
    const redrawNow = () => redraw(opts.state ? opts.state() : {});
    redraw(opts.state ? opts.state() : {});
    // Screens are self-lit only (black base color, full emissive) so colors stay true.
    const mat = new THREE.MeshStandardMaterial({
      map: opts.screen ? null : tex,
      color: opts.screen ? new THREE.Color('#000000') : new THREE.Color('#ffffff'),
      roughness: opts.screen ? 0.2 : 0.7, metalness: 0.05,
      emissive: opts.screen ? new THREE.Color('#d8d8d8') : new THREE.Color('#2a2a2a'), emissiveMap: tex,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h, 2, 2), mat);
    m.position.set(x, y, opts.z ?? 0.004);
    if (partId) { m.userData.partId = partId; m.userData.side = opts.side || 'C'; }
    parent.add(m);
    zoneMeshes.push(m);
    if (!opts.screen) nightables.push(m);

    if (typeof drawer !== 'function') {
      const OPERABLE = new Set(['toggle', 'guard', 'knob', 'button']);
      const hit = (uv) => {
        if (!uv) return null;
        const px = uv.x, py = 1 - uv.y;
        return controls.find((c) => OPERABLE.has(c.it.t) && ((px - c.x) / c.rx) ** 2 + ((py - c.y) / c.ry) ** 2 <= 1) || null;
      };
      const name = (c) => (c.it.label || c.it.text || '').replace(/\n/g, ' ');
      m.userData.hint = (uv) => {
        const c = hit(uv);
        if (!c) return null;
        const linked = c.it.key && c.it.key !== 'apuGen';
        return `${name(c)} · click to ${c.it.t === 'button' ? 'press' : c.it.t === 'knob' ? 'turn' : 'switch'}${linked ? ' (linked to aircraft)' : ''}`;
      };
      m.userData.interact = ({ uv }) => {
        const c = hit(uv);
        if (!c) return null;
        const id = `${c.ri},${c.ci}`;
        const key = c.it.key;
        if (key && key.startsWith('light.')) {
          const r = systems.set(key, !systems.get(key));
          return { handled: true, ok: r.ok, message: r.message };
        }
        if (key === 'apu') {
          const r = systems.set('apu', !systems.get('apu'));
          return { handled: true, ok: r.ok, message: r.message };
        }
        const o = (overrides[id] = overrides[id] || {});
        if (c.it.t === 'toggle' || c.it.t === 'guard') o.on = !(o.on ?? c.it.on ?? false);
        else if (c.it.t === 'knob') {
          const steps = [-0.8, 0, 0.8];
          const curA = o.angle ?? c.it.angle ?? -0.6;
          const i = steps.findIndex((s) => s > curA + 0.01);
          o.angle = i === -1 ? steps[0] : steps[i];
        } else if (c.it.t === 'button') {
          o.lit = c.it.lit ? null : '#e8e2c8';
          redrawNow();
          setTimeout(() => { delete o.lit; redrawNow(); }, 220);
          return { handled: true, ok: true };
        }
        redrawNow();
        return { handled: true, ok: true };
      };
    }
    if (opts.state) {
      let last = '';
      dynamic.push(() => { const st = opts.state(); const sig = JSON.stringify(st); if (sig !== last) { last = sig; redraw(st); } });
    }
    return m;
  }
  function resolveLayout(layout, state = {}, overrides = {}) {
    return {
      ...layout,
      rows: layout.rows.map((row, ri) => row.map((it, ci) => {
        let out = it;
        const o = overrides[`${ri},${ci}`];
        if (o) out = { ...out, ...Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null)) };
        if (!it.key) return out;
        if (it.key === 'le') return { ...out, lit: state.le?.[it.i] > 0, color: state.le?.[it.i] === 1 ? 'amber' : 'green' };
        if (it.key === 'apuGen') return { ...out, lit: !!state.apuGen };
        if (it.key === 'apu') return { ...out, angle: state.apu ? 0.7 : -0.7 };
        if (it.key.startsWith('light.')) return { ...out, on: !!state[it.key] };
        return out;
      })),
    };
  }
  const L = (id) => LAYOUTS[id];
  const sysState = () => systems.state;
  const ann = () => systems.annunciators();

  // ---- main instrument panel (P1 / P2 / P3)
  const mainPanel = facing(V(0.88, 0.8, 0), V(-1, 0.2, 0));
  const backing = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.56), mats.panel);
  mainPanel.add(backing);
  box(0.2, 0.62, 2.04, mats.panel, [1.08, 0.78, 0]); // structure behind the tilted panel (kept clear of its face)
  const pfdState = () => {
    const st = sysState();
    const air = !st.onGround;
    return { pitch: air ? 2.5 : 0, bank: air ? -st.roll * 18 : 0, speed: air ? 250 : 0, alt: air ? 10000 : 0, hdg: 10, fma: air ? ['MCP SPD', 'LNAV', 'VNAV PTH'] : ['', '', ''], cmd: air };
  };
  for (const s of [-1, 1]) {
    zone(mainPanel, 'fd-pfd', 0.205, 0.205, s * 0.71, 0.03, drawPFD, { screen: true, state: pfdState, side: s < 0 ? 'L' : 'R' });
    zone(mainPanel, 'fd-nd', 0.205, 0.205, s * 0.475, 0.03, drawND, { screen: true, side: s < 0 ? 'L' : 'R' });
  }
  zone(mainPanel, 'fd-upper-du', 0.205, 0.205, 0.0, 0.05, drawEngines, {
    screen: true,
    state: () => { const st = sysState(); const a = ann(); return { n1: st.onGround ? 0 : 84.6, egt: st.onGround ? 22 : 712, rev: a.rev.state === 'off' ? '' : a.rev.state }; },
  });
  zone(mainPanel, 'fd-standby', 0.1, 0.1, -0.205, 0.08, drawISFD, { screen: true });
  zone(mainPanel, 'fd-gear-panel', 0.15, 0.26, 0.205, 0.0, drawGearPanel, {
    state: () => { const a = ann(); return { gear: a.gearN.state, leTransit: a.leTransit.state !== 'off', leExt: a.leExt.state !== 'off', flap: parseFloat(systems.readout('flapGauge')) || 0 }; },
  });

  // gear lever (3D, on the main panel)
  const gearLever = new THREE.Group();
  gearLever.position.set(0.31, 0.02, 0.02);
  mainPanel.add(gearLever);
  {
    const stem = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.012, 0.08), mats.metal);
    stem.position.z = 0.04;
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.03, 20), mats.wall);
    knob.rotation.x = Math.PI / 2; knob.position.z = 0.085;
    [stem, knob].forEach((m) => { m.userData.partId = 'fd-gear-panel'; gearLever.add(m); });
  }

  // ---- glareshield (P7)
  box(0.38, 0.06, 2.04, mats.glare, [0.8, 1.04, 0]);
  const glare = facing(V(0.63, 1.01, 0), V(-1, 0.75, 0));
  const glareFace = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.12), mats.glare);
  glare.add(glareFace);
  zone(glare, 'fd-mcp', 0.66, 0.1, 0, 0, drawMCP, { screen: false });
  for (const s of [-1, 1]) {
    zone(glare, 'fd-efis-panels', 0.2, 0.1, s * 0.47, 0, L('fd-efis-panels'), { side: s < 0 ? 'L' : 'R' });
    zone(glare, 'fd-master-caution', 0.14, 0.1, s * 0.66, 0, drawMasterCaution, { side: s < 0 ? 'L' : 'R' });
  }

  // ---- forward overhead (P5)
  const ovh = facing(V(0.33, 1.85, 0), V(-0.36, -0.93, 0));
  ovh.add(new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.72), mats.panel));
  const cw = 0.168, x0 = -0.42;
  const col = (i) => x0 + cw * (i + 0.5);
  const yTop = 0.34, yBot = -0.2;
  const place = (id, ci, y1, y2, layoutId = id) =>
    zone(ovh, id, cw - 0.006, (y2 - y1) - 0.006, col(ci), (y1 + y2) / 2, L(layoutId), {
      state: LAYOUTS[layoutId].rows.some((r) => r.some((it) => it.key)) ? () => ({ apu: !!sysState().apu, apuGen: ann().apuGen.state !== 'off' }) : null,
    });
  place('fd-flight-controls', 0, 0.06, yTop);
  place('fd-nav-displays', 0, -0.06, 0.06);
  place('fd-fuel', 0, yBot, -0.06);
  place('fd-electrical', 1, 0.0, yTop);
  place('fd-apu', 1, yBot, 0.0);
  place('fd-cabin-signs', 2, 0.12, yTop);
  place('fd-window-probe-heat', 2, yBot, 0.12);
  place('fd-anti-ice', 3, 0.12, yTop);
  place('fd-hydraulics', 3, yBot, 0.12);
  place('fd-air-conditioning', 4, 0.15, yTop);
  place('fd-bleed-air', 4, -0.03, 0.15);
  place('fd-pressurization', 4, yBot, -0.03);
  // bottom row (forward edge)
  const lightsState = () => ({ ...sysState() });
  zone(ovh, 'fd-exterior-lights', 0.33, 0.13, -0.255, -0.28, L('fd-exterior-lights'), { state: lightsState });
  zone(ovh, 'fd-engine-start', 0.18, 0.13, 0.0, -0.28, L('fd-engine-start'));
  zone(ovh, 'fd-exterior-lights', 0.33, 0.13, 0.255, -0.28, L('fd-exterior-lights-2'), { state: lightsState });

  // ---- aft overhead
  const aft = facing(V(-0.25, 1.99, 0), V(-0.08, -1, 0));
  aft.add(new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.42), mats.panel));
  zone(aft, 'fd-irs', 0.27, 0.36, -0.29, 0, L('fd-irs'));
  zone(aft, 'fd-le-devices', 0.27, 0.36, 0, 0, L('fd-le-devices'), {
    state: () => { const a = ann(); const ext = a.leExt.state !== 'off'; const tr = a.leTransit.state !== 'off'; return { le: Array.from({ length: 12 }, () => (tr ? 1 : ext ? 2 : 0)) }; },
  });
  zone(aft, 'fd-engine-eec', 0.27, 0.36, 0.29, 0, L('fd-engine-eec'));

  // ---- pedestal
  box(0.36, 0.5, 0.66, mats.panel, [0.58, 0.25, 0]);
  box(0.46, 0.6, 0.42, mats.panel, [0.18, 0.3, 0]);
  box(0.56, 0.58, 0.44, mats.panel, [-0.3, 0.29, 0]);
  const fwdElec = facing(V(0.6, 0.6, 0), V(-0.75, 0.66, 0));
  fwdElec.add(new THREE.Mesh(new THREE.PlaneGeometry(0.68, 0.32), mats.panel));
  for (const s of [-1, 1]) zone(fwdElec, 'fd-cdu', 0.2, 0.29, s * 0.225, 0, drawCDU, { side: s < 0 ? 'L' : 'R' });
  zone(fwdElec, 'fd-lower-du', 0.2, 0.2, 0, 0.03, drawLowerDU, { screen: true });

  // control stand
  const cs = facing(V(0.19, 0.62, 0), V(-0.12, 1, 0));
  {
    const c = makeCanvas(0.42, 0.42);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#4c545e'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#111'; const W = c.width, H = c.height;
    [[0.12, 'SPEED BRAKE'], [0.88, 'FLAPS']].forEach(([x]) => ctx.fillRect(W * x - 4, H * 0.12, 8, H * 0.62));
    [0.42, 0.58].forEach((x) => ctx.fillRect(W * x - 5, H * 0.1, 10, H * 0.66));
    drawLabel(ctx, 'SPEED\nBRAKE', W * 0.12, H * 0.06, H * 0.03, '#fff');
    drawLabel(ctx, 'FLAPS', W * 0.88, H * 0.06, H * 0.03, '#fff');
    ['DOWN', 'ARMED', 'FLT DET', 'UP'].forEach((t, i) => drawLabel(ctx, t, W * 0.22, H * (0.14 + i * 0.19), H * 0.026, '#fff'));
    FLAP_DETENTS.forEach((d, i) => drawLabel(ctx, d === 0 ? 'UP' : String(d), W * 0.78, H * (0.14 + i * 0.075), H * 0.026, '#fff'));
    drawLabel(ctx, 'IDLE / CUTOFF', W * 0.5, H * 0.86, H * 0.026, '#fff');
    drawLabel(ctx, 'PARK BRAKE', W * 0.14, H * 0.93, H * 0.025, '#ff6b5b');
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), new THREE.MeshStandardMaterial({ map: canvasTexture(c), roughness: 0.7 }));
    cs.add(plate);
  }
  const lever = (partId, x, y, h, knobGeom, knobMat) => {
    const g = new THREE.Group();
    g.position.set(x, y, 0);
    cs.add(g);
    const stem = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, h), mats.black);
    stem.position.z = h / 2;
    const knob = new THREE.Mesh(knobGeom, knobMat);
    knob.position.z = h;
    [stem, knob].forEach((m) => { m.userData.partId = partId; g.add(m); });
    return g;
  };
  const thrust = [-0.035, 0.035].map((x) => lever('fd-thrust-levers', x, -0.05, 0.13, new THREE.BoxGeometry(0.05, 0.03, 0.035), mats.metal));
  const reverse = thrust.map((t) => {
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.012), mats.black);
    r.position.set(0, 0.03, 0.12); r.userData.partId = 'fd-thrust-levers';
    t.add(r);
    return r;
  });
  const sbLever = lever('fd-speedbrake-lever', -0.16, 0.1, 0.1, new THREE.BoxGeometry(0.03, 0.05, 0.02), mats.wall);
  const flapLever = lever('fd-flap-lever', 0.16, 0.1, 0.1, new THREE.BoxGeometry(0.05, 0.03, 0.025), mats.wall);
  [-0.03, 0.03].forEach((x) => lever('fd-start-levers', x, -0.17, 0.06, new THREE.CylinderGeometry(0.012, 0.012, 0.03, 12), mats.black));
  lever('fd-start-levers', -0.15, -0.18, 0.05, new THREE.BoxGeometry(0.035, 0.02, 0.015), new THREE.MeshStandardMaterial({ color: '#b8231c' }));
  // stab trim wheels
  const wheels = [-1, 1].map((s) => {
    const g = new THREE.Group();
    g.position.set(0.15, 0.48, s * 0.232);
    root.add(g);
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.03, 40), mats.black);
    w.rotation.x = Math.PI / 2;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.06, 0.032), mats.wall);
    stripe.position.set(0, 0.1, 0);
    [w, stripe].forEach((m) => { m.userData.partId = 'fd-stab-trim'; g.add(m); });
    return g;
  });

  // aft electronic panel (P8)
  const aftElec = facing(V(-0.3, 0.6, 0), V(-0.06, 1, 0));
  aftElec.add(new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.54), mats.panel));
  zone(aftElec, 'fd-fire-panel', 0.42, 0.15, 0, 0.18, L('fd-fire-panel'));
  zone(aftElec, 'fd-radios', 0.42, 0.21, 0, 0.0, L('fd-radios'));
  zone(aftElec, 'fd-trim-panel', 0.42, 0.13, 0, -0.19, L('fd-trim-panel'));

  // ---- seats, columns, pedals, tiller
  for (const s of [-1, 1]) {
    const z = s * 0.53;
    box(0.5, 0.12, 0.5, mats.seat, [-0.45, 0.46, z]);
    const back = box(0.12, 0.8, 0.5, mats.seat, [-0.74, 0.92, z]);
    back.rotation.z = -0.12;
    box(0.1, 0.22, 0.3, mats.seat, [-0.82, 1.42, z]);
    box(0.3, 0.4, 0.3, mats.trim, [-0.45, 0.2, z]);
  }
  const columns = [-1, 1].map((s) => {
    const z = s * 0.53;
    const pivot = new THREE.Group();
    pivot.position.set(0.58, 0.06, z);
    root.add(pivot);
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.62, 0.05), mats.black);
    col.position.set(-0.08, 0.31, 0); col.rotation.z = 0.25;
    const wheel = new THREE.Group();
    wheel.position.set(-0.17, 0.66, 0);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.035, 0.32), mats.black);
    const gripL = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.13, 0.03), mats.black); gripL.position.set(0, 0.05, -0.16);
    const gripR = gripL.clone(); gripR.position.z = 0.16;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 16), mats.metal); hub.rotation.z = Math.PI / 2;
    [bar, gripL, gripR, hub].forEach((m) => { m.userData.partId = 'fd-control-column'; wheel.add(m); });
    col.userData.partId = 'fd-control-column';
    pivot.add(col, wheel);
    return { pivot, wheel };
  });
  const pedals = [];
  for (const s of [-1, 1]) {
    for (const p of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.2, 0.09), mats.metal);
      m.position.set(0.74, 0.17, s * 0.53 + p * 0.1);
      m.rotation.z = 0.35;
      m.userData.partId = 'fd-rudder-pedals';
      root.add(m);
      pedals.push({ m, p, base: m.position.x });
    }
  }
  {
    const t = new THREE.Group();
    t.position.set(0.32, 0.72, -0.99);
    root.add(t);
    const disk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 24), mats.black);
    disk.rotation.x = Math.PI / 2;
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.05, 12), mats.metal);
    knob.rotation.x = Math.PI / 2; knob.position.set(0.04, 0, 0.03);
    [disk, knob].forEach((m) => { m.userData.partId = 'fd-tiller'; t.add(m); });
    box(0.3, 0.12, 0.06, mats.trim, [0.32, 0.66, -1.0]);
  }

  // ---- direct manipulation of levers and wheels
  const operable = (obj, hint, act) => obj.traverse((m) => {
    if (!m.isMesh) return;
    m.userData.hint = () => hint;
    m.userData.interact = ({ shift }) => {
      const r = act(shift);
      return { handled: true, ok: r?.ok !== false, message: r?.message };
    };
  });
  operable(flapLever, 'Flap lever · click: next detent · Shift+click: back one', (shift) => {
    const i = FLAP_DETENTS.indexOf(systems.get('flapLever'));
    const n = FLAP_DETENTS[Math.max(0, Math.min(FLAP_DETENTS.length - 1, i + (shift ? -1 : 1)))];
    return systems.set('flapLever', n);
  });
  operable(gearLever, 'Gear lever · click: UP / DN · Shift+click: OFF', (shift) => {
    if (shift) return systems.set('gearLever', 'OFF');
    return systems.set('gearLever', systems.get('gearLever') === 'DN' ? 'UP' : 'DN');
  });
  const SB = ['DOWN', 'ARMED', 'FLIGHT', 'UP'];
  operable(sbLever, 'Speed brake · click: next position · Shift+click: back', (shift) => {
    const i = SB.indexOf(systems.get('speedbrake'));
    return systems.set('speedbrake', SB[Math.max(0, Math.min(SB.length - 1, i + (shift ? -1 : 1)))]);
  });
  thrust.forEach((t) => operable(t, 'Reverse thrust levers · click to raise / stow', () => systems.set('reversers', !systems.get('reversers'))));
  wheels.forEach((w) => operable(w, 'Stab trim wheel · click: nose up · Shift+click: nose down', (shift) =>
    systems.set('stabTrim', Math.round(((parseFloat(systems.readout('stabUnits')) || 5) + (shift ? -0.5 : 0.5)) * 4) / 4)));

  // ---- day / night
  const sky = root.children.find((c) => c.geometry?.type === 'SphereGeometry');
  function setNight(on) {
    sky.material.color.set(on ? '#1a2233' : '#ffffff');
    amb.intensity = on ? 0.12 : 0.9;
    dome.intensity = on ? 0.35 : 1.2;
    dome.color.set(on ? '#ffd9a8' : '#fff3e0');
    for (const m of nightables) {
      const base = m.userData.baseEmissive || (m.userData.baseEmissive = m.material.emissive.clone());
      base.set(on ? '#8a8a8a' : '#2a2a2a');
      if (!m.userData.hl) m.material.emissive.copy(base);
    }
  }

  // ---- animation from systems
  const cur = { flap: 0, sb: 0.12, gear: -0.04, rev: 0, stab: 5, roll: 0, pitch: 0, yaw: 0 };
  const approach = (a, b, k) => a + (b - a) * k;
  function update(dt) {
    const st = systems.state;
    const k = 1 - Math.exp(-dt * 8);
    const fi = Math.max(0, FLAP_DETENTS.indexOf(st.flapLever));
    cur.flap = approach(cur.flap, 0.13 - (fi / (FLAP_DETENTS.length - 1)) * 0.26, k);
    flapLever.position.y = cur.flap;
    const sbPos = { DOWN: 0.12, ARMED: 0.08, FLIGHT: -0.02, UP: -0.12 }[st.speedbrake] ?? 0.12;
    cur.sb = approach(cur.sb, sbPos, k);
    sbLever.position.y = cur.sb;
    const gy = { UP: 0.055, OFF: 0.0, DN: -0.055 }[st.gearLever] ?? -0.055;
    cur.gear = approach(cur.gear, gy, k);
    gearLever.position.y = cur.gear;
    cur.rev = approach(cur.rev, st.reversers ? 1 : 0, k);
    reverse.forEach((r) => { r.rotation.x = -cur.rev * 1.1; r.position.z = 0.12 + cur.rev * 0.02; });
    const stab = parseFloat(systems.readout('stabUnits')) || 5;
    wheels.forEach((w) => { w.rotation.z = stab * 0.9; });
    cur.roll = approach(cur.roll, st.roll, k);
    cur.pitch = approach(cur.pitch, st.pitch, k);
    cur.yaw = approach(cur.yaw, st.yaw, k);
    columns.forEach((c) => { c.wheel.rotation.x = cur.roll * 1.2; c.pivot.rotation.z = cur.pitch * 0.18; });
    pedals.forEach((p) => { p.m.position.x = p.base + p.p * cur.yaw * 0.05; });
    dynamic.forEach((f) => f());
  }

  return { root, update, setNight };
}
