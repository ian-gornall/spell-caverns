// test/picturecode.test.js — PURE picture-password <-> sync-code mapping
// (src/engine/picturecode.js). A child taps 4 pictures; that maps to an 8-char code the
// sync backend uses. Runs under `node --test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PICTURES,
  PICTURE_CODE_LEN,
  pictureById,
  picturesToCode,
  codeToPictures,
} from '../src/engine/picturecode.js';
import { isValidSyncCode } from '../src/engine/cloudsync.js';

test('PICTURES are well-formed: unique ids + unique 2-char tokens + an emoji each', () => {
  assert.ok(PICTURES.length >= 12, 'a decent set to choose from');
  const ids = new Set();
  const tokens = new Set();
  for (const p of PICTURES) {
    assert.ok(p.id && !ids.has(p.id), `unique id ${p.id}`);
    ids.add(p.id);
    assert.match(p.token, /^[A-Z0-9]{2}$/, `2-char token for ${p.id}`);
    assert.ok(!tokens.has(p.token), `unique token ${p.token}`);
    tokens.add(p.token);
    assert.ok(p.emoji && p.name, `emoji + name for ${p.id}`);
  }
});

test('picturesToCode produces a valid sync code from 4 pictures', () => {
  const ids = PICTURES.slice(0, PICTURE_CODE_LEN).map((p) => p.id);
  const code = picturesToCode(ids);
  assert.equal(code.length, PICTURE_CODE_LEN * 2);
  assert.ok(isValidSyncCode(code), `picture code ${code} must satisfy the sync-code format`);
});

test('codeToPictures round-trips a picture code back to the same sequence', () => {
  const ids = ['dog', 'star', 'pizza', 'moon'];
  const code = picturesToCode(ids);
  const back = codeToPictures(code);
  assert.deepEqual(back.map((p) => p.id), ids, 'order preserved');
});

test('order matters and repeats are allowed (more memorable + more entropy)', () => {
  assert.notEqual(picturesToCode(['dog', 'cat', 'star', 'moon']), picturesToCode(['cat', 'dog', 'star', 'moon']));
  const rep = picturesToCode(['dog', 'dog', 'cat', 'cat']);
  assert.ok(isValidSyncCode(rep));
  assert.deepEqual(codeToPictures(rep).map((p) => p.id), ['dog', 'dog', 'cat', 'cat']);
});

test('invalid inputs return null (wrong count, unknown id/token)', () => {
  assert.equal(picturesToCode(['dog', 'cat']), null, 'too few');
  assert.equal(picturesToCode(['dog', 'cat', 'star', 'nope']), null, 'unknown id');
  assert.equal(codeToPictures('ZZZZZZZZ'), null, 'unknown tokens');
  assert.equal(codeToPictures('DGST'), null, 'wrong length');
  assert.equal(codeToPictures(''), null);
  assert.equal(pictureById('nope'), undefined);
});
