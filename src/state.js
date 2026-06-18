// src/state.js — the app's persistent store (localStorage, single JSON blob).
//
// Holds the learner profile, settings, gem balance, lightweight play stats, the
// feedback log, and the LIVE continuous mastery tracker (a Map, from the pure
// engine). The tracker is serialized on save / deserialized on load via the pure
// helpers in engine/progress.js, so the Map round-trips through JSON. Includes
// export/import so progress can leave the iPad for a parent/dev (HANDOFF §4).
//
// This is a UI module (touches localStorage) — never imported by `node --test`.
import {
  createTracker,
  serializeTracker,
  deserializeTracker,
} from './engine/progress.js';
import { defaultStreak, updateStreak } from './engine/streak.js';
import { purchaseResult, nextFreeCrystal } from './engine/catalog.js';
import { wrapBackup, readBackup } from './engine/backup.js';

const KEY = 'crystal-spell-caverns:v1';

// The two kid-facing levers (difficulty + length) plus voice/display prefs. The
// raw two-axis config (patternSpread×masteryTarget) can override `difficulty`
// later from an advanced screen; the rhythm/session code already accepts either.
function defaultSettings() {
  return {
    difficulty: 'easy', // 'easy' | 'medium' | 'hard'  (or a custom axes object)
    length: 10, // words per session/wave
    optionCount: 3, // answer tiles shown (3 or 4)
    voice: true, // spoken dictation + praise on?
    volume: 0.85, // 0..1
    voiceName: null, // chosen speechSynthesis voice (null = auto-pick English)
    themeColor: '#7AA2FF',
    readableText: false, // accessibility: extra letter-spacing/line-height on spelling text
    dailyGoalGems: 250, // a light daily target — ~1.5-2 digs (§17.D: 80 was cleared by one short wave); momentum, not pressure
  };
}

function defaults() {
  return {
    version: 1,
    profile: { name: 'Explorer' },
    settings: defaultSettings(),
    gems: 0,
    feedback: [], // { ts, rating, difficulty, note }
    specimens: [], // Crystal Lab collection: { ts, word, name, image(dataURL) }
    stats: { sessionsPlayed: 0, answers: 0, correct: 0, byDay: {} },
    streak: defaultStreak(), // daily-play streak (the "glowing vein")
    records: { bestCombo: 0, bestWaveGems: 0 }, // personal bests ("beat your best")
    catalog: { owned: [], milestoneDepth: 1 }, // Crystal Catalog: collected mineral ids + last depth that granted a free crystal
    lastBackupAt: 0, // ms of the last parent backup (0 = never) — drives the backup reminder
    tracker: createTracker(), // LIVE tracker (Map); serialized on save()
  };
}

let state = null;

// Read the saved blob (or fresh defaults). Deep-merges saved settings/profile
// over defaults so a new setting added later still gets a sane value.
export function load() {
  const base = defaults();
  let data = null;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) data = JSON.parse(raw);
  } catch {
    data = null;
  }
  if (data && typeof data === 'object') {
    state = {
      ...base,
      ...data,
      // A save already exists → this is a RETURNING user; treat them as onboarded so an
      // upgrade never forces them through first-run onboarding (the field predates it).
      // A brand-new user has no save at all and falls through to the `else` (onboarding).
      profile: { ...base.profile, onboarded: true, ...(data.profile || {}) },
      settings: { ...base.settings, ...(data.settings || {}) },
      stats: { ...base.stats, ...(data.stats || {}) },
      streak: { ...base.streak, ...(data.streak || {}) },
      records: { ...base.records, ...(data.records || {}) },
      catalog: { ...base.catalog, ...(data.catalog || {}) },
      tracker: deserializeTracker(data.tracker),
    };
  } else {
    state = base;
  }
  return state;
}

export function get() {
  return state || load();
}

