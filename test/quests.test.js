// test/quests.test.js — PURE daily quests + variable geode (src/engine/quests.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../src/engine/distractors.js';
import {
  QUEST_POOL,
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
  const known = new Set(['gems', 'correct', 'digs', 'bestCombo', 'specimens']);
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
