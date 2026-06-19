// src/admin.js — DEVELOPER-ONLY client helpers for the hidden feedback archive (§28.A).
//
// This app has a single admin (the developer). Once a device proves it knows the ADMIN_KEY
// (via the 7-tap unlock in Settings → push.registerAdmin), we remember the key in localStorage
// on THAT device so the in-app feedback archive can fetch without re-prompting. The key only
// gates a read of pseudonymous feedback, and it lives only on the developer's own device, so
// this is low-stakes. It is stored OUTSIDE the multi-profile container (device-level dev flag).
// UI-side module (localStorage + fetch) — never imported by `node --test`.
const KEY = 'csc_admin_key';

export function getAdminKey() {
  try {
    return localStorage.getItem(KEY) || '';
  } catch {
    return '';
  }
}

export function setAdminKey(k) {
  try {
    if (k) localStorage.setItem(KEY, k);
  } catch {
    /* storage disabled — viewer just won't persist */
  }
}

export function clearAdminKey() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function isAdmin() {
  return !!getAdminKey();
}

// Fetch the full feedback archive (newest first), gated by the stored admin key. Resolves to
// an array on success; throws { status } so the screen can show "key rejected" (403) vs offline.
export async function fetchFeedback() {
  const key = getAdminKey();
  if (!key) throw { status: 0, reason: 'no-key' };
  const res = await fetch('/api/feedback', { headers: { 'x-admin-key': key } });
  if (!res.ok) throw { status: res.status, reason: res.status === 403 ? 'forbidden' : 'server' };
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}
