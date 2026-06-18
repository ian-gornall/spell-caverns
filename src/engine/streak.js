// src/engine/streak.js — PURE daily-streak logic (the "glowing vein").
//
// A streak = consecutive DAYS the learner played (completed at least one dig).
// Modelled on Duolingo's streak, but deliberately GUILT-FREE for a child (research):
//   - freezes ("crystal lanterns") bridge a missed day and are GIVEN AWAY for free
//     (earned every 5-day milestone, capped) — never bought, never monetised;
//   - framing elsewhere is "momentum", not "you broke it";
//   - the daily goal is tiny (one short dig), so a bad day is survivable.
// Date is passed IN (todayISO = "YYYY-MM-DD") so this stays pure + testable; the
// caller (state.js) supplies new Date().toISOString().slice(0,10).

const MAX_FREEZES = 2;
const FREEZE_EVERY = 5; // earn a freeze each 5-day streak milestone

// Whole-day difference b - a for two "YYYY-MM-DD" strings (UTC, calendar days).
export function dayDiff(aISO, bISO) {
  const a = Date.parse(aISO + 'T00:00:00Z');
  const b = Date.parse(bISO + 'T00:00:00Z');
  if (!Number.isFinite(a) || !Number.isFinite(b)) return NaN;
  return Math.round((b - a) / 86400000);
}

export function defaultStreak() {
  return { count: 0, lastPlayedDate: null, longest: 0, freezes: 0 };
}

// Record that the learner played on `todayISO`; return the updated streak state.
// Idempotent within a day (playing twice today doesn't double-count).
export function updateStreak(streak, todayISO) {
  const s = { ...defaultStreak(), ...(streak || {}) };
  if (!s.lastPlayedDate) {
    return { count: 1, lastPlayedDate: todayISO, longest: Math.max(s.longest, 1), freezes: s.freezes };
  }
  const diff = dayDiff(s.lastPlayedDate, todayISO);
  if (!Number.isFinite(diff) || diff <= 0) return s; // same day / clock anomaly: no change

  let count = s.count;
  let freezes = s.freezes;
  if (diff === 1) {
    count += 1; // consecutive day
  } else {
    const missed = diff - 1;
    if (freezes >= missed) {
      freezes -= missed; // lanterns kept the vein glowing across the gap
      count += 1;
    } else {
      count = 1; // streak lapsed — today starts a fresh one (no guilt, just reset)
    }
  }
  // Free forgiveness: earn a lantern each milestone, capped (never purchased).
  if (count > s.count && count % FREEZE_EVERY === 0) freezes = Math.min(MAX_FREEZES, freezes + 1);
  return { count, lastPlayedDate: todayISO, longest: Math.max(s.longest, count), freezes };
}

// Is the streak still "live" as of `todayISO` (played today or yesterday)? Used to
// decide whether to show the flame as lit vs. at-risk, without mutating state.
export function streakIsLive(streak, todayISO) {
  if (!streak || !streak.lastPlayedDate || !streak.count) return false;
  const diff = dayDiff(streak.lastPlayedDate, todayISO);
  return Number.isFinite(diff) && diff >= 0 && diff <= 1;
}
