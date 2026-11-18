// Simplified 737 NG AFDS + autothrottle mode logic and point-mass flight model for the
// Automatic flight trainer. Teaching model only: numbers are illustrative, not performance data.

export const wrap360 = (a) => ((a % 360) + 360) % 360;
export const angDiff = (a, b) => ((a - b + 540) % 360) - 180; // a - b in -180..180
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

// World (nm, x east / y north). ILS runway 27: threshold at origin, landing west.
export const RWY = { x: 0, y: 0, crs: 270, len: 1.6, elev: 0, name: '27', ident: 'IAFC', gs: 3 };
// Fictional example route (not real airspace) ending on the extended centreline.
export const ROUTE = [
  { id: 'KOVIL', x: -18, y: 22 },
  { id: 'RENAS', x: 12, y: 30 },
  { id: 'TOLPA', x: 34, y: 16 },
  { id: 'MIRUS', x: 26, y: 2 },
  { id: 'CI27', x: 14, y: 0 },
];
export const ROUTE_START = { id: 'DEP', x: -30, y: 6 };

export const IDLE_N1 = 26; // flight idle (illustrative)
const CLB_N1 = 91.5; // example climb N1 limit
const TO_N1 = 95.0; // example takeoff N1
const V2 = 152, VR = 147;

function blankState() {
  return {
    t: 0,
    x: 0, y: 0, alt: 3000, ias: 210, vs: 0, hdg: 90, bank: 0, pitchAtt: 2, n1: 60, lever: 0.45,
    onGround: false, gearDown: false, landed: false, stopped: null, touchT: null,
    mcp: {
      spd: 210, mach: false, hdg: 90, alt: 3000, vs: 0, crsL: 270, crsR: 270, bank: 25,
      atArm: true, fdL: true, fdR: true, cmdA: false, cmdB: false, cwsA: false, cwsB: false,
      discBar: false, spdIntv: false, master: 'L',
    },
    at: '', roll: '', pitch: '', armRoll: '', armGS: false, armVS: false, flareArmed: false,
    lvlChg: false, vnav: false, appMode: false, holdAlt: null, altHoldAtSel: false, prevPitch: '',
    acqVs: 0, crzAlt: 14000, route: null, leg: 1, ils: true,
    warnAP: false, warnAT: false, manualLever: null,
  };
}

