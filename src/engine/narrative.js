// src/engine/narrative.js — PURE light narrative spine for the descent.
//
// The cavern is divided into named ZONES that the learner breaks into as their
// mastery deepens (cavern depth = 1 + floor(mastered/8), see app.js). Each new depth
// is a small story beat: Geo announces the new zone and a "Great Geode" milestone
// gate (the Geode Boss) marks the threshold. This is intentionally LIGHT — flavour
// + endowed-progress framing, never a gate on play (RESEARCH.md guardrails). Data
// only + deterministic; covered by node --test.

// §36 D4 (Ian 2026-06-22d): a geode boss / new cavern DEPTH every 10 MASTERED words (was 8). This is
// the single source of truth for the mastery-depth axis — app.js depth() and screens/progress.js both
// import it, so the boss trigger and the "to the next boss" copy can never drift apart again.
export const WORDS_PER_DEPTH = 10;
export const depthForMastered = (mastered) => 1 + Math.floor(Math.max(0, Number.isFinite(mastered) ? mastered : 0) / WORDS_PER_DEPTH);

export const ZONES = [
  { name: 'the Glimmer Shallows', tagline: 'Sunlight still sparkles on the walls here.' },
  { name: 'the Crystal Hollows', tagline: 'Bright clusters line every winding tunnel.' },
  { name: 'the Echoing Caverns', tagline: 'Your footsteps echo through the wide dark.' },
  { name: 'the Amethyst Deep', tagline: 'Purple crystals glow softly all around you.' },
  { name: 'the Frozen Galleries', tagline: 'Ice and crystal shimmer side by side.' },
  { name: 'the Molten Veins', tagline: 'Warm light pulses from deep within the rock.' },
  { name: 'the Starlit Abyss', tagline: 'Crystals twinkle overhead like a hidden sky.' },
  { name: 'the Heart of the Mountain', tagline: 'The deepest, most dazzling place of all.' },
];

// Resolve a cavern depth (1-based) to its zone, clamped so very shallow / very deep
// always land on a real zone. Carries `depth` back for display.
export function zoneForDepth(depth) {
  const d = Number.isFinite(depth) ? Math.round(depth) : 1;
  const i = Math.max(0, Math.min(ZONES.length - 1, d - 1));
  return { ...ZONES[i], depth: d, index: i };
}

// Geo's announcement when a Geode Boss is cracked and a new zone opens up.
export function bossAnnounce(depth) {
  const z = zoneForDepth(depth);
  return `You broke through to ${z.name}! ${z.tagline}`;
}
