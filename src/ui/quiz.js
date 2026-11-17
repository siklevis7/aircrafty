// Quiz mode: "find it" questions answered by clicking the 3D model, plus multiple choice
// with explanations. Best scores and missed questions are kept in localStorage.
import { store } from '../core/storage.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const shuffle = (a) => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
const LETTERS = ['A', 'B', 'C', 'D', 'E'];

export function createQuiz(root, { bank, sources, aircraftId, setScene, viewer, setHotspots }) {
  const key = `${aircraftId}:quiz`;
  const saved = store.get(key, {});
  const stats = { best: saved.best || {}, missed: saved.missed || [], answered: saved.answered || 0, correct: saved.correct || 0 };
  const save = () => store.set(key, stats);

  const findQ = (scene, p) => ({
    id: `find:${scene}:${p.id}`, kind: 'find', scene, target: p.id, name: p.name, hint: p.where, explain: p.what,
  });
  const mcQ = (q) => {
    const opts = shuffle(q.options.map((text, i) => ({ text, correct: i === 0 })));
    return { id: `mc:${q.id}`, kind: 'mc', topic: q.topic, q: q.q, options: opts, explain: q.explain };
  };
  const all = () => [
    ...(sources.exterior || []).map((p) => findQ('exterior', p)),
    ...(sources.flightdeck || []).map((p) => findQ('flightdeck', p)),
    ...bank.map(mcQ),
  ];
  const TOPICS = [
    { id: 'exterior-find', label: 'Exterior: find it', desc: 'Click the named component on the 3D aircraft.', icon: '✈', build: () => (sources.exterior || []).map((p) => findQ('exterior', p)) },
    { id: 'flightdeck-find', label: 'Flight deck: find it', desc: 'Find panels and controls in the cockpit.', icon: '◫', build: () => (sources.flightdeck || []).map((p) => findQ('flightdeck', p)) },
    { id: 'systems', label: 'Systems knowledge', desc: 'Hydraulics, electrics, fuel and bleed air.', icon: '⚙', build: () => bank.filter((q) => q.topic === 'systems').map(mcQ) },
    { id: 'aircraft', label: 'Aircraft & flight controls', desc: 'Flight controls, limits and aircraft facts.', icon: '◎', build: () => bank.filter((q) => q.topic === 'aircraft').map(mcQ) },
    { id: 'mixed', label: 'Mixed', desc: 'A bit of everything.', icon: '✦', build: all },
  ].filter((t) => t.build().length);

  let session = null; // { topic, questions, i, score, log: [{q, ok, picked}] , answered }
  let length = store.get(`${key}:len`, 10);
  let active = false;

  function start(topicId, { fromMissed = false } = {}) {
    let pool;
    if (fromMissed) {
      const byId = new Map(all().map((q) => [q.id, q]));
      pool = stats.missed.map((id) => byId.get(id)).filter(Boolean);
    } else pool = TOPICS.find((t) => t.id === topicId).build();
    const questions = shuffle(pool).slice(0, fromMissed ? pool.length : length);
    session = { topic: fromMissed ? 'missed' : topicId, questions, i: 0, score: 0, log: [], answered: false, hint: false };
    showQuestion();
  }

  function cur() { return session?.questions[session.i]; }

  function showQuestion() {
    const q = cur();
    session.answered = false;
    session.hint = false;
    session.picked = null;
    viewer.select(null);
    if (q.kind === 'find') {
      setScene(q.scene);
      setHotspots(false);
    }
    render();
  }

  function record(ok, picked) {
    const q = cur();
    session.answered = true;
    session.picked = picked;
    if (ok) session.score++;
    session.log.push({ q, ok, picked });
    stats.answered++;
    if (ok) { stats.correct++; stats.missed = stats.missed.filter((id) => id !== q.id); }
    else if (!stats.missed.includes(q.id)) stats.missed.push(q.id);
    save();
    render();
  }

  function answerMC(i) {
    if (!session || session.answered) return;
    record(cur().options[i].correct, i);
  }

  /** Called when the user clicks a part in 3D during a find-it question. Returns true if consumed. */
  function pick(partId) {
    const q = cur();
    if (!active || !q || q.kind !== 'find' || session.answered) return false;
    if (!partId) return true; // clicked empty space: ignore
    const ok = partId === q.target;
    viewer.select(q.target, { focus: !ok });
    record(ok, partId);
    return true;
  }

  function reveal() {
    const q = cur();
    viewer.select(q.target, { focus: true });
    record(false, null);
  }

  function next() {
    if (session.i < session.questions.length - 1) { session.i++; showQuestion(); }
    else finish();
  }

  function finish() {
    const pct = Math.round((session.score / session.questions.length) * 100);
    if (session.topic !== 'missed') stats.best[session.topic] = Math.max(stats.best[session.topic] || 0, pct);
    save();
    session.done = true;
    viewer.select(null);
    render();
  }

  function home() { session = null; viewer.select(null); render(); }

  const partName = (scene, id) => (sources[scene] || []).find((p) => p.id === id)?.name || id;

  function render() {
    if (!active) return;
    if (!session) return renderHome();
    if (session.done) return renderResults();
    const q = cur();
    const n = session.questions.length;
    const head = `
      <div class="quiz-head">
        <div class="quiz-top"><button type="button" class="walk-link" data-act="home">← Topics</button><span class="quiz-score">Score <b>${session.score}</b></span></div>
        <div class="walk-progress">Question <b>${session.i + 1}</b> of ${n}</div>
        <div class="progress-bar"><i style="width:${((session.i + (session.answered ? 1 : 0)) / n) * 100}%"></i></div>
      </div>`;
    let body = '';
    if (q.kind === 'mc') {
      body = `
        <section class="quiz-card">
          <div class="quiz-kind">Multiple choice</div>
          <h2 class="quiz-q">${esc(q.q)}</h2>
          <div class="quiz-opts">
            ${q.options.map((o, i) => {
              let cls = '';
              if (session.answered) cls = o.correct ? ' is-correct' : i === session.picked ? ' is-wrong' : ' is-dim';
              return `<button type="button" class="quiz-opt${cls}" data-opt="${i}" ${session.answered ? 'disabled' : ''}><span class="quiz-letter">${LETTERS[i]}</span><span>${esc(o.text)}</span></button>`;
            }).join('')}
          </div>
          ${session.answered ? feedback(q.options[session.picked]?.correct, q.explain) : ''}
        </section>`;
    } else {
      const ok = session.answered && session.picked === q.target;
      body = `
        <section class="quiz-card">
          <div class="quiz-kind">${q.scene === 'flightdeck' ? 'Flight deck' : 'Exterior'} · find it</div>
          <h2 class="quiz-q">Find: ${esc(q.name)}</h2>
          ${!session.answered ? `
            <p class="quiz-instr">Click it on the 3D model. Drag to orbit and scroll to zoom.</p>
            ${session.hint ? `<p class="quiz-hint"><b>Hint:</b> ${esc(q.hint || '')}</p>` : ''}
            <div class="quiz-actions">
              ${session.hint ? '' : '<button type="button" class="walk-btn" data-act="hint">Hint</button>'}
              <button type="button" class="walk-btn" data-act="reveal">Show me</button>
            </div>` : feedback(ok, `${ok ? '' : session.picked ? `You clicked: ${esc(partName(q.scene, session.picked))}. ` : ''}${q.explain}`, true)}
        </section>`;
    }
    root.innerHTML = head + `<div class="walk-body">${body}</div>`;
    bind();
  }

  function feedback(ok, text, isFind = false) {
    const last = session.i === session.questions.length - 1;
    return `
      <div class="quiz-fb ${ok ? 'is-ok' : 'is-bad'}">
        <strong>${ok ? 'Correct' : isFind ? 'Not quite. It\'s highlighted on the model' : 'Not quite'}</strong>
        <p>${text}</p>
      </div>
      <button type="button" class="walk-btn walk-btn--primary quiz-next" data-act="next">${last ? 'See results' : 'Next question'} →</button>`;
  }

  function renderHome() {
    const acc = stats.answered ? Math.round((stats.correct / stats.answered) * 100) : null;
    root.innerHTML = `
      <div class="walk-head">
        <div class="eyebrow">Quiz</div>
        <div class="walk-progress">${stats.answered ? `<b>${stats.answered}</b> answered · <b>${acc}%</b> correct overall` : 'Test yourself on the aircraft, the flight deck and the systems.'}</div>
      </div>
      <div class="walk-body">
        <div class="quiz-len">
          <span class="scn-label">Questions</span>
          <div class="scn-opts">${[5, 10, 20].map((v) => `<button type="button" class="scn-btn${v === length ? ' is-on' : ''}" data-len="${v}">${v}</button>`).join('')}</div>
        </div>
        <div class="quiz-topics">
          ${TOPICS.map((t) => `
            <button type="button" class="quiz-topic" data-topic="${t.id}">
              <span class="quiz-icon" aria-hidden="true">${t.icon}</span>
              <span class="quiz-tt"><b>${esc(t.label)}</b><span>${esc(t.desc)}</span></span>
              <span class="quiz-best">${stats.best[t.id] != null ? `${stats.best[t.id]}%` : '—'}</span>
            </button>`).join('')}
        </div>
        ${stats.missed.length ? `<button type="button" class="walk-btn walk-btn--primary quiz-missed" data-act="missed">Review missed questions (${stats.missed.length})</button>` : ''}
        <p class="walk-note">Best scores and missed questions are saved in this browser. Study aid only: your operator's documents take precedence.</p>
      </div>`;
    bind();
  }

  function renderResults() {
    const n = session.questions.length;
    const pct = Math.round((session.score / n) * 100);
    const msg = pct === 100 ? 'Perfect run.' : pct >= 80 ? 'Solid. Ready for the sim.' : pct >= 60 ? 'Getting there. Review the misses.' : 'Keep studying, then try again.';
    const missed = session.log.filter((l) => !l.ok);
    root.innerHTML = `
      <div class="walk-head"><div class="eyebrow">Results</div></div>
      <div class="walk-body">
        <section class="quiz-result">
          <div class="quiz-ring" style="--p:${pct}"><span>${pct}%</span></div>
          <h2>${session.score} / ${n} correct</h2>
          <p>${msg}</p>
        </section>
        ${missed.length ? `<h3 class="quiz-sub">Review</h3><ul class="quiz-review">
          ${missed.map(({ q }) => `<li><b>${esc(q.kind === 'find' ? `Find: ${q.name}` : q.q)}</b><span>${esc(q.kind === 'find' ? (q.hint || '') : q.options.find((o) => o.correct).text)}</span></li>`).join('')}
        </ul>` : ''}
        <div class="quiz-actions quiz-actions--col">
          ${missed.length ? '<button type="button" class="walk-btn walk-btn--primary" data-act="retry">Retry the ones I missed</button>' : ''}
          <button type="button" class="walk-btn" data-act="again">Same topic again</button>
          <button type="button" class="walk-btn" data-act="home">All topics</button>
        </div>
      </div>`;
    bind();
  }

  function bind() {
    root.querySelectorAll('[data-topic]').forEach((b) => b.addEventListener('click', () => start(b.dataset.topic)));
    root.querySelectorAll('[data-len]').forEach((b) => b.addEventListener('click', () => { length = +b.dataset.len; store.set(`${key}:len`, length); render(); }));
    root.querySelectorAll('[data-opt]').forEach((b) => b.addEventListener('click', () => answerMC(+b.dataset.opt)));
    const on = (act, fn) => root.querySelectorAll(`[data-act="${act}"]`).forEach((b) => b.addEventListener('click', fn));
    on('home', home);
    on('next', next);
    on('hint', () => { session.hint = true; render(); });
    on('reveal', reveal);
    on('missed', () => start(null, { fromMissed: true }));
    on('retry', () => {
      const ids = session.log.filter((l) => !l.ok).map((l) => l.q.id);
      const byId = new Map(all().map((q) => [q.id, q]));
      session = { topic: 'missed', questions: shuffle(ids.map((id) => byId.get(id)).filter(Boolean)), i: 0, score: 0, log: [], answered: false };
      showQuestion();
    });
    on('again', () => start(session.topic === 'missed' ? 'mixed' : session.topic));
    root.querySelector('.quiz-next')?.focus({ preventScroll: true });
  }

  return {
    start() { active = true; root.hidden = false; render(); },
    stop() { active = false; root.hidden = true; viewer.select(null); },
    pick,
    key(k) {
      if (!active || !session || session.done) return false;
      const q = cur();
      if (q.kind === 'mc' && !session.answered && /^[1-5]$/.test(k) && q.options[+k - 1]) { answerMC(+k - 1); return true; }
      if (session.answered && (k === 'Enter' || k === 'ArrowRight')) { next(); return true; }
      return false;
    },
    get wantsPick() { const q = cur(); return active && q?.kind === 'find' && !session.answered && !session.done; },
    get active() { return active; },
  };
}
