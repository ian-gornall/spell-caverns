// test/distractors.test.js — locks in the behaviour of the pure distractor engine
// (src/engine/distractors.js). Runs under `node --test` (no browser).
//
// The distractor engine is what lets the game scale to thousands of words without
// hand-authored wrong answers, and what produces the easy->hard "very similar
// spellings" endgame. These tests pin down the contract the rest of the engine
// (and the rhythm/puzzle modes) will rely on.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { REAL_WORDS, byRank } from '../src/engine/lexicon.js';
import {
  mulberry32,
  shuffle,
  levenshtein,
  generateMisspellings,
  buildOptions,
} from '../src/engine/distractors.js';

// ------------------------------------------------------------------- mulberry32
test('mulberry32 is deterministic for a given seed', () => {
  const a = mulberry32(12345);
  const b = mulberry32(12345);
  const seqA = [a(), a(), a(), a(), a()];
  const seqB = [b(), b(), b(), b(), b()];
  assert.deepEqual(seqA, seqB);
});

test('mulberry32 produces floats in [0, 1) and not a constant', () => {
  const r = mulberry32(7);
  const vals = Array.from({ length: 50 }, () => r());
  for (const v of vals) {
    assert.ok(v >= 0 && v < 1, `out of range: ${v}`);
  }
  assert.ok(new Set(vals).size > 1, 'rng returned a constant');
});

test('mulberry32 with different seeds gives different streams', () => {
  const a = mulberry32(1);
  const b = mulberry32(2);
  assert.notEqual(a(), b());
});

// ---------------------------------------------------------------------- shuffle
test('shuffle returns a permutation without mutating the input', () => {
  const input = [1, 2, 3, 4, 5, 6, 7, 8];
  const copy = input.slice();
  const out = shuffle(input, mulberry32(99));
  assert.notEqual(out, input); // new array
  assert.deepEqual(input, copy); // input untouched
  assert.deepEqual([...out].sort((a, b) => a - b), copy); // same multiset
});

test('shuffle is deterministic given a seeded rng', () => {
  const input = ['a', 'b', 'c', 'd', 'e'];
  const out1 = shuffle(input, mulberry32(42));
  const out2 = shuffle(input, mulberry32(42));
  assert.deepEqual(out1, out2);
});

// ------------------------------------------------------------------ levenshtein
test('levenshtein computes known edit distances', () => {
  assert.equal(levenshtein('kitten', 'sitting'), 3);
  assert.equal(levenshtein('flaw', 'lawn'), 2);
  assert.equal(levenshtein('abc', 'abc'), 0);
  assert.equal(levenshtein('', 'abc'), 3);
  assert.equal(levenshtein('abc', ''), 3);
});

// ------------------------------------------------------------ generateMisspellings
test('generateMisspellings returns plausible, well-formed variants', () => {
  const out = generateMisspellings('because');
  assert.ok(Array.isArray(out));
  assert.ok(out.length > 0, 'no misspellings produced');
  for (const m of out) {
    assert.equal(typeof m, 'string');
    assert.ok(m.length > 0, 'empty misspelling');
    assert.ok(/^[a-z]+$/.test(m), `non-letter misspelling: ${m}`);
    assert.notEqual(m, 'because', 'misspelling equals the word');
  }
});

test('generateMisspellings is ordered closest (most confusable) first', () => {
  const word = 'because';
  const out = generateMisspellings(word, { max: 20 });
  for (let i = 0; i + 1 < out.length; i++) {
    const di = levenshtein(word, out[i]);
    const dj = levenshtein(word, out[i + 1]);
    assert.ok(di <= dj, `distance not non-decreasing at ${i}: ${out[i]}(${di}) > ${out[i + 1]}(${dj})`);
  }
});

test('generateMisspellings excludes real words when a real-word set is given', () => {
  const out = generateMisspellings('because', { realWords: REAL_WORDS, max: 30 });
  for (const m of out) {
    assert.ok(!REAL_WORDS.has(m), `produced a real word: ${m}`);
  }
});

