// src/engine/placement.js — PURE C1 placement diagnostic walk (Ian 2026-06-22).
//
// The COLD-START "cavern level 1" for EVERY explorer, played as ordinary CRAFT so
// the child never knows it's a different mode:
//   1. Ask the child's age → seed a START position in the frequency-ordered list
//      (5→#1, 6→#300, 7→#600, +300/yr — the most-common word a kid that age might
//      still be learning).
//   2. Serve that word in Craft. Spelled cleanly → jump +`step` (default 100) list
//      positions; missed → jump −`step`. Never repeat a word: if a jump lands on an
//      already-served (or unservable) position, advance to the next unserved one.
//   3. STOP when `missesToEnter` (default 3) missed words fall in the SAME 30-word
//      group (a "band" / cavern level). That band is where the explorer ENTERS the
//      cavern; the categories engine then serves that band's words until mastered.
//
// With a ±100 step the walk parks two "fingers" either side of the frontier; the
// upper finger marches forward one position per revisit (dedup), so misses pile up
// inside one band and trip the stop within a handful of words. A maxItems cap is a
// safety net for an erratic speller. The walk is decided HERE; the SCREEN presents
// it as Craft (relaxing the auto-hint/timer during the diagnostic) and feeds each
// clean-build/miss outcome back via submit(). Real difficulty self-corrects from
// actual play afterwards (the selection-layer adaptive level), so a slightly-high
// placement is fine. Imports nothing browser-specific → runs under `node --test`.

// Default: a word is servable in Craft if it has ≥3 letters (matches modes/puzzle.js,
// which filters `byRank().filter(w => w.word.length >= 3)`), so 1–2 letter sight
// words ("a", "I") are skipped without disturbing the full-list position numbering.
const DEFAULT_SERVABLE = (w) => !!w && typeof w.word === 'string' && w.word.length >= 3;

// Age → 0-based START position in the frequency list. 5 (or younger) → #1; each year
// adds 300 (6→#300, 7→#600, …). Clamped to the list length. `listLength` optional.
export function startPosForAge(age, listLength) {
  const a = Number.isFinite(age) ? Math.round(age) : 5;
  const word1based = a <= 5 ? 1 : (a - 5) * 300; // 5→1, 6→300, 7→600, 8→900, …
  let pos = word1based - 1;
  if (Number.isFinite(listLength) && listLength > 0) pos = Math.min(pos, listLength - 1);
  return Math.max(0, pos);
}

// The 30-word band (1-based cavern level) for a list position. Prefers the band
// carried on the entry (attached by lexicon.byRank); falls back to the position.
function bandAt(words, pos, bandSize) {
  const e = words[pos];
  if (e && Number.isFinite(e.band)) return e.band;
  return Math.floor(pos / bandSize) + 1;
}

// createPlacement(words, opts) -> a mutable walk state.
//   words : the frequency-ordered dataset (lexicon.byRank()) — entries with
//           {word, pos, band, rank, …}. Position = index in this array.
//   opts  : age | startPos, step(100), missesToEnter(3), maxItems(36),
//           bandSize(30), servable(fn), restore (a prior serialize() to RESUME the walk).
// The walk PERSISTS across craft sessions (Ian 2026-06-22b): each session plays a few words and
// the walk continues — it ends only when 3 misses land in one band (or the maxItems safety net).
export function createPlacement(words, opts = {}) {
  const {
    age,
    startPos,
    restore,
    step = 100,
    missesToEnter = 3,
    maxItems = 36, // safety net only (≈6 craft sessions); the real stop is 3-misses-in-a-band
    bandSize = 30,
    servable = DEFAULT_SERVABLE,
  } = opts;
  const N = Array.isArray(words) ? words.length : 0;
  const start = Number.isFinite(startPos) ? startPos : startPosForAge(age, N);
  const st = {
    words,
    N,
    step,
    missesToEnter,
    maxItems,
    bandSize,
    servable,
    pos: Math.max(0, Math.min(start, Math.max(0, N - 1))), // next position to try
    servingPos: null, // the actual position of the pending word
    pending: null,
    served: new Set(), // positions already answered
    bandMiss: new Map(), // band -> # missed words in it
    responses: [], // { word, correct, pos, band }
    done: N === 0,
    enteredBand: null,
  };
  // RESUME a walk saved between sessions (serialize() below). The words array is reconstructed
  // each session; only the progress (served positions, miss tally, cursor, answers) is restored.
  if (restore && typeof restore === 'object') {
    if (Number.isFinite(restore.pos)) st.pos = Math.max(0, Math.min(restore.pos, Math.max(0, N - 1)));
    if (Array.isArray(restore.served)) st.served = new Set(restore.served);
    if (Array.isArray(restore.bandMiss)) st.bandMiss = new Map(restore.bandMiss);
    if (Array.isArray(restore.responses)) st.responses = restore.responses.map((r) => ({ ...r }));
    st.done = !!restore.done;
    st.enteredBand = restore.enteredBand ?? null;
  }
  return st;
}

