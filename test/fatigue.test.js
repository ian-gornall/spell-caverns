// test/fatigue.test.js — the session fatigue meter (src/engine/fatigue.js).
//
// §40: a lessons-mode block ends at the fatigue knee — the running median response
// time on clean known-word recalls rising ~25% over the session's own baseline —
// or at a response cap. The same samples drive self-relative pace praise. The
// meter is session-scoped (never persisted) and only ever fed clean (correct,
// rung-0, known-word) recall times. Pure; runs under `node --test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createFatigueMeter } from '../src/engine/fatigue.js';

test('no knee before minSamples (a block cannot end in its first minute)', () => {
  const m = createFatigueMeter({ minSamples: 8 });
  for (let i = 0; i < 7; i++) m.record(10000); // absurdly slow, but too few samples
  assert.equal(m.knee(), false);
});

test('knee fires when the recent median rises past the baseline by the factor', () => {
  const m = createFatigueMeter({ baselineN: 6, minSamples: 8, kneeFactor: 1.25 });
  for (let i = 0; i < 6; i++) m.record(1000); // baseline median 1000
  m.record(1050);
  m.record(1100);
  assert.equal(m.knee(), false, 'steady pace: no knee');
  for (let i = 0; i < 5; i++) m.record(1400); // recent median 1400 > 1250
  assert.equal(m.knee(), true);
});

test('a steady session never knees', () => {
  const m = createFatigueMeter();
  for (let i = 0; i < 40; i++) m.record(900 + (i % 3) * 60);
  assert.equal(m.knee(), false);
});

test('pace is self-relative: fast / ok / slow against the rolling median', () => {
  const m = createFatigueMeter();
  assert.equal(m.pace(500), 'ok', 'too few samples: neutral');
  for (let i = 0; i < 10; i++) m.record(1000);
  assert.equal(m.pace(700), 'fast');
  assert.equal(m.pace(1000), 'ok');
  assert.equal(m.pace(1400), 'slow');
});

test('record ignores junk samples', () => {
  const m = createFatigueMeter();
  m.record(NaN);
  m.record(-50);
  m.record(0);
  m.record(Infinity);
  assert.equal(m.size(), 0);
});
