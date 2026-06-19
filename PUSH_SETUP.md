# Daily-reminder Web Push — setup & verification

A gentle once-a-day "your geode is ready 💎" notification. Opt-in, off by default, set by a
grown-up in **Settings → Sound → Daily reminder**. The code is all in the repo; two steps below
need your Cloudflare account (they can't be automated from here), then it's live.

## What's already built (in the repo)

| Piece | File |
|---|---|
| Push payload encryption (RFC 8291 `aes128gcm`) + VAPID JWT (RFC 8292) | `src/engine/webpush.js` |
| Crypto proof — RFC 8291 Appendix A byte-vector + round-trip + JWT verify | `test/webpush.test.js` (in `npm test`) |
| Public VAPID key (shared by client + Worker) | `src/engine/pushconfig.js` |
| Client opt-in (permission → subscribe → register) + test-send | `src/push.js` |
| Settings toggle "Daily reminder" + "Send a test" | `src/screens/settings.js` |
| Service-worker `push` + `notificationclick` handlers | `sw.js` |
| Worker routes `/api/push/subscribe`, `/api/push/test` + daily `scheduled()` sender | `worker.js` |
| Daily cron `0 16 * * *` (16:00 UTC ≈ after-school UK) | `wrangler.toml` |

Subscriptions are stored in the **existing** `FAMILY_SYNC` KV namespace under a `push:` key
prefix — no new binding to create. Cron Triggers work on the **free** Workers plan.

## The VAPID keypair

- **Public** key is committed in `src/engine/pushconfig.js` (safe to publish).
- **Private** key is in your git-ignored `.env` as `VAPID_PRIVATE=` (pkcs8, base64url). It is
  **never** committed. You set it as a Worker secret (below).

## Two steps you need to run (account-gated)

```bash
# 1. Authenticate wrangler to your Cloudflare account (once).
wrangler login

# 2. Set the VAPID private key as a Worker secret. Paste the value of VAPID_PRIVATE
#    from your local .env when prompted.
wrangler secret put VAPID_PRIVATE
#    (optional — override the VAPID contact address; defaults to mailto:ian.gornall@gmail.com)
# wrangler secret put VAPID_SUBJECT
```

Then deploy as usual — **push to `main`** (Git-CD runs `node scripts/build_deploy.mjs` +
`npx wrangler deploy`, which picks up the new `[triggers]` cron), or run `npx wrangler deploy`
locally. Until the secret is set, `scheduled()` is a safe no-op (no errors, just no sends).

## Verify on a real device (can't be done headless)

1. Open the **installed PWA** (Add to Home Screen). iOS needs **16.4+** and the installed app —
   push does not work in a plain iOS Safari tab.
2. Settings → Sound → **Daily reminder → On** → allow notifications.
3. Tap **🔔 Send a test** → a notification should arrive within a few seconds. Tapping it opens
   the app.
4. The real daily nudge fires at 16:00 UTC via the cron trigger.

## Notes

- Expired subscriptions (push service returns 404/410) are pruned automatically on the next
  daily run.
- To change the time, edit `crons` in `wrangler.toml`. To change the copy, edit the payload in
  `worker.js` `sendDailyReminders()`.
- To rotate the push identity: regenerate a P-256 keypair, replace `VAPID_PUBLIC` in
  `pushconfig.js` and the `VAPID_PRIVATE` secret. (Existing subscriptions are invalidated.)
