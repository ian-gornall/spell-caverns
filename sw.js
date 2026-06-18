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
const VERSION = 'csc-v3';

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
  '/src/engine/lexicon.js',
  '/src/engine/distractors.js',
  '/src/engine/praise.js',
  '/src/engine/assessment.js',
  '/src/engine/progress.js',
  '/src/engine/session.js',
  '/src/engine/nonsense.js',
  '/src/engine/puzzle.js',
  '/src/modes/rhythm.js',
  '/src/modes/puzzle.js',
  '/src/modes/lab.js',
  '/src/screens/home.js',
  '/src/screens/settings.js',
  '/src/screens/progress.js',
  '/src/screens/feedback.js',
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

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/audio/')) return; // let the browser handle ranged media

  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res && res.status === 200 && res.type === 'basic') {
          const cache = await caches.open(VERSION);
          cache.put(req, res.clone());
        }
        return res;
      } catch (err) {
        // offline and not cached — for a page navigation, fall back to the app shell
        if (req.mode === 'navigate') {
          const shell = await caches.match('/index.html');
          if (shell) return shell;
        }
        throw err;
      }
    })(),
  );
});
