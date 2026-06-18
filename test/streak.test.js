// test/streak.test.js — PURE daily-streak logic (src/engine/streak.js).
// A streak counts consecutive days played; free "lantern" freezes bridge one
// missed day; everything is guilt-free (a lapse just resets to 1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dayDiff,
  defaultStreak,
  updateStreak,
  streakIsLive,
  daysSinceLastPlayed,
} from '../src/engine/streak.js';

test('dayDiff counts whole calendar days', () => {
  assert.equal(dayDiff('2026-06-18', '2026-06-18'), 0);
  assert.equal(dayDiff('2026-06-18', '2026-06-19'), 1);
  assert.equal(dayDiff('2026-06-18', '2026-06-21'), 3);
  assert.equal(dayDiff('2026-06-30', '2026-07-01'), 1); // month boundary
  assert.ok(Number.isNaN(dayDiff('nonsense', '2026-06-18')));
});

test('first play starts a 1-day streak', () => {
  const s = updateStreak(defaultStreak(), '2026-06-18');
  assert.equal(s.count, 1);
  assert.equal(s.lastPlayedDate, '2026-06-18');
  assert.equal(s.longest, 1);
});

test('playing again the same day does not double-count', () => {
  let s = updateStreak(defaultStreak(), '2026-06-18');
  s = updateStreak(s, '2026-06-18');
  assert.equal(s.count, 1);
});

test('consecutive days increment the streak', () => {
  let s = updateStreak(defaultStreak(), '2026-06-18');
  s = updateStreak(s, '2026-06-19');
  s = updateStreak(s, '2026-06-20');
  assert.equal(s.count, 3);
  assert.equal(s.longest, 3);
});

test('a missed day with no freeze resets the streak to 1 (no guilt)', () => {
  let s = updateStreak(defaultStreak(), '2026-06-18');
  s = updateStreak(s, '2026-06-19'); // count 2, no freeze yet
  s = updateStreak(s, '2026-06-21'); // skipped the 20th
  assert.equal(s.count, 1);
  assert.equal(s.longest, 2, 'longest remembers the best run');
});

test('a free lantern bridges one missed day and keeps the streak', () => {
  // build a 5-day streak to earn a freeze, then skip a day
  let s = defaultStreak();
  for (let d = 18; d <= 22; d++) s = updateStreak(s, `2026-06-${d}`);
  assert.equal(s.count, 5);
  assert.equal(s.freezes, 1, 'earned a lantern at the 5-day milestone');
  s = updateStreak(s, '2026-06-24'); // skipped the 23rd -> lantern bridges it
  assert.equal(s.count, 6, 'streak continued across the gap');
  assert.equal(s.freezes, 0, 'lantern consumed');
});

test('freezes cap and are never negative', () => {
  let s = defaultStreak();
  for (let d = 1; d <= 25; d++) s = updateStreak(s, `2026-07-${String(d).padStart(2, '0')}`);
  assert.ok(s.freezes <= 2, `freezes capped, got ${s.freezes}`);
  assert.equal(s.count, 25);
});

test('streakIsLive: lit today or yesterday, cold after that', () => {
  const s = updateStreak(defaultStreak(), '2026-06-18');
  assert.ok(streakIsLive(s, '2026-06-18'));
  assert.ok(streakIsLive(s, '2026-06-19'));
  assert.ok(!streakIsLive(s, '2026-06-21'));
  assert.ok(!streakIsLive(defaultStreak(), '2026-06-18'));
});

test('daysSinceLastPlayed drives the in-app "welcome back" nudge (§17.A)', () => {
  const s = updateStreak(defaultStreak(), '2026-06-18');
  assert.equal(daysSinceLastPlayed(s, '2026-06-18'), 0, 'played today');
  assert.equal(daysSinceLastPlayed(s, '2026-06-19'), 1, 'one day away');
  assert.equal(daysSinceLastPlayed(s, '2026-06-25'), 7, 'a week away');
  // never played -> Infinity (no nudge), and a clock anomaly never goes negative
  assert.equal(daysSinceLastPlayed(defaultStreak(), '2026-06-18'), Infinity);
  assert.equal(daysSinceLastPlayed(s, '2026-06-17'), 0, 'clock skew clamps to 0, never negative');
});
