// test/quests.test.js — PURE daily quests + variable geode (src/engine/quests.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../src/engine/distractors.js';
import {
  QUEST_POOL,
  ROUND_GROWTH,
  dailyQuests,
  questProgress,
  allQuestsDone,
  openGeode,
} from '../src/engine/quests.js';

test('dailyQuests is deterministic per day, distinct metrics, fresh across days', () => {
  const a = dailyQuests('2026-06-18');
  const b = dailyQuests('2026-06-18');
  assert.deepEqual(a, b, 'same day -> same quests (stable across reloads)');
  assert.equal(a.length, 3);
  assert.equal(new Set(a.map((q) => q.metric)).size, 3, 'three distinct kinds of goal');
  for (const q of a) assert.ok(typeof q.text === 'string' && q.text.length, 'has display text');
  // a different day should (very likely) differ
  let anyDiff = false;
  for (const d of ['2026-06-19', '2026-06-20', '2026-06-21', '2026-06-22']) {
    if (JSON.stringify(dailyQuests(d)) !== JSON.stringify(a)) anyDiff = true;
  }
  assert.ok(anyDiff, 'quests should refresh across days');
});

test('questProgress reports have/target/done/pct', () => {
  const q = { id: 'gems', metric: 'gems', target: 100, icon: '💎' };
  assert.deepEqual(questProgress(q, { gems: 0 }), { have: 0, target: 100, done: false, pct: 0 });
  assert.deepEqual(questProgress(q, { gems: 50 }), { have: 50, target: 100, done: false, pct: 50 });
  const full = questProgress(q, { gems: 250 });
  assert.equal(full.done, true);
  assert.equal(full.have, 100, 'have is capped at target');
  assert.equal(full.pct, 100);
});

test('allQuestsDone only when every quest is met', () => {
  const qs = dailyQuests('2026-06-18');
  assert.ok(!allQuestsDone(qs, {}));
  const met = {};
  for (const q of qs) met[q.metric] = q.target;
  assert.ok(allQuestsDone(qs, met));
  assert.ok(!allQuestsDone([], met), 'no quests -> not "all done"');
});

test('every pool metric is one of the tracked snapshot fields', () => {
  const known = new Set(['gems', 'correct', 'digs', 'bestCombo', 'specimens', 'crafted']);
  for (const q of QUEST_POOL) assert.ok(known.has(q.metric), `unknown metric ${q.metric}`);
});

test('openGeode always returns a positive reward; seeded rng is reproducible', () => {
  for (let s = 1; s <= 50; s++) {
    const g = openGeode(mulberry32(s));
    assert.ok(g.gems > 0, 'never a dud');
    assert.equal(typeof g.rare, 'boolean');
  }
  assert.deepEqual(openGeode(mulberry32(7)), openGeode(mulberry32(7)), 'reproducible');
});

// ── NEW TESTS ──────────────────────────────────────────────────────────────────

test('QUEST_POOL contains a craft quest with correct shape', () => {
  const craft = QUEST_POOL.find((q) => q.id === 'craft');
  assert.ok(craft, 'craft quest is in the pool');
  assert.equal(craft.metric, 'crafted');
  assert.equal(craft.target, 5);
  assert.equal(craft.icon, '🔨');
  assert.ok(craft.craft === true, 'craft:true flag set');
  assert.ok(typeof craft.label === 'function');
  assert.ok(craft.label(5).includes('5'), 'label includes target');
});

test('dailyQuests craft quest is always first', () => {
  for (const d of ['2026-06-18', '2026-06-19', '2026-06-20', '2026-06-21', '2026-06-22']) {
    const qs = dailyQuests(d);
    assert.equal(qs[0].id, 'craft', `craft is first for ${d}`);
    assert.equal(qs[0].craft, true, 'craft flag propagated');
  }
});

test('dailyQuests returned quests carry craft:boolean field', () => {
  const qs = dailyQuests('2026-06-18');
  assert.equal(typeof qs[0].craft, 'boolean');
  for (const q of qs.slice(1)) assert.equal(q.craft, false, 'non-craft quests have craft:false');
});

test('dailyQuests round=0 equals no-round call (backward compat)', () => {
  const a = dailyQuests('2026-06-18');
  const b = dailyQuests('2026-06-18', { round: 0 });
  assert.deepEqual(a, b, 'round=0 identical to default');
});