// Serialize the walk PROGRESS to a plain JSON-safe object so it can persist on the profile
// between craft sessions and be passed back as `restore`. (The words array is NOT serialized.)
export function serialize(state) {
  return {
    pos: state.pos,
    served: [...state.served],
    bandMiss: [...state.bandMiss],
    responses: state.responses.map((r) => ({ ...r })),
    done: !!state.done,
    enteredBand: state.enteredBand ?? null,
  };
}

// Find the next servable, not-yet-served position: scan FORWARD from `from`
// (the dedup "move to the next one" rule), then fall back to scanning BACKWARD.
function findServable(state, from) {
  const { words, N } = state;
  for (let i = Math.max(0, from); i < N; i += 1) {
    if (!state.served.has(i) && state.servable(words[i])) return i;
  }
  for (let i = Math.min(from, N - 1); i >= 0; i -= 1) {
    if (!state.served.has(i) && state.servable(words[i])) return i;
  }
  return -1;
}

function finishByFallback(state) {
  state.done = true;
  if (state.enteredBand != null) return;
  // No band reached the miss threshold (e.g. the 6-word cap was hit first): enter the band
  // with the MOST misses; on a tie pick the LOWEST such band (place a struggler easier rather
  // than arbitrarily high). If there were NO misses at all (a strong speller), enter the band
  // at the current walk position — the walk climbed there, so it's an appropriate level.
  let best = null;
  let bestMiss = -1;
  for (const [band, miss] of state.bandMiss) {
    if (miss > bestMiss || (miss === bestMiss && best != null && band < best)) {
      bestMiss = miss;
      best = band;
    }
  }
  state.enteredBand =
    best != null ? best : bandAt(state.words, Math.max(0, Math.min(state.pos, state.N - 1)), state.bandSize);
}

// nextWord(state) -> the entry to present in Craft, or null when placement is done.
export function nextWord(state) {
  if (state.done) return null;
  if (state.pending) return state.pending; // re-serve un-submitted item
  const pos = findServable(state, state.pos);
  if (pos < 0) {
    finishByFallback(state);
    return null;
  }
  state.servingPos = pos;
  state.pending = state.words[pos];
  return state.pending;
}

// submit(state, word, correct) -> record the answer and take the next ±step jump.
//   correct = a clean first-try Craft build (Decision 1: a hint/wrong = NOT correct).
export function submit(state, word, correct) {
  if (state.done) return state;
  const pos = Number.isInteger(state.servingPos) ? state.servingPos : state.pos;
  const band = bandAt(state.words, pos, state.bandSize);
  const ok = !!correct;
  state.served.add(pos);
  state.responses.push({ word, correct: ok, pos, band });
  state.pending = null;

  if (!ok) {
    const m = (state.bandMiss.get(band) || 0) + 1;
    state.bandMiss.set(band, m);
    if (m >= state.missesToEnter) {
      state.done = true;
      state.enteredBand = band;
    }
  }

  // Take the jump from the word's ACTUAL position (not the drifting cursor).
  const target = pos + (ok ? state.step : -state.step);
  state.pos = Math.max(0, Math.min(target, Math.max(0, state.N - 1)));

  if (!state.done && state.responses.length >= state.maxItems) finishByFallback(state);
  return state;
}

export const isDone = (state) => !!state.done;

// result(state) -> the placement findings:
//   enteredBand   : the 30-word cavern level to seed the categories engine at,
//   responses     : every diagnostic answer (so corrects already bank progress),
//   itemsAsked / correctCount : tallies.
export function result(state) {
  return {
    enteredBand: state.enteredBand,
    responses: state.responses.map((r) => ({ ...r })),
    itemsAsked: state.responses.length,
    correctCount: state.responses.filter((r) => r.correct).length,
  };
}
