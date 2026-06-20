// test/ui_phrases.test.js — pins the FIXED spoken-interface catalog (§32.A).
//
// These strings are pre-rendered to clips by scripts/gen_audio.mjs and looked up at
// runtime by audio.say()/speakPraise() via slug(). The contract that matters: every
// catalog string is a FIXED (non-interpolated) non-empty string, and every string
// slugs to a UNIQUE, non-empty slug — otherwise two lines would map to one clip file
// (one silently shadows the other). Runs under `node --test` (no browser).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { UI, UI_LINES, PRAISE, UI_PHRASES } from '../src/engine/ui_phrases.js';

// MUST stay identical to slug() in scripts/gen_audio.mjs AND src/audio.js, or a clip
// generated under one slug won't be found under another at runtime.
function slug(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

test('UI_LINES = the values of UI, all fixed non-empty strings', () => {
  assert.deepEqual(UI_LINES, Object.values(UI));
  assert.ok(UI_LINES.length >= 8, 'expected the onboarding + geode lines');
  for (const line of UI_LINES) {
    assert.equal(typeof line, 'string');
    assert.ok(line.trim().length > 0, `empty line: ${JSON.stringify(line)}`);
    // No interpolation — a ${...} placeholder can't be pre-rendered to one clip.
    assert.ok(!line.includes('${') && !line.includes('{'), `dynamic line can't be a clip: ${line}`);
  }
});

test('UI_PHRASES = the values of PRAISE, all fixed non-empty strings', () => {
  assert.deepEqual(UI_PHRASES, Object.values(PRAISE));
  assert.ok(UI_PHRASES.length >= 1);
  for (const p of UI_PHRASES) {
    assert.equal(typeof p, 'string');
    assert.ok(p.trim().length > 0);
    assert.ok(!p.includes('{'));
  }
});

test('every catalog string slugs to a unique, non-empty slug', () => {
  const all = [...UI_LINES, ...UI_PHRASES];
  const slugs = all.map(slug);
  for (let i = 0; i < all.length; i++) {
    assert.ok(slugs[i].length > 0, `blank slug for: ${all[i]}`);
  }
  assert.equal(new Set(slugs).size, slugs.length, 'two catalog strings share a slug');
});

test('the named onboarding lines are present (the first thing a user hears)', () => {
  assert.ok(UI.welcome.includes('Geo'));
  assert.ok(UI.letsDig.length > 0 && !UI.letsDig.includes('{')); // name dropped from speech
});
