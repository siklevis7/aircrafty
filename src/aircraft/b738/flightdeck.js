// Procedural 737-800 (NG) flight deck. Local coordinates: floor at y = 0, +x forward,
// +z to the First Officer's side (right), captain at z ≈ -0.53.
// Each clickable zone is a mesh with userData.partId matching flightdeck-parts.js.
// Panels are painted canvases (albedo + additive glow layer) with real 3D toggles, guards and knobs
// instanced on top; switches drive the shared systems controller (systems.set).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { makeCanvas, canvasTexture, paintPanel, drawLabel, rrect } from '../../core/panelcanvas.js';
import { FLAP_DETENTS } from './systems.js';
import * as D from './flightdeck-displays.js';
import {
  makeMaterials, buildShell, buildGlareshield, createControlKit, buildSeat, buildColumn, buildPedals,
  buildConsoles, buildTiller, buildCBPanel, buildDoor, buildOutside, bar,
} from './flightdeck-geometry.js';
import { paintSet } from './flightdeck-textures.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const PPM = 2400; // panel canvas resolution (px per metre)
const PPM_DU = 3600; // display units

// ---- layout item helpers -------------------------------------------------------------------
const T = (label, extra = {}) => ({ t: 'toggle', label, ...extra });
const G = (label, extra = {}) => ({ t: 'guard', label, ...extra });
const K = (label, extra = {}) => ({ t: 'knob', label, ...extra });
const A = (text, color = 'amber', extra = {}) => ({ t: 'annun', text, color, ...extra });
const GA = (label, extra = {}) => ({ t: 'gauge', label, ...extra });
const B = (text, extra = {}) => ({ t: 'button', text, ...extra });
const SC = (text, extra = {}) => ({ t: 'screen', text, ...extra });
const TX = (text, extra = {}) => ({ t: 'text', text, ...extra });
const GAP = (w = 1) => ({ t: 'gap', w });
// annunciator lit from panel().ann[...] (core and extension lights)
const an = (k) => (S) => !!S.ann[k];
const ONOFF = ['ON', 'OFF'];

