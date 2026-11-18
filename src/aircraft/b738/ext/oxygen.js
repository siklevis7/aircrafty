// System extension: crew and passenger oxygen (737-800 NG).
//
// Crew: one high-pressure gaseous cylinder feeding the flight deck masks through a shutoff valve
// and pressure regulator. Passengers: chemical oxygen generators in the passenger service units,
// lavatories and attendant stations, triggered by an altitude pressure switch or the PASS OXY switch.
//
// Study simplifications:
// - Mask deployment latches. It resets on the ground with PASS OXY in NORMAL (in reality the
//   generators are one-shot and need maintenance), and when a scenario restores the normal config.
// - fail.oxy.crew models a leak: cylinder pressure bleeds down over about a minute.

const FULL_PSI = 1850; // typical full crew cylinder pressure
const DEPLOY_ALT = 14000; // ft cabin altitude: automatic mask deployment (approximate)

const sims = new WeakMap();
function sim(s) {
  let m = sims.get(s);
  if (!m) { m = { crew: FULL_PSI, deployed: false }; sims.set(s, m); }
  return m;
}

const fmtFt = (v) => `${Math.round(v / 10) * 10 < 0 ? '-' : ''}${Math.abs(Math.round(v / 10) * 10).toLocaleString('en-US')} FT`;
const psi = (v) => `${Math.round(v).toLocaleString('en-US')} PSI`;
const L = (text, ok) => ({ text, state: ok ? 'ok' : 'lost' });
const I = (text) => ({ text, state: 'info' });
const IN_FLIGHT = { onGround: false, engines: true, gearLever: 'UP', flapLever: 0, altitude: 35000 };
const O = (c) => c.oxygen;

