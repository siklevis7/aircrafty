// Geometry helpers for the 737-800 cabin: fuselage cross-section, swept wall panels,
// seat/bin/window geometries and a merge utility. Local axes: +x forward, +y up,
// +z right (looking forward), floor at y = 0, cabin centerline at z = 0.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// Right-hand interior profile (z, y) from the floor edge up to the ceiling centerline.
// Max width ≈ 3.52 m at shoulder height, ceiling ≈ 2.22 m over the aisle.
export const PROFILE = [
  [1.6, 0.0], [1.655, 0.12], [1.705, 0.3], [1.738, 0.5], [1.755, 0.7], [1.758, 0.86],
  [1.742, 1.3],
  [1.718, 1.42], [1.685, 1.52], [1.64, 1.62], [1.57, 1.75], [1.49, 1.88], [1.4, 1.98], [1.28, 2.05],
  [1.1, 2.095], [0.95, 2.13], [0.75, 2.168], [0.5, 2.197], [0.25, 2.214], [0, 2.22],
];
export const BAND = { y0: 0.86, y1: 1.3, z0: 1.758, z1: 1.742 }; // window band (planar)

/** Interior wall half-width at height y. */
export function wallZ(y) {
  for (let i = 0; i < PROFILE.length - 1; i++) {
    const [z0, y0] = PROFILE[i], [z1, y1] = PROFILE[i + 1];
    if (y >= y0 && y <= y1) return z0 + ((y - y0) / (y1 - y0 || 1)) * (z1 - z0);
  }
  return y < 0 ? PROFILE[0][0] : 0;
}

/** Sub-profile between two heights (interpolated ends). */
export function profileBetween(ya, yb) {
  const out = [[wallZ(ya), ya]];
  for (const p of PROFILE) if (p[1] > ya + 1e-6 && p[1] < yb - 1e-6) out.push(p);
  out.push([yb >= 2.22 ? 0 : wallZ(yb), yb]);
  return out;
}

/**
 * Sweep a (z, y) polyline along x from x0 to x1. Faces point toward the cabin
 * centerline. mirror = left side (z negated). v runs along the arc (0..1) unless
 * vScale is given (metres per unit), u = x / uScale.
 */
export function sweep(pts, x0, x1, { mirror = false, uScale = 1, vScale = null, vStart = 0, vTotal = null } = {}) {
  const s = mirror ? -1 : 1;
  const n = pts.length;
  const arc = [0];
  for (let i = 1; i < n; i++) arc.push(arc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = vTotal || arc[n - 1] || 1;
  const pos = [], nor = [], uv = [], idx = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    const dz = b[0] - a[0], dy = b[1] - a[1];
    const l = Math.hypot(dz, dy) || 1;
    const nz = -dy / l, ny = dz / l;
    for (const x of [x0, x1]) {
      pos.push(x, pts[i][1], s * pts[i][0]);
      nor.push(0, ny, s * nz);
      uv.push(x / uScale, vScale ? arc[i] / vScale : (vStart + arc[i]) / total);
    }
  }
  for (let i = 0; i < n - 1; i++) {
    const A = i * 2, B = i * 2 + 1, D = i * 2 + 2, C = i * 2 + 3;
    if (!mirror) idx.push(A, D, B, B, D, C);
    else idx.push(A, B, D, B, C, D);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** Total arc length of a (z, y) polyline. */
export const arcLength = (pts) => pts.reduce((a, p, i) => (i ? a + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);

/** Arc-length fraction → (z, y) on a polyline (for painting wash gradients). */
export function pointAt(pts, f) {
  const arc = [0];
  for (let i = 1; i < pts.length; i++) arc.push(arc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const t = f * arc[arc.length - 1];
  for (let i = 1; i < pts.length; i++) {
    if (t <= arc[i]) {
      const k = (t - arc[i - 1]) / (arc[i] - arc[i - 1] || 1);
      return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k];
    }
  }
  return pts[pts.length - 1];
}

// ---- merging ---------------------------------------------------------------------------
/** Merge [geometry, matrix?] pairs into one non-indexed geometry (position/normal/uv only). */
export function merge(list) {
  const geos = list.map(([g, m]) => {
    let x = g.index ? g.toNonIndexed() : g.clone();
    for (const k of Object.keys(x.attributes)) if (!['position', 'normal', 'uv'].includes(k)) x.deleteAttribute(k);
    if (!x.attributes.uv) x.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(x.attributes.position.count * 2), 2));
    x.clearGroups();
    if (m) x.applyMatrix4(m);
    return x;
  });
  const out = mergeGeometries(geos, false);
  geos.forEach((g) => g.dispose());
  return out;
}

export const M = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const rbox = (w, h, d, r = 0.02, seg = 2) => new RoundedBoxGeometry(w, h, d, seg, r);
const cyl = (r0, r1, h, n = 12) => new THREE.CylinderGeometry(r0, r1, h, n);

/** Side-profile extrusion (profile in x/y, extruded symmetric along z). */
function sideExtrude(points, width, bevel = 0.012) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: width - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 2, curveSegments: 6 });
  g.translate(0, 0, -(width - bevel * 2) / 2);
  return g;
}

