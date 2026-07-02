// src/engine/spinediag.js — the lessons-mode SPINE DIAGNOSTIC walk (§40).
//
// Places a NEW lessons-mode profile on the lesson path (classic placement.js walks
// the frequency list and is untouched). Played as ordinary lesson trials — the mode
// keeps misses one-shot, caps the hint ladder at rung 1, and never reveals the
// spelling, so a probe can't be taught into a false pass.
//   1. BINARY SEARCH over lesson indices: probe a lesson with up to 2 of its first
//      (shortest, most frequent) words — both correct = the lesson is passed, a miss
//      fails it fast. Pass → search above; fail → search below.
//   2. DENSE probes around the converged frontier refine it; the final frontier is
//      the LOWEST failed lesson (conservative — place a struggler easier).
//   3. CLOSE ON A SUCCESS: if the last answer was a miss, serve easy words from well
//      below the frontier until one lands (capped) — the child ends feeling good.
// The result seeds below-frontier words as KNOWN (lessonrun.seedKnown, capped ~40
// nearest the frontier) so incremental rehearsal has knowns from day one. The walk
// persists across sessions at run.diag (serializeDiag/restore); a restore from a
// DIFFERENT path (age change renumbered the lessons) is discarded. Pure; `node --test`.

const PROBE_WORDS = 2; // words per probed lesson (fewer if the lesson is smaller)
const DENSE_SPAN = 2; // dense phase probes [frontier-2 .. frontier+1]
const CLOSE_TRIES = 3; // best-effort attempts to end on a success

const lessonWords = (l) => l.words.map((e) => (typeof e === 'string' ? e : e.word));
const pathIdsOf = (lessons) => lessons.map((l) => l.id);

export function createSpineDiag(lessons, { restore } = {}) {
  const st = {
    lessons,
    L: lessons.length,
    pathIds: pathIdsOf(lessons),
    phase: 'binary', // 'binary' | 'dense' | 'closing' | 'done'
    lo: 0,
    hi: lessons.length - 1,
    probes: {}, // lessonIdx -> { asked, correct, wrong, settled, passed }
    pending: null, // { word, lessonIdx, lessonId }
    responses: [], // { word, lessonIdx, lessonId, correct }
    frontier: null,
    closeTries: 0,
    done: lessons.length === 0,
  };
  if (restore && typeof restore === 'object') {
    // only resume onto the SAME path — an age change renumbers/reshapes the lessons
    const same = Array.isArray(restore.pathIds)
      && restore.pathIds.length === st.pathIds.length
      && restore.pathIds.every((id, i) => id === st.pathIds[i]);
    if (same) {
      st.phase = restore.phase || 'binary';
      st.lo = Number.isFinite(restore.lo) ? restore.lo : 0;
      st.hi = Number.isFinite(restore.hi) ? restore.hi : st.L - 1;
      st.probes = restore.probes && typeof restore.probes === 'object' ? JSON.parse(JSON.stringify(restore.probes)) : {};
      st.responses = Array.isArray(restore.responses) ? restore.responses.map((r) => ({ ...r })) : [];
      st.frontier = Number.isFinite(restore.frontier) ? restore.frontier : null;
      st.closeTries = Number.isFinite(restore.closeTries) ? restore.closeTries : 0;
      st.done = !!restore.done;
      st.pending = null; // an un-answered probe is simply re-picked
    }
  }
  return st;
}

// JSON-safe progress (the lessons array is reconstructed each session).
export function serializeDiag(st) {
  return {
    pathIds: [...st.pathIds],
    phase: st.phase,
    lo: st.lo,
    hi: st.hi,
    probes: JSON.parse(JSON.stringify(st.probes)),
    responses: st.responses.map((r) => ({ ...r })),
    frontier: st.frontier,
    closeTries: st.closeTries,
    done: !!st.done,
  };
}

export const diagDone = (st) => !!st.done;

function probeOf(st, idx) {
  if (!st.probes[idx]) st.probes[idx] = { asked: 0, correct: 0, wrong: 0, settled: false, passed: null };
  return st.probes[idx];
}

// The next un-served probe word of a lesson (teaching order), or null when exhausted.
function nextWordOf(st, idx) {
  const words = lessonWords(st.lessons[idx]);
  const askedHere = new Set(st.responses.filter((r) => r.lessonIdx === idx).map((r) => r.word));
  return words.find((w) => !askedHere.has(w)) || null;
}

const serve = (st, idx, word) => {
  st.pending = { word, lessonIdx: idx, lessonId: st.lessons[idx].id };
  return st.pending;
};

