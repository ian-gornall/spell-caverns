// test/praise.test.js — locks in the behaviour of the DDR/Pump-It-Up praise
// engine (src/engine/praise.js). Runs under `node --test` (no browser).
//
// This module decides, on every answer, the speed tier (PERFECT/AMAZING/...),
// the points, and the encouraging phrase the game speaks aloud. The rhythm mode
// leans on this contract, so we pin it down here.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { mulberry32 } from '../src/engine/distractors.js';
import {
  SPEED_TIERS,
  MISS_TIER,
  BASE_POINTS,
  COMBO_PHRASES,
  GENTLE_PHRASES,
  gradeAnswer,
} from '../src/engine/praise.js';

const SPEC_FIELDS = ['tier', 'label', 'phrase', 'points', 'mult', 'color'];

// ----------------------------------------------------------------- SPEED_TIERS
test('SPEED_TIERS is an ordered, well-formed tier table', () => {
  assert.ok(Array.isArray(SPEED_TIERS) && SPEED_TIERS.length >= 2);
  let prevMax = -Infinity;
  for (const t of SPEED_TIERS) {
    assert.equal(typeof t.key, 'string');
    assert.ok(t.label.length > 0, `tier ${t.key} has no label`);
    assert.ok(/^#|rgb/.test(t.color), `tier ${t.key} has no color`);
    assert.ok(typeof t.mult === 'number' && t.mult > 0, `tier ${t.key} bad mult`);
    assert.ok(Array.isArray(t.phrases) && t.phrases.length > 0, `tier ${t.key} empty phrase pool`);
    assert.ok(t.maxMs >= prevMax, `tiers not ordered by maxMs at ${t.key}`);
    prevMax = t.maxMs;
  }
  // the slowest tier is the catch-all
  assert.equal(SPEED_TIERS[SPEED_TIERS.length - 1].maxMs, Infinity);
});

// ------------------------------------------------------------ gradeAnswer shape
test('gradeAnswer always returns the spec fields', () => {
  const correct = gradeAnswer({ correct: true, responseMs: 800, combo: 1, rng: mulberry32(1) });
  const wrong = gradeAnswer({ correct: false, responseMs: 800, combo: 4, rng: mulberry32(1) });
  for (const res of [correct, wrong]) {
    for (const f of SPEC_FIELDS) assert.ok(f in res, `missing field ${f}`);
    assert.equal(typeof res.phrase, 'string');
    assert.ok(res.phrase.length > 0, 'empty phrase');
    assert.ok(res.label.length > 0, 'empty label');
    assert.equal(typeof res.points, 'number');
  }
});

// ---------------------------------------------------------- speed-tier mapping
test('responseMs maps to the right speed tier at the boundaries', () => {
  const tierAt = (ms) => gradeAnswer({ correct: true, responseMs: ms, rng: mulberry32(1) }).tier;
  // boundaries are inclusive of the faster tier
  const fastest = SPEED_TIERS[0];
  const slowest = SPEED_TIERS[SPEED_TIERS.length - 1];
  assert.equal(tierAt(0), fastest.key);
  assert.equal(tierAt(fastest.maxMs), fastest.key);
  assert.equal(tierAt(fastest.maxMs + 1), SPEED_TIERS[1].key);
  assert.equal(tierAt(10 ** 9), slowest.key);
});

test('a missing/invalid responseMs falls back to the slowest tier (no crash)', () => {
  const res = gradeAnswer({ correct: true });
  assert.equal(res.tier, SPEED_TIERS[SPEED_TIERS.length - 1].key);
  assert.ok(res.points > 0);
});

// ------------------------------------------------------------------- scoring
test('faster answers score more than slower ones (same combo)', () => {
  const fast = gradeAnswer({ correct: true, responseMs: 0, combo: 0, rng: mulberry32(1) }).points;
  const slow = gradeAnswer({ correct: true, responseMs: 10 ** 9, combo: 0, rng: mulberry32(1) }).points;
  assert.ok(fast > slow, `fast(${fast}) should beat slow(${slow})`);
});

test('a higher combo scores more, but the combo bonus is capped', () => {
  const at = (combo) => gradeAnswer({ correct: true, responseMs: 800, combo, rng: mulberry32(1) }).points;
  assert.ok(at(10) > at(0), 'combo should raise points');
  assert.equal(at(1000), at(20), 'combo bonus must be capped'); // assumes cap at 20
});

test('base scoring at combo 0 is BASE_POINTS * tier.mult', () => {
  const fastest = SPEED_TIERS[0];
  const res = gradeAnswer({ correct: true, responseMs: 0, combo: 0, rng: mulberry32(1) });
  assert.equal(res.points, Math.round(BASE_POINTS * fastest.mult));
});

// --------------------------------------------------------------------- combos
test('combo milestones (every 5) emit a combo phrase', () => {
  const res = gradeAnswer({ correct: true, responseMs: 800, combo: 5, rng: mulberry32(7) });
  assert.equal(res.isCombo, true);
  const expected = new Set(COMBO_PHRASES.map((p) => p.replace('{combo}', '5')));
  assert.ok(expected.has(res.phrase), `"${res.phrase}" is not a combo phrase`);
});

test('non-milestone combos use the speed-tier phrase pool', () => {
  const res = gradeAnswer({ correct: true, responseMs: 800, combo: 3, rng: mulberry32(7) });
  assert.equal(res.isCombo, false);
  const tier = SPEED_TIERS.find((t) => t.key === res.tier);
  assert.ok(tier.phrases.includes(res.phrase), `"${res.phrase}" not in ${res.tier} pool`);
});

// ------------------------------------------------------------- wrong answers
test('a wrong answer is gentle: no points, zero combo, encouraging phrase', () => {
  const res = gradeAnswer({ correct: false, responseMs: 800, combo: 9, rng: mulberry32(2) });
  assert.equal(res.tier, MISS_TIER.key);
  assert.equal(res.points, 0);
  assert.equal(res.mult, 0);
  assert.equal(res.combo, 0); // streak is broken
  assert.equal(res.isCombo, false);
  assert.ok(GENTLE_PHRASES.includes(res.phrase), `"${res.phrase}" is not a gentle phrase`);
});

// ----------------------------------------------------------------- determinism
test('phrase selection is deterministic for a given seed', () => {
  const a = gradeAnswer({ correct: true, responseMs: 800, combo: 2, rng: mulberry32(2026) });
  const b = gradeAnswer({ correct: true, responseMs: 800, combo: 2, rng: mulberry32(2026) });
  assert.deepEqual(a, b);
});

test('gradeAnswer works without an injected rng', () => {
  const res = gradeAnswer({ correct: true, responseMs: 800, combo: 1 });
  assert.ok(res.phrase.length > 0);
  assert.ok(res.points > 0);
});
