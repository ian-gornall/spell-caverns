// src/engine/categories.js — PURE §30 word-category STATE MACHINE.
//
// §30 (Ian 2026-06-19d) layers DISCRETE categories on top of the continuous
// mastery score in progress.js (which still drives gems / speed / recency — this
// module owns "what state is each word in" and "what's in the working set"):
//
//     new → learning → known → mastered      (+ `tricky`, a demotion/overflow bucket)
//
// Hard rules (these SUPERSEDE the §4 "no hard categories" stance for these mechanics):
//   - learning = a FIXED working set of exactly `setSize` words, always kept full.
//   - known    = crafted correctly TWICE IN A ROW in CRAFT (a craft miss → learning).
//   - mastered = a known word with ONE success in MASTERY (draw) mode. Set ONLY there;
//                a draw miss on a mastered word → known; a draw miss on a merely-known
//                word leaves it known ("not mastered yet").
//   - tricky   = the hardest / lowest-accuracy words EVICTED to keep learning at setSize
//                (on overflow when a known/mastered word re-enters, OR on a level demotion).
//                It is the demotion/overflow pool — never a proactive target. GROWN-UP-ONLY
//                in the UI (a child never sees a "tricky/hard" label).
//   - refill priority when a learning slot frees: (1) a NEW unseen word at the current
//                level → (2) an on-level-or-lower TRICKY word (preferring one whose pattern
//                the learner has since mastered — the well-timed reintroduction) → (3) level
//                UP and draw from the higher tier. Tricky words resurface ONLY via (2)/(3),
//                never on their own.
//   - unlock chain: craft (always) → mastery (after `setSize` reached KNOWN) → mining (after
//                `setSize` reached MASTERED). Unlocks NEVER regress (gated on high-water peaks).
//
// `setSize` = the existing "Words per dig" setting (default 10): one lever driving the
// working-set size AND both unlock thresholds.
//
// Imports nothing browser-specific so it runs under `node --test`.

export const CATEGORIES = {
  NEW: 'new',
  LEARNING: 'learning',
  KNOWN: 'known',
  MASTERED: 'mastered',
  TRICKY: 'tricky',
};

// Consecutive correct CRAFTS required to move learning → known ("twice in a row").
export const PROMOTE_STREAK = 2;
// Bounded craft-outcome history kept for the adaptive-level policy (step 2 reads it).
const RECENT_MAX = 8;

const clampLevel = (n, max) => Math.min(max, Math.max(1, Math.round(n) || 1));

// A fresh state machine. `order` is a monotonic counter for stable age tiebreaks.
export function createCategoryState({ setSize = 10, level = 1 } = {}) {
  return {
    setSize: Math.max(1, Math.round(setSize) || 10),
    level: Math.max(1, Math.round(level) || 1),
    words: new Map(), // word -> record (see ensureRecord); UNSEEN words are simply absent
    recent: [], // recent craft outcomes (booleans), newest last — for adaptive level
    order: 0, // bumps on every record creation
    peakKnownish: 0, // high-water of (#known + #mastered) — gates the mastery unlock
    peakMastered: 0, // high-water of #mastered — gates the mining unlock
  };
}

// ---- pool helpers (the pool is an array of dataset entries {word,tier,pattern,rank}) ----
function poolIndex(pool) {
  const m = new Map();
  for (const w of pool || []) if (w && typeof w.word === 'string' && !m.has(w.word)) m.set(w.word, w);
  return m;
}
function maxTier(pool) {
  let mx = 1;
  for (const w of pool || []) if (Number.isFinite(w.tier) && w.tier > mx) mx = w.tier;
  return mx;
}

// Create (or return) the record for `word`, seeding tier/pattern from the pool.
function ensureRecord(state, word, poolEntry) {
  let rec = state.words.get(word);
  if (!rec) {
    rec = {
      word,
      tier: poolEntry && Number.isFinite(poolEntry.tier) ? poolEntry.tier : state.level,
      pattern: (poolEntry && poolEntry.pattern) || '',
      rank: poolEntry && Number.isFinite(poolEntry.rank) ? poolEntry.rank : Infinity,
      category: CATEGORIES.LEARNING,
      craftStreak: 0,
      craftAttempts: 0,
      craftCorrect: 0,
      order: ++state.order,
    };
    state.words.set(word, rec);
  }
  return rec;
}

