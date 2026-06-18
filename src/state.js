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
      profile: { ...base.profile, ...(data.profile || {}) },
      settings: { ...base.settings, ...(data.settings || {}) },
      stats: { ...base.stats, ...(data.stats || {}) },
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
  return state.gems;
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
  save();
  return state.specimens;
}

// --- export / import (data leaves/returns via a JSON file) -------------------

export function exportData() {
  const data = { ...state, tracker: serializeTracker(state.tracker) };
  return JSON.stringify(data, null, 2);
}

export function importData(text) {
  const data = JSON.parse(text);
  if (!data || typeof data !== 'object') throw new Error('Not a valid save file.');
  const base = defaults();
  state = {
    ...base,
    ...data,
    profile: { ...base.profile, ...(data.profile || {}) },
    settings: { ...base.settings, ...(data.settings || {}) },
    stats: { ...base.stats, ...(data.stats || {}) },
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
