// src/engine/categories.js — PURE §30 word-category STATE MACHINE.
//
// §30 (Ian 2026-06-19d) layers DISCRETE categories on top of the continuous
// mastery score in progress.js (which still drives gems / speed / recency — this
// module owns "what state is each word in" and "what's in the working set").
//
// §C1 (Ian 2026-06-22): the working-set LEVEL is a 30-word BAND (a "cavern level",
// `floor(pos/30)+1` over the frequency list), NOT the age `tier`. Every word carries
// a `band` (from lexicon.byRank); selection/refill key off it. `tier` stays only as
// age metadata. The placement diagnostic (engine/placement.js) picks the starting band.
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
//   - refill priority when a learning slot frees: (1) a NEW unseen word in the current
//                level (a 30-word BAND / cavern level) → (2) an on-level-or-lower TRICKY
//                word (preferring one whose pattern the learner has since mastered — the
//                well-timed reintroduction) → (3) level UP and draw from the next band.
//                Tricky words resurface ONLY via (2)/(3), never on their own.
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

// Clean CRAFTS required to move learning → known. §36e (Ian 2026-06-22e): ONE clean construct
// moves a word into the mastery phase (was "twice in a row"). Kept as a named constant so the
// progress pips, the recommender and the placement seeding all read the same threshold.
export const PROMOTE_STREAK = 1;
// Bounded craft-outcome history kept for the adaptive-level policy (step 2 reads it).
const RECENT_MAX = 8;

const clampLevel = (n, max) => Math.min(max, Math.max(1, Math.round(n) || 1));

// §4 caps (Ian 2026-06-22d): words are recorded with the form the UI produces (LOWERCASE — the
// child spells lowercase; the capital of a proper noun is display-only). Proper nouns are stored
// CAPITALIZED in the data ("Williams"), so the category Map is keyed by the LOWERCASE word to keep
// a single identity: fillLearning (cased pool entry) and recordCraft (lowercased target) then hit
// the SAME record. `rec.word` keeps the cased pool form for display. recKey normalizes any lookup.
const recKey = (w) => String(w == null ? '' : w).toLowerCase();
export const getRecord = (state, word) => state.words.get(recKey(word));

// A fresh state machine. `order` is a monotonic counter for stable age tiebreaks.
export function createCategoryState({ setSize = 10, level = 1 } = {}) {
  return {
    setSize: Math.max(1, Math.round(setSize) || 10),
    level: Math.max(1, Math.round(level) || 1),
    words: new Map(), // word -> record (see ensureRecord); UNSEEN words are simply absent
    recent: [], // recent craft outcomes (booleans), newest last — for adaptive level
    order: 0, // bumps on every record creation
    seen: 0, // §36e: monotonic "recency clock" — bumped on every craft/draw → record.lastSeen
    reviewPending: { craft: 0, mastery: 0 }, // §36e: review words to fold into the NEXT set, per mode
    peakKnownish: 0, // high-water of (#known + #mastered) — gates the mastery unlock
    peakMastered: 0, // high-water of #mastered — gates the mining unlock
    peakLevel: Math.max(1, Math.round(level) || 1), // §36 D4: deepest cavern level reached (map frontier)
  };
}

// ---- pool helpers (pool entries = dataset rows {word,tier,pattern,rank,pos,band}) ----
// NOTE (§C1): `level` is a 30-word BAND (cavern level), and `band` is the level bucket
// — NOT the age `tier`. `tier` stays as word metadata (difficulty priors, printables);
// every selection/level decision below keys off `band` (attached by lexicon.byRank).
function poolIndex(pool) {
  const m = new Map();
  // §4 caps: key by lowercase so a lowercased target ("williams") finds the cased entry ("Williams").
  for (const w of pool || []) if (w && typeof w.word === 'string' && !m.has(recKey(w.word))) m.set(recKey(w.word), w);
  return m;
}
function maxBand(pool) {
  let mx = 1;
  for (const w of pool || []) if (Number.isFinite(w.band) && w.band > mx) mx = w.band;
  return mx;
}

