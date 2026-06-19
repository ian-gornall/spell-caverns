// test/progress.test.js — locks in the CONTINUOUS mastery tracker
// (src/engine/progress.js). Runs under `node --test` (no browser).
//
// Per the design decision (HANDOFF §4): there is NO binary known/unknown. Mastery
// is a recency-weighted score per word that also factors response speed, plus a
// confidence that grows with attempts. Difficulty is OBSERVED — the tier/rank
// prior only bootstraps a word until enough responses accrue. These tests pin
// that model down. Both the cold-start assessment and live play feed this tracker
// identically (via seedFromAssessment / recordAnswer).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createTracker,
  recordAnswer,
  answerScore,
  mastery,
  confidence,
  getRecord,
  effectiveDifficulty,
  predictedSuccess,
  summary,
  seedFromAssessment,
  tierToPrior,
  serializeTracker,
  deserializeTracker,
  knownPeak,
  lapsedWords,
  serveCooldown,
  isEligible,
  serveOverdue,
  isTarget,
  targetWords,
  MIN_CRAFT_PROOF,
  needsCraftConfirmation,
  isCraftConfirmed,
} from '../src/engine/progress.js';

// ---------------------------------------------------------------- answerScore
// MASTERY is about ACCURACY, not speed (user 2026-06-18: "if a child is accurate, the
// speed really shouldn't matter"). So any correct answer is full credit regardless of how
// fast it was; only a wrong answer scores 0. (Speed still drives gems/praise in praise.js
// — the DDR fun layer — but it must NOT affect what's considered learned.)
test('answerScore: wrong is 0; ANY correct is full credit, speed irrelevant', () => {
  assert.equal(answerScore({ correct: false, responseMs: 300 }), 0);
  const fast = answerScore({ correct: true, responseMs: 500 });
  const mid = answerScore({ correct: true, responseMs: 3000 });
  const slow = answerScore({ correct: true, responseMs: 30000 });
  assert.equal(fast, 1, 'a fast-correct is full credit');
  assert.equal(slow, 1, 'a slow-correct is ALSO full credit — speed must not matter');
  assert.equal(fast, mid, 'speed makes no difference to mastery credit');
});

test('answerScore: a correct answer is full credit with or without timing info', () => {
  assert.equal(answerScore({ correct: true }), 1);
  assert.equal(answerScore({ correct: true, fast: false }), 1, 'slow flag still full credit');
  assert.equal(answerScore({ correct: false }), 0);
});

// --------------------------------------------- source: MINING vs CRAFTING (§21-A)
// Mastery is ESTABLISHED only by CRAFTING (production / building from letters). MINING
// (rhythm multiple-choice) is recognition — helpful practice for SPEED/engagement, but it
// must NEVER mark a word "known" or make it a target (recognition ≠ production; user
// 2026-06-18). So a 'mine' answer records a speed reading and nothing that affects the
// learning model; only crafting/assessment move mastery, confidence, attempts, targets.
test("a MINING answer never establishes mastery (no record, no target, no attempts)", () => {
  const t = createTracker();
  // a correct mine answer must NOT create a tracked/known word
  recordAnswer(t, 'cave', true, { responseMs: 400, source: 'mine' });
  assert.equal(getRecord(t, 'cave'), undefined, 'mining a new word tracks nothing for mastery');
  assert.equal(mastery(t, 'cave'), 0, 'mining never raises mastery');
  assert.equal(isTarget(t, 'cave'), false, 'a mined word is not a target');
  // a WRONG mine answer must NOT make the word a target either
  recordAnswer(t, 'gem', false, { responseMs: 5000, source: 'mine' });
  assert.equal(isTarget(t, 'gem'), false, 'a missed MINE answer does not create a target');
  assert.deepEqual(targetWords(t), [], 'mining contributes nothing to the working set');
  assert.equal(summary(t).counts.tracked, 0, 'mining does not pollute the progress buckets');
});