// Persist everything. The live tracker is converted to its JSON-safe form first.
export function save() {
  if (!state) return null;
  const data = { ...state, tracker: serializeTracker(state.tracker) };
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* storage full / disabled — play continues, just unsaved */
  }
  return data;
}

// --- small mutators the UI uses (each leaves saving to the caller) -----------

export function addGems(n) {
  state.gems = Math.max(0, (state.gems || 0) + n);
  if (n > 0) {
    const day = new Date().toISOString().slice(0, 10);
    const d = state.stats.byDay[day] || (state.stats.byDay[day] = { answers: 0, correct: 0 });
    d.gems = (d.gems || 0) + n; // gems mined today (drives the daily-goal bar)
  }
  return state.gems;
}

// Gems mined today (for the daily goal). Pure read of the per-day stats.
export function gemsToday() {
  const day = new Date().toISOString().slice(0, 10);
  return state.stats.byDay[day]?.gems || 0;
}

const todayKey = () => new Date().toISOString().slice(0, 10);
// Get-or-create today's stat bucket (for mutators that count daily activity).
function dayBucket() {
  const k = todayKey();
  return state.stats.byDay[k] || (state.stats.byDay[k] = { answers: 0, correct: 0 });
}

// Best combo reached today (drives the combo daily quest) + the all-time record.
export function recordCombo(n) {
  const d = dayBucket();
  d.bestCombo = Math.max(d.bestCombo || 0, n || 0);
  state.records.bestCombo = Math.max(state.records.bestCombo || 0, n || 0);
}

// Update the personal best for gems mined in a single wave ("beat your best").
export function noteWaveEarned(gems) {
  state.records.bestWaveGems = Math.max(state.records.bestWaveGems || 0, gems || 0);
}

// Today's snapshot for the daily quests (read-only; never creates a bucket).
export function dayStats() {
  const d = state.stats.byDay[todayKey()] || {};
  return {
    gems: d.gems || 0,
    correct: d.correct || 0,
    digs: d.digs || 0,
    bestCombo: d.bestCombo || 0,
    specimens: d.specimens || 0,
  };
}

// The daily geode (all-quests-complete bonus) opens once per day.
export function geodeOpenedToday() {
  return !!(state.stats.byDay[todayKey()] || {}).geodeOpened;
}
export function markGeodeOpened() {
  dayBucket().geodeOpened = true;
  save();
}

// Tally one answer into lifetime + per-day stats (for the progress chart).
export function recordAnswerStat(correct) {
  state.stats.answers += 1;
  if (correct) state.stats.correct += 1;
  const day = new Date().toISOString().slice(0, 10);
  const d = state.stats.byDay[day] || (state.stats.byDay[day] = { answers: 0, correct: 0 });
  d.answers += 1;
  if (correct) d.correct += 1;
}

export function recordSessionPlayed() {
  state.stats.sessionsPlayed += 1;
  dayBucket().digs = (dayBucket().digs || 0) + 1; // digs today (daily quest)
  // A completed dig counts as "played today" — extends the daily streak.
  state.streak = updateStreak(state.streak, todayKey());
}

export function addFeedback(entry) {
  state.feedback.push({ ts: Date.now(), ...entry });
  save();
}

// Save a Crystal Lab specimen (with its drawing). Capped so the PNG dataURLs can't
// grow localStorage without bound — oldest specimens drop off first.
export function addSpecimen(spec) {
  if (!Array.isArray(state.specimens)) state.specimens = [];
  state.specimens.push({ ts: Date.now(), ...spec });
  if (state.specimens.length > 60) state.specimens = state.specimens.slice(-60);
  dayBucket().specimens = (dayBucket().specimens || 0) + 1; // specimens today (daily quest)
  save();
  return state.specimens;
}

// --- Crystal Catalog (mineral collection; gem spend sink) --------------------

function ensureCatalog() {
  if (!state.catalog || typeof state.catalog !== 'object') state.catalog = { owned: [], milestoneDepth: 1 };
  if (!Array.isArray(state.catalog.owned)) state.catalog.owned = [];
  return state.catalog;
}

