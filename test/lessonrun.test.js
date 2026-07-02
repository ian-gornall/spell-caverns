// test/lessonrun.test.js — the lessons-mode incremental-rehearsal engine
// (src/engine/lessonrun.js). Pure; runs under `node --test`.
//
// §40: lessons mode becomes ONE trial stream per session — errorless exposure for
// new words, recall trials interleaved among known words (never two unknowns back
// to back, expanding gaps, no repeat within MIN_REGAP), per-word state from the
// rolling last-5 recalls (>=4/5 KNOWN, 3/5 LAPSED, <=2/5 FORGOTTEN), an unknown
// ceiling (3 errors on one new word stops new introductions this session), and a
// lesson completing when every pool word is KNOWN.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  WIN, KNOWN_AT, LAPSED_AT, MIN_REGAP, CEILING_ERRORS,
  createLessonRun, reviveLessonRun, wordState, syncLesson, needsIntro, markIntroSeen,
  beginSession, nextTrial, recordExposure, recordRecall, seedKnown,
  lessonStatus, graduatedWords, maintenanceEntries, activeLessonWords,
} from '../src/engine/lessonrun.js';

// ---- fixtures ----------------------------------------------------------------

const L = (id, band, words) => ({
  band, id, label: `${id} label`, rule: `${id} rule.`, exemplars: ['x', 'y'],
  words: words.map((w) => ({ word: w })),
});
const LESSONS = [
  L('A', 1, ['cat', 'dog', 'sun']),
  L('B', 2, ['ship', 'fish']),
  L('C', 3, ['rain']),
];

function freshRun(lessons = LESSONS) {
  const run = createLessonRun();
  syncLesson(run, lessons);
  return run;
}

// answer the current trial correctly (exposure or recall) and return the trial
function step(run, session, lessons, { correct = true, rung = 0, ms = 900 } = {}) {
  const trial = nextTrial(run, session, lessons);
  if (!trial) return null;
  if (trial.expose) recordExposure(run, session, trial.word);
  else recordRecall(run, session, trial.word, { correct, rung, ms }, lessons);
  return trial;
}

// ---- constants ---------------------------------------------------------------

test('exported constants match the locked design', () => {
  assert.equal(WIN, 5);
  assert.equal(KNOWN_AT, 4);
  assert.equal(LAPSED_AT, 3);
  assert.equal(MIN_REGAP, 2);
  assert.equal(CEILING_ERRORS, 3);
});

// ---- create / revive ----------------------------------------------------------

test('createLessonRun starts fresh, placed by default, no lesson until synced', () => {
  const run = createLessonRun();
  assert.equal(run.v, 1);
  assert.equal(run.placed, true);
  assert.equal(run.diag, null);
  assert.equal(run.lessonId, null);
  assert.deepEqual(run.completed, []);
  assert.deepEqual(run.seenIntro, []);
  assert.equal(run.trial, 0);
  assert.deepEqual(run.words, {});
});

test('reviveLessonRun: absent/malformed -> fresh; a partial save keeps its progress', () => {
  assert.equal(reviveLessonRun(undefined).lessonId, null);
  assert.equal(reviveLessonRun('junk').trial, 0);
  assert.equal(reviveLessonRun({ v: 99 }).v, 1);
  const saved = {
    v: 1, placed: true, diag: null, lessonId: 'B', seenIntro: ['A', 'B'], completed: ['A'],
    trial: 12, prev: { word: 'ship', unknown: true },
    words: {
      ship: { lessonId: 'B', exposed: 1, seeded: 0, last: 12, win: [{ c: 1, r: 0, ms: 800 }] },
      bogus: null, // a corrupt record must not survive
    },
  };
  const run = reviveLessonRun(saved);
  assert.equal(run.lessonId, 'B');
  assert.deepEqual(run.completed, ['A']);
  assert.equal(run.trial, 12);
  assert.equal(run.words.ship.win.length, 1);
  assert.ok(!('bogus' in run.words));
});

// ---- word state from the rolling window ----------------------------------------

test('wordState walks new -> active -> known at 4 clean recalls', () => {
  const run = freshRun();
  const session = beginSession();
  assert.equal(wordState(run, 'cat'), 'new');
  recordExposure(run, session, 'cat');
  assert.equal(wordState(run, 'cat'), 'active');
  for (let i = 0; i < KNOWN_AT - 1; i++) {
    recordRecall(run, session, 'cat', { correct: true }, LESSONS);
    assert.equal(wordState(run, 'cat'), 'active', `still active after ${i + 1}`);
  }
  recordRecall(run, session, 'cat', { correct: true }, LESSONS);
  assert.equal(wordState(run, 'cat'), 'known');
});

