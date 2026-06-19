// src/engine/printables.js — PURE selection logic for OFFLINE practice sheets (§28.C).
//
// The app is an offline PWA but had no path to paper. Grown-ups asked for printable
// practice materials (look-cover-write-check, pattern lists, the learner's current
// target words, a tier list) so a kid can practise away from the screen. This module
// resolves a chosen "what to print" spec into an ordered, de-duplicated, capped word
// list — all side-effect-free so it runs under `node --test`. The actual print VIEW
// (screens/printables.js) renders these words and calls window.print(); the browser
// turns it into a PDF or paper. No PDF library, no build step (project constraint).
import { WORDS, PATTERNS, wordsByTier, wordsByPattern } from './lexicon.js';
import { targetWords } from './progress.js';

// What word set to print. `targets` needs the live tracker; `pattern`/`tier` take a value.
export const SOURCES = [
  { id: 'targets', label: 'Words I’m working on now' },
  { id: 'pattern', label: 'A spelling pattern' },
  { id: 'tier', label: 'An age level' },
];

// How to lay the words out on the page.
export const FORMATS = [
  { id: 'list', label: 'Word list' },
  { id: 'grid', label: 'Look · cover · write · check' },
];

// Cap so a sheet stays to a sensible page or two of big, child-friendly type.
export const MAX_WORDS = 36;

// Age tiers that actually have words, each with a friendly label + count (for the picker).
export function tierChoices() {
  const tiers = [...new Set(WORDS.map((w) => w.tier))].sort((a, b) => a - b);
  return tiers
    .map((t) => ({ id: t, label: `Level ${t}`, count: wordsByTier(t).length }))
    .filter((c) => c.count > 0);
}

// Pattern families that have words, with their friendly names + counts (for the picker).
export function patternChoices() {
  return PATTERNS.map((p) => ({ id: p.id, label: p.name, count: wordsByPattern(p.id).length })).filter(
    (c) => c.count > 0,
  );
}

// Resolve a spec ({ source, value }) into an ORDERED, de-duplicated, capped word array.
//  - tier / pattern: dataset (frequency) order — most useful words lead, so the cap keeps them.
//  - targets: the learner's current target words (worst-first), needs opts.tracker.
// Returns [] for an unknown/empty source rather than throwing, so the screen degrades gracefully.
export function resolveWords(spec = {}, { tracker, max = MAX_WORDS } = {}) {
  let words = [];
  if (spec.source === 'tier') words = wordsByTier(Number(spec.value)).map((w) => w.word);
  else if (spec.source === 'pattern') words = wordsByPattern(spec.value).map((w) => w.word);
  else if (spec.source === 'targets') words = tracker ? targetWords(tracker, { max }) : [];

  const seen = new Set();
  const out = [];
  for (const w of words) {
    if (seen.has(w)) continue;
    seen.add(w);
    out.push(w);
    if (out.length >= max) break;
  }
  return out;
}

// A human title for the sheet header, given the spec + the resolved choice label.
export function sheetTitle(spec = {}, choiceLabel = '') {
  if (spec.source === 'targets') return 'My practice words';
  if (spec.source === 'pattern') return `Spelling pattern: ${choiceLabel || spec.value}`;
  if (spec.source === 'tier') return choiceLabel || `Level ${spec.value}`;
  return 'Practice words';
}
