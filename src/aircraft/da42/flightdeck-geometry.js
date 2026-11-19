// Geometry builders for the DA42 NG cockpit: the slim composite cabin with its one-piece forward
// canopy and the left rear door, glareshield, seats with harnesses, control sticks, adjustable
// rudder pedals, centre console body, and the parts of the aircraft seen through the canopy
// (nose, wings, engine nacelles and propellers).
// Local frame: cabin floor y = 0, +x forward, +z to the right seat. Pilot seats at z = ±0.3.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { paintSet, fabricSet, carpetSet, leatherSet, rubberSet, brushedSet } from '../b738/flightdeck-textures.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const noRay = (m) => { m.raycast = () => {}; return m; };
const shadowy = (m, cast = true) => { m.castShadow = cast; m.receiveShadow = true; return m; };

// ---- materials -------------------------------------------------------------------------------
export function makeMaterials() {
  const paint = paintSet();
  const rep = (t, r) => { const c = t.clone(); c.repeat.set(r, r); c.needsUpdate = true; return c; };
  const fab = fabricSet([46, 48, 52]);
  const carpet = carpetSet();
  const leather = leatherSet([30, 32, 36]);
  const leatherTan = leatherSet([92, 84, 74]);
  const rubber = rubberSet();
  const brushed = brushedSet();
  return {
    // light-grey composite lining (gel-coat with a faint orange peel)
    lining: new THREE.MeshStandardMaterial({ color: '#c9c9c4', roughness: 0.7, normalMap: rep(paint.normal, 8), normalScale: new THREE.Vector2(0.3, 0.3), side: THREE.DoubleSide }),
    liningDark: new THREE.MeshStandardMaterial({ color: '#5d6066', roughness: 0.75, normalMap: rep(paint.normal, 6), normalScale: new THREE.Vector2(0.3, 0.3), side: THREE.DoubleSide }),
    // anthracite instrument panel with a fine textured paint
    panel: new THREE.MeshStandardMaterial({ color: '#33363b', roughness: 0.68, metalness: 0.05, normalMap: rep(paint.normal, 10), normalScale: new THREE.Vector2(0.35, 0.35), roughnessMap: rep(paint.rough, 10) }),
    panelDark: new THREE.MeshStandardMaterial({ color: '#202225', roughness: 0.6, metalness: 0.05 }),
    frame: new THREE.MeshStandardMaterial({ color: '#17181a', roughness: 0.5, side: THREE.DoubleSide }),
    glare: new THREE.MeshStandardMaterial({ color: '#ffffff', map: rep(fab.map, 12), normalMap: rep(fab.normal, 12), normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.97 }),
    carpet: new THREE.MeshStandardMaterial({ color: '#8d8f94', map: rep(carpet.map, 4), normalMap: rep(carpet.normal, 4), roughness: 1 }),
    leather: new THREE.MeshStandardMaterial({ color: '#ffffff', map: rep(leather.map, 6), normalMap: rep(leather.normal, 6), normalScale: new THREE.Vector2(0.5, 0.5), roughnessMap: rep(leather.rough, 6), roughness: 0.65 }),
    leatherTan: new THREE.MeshStandardMaterial({ color: '#ffffff', map: rep(leatherTan.map, 6), normalMap: rep(leatherTan.normal, 6), normalScale: new THREE.Vector2(0.5, 0.5), roughness: 0.7 }),
    rubber: new THREE.MeshStandardMaterial({ color: '#ffffff', map: rubber.map, normalMap: rubber.normal, roughness: 0.9 }),
    black: new THREE.MeshStandardMaterial({ color: '#121315', roughness: 0.5 }),
    plastic: new THREE.MeshStandardMaterial({ color: '#1c1e21', roughness: 0.4 }),
    metal: new THREE.MeshStandardMaterial({ color: '#c3c8cd', roughness: 0.32, metalness: 0.85, roughnessMap: brushed.rough }),
    chrome: new THREE.MeshStandardMaterial({ color: '#e1e4e8', roughness: 0.18, metalness: 1 }),
    white: new THREE.MeshStandardMaterial({ color: '#ecebe6', roughness: 0.55 }),
    red: new THREE.MeshStandardMaterial({ color: '#b5221a', roughness: 0.45 }),
    yellow: new THREE.MeshStandardMaterial({ color: '#d9a51c', roughness: 0.5 }),
    strap: new THREE.MeshStandardMaterial({ color: '#2a2d33', roughness: 0.85 }),
    strapRed: new THREE.MeshStandardMaterial({ color: '#8a1d18', roughness: 0.8 }),
    paint: new THREE.MeshStandardMaterial({ color: '#f3f4f1', roughness: 0.32, metalness: 0.02 }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#cfe0ec', transparent: true, opacity: 0.12, roughness: 0.03, metalness: 0, depthWrite: false, envMapIntensity: 0.7, side: THREE.DoubleSide }),
  };
}

// ---- cabin shell ---------------------------------------------------------------------------------
const X0 = -1.75, X1 = 1.12, SH = 0.45, SILL = 0.6;
export const CANOPY = { x0: -0.6, x1: X1, hingeY: 0.82 };
export const DOOR = { x0: -1.48, x1: -0.72, y0: 0.1, y1: 1.0 };
const REAR_WIN = { x0: -1.42, x1: -0.78, y0: 0.64, y1: 0.97 };
/** Half-width of the cabin at station x. */
export const halfW = (x) => (x < -1.2 ? 0.58 - (-1.2 - x) * 0.18 : x <= 0.25 ? 0.58 : 0.58 - (x - 0.25) * 0.3);
/** Roof / canopy height at station x. */
export const topY = (x) => (x < -0.9 ? 1.16 - (-0.9 - x) * 0.07 : x <= 0 ? 1.16 : 1.16 - Math.pow(x / 1.2, 1.7) * 0.36);
/** A point on the inner shell: u in [-1, 1] from the left floor over the top to the right floor. */
export function shellPt(x, u) {
  const a = halfW(x), yt = topY(x);
  // lower walls take |u| in [0.72, 1], the arch |u| in [0, 0.72]
  const au = Math.abs(u), s = Math.sign(u) || 1;
  if (au >= 0.72) {
    const k = (au - 0.72) / 0.28; // 0 at the shoulder, 1 at the floor
    const y = SH * (1 - k);
    return V(x, y, s * a * (0.9 + 0.1 * (y / SH)));
  }
  const phi = (au / 0.72) * (Math.PI / 2); // 0 top .. pi/2 shoulder
  const n = 2.6;
  const z = a * Math.pow(Math.sin(phi), 2 / n);
  const y = SH + (yt - SH) * Math.pow(Math.cos(phi), 2 / n);
  return V(x, y, s * z);
}
const inRect = (x, y, r) => x > r.x0 && x < r.x1 && y > r.y0 && y < r.y1;

/** Builds the shell; returns { group, canopy (pivot group), door (pivot group) }. */
export function buildShell(root, mats) {
  const g = new THREE.Group(); g.name = 'shell'; root.add(g);
  const nx = 140, nu = 90;
  const pos = [], uv = [];
  for (let i = 0; i <= nx; i++) {
    const x = X0 + (i / nx) * (X1 - X0);
    for (let j = 0; j <= nu; j++) {
      const u = -1 + (2 * j) / nu;
      const p = shellPt(x, u);
      pos.push(p.x, p.y, p.z); uv.push(x * 2, u * 3);
    }
  }
  const buckets = { wall: [], canopy: [], rearGlass: [], door: [], doorGlass: [] };
  const P = (k) => [pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]];
  for (let i = 0; i < nx; i++) for (let j = 0; j < nu; j++) {
    const a = i * (nu + 1) + j, b = a + nu + 1, c = b + 1, d = a + 1;
    const pa = P(a), pc = P(c);
    const x = (pa[0] + pc[0]) / 2, y = (pa[1] + pc[1]) / 2, z = (pa[2] + pc[2]) / 2;
    let k = 'wall';
    if (x > CANOPY.x0 && y > SILL) k = 'canopy';
    else if (inRect(x, y, REAR_WIN)) k = z < 0 ? 'doorGlass' : 'rearGlass';
    else if (z < 0 && inRect(x, y, DOOR)) k = 'door';
    buckets[k].push(a, b, c, a, c, d);
  }
  const geo = (idx) => {
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    gg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    gg.setIndex(idx); gg.computeVertexNormals();
    return gg;
  };
  g.add(shadowy(new THREE.Mesh(geo(buckets.wall), mats.lining)));
  const rg = noRay(new THREE.Mesh(geo(buckets.rearGlass), mats.glass)); rg.renderOrder = 2; g.add(rg);

  // ---- canopy: glass + black frame, pivoting about its forward edge
  const canopy = new THREE.Group(); canopy.position.set(CANOPY.x1, CANOPY.hingeY, 0); g.add(canopy);
  const cInner = new THREE.Group(); cInner.position.set(-CANOPY.x1, -CANOPY.hingeY, 0); canopy.add(cInner);
  const cg = noRay(new THREE.Mesh(geo(buckets.canopy), mats.glass)); cg.renderOrder = 2; cInner.add(cg);
  const uAtY = (x, yy, s) => { // u where the shell crosses height yy on side s
    let lo = 0, hi = 0.999;
    for (let it = 0; it < 30; it++) { const m = (lo + hi) / 2; if (shellPt(x, m).y > yy) lo = m; else hi = m; }
    return s * lo;
  };
  const tubeAlong = (pts, r, mat) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), Math.max(8, pts.length * 3), r, 8), mat);
  const inward = (p, d) => { const dir = V(0, 0.6 - p.y, -p.z).normalize(); return p.clone().addScaledVector(dir, d); };
  // aft bow (canopy frame) and forward arc
  for (const xb of [CANOPY.x0 + 0.03, X1 - 0.04]) {
    const pts = [];
    const uS = Math.abs(uAtY(xb, SILL, 1));
    for (let t = -uS; t <= uS + 1e-6; t += uS / 16) pts.push(inward(shellPt(xb, t), 0.012));
    const bow = tubeAlong(pts, xb < 0 ? 0.03 : 0.022, mats.frame);
    bow.userData.partId = 'da42fd-canopy'; cInner.add(shadowy(bow));
  }
  // side sill rails of the canopy
  for (const s of [-1, 1]) {
    const pts = [];
    for (let x = CANOPY.x0 + 0.03; x <= X1 - 0.04; x += 0.08) pts.push(inward(shellPt(x, uAtY(x, SILL + 0.012, s)), 0.012));
    const rail = tubeAlong(pts, 0.022, mats.frame);
    rail.userData.partId = 'da42fd-canopy'; cInner.add(shadowy(rail));
    // fixed fuselage sill (cockpit side rail with a padded top) below the canopy rail
    const sp = [];
    for (let x = CANOPY.x0 - 0.05; x <= X1 - 0.08; x += 0.08) { const p = shellPt(x, uAtY(x, SILL - 0.02, s)); p.z -= s * 0.035; sp.push(p); }
    g.add(shadowy(tubeAlong(sp, 0.016, mats.liningDark)));
  }
  // latch handles on the canopy frame (one each side, at the aft bow)
  const latches = [-1, 1].map((s) => {
    const lg = new THREE.Group();
    const p = shellPt(CANOPY.x0 + 0.1, uAtY(CANOPY.x0 + 0.1, SILL + 0.05, s));
    lg.position.set(p.x, p.y, p.z - s * 0.05); cInner.add(lg);
    const base = new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.03, 0.025, 2, 0.006), mats.black);
    const lever = new THREE.Mesh(new RoundedBoxGeometry(0.11, 0.018, 0.02, 2, 0.006), mats.red);
    lever.position.set(0.04, 0.02, 0); lever.rotation.z = 0.25;
    [base, lever].forEach((m) => { m.userData.partId = 'da42fd-canopy'; m.userData.side = s < 0 ? 'L' : 'R'; lg.add(shadowy(m)); });
    return { group: lg, lever };
  });
  // gas strut stubs at the hinge
  for (const s of [-1, 1]) {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.28, 8), mats.metal);
    const p = shellPt(0.85, uAtY(0.85, SILL + 0.04, s));
    st.position.set(0.82, p.y + 0.02, p.z - s * 0.04); st.rotation.z = Math.PI / 2 - 0.25; cInner.add(st);
  }

  // ---- rear door (left), hinged at the roof edge
  const hingeP = V((DOOR.x0 + DOOR.x1) / 2, DOOR.y1, -halfW((DOOR.x0 + DOOR.x1) / 2) * 0.86);
  const door = new THREE.Group(); door.position.copy(hingeP); g.add(door);
  const dInner = new THREE.Group(); dInner.position.copy(hingeP).negate(); door.add(dInner);
  const dm = new THREE.Mesh(geo(buckets.door), mats.lining); dm.userData.partId = 'da42fd-rear-door'; dm.userData.side = 'L'; dInner.add(shadowy(dm));
  const dgl = noRay(new THREE.Mesh(geo(buckets.doorGlass), mats.glass)); dgl.renderOrder = 2; dInner.add(dgl);
  // door seal outline and interior handle
  const outline = [];
  for (const [x, y] of [[DOOR.x0, DOOR.y0], [DOOR.x1, DOOR.y0], [DOOR.x1, DOOR.y1], [DOOR.x0, DOOR.y1], [DOOR.x0, DOOR.y0]]) {
    const u = uAtY(x, y, -1); outline.push(shellPt(x, u).add(V(0, 0, 0.01)));
  }
  for (let i = 0; i < outline.length - 1; i++) {
    const a = outline[i], b = outline[i + 1];
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.012, a.distanceTo(b), 0.012), mats.frame);
    m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize());
    g.add(noRay(m));
  }
  const hp = shellPt(-0.85, uAtY(-0.85, 0.55, -1));
  const dHandle = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.025, 0.03, 2, 0.008), mats.red);
  dHandle.position.set(hp.x, hp.y, hp.z + 0.03); dHandle.userData.partId = 'da42fd-rear-door'; dHandle.userData.side = 'L';
  dInner.add(shadowy(dHandle));

  // ---- floor, forward closure, rear baggage bulkhead
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, 1.0), mats.carpet);
  floor.rotation.x = -Math.PI / 2; floor.position.set((X0 + X1) / 2, 0.002, 0); g.add(shadowy(floor, false));
  const bulk = new THREE.Mesh(new THREE.CircleGeometry(0.62, 40), mats.liningDark);
  bulk.scale.set(1, 1, 1); bulk.rotation.y = Math.PI / 2; bulk.position.set(X0 + 0.01, 0.56, 0); g.add(shadowy(bulk));
  // nose / footwell closure ahead of the pedals
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.82, 1.0), mats.liningDark);
  nose.position.set(1.12, 0.41, 0); g.add(shadowy(nose));
  // side wall trim: map pockets, air vents
  for (const s of [-1, 1]) {
    const pocket = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.16, 0.03, 2, 0.01), mats.liningDark);
    const p = shellPt(0.05, s * 0.86); pocket.position.set(0.05, 0.28, p.z - s * 0.03); g.add(shadowy(pocket));
    const vent = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.03, 18), mats.black);
    const pv = shellPt(0.3, uAtY(0.3, SILL - 0.06, s)); vent.rotation.x = Math.PI / 2; vent.position.set(0.3, pv.y, pv.z - s * 0.06); g.add(vent);
  }
  // roll-over / headliner bar between front and rear (structural, behind the front seats)
  {
    const pts = [];
    for (let t = -0.75; t <= 0.75; t += 0.05) { const p = shellPt(CANOPY.x0 - 0.04, t); p.multiply(V(1, 0.985, 0.95)); pts.push(p); }
    g.add(shadowy(tubeAlong(pts, 0.04, mats.liningDark)));
  }
  return { group: g, canopy, door, latches };
}

