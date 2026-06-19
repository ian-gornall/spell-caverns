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
  buildFirstWave,
} from '../src/engine/session.js';
import {
  MIN_CRAFT_PROOF,
  needsCraftConfirmation,
  isCraftConfirmed,
} from '../src/engine/progress.js';

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

test('difficulty still nudges word hardness: hard reaches harder new words than easy', () => {
  // In the target-first model the START LEVEL is the main difficulty driver, but the
  // preset still reaches further ahead on "hard" (lower masteryTarget) than on "easy".
  const t = createTracker();
  const words = grid(FIVE);
  const easy = buildSession(t, { difficulty: 'easy', length: 12, rng: mulberry32(2), words });
  const hard = buildSession(t, { difficulty: 'hard', length: 12, rng: mulberry32(2), words });
  assert.ok(avgPs(t, easy) > avgPs(t, hard) + 0.05, `easy ${avgPs(t, easy)} vs hard ${avgPs(t, hard)}`);
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

// --------------------------------------------------- target-first session model
test('the session always INCLUDES the craft-missed targets (repair is guaranteed)', () => {
  const words = pool([{ pattern: 'short-a', tier: 1, count: 40 }]);
  const t = createTracker();
  // miss three specific words -> they become targets
  const missed = [words[2].word, words[5].word, words[9].word];
  for (const w of missed) recordAnswer(t, w, false, { responseMs: 5000 });
  const s = buildSession(t, { difficulty: 'easy', length: 10, rng: mulberry32(5), words });
  const got = new Set(s.map((w) => w.word));
  for (const m of missed) assert.ok(got.has(m), `target "${m}" should be in the session`);
});

// ----------------------------------------------- chosen LEVEL drives the content (§21-A/B/C)
test('the chosen start level drives what new words are served', () => {
  // a dense pool (8 words per tier) so there's plenty of material at every level
  const words = pool(Array.from({ length: 9 }, (_, i) => ({ pattern: 'short-a', tier: i + 1, count: 8 })));
  const t = createTracker();
  const low = buildSession(t, { difficulty: 'easy', length: 12, rng: mulberry32(11), words, startTier: 1 });
  const high = buildSession(t, { difficulty: 'easy', length: 12, rng: mulberry32(11), words, startTier: 8 });
  const avgTier = (s) => s.reduce((a, w) => a + w.tier, 0) / s.length;
  assert.ok(avgTier(high) > avgTier(low) + 2, `high level should serve harder tiers: ${avgTier(high)} vs ${avgTier(low)}`);
  assert.ok(high.every((w) => w.tier >= 8), 'a high start level should not serve baby (low-tier) words');
});

test('chosen-level new material LEADS but craft-missed targets are still reserved a place', () => {
  // 40 easy words; only ONE craft-missed target. The session must lead with fresh
  // chosen-level words AND still include the single target (reserved repair slot).
  const words = pool([{ pattern: 'short-a', tier: 1, count: 40 }]);
  const t = createTracker();
  const target = words[7].word;
  recordAnswer(t, target, false, { responseMs: 5000, source: 'craft' });
  const s = buildSession(t, { difficulty: 'easy', length: 10, rng: mulberry32(12), words });
  assert.ok(s.some((w) => w.word === target), 'the one craft-missed target is reserved a slot');
  const fresh = s.filter((w) => !getRecord(t, w.word)).length;
  assert.ok(fresh >= 5, `most of the session should be fresh chosen-level material, got ${fresh}/10`);
});

// ------------------------------------------------- guaranteed-win FIRST wave honours level
test('buildFirstWave honours the chosen start level (no tier-1 baby words at high levels)', () => {
  // SHORT spellable words (buildFirstWave filters to 3–8 letters), 6 per tier 1..9
  const words = [];
  let rank = 1;
  for (let tr = 1; tr <= 9; tr++) for (let k = 0; k < 6; k++) words.push({ word: `wx${tr}${k}`, rank: rank++, tier: tr, pattern: 'p' });
  const low = buildFirstWave(words, { startTier: 1, length: 5, rng: mulberry32(1) });
  const high = buildFirstWave(words, { startTier: 7, length: 5, rng: mulberry32(1) });
  assert.equal(low.length, 5);
  assert.equal(high.length, 5);
  assert.ok(low.every((w) => w.tier <= 2), `a "just starting" first wave stays easy, got ${low.map((w) => w.tier)}`);
  assert.ok(high.every((w) => w.tier >= 7), `a high-level first wave reflects the level, got ${high.map((w) => w.tier)}`);
});

test('buildFirstWave never starves: falls back to easy words when a tier is too thin', () => {
  // only a couple of words at the very top tier — must still return `length` words
  const words = pool([
    { pattern: 'short-a', tier: 1, count: 12 },
    { pattern: 'ai-ay', tier: 9, count: 2 },
  ]);
  const s = buildFirstWave(words, { startTier: 9, length: 5, rng: mulberry32(3) });
  assert.equal(s.length, 5, 'tops up from easier words rather than returning a short wave');
});

test('correct-first-time words are PARKED while there is fresh material to do', () => {
  const words = pool([{ pattern: 'short-a', tier: 1, count: 40 }]);
  const t = createTracker();
  const known = words[0].word;
  recordAnswer(t, known, true, { responseMs: 500 }); // nailed first try -> parked (not a target)
  // plenty of never-seen words remain, so the parked word should not be re-served
  const s = buildSession(t, { difficulty: 'easy', length: 10, rng: mulberry32(6), words });
  assert.ok(!s.some((w) => w.word === known), 'a parked correct word waits while new words exist');
  assert.ok(s.every((w) => !getRecord(t, w.word)), 'the session is fresh/new material');
});

test('known words DO come back once there is nothing new and no targets left', () => {
  // tiny pool: every word seen + answered correctly (parked), none new, none targets
  const words = pool([{ pattern: 'short-a', tier: 1, count: 5 }]);
  const t = createTracker();
  for (const w of words) recordAnswer(t, w.word, true, { responseMs: 500 });
  for (let i = 0; i < 40; i++) recordAnswer(t, `filler_${i}`, true, { responseMs: 500 }); // rest them
  const s = buildSession(t, { difficulty: 'easy', length: 5, rng: mulberry32(7), words });
  assert.ok(s.length > 0, 'falls back to due/known words rather than an empty session');
  assert.ok(s.every((w) => getRecord(t, w.word)), 'only the known pool words are available');
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

// -------------------------------------------------------- craft-proof surfacing
// Words answered correctly by crafting once but fewer than MIN_CRAFT_PROOF times are
// NOT yet "craft-proven". They should be surfaced BEFORE brand-new words so the learner
// gets a quick follow-up proof attempt (the key pedagogy: recognition ≠ production —
// one correct doesn't prove spelling mastery). They should come AFTER repair targets
// (words with recent misses) since repair is the highest priority.

test('a once-correct crafted word (needs confirmation) is included despite plenty of new words', () => {
  // pool: 30 never-seen words + 1 word with exactly 1 craft-correct (needs confirmation)
  // The confirmation word must be reserved a slot even though new material could fill all 10.
  const words = pool([{ pattern: 'short-a', tier: 3, count: 31 }]);
  const t = createTracker();
  const confirmMe = words[0].word;
  recordAnswer(t, confirmMe, true, { responseMs: 500, source: 'craft' }); // 1 correct, needs proof
  assert.equal(needsCraftConfirmation(t, confirmMe), true, 'precondition: word needs confirmation');

  // give it a moment to rest past its short cooldown
  for (let i = 0; i < 15; i++) recordAnswer(t, `filler_${i}`, true, { responseMs: 500 });

  const s = buildSession(t, { difficulty: 'easy', length: 10, rng: mulberry32(50), words });
  const idx = s.findIndex((w) => w.word === confirmMe);
  // Must appear — confirmation words are reserved a slot, not crowded out by new material
  assert.ok(idx >= 0, 'the needs-confirmation word appears in the session even with 30 new words available');

  // The session should still have mostly fresh material (confirmation takes only 1-2 slots)
  const freshCount = s.filter((w) => !getRecord(t, w.word)).length;
  assert.ok(freshCount >= 6, `most of the session should be fresh material, got ${freshCount}/10`);
});

test('needs-confirmation words appear in the session even when there are plenty of new words', () => {
  // 50 never-seen words of various tiers; 3 words each with exactly 1 craft-correct
  const words = pool([{ pattern: 'short-a', tier: 2, count: 53 }]);
  const t = createTracker();
  const toConfirm = [words[0].word, words[1].word, words[2].word];
  for (const w of toConfirm) recordAnswer(t, w, true, { responseMs: 500, source: 'craft' });
  // rest them past cooldown
  for (let i = 0; i < 15; i++) recordAnswer(t, `filler_${i}`, true, { responseMs: 500 });

  const s = buildSession(t, { difficulty: 'easy', length: 12, rng: mulberry32(51), words });
  const included = toConfirm.filter((w) => s.some((sw) => sw.word === w));
  assert.ok(included.length >= 2, `at least 2 of 3 needs-confirmation words should appear, got ${included.length}`);
});

test('craft-confirmed words (isCraftConfirmed) are NOT pulled early — they follow the normal cooldown', () => {
  // A word with MIN_CRAFT_PROOF correct answers is craft-confirmed and should not be
  // special-cased by the confirmation bucket — it should rest normally.
  const words = pool([{ pattern: 'short-a', tier: 2, count: 30 }]);
  const t = createTracker();
  const confirmed = words[0].word;
  for (let i = 0; i < MIN_CRAFT_PROOF; i++) recordAnswer(t, confirmed, true, { responseMs: 500 });
  assert.equal(isCraftConfirmed(t, confirmed), true, 'precondition: word is craft-confirmed');

  // check it is NOT in the needs-confirmation bucket (the cooldown should govern it)
  assert.equal(needsCraftConfirmation(t, confirmed), false, 'craft-confirmed word is NOT in needs-confirmation');

  // right after confirmation, it should be resting (cooldown active)
  const s = buildSession(t, { difficulty: 'easy', length: 10, rng: mulberry32(52), words });
  assert.ok(!s.some((w) => w.word === confirmed), 'just-confirmed word should be resting, not in the very next session');
});

test('repair targets (craft misses) take priority over needs-confirmation words', () => {
  // target = missed craft word; toConfirm = single-correct craft word; new = never seen
  // Order must be: target first, then toConfirm, then new
  const words = pool([{ pattern: 'short-a', tier: 2, count: 30 }]);
  const t = createTracker();
  const target = words[0].word;
  const toConfirm = words[1].word;
  recordAnswer(t, target, false, { responseMs: 5000, source: 'craft' }); // target (missed)
  recordAnswer(t, toConfirm, true, { responseMs: 500, source: 'craft' }); // needs confirmation
  // rest toConfirm past its short cooldown
  for (let i = 0; i < 15; i++) recordAnswer(t, `filler_${i}`, true, { responseMs: 500 });

  const s = buildSession(t, { difficulty: 'easy', length: 10, rng: mulberry32(53), words });
  const idxTarget = s.findIndex((w) => w.word === target);
  const idxConfirm = s.findIndex((w) => w.word === toConfirm);
  assert.ok(idxTarget >= 0, 'repair target is in the session');
  assert.ok(idxConfirm >= 0, 'needs-confirmation word is in the session');
  // Both present; the ordering bucket matters: target should have been added earlier
  // (targets are added at step b, confirmation at step b2, before new material at step c)
  assert.ok(idxTarget <= idxConfirm, `target (idx ${idxTarget}) should be ahead of confirmation (idx ${idxConfirm})`);
});
