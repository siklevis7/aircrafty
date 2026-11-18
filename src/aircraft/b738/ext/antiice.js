// System extension: ice & rain protection for the 737-800 (NG).
// Engine (cowl) anti-ice, wing anti-ice (modelled in the core bleed logic), window heat and probe heat.
// Simplified study model: who supplies what is accurate, temperatures and timings are not.
// Bus assignments for window heat vary by airframe, so this model uses a simple left/right split.
// Operator documents (FCOM/QRH) always take precedence.

const WINDOWS = ['lside', 'lfwd', 'rfwd', 'rside'];
const WIN_LABEL = { lside: 'L SIDE', lfwd: 'L FWD', rfwd: 'R FWD', rside: 'R SIDE' };
const PROBES_A = [['captPitot', 'CAPT PITOT'], ['aoaL', 'L AOA VANE'], ['elevL', 'L ELEV PITOT'], ['tat', 'TAT PROBE']];
const PROBES_B = [['foPitot', 'F/O PITOT'], ['aoaR', 'R AOA VANE'], ['elevR', 'R ELEV PITOT'], ['auxPitot', 'AUX PITOT']];
const TRANSIT_S = 1.6; // cowl valve travel time shown as a bright COWL VALVE OPEN light
const COOL_S = 8; // window cool-down (sped up; real procedures call for minutes)

// internal dynamics (one systems instance per page)
const dyn = {
  init: false,
  prev: {}, // last seen switch / valve positions
  transitUntil: { 1: 0, 2: 0 },
  offSince: {}, // window switch OFF time, for overheat cool-down
};

const cowlOpen = (s, n, run) => !!s[`sw.engai${n}`] && run && !s[`fail.engai${n}`];

