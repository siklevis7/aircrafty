// Geometry builders for the 737 NG flight deck: the fuselage shell with its window openings,
// windshield frame, glareshield, consoles, seats, control columns, rudder pedals, circuit-breaker
// panels, cockpit door, the outside world, and an instanced kit of 3D switches and knobs.
// Local frame: floor y = 0, +x forward, +z to the First Officer's side (right).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  paintSet, fabricSet, carpetSet, sheepskinSet, leatherSet, rubberSet, brushedSet,
  cbPanelCanvas, skyCanvas, apronCanvas, cloudDeckCanvas, facadeCanvas,
} from './flightdeck-textures.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const noRay = (m) => { m.raycast = () => {}; return m; };

// ---- materials -------------------------------------------------------------------------------
export function makeMaterials() {
  const paint = paintSet();
  const withRepeat = (t, r) => { const c = t.clone(); c.repeat.set(r, r); c.needsUpdate = true; return c; };
  const fab = fabricSet([27, 29, 32]);
  const carpet = carpetSet();
  const sheep = sheepskinSet();
  const leather = leatherSet([40, 44, 52]);
  const rubber = rubberSet();
  const brushed = brushedSet();
  return {
    lining: new THREE.MeshStandardMaterial({ color: '#b4b3ad', roughness: 0.82, normalMap: withRepeat(paint.normal, 6), normalScale: new THREE.Vector2(0.35, 0.35), side: THREE.DoubleSide }),
    liningDark: new THREE.MeshStandardMaterial({ color: '#8f9396', roughness: 0.75, normalMap: withRepeat(paint.normal, 6), normalScale: new THREE.Vector2(0.3, 0.3) }),
    ceiling: new THREE.MeshStandardMaterial({ color: '#d4d2cb', roughness: 0.9, side: THREE.DoubleSide, normalMap: withRepeat(paint.normal, 8), normalScale: new THREE.Vector2(0.25, 0.25) }),
    panel: new THREE.MeshStandardMaterial({ color: '#59616a', roughness: 0.62, metalness: 0.05, normalMap: withRepeat(paint.normal, 10), normalScale: new THREE.Vector2(0.25, 0.25), roughnessMap: withRepeat(paint.rough, 10) }),
    panelDark: new THREE.MeshStandardMaterial({ color: '#3b4148', roughness: 0.6, metalness: 0.05 }),
    frame: new THREE.MeshStandardMaterial({ color: '#2d3136', roughness: 0.55, side: THREE.DoubleSide }),
    glare: new THREE.MeshStandardMaterial({ color: '#ffffff', map: withRepeat(fab.map, 14), normalMap: withRepeat(fab.normal, 14), normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.96 }),
    carpet: new THREE.MeshStandardMaterial({ color: '#ffffff', map: withRepeat(carpet.map, 5), normalMap: withRepeat(carpet.normal, 5), roughness: 1 }),
    sheep: new THREE.MeshStandardMaterial({ color: '#ffffff', map: withRepeat(sheep.map, 1.5), normalMap: withRepeat(sheep.normal, 1.5), normalScale: new THREE.Vector2(1.2, 1.2), roughness: 1 }),
    leather: new THREE.MeshStandardMaterial({ color: '#ffffff', map: withRepeat(leather.map, 9), normalMap: withRepeat(leather.normal, 9), normalScale: new THREE.Vector2(0.45, 0.45), roughnessMap: withRepeat(leather.rough, 9), roughness: 0.7 }),
    rubber: new THREE.MeshStandardMaterial({ color: '#ffffff', map: rubber.map, normalMap: rubber.normal, roughness: 0.9 }),
    black: new THREE.MeshStandardMaterial({ color: '#141619', roughness: 0.5 }),
    plastic: new THREE.MeshStandardMaterial({ color: '#1d2024', roughness: 0.42 }),
    metal: new THREE.MeshStandardMaterial({ color: '#c3c8cd', roughness: 0.32, metalness: 0.85, roughnessMap: brushed.rough }),
    chrome: new THREE.MeshStandardMaterial({ color: '#e1e4e8', roughness: 0.18, metalness: 1 }),
    white: new THREE.MeshStandardMaterial({ color: '#e9e8e2', roughness: 0.6 }),
    paper: new THREE.MeshStandardMaterial({ color: '#f4f2ea', roughness: 0.9 }),
    red: new THREE.MeshStandardMaterial({ color: '#b5221a', roughness: 0.45 }),
    yellow: new THREE.MeshStandardMaterial({ color: '#d9a51c', roughness: 0.5 }),
    strap: new THREE.MeshStandardMaterial({ color: '#2d3440', roughness: 0.85 }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#c8dcea', transparent: true, opacity: 0.1, roughness: 0.04, metalness: 0, depthWrite: false, envMapIntensity: 0.6 }),
    visor: new THREE.MeshStandardMaterial({ color: '#203024', transparent: true, opacity: 0.55, roughness: 0.15, depthWrite: false }),
  };
}

// ---- fuselage shell ---------------------------------------------------------------------------
const halfWidth = (x) => (x <= 0.1 ? 1.06 : x <= 0.7 ? 1.06 - (x - 0.1) * 0.1 : 1.0 - (x - 0.7) * 0.22);
const prof = (y) => Math.pow(Math.max(0, 1 - Math.pow(Math.abs((y - 0.9) / 1.35), 2.4)), 1 / 2.4);
/** Inner wall offset |z| at (x, y). */
export const wallZ = (x, y) => halfWidth(x) * prof(y);
const WALL_TOP = 1.9;
/** Forward edge of the sidewall: the windshield corner post above the sill. */
const SILL = 1.04;
const frontX = (y) => (y < SILL ? 1.15 : 0.93 - 0.62 * (y - SILL));
const ceilY = (zr) => WALL_TOP + 0.17 * (1 - zr * zr); // zr = z / edge
const CORNER_POST = [V(0.93, SILL, 0), V(0.546, 1.66, 0)];

function smoothPoly(pts, iters = 2) {
  let p = pts;
  for (let k = 0; k < iters; k++) {
    const q = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    p = q;
  }
  return p;
}
function insidePoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function offsetPoly(poly, d) {
  let area = 0;
  for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; area += a[0] * b[1] - b[0] * a[1]; }
  const s = area > 0 ? 1 : -1;
  return poly.map((p, i) => {
    const a = poly[(i - 1 + poly.length) % poly.length], b = poly[(i + 1) % poly.length];
    const n1 = [p[1] - a[1], -(p[0] - a[0])], n2 = [b[1] - p[1], -(b[0] - p[0])];
    const l1 = Math.hypot(...n1) || 1, l2 = Math.hypot(...n2) || 1;
    const n = [n1[0] / l1 + n2[0] / l2, n1[1] / l1 + n2[1] / l2];
    const ln = Math.hypot(...n) || 1;
    return [p[0] + (n[0] / ln) * d * s, p[1] + (n[1] / ln) * d * s];
  });
}
// No. 2 (sliding) and No. 3 windows, in sidewall (x, y) coordinates
export const SIDE_WINDOWS = {
  w2: smoothPoly([[0.82, 1.12], [0.40, 1.12], [0.28, 1.55], [0.55, 1.55]]),
  w3: smoothPoly([[0.31, 1.15], [0.03, 1.17], [0.05, 1.45], [0.21, 1.50]]),
};

