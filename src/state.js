// src/state.js — the app's persistent store (localStorage).
//
// Storage is now a MULTI-PROFILE container (engine/profiles.js, schema 2): siblings can
// share one device + one family sync password, but each has their OWN progress (the game
// serves words based on THAT learner's mastery — user 2026-06-18). FAMILY-level fields
// (sync password/consent, parent admin password) live on the container; everything else
// is per-profile. To keep every screen unchanged, the module-local `state` is always the
// ACTIVE profile's working blob (same shape as before, with a LIVE tracker Map); `save()`
// folds it back into the container. A legacy single-blob save is migrated to one profile.
//
// UI module (touches localStorage) — never imported by `node --test`.
import { createTracker, serializeTracker, deserializeTracker } from './engine/progress.js';
import { createCategoryState, serializeCategoryState, deserializeCategoryState } from './engine/categories.js';
import { defaultStreak, updateStreak } from './engine/streak.js';
import { purchaseResult, nextFreeCrystal } from './engine/catalog.js';
import { wrapBackup, readBackup } from './engine/backup.js';
import {
  emptyContainer,
  isContainer,
  isLegacyBlob,
  migrateLegacy,
  getProfile,
  profileSummaries,
  pushSnapshot,
} from './engine/profiles.js';

const KEY = 'crystal-spell-caverns:v1';

// Per-profile play/display prefs (sync moved to the FAMILY level — see container fields).
function defaultSettings() {
  return {
    difficulty: 'easy',
    length: 10,
    optionCount: 3,
    voice: true,
    volume: 0.85,
    voiceName: null,
    voiceRate: 0.85, // dictation speed: a little slower than 1.0 by default (clearer for a weak speller); configurable in Settings
    themeColor: '#7AA2FF',
    readableText: false,
    dailyGoalGems: 250,
  };
}

// One learner's full game blob (the working `state` shape). `tracker` is a LIVE Map here;
// it's serialized when folded into the container.
function defaultProfile(id, over = {}) {
  return {
    id,
    version: 1,
    profile: { name: over.name || 'Explorer', onboarded: !!over.onboarded },
    settings: { ...defaultSettings(), ...(over.themeColor ? { themeColor: over.themeColor } : {}) },
    startLevel: over.startLevel || 1, // level-select anchor (per profile)
    kidLock: over.kidLock || null, // optional per-kid lock (a picture/PIN code) — set later
    snapshots: [], // dated rollback points for parent revert
    gems: 0,
    feedback: [],
    specimens: [],
    stats: { sessionsPlayed: 0, answers: 0, correct: 0, byDay: {} },
    streak: defaultStreak(),
    records: { bestCombo: 0, bestWaveGems: 0 },
    catalog: { owned: [], milestoneDepth: 1 },
    lastBackupAt: 0,
    tracker: createTracker(),
    // §30 word-category state machine (working set / known / mastered / tricky). setSize =
    // the "Words per dig" setting; level seeds from the chosen start level then adapts.
    categories: createCategoryState({ setSize: defaultSettings().length, level: over.startLevel || 1 }),
  };
}

let container = null; // the full multi-profile container (profiles store SERIALIZED trackers)
let state = null; // the ACTIVE profile's working blob (LIVE tracker Map)

const newId = () => 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);

// Merge a stored profile blob over the per-profile defaults + revive its tracker Map.
function storedToState(p) {
  const base = defaultProfile(p.id || newId());
  return {
    ...base,
    ...p,
    profile: { ...base.profile, onboarded: true, ...(p.profile || {}) },
    settings: { ...base.settings, ...(p.settings || {}) },
    stats: { ...base.stats, ...(p.stats || {}) },
    streak: { ...base.streak, ...(p.streak || {}) },
    records: { ...base.records, ...(p.records || {}) },
    catalog: { ...base.catalog, ...(p.catalog || {}) },
    snapshots: Array.isArray(p.snapshots) ? p.snapshots : [],
    tracker: deserializeTracker(p.tracker),
    // revive the §30 category machine (absent on pre-§30 saves → a fresh one; words
    // re-categorise through play, while the continuous tracker keeps its history).
    categories: deserializeCategoryState(p.categories),
  };
}

