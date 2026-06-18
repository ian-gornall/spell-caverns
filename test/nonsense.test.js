// test/nonsense.test.js — locks in the pattern-based nonsense-word generator
// (src/engine/nonsense.js) used by the Crystal Lab. Runs under `node --test`.
//
// makeNonsenseWord invents a PRONOUNCEABLE non-word that embodies a given spelling
// pattern (e.g. "splight" for `ight`, "dake" for `silent-e-a`), so spelling it
// reinforces the pattern. Guarantees: not a real (dataset) word, not in `avoid`,
// deterministic under a seeded rng. Only phonetically-meaningful patterns are
// supported (NONSENSE_PATTERNS); others return null.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { REAL_WORDS } from '../src/engine/lexicon.js';
import { PATTERN_IDS } from '../data/patterns.js';
import { mulberry32 } from '../src/engine/distractors.js';
import {
  ONSETS,
  RIMES,
  NONSENSE_PATTERNS,
  makeNonsenseWord,
} from '../src/engine/nonsense.js';
import { NONSENSE_BLOCKLIST } from '../data/nonsense_blocklist.js';

const hasVowel = (w) => /[aeiouy]/.test(w);

// --------------------------------------------------------------- exports shape
test('ONSETS and RIMES are well-formed; NONSENSE_PATTERNS are real pattern ids', () => {
  assert.ok(Array.isArray(ONSETS) && ONSETS.length > 0);
  for (const o of ONSETS) assert.ok(/^[a-z]+$/.test(o), `bad onset ${o}`);
  assert.ok(NONSENSE_PATTERNS.length >= 25, `only ${NONSENSE_PATTERNS.length} patterns`);
  for (const id of NONSENSE_PATTERNS) {
    assert.ok(PATTERN_IDS.has(id), `"${id}" is not a canonical pattern id`);
    assert.ok(RIMES[id] && Array.isArray(RIMES[id].rimes) && RIMES[id].rimes.length > 0, `bad rimes for ${id}`);
  }
});

// --------------------------------------------------------------- single word
test('makeNonsenseWord makes a pronounceable non-word for a supported pattern', () => {
  const w = makeNonsenseWord('ight', { realWords: REAL_WORDS, rng: mulberry32(1) });
  assert.equal(typeof w, 'string');
  assert.ok(/^[a-z]+$/.test(w), `not all letters: ${w}`);
  assert.ok(w.length >= 3 && hasVowel(w));
  assert.ok(w.includes('ight'), `should embody the pattern: ${w}`);
  assert.ok(!REAL_WORDS.has(w), `should not be a real word: ${w}`);
});

// --------------------------------------------------------------- broad coverage
test('every supported pattern yields a non-real, pronounceable word across seeds', () => {
  for (const id of NONSENSE_PATTERNS) {
    for (let seed = 1; seed <= 5; seed++) {
      const w = makeNonsenseWord(id, { realWords: REAL_WORDS, rng: mulberry32(seed) });
      assert.ok(w, `no word for pattern ${id} (seed ${seed})`);
      assert.ok(/^[a-z]+$/.test(w), `pattern ${id}: non-letter word ${w}`);
      assert.ok(w.length >= 2 && hasVowel(w), `pattern ${id}: unpronounceable ${w}`);
      assert.ok(!REAL_WORDS.has(w), `pattern ${id}: produced real word ${w}`);
    }
  }
});

// --------------------------------------------------------------- signatures
test('generated words carry their pattern signature', () => {
  const checks = {
    sh: (w) => w.includes('sh'),
    ch: (w) => w.includes('ch'),
    oo: (w) => w.includes('oo'),
    'r-ar': (w) => w.includes('ar'),
    tch: (w) => w.includes('tch'),
    'ai-ay': (w) => w.includes('ai') || w.includes('ay'),
    'ee-ea': (w) => w.includes('ee') || w.includes('ea'),
    'silent-e-a': (w) => /a[a-z]e/.test(w),
  };
  for (const [id, ok] of Object.entries(checks)) {
    assert.ok(NONSENSE_PATTERNS.includes(id), `${id} should be supported`);
    for (let seed = 1; seed <= 4; seed++) {
      const w = makeNonsenseWord(id, { realWords: REAL_WORDS, rng: mulberry32(seed) });
      assert.ok(ok(w), `pattern ${id} word "${w}" lacks its signature`);
    }
  }
});