function sidewallGeometry(side) {
  const nx = 230, ny = 190;
  const pos = [], uv = [], idx = [];
  const holes = Object.values(SIDE_WINDOWS);
  for (let j = 0; j <= ny; j++) {
    const y = (j / ny) * WALL_TOP;
    const x0 = -1.32, x1 = frontX(y);
    for (let i = 0; i <= nx; i++) {
      const x = x0 + (i / nx) * (x1 - x0);
      pos.push(x, y, side * wallZ(x, y));
      uv.push(x * 2, y * 2);
    }
  }
  const at = (i, j) => j * (nx + 1) + i;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const a = at(i, j), b = at(i + 1, j), c = at(i + 1, j + 1), d = at(i, j + 1);
    const cx = (pos[a * 3] + pos[c * 3]) / 2, cy = (pos[a * 3 + 1] + pos[c * 3 + 1]) / 2;
    if (holes.some((h) => insidePoly(cx, cy, h))) continue;
    if (side < 0) idx.push(a, b, c, a, c, d); else idx.push(a, c, b, a, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function ceilingGeometry() {
  const nx = 60, nz = 40;
  const pos = [], idx = [], uv = [];
  const xFront = frontX(WALL_TOP);
  for (let i = 0; i <= nx; i++) {
    const x = -1.32 + (i / nx) * (xFront + 1.32);
    const edge = wallZ(x, WALL_TOP);
    for (let k = 0; k <= nz; k++) {
      const zr = -1 + (2 * k) / nz;
      pos.push(x, ceilY(zr), zr * edge);
      uv.push(x * 2, zr * 2);
    }
  }
  for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
    const a = i * (nz + 1) + k, b = a + 1, c = a + nz + 2, d = a + nz + 1;
    idx.push(a, b, c, a, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/** A thick trim ring around a sidewall window (padded frame), plus its glass. */
function windowTrim(poly, side, mats) {
  const outer = offsetPoly(poly, 0.065);
  const n = poly.length;
  const pos = [], idx = [];
  const toWall = ([x, y], inset) => [x, y, side * (wallZ(x, y) - inset)];
  for (let i = 0; i < n; i++) {
    pos.push(...toWall(outer[i], 0.004), ...toWall(poly[i], 0.03), ...toWall(poly[i], -0.035));
  }
  for (let i = 0; i < n; i++) {
    const a = i * 3, b = ((i + 1) % n) * 3;
    // face (outer rim -> inner rim) and reveal (inner rim -> glass depth)
    for (const [p, q] of [[0, 1], [1, 2]]) {
      if (side < 0) idx.push(a + p, b + p, b + q, a + p, b + q, a + q);
      else idx.push(a + p, b + q, b + p, a + p, a + q, b + q);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  const trim = new THREE.Mesh(g, mats.frame);
  // glass
  const shape = new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x, y)));
  const gg = new THREE.ShapeGeometry(shape);
  const p = gg.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, side * (wallZ(p.getX(i), p.getY(i)) + 0.03));
  gg.computeVertexNormals();
  const glass = noRay(new THREE.Mesh(gg, mats.glass));
  glass.renderOrder = 2;
  return [trim, glass];
}

/** Bar between two points (box oriented along a→b). */
export function bar(a, b, w, d, mat, up = V(0, 1, 0)) {
  const len = a.distanceTo(b);
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, len, d), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  const dir = b.clone().sub(a).normalize();
  m.quaternion.setFromUnitVectors(V(0, 1, 0), dir);
  void up;
  return m;
}
function tube(points, r, mat, seg = 32, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points, closed, 'centripetal');
  return new THREE.Mesh(new THREE.TubeGeometry(curve, seg, r, 10, closed), mat);
}