// The dense window around the binary frontier: [lo-DENSE_SPAN .. lo+1], unprobed only.
function denseCandidates(st) {
  const f = Math.max(0, Math.min(st.lo, st.L - 1));
  const out = [];
  for (let i = Math.max(0, f - DENSE_SPAN); i <= Math.min(st.L - 1, f + 1); i++) {
    if (!probeOf(st, i).settled) out.push(i);
  }
  return out;
}

// The final frontier once probing is finished: the LOWEST failed lesson, else the
// binary insertion point; an all-pass child starts at the LAST lesson.
function settleFrontier(st) {
  let lowestFail = null;
  for (const [idx, p] of Object.entries(st.probes)) {
    if (p.settled && p.passed === false) {
      const i = Number(idx);
      if (lowestFail == null || i < lowestFail) lowestFail = i;
    }
  }
  const f = lowestFail != null ? lowestFail : st.lo;
  st.frontier = Math.max(0, Math.min(f, st.L - 1));
}

// nextProbe(st) -> { word, lessonIdx, lessonId } | null when the walk is done.
export function nextProbe(st) {
  if (st.done) return null;
  if (st.pending) return st.pending;

  if (st.phase === 'binary') {
    if (st.lo > st.hi) {
      st.phase = 'dense';
    } else {
      const mid = (st.lo + st.hi) >> 1;
      const p = probeOf(st, mid);
      if (!p.settled) {
        const w = nextWordOf(st, mid);
        if (w) return serve(st, mid, w);
        // no words left to probe (tiny lesson fully asked): settle on what we saw
        p.settled = true;
        p.passed = p.wrong === 0;
        if (p.passed) st.lo = mid + 1;
        else st.hi = mid - 1;
      }
      return nextProbe(st);
    }
  }

  if (st.phase === 'dense') {
    const cands = denseCandidates(st);
    if (cands.length) {
      const idx = cands[0];
      const w = nextWordOf(st, idx);
      if (w) return serve(st, idx, w);
      const p = probeOf(st, idx);
      p.settled = true;
      p.passed = p.wrong === 0;
      return nextProbe(st);
    }
    settleFrontier(st);
    st.phase = 'closing';
  }

  if (st.phase === 'closing') {
    const last = st.responses[st.responses.length - 1];
    if ((last && last.correct) || st.closeTries >= CLOSE_TRIES) {
      st.phase = 'done';
      st.done = true;
      if (st.frontier == null) settleFrontier(st);
      return null;
    }
    // serve an easy word from well below the frontier until one lands
    const easy = Math.max(0, (st.frontier ?? 0) - DENSE_SPAN);
    for (let i = easy; i >= 0; i--) {
      const w = nextWordOf(st, i);
      if (w) {
        st.closeTries += 1;
        return serve(st, i, w);
      }
    }
    // nothing left to serve below — end as-is
    st.phase = 'done';
    st.done = true;
    return null;
  }

  return null;
}

// submitProbe(st, correct) -> record the pending probe's outcome and advance the search.
export function submitProbe(st, correct) {
  if (st.done || !st.pending) return st;
  const { word, lessonIdx, lessonId } = st.pending;
  st.pending = null;
  const ok = !!correct;
  st.responses.push({ word, lessonIdx, lessonId, correct: ok });

  if (st.phase === 'closing') return st; // closing serves don't move the search

  const p = probeOf(st, lessonIdx);
  p.asked += 1;
  if (ok) p.correct += 1;
  else p.wrong += 1;

  const size = Math.min(PROBE_WORDS, lessonWords(st.lessons[lessonIdx]).length);
  if (!ok) {
    p.settled = true;
    p.passed = false; // a miss fails the lesson fast
  } else if (p.correct >= size) {
    p.settled = true;
    p.passed = true;
  }
  if (st.phase === 'binary' && p.settled) {
    if (p.passed) st.lo = lessonIdx + 1;
    else st.hi = lessonIdx - 1;
  }
  return st;
}

// diagResult(st) -> what the mode seeds from:
//   startLessonId  : where the run begins,
//   knownLessonIds : every lesson below the frontier (their words seed as KNOWN),
//   correctWords   : the probe successes ([{word, lessonId}]) — provably known live.
export function diagResult(st) {
  if (st.frontier == null) settleFrontier(st);
  const f = st.frontier;
  return {
    startLessonId: st.L ? st.lessons[f].id : null,
    knownLessonIds: st.lessons.slice(0, f).map((l) => l.id),
    correctWords: st.responses.filter((r) => r.correct).map((r) => ({ word: r.word, lessonId: r.lessonId })),
  };
}
