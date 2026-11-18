// Procedural Boeing 737-800 built from real dimensions (meters).
// Axes: +x forward (nose), +y up, +z right wing. Design stations use X = meters aft of the nose.
// Every component is its own mesh tagged with userData.partId so it can be picked and animated.
// Surface detail (panel lines, rivets, wear, a fictional neutral livery) comes from procedural
// canvas textures in model-textures.js.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  DEG, lerp, clamp, gridSurface, interpStations, makePlanform, liftingPiece,
  hingeLine, makePivot, glowTexture,
} from '../../core/geometry.js';
import {
  fuselageMaps, surfaceMaps, doorMaps, tireMaps, hubMap, spinnerMap, tailLogo, titleDecal,
} from './model-textures.js';

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
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
// Lower-lobe shaping: the 737 section is not an ellipse — the lower lobe tucks in below the floor
// line and the belly is flatter. Only the half-width changes (height stays h·cos θ), so Y → θ
// inversions used for doors, windows and probes stay exact. Fades out at the nose and tail cone.
function lobe(X, th) {
  const c = Math.cos(th);
  if (c >= 0) return 1;
  const k = smooth(1.2, 4.5, X) * (1 - smooth(31, 37.5, X));
  const a = Math.min(1, -c);
  return 1 - k * (0.055 * Math.sin(Math.PI * a) - 0.13 * a ** 4);
}
function fusePt(X, th, off = 0) {
  const st = fuseAt(X);
  return [wx(X), st.cY + (st.h + off) * Math.cos(th), (st.w * lobe(X, th) + off) * Math.sin(th)];
}
function fuseTheta(X, Y, side) {
  const st = fuseAt(X);
  return side * Math.acos(clamp((Y - st.cY) / st.h, -1, 1));
}
const fuseSidePt = (X, Y, side, off = 0) => fusePt(X, fuseTheta(X, Y, side), off);
function fuseNormal(X, th) {
  const st = fuseAt(X);
  const e = 1e-3;
  const z = (t) => st.w * lobe(X, t) * Math.sin(t);
  const dy = -st.h * Math.sin(th), dz = (z(th + e) - z(th - e)) / (2 * e);
  return V(0, dz, -dy).normalize();
}

// ---- Materials (the viewer clones these per mesh) ---------------------------------
// Skin panel joints (station X, m) and longitudinal lap joints (theta from the top, rad) for the fuselage map.
const SKIN_FRAMES = [3.2, 6.3, 9.7, 13.1, 16.6, 20.1, 23.5, 26.9, 30.2, 33.4, 36.0, 38.1];
const SKIN_LAPS = [0.42, 1.08, 1.72, 2.45].flatMap((t) => [t, Math.PI * 2 - t]);
const FUSE_X0 = 1.5, FUSE_X1 = 39.45;

