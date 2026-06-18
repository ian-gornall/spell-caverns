// src/engine/session.js — PURE two-axis session/level builder.
//
// Turns the learner's difficulty + length levers into a concrete, ordered list of
// words to play. Difficulty is TWO ORTHOGONAL axes (HANDOFF §4):
//   - patternSpread (0..1): how many spelling patterns the session mixes. Rising
//     spread pulls in CONFUSABLE families (for discrimination practice — the
//     research benefit) and shifts ordering blocked → interleaved.
//   - masteryTarget (0..1): the average "learning score" (predicted success) of
//     the words pulled in. High = review-heavy/easy; low = new-and-shaky/hard.
//
// easy/medium/hard are PRESETS = points in that 2-D space; an advanced config can
// pass a custom {patternSpread, masteryTarget} (the saveable custom levels). Harder
// difficulties UNLOCK with demonstrated mastery — the game never force-bumps;
// unlocking is the nudge (better than forcing per the user). All word selection is
// program-driven (the kid never picks words). Imports nothing browser-specific.
import { byRank } from './lexicon.js';
import { shuffle } from './distractors.js';
import { predictedSuccess, tierToPrior, getRecord, knownPeak } from './progress.js';

const MAX_PATTERNS = 5; // patternSpread 1.0 mixes up to this many families
const REVIEW_FRACTION = 0.3; // share of a session that opens as mixed review
const BAND = 0.25; // a word counts as "near target" within this predicted-success distance

const clamp01 = (x) => (!Number.isFinite(x) ? 0 : x < 0 ? 0 : x > 1 ? 1 : x);

// The two-axis presets behind the kid's easy/medium/hard buttons.
export const DIFFICULTY_PRESETS = {
  easy: { patternSpread: 0.0, masteryTarget: 0.85 }, // one family, review-heavy, confidence
  medium: { patternSpread: 0.5, masteryTarget: 0.65 }, // a few confusable families
  hard: { patternSpread: 1.0, masteryTarget: 0.5 }, // many families incl. confusable, struggle
};

// How many "known" words (the progress summary bucket) must exist before a
// difficulty unlocks. Tuned LOW so progression feels fast — the learner should
// see harder options open up within a wave or two (play-test feedback 2026-06-17).
// Easy is always available; unlocking is a nudge, never a force (HANDOFF §4).
export const UNLOCK_THRESHOLDS = { easy: 0, medium: 4, hard: 10 };

// Families that are easily confused — increasing patternSpread prefers mixing
// WITHIN a cluster so the learner must discriminate (the interleaving payoff),
// rather than mixing unrelated patterns. Grounded in the real pattern ids.
export const CONFUSABLE_CLUSTERS = [
  ['short-a', 'short-e', 'short-i', 'short-o', 'short-u'],
  ['sh', 'ch', 'th', 'wh', 'tch'],
  ['l-blend', 'r-blend', 's-blend', 'end-blend'],
  ['silent-e-a', 'ai-ay'], // long a
  ['ee-ea', 'y-long-e', 'ie-ei'], // long e
  ['silent-e-i', 'ight'], // long i
  ['silent-e-o', 'oa-ow-long'], // long o
  ['silent-e-u', 'oo'], // long u / oo
  ['r-ar', 'r-or', 'r-er-ir-ur', 'schwa-er-or-ar'], // r-controlled
  ['ou-ow-loud', 'oi-oy', 'aw-au-all', 'ough-augh'], // diphthongs
  ['tion', 'sion-cian', 'cious-tious'], // -tion family
  ['suffix-able-ible', 'suffix-ous', 'ant-ent-ance-ence', 'ary-ery-ory', 'ial-ical'], // confusable suffixes
  ['ending-ed-ing', 'suffix-er-est', 'double-cons', 'double-suffix'], // doubling/endings
  ['silent-letters', 'ph', 'greek-roots'],
];

function sharesCluster(a, b) {
  return CONFUSABLE_CLUSTERS.some((c) => c.includes(a) && c.includes(b));
}

// Resolve a difficulty (preset name OR custom axes object) to clamped axes.
export function resolveDifficulty(difficulty) {
  let axes;
  if (typeof difficulty === 'string') axes = DIFFICULTY_PRESETS[difficulty];
  else if (difficulty && typeof difficulty === 'object') axes = difficulty;
  if (!axes) axes = DIFFICULTY_PRESETS.easy;
  return {
    patternSpread: clamp01(axes.patternSpread ?? 0),
    masteryTarget: clamp01(axes.masteryTarget ?? 0.85),
  };
}

// Which built-in difficulties are unlocked, given demonstrated mastery. Gates on the
// monotonic high-water mark (knownPeak) so an unlock the learner earned never
// disappears when recency-weighted mastery later dips (QA I5: unlock, never regress).
export function unlockedDifficulties(tracker) {
  const peak = knownPeak(tracker);
  return ['easy', 'medium', 'hard'].filter((name) => peak >= UNLOCK_THRESHOLDS[name]);
}

