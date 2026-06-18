// src/engine/backup.js — PURE backup/restore envelope + reminder logic.
//
// Crystal Spell Caverns keeps ALL learner data on-device (localStorage). To make that
// data durable and movable across devices WITHOUT operating a server that holds a
// child's data (the COPPA-minimizing choice — see PRIVACY.md), the parent exports a
// backup file they keep in their OWN cloud (iCloud Drive / Google Drive via the Files
// app) and restores it on another device.
//
// This module is the pure, testable core of that: it wraps a state blob in a small,
// identifiable, versioned envelope (adding ONLY a marker + version + timestamp — no new
// personal data), validates a file on restore (so an unrelated JSON is rejected kindly),
// and decides when to nudge the parent to back up. Imports nothing browser-specific.

export const BACKUP_APP = 'crystal-spell-caverns';
export const BACKUP_VERSION = 1;

// Wrap a (already JSON-safe) state blob in the backup envelope. `nowMs` is passed in so
// this stays pure/testable (state.js supplies Date.now()).
export function wrapBackup(stateBlob, nowMs) {
  return {
    app: BACKUP_APP,
    backupVersion: BACKUP_VERSION,
    savedAt: Number.isFinite(nowMs) ? nowMs : 0,
    data: stateBlob,
  };
}

// Extract the inner state blob from a parsed backup file. Accepts our enveloped format
// and (for backward compatibility) a bare legacy export that looks like our save.
// Throws with a friendly, COPPA-safe message if the file isn't recognisably ours.
export function readBackup(obj) {
  if (!obj || typeof obj !== 'object') throw new Error('That is not a backup file.');
  if (obj.app === BACKUP_APP && obj.data && typeof obj.data === 'object') return obj.data;
  // Legacy bare export: the state blob itself, no envelope. Must look like our save.
  if ('settings' in obj || 'tracker' in obj || obj.version === 1) return obj;
  throw new Error('That is not a Crystal Spell Caverns backup.');
}

// Whole days between `lastMs` and `nowMs`. Infinity if never backed up; never negative.
export function daysSince(lastMs, nowMs) {
  if (!lastMs || !Number.isFinite(lastMs)) return Infinity;
  return Math.max(0, Math.floor((nowMs - lastMs) / 86400000));
}

// Should we gently remind the parent to back up? Only when there's progress worth
// keeping AND it's been a while (or it was never backed up). Pure; the UI decides how
// to surface it. Never punitive — a backup is a safety net, not a chore.
export function backupReminderDue({ lastBackupAt, nowMs, hasProgress, everyDays = 7 } = {}) {
  if (!hasProgress) return false;
  return daysSince(lastBackupAt, nowMs) >= everyDays;
}