export default {
  id: 'antiice',
  state: {
    'sw.engai1': false, 'sw.engai2': false,
    'sw.wh.lside': true, 'sw.wh.lfwd': true, 'sw.wh.rfwd': true, 'sw.wh.rside': true,
    'sw.probe.a': false, 'sw.probe.b': false,
    'fail.wh.lfwd': false, 'fail.probe.capt': false, 'fail.engai1': false,
  },

  set(key, value, api) {
    // the WING ANTI-ICE switch is solenoid held and trips OFF at lift-off (air mode)
    if (key === 'onGround' && value === false && api.state.onGround && api.state['sw.wingai']) {
      api.state['sw.wingai'] = false;
      api.emit({ type: 'info', message: 'WING ANTI-ICE switch tripped OFF at lift-off. Select it ON again in flight if needed.' });
    }
    return undefined; // nothing here is refused; plain switches are stored by the core
  },

  update(dt, api) {
    const s = api.state;
    const t = api.time;
    const run = { 1: api.eng1Run, 2: api.eng2Run };
    for (const n of [1, 2]) {
      const sw = !!s[`sw.engai${n}`];
      const open = cowlOpen(s, n, run[n]);
      // a commanded change of valve position takes a moment: bright light while travelling
      if (dyn.init && (dyn.prev[`sw${n}`] !== sw || dyn.prev[`open${n}`] !== open)) dyn.transitUntil[n] = t + TRANSIT_S;
      dyn.prev[`sw${n}`] = sw;
      dyn.prev[`open${n}`] = open;
    }
    // window overheat: switch OFF, let it cool, switch ON again and the heat comes back
    for (const w of WINDOWS) {
      const on = !!s[`sw.wh.${w}`];
      const was = dyn.prev[`wh.${w}`];
      if (dyn.init && was && !on) dyn.offSince[w] = t;
      if (dyn.init && !was && on && w === 'lfwd' && s['fail.wh.lfwd'] && dyn.offSince[w] != null && t - dyn.offSince[w] >= COOL_S) {
        api.set('fail.wh.lfwd', false);
        api.emit({ type: 'info', message: 'L FWD window cooled: OVERHEAT reset and heat restored. (In the aircraft the wait is a few minutes; follow your QRH.)' });
      }
      if (on) dyn.offSince[w] = null;
      dyn.prev[`wh.${w}`] = on;
    }
    dyn.init = true;
  },

  compute(s, out, api) {
    const t = api.time;
    const run = { 1: out.eng.run1, 2: out.eng.run2 };
    const cowl = {};
    for (const n of [1, 2]) {
      const sw = !!s[`sw.engai${n}`];
      const open = cowlOpen(s, n, run[n]);
      const transit = t < dyn.transitUntil[n];
      cowl[n] = { sw, open, transit, disagree: sw !== open, bright: transit || sw !== open };
    }
    const bus = { lside: out.elec.tbus1, lfwd: out.elec.tbus1, rfwd: out.elec.tbus2, rside: out.elec.tbus2 };
    const windows = {}, ovht = {}, winPower = {};
    for (const w of WINDOWS) {
      const sw = !!s[`sw.wh.${w}`];
      ovht[w] = sw && !!s[`fail.wh.${w}`]; // overheat detected: controller removes power
      winPower[w] = !!bus[w];
      windows[w] = sw && winPower[w] && !ovht[w];
    }
    const pa = !!s['sw.probe.a'] && out.elec.tbus1;
    const pb = !!s['sw.probe.b'] && out.elec.tbus2;
    const air = !s.onGround;
    const probes = {
      captPitot: pa && !s['fail.probe.capt'], aoaL: pa, elevL: pa,
      tat: pa && air, // the TAT probe heater is not powered on the ground
      foPitot: pb, aoaR: pb, auxPitot: pb, elevR: pb,
    };
    // amber light = probe not heated; on the ground the TEMP PROBE light stays out with the switch ON
    const lights = {};
    for (const k of Object.keys(probes)) lights[k] = !probes[k];
    if (s.onGround && s['sw.probe.a'] && out.elec.tbus1) lights.tat = false;
    return {
      cowl1: cowl[1].open, cowl2: cowl[2].open,
      cowl1Bright: cowl[1].bright, cowl2Bright: cowl[2].bright,
      cowl1Light: cowl[1].open || cowl[1].bright, cowl2Light: cowl[2].open || cowl[2].bright,
      cowlState: { 1: cowl[1], 2: cowl[2] },
      wing: !!out.bleed.wingAI,
      wingL: !!s['sw.wingai'] && out.bleed.left, wingR: !!s['sw.wingai'] && out.bleed.right,
      windows, ovht, winPower, probes, lights,
      probeA: pa, probeB: pb,
    };
  },

  ann(r) {
    return {
      'ai.cowl1': r.cowl1Light, 'ai.cowl2': r.cowl2Light,
      'wh.lside': r.windows.lside, 'wh.lfwd': r.windows.lfwd, 'wh.rfwd': r.windows.rfwd, 'wh.rside': r.windows.rside,
      'wh.ovht.lside': r.ovht.lside, 'wh.ovht.lfwd': r.ovht.lfwd, 'wh.ovht.rfwd': r.ovht.rfwd, 'wh.ovht.rside': r.ovht.rside,
      'probe.captPitot': r.lights.captPitot, 'probe.foPitot': r.lights.foPitot, 'probe.auxPitot': r.lights.auxPitot,
      'probe.aoaL': r.lights.aoaL, 'probe.aoaR': r.lights.aoaR, 'probe.tat': r.lights.tat,
      'probe.elevL': r.lights.elevL, 'probe.elevR': r.lights.elevR,
    };
  },

  cats(r) {
    const any = Object.values(r.ovht).some(Boolean) || Object.values(r.lights).some(Boolean);
    return any ? ['ANTI-ICE'] : [];
  },

  schematics: [{
    id: 'antiice', category: 'sys-antiice', title: 'Ice & Rain', color: 'ice',
    intro: 'Bleed air heats the engine inlet cowls and the inboard wing slats. Electrical heat protects the flight deck windows and the air data probes. Click a valve, switch or window to operate it.',
    nodes: [
      // ---- pneumatic: engine anti-ice
      { id: 'eng1', kind: 'source', label: 'ENGINE 1', x: 60, y: 30, w: 160, h: 50, active: (c) => c.eng.run1, part: 'sys-ai-engine', status: (c) => (c.eng.run1 ? 'RUNNING' : 'NOT RUNNING') },
      { id: 'eng2', kind: 'source', label: 'ENGINE 2', x: 780, y: 30, w: 160, h: 50, active: (c) => c.eng.run2, part: 'sys-ai-engine', status: (c) => (c.eng.run2 ? 'RUNNING' : 'NOT RUNNING') },
      { id: 'cv1', kind: 'valve', label: 'COWL VALVE 1', x: 140, y: 130, orient: 'v', active: (c) => c.antiice.cowl1, part: 'sys-ai-engine', control: { key: 'sw.engai1', type: 'toggle' }, status: (c) => cowlStatus(c, 1) },
      { id: 'cv2', kind: 'valve', label: 'COWL VALVE 2', x: 860, y: 130, orient: 'v', active: (c) => c.antiice.cowl2, part: 'sys-ai-engine', control: { key: 'sw.engai2', type: 'toggle' }, status: (c) => cowlStatus(c, 2) },
      { id: 'lip1', kind: 'box', label: 'ENG 1 INLET COWL LIP', x: 60, y: 190, w: 160, h: 46, active: (c) => c.antiice.cowl1, part: 'sys-ai-engine', status: (c) => (c.antiice.cowl1 ? 'HEATED' : '') },
      { id: 'lip2', kind: 'box', label: 'ENG 2 INLET COWL LIP', x: 780, y: 190, w: 160, h: 46, active: (c) => c.antiice.cowl2, part: 'sys-ai-engine', status: (c) => (c.antiice.cowl2 ? 'HEATED' : '') },
      // ---- pneumatic: wing anti-ice
      { id: 'ductL', kind: 'bus', label: 'LEFT BLEED DUCT', x: 250, y: 100, w: 230, active: (c) => c.bleed.left, part: 'sys-ai-wing' },
      { id: 'ductR', kind: 'bus', label: 'RIGHT BLEED DUCT', x: 520, y: 100, w: 230, active: (c) => c.bleed.right, part: 'sys-ai-wing' },
      { id: 'wvL', kind: 'valve', label: 'L WING VALVE', x: 330, y: 170, orient: 'v', active: (c) => c.antiice.wingL, part: 'sys-ai-wing' },
      { id: 'wvR', kind: 'valve', label: 'R WING VALVE', x: 670, y: 170, orient: 'v', active: (c) => c.antiice.wingR, part: 'sys-ai-wing' },
      { id: 'slatL', kind: 'box', label: 'L WING · 3 INBD SLATS', x: 240, y: 230, w: 180, h: 40, active: (c) => c.antiice.wingL, part: 'sys-ai-wing' },
      { id: 'slatR', kind: 'box', label: 'R WING · 3 INBD SLATS', x: 580, y: 230, w: 180, h: 40, active: (c) => c.antiice.wingR, part: 'sys-ai-wing' },
      { id: 'wsw', kind: 'box', label: 'WING ANTI-ICE', x: 430, y: 160, w: 140, h: 44, active: (c) => c.s['sw.wingai'], part: 'sys-ai-wing', control: { key: 'sw.wingai', type: 'toggle', on: 'ON', off: 'OFF' } },
      // ---- electrical
      { id: 'tb1', kind: 'bus', label: 'AC TRANSFER BUS 1', x: 30, y: 340, w: 440, active: (c) => c.elec.tbus1, part: 'sys-ai-window' },
      { id: 'tb2', kind: 'bus', label: 'AC TRANSFER BUS 2', x: 530, y: 340, w: 440, active: (c) => c.elec.tbus2, part: 'sys-ai-window' },
      ...[['lside', 30], ['lfwd', 150], ['rfwd', 740], ['rside', 860]].flatMap(([w, x]) => [
        { id: `wh-${w}`, kind: 'box', label: WIN_LABEL[w], x, y: 390, w: 110, h: 44, active: (c) => c.antiice.windows[w], part: 'sys-ai-window', control: { key: `sw.wh.${w}`, type: 'toggle' }, status: (c) => winStatus(c, w) },
        { id: `ov-${w}`, kind: 'annun', label: 'OVERHEAT', x, y: 446, w: 110, h: 26, active: (c) => c.antiice.ovht[w], part: 'sys-ai-window' },
      ]),
      { id: 'pha', kind: 'box', label: 'PROBE HEAT A', x: 290, y: 390, w: 160, h: 44, active: (c) => c.antiice.probeA, part: 'sys-ai-probe', control: { key: 'sw.probe.a', type: 'toggle' } },
      { id: 'phb', kind: 'box', label: 'PROBE HEAT B', x: 550, y: 390, w: 160, h: 44, active: (c) => c.antiice.probeB, part: 'sys-ai-probe', control: { key: 'sw.probe.b', type: 'toggle' } },
      ...PROBES_A.map(([k, l], i) => probeNode(k, l, 310, i)),
      ...PROBES_B.map(([k, l], i) => probeNode(k, l, 550, i)),
      { id: 'wnote', kind: 'label', label: 'WINDOW HEAT', x: 30, y: 498 },
      { id: 'wnote2', kind: 'label', label: 'WINDOW HEAT', x: 892, y: 498 },
    ],
    lines: [
      { pts: [[140, 80], [140, 110]], live: (c) => c.eng.run1 },
      { pts: [[140, 150], [140, 190]], live: (c) => c.antiice.cowl1 },
      { pts: [[860, 80], [860, 110]], live: (c) => c.eng.run2 },
      { pts: [[860, 150], [860, 190]], live: (c) => c.antiice.cowl2 },
      { pts: [[220, 55], [235, 55], [235, 106], [250, 106]], live: (c) => c.bleed.eb1 },
      { pts: [[780, 55], [765, 55], [765, 106], [750, 106]], live: (c) => c.bleed.eb2 },
      { pts: [[330, 112], [330, 150]], live: (c) => c.bleed.left },
      { pts: [[330, 190], [330, 230]], live: (c) => c.antiice.wingL },
      { pts: [[670, 112], [670, 150]], live: (c) => c.bleed.right },
      { pts: [[670, 190], [670, 230]], live: (c) => c.antiice.wingR },
      // window heat feeds
      { pts: [[85, 352], [85, 390]], live: (c) => c.antiice.windows.lside },
      { pts: [[205, 352], [205, 390]], live: (c) => c.antiice.windows.lfwd },
      { pts: [[795, 352], [795, 390]], live: (c) => c.antiice.windows.rfwd },
      { pts: [[915, 352], [915, 390]], live: (c) => c.antiice.windows.rside },
      // probe heat
      { pts: [[370, 352], [370, 390]], live: (c) => c.antiice.probeA },
      { pts: [[630, 352], [630, 390]], live: (c) => c.antiice.probeB },
      { pts: [[300, 434], [300, py(3) + 13]], live: (c) => c.antiice.probeA },
      ...PROBES_A.map(([k], i) => ({ pts: [[300, py(i) + 13], [310, py(i) + 13]], live: (c) => c.antiice.probes[k] })),
      { pts: [[700, 434], [700, py(3) + 13]], live: (c) => c.antiice.probeB },
      ...PROBES_B.map(([k], i) => ({ pts: [[700, py(i) + 13], [690, py(i) + 13]], live: (c) => c.antiice.probes[k] })),
    ],
  }],

  parts: [
    { id: 'sys-ai-engine', category: 'sys-antiice', name: 'Engine Anti-Ice', where: 'Engine inlet cowls · Anti-ice panel',
      what: 'Hot bleed air from each engine heats the lip of its own inlet cowl, so ice can\'t build up and shed into the fan and core.',
      how: 'Each ENG ANTI-ICE switch commands a cowl anti-ice valve. The valves are electrically controlled and opened by bleed air pressure, so the engine must be running. The air is tapped upstream of the engine bleed valve, so engine anti-ice works whatever the ENG BLEED switch position. The blue COWL VALVE OPEN light is bright while the valve travels or disagrees with the switch, and dim once it is open as commanded. A TAI indication appears on the engine display.',
      notes: [
        'An amber COWL ANTI-ICE light shows overpressure in the duct downstream of the valve.',
        'Typical use: ON on the ground and in flight when icing conditions exist or are expected. Check your FCOM limitations for the exceptions (for example very cold climb and cruise).',
        'Try it: switch ENG 1 anti-ice ON with the engines off and the light stays bright, because there\'s no bleed pressure to open the valve.',
      ] },
    { id: 'sys-ai-wing', category: 'sys-antiice', name: 'Wing Anti-Ice', where: 'Wing leading edge · Anti-ice panel',
      what: 'Bleed air from the main bleed duct heats the three inboard leading-edge slats on each wing. The outboard slats and the Krueger flaps are not heated.',
      how: 'The WING ANTI-ICE switch opens a valve on each side. Because the air comes from the bleed duct, it depends on the ENG BLEED switches (or the APU bleed on the ground) and the isolation valve. The blue L and R VALVE OPEN lights use the same bright and dim logic as the cowl valves.',
      notes: [
        'On the ground the valves close automatically if either thrust lever is advanced past the takeoff warning position, or if a duct overheats, and reopen when the condition clears. This ground logic isn\'t modelled here.',
        'The switch is solenoid held and trips OFF at lift-off. That part is modelled.',
        'Wing anti-ice is used in flight as an anti-ice or de-ice tool. Your FCOM gives the conditions.',
      ] },
    { id: 'sys-ai-window', category: 'sys-antiice', name: 'Window Heat', where: 'Flight deck windows · Anti-ice panel',
      what: 'Electrical heating of the flight deck windows. The forward windshields (window 1) are heated for anti-icing and anti-fogging. The heated side windows are for anti-fogging. Heat also makes the windows more resistant to bird strikes.',
      how: 'Four switches: L SIDE, L FWD, R FWD and R SIDE, using 115 V AC. A controller cycles the power to hold the window at temperature. The green ON light shows heat is being applied, so it can go out when the window is already warm. An overheat removes power and lights the amber OVERHEAT light with MASTER CAUTION (ANTI-ICE).',
      notes: [
        'Reset after an overheat: switch OFF, let the window cool, then ON again. Follow your QRH for timing and what to do if it won\'t reset.',
        'With forward window heat inoperative, procedures usually include a speed limit below 10,000 ft because of the bird-strike risk. Use your operator\'s QRH.',
        'Exact window coverage and the bus feeding each switch vary by airframe. Here, left windows use transfer bus 1 and right windows bus 2.',
      ] },
    { id: 'sys-ai-probe', category: 'sys-antiice', name: 'Probe Heat', where: 'Forward fuselage · Anti-ice panel',
      what: 'Electrical heaters on the pitot probes, angle-of-attack vanes, elevator feel pitots and the TAT probe. The static ports are not heated.',
      how: 'PROBE HEAT A: captain pitot, left AOA vane, left elevator pitot and the TAT probe (transfer bus 1). PROBE HEAT B: F/O pitot, right AOA vane, right elevator pitot and the auxiliary pitot (transfer bus 2). An amber light for each probe shows it isn\'t heated. The TAT probe isn\'t heated on the ground.',
      notes: [
        'On some aircraft the captain pitot heater is powered from the AC standby bus. Later aircraft have an AUTO position that heats the probes once an engine is running.',
        'A blocked or iced pitot gives unreliable airspeed on the instruments it feeds. Compare the captain, F/O and standby (auxiliary pitot) indications.',
      ] },
  ],

  categories: [{ id: 'sys-antiice', label: 'Ice & Rain Protection' }],

  failures: [
    {
      id: 'wh-lfwd-ovht', title: 'Forward window overheat (L FWD)', system: 'antiice', group: 'Ice & Rain',
      setup: { onGround: false, engines: true, gearLever: 'UP', flapLever: 0 }, flags: ['fail.wh.lfwd'],
      summary: 'The left forward window controller senses an overheat and removes power from that window. The amber OVERHEAT light and MASTER CAUTION (ANTI-ICE) come on.',
      effects: (c) => [
        L('L FWD window heat', c.antiice.windows.lfwd),
        L('OVERHEAT light out', !c.antiice.ovht.lfwd),
        L('R FWD window heat', c.antiice.windows.rfwd),
        L('Side window heat (L and R)', c.antiice.windows.lside && c.antiice.windows.rside),
        I('Try the reset: switch L FWD OFF in the schematic, wait a few seconds, then ON again.'),
      ],
      know: [
        'Only the affected window loses heat. The other windows keep their own controllers.',
        'Without heat the forward window can fog or ice up, and it is less resistant to bird strikes.',
        'The QRH reset is OFF, a cooling wait, then ON. If it doesn\'t reset, your QRH gives the follow-up, typically including a speed limit at low altitude.',
      ],
    },
    {
      id: 'capt-pitot-heat', title: 'Captain pitot heat failure', system: 'antiice', group: 'Ice & Rain',
      setup: { onGround: false, engines: true, gearLever: 'UP', flapLever: 0 }, flags: ['fail.probe.capt'],
      summary: 'The captain pitot heater stops working. The amber CAPT PITOT light and MASTER CAUTION (ANTI-ICE) come on. In icing the probe can block.',
      effects: (c) => [
        L('Captain pitot heated', c.antiice.probes.captPitot),
        L('F/O pitot heated', c.antiice.probes.foPitot),
        L('Auxiliary pitot heated (standby instruments)', c.antiice.probes.auxPitot),
        L('Left AOA vane and TAT probe heated (same A system)', c.antiice.probes.aoaL && c.antiice.probes.tat),
      ],
      know: [
        'An iced pitot probe gives unreliable airspeed (and related warnings) on the instruments it feeds. It can be gradual and misleading.',
        'Compare the captain, F/O and standby airspeed. The F/O and auxiliary pitots are on probe heat B here, so they stay heated.',
        'Avoid icing conditions where possible and follow your QRH. For unreliable airspeed, use your operator\'s procedures.',
      ],
    },
    {
      id: 'engai1-valve', title: 'Engine 1 cowl anti-ice valve fails closed', system: 'antiice', group: 'Ice & Rain',
      setup: { onGround: false, engines: true, gearLever: 'UP', flapLever: 0, 'sw.engai1': true, 'sw.engai2': true },
      flags: ['fail.engai1'],
      summary: 'In icing conditions with both ENG ANTI-ICE switches ON, the engine 1 cowl valve fails closed. Its COWL VALVE OPEN light stays bright because the valve disagrees with the switch.',
      effects: (c) => [
        L('Engine 1 cowl valve open', c.antiice.cowl1),
        L('Engine 1 inlet lip heated', c.antiice.cowl1),
        L('Engine 2 cowl valve open', c.antiice.cowl2),
        I(c.antiice.cowl1Bright ? 'COWL VALVE OPEN 1 is bright: valve position disagrees with the switch.' : 'COWL VALVE OPEN 1 is not bright.'),
      ],
      know: [
        'Bright blue = in transit or disagreeing with the switch. Dim blue = open as commanded. A bright light that stays on is the clue.',
        'An unprotected inlet can build ice that sheds into the engine. Leave icing conditions if possible and follow your QRH.',
        'Engine anti-ice air is taken before the engine bleed valve, so the ENG BLEED switch doesn\'t affect it.',
      ],
    },
  ],

  labels: {
    'ai.cowl1': ['COWL VALVE OPEN 1', 'blue'], 'ai.cowl2': ['COWL VALVE OPEN 2', 'blue'],
    'wh.ovht.lside': ['L SIDE WINDOW OVERHEAT', 'amber'], 'wh.ovht.lfwd': ['L FWD WINDOW OVERHEAT', 'amber'],
    'wh.ovht.rfwd': ['R FWD WINDOW OVERHEAT', 'amber'], 'wh.ovht.rside': ['R SIDE WINDOW OVERHEAT', 'amber'],
    'probe.captPitot': ['CAPT PITOT', 'amber'], 'probe.foPitot': ['F/O PITOT', 'amber'], 'probe.auxPitot': ['AUX PITOT', 'amber'],
    'probe.aoaL': ['L ALPHA VANE', 'amber'], 'probe.aoaR': ['R ALPHA VANE', 'amber'], 'probe.tat': ['TEMP PROBE', 'amber'],
    'probe.elevL': ['L ELEV PITOT', 'amber'], 'probe.elevR': ['R ELEV PITOT', 'amber'],
  },

  normal: {
    'sw.engai1': false, 'sw.engai2': false,
    'sw.wh.lside': true, 'sw.wh.lfwd': true, 'sw.wh.rfwd': true, 'sw.wh.rside': true,
    'sw.probe.a': true, 'sw.probe.b': true,
  },

  scenario: [],
};

// ---- helpers (hoisted function declarations / consts used above at call time)
function cowlStatus(c, n) {
  const st = c.antiice.cowlState[n];
  if (st.open && !st.transit) return 'OPEN';
  if (st.transit) return 'IN TRANSIT';
  if (st.disagree) return c.s[`fail.engai${n}`] ? 'DISAGREE' : 'NO BLEED';
  return 'CLOSED';
}
function winStatus(c, w) {
  if (c.antiice.ovht[w]) return 'OVHT';
  if (!c.s[`sw.wh.${w}`]) return 'OFF';
  if (!c.antiice.winPower[w]) return 'NO POWER';
  return 'ON';
}
function py(i) { return 460 + i * 36; }
function probeNode(k, label, x, i) {
  return { id: `pr-${k}`, kind: 'box', label, x, y: py(i), w: 140, h: 26, active: (c) => c.antiice.probes[k], part: 'sys-ai-probe' };
}
function L(text, ok) { return { text, state: ok ? 'ok' : 'lost' }; }
function I(text) { return { text, state: 'info' }; }
