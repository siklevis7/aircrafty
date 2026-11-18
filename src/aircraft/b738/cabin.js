// Procedural 737-800 (NG) passenger cabin. Local coordinates: floor at y = 0, +x forward,
// +z to the right (looking forward), cabin centerline z = 0. Forward bulkhead at x = +15,
// aft bulkhead at x = -15. Typical two-class layout: 4 rows 2-2 + 24 rows 3-3.
// Clickable zones carry userData.partId matching cabin-parts.js. Secondary copies of a zone
// are tagged side 'R' so the viewer focuses on / places its marker at the primary one.
import * as THREE from 'three';
import {
  PROFILE, BAND, wallZ, profileBetween, sweep, pointAt, arcLength, merge, M,
  seatGroup, vestPouch, binGeometry, binBottomY, BIN_TILT, windowParts, bandFrame, WIN,
} from './cabin-geom.js';
import * as TX from './cabin-textures.js';
import { cabinParts } from './cabin-parts.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const XF = 15, XA = -15;
const tmpColor = new THREE.Color();
// zones nested inside another zone get their hit plane lifted toward the camera so they win the pick
const HIT_LIFT = { 'cab-slide': 0.15, 'cab-pax-oxygen': 0.4, 'cab-lav-bin-ext': 0.04, 'cab-lav-smoke': 0.05 };

// ---- layout ------------------------------------------------------------------------------
const DOORS = [
  { id: 'cab-door-l1', x: 14.0, s: -1, w: 0.86, h: 1.83 },
  { id: 'cab-door-r1', x: 14.0, s: 1, w: 0.78, h: 1.68 },
  { id: 'cab-doors-aft', x: -13.1, s: -1, w: 0.86, h: 1.83 },
  { id: 'cab-doors-aft', x: -13.1, s: 1, w: 0.78, h: 1.68, secondary: true },
];
const WIN_X0 = 12.15, WIN_N = 47;
const winX = (i) => WIN_X0 - i * WIN.pitch;
const HATCH_SLOTS = [25, 27]; // overwing exit hatches replace these window slots (window in hatch)
const BIZ_X = [11.75, 10.785, 9.82, 8.855];
function econRows() {
  const h1 = winX(HATCH_SLOTS[0]), h2 = winX(HATCH_SLOTS[1]);
  const e1 = h1 - 0.05, e2 = h2 - 0.05; // exit rows sit beside the hatches
  const rows = [];
  for (let x = e1 + 0.85; x <= 7.75; x += 0.775) rows.push(x);
  rows.reverse();
  rows.push(e1, e2);
  for (let x = e2 - 0.8; x >= -11.0; x -= 0.775) rows.push(x);
  return rows;
}