// The JSON-safe form of a working profile blob (serialize the live tracker + category machine).
function stateToStored(s) {
  return { ...s, tracker: serializeTracker(s.tracker), categories: serializeCategoryState(s.categories) };
}

function loadContainer() {
  let data = null;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) data = JSON.parse(raw);
  } catch {
    data = null;
  }
  if (isContainer(data)) container = data;
  else if (isLegacyBlob(data)) container = migrateLegacy(data, newId());
  else container = emptyContainer();
  return container;
}

function activate(id) {
  const p = getProfile(container, id);
  if (!p) {
    state = null;
    return null;
  }
  container.activeId = id;
  state = storedToState(p);
  return state;
}

// Load the container + activate the saved active profile (if any). Returns the active
// `state` or null when there are no profiles yet (boot then routes to onboarding).
export function load() {
  loadContainer();
  if (container.activeId && getProfile(container, container.activeId)) return activate(container.activeId);
  // exactly one profile? activate it; otherwise leave null (who's-playing / first-run).
  if (container.profiles.length === 1) return activate(container.profiles[0].id);
  state = null;
  return state;
}

export function get() {
  return state || load();
}

// Persist: fold the active working `state` back into the container, then write it all.
export function save() {
  if (state) {
    const idx = container.profiles.findIndex((p) => p.id === state.id);
    const stored = stateToStored(state);
    if (idx >= 0) container.profiles[idx] = stored;
    else container.profiles.push(stored);
    container.activeId = state.id;
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(container));
  } catch {
    /* storage full / disabled — play continues, just unsaved */
  }
  return container;
}

// --- profiles ("who's playing?") + family fields ----------------------------

export function profileCount() {
  return (container?.profiles || []).length;
}
export function listProfiles() {
  return profileSummaries(container || emptyContainer());
}
export function activeId() {
  return container?.activeId || null;
}
export function activeName() {
  return state?.profile?.name || null;
}

// Create a new explorer (and make it active). `over` = { name, themeColor, startLevel }.
export function addProfile(over = {}) {
  if (!container) loadContainer();
  if (state) save(); // park the current profile first
  const id = newId();
  state = defaultProfile(id, { ...over, onboarded: true });
  container.profiles.push(stateToStored(state));
  container.activeId = id;
  save();
  return id;
}

export function switchProfile(id) {
  if (!container) loadContainer();
  if (state) save();
  return activate(id);
}

export function removeProfile(id) {
  if (!container) return;
  container.profiles = container.profiles.filter((p) => p.id !== id);
  if (container.activeId === id) {
    container.activeId = null;
    state = null;
  }
  save();
}

// optional per-kid lock (a picture/PIN code on the profile)
export function getKidLock(id) {
  return getProfile(container, id)?.kidLock || null;
}
export function setKidLock(code) {
  if (state) {
    state.kidLock = code || null;
    save();
  }
}

// family-level: the sync password/consent + the parent admin password
export function syncCode() {
  return container?.syncCode || null;
}
export function setSyncCode(code) {
  if (container) {
    container.syncCode = code || null;
    save();
  }
}
export function syncConsent() {
  return !!container?.syncConsent;
}
export function setSyncConsent(on) {
  if (container) {
    container.syncConsent = !!on;
    save();
  }
}
export function parentPassword() {
  return container?.parentPassword || null;
}
export function setParentPassword(pw) {
  if (container) {
    container.parentPassword = pw || null;
    save();
  }
}
// §32: one-time GROWN-UP consent to use the microphone for voice spelling (the child speaks
// letters; the browser/OS speech service transcribes them and the audio is NOT stored — the
// COPPA "voice as a replacement for written input" exception, gated behind a parental OK).
// Family-level so a grown-up enables it once per device. Revocable in Settings.
export function voiceConsent() {
  return !!container?.voiceConsent;
}
export function setVoiceConsent(on) {
  if (container) {
    container.voiceConsent = !!on;
    save();
  }
}

