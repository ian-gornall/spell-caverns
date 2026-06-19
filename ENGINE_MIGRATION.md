# Engine / Framework Migration Review — Crystal Spell Caverns

> Decision-grade review (2026-06-19). Question: should we rebuild or port the existing
> dependency-free vanilla-JS kids' spelling PWA onto an established game engine/framework
> to raise production quality with prebuilt assets, tweens, particles, scene management,
> input and audio? Author: read-only reviewer. No app source was modified.
>
> Method: (1) ran the live app at phone (390×844) and tablet (820×1180) sizes via Playwright,
> captured the game-feel surfaces (evidence in `scripts/qa/engine/*.png`); (2) read the full
> source tree (`src/engine/**`, `src/modes/**`, `src/screens/**`, `audio.js`, `ui.js`,
> `state.js`, `app.js`, `data/words.js`) and the project docs (HANDOFF, README, RESEARCH, QA);
> (3) researched each candidate engine against current official documentation and licensing
> pages (sources in the Evidence appendix).

---

## 1. Executive summary & recommendation

**Recommendation: STAY VANILLA. Do NOT migrate to a game engine. Instead spend a fraction of
the migration budget on a targeted "game-feel + asset" upgrade inside the current stack.**

The motivation for considering an engine is "more professional assets and prebuilt game logic."
That motivation is real — the app currently uses **zero art/audio asset files**: every visual is
DOM + CSS, every crystal is a procedurally-drawn SVG, every reward burst is CSS-animated `<div>`
particles, and every sound effect is a Web-Audio synth tone. So there is genuine headroom.

But a full-engine migration is the wrong instrument for that goal, for four reasons that the
research below makes concrete:

1. **The valuable IP is framework-agnostic pure JS and would survive a migration only as a
   reused module at best, or a full-language PORT at worst.** ~2,300 lines of adaptive-pedagogy
   logic across 15 `src/engine/*.js` modules (assessment, continuous mastery tracker, two-axis
   session builder, distractor/misspelling generator, DDR praise tiers, quests, catalog,
   profiles, cloudsync) plus a 2,919-word dataset, all covered by **217 unit tests**. None of
   that is "game engine" work — an engine replaces the *view/feel layer*, which is the cheap part.
2. **The app's hard constraint — an installable, offline PWA on iPad + budget phones — is exactly
   where the heavyweight engines (Godot 4, Unity) currently FAIL on iOS Safari** (active,
   unresolved audio-crash and memory-crash regressions; see §3). The current stack ships this
   constraint perfectly today (live, installable, offline, 0 console errors on both viewports).
3. **The app is logic-heavy and game-feel-light.** Its surface is menus, dictation, multiple-choice
   tiles, drag-to-build letter slots, progress bars, and short reward flashes — not physics,
   skeletal characters, or real-time action. A 2D game engine's batteries (physics, tweening,
   particle systems, scene graphs) solve problems this app mostly doesn't have. The bottleneck
   isn't a missing engine; it's the absence of commissioned art and recorded audio.
4. **Every full migration trades away the project's deliberate strengths** — no build step,
   dependency-free, git-CD straight to Cloudflare static assets, ~1.5 MB total code (mostly the
   word dataset), instant deploys — for a build pipeline, a heavier bundle, and (for non-JS engines)
   a rewrite of working, tested code.

**If a renderer is genuinely wanted later** (e.g. you decide the reward moments must have
sprite-based particle systems and skeletal-animated characters), the only sane path that
preserves the constraints is a **library, not a full engine**: **PixiJS v8** or **Phaser 4**,
both MIT, both loadable with **no build step**, both reuse the pure `src/engine/**` logic as-is.
That is a Medium effort and should be scoped to the *play surfaces only*, not the whole app. But
it is not recommended now — the cheaper "targeted upgrade" (§5, Option 0) gets ~80% of the
"more professional" benefit for ~10% of the cost and zero risk to the live product.

---

## 2. What the app actually is today

### 2a. The pure pedagogy engine (the IP — must be preserved; framework-agnostic)

`src/engine/` is ~2,287 lines of **pure JavaScript with no DOM/Audio/Canvas/network dependency**
(verified: the only `window`/`document`/`fetch` tokens in those files are comments or a parameter
named `window` in `targetWords({window})`). It runs entirely under `node --test`:

