// Procedural Diamond DA42 NG / DA42-VI built from published dimensions (meters).
// Span 13.42 m (TCDS), length 8.56 m, height 2.49 m, wing area 16.29 m², prop diameter 1.87–1.90 m.
// Axes: +x forward (nose), +y up, +z right wing. Design stations use X = meters aft of the nose tip.
// Every component is its own mesh tagged with userData.partId so it can be picked and animated.
// Surface detail (seams, livery, walkways, decals) comes from canvas textures in model-textures.js.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  DEG, lerp, clamp, gridSurface, interpStations, makePlanform, liftingPiece,
  camberLine, makePivot, glowTexture,
} from '../../core/geometry.js';
import {
  fuselageMaps, surfaceMaps, walkwayMap, tireMaps, hubMap, finLogo, titleDecal, bladeMap,
} from './model-textures.js';

const NOSE_X = 3.0; // world x of the nose tip; puts the origin near the main gear / CG
const wx = (X) => NOSE_X - X;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const spow = (v, p) => Math.sign(v) * Math.abs(v) ** p;

// ---- Fuselage: half-width w, top / beltline / bottom heights (m above ground), top narrowing k, exponent p
const FUSE = [
  { X: 0, w: 0.015, top: 0.93, belt: 0.92, bot: 0.91, k: 0, p: 1 },
  { X: 0.15, w: 0.12, top: 1.0, belt: 0.93, bot: 0.83, k: 0.05, p: 1 },
  { X: 0.4, w: 0.22, top: 1.07, belt: 0.93, bot: 0.75, k: 0.08, p: 0.95 },
  { X: 0.8, w: 0.32, top: 1.15, belt: 0.92, bot: 0.68, k: 0.1, p: 0.92 },
  { X: 1.3, w: 0.42, top: 1.24, belt: 0.92, bot: 0.62, k: 0.12, p: 0.9 },
  { X: 1.75, w: 0.5, top: 1.33, belt: 0.95, bot: 0.58, k: 0.18, p: 0.88 },
  { X: 2.1, w: 0.56, top: 1.53, belt: 1.0, bot: 0.56, k: 0.26, p: 0.86 },
  { X: 2.5, w: 0.6, top: 1.71, belt: 1.02, bot: 0.55, k: 0.3, p: 0.85 },
  { X: 2.9, w: 0.61, top: 1.785, belt: 1.03, bot: 0.55, k: 0.32, p: 0.85 },
  { X: 3.4, w: 0.61, top: 1.775, belt: 1.03, bot: 0.555, k: 0.32, p: 0.85 },
  { X: 3.9, w: 0.58, top: 1.72, belt: 1.03, bot: 0.58, k: 0.3, p: 0.86 },
  { X: 4.4, w: 0.52, top: 1.6, belt: 1.04, bot: 0.65, k: 0.26, p: 0.88 },
  { X: 5.0, w: 0.43, top: 1.47, belt: 1.06, bot: 0.76, k: 0.2, p: 0.9 },
  { X: 5.8, w: 0.32, top: 1.36, belt: 1.09, bot: 0.9, k: 0.14, p: 0.93 },
  { X: 6.6, w: 0.22, top: 1.3, belt: 1.12, bot: 1.0, k: 0.1, p: 0.95 },
  { X: 7.4, w: 0.15, top: 1.27, belt: 1.15, bot: 1.06, k: 0.08, p: 1 },
  { X: 8.0, w: 0.09, top: 1.25, belt: 1.17, bot: 1.1, k: 0.05, p: 1 },
  { X: 8.25, w: 0.03, top: 1.22, belt: 1.18, bot: 1.14, k: 0, p: 1 },
];
const FUSE_X0 = 0, FUSE_X1 = 8.25;
const fuseAt = (X) => interpStations(FUSE, 'X', X);
function fusePt(X, th, off = 0) {
  const st = fuseAt(X);
  const c = Math.cos(th), s = Math.sin(th);
  const hy = c >= 0 ? st.top - st.belt : st.belt - st.bot;
  const y = st.belt + (hy + off) * spow(c, st.p);
  const z = (st.w + off) * spow(s, st.p) * (c > 0 ? 1 - st.k * c * c : 1);
  return [wx(X), y, z];
}
function fuseTheta(X, Y, side) {
  const st = fuseAt(X);
  const c = Y >= st.belt
    ? clamp((Y - st.belt) / (st.top - st.belt), 0, 1) ** (1 / st.p)
    : -(clamp((st.belt - Y) / (st.belt - st.bot), 0, 1) ** (1 / st.p));
  return side * Math.acos(clamp(c, -1, 1));
}
const fuseSidePt = (X, Y, side, off = 0) => fusePt(X, fuseTheta(X, Y, side), off);
function fuseNormal(X, th) {
  const e = 1e-3;
  const p = V(...fusePt(X, th));
  const dT = V(...fusePt(X, th + e)).sub(V(...fusePt(X, th - e)));
  const dX = V(...fusePt(X + e, th)).sub(V(...fusePt(X - e, th)));
  const n = dT.clone().cross(dX).normalize();
  const st = fuseAt(X);
  if (n.dot(V(0, p.y - st.belt, p.z)) < 0) n.negate();
  return n;
}

// ---- Wing: centre (stub) wing to the nacelles, outer wings with dihedral (TCDS: stub-wing joint)
const WY = 0.8; // chord plane height of the stub wing
const JOINT = 2.05; // stub / outer wing joint (just outboard of the nacelle)
const TIP = 6.45; // outer wing tip, winglet beyond
const DIHEDRAL = 5 * DEG;
const STUB = makePlanform([
  { s: 0, le: 2.55, c: 1.62, tc: 0.165 },
  { s: JOINT, le: 2.55, c: 1.62, tc: 0.155 },
], 0.02);
const OUTER = makePlanform([
  { s: JOINT, le: 2.55, c: 1.62, tc: 0.155 },
  { s: TIP, le: 2.79, c: 0.92, tc: 0.12 },
], 0.02);
const NAC_Z = 1.72; // nacelle centreline (m from the aircraft centreline)
const HUB_X = 1.18, HUB_Y = 1.18; // propeller hub station and thrust-line height
const PROP_R = 0.95; // MT 3-blade, 1.90 m diameter (1.87 m on earlier aircraft)

// ---- Nacelle sections (X, half-width hw, top, bot)
const NAC = [
  { X: 1.3, hw: 0.19, top: 1.37, bot: 0.99 },
  { X: 1.5, hw: 0.265, top: 1.42, bot: 0.87 },
  { X: 1.9, hw: 0.29, top: 1.46, bot: 0.8 },
  { X: 2.5, hw: 0.29, top: 1.45, bot: 0.75 },
  { X: 3.2, hw: 0.27, top: 1.38, bot: 0.73 },
  { X: 3.9, hw: 0.22, top: 1.25, bot: 0.75 },
  { X: 4.5, hw: 0.13, top: 1.1, bot: 0.81 },
  { X: 4.85, hw: 0.035, top: 0.99, bot: 0.91 },
];
const nacAt = (X) => interpStations(NAC, 'X', X);
function nacPt(X, th, side, off = 0) {
  const st = nacAt(X);
  const cy = (st.top + st.bot) / 2, hh = (st.top - st.bot) / 2;
  return [wx(X), cy + (hh + off) * spow(Math.cos(th), 0.9), side * NAC_Z + (st.hw + off) * spow(Math.sin(th), 0.9)];
}

