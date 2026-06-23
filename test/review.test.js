// test/review.test.js — §36e RETENTION REVIEW (Ian 2026-06-22e). Pure; runs under `node --test`.
//
// Ian's spec: a "run" is a completed set of N words (craft = 6, mastery = 5). PER MODE, when the
// PREVIOUS set scored BELOW 60%, the NEXT set folds in some previously-MASTERED words for review,
// picked OLDEST-last-seen first. The count scales with how far below the line the set fell:
//   6-word craft set: 3/6 → +1, 2/6 → +2, 1/6 → +3, 0/6 → +4 (≥4/6 = ≥60% → none).
// Generalised: pending = max(0, ceil(0.6*total) - correct). Only construct/mastery answers count
// toward a run (mining never changes status, so it never drives review). A resurfaced mastered word
// that is then MISSED "breaks" (→ learning/cracked, see categories.test.js) and redoes both phases.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createCategoryState,
  fillLearning,
  recordCraft,
  recordDraw,
  masteredWords,
  knownWords,
  recordSetResult,
  pendingReview,
  reviewWords,
  serializeCategoryState,
  deserializeCategoryState,
  CATEGORIES,
  getCat,
} from '../src/engine/categories.js';
import { buildCraftPool, buildMasteryPool } from '../src/engine/selection.js';

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
const rng = () => 0.42;

// Master `words` in the given order so their lastSeen increases left→right (oldest first).
function masterInOrder(st, words) {
  for (const w of words) {
    recordCraft(st, w, true, { pool: POOL }); // learning → known
    recordDraw(st, w, true); // known → mastered
  }
}

test('recordSetResult: a 6-word set below 60% queues review words that scale with the miss count', () => {
  const cases = [
    [6, 0], [5, 0], [4, 0], // ≥60% (4/6 = 66%) → no review
    [3, 1], [2, 2], [1, 3], [0, 4], // <60% → 1 extra review word per miss below the line
  ];
  for (const [correct, expected] of cases) {
    const st = createCategoryState({ setSize: 6 });
    assert.equal(recordSetResult(st, 'craft', correct, 6), expected, `${correct}/6 → ${expected}`);
    assert.equal(pendingReview(st, 'craft'), expected);
  }
});

test('recordSetResult generalises to a 5-word mastery set (ceil(0.6*5)=3)', () => {
  const st = createCategoryState();
  assert.equal(recordSetResult(st, 'mastery', 3, 5), 0); // 3/5 = 60% → none
  assert.equal(recordSetResult(st, 'mastery', 2, 5), 1); // 2/5 = 40% → 1
  assert.equal(recordSetResult(st, 'mastery', 0, 5), 3);
});

test('reviewPending is per-mode and independent (craft vs mastery)', () => {
  const st = createCategoryState();
  recordSetResult(st, 'craft', 1, 6); // → 3
  recordSetResult(st, 'mastery', 4, 5); // → 0 (4/5 ≥ 60%)
  assert.equal(pendingReview(st, 'craft'), 3);
  assert.equal(pendingReview(st, 'mastery'), 0);
});

test('reviewWords returns the N oldest-last-seen MASTERED words (and never more than are queued)', () => {
  const st = createCategoryState({ setSize: 8, level: 1 });
  fillLearning(st, POOL);
  masterInOrder(st, ['cat', 'bat', 'hat']); // lastSeen: cat < bat < hat
  assert.deepEqual(masteredWords(st).sort(), ['bat', 'cat', 'hat']);
  recordSetResult(st, 'craft', 2, 6); // queue 2 review words
  assert.deepEqual(reviewWords(st, 'craft'), ['cat', 'bat'], 'the two OLDEST mastered words');
  // re-confirming the oldest word (a fresh draw) makes it the most-recently-seen → it drops to the back
  recordDraw(st, 'cat', true);
  recordSetResult(st, 'craft', 2, 6);
  assert.deepEqual(reviewWords(st, 'craft'), ['bat', 'hat'], 'cat is now freshest → bat/hat are oldest');
  // nothing queued → no review words
  recordSetResult(st, 'craft', 6, 6);
  assert.deepEqual(reviewWords(st, 'craft'), []);
});

test('lastSeen bumps on every craft and draw so review-ordering tracks real recency', () => {
  const st = createCategoryState({ setSize: 8, level: 1 });
  fillLearning(st, POOL);
  recordCraft(st, 'cat', true, { pool: POOL });
  const a = st.words.get('cat').lastSeen;
  recordCraft(st, 'bat', true, { pool: POOL });
  const b = st.words.get('bat').lastSeen;
  assert.ok(Number.isFinite(a) && Number.isFinite(b) && b > a, 'lastSeen is monotonic across records');
  recordDraw(st, 'cat', true); // cat re-touched → now newest
  assert.ok(st.words.get('cat').lastSeen > b, 'a draw also bumps lastSeen');
});

test('buildCraftPool folds the queued review words into the next set (and none when not queued)', () => {
  const st = createCategoryState({ setSize: 6, level: 1 });
  fillLearning(st, POOL); // 6 band-1 learning words
  masterInOrder(st, ['cat', 'bat']); // 2 mastered (oldest cat, then bat)
  // no review queued yet → the craft set is pure learning, no mastered word sneaks in
  let out = buildCraftPool(st, POOL, { length: 6, rng });
  assert.ok(!out.some((w) => w.word === 'cat' || w.word === 'bat'), 'no mastered words without a queued review');
  // a bad set queues 2 review words → both oldest-mastered words MUST appear next set
  recordSetResult(st, 'craft', 2, 6);
  out = buildCraftPool(st, POOL, { length: 6, rng });
  assert.ok(out.some((w) => w.word === 'cat'), 'oldest mastered word resurfaced');
  assert.ok(out.some((w) => w.word === 'bat'), 'second-oldest mastered word resurfaced');
  assert.equal(new Set(out.map((w) => w.word)).size, out.length, 'no duplicates');
});

test('buildMasteryPool appends queued review words while KNOWN still leads', () => {
  const st = createCategoryState({ setSize: 6, level: 1 });
  fillLearning(st, POOL);
  masterInOrder(st, ['cat', 'bat']); // mastered
  recordCraft(st, 'hat', true, { pool: POOL }); // hat is KNOWN (the goal of mastery)
  assert.ok(knownWords(st).includes('hat'));
  recordSetResult(st, 'mastery', 1, 5); // queue 2 review words
  const out = buildMasteryPool(st, POOL, { length: 10, rng });
  assert.equal(getCat(st, out[0].word), CATEGORIES.KNOWN, 'a known-but-unmastered word still leads');
  assert.ok(out.some((w) => w.word === 'cat') && out.some((w) => w.word === 'bat'), 'review words are present');
});

test('reviewPending + lastSeen survive a serialize → deserialize round-trip', () => {
  const st = createCategoryState({ setSize: 6, level: 1 });
  fillLearning(st, POOL);
  masterInOrder(st, ['cat', 'bat']);
  recordSetResult(st, 'craft', 1, 6); // pending 3
  recordSetResult(st, 'mastery', 2, 5); // pending 1
  const round = deserializeCategoryState(JSON.parse(JSON.stringify(serializeCategoryState(st))));
  assert.equal(pendingReview(round, 'craft'), 3);
  assert.equal(pendingReview(round, 'mastery'), 1);
  assert.deepEqual(reviewWords(round, 'craft'), reviewWords(st, 'craft'));
});