// ---- overhead and pedestal panel layouts -----------------------------------------------------
const LAYOUTS = {
  'fd-flight-controls': { title: 'FLIGHT CONTROL', rowH: [1.3, 0.8, 1.2, 1.3, 0.8, 1.2], rows: [
    [G('FLT CONTROL A', { key: 'sw.fc.a', marks: ONOFF }), G('FLT CONTROL B', { key: 'sw.fc.b', marks: ONOFF })],
    [A('LOW\nPRESSURE', 'amber', { lit: an('fc.a') }), A('LOW\nPRESSURE', 'amber', { lit: an('fc.b') })],
    [G('SPOILER A', { on: true, marks: ONOFF }), G('SPOILER B', { on: true, marks: ONOFF })],
    [G('ALTERNATE FLAPS', { key: 'sw.altflaps', marks: ['ARM', 'OFF'], guardPos: -1 }), T('ALTN FLAPS', { pos: 0, values: ['DOWN', 'OFF', 'UP'], marks: ['DOWN', 'OFF', 'UP'] })],
    [A('FEEL DIFF\nPRESS'), A('SPEED TRIM\nFAIL'), A('MACH TRIM\nFAIL'), A('AUTO SLAT\nFAIL')],
    [T('YAW DAMPER', { on: true, marks: ONOFF }), A('YAW\nDAMPER')],
  ] },
  'fd-nav-displays': { title: 'NAV / DISPLAYS SOURCE', rows: [
    [K('VHF NAV', { values: ['BOTH ON 1', 'NORMAL', 'BOTH ON 2'], v: 'NORMAL', marks: ['1', 'N', '2'] }), K('IRS', { values: ['BOTH ON L', 'NORMAL', 'BOTH ON R'], v: 'NORMAL', marks: ['L', 'N', 'R'] }), K('FMC', { values: ['BOTH ON L', 'NORMAL', 'BOTH ON R'], v: 'NORMAL', marks: ['L', 'N', 'R'] }), K('DISPLAYS', { values: ['ALL ON 1', 'AUTO', 'ALL ON 2'], v: 'AUTO', marks: ['1', 'A', '2'] }), K('CONTROL PNL', { values: ['BOTH ON 1', 'NORMAL', 'BOTH ON 2'], v: 'NORMAL', marks: ['1', 'N', '2'] })],
  ] },
  'fd-fuel': { title: 'FUEL', rowH: [1.4, 1.1, 0.8, 1.2], rows: [
    [GA('FUEL TEMP', { value: 0.45, scale: ['-50', '0', '+50'], gr: 0.55 }), A('ENG VALVE\nCLOSED', 'blue', { lit: (S) => !S.p.eng.run1 }), A('SPAR VALVE\nCLOSED', 'blue', { lit: (S) => !S.p.eng.run1 }), A('SPAR VALVE\nCLOSED', 'blue', { lit: (S) => !S.p.eng.run2 }), A('ENG VALVE\nCLOSED', 'blue', { lit: (S) => !S.p.eng.run2 })],
    [A('FILTER\nBYPASS'), K('CROSSFEED', { key: 'sw.fuel.xfeed', marks: [{ a: -0.8, t: 'CLOSED' }, { a: 0.8, t: 'OPEN' }] }), A('VALVE\nOPEN', 'blue', { lit: an('fuel.xfeed') }), A('FILTER\nBYPASS')],
    ['aft1', 'fwd1', 'ctrl', 'ctrr', 'fwd2', 'aft2'].map((k) => A('LOW\nPRESSURE', 'amber', { lit: an(`fuel.${k}`), ts: 0.17 })),
    [['AFT 1', 'aft1'], ['FWD 1', 'fwd1'], ['CTR L', 'ctrl'], ['CTR R', 'ctrr'], ['FWD 2', 'fwd2'], ['AFT 2', 'aft2']].map(([l, k]) => T(l, { key: `sw.fuel.${k}`, marks: ONOFF })),
  ] },
  'fd-electrical': { title: 'ELECTRICAL', rowH: [0.8, 1.2, 1.2, 0.8, 1.2, 0.8, 1.2, 0.8], rows: [
    [A('BAT\nDISCHARGE', 'amber', { lit: an('elec.batdisch') }), A('TR UNIT'), A('ELEC')],
    [GA('DC AMPS', { value: 0.3, gr: 0.5 }), GA('AC VOLTS', { value: 0.62, gr: 0.5 }), GA('CPS FREQ', { value: 0.6, gr: 0.5 })],
    [K('DC', { values: ['STBY PWR', 'BAT BUS', 'BAT', 'AUX BAT', 'TR1', 'TR2', 'TR3', 'TEST'], v: 'BAT', sweep: 3.2, marks: [] }), G('BAT', { key: 'sw.battery', marks: ONOFF }), K('AC', { values: ['STBY PWR', 'GRD PWR', 'GEN 1', 'APU GEN', 'GEN 2', 'INV', 'TEST'], v: 'GRD PWR', sweep: 3.0, marks: [] })],
    [A('DRIVE', 'amber', { lit: an('elec.drive1') }), A('STANDBY\nPWR OFF', 'amber', { lit: (S) => !S.p.elec.acStby }), A('DRIVE', 'amber', { lit: an('elec.drive2') })],
    [G('STANDBY POWER', { key: 'sw.stbypower', marks: ['AUTO', 'OFF'] }), A('GRD POWER\nAVAILABLE', 'blue', { lit: (S) => !!S.p.elec.avail?.ext }), T('GRD PWR', { key: 'act.elec.ext', marks: ONOFF }), T('BUS TRANSFER', { key: 'sw.bustransfer', marks: ['AUTO', 'OFF'] })],
    [A('TRANSFER\nBUS OFF', 'amber', { lit: an('elec.tbo1') }), A('SOURCE\nOFF', 'amber', { lit: (S) => !S.p.elec.bus1 }), A('SOURCE\nOFF', 'amber', { lit: (S) => !S.p.elec.bus2 }), A('TRANSFER\nBUS OFF', 'amber', { lit: an('elec.tbo2') })],
    [T('GEN 1', { key: 'act.elec.gen1', marks: ONOFF }), T('APU GEN', { key: 'act.elec.apu', marks: ONOFF }), T('APU GEN', { key: 'act.elec.apu', marks: ONOFF }), T('GEN 2', { key: 'act.elec.gen2', marks: ONOFF })],
    [A('GEN OFF\nBUS', 'blue', { lit: (S) => S.p.elec.bus1 !== 'gen1' }), A('APU GEN\nOFF BUS', 'blue', { lit: (S) => S.a.apuGen.state !== 'off' }), GAP(), A('GEN OFF\nBUS', 'blue', { lit: (S) => S.p.elec.bus2 !== 'gen2' })],
  ] },
  'fd-apu': { title: 'APU', rowH: [1.4, 0.9, 1.4], rows: [
    [GA('EGT', { value: (S) => (S.s('apu') ? 0.42 : 0.04), scale: ['0', '5', '10'], gr: 0.55 })],
    [A('MAINT', 'blue'), A('LOW OIL\nPRESSURE'), A('FAULT'), A('OVER\nSPEED')],
    [K('APU', { key: 'apu', marks: [{ a: -0.7, t: 'OFF' }, { a: 0, t: 'ON' }, { a: 0.7, t: 'START' }] })],
  ] },
  'fd-cabin-signs': { rowH: [0.5, 1.1, 0.6, 0.5, 1.2, 0.5, 1.2, 0.9], rows: [
    [TX('EQUIP COOLING', { ts: 0.3 })],
    [T('SUPPLY', { values: ['NORMAL', 'ALTERNATE'], v: 'NORMAL', marks: ['NORM', 'ALTN'] }), A('OFF'), A('OFF'), T('EXHAUST', { values: ['NORMAL', 'ALTERNATE'], v: 'NORMAL', marks: ['NORM', 'ALTN'] })],
    [GAP()],
    [TX('EMERGENCY EXIT LIGHTS', { ts: 0.3 })],
    [G('EMER EXIT LIGHTS', { key: 'sw.emerlights', values: ['ON', 'ARMED', 'OFF'], marks: ['ON', 'ARMED', 'OFF'], guardPos: 0, label: '', name: 'EMERGENCY EXIT LIGHTS' }), A('NOT\nARMED', 'amber', { lit: an('emer.notArmed') })],
    [TX('PASSENGER SIGNS', { ts: 0.3 })],
    [T('NO SMOKING', { values: ['ON', 'AUTO', 'OFF'], v: 'AUTO', marks: ['ON', 'AUTO', 'OFF'] }), T('FASTEN BELTS', { values: ['ON', 'AUTO', 'OFF'], v: 'ON', marks: ['ON', 'AUTO', 'OFF'] })],
    [B('ATTEND'), B('GRD\nCALL')],
  ] },
  'fd-window-probe-heat': { title: 'WINDOW HEAT', rowH: [0.8, 0.8, 1.3, 1.0, 0.5, 1.3, 0.8, 0.8], rows: [
    ['lside', 'lfwd', 'rfwd', 'rside'].map((w) => A('OVERHEAT', 'amber', { lit: an(`wh.ovht.${w}`), ts: 0.17 })),
    ['lside', 'lfwd', 'rfwd', 'rside'].map((w) => A('ON', 'green', { lit: an(`wh.${w}`) })),
    [['L SIDE', 'lside'], ['L FWD', 'lfwd'], ['R FWD', 'rfwd'], ['R SIDE', 'rside']].map(([l, k]) => T(l, { key: `sw.wh.${k}`, marks: ONOFF })),
    [T('TEST', { values: ['OVHT', 'NEUTRAL', 'PWR TEST'], v: 'NEUTRAL', spring: true, marks: ['OVHT', '', 'PWR'] })],
    [TX('PROBE HEAT', { ts: 0.32 })],
    [T('PROBE HEAT A', { key: 'sw.probe.a', marks: ONOFF }), GAP(0.5), T('PROBE HEAT B', { key: 'sw.probe.b', marks: ONOFF })],
    [['CAPT\nPITOT', 'captPitot'], ['L ELEV\nPITOT', 'elevL'], ['L ALPHA\nVANE', 'aoaL'], ['TEMP\nPROBE', 'tat']].map(([t, k]) => A(t, 'amber', { lit: an(`probe.${k}`), ts: 0.17 })),
    [['F/O\nPITOT', 'foPitot'], ['R ELEV\nPITOT', 'elevR'], ['R ALPHA\nVANE', 'aoaR'], ['AUX\nPITOT', 'auxPitot']].map(([t, k]) => A(t, 'amber', { lit: an(`probe.${k}`), ts: 0.17 })),
  ] },
  'fd-anti-ice': { title: 'ANTI-ICE', rowH: [0.9, 0.9, 1.4], rows: [
    [A('L VALVE\nOPEN', 'blue', { lit: (S) => !!(S.p.antiice?.wingL ?? S.ann['ai.wing']) }), A('COWL\nANTI-ICE'), A('COWL\nANTI-ICE'), A('R VALVE\nOPEN', 'blue', { lit: (S) => !!(S.p.antiice?.wingR ?? S.ann['ai.wing']) })],
    [GAP(), A('COWL VALVE\nOPEN', 'blue', { lit: an('ai.cowl1') }), A('COWL VALVE\nOPEN', 'blue', { lit: an('ai.cowl2') }), GAP()],
    [T('WING ANTI-ICE', { key: 'sw.wingai', marks: ONOFF }), T('ENG 1', { key: 'sw.engai1', marks: ONOFF }), T('ENG 2', { key: 'sw.engai2', marks: ONOFF })],
  ] },
  'fd-hydraulics': { title: 'HYDRAULIC PUMPS', rowH: [0.8, 0.8, 1.4], rows: [
    [GAP(), A('OVERHEAT'), A('OVERHEAT'), GAP()],
    [A('LOW\nPRESSURE', 'amber', { lit: an('hyd.eng1') }), A('LOW\nPRESSURE', 'amber', { lit: an('hyd.elec2') }), A('LOW\nPRESSURE', 'amber', { lit: an('hyd.elec1') }), A('LOW\nPRESSURE', 'amber', { lit: an('hyd.eng2') })],
    [T('ENG 1', { key: 'sw.hyd.eng1', marks: ONOFF }), T('ELEC 2', { key: 'sw.hyd.elec2', marks: ONOFF }), T('ELEC 1', { key: 'sw.hyd.elec1', marks: ONOFF }), T('ENG 2', { key: 'sw.hyd.eng2', marks: ONOFF })],
  ] },
  'fd-doors': { title: 'DOORS', rows: [
    [A('FWD\nENTRY', 'amber', { lit: (S) => S.a.doorsAnn.state !== 'off' }), A('FWD\nSERVICE'), A('FWD\nCARGO', 'amber', { lit: (S) => S.a.doorsAnn.state !== 'off' }), A('EQUIP')],
    [A('AFT\nENTRY', 'amber', { lit: (S) => S.a.doorsAnn.state !== 'off' }), A('AFT\nSERVICE'), A('AFT\nCARGO', 'amber', { lit: (S) => S.a.doorsAnn.state !== 'off' }), A('OVERWING')],
  ] },
  'fd-air-conditioning': { title: 'AIR TEMPERATURE', rowH: [1.3, 0.7, 1.2, 1.0], rows: [
    [GA('TEMP', { value: 0.4, scale: ['0', '20', '40', '60'], gr: 0.55 }), K('SOURCE', { values: ['SUPPLY DUCT', 'PASS CAB', 'CONT CAB'], v: 'PASS CAB', marks: ['DUCT', 'PASS', 'CONT'] })],
    [A('ZONE\nTEMP'), A('ZONE\nTEMP'), A('ZONE\nTEMP')],
    [K('CONT CAB', { angle: 0.2, marks: [{ a: -1.3, t: 'C' }, { a: 1.3, t: 'W' }] }), K('FWD CAB', { angle: 0.1, marks: [{ a: -1.3, t: 'C' }, { a: 1.3, t: 'W' }] }), K('AFT CAB', { angle: 0.1, marks: [{ a: -1.3, t: 'C' }, { a: 1.3, t: 'W' }] })],
    [T('TRIM AIR', { on: true, marks: ONOFF }), T('L RECIRC FAN', { on: true, marks: ['AUTO', 'OFF'] }), T('R RECIRC FAN', { on: true, marks: ['AUTO', 'OFF'] })],
  ] },
  'fd-bleed-air': { title: 'BLEED AIR', rowH: [1.2, 0.8, 1.3, 0.8, 1.3], rows: [
    [A('DUAL\nBLEED', 'amber', { lit: an('bleed.dual') }), GA('DUCT PRESS', { value: (S) => (S.p.bleed.left || S.p.bleed.right ? 0.55 : 0.02), scale: ['0', '40', '80'], gr: 0.55 }), A('RAM DOOR\nFULL OPEN', 'blue', { lit: (S) => S.s('onGround') }), A('RAM DOOR\nFULL OPEN', 'blue', { lit: (S) => S.s('onGround') })],
    [A('PACK', 'amber', { lit: an('pack.l') }), A('WING-BODY\nOVERHEAT'), B('TRIP\nRESET'), A('WING-BODY\nOVERHEAT'), A('PACK', 'amber', { lit: an('pack.r') })],
    [T('L PACK', { key: 'sw.pack.l', marks: ['AUTO', 'OFF'] }), K('ISOLATION VALVE', { key: 'sw.iso', values: ['CLOSE', 'AUTO', 'OPEN'] }), T('R PACK', { key: 'sw.pack.r', marks: ['AUTO', 'OFF'] })],
    [A('BLEED\nTRIP OFF', 'amber', { lit: an('bleed.trip1') }), GAP(), A('BLEED\nTRIP OFF', 'amber', { lit: an('bleed.trip2') })],
    [T('1', { key: 'sw.bleed1', marks: ONOFF, label: 'BLEED 1' }), T('APU', { key: 'sw.apubleed', marks: ONOFF, label: 'APU BLEED' }), T('2', { key: 'sw.bleed2', marks: ONOFF, label: 'BLEED 2' })],
  ] },
  'fd-cabin-altitude': { screws: true, rows: [
    [GA('', { gr: 0.78, face: (S) => D.faces.cabinAlt({ alt: S.p.pressurization?.cabinAlt ?? 0, diff: S.p.pressurization?.diff ?? 0 }), w: 1.3 }),
      GA('', { gr: 0.78, face: (S) => D.faces.cabinRate({ rate: S.p.pressurization?.rate ?? 0 }), w: 1.3 }),
      B('ALT HORN\nCUTOUT', { ts: 0.2, w: 0.8 })],
  ] },
  'fd-pressurization': { title: 'PRESSURIZATION', rowH: [1.2, 0.8, 1.4], rows: [
    [SC('', { key: 'press.fltAlt', step: 500, min: -1000, max: 42000, text: (S) => fmtAlt(S.s('press.fltAlt')), top: 'FLT ALT', color: '#ffb21a' }),
      SC('', { key: 'press.landAlt', step: 50, min: -1000, max: 14000, text: (S) => fmtAlt(S.s('press.landAlt')), top: 'LAND ALT', color: '#ffb21a' })],
    [A('AUTO\nFAIL', 'amber', { lit: an('press.autoFail') }), A('OFF SCHED\nDESCENT', 'amber', { lit: an('press.offSched') }), A('ALTN', 'green', { lit: an('press.altn') }), A('MANUAL', 'green', { lit: an('press.manual') })],
    [GA('VALVE', { face: (S) => D.faces.valve({ pos: S.p.pressurization?.outflow ?? 0.5 }), gr: 0.62 }),
      T('FLT / GRD', { values: ['FLT', 'GRD'], v: 'FLT', marks: ['FLT', 'GRD'] }),
      T('OUTFLOW VALVE', { pos: 0, marks: ['CLOSE', '', 'OPEN'], up: 'act.press.ofvClose', down: 'act.press.ofvOpen' }),
      K('MODE', { key: 'press.mode', values: ['AUTO', 'ALTN', 'MAN'], marks: [{ a: -0.8, t: 'AUTO' }, { a: 0, t: 'ALTN' }, { a: 0.8, t: 'MAN' }] })],
  ] },
  'fd-exterior-lights': { rows: [[
    T('L RETRACT', { key: 'light.landing', marks: ONOFF, label: 'RETRACTABLE' }), T('R RETRACT', { key: 'light.landing', marks: ONOFF, label: 'LANDING' }),
    T('L FIXED', { key: 'light.landing', marks: ONOFF, label: 'L FIXED' }), T('R FIXED', { key: 'light.landing', marks: ONOFF, label: 'R FIXED' }),
    T('L TURNOFF', { key: 'light.turnoff', marks: ONOFF, label: 'L RWY TURNOFF' }), T('R TURNOFF', { key: 'light.turnoff', marks: ONOFF, label: 'R RWY TURNOFF' }),
    T('TAXI', { key: 'light.taxi', marks: ONOFF }),
  ]] },
  'fd-exterior-lights-2': { rows: [[
    T('LOGO', { key: 'light.logo', marks: ONOFF }),
    T('POSITION', { values: ['STROBE', 'OFF', 'STEADY'], marks: ['STROBE &\nSTEADY', 'OFF', 'STEADY'],
      get: (S) => (S.s('light.strobe') ? 'STROBE' : S.s('light.nav') ? 'STEADY' : 'OFF'),
      put: (v, set) => { const a = set('light.nav', v !== 'OFF'); set('light.strobe', v === 'STROBE'); return a; } }),
    T('ANTI COLLISION', { key: 'light.beacon', marks: ONOFF }), T('WING', { key: 'light.wing', marks: ONOFF }), T('WHEEL WELL', { on: false, marks: ONOFF }),
  ]] },
  'fd-engine-start': { title: 'ENGINE START', rows: [[
    K('ENG 1', { values: ['GRD', 'OFF', 'CONT', 'FLT'], v: 'OFF', sweep: 2.2, markSize: 0.18 }),
    K('IGNITION', { values: ['IGN L', 'BOTH', 'IGN R'], v: 'IGN L', sweep: 1.6, markSize: 0.17 }),
    K('ENG 2', { values: ['GRD', 'OFF', 'CONT', 'FLT'], v: 'OFF', sweep: 2.2, markSize: 0.18 }),
  ]] },
  // aft overhead
  'fd-irs': { title: 'IRS', rowH: [1, 0.8, 0.8, 1.5], rows: [
    [SC('', { text: () => 'N 47 27.4  E 008 33.1', ts: 0.13, sw: 3.2, color: '#ffb21a' })],
    [A('ALIGN', 'white'), A('ON DC'), A('ALIGN', 'white'), A('ON DC')],
    [A('FAULT'), A('DC FAIL'), A('FAULT'), A('DC FAIL')],
    [K('L IRS', { values: ['OFF', 'ALIGN', 'NAV', 'ATT'], v: 'NAV', sweep: 2.0 }), K('R IRS', { values: ['OFF', 'ALIGN', 'NAV', 'ATT'], v: 'NAV', sweep: 2.0 })],
  ] },
  'fd-le-devices': { title: 'LE DEVICES', rows: [
    [0, 1, 2, 3, 4, 5].map((i) => A('', 'green', { le: i })),
    [6, 7, 8, 9, 10, 11].map((i) => A('', 'green', { le: i })),
    [TX('FLAPS', { ts: 0.25 }), TX('SLATS', { ts: 0.25 }), TX('SLATS', { ts: 0.25 }), TX('FLAPS', { ts: 0.25 })],
  ] },
  'fd-engine-eec': { title: 'ENGINE', rows: [
    [A('REVERSER'), A('REVERSER')],
    [A('ENGINE\nCONTROL'), A('ENGINE\nCONTROL')],
    [B('EEC\nON', { lit: '#e8e2c8' }), B('EEC\nON', { lit: '#e8e2c8' })],
  ] },
  'fd-oxygen': { title: 'OXYGEN', rowH: [1.5, 1.2], rows: [
    [GA('CREW OXYGEN', { gr: 0.62, face: (S) => D.faces.oxygen({ psi: S.p.oxygen?.crewPressure ?? 1800 }) }), A('PASS OXY\nON', 'amber', { lit: an('oxy.paxOn') })],
    [G('PASSENGER OXYGEN', { key: 'sw.oxy.pax', values: ['ON', 'NORMAL'], marks: ['ON', 'NORMAL'], guardPos: -1 })],
  ] },
  // forward electronic panel
  'fd-autobrake': { title: 'AUTO BRAKE', rowH: [1.3, 0.8, 1.6], rows: [
    [GA('', { name: 'BRAKE PRESSURE', gr: 0.62, face: (S) => D.faces.brake({ psi: S.p.gearbrakes?.accumulator ?? 3000 }) })],
    [A('ANTISKID\nINOP', 'amber', { lit: an('gb.antiskidInop') }), A('AUTO BRAKE\nDISARM', 'amber', { lit: an('gb.autobrakeDisarm') })],
    [K('', { name: 'AUTO BRAKE', key: 'sw.autobrake', values: ['OFF', 'RTO', '1', '2', '3', 'MAX'], sweep: 2.4, markSize: 0.2 })],
  ] },
  'fd-mfd': { title: 'MFD', rows: [
    [B('ENG'), B('SYS'), B('C/R')],
    [T('FUEL FLOW', { pos: 0, marks: ['RESET', 'RATE', 'USED'], values: ['RESET', 'RATE', 'USED'], v: 'RATE', spring: true })],
  ] },
  // aft electronic panel (P8)
  'fd-cargo-fire': { title: 'CARGO FIRE', rowH: [1.2, 1], rows: [
    [B('FWD', { bw: 1.2, bh: 0.9, ts: 0.22, toggleKey: 'fire.cargo.armFwd', litFn: (S) => (S.p.fire?.cargoFwd ? '#ff3b2f' : S.s('fire.cargo.armFwd') ? '#e8e2c8' : null), textFn: (S) => (S.s('fire.cargo.armFwd') ? 'FWD\nARMED' : 'FWD') }),
      B('AFT', { bw: 1.2, bh: 0.9, ts: 0.22, toggleKey: 'fire.cargo.armAft', litFn: (S) => (S.p.fire?.cargoAft ? '#ff3b2f' : S.s('fire.cargo.armAft') ? '#e8e2c8' : null), textFn: (S) => (S.s('fire.cargo.armAft') ? 'AFT\nARMED' : 'AFT') }),
      B('DISCH', { bw: 1.2, bh: 0.9, ts: 0.22, key: 'act.fire.cargoDisch', litFn: (S) => (S.p.fire?.bottleCargo ? '#ffb000' : null) })],
    [K('DET SELECT', { values: ['A', 'ORM', 'B'], v: 'ORM', marks: ['A', 'NORM', 'B'] }), B('TEST', { key: 'act.fire.test' }), A('DETECTOR\nFAULT')],
  ] },
  'fd-radio-comm1': { title: 'VHF COMM 1', rows: [[SC('118.700', { color: '#f2f2f2', ts: 0.3, sw: 1.8 }), B('TFR', { bw: 0.8 }), SC('121.500', { color: '#f2f2f2', ts: 0.3, sw: 1.8 })], [K('', { style: 'round', angle: 0, w: 0.6 }), B('VHF1'), B('VHF2'), B('HF'), B('OFF')]] },
  'fd-radio-comm2': { title: 'VHF COMM 2', rows: [[SC('124.350', { color: '#f2f2f2', ts: 0.3, sw: 1.8 }), B('TFR', { bw: 0.8 }), SC('121.500', { color: '#f2f2f2', ts: 0.3, sw: 1.8 })], [K('', { style: 'round', angle: 0, w: 0.6 }), B('VHF1'), B('VHF2'), B('HF'), B('OFF')]] },
  'fd-radio-nav1': { title: 'NAV 1', rows: [[SC('110.30', { color: '#f2f2f2', ts: 0.3, sw: 1.6 }), B('TFR', { bw: 0.8 }), SC('113.70', { color: '#f2f2f2', ts: 0.3, sw: 1.6 })], [K('', { style: 'round', angle: 0 }), B('TEST')]] },
  'fd-radio-nav2': { title: 'NAV 2', rows: [[SC('108.90', { color: '#f2f2f2', ts: 0.3, sw: 1.6 }), B('TFR', { bw: 0.8 }), SC('115.20', { color: '#f2f2f2', ts: 0.3, sw: 1.6 })], [K('', { style: 'round', angle: 0 }), B('TEST')]] },
  'fd-acp': { title: 'AUDIO CONTROL', rows: [['VHF1', 'VHF2', 'VHF3', 'HF1', 'FLT', 'SERV', 'PA'].map((t) => B(t, { ts: 0.22 })), ['V1', 'V2', 'V3', 'HF', 'FL', 'SV', 'PA'].map((t) => K(t, { style: 'round', angle: -0.4, scale: 0.8 })), [T('R/T - I/C', { pos: 0, marks: ['R/T', '', 'I/C'] }), K('MASK/BOOM', { values: ['MASK', 'BOOM'], v: 'BOOM', marks: ['MASK', 'BOOM'] }), K('FILTER', { values: ['V', 'B', 'R'], v: 'B', marks: ['V', 'B', 'R'] })]] },
  'fd-atc': { title: 'ATC / TCAS', rows: [[SC('2000', { color: '#f2f2f2', ts: 0.32, sw: 1.6 }), B('IDENT'), T('ALT SOURCE', { values: ['1', '2'], v: '1', marks: ['1', '2'] })], [K('MODE', { values: ['STBY', 'ALT OFF', 'XPNDR', 'TA ONLY', 'TA/RA'], v: 'TA/RA', sweep: 2.4, markSize: 0.16 }), K('', { style: 'round', angle: 0 }), K('', { style: 'round', angle: 0 })]] },
  'fd-trim-panel': { title: 'RUDDER / AILERON TRIM', rows: [[GA('RUDDER', { value: 0.5, scale: ['L', '0', 'R'], gr: 0.5 }), K('RUDDER TRIM', { angle: 0, marks: [{ a: -0.9, t: 'NOSE L' }, { a: 0.9, t: 'NOSE R' }] }), T('AILERON', { pos: 0, marks: ['', '', ''] }), T('AILERON', { pos: 0, marks: ['', '', ''] })]] },
  'fd-door-lock': { title: 'FLT DECK DOOR', rows: [[K('', { values: ['UNLKD', 'AUTO', 'DENY'], v: 'AUTO', marks: ['UNLKD', 'AUTO', 'DENY'] }), A('LOCK\nFAIL'), A('AUTO\nUNLK')]] },
  // control stand
  'fd-parking-brake-light': { screws: false, rows: [[A('PARKING\nBRAKE', 'red', { lit: an('gb.parkBrake'), aw: 1.5, ah: 0.75, ts: 0.22 })]] },
  'fd-stab-cutout': { title: 'STAB TRIM', rows: [[G('MAIN ELECT', { on: true, marks: ['NORMAL', 'CUTOUT'] }), G('AUTO PILOT', { on: true, marks: ['NORMAL', 'CUTOUT'] })]] },
};
// warning / status lights on the captain's and F/O's panels
const WARN_LIGHTS = { screws: false, rows: [
  [A('TAKEOFF\nCONFIG', 'red', { ts: 0.2 })],
  [A('CABIN\nALTITUDE', 'red', { lit: an('press.cabinAlt'), ts: 0.2 })],
] };
const STATUS_STRIP = { screws: false, rows: [[
  A('SPEED BRAKE\nARMED', 'green', { lit: (S) => S.a.sbArmed.state !== 'off', ts: 0.16 }),
  A('SPEED BRAKE\nDO NOT ARM', 'amber', { ts: 0.16 }),
  A('SPEEDBRAKE\nEXTENDED', 'amber', { lit: (S) => S.a.sbExt.state !== 'off', ts: 0.16 }),
  A('STAB OUT\nOF TRIM', 'amber', { ts: 0.16 }),
  A('BELOW\nG/S', 'amber', { ts: 0.16 }),
  A('A/P', 'red', { ts: 0.2 }), A('A/T', 'red', { ts: 0.2 }), A('FMC', 'amber', { ts: 0.2 }),
]] };
const DISPLAY_SELECT = { screws: true, rows: [
  [K('MAIN PANEL DUs', { values: ['OUTBD PFD', 'NORM', 'ENG PRI', 'PFD', 'MFD'], v: 'NORM', sweep: 2.4, markSize: 0.15, ls: 0.17 })],
  [K('LOWER DU', { values: ['ENG PRI', 'NORM', 'ND'], v: 'NORM', sweep: 1.6, markSize: 0.15, ls: 0.17 })],
] };
const FIRE_HANDLE_X = [0.2, 0.5, 0.8];
const FIRE_PANEL = { title: 'FIRE PROTECTION', rowH: [1.1, 1.7, 1.0], rows: [
  [T('OVHT DET', { values: ['A', 'NORMAL', 'B'], v: 'NORMAL', marks: ['A', 'N', 'B'], scale: 0.85 }),
    A('ENG 1\nOVERHEAT', 'amber', { lit: (S) => !!(S.p.fire?.ovht1 || S.p.fire?.testing), ts: 0.17 }),
    A('WHEEL\nWELL', 'red', { lit: (S) => !!S.p.fire?.wheelwell, ts: 0.17 }),
    A('FAULT', 'amber', { lit: (S) => !!S.p.fire?.testing, ts: 0.18 }),
    B('BELL\nCUTOUT', { key: 'act.fire.bellCutout', ts: 0.18 }),
    T('TEST', { pos: 0, marks: ['FAULT/\nINOP', '', 'OVHT/\nFIRE'], up: 'act.fire.test', down: 'act.fire.test', scale: 0.85 }),
    A('APU DET\nINOP', 'amber', { ts: 0.17 }),
    A('ENG 2\nOVERHEAT', 'amber', { lit: (S) => !!(S.p.fire?.ovht2 || S.p.fire?.testing), ts: 0.17 }),
    T('OVHT DET', { values: ['A', 'NORMAL', 'B'], v: 'NORMAL', marks: ['A', 'N', 'B'], scale: 0.85 })],
  [GAP()],
  [A('L BOTTLE\nDISCHARGE', 'amber', { lit: (S) => !!S.p.fire?.bottleL, ts: 0.17 }),
    A('APU BOTTLE\nDISCHARGE', 'amber', { lit: (S) => !!S.p.fire?.bottleApu, ts: 0.17 }),
    A('R BOTTLE\nDISCHARGE', 'amber', { lit: (S) => !!S.p.fire?.bottleR, ts: 0.17 }),
    T('EXT TEST', { pos: 0, marks: ['1', '', '2'], scale: 0.85 })],
], after(ctx, W, H) {
  // handle wells with legends and discharge arrows
  const y = H * 0.5;
  FIRE_HANDLE_X.forEach((fx, i) => {
    const x = W * fx;
    ctx.fillStyle = '#121418'; rrect(ctx, x - W * 0.085, y - H * 0.12, W * 0.17, H * 0.24, H * 0.04); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 2; ctx.stroke();
    const lab = ['ENG 1', 'APU', 'ENG 2'][i];
    drawLabel(ctx, i === 1 ? 'DISCH' : 'L', x - W * 0.11, y - H * 0.16, H * 0.05, '#f4f3ee');
    drawLabel(ctx, i === 1 ? 'DISCH' : 'R', x + W * 0.11, y - H * 0.16, H * 0.05, '#f4f3ee');
    drawLabel(ctx, lab, x, y + H * 0.17, H * 0.05, '#f4f3ee');
    ctx.strokeStyle = '#f4f3ee'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, W * 0.1, Math.PI * 1.15, Math.PI * 1.4); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, W * 0.1, Math.PI * 1.6, Math.PI * 1.85); ctx.stroke();
  });
} };