export function buildShell(root, mats) {
  const shadowy = (m, cast = true) => { m.castShadow = cast; m.receiveShadow = true; m.material.shadowSide = THREE.DoubleSide; return m; };
  const g = new THREE.Group(); g.name = 'shell'; root.add(g);
  for (const side of [-1, 1]) {
    g.add(shadowy(new THREE.Mesh(sidewallGeometry(side), mats.lining)));
    for (const poly of Object.values(SIDE_WINDOWS)) g.add(...windowTrim(poly, side, mats));
    // windshield corner post (L1/L2), following the sidewall's front edge
    const a = CORNER_POST[0].clone().setZ(side * (wallZ(0.93, SILL) - 0.04)), b = CORNER_POST[1].clone().setZ(side * (wallZ(0.546, 1.66) - 0.04));
    g.add(shadowy(bar(a, b, 0.1, 0.07, mats.frame)));
    // No. 2 / No. 3 window post and the sliding-window handle
    const pa = V(0.355, 1.13, side * (wallZ(0.355, 1.13) - 0.03)), pb = V(0.25, 1.53, side * (wallZ(0.25, 1.53) - 0.03));
    g.add(shadowy(bar(pa, pb, 0.08, 0.05, mats.frame)));
    const handle = tube([V(0.74, 1.2, side * 0.93), V(0.76, 1.27, side * 0.9), V(0.74, 1.34, side * 0.93)], 0.012, mats.black, 16);
    g.add(handle);
    // eyebrow trim above the side windows
    g.add(tube([V(0.86, 1.62, side * (wallZ(0.86, 1.62) - 0.03)), V(0.4, 1.64, side * (wallZ(0.4, 1.64) - 0.035)), V(-0.1, 1.6, side * (wallZ(-0.1, 1.6) - 0.035))], 0.025, mats.frame, 24));
  }
  g.add(shadowy(new THREE.Mesh(ceilingGeometry(), mats.ceiling)));
  // floor and footwells
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 2.1), mats.carpet);
  floor.rotation.x = -Math.PI / 2; floor.position.set(-0.08, 0.0, 0);
  g.add(shadowy(floor, false));
  // windshield: center post, header, sill and glass (V-shaped panes)
  const wsBC = V(1.13, 1.05, 0), wsTC = V(0.74, 1.66, 0);
  g.add(shadowy(bar(wsBC, wsTC, 0.055, 0.06, mats.frame)));
  const glassGeo = new THREE.BufferGeometry();
  const sideTop = (s) => V(0.546, 1.66, s * (wallZ(0.546, 1.66) - 0.01)), sideBot = (s) => V(0.93, SILL + 0.01, s * (wallZ(0.93, SILL) - 0.01));
  const gp = [];
  for (const s of [-1, 1]) gp.push(...wsBC.toArray(), ...sideBot(s).toArray(), ...sideTop(s).toArray(), ...wsBC.toArray(), ...sideTop(s).toArray(), ...wsTC.toArray());
  glassGeo.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3));
  glassGeo.computeVertexNormals();
  const ws = noRay(new THREE.Mesh(glassGeo, mats.glass.clone()));
  ws.material.side = THREE.DoubleSide; ws.renderOrder = 2;
  g.add(ws);
  for (const s of [-1, 1]) {
    g.add(shadowy(bar(wsTC, sideTop(s), 0.07, 0.08, mats.frame))); // header frame
    g.add(bar(wsBC, sideBot(s), 0.05, 0.05, mats.frame)); // sill frame
  }
  // header fill between the windshield top and the ceiling
  {
    const pts = [], idx = [];
    const N = 16;
    for (let i = 0; i <= N; i++) {
      const t = -1 + (2 * i) / N;
      const s = Math.sign(t) || 1, k = Math.abs(t);
      const lo = wsTC.clone().lerp(sideTop(s), k);
      const xF = frontX(WALL_TOP), edge = wallZ(xF, WALL_TOP);
      const hi = V(xF + (1 - k) * 0.12, ceilY(t) - 0.002, t * edge);
      pts.push(...lo.toArray(), ...hi.toArray());
    }
    for (let i = 0; i < N; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    const hg = new THREE.BufferGeometry();
    hg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); hg.setIndex(idx); hg.computeVertexNormals();
    g.add(shadowy(new THREE.Mesh(hg, mats.ceiling)));
  }
  // forward closure behind the instrument panel and below the windshield
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.06, 1.9), mats.panelDark);
  nose.position.set(1.17, 0.53, 0); g.add(shadowy(nose));
  // aft bulkhead
  const bh = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.1), mats.lining);
  bh.rotation.y = Math.PI / 2; bh.position.set(-1.31, 1.03, 0); g.add(shadowy(bh));
  // sun visors stowed along the header, on their rails
  for (const s of [-1, 1]) {
    const v = noRay(new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.17), mats.visor));
    v.position.set(0.66, 1.6, s * 0.48);
    v.lookAt(V(0.0, 1.2, s * 0.48));
    g.add(v);
    g.add(bar(V(0.7, 1.69, s * 0.2), V(0.62, 1.7, s * 0.8), 0.012, 0.012, mats.metal));
  }
  // standby magnetic compass on the center windshield post
  {
    const c = new THREE.Group(); c.position.set(0.72, 1.6, 0); g.add(c);
    const body = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.06, 0.08, 3, 0.01), mats.black);
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.022, 24), new THREE.MeshStandardMaterial({ color: '#d9d4c0', roughness: 0.4 }));
    face.position.set(-0.031, 0, 0); face.rotation.y = -Math.PI / 2;
    c.add(body, face);
    c.add(bar(V(0.02, 0.03, 0), V(0.05, 0.08, 0), 0.012, 0.012, mats.black));
  }
  // ceiling details: dome lights, air outlets, speaker grilles
  for (const [x, z] of [[-0.35, -0.35], [-0.35, 0.35], [-0.95, 0]]) {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.012, 32), mats.white);
    ring.position.set(x, ceilY(z / wallZ(x, WALL_TOP)) - 0.008, z); g.add(ring);
  }
  for (const s of [-1, 1]) {
    for (const x of [-0.05, -0.6]) {
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.022, 16, 12), mats.metal);
      ball.position.set(x, ceilY(0.62) - 0.015, s * 0.62 * wallZ(x, WALL_TOP)); g.add(ball);
    }
  }
  return g;
}

