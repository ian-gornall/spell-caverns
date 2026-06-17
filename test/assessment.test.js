// test/assessment.test.js — locks in the adaptive pre-assessment engine
// (src/engine/assessment.js). Runs under `node --test` (no browser).
//
// The pre-assessment is the COLD-START phase of the same game (HANDOFF §4): it
// puts words in front of the learner using the tier/rank PRIOR (no response data
// yet) and an adaptive staircase — climb difficulty while accuracy stays high,
// stop at the "frontier" where errors appear. It does NOT decide known/unknown:
// it records raw responses (with timing) that seed the continuous progress
// tracker, plus an `estimatedTier` prior. These tests pin that contract down.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { byRank, getWord } from '../src/engine/lexicon.js';
import { mulberry32 } from '../src/engine/distractors.js';
import { createTracker, seedFromAssessment, getRecord } from '../src/engine/progress.js';
import {
  createAssessment,
  nextItem,
  submit,
  result,
  isDone,
} from '../src/engine/assessment.js';

// Drive an assessment to completion. `knows(entry)` decides if the simulated
// learner spells that word correctly; correct answers are also "fast". Returns
// the asked word entries.
function run(words, opts, knows) {
  const state = createAssessment(words, opts);
  const asked = [];
  let entry;
  while ((entry = nextItem(state)) !== null) {
    asked.push(entry);
    const correct = knows(entry);
    submit(state, entry.word, correct, { responseMs: correct ? 800 : 6000, fast: correct });
  }
  return { state, asked };
}

// --------------------------------------------------------------- item shape
test('nextItem yields real dataset word entries to present', () => {
  const state = createAssessment(byRank(), { rng: mulberry32(1) });
  const entry = nextItem(state);
  assert.ok(entry, 'expected a first item');
  assert.equal(typeof entry.word, 'string');
  assert.ok(Number.isInteger(entry.tier) && entry.tier >= 1 && entry.tier <= 9);
  assert.ok(typeof entry.rank === 'number');
  assert.ok(typeof entry.pattern === 'string');
});

// --------------------------------------------------------------- termination
test('assessment terminates within [minItems, maxItems] for an all-correct learner', () => {
  const { state, asked } = run(byRank(), { rng: mulberry32(1) }, () => true);
  assert.ok(isDone(state));
  assert.ok(asked.length >= 18 && asked.length <= 25, `asked ${asked.length}`);
});

test('a learner who knows everything is estimated at the top tier', () => {
  const { state } = run(byRank(), { rng: mulberry32(2) }, () => true);
  assert.equal(result(state).estimatedTier, 9);
});

// ----------------------------------------------------------- staircase logic
test('the staircase finds the frontier: knows tiers <=4, errors at 5', () => {
  const { state } = run(byRank(), { rng: mulberry32(3) }, (e) => e.tier <= 4);
  const res = result(state);
  // highest tier passed is 4 (errors begin at tier 5)
  assert.equal(res.estimatedTier, 4);
  // responses are coherent: everything answered right is at/below the frontier,
  // everything wrong is above it (this is observed signal, NOT a known/unknown verdict)
  for (const r of res.responses) {
    if (r.correct) assert.ok(getWord(r.word).tier <= 4, `correct ${r.word} above frontier`);
    else assert.ok(getWord(r.word).tier >= 5, `wrong ${r.word} below frontier`);
  }
});

test('a learner who fails immediately is estimated below the start tier', () => {
  const { state } = run(byRank(), { startTier: 2, rng: mulberry32(4) }, () => false);
  const res = result(state);
  assert.ok(res.estimatedTier <= 1, `estimatedTier ${res.estimatedTier}`);
  assert.equal(res.correctCount, 0);
});

// ------------------------------------------------------------ result coherence
test('result reports raw responses with timing, no known/unknown sets', () => {
  const { state, asked } = run(byRank(), { rng: mulberry32(5) }, (e) => e.tier <= 6);
  const res = result(state);
  assert.equal(res.responses.length, asked.length);
  assert.equal(res.itemsAsked, asked.length);
  assert.equal(res.knownWords, undefined, 'should not emit a known/unknown verdict');
  let corrects = 0;
  for (const r of res.responses) {
    assert.equal(typeof r.word, 'string');
    assert.equal(typeof r.correct, 'boolean');
    assert.ok(Number.isFinite(r.responseMs), `missing responseMs for ${r.word}`);
    if (r.correct) corrects += 1;
  }
  assert.equal(corrects, res.correctCount);
});

test('no word is ever asked twice', () => {
  const { asked } = run(byRank(), { rng: mulberry32(6) }, (e) => e.tier <= 5);
  const words = asked.map((e) => e.word);
  assert.equal(words.length, new Set(words).size);
});

test('perPattern accounting sums to the number of items asked', () => {
  const { state, asked } = run(byRank(), { rng: mulberry32(8) }, (e) => e.tier <= 5);
  const res = result(state);
  let asks = 0;
  let corrects = 0;
  for (const id of Object.keys(res.perPattern)) {
    asks += res.perPattern[id].asked;
    corrects += res.perPattern[id].correct;
  }
  assert.equal(asks, asked.length);
  assert.equal(asks, res.itemsAsked);
  assert.equal(corrects, res.correctCount);
});

// ----------------------------------------------- feeds the progress tracker
test('result.responses seed the continuous tracker identically', () => {
  const { state, asked } = run(byRank(), { rng: mulberry32(10) }, (e) => e.tier <= 4);
  const res = result(state);
  const tracker = createTracker();
  seedFromAssessment(tracker, res);
  // every distinct asked word now has a record
  const distinct = new Set(asked.map((e) => e.word));
  for (const w of distinct) assert.ok(getRecord(tracker, w), `no record seeded for ${w}`);
});

// --------------------------------------------------------------- lifecycle
test('nextItem returns null and stays done after completion', () => {
  const { state } = run(byRank(), { rng: mulberry32(9) }, () => true);
  assert.ok(isDone(state));
  assert.equal(nextItem(state), null);
  assert.equal(nextItem(state), null);
});

// --------------------------------------------------------------- determinism
test('same seed + same learner policy is fully reproducible', () => {
  const knows = (e) => e.tier <= 4;
  const a = run(byRank(), { rng: mulberry32(2026) }, knows);
  const b = run(byRank(), { rng: mulberry32(2026) }, knows);
  assert.deepEqual(a.asked.map((e) => e.word), b.asked.map((e) => e.word));
  assert.deepEqual(result(a.state), result(b.state));
});
