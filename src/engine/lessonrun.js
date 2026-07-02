// src/engine/lessonrun.js — the lessons-mode INCREMENTAL-REHEARSAL engine (§40).
//
// Lessons mode is ONE trial stream per session (no separate Craft/Mastery phases),
// built on the evidence-based design in the math-fact research (human-app-design):
//   fact = word, strategy family = spelling pattern (the spine lesson),
//   strategy lesson = the intro card, hint ladder = rule + grapheme + grey copy.
// The stream: errorless EXPOSURE for each new word, then RECALL trials interleaved
// among KNOWN words — never two unknowns back to back (when a known exists),
// expanding gaps (U, U K1, U K1 K2, ...), a word never repeating within MIN_REGAP
// trials, knowns cycling longest-unseen first. Per-word state comes from the rolling
// last-WIN recalls: >= KNOWN_AT correct = KNOWN (graduated; the interleave scaffold),
// exactly LAPSED_AT = LAPSED (queue priority), fewer = FORGOTTEN (re-teach on serve).
// Accuracy only — response time never gates graduation (it drives praise + fatigue,
// see fatigue.js). New-word introductions stop for the session once a single new
// word takes CEILING_ERRORS errors. A lesson completes when every pool word is KNOWN.
//
// The run state is plain JSON, persisted per profile as `state.lessons` (state.js),
// so backup/snapshots/cloud-sync inherit it. The SESSION object (beginSession) is
// held by the mode and never persisted. Pure; runs under `node --test`.

export const WIN = 5; // rolling recall window per word
export const KNOWN_AT = 4; // >= 4 correct of the last 5 => KNOWN
export const LAPSED_AT = 3; // exactly 3 of 5 => LAPSED (priority)
export const MIN_REGAP = 2; // a word never repeats within 2 trials
export const CEILING_ERRORS = 3; // 3 errors on ONE new word => no more intros this session
const MIN_WINDOW = 4; // fewer recalls than this = still building (no verdict)

// Keys are stable lesson-id strings (they survive age renumbering); `placed` gates
// the spine diagnostic (slice 4 flips it to false for fresh lessons-mode profiles).
export function createLessonRun({ placed = true } = {}) {
  return {
    v: 1,
    placed,
    diag: null, // serialized spine-diagnostic state (resumable; slice 4)
    lessonId: null, // current lesson (set by syncLesson)
    seenIntro: [], // lesson ids whose intro card has been shown
    completed: [], // lesson ids passed (every pool word KNOWN) — one-way
    trial: 0, // global trial counter (recency clock for the IR scheduler)
    prev: null, // { word, unknown } of the last served trial (adjacency rule)
    words: {}, // word -> { lessonId, exposed, seeded, last, win: [{c,r,ms}] }
  };
}

// Revive a stored run (absent/malformed => fresh). Normalizes every word record so
// a corrupt or partial save can never crash the scheduler.
export function reviveLessonRun(raw) {
  if (!raw || typeof raw !== 'object' || raw.v !== 1) return createLessonRun();
  const run = createLessonRun({ placed: raw.placed !== false });
  run.diag = raw.diag && typeof raw.diag === 'object' ? raw.diag : null;
  run.lessonId = typeof raw.lessonId === 'string' ? raw.lessonId : null;
  run.seenIntro = Array.isArray(raw.seenIntro) ? raw.seenIntro.filter((x) => typeof x === 'string') : [];
  run.completed = Array.isArray(raw.completed) ? raw.completed.filter((x) => typeof x === 'string') : [];
  run.trial = Number.isFinite(raw.trial) ? Math.max(0, Math.floor(raw.trial)) : 0;
  run.prev = raw.prev && typeof raw.prev === 'object' && typeof raw.prev.word === 'string'
    ? { word: raw.prev.word, unknown: !!raw.prev.unknown }
    : null;
  if (raw.words && typeof raw.words === 'object') {
    for (const [word, rec] of Object.entries(raw.words)) {
      if (!rec || typeof rec !== 'object') continue;
      run.words[word] = {
        lessonId: typeof rec.lessonId === 'string' ? rec.lessonId : null,
        exposed: rec.exposed ? 1 : 0,
        seeded: rec.seeded ? 1 : 0,
        last: Number.isFinite(rec.last) ? rec.last : 0,
        win: (Array.isArray(rec.win) ? rec.win : [])
          .filter((x) => x && typeof x === 'object')
          .slice(-WIN)
          .map((x) => ({ c: x.c ? 1 : 0, r: Number.isFinite(x.r) ? x.r : 0, ms: Number.isFinite(x.ms) ? x.ms : null })),
      };
    }
  }
  return run;
}

// ---- per-word state ----------------------------------------------------------

