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
} from '../src/engine/progress.js';

// ---------------------------------------------------------------- answerScore
test('answerScore: wrong is 0; correct is scaled by speed', () => {
  assert.equal(answerScore({ correct: false, responseMs: 300 }), 0);
  const fast = answerScore({ correct: true, responseMs: 500 }); // perfect tier
  const mid = answerScore({ correct: true, responseMs: 3000 }); // great tier
  const slow = answerScore({ correct: true, responseMs: 9000 }); // good tier
  assert.ok(fast > mid && mid > slow, `expected fast>mid>slow, got ${fast},${mid},${slow}`);
  assert.ok(fast <= 1 && slow >= 0.5, `scores out of expected band: ${fast},${slow}`);
});

test('answerScore falls back to the fast flag when no responseMs', () => {
  const fast = answerScore({ correct: true, fast: true });
  const unhurried = answerScore({ correct: true, fast: false });
  assert.ok(fast > unhurried);
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
