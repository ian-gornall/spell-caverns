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

// --- adminRev: an authoritative admin edit wins the merge ONCE (ADMIN_APP.md §6) -----------
// The admin app writes a container with a bumped `data.adminRev`; that revision outranks the
// progressScore/savedAt rule so the child's device adopts the edit (even a reset that LOWERS
// progress). Once the device adopts it, both carry the same adminRev and normal never-lose-
// progress resumes — so the edit is a one-time baseline, not a permanent override.
test('reconcile: a higher adminRev wins outright, even against far more progress', () => {
  const adminEdit = env({ ...blob({ answers: 1 }), adminRev: 1 }, 50); // tiny progress, admin rev 1
  const device = env(blob({ answers: 100 }), 9999); // lots of progress, adminRev absent (0)
  assert.equal(reconcile(device, adminEdit).action, 'pull', 'device adopts the admin edit');
  assert.equal(reconcile(adminEdit, device).action, 'push', 'admin edit pushes over the device');
});

test('reconcile: equal adminRev falls back to the progressScore rule', () => {
  const more = env({ ...blob({ answers: 100 }), adminRev: 2 }, 50);
  const less = env({ ...blob({ answers: 3 }), adminRev: 2 }, 9999);
  assert.equal(reconcile(more, less).action, 'push', 'same adminRev -> more progress wins');
  assert.equal(reconcile(less, more).action, 'pull');
});

test('reconcile: adminRev absent/0 -> existing behaviour unchanged', () => {
  const a = env({ ...blob({ answers: 10 }), adminRev: 0 }, 100);
  const b = env(blob({ answers: 10 }), 100); // no adminRev field at all
  assert.equal(reconcile(a, b).action, 'inSync', 'adminRev 0 == absent, ties fall through');
});

test('reconcile always reports which envelope to use + a human reason', () => {
  const r = reconcile(env(blob({ answers: 100 }), 1), env(blob({ answers: 1 }), 2));
  assert.ok(r.use && r.use.data, 'returns the chosen envelope');
  assert.equal(typeof r.reason, 'string');
});

test('family passwords normalize loosely-typed input and validate the format', () => {
  assert.equal(normalizeSyncCode(' ab-cd ef '), 'ABCDEF', 'uppercased, stripped');
  assert.equal(normalizeSyncCode('Smith Family 2024!'), 'SMITHFAMILY2024', 'a normal phrase works');
  assert.equal(normalizeSyncCode('a'.repeat(50)).length, 40, 'capped at 40');
  assert.ok(isValidSyncCode('smith2024'), 'a normal family password is valid');
  assert.ok(isValidSyncCode('ABCD'), 'four chars ok');
  assert.ok(!isValidSyncCode('abc'), 'too short (<4)');
  assert.ok(!isValidSyncCode(''), 'empty invalid');
  assert.ok(!isValidSyncCode(null), 'null invalid');
});
