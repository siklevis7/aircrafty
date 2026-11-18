// Diamond DA42 Twin Star exterior component data.
// Written from public sources (EASA TCDS EASA.A.005, Diamond Aircraft product data and widely
// used type-training material) to describe the configuration most common across operators today:
// the DA42 NG / DA42-VI with Austro Engine AE300 (E4) diesel engines, FADEC, MT 3-blade
// feathering propellers and a Garmin G1000 / G1000 NXi flight deck. Older Thielert-powered
// aircraft (TAE 125 "Centurion") are mentioned only as notes.
// Speeds are typical NG AFM values in KIAS; the TCDS gives limits in KEAS. Study aid only:
// always use the approved AFM for the aircraft and your training organisation's procedures.

export const categories = [
  { id: 'flight-controls', label: 'Flight Controls' },
  { id: 'landing-gear', label: 'Landing Gear' },
  { id: 'powerplant', label: 'Powerplant & Propellers' },
  { id: 'fuel', label: 'Fuel' },
  { id: 'airframe', label: 'Airframe & Doors' },
  { id: 'lights', label: 'Exterior Lights' },
  { id: 'sensors', label: 'Probes & Sensors' },
  { id: 'antennas', label: 'Antennas & Avionics' },
  { id: 'ice', label: 'Ice Protection (optional)' },
  { id: 'electrical', label: 'Electrical' },
];

