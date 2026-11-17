// Boeing 737-800 (NG) exterior component data.
// Researched from public sources and written to describe the most common
// configuration across operators. Notable variants are mentioned in the text.
// Study aid only: operator documents (FCOM/QRH/SOP) always take precedence.
// An optional `review` field marks content to re-check against a specific
// operator manual if one is supplied.

export const categories = [
  { id: 'flight-controls', label: 'Flight Controls' },
  { id: 'high-lift', label: 'High-Lift Devices' },
  { id: 'landing-gear', label: 'Landing Gear' },
  { id: 'powerplant', label: 'Powerplant & APU' },
  { id: 'structure', label: 'Airframe' },
  { id: 'doors', label: 'Doors & Exits' },
  { id: 'lights', label: 'Exterior Lights' },
  { id: 'sensors', label: 'Probes & Sensors' },
  { id: 'antennas', label: 'Antennas' },
];

export const parts = [
  // ---------------------------------------------------------------- Flight controls
  {
    id: 'aileron', category: 'flight-controls', name: 'Ailerons', where: 'Outboard trailing edge · one per wing',
    what: 'Primary roll control. Turning the control wheel raises the aileron on one wing and lowers it on the other, rolling the aircraft toward the raised side.',
    how: 'Each aileron is driven by power control units (PCUs) supplied by hydraulic systems A and B. If both systems are lost, the ailerons revert to manual control through cables from the control wheel, with much heavier forces. Balance tabs reduce the forces needed. Aileron trim moves the neutral position of the wheel.',
    notes: [
      'Flight spoilers on the up-going aileron side join in once the wheel passes a small lost-motion range (roughly 10–12° of wheel).',
      'Aileron transfer mechanism: if the ailerons jam, force on the First Officer\'s wheel rolls the aircraft with the spoilers only (the Captain\'s wheel and the ailerons are then inoperative). If the spoilers jam, the Captain\'s wheel still drives the ailerons.',
      'Aileron trim is not used with the autopilot engaged.',
    ],
    tryIt: [{ label: 'Roll right', set: { roll: 0.8 } }, { label: 'Roll left', set: { roll: -0.8 } }, { label: 'Neutral', set: { roll: 0 } }],
  },
  {
    id: 'flight-spoilers', category: 'flight-controls', name: 'Flight Spoilers', where: 'Upper wing surface · 4 per wing',
    what: 'Panels on top of the wing that rise to spoil lift. They help the ailerons roll the aircraft and act as speedbrakes in flight.',
    how: 'Spoilers are numbered 1 to 12 from the left wingtip. Flight spoilers 2–5 (left) and 8–11 (right) sit outboard of the engines. System A powers 2, 4, 9 and 11, and system B powers 3, 5, 8 and 10, so losing one system still leaves a symmetric set. Commanded by the control wheel through the spoiler mixer and by the SPEED BRAKE lever.',
    notes: [
      'In flight, the speed brake lever raises the flight spoilers only. The ground spoilers stay locked down.',
      'Moving the lever beyond the FLIGHT DETENT in flight can cause buffeting.',
      'With the lever ARMED, all spoilers deploy automatically on touchdown.',
      '-800s with blended or split scimitar winglets have a Speedbrake Load Alleviation system that protects the wing at high speeds and weights.',
    ],
    tryIt: [{ label: 'Flight detent', set: { onGround: false, gearLever: 'UP', speedbrake: 'FLIGHT' } }, { label: 'Stow', set: { speedbrake: 'DOWN' } }],
  },
  {
    id: 'ground-spoilers', category: 'flight-controls', name: 'Ground Spoilers', where: 'Upper wing surface · 2 per wing (panels 1, 6, 7, 12)',
    what: 'Spoiler panels that work only on the ground. After touchdown they dump lift, putting the aircraft\'s weight on the wheels so the brakes work. Panels 6 and 7 are inboard of the engines, and panels 1 and 12 are the outboard-most panels.',
    how: 'All four are powered by hydraulic system A through a ground spoiler interlock valve. The valve opens only when the right main gear strut is compressed (ground mode), so the panels can\'t deploy in flight.',
    notes: [
      'They deploy together with the flight spoilers when the lever goes to UP on the ground, either by hand or automatically (ARMED, or during an RTO).',
      'Losing hydraulic system A means no ground spoilers: expect a longer landing distance.',
    ],
    tryIt: [{ label: 'Deploy on ground', set: { onGround: true, gearLever: 'DN', speedbrake: 'UP' } }, { label: 'Stow', set: { speedbrake: 'DOWN' } }],
  },
  {
    id: 'elevator', category: 'flight-controls', name: 'Elevators', where: 'Horizontal stabilizer trailing edge',
    what: 'Primary pitch control. Pulling the column raises the elevators, pitching the nose up. Pushing lowers them.',
    how: 'Driven by PCUs powered by hydraulic systems A and B, with manual reversion if both are lost. The elevator feel computer gives artificial feel from pitot pressure (fin-mounted feel pitots) and stabilizer position. Mach trim moves the elevator at high Mach to counter nose-down tuck.',
    notes: [
      'FEEL DIFF PRESS light: excessive differential pressure in the elevator feel computer, for example from a blocked feel pitot or a hydraulic system loss.',
      'Elevator balance tabs reduce the forces needed.',
      'Mach trim is automatic above about M 0.615.',
    ],
    tryIt: [{ label: 'Pull (nose up)', set: { pitch: 0.8 } }, { label: 'Push (nose down)', set: { pitch: -0.8 } }, { label: 'Neutral', set: { pitch: 0 } }],
  },
  {
    id: 'horizontal-stabilizer', category: 'flight-controls', name: 'Horizontal Stabilizer', where: 'Tail · all-moving trim surface',
    what: 'The whole horizontal tail pivots to trim the aircraft in pitch, so the pilot doesn\'t have to hold column force.',
    how: 'A jackscrew moves the stabilizer, driven by the stabilizer trim motor (main electric trim from the control wheel switches, or autopilot trim) or by cables from the manual trim wheels on the control stand. STAB TRIM CUTOUT switches remove electric trim.',
    notes: [
      'Trim is shown in units from 0 to 17. Electric trim travel is limited to about 4–17 units with flaps up and 0–17 with flaps extended. The green band shows the allowable takeoff trim range.',
      'Column cutout switches interrupt main electric trim, autopilot trim and Speed Trim when the column opposes the trim direction.',
      'Know the runaway stabilizer non-normal procedure in your QRH.',
    ],
    tryIt: [{ label: 'Trim nose up', set: { stabTrim: 12 } }, { label: 'Trim nose down', set: { stabTrim: 1 } }, { label: 'Takeoff trim (5)', set: { stabTrim: 5 } }],
  },
  {
    id: 'rudder', category: 'flight-controls', name: 'Rudder', where: 'Vertical fin trailing edge',
    what: 'Yaw control. Used for crosswind takeoffs and landings, engine-out control, and coordinating turns.',
    how: 'The main rudder PCU is powered by hydraulic systems A and B. A standby rudder PCU is powered by the standby hydraulic system. There\'s no manual reversion. The yaw damper damps Dutch roll and coordinates turns. Rudder trim is set with the knob on the aft pedestal.',
    notes: [
      'Standby hydraulic auto-start: loss of system A or B with flaps extended and either airborne or wheel speed above 60 kt, or a trip of the main rudder PCU force fight monitor. The standby pump then powers the standby rudder PCU.',
      'Rudder pedals also steer the nose wheel up to about 7° on the ground.',
    ],
    tryIt: [{ label: 'Right rudder', set: { yaw: 0.8 } }, { label: 'Left rudder', set: { yaw: -0.8 } }, { label: 'Neutral', set: { yaw: 0 } }],
  },

  // ---------------------------------------------------------------- High lift
  {
    id: 'trailing-edge-flaps', category: 'high-lift', name: 'Trailing-Edge Flaps', where: 'Inboard and outboard · each wing',
    what: 'Double-slotted Fowler flaps. They run aft and down, adding wing area and camber so the aircraft can fly slower for takeoff and landing.',
    how: 'A hydraulic motor powered by system B drives torque tubes and ball-screw actuators. The alternate electric motor (ALTERNATE FLAPS switches) moves them more slowly and without asymmetry protection. Lever positions: UP, 1, 2, 5, 10, 15, 25, 30, 40.',
    notes: [
      'Typical takeoff flaps on the -800: 1, 5, 10, 15 or 25. Landing: 15, 30 or 40.',
      'Flap load relief (not available with alternate flaps) retracts the flaps if the limit speed is exceeded: 40 → 30, and on most NGs also 30 → 25 and 25 → 15. They re-extend when speed reduces.',
      'Asymmetry and skew detection stops flap movement if the panels disagree.',
      'Moving the trailing-edge flaps also schedules the leading-edge devices.',
    ],
    tryIt: [{ label: 'Flaps 5', set: { flapLever: 5 } }, { label: 'Flaps 15', set: { flapLever: 15 } }, { label: 'Flaps 40', set: { flapLever: 40 } }, { label: 'Flaps up', set: { flapLever: 0 } }],
  },
  {
    id: 'le-slats', category: 'high-lift', name: 'Leading-Edge Slats', where: 'Outboard leading edge · 4 per wing (8 total)',
    what: 'Slats move forward and down from the wing\'s leading edge, opening a slot that lets the wing reach a higher angle of attack before stalling.',
    how: 'Powered by hydraulic system B. The standby hydraulic system can extend them through the alternate flaps system (extend only). With flaps 1, 2 or 5 the slats go to EXTEND (intermediate). With flaps 10 to 40 they go to FULL EXTEND.',
    notes: [
      'Autoslat: with flaps 1 to 5, the slats move to full extend automatically when approaching a stall.',
      'Center panel annunciators: LE FLAPS TRANSIT (amber) and LE FLAPS EXT (green).',
      'Wing anti-ice heats the three inboard slats on each wing with bleed air.',
    ],
    tryIt: [{ label: 'Flaps 1 → EXT', set: { flapLever: 1 } }, { label: 'Flaps 10 → FULL', set: { flapLever: 10 } }, { label: 'Retract', set: { flapLever: 0 } }],
  },
  {
    id: 'krueger-flaps', category: 'high-lift', name: 'Krueger Flaps', where: 'Inboard leading edge underside · 2 per wing',
    what: 'Hinged panels under the inboard leading edge. They swing down and forward to increase camber at the wing root.',
    how: 'Powered by hydraulic system B. They extend fully whenever the trailing-edge flaps leave UP.',
    notes: ['Part of the LE FLAPS TRANSIT / LE FLAPS EXT indications.', 'Look for them from behind the engine during the walkaround.'],
    tryIt: [{ label: 'Extend (flaps 1)', set: { flapLever: 1 } }, { label: 'Retract', set: { flapLever: 0 } }],
    view: [0.2, -0.6, -1],
  },

  // ---------------------------------------------------------------- Landing gear
  {
    id: 'main-gear', category: 'landing-gear', name: 'Main Landing Gear', where: 'Under each wing root · 2 wheels per leg',
    what: 'Carries most of the aircraft\'s weight and contains the wheel brakes. The legs retract inward into wells in the wing-body fairing.',
    how: 'Retracted and extended by hydraulic system A. If system A is lost, the manual gear extension handles release the uplocks and the gear free-falls into place. The landing gear transfer unit supplies system B pressure to raise the gear at the normal rate when the aircraft is airborne, engine 1 N2 is below about 50%, the gear lever is UP, and either main gear isn\'t up and locked.',
    notes: [
      'There are no doors over the main wheels. In flight the outer tire and hubcap form part of the belly contour, sealed by brush-type seals.',
      'Gear lever: UP, OFF, DN. OFF removes hydraulic pressure from the gear system. A lever lock prevents UP on the ground (an override trigger exists).',
      'Brakes: normal system B, alternate system A, plus an accumulator for parking and emergency braking. Autobrake RTO and 1, 2, 3, MAX.',
      'Wheel fuse plugs melt to deflate the tires before overheated brakes can burst them.',
    ],
    tryIt: [{ label: 'Gear up (in flight)', set: { onGround: false, gearLever: 'UP' } }, { label: 'Gear down', set: { gearLever: 'DN' } }],
  },
  {
    id: 'nose-gear', category: 'landing-gear', name: 'Nose Gear & Steering', where: 'Forward belly · twin wheels',
    what: 'Steerable twin-wheel nose gear. It retracts forward into the nose wheel well, so airflow helps push it down during a free-fall extension.',
    how: 'Retracted by hydraulic system A. Steering is powered by system A, with alternate steering from system B selected by the NOSE WHEEL STEERING switch. The tiller steers up to about 78° either side, the rudder pedals about 7°.',
    notes: ['The nose wheels have no brakes.', 'The doors are linked to the gear mechanism.', 'The taxi light is mounted on the strut and doesn\'t turn with steering.'],
    tryIt: [{ label: 'Gear up (in flight)', set: { onGround: false, gearLever: 'UP' } }, { label: 'Gear down', set: { gearLever: 'DN' } }],
  },

  // ---------------------------------------------------------------- Powerplant
  {
    id: 'engine', category: 'powerplant', name: 'CFM56-7B Engines', where: 'Under each wing',
    what: 'High-bypass, two-spool turbofans. Boeing lists the CFM56-7B24, -7B26 and -7B27 for the -800, rated at about 24,000 to 27,300 lbf. Bypass ratio is about 5:1.',
    how: 'N1 is the fan and low-pressure spool, N2 the high-pressure core. The EEC (FADEC) controls the engine in normal or alternate mode. Each engine drives an IDG (90 kVA generator) and an engine-driven hydraulic pump (engine 1 for system A, engine 2 for system B), and supplies bleed air.',
    notes: [
      'The flattened bottom of the nacelle gives ground clearance under the low-slung 737 wing. Boeing gives just 0.48–0.64 m between the nacelle and the ground.',
      'Started by an air-driven starter using APU bleed, a ground cart or cross-bleed. Ignition L, R or BOTH.',
      'Engine anti-ice heats the cowl inlet lip with bleed air.',
    ],
    tryIt: [{ label: 'Reverse thrust', set: { onGround: true, gearLever: 'DN', reversers: true } }, { label: 'Stow reversers', set: { reversers: false } }],
  },
  {
    id: 'thrust-reverser', category: 'powerplant', name: 'Thrust Reversers', where: 'Aft section of each nacelle',
    what: 'Cascade-type reversers. On landing the translating sleeves slide aft, blocker doors close off the fan duct, and fan air is turned forward through cascade vanes to help slow the aircraft.',
    how: 'The engine 1 reverser is powered by hydraulic system A and the engine 2 reverser by system B, with the standby system as backup. With the forward thrust levers at idle, the reverse levers can be raised only when the radio altimeter reads below 10 ft or the air/ground system is in ground mode. An electromechanical lock adds protection against in-flight deployment.',
    notes: ['REV indication on the upper display: amber while in transit, green when deployed.', 'Many SOPs have the reversers stowed to idle reverse by 60 kt.'],
    tryIt: [{ label: 'Deploy (on ground)', set: { onGround: true, gearLever: 'DN', reversers: true } }, { label: 'Stow', set: { reversers: false } }],
  },
  {
    id: 'pylon', category: 'powerplant', name: 'Engine Struts (Pylons)', where: 'Between each engine and wing',
    what: 'Attach the engine to the wing and carry fuel, bleed air, hydraulic lines and wiring between them.',
    how: 'The strut-to-wing attachments use fuse pins, designed to shear under extreme loads so the engine separates without rupturing the wing fuel tank.',
    notes: ['Strut fairings extend aft under the wing behind the nacelle.'],
  },
  {
    id: 'apu', category: 'powerplant', name: 'APU', where: 'Tail cone · inlet door on the right side',
    what: 'The auxiliary power unit is a small gas turbine in the tail. It supplies electrical power and bleed air when the engines aren\'t running, and serves as a backup in flight.',
    how: 'Most NGs have a Honeywell 131-9B (some early airframes have the GTCP36-280) driving one 90 kVA generator. It draws fuel from the left fuel manifold and starts on battery or external power. The air inlet door on the right side opens on start. The exhaust is at the tip of the tail cone.',
    notes: [
      'Operating envelope: bleed and electrical together up to 10,000 ft, bleed only up to 17,000 ft, electrical up to 41,000 ft.',
      'APU GEN OFF BUS (blue) shows the APU is ready to take electrical load.',
    ],
    tryIt: [{ label: 'Start APU', set: { apu: true } }, { label: 'Shut down', set: { apu: false } }],
    view: [-0.6, 0.15, 0.8],
  },

  // ---------------------------------------------------------------- Structure
  {
    id: 'fuselage', category: 'structure', name: 'Fuselage', where: 'Pressurized hull',
    what: 'Semi-monocoque aluminum pressure vessel holding the flight deck, passenger cabin and lower cargo holds. The -800 is 39.5 m (129 ft 6 in) long overall.',
    how: 'Pressurized by bleed air through the air conditioning packs, with the outflow valve controlling cabin altitude. The safety relief valves limit differential pressure to about 9.1 psi, keeping the cabin near 8,000 ft at FL410. Maximum differential for takeoff and landing is 0.125 psi.',
    notes: ['Boeing quotes 160 seats in two classes and up to 184 all-economy. Some high-density cabins are certified for up to 189.', 'Top of the fuselage is about 5.4–5.6 m above the ground, depending on weight (Boeing airport planning data).', 'Window belt, doors and cargo holds are explained under Doors & Exits.'],
  },
  {
    id: 'radome', category: 'structure', name: 'Radome', where: 'Nose cone',
    what: 'The composite nose cone covers the weather radar antenna. It\'s transparent to radar energy.',
    how: 'Behind it sit the weather radar antenna (with predictive windshear on equipped aircraft) and the glideslope antennas.',
    notes: ['On the walkaround, check for lightning strike marks, bird strike damage and loose latches.'],
    view: [1, 0.25, -0.5],
  },
  {
    id: 'wing', category: 'structure', name: 'Wings', where: 'Low-mounted, swept 25°',
    what: 'Swept 25° at quarter chord. The span is 34.3 m, or 35.8 m with blended winglets. The wings carry the main fuel tanks.',
    how: 'Main tanks 1 and 2 are in the wings and the center tank is in the center wing box. Total usable fuel is 26,024 L (6,875 US gal, about 20,900 kg), per Boeing\'s airport planning data.',
    notes: ['Dihedral helps lateral stability.', 'Wing anti-ice heats the three inboard leading-edge slats on each wing with bleed air.'],
  },
  {
    id: 'winglet', category: 'structure', name: 'Blended Winglets', where: 'Wing tips',
    what: 'Blended winglets about 2.4 m tall. They reduce induced drag from the wingtip vortex, saving roughly 3 to 5% fuel on longer sectors.',
    how: 'They\'re a passive structure with no moving parts. Some -800s have split scimitar winglets with an extra ventral strake.',
    notes: ['The wingtip position and strobe lights are at the winglet base.'],
  },
  {
    id: 'vertical-fin', category: 'structure', name: 'Vertical Fin', where: 'Tail',
    what: 'Gives directional (weathercock) stability and carries the rudder.',
    how: 'The two elevator feel pitot probes sit on either side of the dorsal fin, at the base of the vertical stabilizer. The dorsal fin fillet improves stability at high sideslip.',
    notes: ['On the walkaround, check the static wicks and the feel pitots.'],
  },
  {
    id: 'tail-skid', category: 'structure', name: 'Tail Skid', where: 'Lower aft fuselage',
    what: 'The -800\'s long fuselage makes a tail strike more likely if the aircraft over-rotates on takeoff or flares too much on landing. The tail skid protects the aft fuselage by touching the runway first.',
    how: 'A fixed skid with a crushable energy-absorbing cartridge. A tail strike crushes the cartridge, and its warning decal shows whether it needs maintenance attention.',
    notes: ['Walkaround: check the skid isn\'t damaged and the cartridge indicator is in the normal range.', 'A suspected tail strike calls for the Tail Strike non-normal procedure and a maintenance inspection.'],
    view: [-0.3, -0.25, -1],
  },
  {
    id: 'wing-body-fairing', category: 'structure', name: 'Wing-to-Body Fairing', where: 'Belly at the wing root',
    what: 'Streamlines the joint between wing and fuselage. It also encloses the main wheel wells and the air conditioning pack bay.',
    how: 'Ram air inlets and exhausts for the pack heat exchangers sit on the underside of the fairing.',
    notes: [],
    view: [0.3, -0.7, -0.8],
  },

  // ---------------------------------------------------------------- Doors
  {
    id: 'forward-entry-door', category: 'doors', name: 'Forward Entry Door (L1)', where: 'Left forward fuselage',
    what: 'The main boarding door. It\'s a plug-type door that lifts, then swings outward and forward.',
    how: 'Fitted with an escape slide. When the girt bar is attached to the floor brackets (armed), opening the door deploys and inflates the slide. A manual inflation handle is the backup.',
    notes: ['A door open shows on the overhead door annunciator panel.', 'Always confirm the door is disarmed before opening it normally.'],
    tryIt: [{ label: 'Open doors', set: { onGround: true, gearLever: 'DN', doors: true } }, { label: 'Close doors', set: { doors: false } }],
  },
  {
    id: 'aft-entry-door', category: 'doors', name: 'Aft Entry Door (L2)', where: 'Left aft fuselage',
    what: 'The rear boarding door, the same plug-type design as L1.',
    how: 'It has its own escape slide and girt bar.',
    notes: [],
    tryIt: [{ label: 'Open doors', set: { onGround: true, gearLever: 'DN', doors: true } }, { label: 'Close doors', set: { doors: false } }],
  },
  {
    id: 'service-doors', category: 'doors', name: 'Galley Service Doors (R1, R2)', where: 'Right fuselage, forward and aft',
    what: 'Used for catering and servicing. They count as emergency exits.',
    how: 'They have the same plug-door mechanism and escape slides as the entry doors.',
    notes: [],
    tryIt: [{ label: 'Open doors', set: { onGround: true, gearLever: 'DN', doors: true } }, { label: 'Close doors', set: { doors: false } }],
  },
  {
    id: 'overwing-exits', category: 'doors', name: 'Overwing Exits', where: 'Over each wing · 2 per side on the -800',
    what: 'Type III emergency exits. On the NG they\'re self-disposing hatches: pulling the handle lets a spring swing the hatch upward and outward, instead of a hatch that has to be lifted inside.',
    how: 'There\'s no slide. Passengers step onto the wing and follow the marked escape route off the trailing edge of the flaps.',
    notes: ['The spring-hinged overwing hatch was introduced with the NG. Earlier 737s had removable plug hatches.'],
    tryIt: [{ label: 'Open exits', set: { onGround: true, gearLever: 'DN', doors: true } }, { label: 'Close', set: { doors: false } }],
  },
  {
    id: 'forward-cargo-door', category: 'doors', name: 'Forward Cargo Door', where: 'Right lower fuselage, ahead of the wing',
    what: 'Access to the forward lower cargo hold.',
    how: 'Opens inward and upward. It\'s operated manually and counterbalanced.',
    notes: ['The forward hold is about 18.7 m³ (662 ft³) on the -800.'],
    tryIt: [{ label: 'Open doors', set: { onGround: true, gearLever: 'DN', doors: true } }, { label: 'Close doors', set: { doors: false } }],
  },
  {
    id: 'aft-cargo-door', category: 'doors', name: 'Aft Cargo Door', where: 'Right lower fuselage, behind the wing',
    what: 'Access to the aft lower cargo hold.',
    how: 'Opens inward and upward, operated manually.',
    notes: ['The aft hold is about 25.0 m³ (883 ft³) on the -800, for 43.7 m³ of bulk volume in both holds (Boeing reference guide). Boeing\'s airport planning data gives a maximum lower-deck volume of 45.1 m³ (1,591 ft³).'],
    tryIt: [{ label: 'Open doors', set: { onGround: true, gearLever: 'DN', doors: true } }, { label: 'Close doors', set: { doors: false } }],
  },
  {
    id: 'flight-deck-windows', category: 'doors', name: 'Flight Deck Windows', where: 'Nose · windows 1, 2 and 3 each side',
    what: 'Window 1 is the forward windshield, window 2 the sliding side window, and window 3 the aft side window.',
    how: 'Windows 1 and 2 have a conductive coating that is electrically heated for anti-ice and anti-fog, with overheat protection. Window 3 is also heated, for anti-fog. Window 2 can be opened on the ground and serves as an emergency exit from the flight deck, with escape straps.',
    notes: ['WINDOW HEAT switches and lights are on the forward overhead panel.', 'The NG has no eyebrow windows. Boeing dropped them before the NG entered service.'],
    view: [1, 0.35, -0.4],
  },

  // ---------------------------------------------------------------- Lights
  {
    id: 'nav-lights', category: 'lights', name: 'Position (Navigation) Lights', where: 'Wing tips',
    what: 'Red on the left wingtip, green on the right, and white facing aft from both tips. They show other aircraft which way you\'re heading.',
    how: 'Controlled by the POSITION switch (STROBE & STEADY, OFF, STEADY).',
    notes: ['They\'re normally on whenever the aircraft is powered.'],
    tryIt: [{ label: 'Toggle', toggle: 'light.nav' }],
  },
  {
    id: 'strobe-lights', category: 'lights', name: 'Strobe Lights', where: 'Wing tips and tail cone',
    what: 'High-intensity white anti-collision flashes.',
    how: 'Selected with POSITION: STROBE & STEADY. Typically on when entering the runway.',
    notes: [],
    tryIt: [{ label: 'Toggle', toggle: 'light.strobe' }],
  },
  {
    id: 'beacon-lights', category: 'lights', name: 'Anti-Collision Beacons', where: 'Top and bottom of the fuselage',
    what: 'Red rotating or flashing beacons. They warn ground crew that engines are about to start or are running.',
    how: 'Controlled by the ANTI-COLLISION switch. Typically on before pushback or engine start.',
    notes: [],
    tryIt: [{ label: 'Toggle', toggle: 'light.beacon' }],
  },
  {
    id: 'landing-lights', category: 'lights', name: 'Landing Lights', where: 'Wing root leading edge',
    what: 'High-intensity lights for takeoff and landing.',
    how: 'There are two configurations. Earlier NGs have four landing lights: two fixed lights in the wing roots and two retractable lights. Later NGs (from about 2015) have two LED arrays in each wing-root fairing, an inboard and an outboard one, which also serve as the taxi lights.',
    notes: ['They\'re often left on below 10,000 ft to be more visible.'],
    tryIt: [{ label: 'Toggle', toggle: 'light.landing' }],
  },
  {
    id: 'runway-turnoff-lights', category: 'lights', name: 'Runway Turnoff Lights', where: 'Wing root leading edge',
    what: 'Angled outward to light taxiway turnoffs and exits.',
    how: 'Left and right switches on the overhead panel.',
    notes: [],
    tryIt: [{ label: 'Toggle', toggle: 'light.turnoff' }],
  },
  {
    id: 'taxi-light', category: 'lights', name: 'Taxi Light', where: 'Nose gear strut',
    what: 'Lights the area ahead of the aircraft for taxiing.',
    how: 'It\'s mounted on the nose gear strut, so it switches off when the gear retracts. It doesn\'t turn with the nose wheels.',
    notes: [],
    tryIt: [{ label: 'Toggle', toggle: 'light.taxi' }],
  },
  {
    id: 'logo-lights', category: 'lights', name: 'Logo Lights', where: 'Upper surface of the horizontal stabilizer',
    what: 'Floodlight the tail fin livery, making the aircraft easier to see at night.',
    how: 'Controlled by the LOGO switch.',
    notes: [],
    tryIt: [{ label: 'Toggle', toggle: 'light.logo' }],
  },
  {
    id: 'wing-lights', category: 'lights', name: 'Wing Illumination Lights', where: 'Fuselage, ahead of the wings',
    what: 'Light up the wing leading edge and engine nacelle so the crew can check for ice at night.',
    how: 'Controlled by the WING switch.',
    notes: [],
    tryIt: [{ label: 'Toggle', toggle: 'light.wing' }],
  },

  // ---------------------------------------------------------------- Sensors
  {
    id: 'pitot-probes', category: 'sensors', name: 'Pitot Probes', where: 'Forward fuselage, both sides',
    what: 'Measure total (ram) air pressure for airspeed. There are three: the Captain\'s probe on the left side, and the First Officer\'s and auxiliary probes on the right.',
    how: 'The Captain\'s and First Officer\'s probes feed the ADIRUs through air data modules. The auxiliary probe feeds the standby instruments. All are electrically heated, with PROBE HEAT switches A and B.',
    notes: ['A blocked pitot gives unreliable airspeed. Know the Airspeed Unreliable non-normal procedure.', 'Remove pitot covers before flight. This is a classic walkaround item.'],
    view: [0.3, 0, -1],
  },
  {
    id: 'static-ports', category: 'sensors', name: 'Static Ports', where: 'Fuselage sides, aft of the nose',
    what: 'Flush openings that sense ambient static pressure for altitude, vertical speed and airspeed.',
    how: 'There are Captain, First Officer and alternate static ports on both sides of the fuselage, cross-connected to cancel sideslip errors.',
    notes: ['Keep the area around the ports clean and undamaged. Skin damage near them corrupts the readings.'],
    view: [0, 0.1, -1],
  },
  {
    id: 'aoa-vanes', category: 'sensors', name: 'Angle-of-Attack Vanes', where: 'Forward fuselage, both sides',
    what: 'Small vanes that align with the local airflow to measure angle of attack.',
    how: 'They feed the ADIRUs, stall management yaw damper computers (stick shaker) and the AOA displays. Electrically heated.',
    notes: ['Check during the walkaround that they move freely and aren\'t damaged.'],
    view: [0.3, 0.1, -1],
  },
  {
    id: 'tat-probe', category: 'sensors', name: 'TAT Probe', where: 'Left forward fuselage',
    what: 'Measures total air temperature for engine thrust settings and air data computations.',
    how: 'Electrically heated in flight.',
    notes: [],
    view: [0.2, -0.2, -1],
  },
  {
    id: 'elevator-feel-pitots', category: 'sensors', name: 'Elevator Feel Pitots', where: 'Vertical stabilizer · 2, at its base by the dorsal fin',
    what: 'Pitot probes that measure dynamic pressure for the elevator feel computer.',
    how: 'They feed the elevator feel system, so column forces increase with airspeed.',
    notes: ['They\'re high up, so use binoculars or a careful look during the walkaround.'],
    view: [-0.4, 0.2, -1],
  },

  // ---------------------------------------------------------------- Antennas
  {
    id: 'vhf-antennas', category: 'antennas', name: 'VHF Comm Antennas', where: 'Top and bottom of the fuselage',
    what: 'Blade antennas for VHF voice radios and datalink (ACARS).',
    how: 'VHF 1 is on top, with VHF 2 (and VHF 3 where fitted) on the belly.',
    notes: [],
  },
  {
    id: 'tcas-antennas', category: 'antennas', name: 'TCAS Antennas', where: 'Top and bottom of the forward fuselage',
    what: 'Directional antennas the traffic collision avoidance system uses to find nearby transponder-equipped aircraft.',
    how: 'The top antenna is directional. The bottom one is directional or omnidirectional, depending on installation.',
    notes: [],
  },
  {
    id: 'gps-antennas', category: 'antennas', name: 'GPS Antennas', where: 'Top of the fuselage',
    what: 'Low-profile antennas receiving satellite navigation signals for the MMRs and FMC position.',
    how: 'Two antennas, one per GPS receiver.',
    notes: [],
  },
  {
    id: 'radio-altimeter-antennas', category: 'antennas', name: 'Radio Altimeter Antennas', where: 'Aft belly',
    what: 'Transmit and receive pairs that measure the height above the ground.',
    how: 'Used for the RA display, GPWS, autoland, autothrottle retard and the air/ground logic of some systems.',
    notes: [],
    view: [0, -1, -0.3],
  },
  {
    id: 'atc-dme-antennas', category: 'antennas', name: 'ATC / DME Antennas', where: 'Lower and upper fuselage',
    what: 'Small blades for the transponders (ATC) and distance measuring equipment.',
    how: 'The transponders reply to ground radar and TCAS interrogations. DME measures slant range to ground stations.',
    notes: [],
  },
];