test('a full window grades: 4/5 known, 3/5 lapsed, <=2/5 forgotten', () => {
  const run = freshRun();
  const session = beginSession();
  recordExposure(run, session, 'cat');
  for (let i = 0; i < WIN; i++) recordRecall(run, session, 'cat', { correct: true }, LESSONS);
  assert.equal(wordState(run, 'cat'), 'known');
  recordRecall(run, session, 'cat', { correct: false }, LESSONS); // window 1,1,1,1,0
  assert.equal(wordState(run, 'cat'), 'known');
  recordRecall(run, session, 'cat', { correct: false }, LESSONS); // 1,1,1,0,0
  assert.equal(wordState(run, 'cat'), 'lapsed');
  recordRecall(run, session, 'cat', { correct: false }, LESSONS); // 1,1,0,0,0
  assert.equal(wordState(run, 'cat'), 'forgotten');
});

test('a hint-assisted solve is a recorded miss with the rung logged', () => {
  const run = freshRun();
  const session = beginSession();
  recordExposure(run, session, 'cat');
  recordRecall(run, session, 'cat', { correct: false, rung: 2, ms: 9000 }, LESSONS);
  const rec = run.words.cat;
  assert.deepEqual(rec.win[rec.win.length - 1], { c: 0, r: 2, ms: 9000 });
});

// ---- graduation / lapse / forgotten transitions --------------------------------

test('recordRecall reports graduation exactly once', () => {
  const run = freshRun();
  const session = beginSession();
  recordExposure(run, session, 'cat');
  const results = [];
  for (let i = 0; i < 5; i++) results.push(recordRecall(run, session, 'cat', { correct: true }, LESSONS));
  assert.deepEqual(results.map((r) => r.graduated), [false, false, false, true, false]);
});

test('a known word decaying reports lapsed then forgotten (re-teach signal)', () => {
  const run = freshRun();
  const session = beginSession();
  recordExposure(run, session, 'cat');
  for (let i = 0; i < WIN; i++) recordRecall(run, session, 'cat', { correct: true }, LESSONS);
  let r = recordRecall(run, session, 'cat', { correct: false }, LESSONS);
  assert.ok(!r.lapsed && !r.forgotten); // 4/5 still known
  r = recordRecall(run, session, 'cat', { correct: false }, LESSONS);
  assert.ok(r.lapsed);
  r = recordRecall(run, session, 'cat', { correct: false }, LESSONS);
  assert.ok(r.forgotten);
});

// ---- the trial stream: interleave properties ------------------------------------

test('the stream: exposure precedes first recall; no two unknowns adjacent once knowns exist; regap respected', () => {
  const run = freshRun();
  seedKnown(run, [{ word: 'see', lessonId: 'Z' }, { word: 'tree', lessonId: 'Z' }, { word: 'green', lessonId: 'Z' }]);
  const session = beginSession();
  const log = [];
  for (let i = 0; i < 60; i++) {
    const trial = step(run, session, LESSONS);
    assert.ok(trial, 'stream never runs dry');
    log.push(trial);
  }
  // exposure precedes any recall of the same word
  const firstServe = new Map();
  log.forEach((tr, i) => { if (!firstServe.has(tr.word)) firstServe.set(tr.word, { i, tr }); });
  for (const [w, { tr }] of firstServe) {
    if (['cat', 'dog', 'sun'].includes(w)) assert.ok(tr.expose, `${w} first served as exposure`);
  }
  // never two unknown serves back to back (knowns were seeded, so always available)
  for (let i = 1; i < log.length; i++) {
    assert.ok(!(log[i].known === false && log[i - 1].known === false),
      `unknowns adjacent at ${i - 1}/${i}: ${log[i - 1].word}, ${log[i].word}`);
  }
  // a word never repeats within MIN_REGAP trials
  const lastAt = new Map();
  log.forEach((tr, i) => {
    if (lastAt.has(tr.word)) assert.ok(i - lastAt.get(tr.word) >= MIN_REGAP, `${tr.word} repeated too soon at ${i}`);
    lastAt.set(tr.word, i);
  });
});