export const parts = [
  // ---------------------------------------------------------------- Flight controls
  {
    id: 'aileron', category: 'flight-controls', name: 'Ailerons', where: 'Outer wing trailing edge · one per side',
    what: 'Roll control. Moving the stick left raises the left aileron and lowers the right one, rolling the aircraft to the left.',
    how: 'The ailerons are driven mechanically from the control sticks through push rods and bellcranks. There is no hydraulic boost and no aileron trim. Travel is larger upward than downward (about 25° up, 15° down per the TCDS), which reduces adverse yaw.',
    notes: [
      'Preflight: check freedom of movement, hinges and push-rod connections, and that the surface is undamaged.',
      'Static dischargers on the trailing edge bleed off static charge.',
      'The DA42 has no aileron trim: lateral trim with one engine inoperative comes from rudder trim and a small bank toward the live engine.',
    ],
    tryIt: [{ label: 'Roll right', set: { roll: 0.8 } }, { label: 'Roll left', set: { roll: -0.8 } }, { label: 'Neutral', set: { roll: 0 } }],
  },
  {
    id: 'elevator', category: 'flight-controls', name: 'Elevator', where: 'Trailing edge of the T-tail stabilizer',
    what: 'Pitch control. Pulling the stick raises the elevator and pitches the nose up.',
    how: 'Push rods connect the sticks to the elevator. Because the stabilizer sits on top of the fin, the elevator works in fairly clean air, largely clear of the propeller slipstream. The NG has a variable elevator stop that limits nose-up elevator travel at high power, which improves stall behaviour.',
    notes: [
      'TCDS travel: about 15.5° up and 13° down.',
      'Check the elevator through its full range and look for play in the hinges and the trim tab linkage.',
    ],
    tryIt: [{ label: 'Pull (nose up)', set: { pitch: 0.8 } }, { label: 'Push (nose down)', set: { pitch: -0.8 } }, { label: 'Neutral', set: { pitch: 0 } }],
  },
  {
    id: 'elevator-trim-tab', category: 'flight-controls', name: 'Elevator Trim Tab', where: 'Inboard trailing edge of the elevator',
    what: 'Removes the stick force in pitch so the aircraft holds the selected attitude hands-off.',
    how: 'A trim wheel on the centre console moves the tab through a cable or push-rod linkage, and a trim indicator shows the setting. Aircraft with the GFC 700 autopilot also have electric pitch trim on the stick. The tab moves opposite to the elevator: nose-up trim moves the tab trailing edge down.',
    notes: [
      'Set the trim for takeoff before departure (the indicator has a takeoff mark).',
      'TCDS tab travel: about 28° and 25° either side of neutral.',
    ],
    tryIt: [{ label: 'Trim nose up', set: { elevTrim: 0.8 } }, { label: 'Trim nose down', set: { elevTrim: -0.8 } }, { label: 'Takeoff', set: { elevTrim: 0 } }],
  },
  {
    id: 'rudder', category: 'flight-controls', name: 'Rudder', where: 'Vertical fin trailing edge',
    what: 'Yaw control. Used to coordinate turns, for crosswind takeoffs and landings and, above all, to keep straight after an engine failure.',
    how: 'The rudder pedals drive the rudder through cables. The pedals also steer the nose wheel on the ground. Travel is about 27° left and 29° right (TCDS).',
    notes: [
      'With one engine inoperative, rudder holds the aircraft straight against the asymmetric thrust of the live engine. Below VMCA there isn\'t enough rudder authority to do so.',
      'Both propellers turn clockwise as seen from the cockpit, so the left engine is the critical engine.',
    ],
    tryIt: [{ label: 'Right rudder', set: { yaw: 0.8 } }, { label: 'Left rudder', set: { yaw: -0.8 } }, { label: 'Neutral', set: { yaw: 0 } }],
  },
  {
    id: 'rudder-trim-tab', category: 'flight-controls', name: 'Rudder Trim Tab', where: 'Lower trailing edge of the rudder',
    what: 'Takes out pedal force, mainly in single-engine flight where it relieves the leg holding the rudder against the live engine.',
    how: 'A rudder trim knob or wheel in the cockpit moves the tab through a mechanical linkage. The tab moves opposite to the rudder deflection it holds.',
    notes: [
      'After an engine failure, trimming the rudder is part of reducing workload once the aircraft is under control. Follow the AFM procedure.',
      'Check the tab is secure and moves in the correct sense during preflight.',
    ],
    tryIt: [{ label: 'Trim right', set: { rudderTrim: 0.8 } }, { label: 'Trim left', set: { rudderTrim: -0.8 } }, { label: 'Neutral', set: { rudderTrim: 0 } }],
  },
  {
    id: 'flaps', category: 'flight-controls', name: 'Wing Flaps', where: 'Inboard trailing edge · stub wing and outer wing',
    what: 'Increase lift and drag for slower approach and landing speeds and a steeper approach path.',
    how: 'The flaps are electrically actuated by one motor and selected with a three-position switch: UP (0°), APP (20°) and LDG (42°). Position lights show the selected setting and flash while the flaps move. The segments on the stub wing and the outer wing are linked and move together.',
    notes: [
      'Typical NG limits: VFE APP about 137 KIAS, VFE LDG about 111 KIAS. Use the values in your AFM.',
      'Takeoff is normally with flaps UP or APP, per the AFM.',
      'Selecting LDG flaps with the gear not down sounds the gear warning.',
    ],
    tryIt: [{ label: 'APP (20°)', set: { flapLever: 'APP' } }, { label: 'LDG (42°)', set: { flapLever: 'LDG' } }, { label: 'UP', set: { flapLever: 'UP' } }],
  },
  {
    id: 'horizontal-stabilizer', category: 'flight-controls', name: 'Horizontal Stabilizer (T-tail)', where: 'Top of the vertical fin',
    what: 'Gives pitch stability and carries the elevator. On the DA42 it sits on top of the fin in a T-tail layout.',
    how: 'A fixed composite surface. Mounting it high keeps it out of the propeller slipstream and the wing downwash at normal angles of attack, so pitch trim changes little with power and flap settings.',
    notes: [
      'Check the fin-to-stabilizer attachment fairing, the leading edge and the tips for damage.',
      'On aircraft with TKS ice protection the leading edge carries porous panels.',
    ],
  },

  // ---------------------------------------------------------------- Landing gear
  {
    id: 'main-gear', category: 'landing-gear', name: 'Main Landing Gear', where: 'Under each stub wing, inboard of the nacelles',
    what: 'Carries most of the aircraft\'s weight on the ground and absorbs the landing loads.',
    how: 'Trailing-link legs with oleo-pneumatic shock absorbers. The gear is electro-hydraulic: an electrically driven hydraulic pump retracts it, and the legs fold inward into the stub wing. Hydraulic pressure holds the gear up, and the pump restarts automatically if pressure drops. Each leg locks down mechanically.',
    notes: [
      'Three green lights show down-and-locked. A red light shows gear in transit or not agreeing with the selector.',
      'Emergency extension: pulling the emergency gear handle releases hydraulic pressure so the gear falls and locks under gravity and spring force. Follow the AFM procedure.',
      'Typical NG limits: VLO extension 188 KIAS, VLO retraction 152 KIAS, VLE 188 KIAS. Use your AFM values.',
      'Main tyres: 15×6.0-6.',
    ],
    tryIt: [{ label: 'Take off & retract', set: { onGround: false, gearLever: 'UP' } }, { label: 'Extend', set: { gearLever: 'DN' } }, { label: 'Land', set: { gearLever: 'DN', onGround: true } }],
  },
  {
    id: 'nose-gear', category: 'landing-gear', name: 'Nose Gear & Steering', where: 'Under the nose',
    what: 'Supports the nose on the ground and steers the aircraft during taxi.',
    how: 'The nose leg retracts forward into the nose. The rudder pedals are linked to the nose wheel, so steering is direct through the pedals, helped by differential braking for tight turns.',
    notes: [
      'Tow only within the steering limits marked on the aircraft, using the approved tow bar.',
      'Check the shock strut extension, tyre (5.00-5), doors and linkages for damage or leaks.',
      'Because the gear retracts forward, airflow helps push it down during an emergency extension.',
    ],
    tryIt: [{ label: 'Retract (in flight)', set: { onGround: false, gearLever: 'UP' } }, { label: 'Extend', set: { gearLever: 'DN' } }],
  },
  {
    id: 'gear-doors', category: 'landing-gear', name: 'Gear Doors', where: 'Main legs and nose wheel well',
    what: 'Fair over the gear bays when the gear is up to reduce drag.',
    how: 'The main gear doors are attached to the legs and close the bay as the leg folds into the wing. The nose wheel well has two doors, mechanically linked to the nose leg.',
    notes: [
      'Check doors and hinges for cracks and secure attachment.',
      'A damaged door can jam the gear: report any damage before flight.',
    ],
    tryIt: [{ label: 'Cycle gear (in flight)', set: { onGround: false, gearLever: 'UP' } }, { label: 'Extend', set: { gearLever: 'DN' } }],
  },
  {
    id: 'wheel-brakes', category: 'landing-gear', name: 'Wheel Brakes', where: 'Inboard side of each main wheel',
    what: 'Slow and stop the aircraft on the ground and help steer it in tight turns.',
    how: 'Hydraulic disc brakes on the main wheels, operated by toe brakes on the rudder pedals at both front seats. A parking brake valve holds pressure when parked.',
    notes: [
      'Check brake discs, pads and lines, and look for fluid leaks.',
      'Don\'t rely on the parking brake alone for long parking: use chocks and tie-downs.',
    ],
  },

  // ---------------------------------------------------------------- Powerplant & propellers
  {
    id: 'engine', category: 'powerplant', name: 'Austro Engine AE300 (E4)', where: 'Front of each nacelle, under the cowling',
    what: 'Each engine is a 2.0-litre, four-cylinder, liquid-cooled, turbocharged common-rail diesel producing 168 hp (123.5 kW) for takeoff. It runs on jet fuel.',
    how: 'The engine drives the propeller through a reduction gearbox. A FADEC with two engine control units per engine (ECU A and ECU B) controls fuel injection, boost and propeller speed from a single power lever. ECU A normally runs the engine; if it fails, ECU B takes over automatically. Each engine has an ENGINE MASTER switch and an engine-driven alternator.',
    notes: [
      'Approved fuels include Jet A-1, Jet A and other jet fuels listed in the AFM (diesel to EN 590 with a design change). Avgas is not approved for the AE300.',
      'The power lever sets engine load in %. TCDS: 100 % (5 min) for takeoff, 92 % maximum continuous.',
      'The ECU test before flight checks both ECUs and the switch-over between them.',
      'Older DA42s used the Thielert TAE 125 "Centurion" 1.7 or 2.0 litre diesel (135 hp) with a similar single-lever FADEC.',
    ],
    tryIt: [{ label: 'Start both', set: { engines: true } }, { label: 'Shut down both', set: { engines: false } }],
  },
  {
    id: 'propeller', category: 'powerplant', name: 'MT 3-Blade Propellers', where: 'Front of each nacelle',
    what: 'Constant-speed, hydraulically controlled, feathering propellers with three composite blades, 1.87 m or 1.90 m in diameter.',
    how: 'The ECU sets propeller speed electrically through the governor, so there is no separate propeller lever. Oil pressure moves the blades toward fine pitch; springs and counterweights drive them toward feather. When an engine is shut down in flight with its ENGINE MASTER switch, oil pressure is lost and the propeller feathers by itself, provided it is still turning fast enough. On the ground, start-lock pins hold the blades near fine pitch as the engine stops, so the next start is easy.',
    notes: [
      'Both propellers turn clockwise as seen from the cockpit. That makes the left engine critical.',
      'Air restart: an unfeathering accumulator (on most aircraft) and the starter bring the blades out of feather. Follow the AFM procedure.',
      'Preflight: blades free of nicks, cracks and erosion, the metal erosion sheath intact, the spinner secure.',
      'TCDS propeller speed limits: 2300 rpm for takeoff (5 min) and 2100 rpm maximum continuous, or 2300 rpm continuous with design change MÄM 42-600.',
    ],
    tryIt: [
      { label: 'Start engines', set: { engines: true } },
      { label: 'Fly, shut down left', set: { onGround: false, gearLever: 'UP', eng1: false } },
      { label: 'Restart left', set: { eng1: true } },
    ],
  },
  {
    id: 'engine-inlets', category: 'powerplant', name: 'Cooling & Induction Air Inlets', where: 'Below the spinner and on the cowling sides',
    what: 'Bring air to the coolant radiator, the intercooler and the engine induction system.',
    how: 'The chin inlet under the spinner feeds the radiator and intercooler cores and the engine air intake. Smaller inlets on the cowling ventilate the engine compartment and accessories. Warm air leaves through outlets at the bottom of the cowling.',
    notes: [
      'Remove inlet covers and plugs before flight and check for bird nests or debris.',
      'Coolant and oil temperatures depend on clear inlets: a blocked radiator shows up quickly on the engine page.',
    ],
  },
  {
    id: 'exhaust', category: 'powerplant', name: 'Exhaust & Cooling Outlet', where: 'Lower outboard side of each cowling',
    what: 'Carries exhaust gas from the turbocharger overboard and lets cooling air out of the engine compartment.',
    how: 'The exhaust stack exits on the lower side of the cowling behind the turbocharger. The cooling-air outlet at the bottom of the cowling lets hot air escape.',
    notes: [
      'Check the stack is secure and free of cracks. Unusual soot or oil staining is worth reporting.',
      'The exhaust stays hot well after shutdown: keep hands clear.',
    ],
  },
  {
    id: 'cowling-access', category: 'powerplant', name: 'Oil & Coolant Check Doors', where: 'Upper engine cowling',
    what: 'Small access doors for the daily fluid checks without removing the cowling.',
    how: 'Through the access doors you can check the engine oil level with the dipstick and the coolant expansion tank level. The gearbox oil level is also part of the preflight check (see the AFM for where and how).',
    notes: [
      'TCDS engine oil quantity: 5 litres minimum, 7 litres maximum.',
      'Close and latch every access door after checking. An unlatched door can depart in flight.',
      'Use only the oil and coolant types listed in the AFM.',
    ],
  },
  {
    id: 'nacelle', category: 'powerplant', name: 'Engine Nacelles', where: 'On each wing at the stub-wing joint',
    what: 'House the engine, its mounts and accessories, the firewall and, behind the engine, the auxiliary fuel tank (if fitted).',
    how: 'Composite nacelles sit on top of the wing so the propellers have ground clearance. Each nacelle extends aft of the wing trailing edge. The engine mount and firewall are inside the forward part.',
    notes: [
      'Check the nacelle for cracks, loose fasteners, fuel or oil stains and secure cowling latches.',
    ],
  },

  // ---------------------------------------------------------------- Fuel
  {
    id: 'main-fuel-tanks', category: 'fuel', name: 'Main Fuel Tanks', where: 'Outer wings · filler on the upper surface outboard of each nacelle',
    what: 'Each wing has a main tank, about 26 US gal total and 25 US gal usable per side. Each engine normally feeds from its own wing.',
    how: 'Each engine has a fuel selector (ON, CROSSFEED, OFF). In CROSSFEED an engine draws fuel from the opposite wing, which is used to balance fuel with one engine inoperative. An electric fuel pump per engine backs up the engine-driven pump. The G1000 shows quantity, flow and fuel temperature.',
    notes: [
      'TCDS: standard tanks 196.8 litres total, 189.2 litres (50 US gal) usable for both wings.',
      'Check the fuel visually and against the gauges, confirm the correct fuel type, and make sure the caps are closed and locked.',
      'Fuel temperature has limits in the AFM. Very cold or hot fuel matters on a diesel.',
    ],
  },
  {
    id: 'aux-fuel-tanks', category: 'fuel', name: 'Auxiliary Fuel Tanks (optional)', where: 'Engine nacelles · filler on top of the aft nacelle',
    what: 'Optional auxiliary tanks add 13.2 US gal usable per side, 26.4 US gal (100 litres) in total.',
    how: 'The engines do not feed directly from the auxiliary tanks. An electric transfer pump moves fuel from each auxiliary tank into its main tank when the transfer switch is on, once there is room in the main tank.',
    notes: [
      'Plan when to transfer: auxiliary fuel is only available once it reaches the main tank.',
      'Check the auxiliary filler caps are closed and locked.',
    ],
  },
  {
    id: 'fuel-drains', category: 'fuel', name: 'Fuel Drains', where: 'Under the wings and nacelles',
    what: 'Let you take fuel samples from the lowest points of the tanks and the fuel system to check for water and contamination.',
    how: 'Push-to-drain valves under each main tank, auxiliary tank (if fitted) and at the fuel filter/gascolator points let fuel flow into a sampling cup.',
    notes: [
      'Drain before the first flight of the day and after refuelling. Check for water, sediment and the correct jet-fuel colour and smell.',
      'Jet fuel holds water in suspension longer than avgas: allow time to settle before sampling.',
    ],
  },
  {
    id: 'fuel-vents', category: 'fuel', name: 'Fuel Tank Vents', where: 'Under each outer wing',
    what: 'Let air into the tanks as fuel is used, and allow for expansion.',
    how: 'Vent lines run from the tanks to small openings on the wing lower surface.',
    notes: ['A blocked vent can starve an engine or collapse a tank: check they are clear and undamaged.'],
  },

  // ---------------------------------------------------------------- Airframe & doors
  {
    id: 'fuselage', category: 'airframe', name: 'Fuselage', where: 'Composite monocoque',
    what: 'Carries the four occupants, the nose baggage compartment and the tail. Built mainly from carbon- and glass-fibre composite.',
    how: 'The shell is made in halves and bonded together. The upper surfaces are white because high temperatures weaken composite structure: Diamond limits colours on the airframe for that reason.',
    notes: [
      'Look for cracks, delamination, dents and paint damage. Composite damage can hide under intact paint, so report impacts.',
      'Overall length 8.56 m and height 2.49 m (TCDS).',
    ],
  },
  {
    id: 'wing', category: 'airframe', name: 'Wings', where: 'Low wing · stub wing plus two outer wings',
    what: 'A straight, low, composite wing of 13.42 m span and 16.29 m² area (TCDS). The stub (centre) wing carries the engines and main gear; the outer wings have dihedral.',
    how: 'The outer wings attach to the stub wing at the nacelles. The main fuel tanks are in the outer wings. A non-slip walkway on the stub wing next to the fuselage is the only place to step: the rest is NO STEP.',
    notes: [
      'Check the leading edges, upper and lower surfaces, wing-to-fuselage joints and control surface hinges.',
      'Remove frost, snow and ice completely before flight.',
    ],
  },
  {
    id: 'winglets', category: 'airframe', name: 'Winglets', where: 'Wing tips',
    what: 'Upturned composite tips that reduce induced drag. The tip light units sit at their base.',
    how: 'The winglets reduce the wingtip vortex strength and so the induced drag, which helps climb and single-engine performance.',
    notes: ['Check for cracks and that the light lenses are intact and secure.'],
  },
  {
    id: 'vertical-fin', category: 'airframe', name: 'Vertical Fin', where: 'Tail',
    what: 'Gives directional stability and carries the rudder and the T-tail horizontal stabilizer.',
    how: 'A swept composite fin with a dorsal fillet blending it into the tail boom.',
    notes: ['Check the fin for damage, especially around the stabilizer attachment.'],
  },
  {
    id: 'tail-skid', category: 'airframe', name: 'Ventral Fin & Tail Skid', where: 'Under the tail boom',
    what: 'A small ventral fin under the tail adds directional stability and carries a skid that protects the tail in a tail strike.',
    how: 'The skid touches first if the nose is over-rotated on takeoff or landing.',
    notes: ['Scrape marks on the skid mean a possible tail strike: report it.'],
  },
  {
    id: 'front-canopy', category: 'airframe', name: 'Front Canopy', where: 'Over the front seats · hinged at the front',
    what: 'A one-piece canopy that opens forward and upward for access to the front seats, boarding from the wing walkway.',
    how: 'Gas struts help lift and hold the canopy open. A locking handle with a secondary latch secures it, and a DOOR warning on the G1000 shows if the canopy or a door isn\'t locked.',
    notes: [
      'Close and lock the canopy before takeoff and check the DOOR warning is out.',
      'If a canopy or door unlocks in flight, fly the aircraft first and follow the AFM procedure. Don\'t try to close a door that has opened in flight unless the AFM says so.',
      'Don\'t leave the aircraft parked with the canopy open in wind.',
    ],
    tryIt: [{ label: 'Open / close', toggle: 'canopy' }],
  },
  {
    id: 'rear-door', category: 'airframe', name: 'Rear Passenger Door', where: 'Left side, behind the front seats · hinged at the top',
    what: 'Gives access to the rear seats and the baggage area behind them.',
    how: 'The door is hinged at the top of the fuselage and swings outward and upward, held open by a gas strut. It locks with a handle and secondary latch, monitored by the DOOR warning.',
    notes: [
      'Check it is closed and locked before flight. There have been in-flight separations of unlocked DA40/DA42 passenger doors, and authorities issued directives on door latching.',
      'Rear baggage limits (TCDS): 45 kg behind the rear seats and in the baggage extension together (18 kg in its aft part).',
    ],
    tryIt: [{ label: 'Open / close', toggle: 'rearDoor' }],
  },
  {
    id: 'nose-baggage', category: 'airframe', name: 'Nose Baggage Compartment', where: 'Long nose · a door on each side',
    what: 'A baggage compartment in the nose, ahead of the cabin, reached through a lockable door on each side.',
    how: 'The compartment helps keep the centre of gravity within limits. Doors are locked with a key and fit flush with the nose.',
    notes: [
      'TCDS limit: 30 kg in the front baggage compartment. Load and secure baggage per the mass and balance.',
      'Check both doors are closed and locked: an open nose door in flight is a known hazard.',
    ],
    tryIt: [{ label: 'Open / close', toggle: 'noseBaggage' }],
  },
  {
    id: 'tie-downs', category: 'airframe', name: 'Tie-Down Points', where: 'Under each outer wing and at the tail',
    what: 'Anchor points for securing the parked aircraft against wind.',
    how: 'Ropes or straps go from these rings to ground anchors.',
    notes: ['Remove all tie-downs, chocks and covers during the preflight and include them in your final walk-around check.'],
  },

  // ---------------------------------------------------------------- Lights
  {
    id: 'nav-lights', category: 'lights', name: 'Position Lights', where: 'Wing tips',
    what: 'Red (left), green (right) and white (rearward) lights that show other pilots your position and direction.',
    how: 'The coloured lights face forward in the wingtip units. White lights at the rear of each tip cover the tail sector.',
    notes: ['Required between sunset and sunrise. Check all lenses intact during preflight.'],
    tryIt: [{ label: 'Position lights', toggle: 'light.nav' }],
  },
  {
    id: 'strobe-lights', category: 'lights', name: 'Strobe Lights (ACL)', where: 'Wing tips, in the position-light units',
    what: 'High-intensity white flashing anti-collision lights.',
    how: 'Integrated with the position lights in each wingtip unit.',
    notes: ['Usually switched on before engine start or before entering the runway, per your procedures. Switch off if they dazzle in cloud.'],
    tryIt: [{ label: 'Strobes', toggle: 'light.strobe' }],
  },
  {
    id: 'landing-light', category: 'lights', name: 'Landing Light', where: 'Under the forward fuselage',
    what: 'A forward-pointing light for takeoff and landing.',
    how: 'Mounted with the taxi light in a unit under the fuselage. LED units are common on newer aircraft.',
    notes: ['Check the lens is clean and undamaged.'],
    tryIt: [{ label: 'Landing light', toggle: 'light.landing' }],
  },
  {
    id: 'taxi-light', category: 'lights', name: 'Taxi Light', where: 'Under the forward fuselage',
    what: 'A wider-beam light for taxiing at night.',
    how: 'Mounted beside the landing light under the fuselage.',
    notes: ['Use it on the ground. Turn it off when facing other aircraft to avoid dazzling them.'],
    tryIt: [{ label: 'Taxi light', toggle: 'light.taxi' }],
  },

  // ---------------------------------------------------------------- Probes & sensors
  {
    id: 'pitot-static', category: 'sensors', name: 'Pitot-Static Probe', where: 'Under the left outer wing',
    what: 'Measures total (pitot) and static pressure for the air data computer: airspeed, altitude and vertical speed on the G1000.',
    how: 'One combined, electrically heated probe on a mast under the left wing. The pitot opening faces forward and the static ports are on the probe. An alternate static source in the cabin is available if the static ports block.',
    notes: [
      'Remove the cover and check the openings are clear. The probe gets very hot with pitot heat on: don\'t touch it.',
      'Use pitot heat in visible moisture at low temperatures, per your procedures.',
    ],
  },
  {
    id: 'stall-warning', category: 'sensors', name: 'Stall Warning', where: 'Left wing leading edge',
    what: 'Warns the pilot audibly as the wing approaches the stall.',
    how: 'A sensor in the left wing leading edge detects the change in airflow near the stall and triggers an aural warning in the cockpit.',
    notes: ['Check the opening is clear and undamaged, and test the warning as your AFM describes.'],
  },

  // ---------------------------------------------------------------- Antennas & avionics
  {
    id: 'com-antennas', category: 'antennas', name: 'COM Antennas', where: 'Top and bottom of the fuselage',
    what: 'Blade antennas for the two VHF communication radios.',
    how: 'One blade on top of the cabin and one underneath, one for each COM radio in the G1000 system. The navigation (VOR/LOC/GS) antennas are separate; their position depends on the installation.',
    notes: ['Check blades are secure and undamaged.'],
  },
  {
    id: 'gps-antennas', category: 'antennas', name: 'GPS Antennas', where: 'Top of the cabin, behind the canopy',
    what: 'Receive satellite signals for the G1000 GPS receivers (and the WAAS/SBAS augmentation on most aircraft).',
    how: 'Two low-profile antennas, one for each GPS/NAV/COM unit. On the G1000 NXi they also support features like ADS-B In where fitted.',
    notes: ['Keep them clean. Damage or a missing antenna can disable GPS approaches.'],
  },
  {
    id: 'transponder-dme', category: 'antennas', name: 'Transponder & DME Antennas', where: 'Under the fuselage',
    what: 'Small blades for the transponder (Mode S, often with ADS-B Out) and DME if fitted.',
    how: 'The transponder replies to radar and TCAS interrogations. DME measures slant range to ground stations.',
    notes: ['Check they are secure: belly antennas collect debris and damage on rough fields.'],
  },
  {
    id: 'elt-antenna', category: 'antennas', name: 'ELT Antenna', where: 'Top of the tail boom',
    what: 'Antenna for the emergency locator transmitter, which transmits on 406 MHz (and 121.5 MHz for homing) after a crash.',
    how: 'The ELT activates automatically on impact or manually from its remote switch. The antenna is connected to the transmitter in the aft fuselage.',
    notes: ['Check the antenna is secure. ELT tests are only allowed at the times your regulations permit.'],
  },

  // ---------------------------------------------------------------- Ice protection (optional)
  {
    id: 'tks-system', category: 'ice', name: 'TKS Ice Protection (optional)', where: 'Leading edges of wings, stabilizer and fin',
    what: 'An optional fluid ice protection system. With the approved installation (design change OÄM 42-054 on earlier models) the DA42 can be approved for flight into known icing.',
    how: 'A pump sends glycol-based fluid from a tank to porous titanium panels on the leading edges. The fluid weeps through laser-drilled holes and flows back over the surface, preventing ice from forming and shedding light ice. Slinger rings on the propellers and a windshield spray protect those areas.',
    notes: [
      'Many training aircraft are not fitted with it. Without an approved system, flight into known icing is prohibited.',
      'Check fluid quantity and that the panels are undamaged and not blocked. Fluid endurance limits how long you can stay in icing.',
    ],
  },
  {
    id: 'ice-light', category: 'ice', name: 'Ice Inspection Light', where: 'Left fuselage side, aimed at the left wing',
    what: 'Lights the left wing leading edge at night so the pilot can see ice building up.',
    how: 'Usually fitted with the ice protection system. Switched on from the lighting panel.',
    notes: ['Check it works before a night flight where icing is possible.'],
    tryIt: [{ label: 'Ice light', toggle: 'light.ice' }],
  },

  // ---------------------------------------------------------------- Electrical
  {
    id: 'external-power', category: 'electrical', name: 'External Power Receptacle', where: 'Rear fuselage (left side shown)',
    what: 'A socket for connecting a ground power unit for starting or ground checks.',
    how: 'The 28 V DC system is normally powered by the two engine-driven alternators, with a main battery. The NG also has backup batteries that keep each engine\'s ECUs powered if the main supply is lost. External power feeds the main bus through a relay. The receptacle position varies with the installation.',
    notes: [
      'Disconnect ground power and close the cover before taxi.',
      'Follow the AFM for starting with external power and battery limits.',
    ],
  },
  {
    id: 'static-dischargers', category: 'electrical', name: 'Static Dischargers', where: 'Trailing edges of ailerons, elevator, rudder and wing tips',
    what: 'Thin wicks that bleed static electricity off the airframe into the air.',
    how: 'Static charge builds up in flight through precipitation and dust. The wicks discharge it gradually, reducing radio interference. Composite structure has conductive layers and bonding to carry the charge to them.',
    notes: ['A missing wick can increase radio noise: check them on the walkaround.'],
  },
];

