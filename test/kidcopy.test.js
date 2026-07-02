// test/kidcopy.test.js — kid-voiced lesson copy (src/engine/kidcopy.js + data/kid_rules.js).
//
// §39/§40: the research corpus's rule strings are teacher register ("consonant-vowel-
// consonant", "/or/ is usually spelled or"). KID_RULES is the in-repo overlay that
// rewrites every lesson's name + rule for a 6-9 year old; kidLesson() is the ONE
// read every kid-facing surface goes through (reteach strips, intro card, chip,
// Progress path, Settings label). Pure; runs under `node --test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { kidLesson } from '../src/engine/kidcopy.js';
import { KID_RULES } from '../data/kid_rules.js';
import { RESEARCH } from '../data/research_sample.js';

// ---- kidLesson: overlay preferred, corpus fallback ---------------------------

test('kidLesson prefers the KID_RULES overlay over the corpus strings', () => {
  const out = kidLesson({ id: 'L3', label: 'CVC short vowel (cat, dog, box)', rule: 'In a consonant-vowel-consonant word, the middle vowel is short.' });
  assert.equal(out.id, 'L3');
  assert.equal(out.name, KID_RULES.L3.name);
  assert.equal(out.rule, KID_RULES.L3.rule);
  assert.doesNotMatch(out.rule, /consonant|vowel/i);
});

test('kidLesson falls back to the corpus label/rule for an unknown lesson id', () => {
  const out = kidLesson({ id: 'L999', label: 'corpus label', rule: 'corpus rule.' });
  assert.equal(out.name, 'corpus label');
  assert.equal(out.rule, 'corpus rule.');
});

test('kidLesson reads entry-shaped objects too (lessonId/lessonLabel from lexiconEntries)', () => {
  const out = kidLesson({ lessonId: 'L12', lessonLabel: 'sh = /sh/', rule: 'sh says /sh/.', word: 'ship' });
  assert.equal(out.id, 'L12');
  assert.equal(out.name, KID_RULES.L12.name);
  assert.equal(out.rule, KID_RULES.L12.rule);
});

test('kidLesson passes exemplars through and is null-safe', () => {
  assert.equal(kidLesson(null), null);
  assert.equal(kidLesson(undefined), null);
  const out = kidLesson({ id: 'L7', exemplars: ['car', 'arm', 'farm'] });
  assert.deepEqual(out.exemplars, ['car', 'arm', 'farm']);
  assert.deepEqual(kidLesson({ id: 'L7' }).exemplars, []);
});

// ---- KID_RULES: complete + kid register --------------------------------------
// Every spine lesson must have an overlay entry (the fallback is a safety net,
// not the plan), and every string must actually read like a 6-9yo's teacher:
// no linguistics jargon, no /slash/ phoneme notation, short enough to speak.

const JARGON = /\b(consonant|vowel|cluster|syllable|schwa|plural|noun|verb|adjective|adverb|suffix|prefix|comparative|superlative|unstressed)\b/i;
const SLASH_PHONEME = /\/[^\s/]+\//;

test('KID_RULES covers every lesson on the research spine', () => {
  const missing = RESEARCH.spine.map((s) => s.id).filter((id) => !KID_RULES[id]);
  assert.deepEqual(missing, [], `missing overlay for: ${missing.join(', ')}`);
});

test('every KID_RULES entry has a short name and a speakable kid-voiced rule', () => {
  for (const [id, k] of Object.entries(KID_RULES)) {
    assert.ok(k.name && k.name.length >= 3 && k.name.length <= 26, `${id} name length ("${k.name}")`);
    assert.ok(k.rule && k.rule.length >= 15 && k.rule.length <= 170, `${id} rule length (${k.rule?.length})`);
    assert.match(k.rule, /[.!]$/, `${id} rule ends as a sentence`);
    assert.doesNotMatch(k.name + ' ' + k.rule, JARGON, `${id} uses kid words, not jargon`);
    assert.doesNotMatch(k.rule, SLASH_PHONEME, `${id} avoids /slash/ phonemes`);
    assert.doesNotMatch(k.name + k.rule, /—/, `${id} has no em dashes`);
  }
});