test('the stream: recall gaps for a clean word expand (incremental rehearsal)', () => {
  const run = freshRun();
  seedKnown(run, ['red', 'blue', 'gold', 'pink', 'grey'].map((w) => ({ word: w, lessonId: 'Z' })));
  const session = beginSession();
  const positions = [];
  for (let i = 0; i < 40; i++) {
    const trial = step(run, session, LESSONS);
    if (trial.word === 'cat') positions.push(i);
    if (positions.length >= 4 && wordState(run, 'cat') === 'known') break;
  }
  const gaps = positions.slice(1).map((p, i) => p - positions[i]);
  assert.ok(gaps.length >= 2, `saw enough cat serves (${JSON.stringify(positions)})`);
  for (let i = 1; i < gaps.length; i++) {
    assert.ok(gaps[i] >= gaps[i - 1], `gaps expand: ${JSON.stringify(gaps)}`);
  }
});

test('knowns cycle longest-unseen first', () => {
  const run = freshRun();
  seedKnown(run, [{ word: 'red', lessonId: 'Z' }, { word: 'blue', lessonId: 'Z' }]);
  const session = beginSession();
  const knownServes = [];
  for (let i = 0; i < 12; i++) {
    const trial = step(run, session, LESSONS);
    if (trial.known) knownServes.push(trial.word);
  }
  // with two seeded knowns they must alternate (each becomes the longest-unseen in turn)
  for (let i = 1; i < knownServes.length; i++) {
    assert.notEqual(knownServes[i], knownServes[i - 1], `knowns alternate (${JSON.stringify(knownServes)})`);
  }
});

test('with NO knowns yet, the stream still serves (adjacency constraint is best-effort)', () => {
  const run = freshRun();
  const session = beginSession();
  for (let i = 0; i < 20; i++) assert.ok(step(run, session, LESSONS), `trial ${i} served`);
});

// ---- the unknown ceiling ---------------------------------------------------------

test('3 errors on a single new word stops NEW introductions for the session', () => {
  const run = freshRun();
  seedKnown(run, [{ word: 'red', lessonId: 'Z' }, { word: 'blue', lessonId: 'Z' }]);
  const session = beginSession();
  // drive until 'cat' has taken 3 wrong recalls
  let ceilingSeen = false;
  for (let i = 0; i < 40 && !session.capped; i++) {
    const trial = nextTrial(run, session, LESSONS);
    if (trial.expose) { recordExposure(run, session, trial.word); continue; }
    const wrong = trial.word === 'cat';
    const r = recordRecall(run, session, trial.word, { correct: !wrong }, LESSONS);
    if (r.ceilingHit) ceilingSeen = true;
  }
  assert.ok(session.capped, 'session capped');
  assert.ok(ceilingSeen, 'ceilingHit reported');
  const exposedBefore = Object.keys(run.words).filter((w) => run.words[w].exposed && !run.words[w].seeded);
  for (let i = 0; i < 20; i++) {
    const trial = nextTrial(run, session, LESSONS);
    assert.ok(!trial.expose, 'no exposure after the ceiling');
    if (trial.expose) recordExposure(run, session, trial.word);
    else recordRecall(run, session, trial.word, { correct: true }, LESSONS);
  }
  const exposedAfter = Object.keys(run.words).filter((w) => run.words[w].exposed && !run.words[w].seeded);
  assert.deepEqual(exposedAfter.sort(), exposedBefore.sort());
});

// ---- forgotten words re-teach on serve -------------------------------------------

test('a forgotten word is served with the reteach flag and queue priority', () => {
  const run = freshRun();
  seedKnown(run, [{ word: 'red', lessonId: 'Z' }, { word: 'blue', lessonId: 'Z' }]);
  const session = beginSession();
  recordExposure(run, session, 'cat');
  for (let i = 0; i < WIN; i++) recordRecall(run, session, 'cat', { correct: true }, LESSONS);
  for (let i = 0; i < 3; i++) recordRecall(run, session, 'cat', { correct: false }, LESSONS);
  assert.equal(wordState(run, 'cat'), 'forgotten');
  // next serve of cat carries reteach
  for (let i = 0; i < 10; i++) {
    const trial = nextTrial(run, session, LESSONS);
    if (trial.word === 'cat') {
      assert.ok(trial.reteach, 'forgotten word re-teaches');
      assert.ok(!trial.known);
      return;
    }
    if (trial.expose) recordExposure(run, session, trial.word);
    else recordRecall(run, session, trial.word, { correct: true }, LESSONS);
  }
  assert.fail('cat never came back');
});

// ---- lesson completion / sync ------------------------------------------------------

