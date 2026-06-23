// src/engine/admin_export.js — PURE CSV export for the admin app (ADMIN_APP.md §9).
//
// Turns the flat rows from admin_view.js into a CSV string, with a configurable column set
// and two granularities. No DOM/network — importable under `node --test`. The UI layer
// (admin/admin.js) triggers the actual file download from the returned string.

const BOM = '﻿'; // so Excel opens the UTF-8 file with the right encoding
const EOL = '\r\n'; // CRLF — the spreadsheet-friendly line ending

// Quote a cell only when needed (comma, quote, CR or LF); double embedded quotes. Booleans
// render yes/no; arrays (word lists) join with "; "; null/undefined -> empty.
export function csvCell(v) {
  if (v == null) return '';
  let s;
  if (typeof v === 'boolean') s = v ? 'yes' : 'no';
  else if (Array.isArray(v)) s = v.join('; ');
  else s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const csvLine = (cells) => cells.map(csvCell).join(',');

// The per-student column registry: key -> { label, get(row) }. `get` derives display-ready
// values (percent accuracy, play minutes) so the CSV is analysis-friendly in Sheets.
export const COLUMNS = {
  // identity
  name: { label: 'Name', get: (r) => r.name },
  familyCode: { label: 'Family', get: (r) => r.familyCode },
  profileId: { label: 'Profile ID', get: (r) => r.profileId },
  age: { label: 'Age', get: (r) => r.age },
  themeColor: { label: 'Colour', get: (r) => r.themeColor },
  kidLock: { label: 'Kid lock', get: (r) => r.kidLock },
  // settings
  difficulty: { label: 'Difficulty', get: (r) => r.difficulty },
  wordsPerDig: { label: 'Words per dig', get: (r) => r.wordsPerDig },
  voice: { label: 'Voice', get: (r) => r.voice },
  volume: { label: 'Volume', get: (r) => r.volume },
  voiceRate: { label: 'Voice rate', get: (r) => r.voiceRate },
  readableText: { label: 'Readable text', get: (r) => r.readableText },
  dailyGoalGems: { label: 'Daily goal gems', get: (r) => r.dailyGoalGems },
  reminders: { label: 'Reminders', get: (r) => r.reminders },
  labDisabled: { label: 'Lab disabled', get: (r) => r.labDisabled },
  // progress
  level: { label: 'Level', get: (r) => r.level },
  peakLevel: { label: 'Peak level', get: (r) => r.peakLevel },
  startLevel: { label: 'Start level', get: (r) => r.startLevel },
  masteryUnlocked: { label: 'Mastery unlocked', get: (r) => r.masteryUnlocked },
  miningUnlocked: { label: 'Mining unlocked', get: (r) => r.miningUnlocked },
  // stats
  playMin: { label: 'Play (min)', get: (r) => Math.round((r.playMs || 0) / 60000) },
  sessionsPlayed: { label: 'Sessions', get: (r) => r.sessionsPlayed },
  answers: { label: 'Answers', get: (r) => r.answers },
  correct: { label: 'Correct', get: (r) => r.correct },
  accuracy: { label: 'Accuracy %', get: (r) => Math.round((r.accuracy || 0) * 100) },
  gems: { label: 'Gems', get: (r) => r.gems },
  streakCurrent: { label: 'Streak', get: (r) => r.streakCurrent },
  streakBest: { label: 'Best streak', get: (r) => r.streakBest },
  streakLastDay: { label: 'Last played', get: (r) => r.streakLastDay },
  // word counts (CSV default-on)
  learningCount: { label: 'Learning #', get: (r) => r.learningCount },
  knownCount: { label: 'Known #', get: (r) => r.knownCount },
  masteredCount: { label: 'Mastered #', get: (r) => r.masteredCount },
  trickyCount: { label: 'Tricky #', get: (r) => r.trickyCount },
  // word lists (verbose, opt-in)
  learning: { label: 'Learning words', get: (r) => r.learning },
  known: { label: 'Known words', get: (r) => r.known },
  mastered: { label: 'Mastered words', get: (r) => r.mastered },
  tricky: { label: 'Tricky words', get: (r) => r.tricky },
};

// The picker groups (for the export modal's checkboxes). "wordLists" is verbose -> default OFF.
export const COLUMN_GROUPS = {
  identity: ['name', 'familyCode', 'age', 'profileId', 'themeColor', 'kidLock'],
  settings: ['difficulty', 'wordsPerDig', 'voice', 'volume', 'voiceRate', 'readableText', 'dailyGoalGems', 'reminders', 'labDisabled'],
  progress: ['level', 'peakLevel', 'startLevel', 'masteryUnlocked', 'miningUnlocked'],
  stats: ['playMin', 'sessionsPlayed', 'answers', 'correct', 'accuracy', 'gems', 'streakCurrent', 'streakBest', 'streakLastDay'],
  words: ['learningCount', 'knownCount', 'masteredCount', 'trickyCount'],
  wordLists: ['learning', 'known', 'mastered', 'tricky'],
};

// The default selected columns (Ian 2026-06-23, §11 Q1): identity essentials + key progress +
// key stats + word COUNTS. Word lists are off by default.
export const DEFAULT_COLUMNS = [
  'name', 'familyCode', 'age',
  'level', 'masteryUnlocked', 'miningUnlocked',
  'playMin', 'sessionsPlayed', 'accuracy', 'gems', 'streakCurrent',
  'learningCount', 'knownCount', 'masteredCount', 'trickyCount',
];

// Resolve column keys -> {key,label,get}, skipping any unknown key.
function resolveColumns(keys) {
  return (Array.isArray(keys) && keys.length ? keys : DEFAULT_COLUMNS)
    .filter((k) => COLUMNS[k])
    .map((k) => ({ key: k, ...COLUMNS[k] }));
}

// Per-WORD granularity: one line per word per profile (ADMIN_APP.md §9 granularity B).
function wordCSV(rows) {
  const header = ['Family', 'Name', 'Word', 'Category', 'Band', 'Pattern', 'Attempts', 'Correct', 'Accuracy %', 'Last seen'];
  const lines = [csvLine(header)];
  for (const r of rows || []) {
    for (const w of r.wordRecords || []) {
      const acc = w.craftAttempts ? Math.round((w.craftCorrect / w.craftAttempts) * 100) : '';
      lines.push(csvLine([r.familyCode, r.name, w.word, w.category, w.band, w.pattern, w.craftAttempts || 0, w.craftCorrect || 0, acc, w.lastSeen || 0]));
    }
  }
  return BOM + lines.join(EOL) + EOL;
}

// Build a CSV string from flat rows (admin_view).
//   opts.granularity: 'student' (one row per profile, default) | 'word' (one row per word)
//   opts.columns: ordered column keys for 'student' granularity (defaults to DEFAULT_COLUMNS)
export function toCSV(rows, opts = {}) {
  if (opts.granularity === 'word') return wordCSV(rows);
  const cols = resolveColumns(opts.columns);
  const lines = [csvLine(cols.map((c) => c.label))];
  for (const r of rows || []) lines.push(csvLine(cols.map((c) => c.get(r))));
  return BOM + lines.join(EOL) + EOL;
}