test('CRAFTING is the source of truth for mastery; a missed craft is a target', () => {
  const t = createTracker();
  recordAnswer(t, 'island', true, { responseMs: 3000, source: 'craft' }); // clean build -> known-ish
  recordAnswer(t, 'rhythm', false, { responseMs: 6000, source: 'craft' }); // missed build -> target
  assert.ok(mastery(t, 'island') >= 0.9, 'a clean crafted build raises mastery');
  assert.equal(isTarget(t, 'island'), false, 'a clean craft is not a target');
  assert.equal(isTarget(t, 'rhythm'), true, 'a missed craft IS a target');
  // crafting after mining: mining left no record, craft establishes it
  recordAnswer(t, 'cave', false, { responseMs: 5000, source: 'craft' });
  assert.equal(isTarget(t, 'cave'), true, 'crafting a word the kid keeps missing makes it a target');
});

test("mining records a SPEED reading on an already-CRAFTED word (no mastery change)", () => {
  const t = createTracker();
  recordAnswer(t, 'quartz', false, { responseMs: 6000, source: 'craft' }); // crafted, a target
  const before = { ...getRecord(t, 'quartz') };
  recordAnswer(t, 'quartz', true, { responseMs: 500, source: 'mine' }); // mine it fast
  const after = getRecord(t, 'quartz');
  assert.equal(after.attempts, before.attempts, 'mining does not add a mastery attempt');
  assert.equal(after.mastery, before.mastery, 'mining does not change mastery');
  assert.equal(isTarget(t, 'quartz'), true, 'still a target — only crafting can clear it');
  assert.ok(Number.isFinite(after.recentMs), 'mining did record a speed reading');
});

test("default (no source) stays mastery-bearing so assessment/legacy paths are unchanged", () => {
  const t = createTracker();
  recordAnswer(t, 'cat', true, { responseMs: 500 }); // no source -> mastery path
  assert.ok(mastery(t, 'cat') >= 0.9);
  assert.equal(getRecord(t, 'cat').attempts, 1);
});

// --------------------------------------------------------------- empty tracker
test('an unseen word has zero mastery/confidence and falls back to the prior', () => {
  const t = createTracker();
  assert.equal(mastery(t, 'nope'), 0);
  assert.equal(confidence(t, 'nope'), 0);
  assert.equal(getRecord(t, 'nope'), undefined);
  assert.equal(effectiveDifficulty(t, 'nope', 0.42), 0.42); // no data -> pure prior
});

// ---------------------------------------------------------------- recordAnswer
test('a first fast-correct answer sets high mastery and some confidence', () => {
  const t = createTracker();
  const rec = recordAnswer(t, 'cave', true, { responseMs: 500 });
  assert.equal(rec.attempts, 1);
  assert.ok(rec.mastery >= 0.9, `mastery ${rec.mastery}`);
  assert.ok(rec.confidence > 0 && rec.confidence < 1, `confidence ${rec.confidence}`);
});

test('mastery is recency-weighted: a miss drops it, later hits recover it', () => {
  const t = createTracker();
  recordAnswer(t, 'gem', true, { responseMs: 500 }); // ~1.0
  const afterHit = mastery(t, 'gem');
  recordAnswer(t, 'gem', false, { responseMs: 4000 }); // wrong -> pulls down
  const afterMiss = mastery(t, 'gem');
  recordAnswer(t, 'gem', true, { responseMs: 500 }); // recover
  const afterRecover = mastery(t, 'gem');
  assert.ok(afterMiss < afterHit, 'miss should lower mastery');
  assert.ok(afterRecover > afterMiss, 'a later hit should raise it again');
});

