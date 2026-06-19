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
// bestCombo,specimens,crafted} snapshot the store builds from per-day stats.
import { mulberry32, shuffle } from './distractors.js';

// Growth multiplier applied per ratchet round. Exported so UI can show "×N" labels.
export const ROUND_GROWTH = 1.6;

// One template PER metric (so a day's picks are always distinct kinds of goal).
// The CRAFT quest is handled separately — it is always the headline/first quest.
export const QUEST_POOL = [
  { id: 'craft', metric: 'crafted', target: 5, icon: '🔨', label: (t) => `Craft ${t} words from scratch`, craft: true },
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

// Scale a base target up for ratchet `round`. round 0 returns base exactly.
// Uses Math.max(base+round, round(base * ROUND_GROWTH^round)) so even tiny targets
// (digs:2, specimens:1) grow strictly every round.
function scaledTarget(base, round) {
  if (round === 0) return base;
  return Math.max(base + round, Math.round(base * Math.pow(ROUND_GROWTH, round)));
}

// Build a single quest object with scaled target and display text.
function buildQuest(q, round) {
  const target = scaledTarget(q.target, round);
  return {
    id: q.id,
    metric: q.metric,
    target,
    icon: q.icon,
    text: q.label(target),
    craft: !!q.craft,
  };
}

// The daily quests for `dateISO`:
//   - CRAFT quest is always first (headline quest nudges balanced craft play).
//   - Remaining (count-1) quests are date+round-seeded picks from the non-craft pool.
//   - round=0 matches the "no round" default; targets scale up strictly per round.
export function dailyQuests(dateISO, { count = 3, round = 0 } = {}) {
  const craftQuest = QUEST_POOL.find((q) => q.id === 'craft');
  const nonCraftPool = QUEST_POOL.filter((q) => q.id !== 'craft');

  // Include round in seed so different rounds can vary the non-craft mix.
  const seed = (seedFromDate(dateISO) ^ (round * 2654435761)) >>> 0 || 1;
  const rng = mulberry32(seed);

  const picks = shuffle(nonCraftPool, rng).slice(0, count - 1);

  return [craftQuest, ...picks].map((q) => buildQuest(q, round));
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
// round=0 is identical to the no-opts path (backward compatible).
export function openGeode(rng = Math.random, { round = 0 } = {}) {
  const total = GEODE_TIERS.reduce((s, t) => s + t.weight, 0);
  let r = rng() * total;
  let tier = GEODE_TIERS[0];
  for (const t of GEODE_TIERS) {
    if ((r -= t.weight) <= 0) { tier = t; break; }
  }
  const gems = round === 0 ? tier.gems : Math.max(1, Math.round(tier.gems * (1 + round * 0.6)));
  return { gems, rare: tier.rare };
}
