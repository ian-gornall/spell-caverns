// test/narrative.test.js — the PURE narrative spine: named cavern depth ZONES that
// give the descent a light story, plus the Geode-Boss line shown when the learner
// breaks through to a new depth. Data-only + deterministic, so it's easy to lock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ZONES, zoneForDepth, bossAnnounce, WORDS_PER_DEPTH, depthForMastered } from '../src/engine/narrative.js';

test('ZONES are well-formed (name + tagline)', () => {
  assert.ok(ZONES.length >= 6, 'enough zones to feel like a journey');
  for (const z of ZONES) {
    assert.equal(typeof z.name, 'string');
    assert.ok(z.name.length > 3);
    assert.equal(typeof z.tagline, 'string');
    assert.ok(z.tagline.length > 8);
  }
});

test('zoneForDepth maps depth → zone and clamps at the extremes', () => {
  assert.equal(zoneForDepth(1).name, ZONES[0].name);
  assert.equal(zoneForDepth(2).name, ZONES[1].name);
  // clamps below 1
  assert.equal(zoneForDepth(0).name, ZONES[0].name);
  assert.equal(zoneForDepth(-5).name, ZONES[0].name);
  // clamps above the last zone (very deep keeps the deepest zone)
  assert.equal(zoneForDepth(999).name, ZONES[ZONES.length - 1].name);
  // carries the depth back for display
  assert.equal(zoneForDepth(4).depth, 4);
});

// §36 D4 (Ian 2026-06-22d): a geode boss fires every 10 MASTERED words (was 8). depthForMastered is
// the single source of truth for the mastery-depth axis (app.js + screens/progress.js both use it).
test('depthForMastered: a new boss/depth every WORDS_PER_DEPTH (10) mastered words', () => {
  assert.equal(WORDS_PER_DEPTH, 10);
  assert.equal(depthForMastered(0), 1);
  assert.equal(depthForMastered(9), 1); // not yet
  assert.equal(depthForMastered(10), 2); // the 10th mastered word breaks through
  assert.equal(depthForMastered(19), 2);
  assert.equal(depthForMastered(20), 3);
  assert.equal(depthForMastered(100), 11);
  // robust to junk input
  assert.equal(depthForMastered(undefined), 1);
  assert.equal(depthForMastered(-3), 1);
});

test('bossAnnounce returns a non-empty Geo line that references the new zone', () => {
  const line = bossAnnounce(3);
  assert.equal(typeof line, 'string');
  assert.ok(line.length > 10);
  assert.match(line, new RegExp(zoneForDepth(3).name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});
