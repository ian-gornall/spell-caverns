# Family sync — set up cross-device progress sync

Crystal Spell Caverns syncs a child's progress across devices with a simple **family
code** — no Google sign-in, no OAuth, no accounts. The parent creates a code once and
types it on each device once. Progress then flows through a tiny serverless function
(Netlify Function + Netlify Blobs) that we run.

> Privacy: the cloud stores only **pseudonymous gameplay data** (the nickname + scores)
> keyed by your opaque family code — no real name, no email. You can delete it any time
> (Settings → Delete cloud data). See `PRIVACY.md`.

There are two parts: **(A)** deploy the backend once, then **(B)** turn on sync per device
(the easy part).

---

## A. Deploy the backend (one-time, ~10 min)

The family-sync **function** only ships when Netlify builds the site from your repo (a
plain drag-and-drop deploy can't bundle a function). So connect the site to GitHub:

1. **Put the project on GitHub.** Create a new (private is fine) empty repo at
   <https://github.com/new>, then from `C:\Users\iango\spell`:
   ```
   git remote add origin https://github.com/<you>/spell.git
   git push -u origin main
   ```
2. **Connect it to your existing Netlify site** (`spell-caverns`):
   - Netlify → your site → **Site configuration → Build & deploy → Link repository** →
     pick the GitHub repo.
   - Netlify reads `netlify.toml` automatically: build command `node scripts/build_deploy.mjs`,
     publish `deploy`, functions in `netlify/functions`. Leave those as detected.
   - **Deploy.** When it finishes, the function is live at
     `https://spell-caverns.netlify.app/api/sync`.
3. **Verify the function** — open `https://spell-caverns.netlify.app/api/sync?code=TESTCODE`
   in a browser. You should get `null` (not a 404). That means it's deployed and Netlify
   Blobs is working. (Blobs needs no setup — it's automatic for sites with functions.)

> Alternative without GitHub: install the Netlify CLI (`npm i -g netlify-cli`),
> `netlify login`, `netlify link` (to the spell-caverns site), then
> `netlify deploy --build --prod`. Same result; just no auto-redeploy on future changes.

From now on, every `git push` auto-redeploys (the service worker picks up the new version
on the next visit).

## B. Turn on sync (per device, ~20 sec each — no OAuth)

1. On the **first** device: **Settings → Parents & privacy → Family sync** → tick the
   **parent-consent** box → tap **✨ Create a family code**. It shows a short code
   (e.g. `K7QF2M9P`) and immediately syncs this device up.
2. On **each other** device: same screen → tick consent → type that **same code** into
   "Enter a family code" → **Use this code**. It pulls the shared progress down.
3. Done. After that it's automatic: each device **pulls** the latest when the app opens
   and **pushes** when you switch away / lock it. There's also a manual **🔄 Sync now**.

## Notes

- **Conflicts never lose progress:** if two devices differ, the one with more learning
  history wins (ties broken by which synced more recently). The only lossy case is two
  devices playing *heavily offline at the same time* — rare for one learner, and the
  manual file backup (same screen) is the safety net.
- **Delete cloud data** (Settings) wipes the family's stored copy; devices keep their
  local data. **Stop syncing on this device** just unlinks this device.
- The code is the only key — anyone with it can read/write that family's progress, so keep
  it to yourself (it's 8 random characters, not guessable, but not a password).