// ---- glareshield ---------------------------------------------------------------------------------
export function buildGlareshield(root, mats) {
  const s = new THREE.Shape();
  s.moveTo(0.505, 0.838); s.quadraticCurveTo(0.5, 0.866, 0.545, 0.868);
  s.lineTo(1.08, 0.84); s.lineTo(1.08, 0.815); s.lineTo(0.6, 0.818); s.lineTo(0.54, 0.83);
  s.quadraticCurveTo(0.505, 0.828, 0.505, 0.838);
  const W = 0.98;
  const geo = new THREE.ExtrudeGeometry(s, { depth: W, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.005, bevelSegments: 3, curveSegments: 10 });
  geo.translate(0, 0, -W / 2);
  const m = shadowy(new THREE.Mesh(geo, mats.glare));
  root.add(m);
  return m;
}

// ---- seats -----------------------------------------------------------------------------------
/** Front seats are fixed in the airframe (reclined shells with cushions); the pedals adjust instead. */
export function buildFrontSeat(root, mats, z, partId) {
  const g = new THREE.Group(); g.position.set(0, 0, z); root.add(g);
  const P = (m) => { m.userData.partId = partId; m.userData.side = z < 0 ? 'L' : 'R'; return shadowy(m); };
  const rb = (w, h, d, r, mat, x, y, rz = 0, parent = g, zz = 0) => {
    const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, r), mat); m.position.set(x, y, zz); m.rotation.z = rz; parent.add(m); return m;
  };
  // composite seat shell moulded into the floor
  rb(0.5, 0.16, 0.46, 0.04, mats.liningDark, 0.02, 0.08);
  P(rb(0.48, 0.09, 0.44, 0.04, mats.leather, 0.03, 0.2, 0.06));
  P(rb(0.42, 0.035, 0.3, 0.015, mats.leatherTan, 0.04, 0.25, 0.06));
  const back = new THREE.Group(); back.position.set(-0.2, 0.22, 0); back.rotation.z = 0.42; g.add(back);
  P(rb(0.1, 0.74, 0.46, 0.045, mats.leather, -0.03, 0.37, 0, back));
  P(rb(0.035, 0.6, 0.3, 0.014, mats.leatherTan, 0.03, 0.36, 0, back));
  for (const s of [-1, 1]) P(rb(0.08, 0.56, 0.06, 0.025, mats.leather, 0.02, 0.33, 0, back, s * 0.22));
  P(rb(0.1, 0.18, 0.28, 0.045, mats.leather, -0.01, 0.82, 0, back));
  // four-point harness: shoulder straps from the shell, lap belt with a rotary buckle
  for (const s of [-1, 1]) {
    const sh = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.6, 0.045), mats.strap); sh.position.set(0.05, 0.42, s * 0.08); sh.rotation.x = s * 0.05; back.add(sh);
    const lap = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.006, 0.18), mats.strap); lap.position.set(0.1, 0.262, s * 0.12); lap.rotation.z = 0.06; g.add(lap);
    const pad = new THREE.Mesh(new RoundedBoxGeometry(0.015, 0.16, 0.06, 2, 0.006), mats.strapRed); pad.position.set(0.058, 0.3, s * 0.08); back.add(pad);
  }
  const buckle = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.012, 24), mats.metal); buckle.position.set(0.11, 0.27, 0); g.add(buckle);
  return g;
}
export function buildRearBench(root, mats, partId) {
  const g = new THREE.Group(); g.position.set(-1.12, 0, 0); root.add(g);
  for (const z of [-0.28, 0.28]) {
    const P = (m) => { m.userData.partId = partId; m.userData.side = z < 0 ? 'L' : 'R'; return shadowy(m); };
    const pan = P(new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.1, 0.46, 4, 0.04), mats.leather)); pan.position.set(0.02, 0.26, z); pan.rotation.z = 0.06; g.add(pan);
    const base = new THREE.Mesh(new RoundedBoxGeometry(0.48, 0.22, 0.5, 3, 0.03), mats.liningDark); base.position.set(0.02, 0.11, z); g.add(shadowy(base));
    const back = P(new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.66, 0.46, 4, 0.04), mats.leather)); back.position.set(-0.27, 0.6, z); back.rotation.z = 0.32; g.add(back);
    const inset = P(new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.5, 0.3, 2, 0.012), mats.leatherTan)); inset.position.set(-0.215, 0.6, z); inset.rotation.z = 0.32; g.add(inset);
    const head = P(new THREE.Mesh(new RoundedBoxGeometry(0.09, 0.16, 0.26, 4, 0.04), mats.leather)); head.position.set(-0.39, 0.98, z); head.rotation.z = 0.32; g.add(head);
    for (const s of [-1, 1]) { const sh = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.5, 0.04), mats.strap); sh.position.set(-0.2, 0.62, z + s * 0.08); sh.rotation.z = 0.32; g.add(sh); }
  }
  return g;
}

