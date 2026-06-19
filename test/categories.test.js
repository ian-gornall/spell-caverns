// test/categories.test.js — locks in the §30 word-category STATE MACHINE
// (src/engine/categories.js). Runs under `node --test` (no browser).
//
// §30 introduces DISCRETE word categories layered on top of the continuous
// mastery score (progress.js stays as-is for gems/speed/recency):
//   new → learning → known → mastered, plus `tricky` (a demotion/overflow bucket).
// Hard rules (Ian 2026-06-19d):
//   - learning = a fixed working set of EXACTLY [setSize] words, always kept full;
//   - known   = crafted correctly TWICE IN A ROW (a miss → back to learning);
//   - mastered = a known word with ONE success in MASTERY (draw) mode (set ONLY there;
//               a draw miss on a mastered word → back to known; a draw miss on a merely
//               known word leaves it known);
//   - tricky  = the hardest/lowest-accuracy words evicted to keep learning at setSize
//               (on overflow OR a level demotion) — the demotion/overflow pool;
//   - refill priority when a slot frees: new-on-level → on-level-or-lower tricky → level-up;
//   - unlock chain: craft (always) → mastery (after setSize KNOWN) → mining (after setSize MASTERED),
//               and unlocks never regress.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CATEGORIES,
  PROMOTE_STREAK,
  createCategoryState,
  getCat,
  learningWords,
  knownWords,
  masteredWords,
  trickyWords,
  recordCraft,
  recordDraw,
  fillLearning,
  demoteLevel,
  promoteLevel,
  unlocks,
  learningProgress,
  categorySummary,
  serializeCategoryState,
  deserializeCategoryState,
} from '../src/engine/categories.js';

// A small, dense fixture pool: 5 tier-1 (short-a), 4 tier-2 (sh), 3 tier-3 (ight).
const POOL = [
  { word: 'cat', tier: 1, pattern: 'short-a', rank: 1 },
  { word: 'bat', tier: 1, pattern: 'short-a', rank: 2 },
  { word: 'hat', tier: 1, pattern: 'short-a', rank: 3 },
  { word: 'map', tier: 1, pattern: 'short-a', rank: 4 },
  { word: 'rat', tier: 1, pattern: 'short-a', rank: 5 },
  { word: 'ship', tier: 2, pattern: 'sh', rank: 6 },
  { word: 'shop', tier: 2, pattern: 'sh', rank: 7 },
  { word: 'fish', tier: 2, pattern: 'sh', rank: 8 },
  { word: 'dish', tier: 2, pattern: 'sh', rank: 9 },
  { word: 'light', tier: 3, pattern: 'ight', rank: 10 },
  { word: 'night', tier: 3, pattern: 'ight', rank: 11 },
  { word: 'right', tier: 3, pattern: 'ight', rank: 12 },
];

// Fresh small state + filled learning set (setSize 3, level 1).
function fresh(opts = {}) {
  const st = createCategoryState({ setSize: 3, level: 1, ...opts });
  fillLearning(st, POOL);
  return st;
}

// Drive a learning word to KNOWN: PROMOTE_STREAK correct crafts in a row.
function makeKnown(st, word) {
  for (let i = 0; i < PROMOTE_STREAK; i++) recordCraft(st, word, true, { pool: POOL });
}

test('createCategoryState defaults: setSize 10, level 1, empty, only craft unlocked', () => {
  const st = createCategoryState();
  assert.equal(st.setSize, 10);
  assert.equal(st.level, 1);
  assert.equal(learningWords(st).length, 0);
  assert.deepEqual(unlocks(st), { craft: true, mastery: false, mining: false });
});

test('fillLearning fills to setSize with the lowest-rank NEW words at the current level', () => {
  const st = fresh();
  assert.equal(learningWords(st).length, 3);
  assert.deepEqual(learningWords(st).sort(), ['bat', 'cat', 'hat']); // ranks 1-3, tier 1
  for (const w of learningWords(st)) assert.equal(getCat(st, w), CATEGORIES.LEARNING);
});

test('two correct crafts IN A ROW promote a word to known and refill the freed slot', () => {
  const st = fresh();
  recordCraft(st, 'cat', true, { pool: POOL });
  assert.equal(getCat(st, 'cat'), CATEGORIES.LEARNING); // one correct is not enough
  recordCraft(st, 'cat', true, { pool: POOL });
  assert.equal(getCat(st, 'cat'), CATEGORIES.KNOWN); // two in a row → known
  assert.deepEqual(knownWords(st), ['cat']);
  // the freed learning slot is refilled with the next new tier-1 word (rank 4 = 'map')
  assert.equal(learningWords(st).length, 3);
  assert.ok(learningWords(st).includes('map'));
});

