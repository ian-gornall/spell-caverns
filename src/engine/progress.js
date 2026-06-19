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

// EMA weight on the newest answer — high so RECENT performance dominates ("recency
// weighted"). Tunable later.
const ALPHA = 0.4;
// confidence = 1 - CONF_BASE^attempts  → ~0.5, 0.75, 0.875, … approaching 1.
const CONF_BASE = 0.5;
// The "known" mastery bar: a lapsed word is considered repaired once mastery climbs
// back to here (also the default `knownAt` for summary's known bucket).
const KNOWN_AT = 0.85;

// "Target" words = the ones the learner truly doesn't know yet, the focus of practice.
// A word is a target if it's been MISSED at least once within its last TARGET_WINDOW
// attempts (so a correct-every-recent-time word drops out — it's "parked" for spaced
// confirmation). The session builder keeps introducing new words until ~TARGET_CAP words
// are being actively targeted (user 2026-06-18). RECENT_MAX bounds the per-word history.
const TARGET_WINDOW = 3;
const RECENT_MAX = 6;
export const TARGET_CAP = 10;

// Minimum craft attempts before a word is considered "craft-confirmed" (production
// mastery proven — not just luck from a single correct answer). Until a word reaches
// this threshold it is NOT parked under a long cooldown; instead it resurfaces quickly
// for a follow-up proof attempt. This sits between the "repair target" priority (words
// with recent misses) and "new material" priority (never-seen words): the learner has
// already produced the word once, so it's not cold-start, but it needs another rep to
// confirm the production was reliable and not lucky (recognition ≠ production).
export const MIN_CRAFT_PROOF = 2;

// Per-answer score for MASTERY. Mastery is about ACCURACY, not speed (user 2026-06-18:
// "if a child is accurate, the speed really shouldn't matter") — so any correct answer is
// full credit (1) regardless of how fast it was, and a wrong answer is 0. Speed still
// drives gems + spoken praise in praise.js (the DDR fun layer); it just must not change
// what the engine treats as learned. `responseMs`/`fast` are accepted but ignored here.
export function answerScore({ correct } = {}) {
  return correct ? 1 : 0;
}

// Map a difficulty tier (1..9) onto a 0..1 prior (1=easiest spelling, 9=hardest).
export function tierToPrior(tier) {
  const t = Math.min(9, Math.max(1, tier));
  return (t - 1) / 8;
}

