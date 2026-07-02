// src/engine/fatigue.js — the session fatigue meter (§40).
//
// A lessons-mode block ends at the FATIGUE KNEE: the running median response time
// on clean known-word recalls rising ~25% over the session's own baseline (checked
// BETWEEN trials, with a min-samples guard so a block can never end in its first
// minute). The same samples drive the self-relative pace praise (DDR-style: fast /
// ok / slow against the child's OWN rolling median — never another child's).
//
// The meter is SESSION-SCOPED (created per block, never persisted) and must only
// be fed clean samples: correct, rung-0, known-word recalls, with the clock started
// after dictation + grace, and in-flight trials discarded across a pause/break
// (RT hygiene — the caller's job). Pure; runs under `node --test`.

function median(list) {
  if (!list.length) return null;
  const s = [...list].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function createFatigueMeter({ baselineN = 6, kneeFactor = 1.25, minSamples = 8, recentN = 5 } = {}) {
  const samples = [];
  return {
    // A clean recall time. Junk (NaN, <= 0, Infinity) is ignored.
    record(ms) {
      if (Number.isFinite(ms) && ms > 0) samples.push(ms);
    },
    size() {
      return samples.length;
    },
    // The session's own pace anchor: the median of its first baselineN samples.
    baseline() {
      return median(samples.slice(0, baselineN));
    },
    // True when the recent median has risen past baseline * kneeFactor — the child
    // is slowing down; end the block warmly. Never before minSamples.
    knee() {
      if (samples.length < minSamples) return false;
      const base = median(samples.slice(0, baselineN));
      const recent = median(samples.slice(-recentN));
      return recent > base * kneeFactor;
    },
    // Self-relative pace for praise: against the child's own rolling median.
    pace(ms) {
      if (samples.length < 3) return 'ok';
      const m = median(samples);
      if (ms <= m * 0.8) return 'fast';
      if (ms >= m * 1.3) return 'slow';
      return 'ok';
    },
  };
}