// --------------------------------------------------------------- exclusions
test('avoid prevents repeats; many distinct specimens can be collected', () => {
  const avoid = new Set();
  const got = [];
  for (let i = 0; i < 6; i++) {
    const w = makeNonsenseWord('silent-e-a', { realWords: REAL_WORDS, rng: mulberry32(42), avoid });
    assert.ok(w, `ran out at ${i}`);
    assert.ok(!avoid.has(w), `repeated avoided word ${w}`);
    avoid.add(w);
    got.push(w);
  }
  assert.equal(new Set(got).size, 6, 'expected 6 distinct specimens');
});

test('avoid accepts an array as well as a Set', () => {
  const first = makeNonsenseWord('oo', { realWords: REAL_WORDS, rng: mulberry32(3) });
  const second = makeNonsenseWord('oo', { realWords: REAL_WORDS, rng: mulberry32(3), avoid: [first] });
  assert.notEqual(second, first);
});

// --------------------------------------------------------------- determinism
test('same seed + pattern + avoid is reproducible', () => {
  const a = makeNonsenseWord('ee-ea', { realWords: REAL_WORDS, rng: mulberry32(2026) });
  const b = makeNonsenseWord('ee-ea', { realWords: REAL_WORDS, rng: mulberry32(2026) });
  assert.equal(a, b);
});

// ----------------------------------------------- real-word blocklist (QA I2)
// The generator can only ever produce onset+rime combos; some of those combos are
// real English words outside the game dataset (e.g. "leaf", "greet") and used to
// leak into the Lab as fake "crystals". data/nonsense_blocklist.js is the precomputed
// set of those real-word combos; excluding it (plus REAL_WORDS) keeps the Lab clean.
test('blocklist is well-formed and includes the documented leaks', () => {
  assert.ok(Array.isArray(NONSENSE_BLOCKLIST) && NONSENSE_BLOCKLIST.length > 100);
  for (const w of NONSENSE_BLOCKLIST) assert.ok(/^[a-z]{2,}$/.test(w), `bad blocklist entry ${w}`);
  assert.ok(NONSENSE_BLOCKLIST.includes('leaf'), 'should block the real word "leaf"');
  assert.ok(NONSENSE_BLOCKLIST.includes('greet'), 'should block the real word "greet"');
});

test('with the blocklist excluded, no pattern ever emits a real/blocked word', () => {
  const exclude = new Set([...REAL_WORDS, ...NONSENSE_BLOCKLIST]);
  for (const id of NONSENSE_PATTERNS) {
    for (let seed = 1; seed <= 12; seed++) {
      const w = makeNonsenseWord(id, { realWords: exclude, rng: mulberry32(seed * 13 + 1) });
      assert.ok(w, `pattern ${id} (seed ${seed}) produced nothing after blocklist`);
      assert.ok(!exclude.has(w), `pattern ${id}: emitted blocked/real word ${w}`);
    }
  }
});

// --------------------------------------------------------------- unsupported
test('unsupported / arbitrary patterns return null', () => {
  for (const id of ['easy-sight', 'homophone', 'tricky', 'multisyllable', 'greek-roots', 'not-a-pattern']) {
    assert.equal(makeNonsenseWord(id, { realWords: REAL_WORDS, rng: mulberry32(1) }), null, `${id} should be null`);
    if (id !== 'not-a-pattern') assert.ok(!NONSENSE_PATTERNS.includes(id), `${id} should not be supported`);
  }
});
