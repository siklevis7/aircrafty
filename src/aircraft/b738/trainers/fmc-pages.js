// FMC preflight trainer: navigation database (fictional example), data model and CDU pages.
// Page layout follows the general NG CDU convention: title line, six label/data line pairs
// served by line select keys L1-L6 / R1-R6, and a scratchpad. Values are example data only.

// ------------------------------------------------------------------ example database
export const DB = {
  airports: {
    ESSA: { name: 'STOCKHOLM ARLANDA', lat: 59.6519, lon: 17.9186, elev: 137, rwys: ['01L', '01R', '08', '19L', '19R', '26'] },
    EKCH: { name: 'COPENHAGEN KASTRUP', lat: 55.6179, lon: 12.6560, elev: 17, rwys: ['04L', '04R', '12', '22L', '22R', '30'] },
  },
  // fictional fixes (not real airspace)
  fixes: {
    NOSLI: { lat: 59.0833, lon: 17.3333 },
    VAXIN: { lat: 58.4000, lon: 16.2500 },
    TEBRA: { lat: 57.6667, lon: 15.1667 },
    ELMIN: { lat: 56.3333, lon: 13.5000 },
    GOVAR: { lat: 59.9000, lon: 15.9000 },
  },
  airways: { T317: ['NOSLI', 'VAXIN', 'TEBRA'], Z80: ['GOVAR', 'NOSLI'] },
  sids: {
    ESSA: [
      { id: 'NOSLI1C', rwys: ['19L', '19R'], legs: ['D195K', 'NOSLI'] },
      { id: 'NOSLI1E', rwys: ['26'], legs: ['D260J', 'NOSLI'] },
      { id: 'GOVAR2C', rwys: ['19L', '19R'], legs: ['D195K', 'GOVAR'] },
      { id: 'GOVAR2N', rwys: ['01L', '01R'], legs: ['D015G', 'GOVAR'] },
    ],
  },
  stars: { EKCH: [{ id: 'ELMIN1A' }, { id: 'ELMIN1B' }] },
};

export const EXAMPLE = {
  flt: 'ACY123', origin: 'ESSA', dest: 'EKCH', rwy: '19R', sid: 'NOSLI1C',
  route: [['DIRECT', 'NOSLI'], ['T317', 'TEBRA'], ['DIRECT', 'ELMIN']],
  zfw: 58.4, fuel: 9.4, reserves: 2.6, ci: 30, crz: 35000, flaps: 5, cg: 25.0, derate: 'TO-1', sel: 40, oat: 12,
};

