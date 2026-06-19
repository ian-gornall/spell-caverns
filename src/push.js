// src/push.js — client side of the optional daily reminder (Web Push).
//
// A grown-up turns "Daily reminder" on in Settings; we ask the OS for notification permission,
// subscribe via the service worker's PushManager, and register that subscription with the
// Worker (/api/push/subscribe), which fires a once-a-day "your geode is ready" nudge (the
// actual send + VAPID signing happen server-side — see worker.js scheduled() + engine/webpush).
//
// Everything is defensive: unsupported browsers (notably iOS Safari BELOW 16.4, or any non-
// installed iOS tab) simply report unsupported and the toggle stays off — no throws. This is a
// UI module (talks to navigator/Notification), never imported by `node --test`.
import { VAPID_PUBLIC } from './engine/pushconfig.js';

const ENDPOINT = '/api/push/subscribe';

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// True only where push can actually work: a service worker, the Push API, and the
// Notification API all present. (iOS exposes these only for an INSTALLED PWA on 16.4+.)
export function isSupported() {
  try {
    return (
      typeof navigator !== 'undefined' &&
      'serviceWorker' in navigator &&
      typeof window !== 'undefined' &&
      'PushManager' in window &&
      'Notification' in window
    );
  } catch {
    return false;
  }
}

async function registration() {
  if (!isSupported()) return null;
  // ready resolves once a SW controls the page; guard with a timeout so the toggle can't hang.
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise((r) => setTimeout(() => r(null), 3000)),
  ]);
}

// Is a push subscription currently active on this device?
export async function isEnabled() {
  try {
    const reg = await registration();
    if (!reg || !reg.pushManager) return false;
    return !!(await reg.pushManager.getSubscription());
  } catch {
    return false;
  }
}

// Turn reminders ON: prompt for permission, subscribe, register with the Worker.
// Returns { ok, reason } — reason is a short code the UI can surface ('unsupported',
// 'denied', 'no-sw', 'server', 'error').
export async function enable() {
  if (!isSupported()) return { ok: false, reason: 'unsupported' };
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return { ok: false, reason: 'denied' };
    const reg = await registration();
    if (!reg || !reg.pushManager) return { ok: false, reason: 'no-sw' };

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
      });
    }
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(sub.toJSON()),
    });
    if (!res.ok) return { ok: false, reason: 'server' };
    return { ok: true };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

// Ask the Worker to push a one-off test notification to THIS device right now, so a grown-up
// can confirm reminders actually arrive (rather than waiting for the daily cron). Returns
// { ok, reason } — 'not-subscribed' if reminders aren't on, 'server' if the Worker refused.
export async function sendTest() {
  try {
    const reg = await registration();
    const sub = reg && reg.pushManager ? await reg.pushManager.getSubscription() : null;
    if (!sub) return { ok: false, reason: 'not-subscribed' };
    const res = await fetch('/api/push/test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(sub.toJSON()),
    });
    if (!res.ok) return { ok: false, reason: 'server' };
    return { ok: true };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

// Turn reminders OFF: unsubscribe locally + tell the Worker to forget this endpoint.
export async function disable() {
  try {
    const reg = await registration();
    const sub = reg && reg.pushManager ? await reg.pushManager.getSubscription() : null;
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe().catch(() => {});
      await fetch(ENDPOINT, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ endpoint }),
      }).catch(() => {});
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: 'error' };
  }
}
