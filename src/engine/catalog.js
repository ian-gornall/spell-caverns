// src/engine/catalog.js — PURE Crystal Catalog: a collectible roster of REAL
// minerals (the original learner loves rocks & minerals) the kid unlocks by SPENDING
// gems and earns FREE at depth milestones.
//
// Why it exists:
//   - Gem SPEND SINK (QA I5): waves mine hundreds of gems with nothing to spend them
//     on. The catalog gives gems a purpose without any real-money pressure, FOMO
//     timers, or randomised "loot" — every crystal has a visible price and the kid
//     chooses which to unlock (autonomy / SDT; rewards informational, not controlling).
//   - Endowed-progress COLLECTION (research Tier 2 #6): a visible "N/24 collected"
//     goal pulls the learner forward; depth milestones grant the next one free.
//   - Educational: each crystal is a real mineral with a short kid-safe fact.
//
// No art assets (project constraint): each crystal is drawn procedurally from a hue +
// facet count, so `crystalSvg` returns a pure SVG string the screen injects. Imports
// nothing browser-specific; covered by node --test.

// Rarity ladder: ascending gem cost + a glow accent for the card. Costs tuned UP
// AGAIN (§28.B — the user wanted the collection grind lengthened) against the
// rebalanced wave economy (~120-280 gems/wave, see praise.js BASE_POINTS): the first
// common still lands in a handful of waves, but the FULL 24-mineral collection is now a
// multi-MONTH goal (~47k gems total) — a real long-haul sink, never a grind wall
// (cheaper tiers stay reachable, and depth milestones still grant some crystals free).
export const RARITIES = {
  common: { label: 'Common', cost: 400, glow: '#7AE582' },
  rare: { label: 'Rare', cost: 1200, glow: '#36F1CD' },
  epic: { label: 'Epic', cost: 3000, glow: '#9D8DF1' },
  legendary: { label: 'Legendary', cost: 6500, glow: '#FFD23F' },
};

// The roster — real minerals, ordered by rarity then a sensible reveal order. `hue`
// drives the procedural colour; `facets` (5-8) varies the cut; `fact` is a short,
// true, kid-safe note (ties the game to the rocks-&-minerals interest).
export const CRYSTAL_SPECIES = [
  // --- common ---
  { id: 'quartz', name: 'Quartz', hue: 200, facets: 6, rarity: 'common', fact: 'One of the most common minerals on Earth.' },
  { id: 'amethyst', name: 'Amethyst', hue: 280, facets: 6, rarity: 'common', fact: 'Purple quartz — its color comes from iron.' },
  { id: 'citrine', name: 'Citrine', hue: 46, facets: 6, rarity: 'common', fact: 'A sunny yellow kind of quartz.' },
  { id: 'rose-quartz', name: 'Rose Quartz', hue: 335, facets: 6, rarity: 'common', fact: 'Soft pink quartz, popular for carvings.' },
  { id: 'jade', name: 'Jade', hue: 140, facets: 7, rarity: 'common', fact: 'A tough green stone prized for carving.' },
  { id: 'agate', name: 'Agate', hue: 25, facets: 7, rarity: 'common', fact: 'Famous for its colorful banded layers.' },
  { id: 'pyrite', name: 'Pyrite', hue: 50, facets: 5, rarity: 'common', fact: "Shiny and gold — nicknamed 'fool's gold'." },
  { id: 'fluorite', name: 'Fluorite', hue: 170, facets: 6, rarity: 'common', fact: 'Some fluorite glows under ultraviolet light.' },
  // --- rare ---
  { id: 'emerald', name: 'Emerald', hue: 150, facets: 6, rarity: 'rare', fact: 'A deep-green form of the mineral beryl.' },
  { id: 'sapphire', name: 'Sapphire', hue: 222, facets: 7, rarity: 'rare', fact: 'A blue gem, second only to diamond in hardness.' },
  { id: 'topaz', name: 'Topaz', hue: 40, facets: 6, rarity: 'rare', fact: 'Comes in many colors, often golden.' },
  { id: 'garnet', name: 'Garnet', hue: 352, facets: 7, rarity: 'rare', fact: 'Usually deep red — the January birthstone.' },
  { id: 'aquamarine', name: 'Aquamarine', hue: 185, facets: 6, rarity: 'rare', fact: 'Sea-blue beryl, the color of ocean water.' },
  { id: 'peridot', name: 'Peridot', hue: 90, facets: 6, rarity: 'rare', fact: 'An olive-green gem born deep in the Earth.' },
  { id: 'turquoise', name: 'Turquoise', hue: 178, facets: 7, rarity: 'rare', fact: 'A blue-green stone loved for thousands of years.' },
  { id: 'lapis', name: 'Lapis Lazuli', hue: 230, facets: 8, rarity: 'rare', fact: 'Deep blue rock once ground up to make paint.' },
  // --- epic ---
  { id: 'ruby', name: 'Ruby', hue: 356, facets: 8, rarity: 'epic', fact: 'Red corundum — one of the hardest gems.' },
  { id: 'opal', name: 'Opal', hue: 190, facets: 8, rarity: 'epic', fact: 'Flashes many colors when it catches the light.' },
  { id: 'moonstone', name: 'Moonstone', hue: 215, facets: 7, rarity: 'epic', fact: 'Shimmers with a soft, floating blue glow.' },
  { id: 'tourmaline', name: 'Tourmaline', hue: 320, facets: 8, rarity: 'epic', fact: 'A single crystal can show several colors.' },
  { id: 'malachite', name: 'Malachite', hue: 160, facets: 7, rarity: 'epic', fact: 'Bright green with swirling banded patterns.' },
  // --- legendary ---
  { id: 'diamond', name: 'Diamond', hue: 198, facets: 8, rarity: 'legendary', fact: 'The hardest natural material on Earth.' },
  { id: 'alexandrite', name: 'Alexandrite', hue: 130, facets: 8, rarity: 'legendary', fact: 'Amazingly, it changes color in different light!' },
  { id: 'star-sapphire', name: 'Star Sapphire', hue: 235, facets: 8, rarity: 'legendary', fact: 'Shows a glowing six-rayed star on its surface.' },
];

