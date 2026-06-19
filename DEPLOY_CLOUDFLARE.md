# Deploying on Cloudflare Pages

We moved hosting off Netlify (free-tier **build credits ran out** mid-deploy) to **Cloudflare
Pages**. Pages' free tier doesn't meter build minutes the same way and serves static assets
unmetered — a better fit. The repo is already prepared; this is the one-time connect.

The app is a static, no-bundler PWA built by `node scripts/build_deploy.mjs` → `deploy/`,
plus ONE serverless endpoint (`/api/sync`, the family-sync backend) now implemented as a
Cloudflare Pages Function in `functions/api/sync.js` (KV-backed).

## 1. Connect the repo (Git CD, like Netlify had)

Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** → pick
`ian-gornall/spell-caverns`, branch `main`. Build settings:

| Setting | Value |
|---|---|
| Framework preset | **None** |
| Build command | `node scripts/build_deploy.mjs` |
| Build output directory | `deploy` |

(`wrangler.toml` already sets `pages_build_output_dir = "deploy"`.) Save & deploy. Every push
to `main` now auto-builds — same workflow as before. You'll get a `*.pages.dev` URL; add the
custom domain later if you want.

The project is **dependency-free** (`package.json` has no deps; `package-lock.json` is minimal),
so Cloudflare's `npm ci` installs nothing and can't drift — the build is just `node
scripts/build_deploy.mjs`. (Local-only tools install without touching the repo:
`npm i --no-save playwright` for smoke/QA, `npm i --no-save @breezystack/lamejs` for audio gen.)

## 2. Turn on family sync (KV) — optional, only if you use cross-device sync

The site works without this; `/api/sync` just returns 503 and the app runs on-device (sync is
best-effort). To enable it:

1. Create a KV namespace: Storage & Databases → **KV → Create** (any name, e.g. `family-sync`).
   - or CLI: `npx wrangler kv namespace create FAMILY_SYNC`
2. Bind it to the Pages project: Pages → **Settings → Functions → KV namespace bindings** →
   add **Variable name `FAMILY_SYNC`** → your namespace, for **both Production and Preview**.
3. Redeploy (Deployments → Retry, or push any commit).

Verify: `curl https://<your-site>.pages.dev/api/sync?code=TEST1234` → `null` (not a 503).

## 3. Verifying a deploy

- `curl https://<site>/sw.js | grep VERSION` and `curl https://<site>/src/version.js` →
  both should show the latest `csc-vNN` (and match — keep `sw.js` VERSION == `src/version.js`).
- `sw.js` should return `Cache-Control: no-cache` (the `_headers` rule).

## Local testing (what was used to verify the port)

```bash
node scripts/build_deploy.mjs
npx wrangler pages dev deploy --kv FAMILY_SYNC --port 8788
# then: GET/PUT/DELETE http://127.0.0.1:8788/api/sync?code=TEST1234
```

## Notes / fallback

- `netlify.toml` + `netlify/functions/sync.mjs` are kept as a fallback host config (Cloudflare
  ignores them). The Cloudflare path uses `functions/` + `_headers` + `wrangler.toml`.
- KV is eventually consistent (~global propagation in <60s) — fine for low-frequency family sync.
- Free tier limits (plenty here): KV 100k reads / 1k writes per day; Pages 500 builds/month,
  unlimited static requests.