test('confidence grows monotonically with attempts', () => {
  const t = createTracker();
  let prev = 0;
  for (let i = 0; i < 5; i++) {
    recordAnswer(t, 'rock', true, { responseMs: 1500 });
    const c = confidence(t, 'rock');
    assert.ok(c > prev, `confidence not increasing at attempt ${i + 1}: ${c} <= ${prev}`);
    prev = c;
  }
  assert.ok(prev < 1, 'confidence should approach but not reach 1');
});

// ------------------------------------------------------- difficulty: prior->observed
test('effectiveDifficulty slides from prior toward observed as confidence accrues', () => {
  const t = createTracker();
  const prior = 1.0; // the dataset thinks this word is very hard
  // but the learner nails it repeatedly and fast -> observed difficulty is low
  for (let i = 0; i < 6; i++) recordAnswer(t, 'easy4him', true, { responseMs: 500 });
  const eff = effectiveDifficulty(t, 'easy4him', prior);
  assert.ok(eff < 0.15, `effectiveDifficulty should track observed (low), got ${eff}`);
  // predicted success is the complement and stays in range
  const ps = predictedSuccess(t, 'easy4him', prior);
  assert.ok(ps > 0.85 && ps <= 1, `predictedSuccess ${ps}`);
});

test('with one data point, difficulty is mostly still the prior', () => {
  const t = createTracker();
  recordAnswer(t, 'oneshot', true, { responseMs: 500 });
  const eff = effectiveDifficulty(t, 'oneshot', 0.9);
  // confidence after 1 attempt is ~0.5, so eff is a blend, not yet near observed(0)
  assert.ok(eff > 0.3 && eff < 0.9, `expected a blend, got ${eff}`);
});

// ----------------------------------------------------------------- tierToPrior
test('tierToPrior maps the tier band onto 0..1 monotonically', () => {
  assert.equal(tierToPrior(1), 0);
  assert.equal(tierToPrior(9), 1);
  assert.ok(tierToPrior(5) > tierToPrior(3) && tierToPrior(3) > tierToPrior(1));
});

// --------------------------------------------------------------------- summary
test('summary classifies into display buckets and counts everything tracked', () => {
  const t = createTracker();
  for (let i = 0; i < 5; i++) recordAnswer(t, 'mastered', true, { responseMs: 500 });
  for (let i = 0; i < 5; i++) recordAnswer(t, 'struggling', false, { responseMs: 5000 });
  const s = summary(t);
  assert.equal(s.counts.tracked, 2);
  assert.ok(s.known.includes('mastered'), 'high mastery+confidence -> known bucket');
  assert.ok(s.shaky.includes('struggling'), 'low mastery -> shaky bucket');
  assert.equal(s.counts.known + s.counts.learning + s.counts.shaky, 2);
});

// -------------------------------------------------------- seedFromAssessment
test('seedFromAssessment replays responses into the tracker identically', () => {
  const t = createTracker();
  const result = {
    responses: [
      { word: 'cat', correct: true, responseMs: 500 },
      { word: 'rhythm', correct: false, responseMs: 6000 },
      { word: 'cat', correct: true, responseMs: 700 },
    ],
  };
  seedFromAssessment(t, result);
  assert.equal(getRecord(t, 'cat').attempts, 2);
  assert.equal(getRecord(t, 'rhythm').attempts, 1);
  assert.ok(mastery(t, 'cat') > mastery(t, 'rhythm'), 'correct word should outrank the missed one');
});

// ------------------------------------------------ lapsed / "cracked crystals"
test('a miss marks a word lapsed; it stays lapsed until re-mastered', () => {
  const t = createTracker();
  recordAnswer(t, 'rhythm', false, { responseMs: 5000 }); // miss -> cracked
  recordAnswer(t, 'island', true, { responseMs: 500 }); // clean -> never cracked
  assert.deepEqual(lapsedWords(t), ['rhythm']);
  // one lucky correct is NOT enough to repair (mastery still below the bar)
  recordAnswer(t, 'rhythm', true, { responseMs: 500 });
  assert.deepEqual(lapsedWords(t), ['rhythm'], 'still cracked after one correct');
  // several fast corrects pull mastery back to the known bar -> repaired
  for (let i = 0; i < 4; i++) recordAnswer(t, 'rhythm', true, { responseMs: 400 });
  assert.deepEqual(lapsedWords(t), [], 'repaired word leaves the cracked list');
});

