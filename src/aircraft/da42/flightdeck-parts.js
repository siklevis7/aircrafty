// Diamond DA42 NG cockpit study zones. Same shape as the exterior parts so the UI can reuse them.
// Describes the most common configuration: DA42 NG / DA42-VI with Austro AE300 engines (FADEC),
// Garmin G1000 with the GFC 700 autopilot. G1000 NXi and older-aircraft differences are notes.
// Written from public sources as a generic study aid: switch positions and labels vary between
// serial numbers and modifications. Always use the approved AFM and the Garmin pilot's guide.

export const fdCategories = [
  { id: 'da42fd-g1000', label: 'Garmin G1000 Displays' },
  { id: 'da42fd-afcs', label: 'Autopilot (GFC 700)' },
  { id: 'da42fd-standby', label: 'Standby Instruments' },
  { id: 'da42fd-engine', label: 'Engine Controls & FADEC' },
  { id: 'da42fd-electrical', label: 'Electrical' },
  { id: 'da42fd-fuel', label: 'Fuel' },
  { id: 'da42fd-gearflaps', label: 'Landing Gear & Flaps' },
  { id: 'da42fd-controls', label: 'Flight Controls & Trim' },
  { id: 'da42fd-cabin', label: 'Canopy, Doors & Seats' },
  { id: 'da42fd-lights', label: 'Lights & Cabin Environment' },
];

const toggle = (key, label = 'Toggle') => ({ label, toggle: key });
const PANEL = [-1, 0.25, 0];
const CONSOLE = [-0.6, 1, 0.15];
const UNDER = [-1, -0.1, 0];

