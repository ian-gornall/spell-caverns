// test/backup.test.js — PURE backup/restore envelope + reminder logic
// (src/engine/backup.js). Underpins parent-controlled, COPPA-minimizing data export:
// we add only a format marker + version + timestamp (no new personal data), validate
// on restore, and nudge the parent to back up. Runs under `node --test` (no browser).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BACKUP_APP,
  BACKUP_VERSION,
  wrapBackup,
  readBackup,
  daysSince,
  backupReminderDue,
} from '../src/engine/backup.js';

test('wrapBackup envelops a state blob with a marker, version, and timestamp only', () => {
  const blob = { version: 1, gems: 42, settings: {} };
  const env = wrapBackup(blob, 1000);
  assert.equal(env.app, BACKUP_APP);
  assert.equal(env.backupVersion, BACKUP_VERSION);
  assert.equal(env.savedAt, 1000);
  assert.deepEqual(env.data, blob, 'the payload is the unchanged state blob');
  // envelope adds NO new personal fields beyond marker/version/timestamp/data
  assert.deepEqual(Object.keys(env).sort(), ['app', 'backupVersion', 'data', 'savedAt']);
});

test('readBackup round-trips an enveloped backup', () => {
  const blob = { version: 1, gems: 7 };
  const back = readBackup(wrapBackup(blob, 5));
  assert.deepEqual(back, blob);
});

test('readBackup still accepts a legacy bare export (backward compatible)', () => {
  // older exports were the bare state blob with no envelope
  const legacy = { version: 1, settings: { difficulty: 'easy' }, gems: 3 };
  assert.deepEqual(readBackup(legacy), legacy);
  // a bare blob with a tracker also counts
  assert.deepEqual(readBackup({ tracker: { records: [] } }).tracker.records, []);
});

test('readBackup rejects junk / unrelated JSON with a friendly throw', () => {
  for (const bad of [null, undefined, 42, 'nope', {}, { foo: 'bar' }, { app: 'something-else' }]) {
    assert.throws(() => readBackup(bad), /backup/i, `should reject ${JSON.stringify(bad)}`);
  }
});

test('daysSince counts whole days; null/never -> Infinity', () => {
  const now = 10 * 86400000;
  assert.equal(daysSince(now, now), 0);
  assert.equal(daysSince(now - 86400000, now), 1);
  assert.equal(daysSince(now - 3 * 86400000 - 500, now), 3);
  assert.equal(daysSince(null, now), Infinity);
  assert.equal(daysSince(0, now), Infinity);
  assert.equal(daysSince(now + 86400000, now), 0, 'never negative (clock skew)');
});

test('backupReminderDue: only with progress, and only after the interval (or never backed up)', () => {
  const now = 30 * 86400000;
  // no progress -> never nag
  assert.equal(backupReminderDue({ lastBackupAt: null, nowMs: now, hasProgress: false }), false);
  // progress + never backed up -> due
  assert.equal(backupReminderDue({ lastBackupAt: null, nowMs: now, hasProgress: true }), true);
  // backed up today -> not due
  assert.equal(backupReminderDue({ lastBackupAt: now, nowMs: now, hasProgress: true }), false);
  // backed up 8 days ago, default 7-day interval -> due
  assert.equal(
    backupReminderDue({ lastBackupAt: now - 8 * 86400000, nowMs: now, hasProgress: true }),
    true,
  );
  // custom interval respected
  assert.equal(
    backupReminderDue({ lastBackupAt: now - 5 * 86400000, nowMs: now, hasProgress: true, everyDays: 10 }),
    false,
  );
});