export function createSim(onEvent) {
  let s = blankState();
  const listeners = [];
  const ev = (kind, text, why) => {
    const e = { t: s.t, kind, text, why };
    onEvent?.(e);
    listeners.forEach((f) => f(e));
  };
  const deny = (msg) => { ev('deny', msg); return { ok: false, message: msg }; };

  // ---- helpers ------------------------------------------------------------------
  const cmd = () => s.mcp.cmdA || s.mcp.cmdB;
  const cws = () => s.mcp.cwsA || s.mcp.cwsB;
  const fd = () => s.mcp.fdL || s.mcp.fdR;
  const afds = () => cmd() || fd();
  const tas = () => s.ias * (1 + s.alt / 1000 * 0.018);
  const ra = () => Math.max(0, s.alt - RWY.elev);
  const n1Level = () => clamp(48 + 0.1 * (s.ias - 180) + 0.62 * s.alt / 1000, 35, 94);
  const gTerm = () => (s.vs / 60) * 32.2 / Math.max(80, tas() * 1.688) / 1.688; // kt/s lost to climbing
  const fmcSpd = () => {
    if (s.mcp.spdIntv) return s.mcp.spd;
    return s.alt < 10000 - 300 ? 250 : 290;
  };
  const tgtSpd = () => (s.vnav ? fmcSpd() : s.mcp.spd);
  const n1Limit = () => (s.pitch === 'TO/GA' && (s.onGround || ra() < 1500) ? TO_N1 : CLB_N1);

  function setPitch(m, text, why) {
    if (s.pitch === m) return;
    if (m === 'ALT ACQ') s.prevPitch = s.lvlChg ? 'LVLCHG' : s.pitch;
    s.pitch = m;
    if (text) ev('mode', text, why);
  }
  function setRoll(m, text, why) {
    if (s.roll === m) return;
    s.roll = m;
    if (text) ev('mode', text, why);
  }
  function setAT(m, text, why) {
    if (!s.mcp.atArm && m) return;
    if (s.at === m) return;
    s.at = m;
    if (!['ARM', 'THR HLD', ''].includes(m)) s.manualLever = null;
    if (text) ev('mode', text, why);
  }
  function speedModeAT(why) {
    if (!s.mcp.atArm) return;
    if (['RETARD', 'THR HLD', 'GA'].includes(s.at) && !why) return;
    const m = s.vnav ? 'FMC SPD' : 'MCP SPD';
    if (s.at !== m) setAT(m, `A/T: ${m}`, why || 'Thrust now holds the target speed because the pitch mode controls the flight path.');
  }

  // ---- geometry: ILS ------------------------------------------------------------
  function ilsGeom() {
    const inb = rad(RWY.crs); // inbound course direction
    const ux = Math.sin(inb), uy = Math.cos(inb);
    const dx = s.x - RWY.x, dy = s.y - RWY.y;
    const along = -(dx * ux + dy * uy); // distance before threshold (positive = on approach side)
    const xtk = dx * uy - dy * ux; // + = right of inbound course? (right when looking inbound)
    // right of inbound course is -: compute signed so that + = aircraft left of centreline
    const locAng = deg(Math.atan2(-xtk, along + RWY.len + 0.3));
    const gsAng = deg(Math.atan2(Math.max(0, s.alt - RWY.elev - 50), Math.max(0.05, along + 0.16) * 6076));
    return { along, xtk: -xtk, locDots: clamp(locAng / 1.25, -2.6, 2.6), gsDots: clamp((gsAng - RWY.gs) / 0.35, -2.6, 2.6), gsAng };
  }

  // ---- route geometry -----------------------------------------------------------
  function routeLeg() {
    if (!s.route) return null;
    const pts = [ROUTE_START, ...s.route];
    const i = Math.min(s.leg, pts.length - 1);
    const a = pts[i - 1], b = pts[i];
    const crs = wrap360(deg(Math.atan2(b.x - a.x, b.y - a.y)));
    const ux = Math.sin(rad(crs)), uy = Math.cos(rad(crs));
    const dx = s.x - a.x, dy = s.y - a.y;
    const xtk = dx * uy - dy * ux; // + = right of track
    const dist = Math.hypot(b.x - s.x, b.y - s.y);
    const along = dx * ux + dy * uy;
    return { a, b, crs, xtk, dist, along, i, last: i === pts.length - 1 };
  }

  // ---- buttons ------------------------------------------------------------------
  const BTN = {};
  BTN.LVLCHG = () => {
    if (!afds()) return deny('Turn on a flight director or engage an autopilot first — the MCP modes have nothing to command.');
    if (s.onGround) return deny('LVL CHG is not available on the ground.');
    if (s.pitch === 'G/S' || s.pitch === 'FLARE') return deny('After glideslope capture LVL CHG is inhibited. Use TO/GA to go around, or disconnect the autopilot and turn both F/Ds off.');
    const d = s.mcp.alt - s.alt;
    if (Math.abs(d) < 100) return deny('LVL CHG needs a target: set a new MCP altitude above or below the current altitude first.');
    leaveVnav();
    s.lvlChg = true; s.armVS = false;
    setPitch('MCP SPD', `LVL CHG engaged — ${d > 0 ? 'climb' : 'descent'}`, d > 0
      ? 'Pitch now holds the MCP speed (FMA pitch: MCP SPD) and the autothrottle sets climb thrust (N1). Speed on pitch, thrust fixed.'
      : 'Pitch now holds the MCP speed and the autothrottle retards the levers to idle (RETARD). Speed on pitch, thrust at idle.');
    if (d > 0) setAT('N1', 'A/T: N1', 'LVL CHG climb uses the N1 climb limit.');
    else setAT('RETARD', 'A/T: RETARD', 'LVL CHG descent: the thrust levers move to idle.');
    return { ok: true };
  };
  BTN.VS = () => {
    if (!afds()) return deny('Turn on a flight director or engage an autopilot first.');
    if (s.onGround) return deny('V/S is not available on the ground.');
    if (s.pitch === 'G/S' || s.pitch === 'FLARE') return deny('V/S is inhibited after glideslope capture in APP mode.');
    if (s.pitch === 'ALT HOLD' && s.altHoldAtSel) return deny('V/S is inhibited while holding the selected altitude — set a new MCP altitude first (V/S then arms).');
    engageVS(roundVS(s.vs), 'V/S switch pushed');
    return { ok: true };
  };
  function roundVS(v) { const st = Math.abs(v) < 1000 ? 50 : 100; return Math.round(v / st) * st; }
  function engageVS(rate, how) {
    leaveVnav(); s.lvlChg = false; s.armVS = false;
    s.mcp.vs = rate;
    setPitch('V/S', `V/S engaged at ${rate > 0 ? '+' : ''}${rate} fpm`, `${how}: the autopilot now holds the vertical speed shown in the V/S window. V/S can fly away from the MCP altitude if you dial the wrong sign — there is no protection against that direction.`);
    speedModeAT('With V/S controlling the path, the autothrottle holds the MCP speed.');
  }
  BTN.ALTHLD = () => {
    if (!afds()) return deny('Turn on a flight director or engage an autopilot first.');
    if (s.pitch === 'G/S' || s.pitch === 'FLARE') return deny('ALT HOLD is inhibited after glideslope capture.');
    if (s.pitch === 'ALT HOLD' && s.altHoldAtSel) return deny('Already holding the selected altitude.');
    leaveVnav(); s.lvlChg = false; s.armVS = false;
    s.holdAlt = Math.round(s.alt / 10) * 10; s.acqVs = 0;
    s.altHoldAtSel = Math.abs(s.holdAlt - s.mcp.alt) < 20;
    setPitch('ALT HOLD', `ALT HOLD engaged at ${s.holdAlt} ft`, 'You pushed ALT HLD: the autopilot levels off and holds the altitude at the moment of selection (not the MCP altitude).');
    speedModeAT('In ALT HOLD the autothrottle holds the MCP speed.');
    return { ok: true };
  };
  BTN.HDGSEL = () => {
    if (!afds()) return deny('Turn on a flight director or engage an autopilot first.');
    if (s.pitch === 'G/S' && s.roll === 'VOR/LOC') return deny('After LOC and G/S capture, roll cannot be changed with HDG SEL. Go around with TO/GA or disconnect.');
    if (s.roll === 'HDG SEL') return deny('HDG SEL is already engaged. Select another roll mode to leave it.');
    const wasLoc = s.roll === 'VOR/LOC';
    setRoll('HDG SEL', 'HDG SEL engaged', `The aircraft now turns to the MCP heading using up to the bank angle limit (${s.mcp.bank}°).${wasLoc ? ' The localizer is no longer being tracked.' : ''}`);
    if (wasLoc) { s.appMode = false; s.armGS = false; }
    return { ok: true };
  };
  BTN.LNAV = () => {
    if (!afds()) return deny('Turn on a flight director or engage an autopilot first.');
    if (!s.route) return deny('No active FMC route in this exercise.');
    if (s.roll === 'LNAV') { setRoll('', 'LNAV disengaged', 'Pushing an engaged LNAV switch disengages it. With the A/P in CMD and no roll mode, roll goes to CWS R.'); return { ok: true }; }
    if (s.armRoll === 'LNAV') { s.armRoll = ''; ev('mode', 'LNAV disarmed', 'Second push removed the LNAV arm.'); return { ok: true }; }
    if (s.pitch === 'G/S') return deny('Not available after glideslope capture.');
    const L = routeLeg();
    if (Math.abs(L.xtk) < 3) setRoll('LNAV', 'LNAV engaged', 'The aircraft is close to the active leg, so LNAV engages and steers along the FMC route.');
    else { s.armRoll = 'LNAV'; ev('mode', 'LNAV armed (white)', 'Too far from the active leg to capture now. LNAV stays armed and engages when the current heading brings the aircraft within capture distance.'); }
    if (s.appMode) { s.appMode = false; s.armGS = false; }
    return { ok: true };
  };
  BTN.VNAV = () => {
    if (!afds()) return deny('Turn on a flight director or engage an autopilot first.');
    if (s.vnav) { leaveVnav(true); return { ok: true }; }
    if (!s.route) return deny('VNAV needs an active route and performance data (not set in this exercise).');
    if (s.pitch === 'G/S') return deny('Not available after glideslope capture.');
    const top = Math.min(s.mcp.alt, s.crzAlt);
    if (s.mcp.alt < s.alt - 100) return deny('VNAV descents are not modelled in this trainer — use LVL CHG or V/S to descend.');
    s.vnav = true; s.lvlChg = false; s.armVS = false; s.mcp.spdIntv = false;
    if (top - s.alt > 100) {
      setPitch('VNAV SPD', 'VNAV engaged — VNAV SPD', 'VNAV climb: pitch holds the FMC climb speed and the autothrottle sets climb N1. The IAS/MACH window blanks because the FMC now owns the speed.');
      setAT('N1', 'A/T: N1', 'VNAV climb uses the N1 climb limit.');
    } else {
      setPitch(top >= s.crzAlt - 50 ? 'VNAV PTH' : 'VNAV ALT', `VNAV engaged — ${top >= s.crzAlt - 50 ? 'VNAV PTH' : 'VNAV ALT'}`, 'Already at the VNAV target altitude, so VNAV holds altitude and the autothrottle holds the FMC speed.');
      setAT('FMC SPD', 'A/T: FMC SPD', 'VNAV level flight: thrust holds the FMC target speed.');
    }
    return { ok: true };
  };
  function leaveVnav(byPush) {
    if (!s.vnav) return;
    s.vnav = false; s.mcp.spdIntv = false;
    s.mcp.spd = Math.round(s.ias);
    if (byPush) {
      setPitch('', 'VNAV disengaged', 'Second push of VNAV disengages it. The MCP speed window reopens at the current speed. With no pitch mode, an engaged A/P reverts to CWS P.');
      if (s.at === 'FMC SPD' || s.at === 'N1') setAT('ARM', 'A/T: ARM', 'No A/T mode is commanded any more; select SPEED or N1.');
    }
  }
  BTN.VORLOC = () => {
    if (!afds()) return deny('Turn on a flight director or engage an autopilot first.');
    if (s.appMode) return deny('APP is armed or engaged — push APP to change the approach mode.');
    if (s.armRoll === 'VOR/LOC') { s.armRoll = ''; ev('mode', 'VOR/LOC disarmed', 'Second push removed the arm.'); return { ok: true }; }
    if (s.roll === 'VOR/LOC') return deny('Localizer already captured. Select HDG SEL or LNAV to leave it.');
    s.armRoll = 'VOR/LOC';
    ev('mode', 'VOR/LOC armed (white)', 'The localizer will be captured when the beam comes inside the capture window. Until then the current roll mode keeps flying the intercept heading.');
    return { ok: true };
  };
  BTN.APP = () => {
    if (!afds()) return deny('Turn on a flight director or engage an autopilot first.');
    if (s.onGround) return deny('Not on the ground.');
    if (s.pitch === 'G/S' && s.roll === 'VOR/LOC') return deny('With LOC and G/S captured, APP can only be left with TO/GA, by disconnecting the A/P with both F/Ds off, or by retuning the ILS.');
    if (s.appMode) {
      s.appMode = false; s.armGS = false;
      if (s.armRoll === 'VOR/LOC') s.armRoll = '';
      if (cmd() && s.mcp.cmdA && s.mcp.cmdB) { s.mcp.cmdB = false; ev('mode', 'CMD B disengaged', 'Dual autopilots are only allowed in APP mode.'); }
      ev('mode', 'APP disarmed', 'Second push of APP removed the armed approach modes.');
      return { ok: true };
    }
    s.appMode = true;
    if (s.roll !== 'VOR/LOC') s.armRoll = 'VOR/LOC';
    s.armGS = true;
    ev('mode', 'APP armed: VOR/LOC and G/S (white)', 'APP arms both the localizer and the glideslope. They show in white below the active modes until each is captured. A second autopilot can now be engaged for a dual-channel approach.');
    return { ok: true };
  };
  function engageCmd(ch) {
    const k = ch === 'A' ? 'cmdA' : 'cmdB', o = ch === 'A' ? 'cmdB' : 'cmdA';
    const ocws = ch === 'A' ? 'cwsB' : 'cwsA';
    if (s.mcp.discBar) return deny('The A/P disengage bar is down — lift it before engaging an autopilot.');
    if (s.mcp[k]) { disengageAP(`CMD ${ch} pushed while engaged`); return { ok: true }; }
    if (s.onGround) return deny('The autopilot cannot be engaged on the ground in this trainer.');
    if (s.mcp[o]) {
      if (s.appMode) {
        s.mcp[k] = true; s.mcp[ch === 'A' ? 'cwsA' : 'cwsB'] = false;
        ev('mode', `CMD ${ch} engaged — dual channel`, 'With APP armed a second autopilot may engage. It stays in standby until both LOC and G/S are captured and the aircraft descends below 1500 ft RA; until then SINGLE CH is shown.');
        return { ok: true };
      }
      s.mcp[o] = false;
      ev('mode', `CMD ${ch} engaged, CMD ${ch === 'A' ? 'B' : 'A'} off`, 'Only one autopilot can be engaged outside APP mode, so engaging the other one transfers control without a disconnect warning.');
    }
    s.mcp[k] = true; s.mcp[ch === 'A' ? 'cwsA' : 'cwsB'] = false; s.mcp[ocws] = false;
    s.warnAP = false;
    if (!s.pitch || !s.roll) ev('mode', `CMD ${ch} engaged`, `No ${!s.pitch && !s.roll ? 'pitch or roll' : !s.pitch ? 'pitch' : 'roll'} mode was active, so the A/P engages in ${[!s.pitch && 'CWS P', !s.roll && 'CWS R'].filter(Boolean).join(' / ')} and holds the current attitude until you select a mode.`);
    else ev('mode', `CMD ${ch} engaged`, 'The autopilot now flies the modes shown on the FMA. A/P status changes from FD to CMD.');
    return { ok: true };
  }
  BTN.CMDA = () => engageCmd('A');
  BTN.CMDB = () => engageCmd('B');
  function engageCws(ch) {
    if (s.mcp.discBar) return deny('The A/P disengage bar is down.');
    if (s.onGround) return deny('Not on the ground in this trainer.');
    const k = ch === 'A' ? 'cwsA' : 'cwsB';
    if (s.mcp[k]) { disengageAP(`CWS ${ch} pushed while engaged`); return { ok: true }; }
    s.mcp.cmdA = s.mcp.cmdB = s.mcp.cwsA = s.mcp.cwsB = false;
    s.mcp[k] = true; s.warnAP = false;
    ev('mode', `CWS ${ch} engaged`, 'Control wheel steering: the autopilot holds whatever attitude the pilot sets through the control wheel (here: the current attitude). FMA shows CWS P / CWS R. Approaching the MCP altitude, CWS P will still capture it (ALT ACQ → ALT HOLD).');
    return { ok: true };
  }
  BTN.CWSA = () => engageCws('A');
  BTN.CWSB = () => engageCws('B');
  function disengageAP(why) {
    if (!cmd() && !cws()) return;
    s.mcp.cmdA = s.mcp.cmdB = s.mcp.cwsA = s.mcp.cwsB = false;
    s.warnAP = true; s.flareArmed = false;
    ev('warn', 'Autopilot disengaged', `${why}. The red A/P light flashes and the disconnect warning sounds until you push the A/P disconnect switch a second time.`);
    if (!fd()) clearModes('No autopilot and no flight director: the pitch and roll modes are gone.');
  }
  function clearModes(why) {
    if (s.pitch || s.roll || s.armRoll || s.armGS) {
      s.pitch = ''; s.roll = ''; s.armRoll = ''; s.armGS = false; s.armVS = false; s.appMode = false; s.lvlChg = false; s.vnav = false;
      ev('mode', 'Pitch and roll modes cleared', why);
    }
  }
  BTN.APDISC = () => {
    if (cmd() || cws()) { disengageAP('A/P disconnect switch on the control wheel'); return { ok: true }; }
    if (s.warnAP) { s.warnAP = false; ev('info', 'A/P warning silenced', 'Second push of the A/P disconnect switch cancels the flashing light and aural warning.'); }
    return { ok: true };
  };
  BTN.ATDISC = () => {
    if (s.mcp.atArm) {
      s.mcp.atArm = false; setATraw('');
      s.warnAT = true;
      ev('warn', 'Autothrottle disconnected', 'A/T disconnect switch on the thrust levers: the A/T ARM switch drops to OFF and the red A/T light flashes. Push the switch again to cancel the warning. You now control thrust manually.');
      s.manualLever = s.lever;
      return { ok: true };
    }
    if (s.warnAT) { s.warnAT = false; ev('info', 'A/T warning cancelled', 'Second push of the A/T disconnect switch.'); }
    return { ok: true };
  };
  function setATraw(m) { s.at = m; }
  BTN.DISCBAR = () => {
    s.mcp.discBar = !s.mcp.discBar;
    if (s.mcp.discBar) {
      if (cmd() || cws()) disengageAP('A/P disengage bar pulled down');
      else ev('info', 'Disengage bar down', 'Autopilots cannot be engaged while the bar is down.');
    } else ev('info', 'Disengage bar up', 'Autopilots can be engaged again.');
    return { ok: true };
  };
  BTN.FDL = () => toggleFD('fdL');
  BTN.FDR = () => toggleFD('fdR');
  function toggleFD(k) {
    const other = k === 'fdL' ? 'fdR' : 'fdL';
    s.mcp[k] = !s.mcp[k];
    if (s.mcp[k] && !s.mcp[other]) s.mcp.master = k === 'fdL' ? 'L' : 'R';
    if (!s.mcp[k] && s.mcp[other]) s.mcp.master = other === 'fdL' ? 'L' : 'R';
    ev('info', `${k === 'fdL' ? 'Captain' : 'F/O'} F/D ${s.mcp[k] ? 'ON' : 'OFF'}`, s.mcp[k]
      ? (s.mcp[other] ? 'Both F/Ds on. The MA light shows which FCC is master — the side switched on first.' : 'The first F/D switched on makes that side\'s flight control computer master (MA light).')
      : (fd() ? 'One F/D is still on.' : (cmd() ? 'Both F/Ds off, but the A/P keeps flying the selected modes.' : 'Both F/Ds off with no autopilot engaged.')));
    if (!fd() && !cmd()) clearModes('With both F/Ds off and no autopilot in CMD, no pitch or roll modes are active.');
    if (s.mcp[k] && s.onGround && !s.pitch) ev('info', 'F/D on the ground', 'On the ground the F/D shows no modes until TO/GA is pushed for takeoff.');
    return { ok: true };
  }
  BTN.ATARM = () => {
    s.mcp.atArm = !s.mcp.atArm;
    if (s.mcp.atArm) {
      s.warnAT = false; s.at = 'ARM'; s.manualLever = null;
      ev('mode', 'A/T armed', 'A/T ARM switch ON: the FMA shows ARM (white) until an A/T mode is selected — N1, SPEED, or a mode that brings its own A/T mode (LVL CHG, VNAV, TO/GA).');
    } else {
      s.at = ''; s.warnAT = true; s.manualLever = s.lever;
      ev('warn', 'A/T ARM switch OFF', 'Autothrottle disengaged: the red A/T light flashes. You control the thrust levers manually.');
    }
    return { ok: true };
  };
  BTN.N1 = () => {
    if (!s.mcp.atArm) return deny('Arm the autothrottle first (A/T ARM switch).');
    if (s.at === 'N1') { setAT('ARM', 'A/T: ARM', 'Second push of N1: no A/T mode is commanded; levers stay where they are.'); return { ok: true }; }
    setAT('N1', 'A/T: N1', 'N1 pushed: the autothrottle drives the levers to the selected N1 limit and ignores speed.');
    return { ok: true };
  };
  BTN.SPEED = () => {
    if (!s.mcp.atArm) return deny('Arm the autothrottle first (A/T ARM switch).');
    if (s.pitch === 'MCP SPD' || s.pitch === 'VNAV SPD' || s.pitch === 'TO/GA') return deny('SPEED is not compatible with the current pitch mode — pitch already controls speed (LVL CHG / VNAV SPD / TO/GA).');
    if (s.at === 'MCP SPD') { setAT('ARM', 'A/T: ARM', 'Second push of SPEED: no A/T mode is commanded.'); return { ok: true }; }
    if (s.vnav) return deny('In VNAV the speed comes from the FMC. Push SPD INTV to set the speed on the MCP.');
    setAT('MCP SPD', 'A/T: MCP SPD', 'SPEED pushed: the autothrottle holds the speed in the IAS/MACH window.');
    return { ok: true };
  };
  BTN.CO = () => { s.mcp.mach = !s.mcp.mach; ev('info', `Speed window shows ${s.mcp.mach ? 'Mach' : 'IAS'}`, 'C/O toggles the IAS/MACH window between knots and Mach. The target speed stays the same.'); return { ok: true }; };
  BTN.SPDINTV = () => {
    if (!s.vnav) return deny('SPD INTV is used with VNAV active (the window is open already).');
    s.mcp.spdIntv = !s.mcp.spdIntv;
    if (s.mcp.spdIntv) s.mcp.spd = Math.round(fmcSpd());
    ev('info', s.mcp.spdIntv ? 'Speed intervention' : 'Speed intervention off', s.mcp.spdIntv ? 'The IAS/MACH window opens and VNAV now targets the MCP speed instead of the FMC speed.' : 'The window blanks again and VNAV returns to the FMC speed.');
    return { ok: true };
  };
  BTN.ALTINTV = () => deny('ALT INTV deletes or bypasses FMC altitude constraints. This simplified route has no constraints, so it has no effect here.');
  BTN.TOGA = () => {
    if (s.onGround) {
      if (!fd()) return deny('Turn on the flight directors first — TO/GA on the ground needs an F/D on to show takeoff guidance.');
      if (s.pitch === 'TO/GA') return deny('TO/GA is already engaged.');
      setPitch('TO/GA', 'TO/GA engaged', 'Takeoff: the F/D pitch bar commands the takeoff attitude/speed. Roll guidance on the FMA depends on software version; here it stays blank (wings level).');
      if (s.mcp.atArm) setAT('N1', 'A/T: N1', 'TO/GA with the A/T armed advances the levers to takeoff N1.');
      return { ok: true };
    }
    if (!(s.appMode || s.pitch === 'G/S') || ra() > 2000) return deny('In this trainer TO/GA in flight is only modelled as a go-around during an ILS approach.');
    const dual = s.mcp.cmdA && s.mcp.cmdB && s.flareArmed;
    s.appMode = false; s.armGS = false; s.armRoll = ''; s.flareArmed = false; s.vnav = false; s.lvlChg = false;
    setPitch('TO/GA', 'Go-around: TO/GA', 'Pitch commands the go-around attitude, then holds a safe speed.');
    setRoll('TO/GA', 'Roll: TO/GA', 'Roll holds the current ground track during the go-around.');
    if (s.mcp.atArm) setAT('GA', 'A/T: GA', 'First TO/GA push: reduced go-around thrust for a moderate climb rate (a second push would give full go-around thrust).');
    if (!dual && cmd()) disengageAP('A single-channel autopilot does not fly a go-around: TO/GA disengaged it and the F/D guides the manual go-around');
    return { ok: true };
  };

  // ---- knobs -----------------------------------------------------------------------
  function turn(knob, steps, big) {
    const m = s.mcp;
    switch (knob) {
      case 'SPD': {
        if (s.vnav && !m.spdIntv) { deny('The IAS/MACH window is blank in VNAV. Push SPD INTV first.'); return; }
        m.spd = clamp(m.spd + steps * (big ? 10 : 1), 110, 340); break;
      }
      case 'HDG': m.hdg = wrap360(m.hdg + steps * (big ? 10 : 1)); break;
      case 'CRSL': m.crsL = wrap360(m.crsL + steps * (big ? 10 : 1)); break;
      case 'CRSR': m.crsR = wrap360(m.crsR + steps * (big ? 10 : 1)); break;
      case 'BANK': { const opts = [10, 15, 20, 25, 30]; const i = clamp(opts.indexOf(m.bank) + Math.sign(steps), 0, 4); m.bank = opts[i]; break; }
      case 'ALT': {
        const before = m.alt;
        m.alt = clamp(m.alt + steps * (big ? 1000 : 100), 0, 41000);
        if (m.alt !== before) altChanged();
        break;
      }
      case 'VS': {
        if (s.pitch !== 'V/S') {
          if (s.armVS) { engageVS(clamp(roundVS(s.vs) + Math.sign(steps) * 50, -8000, 6000), 'V/S was armed and you moved the thumbwheel'); return; }
          deny('The V/S window is blank until V/S is engaged. Push V/S first.'); return;
        }
        let v = m.vs;
        for (let i = 0; i < Math.abs(steps); i++) {
          const up = steps > 0;
          const st = (Math.abs(v) < 1000 || (Math.abs(v) === 1000 && ((up && v < 0) || (!up && v > 0)))) ? 50 : 100;
          v += up ? st : -st;
        }
        m.vs = clamp(v, -7900, 6000);
        break;
      }
      default:
    }
  }
  function altChanged() {
    const m = s.mcp;
    if (s.pitch === 'ALT HOLD' && s.altHoldAtSel && Math.abs(m.alt - s.holdAlt) > 100) {
      s.altHoldAtSel = false; s.armVS = true;
      ev('mode', 'V/S armed (white) · ALT HLD light on', 'You selected a new MCP altitude more than 100 ft away while holding the old selected altitude. ALT HOLD stays engaged (its switch light comes on) and V/S arms: moving the V/S thumbwheel, or pushing LVL CHG / VNAV, starts the level change.');
    } else if (s.pitch === 'ALT HOLD' && !s.altHoldAtSel && Math.abs(m.alt - s.holdAlt) < 20) {
      // dialled back to current altitude
      s.altHoldAtSel = true; s.armVS = false;
    } else if (s.pitch === 'ALT ACQ') {
      const prev = s.prevPitch;
      if (prev === 'LVLCHG') {
        s.lvlChg = false; s.pitch = '';
        const r = BTN.LVLCHG();
        if (!r.ok) setPitch('ALT HOLD');
      } else if (prev === 'V/S') setPitch('V/S', 'ALT ACQ cancelled → V/S', 'The MCP altitude changed during the capture, so the capture is abandoned and the previous V/S mode resumes (simplified).');
      else if (prev === 'VNAV SPD') setPitch('VNAV SPD', 'ALT ACQ cancelled → VNAV SPD', 'New altitude selected during the capture; the climb continues.');
      else setPitch(prev || '', 'ALT ACQ cancelled', 'The MCP altitude changed during the capture.');
    } else if (s.pitch === 'VNAV ALT' && m.alt > s.alt + 100) {
      setPitch('VNAV SPD', 'VNAV SPD — climb resumes', 'VNAV was levelled by the MCP altitude (VNAV ALT). Raising the MCP altitude lets the VNAV climb continue.');
      setAT('N1', 'A/T: N1', 'VNAV climb thrust.');
    } else if (s.pitch === 'MCP SPD' && s.lvlChg) {
      const climbing = s.at === 'N1';
      if ((climbing && m.alt < s.alt - 100) || (!climbing && m.alt > s.alt + 100)) {
        s.pitch = ''; BTN.LVLCHG();
      }
    }
  }

  // ---- per-tick dynamics -------------------------------------------------------
  function tick(dtIn) {
    if (s.stopped) return;
    const steps = Math.max(1, Math.ceil(dtIn / 0.05));
    const dt = dtIn / steps;
    for (let i = 0; i < steps && !s.stopped; i++) step(dt);
  }

  function step(dt) {
    s.t += dt;
    const m = s.mcp;
    const apOn = cmd();
    const pitchGuided = apOn || fd(); // simulated pilot follows the F/D when no A/P
    const G = ilsGeom();

    // ---------------- mode transitions ----------------
    // ALT ACQ
    const err = m.alt - s.alt;
    const capturable = ['MCP SPD', 'V/S'].includes(s.pitch) || ((cws() || (apOn && !s.pitch)) && !s.onGround);
    if (capturable && Math.abs(s.vs) > 100 && Math.sign(err) === Math.sign(s.vs) && Math.abs(err) <= Math.max(Math.abs(s.vs) / 4, 60)) {
      s.acqVs = Math.abs(s.vs);
      const fromCws = !s.pitch;
      setPitch('ALT ACQ', 'ALT ACQ — capturing the MCP altitude', fromCws
        ? 'Approaching the selected altitude in CWS P: the AFDS captures it automatically (ALT ACQ, then ALT HOLD).'
        : `The aircraft is nearing the MCP altitude (${m.alt} ft). The AFDS starts a smooth level-off automatically — you never press anything for this.`);
      s.lvlChg = false; s.armVS = false;
      if (!fromCws) speedModeAT('During the altitude capture the autothrottle switches to holding the MCP speed.');
    }
    if (s.pitch === 'ALT ACQ' && Math.abs(err) < 15) {
      s.holdAlt = m.alt; s.altHoldAtSel = true;
      setPitch('ALT HOLD', `ALT HOLD at ${m.alt} ft`, 'Capture complete: the aircraft is at the selected altitude, so the mode changes to ALT HOLD. The ALT HLD switch light stays off because this hold is at the MCP altitude.');
      speedModeAT('In ALT HOLD the autothrottle holds the MCP speed.');
    }
    // VNAV level-offs
    if (s.pitch === 'VNAV SPD') {
      const top = Math.min(m.alt, s.crzAlt);
      if (s.alt >= top - Math.max(Math.abs(s.vs) / 4, 50)) {
        const atCrz = s.crzAlt <= m.alt;
        setPitch(atCrz ? 'VNAV PTH' : 'VNAV ALT', atCrz ? 'VNAV PTH — level at cruise altitude' : 'VNAV ALT — levelled by MCP altitude', atCrz
          ? 'The FMC cruise altitude is reached. VNAV now holds the path (level) and the autothrottle holds the FMC cruise speed.'
          : 'The MCP altitude is below the FMC cruise altitude, so VNAV levels at the MCP altitude (VNAV ALT). Raise the MCP altitude to continue the climb.');
        setAT('FMC SPD', 'A/T: FMC SPD', 'Level in VNAV: thrust holds the FMC target speed.');
        s.holdAlt = top; s.acqVs = Math.max(Math.abs(s.vs), 500);
      }
    }
    // A/T RETARD -> ARM
    if (s.at === 'RETARD' && !s.onGround && s.pitch !== 'FLARE' && s.n1 <= IDLE_N1 + 0.6) setAT('ARM', 'A/T: ARM', 'The thrust levers reached idle, so the A/T stops driving them (ARM). Pitch alone now controls speed; you could move the levers by hand if needed.');
    // THR HLD on the takeoff roll
    if (s.at === 'N1' && s.pitch === 'TO/GA' && s.onGround && s.ias >= 84) setAT('THR HLD', 'A/T: THR HLD', 'Passing 84 kt on the takeoff roll the A/T stops moving the levers (power to the servos is removed) so a failure cannot change takeoff thrust. You can still move them by hand.');
    if (s.at === 'THR HLD' && !s.onGround && ra() > 800) setAT('ARM', 'A/T: ARM', 'Above about 800 ft after takeoff THR HLD ends and the A/T shows ARM. Selecting LVL CHG or VNAV for the climb gives it an active mode again.');
    // LNAV capture when armed
    if (s.armRoll === 'LNAV') {
      const L = routeLeg();
      if (L && Math.abs(L.xtk) < 2.5 && Math.abs(angDiff(s.hdg, L.crs)) < 100) {
        s.armRoll = ''; setRoll('LNAV', 'LNAV engaged (captured)', 'The intercept heading brought the aircraft within capture distance of the active leg, so armed LNAV became active.');
      }
    }
    // route sequencing
    if (s.route) {
      const L = routeLeg();
      if (L && !L.last && (L.dist < Math.max(1.2, tas() / 160) || L.along > Math.hypot(L.b.x - L.a.x, L.b.y - L.a.y))) {
        s.leg += 1;
      }
    }
    // LOC capture
    if (s.armRoll === 'VOR/LOC' && s.ils && G.along > 0.5) {
      const closing = Math.abs(G.locDots) < 0.3 || Math.sign(angDiff(s.hdg, RWY.crs)) === Math.sign(G.locDots) || true;
      const inbound = Math.abs(angDiff(s.hdg, RWY.crs)) < 100;
      if (Math.abs(G.locDots) < 1.9 && inbound && closing) {
        s.armRoll = '';
        setRoll('VOR/LOC', 'VOR/LOC captured (green)', 'The localizer deviation came inside the capture window, so the armed VOR/LOC mode became active and replaced the previous roll mode. The aircraft now turns onto and tracks the localizer.');
        if (s.appMode && s.mcp.cmdA !== s.mcp.cmdB) ev('info', 'SINGLE CH', 'Only one autopilot is flying an ILS approach: SINGLE CH is shown. Automatic landing needs both autopilots (dual channel).');
        if (s.appMode && s.mcp.cmdA && s.mcp.cmdB) ev('info', 'SINGLE CH (dual approach)', 'With two autopilots engaged, SINGLE CH shows after LOC capture until the second autopilot couples below 1500 ft RA.');
      }
    }
    // G/S capture
    if (s.armGS && s.roll === 'VOR/LOC' && G.along > 0.5 && G.gsDots > -0.25 && G.gsDots < 1.5) {
      s.armGS = false; s.lvlChg = false; s.armVS = false;
      if (s.vnav) { s.vnav = false; s.mcp.spd = Math.round(s.ias); }
      setPitch('G/S', 'G/S captured (green)', 'The glideslope came inside the capture window. G/S replaces the previous pitch mode and the A/P follows the 3° path. With LOC and G/S both captured the APP switch light goes out: APP can now only be left with TO/GA, by disconnecting with both F/Ds off, or by retuning.');
      speedModeAT('On the glideslope the autothrottle holds the MCP speed.');
    }
    // dual-channel flare arm
    if (s.appMode && s.mcp.cmdA && s.mcp.cmdB && s.roll === 'VOR/LOC' && s.pitch === 'G/S' && ra() < 1500 && !s.flareArmed) {
      s.flareArmed = true;
      ev('mode', 'FLARE armed (white) · second A/P coupled', 'Below 1500 ft RA with LOC and G/S captured, the second autopilot couples to the controls. SINGLE CH goes out and FLARE arms: the approach can now continue to an automatic landing.');
    }
    if (s.flareArmed && s.pitch === 'G/S' && ra() < 50) {
      s.flareArmed = false;
      setPitch('FLARE', 'FLARE engaged', 'At about 50 ft RA the autopilots begin the flare, reducing the descent rate for touchdown.');
    }
    if (s.pitch === 'FLARE' && ra() < 27 && s.at && s.at !== 'RETARD' && s.at !== 'ARM') setAT('RETARD', 'A/T: RETARD', 'At about 27 ft RA in an autoland the autothrottle retards the levers to idle.');
    // single-channel below 50 ft
    if (s.appMode && cmd() && !(s.mcp.cmdA && s.mcp.cmdB) && s.pitch === 'G/S' && ra() < 50) {
      s.stopped = 'single';
      ev('warn', 'Simulation stopped: single-channel A/P below 50 ft', 'A single autopilot cannot flare or land. Disconnect it no later than your operator\'s minimum use height and land manually.');
      return;
    }
    // CWS / no-mode capture behaviour is handled above. V/S arm cancel if alt reached again.

    // ---------------- pitch guidance → vertical speed ----------------
    let vsT = s.vs;
    let vsRate = 450; // fpm per s
    const accelFor = (spd, lim = 1.4) => clamp((spd - s.ias) * 0.18, -lim, lim);
    const vsForAccel = (a) => ((0.085 * (s.n1 - n1Level())) - a) * (Math.max(80, tas() * 1.688) * 1.688) / 32.2 * 60;
    const holdTo = (alt) => { const L = Math.max(1500, s.acqVs || 0); return clamp((alt - s.alt) * 4, -L, L); };
    if (s.onGround) {
      vsT = 0;
    } else if (pitchGuided && !cws()) {
      switch (s.pitch) {
        case 'MCP SPD': case 'VNAV SPD': {
          vsT = vsForAccel(accelFor(tgtSpd()));
          const climb = s.pitch === 'VNAV SPD' || s.at === 'N1' || err > 0;
          vsT = climb ? clamp(vsT, 300, 6000) : clamp(vsT, -6000, -300);
          break;
        }
        case 'TO/GA': {
          const spd = s.at === 'GA' ? Math.max(s.mcp.spd, 150) : V2 + 20;
          vsT = clamp(vsForAccel(accelFor(spd)), 400, s.at === 'GA' ? 2000 : 4500);
          break;
        }
        case 'V/S': vsT = m.vs; break;
        case 'ALT ACQ': vsT = clamp(err * 4, -s.acqVs, s.acqVs); vsRate = 350; break;
        case 'ALT HOLD': vsT = holdTo(s.holdAlt ?? s.alt); break;
        case 'VNAV PTH': case 'VNAV ALT': vsT = holdTo(s.holdAlt ?? s.alt); break;
        case 'G/S': {
          const gsAlt = RWY.elev + 50 + Math.max(0, G.along + 0.16) * 6076 * Math.tan(rad(RWY.gs));
          vsT = -tas() * 101.27 * Math.tan(rad(RWY.gs)) + clamp((gsAlt - s.alt) * 2.5, -500, 500);
          break;
        }
        case 'FLARE': vsT = -(110 + ra() * 8); vsRate = 600; break;
        default: vsT = s.vs; // CWS P with A/P / no mode: hold attitude ≈ hold V/S
      }
    }
    if (!s.onGround) s.vs += clamp(vsT - s.vs, -vsRate * dt, vsRate * dt);

    // ---------------- roll guidance ----------------
    let bankT = s.bank;
    const lim = m.bank;
    const toHdg = (h, l = lim) => clamp(angDiff(h, s.hdg) * 2.2, -l, l);
    if (s.onGround) bankT = 0;
    else if (pitchGuided && !cws()) {
      switch (s.roll) {
        case 'HDG SEL': bankT = toHdg(m.hdg); break;
        case 'LNAV': {
          const L = routeLeg();
          if (L) bankT = toHdg(wrap360(L.crs - clamp(L.xtk * 28, -45, 45)), 25);
          break;
        }
        case 'VOR/LOC': bankT = toHdg(wrap360(RWY.crs + clamp(G.xtk * 40, -30, 30)), 25); break;
        case 'TO/GA': bankT = toHdg(s.gaHdg ?? s.hdg, 15); break;
        default: bankT = Math.abs(s.bank) < 6 ? 0 : s.bank; // CWS R: roll level below 6°, else hold bank
      }
    } else bankT = Math.abs(s.bank) < 6 ? 0 : s.bank;
    if (s.roll === 'TO/GA' && s.gaHdg == null) s.gaHdg = s.hdg;
    if (s.roll !== 'TO/GA') s.gaHdg = null;
    s.bank += clamp(bankT - s.bank, -5 * dt, 5 * dt);
    s.fdPitchErr = clamp((vsT - s.vs) / 30, -45, 45);
    s.fdRollErr = clamp((bankT - s.bank) * 2.5, -50, 50);

    // ---------------- thrust ----------------
    let n1T = s.n1;
    if (s.mcp.atArm) {
      switch (s.at) {
        case 'N1': n1T = n1Limit(); break;
        case 'MCP SPD': case 'FMC SPD': {
          const a = accelFor(tgtSpd(), 1.0);
          n1T = clamp(n1Level() + (a + gTerm()) / 0.085, IDLE_N1, CLB_N1);
          break;
        }
        case 'RETARD': n1T = IDLE_N1; break;
        case 'GA': n1T = clamp(n1Level() + (gTerm() + accelFor(Math.max(s.mcp.spd, 150), 0.8)) / 0.085, IDLE_N1, TO_N1); break;
        default: // ARM / THR HLD / none: levers stay put unless the pilot moves them
          if (s.manualLever != null) n1T = IDLE_N1 + s.manualLever * (TO_N1 - IDLE_N1);
      }
    } else if (s.manualLever != null) n1T = IDLE_N1 + s.manualLever * (TO_N1 - IDLE_N1);
    s.n1 += clamp(n1T - s.n1, -6 * dt, 6 * dt);
    s.n1 = clamp(s.n1, IDLE_N1, TO_N1 + 1);
    s.lever = (s.n1 - IDLE_N1) / (TO_N1 - IDLE_N1);

    // ---------------- point mass ----------------
    if (s.onGround) {
      const a = 0.085 * (s.n1 - 34) - (s.ias > 30 ? 0.002 * s.ias : 0);
      s.ias = Math.max(0, s.ias + a * dt);
      if (s.pitch === 'TO/GA' && s.ias >= VR + 3) {
        s.onGround = false; s.vs = 300; s.alt = RWY.elev + 1;
        ev('info', 'Lift-off', 'The simulated pilot rotated at VR and follows the TO/GA pitch command.');
      }
    } else {
      const a = 0.085 * (s.n1 - n1Level()) - gTerm();
      s.ias = clamp(s.ias + a * dt, 100, 360);
      s.alt += s.vs / 60 * dt;
      const hRate = 1091 * Math.tan(rad(s.bank)) / Math.max(100, tas());
      s.hdg = wrap360(s.hdg + hRate * dt);
    }
    const gs = s.onGround ? s.ias : tas();
    s.x += Math.sin(rad(s.hdg)) * gs / 3600 * dt;
    s.y += Math.cos(rad(s.hdg)) * gs / 3600 * dt;
    const gamma = deg(Math.atan2(s.vs, Math.max(60, gs) * 101.27));
    const alpha = s.onGround ? 0 : clamp(2.2 + (230 - s.ias) * 0.05, 0, 11);
    let pT = s.onGround ? (s.pitch === 'TO/GA' && s.ias > VR ? Math.min(15, (s.ias - VR) * 3) : 0) : gamma + alpha;
    s.pitchAtt += clamp(pT - s.pitchAtt, -3 * dt, 3 * dt);

    // touchdown / terrain
    if (!s.onGround && s.alt <= RWY.elev) {
      s.alt = RWY.elev;
      if (s.pitch === 'FLARE' || (s.appMode && Math.abs(s.vs) < 900 && G.along < 0.3 && G.along > -RWY.len)) {
        s.onGround = true; s.landed = true; s.vs = 0; s.touchT = s.t;
        ev('mode', 'Touchdown', 'Autoland touchdown. In the real aircraft the crew disconnects the autopilot after touchdown and controls the rollout and braking.');
      } else {
        s.stopped = 'terrain'; s.vs = 0;
        ev('warn', 'Simulation stopped: ground contact', 'The aircraft reached the ground outside a landing. Check the MCP altitude and the selected modes, then reset.');
        return;
      }
    }
    if (s.landed) {
      s.ias = Math.max(0, s.ias - 2.5 * dt);
      if (s.at && s.t - s.touchT > 2) {
        s.mcp.atArm = false; s.at = ''; s.manualLever = 0;
        ev('mode', 'A/T disengaged after touchdown', 'The autothrottle disengages automatically shortly after an autoland touchdown.');
      }
      if (s.ias <= 0) s.stopped = 'landed';
    }
  }

  // ---- read-outs ---------------------------------------------------------------
  function fma() {
    const cwsP = (cws() || (cmd() && !s.pitch)) && !s.onGround;
    const cwsR = (cws() || (cmd() && !s.roll)) && !s.onGround;
    const appSingle = s.appMode && s.roll === 'VOR/LOC' && cmd() && !s.flareArmed && s.pitch !== 'FLARE';
    let status = cmd() ? 'CMD' : fd() ? 'FD' : '';
    if (appSingle) status = 'SINGLE CH';
    const armP = [s.armGS && 'G/S', s.armVS && 'V/S', s.flareArmed && 'FLARE'].filter(Boolean).join(' ');
    return {
      at: s.at,
      roll: cws() ? 'CWS R' : (cwsR ? 'CWS R' : s.roll),
      pitch: cws() ? 'CWS P' : (cwsP ? 'CWS P' : s.pitch),
      armRoll: s.armRoll,
      armPitch: armP,
      status,
      cwsP: cws() || cwsP, cwsR: cws() || cwsR,
    };
  }
  function lights() {
    const m = s.mcp;
    return {
      N1: s.at === 'N1', SPEED: s.at === 'MCP SPD' || (s.at === 'FMC SPD' && m.spdIntv),
      LVLCHG: s.pitch === 'MCP SPD' && s.lvlChg, VNAV: s.vnav,
      HDGSEL: s.roll === 'HDG SEL', LNAV: s.roll === 'LNAV' || s.armRoll === 'LNAV',
      VORLOC: !s.appMode && (s.roll === 'VOR/LOC' || s.armRoll === 'VOR/LOC'),
      APP: s.appMode && !(s.roll === 'VOR/LOC' && (s.pitch === 'G/S' || s.pitch === 'FLARE')),
      ALTHLD: s.pitch === 'ALT HOLD' && !s.altHoldAtSel,
      VS: s.pitch === 'V/S',
      CMDA: m.cmdA, CMDB: m.cmdB, CWSA: m.cwsA, CWSB: m.cwsB,
      ATARM: m.atArm, MAL: m.master === 'L' && fd(), MAR: m.master === 'R' && fd(),
    };
  }

  function load(init = {}) {
    s = blankState();
    const { mcp, ...rest } = init;
    Object.assign(s, rest);
    if (mcp) Object.assign(s.mcp, mcp);
    if (init.route) s.route = ROUTE;
    if (s.mcp.atArm === false) s.manualLever = s.lever;
    if (init.n1 == null && !s.onGround) s.n1 = n1Level();
  }

  return {
    get s() { return s; },
    press(id) { const f = BTN[id]; return f ? f() : { ok: false }; },
    turn, tick, fma, lights, load, ilsGeom, routeLeg,
    tgtSpd, fmcSpd, ra, tas, n1Limit,
    canMoveLevers() { return !s.mcp.atArm || ['ARM', 'THR HLD', ''].includes(s.at); },
    setManualLever(v) { if (!s.mcp.atArm || ['ARM', 'THR HLD', ''].includes(s.at)) { s.manualLever = clamp(v, 0, 1); return true; } return false; },
    onEvent(f) { listeners.push(f); },
  };
}
