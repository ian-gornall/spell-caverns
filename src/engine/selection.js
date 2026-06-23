// src/engine/selection.js — PURE §30 category-driven selection.
//
// Turns the categories.js state machine into concrete, ordered per-mode word lists
// (full dataset entries, so the modes get .sentence/.syllables/etc.). progress.js still
// owns gems/speed/recency; this module owns WHICH words each mode serves. (§36: the old
// adaptive level mover lived here and was removed — see the note where it used to be.)
//
//   - CRAFT   (productive-struggle hub): FOCUS the learning set + TRICKY (cracked-overflow repair),
//             plus §36e mastered REVIEW words queued by a sub-60% run. Learning leads.
//   - MINING  (recognition): MASTERED only (Ian 2026-06-22e: mining is gated to mastered).
//   - MASTERY (draw test):   KNOWN words lead (the ones still to master); queued review may follow.
//
// Imports nothing browser-specific so it runs under `node --test`.
import { shuffle } from './distractors.js';
import {
  CATEGORIES,
  PROMOTE_STREAK,
  learningWords,
  knownWords,
  masteredWords,
  trickyWords,
  repairWords,
  reviewWords,
  unlocks,
  getRecord,
} from './categories.js';

const entriesFor = (pool, words) => {
  // §4 caps: case-insensitive so a record word (cased "Williams" or lowercased "williams") always
  // resolves to its pool entry — proper nouns flow through craft/mining/mastery selection unchanged.
  const idx = new Map((pool || []).map((w) => [String(w.word).toLowerCase(), w]));
  return words.map((w) => idx.get(String(w).toLowerCase())).filter(Boolean);
};

// CRAFT: focus the learning set. §36e (Ian 2026-06-22e): the §5 retention REVIEW words (mastered
// words resurfaced after a sub-60% run) are GUARANTEED a place in the next set (they're the whole
// point of the review), then learning fills the bulk, then any TRICKY (cracked-overflow) repair.
// KNOWN words are NOT auto-served here anymore — they belong to the mastery (draw) phase. Returns up
// to `length` de-duplicated, shuffled entries (craft is recall — interleaving aids transfer); the
// caller keeps the learning set full (categories.fillLearning) so it is never starved.
export function buildCraftPool(state, pool, opts = {}) {
  const { length = 10, rng = Math.random } = opts;
  const review = entriesFor(pool, reviewWords(state, 'craft')); // §36e: resurfaced mastered words
  const learn = entriesFor(pool, learningWords(state));
  const tricky = entriesFor(pool, trickyWords(state)); // cracked words evicted on overflow

  const picked = [];
  const seen = new Set();
  const add = (w) => {
    if (w && !seen.has(w.word) && picked.length < length) {
      picked.push(w);
      seen.add(w.word);
    }
  };
  shuffle(review, rng).forEach(add); // §36e: the resurfaced mastered words come back FIRST (guaranteed)
  shuffle(learn, rng).forEach(add); // then the learning set (the bulk of a normal run)
  shuffle(tricky, rng).forEach(add); // then any cracked-overflow repair if room remains
  return shuffle(picked, rng).slice(0, length);
}

// REPAIR (§36 C3): a focused CRAFT drill of exactly the "cracked" words — the learning words
// the child got right before but has since missed (categories.repairWords) — so tapping the
// Repair card drills the same words the yellow lights mark. Pads with other learning words if
// fewer than `length`, so the drill is never frustratingly tiny. Shuffled (craft = recall).
export function buildRepairSession(state, pool, opts = {}) {
  const { length = 6, rng = Math.random } = opts;
  const repair = entriesFor(pool, repairWords(state));
  const picked = [];
  const seen = new Set();
  const add = (w) => {
    if (w && !seen.has(w.word) && picked.length < length) {
      picked.push(w);
      seen.add(w.word);
    }
  };
  shuffle(repair, rng).forEach(add); // the cracked words LEAD (focus the drill on what broke)
  shuffle(entriesFor(pool, learningWords(state)), rng).forEach(add); // pad if thin
  return picked.slice(0, length); // keep cracked-first order (no final reshuffle)
}

// MINING: recognition practice on words the learner has fully proven — MASTERED only (Ian
// 2026-06-22e: mining is gated to mastered, not merely known). Shuffled for variety.
export function buildMiningPool(state, pool, opts = {}) {
  const { length = 10, rng = Math.random } = opts;
  return shuffle(entriesFor(pool, masteredWords(state)), rng).slice(0, length);
}

// MASTERY (draw): lead with KNOWN-but-not-yet-mastered words (the actual goal); §36e appends only
// the QUEUED review words (oldest mastered, resurfaced after a sub-60% mastery run) — NOT every
// mastered word — so mastery focuses on the goal plus a controlled review dose. A draw miss on a
// resurfaced word BREAKS it back to learning (categories.recordDraw).
export function buildMasteryPool(state, pool, opts = {}) {
  const { length = 10, rng = Math.random } = opts;
  const lead = shuffle(entriesFor(pool, knownWords(state)), rng);
  const review = shuffle(entriesFor(pool, reviewWords(state, 'mastery')), rng);
  return [...lead, ...review].slice(0, length);
}

// §36 stay-in-level (Ian 2026-06-22d): the MEDIUM-cadence adaptive level mover (it pushed the level
// up/down off a short run of craft results) was REMOVED — it was the cause of the level "jumping
// around" before a band was learned. The cavern level now advances ONLY by MASTERING the current
// band (categories.advanceLevelIfCleared, called from the mastery draw mode) and only moves back via
// a manual Settings / cavern-map re-aim (categories.setLevelAndRefill). categories.demoteLevel /
// promoteLevel remain as the level primitives (promoteLevel powers advanceLevelIfCleared).

// §31.D — "what should this student do next?" The pedagogical loop Ian wants is a CYCLE:
//   Craft (new→learning→known) → Mastery (known→mastered) → cycle missed/mastered back to Craft.
// We lean MASTERY-FIRST once it is unlocked and there is a backlog of known-but-unmastered
// words (§31.C: actively drive KNOWN→MASTERED instead of letting mastery sit ignored), and
// otherwise steer Craft to keep growing the known set (which feeds the next mastery round).
// Pure; never recommends a LOCKED mode. Returns { mode, reason, knownBacklog, masteredCount,
// learningActive } so the UI can decide both WHICH card to nudge and how hard.
export function recommendNext(state) {
  const u = unlocks(state);
  const knownBacklog = knownWords(state).length; // KNOWN, not yet mastered → the mastery target
  const masteredCount = masteredWords(state).length;
  // learning words not yet proven to known (streak < PROMOTE_STREAK) = the live craft work
  const learningActive = learningWords(state).filter((w) => {
    const rec = getRecord(state, w);
    return (rec ? rec.craftStreak : 0) < PROMOTE_STREAK;
  }).length;
  const signals = { knownBacklog, masteredCount, learningActive };

  // 1) Mastery unlocked + a backlog of known-but-unmastered words → MASTER them (the headline nudge).
  if (u.mastery && knownBacklog > 0) return { mode: 'mastery', reason: 'master-known', ...signals };
  // 2) Words still to learn, or mastery not yet open → CRAFT them toward known.
  if (learningActive > 0 || !u.mastery) {
    return { mode: 'craft', reason: u.mastery ? 'learn-more' : 'unlock-mastery', ...signals };
  }
  // 3) Nothing left to learn or master right now → recognition practice if open, else keep crafting.
  if (u.mining) return { mode: 'mining', reason: 'practice-recognition', ...signals };
  return { mode: 'craft', reason: 'keep-going', ...signals };
}