// ---- Materials (the viewer clones these per mesh)
function makeMaterials() {
  const std = (o) => new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, ...o });
  const hi = !(window.innerWidth <= 820 || (navigator.hardwareConcurrency || 8) <= 2);
  const fm = fuselageMaps({
    X0: FUSE_X0, X1: FUSE_X1, thetaAt: fuseTheta, hi,
    seams: [[4.25, 0.7, 1.0], [6.45, 1.02, 1.28]],
    panels: [[5.6, 5.9, 0.98, 1.12, -1], [5.6, 5.9, 0.98, 1.12, 1], [6.9, 7.15, 1.08, 1.2, 1]],
  });
  const sm = surfaceMaps({ hi });
  const tread = tireMaps(3);
  const white = '#f6f7f4';
  const comp = (o = {}) => std({
    color: white, roughness: 1, metalness: 0.02, normalMap: sm.normalMap, normalScale: new THREE.Vector2(0.35, 0.35),
    roughnessMap: sm.roughnessMap, ...o,
  });
  const walk = (side) => std({ color: '#ffffff', map: walkwayMap({ side }), roughness: 0.4, metalness: 0.02 });
  return {
    fuse: std({ color: '#ffffff', map: fm.map, normalMap: fm.normalMap, normalScale: new THREE.Vector2(0.5, 0.5), roughnessMap: fm.roughnessMap, roughness: 1, metalness: 0.03 }),
    paint: std({ color: white, roughness: 0.3, metalness: 0.03 }),
    panel: std({ color: '#eceeea', roughness: 0.34, metalness: 0.03 }),
    seam: std({ color: '#8c939a', roughness: 0.6, metalness: 0.1 }),
    wing: comp(),
    walkL: walk(-1),
    walkR: walk(1),
    surface: comp({ color: '#f1f2ef' }),
    tks: std({ color: '#9ea4aa', roughness: 0.5, metalness: 0.7 }),
    metal: std({ color: '#c3c8cd', roughness: 0.28, metalness: 0.85 }),
    darkMetal: std({ color: '#40454c', roughness: 0.45, metalness: 0.6 }),
    exhaust: std({ color: '#5a4f47', roughness: 0.6, metalness: 0.7 }),
    gear: std({ color: '#e3e6e8', roughness: 0.4, metalness: 0.15 }),
    rubber: std({ color: '#1b1d20', roughness: 0.9, metalness: 0 }),
    tire: std({ color: '#1e2023', roughness: 1, metalness: 0, normalMap: tread.normalMap, roughnessMap: tread.roughnessMap }),
    hubFace: std({ color: '#ffffff', map: hubMap(), roughness: 0.35, metalness: 0.7 }),
    spinner: std({ color: white, roughness: 0.22, metalness: 0.05 }),
    blade: std({ color: '#ffffff', map: bladeMap(), roughness: 0.45, metalness: 0.15 }),
    sheath: std({ color: '#c9ced3', roughness: 0.25, metalness: 0.9 }),
    frame: std({ color: '#25292e', roughness: 0.6, metalness: 0.2 }),
    glass: std({ color: '#0d1720', roughness: 0.03, metalness: 0.55, envMapIntensity: 1.5 }),
    hole: std({ color: '#0b0d10', roughness: 1, metalness: 0 }),
    interior: std({ color: '#2a2e33', roughness: 0.85, metalness: 0.05 }),
    bulb: std({ color: '#d8d8d8', roughness: 0.2, metalness: 0.1 }),
    lens: std({ color: '#cfd8e0', roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.55 }),
    wick: std({ color: '#2b2f34', roughness: 0.5, metalness: 0.4 }),
    navy: std({ color: '#1d2c54', roughness: 0.35, metalness: 0.08 }),
  };
}

/** Hinge line on a planform's camber line at chord fraction t (handles symmetric planforms). */
function hingeAt(pf, map, s0, s1, t, camber) {
  const pt = (s) => {
    const st = pf.at(s);
    return V(...map(s, st.le + t * st.c, camberLine(t, camber) * st.c + (st.off || 0)));
  };
  return [pt(s0), pt(s1)];
}

