// Performance concepts: landing distance. Dispatch factors (certified ÷ 0.6, +15% wet) and time-of-arrival
// assessment (braking mode, reverse, speedbrake, float, runway condition) with a 15% margin. Qualitative model.
import { esc, clamp, sliderHTML, segHTML, bindSeg } from './performance-util.js';

const CAP = { dry: 1, good: 0.72, medium: 0.48, poor: 0.3 };
const DEM = { 1: 0.32, 2: 0.45, 3: 0.6, MAX: 0.82, MAN: 1.0 };
const BRK_LABEL = { 1: 'Autobrake 1', 2: 'Autobrake 2', 3: 'Autobrake 3', MAX: 'Autobrake MAX', MAN: 'Max manual' };
const SCALE = 2.3;

function landDist(st, brk) {
  const sb = st.sb === 'auto';
  const cap = CAP[st.rwy] * (sb ? 1 : 0.6);
  const dem = DEM[brk] * (sb ? 1 : 0.85);
  const rev = st.rev === 'max' ? 0.06 + 0.14 * (1 - CAP[st.rwy]) : 0.015;
  const decel = Math.min(dem, cap) + rev + 0.05;
  const air = st.float === 'long' ? 0.46 : 0.3;
  return { air, ground: 0.38 / decel, total: air + 0.38 / decel, frictionLimited: dem > cap };
}

