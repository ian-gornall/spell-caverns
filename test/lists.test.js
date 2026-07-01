// test/lists.test.js — multi-list integration of the spelling-research corpus
// (src/engine/lists.js). Pure; runs under `node --test`.
//
// The research repo (C:/Users/iango/spelling-research) ships app_data/: ~50k word
// forms each tagged with an AoA band + a governing phonics pattern, an ordered
// pattern spine, and a rules catalog. APP_DESIGN.md locks the teaching loop:
//   pool = cumulative by age (union of bands <= the learner's age ceiling),
//   path = one spine (a pattern surfaces only when the pool has its words),
//   order within a pattern = shortest first then most-frequent first,
//   on a miss = reteach the rule + highlight the grapheme.
// lists.js implements that loop over a SAMPLED dataset (data/research_sample.js,
// emitted by scripts/import_research.mjs) — the mechanism, not the full corpus.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BAND_ORDER,
  ageToBandCeiling,
  bandWithinCeiling,
  buildPool,
  orderWithinPattern,
  lessonPlan,
  reteach,
  needsCarrierSentence,
} from '../src/engine/lists.js';

// ---- synthetic fixtures ----------------------------------------------------

const SPINE = [
  { index: 0, id: 'L1', label: 'short vowel VC', rule: 'vowel then consonant: short.', category: 'phonics', graphemes: ['a', 'i'] },
  { index: 1, id: 'L2', label: 'open vowel CV', rule: 'ends in a vowel: long.', category: 'phonics', graphemes: ['o', 'e'] },
  { index: 2, id: 'L3', label: 'CVC', rule: 'consonant-vowel-consonant: short.', category: 'phonics', graphemes: ['a', 'e', 'i', 'o', 'u'] },
];

const PATTERNS = {
  L1: { id: 'L1', label: 'short vowel VC', rule: 'vowel then consonant: short.', teach_exemplars: ['at', 'in'], graphemes: ['a', 'i'] },
  L2: { id: 'L2', label: 'open vowel CV', rule: 'ends in a vowel: long.', teach_exemplars: ['go', 'me'], graphemes: ['o', 'e'] },
  L3: { id: 'L3', label: 'CVC', rule: 'consonant-vowel-consonant: short.', teach_exemplars: ['cat'], graphemes: ['a', 'e', 'i', 'o', 'u'] },
};

const w = (word, band, pattern, patternIndex, length, zipf, extra = {}) => ({
  word, band, pattern, patternIndex, length, zipf,
  aoa: null, grapheme: null, homophoneId: null, sentence: `A ${word}.`,
  ...extra,
});

const WORDS = [
  w('it', 'under6', 'L1', 0, 2, 7.1),
  w('in', 'under6', 'L1', 0, 2, 7.0, { homophoneId: 296 }),
  w('go', 'under6', 'L2', 1, 2, 6.5),
  w('cat', 'under6', 'L3', 2, 3, 5.5, {
    grapheme: { bucket: 'L3', grapheme: 'a', start: 1, end: 2, indices: [1] },
  }),
  w('as', '6_7', 'L1', 0, 2, 6.8),
  w('spa', '9_10', 'L2', 1, 3, 3.2),
  w('quiz', '9_10', 'L3', 2, 4, 3.9),
  w('vex', '12_13', 'L3', 2, 3, 2.1),
];

// ---- band ordering / age ceiling -------------------------------------------

test('BAND_ORDER runs under6 -> 15plus and matches the research band names', () => {
  assert.equal(BAND_ORDER[0], 'under6');
  assert.equal(BAND_ORDER[BAND_ORDER.length - 1], '15plus');
  assert.equal(BAND_ORDER.length, 11);
  assert.ok(BAND_ORDER.includes('6_7'));
  assert.ok(BAND_ORDER.includes('14_15'));
});

test('ageToBandCeiling maps an age to its band (age is a ceiling)', () => {
  assert.equal(ageToBandCeiling(4), 'under6');
  assert.equal(ageToBandCeiling(6), '6_7');
  assert.equal(ageToBandCeiling(9.5), '9_10');
  assert.equal(ageToBandCeiling(15), '15plus');
  assert.equal(ageToBandCeiling(40), '15plus');
});

test('bandWithinCeiling accepts bands at or below the ceiling only', () => {
  assert.ok(bandWithinCeiling('under6', '9_10'));
  assert.ok(bandWithinCeiling('9_10', '9_10'));
  assert.ok(!bandWithinCeiling('12_13', '9_10'));
});

// ---- cumulative pool --------------------------------------------------------

test('buildPool is cumulative by age: union of every band <= the ceiling', () => {
  const young = buildPool(WORDS, 6);
  assert.deepEqual(young.map((e) => e.word).sort(), ['as', 'cat', 'go', 'in', 'it']);
  const nine = buildPool(WORDS, 9);
  assert.ok(nine.some((e) => e.word === 'quiz'));
  assert.ok(!nine.some((e) => e.word === 'vex'));
  const teen = buildPool(WORDS, 13);
  assert.equal(teen.length, WORDS.length);
});

// ---- within-pattern order ---------------------------------------------------

test('orderWithinPattern sorts shortest first, then most-frequent first', () => {
  const list = [
    w('banana', 'under6', 'L3', 2, 6, 5.0),
    w('bed', 'under6', 'L3', 2, 3, 5.2),
    w('cat', 'under6', 'L3', 2, 3, 5.5),
    w('nix', 'under6', 'L3', 2, 3, null),
  ];
  const sorted = orderWithinPattern(list).map((e) => e.word);
  assert.deepEqual(sorted, ['cat', 'bed', 'nix', 'banana']);
});

