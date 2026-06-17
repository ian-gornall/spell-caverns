// src/engine/progress.js — PURE continuous mastery tracker (the heart of the
// learning model). REPLACES the dropped Leitner/SRS scheduler.
//
// Design decision (HANDOFF §4): there is NO flat known/unknown categorization —
// it's inaccurate. Instead each word carries:
//   - `mastery`  ∈ [0,1] : a RECENCY-WEIGHTED accuracy that also factors response
//                          SPEED (fast-correct > slow-correct > wrong),
//   - `confidence` ∈ [0,1): how much we trust that estimate (grows with attempts).
// Difficulty is OBSERVED, not assumed: the tier/rank `prior` only bootstraps a
// word until enough responses accrue, then observed performance takes over
// (`effectiveDifficulty` blends prior→observed by confidence).
//
// The cold-start pre-assessment and live play both feed this tracker IDENTICALLY
// (seedFromAssessment just replays recordAnswer). Imports nothing browser-specific.
import { SPEED_TIERS } from './praise.js';

// EMA weight on the newest answer — high so RECENT performance dominates ("recency
// weighted"). Tunable later.
const ALPHA = 0.4;
// confidence = 1 - CONF_BASE^attempts  → ~0.5, 0.75, 0.875, … approaching 1.
const CONF_BASE = 0.5;

// Per-answer score from correctness + speed. Wrong is 0; a correct answer earns
// partial→full credit by how fast it was, reusing the praise speed tiers so the
// whole app shares one notion of "fast". Slow-but-correct still counts.
const SPEED_SCORE = { perfect: 1.0, amazing: 0.9, great: 0.75, good: 0.6 };

function speedScore(responseMs) {
  const t = Number.isFinite(responseMs) ? responseMs : Infinity;
  const tier = SPEED_TIERS.find((x) => t <= x.maxMs) || SPEED_TIERS[SPEED_TIERS.length - 1];
  return SPEED_SCORE[tier.key] ?? 0.6;
}

export function answerScore({ correct, responseMs, fast } = {}) {
  if (!correct) return 0;
  if (Number.isFinite(responseMs)) return speedScore(responseMs);
  return fast ? 0.9 : 0.6; // no timing info: a "fast" flag is a coarse fallback
}

// Map a difficulty tier (1..9) onto a 0..1 prior (1=easiest spelling, 9=hardest).
export function tierToPrior(tier) {
  const t = Math.min(9, Math.max(1, tier));
  return (t - 1) / 8;
}

// A fresh, empty tracker. `tick` is a monotonic counter used for recency/spacing
// (so the session builder can prefer least-recently-seen words for mixed review).
export function createTracker() {
  return { records: new Map(), tick: 0 };
}

export function getRecord(tracker, word) {
  return tracker.records.get(word);
}

export function mastery(tracker, word) {
  const rec = tracker.records.get(word);
  return rec ? rec.mastery : 0;
}

export function confidence(tracker, word) {
  const rec = tracker.records.get(word);
  return rec ? rec.confidence : 0;
}

// Record one answer for `word`, updating its recency-weighted mastery + confidence.
// opts: { responseMs, fast }. Returns the updated record.
export function recordAnswer(tracker, word, correct, opts = {}) {
  const s = answerScore({ correct, responseMs: opts.responseMs, fast: opts.fast });
  let rec = tracker.records.get(word);
  if (!rec) {
    rec = { word, attempts: 0, mastery: 0, confidence: 0, lastSeen: 0, recentMs: null };
    tracker.records.set(word, rec);
  }
  // First answer seeds mastery outright; later answers blend with recency weight.
  rec.mastery = rec.attempts === 0 ? s : rec.mastery + ALPHA * (s - rec.mastery);
  rec.attempts += 1;
  rec.confidence = 1 - Math.pow(CONF_BASE, rec.attempts);
  rec.lastSeen = ++tracker.tick;
  if (Number.isFinite(opts.responseMs)) {
    rec.recentMs =
      rec.recentMs == null ? opts.responseMs : rec.recentMs + ALPHA * (opts.responseMs - rec.recentMs);
  }
  return rec;
}

// Observed difficulty (1 - mastery), blended with the cold-start `prior` by
// confidence: no data → pure prior; high confidence → pure observed.
export function effectiveDifficulty(tracker, word, prior) {
  const rec = tracker.records.get(word);
  if (!rec) return prior;
  const observed = 1 - rec.mastery;
  return (1 - rec.confidence) * prior + rec.confidence * observed;
}

// Predicted chance the learner spells this word right now = complement of the
// effective difficulty. The session builder targets a "productive struggle" band
// (challenging but achievable) using this.
export function predictedSuccess(tracker, word, prior) {
  return 1 - effectiveDifficulty(tracker, word, prior);
}

// True when the word sits in the challenging-but-achievable band — only meaningful
// once there's enough data (low confidence + extreme prior can still qualify, which
// is fine: that's the cold-start guess). Bounds tunable later.
export function isProductiveStruggle(tracker, word, prior, { lo = 0.5, hi = 0.85 } = {}) {
  const ps = predictedSuccess(tracker, word, prior);
  return ps >= lo && ps <= hi;
}

// The transparent progress view (same for the kid and the parent). The buckets are
// DISPLAY ONLY — the engine never treats them as a hard gate.
export function summary(tracker, { knownAt = 0.85, confAt = 0.6, shakyBelow = 0.5 } = {}) {
  const known = [];
  const learning = [];
  const shaky = [];
  for (const rec of tracker.records.values()) {
    if (rec.confidence >= confAt && rec.mastery >= knownAt) known.push(rec.word);
    else if (rec.mastery < shakyBelow) shaky.push(rec.word);
    else learning.push(rec.word);
  }
  return {
    known,
    learning,
    shaky,
    counts: {
      known: known.length,
      learning: learning.length,
      shaky: shaky.length,
      tracked: tracker.records.size,
    },
  };
}

// Seed a tracker from a pre-assessment result by REPLAYING its responses through
// recordAnswer — identical to how live play feeds the tracker (no separate path).
export function seedFromAssessment(tracker, assessmentResult) {
  for (const r of assessmentResult.responses || []) {
    recordAnswer(tracker, r.word, r.correct, { responseMs: r.responseMs, fast: r.fast });
  }
  return tracker;
}