const BY_ID = new Map(CRYSTAL_SPECIES.map((s) => [s.id, s]));
const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary'];

export function crystalById(id) {
  return BY_ID.get(id);
}

export function cost(species) {
  return RARITIES[species.rarity].cost;
}

export function isOwned(owned, id) {
  return (owned || []).includes(id);
}

// Collection progress overall + per rarity (for the "N/24 collected" headers).
export function catalogSummary(owned) {
  const set = new Set((owned || []).filter((id) => BY_ID.has(id)));
  const byRarity = {};
  for (const r of RARITY_ORDER) byRarity[r] = { owned: 0, total: 0 };
  for (const s of CRYSTAL_SPECIES) {
    byRarity[s.rarity].total += 1;
    if (set.has(s.id)) byRarity[s.rarity].owned += 1;
  }
  return { owned: set.size, total: CRYSTAL_SPECIES.length, byRarity };
}

// Un-owned species the learner can afford right now (cheapest first) — the screen
// highlights these as "you can unlock this!".
export function affordableLocked(owned, gems) {
  const set = new Set(owned || []);
  return CRYSTAL_SPECIES.filter((s) => !set.has(s.id) && cost(s) <= gems).sort(
    (a, b) => cost(a) - cost(b),
  );
}

// The next crystal to GRANT FREE at a milestone: the first un-owned species in
// cheapest-rarity-then-roster order (so milestone gifts feel like steady progress
// up the ladder). null once everything is collected.
export function nextFreeCrystal(owned) {
  const set = new Set(owned || []);
  for (const r of RARITY_ORDER) {
    for (const s of CRYSTAL_SPECIES) {
      if (s.rarity === r && !set.has(s.id)) return s;
    }
  }
  return null;
}

// A pure, validated purchase: returns the would-be new owned list + remaining gems,
// or an ok:false with a reason. The caller (state/screen) applies the result and
// persists — keeping the economics testable and side-effect-free here.
export function purchaseResult(owned, gems, id) {
  const species = BY_ID.get(id);
  if (!species) return { ok: false, reason: 'unknown' };
  if ((owned || []).includes(id)) return { ok: false, reason: 'owned' };
  const price = cost(species);
  if ((gems || 0) < price) return { ok: false, reason: 'insufficient' };
  return { ok: true, owned: [...(owned || []), id], gems: gems - price, species, spent: price };
}

// --- procedural art (pure SVG string; no assets — project constraint) -----------
// A brilliant-cut gem viewed top-down: an outer faceted ring (alternating-shaded
// quads between two concentric polygons) under a lighter "table". Deterministic from
// the species' hue + facet count, so the same crystal always looks the same.
export function crystalSvg(species, { size = 120 } = {}) {
  const s = size;
  const cx = s / 2;
  const cy = s / 2;
  const r = s * 0.44;
  const rt = r * 0.52; // table (flat top) radius
  const n = Math.max(5, Math.min(8, species.facets || 6));
  const hue = ((Math.round(species.hue) % 360) + 360) % 360;
  const base = `hsl(${hue},70%,52%)`;
  const lo = `hsl(${hue},62%,38%)`;
  const table = `hsl(${hue},86%,72%)`;
  const edge = `hsl(${hue},90%,86%)`;

  const ring = (radius, off) =>
    Array.from({ length: n }, (_, i) => {
      const a = (Math.PI * 2 * i) / n - Math.PI / 2 + off;
      return [cx + radius * Math.cos(a), cy + radius * Math.sin(a)];
    });
  const outer = ring(r, 0);
  const inner = ring(rt, 0);
  const fmt = (pts) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

  // crown facets: a quad between each outer edge and the matching table edge,
  // alternating base/dark so the gem reads as faceted.
  const facets = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const quad = [outer[i], outer[j], inner[j], inner[i]];
    facets.push(
      `<polygon points="${fmt(quad)}" fill="${i % 2 ? base : lo}" stroke="${edge}" stroke-width="0.6" stroke-opacity="0.5"/>`,
    );
  }
  const tablePoly = `<polygon points="${fmt(inner)}" fill="${table}" stroke="${edge}" stroke-width="1"/>`;
  const outline = `<polygon points="${fmt(outer)}" fill="none" stroke="${edge}" stroke-width="1.4"/>`;
  const sparkle = `<circle cx="${(cx - rt * 0.35).toFixed(1)}" cy="${(cy - rt * 0.3).toFixed(1)}" r="${(rt * 0.16).toFixed(1)}" fill="#ffffff" opacity="0.75"/>`;

  return (
    `<svg viewBox="0 0 ${s} ${s}" width="${s}" height="${s}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${species.name}">` +
    facets.join('') +
    tablePoly +
    outline +
    sparkle +
    `</svg>`
  );
}