test('lapsedWords lists the worst (lowest mastery) first', () => {
  const t = createTracker();
  recordAnswer(t, 'aaa', false, { responseMs: 5000 }); // stays at 0 mastery
  recordAnswer(t, 'bbb', false, { responseMs: 5000 });
  recordAnswer(t, 'bbb', true, { responseMs: 400 }); // bbb a little better, still cracked
  assert.deepEqual(lapsedWords(t), ['aaa', 'bbb']);
  assert.ok(lapsedWords(t, { max: 1 }).length === 1, 'max caps the list');
});

test('lapsed survives serialization', () => {
  const t = createTracker();
  recordAnswer(t, 'gneiss', false, { responseMs: 6000 });
  const restored = deserializeTracker(JSON.parse(JSON.stringify(serializeTracker(t))));
  assert.deepEqual(lapsedWords(restored), ['gneiss']);
});

// ------------------------------------------------ serialize / deserialize (persistence)
test('serializeTracker -> JSON -> deserializeTracker round-trips losslessly', () => {
  const t = createTracker();
  recordAnswer(t, 'cave', true, { responseMs: 500 });
  recordAnswer(t, 'cave', true, { responseMs: 1500 });
  recordAnswer(t, 'gneiss', false, { responseMs: 6000 });

  // Survive an actual JSON string trip (that's what localStorage does).
  const restored = deserializeTracker(JSON.parse(JSON.stringify(serializeTracker(t))));

  assert.equal(restored.tick, t.tick, 'tick (recency counter) preserved');
  assert.equal(restored.records.size, t.records.size, 'every record survives');
  for (const [word, rec] of t.records) {
    assert.deepEqual(restored.records.get(word), rec, `record for "${word}" preserved`);
  }
  // mastery/confidence read back identically through the public helpers
  assert.equal(mastery(restored, 'cave'), mastery(t, 'cave'));
  assert.equal(confidence(restored, 'cave'), confidence(t, 'cave'));
});

test('knownPeak ratchets up and round-trips through serialization (QA I5)', () => {
  const t = createTracker();
  assert.equal(knownPeak(t), 0);
  for (let i = 0; i < 3; i++) {
    recordAnswer(t, `w${i}`, true, { responseMs: 500 });
    recordAnswer(t, `w${i}`, true, { responseMs: 500 });
  }
  assert.equal(knownPeak(t), 3, 'peak tracks the known count');
  // mastery dips below the known bar, but the peak must not fall
  recordAnswer(t, 'w0', false, { responseMs: 6000 });
  recordAnswer(t, 'w0', false, { responseMs: 6000 });
  assert.ok(summary(t).counts.known < 3, 'live known dropped');
  assert.equal(knownPeak(t), 3, 'peak never regresses');
  // and it survives persistence
  const restored = deserializeTracker(JSON.parse(JSON.stringify(serializeTracker(t))));
  assert.equal(restored.knownPeak, 3, 'knownPeak persists across save/load');
});

test('a deserialized tracker keeps recording correctly (recency/tick continue)', () => {
  const t = createTracker();
  recordAnswer(t, 'quartz', true, { responseMs: 800 });
  const restored = deserializeTracker(serializeTracker(t));
  const before = mastery(restored, 'quartz');
  const rec = recordAnswer(restored, 'quartz', false, { responseMs: 7000 });
  assert.equal(rec.attempts, 2, 'attempt count continues from the restored state');
  assert.ok(rec.lastSeen > 1, 'tick keeps incrementing after restore');
  assert.ok(mastery(restored, 'quartz') < before, 'a later miss still pulls mastery down');
});

