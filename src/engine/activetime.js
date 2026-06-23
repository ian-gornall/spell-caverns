// src/engine/activetime.js — §37 A ACTIVE-ENGAGEMENT time accumulator (Ian 2026-06-23). PURE.
//
// Tracks how long a child has been ACTIVELY engaged. Distinct from createIdleGuard (ui.js), which
// watches for INACTIVITY to nudge/pause. Here we measure CONTINUOUS active play to off-ramp a long
// session: after `lockMs` (20 min) of unbroken engagement the app should suggest a break (§37 A).
//
// Two clocks come out of the SAME activity stream (Ian: "build this once — TODO B's play-time
// metric reuses it"):
//   • streakMs — the CONTINUOUS active streak. A gap >= breakMs between interactions is a real
//     break/idle (Ian design call #1) and RESETS it to 0. This drives the 20-minute lock.
//   • playMs   — the LIFETIME active total. The same active gaps add to it, but a break NEVER
//     subtracts. This is the persisted "play time" metric the parent/teacher view (§37 B) reuses.
//
// "Active" means real interaction: the DOM wiring (app.js) calls mark(now) on pointer/key events.
// The gap BETWEEN two interactions counts as active time only while it stays under breakMs — i.e.
// the child kept doing things. A long quiet gap is a break, not active time, so it is never banked.
export function createActiveTimer({ lockMs = 20 * 60 * 1000, breakMs = 60 * 1000, playMs = 0 } = {}) {
  let streakMs = 0; // continuous active streak (resets on a break)
  let totalMs = playMs; // lifetime active total (survives breaks)
  let last = null; // timestamp of the most recent activity mark, or null before the first

  // The streak INCLUDING the live (not-yet-committed) gap up to `t`. While that gap is under
  // breakMs the child is still active so it counts; once it reaches breakMs they have gone idle,
  // so the live streak freezes at the committed value (the next mark() will reset it to 0).
  const streakLive = (t) => {
    if (last == null) return streakMs;
    const gap = t - last;
    return gap >= breakMs ? streakMs : streakMs + gap;
  };

  return {
    // Record a real interaction at time `t`. Commits the gap since the previous mark:
    //   gap >= breakMs → a real BREAK: reset the continuous streak (lifetime total untouched);
    //   gap <  breakMs → active engagement: the gap counts toward BOTH streak and lifetime total.
    mark(t) {
      if (last == null) {
        last = t;
        return;
      }
      const gap = t - last;
      last = t;
      if (gap >= breakMs) {
        streakMs = 0;
      } else {
        streakMs += gap;
        totalMs += gap;
      }
    },
    streakLive,
    // True once the continuous active streak (including the live gap) reaches the lock threshold.
    locked: (t) => streakLive(t) >= lockMs,
    streakMs: () => streakMs,
    playMs: () => totalMs,
    // End the streak without losing play time — called when the break is over (lock dismissed),
    // and on a tab leaving, so resuming starts a fresh 20-minute clock. `last` is cleared too so
    // the (possibly huge) gap across the break isn't mistaken for one giant active stretch.
    resetStreak() {
      streakMs = 0;
      last = null;
    },
    // Re-anchor to a different profile's stored play total and start its streak fresh.
    bind(playMs0 = 0) {
      totalMs = playMs0 || 0;
      streakMs = 0;
      last = null;
    },
  };
}