export const fdParts = [
  // ---------------------------------------------------------------- G1000
  {
    id: 'da42fd-pfd', category: 'da42fd-g1000', name: 'Primary Flight Display (PFD)', where: 'Left 10.4" display, in front of the pilot',
    what: 'The G1000 PFD shows the flight instruments on one screen: attitude over a full-width sky and ground picture, airspeed and altitude tapes, vertical speed, the HSI, NAV and COM frequencies, the autopilot mode bar and the crew alerts.',
    how: 'Attitude comes from the AHRS and air data from the air data computer. The top bar shows NAV frequencies on the left (standby, then active) and COM on the right (active, then standby); the cyan box marks the frequency the tuning knob changes. The navigation status in the middle shows the active leg, desired track and distance. OAT is at the lower left, the transponder and local time at the lower right.',
    notes: [
      'If the MFD fails, the engine indications move to the PFD (reversionary mode, also selectable with the red DISPLAY BACKUP button on the audio panel).',
      'The displays here power up with the ELECTRIC MASTER, as in the DA42 NG; the AVIONIC MASTER powers the radios, the second integrated avionics unit and the autopilot.',
      'G1000 NXi: faster processors, a sharper picture, softkey labels in mixed case and options such as a moving-map HSI inset and SurfaceWatch where fitted.',
    ],
    tryIt: [{ label: 'Displays on/off', toggle: 'elec.master' }, { label: 'Take off', set: { onGround: false } }],
    view: PANEL,
  },
  {
    id: 'da42fd-pfd-airspeed', category: 'da42fd-g1000', name: 'Airspeed Tape & Twin-Engine Markings', where: 'PFD · left side',
    what: 'A moving airspeed tape with the airspeed limits shown as coloured bands, plus the two multi-engine marks: a red line at VMCA and a blue line at VYSE.',
    how: 'White band: flap operating range (top = VFE LDG). Green: normal operating range. Yellow: caution range up to VNE, smooth air only. Red and white barber pole: above VNE. The pointer box shows the current speed, true airspeed sits in the box below.',
    notes: [
      'Representative DA42 NG values (KIAS): white 56–111, green 62–151, yellow 151–188, VNE 188, VMCA about 71, VYSE 85. Published figures differ between serial numbers, mass versions and modifications, so take them from your AFM.',
      'VMCA is the minimum control speed with the critical engine inoperative; below it, full rudder can\'t hold the heading. VYSE gives the best rate of climb on one engine.',
    ],
    view: PANEL,
  },
  {
    id: 'da42fd-hsi', category: 'da42fd-g1000', name: 'Horizontal Situation Indicator (HSI)', where: 'PFD · lower centre',
    what: 'A rotating compass rose with the heading bug, course pointer and course deviation indicator.',
    how: 'The heading box sits above the lubber line. The cyan heading bug is set with the HDG knob; the course pointer and CDI follow the selected navigation source: magenta for GPS, green for VOR/LOC. The CDI softkey cycles the source. The HDG and CRS windows show the selected values.',
    notes: ['GPS phase annunciations (ENR, TERM, LNAV, LPV…) appear next to the aircraft symbol.', 'Wind is shown in the box to the left of the HSI once the aircraft is moving.'],
    view: PANEL,
  },
  {
    id: 'da42fd-cas', category: 'da42fd-g1000', name: 'Crew Alerting (Annunciation Window)', where: 'PFD · right edge, beside the vertical speed tape',
    what: 'The G1000 alert window lists warnings in red, cautions in amber and advisories in white, with an aural tone for new warnings and cautions.',
    how: 'Messages are side specific on the twin, for example L OIL PRES, R ALTN FAIL, L ECU A FAIL, L FUEL LOW, plus DOOR OPEN, CHECK GEAR and PITOT HT OFF. The ALERTS softkey flashes for a new message and acknowledges it. Each message has a matching AFM procedure.',
    notes: [
      'On the ground with an ENGINE MASTER on and that engine stopped, the OIL PRES warning is normal; the ALTN FAIL caution shows an alternator that is not charging.',
      'During the ECU test the ECU A / ECU B cautions come on briefly as the FADEC switches between its units.',
      'The list here is a subset of the typical messages; the full list and actions are in the AFM and Garmin documentation.',
    ],
    tryIt: [{ label: 'Open the canopy', toggle: 'canopy' }, { label: 'Pitot heat', toggle: 'pitotHeat' }],
    view: PANEL,
  },
  {
    id: 'da42fd-mfd', category: 'da42fd-g1000', name: 'Multi-Function Display (MFD)', where: 'Centre 10.4" display',
    what: 'The MFD shows the moving map with the flight plan, the engine indications strip on the left, and the page groups for flight planning, nearest airports, procedures, checklists and systems.',
    how: 'The FMS knob (lower right) selects page groups and pages; the RANGE joystick zooms and pans the map. Data fields in the top bar show ground speed, desired track, track and time en route. Map orientation and range are shown on the map. The ENGINE softkey opens the engine and fuel pages.',
    notes: ['Terrain shading, traffic, weather and charts depend on the options fitted.', 'With the ESSENTIAL BUS selected in an electrical failure, the MFD is typically shed and the engine data move to the PFD.'],
    view: PANEL,
  },
  {
    id: 'da42fd-eis', category: 'da42fd-g1000', name: 'Engine Indication System (EIS)', where: 'MFD · left strip',
    what: 'Engine and electrical data for both AE300 engines side by side: LOAD %, propeller RPM, fuel flow, oil pressure and temperature, coolant temperature, gearbox temperature, fuel temperature, fuel quantity, volts and amps.',
    how: 'Round gauges show LOAD and RPM for each engine. The horizontal scales carry two pointers, L above and R below. Green is the normal range, amber caution, red the limit; the ECU sends the readings, so with an ENGINE MASTER off that engine\'s data are blank.',
    notes: [
      'Representative AE300 limits from public training material: 100% load at 2300 propeller RPM, overspeed to 2500 RPM for no more than about 20 s, oil pressure 1.0–6.5 bar, oil temperature up to 140 °C, coolant up to 105 °C, gearbox up to 120 °C, fuel temperature −30 to +75 °C (or less, depending on the fuel). Band edges drawn here are illustrative.',
      'Fuel quantity shows the main tank contents; on aircraft with auxiliary tanks, aux fuel is transferred into the mains.',
      'The values move with the simulated engines: start an engine and watch the oil temperature and coolant warm up.',
    ],
    tryIt: [{ label: 'Start both engines', set: { engMaster1: true, engMaster2: true, eng1: true, eng2: true } }, { label: 'Stop both', set: { eng1: false, eng2: false } }],
    view: PANEL,
  },
  {
    id: 'da42fd-gdu-bezel', category: 'da42fd-g1000', name: 'GDU 1040 Bezel Controls', where: 'Around each display',
    what: 'The same knobs and keys are on both displays: NAV and COM volume and dual tuning knobs with transfer keys, HDG, ALT, CRS / BARO, the RANGE joystick, Direct-To, MENU, FPL, PROC, CLR, ENT, the FMS knob, and twelve softkeys under the screen.',
    how: 'Dual knobs: the large ring changes the MHz (or the coarse value) and the small knob the kHz; pressing the small knob toggles the tuning box between NAV1/NAV2 or COM1/COM2. Here: click the knobs to change heading bug, selected altitude, course, frequencies and map range; scroll over CRS/BARO for the altimeter setting.',
    notes: ['Softkey labels change with the page; a highlighted softkey is active.', 'The COM transfer key held for about 2 s tunes 121.5 MHz on the real system.'],
    view: PANEL,
  },
  // ---------------------------------------------------------------- Autopilot
  {
    id: 'da42fd-afcs', category: 'da42fd-afcs', name: 'GFC 700 Autopilot Keys', where: 'Left side of each display bezel',
    what: 'The Garmin GFC 700 is controlled from keys on the display bezel: AP, FD, HDG, ALT, NAV, VNV, APR, BC, VS, FLC and NOSE UP / NOSE DN.',
    how: 'AP engages the autopilot (and the flight director). Lateral modes: ROL by default, HDG follows the heading bug, NAV tracks the selected source, APR flies an approach, BC a back course. Vertical modes: PIT by default, ALT holds altitude, VS holds a vertical speed and FLC a speed, both set with NOSE UP / DN; the selected altitude is captured on the way. Active modes are green in the AFCS bar at the top of the PFD, armed modes white.',
    notes: [
      'Disconnect with the red AP DISC / TRIM INTERRUPT button on the stick grip; the electric trim on the stick also works with the AP off.',
      'Older DA42s (mostly earlier Thielert-powered aircraft) may have a Bendix/King KAP 140 autopilot with its own panel unit instead.',
      'Speed and approach limits for autopilot use are in the AFM supplement.',
    ],
    view: PANEL,
  },
  // ---------------------------------------------------------------- Standby instruments
  {
    id: 'da42fd-stby-asi', category: 'da42fd-standby', name: 'Standby Airspeed Indicator', where: 'Top centre of the panel',
    what: 'A conventional pneumatic airspeed indicator, independent of the G1000 air data computer.',
    how: 'Fed from the same pitot-static system. The dial carries the same arcs and the red VMCA and blue VYSE radials as the PFD tape.',
    notes: ['Some later aircraft replace the three standby gauges with a single electronic standby unit (a modification).'],
    view: PANEL,
  },
  {
    id: 'da42fd-stby-att', category: 'da42fd-standby', name: 'Standby Attitude Indicator', where: 'Top centre of the panel, between the standby airspeed and altimeter',
    what: 'An electric standby attitude gyro that keeps working if the main electrical supply fails.',
    how: 'Normally powered from the aircraft bus. With the EMERGENCY switch ON it runs from the emergency battery pack together with the flood light. An OFF flag shows when it has no power.',
    notes: ['Check the emergency battery during preflight as the AFM describes.', 'Allow the gyro time to erect after power up.'],
    tryIt: [toggle('elec.emergency', 'EMERGENCY switch'), toggle('elec.master', 'ELECTRIC MASTER')],
    view: PANEL,
  },
  {
    id: 'da42fd-stby-alt', category: 'da42fd-standby', name: 'Standby Altimeter', where: 'Top centre of the panel',
    what: 'A three-pointer pneumatic altimeter with its own barometric setting window.',
    how: 'Set it to the same pressure as the PFD. It reads from the static system (or the alternate static source when selected).',
    notes: ['Cross-check it against the PFD altitude on the ground and in flight.'],
    view: PANEL,
  },
  {
    id: 'da42fd-compass', category: 'da42fd-standby', name: 'Magnetic Compass', where: 'On top of the glareshield',
    what: 'The direct-reading standby compass with its deviation card.',
    how: 'Independent of electrical power. Read it in steady, unaccelerated flight; the deviation card gives the corrections for the installation.',
    notes: [],
    view: [-1, 0.4, 0],
  },
  // ---------------------------------------------------------------- Engine
  {
    id: 'da42fd-engine-master', category: 'da42fd-engine', name: 'ENGINE MASTER & START', where: 'Lower panel, left of the gear lever',
    what: 'Each engine has an ENGINE MASTER switch that powers its FADEC (ECU A and B), and its own start control.',
    how: 'ENGINE MASTER ON: the ECUs power up and run a self-check, and the glow indication shows until the engine is ready to start. START cranks the engine until it fires. ENGINE MASTER OFF stops the engine; in flight the propeller then feathers by itself as long as it is turning fast enough.',
    notes: [
      'Normal shutdown is with the ENGINE MASTER after the cool-down period in the AFM, never with the fuel selector.',
      'With an ENGINE MASTER on and the engine stopped, the battery is being drained: don\'t leave it like that.',
      'Starter time limits and the restart procedure in flight are in the AFM.',
    ],
    tryIt: [{ label: 'L master ON', set: { engMaster1: true } }, { label: 'Start L', set: { start1: true } }, { label: 'L master OFF', set: { engMaster1: false } }],
    view: PANEL,
  },
  {
    id: 'da42fd-ecu', category: 'da42fd-engine', name: 'ECU VOTER Switches & ECU TEST', where: 'Lower panel, right of the gear lever',
    what: 'The FADEC of each AE300 has two engine control units. The VOTER switch normally stays in AUTO, so the FADEC picks the healthy ECU; the ECU TEST button runs the test of both units.',
    how: 'ECU test (run-up, engines at idle): press and hold the button. The FADEC switches from ECU A to ECU B and back while cycling the propeller, so RPM changes and the ECU caution messages come on briefly; the engine must keep running smoothly. VOTER positions ECU A / ECU B force one unit, which is only done in the procedures the AFM gives.',
    notes: ['A single ECU failure normally leaves the engine running on the other ECU, with a caution message.', 'Each engine\'s ECUs have a backup battery that keeps them running for a time if the alternator supply is lost.'],
    tryIt: [{ label: 'Start L', set: { engMaster1: true, eng1: true } }, { label: 'ECU test L', set: { ecuTest1: true } }],
    view: PANEL,
  },
  {
    id: 'da42fd-power-levers', category: 'da42fd-engine', name: 'Power Levers', where: 'Centre console, forward',
    what: 'One lever per engine. There are no propeller or mixture levers: the FADEC sets fuel injection, turbocharger boost and propeller pitch from the lever position.',
    how: 'Full forward is 100% load (maximum take-off and continuous power), full aft is idle. The resulting LOAD % and RPM show on the EIS. A friction control sets lever stiffness.',
    notes: [
      'With one engine inoperative there is no prop lever to feather: the engine is shut down with its ENGINE MASTER and the propeller feathers.',
      'Click a lever to move it 10%, or scroll over it.',
    ],
    tryIt: [{ label: 'Idle', set: { power1: 0, power2: 0 } }, { label: '75%', set: { power1: 0.75, power2: 0.75 } }, { label: 'Max', set: { power1: 1, power2: 1 } }],
    view: CONSOLE,
  },
  {
    id: 'da42fd-alt-air', category: 'da42fd-engine', name: 'Alternate Air', where: 'Below the instrument panel',
    what: 'Opens an alternate induction air source for each engine if the normal intake or air filter becomes blocked, for example by ice.',
    how: 'Pull to open. The engine then breathes unfiltered air from inside the nacelle. Use it as the AFM describes.',
    notes: [],
    view: UNDER,
  },
  // ---------------------------------------------------------------- Electrical
  {
    id: 'da42fd-elec-master', category: 'da42fd-electrical', name: 'ELECTRIC MASTER, ALT & AVIONIC MASTER', where: 'Lower panel, far left',
    what: 'ELECTRIC MASTER connects the battery (and powers the displays), ALT L / ALT R connect each engine\'s alternator to its bus, AVIONIC MASTER powers the avionics bus, and the guarded ESSENTIAL BUS switch is for electrical failures.',
    how: 'The DA42 NG has two main buses, one fed by each engine-driven alternator, joined to the battery bus. After engine start check that each alternator is charging (AMPS on the EIS, no ALTN FAIL caution). ESSENTIAL BUS ON feeds the essential equipment directly in the electrical failure procedure.',
    notes: [
      'An alternator switch left off is easy to miss: the ammeter can still show current with the switch off. Use the checklist.',
      'VOLTS LOW cautions for the buses warn of a discharging battery.',
    ],
    tryIt: [toggle('elec.master', 'ELECTRIC MASTER'), toggle('elec.avionics', 'AVIONIC MASTER'), toggle('elec.alt1', 'ALT L')],
    view: PANEL,
  },
  {
    id: 'da42fd-emergency', category: 'da42fd-electrical', name: 'EMERGENCY Switch', where: 'Top of the panel, right of the standby instruments',
    what: 'Powers the standby attitude indicator and the flood light from the emergency battery pack.',
    how: 'Guarded, normally OFF. Switched ON after a total electrical failure (or as the AFM says) so the standby attitude and flood light keep working.',
    notes: ['The emergency battery has limited endurance: check its state per the AFM.'],
    tryIt: [toggle('elec.emergency', 'EMERGENCY switch')],
    view: PANEL,
  },
  {
    id: 'da42fd-circuit-breakers', category: 'da42fd-electrical', name: 'Circuit Breakers', where: 'Right side of the instrument panel',
    what: 'Push-pull circuit breakers protecting the electrical loads, grouped by bus and system.',
    how: 'A breaker pops out when it trips. Resetting a tripped breaker in flight follows the AFM and your organisation\'s policy.',
    notes: ['The group titles drawn here are generic, not a map of the real panel.'],
    view: PANEL,
  },
  // ---------------------------------------------------------------- Fuel
  {
    id: 'da42fd-fuel-selectors', category: 'da42fd-fuel', name: 'Fuel Selector Valves', where: 'Centre console, aft between the front seats',
    what: 'One selector per engine with three positions: ON (feed from the same wing), CROSSFEED (feed from the opposite wing) and OFF.',
    how: 'Both ON for take-off and landing. CROSSFEED is used with one engine inoperative to use fuel from the dead engine\'s side and keep the wings balanced. OFF is guarded by a latch and shuts the fuel to that engine (emergencies such as a fire).',
    notes: ['Never select both selectors to CROSSFEED, and never take off with a selector in CROSSFEED.', 'Don\'t shut an engine down with the fuel selector: use the ENGINE MASTER.'],
    tryIt: [{ label: 'Both ON', set: { fuelSel1: 'ON', fuelSel2: 'ON' } }, { label: 'L crossfeed', set: { fuelSel1: 'CROSSFEED' } }],
    view: CONSOLE,
  },
  {
    id: 'da42fd-fuel-pumps', category: 'da42fd-fuel', name: 'Fuel Pump Switches', where: 'Right side of the panel, under the flap selector',
    what: 'Switch on the electric fuel pumps that back up the engine-driven high-pressure supply.',
    how: 'Used for take-off and landing and if fuel pressure is lost, per the checklist.',
    notes: ['Details of the fuel pump switching vary between DA42 versions: follow the AFM for your aircraft.'],
    tryIt: [toggle('fuelPump1', 'L pump'), toggle('fuelPump2', 'R pump')],
    view: PANEL,
  },
  // ---------------------------------------------------------------- Gear & flaps
  {
    id: 'da42fd-gear', category: 'da42fd-gearflaps', name: 'Landing Gear Lever & Indication', where: 'Lower panel, right of the pilot\'s knee',
    what: 'The gear lever with its wheel-shaped knob, three green gear-down lights and a red light for gear in transit or unsafe.',
    how: 'Pull the knob out and move it UP or DOWN. The electro-hydraulic system retracts the gear; three green show all three legs down and locked. Red shows while the gear is moving or doesn\'t agree with the lever. A warning horn and the CHECK GEAR message sound if the gear is not down with landing flaps or low power.',
    notes: ['On the ground a squat switch prevents retraction.', 'Retract below VLO (retraction) and extend below the extension limit given in the AFM.'],
    tryIt: [{ label: 'Gear up (in flight)', set: { onGround: false, gearLever: 'UP' } }, { label: 'Gear down', set: { gearLever: 'DN' } }],
    view: PANEL,
  },
  {
    id: 'da42fd-emergency-gear', category: 'da42fd-gearflaps', name: 'Emergency Gear Extension', where: 'Under the instrument panel, left of the centre console',
    what: 'A handle that releases the hydraulic pressure so the gear falls and locks by gravity and spring force if the normal system fails.',
    how: 'With the gear lever DOWN, pull the handle per the AFM and confirm three green.',
    notes: ['After an emergency extension the gear can\'t normally be retracted again in flight.'],
    view: UNDER,
  },
  {
    id: 'da42fd-flaps', category: 'da42fd-gearflaps', name: 'Flap Selector', where: 'Right side of the panel',
    what: 'A three-position flap switch with UP, APP and LDG position lights.',
    how: 'UP 0°, APP 20°, LDG 42° on the NG. The electric actuator runs to the selected position; the light flashes while the flaps move and stays on when they arrive. Respect VFE APP and VFE LDG.',
    notes: ['Take off with flaps UP or APP as the AFM specifies.', 'Here: click the upper half to move the switch up, the lower half to move it down.'],
    tryIt: [{ label: 'UP', set: { flapLever: 'UP' } }, { label: 'APP', set: { flapLever: 'APP' } }, { label: 'LDG', set: { flapLever: 'LDG' } }],
    view: PANEL,
  },
  // ---------------------------------------------------------------- Flight controls
  {
    id: 'da42fd-sticks', category: 'da42fd-controls', name: 'Control Sticks', where: 'In front of each front seat',
    what: 'Centre sticks for both front seats, connected mechanically through push rods to the ailerons and elevator.',
    how: 'The grip carries the push-to-talk switch, the electric pitch trim hat (with the GFC 700) and the red AP DISC / TRIM INTERRUPT button. The sticks move with the simulated stick inputs from the controls dock.',
    notes: ['Click a stick while the autopilot is engaged to press AP DISC.', 'The NG has a variable elevator stop that limits nose-up elevator at high power with landing flaps.'],
    tryIt: [{ label: 'Pull', set: { pitch: 0.7 } }, { label: 'Roll right', set: { roll: 0.7 } }, { label: 'Neutral', set: { pitch: 0, roll: 0 } }],
    view: [-1, 0.6, 0.3],
  },
  {
    id: 'da42fd-pedals', category: 'da42fd-controls', name: 'Rudder Pedals & Toe Brakes', where: 'Footwells, both front seats',
    what: 'Rudder pedals with toe brakes for the hydraulic wheel brakes. Because the front seats are fixed, the pedals adjust fore and aft instead.',
    how: 'A crank or handle under the panel moves the pedals to suit the pilot\'s leg length. Steering on the ground is by differential braking with the free-castering nose wheel.',
    notes: ['Adjust the pedals so that full rudder and full braking are both reachable before flight.'],
    tryIt: [{ label: 'Left rudder', set: { yaw: -0.8 } }, { label: 'Neutral', set: { yaw: 0 } }],
    view: [-1, 0.4, 0.2],
  },
  {
    id: 'da42fd-elevator-trim', category: 'da42fd-controls', name: 'Elevator Trim Wheel & Indicator', where: 'Centre console, behind the power levers',
    what: 'A manual trim wheel with a position indicator and the take-off (T/O) mark.',
    how: 'Rolling the wheel forward trims nose down, back trims nose up. Set the T/O position before take-off. With the GFC 700, the electric trim on the stick moves the same tab.',
    notes: ['Click for nose up, Shift+click for nose down, or scroll.'],
    tryIt: [{ label: 'T/O', set: { elevTrim: 0 } }, { label: 'Nose up', set: { elevTrim: 0.5 } }],
    view: CONSOLE,
  },
  {
    id: 'da42fd-rudder-trim', category: 'da42fd-controls', name: 'Rudder Trim', where: 'Centre console',
    what: 'Sets the rudder trim tab, mainly to take out the pedal force with one engine inoperative.',
    how: 'Turn toward the live engine to relieve the rudder force. Neutral for take-off.',
    notes: [],
    tryIt: [{ label: 'Right', set: { rudderTrim: 0.6 } }, { label: 'Neutral', set: { rudderTrim: 0 } }],
    view: CONSOLE,
  },
  {
    id: 'da42fd-parking-brake', category: 'da42fd-controls', name: 'Parking Brake', where: 'Under the panel, left side of the centre console',
    what: 'Holds the brake pressure so the aircraft stays parked.',
    how: 'Press the toe brakes and pull the handle to set; push it in to release. Release before taxi.',
    notes: ['Many operators chock the aircraft rather than leave the parking brake set for long periods.'],
    tryIt: [toggle('parkBrake', 'Parking brake')],
    view: UNDER,
  },
  {
    id: 'da42fd-alt-static', category: 'da42fd-controls', name: 'Alternate Static Valve', where: 'Under the panel, left',
    what: 'Switches the static instruments to a static source inside the cabin if the external static ports block.',
    how: 'Open it per the AFM. Cabin pressure differs slightly from outside, so airspeed and altitude read a little differently: use the correction table in the AFM.',
    notes: [],
    tryIt: [toggle('altStatic', 'Alternate static')],
    view: UNDER,
  },
  {
    id: 'da42fd-pitot-heat', category: 'da42fd-controls', name: 'Pitot Heat', where: 'Lower panel, right of the ECU switches',
    what: 'Heats the pitot-static probe to stop ice blocking it.',
    how: 'Switch ON in visible moisture and as the checklist requires. The G1000 shows PITOT HT OFF while it is off and a PITOT FAIL caution if the heater fails.',
    notes: [],
    tryIt: [toggle('pitotHeat', 'Pitot heat')],
    view: PANEL,
  },
  // ---------------------------------------------------------------- Cabin
  {
    id: 'da42fd-canopy', category: 'da42fd-cabin', name: 'Front Canopy', where: 'Over the front seats, hinged at the front',
    what: 'The one-piece canopy that opens forward and up, with gas struts and locking handles on its frame.',
    how: 'Close it and lock both handles before engine start; check that the DOOR OPEN warning is out. Click a red handle to open or close it here.',
    notes: ['If the canopy unlocks in flight, fly the aircraft first and follow the AFM.', 'The large canopy gives an excellent view but lets in a lot of sun: cabin ventilation matters on the ground.'],
    tryIt: [toggle('canopy', 'Canopy')],
    view: [-1, 0.5, 0.4],
  },
  {
    id: 'da42fd-rear-door', category: 'da42fd-cabin', name: 'Rear Passenger Door', where: 'Left side, behind the canopy',
    what: 'The rear passengers board through a door on the left, hinged at the top.',
    how: 'Close and lock it before start; it is part of the DOOR OPEN warning. Click its handle to open or close it.',
    notes: [],
    tryIt: [toggle('rearDoor', 'Rear door')],
    view: [0.6, 0.4, -1],
  },
  {
    id: 'da42fd-front-seats', category: 'da42fd-cabin', name: 'Front Seats & Harnesses', where: 'Pilot and front passenger',
    what: 'Reclined seats built into the composite structure, with removable cushions and four-point harnesses with a central buckle.',
    how: 'The seats don\'t move: the pilot adjusts the rudder pedals and uses cushions to reach the design eye position. Fasten and tighten the harness before start.',
    notes: ['The fixed seat shells form part of the occupant protection design.'],
    view: [-0.4, 0.8, 0.4],
  },
  {
    id: 'da42fd-rear-seats', category: 'da42fd-cabin', name: 'Rear Seats', where: 'Behind the front seats',
    what: 'Two rear seats with harnesses; the backrests fold for longer baggage on many aircraft.',
    how: 'Load and secure passengers and baggage according to the mass and balance limits.',
    notes: [],
    view: [1, 0.6, 0.2],
  },
  {
    id: 'da42fd-cabin-heat', category: 'da42fd-lights', name: 'Cabin Heat & Defrost', where: 'Centre console',
    what: 'Controls the hot air from the engine heat exchangers into the cabin and onto the canopy.',
    how: 'HEAT sends warm air to the footwells; DEFROST blows it onto the inside of the canopy to keep it clear.',
    notes: ['Keep the canopy clear before flight in cold, damp weather.'],
    tryIt: [toggle('cabinHeat', 'Cabin heat'), toggle('defrost', 'Defrost')],
    view: CONSOLE,
  },
  // ---------------------------------------------------------------- Lights
  {
    id: 'da42fd-ext-lights', category: 'da42fd-lights', name: 'Exterior Light Switches', where: 'Top of the panel, above the PFD',
    what: 'LANDING, TAXI, POSITION and STROBE light switches.',
    how: 'Linked to the exterior model: switch them here and the lights on the aircraft follow. Strobes on before entering the runway and off in cloud if they dazzle; landing light per the checklist.',
    notes: ['An ice inspection light is fitted on aircraft with ice protection.'],
    tryIt: [toggle('light.strobe', 'Strobe'), toggle('light.nav', 'Position'), toggle('light.landing', 'Landing')],
    view: PANEL,
  },
  {
    id: 'da42fd-int-lights', category: 'da42fd-lights', name: 'Instrument & Flood Lights', where: 'Top of the panel, left of the standby instruments',
    what: 'Instrument (panel) lighting for the backlit legends and the standby instruments, the flood light, and a dimmer.',
    how: 'INSTR lights the engraved legends and the bezel keys from behind. FLOOD switches on the LED flood light behind the front seats, which washes the panel and console. Try them with Night mode (the N key).',
    notes: ['The G1000 displays dim automatically with the light sensor, or manually from the PFD menu.'],
    tryIt: [toggle('light.panel', 'Instrument lights'), toggle('light.flood', 'Flood light')],
    view: PANEL,
  },
];