// ---- glareshield ---------------------------------------------------------------------------
export const GLARE = { faceBottom: V(0.66, 0.995, 0), faceTop: V(0.718, 1.075, 0), halfWidth: 0.92 };
export function buildGlareshield(root, mats) {
  const s = new THREE.Shape();
  s.moveTo(0.66, 0.995); s.lineTo(0.718, 1.075);
  s.quadraticCurveTo(0.736, 1.108, 0.8, 1.105);
  s.lineTo(1.13, 1.068); s.lineTo(1.13, 1.035); s.lineTo(0.92, 1.03); s.lineTo(0.69, 0.975);
  s.quadraticCurveTo(0.66, 0.975, 0.66, 0.995);
  const W = GLARE.halfWidth * 2;
  const geo = new THREE.ExtrudeGeometry(s, { depth: W, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.012, bevelSegments: 4, curveSegments: 10 });
  geo.translate(0, 0, -W / 2);
  const m = new THREE.Mesh(geo, mats.glare);
  m.castShadow = true; m.receiveShadow = true;
  root.add(m);
  return m;
}

// ---- instanced 3D switches and knobs ------------------------------------------------------------
function latheZ(points, seg = 16) {
  const g = new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  g.rotateX(Math.PI / 2); // lathe axis y -> z (out of the panel)
  return g;
}
export function createControlKit(mats) {
  const lever = latheZ([[0, 0], [0.085, 0], [0.08, 0.1], [0.055, 0.5], [0.075, 0.58], [0.09, 0.66], [0.07, 0.73], [0, 0.75]]);
  const nut = new THREE.CylinderGeometry(0.27, 0.27, 0.12, 6); nut.rotateX(Math.PI / 2); nut.translate(0, 0, 0.06);
  const guardGeo = (() => {
    const top = new THREE.BoxGeometry(0.74, 0.98, 0.04); top.translate(0, -0.49, 0.34);
    const l = new THREE.BoxGeometry(0.04, 0.98, 0.34); l.translate(-0.35, -0.49, 0.17);
    const r = l.clone(); r.translate(0.7, 0, 0);
    return mergeGeometries([top, l, r]);
  })();
  const knobBody = (() => {
    const disc = new THREE.CylinderGeometry(0.44, 0.47, 0.14, 28); disc.rotateX(Math.PI / 2); disc.translate(0, 0, 0.07);
    const b = new RoundedBoxGeometry(0.3, 0.92, 0.3, 2, 0.06); b.translate(0, 0.0, 0.29);
    return mergeGeometries([disc.toNonIndexed(), b.toNonIndexed()]);
  })();
  const knobLine = new THREE.BoxGeometry(0.05, 0.4, 0.01); knobLine.translate(0, 0.22, 0.445);
  const knobRound = (() => {
    const pts = [[0, 0], [0.5, 0], [0.5, 0.32], [0.46, 0.4], [0.3, 0.42], [0.28, 0.5], [0, 0.5]];
    return latheZ(pts, 24);
  })();
  const KINDS = {
    nut: { geo: nut, mat: mats.chrome }, lever: { geo: lever, mat: mats.chrome },
    guard: { geo: guardGeo, mat: mats.red }, knob: { geo: knobBody, mat: mats.plastic },
    knobLine: { geo: knobLine, mat: mats.white }, knobRound: { geo: knobRound, mat: mats.plastic },
  };
  const slots = Object.fromEntries(Object.keys(KINDS).map((k) => [k, []]));
  const meshes = {};
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3();
  function write(slot) {
    const mesh = meshes[slot.kind];
    if (!mesh) return;
    tmpE.set(slot.rx || 0, 0, slot.rz || 0, 'ZXY');
    tmpQ.setFromEuler(tmpE);
    tmpP.copy(slot.pos); tmpS.setScalar(slot.scale);
    tmpM.compose(tmpP, tmpQ, tmpS).premultiply(slot.parent.matrixWorld);
    mesh.setMatrixAt(slot.index, tmpM);
    mesh.instanceMatrix.needsUpdate = true;
  }
  return {
    add(kind, parent, x, y, z, scale) {
      const slot = { kind, parent, pos: V(x, y, z), scale, rx: 0, rz: 0, index: slots[kind].length };
      slots[kind].push(slot);
      slot.set = (rx = 0, rz = 0) => { if (slot.rx === rx && slot.rz === rz && slot.done) return; slot.rx = rx; slot.rz = rz; slot.done = true; write(slot); };
      return slot;
    },
    finalize(root) {
      root.updateMatrixWorld(true);
      for (const [k, def] of Object.entries(KINDS)) {
        if (!slots[k].length) continue;
        const m = new THREE.InstancedMesh(def.geo, def.mat, slots[k].length);
        m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true;
        noRay(m);
        meshes[k] = m; root.add(m);
        slots[k].forEach((s) => write(s));
      }
    },
  };
}

