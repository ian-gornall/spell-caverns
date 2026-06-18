// test/catalog.test.js — the PURE Crystal Catalog engine: a collectible roster of
// real minerals unlocked by spending gems (the gem economy's spend sink, QA I5) and
// granted free at depth milestones (endowed-progress collection). Covers the species
// table integrity, ownership/affordability queries, the pure purchase transaction,
// the milestone free-grant selector, and the procedural SVG generator.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CRYSTAL_SPECIES,
  RARITIES,
  crystalById,
  cost,
  isOwned,
  catalogSummary,
  affordableLocked,
  nextFreeCrystal,
  purchaseResult,
  crystalSvg,
} from '../src/engine/catalog.js';

test('species table is well-formed (unique ids, valid rarity, hue range, fact)', () => {
  assert.ok(CRYSTAL_SPECIES.length >= 20, 'a worthwhile collection');
  const ids = new Set();
  for (const s of CRYSTAL_SPECIES) {
    assert.equal(typeof s.id, 'string');
    assert.ok(s.id.length, 'non-empty id');
    assert.ok(!ids.has(s.id), `duplicate id ${s.id}`);
    ids.add(s.id);
    assert.equal(typeof s.name, 'string');
    assert.ok(s.name.length, 'has a name');
    assert.ok(RARITIES[s.rarity], `valid rarity for ${s.id}`);
    assert.ok(Number.isFinite(s.hue) && s.hue >= 0 && s.hue < 360, `hue in range for ${s.id}`);
    assert.ok(Number.isInteger(s.facets) && s.facets >= 5 && s.facets <= 8, `facets for ${s.id}`);
    assert.ok(typeof s.fact === 'string' && s.fact.length > 4, `has a fact for ${s.id}`);
  }
});

test('rarities define an ascending, positive cost ladder', () => {
  const order = ['common', 'rare', 'epic', 'legendary'];
  let prev = 0;
  for (const r of order) {
    assert.ok(RARITIES[r], `rarity ${r} defined`);
    assert.ok(RARITIES[r].cost > prev, `${r} cost ascends`);
    prev = RARITIES[r].cost;
  }
  // every rarity is represented by at least one species
  for (const r of order) {
    assert.ok(CRYSTAL_SPECIES.some((s) => s.rarity === r), `at least one ${r} species`);
  }
});

test('crystalById + cost resolve correctly', () => {
  const s = CRYSTAL_SPECIES[0];
  assert.equal(crystalById(s.id), s);
  assert.equal(crystalById('not-a-real-id'), undefined);
  assert.equal(cost(s), RARITIES[s.rarity].cost);
});

test('isOwned + catalogSummary report collection progress', () => {
  const common = CRYSTAL_SPECIES.filter((s) => s.rarity === 'common');
  const owned = [common[0].id, common[1].id];
  assert.ok(isOwned(owned, common[0].id));
  assert.ok(!isOwned(owned, common[2]?.id ?? 'x'));
  const sum = catalogSummary(owned);
  assert.equal(sum.total, CRYSTAL_SPECIES.length);
  assert.equal(sum.owned, 2);
  assert.equal(sum.byRarity.common.owned, 2);
  assert.equal(sum.byRarity.common.total, common.length);
  // unknown / duplicate ids in owned don't inflate the count
  const sum2 = catalogSummary([common[0].id, common[0].id, 'ghost']);
  assert.equal(sum2.owned, 1);
});

test('affordableLocked returns only un-owned species the learner can buy', () => {
  const cheapest = [...CRYSTAL_SPECIES].sort((a, b) => cost(a) - cost(b))[0];
  const broke = affordableLocked([], 0);
  assert.equal(broke.length, 0, 'nothing affordable with 0 gems');
  const some = affordableLocked([], cost(cheapest));
  assert.ok(some.some((s) => s.id === cheapest.id), 'cheapest is affordable');
  assert.ok(some.every((s) => cost(s) <= cost(cheapest)));
  // already-owned never appears
  const ownedCheapest = affordableLocked([cheapest.id], cost(cheapest));
  assert.ok(!ownedCheapest.some((s) => s.id === cheapest.id));
});

test('nextFreeCrystal yields the next un-owned species (cheapest-first), null when complete', () => {
  const first = nextFreeCrystal([]);
  assert.ok(first, 'something to grant when nothing owned');
  // cheapest rarity first
  assert.equal(first.rarity, 'common');
  const allIds = CRYSTAL_SPECIES.map((s) => s.id);
  assert.equal(nextFreeCrystal(allIds), null, 'null when everything is owned');
  // skips owned ones
  const next = nextFreeCrystal([first.id]);
  assert.notEqual(next.id, first.id);
});

test('purchaseResult is a pure, validated transaction', () => {
  const cheapest = [...CRYSTAL_SPECIES].sort((a, b) => cost(a) - cost(b))[0];
  // success: gems deducted, species added, original arrays untouched
  const owned = [];
  const r = purchaseResult(owned, cost(cheapest) + 50, cheapest.id);
  assert.equal(r.ok, true);
  assert.equal(r.gems, 50);
  assert.deepEqual(r.owned, [cheapest.id]);
  assert.deepEqual(owned, [], 'input not mutated');
  // too poor
  const poor = purchaseResult([], cost(cheapest) - 1, cheapest.id);
  assert.equal(poor.ok, false);
  assert.equal(poor.reason, 'insufficient');
  // already owned
  const dup = purchaseResult([cheapest.id], 99999, cheapest.id);
  assert.equal(dup.ok, false);
  assert.equal(dup.reason, 'owned');
  // unknown id
  const ghost = purchaseResult([], 99999, 'ghost');
  assert.equal(ghost.ok, false);
  assert.equal(ghost.reason, 'unknown');
});

test('crystalSvg renders a deterministic, hue-tinted faceted gem', () => {
  const s = CRYSTAL_SPECIES[0];
  const svg = crystalSvg(s, { size: 100 });
  assert.match(svg, /^<svg/, 'is an svg');
  assert.match(svg, /polygon/, 'has facet polygons');
  assert.match(svg, new RegExp(`${s.hue}`), 'colour derives from the hue');
  // deterministic
  assert.equal(crystalSvg(s, { size: 100 }), svg);
  // a different species (different hue) renders differently
  const other = CRYSTAL_SPECIES.find((x) => x.hue !== s.hue);
  assert.notEqual(crystalSvg(other, { size: 100 }), svg);
  // facet count influences the geometry (more polygons for more facets)
  const polys = (svg.match(/<polygon/g) || []).length;
  assert.ok(polys >= s.facets, 'at least one polygon per facet');
});
