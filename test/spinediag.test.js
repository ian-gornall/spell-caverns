// test/spinediag.test.js — the lessons-mode SPINE DIAGNOSTIC (src/engine/spinediag.js).
//
// §40: a new lessons-mode profile is placed by a walk over the LESSON PATH (classic
// placement.js walks the frequency list and is untouched): binary search over lesson
// indices with 2-word probes, then dense probes around the frontier, always ending
// on a success. The result seeds below-frontier words as KNOWN (lessonrun.seedKnown)
// so incremental rehearsal has knowns to interleave from day one. Resumable across
// sessions via serializeDiag/restore. Pure; runs under `node --test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createSpineDiag, nextProbe, submitProbe, serializeDiag, diagResult, diagDone } from '../src/engine/spinediag.js';

// a synthetic path: 40 lessons, 4 words each (w<lesson>_<n>)
const LESSONS = Array.from({ length: 40 }, (_, i) => ({
  band: i + 1,
  id: `L${i}`,
  label: `lesson ${i}`,
  rule: 'rule.',
  exemplars: [],
  words: Array.from({ length: 4 }, (_, k) => ({ word: `w${i}_${k}` })),
}));

// Simulate a child who spells every word of lessons < K and misses everything at >= K.
function runChild(K, { lessons = LESSONS, interruptAt = null } = {}) {
  let diag = createSpineDiag(lessons);
  let served = 0;
  for (;;) {
    if (interruptAt != null && served === interruptAt) {
      diag = createSpineDiag(lessons, { restore: serializeDiag(diag) }); // resume round-trip
      interruptAt = null;
    }
    const probe = nextProbe(diag);
    if (!probe) break;
    served += 1;
    submitProbe(diag, probe.lessonIdx < K);
    if (served > 500) throw new Error('diagnostic never converged');
  }
  return { diag, served };
}

test('converges on the frontier lesson for a monotone child', () => {
  for (const K of [0, 3, 17, 25, 39]) {
    const { diag } = runChild(K);
    const res = diagResult(diag);
    assert.equal(res.startLessonId, `L${K}`, `frontier for K=${K}`);
    assert.deepEqual(res.knownLessonIds, LESSONS.slice(0, K).map((l) => l.id), `knowns below frontier for K=${K}`);
  }
});

test('an all-knowing child starts at the LAST lesson; an all-missing child at the first', () => {
  const all = diagResult(runChild(40).diag);
  assert.equal(all.startLessonId, 'L39');
  assert.equal(all.knownLessonIds.length, 39);
  const none = diagResult(runChild(0).diag);
  assert.equal(none.startLessonId, 'L0');
  assert.deepEqual(none.knownLessonIds, []);
});

test('probes stay compact: ~binary + dense, far fewer than the path', () => {
  const { diag, served } = runChild(20);
  assert.ok(served <= 30, `served ${served} probes for 40 lessons`);
  assert.ok(diag.responses.length === served);
  // each probed lesson took at most 2 words (plus closing successes from easy lessons)
  const perLesson = new Map();
  for (const r of diag.responses) perLesson.set(r.lessonIdx, (perLesson.get(r.lessonIdx) || 0) + 1);
  for (const [idx, n] of perLesson) {
    assert.ok(n <= 4, `lesson ${idx} probed ${n} times`); // 2 probe words + closing extras
  }
});

test('the walk always ends on a success (when the child can succeed anywhere)', () => {
  for (const K of [1, 5, 22]) {
    const { diag } = runChild(K);
    const last = diag.responses[diag.responses.length - 1];
    assert.equal(last.correct, true, `last response is a success for K=${K}`);
  }
});

test('an all-missing child still terminates (best-effort close, capped)', () => {
  const { diag } = runChild(0);
  assert.ok(diagDone(diag));
});

test('probe words come from the lesson pool in teaching order', () => {
  const { diag } = runChild(10);
  for (const r of diag.responses) {
    assert.match(r.word, new RegExp(`^w${r.lessonIdx}_[0-3]$`));
  }
});

test('serializeDiag/restore resumes mid-walk to the same result', () => {
  const clean = diagResult(runChild(17).diag);
  const resumed = diagResult(runChild(17, { interruptAt: 5 }).diag);
  assert.deepEqual(resumed.startLessonId, clean.startLessonId);
  assert.deepEqual(resumed.knownLessonIds, clean.knownLessonIds);
});

test('a restore from a DIFFERENT path (age change) is discarded — fresh walk', () => {
  const { diag } = runChild(10);
  const saved = serializeDiag(diag);
  const otherPath = LESSONS.slice(5); // renumbered path (ids differ by position)
  const fresh = createSpineDiag(otherPath, { restore: saved });
  assert.equal(fresh.responses.length, 0, 'mismatched path discards the restore');
  assert.ok(!diagDone(fresh));
});

test('correctWords carries every success with its lesson id (seeding material)', () => {
  const { diag } = runChild(12);
  const res = diagResult(diag);
  assert.ok(res.correctWords.length > 0);
  for (const c of res.correctWords) {
    assert.equal(typeof c.word, 'string');
    assert.match(c.lessonId, /^L\d+$/);
  }
  // every correct response is in there
  const corrects = diag.responses.filter((r) => r.correct).length;
  assert.equal(res.correctWords.length, corrects);
});

test('a 1-word lesson probes with its single word', () => {
  const tiny = [
    { band: 1, id: 'A', words: [{ word: 'one' }] },
    { band: 2, id: 'B', words: [{ word: 'two' }, { word: 'three' }] },
  ];
  const diag = createSpineDiag(tiny);
  for (;;) {
    const probe = nextProbe(diag);
    if (!probe) break;
    submitProbe(diag, probe.lessonIdx < 1);
  }
  assert.equal(diagResult(diag).startLessonId, 'B');
});
