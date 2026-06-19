// sw.js — service worker: makes Crystal Spell Caverns work OFFLINE once installed.
//
// Strategy: precache the whole app shell (HTML/CSS/all ES modules + the word data
// + icons) on install, then cache-first for same-origin GETs so anything else is
// served from cache when offline. AUDIO (/audio/*) is intentionally NOT intercepted
// — those clips are served with HTTP Range requests; letting the browser handle
// them avoids partial-content caching bugs, and the app already falls back to the
// device's built-in speech voice for any clip it can't fetch.
//
// NOTE: service workers only run in a SECURE context (HTTPS or localhost). Over a
// plain http:// LAN address the SW won't register — the app still installs to the
// home screen and runs online; true offline needs HTTPS. (See README.)
//
// Bump VERSION whenever a precached file changes, to retire the old cache.
// v6: session/progress spacing, economy rebalance (praise/catalog/state), shared
// button-centering tokens (styles.css), contextual welcome-back greeting (home).
// v7: parent-controlled backup/restore (engine/backup.js, Parents & Privacy panel).
// v8: optional Google-Drive auto-sync (engine/cloudsync.js + cloud_drive.js).
// v9: family-sync backend — Drive OAuth replaced by a sync code + serverless function
//     (cloud_sync_backend.js). Per-device OAuth removed.
// v10: kid-friendly PICTURE password (engine/picturecode.js) + family sync moved into
//      first-run onboarding.
// v11: picture password dropped (grown-up sets a normal family password, saved locally);
//      mastery decoupled from speed; target-words session algorithm; level-select.
// v12: multi-profile (engine/profiles.js + screens/profiles.js "who's playing"), per-kid
//      progress, family-level sync, snapshots; clickable quests.
// v13: configurable voice speed (dictation rate; a little slow by default).
// v14: NETWORK-FIRST fetch (online always gets the latest deploy; cache is the offline
//      fallback). Stops the "deployed but I still see the old app" stale-cache problem.
// v15: learning-model rework — mastery=crafting-not-mining, level-led sessions, 9 levels,
//      Settings level control (§21-A/B/C/D). JS+CSS changed, so retire the old cache.
// v16: phone/PWA responsive fixes — in-game header no longer clips the depth chip, level
//      grid respects panel padding, header pills shrink on phones. CSS+ui.js changed.
// v17: PWA UPDATE FLOW — registration moved to src/pwa.js (updateViaCache:none + update on
//      foreground + reload-on-controllerchange) so installed apps (Android) pick up deploys
//      without a reload button; visible app/cache VERSION in Settings (GET_VERSION below).
const VERSION = 'csc-v17';

const CORE = [
  '/',
  '/index.html',
  '/styles.css',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/src/app.js',
  '/src/ui.js',
  '/src/state.js',
  '/src/audio.js',
  '/src/pwa.js',
  '/src/version.js',
  '/src/engine/lexicon.js',
  '/src/engine/distractors.js',
  '/src/engine/praise.js',
  '/src/engine/assessment.js',
  '/src/engine/progress.js',
  '/src/engine/session.js',
  '/src/engine/nonsense.js',
  '/src/engine/puzzle.js',
  '/src/engine/streak.js',
  '/src/engine/quests.js',
  '/src/engine/catalog.js',
  '/src/engine/narrative.js',
  '/src/engine/backup.js',
  '/src/engine/cloudsync.js',
  '/src/engine/profiles.js',
  '/src/cloud_sync_backend.js',
  '/src/modes/rhythm.js',
  '/src/modes/puzzle.js',
  '/src/modes/lab.js',
  '/src/screens/home.js',
  '/src/screens/settings.js',
  '/src/screens/progress.js',
  '/src/screens/feedback.js',
  '/src/screens/catalog.js',
  '/src/screens/onboarding.js',
  '/src/screens/profiles.js',
  '/src/screens/boss.js',
  '/data/words.js',
  '/data/patterns.js',
  '/data/nonsense_blocklist.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION);
      await cache.addAll(CORE);
      await self.skipWaiting();
    })(),
  );
});

// Let the page read the active cache version (Settings shows it next to the app-code
// version; a mismatch means a stale cache / pending update). See src/pwa.js swCacheVersion.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0] && event.ports[0].postMessage({ version: VERSION });
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

// NETWORK-FIRST (was cache-first). An online device ALWAYS gets the freshly-deployed
// files (so a new deploy shows up immediately — no stale-cache "I don't see my update"),
// refreshing the cache as it goes; only when OFFLINE does it fall back to the cache. The
// precache (install) still makes the whole shell available offline. We never touch
// /audio/ (ranged media) or /api/ (the live sync function — caching it would break sync).
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/audio/') || url.pathname.startsWith('/api/')) return;

  event.respondWith(
    (async () => {
      try {
        const res = await fetch(req);
        if (res && res.status === 200 && res.type === 'basic') {
          const cache = await caches.open(VERSION);
          cache.put(req, res.clone());
        }
        return res;
      } catch (err) {
        // offline → serve the cached copy; for a navigation, fall back to the app shell.
        const cached = await caches.match(req);
        if (cached) return cached;
        if (req.mode === 'navigate') {
          const shell = await caches.match('/index.html');
          if (shell) return shell;
        }
        throw err;
      }
    })(),
  );
});