// ---- seats -----------------------------------------------------------------------------------
export function buildSeat(root, mats, z, partId) {
  const g = new THREE.Group(); g.position.set(-0.05, 0, z); root.add(g);
  const P = (m) => { m.userData.partId = partId; m.userData.side = z < 0 ? 'L' : 'R'; m.castShadow = true; m.receiveShadow = true; return m; };
  const rb = (w, h, d, r, mat, x, y, zz = 0, rotZ = 0) => {
    const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, r), mat);
    m.position.set(x, y, zz); m.rotation.z = rotZ; g.add(m); return m;
  };
  // floor tracks and pedestal
  for (const t of [-0.13, 0.13]) { const r = rb(0.7, 0.03, 0.04, 0.008, mats.metal, 0.02, 0.015, t); r.receiveShadow = true; }
  rb(0.34, 0.24, 0.36, 0.03, mats.panelDark, 0.0, 0.15);
  rb(0.46, 0.06, 0.46, 0.02, mats.plastic, 0.02, 0.3);
  // seat pan + sheepskin cushion
  P(rb(0.5, 0.1, 0.5, 0.045, mats.leather, 0.03, 0.38, 0, 0.04));
  P(rb(0.47, 0.06, 0.46, 0.03, mats.sheep, 0.04, 0.445, 0, 0.05));
  // backrest (reclined), lumbar and sheepskin cover
  const back = new THREE.Group(); back.position.set(-0.24, 0.44, 0); back.rotation.z = 0.2; g.add(back);
  const bk = (w, h, d, r, mat, x, y, zz = 0) => { const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, r), mat); m.position.set(x, y, zz); back.add(m); return P(m); };
  bk(0.12, 0.78, 0.5, 0.05, mats.leather, -0.02, 0.4);
  bk(0.05, 0.7, 0.44, 0.022, mats.sheep, 0.055, 0.4);
  bk(0.06, 0.18, 0.4, 0.03, mats.sheep, 0.07, 0.17);
  // side bolsters
  for (const s of [-1, 1]) bk(0.1, 0.62, 0.06, 0.025, mats.leather, 0.04, 0.38, s * 0.25);
  // headrest on its posts
  bk(0.11, 0.2, 0.32, 0.045, mats.leather, 0.0, 0.9);
  bk(0.035, 0.17, 0.28, 0.015, mats.sheep, 0.06, 0.9);
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.08, 8), mats.chrome); p.position.set(-0.01, 0.79, s * 0.08); back.add(p); }
  // armrests (inboard and outboard)
  for (const s of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(-0.2, 0.63, s * 0.27); g.add(arm);
    const pad = new THREE.Mesh(new RoundedBoxGeometry(0.36, 0.05, 0.07, 3, 0.02), mats.leather); pad.position.set(0.16, 0.0, 0); arm.add(pad);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 16), mats.plastic); hub.rotation.x = Math.PI / 2; arm.add(hub);
    P(pad);
  }
  // five-point harness
  // shoulder straps lie flat down the backrest, lap belts across the cushion
  for (const s of [-1, 1]) {
    const sh = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.62, 0.045), mats.strap);
    sh.position.set(0.085, 0.47, s * 0.09); sh.rotation.x = s * 0.06; back.add(sh);
    const lap = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.006, 0.19), mats.strap);
    lap.position.set(0.12, 0.481, s * 0.13); lap.rotation.z = 0.05; g.add(lap);
  }
  const crotch = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.006, 0.045), mats.strap); crotch.position.set(0.19, 0.478, 0); crotch.rotation.z = 0.05; g.add(crotch);
  const buckle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.012, 24), mats.chrome);
  buckle.position.set(0.12, 0.487, 0); g.add(buckle);
  return g;
}

