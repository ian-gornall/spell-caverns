// test/recommend.test.js — §31.D the "what should this student do next?" recommender
// (src/engine/selection.js `recommendNext`). Pure; runs under `node --test`.
//
// The pedagogical loop Ian wants (known↔learning cycling):
//   Craft (new→learning→known) → Mastery (known→mastered) → cycle mastered/missed back to Craft.
// recommendNext reads the category state and returns the single best next mode + a reason,
// MASTERY-FIRST once it is unlocked and a backlog of known-but-unmastered words exists
// (§31.C: drive KNOWN→MASTERED instead of letting mastery sit ignored). It never recommends
// a LOCKED mode.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createCategoryState,
  fillLearning,
  recordCraft,
  recordDraw,
  knownWords,
  masteredWords,
  unlocks,
} from '../src/engine/categories.js';
import { recommendNext } from '../src/engine/selection.js';

// A pool with enough band-1 words to reach the setSize unlock thresholds.
const POOL = Array.from({ length: 12 }, (_, i) => ({
  word: `w${String.fromCharCode(97 + i)}`, // wa, wb, wc, ...
  band: 1,
  pattern: 'p',
  rank: i + 1,
  sentence: `A w${String.fromCharCode(97 + i)}.`,
}));

const makeKnown = (st, w) => {
  recordCraft(st, w, true, { pool: POOL });
  recordCraft(st, w, true, { pool: POOL });
};

test('fresh state (mastery locked) → CRAFT, reason unlock-mastery', () => {
  const st = createCategoryState({ setSize: 4, level: 1 });
  fillLearning(st, POOL);
  assert.equal(unlocks(st).mastery, false);
  const r = recommendNext(st);
  assert.equal(r.mode, 'craft');
  assert.equal(r.reason, 'unlock-mastery');
});

test('once setSize words are KNOWN but none mastered → MASTERY (mastery-first nudge)', () => {
  const st = createCategoryState({ setSize: 4, level: 1 });
  fillLearning(st, POOL);
  ['wa', 'wb', 'wc', 'wd'].forEach((w) => makeKnown(st, w));
  assert.equal(unlocks(st).mastery, true);
  assert.equal(masteredWords(st).length, 0);
  assert.ok(knownWords(st).length >= 1);
  const r = recommendNext(st);
  assert.equal(r.mode, 'mastery', 'a backlog of known-but-unmastered words drives Mastery');
  assert.equal(r.reason, 'master-known');
  assert.ok(r.knownBacklog >= 1);
});

test('mastery-first WINS even while fresh learning words remain to be crafted', () => {
  const st = createCategoryState({ setSize: 4, level: 1 });
  fillLearning(st, POOL);
  ['wa', 'wb', 'wc', 'wd'].forEach((w) => makeKnown(st, w)); // unlock mastery; refills bring new learning words
  // there ARE still unproven learning words in the set now, but the known backlog should win
  const r = recommendNext(st);
  assert.equal(r.mode, 'mastery');
});

test('when every KNOWN word is mastered, steer back to CRAFT to learn more (the cycle)', () => {
  const st = createCategoryState({ setSize: 4, level: 1 });
  fillLearning(st, POOL);
  ['wa', 'wb', 'wc', 'wd'].forEach((w) => makeKnown(st, w));
  knownWords(st).forEach((w) => recordDraw(st, w, true)); // master them all
  assert.equal(knownWords(st).length, 0);
  const r = recommendNext(st);
  assert.equal(r.mode, 'craft');
  assert.equal(r.reason, 'learn-more');
});

test('never recommends a locked mode; reason fields describe the signals', () => {
  const st = createCategoryState({ setSize: 4, level: 1 });
  fillLearning(st, POOL);
  const r = recommendNext(st);
  const u = unlocks(st);
  if (r.mode === 'mastery') assert.ok(u.mastery);
  if (r.mode === 'mining') assert.ok(u.mining);
  assert.ok(typeof r.knownBacklog === 'number' && typeof r.masteredCount === 'number');
});