const fmtAlt = (v) => { const n = Math.round(Number(v) || 0); return (n < 0 ? '-' : '') + String(Math.abs(n)).padStart(5, '0'); };
const pad3 = (n) => String(Math.round(((n % 360) + 360) % 360) || 360).padStart(3, '0');

// ---- builder -------------------------------------------------------------------------------------
export function buildFlightDeck(systems) {
  const root = new THREE.Group();
  root.name = 'b738-flightdeck';
  const mats = makeMaterials();
  const kit = createControlKit(mats);
  const paintNormal = paintSet().normal;
  let night = false;

  // local fallback for keys whose extension isn't loaded (keeps the switch usable)
  const local = {};
  const getS = (k) => (k in systems.state ? systems.state[k] : local[k]);
  const trySet = (k, v) => {
    const r = systems.set(k, v);
    if (!r.ok && /Unknown control/.test(r.message || '')) { local[k] = v; return { ok: true }; }
    return r;
  };

  // one snapshot of the systems per frame, shared by every panel
  let S = null;
  const snap = () => {
    if (S) return S;
    const p = systems.panel();
    S = { p, ann: p.ann || {}, a: systems.annunciators(), s: getS };
    return S;
  };

  // ---- world, shell, glareshield
  const outside = buildOutside(root);
  outside.setNight(false);
  buildShell(root, mats);
  buildGlareshield(root, mats);

  // ---- lights
  const hemi = new THREE.HemisphereLight(0xe4edf7, 0x4a4844, 0.4);
  root.add(hemi);
  const dome = new THREE.PointLight(0xfff1dc, 0.6, 3.5, 2);
  dome.position.set(-0.35, 1.95, 0); root.add(dome);
  const spot = (pos, target, color, angle = 0.8) => {
    const l = new THREE.SpotLight(color, 0, 3, angle, 0.6, 2);
    l.position.copy(pos); l.target.position.copy(target); root.add(l, l.target); return l;
  };
  const floods = [
    spot(V(0.7, 0.965, -0.5), V(0.92, 0.7, -0.55), 0xffe2b8), // glareshield floods onto the main panel
    spot(V(0.7, 0.965, 0.5), V(0.92, 0.7, 0.55), 0xffe2b8),
    spot(V(0.0, 1.98, 0), V(0.25, 0.55, 0), 0xffe7c4, 0.6), // pedestal flood from the aft overhead
    spot(V(-0.3, 1.5, 0), V(0.3, 1.85, 0), 0xffe7c4, 0.9), // overhead panel flood
  ];

  // ---- zone helpers
  const zones = []; // { mesh, refresh(force) }
  function facing(pos, dir, parent = root) {
    const g = new THREE.Group();
    g.position.copy(pos);
    parent.add(g);
    g.lookAt(pos.clone().add(dir.clone().normalize()));
    return g;
  }
  const overlayMat = (tex) => {
    const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    m.color.setScalar(1.7);
    return m;
  };
  function bezel(parent, w, h, x, y, border = 0.014, depth = 0.012) {
    const s = new THREE.Shape();
    const W2 = w / 2 + border, H2 = h / 2 + border;
    s.moveTo(-W2, -H2); s.lineTo(W2, -H2); s.lineTo(W2, H2); s.lineTo(-W2, H2); s.closePath();
    const hole = new THREE.Path(); hole.moveTo(-w / 2, -h / 2); hole.lineTo(-w / 2, h / 2); hole.lineTo(w / 2, h / 2); hole.lineTo(w / 2, -h / 2); hole.closePath();
    s.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2 });
    const m = new THREE.Mesh(geo, mats.frame);
    m.position.set(x, y, 0); m.castShadow = true; m.receiveShadow = true;
    parent.add(m);
    // glass cover: faint reflections over the display
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshPhysicalMaterial({ color: '#0a0c0e', transparent: true, opacity: 0.1, roughness: 0.12, metalness: 0, depthWrite: false, envMapIntensity: 0.5 }));
    glass.position.set(x, y, 0.008); glass.raycast = () => {}; glass.renderOrder = 3;
    parent.add(glass);
    return m;
  }

  /**
   * A painted zone. `drawer` is a layout object (rows of controls) or a function
   * (ctx, W, H, state, glowCtx). opts: { screen, state(), regions, side, ppm, z }
   */
  function zone(parent, partId, w, h, x, y, drawer, opts = {}) {
    const layout = typeof drawer === 'function' ? null : drawer;
    const ppm = opts.ppm || (opts.screen ? PPM_DU : PPM);
    const canvas = makeCanvas(w, h, ppm);
    const tex = canvasTexture(canvas);
    const glowCanvas = opts.screen ? null : makeCanvas(w, h, ppm);
    const glowTex = glowCanvas ? canvasTexture(glowCanvas) : null;
    const overrides = {};
    let controls = [];
    const slots = new Map(); // control index -> 3D parts
    const normal = paintNormal.clone(); normal.repeat.set(w / 0.05, h / 0.05); normal.needsUpdate = true;
    const mat = opts.screen
      ? new THREE.MeshStandardMaterial({ color: '#000000', roughness: 0.95, metalness: 0, emissive: new THREE.Color('#ffffff'), emissiveMap: tex, emissiveIntensity: 1.15 })
      : new THREE.MeshStandardMaterial({ map: tex, roughness: 0.62, metalness: 0.04, normalMap: normal, normalScale: new THREE.Vector2(0.25, 0.25), emissive: new THREE.Color('#161616'), emissiveMap: tex });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(x, y, opts.z ?? 0.004);
    m.receiveShadow = true;
    if (partId) { m.userData.partId = partId; m.userData.side = opts.side || 'C'; }
    parent.add(m);
    if (!opts.screen) {
      // light-plate edge for depth
      const edge = new THREE.Mesh(new THREE.BoxGeometry(w + 0.004, h + 0.004, 0.006), mats.panelDark);
      edge.position.set(x, y, (opts.z ?? 0.004) - 0.0032); parent.add(edge);
    }
    let overlay = null;
    if (glowTex) {
      overlay = new THREE.Mesh(new THREE.PlaneGeometry(w, h), overlayMat(glowTex));
      overlay.position.set(x, y, (opts.z ?? 0.004) + 0.0008); overlay.raycast = () => {}; overlay.renderOrder = 1;
      parent.add(overlay);
    }

    let last = null;
    function paint(force = false) {
      if (layout) {
        const res = resolveLayout(layout, snap(), overrides);
        const sig = res.sig + (night ? 'N' : 'D');
        if (!force && sig === last) return;
        last = sig;
        controls = paintPanel(canvas, res.layout, { glow: glowCanvas, night, solid: true });
        place3D(res.layout);
      } else {
        const st = { ...(opts.state ? opts.state() : {}), night };
        const sig = JSON.stringify(st);
        if (!force && sig === last) return;
        last = sig;
        drawer(canvas.getContext('2d'), canvas.width, canvas.height, st, glowCanvas?.getContext('2d'));
      }
      tex.needsUpdate = true;
      if (glowTex) glowTex.needsUpdate = true;
    }
    // 3D toggles / guards / knobs on top of the painted bases
    function place3D(lay) {
      const px2m = w / canvas.width;
      controls.forEach((c, i) => {
        const t = c.it.t;
        if (t !== 'toggle' && t !== 'guard' && t !== 'knob') return;
        let sl = slots.get(i);
        const lx = x + (c.x - 0.5) * w, ly = y + (0.5 - c.y) * h, lz = (opts.z ?? 0.004) + 0.001;
        const sc = c.u * px2m;
        if (!sl) {
          sl = {};
          if (t === 'knob') {
            if (c.it.style === 'round') sl.knob = kit.add('knobRound', parent, lx, ly, lz, sc * 0.8);
            else { sl.knob = kit.add('knob', parent, lx, ly, lz, sc); sl.line = kit.add('knobLine', parent, lx, ly, lz, sc); }
          } else {
            sl.nut = kit.add('nut', parent, lx, ly, lz, sc);
            sl.lever = kit.add('lever', parent, lx, ly, lz, sc * 1.05);
            if (t === 'guard') sl.guard = kit.add('guard', parent, lx, ly + sc * 0.62, lz, sc);
          }
          slots.set(i, sl);
        }
        if (t === 'knob') {
          const a = c.it.angle ?? -0.6;
          sl.knob.set(0, -a); sl.line?.set(0, -a);
        } else {
          const pos = c.it.pos !== undefined ? c.it.pos : c.it.on ? 1 : -1;
          sl.nut.set(0, 0);
          sl.lever.set(-0.5 * pos, 0);
          if (sl.guard) sl.guard.set(pos === (c.it.guardPos ?? 1) ? 0 : -1.95, 0);
        }
      });
      void lay;
    }
    paint(true);

    if (layout) {
      const OPERABLE = new Set(['toggle', 'guard', 'knob', 'button']);
      const hit = (uv) => {
        if (!uv) return null;
        const px = uv.x, py = 1 - uv.y;
        const c = controls.find((cc) => (OPERABLE.has(cc.it.t) || (cc.it.t === 'screen' && cc.it.key)) && ((px - cc.x) / (cc.rx * (cc.it.t === 'screen' ? 1.6 : 1))) ** 2 + ((py - cc.y) / cc.ry) ** 2 <= 1);
        return c ? { c, upper: py < c.y, src: layout.rows[c.ri][c.ci], id: `${c.ri},${c.ci}` } : null;
      };
      m.userData.hint = (uv) => { const h = hit(uv); return h ? hintFor(h.src, h.c.it, overrides[h.id]) : null; };
      m.userData.interact = ({ uv, shift }) => {
        const h = hit(uv);
        if (!h) return null;
        const r = operate(h.src, h.c.it, h.id, overrides, { shift, upper: h.upper, repaint: () => { S = null; paint(true); } }) || {};
        S = null; paint(true);
        return { handled: true, ok: r.ok !== false, message: r.message };
      };
      m.userData.wheel = ({ uv, dir }) => {
        const h = hit(uv);
        if (!h) return null;
        const it = h.src;
        if (!(it.t === 'knob' && it.values) && !(it.t === 'screen' && it.key)) return null;
        operate(it, h.c.it, h.id, overrides, { shift: dir < 0, wheel: true });
        S = null; paint(true);
        return { handled: true };
      };
    }
    if (opts.regions) {
      const find = (uv) => {
        if (!uv) return null;
        const px = uv.x, py = 1 - uv.y;
        return opts.regions.find((r) => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) || null;
      };
      m.userData.hint = (uv) => { const r = find(uv); return r ? (typeof r.hint === 'function' ? r.hint() : r.hint) : null; };
      m.userData.interact = ({ uv, shift }) => {
        const r = find(uv);
        if (!r?.act) return null;
        const res = r.act(shift) || {};
        S = null; paint(true);
        return { handled: true, ok: res.ok !== false, message: res.message };
      };
      m.userData.wheel = ({ uv, dir }) => {
        const r = find(uv);
        if (!r?.wheel) return null;
        r.wheel(dir); S = null; paint(true);
        return { handled: true };
      };
    }
    const dynamic = !!(layout || opts.state);
    zones.push({ mesh: m, refresh: (force) => { if (dynamic || force) paint(force); } });
    return m;
  }

  // ---- layout resolution: live values for every control
  function resolveLayout(layout, S0, overrides) {
    const sig = [];
    const rows = layout.rows.map((row, ri) => row.map((it, ci) => {
      const o = overrides[`${ri},${ci}`] || {};
      const out = { ...it };
      // multi-position value (state key, get(), or a local value)
      let val;
      if (it.get) val = it.get(S0);
      else if (it.key && it.values) val = S0.s(it.key);
      else if (it.values) val = o.v ?? it.v ?? it.values[0];
      if (it.values && (it.t === 'toggle' || it.t === 'guard')) {
        const i = Math.max(0, it.values.indexOf(val));
        out.pos = o.pos ?? (it.values.length === 3 ? [1, 0, -1][i] : i === 0 ? 1 : -1);
      } else if (it.t === 'toggle' || it.t === 'guard') {
        if (o.pos !== undefined) out.pos = o.pos;
        else if (it.key?.startsWith('act.elec.')) out.on = [S0.p.elec.bus1, S0.p.elec.bus2].includes(it.key.slice(9));
        else if (it.key) out.on = !!S0.s(it.key);
        else if (o.on !== undefined) out.on = o.on;
      }
      if (it.t === 'knob') {
        if (it.values) {
          const n = it.values.length, i = Math.max(0, it.values.indexOf(val)), sw = it.sweep ?? 1.6;
          out.angle = it.angles ? it.angles[i] : n === 1 ? 0 : -sw / 2 + (i / (n - 1)) * sw;
          if (!it.marks) out.marks = it.values;
        } else if (it.key === 'apu') out.angle = S0.s('apu') ? 0 : -0.7;
        else if (it.key) out.angle = S0.s(it.key) ? 0.8 : -0.8;
        else if (o.angle !== undefined) out.angle = o.angle;
      }
      if (it.t === 'annun') {
        if (it.le !== undefined) { const le = leState(); out.lit = le > 0; out.color = le === 1 ? 'amber' : 'green'; } else out.lit = it.lit ? !!it.lit(S0) : false;
      }
      if (it.t === 'button') {
        out.lit = o.lit !== undefined ? o.lit : it.litFn ? it.litFn(S0) : it.lit ?? null;
        if (it.textFn) out.text = it.textFn(S0);
      }
      if (it.t === 'screen' && typeof it.text === 'function') out.text = it.text(S0);
      if (it.t === 'gauge') {
        if (typeof it.value === 'function') out.value = it.value(S0);
        if (it.face) { const f = it.face(S0); out.face = f; sig.push(String(f)); }
      }
      sig.push(out.pos ?? '', out.on ? 1 : 0, out.angle ?? '', out.lit ?? '', out.text ?? '', out.value ?? '');
      return out;
    }));
    // gauge faces are closures; include their inputs via the panel snapshot of pressurization/oxygen/brakes
    const pz = S0.p.pressurization, ox = S0.p.oxygen, gb = S0.p.gearbrakes;
    if (layout.rows.some((r) => r.some((it) => it.face))) sig.push(pz?.cabinAlt, pz?.diff, pz?.rate, pz?.outflow, ox?.crewPressure, gb?.accumulator);
    return { layout: { ...layout, rows }, sig: sig.join('|') };
  }
  const leState = () => { const a = snap().a; return a.leTransit.state !== 'off' ? 1 : a.leExt.state !== 'off' ? 2 : 0; };

  const nm = (it) => String(it.name || it.label || (typeof it.text === 'string' ? it.text : '') || it.top || '').replace(/\n/g, ' ').trim() || 'Selector';
  function curValue(src, res, o) {
    if (src.get) return src.get(snap());
    if (src.values) return src.key ? getS(src.key) : (o?.v ?? src.v ?? src.values[0]);
    if (src.key) return getS(src.key);
    return null;
  }
  function hintFor(src, res, o) {
    const k = src.key || '';
    const live = k.startsWith('light.') || k === 'apu' ? ' (linked to aircraft)' : k || src.get || src.up || src.toggleKey ? ' (live systems)' : '';
    const v = curValue(src, res, o);
    const pos = src.values ? ` · ${String(v).replace(/\n/g, ' ')}` : (src.t === 'toggle' || src.t === 'guard') && k && !k.startsWith('act.') ? ` · ${v ? (src.marks?.[0] || 'ON') : (src.marks?.[1] || 'OFF')}` : '';
    if (src.t === 'screen') return `${nm(src)} ${res.text} · click +, Shift+click −, or scroll${live}`;
    if (src.up) return `${nm(src)} · click upper half: ${(src.marks?.[0] || 'up').replace(/\n/g, '')}, lower half: ${(src.marks?.[2] || 'down').replace(/\n/g, '')}${live}`;
    if (src.t === 'knob' && src.values) return `${nm(src)}${pos} · click next, Shift+click back, or scroll${live}`;
    if ((src.t === 'toggle' || src.t === 'guard') && src.values?.length === 3) return `${nm(src)}${pos} · click upper half to move up, lower half to move down${src.t === 'guard' ? ' (guarded)' : ''}${live}`;
    return `${nm(src)}${pos} · click to ${src.t === 'button' ? 'press' : src.t === 'knob' ? 'turn' : 'switch'}${src.t === 'guard' ? ' (guarded)' : ''}${live}`;
  }
  function operate(src, res, id, overrides, { shift, upper, wheel, repaint }) {
    const o = (overrides[id] = overrides[id] || {});
    const step = (list, cur, d) => list[Math.max(0, Math.min(list.length - 1, list.indexOf(cur) + d))];
    const momentary = (pos) => { o.pos = pos; setTimeout(() => { delete o.pos; repaint?.(); }, 450); };
    if (src.t === 'screen' && src.key) {
      const cur = Number(getS(src.key)) || 0;
      const nv = Math.max(src.min ?? -Infinity, Math.min(src.max ?? Infinity, cur + (shift ? -1 : 1) * src.step));
      return trySet(src.key, nv);
    }
    if (src.t === 'button') {
      if (src.toggleKey) return trySet(src.toggleKey, !getS(src.toggleKey));
      const r = src.key ? trySet(src.key, true) : { ok: true };
      if (!src.litFn) { o.lit = '#e8e2c8'; setTimeout(() => { delete o.lit; repaint?.(); }, 220); }
      return r;
    }
    if (src.up) { // spring-loaded: upper half / lower half
      momentary(upper ? 1 : -1);
      const k = upper ? src.up : src.down;
      return k ? trySet(k, true) : { ok: true };
    }
    if (src.values) {
      const cur = curValue(src, res, o);
      let next;
      if ((src.t === 'toggle' || src.t === 'guard') && src.values.length === 3) next = step(src.values, cur, upper ? -1 : 1);
      else if (src.t === 'toggle' || src.t === 'guard') next = src.values[(src.values.indexOf(cur) + 1) % src.values.length];
      else next = wheel ? step(src.values, cur, shift ? -1 : 1) : shift ? step(src.values, cur, -1) : src.values[(src.values.indexOf(cur) + 1) % src.values.length];
      if (src.spring) { momentary(src.values.indexOf(next) === 0 ? 1 : -1); return { ok: true }; }
      if (src.put) return src.put(next, trySet);
      if (src.key) return trySet(src.key, next);
      o.v = next; return { ok: true };
    }
    if (src.key) {
      if (src.key.startsWith('act.')) return trySet(src.key, true);
      if (src.key === 'apu') return trySet('apu', !getS('apu'));
      return trySet(src.key, !getS(src.key));
    }
    if (src.t === 'toggle' || src.t === 'guard') { o.on = !(o.on ?? src.on ?? false); return { ok: true }; }
    if (src.t === 'knob') { const steps = [-0.8, 0, 0.8]; const cur = o.angle ?? src.angle ?? -0.6; const i = steps.findIndex((s) => s > cur + 0.01); o.angle = i === -1 ? steps[0] : steps[i]; }
    return { ok: true };
  }

  // ---- cockpit-only state: MCP settings, EFIS ranges and master caution memory
  const fd = {
    mcp: { spd: 250, hdg: 10, alt: 10000, vs: 0, crs: 10, modes: [], cmdA: false, cmdB: false, at: false, fdL: true, fdR: true },
    range: { L: 20, R: 20 },
    ack: null, recallUntil: 0, t: 0,
  };
  function cautionState() {
    const { cats } = snap().p;
    if (!fd.ack) fd.ack = new Set(cats);
    for (const c of [...fd.ack]) if (!cats.has(c)) fd.ack.delete(c);
    const fresh = [...cats].filter((c) => !fd.ack.has(c));
    const recall = fd.t < fd.recallUntil;
    return { mc: fresh.length > 0 || (recall && cats.size > 0), six: recall ? [...cats] : fresh, fire: !!snap().p.fire?.warn };
  }

  // MCP behaviour
  const MCP_GROUPS = [['N1', 'SPEED'], ['VNAV', 'LVL CHG', 'ALT HLD', 'V/S'], ['HDG SEL', 'LNAV', 'VOR LOC', 'APP']];
  const STEP = { spd: 5, hdg: 5, alt: 500, vs: 100, crs: 5 };
  function adjust(id, dir) {
    const m = fd.mcp;
    if (id === 'hdg' || id === 'crs') m[id] = ((m[id] + dir * STEP[id]) % 360 + 360) % 360 || 360;
    else if (id === 'spd') m.spd = Math.max(100, Math.min(340, m.spd + dir * STEP.spd));
    else if (id === 'alt') m.alt = Math.max(0, Math.min(41000, m.alt + dir * STEP.alt));
    else if (id === 'vs') m.vs = Math.max(-6000, Math.min(6000, m.vs + dir * STEP.vs));
  }
  function pressMode(mode) {
    const m = fd.mcp;
    if (mode === 'CMD A' || mode === 'CMD B') {
      const k = mode === 'CMD A' ? 'cmdA' : 'cmdB', other = mode === 'CMD A' ? 'cmdB' : 'cmdA';
      if (!m[k] && m[other] && !m.modes.includes('APP')) {
        return { ok: false, message: 'Both autopilots engage together only for an approach. Arm APP first, then engage the second autopilot.' };
      }
      m[k] = !m[k];
      return {};
    }
    if (mode === 'CWS A' || mode === 'CWS B') return { ok: true, message: 'Control wheel steering is not modelled here.' };
    if (m.modes.includes(mode)) { m.modes = m.modes.filter((x) => x !== mode); return {}; }
    const group = MCP_GROUPS.find((g) => g.includes(mode)) || [];
    m.modes = m.modes.filter((x) => !group.includes(x));
    if (mode === 'APP') m.modes = m.modes.filter((x) => !MCP_GROUPS[1].includes(x));
    m.modes.push(mode);
    return {};
  }
  function fma() {
    const m = fd.mcp, has = (x) => m.modes.includes(x);
    const thrust = !m.at ? '' : has('N1') || has('LVL CHG') ? 'N1' : has('SPEED') ? 'MCP SPD' : has('VNAV') ? 'FMC SPD' : 'ARM';
    const roll = has('HDG SEL') ? 'HDG SEL' : has('LNAV') ? 'LNAV' : has('VOR LOC') || has('APP') ? 'VOR/LOC' : '';
    const pitch = has('VNAV') ? 'VNAV PTH' : has('LVL CHG') ? 'MCP SPD' : has('ALT HLD') ? 'ALT HOLD' : has('V/S') ? 'V/S' : has('APP') ? 'G/S' : '';
    return [thrust, roll, pitch];
  }
  const winById = Object.fromEntries(D.MCP.windows.map((w) => [w.id, w]));
  const mcpRegions = [
    ...D.MCP.knobs.map((k) => {
      const w = winById[k.id];
      const x0 = Math.min(w.x, k.x - 0.03), x1 = Math.max(w.x + w.w, k.x + 0.03);
      return { x: x0, y: 0.05, w: x1 - x0, h: 0.9, hint: `${w.label} · click +, Shift+click −, or scroll`, act: (shift) => adjust(w.key, shift ? -1 : 1), wheel: (dir) => adjust(w.key, dir) };
    }),
    ...D.MCP.buttons.map(([t, x, y]) => ({ x: x - D.MCP.btnW / 2, y: y - D.MCP.btnH / 2, w: D.MCP.btnW, h: D.MCP.btnH, hint: `${t} · click to ${t.startsWith('CMD') ? 'engage / disengage' : 'select'}`, act: () => pressMode(t) })),
    ...D.MCP.toggles.map(([key, lab, x]) => ({ x: x - 0.02, y: 0.5, w: 0.04, h: 0.45, hint: () => `${lab} switch · ${fd.mcp[key] ? 'ON' : 'OFF'} · click to toggle`, act: () => { fd.mcp[key] = !fd.mcp[key]; } })),
    { x: 0.83, y: 0.84, w: 0.08, h: 0.12, hint: 'A/P DISENGAGE bar · click to disengage the autopilots', act: () => { fd.mcp.cmdA = fd.mcp.cmdB = false; } },
  ];
  // the regions must be checked buttons first (they sit inside the wide knob columns)
  mcpRegions.sort((a, b) => a.w * a.h - b.w * b.h);
  const mcRegions = [
    { x: 0.54, y: 0.08, w: 0.38, h: 0.38, hint: 'MASTER CAUTION · click to reset', act: () => { fd.ack = new Set(snap().p.cats); fd.recallUntil = 0; } },
    { x: 0.08, y: 0.08, w: 0.38, h: 0.38, hint: 'FIRE WARN · lit with a fire warning · press to silence the bell and reset', act: () => trySet('act.fire.bellCutout', true) },
    { x: 0.05, y: 0.54, w: 0.92, h: 0.42, hint: 'System annunciator · click to recall cautions', act: () => { fd.recallUntil = fd.t + 2.5; } },
  ];

  // ---- main instrument panel (P1 / P2 / P3)
  const mainPanel = facing(V(0.88, 0.8, 0), V(-1, 0.2, 0));
  {
    // panel body with the centre section running down to the pedestal
    const s = new THREE.Shape();
    s.moveTo(-0.98, 0.28); s.lineTo(0.98, 0.28); s.lineTo(0.98, -0.25); s.lineTo(0.36, -0.27); s.lineTo(0.34, -0.42); s.lineTo(-0.34, -0.42); s.lineTo(-0.36, -0.27); s.lineTo(-0.98, -0.25); s.closePath();
    const body = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2 }), mats.panel);
    body.position.z = -0.04; body.castShadow = true; body.receiveShadow = true;
    mainPanel.add(body);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.66, 1.98), mats.panelDark);
    back.position.set(1.06, 0.76, 0); root.add(back);
  }
  const air = () => !getS('onGround');
  const altNow = () => (air() ? Number(getS('altitude')) || 35000 : 0);
  const iasNow = () => (air() ? (altNow() > 20000 ? 280 : 250) : 0);
  const pfdState = () => {
    const st = systems.state;
    const m = fd.mcp, alt = altNow(), ias = iasNow();
    const tas = ias * (1 + alt / 1000 * 0.02);
    return {
      pitch: air() ? 2.5 + st.pitch * 6 : st.pitch * 3, bank: air() ? -st.roll * 18 : 0, speed: ias, alt: Math.round(alt), hdg: 10, vs: 0,
      mach: tas / (alt > 36000 ? 573 : 661 - alt * 0.0024), onGround: !air(), selHdg: m.hdg,
      fma: fma(), armed: ['', m.modes.includes('VOR LOC') || m.modes.includes('APP') ? 'VOR/LOC' : '', m.modes.includes('APP') ? 'G/S' : ''],
      cmd: m.cmdA || m.cmdB ? 'CMD' : m.fdL || m.fdR ? 'FD' : '', fd: m.fdL || m.fdR, fdP: 0, fdR: 0, selSpd: m.spd, selAlt: m.alt,
    };
  };
  const ndState = (side) => () => {
    const ias = iasNow(), alt = altNow();
    const tas = ias * (1 + alt / 1000 * 0.02);
    return { hdg: fd.mcp.hdg, trk: 10, hdgSel: fd.mcp.modes.includes('HDG SEL'), range: fd.range[side], gs: air() ? tas - 20 : 0, tas: air() ? tas : 0 };
  };
  for (const s of [-1, 1]) {
    const side = s < 0 ? 'L' : 'R';
    bezel(mainPanel, 0.205, 0.205, s * 0.65, -0.01);
    bezel(mainPanel, 0.205, 0.205, s * 0.415, -0.01);
    zone(mainPanel, 'fd-pfd', 0.205, 0.205, s * 0.65, -0.01, D.drawPFD, { screen: true, state: pfdState, side, z: 0.002 });
    zone(mainPanel, 'fd-nd', 0.205, 0.205, s * 0.415, -0.01, D.drawND, { screen: true, side, state: ndState(side), z: 0.002 });
    // outboard column: warning lights, clock, display select
    zone(mainPanel, 'fd-main-warnings', 0.11, 0.085, s * 0.9, 0.2, WARN_LIGHTS, { side });
    zone(mainPanel, 'fd-clock', 0.11, 0.11, s * 0.9, 0.08, D.drawClock, { side, state: () => ({ t: Math.floor(Date.now() / 20000) }) });
    zone(mainPanel, 'fd-display-select', 0.11, 0.17, s * 0.9, -0.08, DISPLAY_SELECT, { side });
    // status strip above the PFD/ND
    zone(mainPanel, 'fd-main-warnings', 0.46, 0.04, s * 0.532, 0.125, STATUS_STRIP, { side });
  }
  bezel(mainPanel, 0.205, 0.205, 0, 0.03);
  zone(mainPanel, 'fd-upper-du', 0.205, 0.205, 0.0, 0.03, D.drawEngines, {
    screen: true, z: 0.002,
    state: () => {
      const st = systems.state, a = snap().a, eng = snap().p.eng;
      const n1For = (run) => (!run ? 0 : st.onGround ? 21.5 : 84.6);
      const egtFor = (run) => (!run ? 22 : st.onGround ? 450 : 712);
      return { n1L: n1For(eng.run1), n1R: n1For(eng.run2), egtL: egtFor(eng.run1), egtR: egtFor(eng.run2), rev: a.rev.state === 'off' ? '' : a.rev.state, thrMode: st.onGround ? 'TO' : 'CRZ' };
    },
  });
  bezel(mainPanel, 0.1, 0.1, -0.205, 0.09, 0.01);
  zone(mainPanel, 'fd-standby', 0.1, 0.1, -0.205, 0.09, D.drawISFD, { screen: true, z: 0.002, state: () => { const p = pfdState(); return { pitch: p.pitch, bank: p.bank, speed: p.speed, alt: p.alt, hdg: p.hdg }; } });
  zone(mainPanel, 'fd-flap-gauge', 0.13, 0.15, -0.205, -0.055, D.drawFlapPanel, {
    state: () => { const a = snap().a; return { leTransit: a.leTransit.state !== 'off', leExt: a.leExt.state !== 'off', flap: parseFloat(systems.readout('flapGauge')) || 0 }; },
  });
  zone(mainPanel, 'fd-gear-panel', 0.13, 0.27, 0.205, -0.005, D.drawGearPanel, {
    state: () => ({ gear: snap().a.gearN.state }),
  });
  // gear lever: wheel-shaped knob on a stem
  const gearLever = new THREE.Group();
  gearLever.position.set(0.205, -0.05, 0.01);
  mainPanel.add(gearLever);
  {
    const stem = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.012, 0.075), mats.chrome);
    stem.position.z = 0.04;
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.026, 28), mats.white);
    knob.rotation.x = Math.PI / 2; knob.position.z = 0.085;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.004, 8, 28), mats.white); rim.position.z = 0.085;
    [stem, knob, rim].forEach((mm) => { mm.userData.partId = 'fd-gear-panel'; mm.castShadow = true; gearLever.add(mm); });
  }

  // ---- glareshield (P7)
  const glare = facing(V(0.689 - 0.8 * 0.016, 1.035 + 0.6 * 0.016, 0), V(-0.8, 0.58, 0));
  {
    const housing = new THREE.Mesh(new RoundedBoxGeometry(0.69, 0.104, 0.03, 3, 0.006), mats.panelDark);
    housing.position.z = -0.006; housing.castShadow = true; glare.add(housing);
  }
  zone(glare, 'fd-mcp', 0.66, 0.094, 0, 0, (ctx, W, H, st, g) => D.drawMCP(ctx, W, H, st, g), {
    state: () => ({ ...fd.mcp, modes: [...fd.mcp.modes] }), regions: mcpRegions, z: 0.0105,
  });
  // MCP 3D knobs (rotate as values change)
  const mcpKnobs = D.MCP.knobs.map((k) => {
    const sc = 0.094 * k.r * 2.1;
    const lx = (k.x - 0.5) * 0.66, ly = (0.5 - k.y) * 0.094;
    return { k, slot: kit.add('knobRound', glare, lx, ly, 0.011, sc) };
  });
  const efisLayout = (side) => ({ rows: [
    [K('MINS', { style: 'round', angle: 0, values: ['RADIO', 'BARO'], v: 'BARO', marks: ['RADIO', 'BARO'] }), B('RST', { scale: 0.8 }), K('BARO', { style: 'round', angle: 0, values: ['IN', 'HPA'], v: 'IN', marks: ['IN', 'HPA'] }), B('STD', { scale: 0.8 })],
    [B('FPV', { scale: 0.8 }), B('MTRS', { scale: 0.8 }), K('MODE', { values: ['APP', 'VOR', 'MAP', 'PLN'], v: 'MAP', sweep: 1.8 }), B('CTR', { scale: 0.8 }), B('TFC', { scale: 0.8 }),
      K('RANGE', { values: ['5', '10', '20', '40', '80', '160', '320', '640'], sweep: 2.6, markSize: 0.16, get: () => String(fd.range[side]), put: (v) => { fd.range[side] = Number(v); return { ok: true, message: `ND range ${v} NM` }; } })],
    ['WXR', 'STA', 'WPT', 'ARPT', 'DATA', 'POS', 'TERR'].map((t) => B(t, { ts: 0.22, scale: 0.8 })),
  ] });
  for (const s of [-1, 1]) {
    const side = s < 0 ? 'L' : 'R';
    zone(glare, 'fd-efis-panels', 0.2, 0.094, s * 0.455, 0, efisLayout(side), { side });
    zone(glare, 'fd-master-caution', 0.14, 0.094, s * 0.665, 0, (ctx, W, H, st, g) => D.drawMasterCaution(ctx, W, H, st, g), {
      side, regions: mcRegions, state: () => ({ ...cautionState(), side }),
    });
  }

  // ---- forward overhead (P5)
  const ovh = facing(V(0.33, 1.85, 0), V(-0.36, -0.93, 0));
  {
    const box = new THREE.Mesh(new RoundedBoxGeometry(0.96, 0.8, 0.09, 3, 0.012), mats.panelDark);
    box.position.z = -0.05; box.castShadow = true; box.receiveShadow = true; ovh.add(box);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.93, 0.77), mats.panel); face.position.z = -0.004; face.receiveShadow = true; ovh.add(face);
  }
  const cw = 0.18, x0 = -0.45;
  const col = (i) => x0 + cw * (i + 0.5);
  const yTop = 0.37, yBot = -0.24;
  const place = (id, ci, y1, y2, layoutId = id) => zone(ovh, id, cw - 0.006, (y2 - y1) - 0.006, col(ci), (y1 + y2) / 2, LAYOUTS[layoutId]);
  place('fd-flight-controls', 0, 0.12, yTop);
  place('fd-nav-displays', 0, 0.03, 0.12);
  place('fd-fuel', 0, yBot, 0.03);
  place('fd-electrical', 1, -0.06, yTop);
  place('fd-apu', 1, yBot, -0.06);
  place('fd-cabin-signs', 2, 0.12, yTop);
  place('fd-window-probe-heat', 2, yBot, 0.12);
  place('fd-anti-ice', 3, 0.19, yTop);
  place('fd-hydraulics', 3, 0.01, 0.19);
  place('fd-doors', 3, yBot, 0.01);
  place('fd-air-conditioning', 4, 0.19, yTop);
  place('fd-bleed-air', 4, -0.01, 0.19);
  place('fd-cabin-altitude', 4, -0.1, -0.01);
  place('fd-pressurization', 4, yBot, -0.1);
  // bottom row (forward edge)
  zone(ovh, 'fd-exterior-lights', 0.34, 0.12, -0.28, -0.31, LAYOUTS['fd-exterior-lights']);
  zone(ovh, 'fd-engine-start', 0.2, 0.12, 0.0, -0.31, LAYOUTS['fd-engine-start']);
  zone(ovh, 'fd-exterior-lights', 0.34, 0.12, 0.28, -0.31, LAYOUTS['fd-exterior-lights-2']);

  // ---- aft overhead
  const aft = facing(V(-0.25, 1.99, 0), V(-0.08, -1, 0));
  {
    const box = new THREE.Mesh(new RoundedBoxGeometry(0.95, 0.46, 0.06, 3, 0.01), mats.panelDark);
    box.position.z = -0.034; aft.add(box);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.43), mats.panel); face.position.z = -0.003; aft.add(face);
  }
  zone(aft, 'fd-irs', 0.28, 0.38, -0.31, 0, LAYOUTS['fd-irs']);
  zone(aft, 'fd-le-devices', 0.25, 0.38, -0.02, 0, LAYOUTS['fd-le-devices']);
  zone(aft, 'fd-engine-eec', 0.3, 0.18, 0.29, 0.1, LAYOUTS['fd-engine-eec']);
  zone(aft, 'fd-oxygen', 0.3, 0.19, 0.29, -0.095, LAYOUTS['fd-oxygen']);

  // ---- pedestal: forward electronic panel (P9)
  const fwdElec = facing(V(0.665, 0.595, 0), V(-0.54, 0.842, 0));
  {
    // pedestal body under the sloping P9 face
    const prof = new THREE.Shape();
    prof.moveTo(0.45, 0); prof.lineTo(0.98, 0); prof.lineTo(0.98, 0.72); prof.lineTo(0.858, 0.716); prof.lineTo(0.463, 0.462); prof.lineTo(0.45, 0.44); prof.closePath();
    const geo = new THREE.ExtrudeGeometry(prof, { depth: 0.64, bevelEnabled: false });
    geo.translate(0, 0, -0.32);
    const body = new THREE.Mesh(geo, mats.panelDark);
    body.castShadow = true; body.receiveShadow = true; root.add(body);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 0.47), mats.panel); face.position.z = -0.001; fwdElec.add(face);
  }
  bezel(fwdElec, 0.2, 0.2, 0, 0.12);
  zone(fwdElec, 'fd-lower-du', 0.2, 0.2, 0, 0.12, D.drawLowerDU, { screen: true, z: 0.002, state: () => { const e = snap().p.eng; return { run1: e.run1, run2: e.run2, air: air() }; } });
  zone(fwdElec, 'fd-autobrake', 0.17, 0.2, -0.215, 0.12, LAYOUTS['fd-autobrake']);
  zone(fwdElec, 'fd-lower-du', 0.17, 0.2, 0.215, 0.12, LAYOUTS['fd-mfd']);
  for (const s of [-1, 1]) {
    const cdu = zone(fwdElec, 'fd-cdu', 0.15, 0.225, s * 0.165, -0.11, D.drawCDU, { side: s < 0 ? 'L' : 'R', ppm: 3000 });
    void cdu;
  }

  // ---- control stand: curved quadrant with levers rotating about a common pivot
  const PIV = V(0.21, 0.33, 0), R = 0.32;
  const stand = new THREE.Group(); root.add(stand);
  {
    const prof = new THREE.Shape();
    prof.moveTo(-0.02, 0); prof.lineTo(0.47, 0); prof.lineTo(0.47, 0.5);
    for (let a = 0.72; a >= -0.72; a -= 0.08) prof.lineTo(PIV.x + Math.sin(a) * (R - 0.016), PIV.y + Math.cos(a) * (R - 0.016));
    prof.lineTo(-0.02, 0.55); prof.closePath();
    const geo = new THREE.ExtrudeGeometry(prof, { depth: 0.34, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 3 });
    geo.translate(0, 0, -0.17);
    const body = new THREE.Mesh(geo, mats.panel); body.castShadow = true; body.receiveShadow = true;
    stand.add(body);
    // quadrant top: painted cylinder segment
    const c = makeCanvas(0.46, 0.34, 1600);
    const ctx = c.getContext('2d');
    const W = c.width, H = c.height;
    ctx.fillStyle = '#4a525b'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#0d0f12';
    const slot = (z, len = 0.84) => ctx.fillRect(W * ((1 - len) / 2), H * (0.5 + z / 0.34) - 5, W * len, 10);
    slot(-0.035); slot(0.035); slot(-0.13, 0.7); slot(0.13, 0.7);
    // u axis runs aft->forward along the arc; v across the stand (FO side at the bottom)
    const at = (deg) => W * (0.5 + deg / 82.5);
    const lab = (t, deg, z, size = 0.022) => { ctx.save(); ctx.translate(at(deg), H * (0.5 + z / 0.34)); ctx.rotate(Math.PI / 2); drawLabel(ctx, t, 0, 0, H * size * 1.6, '#f4f3ee'); ctx.restore(); };
    lab('FLAPS', -36, 0.13);
    [['UP', 28], ['1', 21], ['2', 14], ['5', 7], ['10', 0], ['15', -7], ['25', -14], ['30', -21], ['40', -28]].forEach(([t, d]) => {
      ctx.fillStyle = '#f4f3ee'; ctx.fillRect(at(d) - 1.5, H * (0.5 + 0.105 / 0.34), 3, H * 0.05);
      lab(t, d, 0.093, 0.018);
    });
    lab('SPEED\nBRAKE', -36, -0.13);
    [['DOWN', 28], ['ARMED', 22], ['FLT DET', 2], ['UP', -25]].forEach(([t, d]) => lab(t, d, -0.093, 0.016));
    lab('IDLE', -24, 0.0, 0.016); lab('FWD THRUST', 10, 0.0, 0.016);
    const qt = canvasTexture(c);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.34, 48, 1, true, -0.72, 1.44), new THREE.MeshStandardMaterial({ map: qt, roughness: 0.6, side: THREE.DoubleSide }));
    top.rotation.x = -Math.PI / 2; top.position.copy(PIV);
    top.receiveShadow = true;
    stand.add(top);
  }
  // CylinderGeometry with rotation.x = PI/2 maps theta around z; theta 0 points to -z before rotation...
  // levers simply use the pivot + angle (deg, + = forward) below.
  const leverAt = (partId, z, len, knobGeo, knobMat, stemMat = mats.chrome) => {
    const g = new THREE.Group(); g.position.set(PIV.x, PIV.y, z); root.add(g);
    const stem = new THREE.Mesh(new THREE.BoxGeometry(0.012, len, 0.012), stemMat); stem.position.y = len / 2;
    const knob = new THREE.Mesh(knobGeo, knobMat); knob.position.y = len;
    [stem, knob].forEach((mm) => { mm.userData.partId = partId; mm.castShadow = true; g.add(mm); });
    return { g, knob };
  };
  const setLever = (lv, deg) => { lv.g.rotation.z = -THREE.MathUtils.degToRad(deg); };
  const thrust = [-0.035, 0.035].map((z) => leverAt('fd-thrust-levers', z, R + 0.11, new RoundedBoxGeometry(0.035, 0.03, 0.055, 3, 0.008), mats.white, mats.plastic));
  const reverse = thrust.map((t) => {
    const r = new THREE.Group(); r.position.set(0.02, R + 0.075, 0); t.g.add(r);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.05, 0.012), mats.black); arm.position.y = 0.025;
    arm.userData.partId = 'fd-thrust-levers'; r.add(arm);
    return r;
  });
  // TO/GA buttons on the thrust lever knobs, A/T disconnect on the outboard sides
  thrust.forEach((t, i) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.006, 0.02), mats.black); b.position.set(-0.018, R + 0.11, 0); t.g.add(b);
    const at = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.006, 10), mats.red); at.rotation.x = Math.PI / 2; at.position.set(0, R + 0.11, (i ? 1 : -1) * 0.03); t.g.add(at);
  });
  const sbLever = leverAt('fd-speedbrake-lever', -0.13, R + 0.09, new RoundedBoxGeometry(0.06, 0.025, 0.035, 3, 0.008), mats.white);
  const flapLever = leverAt('fd-flap-lever', 0.13, R + 0.09, new RoundedBoxGeometry(0.03, 0.035, 0.06, 3, 0.008), mats.white);
  // engine start levers at the aft end, red-tipped release
  const startLevers = [-0.03, 0.03].map((z) => {
    const g = new THREE.Group(); g.position.set(0.0, 0.56, z); root.add(g);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.06, 0.012), mats.chrome); arm.position.y = 0.03;
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.03, 14), mats.black); knob.rotation.x = Math.PI / 2; knob.position.y = 0.06;
    [arm, knob].forEach((mm) => { mm.userData.partId = 'fd-start-levers'; g.add(mm); });
    return g;
  });
  // parking brake lever (left aft of the stand) and its red light
  const parkLever = new THREE.Group(); parkLever.position.set(-0.01, 0.53, -0.14); root.add(parkLever);
  {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.012, 0.012), mats.chrome); arm.position.x = 0.03;
    const grip = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.024, 0.03, 3, 0.006), mats.red); grip.position.x = 0.065;
    [arm, grip].forEach((mm) => { mm.userData.partId = 'fd-parking-brake'; mm.castShadow = true; parkLever.add(mm); });
  }
  const standAft = facing(V(-0.032, 0.42, 0), V(-1, 0.1, 0));
  zone(standAft, 'fd-parking-brake', 0.08, 0.05, -0.12, 0.06, LAYOUTS['fd-parking-brake-light']);
  zone(standAft, 'fd-stab-trim', 0.14, 0.09, 0.08, 0.04, LAYOUTS['fd-stab-cutout']);
  // stab trim wheels with white stripes, and the trim indicators beside them
  const wheels = [-1, 1].map((s) => {
    const g = new THREE.Group();
    g.position.set(0.2, 0.43, s * 0.195);
    root.add(g);
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.03, 48), mats.black);
    w.rotation.x = Math.PI / 2;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.008, 8, 48), mats.plastic);
    const stripes = [0, Math.PI].map((a) => { const st = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.07, 0.032), mats.white); st.position.set(Math.sin(a) * 0.1, Math.cos(a) * 0.1, 0); st.rotation.z = -a; return st; });
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.05, 10), mats.metal); handle.rotation.x = Math.PI / 2; handle.position.set(0.11, 0.0, s * 0.035);
    [w, rim, ...stripes, handle].forEach((mm) => { mm.userData.partId = 'fd-stab-trim'; mm.castShadow = true; g.add(mm); });
    return g;
  });
  const trimInd = [-1, 1].map((s) => facing(V(0.42, 0.42, s * 0.181), V(0, 0, s), stand));
  trimInd.forEach((g, i) => zone(g, 'fd-stab-trim', 0.05, 0.15, 0, 0, (ctx, W, H, st) => {
    ctx.fillStyle = '#4a525b'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#0c0d0f'; ctx.fillRect(W * 0.35, H * 0.06, W * 0.3, H * 0.88);
    ctx.fillStyle = '#2bd46a'; ctx.fillRect(W * 0.35, H * (0.06 + 0.88 * (1 - 8.6 / 17)), W * 0.3, H * 0.88 * (8.6 - 2.9) / 17 * 0.9);
    for (let u = 0; u <= 16; u += 2) { const y = H * (0.06 + 0.88 * (1 - u / 17)); ctx.fillStyle = '#fff'; ctx.fillRect(W * 0.2, y - 1, W * 0.14, 2); drawLabel(ctx, String(u), W * 0.12, y, H * 0.035, '#fff'); }
    const y = H * (0.06 + 0.88 * (1 - st.stab / 17));
    ctx.fillStyle = '#f4f3ee'; ctx.beginPath(); ctx.moveTo(W * 0.92, y - H * 0.025); ctx.lineTo(W * 0.66, y); ctx.lineTo(W * 0.92, y + H * 0.025); ctx.fill();
    drawLabel(ctx, 'NOSE\nDN', W * 0.75, H * 0.04, H * 0.025, '#fff'); drawLabel(ctx, 'NOSE\nUP', W * 0.75, H * 0.97, H * 0.025, '#fff');
  }, { side: i ? 'R' : 'L', state: () => ({ stab: Math.round((parseFloat(systems.readout('stabUnits')) || 5) * 4) / 4 }) }));

  // ---- aft electronic panel (P8)
  const aftElec = facing(V(-0.29, 0.6, 0), V(-0.06, 1, 0));
  {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.58, 0.38), mats.panelDark);
    body.position.set(-0.3, 0.29, 0); body.castShadow = true; body.receiveShadow = true; root.add(body);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.37, 0.59), mats.panel); face.position.z = -0.001; aftElec.add(face);
  }
  const fireZone = zone(aftElec, 'fd-fire-panel', 0.35, 0.13, 0, 0.215, FIRE_PANEL);
  zone(aftElec, 'fd-radios', 0.17, 0.085, -0.088, 0.1, LAYOUTS['fd-radio-comm1']);
  zone(aftElec, 'fd-radios', 0.17, 0.085, 0.088, 0.1, LAYOUTS['fd-radio-comm2']);
  zone(aftElec, 'fd-radios', 0.17, 0.08, -0.088, 0.013, LAYOUTS['fd-radio-nav1']);
  zone(aftElec, 'fd-radios', 0.17, 0.08, 0.088, 0.013, LAYOUTS['fd-radio-nav2']);
  zone(aftElec, 'fd-radios', 0.17, 0.09, -0.088, -0.075, LAYOUTS['fd-acp'], { side: 'L' });
  zone(aftElec, 'fd-radios', 0.17, 0.09, 0.088, -0.075, LAYOUTS['fd-acp'], { side: 'R' });
  zone(aftElec, 'fd-cargo-fire', 0.17, 0.08, -0.088, -0.165, LAYOUTS['fd-cargo-fire']);
  zone(aftElec, 'fd-radios', 0.17, 0.08, 0.088, -0.165, LAYOUTS['fd-atc']);
  zone(aftElec, 'fd-trim-panel', 0.2, 0.07, -0.075, -0.25, LAYOUTS['fd-trim-panel']);
  zone(aftElec, 'fd-flight-deck-door', 0.14, 0.07, 0.105, -0.25, LAYOUTS['fd-door-lock']);
  void fireZone;

  // engine and APU fire switches (T-handles) that pull and rotate
  const FIRE_KEYS = ['eng1', 'apu', 'eng2'];
  const fireHandles = FIRE_KEYS.map((k, i) => {
    const g = new THREE.Group();
    g.position.set((FIRE_HANDLE_X[i] - 0.5) * 0.35, 0.215, 0.006);
    aftElec.add(g);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.022, 0.022), mats.plastic);
    grip.position.z = 0.012; grip.castShadow = true;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.02, 10), mats.chrome); stem.rotation.x = Math.PI / 2; stem.position.z = 0.0;
    // translucent lens on the grip with the engine number; glows red with a fire warning
    const c = makeCanvas(0.05, 0.018, 4000);
    const cx = c.getContext('2d');
    cx.fillStyle = '#3a0c08'; cx.fillRect(0, 0, c.width, c.height);
    drawLabel(cx, ['1', 'APU', '2'][i], c.width / 2, c.height / 2, c.height * 0.7, '#ffd7cf');
    const lensMat = new THREE.MeshStandardMaterial({ map: canvasTexture(c), roughness: 0.25, emissive: new THREE.Color('#ff2a1c'), emissiveMap: canvasTexture(c), emissiveIntensity: 0 });
    const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.018), lensMat);
    lens.position.z = 0.0232; lens.raycast = () => {};
    grip.userData.partId = 'fd-fire-panel'; stem.userData.partId = 'fd-fire-panel';
    g.add(grip, stem, lens);
    const key = `fire.handle.${k}`;
    grip.userData.hint = () => {
      const v = getS(key) ?? 'IN';
      const nmH = ['Engine 1 fire switch', 'APU fire switch', 'Engine 2 fire switch'][i];
      if (v === 'IN') return `${nmH} · IN · click to pull`;
      if (k === 'apu') return v === 'PULLED' ? `${nmH} · PULLED · click to rotate (discharge) · Shift+click to push in` : `${nmH} · ROTATED · click to return · Shift+click to push in`;
      return v === 'PULLED' ? `${nmH} · PULLED · click left half: rotate L, right half: rotate R · Shift+click to push in` : `${nmH} · rotated ${v} · click to return · Shift+click to push in`;
    };
    grip.userData.interact = ({ uv, shift }) => {
      const v = getS(key) ?? 'IN';
      let next;
      if (shift && v !== 'IN') next = 'IN';
      else if (v === 'IN') next = 'PULLED';
      else if (v === 'PULLED') next = k === 'apu' ? 'DISCH' : (uv && uv.x < 0.5 ? 'L' : 'R');
      else next = 'PULLED';
      const r = trySet(key, next);
      S = null;
      return { handled: true, ok: r.ok !== false, message: r.message };
    };
    return { g, lensMat, key, k, cur: { z: 0, rot: 0 } };
  });

  // ---- seats, columns, pedals, consoles, tiller, CB panels, door
  buildSeat(root, mats, -0.53, 'fd-seats');
  buildSeat(root, mats, 0.53, 'fd-seats');
  const columns = [-1, 1].map((s) => buildColumn(root, mats, s * 0.53, 'fd-control-column'));
  const pedals = [-1, 1].flatMap((s) => buildPedals(root, mats, s * 0.53, 'fd-rudder-pedals'));
  const maskTex = (() => {
    const c = makeCanvas(0.19, 0.14, 1600); const ctx = c.getContext('2d'); const W = c.width, H = c.height;
    ctx.fillStyle = '#30353b'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#20242a'; rrect(ctx, W * 0.06, H * 0.08, W * 0.88, H * 0.84, 10); ctx.fill();
    drawLabel(ctx, 'OXYGEN MASK', W / 2, H * 0.22, H * 0.09, '#f4f3ee');
    drawLabel(ctx, 'SQUEEZE RED LEVERS\nAND PULL TO REMOVE', W / 2, H * 0.48, H * 0.065, '#f4f3ee');
    ctx.fillStyle = '#e8e2c8'; ctx.fillRect(W * 0.15, H * 0.68, W * 0.25, H * 0.12); drawLabel(ctx, 'OXY ON', W * 0.275, H * 0.74, H * 0.06, '#222');
    drawLabel(ctx, 'RESET / TEST', W * 0.68, H * 0.74, H * 0.06, '#f4f3ee');
    return canvasTexture(c);
  })();
  buildConsoles(root, mats, maskTex);
  buildTiller(root, mats, 'fd-tiller', -1);
  buildCBPanel(root, mats, { x0: -1.2, x1: -0.62, y0: 0.42, y1: 1.5, side: -1, seed: 1, partId: 'fd-circuit-breakers' });
  buildCBPanel(root, mats, { x0: -1.22, x1: -0.58, y0: 0.38, y1: 1.56, side: 1, seed: 5, partId: 'fd-circuit-breakers' });
  buildDoor(root, mats, 'fd-flight-deck-door');

  kit.finalize(root);
  // the studio environment map isn't occluded by the shell: tone it down indoors so the
  // windows and flood lights carry the lighting (screens and the outside world are unaffected)
  root.traverse((o) => {
    if (!o.isMesh && !o.isInstancedMesh) return;
    for (const m of [].concat(o.material)) if (m && m.isMeshStandardMaterial && m.envMapIntensity === 1 && m.emissiveIntensity <= 1) m.envMapIntensity = 0.45;
  });

  // ---- direct manipulation of levers and wheels
  const operable = (obj, hint, act) => obj.traverse((m) => {
    if (!m.isMesh || !m.userData.partId) return;
    m.userData.hint = typeof hint === 'function' ? hint : () => hint;
    m.userData.interact = ({ shift }) => {
      const r = act(shift);
      S = null;
      return { handled: true, ok: r?.ok !== false, message: r?.message };
    };
  });
  operable(flapLever.g, () => `Flap lever · ${getS('flapLever') || 'UP'} · click: next detent · Shift+click: back one`, (shift) => {
    const i = FLAP_DETENTS.indexOf(systems.get('flapLever'));
    const n = FLAP_DETENTS[Math.max(0, Math.min(FLAP_DETENTS.length - 1, i + (shift ? -1 : 1)))];
    return systems.set('flapLever', n);
  });
  operable(gearLever, () => `Gear lever · ${getS('gearLever')} · click: UP / DN · Shift+click: OFF`, (shift) => {
    if (shift) return systems.set('gearLever', 'OFF');
    return systems.set('gearLever', systems.get('gearLever') === 'DN' ? 'UP' : 'DN');
  });
  const SB = ['DOWN', 'ARMED', 'FLIGHT', 'UP'];
  operable(sbLever.g, () => `Speed brake · ${getS('speedbrake')} · click: next position · Shift+click: back`, (shift) => {
    const i = SB.indexOf(systems.get('speedbrake'));
    return systems.set('speedbrake', SB[Math.max(0, Math.min(SB.length - 1, i + (shift ? -1 : 1)))]);
  });
  thrust.forEach((t) => operable(t.g, 'Reverse thrust levers · click to raise / stow', () => systems.set('reversers', !systems.get('reversers'))));
  wheels.forEach((w) => operable(w, 'Stab trim wheel · click: nose up · Shift+click: nose down', (shift) =>
    systems.set('stabTrim', Math.round(((parseFloat(systems.readout('stabUnits')) || 5) + (shift ? -0.5 : 0.5)) * 4) / 4)));
  operable(parkLever, () => `Parking brake lever · ${getS('sw.parkbrake') ? 'SET' : 'RELEASED'} · click to ${getS('sw.parkbrake') ? 'release' : 'set'}`, () => trySet('sw.parkbrake', !getS('sw.parkbrake')));

  // ---- day / night
  function setNight(on) {
    night = on;
    outside.setNight(on);
    hemi.intensity = on ? 0.04 : 0.4;
    dome.intensity = on ? 0.05 : 0.6;
    dome.color.set(on ? '#ffd9a8' : '#fff1dc');
    floods[0].intensity = floods[1].intensity = on ? 1.1 : 0;
    floods[2].intensity = on ? 0.9 : 0;
    floods[3].intensity = on ? 0.8 : 0;
    for (const z of zones) {
      const m = z.mesh;
      if (m.material.emissiveIntensity > 1) continue; // screens keep their brightness
      const base = m.userData.baseEmissive || (m.userData.baseEmissive = m.material.emissive.clone());
      base.set(on ? '#060606' : '#161616');
      if (!m.userData.hl) m.material.emissive.copy(base);
    }
    S = null;
    zones.forEach((z) => z.refresh(true));
  }
  // repaint once the web fonts have loaded (canvas text falls back until then)
  document.fonts?.ready?.then(() => { S = null; zones.forEach((z) => z.refresh(true)); });

  // ---- animation from systems
  const cur = { flap: 28, sb: 28, gear: -0.05, rev: 0, roll: 0, pitch: 0, yaw: 0, thr: -22 };
  const approach = (a, b, k) => a + (b - a) * k;
  const GEAR_Y = { UP: 0.0, OFF: -0.047, DN: -0.094 };
  let lastAir = null;
  function update(dt) {
    fd.t += dt;
    S = null;
    const st = systems.state;
    const k = 1 - Math.exp(-dt * 8);
    const fi = Math.max(0, FLAP_DETENTS.indexOf(st.flapLever));
    cur.flap = approach(cur.flap, 28 - fi * 7, k);
    setLever(flapLever, cur.flap);
    const sbDeg = { DOWN: 28, ARMED: 22, FLIGHT: 2, UP: -25 }[st.speedbrake] ?? 28;
    cur.sb = approach(cur.sb, sbDeg, k);
    setLever(sbLever, cur.sb);
    const thr = !st.engines ? -24 : st.onGround ? -22 : 6;
    cur.thr = approach(cur.thr, thr, k);
    thrust.forEach((t) => setLever(t, cur.thr));
    cur.gear = approach(cur.gear, GEAR_Y[st.gearLever] ?? GEAR_Y.DN, k);
    gearLever.position.y = cur.gear;
    gearLever.position.z = 0.01 + (st.gearLever === 'OFF' ? 0.012 : 0);
    cur.rev = approach(cur.rev, st.reversers ? 1 : 0, k);
    reverse.forEach((r) => { r.rotation.z = cur.rev * 1.2; });
    const run = snap().p.eng;
    startLevers.forEach((g, i) => { g.rotation.z = (i ? run.run2 : run.run1) || st.engines ? 0.5 : -0.5; });
    parkLever.rotation.z = getS('sw.parkbrake') ? 0.6 : 0;
    const stab = parseFloat(systems.readout('stabUnits')) || 5;
    wheels.forEach((w) => { w.rotation.z = stab * 0.9; });
    cur.roll = approach(cur.roll, st.roll, k);
    cur.pitch = approach(cur.pitch, st.pitch, k);
    cur.yaw = approach(cur.yaw, st.yaw, k);
    columns.forEach((c) => { c.wheel.rotation.x = cur.roll * 1.2; c.pivot.rotation.z = cur.pitch * 0.15; });
    pedals.forEach((p) => { p.g.position.x = p.p * cur.yaw * 0.05; });
    // fire handles: pull / rotate and light up
    const fire = snap().p.fire || {};
    for (const h of fireHandles) {
      const v = getS(h.key) ?? 'IN';
      const z = v === 'IN' ? 0 : 0.03;
      const rot = v === 'L' || v === 'DISCH' ? 0.6 : v === 'R' ? -0.6 : 0;
      h.cur.z = approach(h.cur.z, z, k); h.cur.rot = approach(h.cur.rot, rot, k);
      h.g.position.z = 0.006 + h.cur.z; h.g.rotation.z = h.cur.rot;
      h.lensMat.emissiveIntensity = fire[h.k] ? 2.4 : 0;
    }
    // MCP knobs turn with their values
    for (const { k: kn, slot } of mcpKnobs) {
      const w = winById[kn.id]; const v = fd.mcp[w.key] || 0;
      slot.set(0, -(v / (STEP[w.key] || 1)) * 0.26);
    }
    const isAir = !st.onGround;
    if (isAir !== lastAir) { lastAir = isAir; outside.setAirborne(isAir); }
    zones.forEach((z) => z.refresh(false));
  }

  /** Treat the current cautions as acknowledged (used just before a failure is injected). */
  function ackCautions() {
    fd.ack = new Set(systems.panel().cats);
    fd.recallUntil = 0;
  }

  return { root, update, setNight, ackCautions };
}