// ---- lesson plan ------------------------------------------------------------

test('lessonPlan walks the spine in order and only surfaces patterns the pool needs', () => {
  const pool = buildPool(WORDS, 6); // no L2 words beyond 'go'
  const plan = lessonPlan(pool, SPINE);
  assert.deepEqual(plan.map((l) => l.id), ['L1', 'L2', 'L3']);
  const onlyL1 = lessonPlan(pool.filter((e) => e.pattern === 'L1'), SPINE);
  assert.deepEqual(onlyL1.map((l) => l.id), ['L1']); // empty patterns don't surface
});

test('lessonPlan words are ordered shortest-then-most-frequent inside each lesson', () => {
  const plan = lessonPlan(buildPool(WORDS, 13), SPINE);
  const l1 = plan.find((l) => l.id === 'L1');
  assert.deepEqual(l1.words.map((e) => e.word), ['it', 'in', 'as']);
  const l3 = plan.find((l) => l.id === 'L3');
  assert.deepEqual(l3.words.map((e) => e.word), ['cat', 'vex', 'quiz']);
});

test('lessonPlan carries the spine label and rule for each lesson', () => {
  const plan = lessonPlan(buildPool(WORDS, 6), SPINE);
  assert.equal(plan[0].label, 'short vowel VC');
  assert.match(plan[0].rule, /short/);
});

// ---- reteach on a miss --------------------------------------------------------

test('reteach returns the rule, exemplars, and grapheme highlight indices', () => {
  const cat = WORDS.find((e) => e.word === 'cat');
  const r = reteach(cat, PATTERNS);
  assert.equal(r.rule, PATTERNS.L3.rule);
  assert.deepEqual(r.exemplars, ['cat']);
  assert.deepEqual(r.graphemeIndices, [1]);
  assert.equal(r.label, 'CVC');
});

test('reteach tolerates a missing grapheme span (no highlight, rule still taught)', () => {
  const it = WORDS.find((e) => e.word === 'it');
  const r = reteach(it, PATTERNS);
  assert.equal(r.rule, PATTERNS.L1.rule);
  assert.deepEqual(r.graphemeIndices, []);
});

// ---- homophones ---------------------------------------------------------------

test('needsCarrierSentence is true exactly when the word is in a homophone cluster', () => {
  assert.ok(needsCarrierSentence(WORDS.find((e) => e.word === 'in')));
  assert.ok(!needsCarrierSentence(WORDS.find((e) => e.word === 'it')));
});

// ---- the emitted sample dataset ------------------------------------------------
// data/research_sample.js is committed output of scripts/import_research.mjs.
// These lock its contract so the engine above can trust it.

test('research_sample: shape, bands, spine coverage, and per-lesson cap', async () => {
  const { RESEARCH } = await import('../data/research_sample.js');
  assert.ok(Array.isArray(RESEARCH.spine) && RESEARCH.spine.length > 50, 'spine present');
  assert.ok(RESEARCH.words.length > 200, 'a real sample, not a stub');

  const spineIds = new Set(RESEARCH.spine.map((s) => s.id));
  const perLessonBand = new Map();
  for (const e of RESEARCH.words) {
    assert.equal(typeof e.word, 'string');
    assert.ok(BAND_ORDER.includes(e.band), `band ${e.band}`);
    assert.ok(spineIds.has(e.pattern), `pattern ${e.pattern} on spine`);
    assert.ok(RESEARCH.patterns[e.pattern], `pattern ${e.pattern} in catalog`);
    assert.equal(typeof e.sentence, 'string');
    assert.ok(e.sentence.length > 0, `sentence for ${e.word}`);
    const k = `${e.pattern}|${e.band}`;
    perLessonBand.set(k, (perLessonBand.get(k) || 0) + 1);
  }
  for (const [k, n] of perLessonBand) {
    assert.ok(n <= RESEARCH.samplePerPatternBand, `cap exceeded at ${k}: ${n}`);
  }
  // every homophoneId resolves to a cluster containing the word
  for (const e of RESEARCH.words) {
    if (e.homophoneId == null) continue;
    const cluster = RESEARCH.homophones[e.homophoneId];
    assert.ok(cluster, `cluster ${e.homophoneId} for ${e.word}`);
    assert.ok(cluster.members.some((m) => m.word === e.word), `${e.word} in its cluster`);
  }
});

test('research_sample: the full teaching loop runs end-to-end on real data', async () => {
  const { RESEARCH } = await import('../data/research_sample.js');
  const plan7 = lessonPlan(buildPool(RESEARCH.words, 7), RESEARCH.spine);
  const plan12 = lessonPlan(buildPool(RESEARCH.words, 12), RESEARCH.spine);
  assert.ok(plan7.length > 10, 'a 7yo has lessons');
  assert.ok(plan12.length >= plan7.length, 'an older learner never has fewer lessons');
  // spine order is preserved
  const idx = plan12.map((l) => l.index);
  assert.deepEqual(idx, [...idx].sort((a, b) => a - b));
  // a 7yo pool never contains a word above their ceiling
  for (const l of plan7) {
    for (const e of l.words) assert.ok(bandWithinCeiling(e.band, '7_8'), `${e.word} ${e.band}`);
  }
  // reteach works on an arbitrary sampled word with a span
  const withSpan = RESEARCH.words.find((e) => e.grapheme && e.grapheme.indices.length);
  const r = reteach(withSpan, RESEARCH.patterns);
  assert.ok(r.rule.length > 0);
  assert.ok(r.graphemeIndices.every((i) => i >= 0 && i < withSpan.word.length));
});