test('deserializeTracker tolerates missing/empty input by returning a fresh tracker', () => {
  for (const bad of [undefined, null, {}, { records: null }]) {
    const t = deserializeTracker(bad);
    assert.equal(t.records.size, 0);
    assert.equal(t.tick, 0);
    // and it's usable
    recordAnswer(t, 'x', true, { responseMs: 500 });
    assert.equal(t.records.size, 1);
  }
});

// ------------------------------------------------ serve spacing (don't immediately
// repeat known words; keep unknown words in frequent rotation — the user's request)
test('serveCooldown: unseen and shaky words rest barely at all (frequent recurrence)', () => {
  const t = createTracker();
  assert.equal(serveCooldown(getRecord(t, 'never')), 0, 'never-seen -> no cooldown');
  // a missed (shaky) word: low mastery -> ~0 cooldown so it comes straight back
  recordAnswer(t, 'shaky', false, { responseMs: 5000 });
  assert.ok(serveCooldown(getRecord(t, 'shaky')) <= 2, 'shaky word should recur freely');
});

test('serveCooldown grows with mastery and with confirmations', () => {
  // Under-confirmed (1 craft-correct, attempts < MIN_CRAFT_PROOF): short rest so the
  // follow-up confirmation comes back quickly.
  const t1 = createTracker();
  recordAnswer(t1, 'w', true, { responseMs: 400 }); // perfect -> mastery ~1.0, attempts 1
  const once = serveCooldown(getRecord(t1, 'w'));
  assert.ok(once > 0, `an under-confirmed word still rests briefly (not 0), got ${once}`);
  assert.ok(once <= 12, `single-correct word rests briefly for a quick follow-up, got ${once}`);

  // Craft-confirmed (MIN_CRAFT_PROOF correct answers): a longer rest spanning several sessions.
  const tConfirmed = createTracker();
  for (let i = 0; i < MIN_CRAFT_PROOF; i++) recordAnswer(tConfirmed, 'w', true, { responseMs: 400 });
  const confirmed = serveCooldown(getRecord(tConfirmed, 'w'));
  assert.ok(confirmed >= 20, `a craft-confirmed word should rest several sessions, got ${confirmed}`);
  assert.ok(confirmed > once, `craft-confirmed rests longer than under-confirmed (${confirmed} vs ${once})`);

  // the SAME word confirmed many more times rests MUCH longer (revisit over a long horizon)
  const t2 = createTracker();
  for (let i = 0; i < 8; i++) recordAnswer(t2, 'w', true, { responseMs: 400 });
  const many = serveCooldown(getRecord(t2, 'w'));
  assert.ok(many > confirmed * 1.5, `well-confirmed word should rest far longer (${many} vs ${confirmed})`);

  // a shaky word (recently MISSED -> low mastery) rests far less than a mastered one, so
  // it comes straight back (accuracy drives this now, not speed)
  const t3 = createTracker();
  recordAnswer(t3, 'w', false, { responseMs: 500 }); // missed -> low mastery
  const learning = serveCooldown(getRecord(t3, 'w'));
  assert.ok(learning < once, `a shaky/missed word should rest less than an under-confirmed one (${learning} vs ${once})`);
});

test('isEligible: a just-mastered word is NOT eligible immediately, but is after it rests', () => {
  const t = createTracker();
  recordAnswer(t, 'mined', true, { responseMs: 400 }); // mastered on one perfect answer
  assert.equal(isEligible(t, 'mined'), false, 'should rest right after being mastered');
  // simulate many other words being practiced (ticks advance past its cooldown)
  const cd = serveCooldown(getRecord(t, 'mined'));
  for (let i = 0; i < cd; i++) recordAnswer(t, `other_${i}`, true, { responseMs: 1500 });
  assert.equal(isEligible(t, 'mined'), true, 'eligible again once enough words have passed');
});