// ---- category queries ----
export function getCat(state, word) {
  const rec = state.words.get(word);
  return rec ? rec.category : CATEGORIES.NEW;
}
const wordsIn = (state, cat) =>
  [...state.words.values()].filter((r) => r.category === cat).sort((a, b) => a.order - b.order).map((r) => r.word);
export const learningWords = (state) => wordsIn(state, CATEGORIES.LEARNING);
export const knownWords = (state) => wordsIn(state, CATEGORIES.KNOWN);
export const masteredWords = (state) => wordsIn(state, CATEGORIES.MASTERED);
export const trickyWords = (state) => wordsIn(state, CATEGORIES.TRICKY);
const learningCount = (state) => {
  let n = 0;
  for (const r of state.words.values()) if (r.category === CATEGORIES.LEARNING) n += 1;
  return n;
};

// Accuracy for eviction. UNTESTED words (no craft attempts) are treated as "not yet
// shown to be hard" (1.0) so a fresh word is never parked ahead of a chronic struggler.
function accuracy(rec) {
  return rec.craftAttempts ? rec.craftCorrect / rec.craftAttempts : 1;
}
// "Harder" first: lowest accuracy, then higher tier, then more struggle (attempts), then oldest.
function harder(a, b) {
  return accuracy(a) - accuracy(b) || b.tier - a.tier || b.craftAttempts - a.craftAttempts || a.order - b.order;
}

// Park the single hardest learning word (excluding `exclude`) as tricky. Returns it or null.
function evictHardestToTricky(state, { exclude } = {}) {
  const cands = [...state.words.values()].filter((r) => r.category === CATEGORIES.LEARNING && r.word !== exclude);
  if (!cands.length) return null;
  cands.sort(harder);
  const victim = cands[0];
  victim.category = CATEGORIES.TRICKY;
  return victim;
}

// ---- peaks / unlocks ----
function bumpPeaks(state) {
  let known = 0;
  let mastered = 0;
  for (const r of state.words.values()) {
    if (r.category === CATEGORIES.KNOWN) known += 1;
    else if (r.category === CATEGORIES.MASTERED) mastered += 1;
  }
  // A mastered word has, by definition, passed through known — so the "reached known"
  // high-water counts both. Unlocks ratchet up and never fall back (QA I5 precedent).
  state.peakKnownish = Math.max(state.peakKnownish, known + mastered);
  state.peakMastered = Math.max(state.peakMastered, mastered);
}

export function unlocks(state) {
  return {
    craft: true,
    mastery: state.peakKnownish >= state.setSize,
    mining: state.peakMastered >= state.setSize,
  };
}

// ---- refill ----
// Has the learner mastered this spelling PATTERN (≥1 mastered word in it)? Used to prefer
// a well-timed reintroduction of a same-pattern tricky word (Ian's adopted secondary trigger).
function patternMastered(state, pattern) {
  if (!pattern) return false;
  for (const r of state.words.values()) if (r.category === CATEGORIES.MASTERED && r.pattern === pattern) return true;
  return false;
}

// Pick ONE refill candidate at/below the current level, or null if none exists there.
//   priority: (1) lowest-rank NEW word at tier === level
//             (2) an on-level-or-lower TRICKY word (pattern-mastered first, then closest tier)
function pickRefill(state, idx) {
  // (1) new unseen at the current level
  let bestNew = null;
  for (const entry of idx.values()) {
    if (entry.tier !== state.level || state.words.has(entry.word)) continue;
    if (!bestNew || (entry.rank ?? Infinity) < (bestNew.rank ?? Infinity)) bestNew = entry;
  }
  if (bestNew) return { kind: 'new', entry: bestNew };

  // (2) tricky at/below the level — prefer pattern-mastered, then highest tier (closest), then rank
  const tricky = [...state.words.values()].filter((r) => r.category === CATEGORIES.TRICKY && r.tier <= state.level);
  if (tricky.length) {
    tricky.sort((a, b) => {
      const pm = (patternMastered(state, b.pattern) ? 1 : 0) - (patternMastered(state, a.pattern) ? 1 : 0);
      return pm || b.tier - a.tier || (a.rank ?? Infinity) - (b.rank ?? Infinity) || a.order - b.order;
    });
    return { kind: 'tricky', rec: tricky[0] };
  }
  return null;
}

