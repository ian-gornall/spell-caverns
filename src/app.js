// src/app.js — bootstrap + router.
//
// Loads persisted state, wires the shared `ctx` (state + audio + nav + helpers)
// that every screen receives, primes audio on the FIRST user gesture (iOS
// requirement), and renders the home screen. The route table maps names to
// screen factories; each factory returns a DOM node that `render()` mounts.
import * as store from './state.js';
import * as audio from './audio.js';
import { setRoot, render, toast, applyTheme, applyReadable } from './ui.js';
import { homeScreen } from './screens/home.js';
import { onboardingScreen } from './screens/onboarding.js';
import { profilesScreen } from './screens/profiles.js';
import { settingsScreen } from './screens/settings.js';
import { progressScreen } from './screens/progress.js';
import { feedbackScreen } from './screens/feedback.js';
import { catalogScreen } from './screens/catalog.js';
import { bossScreen } from './screens/boss.js';
import { geodeScreen } from './screens/geode.js';
import { printablesScreen } from './screens/printables.js';
import { adminFeedbackScreen } from './screens/admin_feedback.js';
import { startRhythm } from './modes/rhythm.js';
import { startPuzzle } from './modes/puzzle.js';
import { startMastery } from './modes/mastery.js';
import { startLab } from './modes/lab.js';
import { summary } from './engine/progress.js';
import { byRank } from './engine/lexicon.js';
import { fillLearning, recordCraft, knownWords, learningWords } from './engine/categories.js';
import { registerServiceWorker } from './pwa.js';

const routes = {
  home: homeScreen,
  settings: settingsScreen,
  progress: progressScreen,
  rhythm: startRhythm,
  puzzle: startPuzzle,
  mastery: startMastery,
  lab: startLab,
  feedback: feedbackScreen,
  catalog: catalogScreen,
  onboarding: onboardingScreen,
  profiles: profilesScreen,
  boss: bossScreen,
  geode: geodeScreen,
  printables: printablesScreen,
  admin: adminFeedbackScreen,
};

let ctx = null;
let leaveHandlers = []; // teardown fns the current screen registered (idle guards, timers)

function nav(name, params = {}) {
  const factory = routes[name];
  if (!factory) {
    toast('Coming soon! ✨');
    return;
  }
  // Run the leaving screen's teardown (idle guards, pending timers) before we drop
  // its DOM, so nothing keeps running in the background after we navigate away.
  const handlers = leaveHandlers;
  leaveHandlers = [];
  for (const fn of handlers) {
    try {
      fn();
    } catch {
      /* ignore */
    }
  }
  // Stop any in-flight speech from the screen we're leaving FIRST — then build the
  // next screen, so its on-mount dictation (rhythm) survives and is actually heard.
  audio.stop();
  ctx.route = name;
  render(factory(ctx, params));
}

// Cavern depth = a friendly level number that grows as words are mastered.
function depth() {
  if (!ctx.state) return 1;
  const known = summary(ctx.state.tracker).counts.known;
  return 1 + Math.floor(known / 8);
}

// Load the ACTIVE profile into ctx + apply its audio/theme/easy-read prefs. Called at
// boot and whenever the profile changes (profile-select / add explorer).
function refreshActive() {
  const s = store.get();
  ctx.state = s;
  if (s) {
    audio.configure(s.settings);
    applyTheme(s.settings.themeColor);
    applyReadable(s.settings.readableText);
  }
  return s;
}