| Module | LOC | Role |
|---|---|---|
| `session.js` | 348 | Two-axis level builder (`patternSpread` × `masteryTarget`); target-word selection |
| `progress.js` | 350 | Continuous, recency+speed-weighted mastery tracker + confidence; serialize/deserialize |
| `distractors.js` | 232 | Seeded RNG, Levenshtein, child-error misspelling generator, multiple-choice builder |
| `assessment.js` | 204 | Cold-start adaptive staircase that seeds the tracker |
| `catalog.js` | 174 | Collectible-mineral roster + **procedural crystal SVG** |
| `praise.js` | 172 | DDR/Pump-It-Up speed→praise tiers, combo phrases, scoring |
| `webpush.js` `quests.js` `profiles.js` `streak.js` `cloudsync.js` `puzzle.js` `nonsense.js` `backup.js` `narrative.js` `lexicon.js` | ~780 | Daily quests, multi-profile, streaks, family-sync merge, build-grading, nonsense-word gen, backup, narrative, data access |

Plus `data/words.js` — **2,919 frequency-ordered words**, ages 5–13, 63 spelling-pattern families,
each with tier / syllables / curated child misspellings / kid-safe sentence.

**This is the product.** It is the multi-week-of-work, research-backed, fully-tested core. **An
engine migration must preserve it intact — as a hard requirement.** Because it's pure JS, the
*only* paths that keep it as-is are JS-based ones (vanilla, PixiJS, Phaser, Construct-via-modules,
GDevelop-via-bundle, Cocos-via-TS). Every non-JS engine (Godot/GDScript, Unity/C#, Defold/Lua)
forces a **language port** of this code — re-deriving and re-testing the most valuable, subtlest
part of the app, with no gameplay benefit.

### 2b. The game-feel surface (what an engine would replace)

Read against the screenshots in `scripts/qa/engine/`, the surface layer (~5,500 LOC across
`src/`, `src/screens/`, `src/modes/`) is entirely hand-built DOM + CSS + Web Audio:

- **Rendering:** plain DOM via a 30-line `el()` helper (`ui.js`); no canvas/WebGL anywhere in the
  game (a `<canvas>` is used only in the Crystal Lab draw-a-meaning step).
- **Art:** **no asset files.** Crystals are procedural SVG (`catalog.crystalSvg`); the mascot "Geo"
  is CSS shapes; icons are emoji. (See `f-phone-catalog.png`, `f-phone-home.png`.)
- **Particles:** `ui.burst()` spawns N CSS-animated `<div>` particles and removes them after 760ms.
- **Tweens/transitions:** CSS classes (`.flash`, `.bump`, `.shake`, `.reveal`, `.dim-out`, combo-bar
  width transitions). No tween engine.
- **Scene/state management:** a hand-rolled route table in `app.js` (`nav(name)` swaps the screen
  node) with an `onLeave` teardown registry.
- **Input:** native pointer events; tap-or-drag letter placement in puzzle (`pointerdown`/`move`/`up`).
- **Audio:** `audio.js` — pre-generated neural-TTS MP3 clips (722/2,949 words generated; rest fall
  back to device `speechSynthesis`) for dictation + spoken praise, and **Web-Audio-synthesized**
  chimes/zaps/fanfares for instant per-answer SFX. No sound-effect asset files.
- **Game-feel moments (all DOM/CSS):** the live speed-pressure gem meter, the combo bar + "Combo x3"
  label, the big coloured verdict flash ("Flawless!" / "Brilliant!"), the +N gem chip, the
  spotlight-correct/fade-wrong anti-imprinting tile reveal, the wave-reward screen, the daily-geode
  tap-to-crack, the cavern depth-ladder map, and the procedural-mineral catalog.

**An engine would realistically replace:** the renderer, the particle bursts, the CSS tweens, the
scene swap, the SFX synth — i.e. the "feel," upgrading it to sprite/skeletal animation, GPU
particles, real tween easing, and asset-based audio.

**An engine would NOT replace and must preserve:** all of `src/engine/**`, `data/words.js`, the
audio dictation/clip pipeline, `state.js` (multi-profile localStorage container), `cloud_sync_backend.js`
+ `worker.js` + `wrangler.toml` (Cloudflare Worker + KV family-sync), and the PWA shell
(`manifest.webmanifest`, `sw.js`).

### 2c. Live verification (this review)

Driven at 390×844 and 820×1180 with a seeded onboarded profile: home hub, Craft (build-the-word),
Practice/Mining (rhythm), verdict + praise flash, wave-reward, progress map, quests, mineral catalog,
settings all render and play correctly with **0 console errors on both viewports** across two
independent Playwright passes. The product is healthy; this is a "raise polish," not "fix a problem,"
decision.

---

## 3. Per-engine evaluation

Scoring legend (1 = poor fit, 5 = excellent fit, for *this* app's constraints).
"Migration effort" is the *whole-app* cost; ✅/❌ "JS logic survives" = whether `src/engine/**`
is reused as-is vs ported to another language.

| Engine | PWA / iOS fit | Asset ecosystem | Prebuilt logic / feel | Automation / CI (no-build, git-CD) | Language / maintainability | JS logic survives | Migration effort | Cost |
|---|---|---|---|---|---|---|---|---|
| **Stay vanilla (baseline)** | 5 (live today) | 1 (none — the gap) | 2 (hand-rolled) | 5 (no build, instant CD) | 5 (JS, you own it) | ✅ as-is | — | $0 |
| **Vanilla + targeted upgrade (Option 0)** | 5 | 3–4 (buy packs, GSAP/tsParticles) | 3–4 | 5 | 5 | ✅ as-is | **S–M** | low |
| **PixiJS v8** | 4 (WebGL on iOS; keep WebGPU off) | 4 (Pixi pipeline, Spine, atlases) | 3 (renderer only; no tween/state built-in) | 4 (UMD/CDN, no build needed) | 4 (TS) | ✅ as-is | **M** | $0 engine |
| **Phaser 4** | 4 (WebGL2 + v4 context-loss recovery) | 4 (Kenney, Spine, templates) | 5 (tween+particles+scene+audio+physics) | 4 (CDN/ESM, no build forced) | 4 (JS/TS) | ✅ as-is | **M(–L)** | $0 engine |
| **Construct 3** | 4 (auto-PWA; WebGL-only, no Canvas2D fallback) | 4 (asset store + behaviors) | 5 (very rich, visual) | 2 (GUI-only export, **no official CLI**) | 3 (proprietary editor, subscription) | ✅ via ES-module import | **M–L** | **$130/yr** to edit |
| **GDevelop** | 3 (HTML5 good; **PWA is manual**) | 4 (asset store, packs) | 4 (behaviors, particles, effects) | 3 (real `--run-command` CLI exists) | 3 (visual events + JS) | ⚠️ as a UMD **bundle**, no module system | **M** | $0 (self-host) |
| **Cocos Creator** | 3 (tested target, no hard blocker; **PWA manual**) | 3 (Asia-leaning store, thin English) | 4 (Spine/DragonBones, particles, UI) | 3 (CLI build needs a display server) | 4 (TypeScript) | ✅ imports near-as-is (TS/JS) | **M** | $0 (royalty-free) |
| **Godot 4** | **1 (active iOS Safari audio-crash regression 4.4–4.6)** | 2 (free-only Asset Library, thin) | 4 (tween, GPUParticles2D, UI nodes) | 3 (headless export → static folder) | 2 (GDScript; **C# unsupported on web**) | ❌ port to GDScript | **L** | $0 |
| **Defold** | 3 (no specific iOS blocker; **PWA manual**) | 2 (304 free assets, thin) | 4 (tween, particle FX, Druid/Monarch) | 4 (truly-headless Bob build) | 2 (Lua; ts-defold community) | ❌ port to Lua | **L–XL** | $0 |
| **Unity (WebGL)** | **1 (iOS 18.4 crashes 3 GB devices; mobile WebGL deprioritized)** | 5 (largest store, ~122K assets) | 5 (DOTween, Shuriken, UI Toolkit) | 2 (slow WebGL builds; MIME fix) | 2 (C#) | ❌ port to C# / fragile `.jslib` | **XL** | Free <$200K; **Pro $2,310/seat/yr** |
| **@pixi/react** | 4 (Pixi under React) | 4 (Pixi pipeline) | 3 (declarative; tween via libs) | **2 (JSX build pipeline FORCED)** | 4 (React 19 + TS) | ✅ as-is | **L** | $0 |
| **react-three-fiber** | 4 (3D engine doing 2D) | 3 (three/drei; 2D is manual) | 3 (3D-for-2D overhead) | **2 (JSX build pipeline FORCED)** | 3 (React + a 3D engine) | ✅ as-is | **XL** | $0 |

### Prose pro/con per option

**Stay vanilla (baseline).** Pro: ships every hard constraint *today* (installable, offline, iOS +
budget Android, 0 console errors), zero deps, no build, instant git-CD to Cloudflare, you own all of
it. Con: the asset/feel ceiling — procedural SVG, CSS particles, synth SFX — is the one place the app
visibly trails commercial kids' apps (Duolingo ABC, Teach Your Monster).

**Vanilla + targeted upgrade (Option 0 — the recommendation).** Pro: keeps every baseline strength;
buys the actual missing thing (professional art + audio) directly; drop-in libraries can be added
with **no build step** via `<script>`/ESM or a tiny optional bundle. Con: still hand-rolled scene/state
(but that already works fine and is small).

**PixiJS v8.** MIT, ~225 KB gzip full (tree-shakes smaller), default WebGL renderer (keep the
experimental WebGPU off for iOS), loadable as a UMD `<script>` so **no build step is forced**.
Strongest 2D asset pipeline (TexturePacker atlases, bitmap fonts, first-class Spine via
`@esotericsoftware/spine-pixi-v8`), built-in `AnimatedSprite`, federated pointer input, and a
**built-in accessibility plugin** (DOM/ARIA overlays — a genuine plus for a read-aloud kids' app).
Con: renderer only — no built-in tween (add GSAP/tween.js) or scene/state manager (you keep your own).
Migration is Medium: pure logic reused as-is; the play-surface view rewritten as a Pixi scene graph.

**Phaser 4.** MIT, GA (v4.2.0; v4.1 "Salusa" Apr 2026), ~345 KB gzip full, WebGL2-first with Canvas
fallback, and v4's **automatic WebGL context-loss recovery** specifically fixes the classic
iOS-Safari "lost the canvas after backgrounding" PWA bug. Full *framework*: tween, particles, scene
manager (your screens map to scenes), input, built-in WebAudio, physics — the richest batteries of the
JS options, with **no build step forced** (CDN single `<script>` or native ESM). Con: largest JS
bundle; canvas accessibility is DOM-overlay-only; the scene/game-object model is a real shift from DOM
(Medium, trending Large if the whole app moves).

**Construct 3.** Auto-generates an installable PWA (service worker + manifest) on every web export —
the best out-of-box PWA story here — and is extremely feature-rich (behaviors, tween with ease editor,
particles, effects, timeline). Critically, it consumes **standard ES modules**, so the pure
`src/engine/**` can be imported and called as-is (you do *not* rebuild pedagogy as event sheets). Con:
**$129.99/yr subscription to edit** (exports run free forever, no DRM), proprietary editor/lock-in,
WebGL-only with no Canvas2D fallback, and **no official headless CLI** — which breaks the project's
git-CD-to-Cloudflare automation (a real regression for this team).

**GDevelop.** Open-source (MIT engine, no royalties), rich behaviors/particles/effects, an asset store,
and — unlike Construct — a **real headless CLI** (`--run-command`, community `gdexporter`). Free local
HTML5 export you self-host on the existing Worker. Con: **PWA service worker + manifest are NOT
generated** (manual post-export — though this team already hand-rolls exactly that); and its JS code
events have **no ES-module system**, so the 15 logic modules must be pre-bundled into one UMD/IIFE blob
and attached to `gdjs` (bundling friction; tests stay in your own repo). Medium effort, real lock-in
risk is low.

**Cocos Creator.** Engine MIT, royalty-free, mobile-web-first, smallest full-engine bundle (~2–4 MB),
and — uniquely among the full engines — **scripts are TypeScript/JS so your pure-JS modules import
nearly unchanged** (add `.js` suffixes, `window`→`globalThis`). First-class Spine + DragonBones. iOS
Safari is a tested target with no known hard blocker. Con: PWA SW/manifest are a manual custom-build-
template add-on (~2–3 days); the asset store is Asia/WeChat-leaning and thin on Western/English art;
CLI builds need a display server (Xvfb), complicating pure-Docker CI. The best *full-engine* fit if one
were forced, precisely because the JS IP survives.

**Godot 4.** MIT, free, excellent editor and 2D toolset (tween, GPUParticles2D, Control-node UI), and a
built-in PWA export. **Disqualifying blocker for this app:** an active, unresolved iOS-Safari
audio-crash regression introduced in 4.4 and still present through 4.6 (continuous audio crashes Safari
after minutes — GitHub #107390/#116750) — fatal for an audio-heavy kids' app on iPad. Also: C# is *not*
supported on web export, so the logic would port to **GDScript**, and web builds are 10–25 MB gzip vs
today's ~1.5 MB. Effort Large, with a platform blocker on top.

**Defold.** Best-in-class size (~1 MB empty HTML5 gzip), genuinely headless Bob builds (great CI), no
iOS-specific blocker found. Con: source-available (not OSI) license; **PWA is zero-scaffolding** (hand-
inject SW/manifest); and the logic must be **ported to Lua** (or the experimental ts-defold transpiler).
The pure-JS IP does not survive natively → Large–XL. Best only if the goal were tiny builds and game-
feel rather than preserving the JS engine.

**Unity (WebGL).** Largest asset store and richest tooling, and the Runtime Fee was cancelled (Sept
2024; Personal free under $200K, Pro $2,310/seat/yr above). **Disqualifying for this app:** Unity WebGL
on iOS hits Safari's per-tab memory cap, and an **iOS 18.4 regression crashes 3 GB-RAM devices (iPad
9th-gen and older, iPhone 13 mini) at ~80% load with no official fix** — i.e. it fails on exactly the
budget family devices this app must serve. Plus a full **C# port** of the logic (or a fragile `.jslib`
string bridge), 8–25 MB builds, and slow build/deploy. Worst migration (XL) + worst iOS reliability.

**@pixi/react / react-three-fiber.** Both MIT and reuse the logic as-is, but **React/JSX forces a
transpile/bundler step**, which breaks the project's defining no-build, push-vanilla-to-Cloudflare
workflow. If React's declarative model were wanted anyway, **@pixi/react (L)** beats **r3f (XL)** —
purpose-built 2D, native sprite/atlas/Spine, built-in a11y, smaller tree-shaken bundle; r3f is a 3D
engine pressed into 2D service for no 2D benefit. Neither is recommended given the workflow cost.

---

## 4. The asset-quality angle (the user's actual motivation)

"More professional assets" is the real driver, so here is where assets come from per path and what
they cost — independent of which renderer you use, since **most of these marketplaces are
engine-agnostic** (PNG/atlas/audio that any of vanilla, Pixi, or Phaser can load):

- **Free / CC0 art:** **Kenney** (kenney.nl / itch.io) — huge CC0 packs incl. UI, particle, and game-
  asset bundles; "All-in-1" bundle ≈ **$19.95**, otherwise free. Excellent baseline for a kids' game.
- **Curated 2D packs:** **itch.io** game-asset section (free → ~$30 per pack), **CraftPix**
  (free + premium, ~$3–$98/pack), **GraphicRiver/Envato** (one-off licences). GDevelop and Construct
  each also have a **first-party asset store** (300+ packs, mix of free/paid) usable from inside the editor.
- **Skeletal / animated characters:** **Spine** (esotericsoftware.com) is the industry standard —
  editor ≈ **$69 (Essential) / $299 (Professional)** one-time; runtimes are free and exist for **plain
  web, PixiJS (`@esotericsoftware/spine-pixi-v8`), and Phaser (`spine-phaser`)**. DragonBones is a free
  alternative (Cocos has first-class support). A Spine-animated "Geo" mascot + reward creatures would be
  the single biggest visible-quality jump.
- **Audio:** SFX/music from **itch.io**, **OpenGameArt** (free), **Sonniss GDC bundles** (free, large),
  or commissioned. The app today synthesizes SFX; swapping in a small set of recorded chimes/fanfares is
  cheap and high-impact. (Dictation/praise TTS is already a solved, separate pipeline.)
- **Commissioned art:** a freelance 2D/UI artist for a cohesive kids'-game look typically runs **~$500–
  $3,000** for a themed icon/UI/character set, depending on scope. This is the highest-quality option and
  is **engine-independent** — you'd buy it whether you migrated or not.

**Key point:** none of this requires an engine. The assets are the gap; the engine is just one possible
*consumer* of them. You can load a Kenney UI pack, a tsParticles preset, and a Spine mascot into the
**current vanilla app** (Spine has a plain-web runtime) almost as easily as into Pixi/Phaser. Unity's
122K-asset store is the one ecosystem you can't tap without adopting Unity — but Unity is disqualified on
iOS, so that advantage is moot for this product.

---

## 5. Recommended path & migration strategy

### Option 0 — "Stay vanilla + targeted game-feel/asset upgrade" (RECOMMENDED) — effort S–M

Phased, each phase independently shippable, each preserves the live product and the engine IP untouched:

- **Phase A (S) — Assets, no code-architecture change.** Commission or buy a cohesive 2D art set
  (Kenney/CraftPix to start; a Spine mascot later). Replace emoji icons + procedural crystals with
  PNG/SVG art via the existing `el()` + CSS. Swap synth SFX for a small recorded set (`audio.sfx` already
  abstracts this — point it at clips). **Biggest visible-quality jump for the least risk.**
- **Phase B (S) — Drop-in feel libraries, still no build step.** Add **GSAP** (CDN `<script>`, free
  standard tier) for real eased tweens on verdict/combo/reward, and **tsParticles** (CDN) to replace the
  hand-rolled `ui.burst()` with richer GPU-friendly particle presets. Both load without a bundler and
  touch only `ui.js`.
- **Phase C (optional, M) — Spine mascot + animated reward creatures** via the **plain-web Spine
  runtime** (a single `<script>`), rendered into a small canvas overlay on the home/reward screens. This
  is the one piece that benefits from a renderer; if it grows, *that overlay* (not the app) is where
  PixiJS would later earn its place.
- **Throughout:** keep `node --test` (217 tests) green, keep `npm run smoke` + `scripts/qa.mjs`
  (0 console errors / 0 overflow) as the gate, bump `sw.js` VERSION + `src/version.js`, git push → CD.

This delivers "more professional assets and feel" while keeping the no-build, dependency-light,
offline-PWA, instant-deploy properties that make this project cheap to run and impossible to break.

### Option 1 — If a true renderer is later justified: PixiJS v8 (or Phaser 4), play-surfaces only — effort M

Only if Phase C grows into wanting sprite-based particle systems + skeletal animation across all play.
Strategy that preserves everything load-bearing:

1. **Reuse `src/engine/**` and `data/words.js` verbatim** — they import nothing browser-specific, so the
   renderer calls them directly (`buildSession`, `buildOptions`, `gradeAnswer`, `recordAnswer`, …). No
   port, tests unchanged. (This is the whole reason a JS option is the only sane one.)
2. **Rewrite only the play surfaces** (`rhythm`, `puzzle`, `lab`) and reward moments as Pixi/Phaser scenes;
   keep menus/settings/progress/onboarding as DOM (the renderer doesn't need to own those).
3. **Preserve PWA + hosting exactly:** the renderer is bundled/loaded into the same `index.html`; `sw.js`,
   `manifest.webmanifest`, `worker.js`, `wrangler.toml`, KV family-sync, and `state.js` are unchanged.
   With PixiJS UMD or Phaser CDN/ESM you can **keep the no-build deploy**; only adopt a bundler if you
   need to tree-shake the bundle, and even then it slots into `scripts/build_deploy.mjs`.
4. **Automation/test story:** pure-engine stays on `node --test`; the new scenes are covered by the
   existing Playwright smoke/QA harness (already the pattern for UI).
5. **Risks:** larger bundle (+225–345 KB gzip) on a budget device; iOS WebGL context-loss (mitigated by
   Phaser 4's recovery, or manual handling in Pixi); canvas accessibility (use DOM overlays / Pixi's a11y
   plugin for the read-aloud UI); and the genuine effort of rebuilding a working, polished view layer for a
   feel upgrade. Scope it to the play surfaces to keep it Medium, not Large.

### Explicitly NOT recommended

Godot 4 and Unity (iOS-Safari blockers + language port), Defold (language port + manual PWA), Construct 3
(subscription + no CI), and the React options (forced build pipeline). For a *full*-engine forced choice,
**Cocos Creator** is the least-bad (TS, JS survives, mobile-web-first) — but it's still strictly worse than
staying vanilla for this product.

---

## 6. Cost & effort summary + decision guide

| Path | Effort | One-time cost | Recurring | JS IP | No-build / instant CD | iOS+budget reach | Net for this app |
|---|---|---|---|---|---|---|---|
| **Stay vanilla** | — | $0 | $0 | kept | yes | yes | safe, but asset ceiling |
| **Vanilla + upgrade (Option 0)** | **S–M** | art ~$0–$3k + Spine ~$69–$299 | $0 | **kept** | **yes** | **yes** | **best value — RECOMMENDED** |
| PixiJS v8 (surfaces only) | M | same art | $0 | kept | yes (UMD) | yes (WebGL) | good *if* renderer truly needed |
| Phaser 4 (surfaces only) | M(–L) | same art | $0 | kept | yes (CDN/ESM) | yes (+context recovery) | richest feel; bigger bundle |
| Cocos Creator | M | same art | $0 | kept (TS) | no (CLI+display server) | ok (PWA manual) | least-bad full engine |
| GDevelop | M | same art | $0 (self-host) | bundled UMD | partial (PWA manual) | ok | viable, bundling friction |
| Construct 3 | M–L | same art | **$130/yr** | kept (ESM) | **no (no CLI)** | yes (auto-PWA) | CI regression + lock-in |
| Godot 4 | L | same art | $0 | **ported to GDScript** | no | **iOS blocker** | avoid |
| Defold | L–XL | same art | $0 | **ported to Lua** | no | ok (PWA manual) | avoid (port) |
| Unity WebGL | XL | same art | **$2,310/seat/yr (Pro)** | **ported to C#** | no | **iOS blocker** | avoid |

### "Do this if…" guide

- **You want more professional art/audio + better feel, and to keep shipping safely** → **Option 0**
  (vanilla + assets + GSAP/tsParticles, optional Spine mascot). *This is the answer for the stated goal.*
- **You later prove you need sprite/skeletal particle systems across all play** → **PixiJS v8** (lean,
  a11y, no-build) or **Phaser 4** (full batteries, iOS context-loss recovery), **play surfaces only**,
  reusing `src/engine/**` as-is.
- **You are contractually forced onto a full visual editor** → **Cocos Creator** (only because the JS IP
  survives) — but expect a manual PWA layer and weaker English asset store.
- **You are tempted by Unity's asset store or Godot's editor** → don't: both have current, unresolved
  iOS-Safari blockers on the exact devices this app must support, *and* force a full-language port of the
  tested pedagogy engine.

---

## 7. Evidence appendix

### Screenshots captured (this review) — `C:\Users\iango\spell\scripts\qa\engine\`
Driven against the live app (`PORT=5182 node server.js`) with a seeded onboarded profile; two passes,
**0 console errors** on both phone (390×844) and tablet (820×1180):

- `f-phone-home.png`, `f-tablet-home.png` — home hub: Craft hero card + "Best gems" badge, streak chip,
  daily-goal bar, quest chip, gem counter, themed cards.
- `f-phone-rhythm.png`, `f-phone-rhythm-verdict.png`, `f-tablet-rhythm-verdict.png` — Mining/rhythm:
  progress dots, combo bar, "Hear it again", blanked sentence, depleting speed-pressure gem meter, big
  coloured verdict flash ("Flawless!"/"Brilliant!"), +N gem chip, spotlight-correct/fade-wrong tiles.
- `f-phone-rhythm-reward.png` — combo state + 4 plausible-misspelling tiles.
- `f-phone-craft.png`, `f-phone-craft-solved.png` — Craft (build-the-word) entry/home.
- `f-phone-progress.png`, `f-tablet-progress.png` — haul stats, cavern depth-ladder map (D1→D2→D3 locks),
  daily quests with progress bars.
- `f-phone-catalog.png`, `f-tablet-catalog.png` — procedural-SVG mineral collection (owned vs gem-priced).
- `f-phone-settings.png`, `f-*-geode-or-quests.png` — settings + quest/geode entry.
- `walk3.mjs` — the seeding Playwright walk used to produce the set (read-only review aid).

### Source reviewed
`HANDOFF.md` (full), `README.md`, `RESEARCH.md`, `QA.md`, `package.json`, `sw.js`; `src/app.js`,
`src/ui.js`, `src/audio.js`, `src/state.js`; `src/modes/rhythm.js`, `src/modes/puzzle.js`;
`src/screens/home.js`, `src/screens/geode.js`; `src/engine/{session,progress,catalog}.js` (+ LOC/purity
scan of all 15 engine modules); `data/words.js` (metadata). Measured: engine ≈ 2,287 LOC pure JS; UI ≈
5,479 LOC; tests ≈ 2,714 LOC / 217 `test()` calls; app code ≈ 1.5 MB (mostly the 2,919-word dataset),
CSS 55 KB, audio clips 9.3 MB; sw `csc-v22`.

### Sources cited (engine research — current docs/repos/pricing/issues)

**Phaser 4 / PixiJS v8 / React options**
- Phaser: github.com/phaserjs/phaser (README, sizes, CDN/ESM); LICENSE.md (MIT); phaser.io/pricing;
  phaser.io/news/2026/04/phaser-4-1-0-salusa-release; .../phaser-4-renderer-faster-cleaner... (context-loss);
  esotericsoftware.com/spine-phaser; kenney.itch.io/kenney-game-assets; kenney.nl/assets/particle-pack;
  phaser.io/news/2024/09/openforge... (accessibility).
- PixiJS: github.com/pixijs/pixijs LICENSE + package.json; unpkg.com/pixi.js@8.19.0/dist (sizes);
  pixijs.com/blog/june-2026; pixijs.com/8.x/guides/components/renderers (WebGL default, WebGPU experimental);
  pixijs.com/8.x/guides/components/accessibility; github.com/pixijs-userland/spine; github.com/pixijs/ui;
  npmjs.com/package/@pixi/sound.
- React: registry.npmjs.org/@pixi/react/latest; pixijs.com/blog/pixi-react-v8-live; react.pixijs.io;
  r3f.docs.pmnd.rs; bundlephobia.com (pixi.js / three / @react-three/fiber sizes);
  webkit.org/blog/16993/... + developer.apple.com/.../safari-26-release-notes (iOS WebGPU default-on Safari 26).

**Godot / Unity / Cocos / Defold**
- Godot: godotengine.org/license (MIT); docs.godotengine.org web export; GitHub issues #107390, #116750
  (iOS Safari audio-crash 4.4–4.6).
- Unity: unity.com/products/pricing-updates (Personal <$200K free; Pro $2,310/seat/yr, Jan 2026 rise);
  unity.com/blog/unity-is-canceling-the-runtime-fee (cancelled Sept 2024); Unity WebGL mobile/iOS
  memory guidance + iOS 18.4 3 GB-device crash reports (mid-2026).
- Cocos: github.com/cocos/cocos-engine (MIT); cocos.com/en/post/10-common-faqs... (royalty-free EULA);
  Cocos Creator 3.8.8 LTS web-mobile export + custom build template (PWA) docs.
- Defold: defold.com/license (Defold License v1.0, source-available, royalty-free);
  defold.com/product (empty HTML5 ~1.06 MB gzip vs Unity 8.1 / Godot 9.0); Bob headless build docs.

**Construct 3 / GDevelop**
- Construct: construct.net/en/make-games/buy-construct-3 (Free / Personal $129.99/yr / Business tiers);
  construct.net/.../scripting/overview + /script-files + /using-import-maps (ES modules);
  construct.net/en/tutorials/offline-games-construct-8 (auto SW/manifest PWA);
  construct.net/.../behavior-reference/tween + /plugin-reference/particles; (no official export CLI —
  community github.com/Bottlis/c3-cli).
- GDevelop: gdevelop.io/pricing (Free/Silver/Gold/Pro; local HTML5 export free+unlimited);
  github.com/4ian/GDevelop LICENSE.md (MIT); wiki.gdevelop.io/.../publishing/web + /html5_game_in_a_local_folder
  (PWA is manual); wiki.gdevelop.io/.../events/js-code (no module system → UMD bundle);
  github.com/arthuro555/gdexporter + npmjs.com/package/gdexporter (community CLI); gdevelop.io/asset-store.

> Caveats flagged by the research: bundlephobia "full" gzip figures (pixi.js 245 KB, three 177 KB) reflect
> importing the whole library — real builds tree-shake smaller. Construct's exact bare-runtime export size and
> asset-pack price ranges are not officially published (construct.net blocks curl; pages retrieved via
> WebFetch/Wayback). Unity's exact iOS-version crash matrix is from community reports cross-checked against
> Unity's own "mobile WebGL is low-priority" guidance.
