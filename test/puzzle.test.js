// test/puzzle.test.js — the PURE letter-tray logic behind the build-the-word
// (production / recall) puzzle mode. Mirrors the repo's test-first rule: the DOM
// puzzle module (src/modes/puzzle.js) is verified separately with Playwright; the
// decision logic lives in src/engine/puzzle.js and is covered here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../src/engine/distractors.js';
import { scrambleTray, gradeBuild, isProperWord, displayCase } from '../src/engine/puzzle.js';

function multiset(arr) {
  const m = {};
  for (const c of arr) m[c] = (m[c] || 0) + 1;
  return m;
}

test('scrambleTray contains every letter of the word (always solvable)', () => {
  const tray = scrambleTray('crystal', { rng: mulberry32(1) });
  const tm = multiset(tray);
  const wm = multiset('crystal'.split(''));
  for (const [c, n] of Object.entries(wm)) {
    assert.ok((tm[c] || 0) >= n, `tray missing letter "${c}"`);
  }
  assert.equal(tray.length, 'crystal'.length);
  assert.ok(tray.every((c) => typeof c === 'string' && c.length === 1));
});

test('scrambleTray adds exactly `extra` distractor letters, none in the word', () => {
  const tray = scrambleTray('gem', { extra: 3, rng: mulberry32(2) });
  assert.equal(tray.length, 'gem'.length + 3);
  const wm = multiset('gem'.split(''));
  const tm = multiset(tray);
  let extra = 0;
  for (const [c, n] of Object.entries(tm)) extra += Math.max(0, n - (wm[c] || 0));
  assert.equal(extra, 3, 'exactly 3 letters beyond the word itself');
  // every non-word tile is a true red herring (pool excludes in-word letters)
  for (const c of tray) {
    if (!'gem'.includes(c)) assert.ok(!'gem'.includes(c));
  }
});

test('scrambleTray never hands back the word already spelled (extra=0)', () => {
  for (let s = 1; s <= 20; s++) {
    const tray = scrambleTray('cat', { rng: mulberry32(s) });
    assert.notEqual(tray.join(''), 'cat', `seed ${s} returned the word unshuffled`);
  }
});

test('scrambleTray is deterministic for a given seed', () => {
  assert.deepEqual(
    scrambleTray('mineral', { rng: mulberry32(7) }),
    scrambleTray('mineral', { rng: mulberry32(7) }),
  );
});

test('scrambleTray handles single-letter and repeated-letter words', () => {
  assert.deepEqual(scrambleTray('a', { rng: mulberry32(1) }), ['a']);
  const tray = scrambleTray('llama', { rng: mulberry32(3) });
  assert.equal(multiset(tray)['l'], 2);
  assert.equal(multiset(tray)['a'], 2);
});

test('gradeBuild flags an empty / partial build as incomplete', () => {
  assert.equal(gradeBuild('gem', [null, null, null]).complete, false);
  const g = gradeBuild('gem', ['g', null, null]);
  assert.equal(g.complete, false);
  assert.equal(g.correct, false);
  assert.deepEqual(g.perPosition, [true, null, null]);
  assert.equal(g.correctCount, 1);
});

test('gradeBuild accepts a correct, complete build', () => {
  const g = gradeBuild('gem', ['g', 'e', 'm']);
  assert.equal(g.complete, true);
  assert.equal(g.correct, true);
  assert.deepEqual(g.perPosition, [true, true, true]);
  assert.equal(g.correctCount, 3);
});

test('gradeBuild marks per-position errors on a complete-but-wrong build', () => {
  const g = gradeBuild('gem', ['g', 'm', 'e']); // last two transposed
  assert.equal(g.complete, true);
  assert.equal(g.correct, false);
  assert.deepEqual(g.perPosition, [true, false, false]);
  assert.equal(g.correctCount, 1);
});

test('gradeBuild is case-insensitive', () => {
  assert.equal(gradeBuild('Gem', ['G', 'E', 'M']).correct, true);
});

// §4 caps (Ian 2026-06-22d): proper nouns are SPELLED with lowercase tiles/handwriting (the
// recognizer is case-insensitive), but the FIRST placed letter DISPLAYS as a capital so the child
// sees the correct proper form (e.g. "Europe") without ever needing to draw/pick a capital.
test('isProperWord detects a capitalized data entry (the proper-noun flag)', () => {
  assert.equal(isProperWord('Europe'), true);
  assert.equal(isProperWord('August'), true);
  assert.equal(isProperWord('cat'), false);
  assert.equal(isProperWord('iphone'), false);
  assert.equal(isProperWord(''), false);
  assert.equal(isProperWord(null), false);
});

test('displayCase uppercases ONLY position 0 of a proper noun (display only; grading unaffected)', () => {
  assert.equal(displayCase('e', 0, true), 'E'); // first letter of a proper noun → capital
  assert.equal(displayCase('u', 1, true), 'u'); // any other position stays lowercase
  assert.equal(displayCase('c', 0, false), 'c'); // common word → unchanged
  assert.equal(displayCase('', 0, true), ''); // empty slot → unchanged
  assert.equal(displayCase(null, 0, true), null);
});
