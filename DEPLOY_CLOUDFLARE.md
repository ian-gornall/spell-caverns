# Deploying on Cloudflare (Workers + Static Assets)

We moved hosting off Netlify (free-tier **build credits ran out** mid-deploy) to Cloudflare.
Cloudflare's "Connect to Git" now provisions a **Worker** (and runs `wrangler deploy`), so this
is set up as a **Worker with Static Assets**: the Worker (`worker.js`) serves the static PWA
(from `deploy/`) and handles the one dynamic route, `/api/sync` (the KV-backed family-sync
backend). Config is in `wrangler.toml`.

## 1. Connect the repo (Git CD)

Cloudflare dashboard → **Workers & Pages → Create → Workers → Connect to Git** (or "Import a
repository") → pick `ian-gornall/spell-caverns`, branch `main`. Build settings:

| Setting | Value |
|---|---|
| Build command | `node scripts/build_deploy.mjs` |
| Deploy command | `npx wrangler deploy` (the default) |

`wrangler.toml` does the rest — `main = worker.js`, and `[assets] directory = "./deploy"` uploads
the built site. Save & deploy. Every push to `main` auto-builds. You get a `*.workers.dev` URL;
add a custom domain later if you want.

The project is **dependency-free** (`package.json` has no deps; `package-lock.json` is minimal),
so Cloudflare's `npm ci` installs nothing and can't drift. (Local-only tools install without
touching the repo: `npm i --no-save playwright` for smoke/QA, `npm i --no-save @breezystack/lamejs`
for audio gen.)

## 2. Turn on family sync (KV) — optional, only if you use cross-device sync

The site works without this; `/api/sync` returns 503 and the app runs on-device (sync is
best-effort). To enable it:

1. Create a KV namespace: `npx wrangler kv namespace create FAMILY_SYNC` (prints an `id`), or
   dashboard → Storage & Databases → **KV → Create**.
2. In `wrangler.toml`, uncomment the `[[kv_namespaces]]` block and paste the `id`; commit.
   (For Git-deployed Workers, bindings come from `wrangler.toml` — not the dashboard.)
3. Push → the next deploy has KV bound.

Verify: `curl https://<your-worker>.workers.dev/api/sync?code=TEST1234` → `null` (not 503).

## 3. Verifying a deploy

- `curl https://<site>/sw.js | grep VERSION` and `curl https://<site>/src/version.js` →
  both should show the latest `csc-vNN` (and match — keep `sw.js` VERSION == `src/version.js`).
- `sw.js` should return `Cache-Control: no-cache` (the `_headers` rule).

## Local testing (how the Worker was verified before shipping)

```bash
node scripts/build_deploy.mjs
npx wrangler dev --port 8788 --local      # serves deploy/ via ASSETS + runs worker.js
# GET /  /sw.js  /src/version.js  and  GET/PUT/DELETE /api/sync?code=TEST1234
# (to exercise KV locally, temporarily add a [[kv_namespaces]] block with any id)
```

## Notes / fallback

- Model: **Worker + Static Assets** (`worker.js` + `wrangler.toml` `[assets]`). `_headers` in
  `deploy/` sets cache rules. The old Netlify config (`netlify.toml`, `netlify/functions/`) is
  kept as a fallback (Cloudflare ignores it); reviving it needs `npm i @netlify/blobs`.
- KV is eventually consistent (~global propagation <60s) — fine for low-frequency family sync.
- Free tier (plenty here): KV 100k reads / 1k writes per day; Workers 100k requests/day;
  static asset requests are free/unmetered.