// ---- control columns -------------------------------------------------------------------------------
export function buildColumn(root, mats, z, partId) {
  const pivot = new THREE.Group(); pivot.position.set(0.6, 0.05, z); root.add(pivot);
  const P = (m) => { m.userData.partId = partId; m.userData.side = z < 0 ? 'L' : 'R'; m.castShadow = true; return m; };
  const col = tube([V(0, 0, 0), V(-0.04, 0.3, 0), V(-0.11, 0.52, 0), V(-0.17, 0.66, 0)], 0.028, mats.plastic, 24);
  pivot.add(P(col));
  const boot = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.12, 16), mats.black); boot.position.set(0, 0.04, 0); pivot.add(boot);
  const wheel = new THREE.Group(); wheel.position.set(-0.175, 0.67, 0); pivot.add(wheel);
  // the wheel plane faces the pilot: build in the y-z plane
  const hub = new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.1, 0.13, 3, 0.02), mats.plastic);
  wheel.add(P(hub));
  for (const s of [-1, 1]) {
    // ram's-horn grip: out from the hub, then up and slightly back toward the pilot
    const horn = tube([V(0, -0.01, s * 0.05), V(-0.005, -0.02, s * 0.12), V(-0.01, 0.0, s * 0.175), V(-0.02, 0.07, s * 0.19), V(-0.03, 0.13, s * 0.17)], 0.018, mats.plastic, 28);
    wheel.add(P(horn));
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.019, 12, 10), mats.plastic); cap.position.set(-0.03, 0.13, s * 0.17); wheel.add(cap);
  }
  // pilot-side details: AP disconnect (red, outboard horn), stab trim switches (outboard horn top), mic switch
  const out = z < 0 ? -1 : 1;
  const apd = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.01, 12), mats.red); apd.rotation.z = Math.PI / 2; apd.position.set(-0.035, 0.08, out * 0.19); wheel.add(apd);
  for (const dz of [-0.008, 0.008]) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.018, 0.009), mats.black); t.position.set(-0.03, 0.15, out * 0.17 + dz); wheel.add(t); }
  const mic = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.015, 0.02), mats.black); mic.position.set(-0.03, 0.09, -out * 0.185); wheel.add(mic);
  // clipboard / chart holder on the hub
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.13, 0.1), mats.paper); board.position.set(-0.04, 0.06, 0); board.rotation.z = 0.25; wheel.add(board);
  const clip = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.02, 0.05), mats.metal); clip.position.set(-0.045, 0.12, 0); clip.rotation.z = 0.25; wheel.add(clip);
  return { pivot, wheel };
}

// ---- rudder pedals (suspended) ---------------------------------------------------------------------
export function buildPedals(root, mats, z, partId) {
  const out = [];
  for (const p of [-1, 1]) {
    const g = new THREE.Group(); g.position.set(0.0, 0, z + p * 0.1); root.add(g);
    const arm = bar(V(0.8, 0.46, 0), V(0.71, 0.2, 0), 0.025, 0.02, mats.metal); g.add(arm);
    const pedal = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.2, 0.1, 3, 0.01), mats.rubber);
    pedal.position.set(0.7, 0.16, 0); pedal.rotation.z = 0.38;
    pedal.userData.partId = partId; pedal.userData.side = z < 0 ? 'L' : 'R';
    arm.userData.partId = partId; arm.userData.side = pedal.userData.side;
    g.add(pedal);
    out.push({ g, p, base: 0 });
  }
  return out;
}

// ---- side consoles, tiller, oxygen mask boxes, CB panels, door -------------------------------------
export function buildConsoles(root, mats, maskFaceTex) {
  const parts = {};
  for (const s of [-1, 1]) {
    const zIn = s * 0.84;
    // console body along the wall
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.06, 0.22), mats.liningDark);
    body.position.set(0.2, 0.74, s * 0.95); body.castShadow = body.receiveShadow = true; root.add(body);
    const front = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.5, 0.02), mats.liningDark);
    front.position.set(0.2, 0.47, zIn); root.add(front);
    // padded arm rest strip along the inner edge
    const pad = new THREE.Mesh(new RoundedBoxGeometry(1.0, 0.04, 0.07, 3, 0.015), mats.leather);
    pad.position.set(0.05, 0.785, s * 0.875); root.add(pad);
    // oxygen mask stowage box
    const box = new THREE.Group(); box.position.set(-0.05, 0.84, s * 0.97); root.add(box);
    const shell = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.13, 0.15, 3, 0.012), mats.panelDark);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(0.19, 0.14), new THREE.MeshStandardMaterial({ map: maskFaceTex, roughness: 0.6 }));
    top.rotation.x = -Math.PI / 2; top.position.y = 0.0655; top.rotation.z = s < 0 ? 0 : Math.PI;
    const lever = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.02), mats.red); lever.position.set(0.07, 0.03, -s * 0.08);
    const flow = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.01, 16), mats.yellow); flow.rotation.x = Math.PI / 2; flow.position.set(-0.05, 0.02, -s * 0.077);
    [shell, top, lever, flow].forEach((m) => { m.userData.partId = 'fd-oxygen-mask'; m.userData.side = s < 0 ? 'L' : 'R'; box.add(m); });
    parts[s] = { box };
    // map / chart light on a gooseneck, ashtray and cup holder
    const lamp = tube([V(0.35, 0.77, s * 0.98), V(0.35, 0.9, s * 0.99), V(0.3, 0.98, s * 0.95)], 0.006, mats.black, 12);
    root.add(lamp);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.05, 16), mats.black); head.position.set(0.29, 0.98, s * 0.95); head.rotation.z = 1.0; root.add(head);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.05, 20, 1, true), mats.plastic); cup.position.set(-0.4, 0.78, s * 0.95); root.add(cup);
    // flight bag / manual stowage at the aft end
    const bag = new THREE.Mesh(new RoundedBoxGeometry(0.35, 0.38, 0.2, 3, 0.02), mats.leather); bag.position.set(-0.7, 0.21, s * 0.86); root.add(bag);
  }
  return parts;
}

