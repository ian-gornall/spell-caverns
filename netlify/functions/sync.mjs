// netlify/functions/sync.mjs — the family-sync backend (Netlify Function v2).
//
// A tiny, opaque-code-keyed store for cross-device progress sync. The parent creates a
// family sync CODE once; each device sends that code with its backup envelope. We store
// ONE envelope per code in Netlify Blobs and merge with the tested, never-lose-progress
// reconcile rule, so devices converge without OAuth or accounts.
//
// COPPA posture (we ARE an operator here — see PRIVACY.md): we store only PSEUDONYMOUS
// gameplay data (a nickname + stats — no real name, no email), keyed by an opaque code
// the parent controls and can delete (DELETE below). HTTPS only; no third-party sharing.
import { getStore } from '@netlify/blobs';
import { reconcile, isValidSyncCode, normalizeSyncCode } from '../../src/engine/cloudsync.js';

export default async (req) => {
  const url = new URL(req.url);
  const code = normalizeSyncCode(url.searchParams.get('code'));
  if (!isValidSyncCode(code)) {
    return new Response(JSON.stringify({ error: 'invalid sync code' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }
  const store = getStore('family-sync');

  try {
    if (req.method === 'GET') {
      const data = await store.get(code, { type: 'json' });
      return Response.json(data || null);
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      const incoming = await req.json().catch(() => null);
      if (!incoming || !incoming.data) {
        return new Response(JSON.stringify({ error: 'bad backup' }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        });
      }
      const existing = await store.get(code, { type: 'json' });
      // Merge: the more-advanced/newer envelope wins (same rule the client uses).
      const { use } = reconcile(incoming, existing);
      const winner = use || incoming;
      await store.setJSON(code, winner);
      return Response.json(winner); // client adopts this if the server was ahead
    }

    if (req.method === 'DELETE') {
      await store.delete(code);
      return new Response(null, { status: 204 });
    }

    return new Response('method not allowed', { status: 405 });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'sync failed' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
};

// Serve at /api/sync (Netlify Functions v2 routing — no redirect needed).
export const config = { path: '/api/sync' };
