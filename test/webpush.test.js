// test/webpush.test.js — proves the Web Push crypto (src/engine/webpush.js) is correct
// WITHOUT a physical phone, by reproducing the published RFC 8291 Appendix A vector
// byte-for-byte, plus a self-decrypt round-trip for the production (random-salt) path and
// a VAPID-JWT sign/verify check. If these pass, a real push service will accept our bodies.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  b64urlToBytes,
  bytesToB64url,
  encryptPayload,
  buildVapidJWT,
} from '../src/engine/webpush.js';

const subtle = globalThis.crypto.subtle;

// --- RFC 8291 Appendix A: exact intermediate/expected values -----------------
const V = {
  plaintext: 'V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24',
  as_public: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  as_private: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  ua_public: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  ua_private: 'q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94',
  salt: 'DGv6ra1nlYgDCS1FRnbzlw',
  auth_secret: 'BTBZMqHH6r4Tts7J_aSIgg',
  header: 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  ciphertext: '8pfeW0KbunFT06SuDKoJH9Ql87S1QUrdirN6GcG7sFz1y1sqLgVi1VhjVkHsUoEsbI_0LpXMuGvnzQ',
};

test('b64url round-trips arbitrary bytes', () => {
  const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255, 65, 66]);
  assert.deepEqual(b64urlToBytes(bytesToB64url(bytes)), bytes);
  // tolerates the whitespace the RFC prints inside its base64url blocks
  assert.deepEqual(b64urlToBytes('AAEC AwQF'), new Uint8Array([0, 1, 2, 3, 4, 5]));
});

test('encryptPayload reproduces RFC 8291 Appendix A byte-for-byte', async () => {
  const body = await encryptPayload({
    uaPublicB64url: V.ua_public,
    authSecretB64url: V.auth_secret,
    payload: b64urlToBytes(V.plaintext),
    _testServer: {
      asPublic: b64urlToBytes(V.as_public),
      asPrivate: b64urlToBytes(V.as_private),
      salt: b64urlToBytes(V.salt),
    },
  });
  const expected = new Uint8Array([...b64urlToBytes(V.header), ...b64urlToBytes(V.ciphertext)]);
  assert.equal(bytesToB64url(body), bytesToB64url(expected));
});

// Decrypt helper (RECEIVER side) — only used by the round-trip test below to confirm the
// random-salt production path yields something a user agent could actually decrypt.
async function decrypt(body, uaPublicB64url, uaPrivateB64url, authSecretB64url) {
  const enc = new TextEncoder();
  const concat = (...a) => {
    const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0));
    let off = 0;
    for (const x of a) { o.set(x, off); off += x.length; }
    return o;
  };
  const hmac = async (k, m) => {
    const key = await subtle.importKey('raw', k, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return new Uint8Array(await subtle.sign('HMAC', key, m));
  };
  const hkdf = async (salt, ikm, info, len) => (await hmac(await hmac(salt, ikm), concat(info, new Uint8Array([1])))).subarray(0, len);
  const info = (l) => concat(enc.encode(`Content-Encoding: ${l}`), new Uint8Array([0]));

  const salt = body.subarray(0, 16);
  const asPublic = body.subarray(21, 86);
  const ct = body.subarray(86);
  const uaPublic = b64urlToBytes(uaPublicB64url);

  const x = bytesToB64url(uaPublic.subarray(1, 33));
  const y = bytesToB64url(uaPublic.subarray(33, 65));
  const uaPriv = await subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x, y, d: uaPrivateB64url, ext: true }, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
  const asPub = await subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: asPub }, uaPriv, 256));

  const keyInfo = concat(enc.encode('WebPush: info'), new Uint8Array([0]), uaPublic, asPublic);
  const ikm = await hkdf(b64urlToBytes(authSecretB64url), shared, keyInfo, 32);
  const cek = await hkdf(salt, ikm, info('aes128gcm'), 16);
  const nonce = await hkdf(salt, ikm, info('nonce'), 12);
  const aesKey = await subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['decrypt']);
  const pt = new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, aesKey, ct));
  return pt.subarray(0, pt.length - 1); // drop the 0x02 padding delimiter
}

test('production path (random salt + ephemeral key) decrypts back to the payload', async () => {
  const msg = JSON.stringify({ title: 'Your geode is ready 💎', body: 'Come open today’s crystal!' });
  const body = await encryptPayload({
    uaPublicB64url: V.ua_public,
    authSecretB64url: V.auth_secret,
    payload: msg,
  });
  const round = await decrypt(body, V.ua_public, V.ua_private, V.auth_secret);
  assert.equal(new TextDecoder().decode(round), msg);
});

test('buildVapidJWT signs a verifiable ES256 token with the right claims', async () => {
  const kp = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const pkcs8 = bytesToB64url(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey)));
  const exp = 1893456000; // fixed clock (2030-01-01) — tests must not read the wall clock
  const jwt = await buildVapidJWT({ audience: 'https://fcm.googleapis.com', subject: 'mailto:dev@example.com', privateKey: pkcs8, expSeconds: exp });

  const [h, p, s] = jwt.split('.');
  const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(h)));
  const body = JSON.parse(new TextDecoder().decode(b64urlToBytes(p)));
  assert.equal(header.alg, 'ES256');
  assert.equal(header.typ, 'JWT');
  assert.equal(body.aud, 'https://fcm.googleapis.com');
  assert.equal(body.sub, 'mailto:dev@example.com');
  assert.equal(body.exp, exp);

  const ok = await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, kp.publicKey, b64urlToBytes(s), new TextEncoder().encode(`${h}.${p}`));
  assert.equal(ok, true);
});
