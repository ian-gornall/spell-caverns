// src/engine/lexicon.js — PURE data-access layer over the word dataset.
//
// Loads the frequency-ordered WORDS list and the canonical PATTERNS list, and
// exposes small, side-effect-free helpers the rest of the engine uses to pick
// words by pattern, tier, or rank. Imports NOTHING browser-specific so it runs
// under `node --test`.
import { WORDS, PATTERNS } from '../../data/words.js';

// Fast membership test of "is this string a real word in the dataset?".
// Used by the distractor + nonsense engines to avoid accidentally producing a
// real word when they want a wrong/invented one.
export const REAL_WORDS = new Set(WORDS.map((w) => w.word));

// All entries that belong to a given orthographic pattern family (e.g. "ight").
export function wordsByPattern(id) {
  return WORDS.filter((w) => w.pattern === id);
}

// All entries in a given difficulty tier (1..9).
export function wordsByTier(t) {
  return WORDS.filter((w) => w.tier === t);
}

// Look up a single entry by its exact (lowercase) spelling.
export function getWord(word) {
  return WORDS.find((w) => w.word === word);
}

// WORDS is already rank-sorted (rank 1 = most common). Return a shallow copy so
// callers can sort/slice without mutating the shared dataset array.
export function byRank() {
  return WORDS.slice();
}

export { WORDS, PATTERNS };