// ---- seats -------------------------------------------------------------------------------
/**
 * Seat group geometry (facing +x). Returns geometries per material:
 * { fabric, shell, frame, cover, tray, pocket, arm }.
 * opts: n seats, pitch (seat-to-seat width), business flag.
 */
export function seatGroup({ n = 3, width = 0.44, step = 0.47, business = false } = {}) {
  const parts = { fabric: [], shell: [], frame: [], cover: [], tray: [], pocket: [], arm: [] };
  const bh = business ? 1.12 : 1.08; // backrest top
  const off = ((n - 1) * step) / 2;
  for (let i = 0; i < n; i++) {
    const z = i * step - off;
    // cushion
    parts.fabric.push([rbox(business ? 0.52 : 0.46, business ? 0.13 : 0.11, width, 0.035, 2), M(0.05, 0.445, z)]);
    // backrest: side profile with lumbar bulge, reclined slightly aft
    const back = business
      ? [[-0.15, 0.47], [-0.11, 0.62], [-0.15, 0.82], [-0.24, 1.06], [-0.28, bh], [-0.36, bh - 0.01], [-0.34, 0.85], [-0.27, 0.47]]
      : [[-0.16, 0.47], [-0.13, 0.6], [-0.17, 0.8], [-0.25, 1.04], [-0.28, bh], [-0.33, bh - 0.01], [-0.31, 0.82], [-0.26, 0.47]];
    parts.fabric.push([sideExtrude(back, width - 0.01, 0.018), M(0, 0, z)]);
    // rear shell (thin plastic behind the backrest)
    const shell = business
      ? [[-0.34, 0.42], [-0.37, 0.85], [-0.385, bh + 0.005], [-0.405, bh - 0.02], [-0.395, 0.8], [-0.36, 0.42]]
      : [[-0.3, 0.42], [-0.325, 0.82], [-0.335, bh + 0.005], [-0.355, bh - 0.02], [-0.345, 0.78], [-0.32, 0.42]];
    parts.shell.push([sideExtrude(shell, width + 0.01, 0.008), M(0, 0, z)]);
    // headrest cover on the upper front of the backrest
    // sits on the upper front face of the backrest (front line leans aft going up)
    parts.cover.push([box(0.008, 0.2, width - 0.05), business ? M(-0.199, bh - 0.12, z, 0, 0, 0.36) : M(-0.206, bh - 0.12, z, 0, 0, 0.32)]);
    // tray table (stowed) + latch, seat pocket
    const tx = business ? -0.392 : -0.348;
    parts.tray.push([rbox(0.016, 0.24, width - 0.09, 0.006, 1), M(tx - 0.006, 0.88, z, 0, 0, 0.07)]);
    parts.frame.push([box(0.012, 0.025, 0.05), M(tx - 0.012, 1.02, z)]);
    parts.pocket.push([rbox(0.03, 0.2, width - 0.08, 0.01, 1), M(tx + 0.0, 0.6, z, 0, 0, 0.04)]);
    // seat pan underside
    parts.shell.push([box(0.42, 0.035, width - 0.02), M(0.03, 0.37, z)]);
  }
  // armrests (n + 1), aisle-side and window-side ends included
  for (let i = 0; i <= n; i++) {
    const z = i * step - off - step / 2;
    const w = business ? (i === 0 || i === n ? 0.07 : 0.14) : 0.05;
    parts.arm.push([rbox(business ? 0.48 : 0.38, 0.05, w, 0.018, 1), M(business ? 0.0 : 0.0, business ? 0.64 : 0.62, z)]);
    parts.shell.push([box(0.06, 0.2, w * 0.7), M(-0.16, 0.52, z)]);
    if (business && i > 0 && i < n) parts.shell.push([box(0.4, 0.2, 0.13), M(0.0, 0.53, z)]);
  }
  // legs, beams, baggage bar
  const span = n * step;
  for (const lz of [-span * 0.3, span * 0.3]) {
    parts.frame.push([cyl(0.018, 0.022, 0.36), M(0.17, 0.18, lz, 0, 0, -0.12)]);
    parts.frame.push([cyl(0.018, 0.022, 0.38), M(-0.18, 0.18, lz, 0, 0, 0.25)]);
    parts.frame.push([box(0.5, 0.025, 0.04), M(0.0, 0.015, lz)]);
    parts.frame.push([box(0.05, 0.05, 0.04), M(0.0, 0.35, lz)]);
  }
  for (const bx of [0.13, -0.13]) parts.frame.push([cyl(0.02, 0.02, span - 0.02), M(bx, 0.35, 0, Math.PI / 2, 0, 0)]);
  parts.frame.push([cyl(0.008, 0.008, span - 0.1), M(0.27, 0.07, 0, Math.PI / 2, 0, 0)]);
  const out = {};
  for (const [k, list] of Object.entries(parts)) out[k] = list.length ? merge(list) : null;
  return out;
}