// 'new' (never exposed) | 'active' (building) | 'known' | 'lapsed' | 'forgotten'.
export function wordState(run, word) {
  const rec = run.words[word];
  if (!rec || !rec.exposed) return 'new';
  const win = rec.win;
  if (win.length < MIN_WINDOW) return 'active';
  const last5 = win.slice(-WIN);
  const correct = last5.filter((x) => x.c).length;
  if (correct >= KNOWN_AT) return 'known';
  if (win.length >= WIN) {
    if (correct === LAPSED_AT) return 'lapsed';
    return 'forgotten';
  }
  return 'active';
}

const isKnown = (run, word) => wordState(run, word) === 'known';

// ---- lesson bookkeeping --------------------------------------------------------

const lessonWords = (lesson) => (lesson ? lesson.words.map((e) => (typeof e === 'string' ? e : e.word)) : []);
const findLesson = (lessons, id) => lessons.find((l) => l.id === id) || null;

// Self-heal the current lesson against the CURRENT lessonList (age changes renumber
// and add/remove lessons; ids are stable). Keeps a valid, uncompleted lessonId; when
// every listed lesson is completed the run is done (null).
export function syncLesson(run, lessons) {
  const done = new Set(run.completed);
  const current = findLesson(lessons, run.lessonId);
  if (current && !done.has(current.id)) return run.lessonId;
  const next = lessons.find((l) => !done.has(l.id));
  run.lessonId = next ? next.id : null;
  return run.lessonId;
}

export function needsIntro(run) {
  return !!run.lessonId && !run.seenIntro.includes(run.lessonId);
}

export function markIntroSeen(run) {
  if (run.lessonId && !run.seenIntro.includes(run.lessonId)) run.seenIntro.push(run.lessonId);
}

// ---- the session (mode-held, never persisted) -----------------------------------

export function beginSession() {
  return { responses: 0, capped: false, errors: {} };
}

// ---- the IR scheduler ------------------------------------------------------------

// Trailing run of correct recalls — the expanding-gap driver. A fresh exposure (empty
// window) and a miss both reset to 0, so a struggling word comes back soon.
function endStreak(rec) {
  let s = 0;
  for (let i = rec.win.length - 1; i >= 0 && rec.win[i].c; i--) s += 1;
  return s;
}

// The trial number at which a served word is due again: one more than its streak
// (U, U K1, U K1 K2, ...), floored at MIN_REGAP so nothing repeats back to back.
const dueAt = (rec) => rec.last + Math.max(endStreak(rec) + 1, MIN_REGAP);

// Pick the next trial. Pure read — recordExposure/recordRecall advance the clock.
// Returns { word, expose, known, reteach, state } or null (empty pool + no knowns).
export function nextTrial(run, session, lessons) {
  const t = run.trial + 1;
  const lesson = findLesson(lessons, run.lessonId);
  const pool = lessonWords(lesson);
  const regapOk = (rec) => t - rec.last >= MIN_REGAP;

  // knowns (ANY lesson, seeded or earned): the interleave scaffold, longest-unseen first
  const knowns = Object.keys(run.words)
    .filter((w) => isKnown(run, w))
    .sort((a, b) => run.words[a].last - run.words[b].last);
  const knownsEligible = knowns.filter((w) => regapOk(run.words[w]));

  // decayed words (ANY lesson): lapsed/forgotten jump the queue, forgotten first
  const decayed = Object.keys(run.words)
    .map((w) => ({ w, state: wordState(run, w) }))
    .filter((x) => x.state === 'forgotten' || x.state === 'lapsed')
    .filter((x) => regapOk(run.words[x.w]) && dueAt(run.words[x.w]) <= t)
    .sort((a, b) => (a.state === b.state ? dueAt(run.words[a.w]) - dueAt(run.words[b.w]) : a.state === 'forgotten' ? -1 : 1));

  // current-lesson actives, due now, soonest-due first (pool order breaks ties)
  const actives = pool.filter((w) => run.words[w]?.exposed && wordState(run, w) === 'active');
  const activesDue = actives.filter((w) => dueAt(run.words[w]) <= t && regapOk(run.words[w]))
    .sort((a, b) => dueAt(run.words[a]) - dueAt(run.words[b]));

  const unexposed = pool.filter((w) => wordState(run, w) === 'new');

  const serve = (word) => {
    const state = wordState(run, word);
    return { word, expose: false, known: state === 'known', reteach: state === 'forgotten', state };
  };

  // 1. adjacency rule: after an unknown, a known goes next (when one is available)
  if (run.prev && run.prev.unknown && knownsEligible.length) return serve(knownsEligible[0]);
  // 2. decayed words jump the queue (forgotten re-teach first)
  if (decayed.length) return serve(decayed[0].w);
  // 3. due recalls of the lesson's active words
  if (activesDue.length) return serve(activesDue[0]);
  // 4. a new word (errorless exposure), unless the session hit the unknown ceiling
  if (!session.capped && unexposed.length) {
    return { word: unexposed[0], expose: true, known: false, reteach: false, state: 'new' };
  }
  // 5. maintenance: the longest-unseen known
  if (knownsEligible.length) return serve(knownsEligible[0]);
  // 6. nothing due: pull the soonest-due unfinished word (small pools repeat by design)
  const soonest = pool.filter((w) => run.words[w]?.exposed && !isKnown(run, w) && regapOk(run.words[w]))
    .sort((a, b) => dueAt(run.words[a]) - dueAt(run.words[b]));
  if (soonest.length) return serve(soonest[0]);
  // 7. degenerate fallbacks (1-word pools, empty scaffolds): least-recently-served
  if (knowns.length) return serve(knowns[0]);
  const any = pool.filter((w) => run.words[w]?.exposed).sort((a, b) => run.words[a].last - run.words[b].last);
  if (any.length) return serve(any[0]);
  return null;
}