test('dailyQuests is deterministic per (date, round)', () => {
  for (const round of [0, 1, 2, 3]) {
    const a = dailyQuests('2026-06-19', { round });
    const b = dailyQuests('2026-06-19', { round });
    assert.deepEqual(a, b, `round ${round} is stable`);
  }
});

test('dailyQuests round>0 yields strictly larger targets than round 0 for matching quest ids', () => {
  // The craft quest is always first and is the same id across rounds.
  // Non-craft quests may differ across rounds (round is in the seed), so compare
  // any quest ids that appear in BOTH round-0 and round-1.
  const r0 = dailyQuests('2026-06-19', { round: 0 });
  const r1 = dailyQuests('2026-06-19', { round: 1 });
  const r2 = dailyQuests('2026-06-19', { round: 2 });

  // Craft quest (always first, always same) must have strictly larger targets.
  assert.ok(r1[0].target > r0[0].target, 'craft: round1 > round0');
  assert.ok(r2[0].target > r1[0].target, 'craft: round2 > round1');

  // For shared quest ids between rounds, verify scaling.
  const byId = (qs) => Object.fromEntries(qs.map((q) => [q.id, q]));
  const r0Map = byId(r0);
  const r1Map = byId(r1);
  const r2Map = byId(r2);

  // Any quest present in both r0 and r1 must have a strictly larger target in r1.
  for (const id of Object.keys(r0Map)) {
    if (r1Map[id]) assert.ok(r1Map[id].target > r0Map[id].target, `${id}: round1 > round0`);
    if (r2Map[id] && r1Map[id]) assert.ok(r2Map[id].target > r1Map[id].target, `${id}: round2 > round1`);
  }
});

test('dailyQuests round 0 targets are exactly the base pool targets', () => {
  const qs = dailyQuests('2026-06-18', { round: 0 });
  const craftPool = QUEST_POOL.find((q) => q.id === 'craft');
  assert.equal(qs[0].target, craftPool.target, 'craft target unchanged at round 0');
  // all targets in round 0 should match their pool entry
  const byId = Object.fromEntries(QUEST_POOL.map((q) => [q.id, q]));
  for (const q of qs) {
    assert.equal(q.target, byId[q.id].target, `${q.id} target at round 0 matches pool`);
  }
});

test('ROUND_GROWTH is exported and >= 1', () => {
  assert.ok(typeof ROUND_GROWTH === 'number', 'ROUND_GROWTH is a number');
  assert.ok(ROUND_GROWTH >= 1, 'ROUND_GROWTH >= 1 so targets never shrink');
});

test('openGeode round scaling: round>0 payout >= round=0 payout, always positive', () => {
  for (let s = 1; s <= 20; s++) {
    const rng0 = mulberry32(s);
    const g0 = openGeode(rng0, { round: 0 });
    const rng1 = mulberry32(s);
    const g1 = openGeode(rng1, { round: 1 });
    const rng2 = mulberry32(s);
    const g2 = openGeode(rng2, { round: 2 });
    assert.ok(g0.gems > 0, `seed ${s} round 0 positive`);
    assert.ok(g1.gems > 0, `seed ${s} round 1 positive`);
    assert.ok(g2.gems > 0, `seed ${s} round 2 positive`);
    assert.ok(g1.gems >= g0.gems, `seed ${s}: round1 >= round0`);
    assert.ok(g2.gems >= g1.gems, `seed ${s}: round2 >= round1`);
  }
});

test('openGeode round=0 matches no-opts call exactly (backward compat)', () => {
  for (let s = 1; s <= 20; s++) {
    assert.deepEqual(openGeode(mulberry32(s)), openGeode(mulberry32(s), { round: 0 }), `seed ${s}`);
  }
});

test('openGeode is reproducible with round', () => {
  assert.deepEqual(openGeode(mulberry32(7), { round: 2 }), openGeode(mulberry32(7), { round: 2 }));
});

test('dailyQuests non-craft quests have distinct metrics', () => {
  for (const d of ['2026-06-18', '2026-06-19', '2026-06-20']) {
    const qs = dailyQuests(d);
    const metrics = qs.map((q) => q.metric);
    assert.equal(new Set(metrics).size, metrics.length, `all metrics distinct for ${d}`);
  }
});
