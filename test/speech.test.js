// test/speech.test.js — §32 voice spelling: the PURE transcript→letters mapping
// (src/speech.js `lettersFromTranscript`). Runs under `node --test` (no browser APIs touched).
//
// When a child spells a word ALOUD, a speech recogniser returns text like "see", "ay", "tee"
// (the SOUNDS of the letters) or single chars. This maps those to the letters c, a, t — handling
// the homophones (see→c, are→r, you→u, why→y, double-u→w, …) and ignoring non-letter words.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lettersFromTranscript } from '../src/speech.js';

test('single spoken letters map to the letter (the E-set + tricky ones)', () => {
  const cases = {
    a: 'a', ay: 'a', bee: 'b', see: 'c', sea: 'c', dee: 'd', ee: 'e', ef: 'f', eff: 'f',
    gee: 'g', aitch: 'h', eye: 'i', jay: 'j', kay: 'k', el: 'l', em: 'm', en: 'n', oh: 'o',
    pee: 'p', cue: 'q', queue: 'q', are: 'r', ar: 'r', ess: 's', tee: 't', tea: 't',
    you: 'u', vee: 'v', why: 'y', zee: 'z', zed: 'z', ex: 'x',
  };
  for (const [spoken, letter] of Object.entries(cases)) {
    assert.deepEqual(lettersFromTranscript(spoken), [letter], `${spoken} → ${letter}`);
  }
});

test('plain single characters pass through (a..z)', () => {
  assert.deepEqual(lettersFromTranscript('c'), ['c']);
  assert.deepEqual(lettersFromTranscript('C'), ['c']); // case-insensitive
  assert.deepEqual(lettersFromTranscript('x'), ['x']);
});

test('a spelled-out sequence yields the letters in order', () => {
  assert.deepEqual(lettersFromTranscript('see ay tee'), ['c', 'a', 't']);
  assert.deepEqual(lettersFromTranscript('c a t'), ['c', 'a', 't']);
  assert.deepEqual(lettersFromTranscript('d o g'), ['d', 'o', 'g']);
});

test('"double u" / "double you" → w', () => {
  assert.deepEqual(lettersFromTranscript('double u'), ['w']);
  assert.deepEqual(lettersFromTranscript('double you'), ['w']);
  assert.deepEqual(lettersFromTranscript('double-u'), ['w']);
});

test('non-letter words are ignored, letters around them are kept', () => {
  assert.deepEqual(lettersFromTranscript('the letter c'), ['c']);
  assert.deepEqual(lettersFromTranscript('um, bee'), ['b']);
  assert.deepEqual(lettersFromTranscript('cat'), []); // a whole WORD isn't a spelled letter — ignored
  assert.deepEqual(lettersFromTranscript(''), []);
  assert.deepEqual(lettersFromTranscript('   '), []);
});

test('punctuation and extra whitespace are tolerated', () => {
  assert.deepEqual(lettersFromTranscript('C-A-T'), ['c', 'a', 't']);
  assert.deepEqual(lettersFromTranscript('  see ,  ay . '), ['c', 'a']);
});
