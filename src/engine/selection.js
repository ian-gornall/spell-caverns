// src/engine/selection.js — PURE §30 category-driven selection + adaptive level.
//
// Turns the categories.js state machine into concrete, ordered per-mode word lists
// (full dataset entries, so the modes get .sentence/.syllables/etc.), and decides the
// MEDIUM-cadence adaptive level off a short run of craft results. progress.js still
// owns gems/speed/recency; this module owns WHICH words each mode serves.
//
//   - CRAFT   (productive-struggle hub): FOCUS the learning set, balanced with a little
//             KNOWN (review) + TRICKY (repair). Any word may appear; learning leads.
//   - MINING  (recognition): KNOWN-or-better only (known ∪ mastered) — never learning/new.
//   - MASTERY (draw test):   KNOWN words lead (the ones still to master); mastered may follow.
//
// Imports nothing browser-specific so it runs under `node --test`.
import { shuffle } from './distractors.js';
import {
  CATEGORIES,
  learningWords,
  knownWords,
  masteredWords,
  trickyWords,
  demoteLevel,
  promoteLevel,
} from './categories.js';

// Adaptive level (MEDIUM aggressiveness — Ian): read the last ADAPT_WINDOW craft results.
//   ≤ ADAPT_DOWN_MAX correct → push DOWN (clearly weak) ; all correct → push UP (clearly strong).
// Not hair-trigger (window > 1), not glacial (window small). The window resets on every move.
export const ADAPT_WINDOW = 4;
export const ADAPT_DOWN_MAX = 1; // ≤ this many correct in the window ⇒ weak ⇒ down

const entriesFor = (pool, words) => {
  const idx = new Map((pool || []).map((w) => [w.word, w]));
  return words.map((w) => idx.get(w)).filter(Boolean);
};

// CRAFT: focus the learning set, reserving up to ~25% of the session for interleaved
// review (tricky repair first, then known, then mastered). Returns up to `length` entries,
// de-duplicated and shuffled (craft is recall — interleaving aids transfer). The caller keeps
// the learning set full (categories.fillLearning) so it is never starved.
export function buildCraftPool(state, pool, opts = {}) {
  const { length = 10, rng = Math.random } = opts;
  const learn = entriesFor(pool, learningWords(state));
  const review = [
    ...entriesFor(pool, trickyWords(state)), // repair first
    ...entriesFor(pool, knownWords(state)), // then light review
    ...entriesFor(pool, masteredWords(state)), // then over-learned confirmation
  ];
  const reviewSlots = Math.min(review.length, Math.floor(length * 0.25));
  const learnSlots = Math.max(0, length - reviewSlots);

  const picked = [];
  const seen = new Set();
  const add = (w) => {
    if (w && !seen.has(w.word) && picked.length < length) {
      picked.push(w);
      seen.add(w.word);
    }
  };
  shuffle(learn, rng).slice(0, learnSlots).forEach(add);
  review.slice(0, reviewSlots).forEach(add); // review is already priority-ordered
  // top up if either pool was thin: more learning, then any remaining review.
  shuffle(learn, rng).forEach(add);
  review.forEach(add);
  return shuffle(picked, rng).slice(0, length);
}

// MINING: recognition practice on words the learner can already produce — KNOWN ∪ MASTERED
// only (a mastered word "may appear in all modes again"). Most-recently-proven last for variety.
export function buildMiningPool(state, pool, opts = {}) {
  const { length = 10, rng = Math.random } = opts;
  const words = [...knownWords(state), ...masteredWords(state)];
  return shuffle(entriesFor(pool, words), rng).slice(0, length);
}

// MASTERY (draw): lead with KNOWN-but-not-yet-mastered words (the actual goal); top up with
// mastered words for spaced re-confirmation (a draw miss on a mastered word demotes it to known).
export function buildMasteryPool(state, pool, opts = {}) {
  const { length = 10, rng = Math.random } = opts;
  const lead = shuffle(entriesFor(pool, knownWords(state)), rng);
  const tail = shuffle(entriesFor(pool, masteredWords(state)), rng);
  return [...lead, ...tail].slice(0, length);
}

// Decide whether the adaptive level should move, from the recent craft-result window.
// Pure — does NOT mutate. Returns 'up' | 'down' | null.
export function adaptiveLevelDecision(state) {
  const recent = Array.isArray(state.recent) ? state.recent : [];
  if (recent.length < ADAPT_WINDOW) return null; // not enough data for a confident move
  const window = recent.slice(-ADAPT_WINDOW);
  const correct = window.filter(Boolean).length;
  if (correct <= ADAPT_DOWN_MAX) return 'down';
  if (correct === ADAPT_WINDOW) return 'up';
  return null;
}

// Apply the adaptive decision: demote/promote the level (which parks/draws words and resets
// the run window inside categories.js). Returns the direction moved, or null.
export function applyAdaptiveLevel(state, pool) {
  const dir = adaptiveLevelDecision(state);
  if (dir === 'down') demoteLevel(state, pool);
  else if (dir === 'up') promoteLevel(state, pool);
  return dir;
}
