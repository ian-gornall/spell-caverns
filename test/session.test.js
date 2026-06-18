// test/session.test.js — locks in the two-axis session/level builder
// (src/engine/session.js). Runs under `node --test` (no browser).
//
// Difficulty is two ORTHOGONAL axes (HANDOFF §4 + the design chat):
//   - patternSpread : how many spelling patterns the session mixes (interleaving /
//                     discriminative contrast); rising spread prefers CONFUSABLE
//                     families and shifts ordering blocked → interleaved.
//   - masteryTarget : the average "learning score" (predicted success) of the
//                     words pulled in (desirable difficulty / retrieval strength).
// easy/medium/hard are presets = points in that 2-D space; an advanced screen can
// pass custom {patternSpread, masteryTarget}. Harder difficulties UNLOCK with
// demonstrated mastery (the game never force-bumps).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { byRank } from '../src/engine/lexicon.js';
import { mulberry32 } from '../src/engine/distractors.js';
import {
  createTracker,
  recordAnswer,
  predictedSuccess,
  tierToPrior,
  getRecord,
  summary,
  isEligible,
} from '../src/engine/progress.js';
import {
  DIFFICULTY_PRESETS,
  UNLOCK_THRESHOLDS,
  resolveDifficulty,
  unlockedDifficulties,
  isUnlocked,
  buildSession,
  buildReviewSession,
} from '../src/engine/session.js';

// --- synthetic word pools (only word/rank/tier/pattern matter to the builder) ---
function pool(spec) {
  const words = [];
  let rank = 1;
  for (const s of spec) {
    for (let k = 0; k < s.count; k++) {
      words.push({ word: `${s.pattern}_t${s.tier}_${k}`, rank: rank++, tier: s.tier, pattern: s.pattern });
    }
  }
  return words;
}
// a full grid: each pattern has 4 words at every tier 1..9
function grid(patterns) {
  const spec = [];
  for (const p of patterns) for (let t = 1; t <= 9; t++) spec.push({ pattern: p, tier: t, count: 4 });
  return pool(spec);
}
const FIVE = ['short-a', 'ai-ay', 'ee-ea', 'r-ar', 'tion'];

const distinctPatterns = (s) => new Set(s.map((w) => w.pattern)).size;
const avgPs = (tracker, s) =>
  s.reduce((sum, w) => sum + predictedSuccess(tracker, w.word, tierToPrior(w.tier)), 0) / s.length;

// seed `n` distinct words to the "known" bucket (2 fast-correct answers each)
function seedKnown(tracker, n) {
  for (let i = 0; i < n; i++) {
    recordAnswer(tracker, `known_${i}`, true, { responseMs: 500 });
    recordAnswer(tracker, `known_${i}`, true, { responseMs: 500 });
  }
}

// ------------------------------------------------------------ resolveDifficulty
test('resolveDifficulty maps presets and passes through clamped custom axes', () => {
  for (const name of ['easy', 'medium', 'hard']) {
    const a = resolveDifficulty(name);
    assert.deepEqual(a, {
      patternSpread: DIFFICULTY_PRESETS[name].patternSpread,
      masteryTarget: DIFFICULTY_PRESETS[name].masteryTarget,
    });
  }
  // custom object passes through, clamped to 0..1
  assert.deepEqual(resolveDifficulty({ patternSpread: 2, masteryTarget: -1 }), {
    patternSpread: 1,
    masteryTarget: 0,
  });
  // unknown name falls back to easy
  assert.deepEqual(resolveDifficulty('bogus'), resolveDifficulty('easy'));
});

// ------------------------------------------------------------------- unlocking
test('only easy is unlocked at the start; medium/hard unlock with mastery', () => {
  const t = createTracker();
  assert.deepEqual(unlockedDifficulties(t), ['easy']);
  assert.ok(!isUnlocked(t, 'medium'));

  seedKnown(t, UNLOCK_THRESHOLDS.medium);
  assert.ok(isUnlocked(t, 'medium'));
  assert.ok(!isUnlocked(t, 'hard'));

  seedKnown(t, UNLOCK_THRESHOLDS.hard); // now well past the hard gate
  assert.ok(isUnlocked(t, 'hard'));
  assert.deepEqual(unlockedDifficulties(t), ['easy', 'medium', 'hard']);
});

test('unlocks ratchet — they never regress when mastery later dips (QA I5)', () => {
  const t = createTracker();
  seedKnown(t, UNLOCK_THRESHOLDS.hard);
  assert.deepEqual(unlockedDifficulties(t), ['easy', 'medium', 'hard'], 'hard should be unlocked');
  // Recency-weighted mastery can collapse the LIVE known count (e.g. a rough day),
  // but a difficulty the learner already earned must stay open.
  for (let i = 0; i < UNLOCK_THRESHOLDS.hard; i++) {
    for (let k = 0; k < 6; k++) recordAnswer(t, `known_${i}`, false, { responseMs: 4000 });
  }
  assert.equal(summary(t).counts.known, 0, 'live known count should have collapsed');
  assert.deepEqual(
    unlockedDifficulties(t),
    ['easy', 'medium', 'hard'],
    'unlocks must not regress after the dip',
  );
});

