// src/app.js — bootstrap + router.
//
// Loads persisted state, wires the shared `ctx` (state + audio + nav + helpers)
// that every screen receives, primes audio on the FIRST user gesture (iOS
// requirement), and renders the home screen. The route table maps names to
// screen factories; each factory returns a DOM node that `render()` mounts.
import * as store from './state.js';
import * as audio from './audio.js';
import { setRoot, render, toast, applyTheme, applyReadable, activePauseOverlay } from './ui.js';
import { createActiveTimer } from './engine/activetime.js';
import { learningProgress } from './engine/categories.js';
import { setWordlistMode, wordlistMode, lessonList } from './engine/lexicon.js';
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
import { startLesson } from './modes/lesson.js';
import { startLab } from './modes/lab.js';
import { activeLessonWords, syncLesson } from './engine/lessonrun.js';
import { summary } from './engine/progress.js';
import { depthForMastered } from './engine/narrative.js';
// ⏸️ only used by the DISABLED /?dev=mastery test unlock (commented below) — kept for re-enabling:
// import { byRank } from './engine/lexicon.js';
// import { fillLearning, recordCraft, knownWords, learningWords } from './engine/categories.js';
import { registerServiceWorker } from './pwa.js';

const routes = {
  home: homeScreen,
  settings: settingsScreen,
  progress: progressScreen,
  rhythm: startRhythm,
  puzzle: startPuzzle,
  mastery: startMastery,
  lesson: startLesson, // §40 lessons-mode trial stream
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

// Mastery DEPTH = the milestone axis that fires geode bosses — grows as words are MASTERED
// (every WORDS_PER_DEPTH=10, §36 D4). Distinct from the cavern LEVEL/band (categories.level), which
// is "where you are" in the word list. (summary().counts.known = the legacy tracker's mastered tally.)
function depth() {
  if (!ctx.state) return 1;
  const mastered = summary(ctx.state.tracker).counts.known;
  return depthForMastered(mastered);
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
    // §38: point the lexicon at this profile's word lists (classic or pattern lessons + age).
    setWordlistMode(s.settings.wordlists, s.settings.age ?? s.placement?.age);
    // §40: self-heal the lesson run against the active path (fresh profiles pick lesson 1;
    // age changes re-aim) so Home/Progress read a valid lesson before the mode first runs.
    if (s.lessons) syncLesson(s.lessons, lessonList());
  }
  // §37 A: a profile switch is a real break — re-anchor play time to the new explorer + reset the
  // 20-minute streak so one child's session never carries into the next.
  if (activePause) activePause.rebind();
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

  // §37 A: install the global active-engagement clock (20-min continuous play → soft brain break).
  installActivePause();

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
  // ⏸️ DISABLED 2026-06-20 (Ian): commented out so the backdoor isn't live on prod, but KEPT (not
  //   removed) for future testing — uncomment this block (+ devUnlockMastery below) to re-enable.
  // if (new URLSearchParams(location.search).get('dev') === 'mastery' && store.profileCount() >= 1) {
  //   refreshActive();
  //   devUnlockMastery();
  //   nav('home');
  //   maybeBootSync();
  //   return;
  // }

  // §36 D4 DEBUG (Ian 2026-06-22d): "/?boss" (or "/?boss=N") jumps straight to the GEODE BOSS at
  // depth N (default 1) so the boss screens can be exercised without grinding to a mastery milestone.
  // Needs a profile (the screen reads gems/depth); local data only, harmless. Granting the milestone
  // crystal is idempotent per depth, so re-previewing the same depth is a no-op.
  {
    const bossParam = new URLSearchParams(location.search).get('boss');
    if (bossParam != null && store.profileCount() >= 1) {
      refreshActive();
      const d = Math.max(1, parseInt(bossParam, 10) || 1);
      nav('boss', { depth: d, from: 'home' });
      maybeBootSync();
      return;
    }
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

// §37 A ACTIVE-ENGAGEMENT auto-pause. ONE global active-time clock (engine/activetime.js) watches
// document-wide pointer/key activity across EVERY screen. After LOCK_MS (20 min) of CONTINUOUS
// active play it shows a soft "brain break" (ui.activePauseOverlay) — the off-ramp Ian asked for,
// distinct from the per-screen idle guard (which fires on INACTIVITY). A real break resets the
// streak: a >= BREAK_MS gap between interactions, the tab going away, or a profile switch (Ian
// design call #1). The break is grown-up-dismissable and auto-unlocks after PAUSE_MS (call #2).
// The same clock banks lifetime "play time" into stats.playMs — the metric the §37 B parent/teacher
// view will reuse ("build this once"). QA fast-forwards the thresholds via window.__active* knobs.
let activePause = null; // { rebind } — set by installActivePause; refreshActive() re-anchors on switch

function installActivePause() {
  const num = (k, d) => {
    const v = typeof window !== 'undefined' ? Number(window[k]) : NaN;
    return Number.isFinite(v) && v > 0 ? v : d;
  };
  const LOCK_MS = num('__activeLockMs', 20 * 60 * 1000);
  const BREAK_MS = num('__activeBreakMs', 60 * 1000);
  const PAUSE_MS = num('__activePauseMs', 5 * 60 * 1000);
  const HEARTBEAT_MS = num('__activeHeartbeatMs', 5000);
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const playMs0 = () => (ctx.state && ctx.state.stats && ctx.state.stats.playMs) || 0;

  const timer = createActiveTimer({ lockMs: LOCK_MS, breakMs: BREAK_MS, playMs: playMs0() });
  let overlay = null; // the brain-break overlay while shown (marking is suspended during a break)
  let lastMove = 0;
  let lastSaved = timer.playMs();

  const mark = () => {
    if (overlay) return; // on a break — don't count the break itself as engagement
    timer.mark(now());
  };
  const onMove = () => {
    const t = now();
    if (t - lastMove < 300) return; // throttle the high-frequency pointermove
    lastMove = t;
    mark();
  };
  const persist = () => {
    if (!(ctx.state && ctx.state.stats)) return;
    ctx.state.stats.playMs = timer.playMs();
    lastSaved = timer.playMs();
    try {
      ctx.save();
    } catch {
      /* storage disabled */
    }
  };
  const endBreak = () => {
    overlay = null;
    timer.resetStreak(); // a fresh 20-minute clock starts once the break ends
  };
  const showBreak = () => {
    if (overlay) return;
    // §40: in lessons mode the categories machine is bypassed (learningProgress is empty
    // there) — the break chips read the active lesson's in-progress words instead.
    const learning = wordlistMode() === 'lessons'
      ? (ctx.state && ctx.state.lessons ? activeLessonWords(ctx.state.lessons, lessonList()) : [])
      : ctx.state && ctx.state.categories ? learningProgress(ctx.state.categories) : [];
    overlay = activePauseOverlay({ learning, durationMs: PAUSE_MS, onUnlock: endBreak, onGrownupSkip: endBreak });
  };

  document.addEventListener('pointerdown', mark, true);
  document.addEventListener('pointermove', onMove, true);
  document.addEventListener('keydown', mark, true);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') persist(); // bank play time before a possible eviction
    else mark(); // the (possibly long) hidden gap resets the streak if it was a real break
  });

  setInterval(() => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    if (timer.playMs() !== lastSaved) persist(); // bank play time once per heartbeat when it changed
    if (!overlay && ctx.state && ctx.state.profile && timer.locked(now())) showBreak();
  }, HEARTBEAT_MS);

  activePause = {
    rebind: () => {
      if (overlay) {
        overlay.remove();
        overlay = null;
      }
      timer.bind(playMs0()); // re-anchor play time to the (now active) profile + fresh streak
      lastSaved = timer.playMs();
    },
  };
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
// play produces. ⏸️ DISABLED 2026-06-20 (Ian): commented out with its boot hook so it isn't live on
// prod, but KEPT for future testing — uncomment this + the boot block (and the two imports above:
// byRank / fillLearning,recordCraft,knownWords,learningWords) to re-enable.
// function devUnlockMastery() {
//   const cats = ctx.state && ctx.state.categories;
//   if (!cats) return;
//   const pool = byRank().filter((w) => w.word.length >= 3);
//   fillLearning(cats, pool);
//   for (let i = 0; i < cats.setSize && i < 50; i++) {
//     const lw = learningWords(cats);
//     if (!lw.length || knownWords(cats).length >= cats.setSize) break;
//     recordCraft(cats, lw[0], true, { pool });
//     recordCraft(cats, lw[0], true, { pool });
//   }
//   store.save();
//   toast('🔓 Test unlock: Mastery is open — go draw some words! ✍️');
// }

boot();
