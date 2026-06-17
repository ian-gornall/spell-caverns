// test/assessment.test.js — locks in the adaptive pre-assessment engine
// (src/engine/assessment.js). Runs under `node --test` (no browser).
//
// The pre-assessment is THE GATE: it figures out which words the learner can and
// can't spell, so the game never wastes time on known words. It's an adaptive
// staircase — climb difficulty tiers while accuracy stays high, stop at the
// "frontier" where errors appear. These tests pin that contract down.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { byRank, getWord } from '../src/engine/lexicon.js';
import { mulberry32 } from '../src/engine/distractors.js';
import {
  createAssessment,
  nextItem,
  submit,
  result,
  isDone,
} from '../src/engine/assessment.js';

// Drive an assessment to completion. `knows(entry)` decides if the simulated
// learner spells that word correctly. Returns the list of asked word entries.
function run(words, opts, knows) {
  const state = createAssessment(words, opts);
  const asked = [];
  let entry;
  while ((entry = nextItem(state)) !== null) {
    asked.push(entry);
    submit(state, entry.word, knows(entry), { fast: false });
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
  // everything he got right is at or below the frontier; everything wrong is above
  for (const w of res.knownWords) assert.ok(getWord(w).tier <= 4, `known ${w} above frontier`);
  for (const w of res.unknownWords) assert.ok(getWord(w).tier >= 5, `unknown ${w} below frontier`);
});

test('a learner who fails immediately is estimated below the start tier', () => {
  const { state } = run(byRank(), { startTier: 2, rng: mulberry32(4) }, () => false);
  const res = result(state);
  assert.ok(res.estimatedTier <= 1, `estimatedTier ${res.estimatedTier}`);
  assert.equal(res.knownWords.size, 0);
});

// ------------------------------------------------------------ result coherence
test('known and unknown are consistent with the responses and disjoint', () => {
  const { state, asked } = run(byRank(), { rng: mulberry32(5) }, (e) => e.tier <= 6);
  const res = result(state);
  for (const w of res.knownWords) assert.ok(!res.unknownWords.has(w), `${w} in both sets`);
  // every asked word is classified exactly once
  assert.equal(res.knownWords.size + res.unknownWords.size, asked.length);
});

test('no word is ever asked twice', () => {
  const { asked } = run(byRank(), { rng: mulberry32(6) }, (e) => e.tier <= 5);
  const words = asked.map((e) => e.word);
  assert.equal(words.length, new Set(words).size);
});

test('unknownQueue is frequency-ordered and excludes known words', () => {
  const { state } = run(byRank(), { rng: mulberry32(7) }, (e) => e.tier <= 4);
  const res = result(state);
  assert.ok(res.unknownQueue.length > 0);
  let prev = -Infinity;
  for (const w of res.unknownQueue) {
    assert.ok(!res.knownWords.has(w), `queue contains known word ${w}`);
    const rank = getWord(w).rank;
    assert.ok(rank >= prev, `queue not frequency-ordered at ${w}`);
    prev = rank;
  }
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
  assert.equal(corrects, res.knownWords.size);
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
