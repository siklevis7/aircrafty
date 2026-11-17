# AirCrafty

Interactive 3D aircraft explorer for type-rating students. v1 covers the exterior of the Boeing 737-800 (NG).

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

## What's in v1

- A stylized 3D 737-800 built in code, where every component can be clicked (46 parts in 9 categories)
- An info panel for each part: what it does, how it works, study notes, "try it" buttons
- Working controls: flap lever (with LE device scheduling), gear lever with sequence and indicator lights, speed brake (ARMED auto-deploy on touchdown), wheel/column/rudder/stab trim, reversers, APU, doors, all exterior lights
- Realistic interlocks, e.g. the gear lever lock on the ground, reversers only on the ground, no doors in flight
- Progress is saved locally in the browser, plus search, hotspots, isolate mode, camera views and a light/dark theme

## Content

Content is researched from public sources and describes the most common configuration across operators,
with notable variants mentioned in the text. It's a study aid: operator documents (FCOM, QRH, SOP) always take precedence.
Part data lives in `src/aircraft/b738/parts.js`.

### Sources

Figures are checked against Boeing's public documents wherever they cover the topic:

- Boeing, *737 Airplane Characteristics for Airport Planning*, D6-58325-7 Rev C (Oct 2025): dimensions, ground clearances, weights, fuel, seating, cargo volume, engine models
- Boeing, *Commercial Airplanes Reference Guide*: cargo hold volumes
- FAA/Boeing *B-737 Master Minimum Equipment List*, Rev 63 (Apr 2026): equipment counts and configurations (slats, window heat, feel pitots, landing-light variants, speedbrake load alleviation)

Systems logic that Boeing only publishes in the FCOM, which isn't public, comes from widely corroborated training references.
The model itself is stylized. Its overall dimensions and ground clearances follow the Boeing data.

## Adding another aircraft

1. Copy `src/aircraft/b738/` to a new folder, e.g. `src/aircraft/a320/`.
2. Its `index.js` must export the same shape: `meta`, `parts`, `categories`, `controlPanel`, `build()`, `camera`.
3. Register it in `src/aircraft/registry.js`.

The viewer (`src/core/`) and the UI (`src/ui/`) don't depend on any particular aircraft.
