// test/selection.test.js — §30 category-driven SELECTION + adaptive-level policy
// (src/engine/selection.js). Pure; runs under `node --test`.
//
// Selection turns the category state machine into concrete per-mode word lists:
//   - CRAFT   = the productive-struggle hub: FOCUS the learning set + tricky (repair), plus any
//               §36e mastered REVIEW words queued by a sub-60% set. Learning leads.
//   - MINING  = recognition: MASTERED words only (Ian 2026-06-22e: mining is gated to mastered).
//   - MASTERY = the draw test: KNOWN words lead (the ones to master); queued review may follow.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createCategoryState,
  fillLearning,
  recordCraft,
  recordDraw,
  learningWords,
  knownWords,
  masteredWords,
  trickyWords,
  CATEGORIES,
  getCat,
} from '../src/engine/categories.js';
import {
  buildCraftPool,
  buildRepairSession,
  buildMiningPool,
  buildMasteryPool,
} from '../src/engine/selection.js';

const POOL = [
  { word: 'cat', band: 1, pattern: 'short-a', rank: 1, sentence: 'A cat.' },
  { word: 'bat', band: 1, pattern: 'short-a', rank: 2, sentence: 'A bat.' },
  { word: 'hat', band: 1, pattern: 'short-a', rank: 3, sentence: 'A hat.' },
  { word: 'map', band: 1, pattern: 'short-a', rank: 4, sentence: 'A map.' },
  { word: 'rat', band: 1, pattern: 'short-a', rank: 5, sentence: 'A rat.' },
  { word: 'pan', band: 1, pattern: 'short-a', rank: 6, sentence: 'A pan.' },
  { word: 'ship', band: 2, pattern: 'sh', rank: 7, sentence: 'A ship.' },
  { word: 'shop', band: 2, pattern: 'sh', rank: 8, sentence: 'A shop.' },
];
const rng = () => 0.42; // deterministic shuffle

const makeKnown = (st, w) => {
  recordCraft(st, w, true, { pool: POOL });
  recordCraft(st, w, true, { pool: POOL });
};

test('buildCraftPool focuses the learning set (composition is mostly learning words)', () => {
  const st = createCategoryState({ setSize: 6, level: 1 });
  fillLearning(st, POOL); // 6 learning tier-1 words
  const out = buildCraftPool(st, POOL, { length: 6, rng });
  assert.equal(out.length, 6);
  out.forEach((w) => assert.ok(w.word && w.sentence)); // full dataset entries
  const learnSet = new Set(learningWords(st));
  const fromLearning = out.filter((w) => learnSet.has(w.word)).length;
  assert.ok(fromLearning >= 4, 'the bulk of a craft session is the learning set');
});

test('buildCraftPool mixes in TRICKY (cracked-overflow repair) when slots allow; KNOWN words stay in mastery', () => {
  const st = createCategoryState({ setSize: 4, level: 1 });
  fillLearning(st, POOL); // cat,bat,hat,map learning
  makeKnown(st, 'cat'); // cat → known (refills with rat)
  // make a tricky word: drive hat down then overflow it out
  recordCraft(st, 'hat', false, { pool: POOL });
  makeKnown(st, 'bat'); // bat known, refills
  recordCraft(st, 'bat', false, { pool: POOL }); // bat re-enters, evicts the worst (hat) → tricky
  assert.equal(getCat(st, 'hat'), CATEGORIES.TRICKY);
  const out = buildCraftPool(st, POOL, { length: 8, rng });
  const cats = new Set(out.map((w) => getCat(st, w.word)));
  // learning leads; with extra room the tricky (cracked) word is folded in for repair
  assert.ok(cats.has(CATEGORIES.LEARNING));
  assert.ok(cats.has(CATEGORIES.TRICKY));
  // §36e: KNOWN words are the mastery phase's job — craft no longer auto-serves them as review
  assert.ok(!cats.has(CATEGORIES.KNOWN), 'known words are drawn (mastery), not re-crafted');
  // never duplicates a word
  assert.equal(new Set(out.map((w) => w.word)).size, out.length);
});

test('buildRepairSession drills the cracked words first (§36 C3)', () => {
  const st = createCategoryState({ setSize: 6, level: 1 });
  fillLearning(st, POOL); // cat,bat,hat,map,rat,pan learning
  recordCraft(st, 'cat', true, { pool: POOL });
  recordCraft(st, 'cat', false, { pool: POOL }); // cat now needs repair
  recordCraft(st, 'bat', true, { pool: POOL });
  recordCraft(st, 'bat', false, { pool: POOL }); // bat now needs repair
  const out = buildRepairSession(st, POOL, { length: 6, rng });
  out.forEach((w) => assert.ok(w.word && w.sentence)); // full dataset entries
  const words = new Set(out.map((w) => w.word));
  assert.ok(words.has('cat') && words.has('bat'), 'both cracked words are in the drill');
  assert.equal(new Set(out.map((w) => w.word)).size, out.length); // no dupes
});

test('buildRepairSession pads with learning words when few are cracked', () => {
  const st = createCategoryState({ setSize: 6, level: 1 });
  fillLearning(st, POOL);
  recordCraft(st, 'cat', true, { pool: POOL });
  recordCraft(st, 'cat', false, { pool: POOL }); // only cat is cracked
  const out = buildRepairSession(st, POOL, { length: 4, rng });
  assert.equal(out.length, 4, 'padded up to length with other learning words');
  assert.ok(out.some((w) => w.word === 'cat'));
});

test('buildMiningPool serves ONLY MASTERED words (Ian 2026-06-22e: mining is gated to mastered)', () => {
  const st = createCategoryState({ setSize: 4, level: 1 });
  fillLearning(st, POOL);
  makeKnown(st, 'cat');
  makeKnown(st, 'bat');
  recordDraw(st, 'cat', true); // cat → mastered; bat stays merely KNOWN
  const out = buildMiningPool(st, POOL, { length: 10, rng });
  out.forEach((w) => assert.equal(getCat(st, w.word), CATEGORIES.MASTERED, `${w.word} is ${getCat(st, w.word)}`));
  const words = out.map((w) => w.word);
  assert.ok(words.includes('cat'), 'the mastered word is eligible');
  assert.ok(!words.includes('bat'), 'a merely-known word is NOT mined anymore');
});

test('buildMasteryPool leads with KNOWN (unmastered) words — the ones still to master', () => {
  const st = createCategoryState({ setSize: 4, level: 1 });
  fillLearning(st, POOL);
  makeKnown(st, 'cat');
  makeKnown(st, 'bat');
  recordDraw(st, 'cat', true); // mastered
  const out = buildMasteryPool(st, POOL, { length: 10, rng });
  const allowed = new Set([CATEGORIES.KNOWN, CATEGORIES.MASTERED]);
  out.forEach((w) => assert.ok(allowed.has(getCat(st, w.word))));
  assert.equal(getCat(st, out[0].word), CATEGORIES.KNOWN, 'the unmastered known word is offered first');
});

// §36 stay-in-level (Ian 2026-06-22d): the adaptive up/down level mover was REMOVED — the level
// now only advances by MASTERING the current cavern band (categories.advanceLevelIfCleared) or via a
// manual Settings / cavern-map re-aim. Its old tests lived here; see test/categories.test.js for the
// mastery-gated advance.