export function buildModel() {
  const M = makeMaterials();
  const root = new THREE.Group();
  root.name = 'da42';
  const flightGroup = new THREE.Group(); // moves for lift-off
  root.add(flightGroup);
  const airframe = flightGroup;

  const rig = {
    airframe: flightGroup,
    flaps: [], ailerons: [], elevators: [], elevatorTab: null, rudder: null, rudderTab: null,
    mainGear: [], noseGear: null, noseDoors: [], gearWells: [],
    props: [], canopy: null, rearDoor: null, noseBaggage: [],
    lights: { nav: [], strobe: [], landing: [], taxi: [], ice: [] },
  };

  const add = (parent, geom, mat, partId, side = 'C') => {
    const m = new THREE.Mesh(geom, mat);
    m.userData.partId = partId;
    m.userData.side = side;
    parent.add(m);
    return m;
  };
  const sideKey = (s) => (s < 0 ? 'L' : 'R');

  function cylinderBetween(parent, a, b, r, mat, partId, side, seg = 12) {
    const dir = b.clone().sub(a);
    const len = dir.length();
    const m = add(parent, new THREE.CylinderGeometry(r, r, len, seg), mat, partId, side);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(V(0, 1, 0), dir.normalize());
    return m;
  }
  function fusePatch(X0, X1, th0, th1, off, nu = 8, nv = 10) {
    return gridSurface((u, v) => {
      const X = lerp(X0, X1, u);
      const a = typeof th0 === 'function' ? th0(X) : th0;
      const b = typeof th1 === 'function' ? th1(X) : th1;
      return fusePt(X, lerp(a, b, v), off);
    }, nu, nv, { closedV: false });
  }
  function sidePatch(X0, X1, Y0, Y1, side, off, nu = 8, nv = 10) {
    return gridSurface((u, v) => {
      const X = lerp(X0, X1, u);
      const y0 = typeof Y0 === 'function' ? Y0(X) : Y0, y1 = typeof Y1 === 'function' ? Y1(X) : Y1;
      return fuseSidePt(X, lerp(y0, y1, v), side, off);
    }, nu, nv, { closedV: false });
  }
  function nacPatch(X0, X1, th0, th1, side, off, nu = 4, nv = 6) {
    return gridSurface((u, v) => nacPt(lerp(X0, X1, u), lerp(th0, th1, v), side, off), nu, nv, { closedV: false });
  }
  /** Small flush disc on a surface point p with outward normal n. */
  function disc(parent, p, n, r, mat, partId, side, seg = 20) {
    const m = add(parent, new THREE.CircleGeometry(r, seg), mat, partId, side);
    m.position.copy(p);
    m.lookAt(p.clone().add(n));
    return m;
  }
  // Static dischargers trailing from a trailing edge, merged into one mesh: [[base, dir], ...]
  function wicks(parent, pts, partId, side, len = 0.1) {
    const geoms = pts.map(([base, dir]) => {
      const g = new THREE.CylinderGeometry(0.003, 0.004, len, 5);
      g.translate(0, len / 2, 0);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir.clone().normalize()));
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
  function makeLight(parent, kind, pos, color, partId, side, { size = 0.025, glow = 0.45, spot = null } = {}) {
    const mesh = add(parent, new THREE.SphereGeometry(size, 14, 10), M.bulb, partId, side);
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
      spotLight = new THREE.SpotLight(color, 0, spot.distance ?? 40, spot.angle ?? 0.3, 0.55, 1.1);
      spotLight.position.copy(pos);
      spotLight.target.position.copy(pos).add(spot.dir);
      parent.add(spotLight, spotLight.target);
    }
    rig.lights[kind].push({ mesh, sprite, color: new THREE.Color(color), spot: spotLight, side });
    return mesh;
  }

  // ================================================================== Fuselage
  {
    add(airframe, gridSurface((u, v) => fusePt(lerp(FUSE_X0, FUSE_X1, u), v * Math.PI * 2), 150, 80, { capEnd: true }), M.fuse, 'fuselage');
    // AirCrafty title on the tail boom, both sides
    for (const side of [-1, 1]) {
      const m = add(airframe, sidePatch(4.95, 5.9, 1.13, 1.28, side, 0.003, 10, 4),
        new THREE.MeshStandardMaterial({ map: titleDecal(side), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.32, metalness: 0.03,
          polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), 'fuselage', sideKey(side));
      m.userData.noAO = true;
    }
  }

  // ================================================================== Front canopy (forward-hinged, opens up)
  {
    const CX0 = 1.8, CX1 = 3.15;
    const sill = (X) => lerp(1.3, 1.1, smooth(1.8, 2.45, X));
    const th = (X, side, dy = 0) => fuseTheta(X, sill(X) + dy, side);
    // interior revealed when the canopy is open
    add(airframe, fusePatch(CX0, CX1, (X) => th(X, -1), (X) => th(X, 1), 0.004, 14, 16), M.interior, 'front-canopy');
    const hingeP = V(...fusePt(CX0 - 0.02, 0, 0.016));
    const pv = makePivot(airframe, hingeP);
    // frame (dark border) and glass
    add(pv.inner, fusePatch(CX0 - 0.02, CX1 + 0.03, (X) => th(X, -1, -0.025), (X) => th(X, 1, -0.025), 0.01, 14, 18), M.frame, 'front-canopy');
    add(pv.inner, fusePatch(CX0 + 0.02, CX1 - 0.02, (X) => th(X, -1), (X) => th(X, 1), 0.015, 16, 20), M.glass, 'front-canopy');
    // latch handles at the sides of the canopy frame
    for (const side of [-1, 1]) {
      const p = V(...fuseSidePt(2.95, 1.12, side, 0.02));
      const h = add(pv.inner, new THREE.BoxGeometry(0.1, 0.02, 0.02), M.darkMetal, 'front-canopy', sideKey(side));
      h.position.copy(p);
    }
    rig.canopy = { pivot: pv.pivot, axis: V(0, 0, 1), angle: -52 * DEG };
  }

  // ================================================================== Rear passenger door (left, top-hinged) and right window
  {
    const DX0 = 3.22, DX1 = 4.12, DY0 = 1.0;
    const topTh = -0.2; // door top edge, near the roof
    const thBot = (X) => fuseTheta(X, DY0, -1);
    add(airframe, fusePatch(DX0, DX1, thBot, topTh, 0.005, 10, 10), M.interior, 'rear-door', 'L');
    const A = V(...fusePt((DX0 + DX1) / 2, topTh, 0.014));
    const pv = makePivot(airframe, A);
    add(pv.inner, fusePatch(DX0, DX1, thBot, topTh, 0.012, 10, 12), M.panel, 'rear-door', 'L');
    const wTh = (X) => fuseTheta(X, 1.14, -1);
    add(pv.inner, fusePatch(DX0 + 0.06, DX1 - 0.08, wTh, topTh - 0.08, 0.017, 10, 10), M.glass, 'rear-door', 'L');
    const handle = add(pv.inner, new THREE.BoxGeometry(0.12, 0.022, 0.02), M.darkMetal, 'rear-door', 'L');
    handle.position.copy(V(...fuseSidePt(3.9, 1.06, -1, 0.024)));
    rig.rearDoor = { pivot: pv.pivot, axis: V(1, 0, 0), angle: 78 * DEG };
    // fixed rear side window on the right
    add(airframe, fusePatch(DX0 + 0.06, DX1 - 0.08, (X) => fuseTheta(X, 1.14, 1), -topTh + 0.08, 0.006, 10, 10), M.glass, 'fuselage', 'R');
  }

  // ================================================================== Nose baggage compartment doors
  {
    const BX0 = 0.55, BX1 = 1.42, BY0 = 0.8, BY1 = 1.08;
    for (const side of [-1, 1]) {
      const sk = sideKey(side);
      add(airframe, sidePatch(BX0, BX1, BY0, BY1, side, 0.004), M.interior, 'nose-baggage', sk);
      const A = V(...fuseSidePt((BX0 + BX1) / 2, BY1, side, 0.012));
      const pv = makePivot(airframe, A);
      add(pv.inner, sidePatch(BX0, BX1, BY0, BY1, side, 0.009, 10, 8), M.panel, 'nose-baggage', sk);
      const lock = add(pv.inner, new THREE.CylinderGeometry(0.014, 0.014, 0.01, 14), M.darkMetal, 'nose-baggage', sk);
      const lp = fuseTheta(1.2, 0.86, side);
      lock.position.copy(V(...fusePt(1.2, lp, 0.012)));
      lock.lookAt(lock.position.clone().add(fuseNormal(1.2, lp)));
      lock.rotateX(Math.PI / 2);
      rig.noseBaggage.push({ pivot: pv.pivot, axis: V(1, 0, 0), angle: -side * 72 * DEG });
    }
  }

  // ================================================================== Wings
  const tks = (W, pf, map, s0, s1, sk, nu = 12) => add(W, liftingPiece(pf, (s, X, N) => map(s, X - 0.004, N), {
    s0, s1, t0: 0, t1: 0.07, nu, nv: 18, scaleN: 1.05, caps: false,
  }), M.tks, 'tks-system', sk);

  for (const side of [-1, 1]) {
    const sk = sideKey(side);
    const map = (s, X, N) => [wx(X), WY + N, side * s];
    const normAxis = (A, B) => { const a = B.clone().sub(A).normalize(); return a.z < 0 ? a.negate() : a; };
    const hinged = (parent, pf, list, o, tH, mat, part) => {
      const [A, B] = hingeAt(pf, map, o.s0, o.s1, tH, 0.02);
      const pv = makePivot(parent, A);
      add(pv.inner, liftingPiece(pf, map, o), mat, part, sk);
      const sm = (o.s0 + o.s1) / 2;
      list.push({ pivot: pv.pivot, base: A, axis: normAxis(A, B), side, chord: pf.at(sm).c });
      return pv.inner;
    };
    const te = (pf, sx) => { const q = pf.point(sx, 1, true); return V(...map(sx, q.X, q.N)); };

    // ---- stub wing (flat), walkway on the upper surface
    add(airframe, liftingPiece(STUB, map, { s0: 0.3, s1: JOINT, t0: 0, t1: 0.74, nu: 12, nv: 40, caps: false }),
      side < 0 ? M.walkL : M.walkR, 'wing', sk);
    add(airframe, liftingPiece(STUB, map, { s0: 0.3, s1: 0.64, t0: 0.74, t1: 1, nu: 2, nv: 12 }), M.wing, 'wing', sk);
    add(airframe, liftingPiece(STUB, map, { s0: 1.4, s1: JOINT, t0: 0.74, t1: 1, nu: 3, nv: 12 }), M.wing, 'wing', sk);
    hinged(airframe, STUB, rig.flaps, { s0: 0.645, s1: 1.395, t0: 0.74, t1: 1, nu: 6, nv: 20 }, 0.74, M.surface, 'flaps');
    tks(airframe, STUB, map, 0.62, 1.42, sk, 4);
    // main gear bay in the stub wing underside
    // (not pickable: keeps the main-gear hotspot on the leg rather than the bay)
    { const well = new THREE.Mesh(liftingPiece(STUB, map, { s0: 0.66, s1: 1.56, t0: 0.15, t1: 0.62, nu: 3, nv: 8, plate: 'lower', plateT: 0.003 }), M.hole); airframe.add(well); rig.gearWells.push(well); }
    // fuel drain (aux tank sump is in the nacelle, see below) and main-tank drain at the inner end of the outer tank
    {
      const q = STUB.point(1.95, 0.42, false);
      const p = V(...map(2.0, q.X, q.N - 0.01));
      cylinderBetween(airframe, p, p.clone().add(V(0, -0.03, 0)), 0.008, M.metal, 'fuel-drains', sk, 8);
    }

    // ---- outer wing (dihedral about the joint)
    const wg = new THREE.Group();
    wg.position.set(0, WY, side * JOINT);
    wg.rotation.x = -side * DIHEDRAL;
    airframe.add(wg);
    const W = new THREE.Group();
    W.position.set(0, -WY, -side * JOINT);
    wg.add(W);
    add(W, liftingPiece(OUTER, map, { s0: JOINT, s1: TIP, t0: 0, t1: 0.74, nu: 26, nv: 40 }), M.wing, 'wing', sk);
    add(W, liftingPiece(OUTER, map, { s0: 4.2, s1: 4.26, t0: 0.74, t1: 1, nu: 1, nv: 12 }), M.wing, 'wing', sk);
    add(W, liftingPiece(OUTER, map, { s0: 6.32, s1: TIP, t0: 0.74, t1: 1, nu: 2, nv: 12 }), M.wing, 'wing', sk);
    hinged(W, OUTER, rig.flaps, { s0: JOINT + 0.03, s1: 4.2, t0: 0.74, t1: 1, nu: 10, nv: 20 }, 0.74, M.surface, 'flaps');
    const ail = hinged(W, OUTER, rig.ailerons, { s0: 4.26, s1: 6.32, t0: 0.74, t1: 1, nu: 10, nv: 20 }, 0.74, M.surface, 'aileron');
    wicks(ail, [5.2, 6.1].map((sx) => [te(OUTER, sx), V(-1, 0, side * 0.1)]), 'static-dischargers', sk);
    tks(W, OUTER, map, JOINT + 0.02, TIP, sk, 16);
    // flap actuator fairings (lower surface hinge brackets)
    for (const s of [2.6, 3.7]) {
      const st = OUTER.at(s);
      const Xa = st.le + 0.62 * st.c, Xb = st.le + st.c + 0.05;
      add(W, gridSurface((u, v) => {
        const X = lerp(Xa, Xb, u);
        const t = clamp((X - st.le) / st.c, 0, 1);
        const lowerN = OUTER.point(s, t, false).N;
        const k = Math.sin(Math.PI * u);
        const th = v * Math.PI * 2;
        return [wx(X), WY + lowerN + 0.01 - 0.07 * k ** 0.6 * (0.5 - 0.5 * Math.cos(th)), side * s + 0.025 * k ** 0.5 * Math.sin(th)];
      }, 10, 10), M.surface, 'flaps', sk);
    }

    // main fuel tank filler cap (outer wing upper surface, just outboard of the nacelle)
    {
      const s = 2.75, q = OUTER.point(s, 0.32, true);
      const p = V(...map(s, q.X, q.N + 0.003));
      disc(W, p, V(0, 1, 0), 0.045, M.metal, 'main-fuel-tanks', sk);
      disc(W, p.clone().add(V(0, 0.002, 0)), V(0, 1, 0), 0.028, M.darkMetal, 'main-fuel-tanks', sk);
    }
    // fuel tank vent (underside, outboard)
    {
      const s = 3.3, q = OUTER.point(s, 0.4, false);
      const p = V(...map(s, q.X, q.N));
      cylinderBetween(W, p, p.clone().add(V(0.05, -0.035, 0)), 0.007, M.darkMetal, 'fuel-vents', sk, 8);
    }
    // tie-down ring under the outer wing
    {
      const s = 4.85, q = OUTER.point(s, 0.35, false);
      const ring = add(W, new THREE.TorusGeometry(0.025, 0.006, 8, 18), M.metal, 'tie-downs', sk);
      ring.position.copy(V(...map(s, q.X, q.N - 0.03)));
      cylinderBetween(W, V(...map(s, q.X, q.N)), V(...map(s, q.X, q.N - 0.008)), 0.012, M.metal, 'tie-downs', sk);
    }
    // left wing: pitot-static probe (underside) and stall warning inlet (leading edge)
    if (side < 0) {
      const s = 4.65, q = OUTER.point(s, 0.18, false);
      const base = V(...map(s, q.X, q.N));
      const elbow = base.clone().add(V(0, -0.11, 0));
      const mast = cylinderBetween(W, base, elbow, 0.012, M.metal, 'pitot-static', sk);
      mast.scale.set(1, 1, 2.2);
      cylinderBetween(W, elbow.clone().add(V(-0.04, 0, 0)), elbow.clone().add(V(0.24, 0, 0)), 0.009, M.metal, 'pitot-static', sk);
      const tip = add(W, new THREE.CylinderGeometry(0.004, 0.009, 0.02, 10), M.darkMetal, 'pitot-static', sk);
      tip.position.copy(elbow.clone().add(V(0.25, 0, 0)));
      tip.rotation.z = -Math.PI / 2;
      // stall warning: small opening in the leading edge
      const ss = 3.55, sq = OUTER.point(ss, 0.004, false);
      const sp = V(...map(ss, sq.X + 0.002, sq.N - 0.01));
      const plate = add(W, new THREE.BoxGeometry(0.006, 0.03, 0.06), M.metal, 'stall-warning', sk);
      plate.position.copy(sp);
      const slot = add(W, new THREE.BoxGeometry(0.007, 0.01, 0.04), M.hole, 'stall-warning', sk);
      slot.position.copy(sp.clone().add(V(0.001, 0, 0)));
    }

    // ---- winglet (upturned, swept)
    const WL = makePlanform([
      { s: 0, le: 2.79, c: 0.92, tc: 0.12 },
      { s: 0.14, le: 2.88, c: 0.82, tc: 0.11 },
      { s: 0.52, le: 3.28, c: 0.42, tc: 0.09 },
    ], 0);
    const r = 0.13, phiM = 78 * DEG, Lb = r * phiM;
    const wlFrame = (s) => {
      if (s <= Lb) { const phi = s / r; return { phi, out: r * Math.sin(phi), up: r * (1 - Math.cos(phi)) }; }
      return { phi: phiM, out: r * Math.sin(phiM) + (s - Lb) * Math.cos(phiM), up: r * (1 - Math.cos(phiM)) + (s - Lb) * Math.sin(phiM) };
    };
    const wlMap = (s, X, N) => {
      const f = wlFrame(s);
      return [wx(X), WY + f.up + N * Math.cos(f.phi), side * (TIP + f.out - N * Math.sin(f.phi))];
    };
    add(W, liftingPiece(WL, wlMap, { s0: 0, s1: 0.52, nu: 14, nv: 28 }), M.wing, 'winglets', sk);
    // accent tip on the winglet
    add(W, liftingPiece(WL, (s, X, N) => wlMap(s, X, N * 1.04), { s0: 0.4, s1: 0.52, nu: 3, nv: 20 }), M.navy, 'winglets', sk);
    // wingtip lights: position (red L / green R) + strobe in one unit at the front, white position light aft
    const fq = WL.at(0.05);
    const navPos = V(...wlMap(0.05, fq.le - 0.012, 0));
    add(W, new THREE.SphereGeometry(0.045, 14, 10), M.lens, 'nav-lights', sk).position.copy(navPos);
    makeLight(W, 'nav', navPos, side < 0 ? '#ff2a2a' : '#22ff6a', 'nav-lights', sk, { size: 0.022, glow: 0.6 });
    makeLight(W, 'strobe', navPos.clone().add(V(-0.05, 0.012, side * 0.012)), '#ffffff', 'strobe-lights', sk, { size: 0.016, glow: 1.4 });
    const aq = WL.at(0.12);
    makeLight(W, 'nav', V(...wlMap(0.12, aq.le + aq.c + 0.01, 0)), '#ffffff', 'nav-lights', sk, { size: 0.016, glow: 0.4 });
    wicks(W, [[te(OUTER, 6.38), V(-1, 0, side * 0.1)]], 'static-dischargers', sk);
  }

  // ================================================================== Engine nacelles, cowlings, propellers
  for (const side of [-1, 1]) {
    const sk = sideKey(side);
    const zc = side * NAC_Z;
    const tubeOf = (X0, X1, nu, part, mat, off = 0) =>
      add(airframe, gridSurface((u, v) => nacPt(lerp(X0, X1, u), v * Math.PI * 2, side, off), nu, 40, { capEnd: X1 >= 4.85 }), mat, part, sk);
    // engine cowling (upper/lower halves) and the aft nacelle
    tubeOf(1.3, 2.75, 22, 'engine', M.paint);
    tubeOf(2.75, 4.85, 22, 'nacelle', M.paint);
    tubeOf(2.745, 2.757, 1, 'engine', M.seam, 0.002);
    // cowling split line (upper / lower halves) along each side of the cowl
    for (const sd of [-1, 1]) {
      add(airframe, gridSurface((u, v) => nacPt(lerp(1.32, 2.74, u), sd * lerp(Math.PI / 2 - 0.015, Math.PI / 2 + 0.015, v), side, 0.002), 12, 1, { closedV: false }), M.seam, 'engine', sk);
    }
    // front face behind the spinner
    const face = add(airframe, new THREE.CircleGeometry(0.19, 32), M.darkMetal, 'engine', sk);
    face.position.set(wx(1.3), 1.18, zc);
    face.rotation.y = Math.PI / 2;

    // chin inlet (coolant radiator / intercooler / induction air) under the spinner
    {
      const ell = (X, a, b, cy, th) => [wx(X), cy + b * Math.cos(th), zc + a * Math.sin(th)];
      add(airframe, gridSurface((u, v) => ell(lerp(1.34, 1.62, u), lerp(0.15, 0.17, u), lerp(0.062, 0.08, u), lerp(0.935, 0.925, u), v * Math.PI * 2), 4, 28),
        M.paint, 'engine-inlets', sk);
      add(airframe, gridSurface((u, v) => ell(lerp(1.345, 1.5, u), 0.138, 0.052, 0.935, v * Math.PI * 2), 2, 28), M.hole, 'engine-inlets', sk);
      const back = add(airframe, new THREE.CircleGeometry(1, 28), M.hole, 'engine-inlets', sk);
      back.scale.set(0.138, 0.052, 1);
      back.position.set(wx(1.5), 0.935, zc);
      back.rotation.y = Math.PI / 2;
      // radiator core visible inside
      const core = add(airframe, new THREE.PlaneGeometry(0.22, 0.07), M.darkMetal, 'engine-inlets', sk);
      core.position.set(wx(1.45), 0.935, zc);
      core.rotation.y = Math.PI / 2;
      // NACA inlet on the inboard cowl side
      const thIn = -side * Math.PI / 2 * 0.82;
      add(airframe, gridSurface((u, v) => {
        const X = lerp(1.95, 2.18, u);
        const w = lerp(0.012, 0.035, u);
        return nacPt(X, thIn + lerp(-w, w, v) * 2.2, side, 0.003);
      }, 4, 2, { closedV: false }), M.hole, 'engine-inlets', sk);
    }
    // cooling air outlet slot at the bottom rear of the cowling
    add(airframe, nacPatch(2.48, 2.72, Math.PI - 0.32, Math.PI + 0.32, side, 0.003, 3, 6), M.hole, 'exhaust', sk);
    // exhaust stack on the lower outboard side
    {
      const a = V(...nacPt(2.5, side * 2.2, side, -0.02));
      const b = a.clone().add(V(-0.17, -0.06, side * 0.06));
      cylinderBetween(airframe, a, b, 0.036, M.exhaust, 'exhaust', sk, 16);
      const lip = add(airframe, new THREE.TorusGeometry(0.036, 0.006, 8, 18), M.exhaust, 'exhaust', sk);
      lip.position.copy(b);
      lip.lookAt(b.clone().add(b.clone().sub(a)));
      const inner = add(airframe, new THREE.CircleGeometry(0.032, 16), M.hole, 'exhaust', sk);
      inner.position.copy(b.clone().add(a.clone().sub(b).normalize().multiplyScalar(0.01)));
      inner.lookAt(b.clone().add(b.clone().sub(a)));
    }
    // oil dipstick and coolant check access doors on the upper cowling
    for (const [X0, X1, t0, t1] of [[1.68, 1.86, -0.42, -0.08], [2.1, 2.3, 0.1, 0.42]]) {
      add(airframe, nacPatch(X0 - 0.01, X1 + 0.01, t0 - 0.02, t1 + 0.02, side, 0.002), M.seam, 'cowling-access', sk);
      add(airframe, nacPatch(X0, X1, t0, t1, side, 0.004), M.panel, 'cowling-access', sk);
    }
    // aux tank filler (top of the aft nacelle) and aux tank drain (underneath)
    {
      const p = V(...nacPt(3.45, 0, side, 0.004));
      disc(airframe, p, V(0, 1, 0), 0.04, M.metal, 'aux-fuel-tanks', sk);
      disc(airframe, p.clone().add(V(0, 0.002, 0)), V(0, 1, 0), 0.024, M.darkMetal, 'aux-fuel-tanks', sk);
      const d = V(...nacPt(3.5, Math.PI, side));
      cylinderBetween(airframe, d, d.clone().add(V(0, -0.03, 0)), 0.008, M.metal, 'fuel-drains', sk, 8);
      const g = V(...nacPt(2.9, Math.PI, side));
      cylinderBetween(airframe, g, g.clone().add(V(0, -0.035, 0)), 0.01, M.metal, 'fuel-drains', sk, 8);
    }

    // ---- propeller (spins about +x; blades pitch about their own radial axis)
    const spin = new THREE.Group();
    spin.position.set(wx(HUB_X), HUB_Y, zc);
    airframe.add(spin);
    {
      const prof = [];
      for (let i = 0; i <= 16; i++) {
        const t = i / 16;
        prof.push(new THREE.Vector2(0.18 * Math.sin((t * Math.PI) / 2) ** 0.9 + 0.0001, 0.42 * (1 - t)));
      }
      const sp = add(spin, new THREE.LatheGeometry(prof, 36), M.spinner, 'propeller', sk);
      sp.position.set(-0.14, 0, 0);
      sp.rotation.z = -Math.PI / 2;
      const back = add(spin, new THREE.CylinderGeometry(0.182, 0.182, 0.03, 36, 1, true), M.darkMetal, 'propeller', sk);
      back.position.set(-0.155, 0, 0);
      back.rotation.z = Math.PI / 2;
    }
    const bladeGeom = (() => {
      const R0 = 0.15, R1 = PROP_R;
      const chordAt = (r) => {
        const f = (r - R0) / (R1 - R0);
        return f < 0.12 ? lerp(0.06, 0.11, f / 0.12) : f < 0.4 ? lerp(0.11, 0.13, (f - 0.12) / 0.28) : lerp(0.13, 0.07, (f - 0.4) / 0.6) * (f > 0.94 ? Math.sqrt(Math.max(0.05, 1 - (f - 0.94) / 0.06)) : 1);
      };
      const tc = (r) => { const f = (r - R0) / (R1 - R0); return f < 0.12 ? lerp(0.85, 0.2, f / 0.12) : lerp(0.2, 0.08, (f - 0.12) / 0.88); };
      return gridSurface((u, v) => {
        const r = lerp(R0, R1, u);
        const c = chordAt(r);
        const twist = (0.72 - u) * 34 * DEG; // more pitch near the root
        const th = v * Math.PI * 2;
        const q = (c / 2) * Math.cos(th);
        const t = (c * tc(r) / 2) * Math.sin(th) * (Math.cos(th) > 0 ? 0.8 : 1.15);
        // local blade frame: y radial, z chord (leading edge +z), x thickness (forward = +x)
        const x = t * Math.cos(twist) + q * Math.sin(twist);
        const z = -t * Math.sin(twist) + q * Math.cos(twist);
        return [x, r, z];
      }, 22, 20, { uv: (u, v) => [v, u] });
    })();
    const blades = [];
    for (let i = 0; i < 3; i++) {
      const bg = new THREE.Group();
      bg.rotation.x = (i / 3) * Math.PI * 2;
      spin.add(bg);
      const pg = new THREE.Group();
      bg.add(pg);
      add(pg, bladeGeom, M.blade, 'propeller', sk);
      blades.push(pg);
    }
    rig.props.push({ spin, blades, side });
  }

  // ================================================================== Landing gear
  function wheel(G, c, { R, rim, W, part, side, brake = false, out = 1 }) {
    const h = W / 2;
    const prof = [
      [rim, -h * 0.85], [lerp(rim, R, 0.55), -h], [R - 0.02, -h * 0.85], [R, -h * 0.5], [R, 0],
      [R, h * 0.5], [R - 0.02, h * 0.85], [lerp(rim, R, 0.55), h], [rim, h * 0.85],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const tire = add(G, new THREE.LatheGeometry(prof, 36), M.tire, part, side);
    tire.position.copy(c);
    tire.rotation.x = Math.PI / 2;
    const hub = add(G, new THREE.CylinderGeometry(rim, rim, W * 0.85, 24, 1, true), M.metal, part, side);
    hub.position.copy(c);
    hub.rotation.x = Math.PI / 2;
    for (const f of [1, -1]) {
      const face = add(G, new THREE.CircleGeometry(rim * 0.99, 24), M.hubFace, part, side);
      face.position.copy(c).add(V(0, 0, f * W * 0.42));
      if (f < 0) face.rotation.y = Math.PI;
    }
    if (brake) {
      // disc and caliper on the inboard side
      const d = add(G, new THREE.CylinderGeometry(rim * 0.92, rim * 0.92, 0.008, 24), M.darkMetal, 'wheel-brakes', side);
      d.position.copy(c).add(V(0, 0, -out * (W * 0.5 + 0.012)));
      d.rotation.x = Math.PI / 2;
      const cal = add(G, new THREE.BoxGeometry(0.05, 0.045, 0.035), M.darkMetal, 'wheel-brakes', side);
      cal.position.copy(c).add(V(0.0, rim * 0.72, -out * (W * 0.5 + 0.012)));
      const line = cylinderBetween(G, cal.position.clone().add(V(0, 0.02, 0)), cal.position.clone().add(V(0.03, 0.2, 0)), 0.004, M.darkMetal, 'wheel-brakes', side, 6);
      void line;
    }
  }

  // main gear: trailing-link legs that retract inward into the stub wing
  for (const side of [-1, 1]) {
    const sk = sideKey(side);
    const gz = side * 1.475, px = wx(3.05), py = 0.82;
    const pv = makePivot(airframe, V(px, py, gz));
    const G = pv.inner;
    const axleX = wx(3.3), axleY = 0.19, knee = V(px, 0.33, gz);
    cylinderBetween(G, V(px, py + 0.04, gz), knee, 0.03, M.gear, 'main-gear', sk);
    cylinderBetween(G, V(px, py - 0.05, gz), V(px, py - 0.2, gz), 0.04, M.gear, 'main-gear', sk);
    // trailing arm (fork) and oleo-pneumatic shock strut
    for (const dz of [-0.06, 0.06]) {
      cylinderBetween(G, knee.clone().add(V(0, 0, dz)), V(axleX, axleY, gz + dz), 0.017, M.gear, 'main-gear', sk);
    }
    cylinderBetween(G, V(px - 0.03, py - 0.12, gz), V(axleX + 0.08, 0.27, gz), 0.022, M.metal, 'main-gear', sk);
    cylinderBetween(G, V(px - 0.02, py - 0.12, gz), V(px - 0.1, 0.44, gz), 0.03, M.gear, 'main-gear', sk);
    cylinderBetween(G, V(axleX, axleY, gz - 0.08), V(axleX, axleY, gz + 0.08), 0.012, M.darkMetal, 'main-gear', sk);
    wheel(G, V(axleX, axleY, gz), { R: 0.19, rim: 0.085, W: 0.15, part: 'main-gear', side: sk, brake: true, out: side });
    // leg-mounted gear door (closes the bay under the wing when retracted)
    add(G, gridSurface((u, v) => [lerp(px + 0.13, axleX - 0.08, u), lerp(py - 0.02, 0.36, v), gz + side * 0.12], 2, 2, { closedV: false }), M.paint, 'gear-doors', sk);
    rig.mainGear.push({ pivot: pv.pivot, axis: V(1, 0, 0), side });
  }

  // nose gear: retracts forward into the nose, steerable through the rudder pedals
  {
    const px = wx(1.18), py = 0.8;
    const pv = makePivot(airframe, V(px, py, 0));
    const G = pv.inner;
    const ax = wx(1.12), ay = 0.18;
    cylinderBetween(G, V(px, py + 0.04, 0), V(px + 0.02, 0.42, 0), 0.03, M.gear, 'nose-gear');
    cylinderBetween(G, V(px + 0.02, 0.46, 0), V(ax, ay + 0.1, 0), 0.02, M.metal, 'nose-gear');
    // fork
    for (const dz of [-0.075, 0.075]) cylinderBetween(G, V(ax, ay + 0.16, dz), V(ax, ay, dz), 0.012, M.gear, 'nose-gear');
    cylinderBetween(G, V(ax, ay + 0.16, -0.08), V(ax, ay + 0.16, 0.08), 0.016, M.gear, 'nose-gear');
    cylinderBetween(G, V(ax, ay, -0.085), V(ax, ay, 0.085), 0.01, M.darkMetal, 'nose-gear');
    // steering link / drag brace
    cylinderBetween(G, V(px + 0.01, 0.55, 0), V(px - 0.28, py - 0.02, 0), 0.014, M.gear, 'nose-gear');
    // torque links
    const apex = V(px + 0.1, 0.38, 0);
    cylinderBetween(G, V(px + 0.03, 0.5, 0), apex, 0.01, M.gear, 'nose-gear');
    cylinderBetween(G, apex, V(ax + 0.02, ay + 0.17, 0), 0.01, M.gear, 'nose-gear');
    wheel(G, V(ax, ay, 0), { R: 0.18, rim: 0.07, W: 0.12, part: 'nose-gear', side: 'C' });
    rig.noseGear = { pivot: pv.pivot, axis: V(0, 0, 1) };

    // nose wheel well and side-hinged doors
    const T0 = Math.PI - 0.42;
    add(airframe, fusePatch(0.36, 1.3, T0, Math.PI * 2 - T0, 0.004), M.hole, 'nose-gear');
    for (const side of [-1, 1]) {
      const a = side > 0 ? T0 : -(Math.PI - 0.015);
      const b = side > 0 ? Math.PI - 0.015 : -T0;
      // hinge along the door's outer edge (the nose tapers, so the line isn't parallel to x)
      const hA = V(...fusePt(0.36, side * T0, 0.01)), hB = V(...fusePt(1.3, side * T0, 0.01));
      const pvd = makePivot(airframe, hB);
      add(pvd.inner, fusePatch(0.36, 1.3, a, b, 0.01, 8, 4), M.paint, 'gear-doors', sideKey(side));
      rig.noseDoors.push({ pivot: pvd.pivot, axis: hA.sub(hB).normalize(), angle: -side * 80 * DEG });
    }
  }

  // ================================================================== Empennage: fin, dorsal & ventral fins, rudder
  const FY = 1.24;
  const FIN = makePlanform([
    { s: 0, le: 6.5, c: 1.6, tc: 0.12 },
    { s: 1.1, le: 7.58, c: 0.98, tc: 0.11 },
  ], 0);
  const finMap = (s, X, N) => [wx(X), FY + s, N];
  {
    add(airframe, liftingPiece(FIN, finMap, { s0: 0, s1: 1.1, t0: 0, t1: 0.64, nu: 12, nv: 36, caps: false }), M.wing, 'vertical-fin');
    add(airframe, liftingPiece(FIN, finMap, { s0: 0, s1: 0.08, t0: 0.64, t1: 1, nu: 1, nv: 12 }), M.wing, 'vertical-fin');
    add(airframe, liftingPiece(FIN, finMap, { s0: 1.06, s1: 1.1, t0: 0.64, t1: 1, nu: 1, nv: 12 }), M.wing, 'vertical-fin');
    add(airframe, liftingPiece(FIN, (s, X, N) => finMap(s, X - 0.004, N), { s0: 0.12, s1: 1.08, t0: 0, t1: 0.07, nu: 6, nv: 16, scaleN: 1.05, caps: false }), M.tks, 'tks-system');
    // dorsal fillet blending the fin into the tail boom
    const DORSAL = makePlanform([{ s: 0, le: 5.7, c: 1.2, tc: 0.06 }, { s: 0.22, le: 6.62, c: 0.5, tc: 0.08 }], 0);
    add(airframe, liftingPiece(DORSAL, (s, X, N) => [wx(X), 1.22 + s * 0.6, N], { s0: 0, s1: 0.22, nu: 4, nv: 20 }), M.wing, 'vertical-fin');
    // fin decal (livery) on both sides
    const logoMat = new THREE.MeshStandardMaterial({
      map: finLogo(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.32, metalness: 0.05,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    for (const side of [-1, 1]) {
      const g = gridSurface((u, v) => {
        const sx = lerp(0.1, 1.04, v), t = lerp(0.08, 0.63, u);
        const q = FIN.point(sx, t, side > 0);
        return finMap(sx, q.X, q.N + side * 0.003);
      }, 16, 16, { closedV: false });
      const m = add(airframe, g, logoMat, 'vertical-fin', sideKey(side));
      m.userData.noAO = true;
    }
    // rudder with a cockpit-adjustable trim tab at the lower trailing edge
    const [A, B] = hingeAt(FIN, finMap, 0.08, 1.06, 0.64, 0);
    const pv = makePivot(airframe, A);
    add(pv.inner, liftingPiece(FIN, finMap, { s0: 0.08, s1: 1.06, t0: 0.64, t1: 1, nu: 10, nv: 20 }), M.surface, 'rudder');
    wicks(pv.inner, [0.75, 1.0].map((sx) => { const q = FIN.point(sx, 1, true); return [V(...finMap(sx, q.X, q.N)), V(-1, 0.05, 0)]; }), 'static-dischargers', 'C');
    const axis = B.clone().sub(A).normalize();
    rig.rudder = { pivot: pv.pivot, axis: axis.y < 0 ? axis.negate() : axis };
    {
      const [TA, TB] = hingeAt(FIN, finMap, 0.12, 0.38, 0.88, 0);
      const tp = makePivot(pv.inner, TA);
      add(tp.inner, liftingPiece(FIN, (s, X, N) => finMap(s, X, N * 1.15), { s0: 0.12, s1: 0.38, t0: 0.88, t1: 1, nu: 2, nv: 10 }), M.navy, 'rudder-trim-tab');
      const ta = TB.clone().sub(TA).normalize();
      rig.rudderTab = { pivot: tp.pivot, axis: ta.y < 0 ? ta.negate() : ta };
    }
    // ventral fin with the tail bumper / skid
    const VENT = makePlanform([{ s: 0, le: 7.05, c: 0.95, tc: 0.08 }, { s: 0.2, le: 7.42, c: 0.5, tc: 0.08 }], 0);
    add(airframe, liftingPiece(VENT, (s, X, N) => [wx(X), 1.12 - s, N], { s0: 0, s1: 0.2, nu: 4, nv: 20 }), M.wing, 'tail-skid');
    const skid = add(airframe, new THREE.BoxGeometry(0.42, 0.025, 0.045), M.darkMetal, 'tail-skid');
    skid.position.set(wx(7.66), 0.915, 0);
    const ring = add(airframe, new THREE.TorusGeometry(0.022, 0.006, 8, 16), M.metal, 'tie-downs');
    ring.position.set(wx(7.85), 0.9, 0);
    ring.rotation.y = Math.PI / 2;
  }

  // ================================================================== Horizontal stabilizer & elevator (T-tail)
  {
    const HY = FY + 1.16;
    const HS = makePlanform([
      { s: 0, le: 7.5, c: 0.95, tc: 0.11 },
      { s: 2.15, le: 7.8, c: 0.6, tc: 0.1 },
    ], 0);
    // fairing bullet at the fin / stabilizer junction
    add(airframe, gridSurface((u, v) => {
      const X = lerp(7.32, 8.5, u);
      const r = 0.075 * Math.sin(Math.PI * clamp(u * 1.6, 0, 1) / 2) ** 0.7 * (1 - smooth(0.75, 1, u) * 0.85);
      const th = v * Math.PI * 2;
      return [wx(X), HY + 0.01 + r * Math.cos(th), r * 1.05 * Math.sin(th)];
    }, 20, 20, { capEnd: true }), M.wing, 'horizontal-stabilizer');
    for (const side of [-1, 1]) {
      const sk = sideKey(side);
      const map = (s, X, N) => [wx(X), HY + N, side * s];
      add(airframe, liftingPiece(HS, map, { s0: 0, s1: 2.15, t0: 0, t1: 0.66, nu: 14, nv: 32 }), M.wing, 'horizontal-stabilizer', sk);
      add(airframe, liftingPiece(HS, map, { s0: 2.08, s1: 2.15, t0: 0.66, t1: 1, nu: 1, nv: 12 }), M.wing, 'horizontal-stabilizer', sk);
      add(airframe, liftingPiece(HS, (s, X, N) => map(s, X - 0.004, N), { s0: 0.12, s1: 2.12, t0: 0, t1: 0.07, nu: 8, nv: 16, scaleN: 1.05, caps: false }), M.tks, 'tks-system', sk);
      const [A, B] = hingeAt(HS, map, 0.02, 2.08, 0.66, 0);
      const pv = makePivot(airframe, A);
      add(pv.inner, liftingPiece(HS, map, { s0: 0.02, s1: 2.08, t0: 0.66, t1: 1, nu: 10, nv: 20 }), M.surface, 'elevator', sk);
      wicks(pv.inner, [1.4, 2.0].map((sx) => { const q = HS.point(sx, 1, true); return [V(...map(sx, q.X, q.N)), V(-1, 0, side * 0.1)]; }), 'static-dischargers', sk);
      const axis = B.clone().sub(A).normalize();
      rig.elevators.push({ pivot: pv.pivot, axis: axis.z < 0 ? axis.negate() : axis, side });
      if (side < 0) {
        // elevator trim tab on the inboard trailing edge
        const [TA, TB] = hingeAt(HS, map, 0.25, 0.85, 0.88, 0);
        const tp = makePivot(pv.inner, TA);
        add(tp.inner, liftingPiece(HS, (s, X, N) => map(s, X, N * 1.15), { s0: 0.25, s1: 0.85, t0: 0.88, t1: 1, nu: 3, nv: 10 }), M.navy, 'elevator-trim-tab', sk);
        const ta = TB.clone().sub(TA).normalize();
        rig.elevatorTab = { pivot: tp.pivot, axis: ta.z < 0 ? ta.negate() : ta };
      }
    }
  }

  // ================================================================== Lights on the fuselage
  {
    // landing and taxi lights in a fairing under the forward fuselage
    const X = 1.95, st = fuseAt(X);
    // streamlined blister: half of it is buried in the belly
    add(airframe, gridSurface((u, v) => {
      const XX = lerp(1.7, 2.3, u);
      const k = Math.sin(Math.PI * u) ** 0.45;
      const th = v * Math.PI * 2;
      return [wx(XX), fuseAt(XX).bot + 0.012 + 0.04 * k * Math.cos(th), 0.075 * k * Math.sin(th)];
    }, 12, 16), M.paint, 'landing-light');
    const by = st.bot - 0.012;
    for (const [dz, kind, part, spot] of [
      [-0.03, 'landing', 'landing-light', { dir: V(20, -1.6, 0), angle: 0.2, distance: 60 }],
      [0.03, 'taxi', 'taxi-light', { dir: V(12, -1.8, 0), angle: 0.45, distance: 30 }],
    ]) {
      const lens = add(airframe, new THREE.CircleGeometry(0.022, 18), M.lens, part);
      lens.position.set(wx(1.84), by, dz);
      lens.rotation.y = Math.PI / 2;
      makeLight(airframe, kind, V(wx(1.845), by, dz), '#fff6e0', part, 'C', { size: 0.022, glow: 0.7, spot });
    }
    // ice inspection light (TKS aircraft): left fuselage side, aimed at the left wing leading edge
    const ip = V(...fuseSidePt(2.35, 1.12, -1, 0.012));
    add(airframe, new THREE.SphereGeometry(0.025, 12, 8, 0, Math.PI), M.lens, 'ice-light', 'L').position.copy(ip);
    makeLight(airframe, 'ice', ip, '#eaf4ff', 'ice-light', 'L', { size: 0.014, glow: 0.35, spot: { dir: V(-0.6, -0.25, -3), angle: 0.35, distance: 8 } });
  }

  // ================================================================== Antennas
  const bladeGeom = (h, c, t = 0.012) => {
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.lineTo(c, 0); s.lineTo(c * 0.85, h); s.lineTo(c * 0.55, h); s.lineTo(0, 0);
    const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false });
    g.translate(0, 0, -t / 2);
    return g;
  };
  const blade = (X, top, h, c, part) => {
    const m = add(airframe, bladeGeom(h, c), M.paint, part);
    m.position.set(...fusePt(X, top ? 0 : Math.PI, -0.005));
    if (top) m.rotation.y = Math.PI; else m.rotation.z = Math.PI;
    return m;
  };
  blade(4.45, true, 0.24, 0.2, 'com-antennas');
  blade(3.6, false, 0.22, 0.2, 'com-antennas');
  blade(4.35, false, 0.08, 0.07, 'transponder-dme');
  blade(4.75, false, 0.08, 0.07, 'transponder-dme');
  for (const X of [3.95, 4.15]) {
    const m = add(airframe, new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.paint, 'gps-antennas');
    m.scale.set(0.06, 0.018, 0.045);
    m.position.set(...fusePt(X, 0, -0.004));
  }
  {
    const base = V(...fusePt(5.55, 0, -0.004));
    cylinderBetween(airframe, base, base.clone().add(V(-0.05, 0.3, 0)), 0.003, M.darkMetal, 'elt-antenna', 'C', 6);
    const foot = add(airframe, new THREE.CylinderGeometry(0.012, 0.016, 0.02, 10), M.darkMetal, 'elt-antenna');
    foot.position.copy(base).add(V(0, 0.01, 0));
  }

  // ================================================================== External power receptacle (left aft fuselage)
  {
    const X = 4.75, Y = 0.88;
    const th = fuseTheta(X, Y, -1);
    const p = V(...fusePt(X, th, 0.004));
    const n = fuseNormal(X, th);
    const door = add(airframe, new THREE.PlaneGeometry(0.11, 0.08), M.panel, 'external-power', 'L');
    door.position.copy(p);
    door.lookAt(p.clone().add(n));
    disc(airframe, p.clone().addScaledVector(n, 0.002), n, 0.022, M.darkMetal, 'external-power', 'L');
  }

  return { root, rig };
}
