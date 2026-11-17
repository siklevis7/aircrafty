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

## Adding another aircraft

1. Copy `src/aircraft/b738/` to a new folder, e.g. `src/aircraft/a320/`.
2. Its `index.js` must export the same shape: `meta`, `parts`, `categories`, `controlPanel`, `build()`, `camera`.
3. Register it in `src/aircraft/registry.js`.

The viewer (`src/core/`) and the UI (`src/ui/`) don't depend on any particular aircraft.
