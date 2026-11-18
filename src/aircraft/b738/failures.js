// Failure scenarios for the 737-800 (NG). Each one sets up a flight condition, injects
// failure flags into the shared systems logic and lists live effects computed from it.
// "Things to know" are generic study notes, not checklist steps: always use your QRH/FCOM.

/** Panel switches and sources for a normal in-flight configuration (applied before a scenario). */
export const normalFlightConfig = {
  'sw.hyd.elec2': true, 'sw.hyd.eng1': true, 'sw.hyd.eng2': true, 'sw.hyd.elec1': true,
  'sw.fc.a': true, 'sw.fc.b': true, 'sw.altflaps': false,
  'sw.fuel.aft1': true, 'sw.fuel.fwd1': true, 'sw.fuel.ctrl': false, 'sw.fuel.ctrr': false,
  'sw.fuel.fwd2': true, 'sw.fuel.aft2': true, 'sw.fuel.xfeed': false,
  'sw.battery': true, 'sw.stbypower': true, 'sw.bustransfer': true,
  'elec.bus1': 'gen1', 'elec.bus2': 'gen2',
  'sw.bleed1': true, 'sw.bleed2': true, 'sw.apubleed': false, 'sw.iso': 'AUTO',
  'sw.pack.l': true, 'sw.pack.r': true, 'sw.wingai': false,
  apu: false,
};

export const FAILURE_FLAGS = [
  'fail.eng1', 'fail.eng2', 'fail.gen1', 'fail.gen2', 'fail.hyd.a', 'fail.hyd.b',
  'fail.edp.a', 'fail.edp.b', 'fail.bleed1', 'fail.bleed2', 'fail.fuel.fwd1',
];

/** Human labels for annunciators computed by systems.panel().ann */
export const annunciatorLabels = {
  'hyd.eng1': ['ENG 1 HYD PUMP LOW PRESSURE', 'amber'], 'hyd.elec2': ['ELEC 2 HYD PUMP LOW PRESSURE', 'amber'],
  'hyd.eng2': ['ENG 2 HYD PUMP LOW PRESSURE', 'amber'], 'hyd.elec1': ['ELEC 1 HYD PUMP LOW PRESSURE', 'amber'],
  'fc.a': ['FLT CONTROL A LOW PRESSURE', 'amber'], 'fc.b': ['FLT CONTROL B LOW PRESSURE', 'amber'],
  'fuel.aft1': ['FUEL AFT 1 LOW PRESSURE', 'amber'], 'fuel.fwd1': ['FUEL FWD 1 LOW PRESSURE', 'amber'],
  'fuel.fwd2': ['FUEL FWD 2 LOW PRESSURE', 'amber'], 'fuel.aft2': ['FUEL AFT 2 LOW PRESSURE', 'amber'],
  'fuel.ctrl': ['FUEL CTR L LOW PRESSURE', 'amber'], 'fuel.ctrr': ['FUEL CTR R LOW PRESSURE', 'amber'],
  'elec.tbo1': ['TRANSFER BUS 1 OFF', 'amber'], 'elec.tbo2': ['TRANSFER BUS 2 OFF', 'amber'],
  'elec.drive1': ['GEN 1 DRIVE', 'amber'], 'elec.drive2': ['GEN 2 DRIVE', 'amber'],
  'elec.batdisch': ['BAT DISCHARGE', 'amber'],
  'bleed.trip1': ['BLEED 1 TRIP OFF', 'amber'], 'bleed.trip2': ['BLEED 2 TRIP OFF', 'amber'],
  'bleed.dual': ['DUAL BLEED', 'amber'],
  'pack.l': ['L PACK', 'amber'], 'pack.r': ['R PACK', 'amber'],
  'ai.wing': ['WING ANTI-ICE VALVE OPEN', 'blue'], 'fuel.xfeed': ['CROSSFEED VALVE OPEN', 'blue'],
};

// ---- live effect helpers
const L = (text, ok) => ({ text, state: ok ? 'ok' : 'lost' });
const I = (text) => ({ text, state: 'info' });
const IN_FLIGHT = { onGround: false, engines: true, gearLever: 'UP' };