export function buildCabin(systems) {
  const root = new THREE.Group();
  root.name = 'b738-cabin';
  const debug = (root.userData.debug = { masks: false, doors: false, power: null, emer: null });

  // ---- materials
  const grain = TX.plasticGrain().normalMap;
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0, ...o });
  const plastic = (color, o = {}) => std({ color, roughness: 0.5, normalMap: grain, normalScale: new THREE.Vector2(0.25, 0.25), ...o });
  const upperPts = profileBetween(BAND.y1, 2.22);
  const washFn = (f) => {
    const [z, y] = pointAt(upperPts, f);
    if (y < 1.556) return 0.12 + 0.5 * Math.pow((y - BAND.y1) / (1.556 - BAND.y1), 1.6);
    if (z > 0.93 && y < 2.07) return 0;
    const k = Math.min(1, Math.max(0, (z - 0.2) / 0.75));
    return 0.32 + 0.58 * k * k;
  };
  const mats = {
    wall: plastic('#ecebe6'),
    ceiling: plastic('#efeee9', { emissive: new THREE.Color('#ffe8cc'), emissiveMap: TX.washGradient('upper', washFn), emissiveIntensity: 0.5 }),
    bezel: plastic('#f1f0eb', { side: THREE.DoubleSide }),
    tunnel: plastic('#e3e2dc', { side: THREE.DoubleSide }),
    pane: new THREE.MeshBasicMaterial({ map: TX.windowSky().map }),
    shade: plastic('#f3f2ec', { side: THREE.DoubleSide, roughness: 0.55 }),
    bin: plastic('#f4f3ef', { roughness: 0.42 }),
    latch: std({ color: '#7a7f86', roughness: 0.4, metalness: 0.3 }),
    psu: std({ map: TX.psuFace(), roughness: 0.55 }),
    psuDoor: plastic('#e7e6e0'),
    fabric: std({ ...TX.fabric('econ', '#24324c', '#33466a'), roughness: 0.95, normalScale: new THREE.Vector2(0.7, 0.7) }),
    leather: std({ ...TX.leather(), roughness: 0.5, normalScale: new THREE.Vector2(0.5, 0.5) }),
    seatShell: plastic('#cfd1d3', { roughness: 0.45 }),
    bizShell: plastic('#6d6259', { roughness: 0.4 }),
    frame: std({ color: '#a2a8ae', metalness: 0.85, roughness: 0.32 }),
    cover: std({ map: TX.headrestCover().map, roughness: 0.9 }),
    tray: plastic('#b3b7bb'),
    pocket: std({ color: '#22252a', roughness: 0.92 }),
    arm: std({ color: '#3a3e44', roughness: 0.55 }),
    vest: std({ color: '#3b4250', roughness: 0.85 }),
    carpet: std({ ...TX.carpet(), roughness: 1 }),
    aisle: std({ ...TX.aisleCarpet(), roughness: 1 }),
    steel: std({ ...TX.brushed(), metalness: 0.75, roughness: 0.35 }),
    dark: std({ color: '#1e2125', roughness: 0.55 }),
    grey: plastic('#9da2a7'),
    red: std({ color: '#c3201b', roughness: 0.45 }),
    yellow: std({ color: '#f1c40f', roughness: 0.5 }),
    tube: std({ color: '#dfe6ea', roughness: 0.3, transparent: true, opacity: 0.75 }),
    strip: std({ color: '#ffffff', emissive: new THREE.Color('#ffe7c4'), emissiveIntensity: 2.2, roughness: 0.4 }),
    emerLamp: std({ color: '#e8e8e2', emissive: new THREE.Color('#000000'), roughness: 0.4 }),
    mirror: std({ color: '#d9e0e6', metalness: 1, roughness: 0.06 }),
    door: plastic('#e6e5df', { side: THREE.DoubleSide }),
    curtain: std({ ...TX.fabric('curtain', '#5d6a84', '#66748f', 9), roughness: 1 }),
    glow: std({ color: '#f4f0e6', emissive: new THREE.Color('#fff4e0'), emissiveIntensity: 1.2 }),
  };
  mats.carpet.map.repeat.set(30 / 1.4, 3.3 / 1.4);
  mats.carpet.normalMap.repeat.set(30 / 0.35, 3.3 / 0.35);

  const add = (geo, mat, matrix, parent = root, ud = null) => {
    const m = new THREE.Mesh(geo, mat);
    if (matrix) { if (matrix.isMatrix4) matrix.decompose(m.position, m.quaternion, m.scale); else m.position.copy(matrix); }
    if (ud) Object.assign(m.userData, ud);
    parent.add(m);
    return m;
  };
  const boxM = (w, h, d, mat, pos, parent = root, ud = null) => add(new THREE.BoxGeometry(w, h, d), mat, pos, parent, ud);
  // plane facing a direction ('+x' '-x' '+z' '-z' '-y'), oriented so textures read correctly from the cabin
  const plane = (w, h, mat, pos, facing, parent = root, ud = null) => {
    const g = new THREE.PlaneGeometry(w, h);
    if (facing === '+x') g.rotateY(Math.PI / 2);
    else if (facing === '-x') g.rotateY(-Math.PI / 2);
    else if (facing === '-z') g.rotateY(Math.PI);
    else if (facing === '-y') g.rotateX(Math.PI / 2);
    return add(g, mat, pos, parent, ud);
  };
  const instanced = (geo, mat, matrices, ud = null) => {
    const im = new THREE.InstancedMesh(geo, mat, matrices.length);
    matrices.forEach((m, i) => im.setMatrixAt(i, m));
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    if (ud) Object.assign(im.userData, ud);
    root.add(im);
    return im;
  };
  const noShadow = (o) => { o.userData.noShadow = true; return o; };
  const partMat = (base) => base.clone(); // own material per clickable zone (viewer clones again, harmless)

  // ---- outside world (sky dome seen through windows and open doors)
  {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(140, 48, 24), new THREE.MeshBasicMaterial({ map: TX.skyDome().map, side: THREE.BackSide, fog: false }));
    dome.position.y = -1.5;
    dome.raycast = () => {};
    noShadow(dome);
    root.add(dome);
  }

  // ---- fuselage shell
  const doorsBySide = { 1: [], [-1]: [] };
  DOORS.forEach((d) => doorsBySide[d.s].push(d));
  const winSpan = [winX(WIN_N - 1) - WIN.pitch / 2, WIN_X0 + WIN.pitch / 2];
  for (const s of [1, -1]) {
    const mirror = s < 0;
    const cuts = doorsBySide[s].map((d) => [d.x - d.w / 2 - 0.04, d.x + d.w / 2 + 0.04]).sort((a, b) => a[0] - b[0]);
    // x intervals: solid walls between doors, upper-only over doors
    let x = XA;
    const solids = [];
    for (const [a, b] of cuts) { solids.push([x, a]); x = b; }
    solids.push([x, XF]);
    for (const [a, b] of solids) {
      const lo = Math.max(a, winSpan[0]), hi = Math.min(b, winSpan[1]);
      if (hi > lo) {
        // windowed stretch: lower + upper sweeps, band filled by piers and window bezels
        add(sweep(profileBetween(0, BAND.y0), lo, hi, { mirror, uScale: 1, vScale: 1 }), mats.wall);
        add(sweep(upperPts, lo, hi, { mirror, uScale: 1 }), mats.ceiling);
        if (lo > a) add(sweep([[BAND.z0, BAND.y0], [BAND.z1, BAND.y1]], a, lo, { mirror }), mats.wall);
        if (hi < b) add(sweep([[BAND.z0, BAND.y0], [BAND.z1, BAND.y1]], hi, b, { mirror }), mats.wall);
        if (lo > a) { add(sweep(profileBetween(0, BAND.y0), a, lo, { mirror, vScale: 1 }), mats.wall); add(sweep(upperPts, a, lo, { mirror }), mats.ceiling); }
        if (hi < b) { add(sweep(profileBetween(0, BAND.y0), hi, b, { mirror, vScale: 1 }), mats.wall); add(sweep(upperPts, hi, b, { mirror }), mats.ceiling); }
      } else {
        add(sweep(profileBetween(0, BAND.y0), a, b, { mirror, vScale: 1 }), mats.wall);
        add(sweep([[BAND.z0, BAND.y0], [BAND.z1, BAND.y1]], a, b, { mirror }), mats.wall);
        add(sweep(upperPts, a, b, { mirror }), mats.ceiling);
      }
    }
    const upTotal = arcLength(upperPts), upStart = arcLength(profileBetween(BAND.y1, 1.9));
    doorsBySide[s].forEach((d) => {
      const a = d.x - d.w / 2 - 0.04, b = d.x + d.w / 2 + 0.04;
      add(sweep(profileBetween(1.9, 2.22), a, b, { mirror, vStart: upStart, vTotal: upTotal }), mats.ceiling);
      add(sweep(profileBetween(d.h - 0.01, 1.9), a, b, { mirror }), mats.wall);
    });
  }

  // window band: piers between windows, bezels, reveal tunnels, panes, shades
  {
    const wp = windowParts();
    const pierLen = WIN.pitch - WIN.bezelW;
    const pierGeo = { 1: sweep([[BAND.z0, BAND.y0], [BAND.z1, BAND.y1]], -0.5, 0.5), [-1]: sweep([[BAND.z0, BAND.y0], [BAND.z1, BAND.y1]], -0.5, 0.5, { mirror: true }) };
    const piers = { 1: [], [-1]: [] }, frames = [], shades = [];
    const REP_WIN = 9;
    let repFrame = null;
    const shadeOf = (i, s) => { const r = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453; const f = r - Math.floor(r); return f < 0.55 ? 0 : f < 0.8 ? 0.35 + f * 0.3 : 1; };
    for (const s of [1, -1]) {
      for (let i = 0; i < WIN_N; i++) {
        const x = winX(i);
        if (s < 0 && i === REP_WIN) repFrame = bandFrame(x, s); else frames.push(bandFrame(x, s));
        if (i < WIN_N - 1) piers[s].push(M(x - WIN.pitch / 2, 0, 0, 0, 0, 0, pierLen, 1, 1));
        const f = HATCH_SLOTS.includes(i) ? 0 : shadeOf(i, s);
        if (f > 0) {
          const top = WIN.h / 2;
          shades.push(bandFrame(x, s).multiply(M(0, top, 0, 0, 0, 0, 1, WIN.h * f, 1)));
        }
      }
      // fill the half-pier at each end of the windowed stretch
      piers[s].push(M(winX(0) + WIN.pitch / 2 - pierLen / 4, 0, 0, 0, 0, 0, pierLen / 2, 1, 1));
      piers[s].push(M(winX(WIN_N - 1) - WIN.pitch / 2 + pierLen / 4, 0, 0, 0, 0, 0, pierLen / 2, 1, 1));
    }
    // window band pieces are part of the clickable "windows & sidewall" zone (so they also hide hotspots behind them)
    for (const s of [1, -1]) instanced(pierGeo[s], mats.wall, piers[s], { partId: 'cab-windows' });
    instanced(wp.bezel, mats.bezel, frames, { partId: 'cab-windows' });
    instanced(wp.tunnel, mats.tunnel, frames, { partId: 'cab-windows' });
    add(wp.bezel, mats.bezel, repFrame, root, { partId: 'cab-windows' });
    add(wp.tunnel, mats.tunnel, repFrame, root, { partId: 'cab-windows' });
    noShadow(add(wp.pane, mats.pane, repFrame));
    noShadow(instanced(wp.pane, mats.pane, frames));
    if (shades.length) instanced(wp.shade, mats.shade, shades);
  }

  // floor, aisle runner
  {
    const floor = add(new THREE.PlaneGeometry(30, 3.3).rotateX(-Math.PI / 2), mats.carpet, V(0, 0, 0));
    floor.userData.floor = true;
    const L = 24.2;
    const ag = new THREE.PlaneGeometry(0.5, L).rotateX(-Math.PI / 2).rotateY(Math.PI / 2);
    mats.aisle.map.repeat.set(1, L / 1.2);
    add(ag, mats.aisle, V(0.55, 0.003, 0));
    // entry areas: hard-wearing floor panels at the doors
    const entry = std({ color: '#4a4e55', roughness: 0.8 });
    boxM(2.4, 0.006, 3.2, entry, V(13.9, 0.003, 0));
    boxM(1.6, 0.006, 3.2, entry, V(-13.25, 0.003, 0));
  }

  // bulkheads
  {
    const half = PROFILE.map(([z, y]) => [z, y]);
    const outline = [...half, ...half.slice(0, -1).reverse().map(([z, y]) => [-z, y])];
    const fwd = new THREE.Shape();
    fwd.moveTo(0.4, 0);
    outline.forEach(([z, y]) => fwd.lineTo(z, y));
    fwd.lineTo(-0.4, 0); fwd.lineTo(-0.4, 1.98); fwd.lineTo(0.4, 1.98); fwd.closePath();
    add(new THREE.ShapeGeometry(fwd).rotateY(-Math.PI / 2), plastic('#ecebe6'), V(XF, 0, 0), root, { partId: 'cab-cockpit-door', side: 'R' });
    const aft = new THREE.Shape(outline.map(([z, y]) => new THREE.Vector2(z, y)));
    add(new THREE.ShapeGeometry(aft).rotateY(Math.PI / 2), plastic('#ecebe6'), V(XA, 0, 0), root, { partId: 'cab-galley-aft', side: 'R' });
  }

  // ---- seats
  const rowsE = econRows();
  const rows = [
    ...BIZ_X.map((x) => ({ x, biz: true })),
    ...rowsE.map((x) => ({ x, biz: false })),
  ];
  {
    const econ = seatGroup({ n: 3, width: 0.44, step: 0.47 });
    const biz = seatGroup({ n: 2, width: 0.52, step: 0.66, business: true });
    const ez = 0.26 + 0.705, bz = 0.47 + 0.6;
    const em = [], bm = [], vests = [], bizRep = [];
    const vestRep = { x: rowsE[3], z: -(ez + 0.47) };
    for (const r of rows) for (const s of [1, -1]) {
      if (r.biz) {
        if (r.x === BIZ_X[0] && s === -1) bizRep.push(M(r.x, 0, -bz)); else bm.push(M(r.x, 0, s * bz));
        for (const dz of [-0.33, 0.33]) vests.push(M(r.x + 0.22, 0.31, s * bz + dz, 0, 0, 0, 1, 1, 1.6 / 1.4));
      } else {
        em.push(M(r.x, 0, s * ez));
        for (const dz of [-0.47, 0, 0.47]) {
          const z = s * ez + dz;
          if (r.x === vestRep.x && Math.abs(z - vestRep.z) < 1e-6) continue;
          vests.push(M(r.x + 0.2, 0.31, z));
        }
      }
    }
    const seatMats = (business) => ({
      fabric: business ? mats.leather : mats.fabric, shell: business ? mats.bizShell : mats.seatShell, frame: mats.frame,
      cover: mats.cover, tray: mats.tray, pocket: mats.pocket, arm: mats.arm,
    });
    for (const [geo, list, business] of [[econ, em, false], [biz, bm, true]]) {
      const sm = seatMats(business);
      for (const k of Object.keys(geo)) if (geo[k]) instanced(geo[k], sm[k], list);
      // low-poly invisible pick proxy (the viewer raycasts every triangle of clickable meshes)
      const n = business ? 2 : 3;
      const proxy = new THREE.BoxGeometry(business ? 0.3 : 0.26, 0.66, n * (business ? 0.66 : 0.47)); // backrest volume only
      proxy.translate(business ? -0.25 : -0.23, 0.79, 0);
      // invisible (colorWrite off) but opacity > 0.5 so the viewer treats seats as hotspot occluders
      const pm = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.6, depthWrite: false, colorWrite: false });
      noShadow(instanced(proxy, pm, list, { partId: 'cab-seats', side: 'R', bulb: true })); // bulb: viewer won't make it cast shadows
    }
    // representative business seat (regular meshes so it can carry the hotspot marker)
    const sm = seatMats(true);
    for (const k of Object.keys(biz)) if (biz[k]) add(biz[k], sm[k], bizRep[0], root, k === 'fabric' ? { partId: 'cab-seats' } : null);
    // life vest pouches
    const vg = vestPouch();
    instanced(vg, mats.vest, vests, { partId: 'cab-life-vests' });
    add(vg, mats.vest, V(vestRep.x + 0.2, 0.31, vestRep.z), root, { partId: 'cab-life-vests' });
    // class divider: low partitions from the sidewall plus a curtain track across the ceiling
    for (const s of [1, -1]) {
      const pts = profileBetween(0, 1.05).map(([z, y]) => new THREE.Vector2(z - 0.01, y));
      const shp = new THREE.Shape([new THREE.Vector2(0.6, 0), ...pts, new THREE.Vector2(0.6, 1.05)]);
      const pg = new THREE.ExtrudeGeometry(shp, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2 });
      pg.rotateY(-Math.PI / 2);
      if (s < 0) pg.scale(1, 1, -1);
      const part = add(pg, s < 0 ? plastic('#e6e4de', { side: THREE.DoubleSide }) : plastic('#e6e4de'), V(8.2, 0, 0));
      part.userData.keep = true;
      boxM(0.03, 0.02, 0.9, mats.grey, V(8.2, 2.17, s * 0.42));
      // curtain bunched (tied back) against the partition's aisle edge
      const cg = new THREE.CylinderGeometry(0.03, 0.045, 1.05, 10, 1, true);
      add(cg, mats.curtain, V(8.2, 1.62, s * 0.62));
    }
  }

  // ---- overhead bins, PSUs, oxygen masks
  const BIN_A = 12.35, BIN_B = -11.4, BIN_N = 22;
  const binStep = (BIN_A - BIN_B) / BIN_N;
  {
    const bg = binGeometry(binStep - 0.008);
    const list = [], latches = [];
    const repIdx = 6;
    let rep = null;
    for (const s of [1, -1]) for (let i = 0; i < BIN_N; i++) {
      const x = BIN_A - (i + 0.5) * binStep;
      const m = s > 0 ? M(x, 0, 0) : M(x, 0, 0, 0, Math.PI, 0);
      if (s < 0 && i === repIdx) rep = m; else list.push(m);
      latches.push(M(x, 1.655, s * 0.832));
    }
    instanced(bg, mats.bin, list, { partId: 'cab-bins' });
    add(bg, mats.bin, rep, root, { partId: 'cab-bins' });
    instanced(new THREE.BoxGeometry(0.1, 0.018, 0.008), mats.latch, latches);
    // cove (uplight) and sidewall wash strips along the bins
    for (const s of [1, -1]) {
      const L = BIN_A - BIN_B, xc = (BIN_A + BIN_B) / 2;
      noShadow(boxM(L, 0.008, 0.03, mats.strip, V(xc, 2.062, s * 0.93)));
      noShadow(boxM(L, 0.006, 0.025, mats.strip, V(xc, 1.548, s * 1.63)));
    }
  }
  const psu = { list: [], doors: [], masks: [], rep: null };
  {
    const PSU_Z = 1.21, PSU_W = 0.62;
    const pg = new THREE.PlaneGeometry(1, PSU_W).rotateX(Math.PI / 2);
    const tilt = new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), BIN_TILT);
    const yaw = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), Math.PI);
    const ez = 0.26 + 0.705, bz = 0.47 + 0.6;
    const repRow = rows[8];
    const matrices = [];
    for (const r of rows) for (const s of [1, -1]) {
      const len = r.biz ? 0.82 : 0.64;
      const px = r.x - 0.12;
      const q = s > 0 ? tilt.clone() : yaw.clone().multiply(tilt);
      const m = new THREE.Matrix4().compose(V(px, binBottomY(PSU_Z) - 0.012, s * PSU_Z), q, V(len, 1, 1));
      const entry = { m, q, px, s, len, biz: r.biz };
      if (r === repRow && s < 0) psu.rep = entry; else matrices.push(m);
      psu.list.push(entry);
      // masks: one per seat plus a spare
      const seatZ = r.biz ? [-0.33, 0.33].map((d) => s * bz + d) : [-0.47, 0, 0.47].map((d) => s * ez + d);
      const zs = [...seatZ, s * ez + (r.biz ? 0 : 0.2)];
      zs.forEach((z, k) => {
        // masks fall from the mask door and hang almost vertically, leaning toward their seat
        const az = s * Math.min(1.48, Math.max(0.96, Math.abs(z) * 0.55 + 0.62 + (k === zs.length - 1 ? 0.06 : 0)));
        psu.masks.push({
          top: V(px + (k % 2 ? 0.08 : -0.08), binBottomY(Math.abs(az)) - 0.02, az),
          end: V(px + 0.04 + (k % 2) * 0.05, 1.16 + ((k * 37) % 7) * 0.014, az * 0.7 + z * 0.3),
          phase: (r.x * 3.1 + k * 1.7) % 6.28, delay: ((k * 13 + Math.round(r.x * 7)) % 10) * 0.025,
        });
      });
    }
    instanced(pg, mats.psu, matrices, { partId: 'cab-psu' });
    add(pg, mats.psu, psu.rep.m, root, { partId: 'cab-psu' });
    // oxygen doors (hinged on the outboard edge, local z+)
    const dg = new THREE.BoxGeometry(1, 0.008, 0.235);
    dg.translate(0, -0.006, -0.1175);
    psu.doorGeo = dg;
    psu.doorMats = [];
    psu.list.forEach((p) => {
      p.hinge = new THREE.Matrix4().compose(V(p.px, binBottomY(PSU_Z) - 0.012, p.s * PSU_Z), p.q, V(1, 1, 1))
        .multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.285));
    });
    const doorList = psu.list.filter((p) => p !== psu.rep);
    psu.doorIM = instanced(dg, mats.psuDoor, doorList.map((p) => p.hinge.clone().multiply(new THREE.Matrix4().makeScale(p.len * 0.86, 1, 1))), { partId: 'cab-pax-oxygen' });
    psu.doorIM.userData.entries = doorList;
    psu.repDoor = add(dg, mats.psuDoor, null, root, { partId: 'cab-pax-oxygen' });
    psu.repDoor.matrixAutoUpdate = false;
    psu.repDoor.matrix.copy(psu.rep.hinge).multiply(new THREE.Matrix4().makeScale(psu.rep.len * 0.86, 1, 1));
    // masks + hoses (hidden until deployed)
    const mg = merge([
      [new THREE.CylinderGeometry(0.022, 0.034, 0.045, 16, 1, false), M(0, -0.02, 0)],
      [new THREE.TorusGeometry(0.034, 0.003, 6, 20), M(0, -0.043, 0, Math.PI / 2, 0, 0)],
      [new THREE.TorusGeometry(0.05, 0.0018, 4, 20), M(0, -0.03, 0.0, 0.25, 0, 0)],
    ]);
    const maskGeo = mg;
    psu.maskIM = instanced(maskGeo, mats.yellow, psu.masks.map(() => new THREE.Matrix4()));
    psu.hoseIM = instanced(new THREE.CylinderGeometry(0.0035, 0.0035, 1, 5).translate(0, -0.5, 0), mats.tube, psu.masks.map(() => new THREE.Matrix4()));
    psu.maskIM.visible = psu.hoseIM.visible = false;
    psu.maskIM.frustumCulled = psu.hoseIM.frustumCulled = false;
    noShadow(psu.hoseIM);
  }

  // ---- doors (L1, R1, L2, R2)
  const doors = [];
  const exitSigns = [];
  for (const d of DOORS) {
    const s = d.s, mirror = s < 0;
    const ud = d.secondary ? { partId: d.id, side: 'R' } : { partId: d.id };
    const zW = (y) => s * wallZ(y);
    const pivotPos = V(d.x + d.w / 2, 0, s * 1.7);
    const pivot = new THREE.Group();
    pivot.position.copy(pivotPos);
    root.add(pivot);
    // lining panel following the fuselage curve
    const pg = sweep(profileBetween(0.015, d.h), d.x - d.w / 2, d.x + d.w / 2, { mirror });
    const uv = pg.attributes.uv, pos = pg.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setX(i, 0.5 - s * ((pos.getX(i) - d.x) / d.w));
    pg.translate(-pivotPos.x, 0, -pivotPos.z);
    const dmat = partMat(mats.door); dmat.map = TX.doorFace(d.id);
    add(pg, dmat, null, pivot, ud);
    const local = (x, y, z) => V(x - pivotPos.x, y, z - pivotPos.z);
    // viewport
    const vpY = 1.5, vpZ = zW(vpY) - s * 0.012;
    const ring = add(new THREE.TorusGeometry(0.085, 0.018, 10, 28), mats.grey, local(d.x, vpY, vpZ), pivot, ud);
    ring.rotation.y = Math.PI / 2;
    const glass = add(new THREE.CircleGeometry(0.08, 24), mats.pane, local(d.x, vpY, vpZ + s * 0.004), pivot);
    glass.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2;
    noShadow(glass);
    // warning strap across the viewport (shown when armed)
    const strap = boxM(0.022, 0.25, 0.006, mats.red, local(d.x, vpY, vpZ - s * 0.02), pivot);
    strap.rotation.z = 0.6; strap.userData.keep = true;
    // main handle: pivot hub + lever
    const hY = 1.05, hZ = zW(hY) - s * 0.05;
    const hub = add(new THREE.CylinderGeometry(0.035, 0.035, 0.05, 16), mats.grey, local(d.x, hY, hZ), pivot, ud);
    hub.rotation.x = Math.PI / 2;
    const lever = boxM(0.32, 0.035, 0.035, mats.grey, local(d.x - 0.12, hY, hZ - s * 0.03), pivot, ud);
    lever.rotation.z = 0.15;
    boxM(0.06, 0.04, 0.04, mats.red, local(d.x - 0.27, hY - 0.02, hZ - s * 0.03), pivot);
    // assist handle on the door
    boxM(0.03, 0.42, 0.03, mats.grey, local(d.x + d.w / 2 - 0.1, 1.12, zW(1.12) - s * 0.06), pivot, ud);
    // slide bustle with pressure gauge and placard
    const bw = d.w - 0.12;
    const bustle = add(new THREE.BoxGeometry(bw, 0.34, 0.2), partMat(mats.grey), local(d.x, 0.2, zW(0.2) - s * 0.11), pivot,
      d.id === 'cab-door-l1' ? { partId: 'cab-slide' } : { partId: 'cab-slide', side: 'R' });
    bustle.material.color.set('#a7acb1');
    plane(0.34, 0.1, std({ map: TX.placard('slide', 'ESCAPE SLIDE', { w: 512, h: 150, bg: '#c9ccd0', fg: '#1b1d20' }) }),
      local(d.x - 0.08, 0.24, zW(0.2) - s * 0.2115), s > 0 ? '-z' : '+z', pivot);
    const gauge = add(new THREE.CylinderGeometry(0.025, 0.025, 0.01, 16), mats.dark, local(d.x + bw / 2 - 0.08, 0.3, zW(0.2) - s * 0.212), pivot);
    gauge.rotation.x = Math.PI / 2;
    // girt bar: in floor brackets (armed) or in stowage hooks on the bustle (disarmed)
    const girt = add(new THREE.CylinderGeometry(0.012, 0.012, bw + 0.04, 10), mats.frame, null, pivot,
      d.id === 'cab-door-l1' ? { partId: 'cab-slide' } : { partId: 'cab-slide', side: 'R' });
    girt.rotation.z = Math.PI / 2;
    const girtArmed = local(d.x, 0.035, s * 1.5);
    const girtStowed = local(d.x, 0.39, zW(0.2) - s * 0.2);
    for (const dx of [-1, 1]) boxM(0.05, 0.04, 0.06, mats.frame, V(d.x + dx * (bw / 2 - 0.02), 0.02, s * 1.5));
    // frame lining: jambs + header, frame assist handles
    for (const dx of [-1, 1]) {
      const jx = d.x + dx * (d.w / 2 + 0.035);
      boxM(0.07, d.h + 0.06, 0.16, mats.wall, V(jx, (d.h + 0.06) / 2, s * 1.68));
      boxM(0.025, 0.5, 0.025, mats.grey, V(jx, 1.1, s * 1.57));
    }
    const hdrY = Math.max(d.h + 0.05, 1.9);
    boxM(d.w + 0.14, 0.08, 0.2, mats.wall, V(d.x, hdrY, s * (wallZ(hdrY) - 0.06)));
    // EXIT sign over the door
    const sign = plane(0.3, 0.11, partMat(std({ map: TX.exitSign('door'), emissiveMap: TX.exitSign('door'), emissive: new THREE.Color('#000') })),
      V(d.x, hdrY + 0.1, s * (wallZ(hdrY + 0.1) - 0.1)), s > 0 ? '-z' : '+z', root,
      d.id === 'cab-door-l1' ? { partId: 'cab-emer-lights' } : { partId: 'cab-emer-lights', side: 'R' });
    exitSigns.push(sign);
    doors.push({ ...d, pivot, strap, girt, girtArmed, girtStowed, open: 0 });
  }

  // ---- overwing exits (2 per side)
  {
    const hw = 0.5, hh = 0.96, hOff = -0.12;
    const shape = new THREE.Shape();
    const r = 0.09;
    shape.moveTo(-hw / 2 + r, -hh / 2); shape.lineTo(hw / 2 - r, -hh / 2); shape.quadraticCurveTo(hw / 2, -hh / 2, hw / 2, -hh / 2 + r);
    shape.lineTo(hw / 2, hh / 2 - r); shape.quadraticCurveTo(hw / 2, hh / 2, hw / 2 - r, hh / 2);
    shape.lineTo(-hw / 2 + r, hh / 2); shape.quadraticCurveTo(-hw / 2, hh / 2, -hw / 2, hh / 2 - r);
    shape.lineTo(-hw / 2, -hh / 2 + r); shape.quadraticCurveTo(-hw / 2, -hh / 2, -hw / 2 + r, -hh / 2);
    const hole = new THREE.Path();
    const ww = WIN.w + 0.01, wh = WIN.h + 0.01, wr = WIN.r;
    const cy = -hOff;
    hole.moveTo(-ww / 2 + wr, cy - wh / 2); hole.lineTo(ww / 2 - wr, cy - wh / 2); hole.quadraticCurveTo(ww / 2, cy - wh / 2, ww / 2, cy - wh / 2 + wr);
    hole.lineTo(ww / 2, cy + wh / 2 - wr); hole.quadraticCurveTo(ww / 2, cy + wh / 2, ww / 2 - wr, cy + wh / 2);
    hole.lineTo(-ww / 2 + wr, cy + wh / 2); hole.quadraticCurveTo(-ww / 2, cy + wh / 2, -ww / 2, cy + wh / 2 - wr);
    hole.lineTo(-ww / 2, cy - wh / 2 + wr); hole.quadraticCurveTo(-ww / 2, cy - wh / 2, -ww / 2 + wr, cy - wh / 2);
    shape.holes.push(hole);
    const hg = new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2, curveSegments: 8 });
    const uv = hg.attributes.uv, pos = hg.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / hw + 0.5, pos.getY(i) / hh + 0.5);
    const hmat = partMat(plastic('#ffffff', { map: TX.hatchFace() }));
    let first = true;
    for (const s of [-1, 1]) for (const slot of HATCH_SLOTS) {
      const x = winX(slot);
      const m = bandFrame(x, s, 0.035).multiply(M(0, hOff, 0));
      add(hg, hmat, m, root, first ? { partId: 'cab-overwing-exits' } : { partId: 'cab-overwing-exits', side: 'R' });
      first = false;
      // filler between hatch lining and sidewall below the band
      // EXIT sign on the bin face above the exit
      const sign = plane(0.26, 0.095, partMat(std({ map: TX.exitSign('ow'), emissiveMap: TX.exitSign('ow'), emissive: new THREE.Color('#000') })),
        V(x, 1.72, s * 0.796), s > 0 ? '-z' : '+z', root, { partId: 'cab-emer-lights', side: 'R' });
      exitSigns.push(sign);
    }
  }

  // ceiling-hung exit locator signs over the aisle (double-sided)
  {
    const hang = (x, arrow) => {
      boxM(0.05, 0.08, 0.04, mats.grey, V(x, 2.17, 0));
      boxM(0.03, 0.12, 0.33, mats.wall, V(x, 2.09, 0));
      for (const f of ['+x', '-x']) {
        const t = TX.exitSign(`ceil-${arrow}-${f}`, f === '+x' ? -arrow : arrow);
        exitSigns.push(plane(0.31, 0.11, partMat(std({ map: t, emissiveMap: t, emissive: new THREE.Color('#000') })), V(x + (f === '+x' ? 0.016 : -0.016), 2.09, 0), f, root, { partId: 'cab-emer-lights', side: 'R' }));
      }
    };
    hang(12.95, 0); hang(-1.06, 0); hang(-11.9, 0);
  }
  // emergency ceiling lights (small lenses along the aisle)
  const emerIM = (() => {
    const list = [];
    for (let x = 12.4; x > -11.5; x -= 2.4) list.push(M(x, 2.214, 0));
    return instanced(new THREE.BoxGeometry(0.22, 0.012, 0.07), mats.emerLamp, list);
  })();
  // floor proximity path marking (both sides of the aisle)
  const pathStrips = [];
  {
    const pm = std({ color: '#d9dccf', emissive: new THREE.Color('#000'), roughness: 0.4 });
    const L = 23.4, xc = (12.2 + -11.2) / 2;
    pathStrips.push(boxM(L, 0.006, 0.022, partMat(pm), V(xc, 0.004, -0.22), root, { partId: 'cab-floor-path' }));
    pathStrips.push(boxM(L, 0.006, 0.022, partMat(pm), V(xc, 0.004, 0.22), root, { partId: 'cab-floor-path', side: 'R' }));
    // red exit identifiers at the overwing exit rows
    for (const s of [1, -1]) for (const slot of HATCH_SLOTS) {
      pathStrips.push(boxM(0.25, 0.006, 0.03, partMat(std({ color: '#c3201b', emissive: new THREE.Color('#000') })), V(winX(slot), 0.005, s * 0.22), root, { partId: 'cab-floor-path', side: 'R', red: true }));
    }
  }

  // ---- forward area: cockpit door, jumpseat, attendant panel, galleys, lavatory
  // cockpit door
  {
    const ud = { partId: 'cab-cockpit-door' };
    const dm = partMat(plastic('#c9c6be', { roughness: 0.45 }));
    boxM(0.06, 1.95, 0.78, dm, V(XF - 0.03, 0.975, 0), root, ud);
    const lens = add(new THREE.CylinderGeometry(0.012, 0.012, 0.02, 12), mats.dark, V(XF - 0.065, 1.55, 0), root, ud);
    lens.rotation.z = Math.PI / 2;
    boxM(0.05, 0.03, 0.14, mats.steel, V(XF - 0.08, 1.02, -0.28), root, ud);
    boxM(0.03, 0.2, 0.1, mats.steel, V(XF - 0.07, 1.02, -0.3), root, ud);
    // keypad beside the door
    const kp = plane(0.08, 0.11, std({ map: TX.placard('keypad', '1 2 3\n4 5 6\n7 8 9\n* 0 #', { w: 128, h: 180, bg: '#30343a', fg: '#e8e8e2' }) }), V(XF - 0.004, 1.3, 0.52), '-x', root, ud);
    kp.userData.side = 'R';
    plane(0.26, 0.07, std({ map: TX.placard('fd', 'FLIGHT DECK', { w: 256, h: 64, bg: '#2a2e33', fg: '#e8e8e2' }) }), V(XF - 0.065, 1.78, 0), '-x');
    // door frame trim
    for (const dz of [-0.42, 0.42]) boxM(0.04, 2.0, 0.04, mats.grey, V(XF - 0.02, 1.0, dz));
    boxM(0.04, 0.04, 0.88, mats.grey, V(XF - 0.02, 2.0, 0));
  }

  // flight attendant jumpseat (folded) — local frame faces +x, centred on z
  const jumpseat = (pos, yaw, ud) => {
    const g = new THREE.Group();
    g.position.copy(pos); g.rotation.y = yaw;
    root.add(g);
    const seatMat = std({ ...TX.fabric('jump', '#3a4150', '#434b5c', 13), roughness: 0.95 });
    add(new THREE.BoxGeometry(0.035, 0.6, 0.86), plastic('#d9d8d2'), V(0.018, 1.02, 0), g); // mounting panel
    add(new THREE.BoxGeometry(0.07, 0.4, 0.78), seatMat, V(0.06, 0.66, 0), g, ud); // seat pan folded up
    add(new THREE.BoxGeometry(0.05, 0.42, 0.78), seatMat, V(0.025, 1.18, 0), g, ud); // back pad
    add(new THREE.BoxGeometry(0.05, 0.16, 0.6), seatMat, V(0.025, 1.52, 0), g, ud); // headrest
    for (const dz of [-0.2, 0.2]) {
      add(new THREE.BoxGeometry(0.012, 0.6, 0.045), mats.dark, V(0.06, 1.15, dz), g); // harness straps
      add(new THREE.BoxGeometry(0.02, 0.05, 0.06), mats.steel, V(0.075, 0.9, dz), g);
    }
    add(new THREE.BoxGeometry(0.03, 0.03, 0.82), mats.frame, V(0.04, 0.46, 0), g);
    return g;
  };
  // flashlight in a bracket (local +x faces cabin)
  const flashlight = (pos, yaw, ud) => {
    const g = new THREE.Group(); g.position.copy(pos); g.rotation.y = yaw; root.add(g);
    add(new THREE.BoxGeometry(0.05, 0.22, 0.08), mats.dark, V(0.025, 0, 0), g);
    const body = add(new THREE.CylinderGeometry(0.02, 0.026, 0.2, 14), partMat(std({ color: '#2d2f33', roughness: 0.4 })), V(0.07, 0, 0), g, ud);
    body.material.emissive = new THREE.Color('#000');
    add(new THREE.SphereGeometry(0.006, 8, 6), std({ color: '#ff3b2f', emissive: new THREE.Color('#ff2010'), emissiveIntensity: 2 }), V(0.095, 0.08, 0), g);
    return g;
  };
  // halon / water extinguisher in a bracket
  const extinguisher = (pos, yaw, kind, ud) => {
    const g = new THREE.Group(); g.position.copy(pos); g.rotation.y = yaw; root.add(g);
    const body = std({ color: kind === 'water' ? '#b9bec3' : '#c3201b', roughness: 0.35, metalness: kind === 'water' ? 0.7 : 0.2 });
    add(new THREE.CylinderGeometry(0.055, 0.055, 0.34, 20), partMat(body), V(0.07, 0, 0), g, ud);
    add(new THREE.SphereGeometry(0.055, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), body, V(0.07, 0.17, 0), g);
    add(new THREE.BoxGeometry(0.04, 0.06, 0.03), mats.dark, V(0.07, 0.24, 0), g);
    add(new THREE.BoxGeometry(0.11, 0.015, 0.025), mats.dark, V(0.09, 0.275, 0), g);
    const lbl = plane(0.075, 0.12, std({ map: TX.placard(`ext-${kind}`, kind === 'water' ? 'H₂O\nWATER' : 'HALON', { w: 128, h: 200, bg: '#f4f2ea', fg: '#1b1d20' }) }), V(0.127, -0.02, 0), '+x', g, ud);
    lbl.userData.side = ud.side;
    for (const y of [-0.1, 0.1]) add(new THREE.BoxGeometry(0.02, 0.025, 0.13), mats.frame, V(0.03, y, 0), g);
    return g;
  };
  // PBE (smoke hood) in a sealed, placarded container
  const pbe = (pos, yaw, ud) => {
    const g = new THREE.Group(); g.position.copy(pos); g.rotation.y = yaw; root.add(g);
    const m = partMat(std({ map: TX.placard('pbe', 'PBE\nSMOKE HOOD', { w: 200, h: 240, bg: '#e9c43a', fg: '#1b1d20' }), roughness: 0.6 }));
    add(new THREE.BoxGeometry(0.12, 0.26, 0.22), m, V(0.06, 0, 0), g, ud);
    return g;
  };
  const o2Bottle = (pos, yaw, ud) => {
    const g = new THREE.Group(); g.position.copy(pos); g.rotation.y = yaw; root.add(g);
    const body = partMat(std({ color: '#2f8f4e', roughness: 0.4, metalness: 0.3 }));
    add(new THREE.CylinderGeometry(0.06, 0.06, 0.42, 20), body, V(0.08, 0, 0), g, ud);
    add(new THREE.SphereGeometry(0.06, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), body, V(0.08, 0.21, 0), g, ud);
    add(new THREE.CylinderGeometry(0.02, 0.025, 0.06, 12), mats.steel, V(0.08, 0.28, 0), g);
    add(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 12), mats.dark, V(0.08, 0.31, 0), g);
    add(new THREE.TorusGeometry(0.03, 0.005, 6, 16), mats.yellow, V(0.12, 0.27, 0.02), g); // mask hose loop
    for (const y of [-0.12, 0.1]) add(new THREE.BoxGeometry(0.02, 0.03, 0.15), mats.dark, V(0.02, y, 0), g);
    const lbl = plane(0.08, 0.06, std({ map: TX.placard('o2', 'O₂', { w: 128, h: 96, bg: '#f4f2ea', fg: '#2f8f4e' }) }), V(0.141, 0.02, 0), '+x', g, ud);
    return g;
  };
  const megaphone = (pos, yaw, ud) => {
    const g = new THREE.Group(); g.position.copy(pos); g.rotation.y = yaw; root.add(g);
    const m = partMat(std({ color: '#e6e4dc', roughness: 0.5 }));
    const horn = add(new THREE.CylinderGeometry(0.1, 0.04, 0.26, 20, 1, true), m, V(0.12, 0, 0), g, ud);
    horn.rotation.z = Math.PI / 2; horn.material.side = THREE.DoubleSide;
    const grip = add(new THREE.BoxGeometry(0.035, 0.12, 0.035), mats.dark, V(0.05, -0.08, 0), g, ud);
    grip.userData.side = 'R';
    add(new THREE.BoxGeometry(0.02, 0.2, 0.2), mats.dark, V(0.0, 0, 0), g);
    return g;
  };

  // Forward bulkhead (left of the cockpit door): jumpseat, attendant panel, flashlight
  jumpseat(V(XF - 0.04, 0, -1.0), Math.PI, { partId: 'cab-jumpseat' });
  plane(0.42, 0.26, std({ map: TX.attendantPanel('fwd'), roughness: 0.5 }), V(XF - 0.012, 1.72, -1.0), '-x', root, { partId: 'cab-attendant-panel' });
  flashlight(V(XF, 0.24, -1.0), Math.PI, { partId: 'cab-flashlight' }); // under the folded jumpseat

  // galley helpers
  const galley = (x0, x1, z0, z1, faceX, faceDir, cols, key, ud) => {
    const h = 2.0;
    const body = boxM(Math.abs(x1 - x0), h, Math.abs(z1 - z0), plastic('#d6d7d2'), V((x0 + x1) / 2, h / 2, (z0 + z1) / 2), root, { partId: ud.partId, side: 'R' });
    const w = Math.abs(z1 - z0);
    const face = plane(w, h, partMat(std({ map: TX.galleyFace(key, cols), roughness: 0.5 })), V(faceX + faceDir * 0.002, h / 2, (z0 + z1) / 2), faceDir > 0 ? '+x' : '-x', root, ud);
    boxM(0.08, 0.035, w, mats.steel, V(faceX + faceDir * 0.04, 1.0, (z0 + z1) / 2)); // worktop
    noShadow(boxM(0.02, 0.012, w - 0.06, mats.glow, V(faceX + faceDir * 0.05, 1.47, (z0 + z1) / 2))); // work light
    return { body, face };
  };
  const G_COLS = [
    [['box', 0, 0.12], ['oven', 0.12, 0.3, 'OVEN'], ['oven', 0.3, 0.48, 'OVEN'], ['counter', 0.48, 0.52], ['cart', 0.54, 0.99]],
    [['box', 0, 0.12], ['coffee', 0.12, 0.3, 'BEV MAKER'], ['box', 0.3, 0.48], ['counter', 0.48, 0.52], ['cart', 0.54, 0.99]],
    [['cb', 0, 0.12, 'GALLEY CB'], ['box', 0.12, 0.3], ['box', 0.3, 0.48], ['counter', 0.48, 0.52], ['box', 0.54, 0.76], ['box', 0.77, 0.99]],
  ];
  galley(12.55, 13.5, 0.55, 1.6, 13.5, 1, G_COLS, 'fwd', { partId: 'cab-galley-fwd' });
  // forward stowage unit (G1) against the cockpit bulkhead, right side, faces aft
  galley(14.5, XF, 0.55, 1.6, 14.5, -1, [[['box', 0, 0.2], ['box', 0.2, 0.45], ['counter', 0.48, 0.52], ['box', 0.54, 0.99]], [['box', 0, 0.2], ['box', 0.2, 0.45], ['counter', 0.48, 0.52], ['box', 0.54, 0.99]]], 'g1',
    { partId: 'cab-galley-fwd', side: 'R' });
  extinguisher(V(14.5, 0.75, 1.32), Math.PI, 'halon', { partId: 'cab-halon' });
  pbe(V(14.5, 0.75, 0.95), Math.PI, { partId: 'cab-pbe' });
  megaphone(V(14.5, 1.3, 1.2), Math.PI, { partId: 'cab-megaphone' });

  // lavatory: enclosure with door; the forward one is shown open with its fittings
  const lavs = [];
  const lavWallMats = [];
  const lavatory = (x0, x1, s, doorWall, open, ud) => {
    const zIn = s * 0.6, zOut = s * 1.68, h = 2.0;
    const wallM = plastic('#e9e8e3');
    lavWallMats.push(wallM);
    const xm = (x0 + x1) / 2, L = x1 - x0;
    boxM(L, h, 0.03, wallM, V(xm, h / 2, zIn)); // inboard wall
    boxM(L, 0.03, Math.abs(zOut - zIn), wallM, V(xm, h, (zIn + zOut) / 2)); // roof
    const faceX = doorWall === 'fwd' ? x1 : doorWall === 'aft' ? x0 : null;
    const doorW = 0.58, doorH = 1.86;
    if (faceX !== null) {
      // end wall with door opening
      const otherX = doorWall === 'fwd' ? x0 : x1;
      boxM(0.03, h, Math.abs(zOut - zIn), wallM, V(otherX, h / 2, (zIn + zOut) / 2));
      const dzc = s * 1.04;
      const segA = Math.abs(dzc - zIn) - doorW / 2, segB = Math.abs(zOut - dzc) - doorW / 2;
      boxM(0.03, h, segA, wallM, V(faceX, h / 2, zIn + s * segA / 2));
      boxM(0.03, h, segB, wallM, V(faceX, h / 2, zOut - s * segB / 2));
      boxM(0.03, h - doorH, doorW, wallM, V(faceX, doorH + (h - doorH) / 2, dzc));
      const dir = doorWall === 'fwd' ? 1 : -1;
      const door = new THREE.Group();
      door.position.set(faceX + dir * 0.02, 0, dzc - s * doorW / 2);
      root.add(door);
      const dm = partMat(plastic('#e2e1db'));
      const panel = add(new THREE.BoxGeometry(0.03, doorH, doorW), dm, V(0, doorH / 2, s * doorW / 2), door, ud);
      plane(0.2, 0.07, std({ map: TX.placard('lav', 'LAVATORY', { w: 256, h: 80, bg: '#2a2e33', fg: '#e8e8e2' }) }), V(dir * 0.017, 1.55, s * doorW / 2), dir > 0 ? '+x' : '-x', door);
      plane(0.08, 0.05, std({ map: TX.placard('vac', 'VACANT', { w: 128, h: 64, bg: '#2bd46a', fg: '#0d2416' }) }), V(dir * 0.017, 1.1, s * (doorW - 0.08)), dir > 0 ? '+x' : '-x', door);
      boxM(0.05, 0.08, 0.1, mats.steel, V(dir * 0.04, 1.25, s * doorW * 0.5), door); // ashtray (required on lav doors)
      // bi-fold door: shown folded open against its hinge post
      if (open) { door.scale.z = 0.5; door.rotation.y = s * dir * 1.45; }
      lavs.push({ door, panel });
    } else {
      // door on the inboard wall (aft lavs)
      boxM(0.03, h, Math.abs(zOut - zIn), wallM, V(x0, h / 2, (zIn + zOut) / 2));
      boxM(0.03, h, Math.abs(zOut - zIn), wallM, V(x1, h / 2, (zIn + zOut) / 2));
      const dm = partMat(plastic('#e2e1db'));
      add(new THREE.BoxGeometry(doorW, doorH, 0.03), dm, V(xm, doorH / 2, zIn - s * 0.02), root, ud);
      plane(0.2, 0.07, std({ map: TX.placard('lav', 'LAVATORY', { w: 256, h: 80, bg: '#2a2e33', fg: '#e8e8e2' }) }), V(xm, 1.55, zIn - s * 0.037), s > 0 ? '-z' : '+z');
      plane(0.08, 0.05, std({ map: TX.placard('vac', 'VACANT', { w: 128, h: 64, bg: '#2bd46a', fg: '#0d2416' }) }), V(xm + 0.2, 1.1, zIn - s * 0.037), s > 0 ? '-z' : '+z');
    }
  };
  lavatory(12.55, 13.5, -1, 'fwd', true, { partId: 'cab-lavatory' });
  // forward lavatory interior
  {
    const s = -1;
    const van = plastic('#dcdad3'); // vanity: open-fronted lower cabinet (cutaway so the waste-bin bottle is visible)
    boxM(0.7, 0.85, 0.02, van, V(12.95, 0.425, s * 0.63));
    for (const dx of [-0.34, 0.34]) boxM(0.02, 0.85, 0.26, van, V(12.95 + dx, 0.425, s * 0.75));
    boxM(0.72, 0.03, 0.3, mats.steel, V(12.95, 0.86, s * 0.76));
    add(new THREE.CylinderGeometry(0.11, 0.08, 0.06, 20), mats.steel, V(13.05, 0.84, s * 0.76));
    boxM(0.6, 0.5, 0.01, mats.mirror, V(12.95, 1.35, s * 0.62));
    plane(0.16, 0.08, std({ map: TX.placard('flap', 'PUSH', { w: 128, h: 64, bg: '#b9bec3', fg: '#1b1d20' }) }), V(12.7, 0.8, s * 0.885), '-z');
    // waste bin with automatic extinguisher (cutaway view)
    boxM(0.36, 0.5, 0.2, std({ color: '#8d9298', metalness: 0.6, roughness: 0.4 }), V(12.75, 0.32, s * 0.72));
    const bottle = add(new THREE.CylinderGeometry(0.035, 0.035, 0.22, 16), partMat(std({ color: '#c3201b', roughness: 0.35 })), V(12.75, 0.66, s * 0.7), root, { partId: 'cab-lav-bin-ext' });
    bottle.rotation.z = Math.PI / 2;
    for (const dx of [-0.06, 0.06]) add(new THREE.CylinderGeometry(0.006, 0.006, 0.08, 8), mats.steel, V(12.75 + dx, 0.6, s * 0.7), root, { partId: 'cab-lav-bin-ext' });
    // toilet
    boxM(0.42, 0.42, 0.4, plastic('#e8e7e2'), V(12.8, 0.21, s * 1.32));
    add(new THREE.CylinderGeometry(0.19, 0.17, 0.04, 24), plastic('#f2f1ec'), V(12.86, 0.44, s * 1.3));
    // smoke detector and lav oxygen box in the ceiling
    const det = add(new THREE.CylinderGeometry(0.06, 0.065, 0.03, 20), partMat(plastic('#f2f1ec')), V(13.05, 1.97, s * 1.1), root, { partId: 'cab-lav-smoke' });
    add(new THREE.SphereGeometry(0.008, 8, 6), std({ color: '#2bd46a', emissive: new THREE.Color('#2bd46a'), emissiveIntensity: 1.5 }), V(13.05, 1.952, s * 1.07));
    boxM(0.24, 0.02, 0.14, plastic('#e7e6e0'), V(12.8, 1.975, s * 1.3));
    noShadow(boxM(0.5, 0.01, 0.2, mats.glow, V(12.95, 1.98, s * 0.8)));
  }
  // forward lav interior light
  const lavLight = new THREE.PointLight(0xfff2de, 0.8, 2.2, 2);
  lavLight.position.set(13.0, 1.85, -1.1);
  root.add(lavLight);

  // ---- aft area: lavatories, aft galley, jumpseat, equipment, ELT
  lavatory(-12.55, -11.55, -1, 'inboard', false, { partId: 'cab-lavatory', side: 'R' });
  lavatory(-12.55, -11.55, 1, 'inboard', false, { partId: 'cab-lavatory', side: 'R' });
  galley(XA, -14.3, -1.3, 1.3, -14.3, 1, [
    [['box', 0, 0.12], ['oven', 0.12, 0.3, 'OVEN'], ['box', 0.3, 0.48], ['counter', 0.48, 0.52], ['cart', 0.54, 0.99]],
    [['box', 0, 0.12], ['oven', 0.12, 0.3, 'OVEN'], ['box', 0.3, 0.48], ['counter', 0.48, 0.52], ['cart', 0.54, 0.99]],
    [['cb', 0, 0.12, 'GALLEY CB'], ['coffee', 0.12, 0.3, 'BEV MAKER'], ['coffee', 0.3, 0.48, 'BEV MAKER'], ['counter', 0.48, 0.52], ['box', 0.54, 0.99]],
    [['box', 0, 0.12], ['box', 0.12, 0.3], ['box', 0.3, 0.48], ['counter', 0.48, 0.52], ['cart', 0.54, 0.99]],
    [['box', 0, 0.12], ['oven', 0.12, 0.3, 'OVEN'], ['box', 0.3, 0.48], ['counter', 0.48, 0.52], ['cart', 0.54, 0.99]],
  ], 'aft', { partId: 'cab-galley-aft' });
  // aft jumpseat + aft attendant panel on the aft wall of the left lavatory (facing the L2 door area)
  jumpseat(V(-12.57, 0, -1.08), Math.PI, { partId: 'cab-jumpseat', side: 'R' });
  plane(0.42, 0.26, std({ map: TX.attendantPanel('aft', true), roughness: 0.5 }), V(-12.573, 1.74, -1.08), '-x', root, { partId: 'cab-attendant-panel', side: 'R' });
  flashlight(V(-12.57, 0.3, -0.7), Math.PI, { partId: 'cab-flashlight', side: 'R' });
  // equipment on the aft wall of the right lavatory
  extinguisher(V(-12.57, 0.75, 1.42), Math.PI, 'water', { partId: 'cab-water-ext' });
  extinguisher(V(-12.57, 0.75, 1.15), Math.PI, 'halon', { partId: 'cab-halon', side: 'R' });
  pbe(V(-12.57, 1.25, 1.3), Math.PI, { partId: 'cab-pbe', side: 'R' });
  o2Bottle(V(-12.57, 0.8, 0.82), Math.PI, { partId: 'cab-portable-o2' });
  // ELT access panel in the aft cabin ceiling
  plane(0.34, 0.2, partMat(std({ map: TX.placard('elt', 'ELT\nACCESS', { w: 256, h: 150, bg: '#e7e6e0', fg: '#1b1d20', border: '#d0141a' }) })), V(-13.4, 2.214, 0.45), '-y', root, { partId: 'cab-elt' });
  // equipment placards on overhead bins (first aid kit / medical kit stowage)
  {
    const pl = (i, s, key, text, ud) => {
      const x = BIN_A - (i + 0.5) * binStep;
      plane(0.2, 0.07, partMat(std({ map: TX.placard(key, text, { w: 256, h: 90, bg: '#f4f2ea', fg: '#d0141a', border: '#d0141a' }) })), V(x, 1.74, s * 0.797), s > 0 ? '-z' : '+z', root, ud);
    };
    pl(0, -1, 'fak', 'FIRST AID KIT', { partId: 'cab-first-aid' });
    pl(1, -1, 'emk', 'MEDICAL KIT', { partId: 'cab-first-aid', side: 'R' });
    pl(BIN_N - 1, 1, 'fak', 'FIRST AID KIT', { partId: 'cab-first-aid', side: 'R' });
    pl(BIN_N - 2, 1, 'o2b', 'PORTABLE O₂', { partId: 'cab-portable-o2', side: 'R' });
    pl(BIN_N - 1, -1, 'mega', 'MEGAPHONE', { partId: 'cab-megaphone', side: 'R' });
  }

  // ---- cabin lighting
  const cabinLights = [];
  for (const x of [13.6, 10.2, 6.4, 2.6, -1.2, -5.0, -8.8, -12.8]) {
    const l = new THREE.PointLight(0xffe4c4, 2.2, 6.5, 2);
    l.position.set(x, 1.8, 0);
    root.add(l);
    cabinLights.push(l);
  }
  const fill = new THREE.HemisphereLight(0xfff3e2, 0x5a524a, 0.55);
  root.add(fill);

  // representative pickable for general cabin lighting: the cove strip above the first bins
  {
    const L = 2.2;
    const cove = boxM(L, 0.01, 0.035, partMat(mats.strip), V(BIN_A - L / 2 - 1.2, 2.063, -0.93), root, { partId: 'cab-cabin-lighting' });
    cove.material.emissiveIntensity = 1;
    var coveRep = cove; // eslint-disable-line no-var
  }

  // ---- merge static, non-clickable meshes that share a material (fewer draw calls)
  const mergeIn = (parent) => {
    const groups = new Map();
    for (const o of [...parent.children]) {
      if (o.isGroup) { mergeIn(o); continue; }
      if (!o.isMesh || o.isInstancedMesh || o.userData.partId || o.userData.keep || Array.isArray(o.material) || !o.matrixAutoUpdate) continue;
      const key = o.material.uuid + (o.userData.noShadow ? ':n' : '');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(o);
    }
    groups.forEach((list) => {
      if (list.length < 2) return;
      list.forEach((o) => o.updateMatrix());
      const merged = new THREE.Mesh(merge(list.map((o) => [o.geometry, o.matrix])), list[0].material);
      merged.userData.noShadow = list[0].userData.noShadow;
      list.forEach((o) => { parent.remove(o); o.geometry.dispose(); });
      parent.add(merged);
    });
  };
  mergeIn(root);
  // structural surfaces join a study zone: clicking them is meaningful, and the viewer's hotspot
  // occlusion test (which only considers clickable meshes) then hides markers behind walls
  const ceilings = [];
  for (const o of root.children) {
    if (!o.isMesh || o.userData.partId) continue;
    let id = null;
    if (o.material === mats.ceiling) { id = 'cab-cabin-lighting'; ceilings.push(o); }
    else if (o.material === mats.wall) id = 'cab-windows';
    else if (lavWallMats.includes(o.material)) id = 'cab-lavatory';
    if (id) Object.assign(o.userData, { partId: id, side: 'R' });
  }
  // ---- invisible hit/anchor planes, one per zone. The viewer anchors a zone's hotspot marker on the
  // vertex nearest the centre of its largest non-'R' mesh; for boxes and planes that is a corner, so a
  // click at the marker could graze a neighbour. This plane (with a true centre vertex) sits just in
  // front of the zone, facing its focus direction, and becomes the zone's only anchor/focus candidate.
  {
    root.updateMatrixWorld(true);
    const hitMat = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });
    const bb = new THREE.Box3(), tmpB = new THREE.Box3(), corner = new THREE.Vector3();
    for (const p of cabinParts) {
      const meshes = [];
      root.traverse((o) => {
        if (!o.isMesh || o.userData.partId !== p.id) return;
        if (o.isInstancedMesh) o.userData.side = 'R'; // keep instanced copies out of the focus box
        else if (o.userData.side !== 'R') meshes.push(o);
      });
      if (!meshes.length) continue;
      bb.makeEmpty();
      meshes.forEach((m) => bb.union(tmpB.setFromObject(m)));
      const dir = V(...(p.view || [0, 0.3, 1])).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), dir);
      const ax = V(1, 0, 0).applyQuaternion(q), ay = V(0, 1, 0).applyQuaternion(q);
      const c = bb.getCenter(new THREE.Vector3());
      let ex = 0, ey = 0, ez = 0;
      for (let i = 0; i < 8; i++) {
        corner.set(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z).sub(c);
        ex = Math.max(ex, Math.abs(corner.dot(ax))); ey = Math.max(ey, Math.abs(corner.dot(ay))); ez = Math.max(ez, Math.abs(corner.dot(dir)));
      }
      // capped so a long zone (e.g. the floor strip) can't shadow clicks on everything along the aisle
      const w = Math.min(1.2, Math.max(0.12, 2 * ex)), h = Math.min(2.1, Math.max(0.12, 2 * ey));
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h, 2, 2), hitMat);
      // the zone's real meshes stay clickable/highlighted but no longer compete for marker/focus anchor
      meshes.forEach((m) => { m.userData.side = 'R'; });
      plane.position.copy(c).addScaledVector(dir, Math.min(ez, 0.25) + 0.012 + (HIT_LIFT[p.id] || 0));
      plane.quaternion.copy(q);
      Object.assign(plane.userData, { partId: p.id, bulb: true, noShadow: true, hitPlane: true });
      root.add(plane);
    }
  }
  // lit signs and floor strips never cast shadows (the viewer honours userData.bulb for clickable meshes)
  [...exitSigns, ...pathStrips, coveRep].forEach((m) => { m.userData.bulb = true; m.userData.noShadow = true; });
  // ---- shadows: the shell and large items block the sun (light only enters through windows/doors)
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    o.castShadow = !o.userData.noShadow && (o.isInstancedMesh || o.geometry.boundingSphere.radius > 0.35);
    // thin shell surfaces: render both faces into the shadow map so the sun can't leak through
    if (o.castShadow && !Array.isArray(o.material)) o.material.shadowSide = THREE.DoubleSide;
    o.receiveShadow = !o.userData.noShadow;
  });

  // ---- live state
  const st = { light: 1, emer: 0, masks: 0, t: 0, envSet: false, envK: -1, armed: null };
  const mats2 = new Set();
  const glow = (m, hex, k) => {
    tmpColor.set(hex).multiplyScalar(k);
    if (m.userData.baseEmissive) m.userData.baseEmissive.copy(tmpColor);
    if (!m.userData.hl) m.material.emissive.copy(tmpColor);
  };
  const easeOutBounce = (t) => {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  };
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpV = new THREE.Vector3(), tmpS = new THREE.Vector3(), up = V(0, 1, 0), rotM = new THREE.Matrix4();

  function applyEnv(k) {
    if (Math.abs(k - st.envK) < 0.01) return;
    st.envK = k;
    mats2.forEach((m) => { m.envMapIntensity = k; });
  }

  function update(dt) {
    if (!root.parent) return; // not on screen
    st.t += dt;
    if (!st.envSet && root.parent.environment) {
      const env = root.parent.environment;
      root.traverse((o) => {
        if (!o.isMesh) return;
        const list = Array.isArray(o.material) ? o.material : [o.material];
        list.forEach((m) => { if (m.isMeshStandardMaterial && !m.envMap) { m.envMap = env; m.needsUpdate = true; mats2.add(m); } });
      });
      st.envSet = true; st.envK = -1;
    }
    const panel = systems?.panel?.() || {};
    const state = systems?.state || {};
    const elec = panel.elec;
    const ac = debug.power ?? (elec ? !!(elec.tbus1 || elec.tbus2) : true);
    const emer = debug.emer ?? !!elec?.emerLights;
    const masks = !!panel.oxygen?.masksDeployed || debug.masks;
    const doorsOpen = !!state.doors || debug.doors;
    const armed = !doorsOpen && (state.onGround === false || !!state.engines);

    // lights
    const k = 1 - Math.exp(-dt * (ac ? 3 : 9));
    st.light += ((ac ? 1 : 0) - st.light) * k;
    st.emer += ((emer ? 1 : 0) - st.emer) * (1 - Math.exp(-dt * 12));
    const L = st.light, E = st.emer;
    cabinLights.forEach((l) => {
      l.intensity = 2.2 * L + 0.8 * E * (1 - L);
      l.color.setRGB(1, 0.89 + 0.08 * (1 - L), 0.77 + 0.21 * (1 - L));
    });
    fill.intensity = 0.3 * L + 0.06;
    mats.strip.emissiveIntensity = 2.2 * L;
    ceilings.forEach((m) => { m.material.emissiveIntensity = 0.24 * L; }); // viewer gives clickable meshes their own material
    mats.glow.emissiveIntensity = 1.2 * L;
    lavLight.intensity = 0.8 * L;
    glow(coveRep, '#ffe7c4', 2.2 * L);
    applyEnv(0.07 + 0.15 * L);
    exitSigns.forEach((m) => glow(m, '#ffffff', 1.6 * E));
    mats.emerLamp.emissive.setRGB(E * 2.2, E * 2.15, E * 2.0);
    pathStrips.forEach((m) => glow(m, m.userData.red ? '#ff2a1a' : '#eafff0', 1.8 * E));

    // passenger oxygen masks
    const tgt = masks ? 1 : 0;
    if (masks || st.masks > 0) {
      st.masks = masks ? Math.min(1.6, st.masks + dt) : 0;
      const t = st.masks;
      const doorA = -1.45 * Math.min(1, t / 0.25);
      const setDoor = (p, scaleX) => {
        tmpM.copy(p.hinge).multiply(rotM.makeRotationX(doorA)).multiply(new THREE.Matrix4().makeScale(scaleX, 1, 1));
        return tmpM;
      };
      psu.doorIM.userData.entries.forEach((p, i) => psu.doorIM.setMatrixAt(i, setDoor(p, p.len * 0.86)));
      psu.doorIM.instanceMatrix.needsUpdate = true;
      psu.repDoor.matrix.copy(setDoor(psu.rep, psu.rep.len * 0.86));
      psu.maskIM.visible = psu.hoseIM.visible = t > 0.05;
      psu.masks.forEach((mk, i) => {
        const f = easeOutBounce(Math.min(1, Math.max(0, (t - 0.15 - mk.delay) / 0.9)));
        const sway = f >= 1 ? Math.sin(st.t * 1.4 + mk.phase) * 0.012 : 0;
        tmpV.lerpVectors(mk.top, mk.end, f);
        tmpV.x += sway;
        tmpM.compose(tmpV, tmpQ.identity(), tmpS.set(1, 1, 1));
        psu.maskIM.setMatrixAt(i, tmpM);
        // hose from the PSU to the mask
        const dir = tmpV.clone().sub(mk.top);
        const len = Math.max(0.001, dir.length());
        tmpQ.setFromUnitVectors(V(0, -1, 0), dir.divideScalar(len));
        tmpM.compose(mk.top, tmpQ, tmpS.set(1, len, 1));
        psu.hoseIM.setMatrixAt(i, tmpM);
      });
      psu.maskIM.instanceMatrix.needsUpdate = true;
      psu.hoseIM.instanceMatrix.needsUpdate = true;
      if (!masks) {
        psu.maskIM.visible = psu.hoseIM.visible = false;
        psu.doorIM.userData.entries.forEach((p, i) => { tmpM.copy(p.hinge).multiply(new THREE.Matrix4().makeScale(p.len * 0.86, 1, 1)); psu.doorIM.setMatrixAt(i, tmpM); });
        psu.doorIM.instanceMatrix.needsUpdate = true;
        psu.repDoor.matrix.copy(psu.rep.hinge).multiply(new THREE.Matrix4().makeScale(psu.rep.len * 0.86, 1, 1));
      }
    }
    void tgt;

    // doors & girt bars
    doors.forEach((d) => {
      d.open += ((doorsOpen ? 1 : 0) - d.open) * (1 - Math.exp(-dt * 2.2));
      if (Math.abs(d.open - (doorsOpen ? 1 : 0)) < 0.001) d.open = doorsOpen ? 1 : 0;
      d.pivot.rotation.y = d.s * d.open * THREE.MathUtils.degToRad(165);
    });
    if (st.armed !== armed) {
      st.armed = armed;
      doors.forEach((d) => {
        d.girt.position.copy(armed ? d.girtArmed : d.girtStowed);
        d.strap.visible = armed;
      });
    }
  }

  return { root, update };
}

