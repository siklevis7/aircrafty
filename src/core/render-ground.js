// Procedural apron: concrete slabs with expansion joints, aggregate and wear, slightly wet/rough
// variation, and stand markings (yellow lead-in line with black outline, stop bar, taxilane).
import * as THREE from 'three';

const canvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  // CPU-backed: these canvases are read back (normal maps) and drawn with many small primitives
  c.getContext('2d', { willReadFrequently: true });
  return c;
};
function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SLAB = 5; // m, typical apron slab size
const TILE_SLABS = 4; // slabs per texture tile → 20 m tile

function concreteTextures(hi, anisotropy) {
  const S = hi ? 2048 : 1024;
  const rand = rng(11);
  const ppm = S / (SLAB * TILE_SLABS);
  // colour
  const col = canvas(S, S);
  const c = col.getContext('2d');
  c.fillStyle = '#b9b7b1';
  c.fillRect(0, 0, S, S);
  // per-slab tint
  for (let i = 0; i < TILE_SLABS; i++) {
    for (let j = 0; j < TILE_SLABS; j++) {
      const k = (rand() - 0.5) * 18;
      c.fillStyle = `rgb(${185 + k},${183 + k},${177 + k * 0.9})`;
      c.fillRect(i * SLAB * ppm, j * SLAB * ppm, SLAB * ppm, SLAB * ppm);
      // soft blotches inside the slab
      for (let b = 0; b < 6; b++) {
        const x = (i + rand()) * SLAB * ppm, y = (j + rand()) * SLAB * ppm, r = (0.5 + rand() * 1.8) * ppm;
        const g = c.createRadialGradient(x, y, 0, x, y, r);
        const d = rand() < 0.5 ? '90,86,80' : '220,218,212';
        g.addColorStop(0, `rgba(${d},${0.025 + rand() * 0.035})`);
        g.addColorStop(1, `rgba(${d},0)`);
        c.fillStyle = g;
        c.fillRect(x - r, y - r, r * 2, r * 2);
      }
    }
  }
  // aggregate speckle
  {
    const img = c.getImageData(0, 0, S, S), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      // fine grain everywhere, plus sparse dark / light aggregate pebbles
      const r = rand();
      const k = r < 0.03 ? -30 - r * 1000 : r > 0.975 ? 22 + (r - 0.975) * 800 : (r - 0.5) * 14;
      d[i] += k; d[i + 1] += k; d[i + 2] += k * 0.95;
    }
    c.putImageData(img, 0, 0);
  }
  // occasional fuel/oil stains and rubber marks
  for (let i = 0; i < 7; i++) {
    const x = rand() * S, y = rand() * S, r = (0.3 + rand() * 0.9) * ppm;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(40,36,32,0.12)');
    g.addColorStop(0.7, 'rgba(40,36,32,0.05)');
    g.addColorStop(1, 'rgba(40,36,32,0)');
    c.fillStyle = g;
    c.beginPath(); c.ellipse(x, y, r, r * (0.5 + rand() * 0.5), rand() * 3, 0, Math.PI * 2); c.fill();
  }
  // hairline cracks
  c.strokeStyle = 'rgba(60,58,54,0.35)';
  c.lineWidth = 1;
  for (let i = 0; i < 10; i++) {
    let x = rand() * S, y = rand() * S;
    c.beginPath(); c.moveTo(x, y);
    for (let k = 0; k < 8; k++) { x += (rand() - 0.5) * ppm * 0.6; y += (rand() - 0.5) * ppm * 0.6; c.lineTo(x, y); }
    c.stroke();
  }
  // expansion joints (sealant), drawn on the tile edges so they repeat seamlessly
  const jw = Math.max(2, ppm * 0.025);
  c.fillStyle = 'rgba(48,46,44,0.9)';
  for (let i = 0; i <= TILE_SLABS; i++) {
    const p = i * SLAB * ppm;
    c.fillRect(p - jw / 2, 0, jw, S);
    c.fillRect(0, p - jw / 2, S, jw);
  }
  c.fillStyle = 'rgba(48,46,44,0.25)';
  for (let i = 0; i <= TILE_SLABS; i++) {
    const p = i * SLAB * ppm;
    c.fillRect(p - jw * 2, 0, jw * 4, S);
    c.fillRect(0, p - jw * 2, S, jw * 4);
  }
  // height → normal (joints recessed, slight aggregate bumps)
  const NS = hi ? 1024 : 512;
  const hc = canvas(NS, NS);
  const h = hc.getContext('2d');
  h.fillStyle = 'rgb(128,128,128)';
  h.fillRect(0, 0, NS, NS);
  {
    const img = h.getImageData(0, 0, NS, NS), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = rand();
      const k = r < 0.03 ? -35 : r > 0.97 ? 35 : (r - 0.5) * 8;
      d[i] = d[i + 1] = d[i + 2] = 128 + k;
    }
    h.putImageData(img, 0, 0);
  }
  const npm = NS / (SLAB * TILE_SLABS);
  h.fillStyle = 'rgb(40,40,40)';
  for (let i = 0; i <= TILE_SLABS; i++) {
    const p = i * SLAB * npm;
    h.fillRect(p - 1.5, 0, 3, NS);
    h.fillRect(0, p - 1.5, NS, 3);
  }
  const src = h.getImageData(0, 0, NS, NS).data;
  const nc = canvas(NS, NS);
  const nctx = nc.getContext('2d');
  const img = nctx.createImageData(NS, NS);
  const H = (x, y) => src[(((y + NS) % NS) * NS + ((x + NS) % NS)) * 4] / 255;
  for (let y = 0; y < NS; y++) {
    for (let x = 0; x < NS; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * 1.6, dy = (H(x, y + 1) - H(x, y - 1)) * 1.6;
      const l = Math.hypot(dx, dy, 1), i = (y * NS + x) * 4;
      img.data[i] = (-dx / l * 0.5 + 0.5) * 255;
      img.data[i + 1] = (-dy / l * 0.5 + 0.5) * 255;
      img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  nctx.putImageData(img, 0, 0);

  // large-scale roughness: mostly matte concrete with darker (smoother, damp-looking) patches
  const RS = 512;
  const rc = canvas(RS, RS);
  const r = rc.getContext('2d');
  r.fillStyle = 'rgb(232,232,232)';
  r.fillRect(0, 0, RS, RS);
  for (let i = 0; i < 26; i++) {
    const x = rand() * RS, y = rand() * RS, rad = 20 + rand() * 90;
    for (const [ox, oy] of [[0, 0], [RS, 0], [-RS, 0], [0, RS], [0, -RS]]) {
      const g = r.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
      g.addColorStop(0, `rgba(120,120,120,${0.25 + rand() * 0.35})`);
      g.addColorStop(1, 'rgba(120,120,120,0)');
      r.fillStyle = g;
      r.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
    }
  }

  const mk = (cv, srgb) => {
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = anisotropy;
    return t;
  };
  return { map: mk(col, true), normalMap: mk(nc, false), roughnessMap: mk(rc, false) };
}

/** Flat ribbon along a polyline of [x, z] points (y = constant). */
function ribbon(points, width, y) {
  const pos = [], idx = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
    let dx = b[0] - a[0], dz = b[1] - a[1];
    const l = Math.hypot(dx, dz) || 1;
    dx /= l; dz /= l;
    const nx = -dz * width / 2, nz = dx * width / 2;
    pos.push(p[0] + nx, y, p[1] + nz, p[0] - nx, y, p[1] - nz);
    if (i < points.length - 1) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // make sure the ribbon faces up regardless of winding
  const n = g.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  return g;
}

/**
 * Build the apron group. `opts.stop` = x of the nose-wheel stop position, `opts.radius` = extent.
 * Returns { group, setTheme(dark) }.
 */
export function createApron(renderer, { hi = true, stop = 15.2, radius = 420 } = {}) {
  const group = new THREE.Group();
  group.name = 'apron';
  const aniso = renderer.capabilities.getMaxAnisotropy();
  const tx = concreteTextures(hi, aniso);
  const tile = SLAB * TILE_SLABS;
  tx.map.repeat.set((radius * 2) / tile, (radius * 2) / tile);
  tx.normalMap.repeat.copy(tx.map.repeat);
  tx.roughnessMap.repeat.set((radius * 2) / 140, (radius * 2) / 140);
  // offset so slab joints line up with the stand centreline
  tx.map.offset.set(0.5, 0.5);
  tx.normalMap.offset.copy(tx.map.offset);
  const mat = new THREE.MeshStandardMaterial({
    color: '#ffffff', map: tx.map, normalMap: tx.normalMap, normalScale: new THREE.Vector2(0.6, 0.6),
    roughnessMap: tx.roughnessMap, roughness: 0.92, metalness: 0,
  });
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), mat);
  apron.rotation.x = -Math.PI / 2;
  apron.receiveShadow = true;
  apron.raycast = () => {};
  group.add(apron);

  // ---- markings
  const paint = (color) => new THREE.MeshStandardMaterial({
    color, roughness: 0.7, metalness: 0, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const yellow = paint('#e8b21c'), black = paint('#141414'), white = paint('#e9e9e4'), red = paint('#b8322a');
  const marks = [];
  const addLine = (pts, w, m, y, border = 0) => {
    if (border) { const b = new THREE.Mesh(ribbon(pts, w + border * 2, y - 0.0005), black); marks.push(b); }
    const l = new THREE.Mesh(ribbon(pts, w, y), m);
    marks.push(l);
  };
  // lead-in: from the taxilane at x = -48, a quarter arc onto the stand centreline (z = 0), then straight to the stop bar
  const tl = -48, R = 26;
  const leadIn = [];
  for (let i = 0; i <= 32; i++) {
    const a = (i / 32) * (Math.PI / 2);
    leadIn.push([tl + R - R * Math.cos(a), -R + R * Math.sin(a)]);
  }
  leadIn.push([stop, 0]);
  addLine(leadIn, 0.15, yellow, 0.006, 0.05);
  // taxilane centreline
  addLine([[tl, -radius * 0.9], [tl, radius * 0.9]], 0.15, yellow, 0.006, 0.05);
  // stop bar across the centreline at the nose-wheel stop position, with a short alignment bar
  addLine([[stop + 0.1, -1.6], [stop + 0.1, 1.6]], 0.3, yellow, 0.0065, 0.06);
  // stand safety / equipment-restraint line ahead of the stand (red), and wingtip clearance lines (white dashed)
  addLine([[stop + 14, -24], [stop + 14, 24]], 0.15, red, 0.006);
  for (const z of [-21, 21]) {
    for (let x = -36; x < stop + 12; x += 3) addLine([[x, z], [x + 1.8, z]], 0.12, white, 0.006);
  }
  marks.forEach((m) => { m.receiveShadow = true; m.raycast = () => {}; m.renderOrder = 1; group.add(m); });

  const base = { concrete: new THREE.Color('#ffffff'), yellow: yellow.color.clone(), white: white.color.clone(), red: red.color.clone() };
  return {
    group,
    setTheme(dark) {
      // dark theme: floodlit apron at blue hour — darker, slightly cool concrete
      mat.color.copy(base.concrete).multiply(new THREE.Color(dark ? '#4f555e' : '#cfcfcc'));
      mat.roughness = dark ? 0.8 : 0.92;
      yellow.color.copy(base.yellow).multiplyScalar(dark ? 0.75 : 1);
      white.color.copy(base.white).multiplyScalar(dark ? 0.6 : 1);
      red.color.copy(base.red).multiplyScalar(dark ? 0.75 : 1);
    },
    dispose() {
      group.traverse((o) => { o.geometry?.dispose(); });
      [mat, yellow, black, white, red].forEach((m) => m.dispose());
      Object.values(tx).forEach((t) => t.dispose());
    },
  };
}
