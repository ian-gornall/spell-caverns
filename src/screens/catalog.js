// src/screens/catalog.js — the Crystal Catalog: spend mined gems to collect real
// minerals (the gem economy's spend sink, QA I5; endowed-progress collection,
// research Tier 2 #6). Every crystal shows its price up front and the kid chooses
// what to unlock — no randomised loot, no timers, no real money (the guardrails in
// RESEARCH.md). Locked crystals are visible silhouettes so the goal is always in
// view; unlocking reveals the full-colour gem + a short real-world fact.
//
// Art is procedural (engine/catalog.crystalSvg → pure SVG string; no assets). UI
// module — verified with Playwright, never imported by node --test.
import { el, header, toast, burst } from '../ui.js';
import {
  CRYSTAL_SPECIES,
  RARITIES,
  cost,
  isOwned,
  catalogSummary,
  crystalSvg,
} from '../engine/catalog.js';

export function catalogScreen(ctx) {
  const owned = ctx.store.ownedCrystals();
  const gems = ctx.state.gems || 0;
  const sum = catalogSummary(owned);
  const pct = Math.round((sum.owned / sum.total) * 100);

  // Buy a crystal, then re-render so gems + the unlocked art refresh.
  const buy = (species, cell) => {
    const res = ctx.store.purchaseCrystal(species.id);
    if (!res.ok) {
      if (res.reason === 'insufficient') {
        toast(`💎 ${cost(species) - gems} more gems to unlock ${species.name}`);
      }
      return;
    }
    const r = cell.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2, RARITIES[species.rarity].glow, 22);
    ctx.audio.sfx(species.rarity === 'legendary' || species.rarity === 'epic' ? 'combo' : 'gem');
    toast(`✨ Unlocked ${species.name}! ${species.fact}`, 2600);
    ctx.nav('catalog');
  };

  const grid = el(
    'div',
    { class: 'catalog-grid' },
    ...CRYSTAL_SPECIES.map((species) => {
      const have = isOwned(owned, species.id);
      const price = cost(species);
      const affordable = !have && gems >= price;
      const cell = el(
        'button',
        {
          class:
            'crystal-cell ' +
            species.rarity +
            (have ? ' owned' : ' locked') +
            (affordable ? ' affordable' : ''),
          onClick: () => {
            if (have) toast(`💎 ${species.name}: ${species.fact}`, 2600);
            else buy(species, cell);
          },
        },
        el('div', { class: 'crystal-art', html: crystalSvg(species, { size: 96 }) }),
        el('div', { class: 'crystal-name' }, have ? species.name : species.name),
        have
          ? el('div', { class: 'crystal-rarity' }, RARITIES[species.rarity].label)
          : el('div', { class: 'crystal-price' + (affordable ? ' can' : '') }, `💎 ${price}`),
      );
      return cell;
    }),
  );

  const rarityChips = el(
    'div',
    { class: 'rarity-chips' },
    ...['common', 'rare', 'epic', 'legendary'].map((r) =>
      el(
        'span',
        { class: 'rarity-chip', style: { '--glow': RARITIES[r].glow } },
        `${RARITIES[r].label} ${sum.byRarity[r].owned}/${sum.byRarity[r].total}`,
      ),
    ),
  );

  return el(
    'div',
    { class: 'screen catalog' },
    header(ctx, { title: 'Crystal Catalog', onBack: () => ctx.nav('home') }),
    el(
      'div',
      { class: 'scroll' },
      el(
        'div',
        { class: 'panel' },
        el('h3', {}, `Mineral collection — ${sum.owned}/${sum.total}`),
        el('div', { class: 'goal-bar' }, el('div', { class: 'goal-fill', style: { width: pct + '%' } })),
        rarityChips,
        el(
          'p',
          { class: 'quest-note', style: { marginTop: '8px' } },
          sum.owned === sum.total
            ? '🏆 Master collector — every mineral catalogued!'
            : 'Spend mined 💎 gems to unlock minerals. Tap a glowing one to collect it!',
        ),
      ),
      el('div', { class: 'panel' }, grid),
    ),
  );
}
