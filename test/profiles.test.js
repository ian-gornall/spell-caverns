// test/profiles.test.js — PURE multi-profile container model (src/engine/profiles.js):
// schema/migration, snapshots, and per-profile sync merge. Runs under `node --test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SCHEMA,
  MAX_SNAPSHOTS,
  emptyContainer,
  isContainer,
  isLegacyBlob,
  migrateLegacy,
  getProfile,
  activeProfile,
  profileSummaries,
  pushSnapshot,
  mergeFamily,
} from '../src/engine/profiles.js';

test('emptyContainer / isContainer / isLegacyBlob classify saves correctly', () => {
  const c = emptyContainer();
  assert.equal(c.schema, SCHEMA);
  assert.ok(isContainer(c));
  assert.ok(!isContainer({ version: 1, settings: {} }));
  assert.ok(isLegacyBlob({ version: 1, settings: {}, tracker: {} }));
  assert.ok(!isLegacyBlob(emptyContainer()));
  assert.ok(!isLegacyBlob(null));
});

test('migrateLegacy wraps an old single blob as one profile + lifts family sync fields', () => {
  const blob = {
    version: 1,
    profile: { name: 'Ada', onboarded: true },
    settings: { difficulty: 'easy', syncCode: 'SMITH2024', syncConsent: true },
    gems: 42,
    tracker: { tick: 3, records: [] },
  };
  const c = migrateLegacy(blob, 'p1');
  assert.ok(isContainer(c));
  assert.equal(c.activeId, 'p1');
  assert.equal(c.syncCode, 'SMITH2024', 'sync lifted to family level');
  assert.equal(c.syncConsent, true);
  assert.equal(c.profiles.length, 1);
  const p = activeProfile(c);
  assert.equal(p.name, 'Ada');
  assert.equal(p.gems, 42, 'progress preserved');
  assert.deepEqual(p.snapshots, []);
});

test('getProfile / activeProfile / profileSummaries', () => {
  const c = {
    ...emptyContainer(),
    activeId: 'b',
    profiles: [
      { id: 'a', name: 'Al', settings: { themeColor: '#111' } },
      { id: 'b', name: 'Bo', kidLock: 'DGSTPZMN' },
    ],
  };
  assert.equal(getProfile(c, 'a').name, 'Al');
  assert.equal(getProfile(c, 'zzz'), null);
  assert.equal(activeProfile(c).name, 'Bo');
  const sums = profileSummaries(c);
  assert.deepEqual(sums.map((s) => s.name), ['Al', 'Bo']);
  assert.equal(sums[0].locked, false);
  assert.equal(sums[1].locked, true, 'a kid-locked profile reports locked (no data leak)');
  assert.equal(sums[0].themeColor, '#111');
});

test('pushSnapshot keeps a bounded, newest-last ring', () => {
  let snaps = [];
  for (let i = 0; i < MAX_SNAPSHOTS + 3; i++) snaps = pushSnapshot(snaps, { at: i, data: `s${i}` });
  assert.equal(snaps.length, MAX_SNAPSHOTS, 'capped');
  assert.equal(snaps[snaps.length - 1].at, MAX_SNAPSHOTS + 2, 'newest kept');
  assert.equal(snaps[0].at, 3, 'oldest dropped');
  // custom max
  assert.equal(pushSnapshot([{ at: 1 }, { at: 2 }], { at: 3 }, 2).length, 2);
});

test('mergeFamily reconciles each profile independently; one-sided profiles carry through', () => {
  // pick = "more gems wins" stand-in for the real never-lose-progress reconcile
  const pick = (l, r) => {
    if (!l) return r;
    if (!r) return l;
    return (r.gems || 0) > (l.gems || 0) ? r : l;
  };
  const local = {
    ...emptyContainer(),
    syncCode: 'FAM',
    profiles: [
      { id: 'a', name: 'Al', gems: 100 }, // local ahead
      { id: 'b', name: 'Bo', gems: 5 }, // remote ahead
      { id: 'c', name: 'Cy', gems: 7 }, // local only
    ],
  };
  const remote = {
    ...emptyContainer(),
    syncCode: 'IGNORED-remote-family-fields',
    profiles: [
      { id: 'a', name: 'Al', gems: 30 },
      { id: 'b', name: 'Bo', gems: 80 },
      { id: 'd', name: 'Di', gems: 12 }, // remote only
    ],
  };
  const merged = mergeFamily(local, remote, pick);
  const byId = Object.fromEntries(merged.profiles.map((p) => [p.id, p]));
  assert.equal(byId.a.gems, 100, 'local-ahead profile keeps local');
  assert.equal(byId.b.gems, 80, 'remote-ahead profile adopts remote');
  assert.equal(byId.c.gems, 7, 'local-only carried through');
  assert.equal(byId.d.gems, 12, 'remote-only carried through');
  assert.equal(merged.syncCode, 'FAM', 'family-level fields stay LOCAL to this device');
});