// ------------------------------------------------------------- the two axes
test('patternSpread axis: easy draws one pattern, hard mixes several', () => {
  const t = createTracker();
  const words = grid(FIVE);
  const easy = buildSession(t, { difficulty: 'easy', length: 12, rng: mulberry32(1), words });
  const hard = buildSession(t, { difficulty: 'hard', length: 12, rng: mulberry32(1), words });
  assert.equal(distinctPatterns(easy), 1, 'easy should be a single (blocked) pattern');
  assert.ok(distinctPatterns(hard) >= 3, `hard should mix patterns, got ${distinctPatterns(hard)}`);
});

test('masteryTarget axis: easy words are easier (higher predicted success) than hard', () => {
  const t = createTracker();
  const words = grid(FIVE);
  const easy = buildSession(t, { difficulty: 'easy', length: 12, rng: mulberry32(2), words });
  const hard = buildSession(t, { difficulty: 'hard', length: 12, rng: mulberry32(2), words });
  assert.ok(avgPs(t, easy) > avgPs(t, hard) + 0.15, `easy ${avgPs(t, easy)} vs hard ${avgPs(t, hard)}`);
});

test('buildSession returns exactly `length` words', () => {
  const t = createTracker();
  const words = grid(FIVE);
  assert.equal(buildSession(t, { difficulty: 'medium', length: 8, rng: mulberry32(3), words }).length, 8);
  assert.equal(buildSession(t, { difficulty: 'hard', length: 15, rng: mulberry32(3), words }).length, 15);
});

// ----------------------------------------------------------------- ordering
test('hard interleaves patterns (adjacent words usually differ)', () => {
  const t = createTracker();
  const words = grid(FIVE);
  const hard = buildSession(t, { difficulty: 'hard', length: 12, rng: mulberry32(4), words });
  let same = 0;
  let diff = 0;
  for (let i = 1; i < hard.length; i++) (hard[i].pattern === hard[i - 1].pattern ? same++ : diff++);
  assert.ok(diff > same, `expected mostly interleaved, got diff=${diff} same=${same}`);
});

// ------------------------------------------------------------------- review
test('a session opens with previously-seen words that are DUE for review', () => {
  const t = createTracker();
  const words = grid(FIVE);
  // make all tier-5 words "seen" — hard (target ~0.5) targets that band
  for (const w of words.filter((w) => w.tier === 5)) recordAnswer(t, w.word, true, { responseMs: 1500 });
  // Let them REST: play many throwaway words so the seen words pass their spacing
  // cooldown and become due for a confirming revisit (spacing requirement).
  for (let i = 0; i < 40; i++) recordAnswer(t, `filler_${i}`, true, { responseMs: 1500 });
  const s = buildSession(t, { difficulty: 'hard', length: 12, rng: mulberry32(5), words });
  const reviewCount = Math.round(12 * 0.3); // REVIEW_FRACTION
  for (let i = 0; i < reviewCount; i++) {
    assert.ok(getRecord(t, s[i].word), `position ${i} should be a seen/review word`);
  }
});

// -------------------------------------------------------- confusable patterns
test('rising spread prefers confusable families over unrelated ones', () => {
  const t = createTracker();
  // target tier 3 band. ai-ay has the most band words (chosen first); its confusable
  // cluster-mate silent-e-a has fewer band words than the unrelated short-a — yet the
  // 2nd slot should still prefer the cluster-mate for discrimination practice.
  const words = pool([
    { pattern: 'ai-ay', tier: 3, count: 8 },
    { pattern: 'short-a', tier: 3, count: 5 },
    { pattern: 'silent-e-a', tier: 3, count: 2 },
  ]);
  const s = buildSession(t, {
    difficulty: { patternSpread: 0.25, masteryTarget: 0.75 }, // ~2 patterns, tier-3 target
    length: 10,
    rng: mulberry32(6),
    words,
  });
  const pats = new Set(s.map((w) => w.pattern));
  assert.ok(pats.has('ai-ay'), 'should include the richest pattern');
  assert.ok(pats.has('silent-e-a'), 'should prefer the confusable cluster-mate');
  assert.ok(!pats.has('short-a'), 'should NOT pick the unrelated pattern over the cluster-mate');
});

// ----------------------------------------------------------------- determinism
test('same seed yields the same session', () => {
  const t = createTracker();
  const words = grid(FIVE);
  const a = buildSession(t, { difficulty: 'hard', length: 12, rng: mulberry32(2026), words });
  const b = buildSession(t, { difficulty: 'hard', length: 12, rng: mulberry32(2026), words });
  assert.deepEqual(a.map((w) => w.word), b.map((w) => w.word));
});

