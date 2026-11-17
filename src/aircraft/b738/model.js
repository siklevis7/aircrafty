// Procedural, stylized Boeing 737-800 built from real dimensions (meters).
// Axes: +x forward (nose), +y up, +z right wing. Design stations use X = meters aft of the nose.
// Every component is its own mesh tagged with userData.partId so it can be picked and animated.
import * as THREE from 'three';
import {
  DEG, lerp, clamp, gridSurface, interpStations, makePlanform, liftingPiece,
  hingeLine, makePivot, glowTexture,
} from '../../core/geometry.js';

const NOSE_X = 19.75;
const wx = (X) => NOSE_X - X;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---- Fuselage cross-sections: half-width w, half-height h, center height cY -----
const FUSE = [
  { X: 0, w: 0.02, h: 0.02, cY: 2.05 },
  { X: 0.08, w: 0.17, h: 0.16, cY: 2.05 },
  { X: 0.3, w: 0.33, h: 0.31, cY: 2.07 },
  { X: 0.7, w: 0.55, h: 0.55, cY: 2.11 },
  { X: 1.2, w: 0.78, h: 0.8, cY: 2.16 },
  { X: 1.8, w: 1.0, h: 1.05, cY: 2.23 },
  { X: 2.5, w: 1.22, h: 1.32, cY: 2.3 },
  { X: 3.3, w: 1.45, h: 1.58, cY: 2.39 },
  { X: 4.2, w: 1.65, h: 1.8, cY: 2.48 },
  { X: 5.2, w: 1.8, h: 1.94, cY: 2.56 },
  { X: 6.3, w: 1.88, h: 2.0, cY: 2.6 },
  { X: 30, w: 1.88, h: 2.0, cY: 2.6 },
  { X: 32, w: 1.8, h: 1.88, cY: 2.72 },
  { X: 34, w: 1.58, h: 1.58, cY: 2.93 },
  { X: 36, w: 1.22, h: 1.17, cY: 3.18 },
  { X: 38, w: 0.76, h: 0.72, cY: 3.42 },
  { X: 39.45, w: 0.3, h: 0.3, cY: 3.6 },
];
const fuseAt = (X) => interpStations(FUSE, 'X', X);
function fusePt(X, th, off = 0) {
  const st = fuseAt(X);
  return [wx(X), st.cY + (st.h + off) * Math.cos(th), (st.w + off) * Math.sin(th)];
}
function fuseTheta(X, Y, side) {
  const st = fuseAt(X);
  return side * Math.acos(clamp((Y - st.cY) / st.h, -1, 1));
}
const fuseSidePt = (X, Y, side, off = 0) => fusePt(X, fuseTheta(X, Y, side), off);
function fuseNormal(X, th) {
  const st = fuseAt(X);
  return V(0, Math.cos(th) / st.h, Math.sin(th) / st.w).normalize();
}

// ---- Materials (the viewer clones these per mesh) ---------------------------------
function makeMaterials() {
  const std = (o) => new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, ...o });
  return {
    fuse: std({ color: '#ffffff', vertexColors: true, roughness: 0.42, metalness: 0.05 }),
    paint: std({ color: '#f2f3f0', roughness: 0.42, metalness: 0.05 }),
    door: std({ color: '#e6e8e4', roughness: 0.45, metalness: 0.05 }),
    radome: std({ color: '#dcdfda', roughness: 0.5, metalness: 0.02 }),
    belly: std({ color: '#c2c7cc', roughness: 0.5, metalness: 0.1 }),
    wing: std({ color: '#c6ccd1', roughness: 0.5, metalness: 0.15 }),
    surface: std({ color: '#a9b1b9', roughness: 0.5, metalness: 0.18 }),
    tail: std({ color: '#1d2c54', roughness: 0.45, metalness: 0.12 }),
    metal: std({ color: '#b3b9c0', roughness: 0.3, metalness: 0.75 }),
    darkMetal: std({ color: '#40454c', roughness: 0.45, metalness: 0.6 }),
    rubber: std({ color: '#1b1d20', roughness: 0.92, metalness: 0 }),
    glass: std({ color: '#0e1822', roughness: 0.06, metalness: 0.35 }),
    hole: std({ color: '#0b0d10', roughness: 1, metalness: 0 }),
    bulb: std({ color: '#d8d8d8', roughness: 0.2, metalness: 0.1 }),
    outline: new THREE.LineBasicMaterial({ color: '#7d8791', transparent: true, opacity: 0.7 }),
  };
}