// ------------------------------------------------------------------ helpers
export const latStr = (v) => `${v >= 0 ? 'N' : 'S'}${String(Math.floor(Math.abs(v))).padStart(2, '0')}°${(Math.abs(v) % 1 * 60).toFixed(1).padStart(4, '0')}`;
export const lonStr = (v) => `${v >= 0 ? 'E' : 'W'}${String(Math.floor(Math.abs(v))).padStart(3, '0')}°${(Math.abs(v) % 1 * 60).toFixed(1).padStart(4, '0')}`;
export const posStr = (p) => `${latStr(p.lat)} ${lonStr(p.lon)}`;
export const posSp = (p) => posStr(p).replace(/°/g, '').replace(' ', '');
export function parsePos(sp) {
  const m = /^([NS])(\d{2})(\d{2}(?:\.\d)?)([EW])(\d{3})(\d{2}(?:\.\d)?)$/.exec(sp);
  if (!m) return null;
  const lat = (+m[2] + +m[3] / 60) * (m[1] === 'S' ? -1 : 1);
  const lon = (+m[5] + +m[6] / 60) * (m[4] === 'W' ? -1 : 1);
  if (+m[3] >= 60 || +m[6] >= 60 || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
// screen text helpers: large white, small, colours, boxes, dashes
export const W = (t) => `<span class="tr-fmc-l">${esc(t)}</span>`;
export const S = (t) => `<span class="tr-fmc-s">${esc(t)}</span>`;
export const G = (t, small) => `<span class="tr-fmc-${small ? 's' : 'l'} tr-fmc-g">${esc(t)}</span>`;
export const M = (t) => `<span class="tr-fmc-l tr-fmc-m">${esc(t)}</span>`;
export const C = (t, small) => `<span class="tr-fmc-${small ? 's' : 'l'} tr-fmc-c">${esc(t)}</span>`;
export const BX = (n) => `<span class="tr-fmc-l tr-fmc-box">${'□'.repeat(n)}</span>`;
export const DS = (n) => `<span class="tr-fmc-l">${'-'.repeat(n)}</span>`;
export const R = (html) => `<span class="tr-fmc-rev">${html}</span>`;

export const blankRows = () => Array.from({ length: 6 }, () => ({ L: ['', ''], C: ['', ''], R: ['', ''] }));

// ------------------------------------------------------------------ data model
export function createData() {
  return {
    identSeen: false,
    lastPos: { lat: 59.6500, lon: 17.9230 },
    gpsPos: { lat: 59.6497, lon: 17.9215 },
    pos: { ref: null, gate: null, irs: null },
    rte: { origin: null, dest: null, flt: null, coRoute: null, rwy: null, legs: [], state: 'inactive' },
    dep: { rwy: null, sid: null },
    pending: null, // { rte, dep } copy being modified (MOD) while an active route exists
    perf: { zfw: null, fuel: EXAMPLE.fuel, reserves: null, ci: null, crz: null },
    n1: { to: 'TO', clb: 'CLB', sel: null, oat: EXAMPLE.oat },
    to: { flaps: null, cg: null, v1: null, vr: null, v2: null },
    msgs: [],
  };
}

// effective route/dep (MOD copy if pending)
export const eff = (d) => d.pending || d;
export function cloneRoute(d) { return { rte: JSON.parse(JSON.stringify(d.rte)), dep: { ...d.dep } }; }

export function gw(d) { return d.perf.zfw != null ? +(d.perf.zfw + d.perf.fuel).toFixed(1) : null; }
export function perfComplete(d) { return d.perf.zfw != null && d.perf.reserves != null && d.perf.ci != null && d.perf.crz != null; }
export function rteActive(d) { return d.rte.state === 'active'; }

const RATINGS = { TO: '26K', 'TO-1': '24K', 'TO-2': '22K' };
export function toN1(d) {
  // illustrative N1 only — not performance data
  let n = 95.4 - (d.n1.to === 'TO-1' ? 2.6 : d.n1.to === 'TO-2' ? 5.1 : 0);
  if (d.n1.sel != null && d.n1.sel > d.n1.oat) n -= (d.n1.sel - d.n1.oat) * 0.17;
  return n.toFixed(1);
}
export function clbN1(d) { return (93.2 - (d.n1.clb === 'CLB-1' ? 1.6 : d.n1.clb === 'CLB-2' ? 3.2 : 0)).toFixed(1); }
export function qrh(d) {
  const w = gw(d);
  if (w == null || d.to.flaps == null) return null;
  const f = { 1: 6, 5: 0, 10: -3, 15: -6, 25: -9 }[d.to.flaps] ?? 0;
  const derate = d.n1.to === 'TO-1' ? 1 : d.n1.to === 'TO-2' ? 2 : 0;
  const base = 118 + (w - 55) * 1.65 + f;
  const v1 = Math.round(base - 2 + derate), vr = Math.round(base + derate * 0.5), v2 = Math.round(base + 6);
  return { v1, vr, v2 };
}
export function trim(d) { return d.to.cg == null ? null : Math.max(2.5, Math.min(8.5, 8.6 - (d.to.cg - 8) * 0.14)).toFixed(2); }

export function legsList(d) {
  const e = eff(d);
  const out = [];
  if (e.dep.sid) {
    const sid = DB.sids[e.rte.origin]?.find((s) => s.id === e.dep.sid);
    sid?.legs.forEach((l) => out.push({ id: l, via: e.dep.sid }));
  }
  for (const [via, to] of e.rte.legs) {
    if (DB.airways[via]) {
      const aw = DB.airways[via];
      const prev = out[out.length - 1]?.id;
      const i0 = aw.indexOf(prev), i1 = aw.indexOf(to);
      const seg = i0 < i1 ? aw.slice(i0 + 1, i1 + 1) : aw.slice(i1, i0).reverse();
      seg.forEach((id) => out.push({ id, via }));
    } else if (!(out.length && out[out.length - 1].id === to)) out.push({ id: to, via });
  }
  if (e.rte.dest) out.push({ id: e.rte.dest, via: 'DIRECT' });
  return out;
}