function makeMaterials() {
  const std = (o) => new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, ...o });
  const hi = !(window.innerWidth <= 820 || (navigator.hardwareConcurrency || 8) <= 2);
  const fm = fuselageMaps({ X0: FUSE_X0, X1: FUSE_X1, frames: SKIN_FRAMES, laps: SKIN_LAPS, hi });
  const sm = surfaceMaps({ hi });
  const tread = tireMaps(4);
  const bellyN = sm.normalMap.clone();
  bellyN.repeat.set(3, 2);
  bellyN.needsUpdate = true;
  return {
    fuse: std({
      color: '#ffffff', map: fm.map, normalMap: fm.normalMap, normalScale: new THREE.Vector2(0.55, 0.55),
      roughnessMap: fm.roughnessMap, roughness: 1, metalness: 0.04,
    }),
    paint: std({ color: '#f2f3f0', roughness: 0.38, metalness: 0.05 }),
    door: std({ color: '#eef0ec', roughness: 0.4, metalness: 0.05 }),
    radome: std({ color: '#e9ebe7', roughness: 0.42, metalness: 0.02 }),
    belly: std({ color: '#bcc2c8', roughness: 0.55, metalness: 0.1, normalMap: bellyN, normalScale: new THREE.Vector2(0.4, 0.4) }),
    wing: std({
      color: '#c3c9cf', roughness: 1, metalness: 1, normalMap: sm.normalMap, normalScale: new THREE.Vector2(0.45, 0.45),
      roughnessMap: sm.roughnessMap, metalnessMap: sm.metalnessMap,
    }),
    stab: std({
      color: '#c3c9cf', roughness: 1, metalness: 0.12, normalMap: sm.normalMap, normalScale: new THREE.Vector2(0.4, 0.4),
      roughnessMap: sm.roughnessMap,
    }),
    surface: std({
      color: '#a9b1b9', roughness: 1, metalness: 0.18, normalMap: sm.normalMap, normalScale: new THREE.Vector2(0.4, 0.4),
      roughnessMap: sm.roughnessMap,
    }),
    tail: std({ color: '#1d2c54', roughness: 0.36, metalness: 0.12, normalMap: sm.normalMap, normalScale: new THREE.Vector2(0.3, 0.3) }),
    metal: std({ color: '#b9bfc6', roughness: 0.26, metalness: 0.85 }),
    brushed: std({ color: '#c9ced3', roughness: 0.32, metalness: 0.9 }),
    darkMetal: std({ color: '#40454c', roughness: 0.45, metalness: 0.6 }),
    liner: std({ color: '#1b1e22', roughness: 0.85, metalness: 0.1 }),
    rubber: std({ color: '#1b1d20', roughness: 0.9, metalness: 0 }),
    tire: std({ color: '#1e2023', roughness: 1, metalness: 0, normalMap: tread.normalMap, roughnessMap: tread.roughnessMap }),
    hubFace: std({ color: '#ffffff', map: hubMap(), roughness: 0.35, metalness: 0.75 }),
    spinner: std({ color: '#ffffff', map: spinnerMap(), roughness: 0.28, metalness: 0.8 }),
    blade: std({ color: '#9ea5ad', roughness: 0.32, metalness: 0.85 }),
    frame: std({ color: '#25292e', roughness: 0.6, metalness: 0.2 }),
    glass: std({ color: '#0b141d', roughness: 0.04, metalness: 0.5, envMapIntensity: 1.4 }),
    hole: std({ color: '#0b0d10', roughness: 1, metalness: 0 }),
    bulb: std({ color: '#d8d8d8', roughness: 0.2, metalness: 0.1 }),
    wick: std({ color: '#2b2f34', roughness: 0.5, metalness: 0.4 }),
  };
}
const withValues = (m, v) => { const c = m.clone(); c.setValues(v); return c; };
// Door skins by kind, shared across doors of the same kind.
const doorMatCache = new Map();
function doorMaterial(base, kind, aspect) {
  const key = kind + ':' + aspect.toFixed(2);
  if (!doorMatCache.has(key)) {
    const t = doorMaps(kind, aspect);
    doorMatCache.set(key, withValues(base, { map: t.map, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.8, 0.8) }));
  }
  return doorMatCache.get(key);
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

  // Static dischargers: thin rods trailing from a surface's trailing edge, merged into one mesh.
  // pts = [[base Vector3, direction Vector3], ...]
  function wicks(parent, pts, partId, side, len = 0.2) {
    const geoms = pts.map(([base, dir]) => {
      const d = dir.clone().normalize();
      const g = new THREE.CylinderGeometry(0.005, 0.007, len, 5);
      g.translate(0, len / 2, 0);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d));
      g.translate(base.x, base.y, base.z);
      return g;
    });
    const m = add(parent, mergeGeometries(geoms), M.wick, partId, side);
    m.userData.noAO = true;
    return m;
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
    // uv: u = station along the fuselage, v = theta / 2π (matches fuselageMaps)
    const geom = gridSurface((u, v) => fusePt(lerp(FUSE_X0, FUSE_X1, u), v * Math.PI * 2), 170, 96);
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
    // painted-over window reveal: a slightly larger grey rounded frame behind each pane
    const frameGeom = winGeom.clone().scale(1.32, 1.24, 1);
    const spots = [];
    for (let X = 6.7; X < 31.7; X += 0.508) {
      if (X > 15.75 && X < 17.6) continue;
      for (const side of [-1, 1]) spots.push([X, side]);
    }
    const inst = new THREE.InstancedMesh(winGeom, M.glass, spots.length);
    const frames = new THREE.InstancedMesh(frameGeom, withValues(M.door, { color: '#8f979f', roughness: 0.5 }), spots.length);
    const d = new THREE.Object3D();
    spots.forEach(([X, side], i) => {
      const st = fuseAt(X);
      const Y = st.cY + 0.4;
      const th = fuseTheta(X, Y, side);
      for (const [mesh, off] of [[frames, 0.006], [inst, 0.009]]) {
        const p = V(...fusePt(X, th, off));
        d.position.copy(p);
        d.lookAt(p.clone().add(fuseNormal(X, th)));
        d.updateMatrix();
        mesh.setMatrixAt(i, d.matrix);
      }
    });
    inst.userData.partId = 'fuselage';
    frames.userData.partId = 'fuselage';
    airframe.add(frames, inst);

    // fictional neutral livery title (AirCrafty) above the forward cabin windows, both sides
    for (const side of [-1, 1]) {
      const t = titleDecal(side);
      const m = add(airframe, sidePatch(7.9, 11.3, 3.25, 3.74, side, 0.004, 12, 6),
        new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.38, metalness: 0.04,
          polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), 'fuselage', sideKey(side));
      m.userData.noAO = true;
    }
  }

  // Radome
  add(airframe, gridSurface((u, v) => fusePt(lerp(0, 1.52, u), v * Math.PI * 2), 24, 64), M.radome, 'radome');

  // Flight deck windows: No. 1 (windshield, meeting at the centre post), No. 2 and No. 3 each side.
  // Corners are [X, theta-from-top in degrees]: bottom-front, bottom-aft, top-aft, top-front.
  {
    const quad = (c, side, off, grow = 0, nu = 8, nv = 8) => gridSurface((u, v) => {
      const lerp2 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
      const bot = lerp2(c[0], c[1], u), top = lerp2(c[3], c[2], u);
      let [X, thd] = lerp2(bot, top, v);
      X += (u - 0.5) * 2 * grow;
      thd += (0.5 - v) * 2 * grow * 40;
      return fusePt(X, side * Math.max(0.5, thd) * DEG, off);
    }, nu, nv, { closedV: false });
    const PANES = [
      [[1.62, 2.2], [3.1, 53], [3.04, 25], [2.2, 2.2]],
      [[3.2, 53.5], [3.95, 55.5], [3.86, 35], [3.13, 26]],
      [[4.04, 56], [4.5, 57], [4.42, 45], [3.96, 34]],
    ];
    for (const side of [-1, 1]) {
      const sk = sideKey(side);
      PANES.forEach((c) => {
        add(airframe, quad(c, side, 0.006, 0.045), M.frame, 'flight-deck-windows', sk);
        add(airframe, quad(c, side, 0.011), M.glass, 'flight-deck-windows', sk);
      });
      // windshield wiper parked along the bottom of the No. 1 pane
      const a = V(...fusePt(2.8, side * 41 * DEG, 0.03)), b = V(...fusePt(2.12, side * 22 * DEG, 0.03));
      cylinderBetween(airframe, a, b, 0.012, M.frame, 'flight-deck-windows', sk);
      cylinderBetween(airframe, a, V(...fusePt(2.86, side * 44.5 * DEG, 0.012)), 0.02, M.frame, 'flight-deck-windows', sk);
    }
    // centre post between the two No. 1 panes
    add(airframe, gridSurface((u, v) => fusePt(lerp(1.56, 2.28, u), lerp(-2.6, 2.6, v) * DEG, 0.009), 6, 2, { closedV: false }),
      M.frame, 'flight-deck-windows');
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
    const kind = dd.hinge === 'top' ? 'exit' : dd.hinge === 'cargo' ? 'cargo' : 'entry';
    const mat = doorMaterial(M.door, kind, Math.round(((X1 - X0) / (Y1 - Y0)) * 20) / 20);
    add(pv.inner, sidePatch(X0, X1, Y0, Y1, dd.side, 0.013, 8, 12), mat, dd.id, sk);
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
      return pv.inner;
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
    const ailInner = hinged(rig.ailerons, { s0: 12.5, s1: 16.5, t0: 0.75, t1: 1, nu: 8, nv: 20 }, 0.75, 'camber', M.surface, 'aileron');
    const te = (pf, mp, sx) => { const q = pf.point(sx, 1, true); return V(...mp(sx, q.X, q.N)); };
    wicks(ailInner, [13.2, 14.6, 15.9].map((sx) => [te(WING, map, sx), V(-1, 0, side * 0.12)]), 'aileron', sk);

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
    // dischargers on the fixed wingtip trailing edge and the winglet trailing edge
    wicks(W, [[te(WING, map, 16.85), V(-1, 0, side * 0.1)]], 'wing', sk);
    wicks(W, [1.9, 2.75].map((sx) => [te(WL, wlMap, sx), V(-1, 0.25, 0)]), 'winglet', sk, 0.17);

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
    // The CFM56-7B inlet is flattened along the bottom; the flat fades out towards the round fan case.
    const flatK = (xp) => lerp(0.86, 0.95, smooth(0, 0.7, xp));
    const ring = (xp, r, th, flat = true) => {
      const c = Math.cos(th);
      return [wx(X0 + xp), YC + r * c * (flat && c < 0 ? flatK(xp) : 1), zc + r * Math.sin(th)];
    };
    const tubeOf = (a, b, rf, nu, flat = true) =>
      gridSurface((u, v) => { const xp = lerp(a, b, u); return ring(xp, rf(xp), v * Math.PI * 2, flat); }, nu, 56);

    add(flightGroup, tubeOf(0, 2.6, cowlR, 30), M.paint, 'engine', sk);
    // inlet duct (acoustic liner), blending from the flattened lip to the round fan case
    add(flightGroup, gridSurface((u, v) => {
      const xp = lerp(0.02, 0.86, u), th = v * Math.PI * 2, c = Math.cos(th);
      const f = c < 0 ? lerp(flatK(xp), 1, smooth(0.15, 0.62, xp)) : 1;
      return [wx(X0 + xp), YC - 0.02 * smooth(0.15, 0.62, xp) + 0.86 * c * f, zc + 0.86 * Math.sin(th)];
    }, 8, 56), M.liner, 'engine', sk);
    // polished inlet lip
    add(flightGroup, gridSurface((u, v) => ring(-0.05 * Math.sin(Math.PI * u), lerp(0.905, 0.86, u), v * Math.PI * 2),
      8, 56, {}), M.brushed, 'engine', sk);
    // fan face behind the blades
    const fan = add(flightGroup, new THREE.CircleGeometry(0.86, 48), M.liner, 'engine', sk);
    fan.position.set(wx(X0 + 0.84), YC - 0.02, zc);
    fan.rotation.y = Math.PI / 2;
    // 24 wide-chord fan blades, twisted (stagger grows towards the tip) and slightly swept
    {
      const blades = [];
      const B = 24, cx = 0.64;
      for (let i = 0; i < B; i++) {
        const phi0 = (i / B) * Math.PI * 2;
        blades.push(gridSurface((u, v) => {
          const r = lerp(0.28, 0.845, u);
          const chord = lerp(0.22, 0.4, u);
          const beta = lerp(32, 64, u ** 0.8) * DEG; // angle of the chord from the engine axis
          const q = (v - 0.5) * chord;
          const ax = cx + q * Math.cos(beta) + 0.05 * u * u;
          const phi = phi0 + (q * Math.sin(beta)) / r;
          return [wx(X0 + ax), YC - 0.02 + r * Math.cos(phi), zc + r * Math.sin(phi)];
        }, 6, 3, { closedV: false }));
      }
      add(flightGroup, mergeGeometries(blades), M.blade, 'engine', sk);
    }
    // spinner with the painted spiral (lathe: tip → base)
    {
      const prof = [];
      for (let i = 0; i <= 16; i++) {
        const t = i / 16;
        prof.push(new THREE.Vector2(0.285 * Math.sin((t * Math.PI) / 2) ** 0.9 + 0.0001, 0.56 * (1 - t)));
      }
      const sp = add(flightGroup, new THREE.LatheGeometry(prof, 40), M.spinner, 'engine', sk);
      sp.position.set(wx(X0 + 0.66), YC - 0.02, zc);
      sp.rotation.z = -Math.PI / 2;
    }
    // core cowl, primary nozzle and plug
    add(flightGroup, tubeOf(3.65, 4.95, coreR, 14, false), M.metal, 'engine', sk);
    add(flightGroup, tubeOf(4.9, 4.97, () => 0.43, 1, false), M.darkMetal, 'engine', sk);
    add(flightGroup, tubeOf(4.85, 5.55, plugR, 10, false), M.darkMetal, 'engine', sk);

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
  const gearPaint = withValues(M.paint, { color: '#bcc1c7', roughness: 0.42, metalness: 0.2 });
  const tread = M.tire;
  // Wheel: lathe-profiled tire (tread grooves via normal map), rim, hub face with bolts, brake on the inboard side.
  // c = wheel centre, out = +1/−1 direction of the outboard face along z.
  function wheel(G, c, { R, rim, W, part, side, out, brake = false }) {
    const h = W / 2;
    const prof = [
      [rim, -h * 0.8], [lerp(rim, R, 0.5), -h], [R - 0.035, -h * 0.9], [R, -h * 0.62], [R, 0],
      [R, h * 0.62], [R - 0.035, h * 0.9], [lerp(rim, R, 0.5), h], [rim, h * 0.8],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const tire = add(G, new THREE.LatheGeometry(prof, 48), tread, part, side);
    tire.position.copy(c);
    tire.rotation.x = Math.PI / 2;
    const hub = add(G, new THREE.CylinderGeometry(rim, rim, W * 0.8, 32, 1, true), M.metal, part, side);
    hub.position.copy(c);
    hub.rotation.x = Math.PI / 2;
    for (const f of brake ? [out] : [out, -out]) {
      const face = add(G, new THREE.CircleGeometry(rim * 0.99, 32), M.hubFace, part, side);
      face.position.copy(c).add(V(0, 0, f * W * 0.36));
      if (f < 0) face.rotation.y = Math.PI;
    }
    if (brake) {
      const b = add(G, new THREE.CylinderGeometry(rim * 0.86, rim * 0.86, W * 0.72, 24), M.darkMetal, part, side);
      b.position.copy(c).add(V(0, 0, -out * W * 0.12));
      b.rotation.x = Math.PI / 2;
      const housing = add(G, new THREE.CylinderGeometry(rim * 0.62, rim * 0.7, 0.08, 20), M.darkMetal, part, side);
      housing.position.copy(c).add(V(0, 0, -out * (W * 0.36 + 0.03)));
      housing.rotation.x = Math.PI / 2;
    }
  }

  for (const side of [-1, 1]) {
    const sk = sideKey(side);
    const gx = wx(19.4), gz = side * 2.86;
    const ay = 0.56 - LIFT; // axle at 0.56 m above the ground in airframe coordinates
    const pv = makePivot(airframe, V(gx, 1.2, gz));
    const G = pv.inner;
    // shock strut: painted outer cylinder, chrome inner piston
    cylinderBetween(G, V(gx, 1.3, gz), V(gx, ay + 0.55, gz), 0.1, gearPaint, 'main-gear', sk);
    cylinderBetween(G, V(gx, ay + 0.6, gz), V(gx, ay + 0.52, gz), 0.115, gearPaint, 'main-gear', sk); // gland nut
    cylinderBetween(G, V(gx, ay + 0.65, gz), V(gx, ay + 0.06, gz), 0.072, M.metal, 'main-gear', sk);
    cylinderBetween(G, V(gx, ay, gz - 0.5), V(gx, ay, gz + 0.5), 0.06, M.darkMetal, 'main-gear', sk);
    // torque links (scissor) on the front of the strut
    const apex = V(gx + 0.27, ay + 0.34, gz);
    cylinderBetween(G, V(gx + 0.08, ay + 0.62, gz), apex, 0.028, gearPaint, 'main-gear', sk);
    cylinderBetween(G, apex, V(gx + 0.08, ay + 0.1, gz), 0.028, gearPaint, 'main-gear', sk);
    const pin = add(G, new THREE.CylinderGeometry(0.035, 0.035, 0.1, 12), M.darkMetal, 'main-gear', sk);
    pin.position.copy(apex); pin.rotation.x = Math.PI / 2;
    // side strut (folding brace) up and inboard, drag brace forward, and the brake hydraulic line
    cylinderBetween(G, V(gx - 0.02, ay + 0.95, gz - side * 0.06), V(gx - 0.02, 1.26, gz - side * 0.92), 0.045, gearPaint, 'main-gear', sk);
    cylinderBetween(G, V(gx + 0.04, ay + 1.05, gz), V(gx + 0.75, 1.24, gz), 0.04, gearPaint, 'main-gear', sk);
    cylinderBetween(G, V(gx - 0.11, 1.25, gz + side * 0.05), V(gx - 0.11, ay + 0.2, gz + side * 0.05), 0.012, M.darkMetal, 'main-gear', sk);
    for (const dz of [-0.42, 0.42]) {
      wheel(G, V(gx, ay, gz + dz), { R: 0.565, rim: 0.27, W: 0.42, part: 'main-gear', side: sk, out: Math.sign(dz), brake: true });
    }
    rig.mainGear.push({ pivot: pv.pivot, axis: V(1, 0, 0), side });
  }
  {
    const nx = wx(4.55);
    const ny = 0.35 - LIFT; // nose axle 0.35 m above the ground
    const pv = makePivot(airframe, V(nx, 1.35, 0));
    const G = pv.inner;
    cylinderBetween(G, V(nx, 1.45, 0), V(nx, ny + 0.3, 0), 0.075, gearPaint, 'nose-gear');
    cylinderBetween(G, V(nx, ny + 0.45, 0), V(nx, ny, 0), 0.055, M.metal, 'nose-gear');
    cylinderBetween(G, V(nx, ny, -0.3), V(nx, ny, 0.3), 0.04, M.darkMetal, 'nose-gear');
    cylinderBetween(G, V(nx - 0.05, 1.25, 0), V(nx - 0.55, 1.45, 0), 0.04, gearPaint, 'nose-gear');
    // steering collar and torque links (front of the strut)
    cylinderBetween(G, V(nx, ny + 0.86, 0), V(nx, ny + 0.72, 0), 0.105, M.darkMetal, 'nose-gear');
    const apex = V(nx + 0.19, ny + 0.27, 0);
    cylinderBetween(G, V(nx + 0.05, ny + 0.46, 0), apex, 0.02, gearPaint, 'nose-gear');
    cylinderBetween(G, apex, V(nx + 0.05, ny + 0.08, 0), 0.02, gearPaint, 'nose-gear');
    for (const dz of [-0.2, 0.2]) {
      wheel(G, V(nx, ny, dz), { R: 0.343, rim: 0.19, W: 0.197, part: 'nose-gear', side: 'C', out: Math.sign(dz) });
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
    wicks(pv.inner, [4.2, 5.6, 6.9].map((sx) => { const q = FIN.point(sx, 1, true); return [V(...map(sx, q.X, q.N)), V(-1, 0.05, 0)]; }), 'rudder', 'C', 0.17);
    wicks(airframe, [7.3].map((sx) => { const q = FIN.point(sx, 0.85, true); return [V(...map(sx, q.X, q.N + 0.02)), V(-1, 0.15, 0)]; }), 'vertical-fin', 'C', 0.17);
    // tail mark: a conformal decal hugging both sides of the fixed fin
    const logoMat = new THREE.MeshStandardMaterial({
      map: tailLogo(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.36, metalness: 0.08,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    for (const side of [-1, 1]) {
      const g = gridSurface((u, v) => {
        const sx = lerp(1.6, 6.9, v), t = lerp(0.06, 0.68, u);
        const q = FIN.point(sx, t, side > 0);
        return map(sx, q.X, q.N + side * 0.004);
      }, 24, 24, { closedV: false });
      const m = add(airframe, g, logoMat, 'vertical-fin', sideKey(side));
      m.userData.noAO = true;
    }
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
      add(S, liftingPiece(HS, map, { s0: 0, s1: 7.2, t0: 0, t1: 0.7, nu: 16, nv: 36 }), M.stab, 'horizontal-stabilizer', sk);
      add(S, liftingPiece(HS, map, { s0: 6.9, s1: 7.2, t0: 0.7, t1: 1, nu: 2, nv: 12 }), M.stab, 'horizontal-stabilizer', sk);
      add(S, liftingPiece(HS, map, { s0: 0, s1: 0.9, t0: 0.7, t1: 1, nu: 2, nv: 12 }), M.stab, 'horizontal-stabilizer', sk);
      const [A, B] = hingeLine(HS, map, 0.9, 6.9, 0.7);
      const pv = makePivot(S, A);
      add(pv.inner, liftingPiece(HS, map, { s0: 0.9, s1: 6.9, t0: 0.7, t1: 1, nu: 10, nv: 20 }), M.surface, 'elevator', sk);
      wicks(pv.inner, [3.4, 5.0, 6.5].map((sx) => { const q = HS.point(sx, 1, true); return [V(...map(sx, q.X, q.N)), V(-1, 0, side * 0.1)]; }), 'elevator', sk, 0.17);
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
    add(pv.inner, sidePatch(Xa, Xb, Ya, Yb, 1, 0.013), doorMaterial(M.door, 'panel', 1.85), 'apu', 'R');
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