/** Life-vest pouch under a seat (one per seat). */
export function vestPouch() { return merge([[box(0.07, 0.045, 0.26), M(0, 0, 0)]]); }

// ---- overhead bins ----------------------------------------------------------------------
/** Right-side bin cross-section (z, y), extruded along x over `len`, centered at x = 0. */
export const BIN_SECTION = [
  [1.66, 1.555], [0.88, 1.615], [0.84, 1.632], [0.82, 1.7], [0.805, 1.82], [0.82, 1.94], [0.86, 2.025], [0.9, 2.055],
  [1.3, 2.04], [1.45, 1.92], [1.57, 1.75], [1.64, 1.62],
];
export function binGeometry(len) {
  const shape = new THREE.Shape(BIN_SECTION.map(([z, y]) => new THREE.Vector2(-z, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 4 });
  g.translate(0, 0, -len / 2);
  g.rotateY(Math.PI / 2); // shape X(-z) → world z, extrusion → world x
  return g;
}
/** Height of the bin underside at z (right side). */
export const binBottomY = (z) => 1.555 + ((1.66 - z) / (1.66 - 0.88)) * 0.06;
export const BIN_TILT = Math.atan2(0.06, 0.78);

// ---- windows ------------------------------------------------------------------------------
function rrectPts(w, h, r, n = 6) {
  const pts = [];
  const cs = [[w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, Math.PI / 2], [-w / 2 + r, -h / 2 + r, Math.PI], [w / 2 - r, -h / 2 + r, Math.PI * 1.5]];
  for (const [cx, cy, a0] of cs) for (let i = 0; i <= n; i++) {
    const a = a0 + (i / n) * (Math.PI / 2);
    pts.push(new THREE.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
  }
  return pts;
}
export const WIN = { w: 0.255, h: 0.355, r: 0.1, pitch: 0.508, bezelW: 0.32, pane: { w: 0.215, h: 0.31, r: 0.085 }, depth: 0.075 };

/**
 * Window parts in a local frame: x along the cabin, y up the band, -z into the wall
 * (local +z faces the cabin). Returns { bezel, tunnel, pane, shade }.
 */
export function windowParts() {
  const bh = BAND.y1 - BAND.y0 + 0.002;
  const outer = new THREE.Shape([new THREE.Vector2(-WIN.bezelW / 2, -bh / 2), new THREE.Vector2(WIN.bezelW / 2, -bh / 2), new THREE.Vector2(WIN.bezelW / 2, bh / 2), new THREE.Vector2(-WIN.bezelW / 2, bh / 2)]);
  outer.holes.push(new THREE.Path(rrectPts(WIN.w, WIN.h, WIN.r).reverse()));
  const bezel = new THREE.ShapeGeometry(outer, 6);
  // tunnel: loft between the bezel opening and the pane
  const a = rrectPts(WIN.w, WIN.h, WIN.r), b = rrectPts(WIN.pane.w, WIN.pane.h, WIN.pane.r);
  const pos = [], uv = [], idx = [];
  const N = a.length;
  for (let i = 0; i < N; i++) {
    pos.push(a[i].x, a[i].y, 0, b[i].x, b[i].y, -WIN.depth);
    uv.push(i / N, 0, i / N, 1);
  }
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    const A = i * 2, B = i * 2 + 1, C = j * 2 + 1, D = j * 2;
    idx.push(A, B, D, D, B, C);
  }
  const tunnel = new THREE.BufferGeometry();
  tunnel.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  tunnel.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  tunnel.setIndex(idx);
  tunnel.computeVertexNormals();
  // the loft winds counter-clockwise, so make sure normals face inward (toward the opening axis)
  const nrm = tunnel.attributes.normal;
  const p0 = new THREE.Vector3().fromBufferAttribute(tunnel.attributes.position, 0);
  const n0 = new THREE.Vector3().fromBufferAttribute(nrm, 0);
  if (n0.x * p0.x + n0.y * p0.y > 0) {
    const ix = tunnel.index.array;
    for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
    tunnel.computeVertexNormals();
  }
  const pane = new THREE.ShapeGeometry(new THREE.Shape(b), 6);
  pane.translate(0, 0, -WIN.depth + 0.002);
  // normalize pane UVs to 0..1
  const pu = pane.attributes.uv;
  for (let i = 0; i < pu.count; i++) pu.setXY(i, pu.getX(i) / WIN.pane.w + 0.5, pu.getY(i) / WIN.pane.h + 0.5);
  const shade = new THREE.PlaneGeometry(WIN.w * 0.93, 1); // scaled in y per instance, anchored at top
  shade.translate(0, -0.5, -0.018);
  return { bezel, tunnel, pane, shade };
}

/** Matrix placing a window-band local frame at cabin x on side s (+1 right, -1 left). */
export function bandFrame(x, s, inset = 0) {
  const ym = (BAND.y0 + BAND.y1) / 2, zm = (BAND.z0 + BAND.z1) / 2;
  const tilt = Math.atan2(BAND.z0 - BAND.z1, BAND.y1 - BAND.y0); // wall leans inward at the top
  // local +z must face the cabin: right side faces -z (yaw -90° turns local +z to world -x… use explicit basis)
  const up = new THREE.Vector3(0, Math.cos(tilt), -s * Math.sin(tilt));
  const inward = new THREE.Vector3(0, Math.sin(tilt), -s * Math.cos(tilt));
  const along = new THREE.Vector3().crossVectors(up, inward); // right-handed: x = y × z
  const m = new THREE.Matrix4().makeBasis(along, up, inward);
  m.setPosition(x, ym + inward.y * inset, s * zm + inward.z * inset);
  return m;
}