test('isEligible: an unseen word is always eligible; a shaky word stays eligible', () => {
  const t = createTracker();
  assert.equal(isEligible(t, 'fresh'), true);
  recordAnswer(t, 'shaky', false, { responseMs: 5000 });
  recordAnswer(t, 'other', true, { responseMs: 1500 }); // advance the tick by one
  assert.equal(isEligible(t, 'shaky'), true, 'a missed word remains eligible to come back');
});

// ------------------------------------------------ target words (the working set)
test('a correct-first-time word is NOT a target; a missed word IS', () => {
  const t = createTracker();
  recordAnswer(t, 'easy', true, { responseMs: 500 }); // nailed first try -> parked
  recordAnswer(t, 'hard', false, { responseMs: 5000 }); // missed -> target
  assert.equal(isTarget(t, 'easy'), false);
  assert.equal(isTarget(t, 'hard'), true);
  assert.equal(isTarget(t, 'never-seen'), false);
  assert.deepEqual(targetWords(t), ['hard']);
});

test('a target leaves the working set once recent attempts are all clean', () => {
  const t = createTracker();
  recordAnswer(t, 'w', false, { responseMs: 5000 }); // miss -> target
  assert.equal(isTarget(t, 'w'), true);
  recordAnswer(t, 'w', true, { responseMs: 500 });
  assert.equal(isTarget(t, 'w'), true, 'one correct after a miss is still within the last-3 window');
  recordAnswer(t, 'w', true, { responseMs: 500 });
  recordAnswer(t, 'w', true, { responseMs: 500 }); // now last 3 are all correct
  assert.equal(isTarget(t, 'w'), false, 'cleared the recent window -> no longer a target');
});

test('targetWords lists the worst first and survives serialization', () => {
  const t = createTracker();
  recordAnswer(t, 'aaa', false, { responseMs: 5000 }); // mastery 0
  recordAnswer(t, 'bbb', false, { responseMs: 5000 });
  recordAnswer(t, 'bbb', true, { responseMs: 500 }); // bbb a bit higher, still missed in last 3
  assert.deepEqual(targetWords(t), ['aaa', 'bbb']);
  const restored = deserializeTracker(JSON.parse(JSON.stringify(serializeTracker(t))));
  assert.deepEqual(targetWords(restored), ['aaa', 'bbb'], 'recent history persists');
});

test('serveOverdue is negative while resting and rises as the word waits', () => {
  const t = createTracker();
  recordAnswer(t, 'w', true, { responseMs: 400 });
  assert.ok(serveOverdue(t, 'w') < 0, 'a just-seen mastered word is not yet due');
  const cd = serveCooldown(getRecord(t, 'w'));
  for (let i = 0; i < cd + 3; i++) recordAnswer(t, `o_${i}`, true, { responseMs: 1500 });
  assert.ok(serveOverdue(t, 'w') >= 0, 'past its cooldown it is overdue (due for a confirming revisit)');
  assert.equal(serveOverdue(t, 'unseen'), Infinity, 'an unseen word is maximally "due"');
});

// -------------------------------------------------------- craft-proof tracking
// A word answered correctly once by crafting is NOT yet "craft-confirmed" — it could
// be luck. MIN_CRAFT_PROOF attempts are required before a word is truly proven by
// production. Until then it "needs craft confirmation" and should resurface sooner
// for a follow-up proof attempt (higher priority than brand-new words, lower than
// repair targets — the kid has seen it, so it's not cold-start material).

test('MIN_CRAFT_PROOF is exported and is a positive integer >= 2', () => {
  assert.ok(Number.isInteger(MIN_CRAFT_PROOF) && MIN_CRAFT_PROOF >= 2, `MIN_CRAFT_PROOF=${MIN_CRAFT_PROOF}`);
});

