// src/engine/praise.js — PURE DDR / Pump-It-Up reinforcement engine.
//
// On every answer the rhythm mode calls `gradeAnswer(...)`. This module decides:
//   - the SPEED TIER (how fast the learner was: PERFECT / AMAZING / GREAT / Good),
//   - the POINTS (gems) earned, scaled by speed and the current combo streak,
//   - the encouraging PHRASE the game speaks ALOUD (the design's "key" feature) —
//     special celebratory phrases at combo milestones (every 5),
//   - and, for a wrong answer, a GENTLE "try again" (never a harsh buzz).
//
// Imports NOTHING browser-specific, so it runs under `node --test`. The UI maps
// the returned {label, color} to the big on-screen flash; audio speaks {phrase}.
// Randomness (phrase choice) is injected so replays/tests are reproducible.

// Gem value of a base (combo-0, slowest-tier-equivalent) correct answer.
export const BASE_POINTS = 10;

// How a streak boosts points: each consecutive correct adds COMBO_STEP to the
// multiplier, capped at COMBO_CAP so a long run can't run away with the score.
const COMBO_STEP = 0.1;
const COMBO_CAP = 20;
// A celebratory phrase fires when the streak hits a multiple of this.
const COMBO_MILESTONE = 5;

// Speed tiers, FASTEST FIRST. `maxMs` is the inclusive upper bound for the tier;
// the last tier is the Infinity catch-all. `mult` scales points; {label,color}
// drive the big on-screen flash; `phrases` is the spoken-praise pool for the tier.
export const SPEED_TIERS = [
  {
    key: 'perfect',
    label: 'PERFECT!',
    color: '#FFD23F', // crystal gold
    mult: 3,
    maxMs: 1200,
    phrases: ['Perfect!', 'Flawless!', 'Crystal clear!', 'Dazzling!', 'Brilliant!'],
  },
  {
    key: 'amazing',
    label: 'AMAZING!',
    color: '#36F1CD', // bright cyan gem
    mult: 2,
    maxMs: 2200,
    phrases: ['Amazing!', 'Superb!', 'You rock!', 'Gem-tastic!', 'Wonderful!'],
  },
  {
    key: 'great',
    label: 'GREAT!',
    color: '#7AE582', // emerald
    mult: 1.5,
    maxMs: 3500,
    phrases: ['Great job!', 'Nice one!', 'Well done!', 'Sparkling!', 'Sharp!'],
  },
  {
    key: 'good',
    label: 'Good',
    color: '#9D8DF1', // soft amethyst
    mult: 1,
    maxMs: Infinity,
    phrases: ['Good!', 'Got it!', 'Keep going!', 'Nice!', 'You did it!'],
  },
];

// The wrong-answer "tier": gentle, soft-colored, worth nothing — never punitive.
export const MISS_TIER = {
  key: 'tryagain',
  label: 'Try again',
  color: '#6C7A89', // muted slate, not alarm red
  mult: 0,
  maxMs: Infinity,
};

// Spoken at combo milestones. "{combo}" is filled with the streak length.
export const COMBO_PHRASES = [
  '{combo} in a row!',
  'Combo x{combo}!',
  "You're on fire!",
  'Unstoppable!',
  'Power surge!',
];

// Spoken (gently) on a wrong answer — encouragement, no scolding.
export const GENTLE_PHRASES = [
  'Almost!',
  'Try again!',
  'So close!',
  "You've got this!",
  'Give it another go!',
];

// Pick one element using an injected rng (defaults to Math.random).
function pick(arr, rng) {
  const r = rng ? rng() : Math.random();
  return arr[Math.floor(r * arr.length)];
}

// First tier whose inclusive `maxMs` covers `ms`. A missing/invalid time falls
// back to the slowest tier (the learner gets credit, just no speed bonus).
function tierForTime(ms) {
  const t = Number.isFinite(ms) ? ms : Infinity;
  return SPEED_TIERS.find((tier) => t <= tier.maxMs) || SPEED_TIERS[SPEED_TIERS.length - 1];
}

// projectedScore({responseMs, combo}) -> { tier, label, color, mult, points } for
// the CURRENT elapsed time, with NO phrase and NO rng. The rhythm mode calls this
// every animation frame to show a live "gems you'd earn if you answer now" meter
// that visibly decays as the clock runs — the DDR pressure to be fast. It is the
// exact scoring gradeAnswer uses, so the live meter and the real award agree.
export function projectedScore({ responseMs, combo = 0 } = {}) {
  const tier = tierForTime(responseMs);
  const streak = Math.max(0, combo);
  const comboFactor = 1 + Math.min(streak, COMBO_CAP) * COMBO_STEP;
  return {
    tier: tier.key,
    label: tier.label,
    color: tier.color,
    mult: tier.mult,
    points: Math.round(BASE_POINTS * tier.mult * comboFactor),
  };
}

// gradeAnswer({correct, responseMs, combo, rng}) -> a verdict the UI + audio use:
//   { tier, label, phrase, points, mult, color, combo, isCombo }
// `combo` is the streak length INCLUDING this answer (so 5,10,15... are milestones).
// Wrong answers return a gentle verdict worth 0 points with the streak reset to 0.
export function gradeAnswer({ correct, responseMs, combo = 0, rng } = {}) {
  if (!correct) {
    return {
      tier: MISS_TIER.key,
      label: MISS_TIER.label,
      phrase: pick(GENTLE_PHRASES, rng),
      points: 0,
      mult: 0,
      color: MISS_TIER.color,
      combo: 0, // streak broken
      isCombo: false,
    };
  }

  const streak = Math.max(0, combo);
  const proj = projectedScore({ responseMs, combo: streak });
  const tier = SPEED_TIERS.find((t) => t.key === proj.tier) || SPEED_TIERS[SPEED_TIERS.length - 1];
  const isCombo = streak > 0 && streak % COMBO_MILESTONE === 0;
  const phrase = isCombo
    ? pick(COMBO_PHRASES, rng).replace('{combo}', String(streak))
    : pick(tier.phrases, rng);

  return {
    tier: proj.tier,
    label: proj.label,
    phrase,
    points: proj.points,
    mult: proj.mult,
    color: proj.color,
    combo: streak,
    isCombo,
  };
}