// ---- control sticks and pedals --------------------------------------------------------------------------
/** Stick with a moulded grip: PTT (trigger), AP disconnect / trim interrupt (red), electric trim (hat). */
export function buildStick(root, mats, z, partId) {
  const pivot = new THREE.Group(); pivot.position.set(0.24, 0.05, z); root.add(pivot);
  const P = (m) => { m.userData.partId = partId; m.userData.side = z < 0 ? 'L' : 'R'; return shadowy(m); };
  const boot = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.12, 20, 1, true), mats.black); boot.position.y = 0.03; root.add(boot); boot.position.set(0.24, 0.08, z);
  const shaft = P(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.44, 12), mats.black)); shaft.position.set(-0.02, 0.22, 0); shaft.rotation.z = 0.09; pivot.add(shaft);
  const grip = new THREE.Group(); grip.position.set(-0.04, 0.46, 0); grip.rotation.z = 0.12; pivot.add(grip);
  const body = P(new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.09, 6, 14), mats.plastic)); body.scale.set(1.15, 1, 1); grip.add(body);
  const top = P(new THREE.Mesh(new THREE.SphereGeometry(0.026, 16, 12), mats.plastic)); top.position.y = 0.065; top.scale.set(1.1, 0.8, 1); grip.add(top);
  const hat = P(new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.01, 0.012), mats.metal)); hat.position.set(-0.008, 0.088, 0); grip.add(hat);
  const apd = P(new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.01, 12), mats.red)); apd.rotation.z = Math.PI / 2; apd.position.set(-0.024, 0.05, z < 0 ? -0.012 : 0.012); grip.add(apd);
  const ptt = P(new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.025, 0.012), mats.black)); ptt.position.set(0.024, 0.03, 0); grip.add(ptt);
  return { pivot };
}
/** Pedal pair with toe brakes on an adjustable carriage (moved fore/aft by a crank). */
export function buildPedals(root, mats, z, partId) {
  const carriage = new THREE.Group(); carriage.position.set(0.95, 0, z); root.add(carriage);
  const out = [];
  for (const p of [-1, 1]) {
    const g = new THREE.Group(); g.position.set(0, 0.32, p * 0.085); carriage.add(g);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.2, 0.018), mats.metal); arm.position.y = -0.1; g.add(arm);
    const pedal = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.14, 0.09, 3, 0.01), mats.rubber); pedal.position.set(-0.03, -0.2, 0); pedal.rotation.z = 0.5; g.add(pedal);
    const toe = new THREE.Mesh(new RoundedBoxGeometry(0.025, 0.06, 0.08, 3, 0.008), mats.black); toe.position.set(-0.02, -0.12, 0); toe.rotation.z = 0.5; g.add(toe);
    [arm, pedal, toe].forEach((m) => { m.userData.partId = partId; m.userData.side = z < 0 ? 'L' : 'R'; shadowy(m); });
    out.push({ g, p });
  }
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.26), mats.metal); rail.position.y = 0.33; carriage.add(rail);
  return { carriage, pedals: out };
}