test('a miss resets the in-a-row streak (one correct then a miss does NOT make it known)', () => {
  const st = fresh();
  recordCraft(st, 'bat', true, { pool: POOL });
  recordCraft(st, 'bat', false, { pool: POOL });
  recordCraft(st, 'bat', true, { pool: POOL });
  assert.equal(getCat(st, 'bat'), CATEGORIES.LEARNING); // streak was broken → still learning
  recordCraft(st, 'bat', true, { pool: POOL });
  assert.equal(getCat(st, 'bat'), CATEGORIES.KNOWN); // now two in a row
});

test('a craft MISS on a known word demotes it back to learning', () => {
  const st = fresh();
  makeKnown(st, 'cat');
  assert.equal(getCat(st, 'cat'), CATEGORIES.KNOWN);
  recordCraft(st, 'cat', false, { pool: POOL });
  assert.equal(getCat(st, 'cat'), CATEGORIES.LEARNING);
});

test('re-entering learning over capacity evicts the HARDEST other word to tricky (keeps setSize)', () => {
  const st = fresh(); // learning = cat,bat,hat
  // Make 'bat' a chronic struggler (low accuracy), 'hat' clean.
  recordCraft(st, 'bat', false, { pool: POOL });
  recordCraft(st, 'bat', false, { pool: POOL });
  recordCraft(st, 'hat', true, { pool: POOL });
  // Promote 'cat' to known (frees a slot → refilled with 'map'), then miss it to force a re-entry.
  makeKnown(st, 'cat');
  recordCraft(st, 'cat', false, { pool: POOL }); // known → learning, learning now over capacity
  assert.equal(learningWords(st).length, 3); // still exactly setSize
  assert.equal(getCat(st, 'cat'), CATEGORIES.LEARNING); // the re-entering word is kept, never evicted
  assert.equal(getCat(st, 'bat'), CATEGORIES.TRICKY); // the lowest-accuracy word was parked as tricky
});

test('draw mode is the ONLY path to mastered: known + draw success → mastered; draw miss → known', () => {
  const st = fresh();
  makeKnown(st, 'cat');
  // a draw success masters it
  recordDraw(st, 'cat', true);
  assert.equal(getCat(st, 'cat'), CATEGORIES.MASTERED);
  assert.deepEqual(masteredWords(st), ['cat']);
  // a draw miss on a MASTERED word drops it back to known (not below)
  recordDraw(st, 'cat', false);
  assert.equal(getCat(st, 'cat'), CATEGORIES.KNOWN);
});

test('a draw miss on a merely KNOWN (not mastered) word leaves it known; draw on a non-known word is a no-op', () => {
  const st = fresh();
  makeKnown(st, 'cat');
  recordDraw(st, 'cat', false);
  assert.equal(getCat(st, 'cat'), CATEGORIES.KNOWN); // failing the mastery test just means "not mastered yet"
  // 'bat' is still learning — draw mode does not serve it; recording a draw must not change its category
  const before = getCat(st, 'bat');
  recordDraw(st, 'bat', true);
  assert.equal(getCat(st, 'bat'), before);
});

test('unlock chain: mastery after setSize KNOWN, mining after setSize MASTERED — and never regresses', () => {
  const st = fresh(); // setSize 3
  assert.equal(unlocks(st).mastery, false);
  makeKnown(st, 'cat');
  makeKnown(st, 'bat');
  assert.equal(unlocks(st).mastery, false); // only 2 known
  makeKnown(st, 'hat');
  assert.equal(unlocks(st).mastery, true); // 3 reached known → mastery unlocked
  assert.equal(unlocks(st).mining, false);

  recordDraw(st, 'cat', true);
  recordDraw(st, 'bat', true);
  recordDraw(st, 'hat', true);
  assert.equal(unlocks(st).mining, true); // 3 mastered → mining unlocked

  // Regression guard: mastering words drops the live "known" count; missing a mastered word in
  // draw drops the live "mastered" count — but neither unlock may switch back off.
  recordDraw(st, 'cat', false); // mastered → known (mastered count now 2)
  assert.equal(unlocks(st).mining, true);
  assert.equal(unlocks(st).mastery, true);
});

test('refill levels UP when the current level has no more new words (and none below)', () => {
  // Only 2 tier-1 words → setSize 3 cannot be filled from level 1 alone.
  const tiny = [
    { word: 'cat', tier: 1, pattern: 'short-a', rank: 1 },
    { word: 'bat', tier: 1, pattern: 'short-a', rank: 2 },
    { word: 'ship', tier: 2, pattern: 'sh', rank: 6 },
    { word: 'shop', tier: 2, pattern: 'sh', rank: 7 },
  ];
  const st = createCategoryState({ setSize: 3, level: 1 });
  fillLearning(st, tiny);
  assert.equal(learningWords(st).length, 3);
  assert.ok(st.level >= 2, 'level climbed to find enough new words');
  assert.ok(learningWords(st).includes('ship')); // pulled a tier-2 word after tier 1 ran dry
});

