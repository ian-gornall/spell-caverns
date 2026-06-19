// src/pwa.js — service-worker registration + the UPDATE flow that makes an installed PWA
// actually pick up new deploys (the Android "it's not updating" fix).
//
// The problem: in standalone mode (installed app) there's no address bar / reload button,
// so even though the SW is network-first and a new SW activates, the OPEN page keeps
// running the old code until something reloads it. This module:
//   1. registers with `updateViaCache:'none'` so the browser always re-checks sw.js;
//   2. calls `registration.update()` on launch AND whenever the app is brought to the
//      foreground (visibilitychange) — so reopening the installed app checks for a deploy;
//   3. reloads the page ONCE when a new SW takes control (controllerchange) — but only if
//      the page was already controlled, so a first-ever load doesn't reload itself.
// Combined with the SW's skipWaiting()/clients.claim(), a new deploy now applies on the
// next foreground without the user needing a (nonexistent) reload button.
//
// Secure-context only (HTTPS / localhost); a no-op otherwise.

let refreshing = false;

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });

      // If the page is already controlled by a SW, a controllerchange means a NEWER SW just
      // took over (it skipWaiting()s) → reload once to run the fresh code. (When the page
      // starts uncontrolled — a first visit — the initial claim must NOT trigger a reload.)
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (refreshing) return;
          refreshing = true;
          window.location.reload();
        });
      }

      // Proactively check for a new SW now and every time the app returns to the foreground
      // (reopening the installed PWA), so deploys land without a manual refresh.
      const check = () => reg.update().catch(() => {});
      check();
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    } catch {
      /* registration failed (e.g. http:// LAN) — app still runs online */
    }
  });
}

// Ask the ACTIVE service worker for the version of the cache it's serving (see sw.js
// message handler). Returns null if no SW controls the page yet or it doesn't answer.
export function swCacheVersion(timeoutMs = 1200) {
  return new Promise((resolve) => {
    const ctrl = navigator.serviceWorker && navigator.serviceWorker.controller;
    if (!ctrl) return resolve(null);
    const ch = new MessageChannel();
    let done = false;
    const finish = (v) => {
      if (done) return;
      done = true;
      resolve(v);
    };
    ch.port1.onmessage = (e) => finish((e.data && e.data.version) || null);
    try {
      ctrl.postMessage({ type: 'GET_VERSION' }, [ch.port2]);
    } catch {
      finish(null);
    }
    setTimeout(() => finish(null), timeoutMs);
  });
}