export default {
  id: 'oxygen',
  state: {
    'sw.oxy.pax': 'NORMAL',
    'fail.oxy.crew': false,
  },

  set(key, value, api) {
    const s = api.state;
    if (key === 'sw.oxy.pax') {
      if (value !== 'NORMAL' && value !== 'ON') return api.deny('PASS OXY is NORMAL or ON.');
      s['sw.oxy.pax'] = value;
      if (value === 'ON') api.emit({ type: 'info', message: 'PASS OXY ON: the passenger masks drop whatever the cabin altitude. Each generator starts when its mask is pulled and can\'t be stopped.' });
      return { ok: true };
    }
    if (key === 'act.oxy.reset') { // part of the normal config: serviced cylinder, masks stowed
      const m = sim(s);
      m.crew = FULL_PSI;
      m.deployed = false;
      return { ok: true };
    }
    return undefined;
  },

  update(dt, api) {
    const s = api.state;
    const m = sim(s);
    if (!(dt > 0)) return;
    if (s['fail.oxy.crew'] && m.crew > 0) m.crew = Math.max(0, m.crew - m.crew * 0.035 * Math.min(dt, 0.5) - 1.5 * Math.min(dt, 0.5));
  },

  compute(s, out) {
    const m = sim(s);
    const cabinAlt = out.pressurization?.cabinAlt ?? 0;
    const sw = s['sw.oxy.pax'] === 'ON';
    const autoTrip = !s.onGround && cabinAlt > DEPLOY_ALT;
    if (sw || autoTrip) m.deployed = true;
    else if (s.onGround && m.deployed && cabinAlt < DEPLOY_ALT) m.deployed = false; // reset after landing
    const crewSupply = m.crew > 100;
    return {
      masksDeployed: m.deployed,
      paxOn: m.deployed,
      crewPressure: m.crew,
      // extras for the schematic and failures
      cabinAlt, autoTrip, switchOn: sw,
      crewSupply, crewLow: m.crew < FULL_PSI * 0.6,
      crewInUse: crewSupply && !!out.pressurization?.warn,
    };
  },

  ann(r) { return { 'oxy.paxOn': r.paxOn }; },
  cats() { return []; }, // no master caution: crew oxygen is read on the gauge

  labels: { 'oxy.paxOn': ['PASS OXY ON', 'amber'] },
  normal: { 'sw.oxy.pax': 'NORMAL', 'act.oxy.reset': true },

  categories: [{ id: 'sys-oxygen', label: 'Oxygen' }],

  schematics: [{
    id: 'oxygen', category: 'sys-oxygen', title: 'Oxygen', color: 'oxy',
    intro: 'Two separate systems. The crew breathes stored oxygen from a high-pressure cylinder. Passengers get oxygen from chemical generators when the masks drop, automatically at high cabin altitude or with the PASS OXY switch.',
    nodes: [
      // crew side
      { id: 'cyl', kind: 'box', label: 'CREW O2 CYLINDER', x: 60, y: 50, w: 200, h: 60, active: (c) => O(c).crewSupply, part: 'sys-oxy-cylinder', status: (c) => psi(O(c).crewPressure) },
      { id: 'disc', kind: 'box', label: 'OVBD DISCHARGE', x: 290, y: 58, w: 150, h: 44, active: () => true, part: 'sys-oxy-disc', status: () => 'DISC INTACT' },
      { id: 'shutoff', kind: 'valve', label: 'SHUTOFF VALVE', x: 160, y: 170, orient: 'v', active: () => true, part: 'sys-oxy-regulator', status: () => 'OPEN' },
      { id: 'reg', kind: 'box', label: 'PRESSURE REGULATOR', x: 60, y: 230, w: 200, h: 44, active: (c) => O(c).crewSupply, part: 'sys-oxy-regulator', status: (c) => (!O(c).crewSupply ? 'NO SUPPLY' : O(c).crewLow ? 'LOW PRESSURE' : 'NORMAL') },
      { id: 'crewBus', kind: 'bus', label: 'CREW SUPPLY', x: 50, y: 320, w: 380, active: (c) => O(c).crewSupply, part: 'sys-oxy-regulator' },
      ...[['capt', 'CAPTAIN MASK', 50], ['fo', 'F/O MASK', 180], ['obs', 'OBSERVER MASK', 310]].map(([id, label, x]) => ({
        id, kind: 'box', label, x, y: 400, w: 120, h: 44, active: (c) => O(c).crewSupply, part: 'sys-oxy-crewmask',
        status: (c) => (!O(c).crewSupply ? 'NO O2' : O(c).crewInUse ? 'IN USE' : 'READY'),
      })),
      { id: 'crewLbl', kind: 'label', label: 'CREW · STORED GAS', x: 50, y: 490 },

      // passenger side
      { id: 'paxSw', kind: 'box', label: 'PASS OXY SWITCH', x: 530, y: 60, w: 190, h: 50, active: (c) => O(c).switchOn, part: 'sys-oxy-paxswitch', control: { key: 'sw.oxy.pax', type: 'cycle', values: ['NORMAL', 'ON'] }, status: (c) => c.s['sw.oxy.pax'] },
      { id: 'paxOn', kind: 'annun', label: 'PASS OXY ON', x: 750, y: 68, w: 190, h: 34, active: (c) => O(c).paxOn, part: 'sys-oxy-paxswitch' },
      { id: 'altSw', kind: 'box', label: 'ALTITUDE SWITCH', x: 750, y: 140, w: 190, h: 50, active: (c) => O(c).autoTrip, part: 'sys-oxy-auto', status: (c) => (c.s.onGround ? 'ON GROUND' : `CABIN ${fmtFt(O(c).cabinAlt)}`) },
      { id: 'psu', kind: 'box', label: 'O2 GENERATORS', x: 530, y: 230, w: 410, h: 50, active: (c) => O(c).masksDeployed, part: 'sys-oxy-generator', status: (c) => (O(c).masksDeployed ? 'ACTIVATE ON PULL · ~12 MIN' : 'ARMED') },
      { id: 'paxBus', kind: 'bus', label: 'MASK DOORS', x: 530, y: 320, w: 410, active: (c) => O(c).masksDeployed, part: 'sys-oxy-generator' },
      ...[['mPax', 'PAX ROWS', 530], ['mLav', 'LAVATORIES', 670], ['mFa', 'ATTENDANTS', 810]].map(([id, label, x]) => ({
        id, kind: 'box', label, x, y: 400, w: 130, h: 44, active: (c) => O(c).masksDeployed, part: 'sys-oxy-generator',
        status: (c) => (O(c).masksDeployed ? 'DEPLOYED' : 'STOWED'),
      })),
      { id: 'paxLbl', kind: 'label', label: 'PASSENGERS · CHEMICAL', x: 530, y: 490 },
    ],
    lines: [
      { pts: [[260, 80], [290, 80]], live: () => false, kind: 'feed' },
      { pts: [[160, 110], [160, 150]], live: (c) => O(c).crewSupply },
      { pts: [[160, 190], [160, 230]], live: (c) => O(c).crewSupply },
      { pts: [[160, 274], [160, 320]], live: (c) => O(c).crewSupply },
      ...[110, 240, 370].map((x) => ({ pts: [[x, 332], [x, 400]], live: (c) => O(c).crewInUse })),
      // deployment signals: switch or altitude switch
      { pts: [[625, 110], [625, 230]], live: (c) => O(c).switchOn, kind: 'tie' },
      { pts: [[845, 190], [845, 230]], live: (c) => O(c).autoTrip, kind: 'tie' },
      { pts: [[735, 280], [735, 320]], live: (c) => O(c).masksDeployed },
      ...[595, 735, 875].map((x) => ({ pts: [[x, 332], [x, 400]], live: (c) => O(c).masksDeployed })),
    ],
  }],

  parts: [
    { id: 'sys-oxy-cylinder', category: 'sys-oxygen', name: 'Crew Oxygen Cylinder', where: 'Lower fuselage, pressure shown on the overhead oxygen panel',
      what: 'A single high-pressure cylinder of gaseous oxygen for the flight crew, about 1,850 psi when full.',
      how: 'The CREW OXYGEN pressure indicator shows cylinder pressure. The minimum pressure for dispatch depends on crew number, temperature and the operator\'s chart.',
      notes: ['Here, the crew oxygen failure makes the cylinder pressure bleed down.'] },
    { id: 'sys-oxy-disc', category: 'sys-oxygen', name: 'Overboard Discharge Indicator', where: 'Fuselage exterior',
      what: 'A green disc on the outside of the fuselage. If the cylinder overpressurizes, its relief device vents the oxygen overboard and blows the disc out.',
      how: 'A missing green disc on the walkaround means the crew oxygen has discharged and needs checking.',
      notes: [] },
    { id: 'sys-oxy-regulator', category: 'sys-oxygen', name: 'Shutoff Valve & Pressure Regulator', where: 'At the cylinder',
      what: 'The cylinder shutoff valve is normally open. A regulator reduces cylinder pressure to a low supply pressure for the mask regulators.',
      how: 'The supply line runs to the mask stowage boxes beside each pilot and at the observer stations.',
      notes: [] },
    { id: 'sys-oxy-crewmask', category: 'sys-oxygen', name: 'Crew Quick-Donning Masks', where: 'Stowage boxes beside each crew seat',
      what: 'Full-face or mask-and-goggles quick-donning masks with an inflatable harness, worn with one hand in seconds.',
      how: 'The mask regulator gives diluted oxygen (NORMAL), 100% oxygen, or positive pressure (EMERGENCY), for example against smoke. A flow indicator shows oxygen is flowing. Mask microphones connect to the interphone.',
      notes: ['Here, masks show IN USE when the cabin altitude warning is active.'] },
    { id: 'sys-oxy-paxswitch', category: 'sys-oxygen', name: 'PASS OXY Switch & PASS OXY ON Light', where: 'Overhead oxygen panel',
      what: 'The guarded PASS OXY switch (NORMAL / ON) deploys the passenger masks manually. The PASS OXY ON light shows the passenger system has been activated.',
      how: 'In NORMAL the masks drop automatically at high cabin altitude. ON drops them at any altitude.',
      notes: ['Here, deployment latches. Set NORMAL and land to reset it.'] },
    { id: 'sys-oxy-auto', category: 'sys-oxygen', name: 'Automatic Deployment', where: 'Passenger oxygen system',
      what: 'An altitude pressure switch opens all the mask doors when cabin altitude reaches about 14,000 ft.',
      how: 'Independent of the PASS OXY switch position (in NORMAL). The PASS OXY ON light comes on.',
      notes: ['Try it: run the loss of pressurization scenario and watch the masks drop as the cabin passes 14,000 ft.'] },
    { id: 'sys-oxy-generator', category: 'sys-oxygen', name: 'Chemical Oxygen Generators', where: 'Passenger service units, lavatories, attendant stations',
      what: 'Each unit holds masks and a chemical generator. When the doors open, the masks fall and hang ready.',
      how: 'Pulling a mask starts its generator, which then supplies oxygen for about 12 minutes and can\'t be shut off. Generators get very hot and may give off a burning smell, which is normal.',
      notes: ['Typically, the cabin crew also carry portable oxygen bottles.'] },
  ],

  failures: [
    {
      id: 'oxy-crew-low', title: 'Crew oxygen pressure low', system: 'oxygen', group: 'Oxygen',
      setup: IN_FLIGHT, flags: ['fail.oxy.crew'],
      summary: 'A leak in the crew oxygen system lets the cylinder pressure bleed down. There\'s no caution light on the NG: it shows only on the CREW OXYGEN pressure indicator.',
      effects: (c) => [
        L(`Crew cylinder ${psi(O(c).crewPressure)} (full is about 1,850)`, !O(c).crewLow),
        L('Crew masks have oxygen', O(c).crewSupply),
        L('Passenger system (separate, chemical)', true),
        I('No master caution: the only cue is the gauge, so scan it.'),
      ],
      know: [
        'Crew oxygen pressure is shown only on the overhead indicator. Checking it is part of the preflight.',
        'The required minimum depends on the number of crew and temperature (operator chart).',
        'The passenger chemical system is independent of the crew cylinder.',
        'Follow your operator\'s QRH/FCOM.',
      ],
    },
    {
      id: 'oxy-decompression', title: 'Decompression: mask deployment', system: 'oxygen', group: 'Oxygen',
      setup: IN_FLIGHT, flags: ['fail.press.leak'],
      summary: 'A pressurization leak at FL350. Watch the cabin altitude climb, the warning come on at 10,000 ft and the passenger masks drop at about 14,000 ft.',
      effects: (c) => [
        L(`Cabin altitude ${fmtFt(O(c).cabinAlt)}`, O(c).cabinAlt < 10000),
        L(`Passenger masks ${O(c).masksDeployed ? 'deployed (PASS OXY ON)' : 'stowed'}`, !O(c).masksDeployed),
        L(`Crew oxygen ${psi(O(c).crewPressure)}`, O(c).crewSupply),
        I(O(c).masksDeployed ? 'Generators start when each mask is pulled and run for about 12 minutes.' : 'Masks drop automatically at about 14,000 ft cabin altitude.'),
      ],
      know: [
        'Crew masks first: the crew has the gaseous system, passengers the chemical one.',
        'If the masks don\'t drop automatically, PASS OXY ON deploys them.',
        'Chemical generators can\'t be stopped once started, so their duration matters for descent planning.',
        'Follow your operator\'s QRH/FCOM.',
      ],
    },
  ],
};
