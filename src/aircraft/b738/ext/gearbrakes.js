// System extension: landing gear, wheel brakes, antiskid, autobrake and parking brake (737-800 NG).
// Simplified study model: hydraulic sources and selection logic follow the real architecture,
// pressures and timings are approximate and sped up. Operator documents (FCOM/QRH) take precedence.

const MODES = ['OFF', 'RTO', '1', '2', '3', 'MAX'];
const LANDING = ['1', '2', '3', 'MAX'];
const ACC_FULL = 3000; // typical charged accumulator / system pressure (psi)
const ACC_PRECHARGE = 1000; // nitrogen precharge: no usable fluid left at this reading
const ACC_PER_APPLICATION = 350; // demo value: a full pedal application without A or B
const SELF_TEST_S = 1.6; // RTO self-test: AUTO BRAKE DISARM lit briefly when RTO is selected on the ground

const dyn = {
  init: false,
  acc: ACC_FULL,
  lastB: false, // system B pressure at the last compute (accumulator recharge)
  prevGround: true,
  testUntil: 0,
  latch: false, // autobrake disarmed (light on until the selector goes to OFF)
  landed: false, // touched down with a landing mode armed: autobrake applying
  sbUp: false, // speed brake deployed during the landing roll
};

const brakeSources = (s, out) => {
  const B = out.hyd.B, A = out.hyd.A;
  const normal = B;
  const alt = !B && A; // brake selector valve switches to system A when system B pressure is lost
  const accOnly = !A && !B && dyn.acc > ACC_PRECHARGE + 50;
  return { normal, alt, accOnly, any: normal || alt || accOnly };
};