// --- snapshots (parent rollback) ---------------------------------------------
// Capture the active profile's current state as a dated, restorable snapshot.
export function takeSnapshot(label) {
  if (!state) return;
  const entry = { at: Date.now(), label: label || '', data: stateToStored({ ...state, snapshots: [] }) };
  state.snapshots = pushSnapshot(state.snapshots, entry);
  save();
}
export function listSnapshots() {
  return (state?.snapshots || []).map((s, i) => ({ index: i, at: s.at, label: s.label }));
}
// Roll the active profile back to snapshot `index` (keeps the snapshot ring intact).
export function rollback(index) {
  const snap = (state?.snapshots || [])[index];
  if (!snap) return false;
  const snaps = state.snapshots;
  state = storedToState({ ...snap.data, id: state.id });
  state.snapshots = snaps; // keep the rollback history
  save();
  return true;
}

// --- small mutators the UI uses (each leaves saving to the caller) -----------

export function addGems(n) {
  state.gems = Math.max(0, (state.gems || 0) + n);
  if (n > 0) {
    const day = todayKey();
    const d = state.stats.byDay[day] || (state.stats.byDay[day] = { answers: 0, correct: 0 });
    d.gems = (d.gems || 0) + n;
  }
  return state.gems;
}

export function gemsToday() {
  return state.stats.byDay[todayKey()]?.gems || 0;
}

const todayKey = () => new Date().toISOString().slice(0, 10);
function dayBucket() {
  const k = todayKey();
  return state.stats.byDay[k] || (state.stats.byDay[k] = { answers: 0, correct: 0 });
}

export function recordCombo(n) {
  const d = dayBucket();
  d.bestCombo = Math.max(d.bestCombo || 0, n || 0);
  state.records.bestCombo = Math.max(state.records.bestCombo || 0, n || 0);
}

export function noteWaveEarned(gems) {
  state.records.bestWaveGems = Math.max(state.records.bestWaveGems || 0, gems || 0);
}

export function dayStats() {
  const d = state.stats.byDay[todayKey()] || {};
  return {
    gems: d.gems || 0,
    correct: d.correct || 0,
    digs: d.digs || 0,
    bestCombo: d.bestCombo || 0,
    specimens: d.specimens || 0,
    crafted: d.crafted || 0,
  };
}

// Returns the number of geodes opened today (0 if none).
export function geodeRound() {
  return (state.stats.byDay[todayKey()] || {}).geodesOpened || 0;
}

// Boolean accessor: true once any geode has been opened today.
export function geodeOpenedToday() {
  return geodeRound() > 0;
}

// Increment the per-day geode counter (was a boolean toggle — now a count).
export function markGeodeOpened() {
  const d = dayBucket();
  d.geodesOpened = (d.geodesOpened || 0) + 1;
  save();
}

// `source` is optional. When correct && source === 'craft', increment crafted counters.
export function recordAnswerStat(correct, source) {
  state.stats.answers += 1;
  if (correct) state.stats.correct += 1;
  const d = dayBucket();
  d.answers += 1;
  if (correct) d.correct += 1;
  if (correct && source === 'craft') {
    d.crafted = (d.crafted || 0) + 1;
    state.stats.crafted = (state.stats.crafted || 0) + 1;
  }
}

export function recordSessionPlayed() {
  state.stats.sessionsPlayed += 1;
  dayBucket().digs = (dayBucket().digs || 0) + 1;
  state.streak = updateStreak(state.streak, todayKey());
  // Auto-snapshot at the start of each new day's first dig, so the parent always has a
  // recent restore point (bounded ring) without any extra UI.
  const last = state.snapshots[state.snapshots.length - 1];
  const lastDay = last ? new Date(last.at).toISOString().slice(0, 10) : null;
  if (lastDay !== todayKey()) takeSnapshot('auto');
}

