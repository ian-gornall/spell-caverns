// test/cloudsync.test.js — PURE cloud-sync reconciliation (src/engine/cloudsync.js).
// Decides push vs pull between the local backup and the one in the parent's own Drive,
// with a "never silently lose progress" rule. No network/OAuth here (that's the adapter
// src/cloud_drive.js). Runs under `node --test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  progressScore,
  reconcile,
  normalizeSyncCode,
  isValidSyncCode,
} from '../src/engine/cloudsync.js';

const env = (blob, savedAt) => ({ app: 'crystal-spell-caverns', backupVersion: 1, savedAt, data: blob });
const blob = ({ answers = 0, tick = 0, records = 0, gems = 0 } = {}) => ({
  stats: { answers },
  tracker: { tick, records: Array.from({ length: records }, (_, i) => ({ word: `w${i}` })) },
  gems,
});

test('progressScore rises with answers, tracked words, ticks, and gems', () => {
  assert.ok(progressScore(blob({ answers: 10 })) > progressScore(blob({ answers: 1 })));
  assert.ok(progressScore(blob({ records: 20 })) > progressScore(blob({ records: 2 })));
  assert.ok(progressScore(blob({ answers: 5, tick: 5 })) > progressScore(blob({ answers: 5 })));
  assert.equal(progressScore(null), -1, 'garbage scores below any real blob');
});

test('reconcile: no remote -> push local; no local -> pull remote', () => {
  const local = env(blob({ answers: 5 }), 100);
  assert.equal(reconcile(local, null).action, 'push');
  assert.equal(reconcile(null, local).action, 'pull');
  assert.equal(reconcile(null, null).action, 'inSync');
});

test('reconcile: the side with MORE progress wins (never lose progress)', () => {
  const more = env(blob({ answers: 100 }), 50); // older timestamp but more progress
  const less = env(blob({ answers: 3 }), 9999); // newer but barely any progress
  // local has more -> push; remote has more -> pull (progress beats recency)
  assert.equal(reconcile(more, less).action, 'push');
  assert.equal(reconcile(less, more).action, 'pull');
});

test('reconcile: equal progress -> the NEWER savedAt wins', () => {
  const localNewer = env(blob({ answers: 10 }), 200);
  const remoteOlder = env(blob({ answers: 10 }), 100);
  assert.equal(reconcile(localNewer, remoteOlder).action, 'push');
  assert.equal(reconcile(remoteOlder, localNewer).action, 'pull');
});

test('reconcile: identical -> inSync', () => {
  const a = env(blob({ answers: 10 }), 100);
  const b = env(blob({ answers: 10 }), 100);
  assert.equal(reconcile(a, b).action, 'inSync');
});

test('reconcile always reports which envelope to use + a human reason', () => {
  const r = reconcile(env(blob({ answers: 100 }), 1), env(blob({ answers: 1 }), 2));
  assert.ok(r.use && r.use.data, 'returns the chosen envelope');
  assert.equal(typeof r.reason, 'string');
});

test('sync codes normalize loosely-typed input and validate the format', () => {
  assert.equal(normalizeSyncCode(' ab-cd ef '), 'ABCDEF', 'uppercased, stripped');
  assert.equal(normalizeSyncCode('abcdefghijklmnop'), 'ABCDEFGHIJKL', 'capped at 12');
  assert.ok(isValidSyncCode('crys7gem'), 'a normal code is valid');
  assert.ok(isValidSyncCode('ABC123'), 'six chars ok');
  assert.ok(!isValidSyncCode('abc'), 'too short');
  assert.ok(!isValidSyncCode(''), 'empty invalid');
  assert.ok(!isValidSyncCode(null), 'null invalid');
});
