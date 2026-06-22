// test/selection.test.js — §30 category-driven SELECTION + adaptive-level policy
// (src/engine/selection.js). Pure; runs under `node --test`.
//
// Selection turns the category state machine into concrete per-mode word lists:
//   - CRAFT   = the productive-struggle hub: FOCUS the learning set, balanced with a
//               little known (review) + tricky (repair). ANY word may appear; learning leads.
//   - MINING  = recognition: KNOWN-or-better words only (known ∪ mastered).
//   - MASTERY = the draw test: KNOWN words lead (the ones to master); mastered may follow.
// Plus the adaptive level: a MEDIUM-cadence up/down read off a short run of craft results.
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
  ADAPT_WINDOW,
  adaptiveLevelDecision,
  applyAdaptiveLevel,
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

test('buildCraftPool balances in a little KNOWN (review) + TRICKY (repair) when slots allow', () => {
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
  // with extra room beyond the learning set, review + repair words are mixed in
  assert.ok(cats.has(CATEGORIES.LEARNING));
  assert.ok([...cats].some((c) => c === CATEGORIES.KNOWN || c === CATEGORIES.TRICKY));
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

test('buildMiningPool serves ONLY known-or-better words (no learning / tricky / new)', () => {
  const st = createCategoryState({ setSize: 4, level: 1 });
  fillLearning(st, POOL);
  makeKnown(st, 'cat');
  makeKnown(st, 'bat');
  recordDraw(st, 'cat', true); // cat → mastered
  const out = buildMiningPool(st, POOL, { length: 10, rng });
  const allowed = new Set([CATEGORIES.KNOWN, CATEGORIES.MASTERED]);
  assert.ok(out.length >= 2);
  out.forEach((w) => assert.ok(allowed.has(getCat(st, w.word)), `${w.word} is ${getCat(st, w.word)}`));
  // both the known 'bat' and the mastered 'cat' are eligible
  const words = out.map((w) => w.word);
  assert.ok(words.includes('bat') && words.includes('cat'));
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

test('adaptiveLevelDecision: a clearly-weak run pushes DOWN, a clearly-strong run pushes UP', () => {
  const st = createCategoryState({ setSize: 4, level: 3 });
  st.recent = [false, false, false, false].slice(-ADAPT_WINDOW); // all wrong
  assert.equal(adaptiveLevelDecision(st), 'down');
  st.recent = [true, false, false, false]; // 1/4 correct — still weak
  assert.equal(adaptiveLevelDecision(st), 'down');
  st.recent = [true, true, true, true]; // all correct
  assert.equal(adaptiveLevelDecision(st), 'up');
});

test('adaptiveLevelDecision: a mixed run or too-little data holds the level', () => {
  const st = createCategoryState({ setSize: 4, level: 3 });
  st.recent = [true, false, true, false]; // 2/4 — neither clearly strong nor weak
  assert.equal(adaptiveLevelDecision(st), null);
  st.recent = [false, false]; // not enough data yet
  assert.equal(adaptiveLevelDecision(st), null);
});

test('applyAdaptiveLevel moves the level and resets the run window', () => {
  const st = createCategoryState({ setSize: 4, level: 3 });
  fillLearning(st, POOL);
  st.recent = [false, false, false, false];
  const dir = applyAdaptiveLevel(st, POOL);
  assert.equal(dir, 'down');
  assert.equal(st.level, 2);
  assert.equal(st.recent.length, 0, 'window resets after a move so it does not re-fire immediately');

  const st2 = createCategoryState({ setSize: 4, level: 1 });
  fillLearning(st2, POOL); // POOL spans tiers 1-2, so a promote from 1 lands on 2
  st2.recent = [true, true, true, true];
  assert.equal(applyAdaptiveLevel(st2, POOL), 'up');
  assert.equal(st2.level, 2);
});