test('needsCraftConfirmation: true when word has craft attempts but fewer than MIN_CRAFT_PROOF all-correct', () => {
  const t = createTracker();
  // never seen: not needing confirmation (it's new material)
  assert.equal(needsCraftConfirmation(t, 'unseen'), false, 'never-seen word does not need confirmation');

  // one correct craft answer: needs confirmation (not yet proven, no miss)
  recordAnswer(t, 'oneshot', true, { responseMs: 500 });
  assert.equal(needsCraftConfirmation(t, 'oneshot'), true, 'one correct craft attempt → needs confirmation');

  // one MISSED craft answer: it's a TARGET, not confirmation-needing (different bucket)
  recordAnswer(t, 'missed', false, { responseMs: 5000 });
  assert.equal(needsCraftConfirmation(t, 'missed'), false, 'a target (has miss) is NOT in needs-confirmation');

  // MIN_CRAFT_PROOF correct answers: now fully confirmed
  for (let i = 0; i < MIN_CRAFT_PROOF; i++) recordAnswer(t, 'proven', true, { responseMs: 500 });
  assert.equal(needsCraftConfirmation(t, 'proven'), false, 'fully craft-confirmed word does not need confirmation');
});

test('isCraftConfirmed: true only after MIN_CRAFT_PROOF craft attempts, all recent clean', () => {
  const t = createTracker();
  assert.equal(isCraftConfirmed(t, 'unseen'), false, 'never-seen is not confirmed');

  recordAnswer(t, 'partial', true, { responseMs: 500 }); // only 1 craft attempt
  assert.equal(isCraftConfirmed(t, 'partial'), false, 'one craft attempt is not yet confirmed');

  for (let i = 0; i < MIN_CRAFT_PROOF; i++) recordAnswer(t, 'multishot', true, { responseMs: 500 });
  assert.equal(isCraftConfirmed(t, 'multishot'), true, `${MIN_CRAFT_PROOF} correct craft attempts → confirmed`);

  // a missed word is NOT confirmed even with many prior corrects
  recordAnswer(t, 'mixed', true, { responseMs: 500 });
  recordAnswer(t, 'mixed', true, { responseMs: 500 });
  recordAnswer(t, 'mixed', false, { responseMs: 5000 }); // recent miss
  assert.equal(isCraftConfirmed(t, 'mixed'), false, 'a word with a recent miss is not craft-confirmed');
});

test('needsCraftConfirmation clears once MIN_CRAFT_PROOF correct attempts are reached', () => {
  const t = createTracker();
  recordAnswer(t, 'climbing', true, { responseMs: 500 });
  assert.equal(needsCraftConfirmation(t, 'climbing'), true, 'needs confirmation at attempt 1');
  for (let i = 1; i < MIN_CRAFT_PROOF; i++) {
    recordAnswer(t, 'climbing', true, { responseMs: 500 });
  }
  assert.equal(needsCraftConfirmation(t, 'climbing'), false, `clears at ${MIN_CRAFT_PROOF} correct attempts`);
  assert.equal(isCraftConfirmed(t, 'climbing'), true, 'and is now craft-confirmed');
});

test('serveCooldown: single-craft-correct word rests shorter than a multi-confirmed word', () => {
  const t1 = createTracker();
  recordAnswer(t1, 'once', true, { responseMs: 400 }); // 1 craft-correct
  const cdOnce = serveCooldown(getRecord(t1, 'once'));

  const t2 = createTracker();
  for (let i = 0; i < 4; i++) recordAnswer(t2, 'many', true, { responseMs: 400 }); // 4 craft-correct
  const cdMany = serveCooldown(getRecord(t2, 'many'));

  assert.ok(cdOnce < cdMany, `single-correct (${cdOnce}) should rest less than multi-confirmed (${cdMany})`);
  // single-correct should rest no more than 1 session-worth (~12 ticks) so it gets a quick follow-up
  assert.ok(cdOnce <= 12, `single-correct cooldown too long: ${cdOnce} (should be ≤12 for quick confirmation)`);
});
