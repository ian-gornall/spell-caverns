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
// v18: phone exploratory-QA fixes — compact home hero (whole menu fits a phone, was 4/7 cards
//      below the fold), sticky onboarding "Let's dig!" CTA, compact level cards. CSS+onboarding.
// v19: pedagogy rebalance (§B) — CRAFT is now the home hero + best-paying path (CRAFT_MULT gems)
//      + the nudged-toward action (idle route + mining-reward CTA steer to craft); mining reframed
//      as "Practice". Word-discovery (§D): surface once-crafted words for a quick proof follow-up.
// v20: daily GEODE (§C: tap-to-open + ratcheting harder goals); App-Store polish (§A: craft crystal
//      sockets, level depth-ladder, card depth, play-body top-clip fix, treasure-tile haul, colour
//      halo); deferred parental UI now built (kid-lock picture password, grown-up gate, time machine).
// v21: final §A polish loop — onboarding "Let's dig!" sticky CTA gets a full-bleed footer
//      backdrop (cards fade behind it, no longer peek around the pill); more breathing room
//      between the craft verdict flash and the answer tiles on short phones.
// v22: pre-generated neural-TTS audio now SHIPS (audio/ committed, was git-ignored so prod
//      served the robotic device voice); optional daily-reminder Web Push (src/push.js +
//      sw push/notificationclick handlers + worker.js /api/push + scheduled sender).
// v23 (DESIGN_ANALYSIS §26-A free-polish pass): landscape/short-phone hero collapse + pinned
//      reward/boss/geode CTA (no primary action below the fold); two below-AA contrast spots
//      lifted (Craft-hero gradient + wrong-verdict slate); self-hosted Atkinson Hyperlegible
//      (letter-distinct spelling font) + fuller dyslexia "Easy-read" mode. ALSO: audio
//      manifest load now RETRIES on failure (was once-and-never-retry) so a long-lived
//      installed-PWA session can't get permanently stuck on the robotic device voice.
// v24 (§28 user backlog): crystal prices ~2.5× (catalog.js); "Who's playing?" shown for any
//      count≥1 (app.js); OFFLINE PRINTABLES (engine/printables.js + screens/printables.js +
//      @media print); feedback now reaches the developer (worker /api/feedback → KV + push,
//      src/feedback_client.js, src/screens/feedback.js, src/state.js).
// v25 (§28.A follow-up): hidden developer unlock — tap the Settings version line 7× to register
//      THIS device for instant feedback push (push.registerAdmin, gated by ADMIN_KEY). No
//      visible UI (single-admin app). push.js + screens/settings.js changed.
// v26 (§28.A): in-app FEEDBACK ARCHIVE (screens/admin_feedback.js + src/admin.js) — the admin
//      device remembers the key and can browse ALL feedback newest-first; feedback notifications
//      now deep-link (/?view=feedback) straight into it; 7-tap opens the archive once registered.
// v27: root-level overflow-x:clip guard (html/body/#app) kills phantom horizontal scroll on
//      real Android/Samsung devices (the layout viewport could pan a few px past the visual
//      one); also tamed the onboarding -50vw full-bleed to fixed insets. styles.css changed.
// v28 (§26-A #8): SLIM child-facing Settings — advanced levers + players + printables + the
//      Parents&privacy block now live in a collapsed "Grown-up settings" <details> disclosure;
//      the default view is just the simple kid controls. settings.js + styles.css changed.
// v29: clip overflow-x on the onboarding level-select scroller (.onboard-body) — its 9 level
//      cards' shadows caused a ~3px phantom horizontal pan an overflow-y:auto box permits.
// v30 (§26-B feel): subtle staggered GLINT on owned catalog crystals (dependency-free motion,
//      no GSAP) + a global prefers-reduced-motion guard (was missing) that stills the looping
//      ambience for vestibular-sensitive users. styles.css only.
// v31: AUDIO TAIL batch — +160 dictation clips (1678→1838 words; 1081 remain for future free
//      runs). Additive; runtime falls back to TTS for any word without a clip.
// v32: THE actual Samsung right-side pan — `.header-title` was overflow:hidden+nowrap+long title,
//      i.e. its own touch-scroll container that panned ~55-95px on narrow (320-360px) phones.
//      overflow:clip keeps the ellipsis but makes it un-pannable. Reproduced + fixed via real
//      Galaxy device descriptors (scripts/qa_galaxy.mjs), now 0 pan on every Galaxy × screen.
const VERSION = 'csc-v32';

const CORE = [
  '/',
  '/index.html',
  '/styles.css',
  '/fonts/atkinson-hyperlegible-400.woff2',
  '/fonts/atkinson-hyperlegible-700.woff2',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/src/app.js',
  '/src/ui.js',
  '/src/state.js',
  '/src/audio.js',
  '/src/push.js',
  '/src/feedback_client.js',
  '/src/admin.js',
  '/src/pwa.js',
  '/src/version.js',
  '/src/engine/pushconfig.js',
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
  '/src/engine/printables.js',
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
  '/src/screens/geode.js',
  '/src/screens/printables.js',
  '/src/screens/admin_feedback.js',
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

// Daily-reminder Web Push (opt-in; see src/push.js + worker.js). The payload is the JSON the
// Worker encrypted ({ title, body, url }); show it as a notification. userVisibleOnly means we
// MUST show something, so we fall back to generic copy if the payload is missing/garbled.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = data.title || 'Crystal Spell Caverns';
  const options = {
    body: data.body || 'Your daily geode is ready to open! 💎',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: data.tag || 'daily-geode',
    renotify: true,
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Tapping the notification focuses an open app window, or opens one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of all) {
        if ('focus' in client) {
          try {
            await client.navigate(target);
          } catch {
            /* cross-origin or unsupported — just focus */
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
      return undefined;
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