// A fresh, empty tracker. `tick` is a monotonic counter used for recency/spacing
// (so the session builder can prefer least-recently-seen words for mixed review).
// `knownPeak` is a high-water mark of the "known"-bucket count: because mastery is
// recency-weighted it can dip, but difficulty UNLOCKS must never regress once earned
// (QA I5), so unlocking gates on this monotonic peak, not the live count.
export function createTracker() {
  return { records: new Map(), tick: 0, knownPeak: 0 };
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

// Record one answer for `word`. opts: { responseMs, fast, source }.
//
// `source` decides whether this answer ESTABLISHES MASTERY (user 2026-06-18, §21-A):
//   - 'mine'  (rhythm multiple-choice, RECOGNITION) → SPEED/engagement only. It must
//             NEVER raise mastery or make a word a target (recognition ≠ production). So
//             a mine answer only records a speed reading on an ALREADY-tracked word and
//             touches nothing else — a word the kid has only mined stays untracked/unknown.
//   - 'craft' / 'assess' / undefined (the default) → the mastery-bearing path below.
//             CRAFTING (building from letters) is the sole source of truth for "known".
// Returns the updated/looked-up record (or undefined for an untracked mined word).
export function recordAnswer(tracker, word, correct, opts = {}) {
  if (opts.source === 'mine') {
    const existing = tracker.records.get(word);
    if (existing && Number.isFinite(opts.responseMs)) {
      existing.recentMs =
        existing.recentMs == null ? opts.responseMs : existing.recentMs + ALPHA * (opts.responseMs - existing.recentMs);
    }
    return existing; // recognition practice never moves mastery/targets
  }
  const s = answerScore({ correct, responseMs: opts.responseMs, fast: opts.fast });
  let rec = tracker.records.get(word);
  if (!rec) {
    rec = { word, attempts: 0, mastery: 0, confidence: 0, lastSeen: 0, recentMs: null, lapsed: false, recent: [] };
    tracker.records.set(word, rec);
  }
  // First answer seeds mastery outright; later answers blend with recency weight.
  rec.mastery = rec.attempts === 0 ? s : rec.mastery + ALPHA * (s - rec.mastery);
  rec.attempts += 1;
  rec.confidence = 1 - Math.pow(CONF_BASE, rec.attempts);
  rec.lastSeen = ++tracker.tick;
  // Bounded recent-attempt history (oldest→newest) — drives target selection.
  rec.recent = Array.isArray(rec.recent) ? rec.recent : [];
  rec.recent.push(!!correct);
  if (rec.recent.length > RECENT_MAX) rec.recent.shift();
  if (Number.isFinite(opts.responseMs)) {
    rec.recentMs =
      rec.recentMs == null ? opts.responseMs : rec.recentMs + ALPHA * (opts.responseMs - rec.recentMs);
  }
  // "Cracked crystal" tracking: a miss marks the word lapsed (it resurfaces for
  // PRODUCTION review — recall, not recognition — per the transfer research); it
  // stays lapsed until it's reliably correct again (mastery back to the known bar).
  if (!correct) rec.lapsed = true;
  else if (rec.mastery >= KNOWN_AT) rec.lapsed = false;
  return rec;
}

// Words the learner has MISSED and not yet re-mastered — the "cracked crystals" to
// repair via production practice. Worst (lowest mastery) first, then most overdue.
// A SELECTOR over the continuous tracker (not an interval scheduler — HANDOFF §4).
export function lapsedWords(tracker, { max = 50 } = {}) {
  return [...tracker.records.values()]
    .filter((r) => r.lapsed)
    .sort((a, b) => a.mastery - b.mastery || a.lastSeen - b.lastSeen)
    .slice(0, max)
    .map((r) => r.word);
}

// --- target words (the working set the learner is actively trying to learn) ------
const recentOf = (rec) => (rec && Array.isArray(rec.recent) ? rec.recent : []);

// Is `word` a current TARGET — seen, and missed at least once within its last `window`
// attempts (i.e. not yet reliably correct)? A word answered correctly every recent time
// is NOT a target (it's "parked" for spaced confirmation). Falls back to the `lapsed`
// flag for legacy records saved before recent-history tracking existed.
export function isTarget(tracker, word, { window = TARGET_WINDOW } = {}) {
  const rec = tracker.records.get(word);
  if (!rec || !rec.attempts) return false;
  const r = recentOf(rec);
  return r.length ? r.slice(-window).includes(false) : !!rec.lapsed;
}

// All current target words, WORST (lowest mastery) then most-overdue first — the order
// the session builder leads with. `max` caps the scan.
export function targetWords(tracker, { window = TARGET_WINDOW, max = 100 } = {}) {
  return [...tracker.records.values()]
    .filter((rec) => {
      if (!rec.attempts) return false;
      const r = recentOf(rec);
      return r.length ? r.slice(-window).includes(false) : !!rec.lapsed;
    })
    .sort((a, b) => a.mastery - b.mastery || a.lastSeen - b.lastSeen)
    .slice(0, max)
    .map((r) => r.word);
}

// --- craft-confirmation helpers ------------------------------------------------
// These distinguish three tiers of craft knowledge:
//   1. repair TARGET  — has a recent miss in craft history (highest priority)
//   2. needs CONFIRMATION — has craft record (attempts > 0), no recent miss, but
//      fewer than MIN_CRAFT_PROOF craft attempts (needs a follow-up proof; sits above
//      brand-new words in session priority because the learner has already seen it)
//   3. craft CONFIRMED — MIN_CRAFT_PROOF+ craft attempts, all recent correct
//      (parked for spaced confirmation under the normal cooldown)

// Is `word` in the "needs craft confirmation" state? It has been attempted via craft at
// least once (so it's not new material), has no recent miss (so it's not a repair target),
// but has fewer than MIN_CRAFT_PROOF attempts (one correct is not sufficient proof).
export function needsCraftConfirmation(tracker, word) {
  const rec = tracker.records.get(word);
  if (!rec || !rec.attempts) return false; // never seen by craft → new material, not this bucket
  if (isTarget(tracker, word)) return false; // has a recent miss → target bucket (higher priority)
  return rec.attempts < MIN_CRAFT_PROOF;
}

// Is `word` craft-confirmed? It has MIN_CRAFT_PROOF+ craft attempts, no recent miss,
// and is therefore trusted as production-known (subject to normal spaced cooldown).
export function isCraftConfirmed(tracker, word) {
  const rec = tracker.records.get(word);
  if (!rec || !rec.attempts) return false;
  if (isTarget(tracker, word)) return false; // recent miss → not yet confirmed
  return rec.attempts >= MIN_CRAFT_PROOF;
}

// --- serve spacing -------------------------------------------------------------
// How long a word should "rest" (in TICKS ≈ answers — one session is ~10) before it
// is eligible to be served again. The user's requirement: once a word is essentially
// known, don't serve it again immediately (even after a single correct answer); rest
// it for several sessions and cover other words first, then revisit known words only
// over a LONG horizon to confirm retention — while UNKNOWN/shaky words keep recurring
// on the frequent basis needed to learn them.
//
// This is a pure SELECTOR computed from the record's mastery + confirmations + recency
// — NOT an interval scheduler with stored due-dates (HANDOFF §4 forbids the latter).
// session.js uses it to skip resting words when filling a session.
//
//   - mastery below REST_BAND_LO  → ~0 ticks: shaky/missed words come straight back.
//   - mastery REST_BAND_LO..1.0   → a quadratic ramp (small until truly "known", then
//                                    growing): learning words rest briefly, mastered
//                                    words rest for sessions.
//   - more confirmations (attempts) → a multiplicative STRETCH so a word confirmed
//                                    many times rests far longer than one seen once.
//   - under-confirmed (attempts < MIN_CRAFT_PROOF) → the span is capped LOW so a
//     single-correct word rests only briefly and resurfaces quickly for a follow-up
//     proof attempt (one correct craft answer is not sufficient production proof — it
//     should come back within the same or next session, not after 3-4 sessions).
const REST_BAND_LO = 0.6; // below this a word is still being learned → no real rest
const REST_FLOOR = 2; // ticks at the bottom of the band (borderline word)
const REST_SPAN = 30; // extra ticks at full mastery (before the confirm stretch)
const REST_SPAN_UNCONFIRMED = 8; // cap for under-confirmed words (< MIN_CRAFT_PROOF attempts)
const REST_CONFIRM_STEP = 0.5; // each prior sighting stretches the rest by this much…
const REST_CONFIRM_CAP = 8; // …up to this many sightings

export function serveCooldown(rec) {
  if (!rec || !rec.attempts) return 0;
  const m = rec.mastery;
  if (m < REST_BAND_LO) return 0;
  const band = Math.min(1, (m - REST_BAND_LO) / (1 - REST_BAND_LO));
  // Under-confirmed words (fewer than MIN_CRAFT_PROOF attempts, no miss) rest briefly
  // so they get a follow-up proof attempt within the same or next session.
  const span = rec.attempts < MIN_CRAFT_PROOF ? REST_SPAN_UNCONFIRMED : REST_SPAN;
  const base = REST_FLOOR + band * band * span; // quadratic: stays small until high mastery
  const stretch = 1 + Math.min(rec.attempts - 1, REST_CONFIRM_CAP) * REST_CONFIRM_STEP;
  return Math.round(base * stretch);
}

// Ticks elapsed since the word was last practiced (Infinity if never seen).
export function ticksSinceSeen(tracker, word) {
  const rec = tracker.records.get(word);
  if (!rec || !rec.lastSeen) return Infinity;
  return tracker.tick - rec.lastSeen;
}

// Is `word` eligible to be served right now? Never-seen and shaky words always are;
// a recently-practiced known word rests until its cooldown elapses.
export function isEligible(tracker, word) {
  const rec = tracker.records.get(word);
  if (!rec || !rec.attempts) return true;
  return ticksSinceSeen(tracker, word) >= serveCooldown(rec);
}

// How far PAST its cooldown a word is: ≥0 means due (rested long enough), <0 means
// still resting. Infinity for never-seen. The session builder orders its "revisit a
// long-known word" fallback by this (most overdue first), so confirming revisits come
// back in the right order without any stored schedule.
export function serveOverdue(tracker, word) {
  const rec = tracker.records.get(word);
  if (!rec || !rec.attempts) return Infinity;
  return ticksSinceSeen(tracker, word) - serveCooldown(rec);
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

// --- persistence ---------------------------------------------------------
// A tracker holds a Map (and a tick counter), neither of which survives
// JSON.stringify directly. These two convert to/from a plain, JSON-safe object
// so state.js can park the whole tracker in localStorage and read it back. Pure
// and browser-agnostic; the round-trip is lossless (see progress.test.js).
export function serializeTracker(tracker) {
  return {
    tick: tracker.tick,
    knownPeak: tracker.knownPeak || 0,
    // records keyed by word, but we store the values (each already carries .word)
    records: [...tracker.records.values()].map((r) => ({ ...r })),
  };
}

export function deserializeTracker(data) {
  const tracker = createTracker();
  if (!data || typeof data !== 'object') return tracker;
  tracker.tick = Number.isFinite(data.tick) ? data.tick : 0;
  tracker.knownPeak = Number.isFinite(data.knownPeak) ? data.knownPeak : 0;
  for (const rec of Array.isArray(data.records) ? data.records : []) {
    if (rec && typeof rec.word === 'string') tracker.records.set(rec.word, { ...rec });
  }
  return tracker;
}

// Ratchet + read the "known"-bucket high-water mark. Difficulty unlocks gate on this
// so they never regress when recency-weighted mastery dips (QA I5). Mutates tracker
// (bumps knownPeak); callers persist via save(). Returns the current peak.
export function knownPeak(tracker) {
  const known = summary(tracker).counts.known;
  tracker.knownPeak = Math.max(tracker.knownPeak || 0, known);
  return tracker.knownPeak;
}

// Seed a tracker from a pre-assessment result by REPLAYING its responses through
// recordAnswer — identical to how live play feeds the tracker (no separate path).
export function seedFromAssessment(tracker, assessmentResult) {
  for (const r of assessmentResult.responses || []) {
    recordAnswer(tracker, r.word, r.correct, { responseMs: r.responseMs, fast: r.fast });
  }
  return tracker;
}
