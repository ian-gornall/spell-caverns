// src/engine/webpush.js — Web Push payload encryption (RFC 8291, "aes128gcm") + VAPID
// request auth (RFC 8292), implemented with the standard WebCrypto API so the SAME code
// runs on Cloudflare Workers (the sender, worker.js scheduled()) and under `node --test`
// (which is how we prove the crypto is correct against the RFC 8291 Appendix A vectors —
// we have no physical phone in CI).
//
// This is a PURE crypto/protocol module: no DOM, no fetch, no Worker globals. The Worker
// composes these with KV + fetch to actually deliver a push. Reused, never duplicated.
//
// Why hand-rolled instead of a library: the app is deliberately dependency-free (npm ci on
// the host installs nothing), and the Worker bundle must stay tiny. WebCrypto gives us
// ECDH(P-256), HMAC-SHA-256, AES-128-GCM and ECDSA(P-256) — everything the two RFCs need.

const enc = new TextEncoder();
const subtle = () => globalThis.crypto.subtle;

// ---- base64url <-> bytes -----------------------------------------------------
export function b64urlToBytes(s) {
  const b64 = String(s).replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '');
  const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '';
  const bin = atob(b64 + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToB64url(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function concat(...arrs) {
  const len = arrs.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(len);
  let off = 0;
  for (const a of arrs) {
    out.set(a, off);
    off += a.length;
  }
  return out;
}

// ---- HKDF (RFC 5869) via HMAC-SHA-256 ---------------------------------------
async function hmacSha256(keyBytes, msgBytes) {
  const key = await subtle().importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await subtle().sign('HMAC', key, msgBytes));
}

// HKDF-Extract then a single HKDF-Expand block (every output we need is <= 32 bytes, so one
// T(1) = HMAC(PRK, info || 0x01) block always suffices). Returns the first `length` bytes.
async function hkdf(salt, ikm, info, length) {
  const prk = await hmacSha256(salt, ikm);
  const t1 = await hmacSha256(prk, concat(info, new Uint8Array([1])));
  return t1.subarray(0, length);
}

function infoStr(label) {
  // "Content-Encoding: <label>" || 0x00  (RFC 8188 §2.2 / RFC 8291 §3.4)
  return concat(enc.encode(`Content-Encoding: ${label}`), new Uint8Array([0]));
}

// Import a raw uncompressed P-256 public point (65 bytes, 0x04||X||Y) as an ECDH key.
function importEcdhPublic(rawPoint) {
  return subtle().importKey('raw', rawPoint, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
}

// Build an ECDH private JWK from a raw public point (X,Y) + the private scalar d.
function ecdhPrivateFromParts(rawPoint, d) {
  const x = bytesToB64url(rawPoint.subarray(1, 33));
  const y = bytesToB64url(rawPoint.subarray(33, 65));
  const jwk = { kty: 'EC', crv: 'P-256', x, y, d: bytesToB64url(d), ext: true };
  return subtle().importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
}

// Encrypt a push payload for one subscription using the RFC 8291 "aes128gcm" scheme.
//   uaPublicB64url  — the subscription's p256dh key (receiver public key)
//   authSecretB64url— the subscription's auth secret (16 bytes)
//   payload         — string or Uint8Array (the notification JSON we want delivered)
//   _testServer     — TEST ONLY: { asPublic:Uint8Array(65), asPrivate:Uint8Array(32), salt:Uint8Array(16) }
//                     to reproduce the deterministic RFC 8291 Appendix A vector. Omitted in
//                     production, where a fresh ephemeral key + random salt are generated.
// Returns a Uint8Array body (header || AES-GCM ciphertext) ready to POST to the push endpoint.
export async function encryptPayload({ uaPublicB64url, authSecretB64url, payload, _testServer } = {}) {
  const uaPublic = b64urlToBytes(uaPublicB64url);
  const authSecret = b64urlToBytes(authSecretB64url);
  const plaintext = typeof payload === 'string' ? enc.encode(payload) : new Uint8Array(payload || []);

  // Application-server (sender) ephemeral ECDH key + random salt — fixed only in tests.
  let asPublic;
  let asPrivKey;
  let salt;
  if (_testServer) {
    asPublic = _testServer.asPublic;
    salt = _testServer.salt;
    asPrivKey = await ecdhPrivateFromParts(_testServer.asPublic, _testServer.asPrivate);
  } else {
    const kp = await subtle().generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    asPublic = new Uint8Array(await subtle().exportKey('raw', kp.publicKey));
    asPrivKey = kp.privateKey;
    salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  }

  // 1. ECDH shared secret between sender private + receiver public.
  const uaPubKey = await importEcdhPublic(uaPublic);
  const ecdhSecret = new Uint8Array(await subtle().deriveBits({ name: 'ECDH', public: uaPubKey }, asPrivKey, 256));

  // 2. Combine with the auth secret (RFC 8291 §3.4): IKM = HKDF(auth, ecdh, "WebPush: info"…).
  const keyInfo = concat(enc.encode('WebPush: info'), new Uint8Array([0]), uaPublic, asPublic);
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32);

  // 3. Derive the content-encryption key + nonce (RFC 8188 §2.2) from the salt.
  const cek = await hkdf(salt, ikm, infoStr('aes128gcm'), 16);
  const nonce = await hkdf(salt, ikm, infoStr('nonce'), 12);

  // 4. AES-128-GCM over (plaintext || 0x02 padding-delimiter). One record, rs = 4096.
  const aesKey = await subtle().importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const record = concat(plaintext, new Uint8Array([2]));
  const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, aesKey, record));

  // 5. aes128gcm header: salt(16) || rs(uint32 BE = 4096) || idlen(1=65) || keyid(as_public,65).
  const header = new Uint8Array(16 + 4 + 1 + 65);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096, false);
  header[20] = 65;
  header.set(asPublic, 21);

  return concat(header, ct);
}

// ---- VAPID (RFC 8292) -------------------------------------------------------
// Build the signed JWT used in the "Authorization: vapid t=<jwt>, k=<pub>" header.
//   audience   — scheme+host of the push endpoint, e.g. "https://fcm.googleapis.com"
//   subject    — a contact URI, "mailto:you@example.com"
//   privateKey — a CryptoKey (ECDSA P-256, ['sign']) OR a pkcs8 base64url string to import
//   expSeconds — absolute expiry (unix seconds, < now+24h); the caller passes a clock value
export async function buildVapidJWT({ audience, subject, privateKey, expSeconds }) {
  const header = { typ: 'JWT', alg: 'ES256' };
  const body = { aud: audience, exp: expSeconds, sub: subject };
  const signingInput = `${bytesToB64url(enc.encode(JSON.stringify(header)))}.${bytesToB64url(enc.encode(JSON.stringify(body)))}`;

  let key = privateKey;
  if (typeof privateKey === 'string') {
    key = await subtle().importKey('pkcs8', b64urlToBytes(privateKey), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  }
  // WebCrypto ECDSA returns the IEEE P1363 (r||s) signature JWT expects — no DER unwrap needed.
  const sig = new Uint8Array(await subtle().sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(signingInput)));
  return `${signingInput}.${bytesToB64url(sig)}`;
}
