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
  MINING_SPEED_TIERS,
  MISS_TIER,
  BASE_POINTS,
  CRAFT_MULT,
  COMBO_PHRASES,
  GENTLE_PHRASES,
  NEXT_WORD_PHRASES,
  gradeAnswer,
  projectedScore,
} from '../src/engine/praise.js';

const SPEC_FIELDS = ['tier', 'label', 'phrase', 'points', 'mult', 'color'];

// --------------------------------------------------- MINING_SPEED_TIERS (§30.C)
test('MINING_SPEED_TIERS stretches the schedule to ~5s, same mults/keys as SPEED_TIERS', () => {
  assert.equal(MINING_SPEED_TIERS.length, SPEED_TIERS.length);
  // same keys + mults (only the time bounds move)
  for (let i = 0; i < SPEED_TIERS.length; i++) {
    assert.equal(MINING_SPEED_TIERS[i].key, SPEED_TIERS[i].key);
    assert.equal(MINING_SPEED_TIERS[i].mult, SPEED_TIERS[i].mult);
  }
  // strictly later bounds than the default (stretched), ascending, last is the Infinity floor
  let prev = -Infinity;
  for (let i = 0; i < MINING_SPEED_TIERS.length; i++) {
    assert.ok(MINING_SPEED_TIERS[i].maxMs > prev);
    prev = MINING_SPEED_TIERS[i].maxMs;
    if (Number.isFinite(SPEED_TIERS[i].maxMs)) assert.ok(MINING_SPEED_TIERS[i].maxMs > SPEED_TIERS[i].maxMs);
  }
  assert.equal(MINING_SPEED_TIERS[MINING_SPEED_TIERS.length - 1].maxMs, Infinity);
});

test('a ~2s mining answer still earns a STRONG tier (perfect), where default tiers would not', () => {
  const def = projectedScore({ responseMs: 2000, combo: 0 });
  const mine = projectedScore({ responseMs: 2000, combo: 0, tiers: MINING_SPEED_TIERS });
  assert.equal(mine.tier, 'perfect'); // ≤2000ms still top tier under the stretched schedule
  assert.notEqual(def.tier, 'perfect'); // default schedule has already dropped a tier by 2s
  // gradeAnswer honours the same tiers
  const g = gradeAnswer({ correct: true, responseMs: 2000, combo: 1, tiers: MINING_SPEED_TIERS });
  assert.equal(g.tier, 'perfect');
});

test('a late (~4.6s) mining answer falls to the minimum "good" tier near the bottom of the bar', () => {
  const mine = projectedScore({ responseMs: 4600, combo: 0, tiers: MINING_SPEED_TIERS });
  assert.equal(mine.tier, 'good');
  assert.equal(mine.mult, 1);
});

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
// §36 #1 (Ian 2026-06-22d): the ONE-SHOT placement diagnostic advances to the NEXT word on a miss —
// the child does NOT retry. So its consolation copy (shown AND spoken) must NEVER imply "try again":
// the normal-Craft GENTLE_PHRASES ("Try again!", "Give it another go!") are wrong there. NEXT_WORD_PHRASES
// are forward-moving instead.
test('NEXT_WORD_PHRASES are forward-moving — none imply retrying the same word', () => {
  assert.ok(Array.isArray(NEXT_WORD_PHRASES) && NEXT_WORD_PHRASES.length >= 3);
  for (const p of NEXT_WORD_PHRASES) {
    assert.equal(typeof p, 'string');
    assert.ok(p.length > 2);
    assert.doesNotMatch(p, /again|another|once more|retry/i, `"${p}" implies a retry`);
  }
});

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

// ----------------------------------------------------- craft bonus (the assessment)
// CRAFTING (production from scratch) is the assessment and the most-rewarded path:
// for the SAME speed/combo it pays more gems than MINING (recognition). The bonus is
// a flat CRAFT_MULT applied on top of the speed/combo scoring (§B pedagogy rebalance).
test('CRAFT_MULT is a real reward multiplier greater than 1', () => {
  assert.equal(typeof CRAFT_MULT, 'number');
  assert.ok(CRAFT_MULT > 1, `CRAFT_MULT(${CRAFT_MULT}) should reward crafting more than mining`);
});

test('crafting earns more gems than mining for the same answer', () => {
  const args = { correct: true, responseMs: 800, combo: 3, rng: mulberry32(1) };
  const mine = gradeAnswer({ ...args }).points;
  const craft = gradeAnswer({ ...args, craft: true }).points;
  assert.ok(craft > mine, `craft(${craft}) should beat mine(${mine})`);
  assert.equal(craft, Math.round(mine * CRAFT_MULT));
});

test('the craft bonus flows through projectedScore too (live meter agrees)', () => {
  for (const ms of [0, 800, 9000, undefined]) {
    for (const combo of [0, 4, 50]) {
      const g = gradeAnswer({ correct: true, responseMs: ms, combo, craft: true, rng: mulberry32(1) });
      const p = projectedScore({ responseMs: ms, combo, craft: true });
      assert.equal(p.points, g.points, `craft points mismatch at ms=${ms} combo=${combo}`);
    }
  }
});

test('a wrong craft answer is still worth nothing (bonus never rescues a miss)', () => {
  const res = gradeAnswer({ correct: false, responseMs: 800, combo: 4, craft: true, rng: mulberry32(1) });
  assert.equal(res.points, 0);
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

// ----------------------------------------------------- projectedScore (live meter)
// The rhythm mode shows a live, ticking "gems you'd earn if you answer NOW" meter.
// projectedScore is the phrase-free, rng-free core of gradeAnswer's scoring so the
// meter and the actual award never disagree.
test('projectedScore agrees with gradeAnswer on tier/points (no phrase, no rng)', () => {
  for (const ms of [0, 800, 2500, 9000, undefined]) {
    for (const combo of [0, 3, 50]) {
      const g = gradeAnswer({ correct: true, responseMs: ms, combo, rng: mulberry32(1) });
      const p = projectedScore({ responseMs: ms, combo });
      assert.equal(p.points, g.points, `points mismatch at ms=${ms} combo=${combo}`);
      assert.equal(p.tier, g.tier);
      assert.equal(p.label, g.label);
      assert.equal(p.color, g.color);
      assert.equal(p.mult, g.mult);
      assert.ok(!('phrase' in p), 'projectedScore must not carry a phrase');
    }
  }
});

test('projectedScore drops as the answer gets slower (the pressure to be fast)', () => {
  const fast = projectedScore({ responseMs: 0, combo: 0 }).points;
  const mid = projectedScore({ responseMs: 2500, combo: 0 }).points;
  const slow = projectedScore({ responseMs: 9000, combo: 0 }).points;
  assert.ok(fast > mid && mid > slow, `expected fast>mid>slow, got ${fast},${mid},${slow}`);
  // a building combo raises the live projection
  assert.ok(
    projectedScore({ responseMs: 800, combo: 6 }).points >
      projectedScore({ responseMs: 800, combo: 0 }).points,
    'combo should raise the projection',
  );
});