// Preferred camera direction when focusing a part (x forward, y up, z right; left side is -z).
const VIEWS = {
  aileron: [-0.35, 0.85, -0.45],
  'flight-spoilers': [-0.5, 0.85, -0.3],
  'ground-spoilers': [-0.5, 0.85, -0.3],
  'trailing-edge-flaps': [-0.6, 0.7, -0.45],
  'le-slats': [0.65, 0.55, -0.5],
  wing: [0.1, 1, -0.35],
  winglet: [-0.3, 0.35, -1],
  elevator: [-0.6, 0.7, -0.45],
  'horizontal-stabilizer': [-0.5, 0.6, -0.6],
  rudder: [-0.7, 0.3, -0.6],
  'vertical-fin': [-0.2, 0.3, -1],
  'main-gear': [0.4, -0.05, -1],
  'nose-gear': [0.6, 0.02, -1],
  engine: [0.8, 0.2, -0.6],
  'thrust-reverser': [-0.5, 0.2, -0.8],
  pylon: [0, 0.3, -1],
  fuselage: [0.2, 0.35, -1],
  'logo-lights': [-0.6, 0.7, -0.4],
  'beacon-lights': [0.2, 0.3, -1],
  'landing-lights': [1, 0.12, -0.4],
  'runway-turnoff-lights': [1, 0.12, -0.5],
  'taxi-light': [1, -0.02, -0.45],
  'nav-lights': [0.5, 0.3, -0.8],
  'strobe-lights': [0.3, 0.35, -1],
  'wing-lights': [0.2, 0.3, -1],
  'overwing-exits': [0, 0.35, -1],
  'forward-entry-door': [0.3, 0.1, -1],
  'aft-entry-door': [-0.3, 0.1, -1],
  'service-doors': [0.3, 0.1, 1],
  'forward-cargo-door': [0.2, -0.1, 1],
  'aft-cargo-door': [-0.2, -0.1, 1],
  'vhf-antennas': [0.2, 0.6, -1],
  'tcas-antennas': [0.3, 0.8, -0.6],
  'gps-antennas': [0.1, 1, -0.4],
  'atc-dme-antennas': [0.2, -0.6, -1],
};
for (const p of parts) if (!p.view && VIEWS[p.id]) p.view = VIEWS[p.id];

export const meta = {
  id: 'b738',
  name: 'Boeing 737-800',
  family: '737 Next Generation',
  short: '737-800 NG',
  specs: [
    ['Length', '39.5 m'],
    ['Wingspan', '35.8 m (winglets)'],
    ['Height', '12.5 m'],
    ['MTOW', '79,015 kg max'],
    ['Fuel', '26,024 L'],
    ['Seats', '160 / 184'],
    ['Engines', '2 × CFM56-7B'],
    ['Mmo', 'M 0.82'],
    ['Ceiling', '41,000 ft'],
  ],
};
