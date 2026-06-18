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
import { settingsScreen } from './screens/settings.js';
import { progressScreen } from './screens/progress.js';
import { feedbackScreen } from './screens/feedback.js';
import { catalogScreen } from './screens/catalog.js';
import { bossScreen } from './screens/boss.js';
import { startRhythm } from './modes/rhythm.js';
import { startPuzzle } from './modes/puzzle.js';
import { startLab } from './modes/lab.js';
import { summary } from './engine/progress.js';

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
  boss: bossScreen,
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
  const known = summary(ctx.state.tracker).counts.known;
  return 1 + Math.floor(known / 8);
}

function boot() {
  const state = store.load();
  audio.configure(state.settings);
  applyTheme(state.settings.themeColor); // restore the miner's chosen crystal colour
  applyReadable(state.settings.readableText); // restore the easy-read preference

  ctx = {
    state,
    store,
    audio,
    nav,
    toast,
    depth,
    save: store.save,
    // a screen registers teardown here; nav() runs them when leaving the screen
    onLeave: (fn) => leaveHandlers.push(fn),
  };

  setRoot(document.getElementById('app'));

  // Prime audio/speech on the first tap anywhere — iOS unlocks media only inside
  // a user gesture (HANDOFF §4). `{ once:true }` removes the listener after.
  window.addEventListener('pointerdown', () => audio.prime(), { once: true });

  // First run → the mascot-guided onboarding (name + crystal colour + a guaranteed-
  // win first wave); afterwards, straight to home.
  nav(state.profile.onboarded ? 'home' : 'onboarding');

  // Best-effort SILENT cloud sync on open, only if the parent already connected Drive
  // on this device. Pulls newer/more-advanced progress before they start playing. Fully
  // optional, lazy-loaded, and non-blocking: any failure (no token, offline) is ignored
  // and play continues on the local data. (Compliant: parent's own Drive — see PRIVACY.md.)
  if (state.settings.cloudConnected && state.settings.cloudClientId) {
    import('./cloud_drive.js')
      .then((cloud) =>
        cloud.syncNow({
          clientId: state.settings.cloudClientId,
          getLocal: () => JSON.parse(store.exportData()),
          applyRemote: (envel) => store.importData(JSON.stringify(envel)),
          interactive: false, // silent — never pop a Google dialog on launch
        }),
      )
      .then((res) => {
        if (res && res.action === 'pull') {
          audio.configure(ctx.state.settings);
          applyTheme(ctx.state.settings.themeColor);
          applyReadable(ctx.state.settings.readableText);
          if (ctx.route === 'home') nav('home'); // re-render with the pulled progress
          toast('Synced your latest progress ✨');
        }
      })
      .catch(() => {
        /* offline / token needs a tap — silent; the parent can Sync now in Settings */
      });
  }
}

boot();