test('tricky reintroduction: an on-level-or-lower tricky word is reused BEFORE leveling up', () => {
  // tier-1 words exhaust after the working set + one refill; a tier-2 word ('ship') exists so a
  // freed slot COULD level up — but an on-level tricky word must be reused first instead.
  const p = [
    { word: 'cat', tier: 1, pattern: 'short-a', rank: 1 },
    { word: 'bat', tier: 1, pattern: 'short-a', rank: 2 },
    { word: 'hat', tier: 1, pattern: 'short-a', rank: 3 },
    { word: 'map', tier: 1, pattern: 'short-a', rank: 4 },
    { word: 'ship', tier: 2, pattern: 'sh', rank: 9 },
  ];
  const st = createCategoryState({ setSize: 3, level: 1 });
  fillLearning(st, p); // cat,bat,hat
  const makeKnownP = (w) => {
    for (let i = 0; i < PROMOTE_STREAK; i++) recordCraft(st, w, true, { pool: p });
  };
  // Force 'bat' to become tricky: make it the worst, promote cat (→known, refills 'map'), then
  // miss cat so it re-enters learning and evicts the worst (bat) to tricky.
  recordCraft(st, 'bat', false, { pool: p });
  makeKnownP('cat');
  recordCraft(st, 'cat', false, { pool: p }); // cat re-enters → evicts bat to tricky
  assert.equal(getCat(st, 'bat'), CATEGORIES.TRICKY);
  // learning is now {hat, map, cat}; all tier-1 words are seen, only tier-2 'ship' is new.
  // Free EXACTLY ONE slot (promote hat). The refill must reintroduce tricky 'bat' (tier 1 ≤ level)
  // rather than climb to tier-2 'ship'.
  makeKnownP('hat');
  assert.ok(learningWords(st).includes('bat'), 'tricky on-level word reintroduced on exhaustion');
  assert.ok(!learningWords(st).includes('ship'), 'did not reach above level while a tricky word was available');
  assert.equal(st.level, 1, 'did not level up while an on-level tricky word was available');
});

test('demoteLevel parks above-level words as tricky, lowers the level, and refills from below', () => {
  const st = createCategoryState({ setSize: 3, level: 2 });
  fillLearning(st, POOL); // tier-2 words: ship, shop, fish
  assert.equal(st.level, 2);
  demoteLevel(st, POOL);
  assert.equal(st.level, 1);
  assert.equal(learningWords(st).length, 3);
  // the tier-2 words it could no longer hold became tricky; learning now holds tier-1 words
  assert.ok(learningWords(st).every((w) => POOL.find((p) => p.word === w).tier <= 1));
  assert.ok(trickyWords(st).length >= 1);
});

test('promoteLevel raises the level so newly-freed slots draw from a higher tier', () => {
  const st = fresh(); // level 1
  promoteLevel(st, POOL);
  assert.equal(st.level, 2);
});

test('learningProgress reports a 2-step progress toward known for each learning word', () => {
  const st = fresh();
  recordCraft(st, 'cat', true, { pool: POOL });
  const prog = learningProgress(st);
  assert.equal(prog.length, 3);
  const cat = prog.find((p) => p.word === 'cat');
  assert.equal(cat.needed, PROMOTE_STREAK);
  assert.equal(cat.steps, 1); // one correct in a row so far
});

test('categorySummary reports learning list + known/mastered/tricky/new-remaining tallies', () => {
  const st = fresh();
  makeKnown(st, 'cat');
  recordDraw(st, 'cat', true); // master it
  const s = categorySummary(st, POOL);
  assert.equal(s.known, 0); // cat moved on to mastered
  assert.equal(s.mastered, 1);
  assert.equal(s.learning.length, 3);
  // newRemaining = pool words never encountered yet
  assert.equal(typeof s.newRemaining, 'number');
  assert.ok(s.newRemaining >= 0);
  assert.ok(Array.isArray(s.tricky)); // present in the data; the SCREEN gates it to grown-ups
});

test('serialize → deserialize is a lossless round-trip of the whole state machine', () => {
  const st = fresh();
  makeKnown(st, 'cat');
  recordDraw(st, 'cat', true);
  recordCraft(st, 'bat', false, { pool: POOL });
  const round = deserializeCategoryState(JSON.parse(JSON.stringify(serializeCategoryState(st))));
  assert.equal(round.setSize, st.setSize);
  assert.equal(round.level, st.level);
  assert.deepEqual(masteredWords(round).sort(), masteredWords(st).sort());
  assert.deepEqual(knownWords(round).sort(), knownWords(st).sort());
  assert.deepEqual(learningWords(round).sort(), learningWords(st).sort());
  assert.deepEqual(unlocks(round), unlocks(st));
});