// Camera presets, limits and focus behaviour for the cabin scene.
export const cabinCamera = {
  home: { position: [-7.5, 1.68, 0.05], target: [0.5, 1.25, 0] },
  views: {
    'Cabin overview': { position: [-7.5, 1.68, 0.05], target: [0.5, 1.25, 0] },
    'Forward entry (L1)': { position: [14.0, 1.6, 0.95], target: [14.0, 1.0, -1.6] },
    'Forward galley': { position: [14.4, 1.62, 0.15], target: [13.1, 1.05, 1.15] },
    'Forward lavatory': { position: [14.25, 1.55, -1.08], target: [12.9, 0.9, -1.1] },
    'Business cabin': { position: [6.9, 1.6, 0.0], target: [11.2, 0.95, 0.7] },
    'Overwing exits': { position: [-1.0, 1.45, 0.45], target: [-1.06, 0.95, -1.6] },
    'Aft galley & doors': { position: [-9.7, 1.66, 0.0], target: [-14.3, 1.0, 0.0] },
  },
  env: { ground: false, fog: false },
  limits: { minDistance: 0.15, maxDistance: 9, near: 0.03, fov: 64 },
  bounds: { min: [-14.85, 0.3, -1.5], max: [14.85, 2.1, 1.5] },
  focus: { scale: 1.4, add: 0.35, min: 0.55, max: 2.4 },
};
