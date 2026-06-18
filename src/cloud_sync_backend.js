// src/cloud_sync_backend.js — client for the family-sync backend (netlify/functions/sync).
//
// Cross-device sync with NO OAuth and NO per-device accounts: the parent creates a family
// sync CODE once, types it on each device once, and progress flows through our serverless
// function (keyed by that code). The server is the merge authority (never-lose-progress);
// the client adopts whatever the server returns if it's more advanced than local.
//
// Pure decision logic is engine/cloudsync.js; this is the thin network/orchestration layer
// (UI module — not imported by node --test). Generation of a fresh code lives here because
// it needs the browser's crypto.
import { reconcile, normalizeSyncCode } from './engine/cloudsync.js';

const ENDPOINT = '/api/sync';
// Unambiguous alphabet (no 0/O/1/I) so a parent can read a code aloud / retype it.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// A fresh 8-char family code, cryptographically random.
export function generateSyncCode() {
  const n = 8;
  const out = [];
  if (window.crypto?.getRandomValues) {
    const buf = new Uint32Array(n);
    window.crypto.getRandomValues(buf);
    for (let i = 0; i < n; i++) out.push(ALPHABET[buf[i] % ALPHABET.length]);
  } else {
    for (let i = 0; i < n; i++) out.push(ALPHABET[Math.floor(Math.random() * ALPHABET.length)]);
  }
  return out.join('');
}

// GET the stored envelope for a code (or null if none yet). Throws on network error.
export async function pull(code) {
  const res = await fetch(`${ENDPOINT}?code=${encodeURIComponent(normalizeSyncCode(code))}`, {
    method: 'GET',
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`sync pull failed (${res.status})`);
  return res.json();
}

// PUT the local envelope; the server merges and returns the canonical winner.
export async function push(code, envelope) {
  const res = await fetch(`${ENDPOINT}?code=${encodeURIComponent(normalizeSyncCode(code))}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(envelope),
  });
  if (!res.ok) throw new Error(`sync push failed (${res.status})`);
  return res.json();
}

// Delete the family's cloud data entirely (the parent's "delete from cloud" control).
export async function remove(code) {
  const res = await fetch(`${ENDPOINT}?code=${encodeURIComponent(normalizeSyncCode(code))}`, {
    method: 'DELETE',
  });
  if (!res.ok && res.status !== 204) throw new Error(`sync delete failed (${res.status})`);
}

// One full sync: push local (server merges with the stored copy and returns the winner);
// if the winner is more advanced than local, adopt it. Returns { action, reason }.
//   getLocal()     -> local backup envelope (parsed)
//   applyRemote(e) -> adopt a pulled envelope locally (state.importData)
export async function syncNow({ code, getLocal, applyRemote }) {
  const local = getLocal();
  const winner = await push(code, local);
  const { action, reason } = reconcile(local, winner);
  if (action === 'pull') applyRemote(winner);
  return { action: action === 'pull' ? 'pull' : 'push', reason };
}
