// test/activetime.test.js — §37 A ACTIVE-ENGAGEMENT auto-pause (Ian 2026-06-23). Pure; `node --test`.
//
// Spec: an explorer ACTIVELY engaged for 20 minutes STRAIGHT triggers a break. "Active" = real
// interaction; the streak accumulates the gaps BETWEEN interactions while they stay small. A gap
// >= breakMs is a real break/idle (Ian's design call #1) and RESETS the continuous streak to 0 —
// but NOT the lifetime play-time total (the metric §37 B reuses). The lock fires when the live
// streak (committed + the current pending gap) reaches lockMs.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createActiveTimer } from '../src/engine/activetime.js';

const LOCK = 20 * 60 * 1000; // 20 min
const BREAK = 60 * 1000; // 60s gap = a real break

test('a single mark just anchors the clock — no streak, no play time yet', () => {
  const t = createActiveTimer({ lockMs: LOCK, breakMs: BREAK });
  t.mark(1000);
  assert.equal(t.streakMs(), 0);
  assert.equal(t.playMs(), 0);
  assert.equal(t.locked(1000), false);
});

test('steady activity accumulates the gaps into BOTH the streak and the lifetime total', () => {
  const t = createActiveTimer({ lockMs: LOCK, breakMs: BREAK });
  t.mark(0);
  t.mark(1000); // +1s active
  t.mark(3500); // +2.5s active
  assert.equal(t.streakMs(), 3500);
  assert.equal(t.playMs(), 3500);
});

test('a gap >= breakMs resets the continuous streak but preserves lifetime play time', () => {
  const t = createActiveTimer({ lockMs: LOCK, breakMs: BREAK });
  t.mark(0);
  t.mark(10_000); // +10s active streak
  assert.equal(t.streakMs(), 10_000);
  t.mark(10_000 + BREAK); // a full break-gap → real break
  assert.equal(t.streakMs(), 0, 'the continuous streak resets on a break');
  assert.equal(t.playMs(), 10_000, 'lifetime play time is NOT lost to a break');
  t.mark(10_000 + BREAK + 2000); // active again
  assert.equal(t.streakMs(), 2000, 'the streak rebuilds from zero after the break');
  assert.equal(t.playMs(), 12_000, 'play time keeps counting active engagement');
});

test('streakLive includes the live (uncommitted) gap up to t — until it crosses breakMs', () => {
  const t = createActiveTimer({ lockMs: LOCK, breakMs: BREAK });
  t.mark(0);
  t.mark(5000); // committed streak = 5s
  assert.equal(t.streakLive(5000 + 10_000), 15_000, 'a 10s live gap is still active → counted');
  assert.equal(t.streakLive(5000 + BREAK), 5000, 'once the live gap reaches breakMs it is idle → frozen');
});

test('locked() fires exactly when the live streak reaches lockMs (steady play)', () => {
  const t = createActiveTimer({ lockMs: LOCK, breakMs: BREAK });
  // mark every 30s (well under the 60s break) for just under 20 minutes
  let now = 0;
  t.mark(now);
  for (let i = 0; i < 39; i++) { now += 30_000; t.mark(now); } // 39 * 30s = 19m30s
  assert.equal(t.streakMs(), 19 * 60_000 + 30_000);
  assert.equal(t.locked(now), false, 'not yet at 20 minutes');
  now += 30_000; t.mark(now); // 20m00s
  assert.equal(t.locked(now), true, 'the 20-minute continuous streak triggers the lock');
});

test('an idle stretch in the MIDDLE prevents the lock from ever firing (the break resets it)', () => {
  const t = createActiveTimer({ lockMs: LOCK, breakMs: BREAK });
  let now = 0;
  t.mark(now);
  for (let i = 0; i < 30; i++) { now += 30_000; t.mark(now); } // 15 min of play
  now += 5 * 60_000; t.mark(now); // a 5-minute break in the middle → streak resets
  assert.equal(t.streakMs(), 0);
  for (let i = 0; i < 30; i++) { now += 30_000; t.mark(now); } // another 15 min
  assert.equal(t.locked(now), false, 'no 20-min CONTINUOUS streak ever accrued');
});

test('resetStreak clears the streak (used when the break ends) without touching play time', () => {
  const t = createActiveTimer({ lockMs: LOCK, breakMs: BREAK });
  t.mark(0);
  t.mark(10_000);
  t.resetStreak();
  assert.equal(t.streakMs(), 0);
  assert.equal(t.playMs(), 10_000, 'play time survives a streak reset');
  // after a reset, the next mark just re-anchors (no giant gap counted)
  t.mark(1_000_000);
  assert.equal(t.streakMs(), 0);
  t.mark(1_002_000);
  assert.equal(t.streakMs(), 2000);
});

test('seeds the lifetime total from a stored value and rebinds on profile switch', () => {
  const t = createActiveTimer({ lockMs: LOCK, breakMs: BREAK, playMs: 90_000 });
  assert.equal(t.playMs(), 90_000, 'continues a prior profile total');
  t.mark(0);
  t.mark(5000);
  assert.equal(t.playMs(), 95_000);
  t.bind(42_000); // switched to a different profile
  assert.equal(t.playMs(), 42_000, 'rebinds to the new profile total');
  assert.equal(t.streakMs(), 0, 'and the continuous streak starts fresh for the new explorer');
});
