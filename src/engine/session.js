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
import {
  predictedSuccess,
  tierToPrior,
  getRecord,
  knownPeak,
  lapsedWords,
  isEligible,
  serveOverdue,
  targetWords,
  TARGET_CAP,
} from './progress.js';

const MAX_PATTERNS = 5; // patternSpread 1.0 mixes up to this many families
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

// Expand a set of seed patterns to `n`, preferring CONFUSABLE cluster-mates (so a wider
// spread means harder discrimination, not random mixing), then any remaining pattern.
function expandPatterns(seed, words, n) {
  const allPats = [...new Set(words.map((w) => w.pattern))];
  const chosen = [];
  for (const p of seed) if (chosen.length < n && !chosen.includes(p)) chosen.push(p);
  while (chosen.length < n) {
    let next = allPats.find((p) => !chosen.includes(p) && chosen.some((c) => sharesCluster(c, p)));
    if (!next) next = allPats.find((p) => !chosen.includes(p));
    if (!next) break;
    chosen.push(next);
  }
  return chosen;
}

// Order never-seen candidates by an ANCHOR tier so new words come in PROGRESSIVELY from
// the learner's starting point upward (user 2026-06-18): words at/above the anchor first,
// lowest first; below-anchor (probably already easy for them) only as a last resort.
function orderNewByAnchor(list, anchor) {
  return list.slice().sort((a, b) => {
    const da = a.tier < anchor ? 1000 + (anchor - a.tier) : a.tier - anchor;
    const db = b.tier < anchor ? 1000 + (anchor - b.tier) : b.tier - anchor;
    return da - db || a.rank - b.rank;
  });
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

// How far above the chosen starting tier to reach when introducing new words. Lower
// masteryTarget (a "harder" preset) reaches further ahead; "easy" stays at the start.
const REACH = 3;

// buildFirstWave(words, { startTier, length, rng }) -> the guaranteed-win FIRST wave.
//
// The onboarding first wave must be a sure win (SDT competence — the very first
// experience), but it must ALSO reflect the level the grown-up just picked (§21-C bug:
// the old first wave hard-picked tier ≤2 words, so a high starting level looked ignored
// until a data reset). So we take the most FREQUENT (= easiest to recognise) short,
// spellable words AT/above the chosen tier, closest tier first. The caller still applies
// obviously-wrong distractors, so it stays a win at any level. Never starves: if the top
// tier is thin it tops up from easier words. Pure + deterministic given `rng`.
export function buildFirstWave(words = byRank(), opts = {}) {
  const { startTier = 1, length = 5, rng = Math.random } = opts;
  const start = Math.min(9, Math.max(1, Math.round(startTier)));
  const spellable = (w) => w.word.length >= 3 && w.word.length <= 8;
  let pool = words.filter((w) => w.tier >= start && spellable(w));
  if (pool.length < length) pool = words.filter(spellable); // fallback: never return a short wave
  if (pool.length < length) pool = words.slice(); // last resort
  // closest-to-start tier first, then most common (lowest rank) — the easiest at the level
  pool = pool.slice().sort((a, b) => a.tier - b.tier || a.rank - b.rank);
  // keep the wave within the EASIEST two tiers available at/above the level (so a high
  // level never shows baby words and a low level stays easy), shuffled for variety.
  const lowest = pool[0].tier;
  let band = pool.filter((w) => w.tier <= lowest + 1);
  if (band.length < length) band = pool; // widen if that band is thin
  return shuffle(band, rng).slice(0, length);
}

// buildSession(tracker, { difficulty, length, rng, words, startTier }) -> ordered words.
//
// CHOSEN-LEVEL-LED model (user 2026-06-18, §21-A/B/C): the level a grown-up picks is the
// primary driver of WHAT is served — the session LEADS with fresh words at/above the
// chosen start tier (introduced progressively), so changing the level changes the content
// immediately. Craft-missed TARGETS (the words truly not known yet — and, since mining no
// longer establishes mastery, targets come ONLY from crafting) are always RESERVED a share
// of the session so repair is never crowded out. Words answered correctly are PARKED and
// only resurface for spaced confirmation after level + targets are handled. `startTier`
// anchors where new words begin; difficulty's masteryTarget sets how far above to reach.
export function buildSession(tracker, opts = {}) {
  const { difficulty = 'easy', length = 12, rng = Math.random, words = byRank(), startTier = 1 } = opts;
  const { patternSpread, masteryTarget } = resolveDifficulty(difficulty);
  const psFn = (w) => predictedSuccess(tracker, w.word, tierToPrior(w.tier));
  const anchor = Math.min(9, Math.max(1, Math.round(startTier + (1 - masteryTarget) * REACH)));
  const byWord = new Map(words.map((w) => [w.word, w]));
  const rec = (w) => getRecord(tracker, w.word);

  // 1. Craft-missed targets present in this dataset, worst-first (the repair set).
  const targets = targetWords(tracker).map((w) => byWord.get(w)).filter(Boolean);

  // 2. Seed patterns: LEAD from the chosen level (so the picked level drives the new
  //    material), then add the patterns the learner is currently MISSING (repair focus).
  //    Expand by spread (prefers confusable cluster-mates for discrimination practice).
  const levelSeed = choosePatterns(words.filter((w) => w.tier >= startTier), psFn, masteryTarget, 1);
  const targetSeed = [...new Set(targets.map((t) => t.pattern))];
  let seed = [...new Set([...levelSeed, ...targetSeed])];
  if (seed.length === 0) seed = choosePatterns(words, psFn, masteryTarget, 1);
  const chosenPatterns = expandPatterns(seed, words, patternCount(patternSpread));
  const chosen = new Set(chosenPatterns);

  // 3. Fill to `length`, in priority order.
  const picked = [];
  const seen = new Set();
  const add = (w) => {
    if (w && !seen.has(w.word) && picked.length < length) {
      picked.push(w);
      seen.add(w.word);
    }
  };

  // New chosen-level material (never-seen words at/above the anchor, progressive). Still
  // hunt for unknowns only while fewer than ~TARGET_CAP words are actively being repaired.
  const hunting = targets.length < TARGET_CAP;
  const newAtLevel = hunting
    ? orderNewByAnchor(words.filter((w) => chosen.has(w.pattern) && !rec(w)), anchor)
    : [];
  // Reserve up to half the session (capped by how many targets exist) for repair, so the
  // chosen-level lead never crowds the craft-missed words out.
  const reserve = Math.min(targets.length, Math.ceil(length / 2));

  // (a) chosen-level NEW material LEADS, up to the non-reserved slots.
  newAtLevel.slice(0, Math.max(0, length - reserve)).forEach(add);
  // (b) craft-missed TARGETS next — those in the chosen patterns first, then any other.
  targets.filter((t) => chosen.has(t.pattern)).forEach(add);
  targets.forEach(add);
  // (c) more chosen-level new material to top up the session.
  newAtLevel.forEach(add);

  // (d) parked/known words come back only AFTER level + targets: DUE (rested past cooldown)
  //     seen words in the chosen patterns, least-recently-seen (most overdue) first.
  if (picked.length < length) {
    words
      .filter((w) => chosen.has(w.pattern) && !seen.has(w.word) && (rec(w)?.attempts ?? 0) > 0 && isEligible(tracker, w.word))
      .sort((a, b) => rec(a).lastSeen - rec(b).lastSeen)
      .forEach(add);
  }

  // (e) never starve: any never-seen word (progressive, ignore pattern), then the
  //     most-overdue resting words. Rare on the full lexicon; matters for small pools.
  if (picked.length < length) {
    orderNewByAnchor(words.filter((w) => !seen.has(w.word) && !rec(w)), anchor).forEach(add);
  }
  if (picked.length < length) {
    words
      .filter((w) => !seen.has(w.word) && (rec(w)?.attempts ?? 0) > 0)
      .sort((a, b) => serveOverdue(tracker, b.word) - serveOverdue(tracker, a.word))
      .forEach(add);
  }

  // 4. Order blocked → interleaved by spread (targets + similar-pattern words mixed).
  return orderMain(picked, patternSpread, rng).slice(0, length);
}

// buildReviewSession(tracker, { length, words, rng }) -> the learner's "cracked
// crystals" (missed, not-yet-re-mastered words) as dataset entries, worst first,
// for PRODUCTION practice (Craft mode) — recall, not recognition. Tops up with the
// shakiest seen words if there aren't enough lapses; never pulls in brand-new words
// (this is repair, not new material). May return fewer than `length` (that's fine —
// nothing left to repair). A selector over the continuous tracker, not a scheduler.
export function buildReviewSession(tracker, opts = {}) {
  const { length = 6, words = byRank(), rng = Math.random } = opts;
  const byWord = new Map(words.map((w) => [w.word, w]));
  const chosen = lapsedWords(tracker, { max: length })
    .map((w) => byWord.get(w))
    .filter(Boolean);

  if (chosen.length < length) {
    const have = new Set(chosen.map((w) => w.word));
    const extra = [...tracker.records.values()]
      .filter((r) => !have.has(r.word) && r.attempts > 0 && r.mastery < 0.6)
      .sort((a, b) => a.mastery - b.mastery || a.lastSeen - b.lastSeen)
      .map((r) => byWord.get(r.word))
      .filter(Boolean);
    chosen.push(...extra.slice(0, length - chosen.length));
  }
  return shuffle(chosen, rng);
}