// Are there NEW unseen words strictly above the current level (so a level-up can help)?
function hasNewAbove(state, idx) {
  for (const entry of idx.values()) if (entry.tier > state.level && !state.words.has(entry.word)) return true;
  return false;
}

// Top the learning set up to `setSize`, honouring the refill priority. May raise `state.level`
// when the current level (and below, via tricky) is exhausted but higher tiers have new words.
export function fillLearning(state, pool) {
  const idx = poolIndex(pool);
  const top = maxTier(pool);
  let guard = 0;
  while (learningCount(state) < state.setSize && guard++ < 5000) {
    const pick = pickRefill(state, idx);
    if (pick) {
      if (pick.kind === 'new') {
        const rec = ensureRecord(state, pick.entry.word, pick.entry);
        rec.category = CATEGORIES.LEARNING;
      } else {
        pick.rec.category = CATEGORIES.LEARNING;
        pick.rec.craftStreak = 0; // a fresh attempt run at the reintroduced word
      }
      continue;
    }
    // nothing at/below level → climb if higher tiers still have new words, else stop
    if (state.level < top && hasNewAbove(state, idx)) {
      state.level = clampLevel(state.level + 1, top);
      continue;
    }
    break;
  }
  bumpPeaks(state);
  return state;
}

// ---- the transitions ----
function pushRecent(state, correct) {
  state.recent.push(!!correct);
  if (state.recent.length > RECENT_MAX) state.recent.shift();
}

function demoteToLearning(state, rec) {
  rec.category = CATEGORIES.LEARNING;
  rec.craftStreak = 0;
  // a re-entering word may push learning over capacity → park the hardest OTHER word as tricky
  while (learningCount(state) > state.setSize) {
    if (!evictHardestToTricky(state, { exclude: rec.word })) break;
  }
}

// Record one CRAFT (production) result for `word`. CRAFT is the sole source of "known".
// opts: { pool } — when given, a freed/created slot is refilled so learning stays full.
// Returns a small result describing what changed.
export function recordCraft(state, word, correct, opts = {}) {
  const idx = poolIndex(opts.pool);
  const rec = ensureRecord(state, word, idx.get(word));
  rec.craftAttempts += 1;
  if (correct) rec.craftCorrect += 1;
  pushRecent(state, correct);

  const before = rec.category;
  let promoted = false;
  let demoted = false;

  if (rec.category === CATEGORIES.LEARNING || rec.category === CATEGORIES.TRICKY) {
    // a tricky word being crafted is effectively back in the working set; treat as learning
    rec.category = CATEGORIES.LEARNING;
    if (correct) {
      rec.craftStreak += 1;
      if (rec.craftStreak >= PROMOTE_STREAK) {
        rec.category = CATEGORIES.KNOWN; // learning → known frees a slot
        promoted = true;
      }
    } else {
      rec.craftStreak = 0;
    }
  } else {
    // known / mastered
    if (correct) {
      rec.craftStreak = PROMOTE_STREAK; // keep it pinned at the "proven" mark
    } else {
      demoteToLearning(state, rec); // a craft miss always sends it back to re-prove production
      demoted = true;
    }
  }

  if (opts.pool) fillLearning(state, opts.pool);
  bumpPeaks(state);
  return { word, from: before, to: rec.category, promoted, demoted };
}