test('graduating every pool word completes the lesson; syncLesson advances; all done -> null', () => {
  const lessons = [L('A', 1, ['cat', 'dog']), L('B', 2, ['ship'])];
  const run = freshRun(lessons);
  seedKnown(run, [{ word: 'red', lessonId: 'Z' }]);
  const session = beginSession();
  assert.equal(run.lessonId, 'A');
  let completions = 0;
  for (let i = 0; i < 200 && run.completed.length < 2; i++) {
    const trial = nextTrial(run, session, lessons);
    if (!trial) break;
    if (trial.expose) { recordExposure(run, session, trial.word); continue; }
    const r = recordRecall(run, session, trial.word, { correct: true }, lessons);
    if (r.lessonComplete) {
      completions += 1;
      assert.ok(run.completed.includes(run.lessonId));
      syncLesson(run, lessons); // the mode celebrates, then syncs to the next lesson
    }
  }
  assert.equal(completions, 2, 'both lessons completed');
  assert.deepEqual(run.completed, ['A', 'B']);
  assert.equal(syncLesson(run, lessons), null, 'all done -> null lesson');
  assert.equal(lessonStatus(run, lessons).allDone, true);
});

test('syncLesson self-heals when the list changes (age resync) or the id is stale', () => {
  const run = freshRun(LESSONS);
  assert.equal(run.lessonId, 'A');
  // age change removed lesson A from the list -> move to the first uncompleted
  const older = [L('B', 1, ['ship', 'fish']), L('C', 2, ['rain'])];
  syncLesson(run, older);
  assert.equal(run.lessonId, 'B');
  // completing B then syncing hops to C
  run.completed.push('B');
  syncLesson(run, older);
  assert.equal(run.lessonId, 'C');
});

// ---- intro bookkeeping --------------------------------------------------------------

test('needsIntro once per lesson; markIntroSeen is idempotent', () => {
  const run = freshRun();
  assert.ok(needsIntro(run));
  markIntroSeen(run);
  markIntroSeen(run);
  assert.ok(!needsIntro(run));
  assert.deepEqual(run.seenIntro, ['A']);
  run.completed.push('A');
  syncLesson(run, LESSONS);
  assert.ok(needsIntro(run), 'next lesson needs its intro');
});

// ---- seeding / graduated / maintenance -----------------------------------------------

test('seedKnown caps at the entries nearest the frontier and feeds maintenance, not graduation', () => {
  const run = freshRun();
  const list = Array.from({ length: 50 }, (_, i) => ({ word: `w${i}`, lessonId: 'Z' }));
  seedKnown(run, list, { cap: 40 });
  const seeded = Object.keys(run.words);
  assert.equal(seeded.length, 40);
  assert.ok(!seeded.includes('w0'), 'far-from-frontier words dropped');
  assert.ok(seeded.includes('w49'), 'nearest-frontier words kept');
  assert.equal(wordState(run, 'w49'), 'known');
  assert.equal(graduatedWords(run).length, 0, 'seeded words are not earned graduations');
  assert.equal(maintenanceEntries(run).length, 40, 'seeded words are maintenance material');
});

test('a live graduation clears the seeded flag and counts as earned', () => {
  const run = freshRun();
  const session = beginSession();
  recordExposure(run, session, 'cat');
  for (let i = 0; i < KNOWN_AT; i++) recordRecall(run, session, 'cat', { correct: true }, LESSONS);
  assert.deepEqual(graduatedWords(run), ['cat']);
  assert.ok(maintenanceEntries(run).includes('cat'));
});

test('activeLessonWords = the current lesson’s exposed, not-yet-known words (brain-break chips)', () => {
  const run = freshRun();
  const session = beginSession();
  assert.deepEqual(activeLessonWords(run, LESSONS), []);
  recordExposure(run, session, 'cat');
  recordExposure(run, session, 'dog');
  assert.deepEqual(activeLessonWords(run, LESSONS).sort(), ['cat', 'dog']);
  for (let i = 0; i < KNOWN_AT; i++) recordRecall(run, session, 'cat', { correct: true }, LESSONS);
  assert.deepEqual(activeLessonWords(run, LESSONS), ['dog']);
});

// ---- lessonStatus ---------------------------------------------------------------------

test('lessonStatus is the one read: number/total/pool/graduated', () => {
  const run = freshRun();
  const session = beginSession();
  let st = lessonStatus(run, LESSONS);
  assert.equal(st.lessonId, 'A');
  assert.equal(st.number, 1);
  assert.equal(st.total, 3);
  assert.equal(st.pool, 3);
  assert.equal(st.graduated, 0);
  assert.equal(st.allDone, false);
  recordExposure(run, session, 'cat');
  for (let i = 0; i < KNOWN_AT; i++) recordRecall(run, session, 'cat', { correct: true }, LESSONS);
  st = lessonStatus(run, LESSONS);
  assert.equal(st.graduated, 1);
});
