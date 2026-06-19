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
import { startRhythm } from './modes/rhythm.js';
import { startPuzzle } from './modes/puzzle.js';
import { startLab } from './modes/lab.js';
import { summary } from './engine/progress.js';
import { registerServiceWorker } from './pwa.js';

const routes = {
  home: homeScreen,
  settings: settingsScreen,
  progress: progressScreen,
  rhythm: startRhythm,
  puzzle: startPuzzle,
  lab: startLab,
  feedback: feedbackScreen,
  catalog: catalogScreen,
  onboarding: onboardingScreen,
  profiles: profilesScreen,
  boss: bossScreen,
  geode: geodeScreen,
  printables: printablesScreen,
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

boot();
