// test/placement.test.js — locks in the C1 placement diagnostic walk
// (src/engine/placement.js). Runs under `node --test` (no browser).
//
// The diagnostic is the COLD-START "cavern level 1" for every explorer (Ian
// 2026-06-22): ask the child's age → seed a START position in the frequency
// list (5→#1, 6→#300, +300/yr), then play normal CRAFT, walking ±100 list
// positions per answer (right→up, wrong→down), never repeating a word, until
// 3 missed words land in the SAME 30-word group (a "cavern level / band"). That
// band is where the explorer "enters" the cavern. These tests pin that contract.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  startPosForAge,
  createPlacement,
  nextWord,
  submit,
  isDone,
  result,
  serialize,
} from '../src/engine/placement.js';

// A synthetic frequency list: `n` words, each carrying its 0-based list position
// `pos` and its 30-word band (floor(pos/30)+1) — exactly what byRank() attaches.
function makeWords(n = 600) {
  return Array.from({ length: n }, (_, i) => ({
    word: `word${String(i).padStart(4, '0')}`, // length ≥ 3, always servable
    pos: i,
    band: Math.floor(i / 30) + 1,
    rank: i + 1,
  }));
}

// Drive a placement to completion against a simulated speller. `knows(entry)`
// decides whether the child spells that word correctly. Returns asked entries.
function run(words, opts, knows) {
  const state = createPlacement(words, opts);
  const asked = [];
  let entry;
  let guard = 0;
  while ((entry = nextWord(state)) !== null && guard++ < 5000) {
    asked.push(entry);
    submit(state, entry.word, knows(entry));
  }
  return { state, asked };
}

// ----------------------------------------------------------- age → start pos
test('startPosForAge maps age to the frequency-list start (5→#1, 6→#300, 7→#600, +300/yr)', () => {
  assert.equal(startPosForAge(5, 3000), 0); // word #1
  assert.equal(startPosForAge(6, 3000), 299); // word #300
  assert.equal(startPosForAge(7, 3000), 599); // word #600
  assert.equal(startPosForAge(8, 3000), 899);
  assert.equal(startPosForAge(13, 3000), 2399);
});

test('startPosForAge clamps to the list and handles odd ages', () => {
  assert.equal(startPosForAge(13, 1000), 999); // capped at list end
  assert.equal(startPosForAge(4, 3000), 0); // younger than 5 → the very start
  assert.equal(startPosForAge(undefined, 3000), 0); // missing age → start
  assert.ok(startPosForAge(99, 3000) <= 2999); // never off the end
});

// ----------------------------------------------------------- first item
test('nextWord serves the word at the age-seeded start position first', () => {
  const words = makeWords(600);
  const state = createPlacement(words, { age: 7 }); // → pos 599
  const first = nextWord(state);
  assert.equal(first.pos, 599);
  assert.equal(first.word, words[599].word);
});

// ----------------------------------------------------------- the ±100 walk
test('a correct answer jumps +100; a wrong answer jumps −100', () => {
  const words = makeWords(600);
  const state = createPlacement(words, { startPos: 300 });
  const a = nextWord(state); // pos 300
  assert.equal(a.pos, 300);
  submit(state, a.word, true); // correct → +100
  const b = nextWord(state);
  assert.equal(b.pos, 400);
  submit(state, b.word, false); // wrong → −100 → target 300, but 300 was served
  const c = nextWord(state);
  // 300 is already served → the walk advances forward to the next unserved word
  assert.equal(c.pos, 301);
});

test('never serves the same word twice', () => {
  const words = makeWords(600);
  // an erratic speller (alternating) forces lots of revisits near the frontier
  let i = 0;
  const { asked } = run(words, { startPos: 300, maxItems: 40 }, () => (i++ % 2 === 0));
  const seen = new Set(asked.map((w) => w.word));
  assert.equal(seen.size, asked.length, 'every asked word is unique');
});

// ----------------------------------------------------------- convergence / stop
test('walk converges and enters a band near the true frontier', () => {
  const words = makeWords(900);
  const FRONTIER = 520; // the child spells correctly iff pos < 520
  const { state } = run(words, { age: 7 }, (e) => e.pos < FRONTIER);
  assert.ok(isDone(state));
  const band = result(state).enteredBand;
  // band 18 ≈ pos 510-539 (the frontier). ±100 step resolution → within a few bands.
  assert.ok(band >= 16 && band <= 22, `entered band ${band} should bracket the frontier`);
});

