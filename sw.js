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
// v33: the SAME touch-pannable class on more surfaces, caught by a hardened qa_overflow that
//      now does a DEFINITIVE scrollLeft-pannability test (+touch-action awareness): the
//      onboarding/"Who's playing?" glow (.onboarding inset:-10% ::before) and level cards were
//      pannable ~33-39px every launch -> overflow:clip; grids -> minmax(0,1fr) so long labels
//      clip not expand; .onboard-body -> touch-action:pan-y. 0 pan on every Galaxy × screen.
// v34 (§30 LEARNING-MODEL REDESIGN): discrete word categories (engine/categories.js) +
//      category-driven selection/adaptive level (selection.js) + the free/offline draw-mode
//      recognizer (handwriting.js) + the new MASTERY draw mode (modes/mastery.js); craft
//      gem-cost hints, ~5s mining timer, Craft→Mastery→Mining unlock chain, Progress category view.
// v35 (§30 fixes, user 2026-06-19f): Settings level change now re-aims the learning set
//      (categories.setLevelAndRefill); craft gems trimmed (CRAFT_MULT 1.5→1.2); draw mode
//      AUTO-recognises after the pen lifts (no "Read" button). (Recognizer accuracy still WIP.)
// v36 (§30 recognizer, user 2026-06-19f): the draw-mode letter recogniser is now a real
//      on-device EMNIST-letters CNN (src/cnn_recognizer.js + vendored TF.js + a 0.4MB model
//      trained by scripts/train_recognizer.mjs, ~94% top-1) — fixes the a/q/c/s confusion the
//      old grid/Dice matcher had; fully offline + private (no strokes leave the device).
//      PLUS a KEYBOARD fallback in Mastery (toggle draw ↔ type with the on-screen/physical kbd).
// csc-v37: §31 — whole-word MULTI-BOX writing on wide screens (a mini-canvas per letter,
//      auto-filling the best guess; tap a box to redo), MASTERY-FIRST nudging (recommendNext
//      steers known→mastered), + the real-device fixes (one ink overlay, ✓ Check submit,
//      speech that doesn't talk over praise, cross-box stroke capture). PLUS §32 — DICTATION =
//      SPELL OUT LOUD: the child says the letters and the app listens (src/speech.js, Web Speech),
//      behind a one-time GROWN-UP consent (parentalGate in ui.js; voiceConsent in state.js).
// csc-v38: §32 voice — iOS-friendly recogniser rework (single-shot + restart, interimResults,
//      emit-each-new-letter) + a live on-screen "heard:" readout to diagnose/tune recognition,
//      and the confusing Peek/Hide toggle removed from voice mode (sentence just shows).
// csc-v39: §32 voice SHELVED (Ian) — cloud Web Speech can't reliably read isolated letters from a
//      child (it transcribes connected speech into words + the open mic echoed the app's TTS). The
//      🎤 button is removed (VOICE_SPELLING_ENABLED=false in modes/mastery.js); the recogniser/
//      consent/UI are parked for a future PUSH-TO-TALK + on-device-letter-model rebuild (HANDOFF §32).
//      PRIVACY.md reverted (mic not used). Draw + type remain the spelling methods.
// csc-v40: the /?dev=mastery TEST unlock is COMMENTED OUT in app.js (Ian) — disabled so the
//      backdoor isn't live on prod, but KEPT (not removed) for future testing. No feature change.
// csc-v41: §33 PHONE LAYOUT — truly fix co-visibility (user 2026-06-20). The word being filled in,
//      the interaction surface (tray / draw canvas / answer tiles) AND the action buttons now stay
//      on-screen together for ANY word length on a phone. A --play-scale custom property (fitPlayArea
//      in ui.js) shrinks the tiles/canvas to fit the play-body height; CSS compacts the iPad-tuned
//      gaps/prompt on phone (max-width:480) + landscape (max-height:520). iPad PORTRAIT is unchanged
//      (scale stays 1 — the §31-approved layout); iPad landscape + all phones now fully co-visible.
// csc-v42: §32.A INTERFACE AUDIO — the fixed interface narration (Geo's onboarding lines, the geode/
//      boss prompts) + the mastery praise now play PRE-RENDERED neural-TTS clips, not the robotic
//      device voice. New audio/ui/ bucket + manifest.ui; say() resolves UI clips at natural speed;
//      strings centralized in src/engine/ui_phrases.js (precached) so the runtime + generator agree.
// csc-v43: AUDIO TAIL — +460 word clips (1838→2298 of 2919; 621 remain for a future free run). Pure
//      additive content (audio/ is NOT precached; manifest is no-cache) so this bump is bookkeeping —
//      it keeps the displayed version in step with the shipped clip count. New batch on gemini-2.5-flash;
//      size distribution matches the proven prior set.
// csc-v44: §34 PHONE PROPORTIONS — phone-only (max-width:480) CSS tuning so the play area no longer
//      looks cramped under iPad-sized chrome. Collapse the ~100px dead strip above the play area on a
//      fresh word (empty combo-label + combo bar + dots) and the empty verdict/verdict-chip reserves,
//      so fitPlayArea keeps FULL-SIZE tiles (scale ~1, was 0.9) — the "play area too small" fix; plus a
//      lighter home title + tighter hero spacing. styles.css only; iPad portrait stays pixel-identical.
// csc-v45: REWARD-SCREEN overlay fix + orientation unlock. (1) End-of-session reward (craft/mastery/
//      mining): on SHORT viewports the pinned button row grew to ~60% of the screen and COVERED the
//      gem-haul text scrolling behind it. Now: narrow phones get full-width primary CTAs + a compact
//      3-across nav row; landscape drops the decorative emoji/paragraphs and lays buttons inline — so
//      nothing overlaps at any size (verified 360/390 portrait + landscape phone + iPad land). iPad
//      PORTRAIT reward unchanged. "Mine (fast)"→"Mine" so the nav row fits narrow. (2) manifest
//      orientation portrait→any so the installed PWA can rotate to landscape (CSS already supports it).
const VERSION = 'csc-v45';

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
  '/src/cnn_recognizer.js',
  '/src/speech.js',
  '/src/vendor/tf.min.js',
  '/src/models/letters/model.json',
  '/src/models/letters/weights.bin',
  '/src/engine/pushconfig.js',
  '/src/engine/lexicon.js',
  '/src/engine/distractors.js',
  '/src/engine/praise.js',
  '/src/engine/ui_phrases.js',
  '/src/engine/assessment.js',
  '/src/engine/progress.js',
  '/src/engine/session.js',
  '/src/engine/categories.js',
  '/src/engine/selection.js',
  '/src/engine/handwriting.js',
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
  '/src/modes/mastery.js',
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
