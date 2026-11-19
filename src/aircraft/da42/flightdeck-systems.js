// Cockpit-level systems for the DA42 NG flight deck, plugged into createSystems() as an extension
// (same pattern as the 737 extensions): electrical masters and buses, ENGINE MASTER / START,
// ECU voter and test, power levers, fuel selectors and pumps, pitot heat, interior lights,
// parking brake, alternate static / air and cabin heat. It also produces representative Engine
// Indication System values and the G1000 CAS alert list for the displays.
//
// Values are representative of an AE300-powered DA42 NG in a typical configuration, simplified
// and sped up for study. Use the approved AFM and the Garmin pilot's guide for real limits.
import { clamp } from '../../core/geometry.js';

export const VOTER_POSITIONS = ['AUTO', 'ECU A', 'ECU B'];
export const FUEL_POSITIONS = ['ON', 'CROSSFEED', 'OFF'];
const OAT = 15; // °C, ground and the start of every warm-up

const toward = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
const side = (n) => (n === 1 ? 'L' : 'R');
const sideName = (n) => (n === 1 ? 'left' : 'right');

export function createCockpitExtension() {
  // smoothed engine readings (per engine, index 0 = L, 1 = R)
  const mk = () => ({ load: 0, rpm: 0, ff: 0, oilP: 0, oilT: OAT, cool: OAT, gbox: OAT, fuelT: OAT, amps: 0 });
  const eng = [mk(), mk()];
  const test = [0, 0]; // remaining ECU test time per engine (s)
  const startT = [0, 0]; // starter cranking time left
  let lastGround = null;
  let volts = 25.0;

  const ok = { ok: true };

  const ext = {
    id: 'cockpit',
    state: {
      'elec.master': true, // battery relay: G1000 displays and IAU 1 (study default: powered for the walk through)
      'elec.alt1': true, 'elec.alt2': true, // alternator switches
      'elec.avionics': true, // AVIONIC MASTER: audio panel, IAU 2, radios, autopilot
      'elec.essBus': false, // ESSENTIAL BUS switch (electrical failure procedure)
      'elec.emergency': false, // EMERGENCY switch: standby attitude and flood light from the emergency battery
      engMaster1: false, engMaster2: false,
      voter1: 'AUTO', voter2: 'AUTO',
      power1: 0, power2: 0,
      fuelSel1: 'ON', fuelSel2: 'ON',
      fuelPump1: false, fuelPump2: false,
      pitotHeat: false,
      'light.panel': true, 'light.flood': false,
      parkBrake: true,
      altStatic: false,
      altAir1: false, altAir2: false,
      cabinHeat: false, defrost: false,
      pedalAdjust: 0.5,
    },

    set(key, value, api) {
      const S = api.state;
      const m = /^(engMaster|start|ecuTest|fuelSel|power|voter)([12])$/.exec(key);
      if (m) {
        const [, k, ns] = m;
        const n = Number(ns);
        if (k === 'engMaster') {
          const on = !!value;
          if (on === S[key]) return ok;
          if (!on && S[`eng${n}`]) {
            const r = api.set(`eng${n}`, false); // base logic: in-flight feathering, last-engine guard
            if (!r.ok) return r;
          }
          S[key] = on;
          if (on && !S[`eng${n}`]) api.emit({ type: 'info', message: `${side(n)} ENGINE MASTER ON: the ${sideName(n)} engine's ECUs power up and run their self-check. Wait for the glow indication to go out, then start (per the AFM).` });
          return ok;
        }
        if (k === 'start') {
          if (S[`eng${n}`]) return { ok: false, message: `The ${sideName(n)} engine is already running.` };
          if (!S['elec.master']) return { ok: false, message: 'ELECTRIC MASTER is OFF: no battery power for the starter.' };
          if (!S[`engMaster${n}`]) return { ok: false, message: `Switch the ${side(n)} ENGINE MASTER ON before starting.` };
          if (S[`fuelSel${n}`] === 'OFF') return { ok: false, message: `The ${side(n)} fuel selector is OFF. Select ON before starting.` };
          if (S.canopy || S.rearDoor) api.emit({ type: 'info', message: 'Canopy or rear door open: close it and keep the propeller area clear before starting.' });
          const r = api.set(`eng${n}`, true);
          if (r.ok) startT[n - 1] = 2.5;
          return r;
        }
        if (k === 'ecuTest') {
          if (!S.onGround) return { ok: false, message: 'The ECU test is a ground check during the run-up. In flight, the ECU test button is only used as the AFM describes.' };
          if (!S[`eng${n}`]) return { ok: false, message: `Start the ${sideName(n)} engine first: the ECU test runs with the engine at idle.` };
          if (S[`power${n}`] > 0.1) return { ok: false, message: 'Set the power lever to idle before the ECU test.' };
          test[n - 1] = 4.0;
          api.emit({ type: 'info', message: `${side(n)} ECU test: hold the button. The FADEC switches from ECU A to ECU B and back while the propeller is cycled, so the ECU caution lights come on briefly and RPM changes. Check that the engine keeps running smoothly (per the AFM).` });
          return ok;
        }
        if (k === 'fuelSel') {
          if (!FUEL_POSITIONS.includes(value)) return { ok: false, message: 'Fuel selector positions are ON, CROSSFEED and OFF.' };
          const other = S[`fuelSel${3 - n}`];
          if (value === 'CROSSFEED' && other === 'CROSSFEED') return { ok: false, message: 'Never select both fuel selectors to CROSSFEED at the same time.' };
          if (value === 'CROSSFEED' && S.onGround && S[`eng${n}`]) api.emit({ type: 'info', message: 'CROSSFEED is not a takeoff setting: take off with both selectors ON.' });
          if (value === 'OFF' && S[`eng${n}`]) {
            if (!S.onGround) return { ok: false, message: 'Don\'t shut an engine down with the fuel selector: use the ENGINE MASTER. (Selecting OFF with the engine running isn\'t simulated in flight.)' };
            api.set(`eng${n}`, false);
            api.emit({ type: 'info', message: 'The engine stops once its fuel supply runs out. Normal shutdown uses the ENGINE MASTER; the fuel selector OFF is for emergencies such as a fire.' });
          }
          S[key] = value;
          return ok;
        }
        if (k === 'power') { S[key] = clamp(Number(value) || 0, 0, 1); return ok; }
        if (k === 'voter') {
          if (!VOTER_POSITIONS.includes(value)) return { ok: false, message: 'VOTER positions: AUTO, ECU A, ECU B.' };
          S[key] = value;
          if (value !== 'AUTO') api.emit({ type: 'info', message: `${side(n)} VOTER ${value}: forces that ECU to control the engine. Normal position is AUTO; manual selection is for the procedures in the AFM.` });
          return ok;
        }
      }
      if (key === 'elec.master') {
        S[key] = !!value;
        if (!value && (S.eng1 || S.eng2)) api.emit({ type: 'info', message: 'ELECTRIC MASTER OFF with an engine running: the displays and most equipment lose power. The ECUs keep the engines running from the alternators and their backup batteries; follow the AFM for electrical failures.' });
        return ok;
      }
      if (key === 'elec.essBus') {
        S[key] = !!value;
        if (value) api.emit({ type: 'info', message: 'ESSENTIAL BUS ON: the essential equipment is fed directly, and non-essential loads such as the MFD are shed in a typical installation. Used in the electrical failure procedure.' });
        return ok;
      }
      return null; // not ours: let the base controller handle it
    },

    update(dt, api) {
      const S = api.state;
      // flight phase changes from the dock / scenarios: keep the cockpit consistent
      if (lastGround !== S.onGround) {
        if (lastGround !== null) {
          if (!S.onGround) {
            for (const n of [1, 2]) {
              S[`engMaster${n}`] = true;
              if (S[`power${n}`] < 0.3) S[`power${n}`] = 0.8;
              if (S[`fuelSel${n}`] === 'OFF') S[`fuelSel${n}`] = 'ON';
            }
            S.parkBrake = false;
          } else {
            for (const n of [1, 2]) S[`power${n}`] = Math.min(S[`power${n}`], 0.05);
          }
        }
        lastGround = S.onGround;
      }
      for (const n of [1, 2]) {
        // an engine started from elsewhere (dock toggle, Try it) has its master on
        if (S[`eng${n}`] && !S[`engMaster${n}`]) S[`engMaster${n}`] = true;
        test[n - 1] = Math.max(0, test[n - 1] - dt);
        startT[n - 1] = Math.max(0, startT[n - 1] - dt);
      }

      for (const n of [1, 2]) {
        const e = eng[n - 1];
        const run = S[`eng${n}`];
        const feath = S[`feather${n}`];
        const p = S[`power${n}`];
        const t = test[n - 1];
        const crank = startT[n - 1] > 0;
        // representative steady values
        let load = run ? Math.max(3, p * 100) : 0;
        let rpm = run ? 900 + 1400 * Math.pow(p, 0.6) : feath || S.onGround ? 0 : 0;
        if (run && t > 0) rpm = 900 + 600 * Math.abs(Math.sin((4 - t) * 2.4)); // propeller cycles during the test
        if (crank) { rpm = Math.min(rpm, 900 * (1 - startT[n - 1] / 2.5) + 250); load = Math.min(load, 2); }
        const ff = run ? 0.6 + 7.4 * Math.pow(p, 1.1) : 0;
        const oilP = run ? 2.6 + 2.0 * p : 0;
        const warm = run ? 1 : 0;
        e.load = toward(e.load, load, 3, dt);
        e.rpm = toward(e.rpm, rpm, 2.2, dt);
        e.ff = toward(e.ff, ff, 2, dt);
        e.oilP = toward(e.oilP, oilP, 2.5, dt);
        // temperatures warm up (sped up) while running and cool slowly when stopped
        e.oilT = toward(e.oilT, warm ? 82 + 18 * p : OAT, warm ? 0.08 : 0.03, dt);
        e.cool = toward(e.cool, warm ? 78 + 10 * p : OAT, warm ? 0.09 : 0.03, dt);
        e.gbox = toward(e.gbox, warm ? 68 + 16 * p : OAT, warm ? 0.07 : 0.03, dt);
        e.fuelT = toward(e.fuelT, warm ? 24 + 6 * p : OAT, 0.03, dt);
        const altOn = run && S[`elec.alt${n}`] && e.rpm > 600;
        e.amps = toward(e.amps, altOn && S['elec.master'] ? 14 + (S['elec.avionics'] ? 6 : 0) + (S.pitotHeat ? 8 : 0) : 0, 2, dt);
      }
      const charging = (S.eng1 && S['elec.alt1']) || (S.eng2 && S['elec.alt2']);
      volts = toward(volts, !S['elec.master'] ? 25.2 : charging ? 28.0 : 24.6, 1.5, dt);
    },

    compute(S) {
      const master = S['elec.master'];
      const avionics = master && S['elec.avionics'];
      const pfd = master || S['elec.essBus'];
      const mfd = master && !S['elec.essBus'];
      const qty = [22.6, 22.1]; // representative main tank contents (USG)
      const engines = [1, 2].map((n) => {
        const e = eng[n - 1];
        const run = S[`eng${n}`];
        return {
          run, feather: S[`feather${n}`], master: S[`engMaster${n}`], test: test[n - 1] > 0,
          load: e.load, rpm: e.rpm, ff: e.ff, oilP: e.oilP, oilT: e.oilT, cool: e.cool, gbox: e.gbox, fuelT: e.fuelT,
          qty: qty[n - 1], volts: master ? volts - (n === 2 ? 0.1 : 0) : 0, amps: e.amps,
        };
      });
      // G1000 crew alerting (CAS): a subset of typical DA42 NG messages, warnings first
      const cas = [];
      if (pfd) {
        const anyDoor = S.canopy || S.rearDoor || S.noseBaggage;
        if (anyDoor) cas.push({ t: 'DOOR OPEN', lvl: 'warn' });
        if (!S.onGround && S.flapLever === 'LDG' && S.gearLever !== 'DN') cas.push({ t: 'CHECK GEAR', lvl: 'warn' });
        for (const n of [1, 2]) {
          const e = engines[n - 1];
          if (e.master && e.oilP < 1.0) cas.push({ t: `${side(n)} OIL PRES`, lvl: 'warn' });
        }
        for (const n of [1, 2]) {
          const e = engines[n - 1];
          if (e.test) {
            const phase = Math.floor((4 - test[n - 1]) * 1.2) % 2;
            cas.push({ t: `${side(n)} ECU ${phase ? 'B' : 'A'} FAIL`, lvl: 'caut' });
          }
          if (master && (!e.run || !S[`elec.alt${n}`])) cas.push({ t: `${side(n)} ALTN FAIL`, lvl: 'caut' });
        }
        if (master && !S.eng1 && !S.eng2) { cas.push({ t: 'L VOLTS LOW', lvl: 'caut' }); cas.push({ t: 'R VOLTS LOW', lvl: 'caut' }); }
        if (!S.pitotHeat) cas.push({ t: 'PITOT HT OFF', lvl: 'caut' });
      }
      return { master, avionics, pfd, mfd, stbyAtt: master || S['elec.emergency'], engines, cas, volts };
    },

    ann(r) {
      return { 'cas.warn': r.cas.some((c) => c.lvl === 'warn'), 'cas.caut': r.cas.some((c) => c.lvl === 'caut') };
    },
  };
  return ext;
}
