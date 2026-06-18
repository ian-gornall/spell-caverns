// src/engine/quests.js — PURE daily "Cavern Quests" + the variable "geode" reward.
//
// Three small, date-seeded quests refresh each day (Duolingo Daily Quests; research
// Tier 1 #4). They're BONUS objectives over actions we already track today — never a
// gate on play. Completing all three opens a GEODE: a variable surprise bonus
// (Duolingo chests; variable-ratio reward, research Tier 2 #8) that is always
// positive, free, and never a real-money / come-back-timer dark pattern.
//
// Pure + browser-agnostic: the date (todayISO) and the day's stat snapshot are passed
// in, so this is fully testable. metric names index into a {gems,correct,digs,
// bestCombo,specimens} snapshot the store builds from per-day stats.
import { mulberry32, shuffle } from './distractors.js';

// One template PER metric (so a day's 3 picks are always distinct kinds of goal).
export const QUEST_POOL = [
  { id: 'gems', metric: 'gems', target: 150, icon: '💎', label: (t) => `Mine ${t} gems today` },
  { id: 'correct', metric: 'correct', target: 15, icon: '✅', label: (t) => `Spell ${t} words right` },
  { id: 'digs', metric: 'digs', target: 2, icon: '⛏️', label: (t) => `Finish ${t} digs` },
  { id: 'combo', metric: 'bestCombo', target: 6, icon: '⚡', label: (t) => `Hit a ${t}-word combo` },
  { id: 'specimen', metric: 'specimens', target: 1, icon: '🔮', label: (t) => `Catalog ${t} new crystal` },
];

// Variable geode payouts (weighted; rarer = bigger). All positive — never a dud.
const GEODE_TIERS = [
  { gems: 30, rare: false, weight: 5 },
  { gems: 55, rare: false, weight: 3 },
  { gems: 90, rare: true, weight: 1.5 },
  { gems: 150, rare: true, weight: 0.6 },
];

// Stable per-day seed from a "YYYY-MM-DD" string (FNV-1a — no Date use).
function seedFromDate(dateISO) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < dateISO.length; i++) {
    h ^= dateISO.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) || 1;
}

// The 3 quests for `dateISO` — deterministic for the day (stable across reloads),
// fresh each day. Each carries a ready-to-show `text`.
export function dailyQuests(dateISO, { count = 3 } = {}) {
  const rng = mulberry32(seedFromDate(dateISO));
  return shuffle(QUEST_POOL, rng)
    .slice(0, count)
    .map((q) => ({ id: q.id, metric: q.metric, target: q.target, icon: q.icon, text: q.label(q.target) }));
}

// Progress of one quest against today's snapshot.
export function questProgress(quest, dayStats = {}) {
  const have = Math.max(0, dayStats[quest.metric] || 0);
  return {
    have: Math.min(have, quest.target),
    target: quest.target,
    done: have >= quest.target,
    pct: Math.min(100, Math.round((have / quest.target) * 100)),
  };
}

export function allQuestsDone(quests, dayStats = {}) {
  return quests.length > 0 && quests.every((q) => questProgress(q, dayStats).done);
}

// Crack a geode: a variable, always-positive bonus. Seeded rng -> reproducible.
export function openGeode(rng = Math.random) {
  const total = GEODE_TIERS.reduce((s, t) => s + t.weight, 0);
  let r = rng() * total;
  for (const t of GEODE_TIERS) {
    if ((r -= t.weight) <= 0) return { gems: t.gems, rare: t.rare };
  }
  return { gems: GEODE_TIERS[0].gems, rare: false };
}
