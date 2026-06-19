# Feedback delivery — developer setup (§28.A)

In-app feedback (the kid's Feedback screen) is now **delivered to the developer**, not just left
on the device. Each submission is:

1. **Stored durably** in the `FAMILY_SYNC` KV namespace under a `feedback:<ts>-<id>` key
   (long-term; no TTL). This always works once KV is bound — no extra setup.
2. **Web-push notified** to the developer's registered admin device(s) — needs the VAPID secret
   (already used for daily reminders) **and** an admin push subscription (step C below).
3. **Emailed** to the developer via [Resend](https://resend.com) — needs `RESEND_API_KEY`
   (step B below).

The client always stores feedback locally first and POSTs best-effort; if offline, it retries on
the next app open, so nothing is lost. Everything is **pseudonymous** (nickname only — see
`PRIVACY.md`).

## Endpoints (in `worker.js`)

- `POST /api/feedback` — public; stores + notifies + emails one feedback record.
- `GET  /api/feedback` — gated by `x-admin-key`; returns all stored feedback (newest first).
- `POST /api/push/admin` — gated by `x-admin-key`; registers the posting device as an admin
  push target. `DELETE` to remove it.

## Secrets to set (all via `npx wrangler secret put NAME`)

| Secret | Needed for | Notes |
|---|---|---|
| `ADMIN_KEY` | gating `GET /api/feedback` + `/api/push/admin` | any long random string you keep private |
| `RESEND_API_KEY` | the **email** channel | from resend.com; without it, email is silently skipped |
| `VAPID_PRIVATE` | the **push** channel | already set for daily reminders (see `PUSH_SETUP.md`) |

Optional overrides (also `wrangler secret put`, or plain `[vars]` in `wrangler.toml`):

- `FEEDBACK_EMAIL_TO` — default `ian.gornall@gmail.com`
- `FEEDBACK_EMAIL_FROM` — default `Spell Caverns <feedback@spell.pryzmio.com>`

### A. KV (already done)
The `FAMILY_SYNC` KV namespace is already bound (family sync). Feedback reuses it — nothing to do.

### B. Email via Resend
1. Create a Resend account, **verify the `pryzmio.com` (or `spell.pryzmio.com`) sending domain**
   (Resend gives you DNS records → add them in Cloudflare DNS).
2. Create an API key, then `npx wrangler secret put RESEND_API_KEY` (paste the key).
3. (Optional) `npx wrangler secret put FEEDBACK_EMAIL_FROM` to use a verified from-address.

Without `RESEND_API_KEY` the email channel is a no-op — KV + push still work.

### C. Web push to your own device
1. `npx wrangler secret put ADMIN_KEY` (choose a private random string).
2. On your **installed PWA** (iOS 16.4+ Home-Screen app, or desktop), turn on
   **Settings → Daily reminder** so the device has a push subscription.
3. Register that subscription as **admin** — open the PWA's dev console and run (substitute your
   `ADMIN_KEY`):
   ```js
   navigator.serviceWorker.ready
     .then(r => r.pushManager.getSubscription())
     .then(s => fetch('/api/push/admin', {
       method: 'POST',
       headers: { 'content-type': 'application/json', 'x-admin-key': 'YOUR_ADMIN_KEY' },
       body: JSON.stringify(s),
     }))
     .then(r => r.json()).then(console.log);
   ```
   A `{ ok: true }` means your device will now get a push the moment any feedback is submitted.

## Reading feedback back

```sh
curl -H "x-admin-key: YOUR_ADMIN_KEY" https://spell.pryzmio.com/api/feedback
```
or list the keys directly: `npx wrangler kv key list --binding FAMILY_SYNC --prefix feedback:`
