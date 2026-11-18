// CDU page definitions for the FMC preflight trainer. Each page returns
// { title, pg, rows: [6 × { L:[label,data], C:[label,data], R:[label,data], sep? }], keys: { L1: fn(api) ... } }.
// A key handler returns a message string to reject an entry, or nothing on success.
import {
  DB, EXAMPLE, W, S, G, M, BX, DS, blankRows, posStr, posSp, parsePos, eff, cloneRoute, gw, rteActive,
  toN1, clbN1, qrh, trim, legsList, perfComplete,
} from './fmc-pages.js';

const INV = 'INVALID ENTRY', NIDB = 'NOT IN DATA BASE', INVD = 'INVALID DELETE';
const RATING = { TO: '26K', 'TO-1': '24K', 'TO-2': '22K' };
const fl = (a) => (a >= 18000 ? `FL${String(Math.round(a / 100)).padStart(3, '0')}` : String(a));
const num = (sp, re = /^\d{1,3}(\.\d)?$/) => (re.test(sp) ? parseFloat(sp) : null);
const del = (sp) => sp === 'DELETE';

// returns the object to modify: the live data before activation, or a MOD copy once a route is active
function mut(d) {
  if (rteActive(d)) { if (!d.pending) d.pending = cloneRoute(d); return d.pending; }
  return d;
}
function speedsDeleted(d, api) {
  if (d.to.v1 || d.to.vr || d.to.v2) { d.to.v1 = d.to.vr = d.to.v2 = null; api.note('TAKEOFF SPEEDS DELETED'); }
}
const prompt = (t) => W(t);
const routeTitle = (d, base) => `${d.pending ? 'MOD ' : rteActive(d) ? 'ACT ' : ''}${base}`;