function boot() {
  store.load();
  ctx = {
    state: store.get(),
    store,
    audio,
    nav,
    toast,
    depth,
    save: store.save,
    onLeave: (fn) => leaveHandlers.push(fn),
    refreshActive, // screens call this after switching/creating a profile
  };

  setRoot(document.getElementById('app'));
  // Register the service worker + the update-and-reload flow (src/pwa.js): an installed PWA
  // re-checks for a deploy on every foreground and reloads when a new version takes over.
  registerServiceWorker();
  // Prime audio/speech on the first tap anywhere — iOS unlocks media only inside a user
  // gesture (HANDOFF §4). `{ once:true }` removes the listener after.
  window.addEventListener('pointerdown', () => audio.prime(), { once: true });

  // Deliver any feedback that didn't reach the developer last time (offline at submit). Lazy +
  // best-effort — never blocks boot, never throws. (§28.A)
  import('./feedback_client.js')
    .then((fc) => fc.flushUnsent(store))
    .catch(() => {});

  // DEVELOPER deep-link (§28.A): a feedback notification opens "/?view=feedback". On the
  // developer's own (admin-registered) device, jump straight to the feedback archive and SKIP
  // the normal launch flow. Checked synchronously (read the stored key) so there's no flash of
  // the picker. For everyone else (no admin key) the param is ignored → normal boot.
  let adminKey = '';
  try {
    adminKey = localStorage.getItem('csc_admin_key') || '';
  } catch {
    /* storage disabled */
  }
  if (adminKey && new URLSearchParams(location.search).get('view') === 'feedback') {
    if (store.profileCount() >= 1) refreshActive(); // give screens a ctx.state if possible
    nav('admin');
    maybeBootSync();
    return;
  }

  // TEST/DEV UNLOCK (§31): "/?dev=mastery" promotes the active profile's working set to KNOWN so
  // MASTERY unlocks immediately (with a backlog to master → the §31.C nudge fires too) — lets Ian
  // try the new draw modes without grinding 10 words to known first. Local data only; harmless.
  // TODO(§31): strip this before the clean merge to main (it's a test affordance, not a feature).
  if (new URLSearchParams(location.search).get('dev') === 'mastery' && store.profileCount() >= 1) {
    refreshActive();
    devUnlockMastery();
    nav('home');
    maybeBootSync();
    return;
  }

  // Route by how many explorers exist:
  //  - none yet → first-run onboarding (creates explorer #1)
  //  - one or more → "Who's playing?" EVERY launch (user 2026-06-19, §28.D): ALWAYS ask
  //    who's playing AND always surface the "Add explorer" option — even for a one-child
  //    family — because what the game serves depends on that learner's progress, and a
  //    grown-up needs an easy way to add a sibling. (The only exception: a single profile
  //    still mid-onboarding resumes onboarding directly — no point picking an unfinished one.)
  const count = store.profileCount();
  if (count === 0) {
    nav('onboarding');
  } else if (count === 1 && !store.get().profile.onboarded) {
    refreshActive();
    nav('onboarding');
    maybeBootSync();
  } else {
    nav('profiles');
    maybeBootSync(); // sync the family in the background while they pick
  }
}

// Family sync (cross-device): if the FAMILY sync password is set, pull + merge on open
// and push when the app is backgrounded (app switch / lock). Non-blocking + lazy-loaded;
// any failure (offline) is ignored. Conflict resolution never loses progress.
function maybeBootSync() {
  const code = store.syncCode();
  if (!code) return;
  const localEnv = () => JSON.parse(store.exportData());
  const adopt = (envel) => store.importData(JSON.stringify(envel));
  import('./cloud_sync_backend.js').then((sync) => {
    sync
      .syncNow({ code, getLocal: localEnv, applyRemote: adopt })
      .then((res) => {
        if (res && res.action === 'pull') {
          refreshActive();
          if (ctx.route === 'home') nav('home');
          toast('Synced your latest progress ✨');
        }
      })
      .catch(() => {});
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && store.syncCode()) {
        sync.push(store.syncCode(), localEnv()).catch(() => {});
      }
    });
  });
}

// §31 test affordance (see the "/?dev=mastery" hook in boot): craft the active profile's first
// `setSize` learning words up to KNOWN so Mastery unlocks with a backlog still to master. Uses the
// real engine transitions (recordCraft ×2 → known) so the resulting state is exactly what normal
// play produces. TODO(§31): remove with the boot hook before the clean merge.
function devUnlockMastery() {
  const cats = ctx.state && ctx.state.categories;
  if (!cats) return;
  const pool = byRank().filter((w) => w.word.length >= 3);
  fillLearning(cats, pool);
  for (let i = 0; i < cats.setSize && i < 50; i++) {
    const lw = learningWords(cats);
    if (!lw.length || knownWords(cats).length >= cats.setSize) break;
    recordCraft(cats, lw[0], true, { pool });
    recordCraft(cats, lw[0], true, { pool });
  }
  store.save();
  toast('🔓 Test unlock: Mastery is open — go draw some words! ✍️');
}

boot();
