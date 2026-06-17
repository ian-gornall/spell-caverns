// src/engine/assessment.js — PURE adaptive pre-assessment ("THE GATE").
//
// Before any levels are built, this figures out which words the learner can and
// can't spell, so the game never wastes time on words he already knows. It's an
// adaptive STAIRCASE: ask a small batch of words at a difficulty tier; if he's
// accurate, climb to a harder tier; when errors appear we've found his
// "frontier", and we stop. The output seeds the progress tracker:
//   - knownWords  (don't teach these),
//   - unknownQueue (teach these, most-common first),
//   - estimatedTier (where he is now),
//   - perPattern   (which spelling families are shaky).
//
// PRESENTATION-AGNOSTIC: this engine only decides WHICH word to show next. The
// screen decides how (tap-the-correct-spelling vs. type-in) using the distractor
// engine. Imports nothing browser-specific, so it runs under `node --test`.
import { shuffle } from './distractors.js';

const MAX_TIER = 9;

const clampTier = (t) => Math.min(MAX_TIER, Math.max(1, t));

// Lazily get (and create) the running tally for a tier.
function stat(state, tier) {
  let s = state.tierStats.get(tier);
  if (!s) {
    s = { asked: 0, correct: 0 };
    state.tierStats.set(tier, s);
  }
  return s;
}

// Tiers to try when drawing a word, nearest first, staying within 1..9. Lets us
// keep serving items at/around the frontier without running out.
function nearbyTiers(tier) {
  const order = [tier];
  for (let d = 1; d <= MAX_TIER; d++) {
    if (tier - d >= 1) order.push(tier - d);
    if (tier + d <= MAX_TIER) order.push(tier + d);
  }
  return order;
}

// Draw the next not-yet-asked word at/around `tier`, advancing per-tier cursors.
function drawWord(state, tier) {
  for (const t of nearbyTiers(tier)) {
    const list = state.tierLists.get(t) || [];
    let i = state.cursor.get(t) || 0;
    while (i < list.length) {
      const entry = list[i];
      i += 1;
      if (!state.askedWords.has(entry.word)) {
        state.cursor.set(t, i);
        return entry;
      }
    }
    state.cursor.set(t, i);
  }
  return null;
}

// createAssessment(words, opts) -> a mutable assessment state.
//   words : the dataset (e.g. lexicon.byRank()) — entries with {word,rank,tier,pattern}.
//   opts  : startTier(2), batch(3), minItems(18), maxItems(25),
//           climbThreshold(0.6), sampleWindow(60), rng(Math.random).
export function createAssessment(words, opts = {}) {
  const {
    startTier = 2,
    batch = 3,
    minItems = 18,
    maxItems = 25,
    climbThreshold = 0.6,
    sampleWindow = 60,
    rng = Math.random,
  } = opts;

  // Per-tier candidate pools: the `sampleWindow` most-common words of each tier,
  // shuffled — so we sample BY FREQUENCY (common words) with run-to-run variety.
  const tierLists = new Map();
  for (let t = 1; t <= MAX_TIER; t++) {
    const inTier = words.filter((w) => w.tier === t).sort((a, b) => a.rank - b.rank);
    tierLists.set(t, shuffle(inTier.slice(0, sampleWindow), rng));
  }

  return {
    words,
    byWord: new Map(words.map((w) => [w.word, w])),
    tierLists,
    cursor: new Map(),
    tier: clampTier(startTier),
    startTier: clampTier(startTier),
    batch,
    minItems,
    maxItems,
    climbThreshold,
    rng,
    responses: [], // { word, tier, correct, fast }
    askedWords: new Set(),
    tierStats: new Map(),
    lastPassedTier: clampTier(startTier) - 1, // highest tier with accuracy >= threshold
    frontierFound: false,
    pending: null,
    done: false,
  };
}

// nextItem(state) -> the next word entry to present, or null when the assessment
// is over. Decides climb/stop based on the current tier's batch accuracy.
export function nextItem(state) {
  if (state.done) return null;
  if (state.responses.length >= state.maxItems) {
    state.done = true;
    return null;
  }
  // Defensive: if the caller hasn't submitted the previous item, re-serve it.
  if (state.pending) return state.pending.entry;

  const cur = stat(state, state.tier);
  if (cur.asked >= state.batch) {
    const acc = cur.correct / cur.asked;
    if (!state.frontierFound) {
      if (acc >= state.climbThreshold) {
        state.lastPassedTier = state.tier; // passed this tier
        if (state.tier < MAX_TIER) state.tier += 1; // climb
        else state.frontierFound = true; // passed the top tier -> nowhere higher
      } else {
        state.frontierFound = true; // errors appeared -> this is the frontier
      }
    } else if (state.responses.length >= state.minItems) {
      state.done = true; // frontier known and we have enough signal
      return null;
    }
  }

  const entry = drawWord(state, state.tier);
  if (!entry) {
    state.done = true;
    return null;
  }
  state.pending = { entry, tier: state.tier };
  return entry;
}

// submit(state, word, correct, {fast}) -> records the answer to the pending item.
export function submit(state, word, correct, opts = {}) {
  const fast = !!opts.fast;
  const tier =
    state.pending && state.pending.entry.word === word
      ? state.pending.tier
      : (state.byWord.get(word) || {}).tier || state.tier;
  const s = stat(state, tier);
  s.asked += 1;
  if (correct) s.correct += 1;
  state.responses.push({ word, tier, correct: !!correct, fast });
  state.askedWords.add(word);
  state.pending = null;
  return state;
}

export function isDone(state) {
  return !!state.done;
}

// result(state) -> the assessment findings that seed the progress tracker.
export function result(state) {
  const knownWords = new Set();
  const unknownWords = new Set();
  const perPattern = {};

  for (const r of state.responses) {
    if (r.correct) knownWords.add(r.word);
    else unknownWords.add(r.word);
    const entry = state.byWord.get(r.word);
    const pid = entry ? entry.pattern : 'unknown';
    const p = perPattern[pid] || (perPattern[pid] = { asked: 0, correct: 0 });
    p.asked += 1;
    if (r.correct) p.correct += 1;
  }

  const estimatedTier = state.responses.length ? state.lastPassedTier : state.startTier - 1;

  // Starter teaching queue: frequency-ordered words in the frontier zone the
  // learner hasn't shown he knows, PLUS any word he got wrong outright. The
  // session/mastery layer refines selection (pattern grouping + productive
  // struggle); this is just the raw, ranked pool.
  const loTier = Math.max(1, estimatedTier);
  const hiTier = clampTier(estimatedTier + 1);
  const want = new Map();
  for (const w of state.words) {
    if (knownWords.has(w.word)) continue;
    const inZone = w.tier >= loTier && w.tier <= hiTier;
    if (inZone || unknownWords.has(w.word)) want.set(w.word, w);
  }
  const unknownQueue = [...want.values()].sort((a, b) => a.rank - b.rank).map((w) => w.word);

  return {
    knownWords,
    unknownWords,
    unknownQueue,
    estimatedTier,
    perPattern,
    itemsAsked: state.responses.length,
  };
}
