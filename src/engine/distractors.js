// src/engine/distractors.js — PURE wrong-answer engine for the spelling game.
//
// Two jobs:
//   1. Invent plausible *child* misspellings of any word, so the game scales to
//      thousands of words without a human authoring wrong answers for each.
//   2. Assemble a multiple-choice set (`buildOptions`) whose distractors slide
//      from "obviously wrong" (easy) to "minimally different / very confusable"
//      (hard) — the easy->hard ramp the design calls for, ending in the
//      "choose between very similar spellings under speed pressure" endgame.
//
// Imports NOTHING browser-specific, so it runs under `node --test`. Randomness is
// injected (a seeded rng) so option order is reproducible in tests and replays.

// ----------------------------------------------------------------- primitives

// mulberry32: tiny, fast, seedable PRNG. Returns a function producing floats in
// [0, 1). Same seed -> same stream, which is what makes options reproducible.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fisher-Yates shuffle. Returns a NEW array (never mutates the input). `rng` is a
// function returning [0,1) — pass a seeded mulberry32 for determinism.
export function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Classic Levenshtein edit distance (two-row DP). Used to rank candidate
// misspellings by how close they are to the real word = how confusable they are.
export function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[n];
}

// ---------------------------------------------------- misspelling generation

const VOWELS = 'aeiou';

// Confusable grapheme swaps children actually make. Applied to each occurrence
// individually (one swap per candidate) so the results stay close to the word.
// Direction matters: ['ai','ay'] turns "rain"->"rayn".
const TEAM_SWAPS = [
  ['ai', 'ay'], ['ai', 'a'], ['ay', 'ai'], ['ay', 'a'],
  ['ee', 'ea'], ['ea', 'ee'], ['ee', 'e'], ['ea', 'e'],
  ['ie', 'ei'], ['ei', 'ie'], ['ie', 'y'],
  ['oa', 'o'], ['ow', 'ou'], ['ou', 'ow'], ['oo', 'u'], ['oo', 'oa'],
  ['ew', 'oo'], ['au', 'or'], ['aw', 'au'],
  ['igh', 'i'], ['igh', 'y'], ['ight', 'ite'],
  ['ph', 'f'], ['f', 'ph'],
  ['tion', 'shun'], ['tion', 'sion'], ['sion', 'tion'],
  ['cious', 'tious'], ['ous', 'us'],
  ['c', 'k'], ['k', 'c'], ['ck', 'k'], ['ck', 'c'], ['ch', 'tch'],
  ['ce', 'se'], ['se', 'ce'], ['s', 'z'], ['z', 's'],
  ['qu', 'kw'], ['wh', 'w'], ['w', 'wh'],
  ['y', 'i'], ['i', 'y'], ['le', 'el'], ['er', 'ar'], ['er', 'or'],
];

// How many of {first letter, last letter} a candidate keeps. Children anchor
// hard on a word's first and last letter, so candidates that preserve both feel
// more confusable — used only as a tiebreak when edit distances are equal.
function endAnchor(word, s) {
  let n = 0;
  if (word[0] === s[0]) n++;
  if (word[word.length - 1] === s[s.length - 1]) n++;
  return n;
}

// Order two candidates "most confusable first": closest edit distance wins; then
// the one whose length is closest to the word; then the one keeping more
// first/last anchors; finally alphabetical so the order is fully deterministic.
function confusabilityCompare(word, a, b) {
  const da = levenshtein(word, a);
  const db = levenshtein(word, b);
  if (da !== db) return da - db;
  const la = Math.abs(a.length - word.length);
  const lb = Math.abs(b.length - word.length);
  if (la !== lb) return la - lb;
  const ea = endAnchor(word, a);
  const eb = endAnchor(word, b);
  if (ea !== eb) return eb - ea; // more anchors == more confusable == earlier
  return a < b ? -1 : a > b ? 1 : 0;
}