// Preferred camera direction when focusing a part (x forward, y up, z right; left side is -z).
const VIEWS = {
  aileron: [-0.5, 0.8, -0.4],
  elevator: [-0.6, 0.6, -0.5],
  'elevator-trim-tab': [-0.7, 0.6, -0.4],
  rudder: [-0.7, 0.25, -0.6],
  'rudder-trim-tab': [-0.7, 0.15, -0.6],
  flaps: [-0.6, 0.7, -0.45],
  'horizontal-stabilizer': [-0.5, 0.6, -0.6],
  'main-gear': [0.4, -0.05, -1],
  'nose-gear': [0.6, 0.02, -1],
  'gear-doors': [0.3, -0.3, -1],
  'wheel-brakes': [0.2, 0.0, 1],
  engine: [0.8, 0.3, -0.6],
  propeller: [1, 0.2, -0.4],
  'engine-inlets': [1, -0.1, -0.35],
  exhaust: [0.1, -0.2, -1],
  'cowling-access': [0.4, 1, -0.4],
  nacelle: [-0.3, 0.5, -1],
  'main-fuel-tanks': [0.2, 1, -0.5],
  'aux-fuel-tanks': [-0.1, 1, -0.5],
  'fuel-drains': [0.3, -0.7, -0.6],
  'fuel-vents': [0.3, -0.7, -0.6],
  fuselage: [0.2, 0.35, -1],
  wing: [0.1, 1, -0.35],
  winglets: [0.4, 0.3, -1],
  'vertical-fin': [-0.2, 0.3, -1],
  'tail-skid': [-0.3, -0.1, -1],
  'front-canopy': [0.5, 0.6, -0.8],
  'rear-door': [0.1, 0.3, -1],
  'nose-baggage': [0.5, 0.3, -1],
  'tie-downs': [0.2, -0.6, -0.8],
  'nav-lights': [0.6, 0.3, -0.8],
  'strobe-lights': [0.6, 0.3, -0.8],
  'landing-light': [1, -0.5, -0.4],
  'taxi-light': [1, -0.5, 0.4],
  'pitot-static': [0.6, -0.4, -0.8],
  'stall-warning': [1, 0.15, -0.5],
  'com-antennas': [0.2, 0.6, -1],
  'gps-antennas': [0.1, 1, -0.4],
  'transponder-dme': [0.2, -0.7, -1],
  'elt-antenna': [-0.2, 0.6, -1],
  'tks-system': [0.8, 0.4, -0.6],
  'ice-light': [0.4, 0.2, -1],
  'external-power': [0, 0.1, -1],
  'static-dischargers': [-0.7, 0.6, -0.4],
};
for (const p of parts) if (!p.view && VIEWS[p.id]) p.view = VIEWS[p.id];

export const meta = {
  id: 'da42',
  name: 'Diamond DA42',
  family: 'DA42 Twin Star',
  short: 'DA42 NG',
  disclaimer: 'Study aid only · Not affiliated with or endorsed by Diamond Aircraft · Always use the approved AFM and your ATO\'s procedures',
  specs: [
    ['Length', '8.56 m'],
    ['Wingspan', '13.42 m'],
    ['Height', '2.49 m'],
    ['MTOM', '1,900 kg (1,999 kg -VI)'],
    ['Fuel', '189 L usable (+100 L aux)'],
    ['Seats', '4'],
    ['Engines', '2 × AE300, 168 hp'],
    ['VNE', '188 KIAS'],
    ['Ceiling', '18,000 ft'],
  ],
};