// ---- seen through the canopy: nose, wings, nacelles, propellers ----------------------------------------
export function buildAirframeOutside(root, mats) {
  const g = new THREE.Group(); g.name = 'airframe-outside'; root.add(g);
  // nose ahead of the windshield
  const nosePts = [];
  for (let i = 0; i <= 16; i++) { const t = i / 16; nosePts.push(new THREE.Vector2(0.5 * Math.pow(1 - t, 0.55) + 0.02, t * 1.5)); }
  const nose = noRay(new THREE.Mesh(new THREE.LatheGeometry(nosePts, 40), mats.paint));
  nose.rotation.z = -Math.PI / 2; nose.position.set(1.08, 0.5, 0); nose.scale.set(1, 1, 1.0); g.add(nose);
  // low wing: leading edge ahead of the seats, visible below the canopy sill
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0.35, 0.55); wingShape.lineTo(0.12, 6.7); wingShape.lineTo(-0.6, 6.7); wingShape.lineTo(-1.25, 0.55); wingShape.closePath();
  for (const s of [-1, 1]) {
    const geo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 4 });
    const w = noRay(new THREE.Mesh(geo, mats.paint));
    w.rotation.x = s < 0 ? -Math.PI / 2 : Math.PI / 2; w.position.set(0, s < 0 ? 0.0 : 0.12, 0);
    w.rotation.y = 0; g.add(w);
    // walkway (black anti-slip) on the inner wing root
    const walk = noRay(new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.5), mats.black));
    walk.rotation.x = -Math.PI / 2; walk.position.set(-0.35, 0.18, s * 0.95); g.add(walk);
  }
  // engine nacelles with spinners and three-blade propellers
  const props = [];
  for (const s of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 20; i++) { const t = i / 20; pts.push(new THREE.Vector2(0.3 * Math.sin(Math.min(1, t * 2.2) * Math.PI / 2) * (1 - 0.6 * Math.max(0, t - 0.6) / 0.4), t * 3.2)); }
    const nac = noRay(new THREE.Mesh(new THREE.LatheGeometry(pts, 32), mats.paint));
    nac.rotation.z = -Math.PI / 2; nac.position.set(1.55, 0.3, s * 1.62); nac.scale.set(1, 1, 0.9); g.add(nac);
    const hub = new THREE.Group(); hub.position.set(1.72, 0.3, s * 1.62); g.add(hub);
    const spin = noRay(new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.32, 24), mats.paint)); spin.rotation.z = -Math.PI / 2; spin.position.x = 0.1; hub.add(spin);
    const blades = [];
    for (let b = 0; b < 3; b++) {
      const arm = new THREE.Group(); arm.rotation.x = (b / 3) * Math.PI * 2; hub.add(arm);
      const bl = noRay(new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.88, 0.12), mats.black)); bl.position.y = 0.5; arm.add(bl);
      const tip = noRay(new THREE.Mesh(new THREE.BoxGeometry(0.021, 0.06, 0.121), mats.white)); tip.position.y = 0.92; arm.add(tip);
      blades.push(bl);
    }
    const disc = noRay(new THREE.Mesh(new THREE.CircleGeometry(0.95, 40), new THREE.MeshBasicMaterial({ color: '#222', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })));
    disc.rotation.y = Math.PI / 2; hub.add(disc);
    props.push({ hub, blades, disc, side: s });
  }
  return { group: g, props };
}

/** Standby magnetic compass on top of the glareshield. */
export function buildCompass(root, mats, partId) {
  const c = new THREE.Group(); c.position.set(0.66, 0.9, 0); root.add(c);
  const body = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.055, 0.07, 3, 0.01), mats.black);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.026), new THREE.MeshStandardMaterial({ color: '#e8e2c8', roughness: 0.4, emissive: '#000' }));
  face.position.set(-0.031, 0, 0); face.rotation.y = -Math.PI / 2;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.014, 0.05, 10), mats.black); stem.position.y = -0.045;
  const card = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.002, 0.03), mats.black); card.position.set(-0.032, 0, 0);
  [body, face, stem, card].forEach((m) => { m.userData.partId = partId; c.add(shadowy(m)); });
  const corr = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.03), mats.white); corr.position.set(-0.02, -0.055, 0); corr.rotation.y = -Math.PI / 2; corr.userData.partId = partId; c.add(corr);
  return { group: c, face };
}
