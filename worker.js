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

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });

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
    // Everything else: serve the static asset (deploy/). With assets-first routing the Worker
    // usually isn't even invoked for assets; this fallback covers any non-asset path.
    return env.ASSETS.fetch(request);
  },
};