// Create (or return) the record for `word`, seeding tier/pattern from the pool.
function ensureRecord(state, word, poolEntry) {
  const k = recKey(word);
  let rec = state.words.get(k);
  if (!rec) {
    rec = {
      // §4 caps: store the cased pool form ("Williams") for display; the Map key (k) is lowercase.
      word: poolEntry && typeof poolEntry.word === 'string' ? poolEntry.word : word,
      tier: poolEntry && Number.isFinite(poolEntry.tier) ? poolEntry.tier : 0, // age metadata only
      band: poolEntry && Number.isFinite(poolEntry.band) ? poolEntry.band : state.level, // the level bucket
      pattern: (poolEntry && poolEntry.pattern) || '',
      rank: poolEntry && Number.isFinite(poolEntry.rank) ? poolEntry.rank : Infinity,
      category: CATEGORIES.LEARNING,
      craftStreak: 0,
      craftAttempts: 0,
      craftCorrect: 0,
      order: ++state.order,
      lastSeen: 0, // §36e: set on each craft/draw; drives oldest-first review selection
    };
    state.words.set(k, rec);
  }
  return rec;
}

// ---- category queries ----
export function getCat(state, word) {
  const rec = getRecord(state, word);
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
// "Harder" first: lowest accuracy, then higher band (deeper), then more struggle, then oldest.
function harder(a, b) {
  return accuracy(a) - accuracy(b) || b.band - a.band || b.craftAttempts - a.craftAttempts || a.order - b.order;
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
  // §36 D4: high-water of the cavern LEVEL (band) reached — the cavern map's FRONTIER. Lets a child
  // drop back to an easier level (tap on the map) without the deeper ones they'd reached becoming
  // "locked" again: levels up to peakLevel stay reachable, only beyond it is locked.
  state.peakLevel = Math.max(state.peakLevel || 1, state.level || 1);
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

// Pick ONE refill candidate at/below the current level (band), or null if none exists there.
//   priority: (1) lowest-rank NEW word in band === level
//             (2) an on-level-or-lower TRICKY word (pattern-mastered first, then closest band)
function pickRefill(state, idx) {
  // (1) new unseen in the current band
  let bestNew = null;
  for (const entry of idx.values()) {
    if (entry.band !== state.level || state.words.has(recKey(entry.word))) continue;
    if (!bestNew || (entry.rank ?? Infinity) < (bestNew.rank ?? Infinity)) bestNew = entry;
  }
  if (bestNew) return { kind: 'new', entry: bestNew };

  // (2) tricky at/below the level — prefer pattern-mastered, then highest band (closest), then rank
  const tricky = [...state.words.values()].filter((r) => r.category === CATEGORIES.TRICKY && r.band <= state.level);
  if (tricky.length) {
    tricky.sort((a, b) => {
      const pm = (patternMastered(state, b.pattern) ? 1 : 0) - (patternMastered(state, a.pattern) ? 1 : 0);
      return pm || b.band - a.band || (a.rank ?? Infinity) - (b.rank ?? Infinity) || a.order - b.order;
    });
    return { kind: 'tricky', rec: tricky[0] };
  }
  return null;
}

// Top the learning set up to `setSize` from the CURRENT band only (new words first, then an
// on-band/lower tricky reintroduction). §36 stay-in-level (Ian 2026-06-22d): it NEVER climbs to a
// deeper band — when the current band's new/tricky words are exhausted the set simply sits UNDER
// setSize until the band is mastered. The level only advances via advanceLevelIfCleared (mastery-
// gated) or a manual Settings / cavern-map re-aim. The child masters the band's known words in draw
// mode; once all are mastered the band clears and the level moves on.
export function fillLearning(state, pool) {
  const idx = poolIndex(pool);
  let guard = 0;
  while (learningCount(state) < state.setSize && guard++ < 5000) {
    const pick = pickRefill(state, idx);
    if (!pick) break; // nothing new/tricky in the current band → stop (do NOT climb out of the band)
    if (pick.kind === 'new') {
      const rec = ensureRecord(state, pick.entry.word, pick.entry);
      rec.category = CATEGORIES.LEARNING;
    } else {
      pick.rec.category = CATEGORIES.LEARNING;
      pick.rec.craftStreak = 0; // a fresh attempt run at the reintroduced word
    }
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
  const rec = ensureRecord(state, word, idx.get(recKey(word)));
  rec.craftAttempts += 1;
  if (correct) rec.craftCorrect += 1;
  rec.lastSeen = ++state.seen; // §36e: this word is now the most-recently-seen
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
// §36e (Ian 2026-06-22e — the ONE-correct phase model):
//   known + success    → mastered
//   mastered + success → stays mastered (a clean review pass)
//   known OR mastered + MISS → "breaks" the word back to LEARNING (a cracked crystal): it must
//                              pass BOTH phases again (construct, then mastery). NOT a one-rung drop.
// A draw on any other category is a no-op (draw mode never serves it).
export function recordDraw(state, word, correct) {
  const rec = getRecord(state, word);
  if (!rec) return { word, to: CATEGORIES.NEW, noop: true };
  if (rec.category !== CATEGORIES.KNOWN && rec.category !== CATEGORIES.MASTERED) {
    return { word, to: rec.category, noop: true };
  }
  const before = rec.category;
  rec.lastSeen = ++state.seen; // §36e: drawing a word makes it the most-recently-seen
  if (correct) {
    if (rec.category === CATEGORIES.KNOWN) rec.category = CATEGORIES.MASTERED; // the one path to mastered
    // mastered + correct → stays mastered (review confirmed)
  } else {
    demoteToLearning(state, rec); // §36e: a missed draw BREAKS it → learning/cracked, redo both phases
  }
  bumpPeaks(state);
  return { word, from: before, to: rec.category, noop: false };
}

// ---- §36e retention review (Ian 2026-06-22e) ----
// PER MODE, when a completed set (a "run") scores BELOW 60%, fold previously-MASTERED words back
// into the NEXT set for review (oldest-last-seen first) so mastery doesn't decay while the explorer
// pushes deeper. The count scales with how far below the line the run fell:
//   pending = max(0, ceil(0.6*total) - correct)   →  6-word set: 3/6→1, 2/6→2, 1/6→3, 0/6→4
// Only CONSTRUCT (craft) and MASTERY (draw) answers count toward a run — mining never changes a
// word's status, so it never drives review. The pending count is OVERWRITTEN at the end of every
// set (a good set sets it back to 0), so review only ever rides one set forward at a time.
export function recordSetResult(state, mode, correct, total) {
  if (!state.reviewPending) state.reviewPending = { craft: 0, mastery: 0 };
  const t = Math.max(0, Math.round(total) || 0);
  const c = Math.max(0, Math.round(correct) || 0);
  const need = Math.ceil(0.6 * t); // the minimum correct to be AT 60% (ceil(0.6*6)=4, ceil(0.6*5)=3)
  const n = t > 0 && c < need ? need - c : 0;
  state.reviewPending[mode] = n;
  return n;
}
export function pendingReview(state, mode) {
  return (state.reviewPending && state.reviewPending[mode]) || 0;
}
// The mastered words to resurface for `mode` right now: the `pendingReview` OLDEST-last-seen ones
// (the ones not practised for the longest time). Pure read; selection folds them into the pool.
export function reviewWords(state, mode) {
  const n = pendingReview(state, mode);
  if (n <= 0) return [];
  return [...state.words.values()]
    .filter((r) => r.category === CATEGORIES.MASTERED)
    .sort((a, b) => (a.lastSeen || 0) - (b.lastSeen || 0) || a.order - b.order)
    .slice(0, n)
    .map((r) => r.word);
}

// ---- adaptive level primitives (the WHEN-to-move policy lives in the selection layer) ----
// Push DOWN a level: park the now-above-level (or, failing that, the single hardest) learning
// words as tricky, lower the level (band), and refill from the lower band.
export function demoteLevel(state, pool) {
  const newLevel = Math.max(1, state.level - 1);
  const above = [...state.words.values()].filter((r) => r.category === CATEGORIES.LEARNING && r.band > newLevel);
  if (above.length) above.forEach((r) => (r.category = CATEGORIES.TRICKY));
  else evictHardestToTricky(state);
  state.level = newLevel;
  state.recent = []; // a deliberate level move resets the run window
  if (pool) fillLearning(state, pool);
  return state;
}

// Manually re-aim the working set at a NEW level (a grown-up picks a Starting Level in
// Settings). The current learning words are set aside as TRICKY (they can resurface later) and
// the set is refilled with fresh words at the new level — so changing the level IMMEDIATELY
// changes the words served (bug fix 2026-06-19f: the old picker left the learning set stale).
export function setLevelAndRefill(state, level, pool) {
  state.level = clampLevel(level, pool ? maxBand(pool) : 9999);
  for (const r of state.words.values()) if (r.category === CATEGORIES.LEARNING) r.category = CATEGORIES.TRICKY;
  state.recent = [];
  if (pool) fillLearning(state, pool);
  return state;
}

// §37 D (Ian 2026-06-22f): prepare for a placement RE-TEST. A SOFT reset — reset the cavern level to
// 1 and RE-LOCK mastery/mining by zeroing the never-regressing unlock high-water peaks, so the
// re-diagnosis starts clean — but KEEP all word progress (known/mastered/tricky records are left
// untouched; the diagnostic's seedFromPlacement re-aims them on completion, and bumpPeaks then
// re-raises the unlock peaks from the kept progress). The caller also flips state.placement.done off
// so the next Craft re-runs the diagnostic walk. Pure; no pool needed (no refill — the walk drives words).
export function resetForRetest(state) {
  state.level = 1;
  state.peakLevel = 1;
  state.peakKnownish = 0; // re-lock mastery for the duration of the re-diagnosis
  state.peakMastered = 0; // re-lock mining likewise
  state.recent = [];
  state.reviewPending = { craft: 0, mastery: 0 };
  return state;
}

// §C1: seed the working set from a placement diagnostic. Aims the level at the entered
// band (parking any prior learning as tricky), then banks every diagnostic answer onto
// its word so the child "starts with progress" (Ian): a CORRECT word below the entered
// band is treated as tested-out (→ KNOWN); a CORRECT word at/above the band shows one
// craft pip (LEARNING); a MISS at/above the band is live LEARNING; a MISS below the band
// becomes TRICKY (resurfaces later). Finally tops the learning set up to setSize.
export function seedFromPlacement(state, responses, enteredBand, pool) {
  state.level = clampLevel(enteredBand, pool ? maxBand(pool) : 9999);
  for (const r of state.words.values()) if (r.category === CATEGORIES.LEARNING) r.category = CATEGORIES.TRICKY;
  state.recent = [];
  const idx = poolIndex(pool);
  for (const resp of Array.isArray(responses) ? responses : []) {
    if (!resp || typeof resp.word !== 'string') continue;
    const entry = idx.get(recKey(resp.word));
    const band = entry && Number.isFinite(entry.band) ? entry.band : state.level;
    // BELOW the placed level → the diagnostic only tested OUT of these; the high level already
    // means they're not served. We do NOT mark them known/mastered — the child crafted each once,
    // not proven (Ian 2026-06-22b: "I never repeated one, so I can't have mastered them"). Skip.
    if (band < state.level) continue;
    // AT/ABOVE the placed level → live learning with PARTIAL progress (one craft = 1 pip toward
    // known, not known): a clean diagnostic build counts as the first of the two needed for known.
    const rec = ensureRecord(state, resp.word, entry);
    rec.craftAttempts += 1;
    if (resp.correct) rec.craftCorrect += 1;
    rec.category = CATEGORIES.LEARNING;
    rec.craftStreak = resp.correct ? 1 : 0;
  }
  if (pool) fillLearning(state, pool);
  bumpPeaks(state);
  return state;
}

// Push UP a level: newly-freed slots will draw from the next band (existing words stay).
export function promoteLevel(state, pool) {
  const top = pool ? maxBand(pool) : 9999;
  state.level = clampLevel(state.level + 1, top);
  state.recent = [];
  if (pool) fillLearning(state, pool);
  return state;
}

// §36 stay-in-level (Ian 2026-06-22d): is EVERY word in `band` mastered? This is the bar to advance
// the cavern level — the explorer stays in a band (fillLearning never auto-climbs) until all its
// words are drawn from memory. An empty band (no words in the pool) returns false (nothing to clear).
// Pure; one pass over the pool.
export function bandMastered(state, pool, band = state.level) {
  let any = false;
  for (const w of pool || []) {
    if (!w || w.band !== band) continue;
    any = true;
    const rec = getRecord(state, w.word);
    if (!rec || rec.category !== CATEGORIES.MASTERED) return false;
  }
  return any;
}

// §36 stay-in-level: advance to the next cavern level ONLY when the current band is fully MASTERED.
// Climbs past any deeper bands that happen to be mastered already (e.g. one visited earlier via the
// cavern-map go-back). Never DROPS — the adaptive down-mover was removed; a manual Settings / map
// re-aim is the only way back to an easier level. Returns true iff the level moved. Call this after a
// mastery (draw) success — recordDraw is the only place a word becomes MASTERED.
export function advanceLevelIfCleared(state, pool) {
  const top = pool ? maxBand(pool) : 9999;
  if (state.level >= top) return false;
  if (!bandMastered(state, pool, state.level)) return false;
  do {
    promoteLevel(state, pool); // +1 level, reset the run window, refill from the new band
  } while (state.level < top && bandMastered(state, pool, state.level));
  bumpPeaks(state); // raise the cavern-map frontier (peakLevel) to the newly-reached level
  return true;
}

// ---- repair (§36 C3) ----
// "Needs repair" = a LEARNING word the child got RIGHT before but has since MISSED — i.e. it
// has at least one correct craft yet is back at a zero streak (a known/mastered word demoted by
// a craft miss, or a learning word that regressed). These are the "cracked crystals". Driven
// from the SAME records the green craft-streak pips use, so the Repair count, the pips and the
// yellow light always reconcile (replacing the legacy continuous tracker's lapsedWords, which
// didn't match — Ian's confusion). A never-yet-correct learning word is NOT repair (it's just
// new learning, not a regression).
export function needsRepair(rec) {
  return !!rec && rec.category === CATEGORIES.LEARNING && rec.craftStreak === 0 && rec.craftCorrect > 0;
}
export function repairWords(state) {
  return [...state.words.values()].filter(needsRepair).sort((a, b) => a.order - b.order).map((r) => r.word);
}

// ---- display ----
// Each learning word with its 2-step progress toward known (kid-visible) + a needsRepair flag
// (a yellow light: a word it got right before but has since missed).
export function learningProgress(state) {
  return learningWords(state).map((w) => {
    const rec = getRecord(state, w);
    return {
      word: w,
      steps: Math.min(rec.craftStreak, PROMOTE_STREAK),
      needed: PROMOTE_STREAK,
      needsRepair: needsRepair(rec),
    };
  });
}

// The transparent progress view. The SCREEN shows `learning`/`known`/`mastered`/`newRemaining`
// to the kid and gates `tricky` behind the grown-up settings (§30: no "hard" label to a child).
export function categorySummary(state, pool) {
  const idx = poolIndex(pool);
  let newRemaining = 0;
  // §36 stay-in-level (Ian 2026-06-22d): "words to the next LEVEL" = words in the CURRENT cavern level
  // (band === state.level) not yet MASTERED. The bar to advance a cavern level is "all mastered", so
  // this reaches 0 exactly when the band clears and the level moves on. A known-but-unmastered word
  // still counts (it has to be drawn from memory first) — only a MASTERED band word drops off.
  let toNextLevel = 0;
  for (const entry of idx.values()) {
    if (!state.words.has(recKey(entry.word))) newRemaining += 1;
    if (entry.band === state.level) {
      const rec = getRecord(state, entry.word);
      if (!(rec && rec.category === CATEGORIES.MASTERED)) toNextLevel += 1;
    }
  }
  return {
    learning: learningProgress(state),
    known: knownWords(state).length,
    mastered: masteredWords(state).length,
    tricky: trickyWords(state),
    repair: repairWords(state), // §36 C3: cracked words to fix (matches the pips/yellow light)
    newRemaining,
    toNextLevel,
    unlocks: unlocks(state),
    level: state.level,
    setSize: state.setSize,
  };
}

// §36 D4 (Ian 2026-06-22d): the cavern MAP model. Every 30-word BAND is a cavern LEVEL; this returns
// one descriptor per level (1..maxBand) with a status for the scrollable map:
//   current  — band === state.level ("you are here")
//   locked   — band > the FRONTIER (peakLevel, the deepest level ever reached) — not yet reached
//   cleared  — within the frontier, not current, every word in it is MASTERED (done)
//   reached  — within the frontier, not current, some words engaged but not all mastered
//   skipped  — within the frontier, not current, NO word engaged (a placement jump leapt over it,
//              or a level passed without mastering it → go back & master). The "hide-skipped" cue.
// Using peakLevel (not just level) as the locked boundary lets a child DROP back to an easier level
// without the deeper ones they already reached re-locking — the whole reached range stays navigable.
// §36 stay-in-level (Ian 2026-06-22d): "cleared" (⭐) requires every word MASTERED — the same bar the
// game uses to advance the cavern level (advanceLevelIfCleared) — so the map can't show ⭐ on a band
// the game still serves. `total`/`done` are the band's word count and MASTERED count (per-level bar).
// Pure; iterates the pool once + a record lookup per word. Empty bands (total 0) never occur in the
// real (contiguous) dataset but stay safe.
export function cavernLevels(state, pool) {
  const top = maxBand(pool);
  const total = new Array(top + 1).fill(0);
  const done = new Array(top + 1).fill(0);
  const engaged = new Array(top + 1).fill(false);
  for (const w of pool || []) {
    const b = w && Number.isFinite(w.band) ? w.band : 1;
    if (b < 1 || b > top) continue;
    total[b] += 1;
    const rec = getRecord(state, w.word);
    if (rec) {
      engaged[b] = true;
      if (rec.category === CATEGORIES.MASTERED) done[b] += 1; // §36: a band clears only when fully MASTERED
    }
  }
  const level = state.level;
  const frontier = Math.max(level, state.peakLevel || level);
  const out = [];
  for (let b = 1; b <= top; b += 1) {
    let status;
    if (b === level) status = 'current';
    else if (b > frontier) status = 'locked';
    else if (total[b] > 0 && done[b] >= total[b]) status = 'cleared';
    else if (engaged[b]) status = 'reached';
    else status = 'skipped';
    out.push({ band: b, status, total: total[b], done: done[b] });
  }
  return out;
}

// ---- persistence (Map → JSON-safe and back; lossless round-trip) ----
export function serializeCategoryState(state) {
  return {
    setSize: state.setSize,
    level: state.level,
    recent: [...state.recent],
    order: state.order,
    seen: state.seen || 0, // §36e recency clock
    reviewPending: { craft: 0, mastery: 0, ...(state.reviewPending || {}) }, // §36e per-mode review queue
    peakKnownish: state.peakKnownish || 0,
    peakMastered: state.peakMastered || 0,
    peakLevel: state.peakLevel || state.level || 1,
    words: [...state.words.values()].map((r) => ({ ...r })),
  };
}

export function deserializeCategoryState(data) {
  const state = createCategoryState();
  if (!data || typeof data !== 'object') return state;
  state.setSize = Math.max(1, Math.round(data.setSize) || 10);
  state.recent = Array.isArray(data.recent) ? data.recent.map(Boolean) : [];
  state.order = Number.isFinite(data.order) ? data.order : 0;
  state.seen = Number.isFinite(data.seen) ? data.seen : 0; // §36e recency clock
  state.reviewPending = data.reviewPending && typeof data.reviewPending === 'object'
    ? { craft: Number(data.reviewPending.craft) || 0, mastery: Number(data.reviewPending.mastery) || 0 }
    : { craft: 0, mastery: 0 };
  state.peakKnownish = Number.isFinite(data.peakKnownish) ? data.peakKnownish : 0;
  state.peakMastered = Number.isFinite(data.peakMastered) ? data.peakMastered : 0;
  state.peakLevel = Number.isFinite(data.peakLevel) ? data.peakLevel : 0; // §36 D4; re-anchored below

  // §C1 migration: pre-band profiles stored each record with an age `tier` but no
  // `band`, and `level` as an age-tier (1–9). Derive each record's band from its
  // saved `rank` (band = the 30-word group it lives in), then — for legacy state —
  // re-anchor `level` to the DEEPEST band the child is currently LEARNING so the new
  // band-based refill continues from their actual frontier (never loses progress).
  let legacy = false;
  for (const r of Array.isArray(data.words) ? data.words : []) {
    if (!r || typeof r.word !== 'string') continue;
    const rec = { ...r };
    if (!Number.isFinite(rec.band)) {
      legacy = true;
      rec.band = Number.isFinite(rec.rank)
        ? Math.floor((rec.rank - 1) / 30) + 1
        : Number.isFinite(rec.tier) && rec.tier > 0
          ? rec.tier
          : 1;
    }
    state.words.set(recKey(rec.word), rec); // §4 caps: lowercase key (merges any v56 case-split dupes)
  }
  if (legacy) {
    let lv = 1;
    for (const r of state.words.values()) if (r.category === CATEGORIES.LEARNING && r.band > lv) lv = r.band;
    state.level = lv;
  } else {
    state.level = Math.max(1, Math.round(data.level) || 1);
  }
  // §36 D4: the map frontier is at least the current level (saves predating peakLevel, or any drift).
  state.peakLevel = Math.max(state.peakLevel || 1, state.level);
  return state;
}
