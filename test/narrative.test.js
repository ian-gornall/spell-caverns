// test/narrative.test.js — the PURE narrative spine: named cavern depth ZONES that
// give the descent a light story, plus the Geode-Boss line shown when the learner
// breaks through to a new depth. Data-only + deterministic, so it's easy to lock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ZONES, zoneForDepth, bossAnnounce } from '../src/engine/narrative.js';

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

test('bossAnnounce returns a non-empty Geo line that references the new zone', () => {
  const line = bossAnnounce(3);
  assert.equal(typeof line, 'string');
  assert.ok(line.length > 10);
  assert.match(line, new RegExp(zoneForDepth(3).name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});
