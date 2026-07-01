// src/engine/lexicon.js — PURE data-access layer over the word dataset.
//
// Loads the frequency-ordered WORDS list and the canonical PATTERNS list, and
// exposes small, side-effect-free helpers the rest of the engine uses to pick
// words by pattern, tier, or rank. Imports NOTHING browser-specific so it runs
// under `node --test`.
import { WORDS, PATTERNS } from '../../data/words.js';
import { RESEARCH } from '../../data/research_sample.js';
import { lexiconEntries } from './lists.js';

// §C1/D4 cavern levels: the frequency-ordered list is grouped into fixed bands of
// BAND_SIZE consecutive words. A word's `band` (1-based) is its cavern level — the
// unit the categories engine serves from and the placement diagnostic enters at.
export const BAND_SIZE = 30;
export const bandForPos = (pos) => Math.floor(pos / BAND_SIZE) + 1;

// Fast membership test of "is this string a real word in the dataset?".
// Used by the distractor + nonsense engines to avoid accidentally producing a
// real word when they want a wrong/invented one. Research-corpus words count as
// real in BOTH modes (a distractor must never be a real word from either list).
export const REAL_WORDS = new Set(WORDS.map((w) => w.word));
for (const e of RESEARCH.words) REAL_WORDS.add(e.word);

// §38 wordlist mode: 'classic' (the flat frequency list, default) or 'lessons'
// (the research corpus: band = spine lesson, pool filtered by the learner's age).
// Set per active profile by app.refreshActive(); every byRank() caller — categories
// fill, mode pools, progress, settings — serves the active mode automatically.
let research = null; // { entries, lessons } when 'lessons' mode is active

export function setWordlistMode(mode, age) {
  research = mode === 'lessons' ? lexiconEntries(RESEARCH, age ?? 15) : null;
}

export const wordlistMode = () => (research ? 'lessons' : 'classic');

// Lesson metadata for a band number ({ id, label, rule, index }), or null in classic mode.
export function lessonForBand(band) {
  return research ? research.lessons.get(band) || null : null;
}

export function lessonCount() {
  return research ? research.lessons.size : 0;
}

// All entries that belong to a given orthographic pattern family (e.g. "ight").
export function wordsByPattern(id) {
  return WORDS.filter((w) => w.pattern === id);
}

// All entries in a given difficulty tier (1..9).
export function wordsByTier(t) {
  return WORDS.filter((w) => w.tier === t);
}

// Look up a single entry by its exact (lowercase) spelling (active mode first).
export function getWord(word) {
  if (research) {
    const hit = research.entries.find((w) => w.word === word);
    if (hit) return hit;
  }
  return WORDS.find((w) => w.word === word);
}

// WORDS is already rank-sorted (rank 1 = most common). Return FRESH entries (not the
// shared dataset objects) each carrying their 0-based list `pos` and 30-word `band`
// (cavern level), so the categories engine + placement diagnostic agree on which
// 30-word group a word belongs to. Callers can sort/slice/filter freely; filtering
// preserves each word's full-list `pos`/`band` (so a band may have <30 servable words).
export function byRank() {
  if (research) return research.entries.map((w) => ({ ...w }));
  return WORDS.map((w, i) => ({ ...w, pos: i, band: bandForPos(i) }));
}

export { WORDS, PATTERNS };
