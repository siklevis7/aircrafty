// Preflight exterior inspection (walkaround) for the DA42 NG.
// The flow follows the usual DA42 AFM order: brief cabin checks, then clockwise around the
// aircraft from the left wing root. Checks are paraphrased and generic: always use the approved
// AFM for the aircraft and your training organisation's checklist.
//
// Coordinates are world meters: +x forward (nose tip at x = 3.0), +y up, +z right wing.
// `at` is where the pilot stands [x, z]; `eye` overrides the 1.7 m eye height; `look` is the target.

export const walkaround = {
  title: 'Preflight inspection',
  intro: 'Start with a short cabin check, then walk clockwise from the left wing root: left wing, left engine, nose, right engine, right wing and the tail.',
  disclaimer: 'Generic study flow. The approved AFM checklist, your ATO\'s procedures and the aircraft\'s condition take precedence.',
  cameraBack: 1.6,
  stations: [
    {
      id: 'cabin', title: 'Cabin checks', at: [1.9, -2.9], look: [0.3, 1.3, 0],
      parts: ['front-canopy', 'rear-door', 'flaps'],
      items: [
        'Required documents on board; mass and balance within limits',
        'Both ENGINE MASTER switches OFF, gear lever DOWN, emergency gear handle stowed',
        'Electrical master ON briefly: fuel quantity, flap operation and position lights, DOOR warning; then master OFF',
        'Canopy and rear door glass clean and undamaged, locks working',
        'Loose items and baggage secured, control locks removed',
      ],
    },
    {
      id: 'left-fuselage', title: 'Left rear fuselage & door', at: [-1.6, -3.2], look: [-0.9, 1.05, -0.4],
      parts: ['rear-door', 'fuselage', 'external-power', 'wing'],
      items: [
        'Rear door, hinges and gas strut undamaged',
        'Fuselage skin free of cracks, dents or delamination',
        'External power cover closed (or ground power disconnected before start)',
        'Walkway on the stub wing clean',
      ],
    },
    {
      id: 'left-te', title: 'Left flaps & aileron', at: [-3.6, -4.6], look: [-1.1, 0.9, -3.9],
      parts: ['flaps', 'aileron', 'static-dischargers'],
      items: [
        'Flaps: condition, hinges and actuator fairings secure',
        'Aileron: free movement, hinges and push-rod connection secure',
        'Static dischargers in place',
        'No damage to the wing trailing edge',
      ],
    },
    {
      id: 'left-tip', title: 'Left wingtip', at: [-0.6, -8.8], look: [-0.2, 1.1, -6.4],
      parts: ['winglets', 'nav-lights', 'strobe-lights'],
      items: [
        'Winglet and wingtip undamaged',
        'Position and strobe light lenses intact',
      ],
    },
    {
      id: 'left-le', title: 'Left wing leading edge & underside', at: [3.2, -4.8], look: [0.4, 0.9, -3.7],
      parts: ['wing', 'pitot-static', 'stall-warning', 'main-fuel-tanks', 'fuel-vents', 'tie-downs', 'tks-system'],
      items: [
        'Leading edge free of dents and ice protection panels undamaged (if fitted)',
        'Pitot-static probe: cover removed, openings clear',
        'Stall warning opening clear; test as the AFM describes',
        'Fuel quantity checked visually, filler cap closed and locked',
        'Fuel vent clear, tie-down removed',
      ],
    },
    {
      id: 'left-gear', title: 'Left main gear', at: [1.4, -3.0], eye: 0.55, look: [-0.4, 0.5, -1.45],
      parts: ['main-gear', 'wheel-brakes', 'gear-doors', 'fuel-drains'],
      items: [
        'Tyre: inflation, cuts and wear; chock removed',
        'Shock absorber and trailing link undamaged, no fluid leaks',
        'Brake disc, pads and lines secure, no leaks',
        'Gear door and bay clear and secure',
        'Fuel drains: samples taken, no water or contamination',
      ],
    },
    {
      id: 'left-engine', title: 'Left engine & propeller', at: [3.8, -3.4], look: [1.4, 1.15, -1.72],
      parts: ['engine', 'propeller', 'engine-inlets', 'exhaust', 'cowling-access', 'nacelle', 'aux-fuel-tanks'],
      items: [
        'Engine oil, coolant and gearbox oil levels checked, access doors latched',
        'Cowling secure, no oil or fuel leaks, exhaust stack secure',
        'Air inlets clear of covers, nests and debris',
        'Propeller blades free of nicks and cracks, spinner secure',
        'Auxiliary tank cap closed and locked (if fitted)',
      ],
    },
    {
      id: 'nose', title: 'Nose & baggage compartment', at: [4.8, -1.6], look: [2.0, 0.95, 0],
      parts: ['nose-baggage', 'fuselage', 'front-canopy'],
      items: [
        'Nose baggage: contents secured, both doors closed and locked',
        'Nose skin free of damage',
        'Windscreen clean and undamaged',
      ],
    },
    {
      id: 'nose-gear', title: 'Nose gear & belly lights', at: [3.6, -1.9], eye: 0.6, look: [1.7, 0.45, 0],
      parts: ['nose-gear', 'gear-doors', 'landing-light', 'taxi-light'],
      items: [
        'Nose tyre condition and inflation; tow bar removed',
        'Shock strut extension normal, steering linkage secure',
        'Nose gear doors and hinges secure',
        'Landing and taxi light lenses intact',
      ],
    },
    {
      id: 'right-engine', title: 'Right engine & propeller', at: [3.8, 3.4], look: [1.4, 1.15, 1.72],
      parts: ['engine', 'propeller', 'engine-inlets', 'exhaust', 'cowling-access', 'nacelle', 'aux-fuel-tanks'],
      items: [
        'Engine oil, coolant and gearbox oil levels checked, access doors latched',
        'Cowling secure, no leaks, exhaust stack secure',
        'Air inlets clear',
        'Propeller and spinner undamaged',
        'Auxiliary tank cap closed and locked (if fitted)',
      ],
    },
    {
      id: 'right-gear', title: 'Right main gear', at: [1.4, 3.0], eye: 0.55, look: [-0.4, 0.5, 1.45],
      parts: ['main-gear', 'wheel-brakes', 'gear-doors', 'fuel-drains'],
      items: [
        'Tyre, shock absorber and trailing link condition',
        'Brakes and lines, no leaks',
        'Gear door secure',
        'Fuel drains sampled',
      ],
    },
    {
      id: 'right-le', title: 'Right wing leading edge & underside', at: [3.2, 4.8], look: [0.4, 0.9, 3.7],
      parts: ['wing', 'main-fuel-tanks', 'fuel-vents', 'tie-downs', 'tks-system'],
      items: [
        'Leading edge and ice protection panels (if fitted) undamaged',
        'Fuel quantity checked visually, filler cap closed and locked',
        'Fuel vent clear, tie-down removed',
      ],
    },
    {
      id: 'right-tip', title: 'Right wingtip', at: [-0.6, 8.8], look: [-0.2, 1.1, 6.4],
      parts: ['winglets', 'nav-lights', 'strobe-lights'],
      items: ['Winglet undamaged', 'Position and strobe light lenses intact'],
    },
    {
      id: 'right-te', title: 'Right flaps & aileron', at: [-3.6, 4.6], look: [-1.1, 0.9, 3.9],
      parts: ['flaps', 'aileron', 'static-dischargers'],
      items: [
        'Aileron free movement and secure',
        'Flaps and hinges undamaged',
        'Static dischargers in place',
      ],
    },
    {
      id: 'right-fuselage', title: 'Right fuselage & antennas', at: [-1.9, 3.2], look: [-1.0, 1.05, 0.3],
      parts: ['fuselage', 'com-antennas', 'gps-antennas', 'transponder-dme'],
      items: [
        'Fuselage skin and right rear window undamaged',
        'Antennas on top and underneath secure',
      ],
    },
    {
      id: 'empennage', title: 'Empennage', at: [-7.4, -2.4], look: [-4.6, 1.6, 0],
      parts: ['vertical-fin', 'rudder', 'rudder-trim-tab', 'horizontal-stabilizer', 'elevator', 'elevator-trim-tab', 'tail-skid', 'elt-antenna'],
      items: [
        'Fin and stabilizer undamaged, attachment fairing secure',
        'Elevator and rudder: free movement, hinges secure',
        'Trim tabs secure, no excessive play',
        'Tail skid and ventral fin: no strike marks; tail tie-down removed',
        'ELT antenna secure',
      ],
    },
  ],
};