export function buildTiller(root, mats, partId, side = -1) {
  const t = new THREE.Group(); t.position.set(0.55, 0.8, side * 0.93); root.add(t);
  t.rotation.x = side * 0.25;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.08, 0.04, 32), mats.plastic);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.009, 10, 36), mats.black); wheel.rotation.x = Math.PI / 2; wheel.position.y = 0.03;
  const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.01, 0.014), mats.black); spoke.position.y = 0.03;
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.05, 12), mats.metal); knob.position.set(0.045, 0.06, 0);
  [base, wheel, spoke, knob].forEach((m) => { m.userData.partId = partId; t.add(m); });
  return t;
}

/** Circuit-breaker panel with instanced 3D breaker buttons. */
export function buildCBPanel(root, mats, { x0, x1, y0, y1, side, seed, partId }) {
  const w = x1 - x0, h = y1 - y0;
  const { texture, points } = cbPanelCanvas(w, h, seed);
  const zc = side * (Math.min(wallZ((x0 + x1) / 2, y0), wallZ((x0 + x1) / 2, y1)) - 0.035);
  const g = new THREE.Group(); g.position.set((x0 + x1) / 2, (y0 + y1) / 2, zc); root.add(g);
  g.rotation.y = side < 0 ? 0 : Math.PI;
  const plate = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.02), [mats.panelDark, mats.panelDark, mats.panelDark, mats.panelDark, new THREE.MeshStandardMaterial({ map: texture, roughness: 0.65, emissive: '#000000' }), mats.panelDark]);
  plate.castShadow = plate.receiveShadow = true;
  g.add(plate);
  // pickable face (single material so the viewer can highlight it)
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: texture, roughness: 0.65 }));
  face.position.z = 0.0105; face.userData.partId = partId; face.userData.side = side < 0 ? 'L' : 'R';
  g.add(face);
  const cap = new THREE.CylinderGeometry(0.0055, 0.0055, 0.012, 12); cap.rotateX(Math.PI / 2);
  const ring = new THREE.CylinderGeometry(0.0072, 0.0072, 0.004, 14); ring.rotateX(Math.PI / 2);
  const caps = new THREE.InstancedMesh(cap, mats.plastic, points.length);
  const rings = new THREE.InstancedMesh(ring, mats.white, points.length);
  const m = new THREE.Matrix4();
  points.forEach(([u, v], i) => {
    const px = (u - 0.5) * w, py = (0.5 - v) * h;
    // a few breakers pulled (collar showing) for realism
    const pulled = ((i * 2654435761) >>> 0) % 97 === 0;
    m.makeTranslation(px, py, 0.016 + (pulled ? 0.006 : 0)); caps.setMatrixAt(i, m);
    m.makeTranslation(px, py, 0.012); rings.setMatrixAt(i, m);
  });
  [caps, rings].forEach((im) => { noRay(im); g.add(im); });
  return g;
}

export function buildDoor(root, mats, partId) {
  const g = new THREE.Group(); g.position.set(-1.29, 0, 0.05); root.add(g);
  const P = (m) => { m.userData.partId = partId; m.castShadow = true; m.receiveShadow = true; return m; };
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.96, 0.76), mats.frame); frame.position.set(0, 0.98, 0); g.add(frame);
  const door = new THREE.Mesh(new RoundedBoxGeometry(0.05, 1.86, 0.64, 3, 0.01), mats.liningDark); door.position.set(0.02, 0.95, 0); g.add(P(door));
  // reinforced door details: decompression panel, viewer, deadbolt, handle
  const dec = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.42, 0.44), mats.panelDark); dec.position.set(0.048, 0.38, 0); g.add(P(dec));
  for (let i = 0; i < 7; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.012, 0.38), mats.black); l.position.set(0.052, 0.22 + i * 0.05, 0); g.add(l); }
  const viewer = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.02, 20), mats.chrome); viewer.rotation.z = Math.PI / 2; viewer.position.set(0.05, 1.5, 0); g.add(P(viewer));
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.007, 16), new THREE.MeshStandardMaterial({ color: '#0a1a28', roughness: 0.05, metalness: 0.5 })); lens.rotation.y = Math.PI / 2; lens.position.set(0.061, 1.5, 0); g.add(lens);
  const bolt = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.12), mats.metal); bolt.position.set(0.06, 1.1, -0.22); g.add(P(bolt));
  const handle = tube([V(0.05, 1.0, -0.24), V(0.09, 1.0, -0.22), V(0.09, 1.0, -0.12)], 0.011, mats.metal, 12); g.add(P(handle));
  const lockBox = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.1, 0.07), mats.black); lockBox.position.set(0.055, 1.25, -0.24); g.add(P(lockBox));
  // folded observer (jumpseat) on the bulkhead, right of the door
  const js = new THREE.Group(); js.position.set(-1.27, 0, 0.62); root.add(js);
  const pan = new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.42, 0.4, 3, 0.02), mats.leather); pan.position.set(0.04, 0.75, 0); js.add(pan);
  const bk = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.5, 0.38, 3, 0.02), mats.leather); bk.position.set(0.01, 1.25, 0); js.add(bk);
  return g;
}

