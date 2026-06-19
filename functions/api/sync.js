// functions/api/sync.js — Cloudflare Pages Function: the family-sync backend.
//
// Cloudflare port of netlify/functions/sync.mjs. Same contract and same never-lose-progress
// merge (engine/cloudsync.reconcile) — only the storage swaps: Netlify Blobs → Cloudflare KV.
// Pages routes this file to **/api/sync** automatically (functions/api/sync.js → /api/sync).
//
// Setup: create a KV namespace and bind it as `FAMILY_SYNC` (Pages → Settings → Functions →
// KV namespace bindings, for BOTH Production and Preview). Until it's bound, sync returns 503
// and the app simply runs on-device (the client treats sync as best-effort).
//
// COPPA posture (we ARE an operator here — see PRIVACY.md): only PSEUDONYMOUS gameplay data
// (a nickname + stats — no real name/email), keyed by an opaque code the parent controls and
// can delete (DELETE). HTTPS only; no third-party sharing.
import { reconcile, isValidSyncCode, normalizeSyncCode } from '../../src/engine/cloudsync.js';

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });

export async function onRequest(context) {
  const { request, env } = context;
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