// ---- recording -------------------------------------------------------------------

function ensureRec(run, word) {
  if (!run.words[word]) {
    run.words[word] = { lessonId: run.lessonId, exposed: 0, seeded: 0, last: 0, win: [] };
  }
  return run.words[word];
}

// Errorless first exposure (grey ghost copy). Advances the clock; no window entry —
// exposure never counts toward graduation.
export function recordExposure(run, session, word) {
  const rec = ensureRec(run, word);
  rec.exposed = 1;
  run.trial += 1;
  rec.last = run.trial;
  run.prev = { word, unknown: true };
  session.responses += 1;
}

// Record a recall (clean, hinted = miss with the rung logged, or wrong). Returns the
// transitions the mode reacts to: graduation, lapse/forget (re-teach), the unknown
// ceiling, and lesson completion (every pool word KNOWN).
export function recordRecall(run, session, word, { correct, rung = 0, ms = null } = {}, lessons = []) {
  const rec = ensureRec(run, word);
  rec.exposed = 1;
  const before = wordState(run, word);
  rec.win.push({ c: correct ? 1 : 0, r: rung || 0, ms: Number.isFinite(ms) ? ms : null });
  if (rec.win.length > WIN) rec.win.shift();
  run.trial += 1;
  rec.last = run.trial;
  run.prev = { word, unknown: before !== 'known' };
  session.responses += 1;

  let ceilingHit = false;
  if (!correct && before !== 'known' && !rec.seeded) {
    session.errors[word] = (session.errors[word] || 0) + 1;
    if (session.errors[word] >= CEILING_ERRORS && !session.capped) {
      session.capped = true;
      ceilingHit = true;
    }
  }

  const after = wordState(run, word);
  const graduated = after === 'known' && before !== 'known';
  if (graduated) rec.seeded = 0; // proved live — an earned graduation now

  let lessonComplete = false;
  const lesson = findLesson(lessons, run.lessonId);
  if (lesson && !run.completed.includes(lesson.id)) {
    const pool = lessonWords(lesson);
    if (pool.length && pool.every((w) => isKnown(run, w))) {
      run.completed.push(lesson.id);
      lessonComplete = true;
    }
  }

  return {
    state: after,
    graduated,
    lapsed: after === 'lapsed' && before !== 'lapsed',
    forgotten: after === 'forgotten' && before !== 'forgotten',
    ceilingHit,
    lessonComplete,
  };
}

// ---- diagnostic seeding (slice 4) --------------------------------------------------

// Seed below-frontier words as KNOWN so IR has a scaffold from day one. `list` is
// [{ word, lessonId }] in spine order; only the `cap` entries NEAREST the frontier
// (the end of the list) are kept. Seeded knowns feed maintenance/interleave but are
// not earned graduations until proved live (recordRecall clears the flag).
export function seedKnown(run, list, { cap = 40 } = {}) {
  for (const { word, lessonId } of list.slice(-cap)) {
    run.words[word] = {
      lessonId: lessonId ?? null,
      exposed: 1,
      seeded: 1,
      last: 0,
      win: Array.from({ length: WIN }, () => ({ c: 1, r: 0, ms: null })),
    };
  }
}

// ---- reads for the UI ---------------------------------------------------------------

// The ONE read for the chip / Home / Progress: where the learner is on the path.
export function lessonStatus(run, lessons) {
  const lesson = findLesson(lessons, run.lessonId);
  const pool = lessonWords(lesson);
  return {
    lessonId: run.lessonId,
    number: lesson ? lesson.band : 0,
    total: lessons.length,
    pool: pool.length,
    graduated: pool.filter((w) => isKnown(run, w)).length,
    completedCount: run.completed.length,
    allDone: lessons.length > 0 && lessons.every((l) => run.completed.includes(l.id)),
  };
}

// Earned graduations (seeded words don't count until proved live).
export function graduatedWords(run) {
  return Object.keys(run.words).filter((w) => isKnown(run, w) && !run.words[w].seeded);
}

// Mining/maintenance material: every KNOWN word, longest-unseen first.
export function maintenanceEntries(run) {
  return Object.keys(run.words)
    .filter((w) => isKnown(run, w))
    .sort((a, b) => run.words[a].last - run.words[b].last);
}