test('generateMisspellings respects the max cap', () => {
  const out = generateMisspellings('beautiful', { max: 5 });
  assert.ok(out.length <= 5, `got ${out.length} > 5`);
});

test('generateMisspellings is deduplicated', () => {
  const out = generateMisspellings('letter', { max: 50 });
  assert.equal(out.length, new Set(out).size);
});

// ------------------------------------------------------------------ buildOptions
test('buildOptions returns exactly `count` options with one correct answer', () => {
  const opts = buildOptions('because', { count: 4, rng: mulberry32(1), realWords: REAL_WORDS });
  assert.equal(opts.length, 4);
  const correct = opts.filter((o) => o.correct);
  assert.equal(correct.length, 1);
  assert.equal(correct[0].text, 'because');
  for (const o of opts) {
    assert.equal(typeof o.text, 'string');
    assert.equal(typeof o.correct, 'boolean');
  }
});

test('buildOptions defaults to 3 options', () => {
  const opts = buildOptions('crystal', { rng: mulberry32(5), realWords: REAL_WORDS });
  assert.equal(opts.length, 3);
});

test('buildOptions option texts are all unique and distractors are never the word', () => {
  const opts = buildOptions('mineral', { count: 4, rng: mulberry32(8), realWords: REAL_WORDS });
  const texts = opts.map((o) => o.text);
  assert.equal(texts.length, new Set(texts).size, 'duplicate option text');
  for (const o of opts) {
    if (!o.correct) assert.notEqual(o.text, 'mineral', 'distractor equals the word');
  }
});

test('buildOptions never offers a real word as a distractor', () => {
  // Sample across the frequency range so we exercise short + long words.
  const sample = byRank().filter((_, i) => i % 200 === 0);
  for (const w of sample) {
    const opts = buildOptions(w.word, { count: 4, rng: mulberry32(w.rank + 1), realWords: REAL_WORDS });
    assert.equal(opts.length, 4, `not enough options for "${w.word}"`);
    for (const o of opts) {
      if (!o.correct) {
        assert.ok(!REAL_WORDS.has(o.text), `"${o.text}" (distractor for "${w.word}") is a real word`);
      }
    }
  }
});

test('buildOptions is deterministic for a given seed', () => {
  const a = buildOptions('because', { count: 4, rng: mulberry32(2026) });
  const b = buildOptions('because', { count: 4, rng: mulberry32(2026) });
  assert.deepEqual(a, b);
});

test('buildOptions ramps difficulty: hard distractors are closer than easy ones', () => {
  const word = 'because';
  const distractorDist = (difficulty) => {
    const opts = buildOptions(word, { count: 4, difficulty }); // no rng -> deterministic window
    return opts
      .filter((o) => !o.correct)
      .map((o) => levenshtein(word, o.text));
  };
  const hard = distractorDist(1);
  const easy = distractorDist(0);
  const sum = (xs) => xs.reduce((a, b) => a + b, 0);
  assert.ok(
    sum(hard) <= sum(easy),
    `hard distractors should be at least as close as easy ones (hard=${hard}, easy=${easy})`,
  );
  // and the two difficulty settings should actually select different distractors
  assert.notDeepEqual(hard.slice().sort(), easy.slice().sort());
});

test('buildOptions uses curated misspellings first (hardest setting)', () => {
  const curated = ['speling', 'speeling'];
  const opts = buildOptions('spelling', {
    count: 4,
    difficulty: 1,
    curated,
    realWords: REAL_WORDS,
  });
  const texts = new Set(opts.map((o) => o.text));
  for (const c of curated) {
    assert.ok(texts.has(c), `curated distractor "${c}" missing from options`);
  }
});

test('buildOptions guarantees enough options even for very short words', () => {
  for (const word of ['go', 'an', 'to', 'i']) {
    const opts = buildOptions(word, { count: 3, rng: mulberry32(3), realWords: REAL_WORDS });
    assert.equal(opts.length, 3, `"${word}" produced ${opts.length} options`);
    assert.equal(opts.filter((o) => o.correct).length, 1);
  }
});