export function mountLanding(root) {
  const st = { rwy: 'dry', brk: '2', rev: 'max', sb: 'auto', float: 'normal', lda: 150 };

  root.innerHTML = `
    <div class="tr-perf-grid">
      <section class="tr-perf-card tr-perf-vis">
        <div class="tr-perf-cardhead"><h3 class="tr-perf-h3">Landing distance: two different questions</h3></div>
        <div class="tr-perf-land">
          <div class="tr-perf-landpanel">
            <h5 class="tr-perf-h5">1 · At dispatch: can we plan to land here?</h5>
            <div class="tr-perf-lbars" data-dispatch></div>
          </div>
          <div class="tr-perf-landpanel">
            <h5 class="tr-perf-h5">2 · Before descent: what will this landing need?</h5>
            <div class="tr-perf-ctl">
              <div class="tr-perf-segrow"><b>Runway</b>${segHTML('rwy', [['dry', 'Dry'], ['good', 'Wet · good'], ['medium', 'Medium'], ['poor', 'Poor']], st.rwy)}</div>
              <div class="tr-perf-segrow"><b>Braking</b>${segHTML('brk', Object.entries(BRK_LABEL).map(([k, v]) => [k, v.replace('Autobrake ', 'AB ')]), st.brk)}</div>
              <div class="tr-perf-segrow"><b>Reverse</b>${segHTML('rev', [['max', 'Max reverse'], ['idle', 'Idle reverse']], st.rev)}</div>
              <div class="tr-perf-segrow"><b>Speedbrake</b>${segHTML('sb', [['auto', 'Deployed'], ['none', 'Not deployed']], st.sb)}</div>
              <div class="tr-perf-segrow"><b>Touchdown</b>${segHTML('float', [['normal', 'Normal'], ['long', 'Long float']], st.float)}</div>
            </div>
            <div class="tr-perf-lbars" data-arrival></div>
            <div class="tr-perf-strip" data-strip></div>
          </div>
        </div>
        <div class="tr-perf-sliders">${sliderHTML({ id: 'lda', label: 'Landing distance available', min: 80, max: 220, value: st.lda, left: 'Short runway', right: 'Long runway' })}</div>
      </section>
      <aside class="tr-perf-card tr-perf-info"><div class="tr-perf-info-body" data-info></div></aside>
    </div>`;

  const info = root.querySelector('[data-info]');
  const pct = (v) => `${clamp(v / SCALE, 0, 1) * 100}%`;

  function bar(label, sub, parts, lda) {
    const total = parts.reduce((a, p) => a + p.v, 0);
    let x = 0;
    const segs = parts.map((p) => { const h = `<b class="${p.cls}" style="left:${pct(x)};width:${pct(Math.max(0, Math.min(p.v, SCALE - x)))}" title="${esc(p.t)}"></b>`; x += p.v; return h; }).join('');
    const over = total > lda;
    return `<div class="tr-perf-lbar${over ? ' is-over' : ''}">
      <span class="lbl">${esc(label)}<small>${esc(sub)}</small></span>
      <div class="track">${segs}<em class="lda" style="left:${pct(lda)}"></em></div>
      <span class="flag">${over ? 'Exceeds LDA' : 'Within LDA'}</span></div>`;
  }

  function render() {
    const lda = st.lda / 100;
    const cert = 0.62;
    root.querySelector('[data-dispatch]').innerHTML = [
      bar('Certified distance', 'dry · max manual braking · no reverse credit', [{ v: cert, cls: 'p-ground', t: 'Demonstrated distance from 50 ft' }], lda),
      bar('Required, dry', 'certified ÷ 0.6', [{ v: cert, cls: 'p-ground', t: 'Certified' }, { v: cert / 0.6 - cert, cls: 'p-margin', t: 'Regulatory factor' }], lda),
      bar('Required, wet', 'dry required + 15%', [{ v: cert, cls: 'p-ground', t: 'Certified' }, { v: (cert / 0.6) * 1.15 - cert, cls: 'p-margin', t: 'Regulatory factors' }], lda),
    ].join('');

    const d = landDist(st, st.brk);
    root.querySelector('[data-arrival]').innerHTML = bar(`${BRK_LABEL[st.brk]}`, 'operational distance + 15% margin', [
      { v: d.air, cls: 'p-air', t: 'Air distance (threshold to touchdown)' },
      { v: d.ground, cls: 'p-ground', t: 'Ground roll' },
      { v: d.total * 0.15, cls: 'p-margin', t: '15% margin' },
    ], lda);

    // Stopping points for every braking mode on a runway strip
    const all = Object.keys(BRK_LABEL).map((k) => [k, landDist(st, k)]);
    root.querySelector('[data-strip]').innerHTML = `
      <div class="strip-rwy" style="width:${pct(lda)}"><span>RUNWAY (LDA)</span></div>
      ${all.map(([k, r]) => `<button type="button" class="strip-pt${k === st.brk ? ' is-on' : ''}${r.total > lda ? ' is-over' : ''}" data-brk="${k}" style="left:${pct(r.total)}" title="${esc(BRK_LABEL[k])}"><i></i><span>${k === 'MAN' ? 'MAN' : k === 'MAX' ? 'MAX' : 'AB' + k}</span></button>`).join('')}`;

    const notes = [];
    if (d.frictionLimited && st.brk !== 'MAN') notes.push('<p class="tr-perf-verdict is-bad"><b>Friction-limited.</b> The runway can\'t give the deceleration this setting asks for, so higher settings converge. Reverse thrust matters more on slippery surfaces.</p>');
    if (st.sb === 'none') notes.push('<p class="tr-perf-verdict is-bad"><b>Speedbrake not deployed.</b> Wings still carry lift, wheels carry less weight and braking suffers badly. Check deployment on every landing and deploy manually if needed.</p>');
    if (st.float === 'long') notes.push('<p class="tr-perf-verdict is-bad"><b>Long float.</b> Every second in the flare eats runway at landing speed. Fly the aeroplane onto the touchdown zone.</p>');
    info.innerHTML = `
      <div class="tr-perf-kicker">Landing performance</div>
      <h4 class="tr-perf-h4">Dispatch vs time of arrival</h4>
      <p class="tr-perf-lead"><b>At dispatch</b>, certified distances (dry, max manual braking, from 50 ft) are factored up. Dividing by 0.6 for turbojets and adding 15% for wet keeps a large margin for an unknown future.</p>
      <p class="tr-perf-lead"><b>Before landing</b>, crews assess the actual conditions with operational data: reported runway condition, planned braking, reverse, wind, weight and speed additives. A margin of commonly at least 15% is then added.</p>
      ${notes.join('')}
      <ul class="tr-perf-bullets">
        <li>Autobrake targets a deceleration rate; max manual braking gives the most deceleration the antiskid and runway allow.</li>
        <li>Higher autobrake settings and reverse shorten the roll most where friction is good. On poor surfaces the runway is the limit.</li>
        <li>Threshold crossing height, speed additives and the flare change the air distance, which is often underestimated.</li>
      </ul>`;
  }

  for (const k of ['rwy', 'brk', 'rev', 'sb', 'float']) bindSeg(root, k, (v) => { st[k] = v; render(); });
  root.querySelector('[data-strip]').addEventListener('click', (e) => {
    const b = e.target.closest('[data-brk]');
    if (!b) return;
    st.brk = b.dataset.brk;
    root.querySelectorAll('[data-seg="brk"] button').forEach((x) => x.classList.toggle('is-on', x.dataset.v === st.brk));
    render();
  });
  const lda = root.querySelector('[data-in="lda"]');
  const ldaOut = root.querySelector('[data-out="lda"]');
  const upd = () => { st.lda = Number(lda.value); ldaOut.textContent = st.lda < 120 ? 'Short' : st.lda < 175 ? 'Medium' : 'Long'; render(); };
  lda.addEventListener('input', upd);
  upd();
  return { unmount() {} };
}