export function isUnlocked(tracker, name) {
  return unlockedDifficulties(tracker).includes(name);
}

function patternCount(spread) {
  return 1 + Math.round(spread * (MAX_PATTERNS - 1));
}

// Pick `n` patterns: rank by how many near-target words each has (then closest
// single word). After the first, prefer patterns that are CONFUSABLE with one
// already chosen, so a wider spread means harder discrimination, not random mixing.
function choosePatterns(words, psFn, target, n) {
  const groups = new Map();
  for (const w of words) {
    if (!groups.has(w.pattern)) groups.set(w.pattern, []);
    groups.get(w.pattern).push(w);
  }
  const stats = [];
  for (const [pid, list] of groups) {
    let bandCount = 0;
    let best = Infinity;
    for (const w of list) {
      const d = Math.abs(psFn(w) - target);
      if (d <= BAND) bandCount += 1;
      if (d < best) best = d;
    }
    stats.push({ pid, bandCount, best });
  }
  stats.sort((a, b) => b.bandCount - a.bandCount || a.best - b.best || (a.pid < b.pid ? -1 : 1));

  const chosen = [];
  const remaining = stats.slice();
  while (chosen.length < n && remaining.length) {
    let idx = 0;
    if (chosen.length > 0) {
      // prefer a usable confusable cluster-mate of something already chosen
      const mate = remaining.findIndex(
        (s) => (s.bandCount > 0 || s.best <= BAND) && chosen.some((c) => sharesCluster(c, s.pid)),
      );
      if (mate !== -1) idx = mate;
    }
    chosen.push(remaining.splice(idx, 1)[0].pid);
  }
  return chosen;
}

// Select the session's words: an opening mixed-review of previously-seen words
// (most overdue first), then new/target-band words drawn ROUND-ROBIN across the
// chosen patterns (closest to the mastery target first).
function selectWords(tracker, words, chosenPatterns, psFn, target, length) {
  const chosen = new Set(chosenPatterns);
  const inPat = words.filter((w) => chosen.has(w.pattern));

  const seen = inPat
    .filter((w) => (getRecord(tracker, w.word)?.attempts ?? 0) > 0)
    .sort((a, b) => getRecord(tracker, a.word).lastSeen - getRecord(tracker, b.word).lastSeen);
  const reviewCount = Math.min(Math.round(length * REVIEW_FRACTION), seen.length);
  const reviewWords = seen.slice(0, reviewCount);
  const reviewSet = new Set(reviewWords.map((w) => w.word));

  const byPat = new Map();
  for (const p of chosenPatterns) {
    byPat.set(
      p,
      inPat
        .filter((w) => w.pattern === p && !reviewSet.has(w.word))
        .sort((a, b) => Math.abs(psFn(a) - target) - Math.abs(psFn(b) - target)),
    );
  }
  const need = length - reviewWords.length;
  const mainWords = [];
  let i = 0;
  let added = true;
  while (mainWords.length < need && added) {
    added = false;
    for (const p of chosenPatterns) {
      const list = byPat.get(p);
      if (i < list.length && mainWords.length < need) {
        mainWords.push(list[i]);
        added = true;
      }
    }
    i += 1;
  }
  return { reviewWords, mainWords };
}

// Order the main words: blocked (grouped by pattern) at low spread, interleaved
// (round-robin across patterns, so adjacent words differ) at higher spread.
function orderMain(words, spread, rng) {
  const groups = new Map();
  for (const w of words) {
    if (!groups.has(w.pattern)) groups.set(w.pattern, []);
    groups.get(w.pattern).push(w);
  }
  const lists = [...groups.values()].map((g) => shuffle(g, rng));
  if (spread < 0.34) return shuffle(lists, rng).flat(); // blocked

  const out = []; // interleaved (round-robin)
  let i = 0;
  let added = true;
  while (added) {
    added = false;
    for (const list of lists) {
      if (i < list.length) {
        out.push(list[i]);
        added = true;
      }
    }
    i += 1;
  }
  return out;
}

// buildSession(tracker, { difficulty, length, rng, words }) -> ordered word entries.
// `difficulty` is a preset name or a custom {patternSpread, masteryTarget}. `words`
// defaults to the full frequency-ordered lexicon.
export function buildSession(tracker, opts = {}) {
  const { difficulty = 'easy', length = 12, rng = Math.random, words = byRank() } = opts;
  const { patternSpread, masteryTarget } = resolveDifficulty(difficulty);
  const psFn = (w) => predictedSuccess(tracker, w.word, tierToPrior(w.tier));

  const chosenPatterns = choosePatterns(words, psFn, masteryTarget, patternCount(patternSpread));
  const { reviewWords, mainWords } = selectWords(
    tracker,
    words,
    chosenPatterns,
    psFn,
    masteryTarget,
    length,
  );
  // Mixed review opens the session (spacing); then the main words, ordered by spread.
  const ordered = [...shuffle(reviewWords, rng), ...orderMain(mainWords, patternSpread, rng)];
  return ordered.slice(0, length);
}
