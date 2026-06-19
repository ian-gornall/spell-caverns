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

// Gem value of a base (combo-0, slowest-tier-equivalent) correct answer. Tuned DOWN
// from 10 (§17.D economy rebalance): per-answer gems were generous enough that the
// Catalog could be bought out in a day. A flawless 10-word wave now mines ~280 gems
// (speed ×3 and the combo ramp still make a great run feel like a big haul), and the
// Catalog (raised in step) becomes a multi-week collection. Never punitive — just
// slower-earned. See catalog.js RARITIES + state.js dailyGoalGems.
export const BASE_POINTS = 6;

// CRAFTING (spelling a word from scratch) is the ASSESSMENT — the thing we most want
// kids to do and prove (§B pedagogy rebalance). So a crafted word pays MORE gems than
// the same word merely recognised while mining: a flat reward multiplier applied on
// top of the speed/combo scoring. Mining stays fun and fast; crafting is the headline
// pay-off, which steers the loop toward production without ever punishing practice.
// Trimmed 1.5→1.2 (user 2026-06-19f: craft was paying too many gems) — still the best-paid
// path, just less inflated, especially once a long clean combo stacks on top. Tunable.
export const CRAFT_MULT = 1.2;

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
    // a mix of outcome + EFFORT/process praise (growth mindset — praise the work,
    // not just being right; research #9 / Khan's Kodi model)
    phrases: ['Great job!', 'Nice one!', 'Well done!', 'Sparkling!', 'Sharp!', 'Smart work!'],
  },
  {
    key: 'good',
    label: 'Good',
    color: '#9D8DF1', // soft amethyst
    mult: 1,
    maxMs: Infinity,
    // the slowest (still-correct) tier — lean into EFFORT praise: they worked for it
    phrases: ['Good!', 'Got it!', 'You worked it out!', 'Nice thinking!', 'You figured it out!', 'You did it!'],
  },
];

// MINING speed tiers (§30.C): the recognition timer now drains to the bottom in ~5s, the
// SAME for every difficulty, and the speed-tier bonus is STRETCHED across that window so a
// THOUGHTFUL answer at ~2s still earns a strong tier and only the last ~1s drops toward the
// minimum (Ian's goal: actually consider all the options before tapping, without losing the
// DDR reward feel). Same shape/mults/phrases as SPEED_TIERS — only the `maxMs` bounds move
// (perfect ~2.0s, amazing ~3.2s, great ~4.3s, good = the floor reached as the bar bottoms ~5s).
// CRAFT keeps the tighter default SPEED_TIERS; mining passes these in explicitly.
export const MINING_SPEED_TIERS = SPEED_TIERS.map((t, i) => ({
  ...t,
  maxMs: [2000, 3200, 4300, Infinity][i],
}));

// The wrong-answer "tier": gentle, soft-colored, worth nothing — never punitive.
export const MISS_TIER = {
  key: 'tryagain',
  label: 'Try again',
  color: '#8593A3', // muted slate-blue, not alarm red — lifted to clear WCAG AA (≈5.8:1) for the
  //                   wrong-verdict text/"The gem was…" subtext, while staying calm not punitive.
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
// back to the slowest tier (the learner gets credit, just no speed bonus). `tiers`
// lets a mode pass its own schedule (mining uses the stretched MINING_SPEED_TIERS).
function tierForTime(ms, tiers = SPEED_TIERS) {
  const t = Number.isFinite(ms) ? ms : Infinity;
  return tiers.find((tier) => t <= tier.maxMs) || tiers[tiers.length - 1];
}

// projectedScore({responseMs, combo}) -> { tier, label, color, mult, points } for
// the CURRENT elapsed time, with NO phrase and NO rng. The rhythm mode calls this
// every animation frame to show a live "gems you'd earn if you answer now" meter
// that visibly decays as the clock runs — the DDR pressure to be fast. It is the
// exact scoring gradeAnswer uses, so the live meter and the real award agree.
export function projectedScore({ responseMs, combo = 0, craft = false, tiers = SPEED_TIERS } = {}) {
  const tier = tierForTime(responseMs, tiers);
  const streak = Math.max(0, combo);
  const comboFactor = 1 + Math.min(streak, COMBO_CAP) * COMBO_STEP;
  const craftFactor = craft ? CRAFT_MULT : 1;
  return {
    tier: tier.key,
    label: tier.label,
    color: tier.color,
    mult: tier.mult,
    points: Math.round(BASE_POINTS * tier.mult * comboFactor * craftFactor),
  };
}

// gradeAnswer({correct, responseMs, combo, rng}) -> a verdict the UI + audio use:
//   { tier, label, phrase, points, mult, color, combo, isCombo }
// `combo` is the streak length INCLUDING this answer (so 5,10,15... are milestones).
// Wrong answers return a gentle verdict worth 0 points with the streak reset to 0.
export function gradeAnswer({ correct, responseMs, combo = 0, craft = false, rng, tiers = SPEED_TIERS } = {}) {
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
  const proj = projectedScore({ responseMs, combo: streak, craft, tiers });
  const tier = tiers.find((t) => t.key === proj.tier) || tiers[tiers.length - 1];
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
