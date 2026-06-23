// src/engine/admin_view.js — PURE admin data view (ADMIN_APP.md §4).
//
// Flattens a stored family CONTAINER (engine/profiles.js schema 2, as held in KV
// FAMILY_SYNC) into one summary ROW per profile, with every metric the admin app shows or
// exports already derived. No DOM, no network — importable under `node --test`. It reuses
// the §30 category engine (deserialize + the tested query/unlock functions) so the admin's
// counts/unlocks can never drift from what the game itself computes.

import {
  deserializeCategoryState,
  unlocks,
  learningWords,
  knownWords,
  masteredWords,
  trickyWords,
} from './categories.js';

// One profile -> a flat summary row. `familyCode` is the KV key (the family sync code).
export function flattenProfile(familyCode, profile) {
  const p = profile || {};
  const settings = p.settings || {};
  const stats = p.stats || {};
  const streak = p.streak || {};
  const catalog = p.catalog || {};
  const cats = deserializeCategoryState(p.categories); // revives the Map + migrates legacy bands
  const u = unlocks(cats);

  const answers = stats.answers || 0;
  const correct = stats.correct || 0;
  const learning = learningWords(cats);
  const known = knownWords(cats);
  const mastered = masteredWords(cats);
  const tricky = trickyWords(cats);

  return {
    // identity
    familyCode,
    profileId: p.id || null,
    name: (p.profile && p.profile.name) || p.name || 'Explorer',
    themeColor: settings.themeColor || null,
    age: p.placement && p.placement.age != null ? p.placement.age : null,
    kidLock: !!p.kidLock,
    // settings
    difficulty: settings.difficulty || 'easy',
    wordsPerDig: settings.length != null ? settings.length : cats.setSize,
    voice: settings.voice !== false,
    volume: settings.volume != null ? settings.volume : null,
    voiceRate: settings.voiceRate != null ? settings.voiceRate : null,
    readableText: !!settings.readableText,
    dailyGoalGems: settings.dailyGoalGems != null ? settings.dailyGoalGems : null,
    reminders: settings.reminders !== false,
    labDisabled: !!settings.labDisabled, // §37 admin specimen lock
    // progress
    level: cats.level,
    peakLevel: cats.peakLevel,
    startLevel: p.startLevel != null ? p.startLevel : 1,
    masteryUnlocked: u.mastery,
    miningUnlocked: u.mining,
    // stats
    playMs: stats.playMs || 0,
    sessionsPlayed: stats.sessionsPlayed || 0,
    answers,
    correct,
    accuracy: answers ? correct / answers : 0,
    gems: p.gems || 0,
    streakCurrent: streak.count || 0,
    streakBest: streak.longest || 0,
    streakLastDay: streak.lastPlayedDate || null,
    // words — lists + counts (counts are the CSV default; lists are opt-in)
    learning,
    known,
    mastered,
    tricky,
    learningCount: learning.length,
    knownCount: known.length,
    masteredCount: mastered.length,
    trickyCount: tricky.length,
    // catalog / other
    crystalsOwned: Array.isArray(catalog.owned) ? catalog.owned.length : 0,
    milestoneDepth: catalog.milestoneDepth || 1,
    specimenCount: Array.isArray(p.specimens) ? p.specimens.length : 0,
    feedbackCount: Array.isArray(p.feedback) ? p.feedback.length : 0,
    lastBackupAt: p.lastBackupAt || 0,
    // raw per-word records (for the per-word CSV granularity + the detail word lists)
    wordRecords: [...cats.words.values()].map((r) => ({ ...r })),
  };
}

// A whole family container -> one row per profile.
export function flattenContainer(familyCode, container) {
  const profiles = container && Array.isArray(container.profiles) ? container.profiles : [];
  return profiles.map((p) => flattenProfile(familyCode, p));
}

// Many families -> a flat list of all student rows. `families` items may be
// { code, data } (the admin API envelope shape) or { code, container }.
export function flattenFamilies(families) {
  return (Array.isArray(families) ? families : []).flatMap((f) =>
    flattenContainer(f.code, f.data || f.container || f),
  );
}