// ---- outside world -----------------------------------------------------------------------------
export function buildOutside(root) {
  const g = new THREE.Group(); g.name = 'outside'; root.add(g);
  const dayTex = new THREE.CanvasTexture(skyCanvas(false)); dayTex.colorSpace = THREE.SRGBColorSpace;
  const nightTex = new THREE.CanvasTexture(skyCanvas(true)); nightTex.colorSpace = THREE.SRGBColorSpace;
  const sky = noRay(new THREE.Mesh(new THREE.SphereGeometry(140, 48, 24), new THREE.MeshBasicMaterial({ map: dayTex, side: THREE.BackSide, fog: false, depthWrite: false })));
  sky.position.y = 0; sky.renderOrder = -10;
  g.add(sky);
  const ground = new THREE.Group(); g.add(ground);
  const apron = noRay(new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshBasicMaterial({ map: apronCanvas(), fog: false })));
  apron.rotation.x = -Math.PI / 2; apron.rotation.z = Math.PI / 2; apron.position.set(10, -2.6, 0);
  ground.add(apron);
  const grass = noRay(new THREE.Mesh(new THREE.RingGeometry(78, 135, 48, 1), new THREE.MeshBasicMaterial({ color: '#5f7a48', fog: false })));
  grass.rotation.x = -Math.PI / 2; grass.position.y = -2.62; ground.add(grass);
  // buildings: terminal to the left, hangars to the right, tower, distant hills
  const bmat = (seed) => new THREE.MeshBasicMaterial({ map: facadeCanvas(seed), fog: false });
  const building = (w, h, d, x, z, seed) => {
    const m = noRay(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bmat(seed)));
    m.position.set(x, -2.6 + h / 2, z); ground.add(m); return m;
  };
  building(18, 9, 70, 30, -62, 1);
  building(30, 14, 26, 60, 48, 2);
  building(24, 12, 22, 75, 18, 3);
  const tower = noRay(new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.2, 28, 16), new THREE.MeshBasicMaterial({ color: '#c8c9c4', fog: false })));
  tower.position.set(95, -2.6 + 14, -30); ground.add(tower);
  const cab = noRay(new THREE.Mesh(new THREE.CylinderGeometry(3.2, 2.6, 3.5, 12), new THREE.MeshBasicMaterial({ color: '#33424f', fog: false })));
  cab.position.set(95, -2.6 + 29.5, -30); ground.add(cab);
  const hills = new THREE.Group(); ground.add(hills);
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const h = noRay(new THREE.Mesh(new THREE.SphereGeometry(18 + (i * 7) % 13, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#7d8f86', fog: false })));
    h.scale.y = 0.35 + ((i * 5) % 7) * 0.04; h.position.set(Math.cos(a) * 125, -3, Math.sin(a) * 125); hills.add(h);
  }
  // night lights: taxiway edge (blue), centreline (green) and apron floods
  const lights = new THREE.Group(); lights.visible = false; ground.add(lights);
  const pts = (color, arr, size) => {
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    const p = noRay(new THREE.Points(geo, new THREE.PointsMaterial({ color, size, sizeAttenuation: false, fog: false })));
    lights.add(p);
  };
  const blue = [], green = [], flood = [];
  for (let z = -78; z <= 78; z += 6) { blue.push(41, -2.55, z, 59.4, -2.55, z); green.push(55 - 4, -2.57, z); }
  for (let x = -20; x <= 40; x += 5) green.push(x, -2.57, 0);
  for (const [x, z] of [[-10, -32], [20, -32], [-10, 32], [20, 32], [5, -40]]) flood.push(x, 12, z);
  pts('#3a7bff', blue, 3); pts('#3dff7a', green, 2); pts('#ffd9a0', flood, 6);
  // cloud deck for cruise
  const clouds = noRay(new THREE.Mesh(new THREE.CircleGeometry(900, 48), new THREE.MeshBasicMaterial({ map: cloudDeckCanvas(), fog: false, transparent: true, opacity: 0.95 })));
  clouds.rotation.x = -Math.PI / 2; clouds.position.y = -60; clouds.visible = false;
  g.add(clouds);
  return {
    group: g,
    setNight(on) {
      sky.material.map = on ? nightTex : dayTex; sky.material.needsUpdate = true;
      lights.visible = on;
      const k = on ? 0.13 : 0.8;
      ground.traverse((o) => { if (o.isMesh && o.material.color) { o.material.color.setScalar(k); } });
      clouds.material.color.setScalar(on ? 0.12 : 1);
    },
    setAirborne(air) { ground.visible = !air; clouds.visible = air; },
  };
}