test('stops as soon as 3 missed words fall in the same 30-word band', () => {
  const words = makeWords(900);
  const { state } = run(words, { age: 7 }, (e) => e.pos < 520);
  const enteredBand = result(state).enteredBand;
  const missesInBand = result(state).responses.filter(
    (r) => !r.correct && r.band === enteredBand,
  ).length;
  assert.equal(missesInBand, 3, 'enters exactly when the band reaches 3 misses');
});

test('a child who knows nothing enters the very first band', () => {
  const words = makeWords(600);
  const { state } = run(words, { age: 8 }, () => false); // wrong on everything
  assert.equal(result(state).enteredBand, 1);
});

test('a child who knows everything terminates (cannot climb forever) at the top', () => {
  const words = makeWords(600);
  const { state, asked } = run(words, { age: 5 }, () => true); // right on everything
  assert.ok(isDone(state));
  // never exceeds the list; ends near the top band
  assert.ok(asked.length <= 600);
  assert.ok(result(state).enteredBand >= 1);
});

// ----------------------------------------------------------- safety cap
test('an erratic speller still terminates by the maxItems cap with a sensible band', () => {
  const words = makeWords(900);
  let i = 0;
  const { state, asked } = run(words, { age: 7, maxItems: 12 }, () => (i++ % 3 === 0));
  assert.ok(isDone(state));
  assert.ok(asked.length <= 12, `asked ${asked.length} ≤ cap`);
  assert.ok(Number.isInteger(result(state).enteredBand));
});

// ----------------------------------------------------------- resume across sessions
test('the walk RESUMES from serialize() — no repeats, miss tally + answers preserved', () => {
  const words = makeWords(900);
  const F = 520;
  // session 1: a few words
  const s1 = createPlacement(words, { age: 7 });
  const asked1 = [];
  for (let i = 0; i < 4 && !isDone(s1); i++) { const e = nextWord(s1); if (!e) break; asked1.push(e.word); submit(s1, e.word, e.pos < F); }
  const saved = serialize(s1);
  // session 2: restore + play to completion
  const s2 = createPlacement(words, { restore: saved });
  assert.equal(s2.responses.length, asked1.length, 'restored answer count');
  assert.equal(result(s2).correctCount, result(s1).correctCount, 'restored correct tally');
  const seen1 = new Set(asked1);
  const asked2 = [];
  let e;
  let guard = 0;
  while (!isDone(s2) && (e = nextWord(s2)) !== null && guard++ < 5000) { asked2.push(e.word); submit(s2, e.word, e.pos < F); }
  assert.ok(asked2.every((w) => !seen1.has(w)), 'a resumed walk never re-serves a word from before');
  assert.ok(isDone(s2));
  assert.ok(result(s2).enteredBand >= 16 && result(s2).enteredBand <= 22);
});

// ----------------------------------------------------------- result shape
test('result() reports the entered band and per-word responses for seeding', () => {
  const words = makeWords(600);
  const { state } = run(words, { age: 6 }, (e) => e.pos < 350);
  const r = result(state);
  assert.ok(Number.isInteger(r.enteredBand));
  assert.equal(typeof r.itemsAsked, 'number');
  assert.equal(r.correctCount, r.responses.filter((x) => x.correct).length);
  for (const resp of r.responses) {
    assert.equal(typeof resp.word, 'string');
    assert.equal(typeof resp.correct, 'boolean');
    assert.ok(Number.isInteger(resp.pos));
    assert.ok(Number.isInteger(resp.band));
  }
});

// ----------------------------------------------------------- skips unservable
test('skips unservable (too-short) words without breaking position numbering', () => {
  const words = makeWords(600);
  words[599].word = 'a'; // 1-letter → unservable; walk must skip past it
  const state = createPlacement(words, { age: 7 }); // start pos 599
  const first = nextWord(state);
  assert.ok(first.word.length >= 3, 'served a servable word, not the 1-letter one');
  assert.ok(first.pos !== 599 || first.word.length >= 3);
});