// Camera presets, limits and focus behaviour for the flight deck scene.
export const flightDeckCamera = {
  home: { position: [-0.08, 1.24, -0.53], target: [0.88, 0.9, -0.42] },
  views: {
    Captain: { position: [-0.08, 1.24, -0.53], target: [0.88, 0.9, -0.42] },
    'First Officer': { position: [-0.08, 1.24, 0.53], target: [0.88, 0.9, 0.42] },
    Overhead: { position: [-0.32, 1.18, 0], target: [0.33, 1.84, 0] },
    Glareshield: { position: [0.05, 1.22, 0], target: [0.64, 1.03, 0] },
    Pedestal: { position: [-0.42, 1.42, 0], target: [0.4, 0.6, 0] },
    'Aft pedestal': { position: [-0.55, 1.2, 0.05], target: [-0.25, 0.6, 0] },
    Jumpseat: { position: [-1.0, 1.45, 0.3], target: [0.6, 1.0, 0] },
  },
  env: { ground: false, fog: false },
  limits: { minDistance: 0.1, maxDistance: 2.2, near: 0.02, fov: 62 },
  bounds: { min: [-1.2, 0.3, -0.85], max: [0.8, 1.88, 0.85] },
  focus: { scale: 1.5, add: 0.2, min: 0.26, max: 1.2 },
};
