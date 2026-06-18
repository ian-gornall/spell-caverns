# 💎 Crystal Spell Caverns

A gamified spelling adventure for an iPad. The learner descends a glowing crystal
cavern, **mining gems by spelling the words they hear** — with spoken, DDR-style
encouragement that gets more excited the faster and more accurately they answer.
Content spans **ages 5–13** (2,919 frequency-ordered words), and the game adapts to
each learner automatically: it serves the most useful words first, groups
similarly-spelled words to build memory through productive struggle, and never
teaches spelling "rules" explicitly.

Built as an **installable, offline-capable web app (PWA)** — no app store, no build
step, runs in iPad Safari.

---

## Quick start (on the iPad)

1. On the computer (same Wi-Fi as the iPad):

   ```
   npm start
   ```

   It prints a LAN URL, e.g. `http://192.168.1.20:5173`.

2. On the iPad, open that URL in **Safari**.

3. Tap **Share → Add to Home Screen**. Launch it from the home-screen icon for a
   full-screen, app-like experience.

> Tip: the **first tap anywhere** unlocks audio (iOS requires a user gesture before
> a web page can speak), so the very first dictation plays right after the learner
> starts playing.

---

## The game

| Mode | What it is |
|---|---|
| ⛏️ **Play** (rhythm) | The core fast loop. Hear a word, see its sentence with the word blanked, **tap the correct spelling** from the tiles before the gem meter runs down. Speed + combos = bigger gem hauls and louder praise. This is *recognition*. |
| 🔨 **Craft** (puzzle) | The *production / recall* counterweight. Hear a word and **build it** from scrambled crystal letters (tap or drag). Gentle: keep the letters that fit, 💡 hint always available. |
| 🔧 **Repair** (cracked crystals) | Appears once the learner has *missed* words. Re-spells exactly those words in **production** form (recall, not multiple choice) until they're reliably correct again — the strongest path to real, unaided spelling. |
| 🔮 **Crystal Lab** | Creativity. The lab invents a **brand-new nonsense word** in a pattern the learner has been practising, they spell it, then **draw its made-up meaning** on a canvas and name it. Saved to the **Specimen Collection**. |
| 💠 **Catalog** | A collection of **24 real minerals** (quartz, amethyst, emerald, opal, diamond…). **Spend mined gems** to unlock them — a real use for the gems, with each crystal's price shown up front (no randomised loot, no timers, no money). Reaching a new depth also gifts one **free**. Educational + endowed-progress motivation. |
| 🗺️ **Progress** | The same view for kid and grown-up: gems, cavern depth, mastery spectrum, **daily quests**, **personal bests**, the **tricky words** still to repair, recent-days accuracy, the mineral catalog, and the specimen collection. |
| ⚙️ **Settings** | The two kid levers — **difficulty** (harder levels *unlock* with mastery, never forced) and **session length** — plus voice, volume, name, **crystal colour**, **Easy-read text**, and data export/import/reset. |
| 💬 **Feedback** | A built-in rating + note so the learner (or parent) can tell us what to change; data can be exported as a JSON file. |

On the **first run**, a friendly crystal guide (**Geo**) welcomes the learner, asks
their name + a crystal colour, then drops them into a short, easy **guaranteed-win
first wave**. Breaking through to a **new cavern depth** triggers a celebratory
**Geode Boss** — tap to crack open a giant geode and reveal a new mineral.

Difficulty and word selection are the **program's** job — the kid never picks
individual words. Harder difficulties **unlock** as words are mastered.

---

## How it adapts (the short version)

- **Continuous mastery, not pass/fail.** Each word has a recency- and speed-weighted
  mastery score plus a confidence that grows with attempts. "Mastered / Learning /
  Tricky" are only *display* buckets.
- **Difficulty is observed, not assumed.** A word's tier is just a starting guess;
  the learner's actual responses take over as confidence builds.
- **Blocked → interleaved.** Sessions open with a shuffled review, then group new
  words by spelling pattern and mix in confusable families as difficulty rises.
- **Missed words come back, in production form.** A wrong answer "cracks" a crystal;
  it resurfaces in the 🔧 Repair (build-the-word) flow until re-mastered — and the
  rhythm loop always ends a card on the *correct* spelling so misspellings don't stick.
- **Guilt-free momentum.** A daily streak ("glowing vein", with free freezes), a tiny
  daily gem goal, and 3 rotating daily quests keep it inviting — never punitive.
- **Built for a weak speller.** An optional "Easy-read text" mode spaces the letters so
  similar spellings are easier to tell apart, and a "Hear it again" replay is always one
  tap away. Reduced-motion is fully respected.

The full design rationale lives in **`HANDOFF.md`** (§4 especially) — read that before
changing learning behaviour.