export const PAGES = {
  // ---------------------------------------------------------------- INIT/REF INDEX
  index(d) {
    const rows = blankRows();
    rows[0].L = ['', prompt('<IDENT')]; rows[0].R = ['', prompt('NAV DATA>')];
    rows[1].L = ['', prompt('<POS')];
    rows[2].L = ['', prompt('<PERF')];
    rows[3].L = ['', prompt('<THRUST LIM')];
    rows[4].L = ['', prompt('<TAKEOFF')];
    rows[5].L = ['', prompt('<APPROACH')]; rows[5].R = ['', prompt('MAINT>')];
    return {
      title: 'INIT/REF INDEX', pg: '1/1', rows,
      keys: {
        L1: (a) => a.go('ident'), L2: (a) => a.go('pos'), L3: (a) => a.go('perf'), L4: (a) => a.go('n1'), L5: (a) => a.go('takeoff'),
        L6: (a) => a.info('The APPROACH REF page is used before descent, not during preflight.'),
        R1: (a) => a.info('NAV DATA pages let you look up database waypoints and navaids. Not needed for this preflight.'),
        R6: (a) => a.info('Maintenance pages are not used by the flight crew in this trainer.'),
      },
    };
  },
  // ---------------------------------------------------------------- IDENT
  ident(d) {
    d.identSeen = true;
    const rows = blankRows();
    rows[0].L = ['MODEL', W('737-800W')]; rows[0].R = ['ENG RATING', W('26K')];
    rows[1].L = ['NAV DATA', W('TRN2611')]; rows[1].R = ['ACTIVE', W('20NOV17DEC/26')];
    rows[2].R = ['', S('17DEC14JAN/27')];
    rows[3].L = ['OP PROGRAM', W('EXAMPLE')];
    rows[4].L = ['DRAG/F-F', W('+0.0/+0.0')];
    rows[5].sep = true; rows[5].L = ['', prompt('<INDEX')]; rows[5].R = ['', prompt('POS INIT>')];
    return {
      title: 'IDENT', pg: '1/2', rows,
      keys: {
        L6: (a) => a.go('index'), R6: (a) => a.go('pos'),
        R2: (a) => a.info('The navigation database has two cycles: the active one and the next one. Check the active dates cover today.'),
      },
    };
  },
  // ---------------------------------------------------------------- POS INIT / POS REF
  pos(d, sub) {
    const rows = blankRows();
    if (sub === 1) {
      rows[0].L = ['FMC POS (GPS L)', W(posStr(d.gpsPos))];
      rows[1].L = ['IRS L', d.pos.irs ? W(posStr(d.pos.irs)) : DS(14)];
      rows[2].L = ['IRS R', d.pos.irs ? W(posStr(d.pos.irs)) : DS(14)];
      rows[3].L = ['GPS L', W(posStr(d.gpsPos))];
      rows[4].L = ['GPS R', W(posStr({ lat: d.gpsPos.lat + 0.0002, lon: d.gpsPos.lon - 0.0003 }))];
      rows[5].sep = true; rows[5].L = ['', prompt('<INDEX')]; rows[5].R = ['', prompt('ROUTE>')];
      return {
        title: 'POS REF', pg: '2/3', rows,
        keys: {
          L1: (a) => a.copy(posSp(d.gpsPos)), L4: (a) => a.copy(posSp(d.gpsPos)),
          L5: (a) => a.copy(posSp({ lat: d.gpsPos.lat + 0.0002, lon: d.gpsPos.lon - 0.0003 })),
          L6: (a) => a.go('index'), R6: (a) => a.go('rte'),
        },
      };
    }
    if (sub === 2) {
      rows[0].L = ['IRS L', W('NAV')]; rows[0].R = ['GS', W('0KT')];
      rows[1].L = ['IRS R', W('NAV')];
      rows[5].sep = true; rows[5].L = ['', prompt('<INDEX')]; rows[5].R = ['', prompt('ROUTE>')];
      return { title: 'POS SHIFT', pg: '3/3', rows, keys: { L6: (a) => a.go('index'), R6: (a) => a.go('rte') } };
    }
    const apt = d.pos.ref && DB.airports[d.pos.ref];
    rows[0].R = ['LAST POS', W(posStr(d.lastPos))];
    rows[1].L = ['REF AIRPORT', d.pos.ref ? W(d.pos.ref) : DS(4)];
    rows[1].R = ['', apt ? W(posStr(apt)) : ''];
    rows[2].L = ['GATE', d.pos.gate ? W(d.pos.gate) : DS(5)];
    rows[3].R = ['SET IRS POS', d.pos.irs ? W(posStr(d.pos.irs)) : `<span class="tr-fmc-l tr-fmc-box">□□°□□.□ □□□°□□.□</span>`];
    rows[4].L = ['GMT-MON/DY', W('0942z 11/18')];
    rows[5].sep = true; rows[5].L = ['', prompt('<INDEX')]; rows[5].R = ['', prompt('ROUTE>')];
    return {
      title: 'POS INIT', pg: '1/3', rows,
      keys: {
        R1: (a) => a.copy(posSp(d.lastPos)),
        L2: (a) => {
          const sp = a.sp;
          if (!sp) return;
          if (del(sp)) { d.pos.ref = null; return a.clear(); }
          if (!/^[A-Z]{4}$/.test(sp)) return INV;
          if (!DB.airports[sp]) return NIDB;
          d.pos.ref = sp; a.clear();
        },
        R2: (a) => { if (apt && !a.sp) a.copy(posSp(apt)); },
        L3: (a) => {
          const sp = a.sp;
          if (!sp) return;
          if (del(sp)) { d.pos.gate = null; return a.clear(); }
          if (!d.pos.ref) return INV;
          if (!/^[A-Z0-9]{1,5}$/.test(sp)) return INV;
          d.pos.gate = sp; a.clear();
        },
        R4: (a) => {
          const sp = a.sp;
          if (!sp) return;
          if (del(sp)) return INVD;
          const p = parsePos(sp);
          if (!p) return INV;
          d.pos.irs = p; a.clear();
        },
        L6: (a) => a.go('index'), R6: (a) => a.go('rte'),
      },
    };
  },
  // ---------------------------------------------------------------- RTE
  rte(d, sub) {
    const e = eff(d);
    const legs = e.rte.legs;
    const nLegPages = Math.max(1, Math.ceil((legs.length + 1) / 5));
    const total = 1 + nLegPages;
    const rows = blankRows();
    const r6 = () => {
      rows[5].sep = true;
      rows[5].L = ['', prompt('<RTE 2')];
      if (d.rte.state === 'inactive' || d.rte.state === 'armed') rows[5].R = ['', e.rte.origin && e.rte.dest ? prompt('ACTIVATE>') : ''];
      else rows[5].R = ['', prompt('PERF INIT>')];
    };
    const k6 = {
      L6: (a) => a.info('A second route (RTE 2) can be prepared as an alternative. Not used in this preflight.'),
      R6: (a) => {
        if (d.rte.state === 'active') return a.go('perf');
        if (!e.rte.origin || !e.rte.dest) return;
        d.rte.state = 'armed'; a.info('The EXEC light is now on. Check the route, then push EXEC to make it the active route.');
      },
    };
    if (sub === 0) {
      rows[0].L = ['ORIGIN', e.rte.origin ? W(e.rte.origin) : BX(4)];
      rows[0].R = ['DEST', e.rte.dest ? W(e.rte.dest) : BX(4)];
      rows[1].L = ['CO ROUTE', e.rte.coRoute ? W(e.rte.coRoute) : DS(10)];
      rows[1].R = ['FLT NO.', e.rte.flt ? W(e.rte.flt) : DS(8)];
      rows[2].L = ['RUNWAY', e.rte.rwy ? W(`RW${e.rte.rwy}`) : DS(5)];
      r6();
      return {
        title: routeTitle(d, 'RTE 1'), pg: `1/${total}`, rows,
        keys: {
          L1: (a) => {
            const sp = a.sp; if (!sp) return;
            if (del(sp)) return INVD;
            if (!/^[A-Z]{4}$/.test(sp)) return INV;
            if (!DB.airports[sp]) return NIDB;
            const m = mut(d);
            if (m.rte.origin !== sp) { m.rte.legs = []; m.dep = { rwy: null, sid: null }; m.rte.rwy = null; }
            m.rte.origin = sp; a.clear();
          },
          R1: (a) => {
            const sp = a.sp; if (!sp) return;
            if (del(sp)) return INVD;
            if (!/^[A-Z]{4}$/.test(sp)) return INV;
            if (!DB.airports[sp]) return NIDB;
            mut(d).rte.dest = sp; a.clear();
          },
          L2: (a) => { const sp = a.sp; if (!sp) return; if (del(sp)) return INVD; return /^[A-Z0-9]{1,10}$/.test(sp) ? NIDB : INV; },
          R2: (a) => {
            const sp = a.sp; if (!sp) return;
            if (del(sp)) { d.rte.flt = null; if (d.pending) d.pending.rte.flt = null; return a.clear(); }
            if (!/^[A-Z0-9]{1,10}$/.test(sp)) return INV;
            d.rte.flt = sp; if (d.pending) d.pending.rte.flt = sp; a.clear();
          },
          L3: (a) => {
            const sp = a.sp; if (!sp) return;
            if (del(sp)) { const m = mut(d); m.rte.rwy = null; m.dep.rwy = null; m.dep.sid = null; return a.clear(); }
            const r = sp.replace(/^RW/, '');
            if (!e.rte.origin) return INV;
            if (!DB.airports[e.rte.origin].rwys.includes(r)) return NIDB;
            const m = mut(d); m.rte.rwy = r; m.dep.rwy = r;
            if (m.dep.sid && !DB.sids[m.rte.origin]?.find((s) => s.id === m.dep.sid)?.rwys.includes(r)) setSid(m, null);
            a.clear();
          },
          ...k6,
        },
      };
    }
    // legs pages
    const base = (sub - 1) * 5;
    rows[0].L[0] = 'VIA'; rows[0].R[0] = 'TO';
    const keys = { ...k6 };
    for (let i = 0; i < 5; i++) {
      const k = base + i;
      const leg = legs[k];
      const row = rows[i];
      if (i > 0) { row.L[0] = ''; row.R[0] = ''; }
      const incomplete = legs.findIndex((l) => !l[1]);
      const nextIdx = incomplete >= 0 ? incomplete : legs.length;
      if (leg) {
        row.L[1] = W(leg[0]);
        row.R[1] = leg[1] ? W(leg[1]) : BX(5);
      } else if (k === nextIdx) {
        row.L[1] = DS(5); row.R[1] = DS(5);
      }
      if (k > nextIdx) continue;
      keys[`L${i + 1}`] = (a) => {
        const sp = a.sp; if (!sp) return;
        if (del(sp)) { if (!leg) return INVD; mut(d).rte.legs.splice(k, 1); return a.clear(); }
        if (!e.rte.origin) return INV;
        if (!/^[A-Z0-9]{2,7}$/.test(sp)) return INV;
        if (sp === 'DIRECT') return INV;
        const aw = DB.airways[sp];
        if (!aw) return DB.fixes[sp] ? INV : NIDB;
        const prevTo = k === 0 ? sidEnd(e) : legs[k - 1]?.[1];
        if (!prevTo || !aw.includes(prevTo)) return INV;
        const m = mut(d);
        m.rte.legs[k] = [sp, null];
        a.clear();
      };
      keys[`R${i + 1}`] = (a) => {
        const sp = a.sp; if (!sp) return;
        if (del(sp)) { if (!leg) return INVD; mut(d).rte.legs.splice(k, 1); return a.clear(); }
        if (!e.rte.origin) return INV;
        if (!/^[A-Z0-9]{2,5}$/.test(sp)) return INV;
        if (!DB.fixes[sp] && !DB.airports[sp]) return NIDB;
        const m = mut(d);
        if (leg && DB.airways[leg[0]]) {
          const aw = DB.airways[leg[0]];
          const prevTo = k === 0 ? sidEnd(e) : legs[k - 1]?.[1];
          if (!aw.includes(sp) || sp === prevTo) return INV;
          m.rte.legs[k] = [leg[0], sp];
        } else if (leg) m.rte.legs[k] = [leg[0], sp];
        else m.rte.legs.push(['DIRECT', sp]);
        a.clear();
      };
    }
    r6();
    return { title: routeTitle(d, 'RTE 1'), pg: `${sub + 1}/${total}`, rows, keys };
  },
  // ---------------------------------------------------------------- DEP/ARR
  deparr(d) {
    const e = eff(d);
    const rows = blankRows();
    if (e.rte.origin) { rows[0].L = ['', prompt('<DEP')]; rows[0].C = ['RTE 1', W(e.rte.origin)]; rows[0].R = ['', prompt('ARR>')]; }
    if (e.rte.dest) { rows[1].C = ['', W(e.rte.dest)]; rows[1].R = ['', prompt('ARR>')]; }
    rows[5].sep = true; rows[5].L = ['', prompt('<DEP')]; rows[5].C = ['OTHER', DS(4)]; rows[5].R = ['', prompt('ARR>')];
    return {
      title: 'DEP/ARR INDEX', pg: '1/1', rows,
      keys: {
        L1: (a) => (e.rte.origin ? a.go('dep') : undefined),
        R1: (a) => a.info('Arrivals for the origin are only used for a return to the departure airport.'),
        R2: (a) => (e.rte.dest ? a.go('arr') : undefined),
      },
    };
  },
  dep(d, sub) {
    const e = eff(d);
    const o = e.rte.origin;
    const rows = blankRows();
    const apt = DB.airports[o];
    if (!apt) return PAGES.deparr(d);
    const active = !d.pending && rteActive(d);
    const mark = active ? '<ACT>' : '<SEL>';
    const allSids = DB.sids[o] || [];
    const sids = e.dep.sid ? allSids.filter((s) => s.id === e.dep.sid) : allSids.filter((s) => !e.dep.rwy || s.rwys.includes(e.dep.rwy));
    const rwys = e.dep.rwy ? [e.dep.rwy] : (e.dep.sid ? apt.rwys.filter((r) => allSids.find((s) => s.id === e.dep.sid).rwys.includes(r)) : apt.rwys);
    const per = 5;
    const pages = Math.max(1, Math.ceil(Math.max(sids.length, rwys.length) / per));
    const p = Math.min(sub, pages - 1);
    rows[0].L[0] = 'SIDS'; rows[0].C[0] = 'RTE 1'; rows[0].R[0] = 'RUNWAYS';
    const keys = {};
    for (let i = 0; i < per; i++) {
      const s = sids[p * per + i], r = rwys[p * per + i];
      if (s) {
        rows[i].L[1] = W(s.id) + (e.dep.sid === s.id ? G(` ${mark}`) : '');
        keys[`L${i + 1}`] = (a) => { const m = mut(d); setSid(m, m.dep.sid === s.id ? null : s.id); a.clear(); };
      }
      if (r) {
        rows[i].R[1] = (e.dep.rwy === r ? G(`${mark} `) : '') + W(r);
        keys[`R${i + 1}`] = (a) => {
          const m = mut(d);
          if (m.dep.rwy === r) { m.dep.rwy = null; m.rte.rwy = null; } else { m.dep.rwy = r; m.rte.rwy = r; }
          a.clear();
        };
      }
    }
    if (e.dep.sid) { rows[Math.min(4, sids.length)].L = ['TRANS', W('NONE') + G(` ${mark}`)]; }
    rows[5].sep = true;
    rows[5].L = ['', prompt(d.pending ? '<ERASE' : '<INDEX')];
    rows[5].R = ['', prompt('ROUTE>')];
    keys.L6 = (a) => { if (d.pending) { d.pending = null; a.info('Modification erased: the active route is unchanged and the EXEC light goes out.'); } else a.go('deparr'); };
    keys.R6 = (a) => a.go('rte');
    return { title: `${o} DEPARTURES`, pg: `${p + 1}/${pages}`, rows, keys };
  },
  arr(d) {
    const e = eff(d);
    const rows = blankRows();
    rows[0].L[0] = 'STARS'; rows[0].R[0] = 'APPROACHES';
    (DB.stars[e.rte.dest] || []).forEach((s, i) => { rows[i].L[1] = W(s.id); });
    ['ILS22L', 'ILS04R', 'ILS22R'].forEach((s, i) => { rows[i].R[1] = W(s); });
    rows[5].sep = true; rows[5].L = ['', prompt('<INDEX')]; rows[5].R = ['', prompt('ROUTE>')];
    const info = (a) => a.info('The arrival and approach are normally selected in flight, once the landing runway is known. Not part of this preflight.');
    return { title: `${e.rte.dest} ARRIVALS`, pg: '1/1', rows, keys: { L1: info, L2: info, R1: info, R2: info, R3: info, L6: (a) => a.go('deparr'), R6: (a) => a.go('rte') } };
  },
  // ---------------------------------------------------------------- LEGS
  legs(d, sub) {
    const list = legsList(d);
    const rows = blankRows();
    const pages = Math.max(1, Math.ceil(list.length / 5));
    const p = Math.min(sub, pages - 1);
    const active = rteActive(d) && !d.pending;
    let prev = DB.airports[eff(d).rte.origin];
    for (let i = 0; i < p * 5; i++) prev = pt(list[i]?.id) || prev;
    for (let i = 0; i < 5; i++) {
      const L = list[p * 5 + i];
      if (!L) continue;
      const here = pt(L.id);
      let lbl = '';
      if (here && prev) { const { crs, dist } = crsDist(prev, here); lbl = `${String(crs).padStart(3, '0')}°  ${dist}NM`; }
      else if (/^D\d{3}/.test(L.id)) lbl = `${L.id.slice(1, 4)}°`;
      rows[i].L = [lbl, (active && p === 0 && i === 0) ? M(L.id) : W(L.id)];
      rows[i].R = ['', W(i === 0 && p === 0 ? '---/ -----' : '---/ -----')];
      if (here) prev = here;
    }
    if (!list.length) rows[0].C = ['', S('NO ROUTE')];
    rows[5].sep = true;
    rows[5].L = ['', prompt(d.pending ? '<ERASE' : '<RTE 2 LEGS')];
    rows[5].R = ['', prompt(rteActive(d) ? 'RTE DATA>' : 'ACTIVATE>')];
    return {
      title: `${d.pending ? 'MOD ' : active ? 'ACT ' : ''}RTE 1 LEGS`, pg: `${p + 1}/${pages}`, rows,
      keys: {
        L6: (a) => { if (d.pending) { d.pending = null; a.info('Modification erased.'); } else a.info('RTE 2 is not used in this trainer.'); },
        R6: (a) => { if (!rteActive(d) && eff(d).rte.origin && eff(d).rte.dest) { d.rte.state = 'armed'; a.info('EXEC light on: push EXEC to activate the route.'); } else a.info('RTE DATA shows ETAs and winds for each waypoint. Not needed for this preflight.'); },
      },
    };
  },
  // ---------------------------------------------------------------- PERF INIT
  perf(d) {
    const rows = blankRows();
    const w = gw(d);
    rows[0].L = ['GW/CRZ CG', `${w != null ? W(w.toFixed(1)) : W('---.-')}${W('/')}${S('--.-%')}`];
    rows[0].R = ['TRIP/CRZ ALT', `${S('----')}${W('/')}${d.perf.crz ? W(fl(d.perf.crz)) : BX(5)}`];
    rows[1].L = ['PLAN/FUEL', `${d.perf.plan ? W(d.perf.plan.toFixed(1)) : DS(4)}${W('/')}${W(d.perf.fuel.toFixed(1))}`];
    rows[2].L = ['ZFW', d.perf.zfw != null ? W(d.perf.zfw.toFixed(1)) : BX(5)];
    rows[2].R = ['CRZ WIND', W('---°/---')];
    rows[3].L = ['RESERVES', d.perf.reserves != null ? W(d.perf.reserves.toFixed(1)) : BX(4)];
    rows[3].R = ['T/C OAT', W('---°C')];
    rows[4].L = ['COST INDEX', d.perf.ci != null ? W(String(d.perf.ci)) : BX(4)];
    rows[4].R = ['TRANS ALT', W('5000')];
    rows[5].sep = true; rows[5].L = ['', prompt('<INDEX')]; rows[5].R = ['', prompt('N1 LIMIT>')];
    return {
      title: 'PERF INIT', pg: '1/2', rows,
      keys: {
        L1: (a) => (a.sp ? INV : undefined),
        L2: (a) => {
          const sp = a.sp; if (!sp) return;
          if (del(sp)) { d.perf.plan = null; return a.clear(); }
          const v = num(sp); if (v == null || v > 21) return INV;
          d.perf.plan = v; a.clear();
        },
        L3: (a) => {
          const sp = a.sp; if (!sp) return;
          if (del(sp)) return INVD;
          const v = num(sp); if (v == null || v < 35 || v > 62.7) return INV;
          if (v + d.perf.fuel > 79.0) return INV;
          if (d.perf.zfw !== v) speedsDeleted(d, a);
          d.perf.zfw = v; a.clear();
        },
        L4: (a) => {
          const sp = a.sp; if (!sp) return;
          if (del(sp)) { d.perf.reserves = null; return a.clear(); }
          const v = num(sp, /^\d{1,2}(\.\d)?$/); if (v == null || v <= 0 || v >= d.perf.fuel) return INV;
          d.perf.reserves = v; a.clear();
        },
        L5: (a) => {
          const sp = a.sp; if (!sp) return;
          if (del(sp)) return INVD;
          if (!/^\d{1,3}$/.test(sp) || +sp > 500) return INV;
          d.perf.ci = +sp; a.clear();
        },
        R1: (a) => crzEntry(d, a),
        L6: (a) => a.go('index'), R6: (a) => a.go('n1'),
      },
    };
  },
  // ---------------------------------------------------------------- N1 LIMIT
  n1(d) {
    const rows = blankRows();
    const act = rteActive(d) ? '<ACT>' : '<SEL>';
    const tm = (k) => (d.n1.to === k ? G(` ${act}`) : '');
    const cm = (k) => (d.n1.clb === k ? G(`${act} `) : '');
    rows[0].L = ['SEL/OAT', `${d.n1.sel != null ? W(`${d.n1.sel}°C`) : DS(2)}${W(`/+${d.n1.oat}°C`)}`];
    rows[0].R = [`${RATING[d.n1.to]} N1`, W(`${toN1(d)}/${toN1(d)}`)];
    rows[1].L = ['26K', W('<TO') + tm('TO')]; rows[1].R = ['', cm('CLB') + W('CLB>')];
    rows[2].L = ['24K DERATE', W('<TO-1') + tm('TO-1')]; rows[2].R = ['', cm('CLB-1') + W('CLB-1>')];
    rows[3].L = ['22K DERATE', W('<TO-2') + tm('TO-2')]; rows[3].R = ['', cm('CLB-2') + W('CLB-2>')];
    rows[4].R = ['CLB N1', W(`${clbN1(d)}/${clbN1(d)}`)];
    rows[5].sep = true; rows[5].L = ['', prompt('<INDEX')]; rows[5].R = ['', prompt('TAKEOFF>')];
    const pickTO = (k) => (a) => {
      if (a.sp) return INV;
      if (d.n1.to !== k) speedsDeleted(d, a);
      d.n1.to = k; d.n1.clb = { TO: 'CLB', 'TO-1': 'CLB-1', 'TO-2': 'CLB-2' }[k];
    };
    const pickCLB = (k) => (a) => { if (a.sp) return INV; d.n1.clb = k; };
    return {
      title: 'N1 LIMIT', pg: '1/1', rows,
      keys: {
        L1: (a) => {
          const sp = a.sp; if (!sp) return;
          if (del(sp)) { if (d.n1.sel != null) speedsDeleted(d, a); d.n1.sel = null; return a.clear(); }
          const v = /^\+?\d{1,2}(C)?$/.test(sp) ? parseInt(sp.replace('+', ''), 10) : null;
          if (v == null || v <= d.n1.oat || v > 70) return INV;
          if (d.n1.sel !== v) speedsDeleted(d, a);
          d.n1.sel = v; a.clear();
        },
        L2: pickTO('TO'), L3: pickTO('TO-1'), L4: pickTO('TO-2'),
        R2: pickCLB('CLB'), R3: pickCLB('CLB-1'), R4: pickCLB('CLB-2'),
        L6: (a) => a.go('index'), R6: (a) => a.go('takeoff'),
      },
    };
  },
  // ---------------------------------------------------------------- TAKEOFF REF
  takeoff(d, sub) {
    const rows = blankRows();
    if (sub === 1) {
      rows[0].L = ['RW WIND', W('---°/---')]; rows[0].R = ['ACCEL HT', W('1000AGL')];
      rows[1].L = ['RW SLOPE/HDG', W('--.-/---°')]; rows[1].R = ['EO ACCEL HT', W('1000AGL')];
      rows[2].L = ['RW COND', W('DRY')]; rows[2].R = ['THR REDUCTION', W('1500AGL')];
      rows[5].sep = true; rows[5].L = ['', prompt('<INDEX')];
      return { title: 'TAKEOFF REF', pg: '2/2', rows, keys: { L6: (a) => a.go('index') } };
    }
    const q = qrh(d);
    const t = trim(d);
    const spd = (k, i) => {
      const lbl = { v1: 'V1', vr: 'VR', v2: 'V2' }[k];
      rows[i].R[0] = q && !d.to[k] ? `QRH  ${lbl}` : lbl;
      rows[i].R[1] = d.to[k] ? W(`${d.to[k]}KT`) : (q ? S(`${q[k]}`) + W('>') : DS(3));
    };
    rows[0].L = ['FLAPS', d.to.flaps != null ? W(`${String(d.to.flaps).padStart(2, '0')}°`) : `${BX(2)}${W('°')}`];
    spd('v1', 0); spd('vr', 1); spd('v2', 2);
    rows[1].L = [`${RATING[d.n1.to]} N1`, W(`${toN1(d)}/${toN1(d)}`)];
    rows[2].L = ['CG', d.to.cg != null ? W(`${d.to.cg.toFixed(1)}%`) : `${BX(4)}${W('%')}`];
    rows[2].C = ['TRIM', t ? W(t) : ''];
    rows[3].L = ['RUNWAY', d.rte.rwy && !d.pending ? W(`RW${d.rte.rwy}`) : DS(5)];
    rows[3].R = ['GW / TOW', gw(d) != null ? W(`${gw(d).toFixed(1)}/${(gw(d) - 0.2).toFixed(1)}`) : W('---.-/---.-')];
    const incomplete = preflightGaps(d);
    rows[4].C = [incomplete.length ? '' : 'PRE-FLT COMPLETE', ''];
    rows[5].sep = true; rows[5].L = ['', prompt('<INDEX')];
    rows[5].R = [incomplete.length ? 'PRE-FLT' : '', prompt(incomplete.length ? `${incomplete[0].label}>` : 'POS INIT>')];
    const pickV = (k) => (a) => {
      const sp = a.sp;
      if (!sp) { if (q && !d.to[k]) d.to[k] = q[k]; return; }
      if (del(sp)) { d.to[k] = null; return a.clear(); }
      if (!/^\d{3}$/.test(sp) || +sp < 100 || +sp > 200) return INV;
      d.to[k] = +sp; a.clear();
    };
    return {
      title: 'TAKEOFF REF', pg: '1/2', rows,
      keys: {
        L1: (a) => {
          const sp = a.sp; if (!sp) return;
          if (del(sp)) { speedsDeleted(d, a); d.to.flaps = null; return a.clear(); }
          if (!/^\d{1,2}$/.test(sp) || ![1, 5, 10, 15, 25].includes(+sp)) return INV;
          if (d.to.flaps !== +sp) speedsDeleted(d, a);
          d.to.flaps = +sp; a.clear();
        },
        L3: (a) => {
          const sp = a.sp; if (!sp) return;
          if (del(sp)) { d.to.cg = null; return a.clear(); }
          const v = num(sp, /^\d{1,2}(\.\d)?$/); if (v == null || v < 8 || v > 33) return INV;
          d.to.cg = v; a.clear();
        },
        R1: pickV('v1'), R2: pickV('vr'), R3: pickV('v2'),
        L6: (a) => a.go('index'),
        R6: (a) => a.go(incomplete.length ? incomplete[0].page : 'pos'),
      },
    };
  },
  // ---------------------------------------------------------------- other function keys (minimal)
  clb(d) {
    const rows = blankRows();
    rows[0].L = ['CRZ ALT', d.perf.crz ? W(fl(d.perf.crz)) : BX(5)];
    rows[1].L = ['TGT SPD', W('290/.780')];
    rows[2].L = ['SPD REST', W('250/10000')];
    rows[5].sep = true; rows[5].L = ['', prompt('<ECON')]; rows[5].R = ['', prompt('ENG OUT>')];
    return { title: 'ECON CLB', pg: '1/1', rows, keys: { L1: (a) => crzEntry(d, a) } };
  },
  crz(d) {
    const rows = blankRows();
    rows[0].L = ['CRZ ALT', d.perf.crz ? W(fl(d.perf.crz)) : BX(5)];
    rows[1].L = ['TGT SPD', W('.780')];
    rows[5].sep = true; rows[5].L = ['', prompt('<ECON')]; rows[5].R = ['', prompt('ENG OUT>')];
    return { title: 'ECON CRZ', pg: '1/1', rows, keys: { L1: (a) => crzEntry(d, a) } };
  },
  des() {
    const rows = blankRows();
    rows[0].L = ['E/D ALT', DS(5)]; rows[1].L = ['TGT SPD', W('.770/280')]; rows[2].L = ['SPD REST', W('240/10000')];
    rows[5].sep = true; rows[5].L = ['', prompt('<ECON')]; rows[5].R = ['', prompt('FORECAST>')];
    return { title: 'ECON DES', pg: '1/1', rows, keys: {} };
  },
  hold() {
    const rows = blankRows();
    rows[0].L = ['HOLD AT', BX(5)]; rows[1].L = ['', S('PPOS')];
    rows[5].sep = true;
    return { title: 'RTE 1 LEGS HOLD', pg: '1/1', rows, keys: { L1: (a) => (a.sp ? INV : undefined) } };
  },
  prog(d) {
    const rows = blankRows();
    const list = legsList(d);
    rows[0].L[0] = 'TO'; rows[0].C[0] = 'DTG   ETA'; rows[0].R[0] = 'FUEL';
    if (list[0] && rteActive(d)) { rows[0].L[1] = M(list[0].id); rows[0].C[1] = W('  ---   ----z'); rows[0].R[1] = W('--.-'); }
    if (list[1] && rteActive(d)) { rows[1].L[1] = W(list[1].id); rows[1].R[1] = W('--.-'); }
    rows[2].L = ['DEST', W(eff(d).rte.dest || '----')];
    rows[5].sep = true; rows[5].L = ['', prompt('<POS REPORT')]; rows[5].R = ['', prompt('POS REF>')];
    return { title: `${d.rte.flt || ''} PROGRESS`.trim(), pg: '1/4', rows, keys: { R6: (a) => a.go('pos', 1) } };
  },
  fix() {
    const rows = blankRows();
    rows[0].L = ['FIX', BX(5)]; rows[0].R = ['RAD/DIS FR', ''];
    rows[5].sep = true; rows[5].L = ['', prompt('<ERASE FIX')];
    return { title: 'FIX INFO', pg: '1/2', rows, keys: { L1: (a) => { if (!a.sp) return; return DB.fixes[a.sp] || DB.airports[a.sp] ? (a.clear(), a.info('FIX INFO draws reference circles and radials on the ND. Not needed for preflight.')) : NIDB; } } };
  },
  menu() {
    const rows = blankRows();
    rows[0].L = ['', W('<FMC') + G(' <ACT>')]; rows[0].R = ['', W('SELECT>')];
    rows[1].L = ['', W('<ACARS')];
    rows[2].L = ['', W('<DFDAU')];
    return { title: 'MENU', pg: '', rows, keys: { L1: (a) => a.go('index') } };
  },
};

