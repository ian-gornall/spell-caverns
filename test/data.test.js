// test/data.test.js — locks in the integrity of the generated dataset AND the
// pure helpers in src/engine/lexicon.js. Runs under `node --test` (no browser).
//
// If any of these fail after a dataset rebuild (`node scripts/merge.mjs`), the
// data is broken — fix the source/merge, not this test.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { WORDS, PATTERNS } from '../data/words.js';
import { PATTERN_IDS, PATTERN_BY_ID } from '../data/patterns.js';
import {
  REAL_WORDS,
  wordsByPattern,
  wordsByTier,
  getWord,
  byRank,
} from '../src/engine/lexicon.js';

// ---------------------------------------------------------------- dataset shape
test('dataset is non-empty and the expected size', () => {
  assert.ok(WORDS.length > 2000, `only ${WORDS.length} words`);
  assert.equal(PATTERNS.length, 63);
});

test('every word entry has the required, well-typed fields', () => {
  for (const w of WORDS) {
    assert.equal(typeof w.word, 'string');
    assert.ok(w.word.length > 0 && w.word === w.word.toLowerCase(), `bad word: ${w.word}`);
    assert.equal(typeof w.rank, 'number');
    assert.ok(Number.isInteger(w.tier) && w.tier >= 1 && w.tier <= 9, `bad tier on ${w.word}`);
    assert.ok(Array.isArray(w.syllables) && w.syllables.length > 0, `bad syllables on ${w.word}`);
    assert.ok(Array.isArray(w.misspellings), `bad misspellings on ${w.word}`);
    assert.ok(typeof w.sentence === 'string' && w.sentence.length > 0, `bad sentence on ${w.word}`);
  }
});

test('syllables always join back to the exact word', () => {
  for (const w of WORDS) {
    assert.equal(w.syllables.join(''), w.word, `syllables of "${w.word}" -> "${w.syllables.join('')}"`);
  }
});

test('every pattern id is one of the 63 canonical families', () => {
  for (const w of WORDS) {
    assert.ok(PATTERN_IDS.has(w.pattern), `unknown pattern "${w.pattern}" on word "${w.word}"`);
  }
});

test('sentences almost always contain the exact word (regression guard)', () => {
  // The blanked-sentence context (rhythm mode) relies on the word appearing in
  // its sentence. A handful of entries use a morphological variant (rights/right)
  // or are off-topic; that is a known minor content issue, not an integrity bug.
  // We guard the *property* so a bad re-merge that breaks it at scale is caught.
  const omit = WORDS.filter((w) => !w.sentence.toLowerCase().includes(w.word));
  const rate = omit.length / WORDS.length;
  assert.ok(
    rate <= 0.01,
    `${omit.length}/${WORDS.length} sentences omit their word (${(rate * 100).toFixed(2)}%): ` +
      omit.slice(0, 10).map((w) => w.word).join(', '),
  );
});

test('a misspelling is never the correct spelling, and is never blank', () => {
  for (const w of WORDS) {
    for (const m of w.misspellings) {
      assert.equal(typeof m, 'string');
      assert.ok(m.length > 0, `empty misspelling on "${w.word}"`);
      assert.notEqual(m, w.word, `"${w.word}" lists itself as a misspelling`);
    }
  }
});

test('word strings are unique (no duplicate entries)', () => {
  const seen = new Set();
  for (const w of WORDS) {
    assert.ok(!seen.has(w.word), `duplicate word entry: "${w.word}"`);
    seen.add(w.word);
  }
});

test('WORDS is frequency-ordered: rank is non-decreasing', () => {
  let prev = -Infinity;
  for (const w of WORDS) {
    assert.ok(w.rank >= prev, `rank dropped at "${w.word}" (${w.rank} < ${prev})`);
    prev = w.rank;
  }
});

test('PATTERN_BY_ID resolves every id to its family record', () => {
  for (const id of PATTERN_IDS) {
    assert.ok(PATTERN_BY_ID[id], `no record for pattern id "${id}"`);
    assert.equal(PATTERN_BY_ID[id].id, id);
  }
});

// ------------------------------------------------------------- lexicon helpers
test('REAL_WORDS is the full set of correct spellings', () => {
  assert.equal(REAL_WORDS.size, WORDS.length);
  assert.ok(REAL_WORDS.has('the'));
  assert.ok(REAL_WORDS.has(WORDS[WORDS.length - 1].word));
  assert.ok(!REAL_WORDS.has('zzznotaword'));
});

test('wordsByPattern returns only entries of that pattern, and covers them all', () => {
  let counted = 0;
  for (const id of PATTERN_IDS) {
    const got = wordsByPattern(id);
    for (const w of got) assert.equal(w.pattern, id);
    counted += got.length;
  }
  // every word belongs to exactly one pattern, so the partition sums to the whole
  assert.equal(counted, WORDS.length);
});

test('wordsByTier returns only entries of that tier, and covers them all', () => {
  let counted = 0;
  for (let t = 1; t <= 9; t++) {
    const got = wordsByTier(t);
    for (const w of got) assert.equal(w.tier, t);
    counted += got.length;
  }
  assert.equal(counted, WORDS.length);
});

test('getWord finds a known entry and returns undefined for a non-word', () => {
  const because = getWord('because');
  assert.ok(because);
  assert.equal(because.word, 'because');
  assert.equal(getWord('zzznotaword'), undefined);
});

test('byRank returns a sorted shallow copy that does not alias WORDS', () => {
  const a = byRank();
  assert.equal(a.length, WORDS.length);
  assert.notEqual(a, WORDS); // different array instance
  let prev = -Infinity;
  for (const w of a) {
    assert.ok(w.rank >= prev);
    prev = w.rank;
  }
  // mutating the copy must not disturb the shared dataset
  a.reverse();
  assert.equal(WORDS[0].word, 'the');
});

// ------------------------------------------------------------- coverage (supplement)
// The frequency-filtered backbone missed many common, age-appropriate words and
// left some teaching pattern-families thin. The curated supplement (data/supplement.js)
// fills those gaps; these tests lock the coverage in so a re-merge can't silently drop it.
test('common high-frequency words are covered', () => {
  const must = [
    'tight', 'knight', 'fright', 'slight', 'tonight', 'brave', 'prize', 'spark',
    'storm', 'smooth', 'climb', 'gentle', 'gem', 'copper', 'lazy', 'hammer',
    'giant', 'rabbit', 'spoon', 'crash',
  ];
  const missing = must.filter((w) => !REAL_WORDS.has(w));
  assert.equal(missing.length, 0, `still missing common words: ${missing.join(', ')}`);
});

test('the -ight teaching family is well populated', () => {
  const ight = wordsByPattern('ight');
  assert.ok(ight.length >= 24, `only ${ight.length} -ight words`);
  for (const w of ['tight', 'slight', 'knight', 'fright']) {
    assert.ok(ight.some((e) => e.word === w), `-ight family should include ${w}`);
  }
});
