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
// The DEVELOPER's own device(s), registered via the gated /api/push/admin route. Kept separate
// from family `push:` subs so feedback notifications fan out ONLY to the developer, never to
// families. Feedback records are stored durably under `feedback:` (§28.A).
const ADMIN_PUSH_PREFIX = 'adminpush:';
const FEEDBACK_PREFIX = 'feedback:';
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

// POST /api/push/admin — register THIS device as a developer-admin push target (for feedback
// notifications). Gated by a shared secret header so only the developer can subscribe as admin.
// Body is the same PushSubscription JSON as /api/push/subscribe.
async function handleAdminPush(request, env) {
  const kv = env.FAMILY_SYNC;
  if (!kv) return json({ error: 'not configured' }, 503);
  if (!env.ADMIN_KEY) return json({ error: 'ADMIN_KEY secret not set' }, 503);
  if (request.headers.get('x-admin-key') !== env.ADMIN_KEY) return json({ error: 'forbidden' }, 403);

  if (request.method === 'POST') {
    const sub = await request.json().catch(() => null);
    if (!sub || !sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
      return json({ error: 'bad subscription' }, 400);
    }
    await kv.put(ADMIN_PUSH_PREFIX + (await sha256Hex(sub.endpoint)), JSON.stringify({ endpoint: sub.endpoint, keys: sub.keys }));
    return json({ ok: true });
  }
  if (request.method === 'DELETE') {
    const body = await request.json().catch(() => null);
    if (!body || !body.endpoint) return json({ error: 'missing endpoint' }, 400);
    await kv.delete(ADMIN_PUSH_PREFIX + (await sha256Hex(body.endpoint)));
    return new Response(null, { status: 204 });
  }
  return new Response('method not allowed', { status: 405 });
}

// Email one feedback record to the developer via Resend (https://resend.com). Best-effort: if no
// RESEND_API_KEY is configured it's a silent no-op (the KV record + push still happen). Resend
// needs a verified sender domain (pryzmio.com is on Cloudflare — verify it there).
async function emailFeedback(env, fb) {
  if (!env.RESEND_API_KEY) return { sent: false, reason: 'no-key' };
  const to = env.FEEDBACK_EMAIL_TO || 'ian.gornall@gmail.com';
  const from = env.FEEDBACK_EMAIL_FROM || 'Spell Caverns <feedback@spell.pryzmio.com>';
  const stars = fb.rating ? `${fb.rating}/5` : '—';
  const text =
    `New feedback from Crystal Spell Caverns\n\n` +
    `From: ${fb.nick || '(no name)'}\n` +
    `Fun rating: ${stars}\n` +
    `Difficulty: ${fb.difficulty || '—'}\n` +
    `Note: ${fb.note || '(none)'}\n` +
    `When: ${new Date(fb.ts || Date.now()).toISOString()}\n`;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from, to, subject: `🔮 Spell Caverns feedback (${stars})`, text }),
    });
    return { sent: res.ok, status: res.status };
  } catch (e) {
    return { sent: false, reason: String(e && e.message) };
  }
}

// Fan a feedback notification out to the developer's admin device(s). No-op until VAPID + an
// admin subscription exist. Prunes expired subscriptions.
async function pushFeedbackToAdmin(env, fb, nowSec) {
  const kv = env.FAMILY_SYNC;
  if (!kv || !env.VAPID_PRIVATE) return;
  const payload = JSON.stringify({
    title: '🔮 New feedback',
    body: `${fb.nick || 'A player'}: ${fb.note ? fb.note.slice(0, 80) : `rated ${fb.rating || '—'}/5`}`,
    url: '/',
    tag: 'feedback',
  });
  let cursor;
  do {
    const page = await kv.list({ prefix: ADMIN_PUSH_PREFIX, cursor });
    cursor = page.list_complete ? undefined : page.cursor;
    for (const { name } of page.keys) {
      const sub = await kv.get(name, { type: 'json' });
      if (!sub) continue;
      try {
        const status = await sendPush(sub, payload, env, nowSec);
        if (status === 404 || status === 410) await kv.delete(name);
      } catch {
        /* transient — leave it */
      }
    }
  } while (cursor);
}

// POST /api/feedback — receive a kid's in-app feedback and deliver it to the developer (§28.A):
//   1. store it DURABLY in KV under `feedback:<ts>-<id>` (the long-term record),
//   2. notify the developer's device IMMEDIATELY via Web Push (admin subs), and
//   3. email it (Resend), so it lands in an inbox without checking the device.
// Pseudonymous only (nickname, never a real name — COPPA, see PRIVACY.md). GET (gated by
// x-admin-key) lists recent feedback so the developer can read it back.
async function handleFeedback(request, env, nowSec) {
  const kv = env.FAMILY_SYNC;
  if (!kv) return json({ error: 'not configured' }, 503);

  if (request.method === 'GET') {
    if (!env.ADMIN_KEY || request.headers.get('x-admin-key') !== env.ADMIN_KEY) {
      return json({ error: 'forbidden' }, 403);
    }
    const out = [];
    let cursor;
    do {
      const page = await kv.list({ prefix: FEEDBACK_PREFIX, cursor });
      cursor = page.list_complete ? undefined : page.cursor;
      for (const { name } of page.keys) {
        const rec = await kv.get(name, { type: 'json' });
        if (rec) out.push(rec);
      }
    } while (cursor);
    out.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    return json(out);
  }

  if (request.method === 'POST') {
    const body = await request.json().catch(() => null);
    if (!body || (body.rating == null && !body.difficulty && !body.note)) {
      return json({ error: 'empty feedback' }, 400);
    }
    // Keep it small + pseudonymous. Clamp the free text so KV stays tidy.
    const fb = {
      ts: Number(body.ts) || nowSec * 1000,
      rating: body.rating != null ? Number(body.rating) : null,
      difficulty: typeof body.difficulty === 'string' ? body.difficulty.slice(0, 24) : '',
      note: typeof body.note === 'string' ? body.note.slice(0, 600) : '',
      nick: typeof body.nick === 'string' ? body.nick.slice(0, 40) : '',
    };
    const key = `${FEEDBACK_PREFIX}${fb.ts}-${crypto.randomUUID().slice(0, 8)}`;
    await kv.put(key, JSON.stringify(fb)); // durable record (no TTL — keep long term)
    // Notify out-of-band; don't let a slow email/push hold up the kid's response.
    await Promise.allSettled([pushFeedbackToAdmin(env, fb, nowSec), emailFeedback(env, fb)]);
    return json({ ok: true });
  }
  return new Response('method not allowed', { status: 405 });
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
    if (url.pathname === '/api/push/admin') return handleAdminPush(request, env);
    if (url.pathname === '/api/push/test') return handlePushTest(request, env, Math.floor(Date.now() / 1000));
    if (url.pathname === '/api/feedback') return handleFeedback(request, env, Math.floor(Date.now() / 1000));
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
