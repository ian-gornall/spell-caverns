// src/app.js — bootstrap + router.
//
// Loads persisted state, wires the shared `ctx` (state + audio + nav + helpers)
// that every screen receives, primes audio on the FIRST user gesture (iOS
// requirement), and renders the home screen. The route table maps names to
// screen factories; each factory returns a DOM node that `render()` mounts.
import * as store from './state.js';
import * as audio from './audio.js';
import { setRoot, render, toast } from './ui.js';
import { homeScreen } from './screens/home.js';
import { settingsScreen } from './screens/settings.js';
import { progressScreen } from './screens/progress.js';
import { feedbackScreen } from './screens/feedback.js';
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
};

let ctx = null;

function nav(name, params = {}) {
  const factory = routes[name];
  if (!factory) {
    toast('Coming soon! ✨');
    return;
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

  ctx = { state, store, audio, nav, toast, depth, save: store.save };

  setRoot(document.getElementById('app'));

  // Prime audio/speech on the first tap anywhere — iOS unlocks media only inside
  // a user gesture (HANDOFF §4). `{ once:true }` removes the listener after.
  window.addEventListener('pointerdown', () => audio.prime(), { once: true });

  nav('home');
}

boot();