export const failureScenarios = [
  {
    id: 'eng1-fail', title: 'Engine 1 failure in flight', system: 'electrical', group: 'Powerplant',
    setup: { ...IN_FLIGHT, flapLever: 0 }, flags: ['fail.eng1'],
    summary: 'Engine 1 stops producing thrust. Everything it drove is lost: generator 1, the system A engine-driven pump and engine 1 bleed air.',
    effects: (c) => [
      L('Generator 1', c.elec.avail.gen1),
      L(`AC transfer bus 1 ${c.elec.bus1 === 'gen2' ? '(now powered by GEN 2 via bus transfer)' : ''}`, c.elec.tbus1),
      L('System A engine-driven pump', c.hyd.pumps.eng1),
      L('System A pressure (ELEC 2 pump still running)', c.hyd.A),
      L('Engine 1 bleed air', c.bleed.eb1),
      L('Left pack', c.bleed.packL),
      I('Look at the Electrical and Bleed Air tabs to see the transfer and the loss of the left duct.'),
    ],
    know: [
      'With BUS TRANSFER in AUTO, generator 2 picks up both transfer buses automatically.',
      'System A keeps pressure from its electric pump (ELEC 2), powered from the other side.',
      'Starting the APU restores a second generator, and its bleed can feed the left side.',
      'Fly the aircraft first: rudder for the asymmetric thrust, then the non-normal checklist.',
    ],
  },
  {
    id: 'eng2-fail', title: 'Engine 2 failure in flight', system: 'hydraulics', group: 'Powerplant',
    setup: { ...IN_FLIGHT, flapLever: 5 }, flags: ['fail.eng2'],
    summary: 'Engine 2 stops. Generator 2, the system B engine-driven pump and engine 2 bleed are lost. With flaps 5 set, watch the PTU come in.',
    effects: (c) => [
      L('Generator 2', c.elec.avail.gen2),
      L(`AC transfer bus 2 ${c.elec.bus2 === 'gen1' ? '(now powered by GEN 1 via bus transfer)' : ''}`, c.elec.tbus2),
      L('System B engine-driven pump', c.hyd.pumps.eng2),
      L('System B pressure (ELEC 1 pump still running)', c.hyd.B),
      L('Power transfer unit (flaps between UP and 15)', c.hyd.ptu),
      L('Right pack', c.bleed.packR),
      I('Set flaps 15 or UP in the scenario bar and the PTU stops.'),
    ],
    know: [
      'The mirror image of an engine 1 failure, but losing engine 2 also takes system B\'s engine pump. That\'s why the PTU exists.',
      'Generator 1 picks up both transfer buses through bus transfer.',
      'Starting the APU restores a second generator.',
    ],
  },
  {
    id: 'eng1-takeoff', title: 'Engine 1 failure after takeoff (gear retraction)', system: 'hydraulics', group: 'Powerplant',
    setup: [{ ...IN_FLIGHT, gearLever: 'DN', onGround: false, flapLever: 5 }, 'settle', { gearLever: 'UP' }],
    flags: ['fail.eng1'],
    summary: 'Engine 1 fails just after liftoff, as the gear is selected UP. System A has lost its engine pump, so the landing gear transfer unit lets system B supply the volume to raise the gear at the normal rate.',
    effects: (c) => [
      L('System A engine-driven pump', c.hyd.pumps.eng1),
      c.hyd.lgtu
        ? { text: 'Landing gear transfer unit active: system B is raising the gear', state: 'ok' }
        : { text: 'Gear up and locked (transfer unit no longer needed)', state: 'ok' },
      L('System A pressure (ELEC 2)', c.hyd.A),
      L('Generator 1', c.elec.avail.gen1),
      I('Click the scenario again to replay the gear retraction.'),
    ],
    know: [
      'The transfer unit operates when airborne, with engine 1 N2 low, the gear lever UP and a main gear not up and locked.',
      'ELEC 2 alone can\'t supply gear retraction volume quickly enough. That\'s why system B steps in.',
      'Fly the aircraft first: rudder, pitch attitude, then the engine failure procedure at a safe altitude.',
    ],
  },
  {
    id: 'dual-eng-fail', title: 'Dual engine failure', system: 'electrical', group: 'Powerplant',
    setup: { ...IN_FLIGHT, flapLever: 0 }, flags: ['fail.eng1', 'fail.eng2'],
    summary: 'Both engines flame out. Generators, engine-driven pumps and bleeds are all lost. The aircraft is on battery power, and the hydraulic systems lose their pumps.',
    effects: (c) => [
      L('Generators 1 and 2', c.elec.avail.gen1 || c.elec.avail.gen2),
      L('AC transfer buses', c.elec.tbus1 || c.elec.tbus2),
      L('Standby buses (battery + static inverter)', c.elec.acStby && c.elec.batBus),
      L('Hydraulic systems A and B', c.hyd.A || c.hyd.B),
      L('Standby hydraulic pump (needs transfer bus 1)', c.hyd.stby),
      L('Packs', c.bleed.packL || c.bleed.packR),
      I('Start the APU in the scenario bar, then put APU GEN on the buses and watch the electric hydraulic pumps return.'),
    ],
    know: [
      'The 737 has no ram air turbine. Electrical power comes from the battery until the APU or an engine is restarted.',
      'Windmilling engines can still turn their hydraulic pumps and provide some pressure. That\'s not modelled here.',
      'Ailerons and elevators can be flown in manual reversion. The rudder needs hydraulic power.',
      'The APU can supply electrical power in flight and bleed air at lower altitudes, helping engine restarts.',
    ],
  },
  {
    id: 'hyd-a-loss', title: 'Loss of hydraulic system A', system: 'hydraulics', group: 'Hydraulics',
    setup: { ...IN_FLIGHT, flapLever: 0 }, flags: ['fail.hyd.a'],
    summary: 'A system A leak empties the reservoir. Both system A pumps lose pressure and everything powered only by A is lost.',
    effects: (c) => [
      L('System A pressure', c.hyd.A),
      L('Ground spoilers', c.hyd.users.groundSpoilers),
      L('Normal gear retraction / extension', c.hyd.users.gear),
      L('Nose wheel steering (normal)', c.hyd.users.nws),
      L('Alternate brakes', c.hyd.users.altBrakes),
      L('Autopilot A', c.hyd.users.apA),
      L('Flight controls (still powered by system B)', c.hyd.users.fcB),
      L('Thrust reverser 1 (via standby when active)', c.hyd.users.rev1),
    ],
    know: [
      'Gear extension is by the manual extension handles (free fall).',
      'No ground spoilers on landing means a longer landing distance.',
      'Nose wheel steering can be switched to system B (alternate).',
      'Flight controls remain fully powered by system B.',
    ],
  },
  {
    id: 'hyd-b-loss', title: 'Loss of hydraulic system B', system: 'hydraulics', group: 'Hydraulics',
    setup: { ...IN_FLIGHT, flapLever: 5 }, flags: ['fail.hyd.b'],
    summary: 'A system B leak takes out the trailing-edge flap drive, normal brakes, yaw damper and autopilot B. With flaps out, the standby system starts automatically.',
    effects: (c) => [
      L('System B pressure', c.hyd.B),
      L('Trailing-edge flaps (hydraulic)', c.hyd.users.teFlaps),
      L('Leading-edge devices (via standby)', c.hyd.users.leDevices),
      L('Normal brakes (alternate brakes on system A instead)', c.hyd.users.brakes),
      L('Yaw damper', c.hyd.users.yawDamper),
      L('Autopilot B', c.hyd.users.apB),
      L('Standby system (automatic: system lost with flaps extended, airborne)', c.hyd.stby),
    ],
    know: [
      'Flaps can be moved with the alternate (electric) drive, more slowly and without asymmetry protection.',
      'Alternate flaps extends the leading-edge devices fully using the standby system. They can\'t be retracted that way.',
      'Braking uses system A (alternate brakes) and the accumulator.',
    ],
  },
  {
    id: 'hyd-ab-loss', title: 'Loss of both systems A and B', system: 'hydraulics', group: 'Hydraulics',
    setup: { ...IN_FLIGHT, flapLever: 1 }, flags: ['fail.hyd.a', 'fail.hyd.b'],
    summary: 'Both main hydraulic systems are lost. Ailerons and elevators revert to manual (cable) control, the rudder runs on the standby system.',
    effects: (c) => [
      L('System A', c.hyd.A),
      L('System B', c.hyd.B),
      L('Standby system / standby rudder', c.hyd.stby),
      L('Powered ailerons & elevators (manual reversion)', c.hyd.fcA || c.hyd.fcB),
      L('Flight spoilers', c.hyd.users.spoilersA || c.hyd.users.spoilersB),
      L('Thrust reversers (standby)', c.hyd.users.rev1),
      I('Control forces are much higher in manual reversion. Expect a long, flat approach.'),
    ],
    know: [
      'Ailerons and elevators are flown through the cables (manual reversion). Trim becomes very important.',
      'The rudder has no manual reversion and relies on the standby PCU.',
      'Gear by manual extension, flaps by the alternate drive.',
    ],
  },
  {
    id: 'edp-b-fail', title: 'System B engine-driven pump failure', system: 'hydraulics', group: 'Hydraulics',
    setup: { ...IN_FLIGHT, flapLever: 5 }, flags: ['fail.edp.b'],
    summary: 'The engine 2 driven pump fails. System B keeps pressure from ELEC 1. With flaps between UP and 15, the PTU runs to back up the leading-edge devices.',
    effects: (c) => [
      L('System B engine-driven pump', c.hyd.pumps.eng2),
      L('System B pressure (ELEC 1)', c.hyd.B),
      L('Power transfer unit (PTU)', c.hyd.ptu),
      I('Try flaps 15 or UP in the scenario bar: the PTU stops.'),
    ],
    know: [
      'One pump per system is enough for normal operation.',
      'The PTU uses system A pressure to drive a pump for system B fluid. The fluids never mix.',
    ],
  },
  {
    id: 'edp-a-fail', title: 'System A engine-driven pump failure', system: 'hydraulics', group: 'Hydraulics',
    setup: { ...IN_FLIGHT, flapLever: 0 }, flags: ['fail.edp.a'],
    summary: 'The engine 1 driven pump fails. System A keeps full pressure from its electric pump, ELEC 2.',
    effects: (c) => [
      L('System A engine-driven pump', c.hyd.pumps.eng1),
      L('System A pressure (ELEC 2)', c.hyd.A),
      L('All system A users', c.hyd.users.gear && c.hyd.users.groundSpoilers),
      I('Now switch ELEC 2 off (click it) to see the whole system go down.'),
    ],
    know: [
      'One pump per system covers normal demand. The ENG 1 LOW PRESSURE light shows the failed pump.',
      'ELEC 2 is powered from transfer bus 2, so it survives an engine 1 failure.',
    ],
  },
  {
    id: 'gen1-fail', title: 'Generator 1 drive failure', system: 'electrical', group: 'Electrical',
    setup: { ...IN_FLIGHT, flapLever: 0 }, flags: ['fail.gen1'],
    summary: 'IDG 1 loses its drive (for example low oil pressure). Generator 1 drops off line and bus transfer moves transfer bus 1 to generator 2.',
    effects: (c) => [
      L('Generator 1', c.elec.avail.gen1),
      L(`AC transfer bus 1 ${c.elec.bus1 === 'gen2' ? '(from GEN 2)' : c.elec.bus1 === 'apu' ? '(from APU)' : ''}`, c.elec.tbus1),
      L('AC transfer bus 2', c.elec.tbus2),
      I('Start the APU (scenario bar), then click APU GEN to put a second source back on the buses.'),
    ],
    know: [
      'A DRIVE light means the IDG should be disconnected. An IDG can\'t be reconnected in flight.',
      'One generator can carry the essential load. The APU generator restores redundancy.',
    ],
  },
  {
    id: 'gen2-fail', title: 'Generator 2 drive failure', system: 'electrical', group: 'Electrical',
    setup: { ...IN_FLIGHT, flapLever: 0 }, flags: ['fail.gen2'],
    summary: 'IDG 2 loses its drive. Generator 2 drops off line and transfer bus 2 moves to generator 1.',
    effects: (c) => [
      L('Generator 2', c.elec.avail.gen2),
      L('AC transfer bus 1', c.elec.tbus1),
      L(`AC transfer bus 2 ${c.elec.bus2 === 'gen1' ? '(from GEN 1)' : c.elec.bus2 === 'apu' ? '(from APU)' : ''}`, c.elec.tbus2),
      L('System A electric pump (ELEC 2, on transfer bus 2)', c.hyd.pumps.elec2),
      I('Turn BUS TRANSFER off (click it) to see what automatic transfer was doing for you.'),
    ],
    know: [
      'Same logic as a generator 1 failure: one generator can power both transfer buses.',
      'With BUS TRANSFER off there\'s no automatic transfer. The bus stays unpowered until another source is selected.',
    ],
  },
  {
    id: 'tbus1-fail', title: 'AC transfer bus 1 failure', system: 'electrical', group: 'Electrical',
    setup: { ...IN_FLIGHT, flapLever: 0 }, flags: ['fail.tbus1'],
    summary: 'A fault leaves transfer bus 1 unpowered and generator 1 can\'t be connected to it. Everything fed from that bus is lost, across several systems.',
    effects: (c) => [
      L('AC transfer bus 1', c.elec.tbus1),
      L('TRU 1 (DC bus 1 now fed through TRU 3)', c.elec.tru1),
      L('DC bus 1', c.elec.dc1),
      L('System B electric pump (ELEC 1)', c.hyd.pumps.elec1),
      L('Standby hydraulic pump (no power to start it)', c.elec.tbus1),
      L('Fuel pumps: tank 1 and center L', c.fuel.pumps.aft1 || c.fuel.pumps.fwd1 || c.fuel.pumps.ctrl),
      L('Engine 1 (suction feed if no pump pressure)', c.fuel.eng1Feed),
      I('Open the crossfeed (Fuel tab) to feed engine 1 from the right-side pumps.'),
    ],
    know: [
      'A single bus failure cascades: hydraulics, fuel and DC loads on that side all lose power.',
      'The AC standby bus moves to the static inverter, because it\'s normally fed from transfer bus 1.',
      'Crossfeed lets the opposite side\'s pumps feed the engine.',
    ],
  },
  {
    id: 'dual-gen-fail', title: 'Loss of both generators', system: 'electrical', group: 'Electrical',
    setup: { ...IN_FLIGHT, flapLever: 0 }, flags: ['fail.gen1', 'fail.gen2'],
    summary: 'Both IDGs fail and the APU isn\'t running. Both transfer buses go dark and the aircraft runs on the battery and standby system.',
    effects: (c) => [
      L('AC transfer buses', c.elec.tbus1 || c.elec.tbus2),
      L('AC standby bus (static inverter)', c.elec.acStby),
      L('Battery bus', c.elec.batBus),
      L('Hydraulic electric pumps', c.hyd.pumps.elec1 || c.hyd.pumps.elec2),
      L('Fuel boost pumps (engines suction feed)', c.fuel.leftPress || c.fuel.rightPress),
      L('Hydraulic systems A & B (engine pumps still turning)', c.hyd.A && c.hyd.B),
      I('Start the APU and connect APU GEN to restore power.'),
    ],
    know: [
      'The battery powers the standby system for about 30 minutes. Plan to land as soon as possible.',
      'The engine-driven hydraulic pumps keep working, they don\'t need electrical power.',
      'Engines keep running on suction feed. This is limited at high altitude.',
      'The APU can be started in flight to restore AC power.',
    ],
  },
  {
    id: 'bleed1-trip', title: 'Engine 1 bleed trip off', system: 'bleed', group: 'Pneumatics',
    setup: { ...IN_FLIGHT, flapLever: 0 }, flags: ['fail.bleed1'],
    summary: 'The engine 1 bleed valve closes on an overpressure or overtemperature trip. The left duct loses its source and the left pack has no air.',
    effects: (c) => [
      L('Engine 1 bleed', c.bleed.eb1),
      L('Left duct', c.bleed.left),
      L('Left pack', c.bleed.packL),
      L('Right pack', c.bleed.packR),
      I('Set the ISOLATION valve to OPEN (click it) and the right engine feeds both packs.'),
    ],
    know: [
      'A trip can often be reset with the TRIP RESET switch once temperatures come down.',
      'One pack can maintain pressurization. The isolation valve lets the other side feed both.',
    ],
  },
  {
    id: 'bleed2-trip', title: 'Engine 2 bleed trip off', system: 'bleed', group: 'Pneumatics',
    setup: { ...IN_FLIGHT, flapLever: 0 }, flags: ['fail.bleed2'],
    summary: 'The engine 2 bleed valve trips closed. The right duct and right pack lose their air.',
    effects: (c) => [
      L('Engine 2 bleed', c.bleed.eb2),
      L('Right duct', c.bleed.right),
      L('Right pack', c.bleed.packR),
      L('Left pack', c.bleed.packL),
      I('Open the ISOLATION valve and the left engine feeds both packs.'),
    ],
    know: ['Mirror image of the engine 1 trip.', 'Wing anti-ice needs both ducts or an open isolation valve to heat both wings.'],
  },
  {
    id: 'dual-bleed-trip', title: 'Loss of both engine bleeds', system: 'bleed', group: 'Pneumatics',
    setup: { ...IN_FLIGHT, flapLever: 0 }, flags: ['fail.bleed1', 'fail.bleed2'],
    summary: 'Both engine bleed valves trip. Neither pack has air, so the cabin starts to lose pressurization.',
    effects: (c) => [
      L('Engine bleeds', c.bleed.eb1 || c.bleed.eb2),
      L('Left pack', c.bleed.packL),
      L('Right pack', c.bleed.packR),
      L('Wing anti-ice supply', c.bleed.left || c.bleed.right),
      I('Start the APU and open APU BLEED: the left pack comes back (APU bleed can be used at lower altitudes).'),
    ],
    know: [
      'With no pack running, cabin altitude climbs. Expect a descent and possibly the oxygen masks.',
      'The APU can supply bleed air for one pack at lower altitudes (up to 17,000 ft for bleed alone).',
      'Bleed trips can often be reset once temperatures fall.',
    ],
  },
  {
    id: 'pack-l-trip', title: 'Left pack trip', system: 'bleed', group: 'Pneumatics',
    setup: { ...IN_FLIGHT, flapLever: 0 }, flags: ['fail.pack.l'],
    summary: 'The left pack shuts down (for example an overheat). Bleed air is still available, but only the right pack conditions the cabin.',
    effects: (c) => [
      L('Left pack', c.bleed.packL),
      L('Right pack', c.bleed.packR),
      L('Left duct (bleed still available)', c.bleed.left),
      L('Cabin air supply (one pack)', c.bleed.packL || c.bleed.packR),
    ],
    know: [
      'One pack can maintain pressurization and temperature.',
      'A pack trip can often be reset after it cools. The PACK light shows the trip.',
    ],
  },
  {
    id: 'fuel-tank1-pumps', title: 'Both tank 1 fuel pumps failed', system: 'fuel', group: 'Fuel',
    setup: { ...IN_FLIGHT, flapLever: 0 }, flags: ['fail.fuel.aft1', 'fail.fuel.fwd1'],
    summary: 'Both boost pumps in main tank 1 fail. Engine 1 keeps running on suction feed from its own tank.',
    effects: (c) => [
      L('Tank 1 pumps', c.fuel.pumps.aft1 || c.fuel.pumps.fwd1),
      L('Engine 1 manifold pressure', c.fuel.leftPress),
      L(c.fuel.eng1Suction ? 'Engine 1 running on suction feed' : 'Engine 1 pressure-fed', !c.fuel.eng1Suction),
      I('Open the crossfeed (click the valve) and the right-side pumps pressurize engine 1\'s feed.'),
    ],
    know: [
      'Suction feed works but is limited at high altitude, where a lower altitude may be needed.',
      'Feeding from one side with crossfeed open causes an imbalance. Monitor it.',
    ],
  },
  {
    id: 'fuel-pump-fail', title: 'Main tank fuel pump failure', system: 'fuel', group: 'Fuel',
    setup: { ...IN_FLIGHT, flapLever: 0 }, flags: ['fail.fuel.fwd1'],
    summary: 'The forward pump in main tank 1 fails. Its LOW PRESSURE light comes on, and the aft pump keeps the engine 1 manifold pressurized.',
    effects: (c) => [
      L('Forward pump, tank 1', c.fuel.pumps.fwd1),
      L('Aft pump, tank 1', c.fuel.pumps.aft1),
      L('Engine 1 feed', c.fuel.eng1Feed),
      I('Switch the aft pump off too and engine 1 goes to suction feed.'),
    ],
    know: ['A single pump is enough to feed its engine.', 'Watch for fuel imbalance over a long flight.'],
  },
];
