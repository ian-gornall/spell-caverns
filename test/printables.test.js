// test/printables.test.js — the PURE printable-sheet selection logic (§28.C).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SOURCES,
  FORMATS,
  MAX_WORDS,
  tierChoices,
  patternChoices,
  resolveWords,
  sheetTitle,
} from '../src/engine/printables.js';
import { createTracker, recordAnswer } from '../src/engine/progress.js';
import { wordsByTier, wordsByPattern } from '../src/engine/lexicon.js';

test('exposes the source + format menus', () => {
  assert.ok(SOURCES.length >= 3 && SOURCES.every((s) => s.id && s.label));
  assert.ok(FORMATS.some((f) => f.id === 'list') && FORMATS.some((f) => f.id === 'grid'));
});

test('tierChoices are non-empty, ascending, and have counts', () => {
  const tiers = tierChoices();
  assert.ok(tiers.length > 0);
  for (let i = 1; i < tiers.length; i++) assert.ok(tiers[i].id > tiers[i - 1].id, 'ascending');
  assert.ok(tiers.every((t) => t.count > 0), 'every tier has words');
});

test('patternChoices only include families that have words', () => {
  const pats = patternChoices();
  assert.ok(pats.length > 0);
  assert.ok(pats.every((p) => p.count > 0 && p.label && p.id));
});

test('resolveWords(tier) returns that tier’s words, capped + de-duplicated', () => {
  const tier = tierChoices()[0].id;
  const got = resolveWords({ source: 'tier', value: tier });
  assert.ok(got.length > 0);
  assert.ok(got.length <= MAX_WORDS, 'respects the cap');
  assert.equal(new Set(got).size, got.length, 'no duplicates');
  const expected = new Set(wordsByTier(tier).map((w) => w.word));
  assert.ok(got.every((w) => expected.has(w)), 'all from the chosen tier');
});

test('resolveWords(pattern) returns that family’s words', () => {
  const id = patternChoices()[0].id;
  const got = resolveWords({ source: 'pattern', value: id });
  assert.ok(got.length > 0);
  const expected = new Set(wordsByPattern(id).map((w) => w.word));
  assert.ok(got.every((w) => expected.has(w)));
});

test('resolveWords(targets) reflects the learner’s missed words; empty without a tracker', () => {
  assert.deepEqual(resolveWords({ source: 'targets' }), [], 'no tracker → empty, no throw');
  const tracker = createTracker();
  recordAnswer(tracker, 'because', false);
  recordAnswer(tracker, 'friend', false);
  const got = resolveWords({ source: 'targets' }, { tracker });
  assert.ok(got.includes('because') && got.includes('friend'));
});

test('resolveWords degrades to [] for an unknown source', () => {
  assert.deepEqual(resolveWords({ source: 'nope' }), []);
  assert.deepEqual(resolveWords({}), []);
});

test('sheetTitle is sensible per source', () => {
  assert.match(sheetTitle({ source: 'targets' }), /practice/i);
  assert.match(sheetTitle({ source: 'pattern', value: 'ight' }, 'long i (ight)'), /long i/);
  assert.equal(sheetTitle({ source: 'tier', value: 3 }, 'Level 3'), 'Level 3');
});