---

## Voice / audio

- Dictation and praise prefer **pre-generated neural-TTS clips** (Gemini "Kore"
  voice) under `audio/`, and fall back to the **device's built-in speech** for any
  word that doesn't have a clip yet. So it always has a voice.
- Generating the full clip set is gated by the Gemini free-tier daily cap; it's
  **parked** for now (the device voice covers everything in the meantime). See
  `HANDOFF.md` §12 for the generation plan (`npm run gen:audio`) and status.

---

## Develop / test

```
npm test            # the pure decision engine (Node's test runner) — 149 tests
npm start           # serve the app for the iPad / a browser
node scripts/smoke.mjs   # Playwright UI smoke test of every mode (server must be up)
```

- **Logic vs UI split:** all decision logic is in pure, browser-free modules under
  `src/engine/` and is covered by `npm test`. The DOM/audio/canvas code is verified
  in a real browser by the Playwright smoke test (`npm run smoke`).
- **Rebuild the word dataset:** `node scripts/merge.mjs` (never hand-edit
  `data/words.js`).
- **Regenerate the app icons:** `node scripts/gen_icons.mjs` (after editing
  `icons/icon.svg`).

---

## Offline (PWA)

Once installed, the app caches its shell + word data and **works offline**.

⚠️ Service workers only run in a **secure context** — HTTPS or `localhost`. Over a
plain `http://` LAN address the app still installs and runs (online), but the
offline cache won't activate. For true offline on the iPad, serve over HTTPS (e.g. a
local cert or a tunnel like `cloudflared`/`ngrok`).

---

## Deploy it as a "real app on the iPad" (HTTPS hosting)

The best experience — a permanent home-screen icon that opens full-screen, works
offline, and is reachable from any device — comes from hosting the (static, no-build)
site at a **stable HTTPS URL**, then adding it to the home screen once.

**Easiest (recommended): Netlify or Cloudflare Pages — zero config, free, root URL.**

- **Netlify** — drag the project folder onto <https://app.netlify.com/drop>, or
  "import an existing project" from this repo. A `netlify.toml` is included (no build,
  publish the root). You get `https://<your-name>.netlify.app`.
- **Cloudflare Pages / Vercel** — connect the repo; build command **none**, output
  directory **`/`** (the repo root). Also a root HTTPS URL, no config needed.

Then on the iPad open that HTTPS URL in Safari → **Share → Add to Home Screen**. The
icon, splash, portrait orientation, and full-screen (no Safari chrome) are already
configured in `manifest.webmanifest` + the `apple-mobile-web-app-*` meta, and offline
caching now works because it's HTTPS.

> **Serve at a domain ROOT.** The app uses root-absolute paths (`/src/…`, `/sw.js`,
> `/manifest.webmanifest`). A root URL (a `*.netlify.app`/`*.pages.dev` subdomain, a
> custom domain, or a GitHub **user/org** page `username.github.io`) works as-is. A
> GitHub **project** page (`username.github.io/repo/`) serves under a subpath and would
> 404 those paths — prefer the zero-config root hosts above.

### Re-engagement ("it's been a while" nudge)

- **Shipping now (no backend):** an in-app **welcome-back** moment — open the app after
  a day or more away and the home screen greets the learner by name with how long it's
  been, streak-aware and never guilt-trippy (driven by `streak.lastPlayedDate`).
- **A true push notification** ("come back!" while the app is closed) is possible on
  iOS **only for an installed PWA on iOS 16.4+**, and needs a **push service → a small
  backend / serverless function**, which breaks the app's current no-backend design.
  Options if you want it later: a minimal serverless push endpoint, or a managed
  service like **OneSignal**. **This is a product decision** — left out for now; the
  in-app welcome-back covers the common case without any server. (See `HANDOFF.md`
  §17.A.)

---

## Project layout

```
index.html · styles.css · manifest.webmanifest · sw.js · server.js
icons/                     app icons (SVG source + generated PNGs)
data/                      the 2,919-word dataset + build inputs
src/engine/                PURE decision logic (tested with node --test):
                           lexicon · distractors · praise · assessment · progress ·
                           session · nonsense · puzzle · streak · quests · catalog · narrative
src/modes/                 rhythm · puzzle · lab
src/screens/               home · onboarding · progress · settings · feedback · catalog · boss
src/{app,ui,state,audio}.js  bootstrap, DOM toolkit/router, storage, sound
scripts/                   merge · build_backbone · gen_audio · gen_icons · smoke · qa*
HANDOFF.md                 full design + decisions + status (read this to continue)
```

Progress, gems, settings, feedback, and specimens are stored in `localStorage` on
the device. Export from Settings or Feedback to move it to a file.