export function ownedCrystals() {
  return ensureCatalog().owned;
}

// The deepest cavern depth whose Geode-Boss milestone has been cracked. A wave that
// pushes the live depth past this has a PENDING boss (the modes route to it). Stays
// pending until the boss is actually cracked, so leaving early never skips it.
export function lastMilestoneDepth() {
  return ensureCatalog().milestoneDepth || 1;
}

// Buy a crystal with gems (the spend sink). Pure transaction in engine/catalog.js;
// here we apply + persist. Returns { ok, reason?, species? } for the screen to react.
export function purchaseCrystal(id) {
  const cat = ensureCatalog();
  const res = purchaseResult(cat.owned, state.gems || 0, id);
  if (!res.ok) return res;
  cat.owned = res.owned;
  state.gems = res.gems;
  save();
  return res;
}

// Grant the next un-owned crystal FREE for the NEXT uncracked depth gate, when the
// learner's current depth is past it. Advances catalog.milestoneDepth by EXACTLY ONE
// level per call (not straight to `currentDepth`), so a wave that jumps several depths
// still yields one boss + crystal per level over subsequent waves — none is skipped
// (review finding). Returns the granted species (or null if all collected / not past
// the next gate). Idempotent: re-calling at the same depth past the gate keeps granting
// one level at a time until milestoneDepth catches up to currentDepth.
export function grantMilestoneCrystal(currentDepth) {
  const cat = ensureCatalog();
  const last = cat.milestoneDepth || 1;
  if (!(currentDepth > last)) return null;
  cat.milestoneDepth = last + 1;
  const species = nextFreeCrystal(cat.owned);
  if (!species) {
    save();
    return null;
  }
  cat.owned = [...cat.owned, species.id];
  save();
  return species;
}

// --- backup / restore (parent-controlled; data leaves/returns via a JSON file) ----
// All data stays on-device; a "backup" is a file the PARENT keeps in their OWN cloud
// (iCloud Drive / Google Drive via Files), so no server we operate ever holds the
// child's data — the COPPA-minimizing design (see PRIVACY.md / engine/backup.js).

// Whole days since the last parent backup (Infinity if never). For the reminder.
export function lastBackupDays() {
  const last = state.lastBackupAt || 0;
  if (!last) return Infinity;
  return Math.max(0, Math.floor((Date.now() - last) / 86400000));
}

// Is there progress worth backing up yet? (played at least one word, or earned gems)
export function hasProgress() {
  return (state.stats?.answers || 0) > 0 || (state.gems || 0) > 0 || state.tracker.records.size > 0;
}

// Mark that the parent just took a backup (resets the reminder clock).
export function markBackedUp() {
  state.lastBackupAt = Date.now();
  save();
  return state.lastBackupAt;
}

// The backup file contents: the full state (tracker serialized) inside a small,
// identifiable, versioned envelope (marker + version + timestamp only — no new data).
export function exportData() {
  const data = { ...state, tracker: serializeTracker(state.tracker) };
  return JSON.stringify(wrapBackup(data, Date.now()), null, 2);
}

export function importData(text) {
  const parsed = JSON.parse(text);
  const data = readBackup(parsed); // unwrap envelope / accept legacy bare export, else throw
  if (!data || typeof data !== 'object') throw new Error('Not a valid save file.');
  const base = defaults();
  state = {
    ...base,
    ...data,
    profile: { ...base.profile, ...(data.profile || {}) },
    settings: { ...base.settings, ...(data.settings || {}) },
    stats: { ...base.stats, ...(data.stats || {}) },
    streak: { ...base.streak, ...(data.streak || {}) },
    records: { ...base.records, ...(data.records || {}) },
    catalog: { ...base.catalog, ...(data.catalog || {}) },
    tracker: deserializeTracker(data.tracker),
  };
  save();
  return state;
}

export function reset() {
  state = defaults();
  save();
  return state;
}