// Record one MASTERY (draw) result. Draw mode serves KNOWN words; mastered is set ONLY here.
//   known + success → mastered ; known + miss → stays known ;
//   mastered + success → stays mastered ; mastered + miss → known.
// A draw on any other category is a no-op (draw mode never serves it).
export function recordDraw(state, word, correct) {
  const rec = state.words.get(word);
  if (!rec) return { word, to: CATEGORIES.NEW, noop: true };
  const before = rec.category;
  if (rec.category === CATEGORIES.KNOWN) {
    if (correct) rec.category = CATEGORIES.MASTERED;
  } else if (rec.category === CATEGORIES.MASTERED) {
    if (!correct) rec.category = CATEGORIES.KNOWN;
  } else {
    return { word, to: rec.category, noop: true };
  }
  bumpPeaks(state);
  return { word, from: before, to: rec.category, noop: false };
}

// ---- adaptive level primitives (the WHEN-to-move policy lives in the selection layer) ----
// Push DOWN a level: park the now-above-level (or, failing that, the single hardest) learning
// words as tricky, lower the level, and refill from the lower tier.
export function demoteLevel(state, pool) {
  const newLevel = Math.max(1, state.level - 1);
  const above = [...state.words.values()].filter((r) => r.category === CATEGORIES.LEARNING && r.tier > newLevel);
  if (above.length) above.forEach((r) => (r.category = CATEGORIES.TRICKY));
  else evictHardestToTricky(state);
  state.level = newLevel;
  state.recent = []; // a deliberate level move resets the run window
  if (pool) fillLearning(state, pool);
  return state;
}

// Push UP a level: newly-freed slots will draw from the higher tier (existing words stay).
export function promoteLevel(state, pool) {
  const top = pool ? maxTier(pool) : 9;
  state.level = clampLevel(state.level + 1, top);
  state.recent = [];
  if (pool) fillLearning(state, pool);
  return state;
}

// ---- display ----
// Each learning word with its 2-step progress toward known (kid-visible).
export function learningProgress(state) {
  return learningWords(state).map((w) => {
    const rec = state.words.get(w);
    return { word: w, steps: Math.min(rec.craftStreak, PROMOTE_STREAK), needed: PROMOTE_STREAK };
  });
}

// The transparent progress view. The SCREEN shows `learning`/`known`/`mastered`/`newRemaining`
// to the kid and gates `tricky` behind the grown-up settings (§30: no "hard" label to a child).
export function categorySummary(state, pool) {
  const idx = poolIndex(pool);
  let newRemaining = 0;
  for (const entry of idx.values()) if (!state.words.has(entry.word)) newRemaining += 1;
  return {
    learning: learningProgress(state),
    known: knownWords(state).length,
    mastered: masteredWords(state).length,
    tricky: trickyWords(state),
    newRemaining,
    unlocks: unlocks(state),
    level: state.level,
    setSize: state.setSize,
  };
}

// ---- persistence (Map → JSON-safe and back; lossless round-trip) ----
export function serializeCategoryState(state) {
  return {
    setSize: state.setSize,
    level: state.level,
    recent: [...state.recent],
    order: state.order,
    peakKnownish: state.peakKnownish || 0,
    peakMastered: state.peakMastered || 0,
    words: [...state.words.values()].map((r) => ({ ...r })),
  };
}

export function deserializeCategoryState(data) {
  const state = createCategoryState();
  if (!data || typeof data !== 'object') return state;
  state.setSize = Math.max(1, Math.round(data.setSize) || 10);
  state.level = Math.max(1, Math.round(data.level) || 1);
  state.recent = Array.isArray(data.recent) ? data.recent.map(Boolean) : [];
  state.order = Number.isFinite(data.order) ? data.order : 0;
  state.peakKnownish = Number.isFinite(data.peakKnownish) ? data.peakKnownish : 0;
  state.peakMastered = Number.isFinite(data.peakMastered) ? data.peakMastered : 0;
  for (const r of Array.isArray(data.words) ? data.words : []) {
    if (r && typeof r.word === 'string') state.words.set(r.word, { ...r });
  }
  return state;
}
