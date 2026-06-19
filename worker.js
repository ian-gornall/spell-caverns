// worker.js — Cloudflare Worker entry (Workers Static Assets model).
//
// Serves the static PWA from the uploaded assets (deploy/, via the ASSETS binding) and
// handles the one dynamic route, /api/sync — the family-sync backend (same never-lose-
// progress merge as before, engine/cloudsync.reconcile; storage = Cloudflare KV).
//
// Why a Worker and not Pages: Cloudflare's "Connect to Git" now provisions a Worker and runs
// `wrangler deploy`, so we use the Worker + Static Assets model (config in wrangler.toml).
// Static assets are served first; the Worker only runs for paths with no matching asset
// (so /api/sync reaches handleSync; /, /sw.js, /src/*.js, etc. are served as files).
//
// KV: bind a namespace as FAMILY_SYNC (see wrangler.toml / DEPLOY_CLOUDFLARE.md). Until it's
// bound, /api/sync returns 503 and the app runs on-device (client sync is best-effort).
import { reconcile, isValidSyncCode, normalizeSyncCode } from './src/engine/cloudsync.js';
import { encryptPayload, buildVapidJWT } from './src/engine/webpush.js';
import { VAPID_PUBLIC } from './src/engine/pushconfig.js';

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });

// Subscriptions live in the SAME KV namespace as family sync, namespaced by a "push:" prefix
// (a sync code is a bare 8-char string, so there's no collision and no extra binding to set up).
const PUSH_PREFIX = 'push:';
const DEFAULT_SUBJECT = 'mailto:ian.gornall@gmail.com'; // VAPID contact; override with env.VAPID_SUBJECT

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Send one Web Push to a stored subscription. Returns the HTTP status (404/410 => expired,
// caller should forget it). Builds the VAPID auth + RFC 8291 encrypted body via engine/webpush.
async function sendPush(sub, payload, env, nowSec) {
  const url = new URL(sub.endpoint);
  const body = await encryptPayload({
    uaPublicB64url: sub.keys.p256dh,
    authSecretB64url: sub.keys.auth,
    payload,
  });
  const jwt = await buildVapidJWT({
    audience: `${url.protocol}//${url.host}`,
    subject: env.VAPID_SUBJECT || DEFAULT_SUBJECT,
    privateKey: env.VAPID_PRIVATE, // pkcs8 base64url, set via `wrangler secret put VAPID_PRIVATE`
    expSeconds: nowSec + 12 * 3600,
  });
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `vapid t=${jwt}, k=${VAPID_PUBLIC}`,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '86400',
    },
    body,
  });
  return res.status;
}

async function handlePush(request, env) {
  const kv = env.FAMILY_SYNC;
  if (!kv) return json({ error: 'push not configured (bind the FAMILY_SYNC KV namespace)' }, 503);

  if (request.method === 'POST') {
    const sub = await request.json().catch(() => null);
    if (!sub || !sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
      return json({ error: 'bad subscription' }, 400);
    }
    const key = PUSH_PREFIX + (await sha256Hex(sub.endpoint));
    await kv.put(key, JSON.stringify({ endpoint: sub.endpoint, keys: sub.keys }));
    return json({ ok: true });
  }
  if (request.method === 'DELETE') {
    const body = await request.json().catch(() => null);
    if (!body || !body.endpoint) return json({ error: 'missing endpoint' }, 400);
    await kv.delete(PUSH_PREFIX + (await sha256Hex(body.endpoint)));
    return new Response(null, { status: 204 });
  }
  return new Response('method not allowed', { status: 405 });
}

// POST /api/push/test — send a single reminder to the posted subscription RIGHT NOW, so a
// grown-up can confirm notifications arrive on a real device without waiting for the cron.
async function handlePushTest(request, env, nowSec) {
  if (request.method !== 'POST') return new Response('method not allowed', { status: 405 });
  if (!env.VAPID_PRIVATE) return json({ error: 'VAPID_PRIVATE secret not set' }, 503);
  const sub = await request.json().catch(() => null);
  if (!sub || !sub.endpoint || !sub.keys) return json({ error: 'bad subscription' }, 400);
  const payload = JSON.stringify({
    title: 'Crystal Spell Caverns',
    body: 'Test reminder — notifications are working! 💎',
    url: '/',
  });
  try {
    const status = await sendPush(sub, payload, env, nowSec);
    return json({ ok: status >= 200 && status < 300, status });
  } catch (e) {
    return json({ error: 'send failed', detail: String(e && e.message) }, 500);
  }
}

async function handleSync(request, env) {
  const kv = env.FAMILY_SYNC; // KV namespace binding
  const url = new URL(request.url);
  const code = normalizeSyncCode(url.searchParams.get('code'));

  if (!isValidSyncCode(code)) return json({ error: 'invalid sync code' }, 400);
  if (!kv) return json({ error: 'sync not configured (bind the FAMILY_SYNC KV namespace)' }, 503);

  try {
    if (request.method === 'GET') {
      const data = await kv.get(code, { type: 'json' });
      return json(data || null);
    }
    if (request.method === 'PUT' || request.method === 'POST') {
      const incoming = await request.json().catch(() => null);
      if (!incoming || !incoming.data) return json({ error: 'bad backup' }, 400);
      const existing = await kv.get(code, { type: 'json' });
      // Merge: the more-advanced/newer envelope wins (same rule the client uses).
      const { use } = reconcile(incoming, existing);
      const winner = use || incoming;
      await kv.put(code, JSON.stringify(winner));
      return json(winner); // client adopts this if the server was ahead
    }
    if (request.method === 'DELETE') {
      await kv.delete(code);
      return new Response(null, { status: 204 });
    }
    return new Response('method not allowed', { status: 405 });
  } catch (e) {
    return json({ error: 'sync failed' }, 500);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/sync') return handleSync(request, env);
    if (url.pathname === '/api/push/subscribe') return handlePush(request, env);
    if (url.pathname === '/api/push/test') return handlePushTest(request, env, Math.floor(Date.now() / 1000));
    // Everything else: serve the static asset (deploy/). With assets-first routing the Worker
    // usually isn't even invoked for assets; this fallback covers any non-asset path.
    return env.ASSETS.fetch(request);
  },

  // Daily reminder. Cloudflare Cron Trigger (see wrangler.toml [triggers]) invokes this; it
  // fans out a "your geode is ready" push to every stored subscription, pruning any the push
  // service reports as gone (404/410). No-op (logs) until VAPID_PRIVATE is set.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(sendDailyReminders(env, Math.floor(Date.now() / 1000)));
  },
};

async function sendDailyReminders(env, nowSec) {
  const kv = env.FAMILY_SYNC;
  if (!kv || !env.VAPID_PRIVATE) return; // not configured yet — nothing to do
  const payload = JSON.stringify({
    title: 'Your geode is ready 💎',
    body: 'Come open today’s crystal and keep your streak going!',
    url: '/',
    tag: 'daily-geode',
  });
  let cursor;
  do {
    const page = await kv.list({ prefix: PUSH_PREFIX, cursor });
    cursor = page.list_complete ? undefined : page.cursor;
    for (const { name } of page.keys) {
      const sub = await kv.get(name, { type: 'json' });
      if (!sub) continue;
      try {
        const status = await sendPush(sub, payload, env, nowSec);
        if (status === 404 || status === 410) await kv.delete(name); // subscription expired
      } catch {
        /* transient send error — leave the subscription, retry next day */
      }
    }
  } while (cursor);
}
