// src/feedback_client.js — best-effort delivery of in-app feedback to the developer (§28.A).
//
// Feedback is always stored on-device first (state.addFeedback). This module POSTs it to the
// Worker (/api/feedback) which stores it durably + notifies the developer (push + email). It is
// defensive: any failure (offline, server down) just leaves the entry marked unsent so the next
// app open retries it — the kid is never blocked and no feedback is ever lost. UI-side module
// (uses fetch), never imported by `node --test`.
const ENDPOINT = '/api/feedback';

// POST one feedback entry. Returns true only on a 2xx; false on any failure (caller keeps it
// queued). Sends only the pseudonymous fields the Worker expects.
export async function postFeedback(entry) {
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ts: entry.ts,
        rating: entry.rating,
        difficulty: entry.difficulty,
        note: entry.note,
        nick: entry.nick,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Flush any feedback that hasn't reached the developer yet (e.g. submitted while offline).
// Called on app open. Marks each entry sent as it succeeds; stops trying on the first failure
// (likely still offline) so we don't hammer the network.
export async function flushUnsent(store) {
  try {
    const pending = store.unsentFeedback ? store.unsentFeedback() : [];
    for (const f of pending) {
      const ok = await postFeedback(f);
      if (!ok) break;
      store.markFeedbackSent(f.ts);
    }
  } catch {
    /* ignore — try again next open */
  }
}
