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
  setLevelAndRefill,
  seedFromPlacement,
  unlocks,
  learningProgress,
  categorySummary,
  cavernLevels,
  repairWords,
  needsRepair,
  serializeCategoryState,
  deserializeCategoryState,
} from '../src/engine/categories.js';

// A small, dense fixture pool: 5 tier-1 (short-a), 4 tier-2 (sh), 3 tier-3 (ight).
const POOL = [
  { word: 'cat', band: 1, pattern: 'short-a', rank: 1 },
  { word: 'bat', band: 1, pattern: 'short-a', rank: 2 },
  { word: 'hat', band: 1, pattern: 'short-a', rank: 3 },
  { word: 'map', band: 1, pattern: 'short-a', rank: 4 },
  { word: 'rat', band: 1, pattern: 'short-a', rank: 5 },
  { word: 'ship', band: 2, pattern: 'sh', rank: 6 },
  { word: 'shop', band: 2, pattern: 'sh', rank: 7 },
  { word: 'fish', band: 2, pattern: 'sh', rank: 8 },
  { word: 'dish', band: 2, pattern: 'sh', rank: 9 },
  { word: 'light', band: 3, pattern: 'ight', rank: 10 },
  { word: 'night', band: 3, pattern: 'ight', rank: 11 },
  { word: 'right', band: 3, pattern: 'ight', rank: 12 },
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

// §4 caps (Ian 2026-06-22d): proper nouns are stored CAPITALIZED in the data ("Williams"), but the
// UI spells/records them LOWERCASED (modes/puzzle.js does entry.word.toLowerCase()). The category
// machine must treat the word case-INSENSITIVELY so fillLearning (cased pool entry) and recordCraft
// (lowercased target) hit the SAME record — otherwise a proper noun splits into a stuck "Williams"
// learning record + a phantom "williams" known record (the v56 capitalization bug).
test('a proper noun (capitalized in data) is ONE record across fill + lowercased craft (no case split)', () => {
  const POOL2 = [{ word: 'Sam', band: 1, pattern: 'short-a', rank: 0 }, ...POOL]; // rank 0 → served first
  const st = createCategoryState({ setSize: 3, level: 1 });
  fillLearning(st, POOL2); // creates a 'Sam' learning record (lowest-rank new word in band 1)
  assert.ok(learningWords(st).some((w) => w.toLowerCase() === 'sam'), 'Sam should be in the learning set');
  recordCraft(st, 'sam', true, { pool: POOL2 }); // the UI crafts with the LOWERCASED target
  recordCraft(st, 'sam', true, { pool: POOL2 }); // 2 in a row → known
  const recs = [...st.words.values()].filter((r) => r.word.toLowerCase() === 'sam');
  assert.equal(recs.length, 1, 'a proper noun must not split into two case-variant records');
  assert.equal(recs[0].category, CATEGORIES.KNOWN, 'the lowercased craft must progress the SAME record');
  assert.equal(getCat(st, 'Sam'), CATEGORIES.KNOWN); // lookups are case-insensitive either way
  assert.equal(getCat(st, 'sam'), CATEGORIES.KNOWN);
});

// §36 D4 (Ian 2026-06-22d): the cavern MAP is the BAND axis (~97 cavern levels). cavernLevels maps
// every band to a status for the scrollable map: current (= state.level), locked (deeper, not yet
// reached), and for shallower bands — skipped (a placement jump left it untouched → go back and
// master it), reached (some words engaged) or cleared (all words known/mastered).
test('cavernLevels maps each band to current / skipped / locked with per-band tallies', () => {
  const st = createCategoryState({ setSize: 3, level: 3 });
  fillLearning(st, POOL); // band-3 words become learning; bands 1,2 untouched (skipped)
  const map = cavernLevels(st, POOL);
  assert.equal(map.length, 3); // maxBand = 3
  assert.deepEqual(map.map((l) => l.status), ['skipped', 'skipped', 'current']);
  assert.deepEqual(map.map((l) => l.total), [5, 4, 3]);
  assert.deepEqual(map.map((l) => l.band), [1, 2, 3]);
});

test('cavernLevels: an engaged lower band is "reached", a fully-known one is "cleared"; deeper is "locked"', () => {
  const st = createCategoryState({ setSize: 10, level: 3 });
  recordCraft(st, 'cat', false); // engage band 1 (no pool → no refill side-effects), not done yet
  let map = cavernLevels(st, POOL);
  assert.equal(map[0].status, 'reached');
  assert.equal(map[0].done, 0);
  for (const w of ['cat', 'bat', 'hat', 'map', 'rat']) { recordCraft(st, w, true); recordCraft(st, w, true); }
  map = cavernLevels(st, POOL);
  assert.equal(map[0].status, 'cleared');
  assert.equal(map[0].done, 5);
  // a band deeper than the current level is always locked
  const st2 = createCategoryState({ setSize: 3, level: 1 });
  fillLearning(st2, POOL);
  assert.deepEqual(cavernLevels(st2, POOL).map((l) => l.status), ['current', 'locked', 'locked']);
});

test('cavernLevels: dropping back below the frontier (peakLevel) keeps the deeper reached levels unlocked', () => {
  // reached level 3 (peakLevel 3), then dropped back to level 1 (e.g. tapped an easier level on the map)
  const st = createCategoryState({ setSize: 3, level: 1 });
  st.peakLevel = 3;
  const map = cavernLevels(st, POOL);
  assert.equal(map[0].status, 'current'); // band 1 = where we are now
  // bands 2 and 3 are within the frontier → NOT locked (still navigable), shown as skipped/reached
  assert.notEqual(map[1].status, 'locked');
  assert.notEqual(map[2].status, 'locked');
});

// ---- §36 C3: repair (cracked words) reconciles with the craft-streak pips ----
test('a NEVER-correct learning word is NOT repair (it is new learning, not a regression)', () => {
  const st = fresh();
  recordCraft(st, 'cat', false, { pool: POOL }); // missed on first attempt
  assert.equal(needsRepair(st.words.get('cat')), false);
  assert.deepEqual(repairWords(st), []);
});

test('a word correct ONCE then missed needs repair (got it, lost it)', () => {
  const st = fresh();
  recordCraft(st, 'cat', true, { pool: POOL }); // streak 1, correct 1
  assert.equal(needsRepair(st.words.get('cat')), false); // making progress, not repair
  recordCraft(st, 'cat', false, { pool: POOL }); // streak reset to 0, correct still 1
  assert.equal(needsRepair(st.words.get('cat')), true);
  assert.deepEqual(repairWords(st), ['cat']);
});

test('a KNOWN word demoted by a craft miss becomes a repair word (a cracked crystal)', () => {
  const st = fresh();
  makeKnown(st, 'cat'); // → known
  assert.equal(getCat(st, 'cat'), CATEGORIES.KNOWN);
  recordCraft(st, 'cat', false, { pool: POOL }); // craft miss demotes known → learning
  assert.equal(getCat(st, 'cat'), CATEGORIES.LEARNING);
  assert.ok(repairWords(st).includes('cat')); // it had correct crafts, now streak 0 → repair
});

test('learningProgress carries a needsRepair flag that matches repairWords + summary.repair', () => {
  const st = fresh();
  recordCraft(st, 'cat', true, { pool: POOL });
  recordCraft(st, 'cat', false, { pool: POOL }); // cat now needs repair
  const prog = learningProgress(st);
  const catRow = prog.find((p) => p.word === 'cat');
  assert.equal(catRow.needsRepair, true);
  assert.equal(prog.filter((p) => p.needsRepair).length, repairWords(st).length);
  const sum = categorySummary(st, POOL);
  assert.deepEqual(sum.repair, repairWords(st));
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
    { word: 'cat', band: 1, pattern: 'short-a', rank: 1 },
    { word: 'bat', band: 1, pattern: 'short-a', rank: 2 },
    { word: 'ship', band: 2, pattern: 'sh', rank: 6 },
    { word: 'shop', band: 2, pattern: 'sh', rank: 7 },
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
    { word: 'cat', band: 1, pattern: 'short-a', rank: 1 },
    { word: 'bat', band: 1, pattern: 'short-a', rank: 2 },
    { word: 'hat', band: 1, pattern: 'short-a', rank: 3 },
    { word: 'map', band: 1, pattern: 'short-a', rank: 4 },
    { word: 'ship', band: 2, pattern: 'sh', rank: 9 },
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
  // the band-2 words it could no longer hold became tricky; learning now holds band-1 words
  assert.ok(learningWords(st).every((w) => POOL.find((p) => p.word === w).band <= 1));
  assert.ok(trickyWords(st).length >= 1);
});

test('promoteLevel raises the level so newly-freed slots draw from a higher tier', () => {
  const st = fresh(); // level 1
  promoteLevel(st, POOL);
  assert.equal(st.level, 2);
});

test('setLevelAndRefill re-aims the set: old learning words → tricky, refilled from the new level', () => {
  const st = createCategoryState({ setSize: 3, level: 1 });
  fillLearning(st, POOL); // tier-1 learning words
  const oldLearning = learningWords(st);
  assert.ok(oldLearning.length === 3);
  setLevelAndRefill(st, 2, POOL);
  assert.equal(st.level, 2);
  oldLearning.forEach((w) => assert.equal(getCat(st, w), CATEGORIES.TRICKY)); // set aside
  assert.equal(learningWords(st).length, 3); // refilled
  assert.ok(learningWords(st).every((w) => POOL.find((p) => p.word === w).band === 2)); // from the new level
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

// §36 next-step #2 (Ian 2026-06-22c): the Progress tile shows "words to next LEVEL" — words in
// the CURRENT cavern level (band === state.level) the child hasn't yet learned (known/mastered),
// NOT the old mastery-depth count. It reaches 0 when every word in the band is learned.
test('categorySummary.toNextLevel = words in the current cavern level (band) not yet known/mastered', () => {
  const st = fresh(); // level 1; band 1 has 5 words (cat,bat,hat,map,rat), none learned yet
  let s = categorySummary(st, POOL);
  assert.equal(s.level, 1);
  assert.equal(s.toNextLevel, 5); // all 5 band-1 words still to learn
  makeKnown(st, 'cat'); // cat → known (counts as learned)
  s = categorySummary(st, POOL);
  assert.equal(s.toNextLevel, 4);
  recordDraw(st, 'cat', true); // cat → mastered (still learned)
  makeKnown(st, 'bat'); // bat → known
  s = categorySummary(st, POOL);
  assert.equal(s.toNextLevel, 3); // 2 of 5 band-1 words learned
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

// §C1 placement (Ian 2026-06-22b): the diagnostic PLACES a level — it must NOT claim mastery.
// seedFromPlacement aims the working set at the entered band; words BELOW the band are skipped
// (tested out by the high level, NOT marked known/mastered — a single craft isn't proof); words
// AT/above the band become live LEARNING with at most a 1-pip partial (a clean build = 1 of 2).
test('seedFromPlacement places the level without crediting known/mastered for single crafts', () => {
  const st = createCategoryState({ setSize: 3 });
  const responses = [
    { word: 'cat', correct: true, band: 1 }, // below band → skipped (NOT known)
    { word: 'ship', correct: true, band: 2 }, // AT band → learning, 1 pip
    { word: 'shop', correct: false, band: 2 }, // AT band miss → learning, streak 0
    { word: 'map', correct: false, band: 1 }, // below band → skipped (NOT tricky)
  ];
  seedFromPlacement(st, responses, 2, POOL);
  assert.equal(st.level, 2);
  // below-band words are NOT recorded — they stay NEW, never claimed as known/mastered
  assert.equal(getCat(st, 'cat'), CATEGORIES.NEW);
  assert.equal(getCat(st, 'map'), CATEGORIES.NEW);
  // NOTHING is known or mastered straight out of the diagnostic
  assert.equal(knownWords(st).length, 0);
  assert.equal(masteredWords(st).length, 0);
  // at-band words are live learning with a partial (clean = 1 pip, miss = 0)
  assert.equal(getCat(st, 'ship'), CATEGORIES.LEARNING);
  assert.equal(st.words.get('ship').craftStreak, 1);
  assert.equal(st.words.get('shop').craftStreak, 0);
  assert.equal(learningWords(st).length, 3); // filled at band 2 (ship/shop/fish)
  assert.ok(learningWords(st).every((w) => POOL.find((p) => p.word === w).band === 2));
});

// §C1 backward-compat: profiles saved BEFORE the band change carry an age `tier` on
// each record (no `band`) and stored `level` as an age-tier. Deserialize must derive
// each record's band from its `rank` and re-anchor `level` to the deepest LEARNING
// band so band-based refill continues from the child's real frontier (never lost).
test('§C1 migration: a pre-band saved profile derives bands from rank + re-anchors level', () => {
  const legacy = {
    setSize: 3,
    level: 5, // an OLD age-tier value (1–9), NOT a band
    recent: [],
    order: 3,
    peakKnownish: 1,
    peakMastered: 0,
    words: [
      { word: 'apple', tier: 4, rank: 200, pattern: 'x', category: 'known', craftStreak: 2, craftAttempts: 2, craftCorrect: 2, order: 1 },
      { word: 'planet', tier: 5, rank: 905, pattern: 'y', category: 'learning', craftStreak: 1, craftAttempts: 1, craftCorrect: 1, order: 2 },
      { word: 'gem', tier: 5, rank: 950, pattern: 'z', category: 'learning', craftStreak: 0, craftAttempts: 0, craftCorrect: 0, order: 3 },
    ],
  };
  const st = deserializeCategoryState(legacy);
  // band = floor((rank-1)/30)+1 for each migrated record
  assert.equal(st.words.get('apple').band, 7); // rank 200
  assert.equal(st.words.get('planet').band, 31); // rank 905
  assert.equal(st.words.get('gem').band, 32); // rank 950
  // level re-anchored to the deepest LEARNING band (gem=32), not the stale age-tier 5
  assert.equal(st.level, 32);
  // categories preserved (progress not lost)
  assert.deepEqual(knownWords(st), ['apple']);
  assert.equal(learningWords(st).length, 2);
});