// ------------------------------------------------------ review ("cracked crystals")
test('buildReviewSession returns the missed words as full dataset entries', () => {
  const words = pool([
    { pattern: 'short-a', tier: 1, count: 5 },
    { pattern: 'ee-ea', tier: 2, count: 5 },
  ]);
  const t = createTracker();
  recordAnswer(t, words[0].word, false, { responseMs: 5000 }); // crack two
  recordAnswer(t, words[6].word, false, { responseMs: 5000 });
  recordAnswer(t, words[2].word, true, { responseMs: 400 }); // a clean one (not cracked)
  const s = buildReviewSession(t, { length: 6, words, rng: mulberry32(1) });
  const got = new Set(s.map((w) => w.word));
  assert.ok(got.has(words[0].word) && got.has(words[6].word), 'includes both cracked words');
  assert.ok(!got.has(words[2].word), 'a cleanly-answered word is not in the repair set');
  assert.ok(s.every((w) => typeof w.tier === 'number' && w.pattern), 'full entries, not bare words');
});

test('buildReviewSession only repairs — never pulls in brand-new words', () => {
  const words = pool([{ pattern: 'short-a', tier: 1, count: 10 }]);
  const t = createTracker();
  recordAnswer(t, words[0].word, false, { responseMs: 5000 }); // one cracked word, nothing else seen
  const s = buildReviewSession(t, { length: 6, words, rng: mulberry32(2) });
  assert.deepEqual(s.map((w) => w.word), [words[0].word], 'just the one cracked word, no fresh material');
});

// --------------------------------------- serve spacing (don't re-serve known words)
// The user's request: once a word is essentially known (high mastery), don't serve it
// again immediately — rest it for several sessions while fresh/unknown words fill the
// gap; revisit known words only over a long horizon. Unknown words must keep recurring.
test('a freshly-mastered word is not re-served in the very next session', () => {
  const words = pool([{ pattern: 'short-a', tier: 1, count: 40 }]);
  const t = createTracker();
  // master one specific word on a fast-correct answer
  const target = words[0].word;
  recordAnswer(t, target, true, { responseMs: 400 });
  // build several back-to-back sessions; the just-mastered word should rest
  let served = false;
  for (let s = 0; s < 2; s++) {
    const sess = buildSession(t, { difficulty: 'easy', length: 10, rng: mulberry32(100 + s), words });
    if (sess.some((w) => w.word === target)) served = true;
  }
  assert.equal(served, false, 'a just-mastered word must not reappear immediately');
});

test('an unknown/shaky word keeps coming back session after session', () => {
  const words = pool([{ pattern: 'short-a', tier: 1, count: 40 }]);
  const t = createTracker();
  const target = words[3].word;
  // the learner keeps missing it -> it must stay in frequent rotation
  let appearances = 0;
  for (let s = 0; s < 4; s++) {
    const sess = buildSession(t, { difficulty: 'easy', length: 10, rng: mulberry32(200 + s), words });
    if (sess.some((w) => w.word === target)) {
      appearances += 1;
      recordAnswer(t, target, false, { responseMs: 5000 }); // miss again
    } else {
      // not served this round; still count it as available by recording nothing
    }
  }
  assert.ok(appearances >= 2, `a missed word should recur often, saw it ${appearances}/4 sessions`);
});

test('a known word becomes eligible again after it has rested (long-horizon revisit)', () => {
  const words = pool([{ pattern: 'short-a', tier: 1, count: 12 }]);
  const t = createTracker();
  const target = words[0].word;
  recordAnswer(t, target, true, { responseMs: 400 }); // mastered
  assert.equal(isEligible(t, target), false, 'resting right after mastery');
  // play enough other words that its cooldown elapses
  for (let i = 0; i < 40; i++) recordAnswer(t, `filler_${i}`, true, { responseMs: 1500 });
  assert.equal(isEligible(t, target), true, 'eligible again after a long rest');
});

// ------------------------------------------------------- real-lexicon smoke
test('works on the real dataset: presets differ in spread and difficulty', () => {
  const t = createTracker();
  const easy = buildSession(t, { difficulty: 'easy', length: 12, rng: mulberry32(7) });
  const hard = buildSession(t, { difficulty: 'hard', length: 12, rng: mulberry32(7) });
  assert.equal(easy.length, 12);
  assert.equal(hard.length, 12);
  for (const w of [...easy, ...hard]) {
    assert.equal(typeof w.word, 'string');
    assert.ok(Number.isInteger(w.tier));
    assert.equal(typeof w.pattern, 'string');
  }
  assert.ok(distinctPatterns(hard) > distinctPatterns(easy), 'hard mixes more patterns than easy');
  assert.ok(avgPs(t, easy) > avgPs(t, hard), 'easy words are easier than hard words');
});