// generateMisspellings(word, {realWords, max}) -> ranked list of invented
// misspellings, CLOSEST (most confusable) FIRST. Applies the child-error
// transforms below, drops anything that equals the word or (when `realWords` is
// given) is itself a real word, dedupes, ranks, and caps to `max`.
export function generateMisspellings(word, { realWords, max = 16 } = {}) {
  const w = String(word).toLowerCase();
  const cands = new Set();
  const add = (s) => {
    if (s && s !== w && /^[a-z]+$/.test(s)) cands.add(s);
  };

  // 1. confusable vowel-team / consonant grapheme swaps (each occurrence)
  for (const [from, to] of TEAM_SWAPS) {
    let i = w.indexOf(from);
    while (i !== -1) {
      add(w.slice(0, i) + to + w.slice(i + from.length));
      i = w.indexOf(from, i + 1);
    }
  }
  // 2. undouble a doubled consonant ("ll" -> "l")
  for (let i = 0; i + 1 < w.length; i++) {
    if (w[i] === w[i + 1] && !VOWELS.includes(w[i])) {
      add(w.slice(0, i) + w.slice(i + 1));
    }
  }
  // 3. double a single consonant (the classic "is it one l or two?" error)
  for (let i = 0; i < w.length; i++) {
    if (!VOWELS.includes(w[i])) add(w.slice(0, i + 1) + w[i] + w.slice(i + 1));
  }
  // 4. silent-e: drop a trailing e, or add one
  if (w.endsWith('e') && w.length > 2) add(w.slice(0, -1));
  else add(w + 'e');
  // 5. adjacent transpositions ("freind")
  for (let i = 0; i + 1 < w.length; i++) {
    add(w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2));
  }
  // 6. dropped vowels
  for (let i = 0; i < w.length; i++) {
    if (VOWELS.includes(w[i])) add(w.slice(0, i) + w.slice(i + 1));
  }
  // 7. swapped vowels (a/e/i/o/u for one another)
  for (let i = 0; i < w.length; i++) {
    if (VOWELS.includes(w[i])) {
      for (const v of VOWELS) if (v !== w[i]) add(w.slice(0, i) + v + w.slice(i + 1));
    }
  }

  let list = [...cands];
  if (realWords) list = list.filter((s) => !realWords.has(s));
  list.sort((a, b) => confusabilityCompare(w, a, b));
  return list.slice(0, max);
}

// ----------------------------------------------------------- option building

function clamp01(x) {
  if (!Number.isFinite(x)) return 0;
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

// Combined distractor pool for a word: curated misspellings FIRST (they are the
// hand-picked, hardest, most confusable ones), then generated misspellings
// (already ranked closest->furthest). Deduped; excludes the word and real words.
function buildPool(word, { curated = [], realWords, max = 60 } = {}) {
  const seen = new Set();
  const pool = [];
  const add = (s) => {
    if (!s || s === word) return;
    if (realWords && realWords.has(s)) return;
    if (seen.has(s)) return;
    seen.add(s);
    pool.push(s);
  };
  for (const c of curated) add(String(c).toLowerCase());
  for (const g of generateMisspellings(word, { realWords, max })) add(g);
  return pool;
}

// Last-resort filler so buildOptions can always reach `count` even for tiny words
// (e.g. "i", "an"): insert each letter at each position, keeping only non-words.
function padDistractors(word, pool, need, realWords) {
  const out = pool.slice();
  const seen = new Set(out);
  const alpha = 'abcdefghijklmnopqrstuvwxyz';
  for (let pos = 0; pos <= word.length && out.length < need; pos++) {
    for (const ch of alpha) {
      if (out.length >= need) break;
      const cand = word.slice(0, pos) + ch + word.slice(pos);
      if (cand === word || seen.has(cand)) continue;
      if (realWords && realWords.has(cand)) continue;
      seen.add(cand);
      out.push(cand);
    }
  }
  return out;
}

// recognitionOptionCount(tier, setting) -> how many multiple-choice options the
// RECOGNITION ("Practice") mode should show for a word of this difficulty tier.
// The youngest tiers (1-2 — the earliest frequency bands, our most at-risk readers)
// are clamped to 2 so fewer plausible misspellings sit on screen at once, limiting
// imprinting exposure (DESIGN_ANALYSIS rec #9; the spelling literature is firm that
// merely SEEING plausible misspellings can imprint them). Older tiers use the grown-up
// setting. Production (CRAFT) is unaffected — there are no options to choose there.
export function recognitionOptionCount(tier, setting) {
  const s = Math.max(2, Math.min(4, Math.round(setting) || 3));
  return tier <= 2 ? Math.min(s, 2) : s;
}

// buildOptions(word, opts) -> shuffled [{text, correct}] with exactly `count`
// items, exactly one of which is the correct spelling. The distractor pool is
// ordered most-confusable -> least; `difficulty` (0..1) slides a window over it:
//   difficulty 1 (hardest) -> distractors from the FRONT  (minimally different)
//   difficulty 0 (easiest) -> distractors from the BACK   (more obviously wrong)
// A small extra band plus the seeded `rng` add variety without losing the
// difficulty target. Always returns `count` options (pads if the pool is short).
export function buildOptions(word, opts = {}) {
  const { count = 3, difficulty = 0.5, curated = [], realWords, rng } = opts;
  const need = Math.max(0, count - 1); // number of distractors

  let pool = buildPool(word, { curated, realWords, max: 60 });
  if (pool.length < need) pool = padDistractors(word, pool, need, realWords);

  const d = clamp01(difficulty);
  const EXTRA = 2; // a couple of spare candidates so rng can vary the pick
  const maxStart = Math.max(0, pool.length - need);
  const start = Math.round((1 - d) * maxStart); // hard -> 0, easy -> end
  const band = pool.slice(start, Math.min(pool.length, start + need + EXTRA));
  const picked = (rng ? shuffle(band, rng) : band).slice(0, need);

  const options = [
    { text: word, correct: true },
    ...picked.map((t) => ({ text: t, correct: false })),
  ];
  return shuffle(options, rng || Math.random);
}
