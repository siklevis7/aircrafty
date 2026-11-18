// 737-800 (NG) cabin & emergency equipment zones. Same shape as the other parts lists.
// Equipment fit and stowage locations VARY BY OPERATOR: "typical location" describes a
// common arrangement only. Your operator's manuals and aircraft placards take precedence.

export const cabinCategories = [
  { id: 'cab-exits', label: 'Exits & Slides' },
  { id: 'cab-emergency', label: 'Emergency Equipment' },
  { id: 'cab-oxygen', label: 'Oxygen' },
  { id: 'cab-lighting', label: 'Lighting' },
  { id: 'cab-galley-lav', label: 'Galleys & Lavatories' },
  { id: 'cab-cabin', label: 'Cabin' },
];

// focus directions (from the item toward the camera)
const FROM_AISLE_L = [0.35, 0.25, 1]; // items on the left wall
const FROM_AISLE_R = [0.35, 0.25, -1]; // items on the right wall
const FROM_AFT = [-1, 0.2, 0.1]; // items facing aft (forward bulkhead / galley fronts facing aft)
const FROM_FWD = [1, 0.22, 0.05]; // items facing forward

const doorsTry = [{ label: 'Open / close cabin doors', toggle: 'doors' }];

export const cabinParts = [
  // ------------------------------------------------------------------ Exits & slides
  {
    id: 'cab-door-l1', category: 'cab-exits', name: 'Forward Entry Door (L1)', where: 'Left side, just aft of the flight deck',
    what: 'The main boarding door. Like all four cabin doors it is a plug-type door with an escape slide packed in a bustle at its lower edge.',
    how: 'Rotating the inside handle first moves the door inward to clear its stops, then it swings outward and forward to lie against the fuselage. Each door has a viewing window, an assist handle, the slide bustle with its girt bar and pressure gauge, and an instruction placard. If the girt bar is attached to the floor brackets, opening the door deploys the slide.',
    notes: [
      'Left doors are the entry doors, right doors are the service doors.',
      'Plug design: cabin pressure holds the door against its stops, so it cannot be opened against a significant pressure differential.',
      'The door opening and closing in this model follow the "Doors open" switch (ground only).',
    ],
    tryIt: doorsTry,
    view: [0, 0.15, 1],
  },
  {
    id: 'cab-door-r1', category: 'cab-exits', name: 'Forward Service Door (R1)', where: 'Right side, opposite L1',
    what: 'Galley servicing door used for catering; also an emergency exit with its own slide.',
    how: 'Operates like the entry doors: handle, plug-type motion, viewing window, assist handle, slide bustle and girt bar. The service doors are slightly smaller than the entry doors.',
    notes: ['Check the door is disarmed before opening it for catering, and armed for flight per operator procedure.'],
    tryIt: doorsTry,
    view: [0, 0.15, -1],
  },
  {
    id: 'cab-doors-aft', category: 'cab-exits', name: 'Aft Entry & Service Doors (L2 / R2)', where: 'Aft cabin, either side of the aft galley',
    what: 'The aft entry door (L2, left) and aft service door (R2, right). Both are emergency exits with escape slides.',
    how: 'Same operation as the forward doors. The aft attendant station and jumpseat are typically next to L2.',
    notes: ['The DOORS master caution and individual door lights on the flight deck show doors that are not closed and locked.'],
    tryIt: doorsTry,
    view: [-0.35, 0.15, 1],
  },
  {
    id: 'cab-slide', category: 'cab-exits', name: 'Escape Slide & Girt Bar', where: 'Bustle at the bottom of each cabin door',
    what: 'A packed, inflatable single-lane slide on each of the four cabin doors, attached to the aircraft through the girt bar.',
    how: 'Armed: the girt bar is fitted in the floor brackets, so opening the door pulls the slide out of the bustle and it inflates automatically from its gas bottle. Disarmed: the girt bar sits in stowage hooks on the door and the slide stays in the bustle. If the slide does not inflate, the manual inflation handle at the girt end starts it. A detachment handle separates the slide from the aircraft.',
    notes: [
      'A red warning strap across the door window signals to anyone outside that the door is armed (shown here when the door is armed).',
      'An armed door can deploy its slide even when opened from outside: ground staff must coordinate with the cabin crew.',
      'Check the slide pressure gauge is in the green band during preflight, per operator procedure.',
      'The overwing exits have no slides: passengers leave over the wing trailing edge.',
    ],
    view: [-0.4, 0.5, 1],
  },
  {
    id: 'cab-overwing-exits', category: 'cab-exits', name: 'Overwing Exits', where: 'Two per side over the wing (737-800)',
    what: 'Four Type III overwing emergency exits on the -800 (two on the -700). On the NG they are self-disposing hatches.',
    how: 'Pulling the handle at the top of the hatch releases it; a counterbalance spring then swings the hatch up and out, hinged at its top edge, so it does not have to be lifted into the cabin. Passengers step onto the wing and leave aft over the trailing edge (flaps extended).',
    notes: [
      'Flight locks engage automatically for takeoff and flight, for example when engines are running or the air/ground system senses air (logic simplified here).',
      'DOORS master caution lights if an overwing exit is not fully closed or a flight lock fails to lock.',
      'Exit-row seating rules and passenger briefings are operator procedures.',
    ],
    view: [0.05, 0.35, 1],
  },
  {
    id: 'cab-cockpit-door', category: 'cab-exits', name: 'Flight Deck Door', where: 'Forward bulkhead, cabin centerline',
    what: 'The reinforced flight deck door, built to resist intrusion and ballistic penetration.',
    how: 'It has an electric lock, a deadbolt, a viewing lens and decompression panels that open on rapid decompression. The crew controls it from the flight deck lock selector. A keypad in the cabin lets the crew request access; an emergency access code starts a timed sequence that the pilots can deny.',
    notes: [
      'Door control procedures, code use and timings are operator-specific security items: follow your operator\'s procedures.',
    ],
    view: FROM_AFT,
  },

  // ------------------------------------------------------------------ Emergency equipment
  {
    id: 'cab-halon', category: 'cab-emergency', name: 'Halon Fire Extinguisher', where: 'Typical location: bracket near the forward and aft attendant stations',
    what: 'Portable halon extinguisher for cabin fires, including electrical and flammable-liquid fires.',
    how: 'Remove from its bracket, check the pressure gauge or seal, pull the safety pin, aim at the base of the fire from a safe distance and squeeze the handle in short bursts. Halon interrupts the chemical reaction of combustion.',
    notes: [
      'Halon displaces breathable air in confined spaces: wear a PBE when fighting a fire in a confined area.',
      'Quantities and locations are set by the operator\'s equipment fit; check the cabin equipment chart.',
    ],
    view: [-1, 0.2, -0.45],
  },
  {
    id: 'cab-water-ext', category: 'cab-emergency', name: 'Water Fire Extinguisher', where: 'Typical location: bracket in the aft cabin or galley area',
    what: 'Water-based extinguisher (usually with antifreeze) for ordinary combustible fires: paper, fabric, seat cushions.',
    how: 'Activate as placarded, then aim at the base of the fire. Water cools and soaks material, which helps stop smouldering fires re-igniting. Often used after halon to soak the burnt material.',
    notes: ['Not for electrical or flammable-liquid fires.'],
    view: FROM_AFT,
  },
  {
    id: 'cab-pbe', category: 'cab-emergency', name: 'PBE / Smoke Hood', where: 'Typical location: sealed container near each attendant station and fire extinguisher',
    what: 'Protective Breathing Equipment: a hood with its own oxygen supply that protects the eyes and lungs from smoke and fumes while fighting a fire.',
    how: 'Open the sealed container, pull the hood over the head so the neck seal closes, and start the oxygen supply as placarded. Typical units give roughly 15 minutes of protection.',
    notes: [
      'Check the seal or condition indicator during the preflight check; a damaged seal means the unit may not be serviceable.',
      'Remove it away from the fire once the oxygen supply ends, because the hood gets hot and stuffy.',
    ],
    view: FROM_AFT,
  },
  {
    id: 'cab-first-aid', category: 'cab-emergency', name: 'First Aid & Medical Kits', where: 'Typical location: placarded overhead bins or galley stowage',
    what: 'First aid kits for minor injuries and an emergency medical kit with drugs and equipment for use by a medical professional. Many operators also carry an AED.',
    how: 'Stowage is shown by placards on the bin or compartment. The number of first aid kits depends on passenger seating capacity under the applicable regulations.',
    notes: ['Medical kit use and ground medical support are operator procedures.'],
    view: FROM_AISLE_L,
  },
  {
    id: 'cab-megaphone', category: 'cab-emergency', name: 'Megaphones', where: 'Typical location: galley stowage or overhead bin near an exit',
    what: 'Battery-powered portable megaphones for commanding an evacuation when the PA is unavailable.',
    how: 'Squeeze the trigger and speak into the mouthpiece. Under FAA rules an aircraft with more than 99 passenger seats carries two (one with 60 to 99 seats); other authorities have similar rules.',
    notes: ['Typically one forward and one aft so crew at both ends can use them.'],
    view: FROM_AFT,
  },
  {
    id: 'cab-flashlight', category: 'cab-emergency', name: 'Flashlights', where: 'Typical location: bracket at each flight attendant jumpseat',
    what: 'Emergency flashlights for each attendant station, for evacuation, smoke and power loss.',
    how: 'Removing the light from its bracket typically switches it on. A small indicator on the bracket or light flashes to show the battery is good.',
    notes: ['Check the charge indicator during the preflight equipment check.'],
    view: [-1, 0.45, 0.1],
  },
  {
    id: 'cab-life-vests', category: 'cab-emergency', name: 'Life Vests', where: 'Pouch under (or between) each passenger seat; crew vests at the jumpseats',
    what: 'Inflatable life preservers for every occupant, carried for overwater operations.',
    how: 'Put on over the head and fasten the straps. Inflate by pulling the tabs, which fire the gas cartridges; oral inflation tubes top it up. A light activates on contact with water. Inflate only when leaving the aircraft, so it does not hinder movement or get punctured inside the cabin.',
    notes: ['Infant and crew vests are often a different colour. Required equipment depends on the route and regulations.'],
    view: [1, 0.05, 0.2],
  },
  {
    id: 'cab-elt', category: 'cab-emergency', name: 'Emergency Locator Transmitter', where: 'Typical location: fixed unit above the aft cabin ceiling',
    what: 'Transmits a distress signal (406 MHz to the satellite system, plus 121.5 MHz homing) after a crash so search and rescue can find the aircraft.',
    how: 'The fixed ELT activates automatically on a high g impact and can be switched on manually from the flight deck. Some operators also carry a portable or survival ELT in the cabin.',
    notes: ['Exact location and the presence of a portable ELT vary by operator.'],
    view: [0.5, -0.8, 0.2],
  },

  // ------------------------------------------------------------------ Oxygen
  {
    id: 'cab-pax-oxygen', category: 'cab-oxygen', name: 'Passenger Oxygen Masks', where: 'Passenger service units above each seat row; lavatories, galleys and attendant stations',
    what: 'Chemical oxygen generators in each passenger service unit supply drop-down masks when the cabin altitude gets too high.',
    how: 'The mask doors open automatically at a cabin altitude of about 14,000 ft, or when the flight deck PASS OXY switch is selected ON. Masks drop to head height. Pulling a mask down fires the generator for that unit, which then flows for a fixed time (typically around 12 minutes, depending on the generator fitted) and cannot be stopped.',
    notes: [
      'There are more masks than seats in each row (spare masks for infants and standing crew).',
      'Generators get very hot in use and may produce a burning smell. This is normal.',
      'This model drops the masks when the oxygen system reports a deployment (PASS OXY ON or high cabin altitude).',
    ],
    tryIt: [
      { label: 'PASS OXY ON', set: { 'sw.oxy.pax': 'ON' } },
      { label: 'PASS OXY NORMAL', set: { 'sw.oxy.pax': 'NORMAL' } },
    ],
    view: [0.2, -0.35, 1],
  },
  {
    id: 'cab-portable-o2', category: 'cab-oxygen', name: 'Portable Oxygen Bottle', where: 'Typical location: brackets or placarded bins throughout the cabin',
    what: 'Portable gaseous oxygen bottles with masks, for first aid and for crew moving around the cabin when the passenger masks are in use.',
    how: 'Open the valve and plug the mask into an outlet. Bottles typically have a high-flow outlet for crew moving around or for a passenger in distress, and a low-flow outlet for first aid.',
    notes: ['Check the pressure gauge on preflight. Number and locations depend on operator fit.'],
    view: FROM_AFT,
  },

  // ------------------------------------------------------------------ Lighting
  {
    id: 'cab-emer-lights', category: 'cab-lighting', name: 'Emergency Lighting & Exit Signs', where: 'EXIT signs over doors and exits, ceiling lights along the aisle',
    what: 'Battery-backed emergency lights: illuminated EXIT signs, exit locator signs, aisle lighting, floor path marking and exterior escape-path lights.',
    how: 'Controlled by the flight deck EMERGENCY EXIT LIGHTS switch (OFF, ARMED, ON; guarded at ARMED). ARMED: lights come on automatically if DC bus 1 power is lost or AC power is turned off. ON: lights on. An attendant panel switch can also turn them on, overriding the flight deck switch. The batteries are certified for at least 10 minutes.',
    notes: [
      'NOT ARMED (amber) on the flight deck shows the switch is not in ARMED.',
      'Exit signs here light up whenever the emergency lights are on.',
    ],
    tryIt: [
      { label: 'EMER EXIT LIGHTS ON', set: { 'sw.emerlights': 'ON' } },
      { label: 'EMER EXIT LIGHTS ARMED', set: { 'sw.emerlights': 'ARMED' } },
    ],
    view: [-0.5, -0.1, 1],
  },
  {
    id: 'cab-floor-path', category: 'cab-lighting', name: 'Floor Proximity Path Marking', where: 'Along the aisle floor; red markers at the overwing exit rows',
    what: 'Floor-level escape path marking that guides occupants to the exits when smoke hides the overhead lights.',
    how: 'Either electrically lit strips powered with the emergency lights, or photoluminescent strips charged by cabin light. Red or distinct markers identify the exit rows.',
    notes: ['Type and layout depend on the aircraft fit.'],
    tryIt: [{ label: 'EMER EXIT LIGHTS ON', set: { 'sw.emerlights': 'ON' } }],
    view: [0.25, 1, 0.25],
  },
  {
    id: 'cab-cabin-lighting', category: 'cab-lighting', name: 'Cabin Lighting', where: 'Cove uplights above the bins, sidewall wash lights, entry lights',
    what: 'Normal cabin lighting: indirect ceiling and sidewall lighting, entry area lights and reading lights.',
    how: 'Controlled from the forward attendant panel (entry, window and ceiling lights, often with bright/dim and night settings). It is AC powered and goes dark if both transfer buses lose power; the emergency lights then take over if armed.',
    notes: ['In this model the cabin lights follow transfer bus power from the systems simulation.'],
    view: [0.1, 0.05, 1],
  },

  // ------------------------------------------------------------------ Galleys & lavatories
  {
    id: 'cab-galley-fwd', category: 'cab-galley-lav', name: 'Forward Galley', where: 'Forward cabin, right side around the R1 door',
    what: 'Galley units with ovens, beverage makers, trolley bays, stowage and galley circuit breakers.',
    how: 'Galley power comes from the transfer buses through the galley power switches on the flight deck, and is shed automatically when electrical load must be reduced (for example on a single generator).',
    notes: ['Trolleys and containers must be latched for taxi, takeoff and landing.', 'The galley layout is operator-specific.'],
    view: [1, 0.15, -0.35],
  },
  {
    id: 'cab-galley-aft', category: 'cab-galley-lav', name: 'Aft Galley', where: 'Aft cabin, between the L2 and R2 doors',
    what: 'The main galley on most 737-800s: trolley bays, ovens, beverage makers and stowage.',
    how: 'Same power supply and load-shed logic as the forward galley.',
    notes: ['Water and waste servicing panels on the exterior serve the galleys and lavatories.'],
    view: FROM_FWD,
  },
  {
    id: 'cab-lavatory', category: 'cab-galley-lav', name: 'Lavatories', where: 'Typically one forward (left side) and two aft',
    what: 'Lavatory modules with toilet, sink, oxygen masks, smoke detector and an automatic waste-bin extinguisher.',
    how: 'The door has an ashtray on the outside: required even though smoking is prohibited. Each lavatory has its own drop-down oxygen masks and a call button.',
    notes: ['Number and positions of lavatories vary with the cabin layout.'],
    view: [1, 0.3, 0.25],
  },
  {
    id: 'cab-lav-smoke', category: 'cab-galley-lav', name: 'Lavatory Smoke Detector', where: 'Lavatory ceiling',
    what: 'Detects smoke in the lavatory and warns the cabin crew.',
    how: 'On detecting smoke it sounds a horn and lights an alarm light on the detector; many installations also show the alarm at the attendant panel. The crew then checks the lavatory and fights any fire.',
    notes: ['Tampering with or disabling a lavatory smoke detector is prohibited.'],
    view: [1, -1, 0.3],
  },
  {
    id: 'cab-lav-bin-ext', category: 'cab-galley-lav', name: 'Waste Bin Extinguisher', where: 'Under the lavatory sink, above the waste container',
    what: 'A small automatic extinguisher that discharges into the waste bin if a fire starts there.',
    how: 'Heat-sensitive nozzle tips melt at about 77 °C (170 °F) and release the extinguishing agent into the waste container. There is no crew action to fire it. A temperature indicator shows if it has been exposed to heat.',
    notes: ['Shown here in a cutaway: it is normally hidden inside the vanity.'],
    view: [0.6, 0.4, -0.9],
  },

  // ------------------------------------------------------------------ Cabin
  {
    id: 'cab-attendant-panel', category: 'cab-cabin', name: 'Attendant Panels', where: 'Forward panel near L1; aft panel near L2',
    what: 'Cabin crew control panels for lighting, calls, interphone and the emergency exit lights.',
    how: 'The forward panel typically has entry, window and ceiling light controls, a ground service switch and a guarded emergency exit lights switch that turns the emergency lights on, overriding the flight deck switch. The aft panel typically shows lavatory smoke alerts and potable water quantity. Exact layout differs between aircraft.',
    notes: ['The layout shown here is generic, not an operator-specific panel.'],
    tryIt: [{ label: 'EMER EXIT LIGHTS ON', set: { 'sw.emerlights': 'ON' } }],
    view: [-1, 0.1, 0.6],
  },
  {
    id: 'cab-jumpseat', category: 'cab-cabin', name: 'Flight Attendant Jumpseats', where: 'Forward bulkhead next to L1; aft next to L2',
    what: 'Spring-loaded folding seats with full shoulder harnesses for the cabin crew, positioned next to the floor-level exits.',
    how: 'The seat pan folds up automatically when unoccupied to keep the exit path clear. Flashlights, PBE and other equipment are usually close by.',
    notes: ['Crew must be seated with harnesses fastened for taxi, takeoff and landing.'],
    view: [-1, 0.2, 0.6],
  },
  {
    id: 'cab-psu', category: 'cab-cabin', name: 'Passenger Service Units', where: 'Under the overhead bins above each seat row',
    what: 'Each row\'s overhead unit: reading lights and switches, attendant call button, individual air outlets, a speaker, the no-smoking and seat-belt signs, and the oxygen mask compartment.',
    how: 'The signs are controlled from the flight deck NO SMOKING and FASTEN BELTS switches (OFF, AUTO, ON). The call button chimes and lights an indicator for the cabin crew.',
    notes: ['A row of PSUs is mapped to each seat row, so seat pitch changes need the PSUs moved too.'],
    view: [0.2, -0.35, 1],
  },
  {
    id: 'cab-windows', category: 'cab-cabin', name: 'Cabin Windows & Sidewall', where: 'Both sides along the cabin; the overwing exit hatches carry their own window',
    what: 'Passenger windows set in the sidewall lining, with a sliding shade in each window reveal.',
    how: 'Each cabin window has three panes. The outer and middle panes are structural: the outer pane normally carries the pressure load and the middle pane is a fail-safe backup. The inner pane is a non-structural scratch shield. The sidewall panels are trim over the insulated fuselage skin and frames.',
    notes: [
      'The small hole in a window pane lets pressure equalize between the panes, so the outer pane takes the load in normal operation.',
      'Each cabin door also has a viewing window so the crew can check conditions outside before opening it.',
    ],
    view: FROM_AISLE_L,
  },
  {
    id: 'cab-bins', category: 'cab-cabin', name: 'Overhead Stowage Bins', where: 'Both sides along the cabin',
    what: 'Overhead bins for carry-on baggage and some emergency equipment.',
    how: 'Bins latch closed with a positive latch. Placards on the bin doors mark bins holding emergency equipment. Each bin has a placarded weight limit.',
    notes: ['Check emergency equipment bins are free of baggage during the preflight check.'],
    view: [0.25, -0.1, 1],
  },
  {
    id: 'cab-seats', category: 'cab-cabin', name: 'Passenger Seats', where: 'Typical two-class layout: 2-2 forward, 3-3 economy',
    what: 'Passenger seats with tray tables, seat pockets, armrests and life vest stowage.',
    how: 'Seats are fixed to floor tracks, so pitch can be changed. Seats beside the overwing exits often have restricted recline, and the rows ahead and behind are spaced to keep the exit passageway clear.',
    notes: ['Layouts vary widely by operator; up to 189 passengers in high-density single-class layouts on the 737-800.'],
    view: [-0.5, 0.35, 0.6],
  },
];
