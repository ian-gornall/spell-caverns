// test/admin.test.js — PURE admin view + CSV export (src/engine/admin_view.js,
// src/engine/admin_export.js). No DOM/network. Runs under `node --test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flattenProfile, flattenContainer, flattenFamilies } from '../src/engine/admin_view.js';
import { toCSV, csvCell, DEFAULT_COLUMNS, COLUMN_GROUPS } from '../src/engine/admin_export.js';

// A serialized §30 category state (the shape held in KV), with controllable peaks/words.
const cats = (words, over = {}) => ({
  setSize: 3,
  level: 5,
  recent: [],
  order: words.length,
  seen: 5,
  reviewPending: { craft: 0, mastery: 0 },
  peakKnownish: 3,
  peakMastered: 3,
  peakLevel: 5,
  words,
  ...over,
});

const W = (word, category, over = {}) => ({
  word,
  category,
  band: 1,
  pattern: 'short a',
  craftAttempts: 2,
  craftCorrect: 2,
  craftStreak: 1,
  lastSeen: 1,
  order: 1,
  ...over,
});

// A full serialized profile blob (as stored inside a container's profiles[]).
const profileLex = {
  id: 'p1',
  profile: { name: 'Lex' },
  settings: { themeColor: '#7aa2ff', difficulty: 'easy', length: 10, voice: true, labDisabled: false },
  placement: { done: true, age: 8 },
  kidLock: null,
  gems: 1240,
  stats: { sessionsPlayed: 63, answers: 10, correct: 8, playMs: 15120000, byDay: {} }, // 252 min, 80%
  streak: { count: 9, lastPlayedDate: '2026-06-22', longest: 14, freezes: 1 },
  catalog: { owned: ['amethyst', 'quartz'], milestoneDepth: 22 },
  specimens: [{ ts: 1 }, { ts: 2 }],
  feedback: [],
  categories: cats([
    W('cat', 'mastered'),
    W('hat', 'mastered'),
    W('map', 'known'),
    W('ship', 'learning', { craftAttempts: 1, craftCorrect: 0 }),
    W('frog', 'learning', { craftAttempts: 0, craftCorrect: 0 }),
    W('split', 'tricky'),
  ]),
};

const container = {
  schema: 2,
  syncCode: 'K7M3PQ2R',
  activeId: 'p1',
  profiles: [
    profileLex,
    { id: 'p2', profile: { name: 'Sam, Jr' }, settings: {}, stats: { answers: 0, correct: 0 }, categories: cats([]) },
  ],
};

test('flattenProfile derives identity, accuracy, counts and unlocks', () => {
  const r = flattenProfile('K7M3PQ2R', profileLex);
  assert.equal(r.name, 'Lex');
  assert.equal(r.familyCode, 'K7M3PQ2R');
  assert.equal(r.age, 8);
  assert.equal(r.gems, 1240);
  assert.equal(r.level, 5);
  assert.equal(r.peakLevel, 5);
  assert.equal(r.accuracy, 0.8);
  assert.equal(r.playMs, 15120000);
  assert.equal(r.streakCurrent, 9);
  assert.equal(r.streakBest, 14);
  // category counts from the words array
  assert.equal(r.masteredCount, 2);
  assert.equal(r.knownCount, 1);
  assert.equal(r.learningCount, 2);
  assert.equal(r.trickyCount, 1);
  // setSize 3, peaks 3/3 -> both unlocked
  assert.equal(r.masteryUnlocked, true);
  assert.equal(r.miningUnlocked, true);
  // catalog / other
  assert.equal(r.crystalsOwned, 2);
  assert.equal(r.specimenCount, 2);
  // word lists present + raw records for per-word export
  assert.deepEqual(r.mastered.sort(), ['cat', 'hat']);
  assert.equal(r.wordRecords.length, 6);
});

test('flattenContainer + flattenFamilies map every profile', () => {
  const rows = flattenContainer('K7M3PQ2R', container);
  assert.equal(rows.length, 2);
  assert.equal(rows[1].name, 'Sam, Jr');
  assert.equal(rows[1].masteredCount, 0);
  const all = flattenFamilies([{ code: 'K7M3PQ2R', data: container }]);
  assert.equal(all.length, 2);
});

test('flattenProfile is robust to a sparse/legacy profile', () => {
  const r = flattenProfile('FAM', { id: 'x' });
  assert.equal(r.name, 'Explorer');
  assert.equal(r.accuracy, 0);
  assert.equal(r.masteredCount, 0);
  assert.equal(r.masteryUnlocked, false);
});

test('toCSV (student) emits a BOM, label header, and the default column count', () => {
  const rows = flattenContainer('K7M3PQ2R', container);
  const csv = toCSV(rows);
  assert.ok(csv.startsWith('﻿'), 'starts with a UTF-8 BOM');
  const lines = csv.trim().split('\r\n');
  assert.equal(lines.length, 3, 'header + 2 data rows');
  const header = lines[0].replace('﻿', '').split(',');
  assert.equal(header.length, DEFAULT_COLUMNS.length);
  assert.ok(header.includes('Accuracy %'));
  assert.ok(header.includes('Mastered #'));
});

test('toCSV quotes cells containing commas (the "Sam, Jr" name)', () => {
  const rows = flattenContainer('K7M3PQ2R', container);
  const csv = toCSV(rows, { columns: ['name', 'familyCode'] });
  assert.ok(csv.includes('"Sam, Jr",K7M3PQ2R'), 'comma name is quoted');
});

test('toCSV (word granularity) expands one line per word per profile', () => {
  const rows = flattenContainer('K7M3PQ2R', container);
  const csv = toCSV(rows, { granularity: 'word' });
  const lines = csv.trim().split('\r\n');
  // header + 6 word records (Lex has 6; Sam has 0)
  assert.equal(lines.length, 7);
  assert.ok(lines[0].includes('Word'));
  assert.ok(lines[0].includes('Category'));
  assert.ok(lines.some((l) => l.startsWith('K7M3PQ2R,Lex,cat,mastered')));
});

test('csvCell quotes only when needed; booleans->yes/no; arrays->joined; null->empty', () => {
  assert.equal(csvCell('plain'), 'plain');
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('he said "hi"'), '"he said ""hi"""');
  assert.equal(csvCell('line1\nline2'), '"line1\nline2"');
  assert.equal(csvCell(true), 'yes');
  assert.equal(csvCell(false), 'no');
  assert.equal(csvCell(['x', 'y']), 'x; y');
  assert.equal(csvCell(null), '');
  assert.equal(csvCell(undefined), '');
  assert.equal(csvCell(0), '0');
});

test('COLUMN_GROUPS wordLists are excluded from the defaults (verbose, opt-in)', () => {
  for (const k of COLUMN_GROUPS.wordLists) assert.ok(!DEFAULT_COLUMNS.includes(k));
});