export default {
  id: 'gearbrakes',
  state: {
    'sw.autobrake': 'OFF', 'sw.parkbrake': true, 'gb.manualExt': false,
    'fail.antiskid': false, 'fail.autobrake': false,
  },

  set(key, value, api) {
    const s = api.state;
    switch (key) {
      case 'sw.autobrake': {
        const v = String(value);
        if (!MODES.includes(v)) return api.deny(`Autobrake positions: ${MODES.join(', ')}`);
        s['sw.autobrake'] = v;
        dyn.latch = false; // moving the selector resets a disarm
        dyn.landed = false;
        dyn.sbUp = false;
        dyn.testUntil = v === 'RTO' && s.onGround ? api.time + SELF_TEST_S : 0;
        if (v === 'RTO' && !s.onGround) api.emit({ type: 'info', message: 'RTO only arms on the ground. Select it before takeoff, and OFF after takeoff.' });
        return { ok: true };
      }
      case 'act.gb.pedals': {
        const p = api.panel();
        const src = brakeSources(s, p);
        if (dyn.landed && !dyn.latch && LANDING.includes(s['sw.autobrake'])) {
          dyn.latch = true;
          api.emit({ type: 'info', message: 'Manual braking disarms the autobrake: AUTO BRAKE DISARM comes on.' });
        }
        if (!src.normal && !src.alt) {
          if (!src.accOnly) return api.deny('No brake pressure: systems A and B are lost and the accumulator is down to its precharge.');
          dyn.acc = Math.max(ACC_PRECHARGE, dyn.acc - ACC_PER_APPLICATION);
          api.emit({ type: 'info', message: `Accumulator braking: ${Math.round(dyn.acc)} psi left. Each full application uses some of the stored fluid.` });
        } else {
          api.emit({ type: 'info', message: src.normal ? 'Brakes applied with normal brakes (system B).' : 'Brakes applied with alternate brakes (system A).' });
        }
        return { ok: true };
      }
      case 'gb.manualExt': {
        if (!value) { s['gb.manualExt'] = false; return { ok: true }; }
        if (s.onGround) return api.deny('Manual gear extension is an in-flight procedure. On the ground the gear is already down.');
        s['gb.manualExt'] = true;
        if (s.gearLever !== 'DN') api.set('gearLever', 'DN');
        api.emit({ type: 'info', message: 'Manual extension handles pulled: the uplocks release and the gear free-falls by gravity and air load to down and locked.' });
        return { ok: true };
      }
      case 'onGround':
        if (value === false && s.onGround) {
          if (s['sw.parkbrake']) {
            s['sw.parkbrake'] = false;
            api.emit({ type: 'info', message: 'Parking brake released for takeoff. Advancing thrust with it set triggers the takeoff configuration warning.' });
          }
          s['gb.manualExt'] = false; // handles are stowed before the next flight
        }
        return undefined; // the core handles the phase change itself
      default:
        return undefined;
    }
  },

  update(dt, api) {
    const s = api.state;
    // system B charges the accumulator through a check valve; otherwise it holds its charge
    if (dyn.lastB) dyn.acc = Math.min(ACC_FULL, dyn.acc + 1500 * dt);
    const ground = !!s.onGround;
    if (dyn.init && ground !== dyn.prevGround) {
      if (ground) {
        // touchdown
        if (s['sw.autobrake'] === 'RTO') {
          dyn.latch = true;
          api.emit({ type: 'info', message: 'Landed with RTO selected: no autobraking and AUTO BRAKE DISARM comes on.' });
        } else if (LANDING.includes(s['sw.autobrake']) && !dyn.latch) dyn.landed = true;
      } else {
        dyn.landed = false;
        dyn.sbUp = false;
      }
    }
    // speed brake lever pushed back to DOWN during the landing roll disarms the autobrake
    if (dyn.landed && !dyn.latch) {
      if (s.speedbrake === 'UP') dyn.sbUp = true;
      else if (s.speedbrake === 'DOWN' && dyn.sbUp) {
        dyn.latch = true;
        api.emit({ type: 'info', message: 'Speed brake lever moved to DOWN: autobrake disarmed.' });
      }
    }
    dyn.prevGround = ground;
    dyn.init = true;
  },

  compute(s, out, api) {
    dyn.lastB = out.hyd.B;
    const src = brakeSources(s, out);
    const mode = s['sw.autobrake'];
    const testing = api.time < dyn.testUntil && mode === 'RTO' && s.onGround;
    const antiskidInop = !!s['fail.antiskid'];
    // autobrake needs normal brakes (system B) and normal antiskid
    const abAvail = out.hyd.B && !antiskidInop && !s['fail.autobrake'];
    const ok = abAvail && !dyn.latch && !testing;
    const rtoArmed = ok && mode === 'RTO' && !!s.onGround;
    const landArmed = ok && LANDING.includes(mode) && !s.onGround;
    const applying = ok && LANDING.includes(mode) && !!s.onGround && dyn.landed;
    const autobrakeDisarm = mode !== 'OFF' && (testing || dyn.latch || !!s['fail.autobrake'] || antiskidInop);
    const gearPress = out.hyd.A && s.gearLever !== 'OFF';
    const pos = api.gearPos; // 0 down & locked, 1 up & locked
    return {
      normalBrakes: src.normal, altBrakes: src.alt, accOnly: src.accOnly, anyBrakes: src.any,
      accumulator: Math.round(dyn.acc),
      parkSet: !!s['sw.parkbrake'] && dyn.acc > ACC_PRECHARGE + 50,
      autobrakeArmed: rtoArmed || landArmed || applying,
      autobrakeApplying: applying, autobrakeAvail: abAvail, autobrakeTesting: testing,
      autobrakeDisarm,
      antiskidInop,
      antiskid: antiskidInop ? 'INOP' : src.normal ? 'NORMAL' : src.alt || src.accOnly ? 'ALTERNATE' : 'NO PRESSURE',
      gearPress, gearPos: pos, lgtu: !!out.hyd.lgtu, manualExt: !!s['gb.manualExt'],
      gearState: pos <= 0.0001 ? 'DOWN & LOCKED' : pos >= 0.9999 ? 'UP & LOCKED' : 'IN TRANSIT',
    };
  },

  ann(r, s) {
    return {
      'gb.antiskidInop': r.antiskidInop,
      'gb.autobrakeDisarm': r.autobrakeDisarm,
      'gb.parkBrake': !!s['sw.parkbrake'],
    };
  },

  // ANTISKID INOP, AUTO BRAKE DISARM and PARKING BRAKE are stand-alone lights (no MASTER CAUTION here)
  cats: () => [],

  schematics: [{
    id: 'gearbrakes', category: 'sys-gearbrakes', title: 'Gear & Brakes', color: 'gear',
    intro: 'Normal brakes use system B, alternate brakes system A, and an accumulator keeps a reserve for parking and emergencies. Gear retraction and extension use system A, with the transfer unit and manual extension as backups. Click the selector, parking brake, pedals or handles to operate them.',
    nodes: [
      { id: 'sysA', kind: 'bus', label: 'HYDRAULIC SYSTEM A', x: 40, y: 40, w: 260, active: (c) => c.hyd.A, part: 'sys-gb-brakes' },
      { id: 'sysB', kind: 'bus', label: 'HYDRAULIC SYSTEM B', x: 700, y: 40, w: 260, active: (c) => c.hyd.B, part: 'sys-gb-brakes' },
      // ---- brakes
      { id: 'acc', kind: 'box', label: 'BRAKE ACCUMULATOR', x: 720, y: 90, w: 180, h: 46, active: (c) => c.gearbrakes.accumulator > ACC_PRECHARGE + 50, part: 'sys-gb-accumulator', status: (c) => `${c.gearbrakes.accumulator.toLocaleString('en-US')} PSI` },
      { id: 'sel', kind: 'box', label: 'BRAKE SELECTOR VALVE', x: 400, y: 130, w: 200, h: 46, active: (c) => c.gearbrakes.anyBrakes, part: 'sys-gb-brakes', status: (c) => (c.gearbrakes.normalBrakes ? 'NORMAL · B' : c.gearbrakes.altBrakes ? 'ALTERNATE · A' : c.gearbrakes.accOnly ? 'ACCUMULATOR' : 'NO PRESSURE') },
      { id: 'askid', kind: 'box', label: 'ANTISKID VALVES', x: 400, y: 220, w: 200, h: 46, active: (c) => c.gearbrakes.anyBrakes && !c.gearbrakes.antiskidInop, part: 'sys-gb-antiskid', status: (c) => c.gearbrakes.antiskid },
      { id: 'askidInop', kind: 'annun', label: 'ANTISKID INOP', x: 220, y: 228, w: 160, h: 30, active: (c) => c.gearbrakes.antiskidInop, part: 'sys-gb-antiskid' },
      { id: 'ab', kind: 'box', label: 'AUTOBRAKE', x: 720, y: 170, w: 180, h: 46, active: (c) => c.gearbrakes.autobrakeArmed, part: 'sys-gb-autobrake', control: { key: 'sw.autobrake', type: 'cycle', values: MODES }, status: (c) => abStatus(c) },
      { id: 'abDis', kind: 'annun', label: 'AUTO BRAKE DISARM', x: 720, y: 226, w: 180, h: 30, active: (c) => c.gearbrakes.autobrakeDisarm, part: 'sys-gb-autobrake' },
      { id: 'pb', kind: 'box', label: 'PARKING BRAKE', x: 720, y: 290, w: 180, h: 40, active: (c) => c.gearbrakes.parkSet, part: 'sys-gb-parking', control: { key: 'sw.parkbrake', type: 'toggle', on: 'SET', off: 'RELEASED' } },
      { id: 'pbAnn', kind: 'annun', label: 'PARKING BRAKE', x: 720, y: 340, w: 180, h: 30, active: (c) => c.s['sw.parkbrake'], part: 'sys-gb-parking' },
      { id: 'pedals', kind: 'box', label: 'BRAKE PEDALS', x: 40, y: 290, w: 170, h: 40, active: (c) => c.gearbrakes.anyBrakes, part: 'sys-gb-brakes', control: { key: 'act.gb.pedals', type: 'action' }, status: () => 'APPLY' },
      ...[['1', 'L OUTBD'], ['2', 'L INBD'], ['3', 'R INBD'], ['4', 'R OUTBD']].map(([n, l], i) => (
        { id: `wb${n}`, kind: 'box', label: `BRAKE ${n}`, x: 300 + i * 105, y: 340, w: 95, h: 46, active: (c) => c.gearbrakes.anyBrakes, part: 'sys-gb-brakes', status: () => l }
      )),
      // ---- landing gear
      { id: 'gearHdr', kind: 'label', label: 'LANDING GEAR', x: 40, y: 418 },
      { id: 'lever', kind: 'box', label: 'GEAR LEVER', x: 40, y: 440, w: 180, h: 46, active: (c) => c.gearbrakes.gearPress, part: 'sys-gb-gear', control: { key: 'gearLever', type: 'cycle', values: ['UP', 'OFF', 'DN'] } },
      { id: 'act', kind: 'box', label: 'GEAR ACTUATORS & LOCKS', x: 330, y: 440, w: 340, h: 46, active: (c) => c.gearbrakes.gearPress || c.gearbrakes.lgtu, part: 'sys-gb-gear', status: (c) => c.gearbrakes.gearState },
      { id: 'lgtu', kind: 'box', label: 'GEAR TRANSFER UNIT', x: 760, y: 440, w: 180, h: 46, active: (c) => c.gearbrakes.lgtu, part: 'sys-hyd-lgtu', status: (c) => (c.gearbrakes.lgtu ? 'ACTIVE' : 'STANDBY') },
      { id: 'man', kind: 'box', label: 'MANUAL EXTENSION', x: 400, y: 550, w: 200, h: 46, active: (c) => c.gearbrakes.manualExt, part: 'sys-gb-manual', control: { key: 'gb.manualExt', type: 'action' }, status: (c) => (c.gearbrakes.manualExt ? 'PULLED' : 'STOWED') },
    ],
    lines: [
      // alternate brakes: system A to the selector valve
      { pts: [[150, 52], [150, 153], [400, 153]], live: (c) => c.gearbrakes.altBrakes },
      // normal brakes: system B charges the accumulator and feeds the selector valve
      { pts: [[810, 52], [810, 90]], live: (c) => c.hyd.B },
      { pts: [[720, 113], [660, 113], [660, 153], [600, 153]], live: (c) => c.gearbrakes.normalBrakes || c.gearbrakes.accOnly },
      // autobrake pressure control into the normal antiskid valves
      { pts: [[720, 193], [650, 193], [650, 243], [600, 243]], live: (c) => c.gearbrakes.autobrakeApplying },
      { pts: [[500, 176], [500, 220]], live: (c) => c.gearbrakes.anyBrakes },
      { pts: [[500, 266], [500, 318]], live: (c) => c.gearbrakes.anyBrakes },
      { pts: [[347, 318], [663, 318]], live: (c) => c.gearbrakes.anyBrakes },
      ...[0, 1, 2, 3].map((i) => ({ pts: [[347 + i * 105, 318], [347 + i * 105, 340]], live: (c) => c.gearbrakes.anyBrakes })),
      // gear: system A through the lever-controlled selector valve
      { pts: [[40, 46], [25, 46], [25, 463], [40, 463]], live: (c) => c.hyd.A },
      { pts: [[220, 463], [330, 463]], live: (c) => c.gearbrakes.gearPress },
      // LGTU: system B volume for retraction after an engine 1 failure
      { pts: [[920, 52], [920, 440]], live: (c) => c.gearbrakes.lgtu },
      { pts: [[760, 463], [670, 463]], live: (c) => c.gearbrakes.lgtu },
      // manual extension: cables release the uplocks
      { pts: [[500, 550], [500, 486]], live: (c) => c.gearbrakes.manualExt, kind: 'tie' },
    ],
  }],

  parts: [
    { id: 'sys-gb-brakes', category: 'sys-gearbrakes', name: 'Wheel Brakes', where: 'Main gear (4 brakes) · Rudder pedals',
      what: 'Each of the four main wheels has a hydraulic brake, operated by the toe brakes on either pilot\'s rudder pedals. The nose wheels have no brakes.',
      how: 'Normal brakes use system B. If system B pressure is lost, the brake selector valve automatically switches to the alternate brakes on system A. With both systems lost, the accumulator on the normal brake line still gives a limited amount of braking.',
      notes: [
        'Autobrake works only with normal brakes.',
        'Try it: in the Failures tab, run the system B loss or accumulator-only scenario and press BRAKE PEDALS.',
      ] },
    { id: 'sys-gb-accumulator', category: 'sys-gearbrakes', name: 'Brake Accumulator', where: 'Main wheel well · Brake pressure gauge',
      what: 'A nitrogen-precharged accumulator on the normal brake line. It holds pressure for the parking brake and gives emergency braking if both hydraulic systems are lost.',
      how: 'System B charges it to normal system pressure (about 3,000 psi on the brake pressure indicator). A check valve keeps the charge if system B is lost. The indicator reads the precharge (about 1,000 psi) when no usable fluid is left.',
      notes: [
        'It supports only a limited number of brake applications, so use them sparingly. The drop per application shown here is a demo value.',
      ] },
    { id: 'sys-gb-antiskid', category: 'sys-gearbrakes', name: 'Antiskid', where: 'Brake system · ANTISKID INOP light',
      what: 'Prevents the wheels from locking and skidding, which could burst a tyre or reduce braking.',
      how: 'Normal antiskid works with the normal brakes and controls each wheel individually. Alternate antiskid works with the alternate brakes and controls the wheels in pairs. It also gives touchdown and locked-wheel protection. The amber ANTISKID INOP light shows the monitoring system found a fault.',
      notes: [
        'With antiskid inoperative, autobrake is not available and the wheels can lock, so brake gently and progressively. Follow your QRH.',
      ] },
    { id: 'sys-gb-autobrake', category: 'sys-gearbrakes', name: 'Autobrake', where: 'Center forward panel',
      what: 'Applies the brakes automatically: RTO gives maximum braking for a rejected takeoff, and 1, 2, 3 and MAX give a selected deceleration on landing.',
      how: 'Uses system B through the normal antiskid. RTO arms on the ground (AUTO BRAKE DISARM lights for a moment as a self-test) and brakes at maximum pressure if the thrust levers are closed above about 90 kt. Landing modes apply the brakes after touchdown with the thrust levers at idle.',
      notes: [
        'AUTO BRAKE DISARM comes on when the autobrake is disarmed during a landing or RTO: speed brake lever to DOWN, manual braking, thrust levers advanced (apart from the first seconds after touchdown), landing with RTO still selected, or a fault. Selecting OFF resets it.',
        'Modelled here: self-test, landing with RTO, manual braking, speed brake lever to DOWN, faults. Thrust lever logic isn\'t simulated.',
      ] },
    { id: 'sys-gb-parking', category: 'sys-gearbrakes', name: 'Parking Brake', where: 'Center pedestal · PARKING BRAKE light',
      what: 'Holds the brakes on when parked.',
      how: 'Set by pressing the brake pedals and pulling the lever, which closes the parking brake valve and traps pressure from the accumulator. The red PARKING BRAKE light shows it\'s set.',
      notes: [
        'Advancing the thrust levers with the parking brake set triggers the takeoff configuration warning.',
        'If the accumulator is depleted the parking brake may not hold, so chocks are needed. Here, it is released automatically when you go to Flight.',
      ] },
    { id: 'sys-gb-gear', category: 'sys-gearbrakes', name: 'Landing Gear Actuation', where: 'Main and nose wheel wells · Gear lever',
      what: 'Two main gears retracting inboard into the fuselage (no main gear doors, the wheels form part of the fuselage contour) and a nose gear retracting forward. Each gear is held by an uplock when up and by locking struts when down.',
      how: 'System A powers retraction and extension through the selector valve moved by the gear lever. Lever OFF removes pressure from the gear system. A lever lock stops selection of UP on the ground, with an override trigger.',
      notes: [
        'Green lights = down and locked. Red lights = disagreement with the lever or gear in transit.',
        'Losing system A means manual gear extension.',
      ] },
    { id: 'sys-gb-manual', category: 'sys-gearbrakes', name: 'Manual Gear Extension', where: 'Flight deck floor (manual extension access door)',
      what: 'Three handles, one per gear, that mechanically release the uplocks so the gear can extend without hydraulic pressure.',
      how: 'With the gear lever OFF (procedure), pulling a handle releases that gear\'s uplock. The gear free-falls by gravity and air loads, and springs help the locks engage down and locked.',
      notes: [
        'Follow your QRH for the full manual extension procedure. Once extended manually, the gear can\'t be retracted in flight here.',
      ] },
  ],

  categories: [{ id: 'sys-gearbrakes', label: 'Landing Gear & Brakes' }],

  failures: [
    {
      id: 'antiskid-inop', title: 'Antiskid inoperative', system: 'gearbrakes', group: 'Gear & Brakes',
      setup: { onGround: false, engines: true, gearLever: 'DN', flapLever: 30, 'sw.autobrake': '2' }, flags: ['fail.antiskid'],
      summary: 'On approach with autobrake 2 armed, the antiskid monitor detects a fault. ANTISKID INOP comes on and the autobrake disarms.',
      effects: (c) => [
        L('Antiskid protection', !c.gearbrakes.antiskidInop),
        L('Autobrake available', c.gearbrakes.autobrakeAvail),
        L('Normal brakes (system B) still available', c.gearbrakes.normalBrakes),
        I(c.gearbrakes.autobrakeDisarm ? 'AUTO BRAKE DISARM is lit with the selector out of OFF.' : 'AUTO BRAKE DISARM is out.'),
      ],
      know: [
        'Brakes still work, but without antiskid the wheels can lock, so heavy pedal pressure can skid and burst tyres.',
        'Plan for a longer landing distance and brake smoothly. Your QRH lists the landing considerations.',
        'Autobrake depends on the normal antiskid, so plan a manual-braking landing.',
      ],
    },
    {
      id: 'autobrake-fail', title: 'Autobrake failure', system: 'gearbrakes', group: 'Gear & Brakes',
      setup: { onGround: false, engines: true, gearLever: 'DN', flapLever: 30, 'sw.autobrake': '3' }, flags: ['fail.autobrake'],
      summary: 'The autobrake system detects a fault on approach. AUTO BRAKE DISARM comes on and no automatic braking will occur on landing.',
      effects: (c) => [
        L('Autobrake armed', c.gearbrakes.autobrakeArmed),
        L('Normal brakes (manual)', c.gearbrakes.normalBrakes),
        L('Antiskid', !c.gearbrakes.antiskidInop),
        I('Set the selector OFF and the DISARM light goes out.'),
      ],
      know: [
        'Manual braking and antiskid are unaffected.',
        'Brief the manual braking technique and check landing distance for no autobrake.',
      ],
    },
    {
      id: 'hyd-b-brakes', title: 'System B loss: alternate brakes', system: 'gearbrakes', group: 'Gear & Brakes',
      setup: { onGround: false, engines: true, gearLever: 'DN', flapLever: 15, 'sw.autobrake': '2' }, flags: ['fail.hyd.b'],
      summary: 'System B loses its fluid. The brake selector valve switches to the alternate brakes on system A, the accumulator keeps its charge, and autobrake is lost.',
      effects: (c) => [
        L('Normal brakes (system B)', c.gearbrakes.normalBrakes),
        L('Alternate brakes (system A)', c.gearbrakes.altBrakes),
        L(`Accumulator charge (${c.gearbrakes.accumulator.toLocaleString('en-US')} psi)`, c.gearbrakes.accumulator > ACC_PRECHARGE + 50),
        L('Autobrake', c.gearbrakes.autobrakeAvail),
        I('Antiskid is now the alternate (paired wheel) system.'),
      ],
      know: [
        'The switch to alternate brakes is automatic. Pedal feel and antiskid protection change slightly.',
        'Autobrake needs the normal brake system, so plan manual braking.',
        'System B loss also affects flaps, leading-edge devices and other users. Check the Hydraulics tab and your QRH.',
      ],
    },
    {
      id: 'acc-only', title: 'Systems A and B lost: accumulator braking', system: 'gearbrakes', group: 'Gear & Brakes',
      setup: { onGround: false, engines: true, gearLever: 'UP', flapLever: 0 }, flags: ['fail.hyd.a', 'fail.hyd.b'],
      summary: 'Both main hydraulic systems are lost. Only the brake accumulator is left for braking, and the gear has to be extended manually.',
      effects: (c) => [
        L('Normal and alternate brakes', c.gearbrakes.normalBrakes || c.gearbrakes.altBrakes),
        L(`Accumulator braking (${c.gearbrakes.accumulator.toLocaleString('en-US')} psi)`, c.gearbrakes.accOnly),
        L('Gear hydraulic pressure (system A)', c.gearbrakes.gearPress),
        L(c.gearbrakes.manualExt ? 'Gear extended manually' : 'Gear extension (use MANUAL EXTENSION)', c.gearbrakes.manualExt),
        I('Press BRAKE PEDALS a few times and watch the accumulator pressure fall toward its precharge.'),
      ],
      know: [
        'The accumulator gives a limited number of applications. Apply the brakes once, steadily, and avoid pumping the pedals.',
        'Without system A there\'s no nose wheel steering and no normal gear extension.',
        'Manual reversion of the flight controls and the standby system also come into play. Follow your QRH.',
      ],
    },
  ],

  labels: {
    'gb.antiskidInop': ['ANTISKID INOP', 'amber'],
    'gb.autobrakeDisarm': ['AUTO BRAKE DISARM', 'amber'],
    'gb.parkBrake': ['PARKING BRAKE', 'red'],
  },

  normal: { 'sw.autobrake': 'OFF', 'sw.parkbrake': false, 'gb.manualExt': false },

  scenario: [],
};

function abStatus(c) {
  const g = c.gearbrakes, m = c.s['sw.autobrake'];
  if (m === 'OFF') return 'OFF';
  if (g.autobrakeTesting) return 'RTO · TEST';
  if (g.autobrakeApplying) return `${m} · BRAKING`;
  if (g.autobrakeArmed) return `${m} · ARMED`;
  if (g.autobrakeDisarm) return `${m} · DISARMED`;
  if (!g.autobrakeAvail) return `${m} · INOP`;
  return m === 'RTO' ? 'RTO · NOT ARMED' : `${m} · ARMS IN AIR`;
}
function L(text, ok) { return { text, state: ok ? 'ok' : 'lost' }; }
function I(text) { return { text, state: 'info' }; }