function crzEntry(d, a) {
  const sp = a.sp; if (!sp) return;
  if (del(sp)) return INVD;
  let v = null;
  if (/^FL\d{2,3}$/.test(sp)) v = +sp.slice(2) * 100;
  else if (/^\d{1,3}$/.test(sp)) v = +sp * 100;
  else if (/^\d{4,5}$/.test(sp)) v = +sp;
  if (v == null || v < 1000 || v > 41000) return INV;
  d.perf.crz = v; a.clear();
}

function sidEnd(e) {
  if (!e.dep.sid) return null;
  const sid = DB.sids[e.rte.origin]?.find((s) => s.id === e.dep.sid);
  return sid?.legs[sid.legs.length - 1] ?? null;
}
function setSid(m, id) {
  const old = m.dep.sid;
  m.dep.sid = id;
  const legs = m.rte.legs;
  if (old && legs[0]?.[0] === old) legs[0][0] = 'DIRECT';
  if (id) {
    const sid = DB.sids[m.rte.origin].find((s) => s.id === id);
    const end = sid.legs[sid.legs.length - 1];
    if (!m.dep.rwy) { const r = sid.rwys[0]; m.dep.rwy = r; m.rte.rwy = r; }
    if (legs[0]?.[1] === end) legs[0][0] = id;
    else legs.unshift([id, end]);
  }
}
function pt(id) { return DB.fixes[id] || DB.airports[id] || null; }
function crsDist(a, b) {
  const la = (a.lat * Math.PI) / 180;
  const dx = (b.lon - a.lon) * Math.cos(la) * 60, dy = (b.lat - a.lat) * 60;
  const crs = Math.round(((Math.atan2(dx, dy) * 180) / Math.PI + 360 + 6) % 360) || 360; // ~6°E variation (example)
  return { crs, dist: Math.round(Math.hypot(dx, dy)) };
}

// first incomplete preflight items (used by TAKEOFF REF)
export function preflightGaps(d) {
  const gaps = [];
  if (!d.pos.irs) gaps.push({ label: 'POS INIT', page: 'pos' });
  if (!rteActive(d) || d.pending) gaps.push({ label: 'ROUTE', page: 'rte' });
  if (!perfComplete(d)) gaps.push({ label: 'PERF INIT', page: 'perf' });
  if (!(d.to.flaps != null && d.to.v1 && d.to.vr && d.to.v2)) gaps.push({ label: 'TAKEOFF', page: 'takeoff' });
  return gaps;
}
export { EXAMPLE };