// Feedback is stored locally AND delivered to the developer (§28.A). We stamp each entry with
// `sent:false`; the caller POSTs it to /api/feedback best-effort and calls markFeedbackSent on
// success. Anything still unsent (offline at the time) is flushed on the next app open, so a
// kid's feedback is never lost and always eventually reaches the developer.
export function addFeedback(entry) {
  const rec = { ts: Date.now(), sent: false, ...entry };
  state.feedback.push(rec);
  save();
  return rec;
}

export function markFeedbackSent(ts) {
  const rec = state.feedback.find((f) => f.ts === ts);
  if (rec && !rec.sent) {
    rec.sent = true;
    save();
  }
}

export function unsentFeedback() {
  return state.feedback.filter((f) => f && f.sent === false);
}

export function addSpecimen(spec) {
  if (!Array.isArray(state.specimens)) state.specimens = [];
  state.specimens.push({ ts: Date.now(), ...spec });
  if (state.specimens.length > 60) state.specimens = state.specimens.slice(-60);
  dayBucket().specimens = (dayBucket().specimens || 0) + 1;
  save();
  return state.specimens;
}

// --- Crystal Catalog ---------------------------------------------------------

function ensureCatalog() {
  if (!state.catalog || typeof state.catalog !== 'object') state.catalog = { owned: [], milestoneDepth: 1 };
  if (!Array.isArray(state.catalog.owned)) state.catalog.owned = [];
  return state.catalog;
}
export function ownedCrystals() {
  return ensureCatalog().owned;
}
export function lastMilestoneDepth() {
  return ensureCatalog().milestoneDepth || 1;
}
export function purchaseCrystal(id) {
  const cat = ensureCatalog();
  const res = purchaseResult(cat.owned, state.gems || 0, id);
  if (!res.ok) return res;
  cat.owned = res.owned;
  state.gems = res.gems;
  save();
  return res;
}
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

// --- backup / restore (parent-controlled; the WHOLE family in one file) ------

export function lastBackupDays() {
  const last = state?.lastBackupAt || 0;
  if (!last) return Infinity;
  return Math.max(0, Math.floor((Date.now() - last) / 86400000));
}
export function hasProgress() {
  return (state?.stats?.answers || 0) > 0 || (state?.gems || 0) > 0 || (state?.tracker?.records?.size || 0) > 0;
}
export function markBackedUp() {
  if (state) state.lastBackupAt = Date.now();
  save();
  return state?.lastBackupAt;
}

// Export the WHOLE container (all profiles + family) so a parent backs up everyone.
export function exportData() {
  if (state) save(); // fold the live profile in first
  return JSON.stringify(wrapBackup(container, Date.now()), null, 2);
}

// Import a backup: a multi-profile container, or a legacy single blob (migrated).
export function importData(text) {
  const parsed = JSON.parse(text);
  const data = readBackup(parsed);
  if (isContainer(data)) container = data;
  else if (isLegacyBlob(data)) container = migrateLegacy(data, newId());
  else throw new Error('Not a valid Crystal Spell Caverns backup.');
  try {
    localStorage.setItem(KEY, JSON.stringify(container));
  } catch {
    /* ignore */
  }
  // re-activate (the saved active profile, or the first one)
  state = null;
  if (container.activeId && getProfile(container, container.activeId)) activate(container.activeId);
  else if (container.profiles.length) activate(container.profiles[0].id);
  return state;
}

// Wipe THIS device entirely (all profiles + family). The parent's nuclear option.
export function reset() {
  container = emptyContainer();
  state = null;
  try {
    localStorage.setItem(KEY, JSON.stringify(container));
  } catch {
    /* ignore */
  }
  return container;
}

// Reset just the ACTIVE profile's game progress (keep the profile + its name/colour).
export function resetActiveProgress() {
  if (!state) return;
  const keep = { id: state.id, name: state.profile.name, themeColor: state.settings.themeColor, startLevel: state.startLevel, kidLock: state.kidLock };
  state = defaultProfile(keep.id, { name: keep.name, themeColor: keep.themeColor, startLevel: keep.startLevel, onboarded: true });
  state.kidLock = keep.kidLock;
  save();
  return state;
}
