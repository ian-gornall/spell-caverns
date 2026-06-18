// src/engine/cloudsync.js — PURE cloud-sync reconciliation.
//
// When the learner uses more than one device, each has a LOCAL backup envelope and
// there may be one stored in the parent's own Google Drive (the REMOTE). This module
// decides — with no network and no provider knowledge — whether to PUSH the local copy
// up or PULL the remote copy down. The guiding rule for a child's learning data is
// "never silently lose progress": the copy with more learning history wins, ties broken
// by the newer timestamp. The Drive plumbing lives in src/cloud_drive.js (UI module);
// this stays pure + testable.

// A rough, monotonic-in-real-play measure of how much progress a state blob holds, so
// sync never overwrites a more-advanced device with a barely-used one. Weighted toward
// learning history (answers, tracked words, the recency tick) over gems.
export function progressScore(blob) {
  if (!blob || typeof blob !== 'object') return -1;
  const answers = blob.stats?.answers || 0;
  const tick = blob.tracker?.tick || 0;
  const tracked = Array.isArray(blob.tracker?.records) ? blob.tracker.records.length : 0;
  const gems = blob.gems || 0;
  return answers * 10 + tick * 5 + tracked * 2 + gems;
}

// Decide the sync action between the LOCAL and REMOTE backup envelopes (either may be
// null). Returns { action: 'push'|'pull'|'inSync', use, reason }:
//   - push  : upload `use` (the local envelope) to Drive
//   - pull  : adopt `use` (the remote envelope) locally
//   - inSync: nothing to do
export function reconcile(local, remote) {
  const l = local && local.data ? local : null;
  const r = remote && remote.data ? remote : null;
  if (!l && !r) return { action: 'inSync', use: null, reason: 'nothing to sync' };
  if (!r) return { action: 'push', use: l, reason: 'no backup in Drive yet' };
  if (!l) return { action: 'pull', use: r, reason: 'no local progress yet' };

  const ls = progressScore(l.data);
  const rs = progressScore(r.data);
  if (rs > ls) return { action: 'pull', use: r, reason: 'Drive copy has more progress' };
  if (ls > rs) return { action: 'push', use: l, reason: 'this device has more progress' };
  // equal progress -> the more recently saved one wins
  const lt = l.savedAt || 0;
  const rt = r.savedAt || 0;
  if (rt > lt) return { action: 'pull', use: r, reason: 'Drive copy is newer' };
  if (lt > rt) return { action: 'push', use: l, reason: 'this device is newer' };
  return { action: 'inSync', use: l, reason: 'already in sync' };
}