export function buildModel() {
  const M = makeMaterials();
  const root = new THREE.Group();
  root.name = 'b738';
  // flightGroup moves for lift-off. The airframe sits LIFT higher so the fuselage, doors and tail
  // match Boeing's published ground clearances (D6-58325-7). Engines hang lower, as on the real aircraft.
  const LIFT = 0.8;
  const flightGroup = new THREE.Group();
  root.add(flightGroup);
  const airframe = new THREE.Group();
  airframe.position.y = LIFT;
  flightGroup.add(airframe);

  const rig = {
    airframe: flightGroup,
    flaps: [], slats: [], kruegers: [], ailerons: [],
    flightSpoilers: [], groundSpoilers: [], elevators: [], rudder: null,
    stab: null, mainGear: [], noseGear: null, noseDoors: [],
    reversers: [], doors: [], apuDoor: null,
    lights: { nav: [], strobe: [], beacon: [], landing: [], turnoff: [], taxi: [], logo: [], wing: [] },
  };

  const add = (parent, geom, mat, partId, side = 'C') => {
    const m = new THREE.Mesh(geom, mat);
    m.userData.partId = partId;
    m.userData.side = side;
    parent.add(m);
    return m;
  };
  const sideKey = (s) => (s < 0 ? 'L' : 'R');

  function cylinderBetween(parent, a, b, r, mat, partId, side) {
    const dir = b.clone().sub(a);
    const len = dir.length();
    const m = add(parent, new THREE.CylinderGeometry(r, r, len, 14), mat, partId, side);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(V(0, 1, 0), dir.normalize());
    return m;
  }

  function fusePatch(X0, X1, th0, th1, off, nu = 6, nv = 8) {
    return gridSurface((u, v) => {
      const X = lerp(X0, X1, u);
      const a = typeof th0 === 'function' ? th0(u) : th0;
      const b = typeof th1 === 'function' ? th1(u) : th1;
      return fusePt(X, lerp(a, b, v), off);
    }, nu, nv, { closedV: false });
  }
  function sidePatch(X0, X1, Y0, Y1, side, off, nu = 6, nv = 10) {
    return gridSurface((u, v) => fuseSidePt(lerp(X0, X1, u), lerp(Y0, Y1, v), side, off), nu, nv, { closedV: false });
  }
  function sideOutline(X0, X1, Y0, Y1, side, off) {
    const pts = [];
    const n = 12;
    for (let i = 0; i <= n; i++) pts.push(V(...fuseSidePt(lerp(X0, X1, i / n), Y0, side, off)));
    for (let i = 0; i <= n; i++) pts.push(V(...fuseSidePt(X1, lerp(Y0, Y1, i / n), side, off)));
    for (let i = 0; i <= n; i++) pts.push(V(...fuseSidePt(lerp(X1, X0, i / n), Y1, side, off)));
    for (let i = 0; i <= n; i++) pts.push(V(...fuseSidePt(X0, lerp(Y1, Y0, i / n), side, off)));
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), M.outline);
    line.raycast = () => {};
    return line;
  }

  // Light bulb + glow sprite (+ optional spot light)
  const glowMat = (color) => new THREE.SpriteMaterial({
    map: glowTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
  });
  function makeLight(parent, kind, pos, color, partId, side, { size = 0.07, glow = 1.1, spot = null } = {}) {
    const mesh = add(parent, new THREE.SphereGeometry(size, 16, 12), M.bulb, partId, side);
    mesh.position.copy(pos);
    mesh.userData.bulb = true;
    const sprite = new THREE.Sprite(glowMat(color));
    sprite.scale.setScalar(glow);
    sprite.position.copy(pos);
    sprite.visible = false;
    sprite.raycast = () => {};
    parent.add(sprite);
    let spotLight = null;
    if (spot) {
      spotLight = new THREE.SpotLight(color, 0, spot.distance ?? 90, spot.angle ?? 0.28, 0.55, 1.1);
      spotLight.position.copy(pos);
      spotLight.target.position.copy(pos).add(spot.dir);
      parent.add(spotLight, spotLight.target);
    }
    rig.lights[kind].push({ mesh, sprite, color: new THREE.Color(color), spot: spotLight, side });
    return mesh;
  }

  // ================================================================== Fuselage
  {
    const geom = gridSurface((u, v) => fusePt(lerp(1.5, 39.45, u), v * Math.PI * 2), 120, 64);
    const pos = geom.attributes.position;
    const colors = [];
    const white = new THREE.Color('#f4f5f2');
    const grey = new THREE.Color('#c4c9ce');
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const X = NOSE_X - pos.getX(i);
      const st = fuseAt(X);
      const t = (pos.getY(i) - st.cY) / st.h;
      const k = clamp((t + 0.36) / -0.1, 0, 1);
      c.copy(white).lerp(grey, k);
      colors.push(c.r, c.g, c.b);
    }
    geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    add(airframe, geom, M.fuse, 'fuselage');

    // Cabin windows (instanced)
    const shape = new THREE.Shape();
    const w = 0.12, h = 0.17, r = 0.06;
    shape.moveTo(-w + r, -h);
    shape.lineTo(w - r, -h); shape.quadraticCurveTo(w, -h, w, -h + r);
    shape.lineTo(w, h - r); shape.quadraticCurveTo(w, h, w - r, h);
    shape.lineTo(-w + r, h); shape.quadraticCurveTo(-w, h, -w, h - r);
    shape.lineTo(-w, -h + r); shape.quadraticCurveTo(-w, -h, -w + r, -h);
    const winGeom = new THREE.ShapeGeometry(shape, 4);
    const spots = [];
    for (let X = 6.7; X < 31.7; X += 0.508) {
      if (X > 15.75 && X < 17.6) continue;
      for (const side of [-1, 1]) spots.push([X, side]);
    }
    const inst = new THREE.InstancedMesh(winGeom, M.glass, spots.length);
    const d = new THREE.Object3D();
    spots.forEach(([X, side], i) => {
      const st = fuseAt(X);
      const Y = st.cY + 0.4;
      const th = fuseTheta(X, Y, side);
      const p = V(...fusePt(X, th, 0.008));
      d.position.copy(p);
      d.lookAt(p.clone().add(fuseNormal(X, th)));
      d.updateMatrix();
      inst.setMatrixAt(i, d.matrix);
    });
    inst.userData.partId = 'fuselage';
    airframe.add(inst);
  }

  // Radome
  add(airframe, gridSurface((u, v) => fusePt(lerp(0, 1.52, u), v * Math.PI * 2), 24, 64), M.radome, 'radome');

  // Flight deck windows (1, 2, 3 each side)
  for (const side of [-1, 1]) {
    const sk = sideKey(side);
    // [X0, X1, Ybottom, Ytop] — a continuous windshield band rising slightly aft
    const wins = [
      [2.42, 3.18, 3.0, 3.56],
      [3.25, 3.95, 3.07, 3.64],
      [4.02, 4.5, 3.14, 3.58],
    ];
    for (const [X0, X1, Y0, Y1] of wins) {
      add(airframe, sidePatch(X0, X1, Y0, Y1, side, 0.012, 6, 8), M.glass, 'flight-deck-windows', sk);
      airframe.add(sideOutline(X0, X1, Y0, Y1, side, 0.016));
    }
  }

  // ================================================================== Doors & exits
  const doorDefs = [
    { id: 'forward-entry-door', X: [4.55, 5.42], Y: [1.98, 3.85], side: -1, hinge: 'fwd' },
    { id: 'service-doors', X: [4.62, 5.42], Y: [2.1, 3.72], side: 1, hinge: 'fwd' },
    { id: 'aft-entry-door', X: [32.25, 33.1], Y: [2.25, 3.98], side: -1, hinge: 'fwd' },
    { id: 'service-doors', X: [32.3, 33.1], Y: [2.35, 3.88], side: 1, hinge: 'fwd' },
    { id: 'overwing-exits', X: [15.92, 16.44], Y: [2.48, 3.45], side: -1, hinge: 'top' },
    { id: 'overwing-exits', X: [16.88, 17.4], Y: [2.48, 3.45], side: -1, hinge: 'top' },
    { id: 'overwing-exits', X: [15.92, 16.44], Y: [2.48, 3.45], side: 1, hinge: 'top' },
    { id: 'overwing-exits', X: [16.88, 17.4], Y: [2.48, 3.45], side: 1, hinge: 'top' },
    { id: 'forward-cargo-door', X: [8.4, 9.62], Y: [0.68, 1.7], side: 1, hinge: 'cargo' },
    { id: 'aft-cargo-door', X: [25.6, 26.82], Y: [0.92, 1.95], side: 1, hinge: 'cargo' },
  ];
  for (const dd of doorDefs) {
    const [X0, X1] = dd.X, [Y0, Y1] = dd.Y, sk = sideKey(dd.side);
    // dark opening revealed when the door moves
    add(airframe, sidePatch(X0, X1, Y0, Y1, dd.side, 0.005), M.hole, dd.id, sk);
    let A, axis, angle;
    if (dd.hinge === 'fwd') {
      A = V(...fuseSidePt(X0, (Y0 + Y1) / 2, dd.side, 0.012)); axis = V(0, 1, 0); angle = dd.side * 100 * DEG;
    } else if (dd.hinge === 'top') {
      A = V(...fuseSidePt((X0 + X1) / 2, Y1, dd.side, 0.012)); axis = V(1, 0, 0); angle = -dd.side * 80 * DEG;
    } else {
      A = V(...fuseSidePt((X0 + X1) / 2, Y1, dd.side, 0.012)); axis = V(1, 0, 0); angle = dd.side * 72 * DEG;
    }
    const pv = makePivot(airframe, A);
    add(pv.inner, sidePatch(X0, X1, Y0, Y1, dd.side, 0.013), M.door, dd.id, sk);
    pv.inner.add(sideOutline(X0, X1, Y0, Y1, dd.side, 0.016));
    rig.doors.push({ pivot: pv.pivot, axis, angle });
  }

  // ================================================================== Wing-body fairing
  {
    const FAIR = [
      { X: 12.6, w: 0.25, h: 0.2, cY: 0.86 },
      { X: 13.6, w: 1.3, h: 0.56, cY: 1.16 },
      { X: 15.0, w: 1.95, h: 0.86, cY: 1.42 },
      { X: 17.0, w: 2.2, h: 0.95, cY: 1.5 },
      { X: 21.0, w: 2.25, h: 0.95, cY: 1.5 },
      { X: 23.0, w: 1.85, h: 0.85, cY: 1.46 },
      { X: 24.6, w: 0.9, h: 0.46, cY: 1.12 },
      { X: 25.4, w: 0.2, h: 0.15, cY: 0.9 },
    ];
    const se = (v, p) => Math.sign(v) * Math.abs(v) ** p;
    add(airframe, gridSurface((u, v) => {
      const X = lerp(12.6, 25.4, u);
      const st = interpStations(FAIR, 'X', X);
      const th = v * Math.PI * 2;
      return [wx(X), st.cY + st.h * se(Math.cos(th), 0.8), st.w * se(Math.sin(th), 0.8)];
    }, 50, 48, { capStart: true, capEnd: true }), M.belly, 'wing-body-fairing');
  }

  // ================================================================== Wings
  const WING = makePlanform([
    { s: 0, le: 15.0, c: 7.6, tc: 0.15 },
    { s: 5.6, le: 17.85, c: 4.75, tc: 0.13 },
    { s: 17.16, le: 23.74, c: 1.3, tc: 0.105 },
  ], 0.02);
  const WY = 1.4;
  const DIHEDRAL = 5 * DEG; // effective, tuned so the wingtip height matches Boeing's ground clearance data
  const TIP = 17.16;

  for (const side of [-1, 1]) {
    const sk = sideKey(side);
    const wg = new THREE.Group();
    wg.position.set(0, WY, 0);
    wg.rotation.x = -side * DIHEDRAL;
    airframe.add(wg);
    const W = new THREE.Group();
    W.position.set(0, -WY, 0);
    wg.add(W);
    const map = (s, X, N) => [wx(X), WY + N, side * s];
    const piece = (o, mat, part) => add(W, liftingPiece(WING, map, o), mat, part, sk);
    const normAxis = (A, B) => { const a = B.clone().sub(A).normalize(); return a.z < 0 ? a.negate() : a; };
    const hinged = (list, o, tH, surface, mat, part, extra = {}) => {
      const [A, B] = hingeLine(WING, map, o.s0, o.s1, tH, surface);
      const pv = makePivot(W, A);
      add(pv.inner, liftingPiece(WING, extra.map || map, o), mat, part, sk);
      const sm = (o.s0 + o.s1) / 2;
      const entry = { pivot: pv.pivot, base: A, axis: normAxis(A, B), side, chord: WING.at(sm).c, s: sm };
      list.push(entry);
      return entry;
    };

    // fixed structure (front 75 % of chord)
    piece({ s0: 0, s1: 5.6, t0: 0, t1: 0.75, nu: 14, nv: 40, caps: false }, M.wing, 'wing');
    piece({ s0: 5.6, s1: TIP, t0: 0, t1: 0.75, nu: 30, nv: 40, caps: false }, M.wing, 'wing');
    piece({ s0: 16.5, s1: TIP, t0: 0.75, t1: 1, nu: 3, nv: 12 }, M.wing, 'wing');
    piece({ s0: 6.9, s1: 7.1, t0: 0.75, t1: 1, nu: 2, nv: 12 }, M.wing, 'wing');
    piece({ s0: 12.4, s1: 12.5, t0: 0.75, t1: 1, nu: 2, nv: 12 }, M.wing, 'wing');

    // trailing-edge flaps
    for (const [s0, s1] of [[1.95, 6.9], [7.1, 12.4]]) {
      hinged(rig.flaps, { s0, s1, t0: 0.75, t1: 1, nu: 8, nv: 22 }, 0.75, 'camber', M.surface, 'trailing-edge-flaps');
    }
    // flap track fairings
    for (const s of [7.0, 9.6, 12.0]) {
      const st = WING.at(s);
      const Xa = st.le + 0.5 * st.c, Xb = st.le + st.c + 0.85;
      add(W, gridSurface((u, v) => {
        const X = lerp(Xa, Xb, u);
        const t = clamp((X - st.le) / st.c, 0, 1);
        const lowerN = WING.point(s, t, false).N;
        const k = Math.sin(Math.PI * u);
        const depth = 0.45 * k ** 0.6, w = 0.15 * k ** 0.5;
        const th = v * Math.PI * 2;
        return [wx(X), WY + lowerN + 0.02 - depth * (0.5 - 0.5 * Math.cos(th)), side * s + w * Math.sin(th)];
      }, 16, 16), M.surface, 'trailing-edge-flaps', sk);
    }
    // ailerons
    hinged(rig.ailerons, { s0: 12.5, s1: 16.5, t0: 0.75, t1: 1, nu: 8, nv: 20 }, 0.75, 'camber', M.surface, 'aileron');

    // spoilers (plates on the upper surface, hinged at the front edge)
    const spoilerOpts = (s0, s1) => ({ s0, s1, t0: 0.58, t1: 0.77, nu: 4, nv: 12, plate: 'upper', plateT: 0.03 });
    hinged(rig.groundSpoilers, spoilerOpts(2.15, 4.1), 0.58, 'upper', M.surface, 'ground-spoilers');
    for (const [s0, s1] of [[5.9, 7.2], [7.25, 8.55], [8.6, 9.9], [9.95, 11.2]]) {
      hinged(rig.flightSpoilers, spoilerOpts(s0, s1), 0.58, 'upper', M.surface, 'flight-spoilers');
    }
    hinged(rig.groundSpoilers, spoilerOpts(11.25, 12.4), 0.58, 'upper', M.surface, 'ground-spoilers');

    // leading-edge slats (slightly proud of the fixed nose so they enclose it)
    const slatMap = (s, X, N) => map(s, X - 0.012, N);
    for (const [s0, s1] of [[5.9, 8.55], [8.6, 11.2], [11.25, 13.85], [13.9, 16.6]]) {
      hinged(rig.slats, { s0, s1, t0: 0, t1: 0.14, nu: 8, nv: 26, scaleN: 1.07 }, 0.14, 'camber', M.metal, 'le-slats', { map: slatMap });
    }
    // Krueger flaps (lower surface, inboard of the engine)
    for (const [s0, s1] of [[2.2, 3.0], [3.05, 3.85]]) {
      hinged(rig.kruegers, { s0, s1, t0: 0.03, t1: 0.16, nu: 4, nv: 12, plate: 'lower', plateT: 0.03 }, 0.03, 'lower', M.surface, 'krueger-flaps');
    }

    // blended winglet
    const WL = makePlanform([
      { s: 0, le: 23.74, c: 1.3, tc: 0.105 },
      { s: 0.72, le: 24.15, c: 1.12, tc: 0.1 },
      { s: 2.95, le: 25.55, c: 0.5, tc: 0.08 },
    ], 0);
    const r = 0.55, phiM = 75 * DEG, Lb = r * phiM;
    const wlFrame = (s) => {
      if (s <= Lb) { const phi = s / r; return { phi, out: r * Math.sin(phi), up: r * (1 - Math.cos(phi)) }; }
      return { phi: phiM, out: r * Math.sin(phiM) + (s - Lb) * Math.cos(phiM), up: r * (1 - Math.cos(phiM)) + (s - Lb) * Math.sin(phiM) };
    };
    const wlMap = (s, X, N) => {
      const f = wlFrame(s);
      return [wx(X), WY + f.up + N * Math.cos(f.phi), side * (TIP + f.out - N * Math.sin(f.phi))];
    };
    add(W, liftingPiece(WL, wlMap, { s0: 0, s1: 2.95, nu: 26, nv: 28 }), M.tail, 'winglet', sk);

    // wingtip lights
    const navPos = V(...wlMap(0.3, WL.at(0.3).le - 0.03, 0));
    makeLight(W, 'nav', navPos, side < 0 ? '#ff2a2a' : '#22ff6a', 'nav-lights', sk, { size: 0.065, glow: 1.4 });
    const tailNav = V(...wlMap(0.3, WL.at(0.3).le + WL.at(0.3).c + 0.03, 0));
    makeLight(W, 'nav', tailNav, '#ffffff', 'nav-lights', sk, { size: 0.05, glow: 0.9 });
    const strobePos = V(...wlMap(0.08, WL.at(0.08).le + 0.1, -0.02));
    makeLight(W, 'strobe', strobePos, '#ffffff', 'strobe-lights', sk, { size: 0.05, glow: 3.2 });

    // wing-root landing & turnoff lights
    const llS = 2.55, toS = 2.12;
    makeLight(W, 'landing', V(...map(llS, WING.at(llS).le - 0.01, -0.02)), '#fff6e0', 'landing-lights', sk,
      { size: 0.09, glow: 1.6, spot: { dir: V(30, -2.4, side * 1.5), angle: 0.22, distance: 120 } });
    makeLight(W, 'turnoff', V(...map(toS, WING.at(toS).le - 0.01, 0.05)), '#fff6e0', 'runway-turnoff-lights', sk,
      { size: 0.07, glow: 1.3, spot: { dir: V(14, -1.4, side * 14), angle: 0.4, distance: 60 } });

    // engine strut aft fairing joins under the wing (built with the pylon below)
  }

  // ================================================================== Engines & pylons
  const X0 = 13.3, YC = 1.42; // world height: nacelle bottom ~0.55 m (Boeing: 0.48–0.64 m)
  const prof = (stations) => (xp) => interpStations(stations, 'x', xp).r;
  const cowlR = prof([{ x: 0, r: 0.9 }, { x: 0.18, r: 0.99 }, { x: 0.6, r: 1.04 }, { x: 1.8, r: 1.02 }, { x: 2.6, r: 0.97 }]);
  const sleeveR = prof([{ x: 2.6, r: 0.975 }, { x: 3.3, r: 0.9 }, { x: 3.9, r: 0.79 }]);
  const coreR = prof([{ x: 3.65, r: 0.66 }, { x: 4.4, r: 0.6 }, { x: 4.95, r: 0.46 }]);
  const plugR = prof([{ x: 4.85, r: 0.34 }, { x: 5.25, r: 0.19 }, { x: 5.55, r: 0.02 }]);

  for (const side of [-1, 1]) {
    const sk = sideKey(side);
    const zc = side * 4.9;
    const ring = (xp, r, th, flat = true) => {
      const c = Math.cos(th);
      return [wx(X0 + xp), YC + r * c * (flat && c < 0 ? 0.84 : 1), zc + r * Math.sin(th)];
    };
    const tubeOf = (a, b, rf, nu, flat = true) =>
      gridSurface((u, v) => { const xp = lerp(a, b, u); return ring(xp, rf(xp), v * Math.PI * 2, flat); }, nu, 56);

    add(flightGroup, tubeOf(0, 2.6, cowlR, 26), M.paint, 'engine', sk);
    add(flightGroup, tubeOf(0, 0.66, () => 0.86, 4), M.darkMetal, 'engine', sk);
    // inlet lip
    add(flightGroup, gridSurface((u, v) => ring(-0.045 * Math.sin(Math.PI * u), lerp(0.9, 0.86, u), v * Math.PI * 2),
      6, 56, {}), M.metal, 'engine', sk);
    // fan face, blades, spinner
    const fan = add(flightGroup, new THREE.CircleGeometry(0.86, 48), M.darkMetal, 'engine', sk);
    fan.position.set(wx(X0 + 0.66), YC - 0.02, zc);
    fan.rotation.y = Math.PI / 2;
    const bladeGeom = new THREE.BoxGeometry(0.02, 0.6, 0.12);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const b = add(flightGroup, bladeGeom, M.metal, 'engine', sk);
      b.position.set(wx(X0 + 0.6), YC - 0.02 + Math.cos(a) * 0.54, zc + Math.sin(a) * 0.54);
      b.rotation.set(a, 0, 0);
      b.rotateY(0.5);
    }
    const spinner = add(flightGroup, new THREE.ConeGeometry(0.27, 0.55, 32), M.metal, 'engine', sk);
    spinner.position.set(wx(X0 + 0.38), YC - 0.02, zc);
    spinner.rotation.z = -Math.PI / 2;
    // core cowl & plug
    add(flightGroup, tubeOf(3.65, 4.95, coreR, 12, false), M.metal, 'engine', sk);
    add(flightGroup, tubeOf(4.85, 5.55, plugR, 8, false), M.darkMetal, 'engine', sk);

    // thrust reverser: cascade (fixed) + translating sleeve
    add(flightGroup, tubeOf(2.55, 3.15, () => 0.875, 6), M.hole, 'thrust-reverser', sk);
    const sleeve = new THREE.Group();
    flightGroup.add(sleeve);
    add(sleeve, tubeOf(2.6, 3.9, sleeveR, 14), M.paint, 'thrust-reverser', sk);
    add(sleeve, tubeOf(3.86, 3.9, () => 0.76, 1), M.darkMetal, 'thrust-reverser', sk);
    rig.reversers.push({ sleeve, side });

    // pylon / strut
    const PY = [
      { X: 14.0, yb: 2.3, yt: 2.42, hw: 0.04 },
      { X: 14.8, yb: 2.27, yt: 2.7, hw: 0.19 },
      { X: 16.6, yb: 2.2, yt: 2.68, hw: 0.2 },
      { X: 17.6, yb: 2.02, yt: 2.58, hw: 0.19 },
      { X: 18.6, yb: 1.86, yt: 2.52, hw: 0.17 },
      { X: 20.4, yb: 1.98, yt: 2.6, hw: 0.11 },
      { X: 21.6, yb: 2.4, yt: 2.64, hw: 0.03 },
    ];
    add(flightGroup, gridSurface((u, v) => {
      const X = lerp(14.0, 21.6, u);
      const st = interpStations(PY, 'X', X);
      const th = v * Math.PI * 2;
      return [wx(X), (st.yb + st.yt) / 2 + ((st.yt - st.yb) / 2) * Math.cos(th), zc + st.hw * Math.sin(th)];
    }, 30, 24, { capStart: true, capEnd: true }), M.paint, 'pylon', sk);
  }

  // ================================================================== Landing gear
  for (const side of [-1, 1]) {
    const sk = sideKey(side);
    const gx = wx(19.4), gz = side * 2.86;
    const ay = 0.56 - LIFT; // axle at 0.56 m above the ground in airframe coordinates
    const pv = makePivot(airframe, V(gx, 1.2, gz));
    const G = pv.inner;
    cylinderBetween(G, V(gx, 1.3, gz), V(gx, ay + 0.55, gz), 0.1, M.metal, 'main-gear', sk);
    cylinderBetween(G, V(gx, ay + 0.65, gz), V(gx, ay, gz), 0.075, M.metal, 'main-gear', sk);
    cylinderBetween(G, V(gx, ay, gz - 0.5), V(gx, ay, gz + 0.5), 0.06, M.darkMetal, 'main-gear', sk);
    cylinderBetween(G, V(gx + 0.12, ay + 0.5, gz), V(gx + 0.12, ay + 0.14, gz), 0.03, M.darkMetal, 'main-gear', sk);
    cylinderBetween(G, V(gx - 0.05, 1.1, gz), V(gx - 0.05, ay + 0.75, gz - side * 0.18), 0.045, M.darkMetal, 'main-gear', sk);
    for (const dz of [-0.42, 0.42]) {
      const tire = add(G, new THREE.TorusGeometry(0.39, 0.17, 16, 36), M.rubber, 'main-gear', sk);
      tire.position.set(gx, ay, gz + dz);
      const hub = add(G, new THREE.CylinderGeometry(0.29, 0.29, 0.3, 28), M.metal, 'main-gear', sk);
      hub.position.set(gx, ay, gz + dz);
      hub.rotation.x = Math.PI / 2;
    }
    rig.mainGear.push({ pivot: pv.pivot, axis: V(1, 0, 0), side });
  }
  {
    const nx = wx(4.55);
    const ny = 0.35 - LIFT; // nose axle 0.35 m above the ground
    const pv = makePivot(airframe, V(nx, 1.35, 0));
    const G = pv.inner;
    cylinderBetween(G, V(nx, 1.45, 0), V(nx, ny + 0.3, 0), 0.075, M.metal, 'nose-gear');
    cylinderBetween(G, V(nx, ny + 0.45, 0), V(nx, ny, 0), 0.055, M.metal, 'nose-gear');
    cylinderBetween(G, V(nx, ny, -0.3), V(nx, ny, 0.3), 0.04, M.darkMetal, 'nose-gear');
    cylinderBetween(G, V(nx - 0.05, 1.25, 0), V(nx - 0.55, 1.45, 0), 0.04, M.darkMetal, 'nose-gear');
    for (const dz of [-0.2, 0.2]) {
      const tire = add(G, new THREE.TorusGeometry(0.245, 0.1, 14, 30), M.rubber, 'nose-gear');
      tire.position.set(nx, ny, dz);
      const hub = add(G, new THREE.CylinderGeometry(0.16, 0.16, 0.17, 24), M.metal, 'nose-gear');
      hub.position.set(nx, ny, dz);
      hub.rotation.x = Math.PI / 2;
    }
    makeLight(G, 'taxi', V(nx + 0.1, ny + 0.5, 0), '#fff6e0', 'taxi-light', 'C',
      { size: 0.07, glow: 1.3, spot: { dir: V(30, -1.6, 0), angle: 0.42, distance: 70 } });
    rig.noseGear = { pivot: pv.pivot, axis: V(0, 0, 1) };

    // nose wheel well + doors
    add(airframe, fusePatch(2.9, 4.75, Math.PI - 0.2, Math.PI + 0.2, 0.007), M.hole, 'nose-gear');
    for (const side of [-1, 1]) {
      const a = side > 0 ? Math.PI - 0.2 : -(Math.PI - 0.02);
      const b = side > 0 ? Math.PI - 0.02 : -(Math.PI - 0.2);
      const hingeTh = side * (Math.PI - 0.2);
      const pvd = makePivot(airframe, V(...fusePt(3.8, hingeTh, 0.014)));
      add(pvd.inner, fusePatch(2.9, 4.75, a, b, 0.014, 6, 4), M.belly, 'nose-gear', sideKey(side));
      rig.noseDoors.push({ pivot: pvd.pivot, axis: V(1, 0, 0), angle: -side * 85 * DEG });
    }
  }

  // ================================================================== Vertical fin & rudder
  {
    const FIN = makePlanform([
      { s: 0, le: 28.6, c: 7.0, tc: 0.11 },
      { s: 0.9, le: 31.0, c: 5.0, tc: 0.11 },
      { s: 7.45, le: 36.2, c: 2.25, tc: 0.09 },
    ], 0);
    // fin tip at 12.5 m above the ground (Boeing: 12.37–12.62 m)
    const FY = 4.25;
    const map = (s, X, N) => [wx(X), FY + s, N];
    add(airframe, liftingPiece(FIN, map, { s0: 0, s1: 0.9, t0: 0, t1: 1, nu: 4, nv: 40, caps: false }), M.tail, 'vertical-fin');
    add(airframe, liftingPiece(FIN, map, { s0: 0.9, s1: 7.45, t0: 0, t1: 0.7, nu: 20, nv: 40, caps: false }), M.tail, 'vertical-fin');
    add(airframe, liftingPiece(FIN, map, { s0: 7.15, s1: 7.45, t0: 0.7, t1: 1, nu: 2, nv: 12 }), M.tail, 'vertical-fin');
    // tip cap for the fixed fin
    add(airframe, liftingPiece(FIN, map, { s0: 7.43, s1: 7.45, t0: 0, t1: 0.7, nu: 1, nv: 40 }), M.tail, 'vertical-fin');
    const [A, B] = hingeLine(FIN, map, 0.9, 7.15, 0.7);
    const pv = makePivot(airframe, A);
    add(pv.inner, liftingPiece(FIN, map, { s0: 0.9, s1: 7.15, t0: 0.7, t1: 1, nu: 12, nv: 20 }), M.tail, 'rudder');
    const axis = B.clone().sub(A).normalize();
    rig.rudder = { pivot: pv.pivot, axis: axis.y < 0 ? axis.negate() : axis };

    // elevator feel pitots on the dorsal fin, at the base of the vertical stabilizer
    const fs = 0.55, st = FIN.at(fs);
    for (const side of [-1, 1]) {
      const X = st.le + 0.22 * st.c;
      const skin = FIN.point(fs, 0.22, true).N; // half-thickness at the probe station
      const base = V(wx(X), FY + fs, side * (skin - 0.01));
      const tip = base.clone().add(V(0, 0, side * 0.16));
      cylinderBetween(airframe, base, tip, 0.02, M.metal, 'elevator-feel-pitots', sideKey(side));
      cylinderBetween(airframe, tip, tip.clone().add(V(0.22, 0, 0)), 0.018, M.metal, 'elevator-feel-pitots', sideKey(side));
    }
    // beacon top / tail strobe positioned below
  }

  // ================================================================== Horizontal stabilizer & elevators
  {
    const HS = makePlanform([
      { s: 0, le: 34.0, c: 3.9, tc: 0.1 },
      { s: 7.2, le: 38.4, c: 1.25, tc: 0.085 },
    ], 0);
    const HY = 3.85; // stabilizer tip ~5.5 m above the ground (Boeing: 5.49–5.64 m)
    const trim = makePivot(airframe, V(wx(36.6), HY, 0));
    rig.stab = { pivot: trim.pivot, axis: V(0, 0, 1) };
    for (const side of [-1, 1]) {
      const sk = sideKey(side);
      const g = new THREE.Group();
      g.position.set(0, HY, 0);
      g.rotation.x = -side * 7 * DEG;
      trim.inner.add(g);
      const S = new THREE.Group();
      S.position.set(0, -HY, 0);
      g.add(S);
      const map = (s, X, N) => [wx(X), HY + N, side * s];
      add(S, liftingPiece(HS, map, { s0: 0, s1: 7.2, t0: 0, t1: 0.7, nu: 16, nv: 36 }), M.wing, 'horizontal-stabilizer', sk);
      add(S, liftingPiece(HS, map, { s0: 6.9, s1: 7.2, t0: 0.7, t1: 1, nu: 2, nv: 12 }), M.wing, 'horizontal-stabilizer', sk);
      add(S, liftingPiece(HS, map, { s0: 0, s1: 0.9, t0: 0.7, t1: 1, nu: 2, nv: 12 }), M.wing, 'horizontal-stabilizer', sk);
      const [A, B] = hingeLine(HS, map, 0.9, 6.9, 0.7);
      const pv = makePivot(S, A);
      add(pv.inner, liftingPiece(HS, map, { s0: 0.9, s1: 6.9, t0: 0.7, t1: 1, nu: 10, nv: 20 }), M.surface, 'elevator', sk);
      const axis = B.clone().sub(A).normalize();
      rig.elevators.push({ pivot: pv.pivot, axis: axis.z < 0 ? axis.negate() : axis, side });

      // logo lights on the stabilizer upper surface, aimed at the fin
      const ls = 5.6, st = HS.at(ls);
      const lp = HS.point(ls, 0.35, true);
      makeLight(S, 'logo', V(...map(ls, lp.X, lp.N + 0.04)), '#fff4dc', 'logo-lights', sk,
        { size: 0.05, glow: 0.9, spot: { dir: V(-1.5, 3.2, -side * 5.4), angle: 0.32, distance: 18 } });
      void st;
    }
  }

  // ================================================================== APU
  {
    const st = fuseAt(39.3);
    add(airframe, gridSurface((u, v) => {
      const X = lerp(39.2, 39.62, u);
      const th = v * Math.PI * 2;
      const r = 0.25;
      return [wx(X), 3.6 + r * Math.cos(th), r * Math.sin(th)];
    }, 3, 32, { capEnd: true }), M.darkMetal, 'apu');
    void st;
    const [Xa, Xb, Ya, Yb] = [36.9, 37.65, 3.55, 3.95];
    add(airframe, sidePatch(Xa, Xb, Ya, Yb, 1, 0.005), M.hole, 'apu', 'R');
    const pv = makePivot(airframe, V(...fuseSidePt(Xb, (Ya + Yb) / 2, 1, 0.012)));
    add(pv.inner, sidePatch(Xa, Xb, Ya, Yb, 1, 0.013), M.door, 'apu', 'R');
    pv.inner.add(sideOutline(Xa, Xb, Ya, Yb, 1, 0.016));
    rig.apuDoor = { pivot: pv.pivot, axis: V(0, 1, 0), angle: -38 * DEG };
  }

  // ================================================================== Fuselage lights
  makeLight(airframe, 'beacon', V(wx(20.5), 4.62, 0), '#ff2020', 'beacon-lights', 'C', { size: 0.1, glow: 1.8 });
  makeLight(airframe, 'beacon', V(wx(25.9), 0.6, 0), '#ff2020', 'beacon-lights', 'C', { size: 0.1, glow: 1.8 });
  makeLight(airframe, 'strobe', V(wx(39.2), 3.93, 0), '#ffffff', 'strobe-lights', 'C', { size: 0.06, glow: 3.2 });
  for (const side of [-1, 1]) {
    const X = 13.4, Y = 3.2;
    const th = fuseTheta(X, Y, side);
    const p = V(...fusePt(X, th, 0.03));
    makeLight(airframe, 'wing', p, '#fff4dc', 'wing-lights', sideKey(side),
      { size: 0.06, glow: 1.0, spot: { dir: V(-6, -1.2, side * 9), angle: 0.45, distance: 25 } });
  }

  // ================================================================== Probes & sensors
  const probeBase = (X, Y, side, off = 0) => {
    const th = fuseTheta(X, Y, side);
    return { p: V(...fusePt(X, th, off)), n: fuseNormal(X, th) };
  };
  // Captain (left), First Officer + auxiliary (right)
  for (const [X, Y, side] of [[3.3, 2.35, -1], [3.3, 2.35, 1], [3.05, 2.02, 1]]) {
    const { p, n } = probeBase(X, Y, side);
    const tip = p.clone().addScaledVector(n, 0.13);
    cylinderBetween(airframe, p, tip, 0.022, M.metal, 'pitot-probes', sideKey(side));
    cylinderBetween(airframe, tip.clone().add(V(-0.04, 0, 0)), tip.clone().add(V(0.22, 0, 0)), 0.02, M.metal, 'pitot-probes', sideKey(side));
  }
  for (const side of [-1, 1]) {
    const { p, n } = probeBase(4.0, 2.9, side);
    const vane = add(airframe, new THREE.BoxGeometry(0.16, 0.06, 0.012), M.darkMetal, 'aoa-vanes', sideKey(side));
    vane.position.copy(p).addScaledVector(n, 0.05);
    const disk = add(airframe, new THREE.CircleGeometry(0.07, 20), M.metal, 'aoa-vanes', sideKey(side));
    disk.position.copy(p).addScaledVector(n, 0.006);
    disk.lookAt(disk.position.clone().add(n));
    for (const X of [6.55, 6.85]) {
      const s = probeBase(X, 2.3, side, 0.009);
      const port = add(airframe, new THREE.CircleGeometry(0.06, 20), M.metal, 'static-ports', sideKey(side));
      port.position.copy(s.p);
      port.lookAt(s.p.clone().add(s.n));
    }
  }
  {
    const { p, n } = probeBase(4.7, 1.95, -1);
    const tip = p.clone().addScaledVector(n, 0.12);
    cylinderBetween(airframe, p, tip, 0.03, M.metal, 'tat-probe', 'L');
    cylinderBetween(airframe, tip, tip.clone().add(V(0.09, 0.02, 0)), 0.035, M.metal, 'tat-probe', 'L');
  }

  // ================================================================== Tail skid
  {
    const X = 29.4, st = fuseAt(X);
    const bottom = st.cY - st.h;
    const fair = add(airframe, new THREE.BoxGeometry(0.75, 0.2, 0.18), M.belly, 'tail-skid');
    fair.position.set(wx(X), bottom - 0.06, 0);
    const shoe = add(airframe, new THREE.BoxGeometry(0.42, 0.06, 0.14), M.darkMetal, 'tail-skid');
    shoe.position.set(wx(X + 0.1), bottom - 0.18, 0);
  }

  // ================================================================== Antennas
  const bladeGeom = (h, c) => {
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.lineTo(c, 0); s.lineTo(c * 0.82, h); s.lineTo(c * 0.5, h); s.lineTo(0, 0);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.025, bevelEnabled: false });
    g.translate(0, 0, -0.0125);
    return g;
  };
  const blade = (X, top, h, c, part) => {
    const m = add(airframe, bladeGeom(h, c), M.door, part);
    m.position.set(...fusePt(X, top ? 0 : Math.PI, -0.01));
    if (top) m.rotation.y = Math.PI; else m.rotation.z = Math.PI;
  };
  blade(12.8, true, 0.45, 0.5, 'vhf-antennas');
  blade(9.0, false, 0.4, 0.45, 'vhf-antennas');
  blade(23.9, false, 0.36, 0.42, 'vhf-antennas');
  blade(6.2, false, 0.14, 0.2, 'atc-dme-antennas');
  blade(6.8, false, 0.14, 0.2, 'atc-dme-antennas');
  blade(26.2, true, 0.14, 0.2, 'atc-dme-antennas');
  const dome = (X, top, sx, sy, sz, part, mat = M.door) => {
    const m = add(airframe, new THREE.SphereGeometry(1, 24, 12), mat, part);
    m.scale.set(sx, sy, sz);
    m.position.set(...fusePt(X, top ? 0 : Math.PI, -0.01));
  };
  dome(10.0, true, 0.36, 0.07, 0.2, 'tcas-antennas');
  dome(10.6, false, 0.36, 0.07, 0.2, 'tcas-antennas');
  dome(17.6, true, 0.13, 0.035, 0.13, 'gps-antennas');
  dome(18.3, true, 0.13, 0.035, 0.13, 'gps-antennas');
  for (const X of [27.6, 28.1, 28.6, 29.1]) {
    const m = add(airframe, new THREE.BoxGeometry(0.26, 0.025, 0.2), M.darkMetal, 'radio-altimeter-antennas');
    m.position.set(...fusePt(X, Math.PI, 0.005));
  }

  return { root, rig };
}
