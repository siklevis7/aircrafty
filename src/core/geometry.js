// Generic procedural geometry helpers shared by every aircraft model.
import * as THREE from 'three';

export const DEG = Math.PI / 180;
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

/**
 * Build a surface from fn(u, v) -> [x, y, z] sampled on a (nu x nv) grid.
 * closedV wraps the v direction (tubes, airfoil loops). Caps close the ends
 * with their own vertices so the shading stays crisp at the edge.
 */
export function gridSurface(fn, nu, nv, { closedV = true, capStart = false, capEnd = false } = {}) {
  const pos = [];
  const idx = [];
  const cols = closedV ? nv : nv + 1;
  for (let i = 0; i <= nu; i++) {
    for (let j = 0; j < cols; j++) {
      const p = fn(i / nu, j / nv);
      pos.push(p[0], p[1], p[2]);
    }
  }
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const j1 = closedV ? (j + 1) % cols : j + 1;
      const a = i * cols + j, b = (i + 1) * cols + j, c = (i + 1) * cols + j1, d = i * cols + j1;
      idx.push(a, b, d, b, c, d);
    }
  }
  const cap = (row, flip) => {
    const start = pos.length / 3;
    let cx = 0, cy = 0, cz = 0;
    for (let j = 0; j < cols; j++) {
      const k = (row * cols + j) * 3;
      pos.push(pos[k], pos[k + 1], pos[k + 2]);
      cx += pos[k]; cy += pos[k + 1]; cz += pos[k + 2];
    }
    const c = pos.length / 3;
    pos.push(cx / cols, cy / cols, cz / cols);
    for (let j = 0; j < nv; j++) {
      const j1 = closedV ? (j + 1) % cols : j + 1;
      const a = start + j, b = start + j1;
      if (flip) idx.push(c, b, a); else idx.push(c, a, b);
    }
  };
  if (capStart) cap(0, false);
  if (capEnd) cap(nu, true);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Linear interpolation through an array of station objects sorted by `key`. */
export function interpStations(stations, key, x) {
  if (x <= stations[0][key]) return { ...stations[0] };
  for (let i = 0; i < stations.length - 1; i++) {
    const a = stations[i], b = stations[i + 1];
    if (x <= b[key]) {
      const t = (x - a[key]) / (b[key] - a[key]);
      const out = {};
      for (const k of Object.keys(a)) out[k] = typeof a[k] === 'number' ? lerp(a[k], b[k], t) : a[k];
      return out;
    }
  }
  return { ...stations[stations.length - 1] };
}

// ---- Airfoils ---------------------------------------------------------------

/** NACA 4-digit half-thickness (fraction of chord) at chord fraction t. */
export function halfThickness(t, tc) {
  t = clamp(t, 0, 1);
  return 5 * tc * (0.2969 * Math.sqrt(t) - 0.126 * t - 0.3516 * t * t + 0.2843 * t ** 3 - 0.1036 * t ** 4);
}

/** NACA 4-digit mean camber line (fraction of chord). */
export function camberLine(t, m = 0.02, p = 0.4) {
  if (m === 0) return 0;
  return t < p ? (m / (p * p)) * (2 * p * t - t * t) : (m / ((1 - p) ** 2)) * (1 - 2 * p + 2 * p * t - t * t);
}

/**
 * A lifting-surface "planform": stations along the span s, each with
 * leading-edge chordwise position `le`, chord `c`, thickness ratio `tc`,
 * and optional normal offset `off`.
 */
export function makePlanform(stations, camber = 0.02) {
  const at = (s) => interpStations(stations, 's', s);
  /** Point on the section: X (chordwise, aft-positive) and N (normal offset). */
  const point = (s, t, upper, { scaleN = 1, plate = null, plateT = 0.035 } = {}) => {
    const st = at(s);
    const X = st.le + t * st.c;
    const cm = camberLine(t, camber) * st.c;
    const th = halfThickness(t, st.tc) * st.c;
    let N;
    if (plate === 'upper') N = cm + th + (upper ? plateT : 0.004);
    else if (plate === 'lower') N = cm - th - (upper ? 0.004 : plateT);
    else N = cm + (upper ? th : -th) * scaleN;
    return { X, N: N + (st.off || 0) };
  };
  return { stations, at, point };
}

/**
 * Lofted piece of a lifting surface between span s0..s1 and chord t0..t1.
 * `map(s, X, N)` converts planform coordinates to world [x, y, z].
 */
export function liftingPiece(pf, map, { s0, s1, t0 = 0, t1 = 1, nu = 10, nv = 28, caps = true, ...opts }) {
  const fn = (u, v) => {
    const s = lerp(s0, s1, u);
    const upper = v < 0.5;
    const w = upper ? 1 - v / 0.5 : (v - 0.5) / 0.5; // 0 at t0 (front), 1 at t1 (rear)
    const spacing = t0 === 0 ? 1 - Math.cos((w * Math.PI) / 2) : w;
    const t = lerp(t0, t1, spacing);
    const p = pf.point(s, t, upper, opts);
    return map(s, p.X, p.N);
  };
  return gridSurface(fn, nu, nv, { closedV: true, capStart: caps, capEnd: caps });
}

/** Hinge line endpoints on the camber line at chord fraction t (world coords). */
export function hingeLine(pf, map, s0, s1, t, surface = 'camber') {
  const pt = (s) => {
    const st = pf.at(s);
    const X = st.le + t * st.c;
    let N = camberLine(t) * st.c + (st.off || 0);
    if (surface === 'upper') N += halfThickness(t, st.tc) * st.c;
    if (surface === 'lower') N -= halfThickness(t, st.tc) * st.c;
    return new THREE.Vector3(...map(s, X, N));
  };
  return [pt(s0), pt(s1)];
}

/**
 * Create a pivot at world point A inside `parent`. Meshes added to `inner`
 * keep using absolute coordinates while rotating about A.
 */
export function makePivot(parent, A) {
  const pivot = new THREE.Group();
  pivot.position.copy(A);
  const inner = new THREE.Group();
  inner.position.copy(A).multiplyScalar(-1);
  pivot.add(inner);
  parent.add(pivot);
  return { pivot, inner, base: A.clone() };
}

/** Tube lofted along a path of rings: ring(u) -> {c:[x,y,z] center, ...}, pointFn(u, theta). */
export function tube(pointFn, nu, nv, opts) {
  return gridSurface((u, v) => pointFn(u, v * Math.PI * 2), nu, nv, opts);
}

/** Radial gradient sprite texture used for light glows. */
let glowTex = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.18, 'rgba(255,255,255,0.75)');
  grd.addColorStop(0.45, 'rgba(255,255,255,0.18)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}
