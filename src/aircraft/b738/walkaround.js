// Exterior inspection (walkaround) for the 737-800.
// The sequence follows Boeing's FCOM exterior inspection flow as reproduced in
// widely used training material. Checks are paraphrased and generic: always
// follow your operator's approved procedure.
//
// Coordinates are world meters: +x forward (nose at x ≈ 19.75), +y up, +z right wing.
// `at` is where the pilot stands [x, z]; `eye` overrides the 1.7 m eye height.

export const walkaround = {
  title: 'Exterior inspection',
  intro: 'Walk the aircraft clockwise from the left forward fuselage, the way the Boeing exterior inspection flows. At each stop, check the items, then move on.',
  disclaimer: 'Generic study flow. Your operator\'s procedure and the aircraft\'s condition take precedence.',
  stations: [
    {
      id: 'left-fwd-fuselage', title: 'Left forward fuselage', at: [13.5, -5.2], look: [14.5, 2.7, -1.6],
      parts: ['pitot-probes', 'aoa-vanes', 'tat-probe', 'static-ports', 'forward-entry-door'],
      items: [
        'Captain\'s pitot probe and AOA vane: covers removed, undamaged, unobstructed',
        'TAT probe undamaged',
        'Static ports clean and undamaged, with no skin damage nearby',
        'L1 door and access panels not in use are latched',
        'No fluid leaks or skin damage',
      ],
    },
    {
      id: 'nose', title: 'Nose', at: [26, -2], look: [17.5, 2.6, 0],
      parts: ['radome', 'flight-deck-windows'],
      items: [
        'Radome: no cracks, dents or lightning strike marks, latches secure',
        'Lightning diverter strips intact',
        'Windshield and wipers undamaged',
        'Forward electronic-equipment (E&E) access door closed',
      ],
    },
    {
      id: 'nose-wheel-well', title: 'Nose gear & wheel well', at: [18.2, -2.6], eye: 1.35, look: [15.2, 1.0, 0],
      parts: ['nose-gear', 'taxi-light'],
      items: [
        'Tires: no cuts, bulges or excessive wear',
        'Strut extension looks normal, with no hydraulic leaks',
        'Steering lockout pin as required for towing (per operator)',
        'Gear doors and linkages secure',
        'Taxi light undamaged, wheel well clear of debris',
      ],
    },
    {
      id: 'right-fwd-fuselage', title: 'Right forward fuselage', at: [13.5, 5.2], look: [14.5, 2.7, 1.6],
      parts: ['pitot-probes', 'aoa-vanes', 'static-ports', 'service-doors', 'forward-cargo-door'],
      items: [
        'First Officer\'s and auxiliary pitot probes, and AOA vane: clear and undamaged',
        'Static ports, including the alternate static port, clean',
        'Crew oxygen overboard discharge (green) disc in place',
        'R1 door and forward cargo door secure when loading is complete',
        'Access panels latched',
      ],
    },
    {
      id: 'right-wing-root', title: 'Right wing root, pack & lower fuselage', at: [5, 5.6], look: [3, 1.6, 2.2],
      parts: ['wing-body-fairing', 'landing-lights', 'runway-turnoff-lights', 'krueger-flaps', 'vhf-antennas', 'tcas-antennas'],
      items: [
        'Landing and runway turnoff lights undamaged',
        'Pack ram-air inlet and exhaust clear',
        'Krueger flaps undamaged',
        'Lower fuselage antennas undamaged',
        'No fuel, hydraulic or water leaks',
      ],
    },
    {
      id: 'engine-2', title: 'Number 2 engine', at: [9.5, 6.6], look: [5.5, 1.5, 4.9],
      parts: ['engine', 'thrust-reverser', 'pylon'],
      items: [
        'Inlet and fan blades: no damage or foreign objects',
        'Cowl panels and latches closed',
        'Thrust reverser sleeves stowed',
        'Exhaust nozzle and plug undamaged',
        'No fuel or oil leaks under the engine, and the strut is secure',
      ],
    },
    {
      id: 'right-wing-le', title: 'Right wing & leading edge', at: [1, 12], look: [-1.6, 2.6, 11],
      parts: ['wing', 'le-slats'],
      items: [
        'Leading-edge slats undamaged',
        'Wing surfaces free of ice, snow and frost',
        'Fueling panel closed and fuel measuring sticks flush',
        'Fuel vent clear, with no fuel leaks',
      ],
    },
    {
      id: 'right-wingtip-te', title: 'Right wing tip & trailing edge', at: [-6.2, 19.6], look: [-3.8, 3.3, 16],
      parts: ['winglet', 'nav-lights', 'strobe-lights', 'aileron', 'trailing-edge-flaps', 'flight-spoilers', 'ground-spoilers'],
      items: [
        'Green position light, white tail light and strobe undamaged',
        'Winglet undamaged',
        'Static dischargers in place',
        'Aileron, trailing-edge flaps and spoilers undamaged',
      ],
    },
    {
      id: 'right-main-gear', title: 'Right main gear', at: [-1.6, 4.4], eye: 1.45, look: [0.35, 0.7, 2.86],
      parts: ['main-gear'],
      items: [
        'Tires: no cuts, bulges or excessive wear',
        'Brakes and wheels undamaged, with brake wear indicator pins extending (parking brake set)',
        'Strut extension normal, with no hydraulic leaks',
        'Gear down-lock pin per operator procedure',
      ],
    },
    {
      id: 'main-wheel-well', title: 'Main wheel well', at: [-0.8, 3.7], eye: 1.05, look: [0.4, 1.7, 1.4],
      parts: ['main-gear', 'wing-body-fairing'],
      items: [
        'General condition good, nothing loose',
        'Hydraulic components free of leaks',
        'Wheel well clear of debris',
      ],
    },
    {
      id: 'right-aft-fuselage', title: 'Right aft fuselage', at: [-8, 5.4], look: [-8.5, 2.4, 1.5],
      parts: ['aft-cargo-door', 'service-doors', 'overwing-exits', 'beacon-lights'],
      items: [
        'Overwing exits flush',
        'Aft cargo door and R2 door secure when servicing is complete',
        'Outflow valve open on the ground',
        'Lower anti-collision beacon undamaged',
        'Drain masts undamaged, access panels latched',
      ],
    },
    {
      id: 'tail', title: 'Tail', at: [-27, 4], look: [-16.5, 4.6, 0],
      parts: ['vertical-fin', 'rudder', 'horizontal-stabilizer', 'elevator', 'apu', 'elevator-feel-pitots', 'logo-lights', 'tail-skid'],
      items: [
        'Vertical fin, rudder, stabilizer and elevators undamaged',
        'Static dischargers in place',
        'Elevator feel pitot probes clear',
        'APU air inlet and exhaust clear',
        'Tail skid undamaged (cartridge indicator normal)',
        'Tail cone strobe undamaged',
      ],
    },
    {
      id: 'left-aft-fuselage', title: 'Left aft fuselage', at: [-8, -5.4], look: [-8.5, 2.6, -1.5],
      parts: ['aft-entry-door', 'overwing-exits', 'vhf-antennas'],
      items: [
        'L2 door secure when servicing is complete',
        'Overwing exits flush',
        'Antennas undamaged',
        'Access panels latched, no skin damage',
      ],
    },
    {
      id: 'left-main-gear', title: 'Left main gear', at: [-1.6, -4.4], eye: 1.45, look: [0.35, 0.7, -2.86],
      parts: ['main-gear'],
      items: [
        'Tires: no cuts, bulges or excessive wear',
        'Brakes and wheels undamaged, with brake wear indicator pins extending (parking brake set)',
        'Strut extension normal, with no hydraulic leaks',
        'Gear down-lock pin per operator procedure',
      ],
    },
    {
      id: 'left-wingtip-te', title: 'Left wing tip & trailing edge', at: [-6.2, -19.6], look: [-3.8, 3.3, -16],
      parts: ['winglet', 'nav-lights', 'strobe-lights', 'aileron', 'trailing-edge-flaps', 'flight-spoilers', 'ground-spoilers'],
      items: [
        'Red position light, white tail light and strobe undamaged',
        'Winglet undamaged',
        'Static dischargers in place',
        'Aileron, trailing-edge flaps and spoilers undamaged',
      ],
    },
    {
      id: 'left-wing-le', title: 'Left wing & leading edge', at: [1, -12], look: [-1.6, 2.6, -11],
      parts: ['wing', 'le-slats', 'wing-lights'],
      items: [
        'Leading-edge slats undamaged',
        'Wing surfaces free of ice, snow and frost',
        'Fuel measuring sticks flush, fuel vent clear',
        'Wing illumination light undamaged',
      ],
    },
    {
      id: 'engine-1', title: 'Number 1 engine', at: [9.5, -6.6], look: [5.5, 1.5, -4.9],
      parts: ['engine', 'thrust-reverser', 'pylon'],
      items: [
        'Inlet and fan blades: no damage or foreign objects',
        'Cowl panels and latches closed',
        'Thrust reverser sleeves stowed',
        'Exhaust nozzle and plug undamaged',
        'No fuel or oil leaks under the engine, and the strut is secure',
      ],
    },
    {
      id: 'left-wing-root', title: 'Left wing root, pack & lower fuselage', at: [5, -5.6], look: [3, 1.6, -2.2],
      parts: ['wing-body-fairing', 'landing-lights', 'runway-turnoff-lights', 'krueger-flaps', 'beacon-lights'],
      items: [
        'Landing and runway turnoff lights undamaged',
        'Pack ram-air inlet and exhaust clear',
        'Krueger flaps undamaged',
        'No fuel, hydraulic or water leaks',
      ],
    },
  ],
};
