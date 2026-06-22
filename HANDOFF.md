# Crystal Spell Caverns — Project Handoff

> Read this top-to-bottom before continuing. It is written so a fresh session (with no
> prior context) can pick up without re-deriving decisions. Project root:
> `C:\Users\iango\spell`  •  Last updated 2026-06-22 • building sw **csc-v57** (NOT YET DEPLOYED — prod is csc-v56).
>
> **🆕 SESSION 2026-06-22d — §36 NEXT-STEPS #1 + #2 + #4 ✅ BUILT + QA'd locally (now csc-v58). NOT YET DEPLOYED —
> held for Ian's review.** All done test-first; 315 unit tests + smoke + qa_placement + qa_diag_oneshot + qa_caps +
> qa_caps_mastery + qa_level + qa_overflow all green. (#3 D4 is next — Ian's design answers are recorded below.)
> - **#4 — PROPER-NOUN CAPS (Ian's design: lowercase tiles/writing, AUTO-capital first letter).** Proper nouns
>   (stored capitalized in the data, e.g. "Williams"/"Europe") are SPELLED with lowercase tiles / lowercase
>   handwriting / lowercase keyboard — the child never picks or draws a capital (and the case-merged EMNIST CNN
>   couldn't tell C from c anyway). Instead the FIRST placed letter DISPLAYS as a capital so the correct proper form
>   builds up. Pure `engine/puzzle.isProperWord` + `displayCase` (+unit tests), wired into Craft (`modes/puzzle`
>   slot display) AND Mastery (`modes/mastery` box + slot display). Verified live with screenshots: Craft shows "W i"
>   (cap W, lower i) with lowercase tiles; Mastery type mode shows "W i l l i a m s" with a lowercase keyboard.
>   **Also fixed a v56 case-split BUG** found while building: the category machine keyed words by exact case, so a
>   proper noun split into a STUCK "Williams" learning record + a phantom "williams" known record (fill used the
>   cased pool entry, craft used the lowercased target). Now the categories Map keys are case-INSENSITIVE
>   (`engine/categories` `recKey`/`getRecord` + `engine/selection` `entriesFor`); `rec.word` keeps the cased form for
>   display. +unit test (one record, progresses correctly). **august** capitalized (`data/words.js` + the generator's
>   PROPER set); **may/march/states/united stay lowercase** (+data.test guard). New guards `qa_caps.mjs` +
>   `qa_caps_mastery.mjs`. ⚠️ legacy saves with the v56 dual record merge on load (lossy but the dupes were buggy).
> - **#1 — DIAGNOSTIC = ONE SHOT PER WORD.** In the placement diagnostic, a WRONG full build now records the miss
>   on the ±100 walk and advances STRAIGHT to the next word — the child does NOT get to keep the fitting letters and
>   retry. New `diagnosticMiss()` in `modes/puzzle.js`: `wrongSubmit` early-returns to it when `placement` is true;
>   it banks the SAME bookkeeping a hinted-to-correct miss did (walk `submit(...,false)` + legacy tracker +
>   answer-stat) and gives the gentle "+5 💎 · Next word" consolation (non-shaming; the child never knows it's a
>   diagnostic). **Normal Craft's keep-the-fitting-letters retry is UNCHANGED** (the placement branch is the only
>   new path); clean/hinted builds still complete via `solve()`. NEW guard `scripts/qa_diag_oneshot.mjs` drives the
>   diagnostic, deliberately builds the first word WRONG, and asserts the one-shot "Next word" chip + that the word
>   advances (the old retry behaviour would stay put). Verified live: "tube" built "etub" → advanced to "happened".
> - **#1 — DIAGNOSTIC = ONE SHOT PER WORD.** In the placement diagnostic, a WRONG full build now records the miss
>   on the ±100 walk and advances STRAIGHT to the next word — the child does NOT get to keep the fitting letters and
>   retry. New `diagnosticMiss()` in `modes/puzzle.js`: `wrongSubmit` early-returns to it when `placement` is true;
>   it banks the SAME bookkeeping a hinted-to-correct miss did (walk `submit(...,false)` + legacy tracker +
>   answer-stat) and gives the gentle "+5 💎 · Next word" consolation (non-shaming; the child never knows it's a
>   diagnostic). **Normal Craft's keep-the-fitting-letters retry is UNCHANGED** (the placement branch is the only
>   new path); clean/hinted builds still complete via `solve()`. NEW guard `scripts/qa_diag_oneshot.mjs` drives the
>   diagnostic, deliberately builds the first word WRONG, and asserts the one-shot "Next word" chip + that the word
>   advances (the old retry behaviour would stay put). Verified live: "tube" built "etub" → advanced to "happened".
> - **#2 — "to next depth" → "to next LEVEL".** The Progress tile now shows words to the next cavern LEVEL (band) —
>   the words in the CURRENT band the child hasn't learned yet — not the old mastery-DEPTH count. New pure
>   `categorySummary.toNextLevel` (`engine/categories.js`, +1 unit test): counts band==level pool words that aren't
>   yet known/mastered (reaches 0 when the level is cleared). `screens/progress.js` uses it + the relabelled tile.
>   qa_placement extended to assert the tile reads "to next level" with a number (showed "🪨 30 to next level" at the
>   placed band 47). NOTE: the `cavernMap` panel below still uses mastery-DEPTH language — that's **D4's** job to
>   unify (left alone deliberately; #2 was scoped to the tile).
> - **⚠️ REMAINING NEXT STEPS:** **#3 D4** (NEXT — Ian's design answers below) · **#5 OWED real-device pass** on
>   audio + diagnostic + re-rank + caps + all of csc-v57/v58 (Ian's).
> - **#3 D4 — IAN'S DESIGN ANSWERS (2026-06-22d, recorded; not yet built):** (a) **Bosses fire every 10 MASTERED
>   words** (change `WORDS_PER_DEPTH` 8→10 + the boss trigger; stays mastery-based, NOT band-up). (b) **"maybe a
>   larger boss at the END of a level"** (a bigger boss on completing a cavern level/band — tentative "maybe"). (c)
>   **Add a DEBUG FLAG to trigger/test bosses** (e.g. `?boss=N` / a dev hook) so the boss screens can be exercised
>   without grinding to the milestone. Plus the already-decided D4 spec: the scrollable ~100-level cavern map (current
>   level big, tap to zoom, reached levels scrollable above, locked greyed below) with **hide-skipped** (a placement
>   jump leaves the skipped lower levels locked too, to pull the child back to master the easier words). Unify the
>   `cavernMap` panel (still mastery-DEPTH language) onto this.
> - **DEPLOY when Ian approves:** versions bumped (`sw.js` + `version.js` → **csc-v58**); push `main` → Git-CD
>   builds + deploys; verify `check_deploy.mjs csc-v58` + `qa_prod.mjs`. (Consider deploying #1/#2/#4 now and D4 after.)
>
> **🆕 SESSION 2026-06-22c — C1 DIAGNOSTIC + AoA RE-RANK + AUDIO-ASSET REPAIR ✅ SHIPPED (csc-v56).** A very
> large session, committed + deployed. Summary of everything done (details below + in the §C1 banner):
> - **§C1 PLACEMENT DIAGNOSTIC** (see next banner). Refined per Ian's live testing: the diagnostic is now a
>   chain of normal **6-word Craft sessions** (each looks like normal play) whose adaptive **±100 walk PERSISTS
>   across sessions** (saved on the profile, `placement.serialize`/`restore`) until **3 misses land in one
>   30-word band** → then it places. **No repeated words** (walk dedups across sessions); the `?debug=1` rank
>   readout persists every session until placed. The diagnostic does **NOT credit known/mastered** (a single
>   craft isn't mastery — Ian: "I never repeated one"): `seedFromPlacement` only places the level + banks ≤1
>   craft pip on at-band words; below-band words are skipped (the high level already excludes them). Age
>   buttons are now **2–5 … 13+** (open-ended). The header / reward / Progress now show the **CAVERN LEVEL**
>   (the band, e.g. "⛏️ Level 47") — "where you are" — NOT the mastery depth (which still drives the geode boss
>   internally). qa_placement / smoke updated for multi-session; 310 tests + smoke + overflow green.
> - **WORD LIST RE-RANKED BY AGE-OF-ACQUISITION** (Ian: adult frequency was wrong — "storm before relations").
>   `data/words.js` is now ordered by child AoA (Kuperman/Brysbaert 2012, free OSF datasets in `_aoa/`, 95%
>   coverage, gaps placed by frequency) via `scripts/rerank_aoa.mjs`. Leads with `mom, yes, water, dog…`; storm
>   (645) now ≪ relations (1998); tiers re-derived from AoA. **Clips are keyed by word → unaffected.**
>   `merge.mjs` now WARNS to run rerank_aoa after it (or the order reverts to frequency).
> - **PROPER NOUNS CAPITALIZED** (Ian): 88 words (Europe, Texas, January, Smith, English…) capitalized in
>   word + sentences + first syllable, via rerank_aoa's `PROPER` set. Spelling-safe (craft/draw lowercase the
>   target; audio slug lowercase → clips/grading unaffected). EXCLUDED ambiguous (may/march/august/states/united).
> - **AUDIO-ASSET REPAIR** — root-caused a pre-existing `gen_audio` batch-split bug (`documents.mp3` literally
>   said "purpose"; ~2 batches misaligned). Audited ALL 2,916 clips with **Whisper** (`scripts/audit_clips.mjs`,
>   in-browser transformers.js, no installs): 47 clips **content-remapped** (`remap_clips.mjs`, verified), 8
>   **regenerated** via Gemini (one-word-per-request), 4 (`con`+3 contractions `they're/there's/you're`) from
>   **Ian's WAV recordings** (`con`→`con_.mp3` alias since Windows blocks `con.mp3` — `audio.js`+`gen_audio`
>   map it). Hardened `splitIntoN` so it can't recur. **All 2,916 words now have a correct clip (0 missing).**
> - **VOICE-QUEUE preemption fix** (`engine/voicequeue.js` `preemptDictation`): a new word now supersedes a
>   stale dictation without cutting praise (a real lag bug, separate from the clip bug).
> - **Global CLAUDE.md:** added a hard **5-minute monitoring rule** (poll any shell job ≤5 min, even short ones).
> - **⚠️ NEXT STEPS (#1 + #2 DONE 2026-06-22d in csc-v57 — see top banner; #3–#5 still open):**
>   1. ✅ **DONE (csc-v57).** Diagnostic = ONE shot per word: a wrong build records the miss + advances, no
>      retry (`modes/puzzle.js` `diagnosticMiss`; normal Craft retry unchanged; guard `qa_diag_oneshot.mjs`).
>   2. ✅ **DONE (csc-v57).** "to next depth" → "to next level": Progress tile shows words to the next cavern
>      LEVEL (band) via new `categorySummary.toNextLevel`. (cavernMap panel's depth language is D4's job.)
>   3. **D4 (depth/level/cavern-map):** fully unify the mastery-"depth" (geode boss, 8 zones) with the cavern
>      LEVEL (band) into the 100-level cavern map. The header now shows the band as a stopgap; the boss still
>      uses mastery-depth internally. Confirm: should bosses fire on band-up (reaching a new cavern level)?
>   4. **Caps in spelling:** proper nouns DISPLAY capitalized but the child still spells them lowercase in
>      craft/draw (recognizer is case-insensitive). If the capital should be TAUGHT, that's a recognizer/tiles
>      change. Also: decide the ambiguous words (may/march/august/states/united) left lowercase.
>   5. **OWED real-device pass** on all of the above (audio, diagnostic, re-rank, caps).
>
> **🆕 SESSION 2026-06-22b — §36 C1 PLACEMENT DIAGNOSTIC ✅ SHIPPED in csc-v56 (was: built locally csc-v55).**
> Built to Ian's design (3 decisions confirmed this session): a NEW explorer's FIRST Craft IS a placement
> walk, played as ordinary Craft so the child never knows. **Flow:** onboarding asks **AGE** (big 5–13
> buttons, replaces the age-labelled level picker) → seeds a start word in the frequency list (5→#1, 6→#300,
> +300/yr) → plays normal Craft, walking **±100** list positions per answer (clean build → up, miss/hint →
> down, never repeats) until **3 missed words land in one 30-word "cavern level" (band)** → enters there,
> seeding the §30 categories engine (corrects already banked progress). **Decisions (Ian):** (1) clean build
> = up; **diagnostic relaxes timers** (no 8s auto-hint, no speed clock) so a slow first-timer isn't mis-placed
> low; (2) after mastering a band, **climb up** — skipped easier bands treated as tested-out (hide-skipped/
> backfill deferred to D4); (3) per-word walk shown as a 6-word Craft set. **Engine:** the categories LEVEL is
> now a **30-word BAND** (`floor(pos/30)+1`, ~97 cavern levels), NOT the age tier — `lexicon.byRank()` attaches
> `pos`+`band`; `categories.js` selection/refill key off `band` (tier kept as age metadata). New pure
> `engine/placement.js` (+ `test/placement.test.js`, 12 tests) owns the walk. **Also fixes D1** (first-run no
> longer drops into locked Mining) and **lays D4's data model**. Settings level → a cavern-level **stepper**
> (➖/➕) + **Re-test**. **Legacy saves migrate** (band from rank, level re-anchored to the deepest learning
> band — existing players never re-diagnosed). **QA all green:** 307 unit tests (+13 new); `smoke` (rewritten
> for the new flow); NEW `qa_placement.mjs` (end-to-end: age step → diagnostic → placed at a band, 0 console
> errors); `qa_overflow`/`qa_responsive`/`qa_fold`/`qa_mastery`/`qa_s31`/`qa_autofill` green; `qa_phone_audit`
> = only the 2 documented by-design landscape fails; `qa_level` updated to the stepper. Files: `engine/
> placement.js` (new), `engine/{categories,lexicon}.js`, `modes/puzzle.js`, `screens/{onboarding,settings}.js`,
> `state.js`, `styles.css`, `sw.js`+`version.js` (csc-v55, placement.js precached). ⚠️ **NOT DEPLOYED** — held
> for Ian's local review (per the plan). ⚠️ **OWED:** real-device pass; update the remaining onboarding-WALKING
> scratch QA scripts to the age step (`qa_s30`, `qa_do`, `qa_explore`, `qa_uiaudio`, `qa_profiles`, `design_qa`,
> `qa.mjs`) + retire obsolete `qa_levels.mjs` (superseded by `qa_placement.mjs`). **Remaining §36 discuss-first:
> D2, D3, D4, D5, E5** (C1 + D1 now done).
>
> **🆕 SESSION 2026-06-22 — §36 DO-FIRST backlog ✅ SHIPPED + LIVE on prod (csc-v54), verified.**
> Pushed to `main` → Git-CD built + deployed; `check_deploy.mjs csc-v54` = DEPLOYED ✅ (prod went
> csc-v53→csc-v54 in ~45s), `qa_prod.mjs` = **ISSUES: none** (boots, home + Mastery card render, CNN
> recognizer loads + drew 'a'→'a', APP_VERSION=csc-v54). Worked the §36 item-#15
> "do-first" list. **DONE + committed + QA'd + LIVE:** **A1–A8** (CSS bugs: one-shot Geo wink,
> desktop max-width≤900 @pointer:fine, Progress `.seg` padding, bigger phone geode, real Crystal-Lab
> button, re-proportioned back button, themed scrollbar + `.play-body overflow-x:clip` to kill the
> pulse-induced horizontal bar) · **B3** (American spellings: `centre→center`/`programme→program`/
> `theatre→theater` flipped at SOURCE in `data/chunks/*` + rebuilt `words.js`, British forms demoted to
> misspellings, **no new audio needed** — clips already on disk + manifest, reused the homophone clip for
> `pickColour`; UI copy colour→color / practise→practice / catalogued→cataloged swept; +2 data.test
> guards) · **B1/B2** (a real SERIAL voice queue `src/engine/voicequeue.js` (+8 unit tests) wired through
> `audio.js` so praise never overlaps the next word; a new dictation preempts a playing one but praise is
> PROTECTED) · **E1–E4** (auto-hint never reveals the FINAL letter; manual ⏸ Pause button in the play
> header; no hints while paused; **the confirmed background-tab bug fixed** via `visibleTimeout()` +
> visibility-gated `createIdleGuard` with onSuspend/onWake) · **C2** (scary "~2800 new to find" →
> "to next depth") · **C3** (Repair UNIFIED on the §30 categories: `repairWords`/`needsRepair`,
> `buildRepairSession`, a YELLOW light on missed words, count+pips+drill now reconcile — no more legacy
> `lapsedWords` mismatch) · **F1** (mining defaults to 2 answer tiles; 3/4 still selectable) · **F2**
> (Ian chose "prompt at end of onboarding": `defaultSettings().reminders=true` + a grown-up-framed
> permission prompt after the explorer is created, gated on push-supported && `Notification.permission===
> 'default'`; honest — ON only if granted). **293 tests green; smoke/overflow/fold/phone-audit/mastery/
> s31/autofill all green; iPad-portrait --play-scale=1 preserved.** Ian reviewed locally then approved
> the deploy (csc-v54 now LIVE). ⚠️ **OWED:** a real-device pass on the shipped fixes (the audio
> no-overlap queue, the ⏸ Pause + background-tab gating, the F2 onboarding reminder prompt) — judged via
> emulation/screenshots + qa_prod only. **NOT STARTED (the "discuss-first" §36 items, all need Ian's design input):** **C1**
> (diagnostic start-level placement — Ian wants a FULL design discussion), **D1** (first-run flow), **D2**
> (Crystal Lab redesign), **D3** (set-size 6 fixed + per-dig mining size), **D4** (100-level cavern map +
> hide skipped levels), **D5** (catalog photos+science), **E5** (screen-time off-ramp). See §36 below.
>
> **Earlier this session block (Ian's directives):** **#3 AUDIO TAIL — ✅ COMPLETE + LIVE (csc-v53):** the whole remaining tail generated in ONE
> approved run (+461 clips → **2918/2918 words**; only the Windows-reserved slug `con` falls back to device
> TTS). Word audio is now fully shipped. **#13 one-screen experiment — ⏸️ DEFERRED by Ian** ("many new issues
> introduced") — the test Worker/branch stay as-is but the model is NOT being adopted; stop polling for a
> verdict. **#1 follow-up (Gemini free-tier TTS commercial licensing) — ✅ RESOLVED 2026-06-21: OK to ship**
> (Google doesn't claim ownership of generated content; the EEA/UK/CH "paid-only" clause governs *serving the
> API to end-users at runtime*, which this app never does — clips are baked offline at build time. Full
> reasoning + verbatim clauses in `SERVICES_AUDIT.md`). **Real-device passes — Ian marked done/approved**
> (clear the "OWED: real-device pass" notes throughout). **§32 voice spelling — stays DEFERRED.** Earlier
> 2026-06-21a session closed backlog 11–14: #14 mastery keypad fixed on iPad/tablet/desktop (csc-v52);
> mastery app-keypad (§11/§12) APPROVED on phone AND full-size on non-phone.
> **NOTE (2026-06-21b): a Cloudflare "50% of daily free max" warning was investigated — NOT this app.**
> `FAMILY_SYNC` KV is empty + `spell-caverns` worker idle (0 reqs in an 80s live tail); the account-wide
> free limit is being consumed by a **kidenv** worker (Ian confirmed + is handling it). The spell app's open
> public endpoints (`/api/sync`, `/api/feedback`) remain unauthenticated/unthrottled — fine at family scale,
> but a free Cloudflare rate-limit/WAF rule (or an in-worker per-IP throttle) is the hardening if ever needed.
> **The game is FEATURE-COMPLETE, DEPLOYED, MULTI-USER, and POLISHED.** Live (HTTPS,
> installable PWA) at **https://spell.pryzmio.com** (Cloudflare Worker + Static Assets,
> Git-CD from **github.com/ian-gornall/spell-caverns** on every push to `main`).
> `npm test` green (**262 tests**); `npm run smoke` green; `node scripts/qa.mjs` = 0
> console errors; `node scripts/qa_responsive.mjs` = 0 overflow; **`node scripts/qa_overflow.mjs` =
> 0 inner-scroll/bleed at 8 Galaxy sizes × 2 text scales** (the §29 deep guard); `node
> scripts/qa_fold.mjs` = above-the-fold PASS; sw **csc-v36** (LIVE; **§30 SHIPPED + recognizer
> upgraded** — see §30).
> **➡️ NEW: §30 (LEARNING-MODEL REDESIGN + draw-the-letters MASTERY mode) is SHIPPED + LIVE
> (csc-v36, verified on prod). The draw-mode recogniser is now a real on-device EMNIST-letters
> CNN (TF.js, ~94% top-1, fixes the a/q/c/s confusion) + a keyboard fallback. Owed: a real-device
> iPad pass. START AT §0 (current state) → §30.** Older: §28 user backlog, §27 §26-A design brief.
> **§28.A FEEDBACK DELIVERY — fully LIVE + verified end-to-end on prod (csc-v26):** feedback now
> reaches Ian via durable KV + instant web-push to his devices (laptop + phone both registered &
> confirmed buzzing). Plus an in-app **FEEDBACK ARCHIVE** (`screens/admin_feedback.js`): tap a
> feedback notification → deep-links (`/?view=feedback`) into the full list (newest first); or in
> Settings tap the **version line 7×** (hidden, single-admin app — no visible UI) to open it / set
> up a device. The admin device REMEMBERS the `ADMIN_KEY` in localStorage (`src/admin.js`, key
> `csc_admin_key`) so it fetches `GET /api/feedback` without re-prompting. Secrets set: `ADMIN_KEY`
> (Ian has the value), `VAPID_PRIVATE`. Email (Resend) intentionally OFF (free-first); lights up
> only if `RESEND_API_KEY` is ever set ([[prefer-free-services]] — owed: a full third-party dep audit).
> **§28 (2026-06-19, csc-v24→v26 — DONE, QA'd, LIVE):** built all four user asks.
> **B** crystal prices ~2.5× (400/1200/3000/6500, `catalog.js`). **D** boot routing now shows
> "Who's playing?" for ANY count≥1 (solo kids too; `app.js`) — always asks + always surfaces
> Add-explorer. **C** OFFLINE PRINTABLES: pure `engine/printables.js` (8 tests) + `screens/
> printables.js` + `@media print` CSS + Settings "Practice sheets" entry; 3 sources (target
> words / pattern family / age tier) × 2 formats (word list / look-cover-write-check grid);
> verified clean print output (chrome hidden, big black-on-white). **A** FEEDBACK NOW REACHES
> IAN: `POST /api/feedback` → durable KV (`feedback:` prefix) + instant web-push to the
> developer's admin device + (dormant) email. Client (`feedback_client.js`) POSTs best-effort,
> queues unsent, flushes on next open. **Email via Resend was DROPPED** (free-tier cliff;
> push+KV already = "notified immediately + stored long term"); the Resend code path is a
> graceful no-op unless `RESEND_API_KEY` is set ([[prefer-free-services]] — owed: a full
> third-party-dep audit). All manual setup DONE + verified (see §28.A banner above). Devices are
> registered via the in-app 7-tap unlock now, NOT the old console one-liner.
> **§27 (2026-06-19, csc-v23 — LIVE+verified):** shipped the whole §26-A design brief —
> landscape/short-phone fold collapse + pinned reward CTA (no action below the fold), two
> below-AA contrast lifts, **self-hosted Atkinson Hyperlegible** (letter-distinct spelling
> font) + fuller dyslexia "Easy-read" mode, **distinct tinted locked-catalog silhouettes**
> (was 24 grey clones), youngest-tier recognition clamp (anti-imprinting, test-first),
> reactive Geo (wink/cheer), onboarding ambient. An independent design agent verified all 8
> fixes PASS, 0 regressions. ALSO root-caused + fixed a "prod plays robotic voice not the
> clips" report: the clip **manifest load was once-and-never-retry**, so any early/transient
> miss stranded a long-lived installed-PWA session on TTS forever — now self-heals (retry on
> failure + re-check each dictation). §26-B (acquire pro assets, stay vanilla) NOT started;
> §26-A item #8 (slim child-Settings, ★★) deferred. Audio-tail next free batch due 2026-06-20.
> §24 shipped the whole §23 App-Store-quality backlog (CRAFT is the hero + best-paid +
> nudged path; the daily GEODE tap-to-open with ratcheting harder goals; a sustained
> phone-polish pass) AND the long-deferred multi-user UI (kid-lock picture password,
> grown-up password gate, snapshot time-machine). Earlier: §22 (mastery = CRAFTING),
> §20 (target-words algorithm, multi-profile, family sync), §17 (polish/economy/deploy).
> Older sections are reference: §4/§7/§8 = design decisions (don't relitigate); §16 =
> Catalog/onboarding/Geode-Boss; §17 = the (DONE) polish/economy/deploy backlog;
> §18–18b = backup + cloud-sync design; §19 = deploy bring-up; §12 = audio (722/2949 clips).

---

## 0. CURRENT STATE & NEXT ACTION (read first)

**The app is feature-complete, deployed, and multi-user. Everything below is committed; tree clean.**

**Live + deploy**
- **LIVE at https://spell.pryzmio.com** (custom domain) — Cloudflare **Worker + Static Assets**,
  Git-CD from **github.com/ian-gornall/spell-caverns** `main`. (Moved off Netlify — free-tier
  build credits ran out. Cloudflare "Connect to Git" provisions a Worker + runs `wrangler deploy`,
  NOT Pages.) `worker.js` serves the static PWA (`deploy/` via the ASSETS binding) AND `/api/sync`
  (family-sync on **KV**, same `engine/cloudsync.reconcile` merge). Config = `wrangler.toml`
  (`main=worker.js`, `[assets] directory="./deploy"`). `package.json` is **dependency-free** so
  `npm ci` can't drift. Build cmd `node scripts/build_deploy.mjs` → `deploy/`; deploy cmd
  `npx wrangler deploy`. Old `netlify.toml`/`netlify/functions/` kept as a dead fallback.
- ✅ **Family sync is LIVE**: KV namespace `FAMILY_SYNC` (id `8646bafb7f3c43a28808b93b8007ce4d`)
  created + bound in `wrangler.toml`. VERIFIED end-to-end on prod (GET/PUT/DELETE +
  never-lose-progress merge all pass; `_headers` no-cache confirmed). To manage KV the dev needs
  `wrangler login` first (account-gated). NOTE: the old Pages-style `functions/` dir was REMOVED.
- ⚠️ **Per-origin data**: spell.pryzmio.com is a NEW origin vs the old netlify URL — localStorage
  doesn't carry over. To move a kid's progress: Settings → Back up (old) → Restore (new), or use
  family sync. (Tell the user; the old Netlify site should be deleted.)
- `npm test` = **220 green** (`node --test`); `npm run smoke` (Playwright, needs `npm start`) green;
  `node scripts/qa.mjs` = 0 console/JS errors; `node scripts/qa_responsive.mjs` = 0 horizontal
  overflow at 7 viewports (360–820px); **`node scripts/qa_fold.mjs` = all primary actions above the
  fold** (the VERTICAL-fold regression guard added in §27); `node scripts/qa_s28.mjs` = §28 checks
  pass. sw VERSION **csc-v26** (bump on any precached change — AND bump `src/version.js` `APP_VERSION`
  to match; Settings shows both). **Before major UI changes, follow `QA.md`** (interactive
  view-as-you-go QA + the phone device matrix).
- ✅ Everything through §28 is **pushed and LIVE on prod** (current sw **csc-v26**, verified).

**What exists**
- **Data:** `data/words.js` = 2,919 frequency-ordered words (ages 5–13), 63 pattern families;
  rebuild via `node scripts/merge.mjs`. (§3)
- **Pure engine** (`src/engine/`, all unit-tested): `lexicon · distractors · praise · assessment ·
  progress · session · nonsense · puzzle · streak · quests · catalog · narrative · backup ·
  cloudsync · profiles · printables · webpush`. Learning model: CONTINUOUS mastery, established ONLY by CRAFTING
  (production) — MINING (recognition) drives speed/gems/engagement but never mastery or
  targets (§22). CHOSEN-LEVEL-LED session selection: lead with fresh words at/above the
  picked start tier, RESERVE a share for craft-missed targets (repair), park correct ones.
  `buildFirstWave` gives a guaranteed-win first wave AT the chosen level. (§4, §20, §22)
- **UI** (`src/`): `app.js` (boot/router/ctx + family sync + the `/?view=feedback` admin deep-link),
  `state.js` (MULTI-PROFILE container — see below), `audio.js` (clip/Web-Speech dictation + synth SFX;
  configurable voice speed), `ui.js`, `push.js` (daily-reminder + `registerAdmin`), `feedback_client.js`
  (best-effort feedback POST + offline queue), `admin.js` (developer feedback-archive helpers).
  Screens: `home · onboarding · profiles ("who's playing") · settings · progress · feedback ·
  catalog · boss · geode · printables · admin_feedback`. Modes: `rhythm · puzzle · lab`. The home leads
  with the **CRAFT hero** (the assessment); the daily **geode** (`screens/geode.js`) is the ratcheting
  balanced-play reward. Reusable `ui.picturePad` powers the kid-lock. `screens/admin_feedback.js` is the
  hidden developer feedback archive (7-tap the Settings version line; §28.A). (§24, §28)
- **Multi-profile:** one device/family, many kids, each with own progress; "Who's playing?" each
  launch; per-profile level-select; family-password cloud sync (KV). Each kid can set a **picture-
  password kid-lock**; a grown-up can set an optional **parent password** gating the Parents panel
  + a snapshot **Time machine** rollback. (§20, §24)
- **Privacy/COPPA:** on-device by default; opt-in family sync stores only pseudonymous data behind
  a parental-consent gate; deletable. (PRIVACY.md, §18b)

**§29 — 2026-06-19c (csc-v27→v29 — DONE, QA'd, on prod): phone overflow + slim Settings + audit.**
Built from the user's report "things still cut off on the right / I can scroll a bit, oversize —
Samsung Galaxy." Root cause analysis: pure-width Chromium emulation at 8 Galaxy viewports × 2 text
scales shows ZERO overflow, so the real-device pan is **layout-viewport-level** (a transient fixed
overlay / sub-pixel %·vw round / the browser nudging the layout viewport past the visual one).
- ✅ **THE Samsung right-side pan — ROOT CAUSE FOUND + FIXED (csc-v32).** Using Playwright's real
  **Galaxy device descriptors** (S24/A55/S9+/S8/Z-Fold-6, real Samsung UA+DPR) against PROD and
  ACTIVELY trying to pan right (`scripts/qa_galaxy.mjs`), the culprit surfaced: **`.header-title`**
  was `overflow:hidden` + `white-space:nowrap` + a long title → its OWN touch-scroll container.
  On a narrow 320-360px phone the clipped title is ~55-95px wider than its box, so the title element
  itself **panned right under a finger** (the page didn't — `doc=0,winX=0`). Only bites at narrow
  widths (the A55/Fold at 480/928px were clean) — fits "narrow Samsung." Fix = `overflow:clip`
  (keeps the ellipsis, creates no scroll container). Then a hardened `qa_overflow.mjs` (a DEFINITIVE
  `scrollLeft`-pannability test, touch-action-aware) found the SAME class on more surfaces and they
  were ALL fixed (csc-v33): the **"Who's playing?" picker / onboarding** screen was touch-pannable
  ~33-39px EVERY launch (its `.onboarding::before` glow `inset:-10%` ≈33px, clipped-but-pannable
  under `overflow:hidden`) → `overflow:clip`; **level cards** → `overflow:clip` + grids →
  `minmax(0,1fr)` (long labels clip, don't expand the grid); **`.onboard-body`** y-scroller (CSS
  won't clip-x while it scrolls-y) → `touch-action: pan-y` (blocks sideways drags at the input
  layer). **After: 0 horizontal pan on every Galaxy device descriptor × every screen** (incl. the
  picker), verified by `qa_galaxy.mjs` against PROD with active pan attempts. This set is almost
  certainly the user's exact "scroll a bit right / oversize" symptom.
- ✅ **Defensive root guards (csc-v27/v29):** `overflow-x: clip` on `html, body, #app`; clipped
  `.onboard-body` (its level-card shadows caused a ~3px phantom inner pan). `scripts/qa_overflow.mjs`
  = DEEP guard catching **inner-scroller** overflow `qa_responsive.mjs` can't see (+1.3× text scale +
  onboarding). `scripts/qa_galaxy.mjs` = the real-device-descriptor PAN test (run it against prod).
  ⚠️ **Ian: please still hard-reload the PWA on the actual Galaxy to confirm** — but the pannable
  element is now provably gone under the closest-to-real Samsung emulation.
- ✅ **Stale smoke REPAIRED:** the HANDOFF claimed `npm run smoke` green, but §28's always-ask
  "Who's playing?" picker + §27's youngest-tier option clamp had silently broken it (it failed at
  the first post-onboarding home hop). Added `dismissPicker()` through every boot, relaxed the tile
  assertion to ≥2 (the tier-1-2 anti-imprinting clamp), and made it tolerate audio-tail clip 404s
  (TTS fallback) + Worker-only `/api/*` 404s (absent on the static dev server). **Smoke green again.**
- ✅ **§26-A #8 — child Settings SLIMMED (csc-v28):** advanced levers (answer-count, device voice
  picker), Players admin, Practice sheets, and the whole Parents & privacy block now live in a
  collapsed native `<details>` **"Grown-up settings"** disclosure. Default view = just the simple kid
  controls (level, difficulty, length, voice on/off + speed + volume, name, colour, easy-read,
  kid-lock). Destructive items keep their parent-password gate. Verified collapse/expand, 0 errors.
- ✅ **Free-first SERVICES AUDIT → `SERVICES_AUDIT.md`** (OPEN BACKLOG #1, [[prefer-free-services]]):
  every runtime dep **>95% free-tier headroom, fail-closed**. Eyes only on KV writes (if scaled
  ~20×), dormant Resend 100/day (if enabled), + a non-cost Gemini-TTS commercial-licensing check.

**→ OPEN BACKLOG (what's actually left — everything else is DONE + LIVE):**

1. ✅ **Free-first SERVICES AUDIT — DONE (§29)** → `SERVICES_AUDIT.md`. Follow-up **Gemini free-tier TTS
   commercial-use licensing — ✅ RESOLVED 2026-06-21: OK to ship** (Google doesn't claim ownership of
   generated content; the EEA/UK/CH paid-only clause governs *serving the API to end-users at runtime*, which
   this app never does — clips are baked offline at build time). Full reasoning + verbatim clauses in the new
   "Gemini TTS commercial-licensing" section of `SERVICES_AUDIT.md`.
2. ✅ **INTERFACE AUDIO (§32.A) + AUDIO-START GATE (§32.B) — DONE + QA'd (csc-v42, 2026-06-20).** The
   fixed interface narration (Geo's onboarding lines, the geode/boss prompts) + the mastery praise now
   play PRE-RENDERED neural-TTS Gemini clips, not the robotic device voice. Built: a centralized catalog
   `src/engine/ui_phrases.js` (`UI` lines → new `audio/ui/` bucket; `PRAISE` → folded into the `phrases`
   bucket) so the runtime `say()` string and the generator agree (no slug drift); `gen_audio.mjs` grew a
   `ui` kind + `manifest.ui`; `say()` resolves UI clips at NATURAL speed (rate 1, not the slowed dictation
   rate). **Generated 13 clips** (10 ui + 3 praise) — all on the first model, so the daily Gemini quota is
   **untouched, left for the word tail** (#3). **§32.B shipped too:** first-run onboarding opens with a
   **"Tap to start 🔊" gate** (`onboarding.js tapToStart()` + `audio.whenReady()`) — one tap primes audio
   + awaits the manifest so the FIRST line (welcome) plays a clip, fixing the "first line is a different/
   robotic voice" bug (gate is first-run only; the picker/home don't auto-narrate). QA: `test/ui_phrases.test.js`
   (+4 → 277 tests), `scripts/qa_uiaudio.mjs` (NEW — every onboarding line incl. welcome resolves to a clip,
   0 console errors), smoke + qa_responsive/overflow/fold green. **NOTE:** the settings voice-picker/speed
   previews stay TTS on purpose (they audition the DEVICE voice). ⚠️ OWED: a real-device pass (iPad/iOS) to
   confirm the gate unlocks iOS audio + the clips sound right on hardware.
3. ✅ **AUDIO TAIL — COMPLETE + LIVE (csc-v53, 2026-06-21b).** Ian approved the run; the WHOLE remaining tail
   generated in ONE pass (the daily quota held the entire time): **+461 word clips → 2918/2918 words done**
   (2918 word + 35 phrase + 10 ui; manifest matches disk). The ONLY gap is the Windows-reserved slug `con`
   (→ device TTS by design). Word audio is now **fully shipped**. Deployed via the standard recipe (commit
   clips → bump `sw.js`/`version.js` to csc-v53 → push `main` → Git-CD; verified `node scripts/check_deploy.mjs
   csc-v53` = DEPLOYED ✅, prod sw=csc-v53). ⚠️ **Windows reserved-name gotcha (kept for reference):** `con`/
   PRN/AUX/NUL/COM0-9/LPT0-9 slugs are SKIPPED by `gen_audio.mjs` (native git can't index `con.mp3`) → TTS
   fallback. **Recipe if ever regenerating** (e.g. new words added): `npm i --no-save @breezystack/lamejs`
   (it gets pruned by other --no-save installs — reinstall right before) → `npm run gen:audio words` (skips
   done, BATCH_SIZE=40) → commit → bump versions → push → `check_deploy`. [[approval-before-consuming-limits]]
   per run. (Was: nothing further owed — the prior `parking`/`bear` spot-listen note is moot now the full set ships.)
4. ✅ **§26-B — ASSETS REVIEW of `C:\Users\iango\kidenv` → ARTIFACT — DONE (2026-06-20). Artifact:
   `KIDENV_ASSET_REVIEW.md` (repo root).** A read-only inventory of the kidenv workspace (6 apps + a
   `template/` skeleton + a shared `guides/phaser/` CC0 library). Findings: the single most valuable
   reusable thing is **`kidenv/template/styles.css` — a complete, battle-tested DESIGN-TOKEN system**
   (fluid `--gap`/`--pad` clamps, a type scale, a `max-height:480px` LANDSCAPE override, `--tap-primary`,
   a `max(pad, safe-area-inset)` body-padding idiom, `.app` width that widens in landscape). Also: 7 OFL
   kid fonts (**Fredoka** = top heading pick, 159 KB), `gemgrid`'s on-theme **pure-CSS gem shapes +
   star-field + glow/float keyframes** (the only thematically-fitting art — everything else is space/alien
   Kenney sprites = wrong theme), and Kenney **CC0 UI SFX** (click/confirm/coin/levelup). The artifact
   gives a per-asset licence/fit/reuse recommendation + a prioritized "next actions" list. ⚠️ READ-ONLY
   w.r.t. kidenv was honoured (only inspected; the artifact was written into the `spell` repo). Corrected
   one agent misread (CSC already defines `--tap-min:64px`; no raise needed).
   **➡️ §34 PAIRING OUTCOME:** §34 shipped WITHOUT adopting these tokens this round — the surgical
   phone-scoped fix (see #9) met the goal at zero risk to the pixel-identical iPad, whereas a token
   refactor (replace hardcoded spacing with `--gap`/`--pad` clamps, add the `max-height:480px` landscape
   block + `--tap-primary` + Fredoka headings) is a bigger, separable follow-up. The artifact's "Recommended
   Next Actions" is the ready-made backlog for that future pass. Partial §26-B already shipped dependency-
   free earlier: owned-crystal glint + prefers-reduced-motion (§29, csc-v30). Any future integration stays
   on vanilla surfaces WITHOUT touching `src/engine/**`; respect [[prefer-free-services]] +
   [[approval-before-consuming-limits]].
5. ✅ **§26-A #8 (slim child Settings) — DONE (§29, csc-v28).**
6. ✅ **§30 — LEARNING-MODEL REDESIGN + MASTERY (draw) mode (Ian 2026-06-19d) — SHIPPED + LIVE
   (sw `csc-v36`), verified on prod + on Ian's real iPad ("yes that works", 2026-06-19g).** All 6
   steps + the user's 2026-06-19f follow-ups: the draw recognizer is now a real on-device
   EMNIST-letters **CNN** (TF.js, ~94% top-1 — fixes the a/q/c/s confusion), draw mode
   auto-recognises (no button), a **keyboard fallback** (toggle draw↔type), the level picker
   re-aims the learning set, craft gems trimmed. Full detail in §30 below.
7. ✅ **§31 — MASTERY UX + MASTERY-FIRST NUDGING (Ian 2026-06-19g) — SHIPPED + LIVE (csc-v40), writing
   APPROVED on iPad.** Whole-word multi-box writing on wide screens, dictation→§32 voice (shelved),
   mastery-first nudging + `recommendNext`. Full detail in §31 below.
8. ✅ **§33 — PHONE LAYOUT co-visibility, fixed (Ian 2026-06-20) — DONE + QA'd + LIVE (csc-v41).** See §33
   below. ➡️ **Follow-up: §34 (phone PROPORTIONS / visual polish) is OPEN** — usable now, but looks off.
9. ✅ **§34 — PHONE PROPORTIONS / VISUAL POLISH (Ian 2026-06-20) — DONE + QA'd + LIVE (csc-v44).** The
   "titles too big, play area too small" feel is fixed on phones. Root cause confirmed via
   `qa_phone_audit.mjs` geometry: a ~107px DEAD strip between the header and the play area (the session
   **dots + combo bar + EMPTY combo-label**) plus the **empty `.verdict`/`.verdict-chip` reserves** (~57px)
   pushed the play surface down, so `fitPlayArea` shrank the tiles to **scale 0.9** on a fresh long word. Fix
   (styles.css, `@media (max-width:480px)` only): compact that strip + **collapse the reserves that are empty
   on a fresh word** (`:empty{min-height:0}`) → the play area reclaims the space and keeps **FULL-SIZE tiles
   (scale back to 1)** on craft/mastery/mining at 360 & 390; plus a lighter home brand title + tighter
   hero→streak→grid spacing so the title no longer dominates the first screen. **iPad stays pixel-identical**
   (every edit is phone-scoped; the audit re-confirms iPad-portrait `--play-scale=1` across all play modes).
   QA all green: 277 tests, `qa_phone_audit` (iPad guard + co-visibility), `qa_responsive`/`qa_overflow`(Galaxy)/
   `qa_fold`, `qa_mastery`/`qa_s31`, `qa.mjs` 0 console errors, smoke. Visual review of before/after phone
   screenshots confirms a bigger play area + balanced framing. **Deliberately did NOT adopt the kidenv design-
   token system** (see §26-B) this pass — that's a larger refactor that risks the pixel-identical iPad
   constraint; the surgical phone fix achieves the goal at zero iPad risk. Files: `styles.css`, `sw.js`,
   `src/version.js`. ⚠️ OWED: a real-device pass on an actual phone (judged via emulation + screenshots only).
10. ✅ **§35 — REWARD-SCREEN OVERLAY FIX + ORIENTATION UNLOCK (Ian 2026-06-20) — DONE + LIVE (csc-v45/v46).
   ✅ ROTATION CONFIRMED WORKING by Ian (2026-06-20)** after he removed + re-added the home-screen PWA. (1)
   The end-of-session reward's pinned button row covered the gem-haul text on short viewports → fixed
   (full-width primary CTAs + a compact 3-across nav row on narrow phones; inline buttons in landscape;
   iPad portrait unchanged). (2) manifest `orientation` portrait→`any` + `_headers` `no-cache` on the
   manifest (csc-v46). **GOTCHA recorded:** an installed PWA BAKES `orientation` at add-to-home-screen time
   (iOS / Android WebAPK), so the manifest change alone didn't rotate it — the fix required REINSTALLING the
   icon. Full detail in §35 below.

**🆕 NEW BACKLOG (Ian 2026-06-20, in priority order — "update the handoff only, do not code" for these):**

11. ✅ **DISABLE KEYBOARD AUTOFILL (Ian 2026-06-20) — DONE + QA'd + LIVE (csc-v47).** The mobile keyboard's
   autofill / autocomplete / autocorrect / spellcheck suggestion strip is now OFF on every app text input.
   **ROOT CAUSE (the real bug):** the Mastery type input already had all four attributes in code, yet
   suggestions still showed — because the `el()` helper did `node.spellcheck = 'false'`, but `spellcheck` is
   a BOOLEAN IDL property and the non-empty string `'false'` is TRUTHY, so spellcheck stayed ON. Fix: `el()`
   now reflects `spellcheck` via the ATTRIBUTE (handles `false` and `'false'`, before the falsy-skip) + a
   shared **`NO_AUTOFILL`** constant (export in `src/ui.js`: autocomplete/autocorrect/autocapitalize=`off`,
   spellcheck=`false`) applied to ALL inputs: Mastery type-mode (`modes/mastery.js`), Settings learner name +
   onboarding name + both family-password fields, Lab "name your crystal" (`modes/lab.js`), feedback textarea
   (`screens/feedback.js`). Password fields → `autocomplete=off`/`new-password`; parental-gate number →
   `autocomplete=off`. **QA:** 277 tests; **new `scripts/qa_autofill.mjs`** proves `spellcheck===false` +
   all-off both on the `el()` helper (incl. the historical `'false'` bug input) AND end-to-end on the
   mastery / settings-name / feedback / onboarding inputs; smoke, `qa.mjs` (0 console errors), `qa_responsive`,
   `qa_fold`, `qa_overflow`(Galaxy) green; `qa_phone_audit` confirms iPad-portrait `--play-scale=1` preserved
   (only the by-design landscape home-menu scroll "fails", pre-existing per §34). Files: `src/ui.js`,
   `src/modes/{mastery,lab}.js`, `src/screens/{onboarding,settings,feedback}.js`, `src/version.js`, `sw.js`,
   `scripts/qa_autofill.mjs`.
   **➡️ FOLLOW-UP (csc-v48) — Ian clarified the REAL problem: not autofill, the keyboard's predictive
   word-SUGGESTION strip (iOS QuickType / Android Gboard) showing candidate words that GIVE AWAY THE
   SPELLING.** That strip is OS-drawn, not page-controlled, and can't be reliably disabled on a native
   field (Android ignores the HTML attributes). FIX (Ian chose "in-app letter keyboard"): Mastery's "type
   the word" fallback no longer uses a native `<input>` at all — it renders an **APP-DRAWN A–Z keypad**
   (`modes/mastery.js`: `buildKeyboard`/`typeLetter`/`backspace`; QWERTY rows, gold ⌫; new crystal-gem CSS
   `.type-keyboard`/`.key`). Letter keys fill the next empty slot, ⌫ removes the last, tapping a placed
   letter clears just that one; the miss flow keeps correct letters (the old linear input couldn't show
   gaps). A `window keydown` listener keeps a PHYSICAL keyboard working (no suggestion strip on hardware
   keys). **No OS keyboard surface exists → no suggestion strip, on ANY device, offline.** Both layouts:
   narrow `.slots` + auto-check; wide boxes + ✓ Check. The old `.draw-type-input`/`.draw-type-wrap` rules
   were removed. **QA:** 277 tests; `qa_autofill.mjs` now asserts the keypad has 26 letters + ⌫ and **ZERO
   native text inputs** in the mastery screen (so no OS keyboard can appear) + typing a word masters it;
   `qa_s31.mjs` updated for the keypad (wide); draw mode (`qa_mastery`) unaffected; `qa_phone_audit`
   iPad-portrait `--play-scale=1` preserved; smoke green; phone + wide keypad screenshots reviewed
   (polished, on-theme). ⚠️ OWED: a real-device pass on the keypad (iPad + phone) — verified via emulation
   + screenshots only. **➡️ NEXT: #12.**

12. ✅ **LANDSCAPE-PHONE PLAY SIZING + MASTERY PHONE PROPORTIONS (Ian 2026-06-20) — DONE + QA'd + LIVE (csc-v49).**
   Triggered by Ian's report on the new app-keypad: "works, but very cramped on phone — some letters overlap
   their borders in portrait, and in landscape it's tiny because the top bar is still very large vs the little
   letters." Diagnosed objectively with `scripts/qa_phone_audit.mjs` + height instrumentation:
   - **Portrait**: the Mastery word-display tiles were iPad-sized, so a long word (`international`, 13) wrapped
     to **3 big rows** that crowded the keypad. FIX (`@media max-width:480`): smaller `.mastery .draw-slots .slot`
     + tighter `.draw-slots` gap → fits ~2 rows, balanced with the keypad. (Phone DRAW mode draws on the
     separate canvas, so smaller display tiles don't hurt it.)
   - **Landscape**: ROOT CAUSE measured — the **PROMPT is inside `.play-body` and does NOT scale with
     `--play-scale`**, and the full-size header + stacked hear-button/3-line-sentence made it the dominant
     FIXED cost (prompt ≈128px of a ~290px play-body), so `fitPlayArea` floored at `--play-scale 0.35` →
     a tiny keypad. FIX (`@media max-height:520`): thin header (smaller `.header-title` + `.stat`), lay
     **hear button + sentence on ONE row** (`.prompt{flex-direction:row}`), drop the sentence's `max-width:30ch`
     wrap cap (landscape has the WIDTH), and collapse the empty `.verdict`/`.verdict-chip` reserve. Prompt
     128→52px; **landscape `--play-scale` rose 0.35 → 0.65 (740) / 0.80 (844)** = a usable keypad. Plus a
     compact landscape keypad (`.key` short) + box (`.lbox`) sizing.
   - **All phone-scoped** (`max-width:480` / `max-height:520`); **iPad portrait + landscape UNCHANGED** (both
     escape those media queries — audit re-confirms iPad craft/mastery/mining `--play-scale=1`). QA: 277 tests;
     `qa_phone_audit` (iPad scale=1, only the by-design landscape home-menu scroll "fails"), `qa_s31`,
     `qa_mastery`, `qa_autofill`, `qa_overflow`(Galaxy), `qa_responsive` all green; before/after screenshots at
     360/390 portrait + 740/844 landscape reviewed. Files: `styles.css`, `sw.js`, `src/version.js`. ⚠️ OWED: a
     real-device pass on an actual phone (portrait + landscape) — judged via emulation + screenshots only.
   - ✅ **KEYPAD LEGIBILITY follow-up (csc-v50)** — Ian clarified the cramping was the **keypad keys** (not the
     word boxes the round above tuned): letters overran the key borders in portrait, keys were tiny in landscape.
     ROOT CAUSE (portrait): the `.key` font clamp FLOOR (`1.1rem`≈19.8px on the fixed 18px root, and inflatable
     by the iOS text-size setting) won on a narrow phone and overran the ~28px key. FIX: a **viewport-based key
     font** `clamp(0.78rem,4.1vw,1.5rem)` (each phone key ≈9-10vw, so the glyph always fits the key WIDTH and
     can't be text-inflated past it) + flex-centered glyph + `line-height:1` + global `-webkit-text-size-adjust:100%`
     (glyph 19.8→~15px, overflow 0). Landscape: keys were ~16-22px tall → **vh-based key height+font + wider keys**
     using the abundant landscape width, plus freed vertical room (smaller `.lbox` display + compact Check/toggle)
     so `fitPlayArea` doesn't crush them (keys now ~26-33px / ~14-17px font). iPad keypad still fits (caps at
     1.5rem in a 52px key); guards green; cropped+full keypad screenshots reviewed.
   - ✅ **PHONE keypad APPROVED on a real phone (Ian 2026-06-21): "the keyboard looks good on a phone now."**
     ⚠️ **But the keypad looks OFF on OTHER (non-phone) devices** ("on other devices, not so much") → NEW open
     item **#14** below. The phone tuning above must NOT be regressed while fixing the larger form factors.

13. ⏸️ **ONE-SCREEN-AT-A-TIME EXPERIMENT — DEFERRED by Ian (2026-06-21b): "many new issues introduced."** The
   model is **NOT being adopted**; prod stays on the scrolling layout. The isolated test Worker + local branch
   below remain as-is for reference (no action needed; don't poll for a verdict). Original build notes retained:
   **BUILT + DEPLOYED to a test URL (2026-06-21). TEST-ONLY; NOT merged.**
   **LIVE for comparison: https://spell-experiment.ian-gornall.workers.dev** (a SEPARATE, isolated Cloudflare
   Worker `spell-experiment` on workers.dev — NO custom domain, NO routes, and NO KV binding, so it cannot
   touch prod or prod data; Ian chose the fully-isolated option). Code lives on the LOCAL branch
   **`experiment/one-screen`** (committed, NOT pushed, NOT merged — `main`/prod untouched; tag `csc-v52-exp1`).
   **What it does:** `src/experiment.js` `initOneScreen()` adds `html.one-screen` + a MutationObserver that
   re-fits whatever screen `app.js` mounts (on swap/resize/rotate). Per screen: scale the WHOLE screen to fit
   the viewport; if that would fall below a legibility floor (0.6), split the body into stepped PAGES
   (fixed-height clip slots, scaled inner) with a ‹ Prev · x/n · Next › bar. The home/menu hub always SCALES
   (never split — landing on a page with no menu is worse). `fitPlayArea` is neutralized (the global per-screen
   scale handles play modes uniformly). Additive — NO screen files edited; all CSS branch-scoped under
   `html.one-screen`. **Verified (`scripts/_arch/qa_onescreen.mjs`) on the LIVE URL: every screen fits with
   ZERO overflow at phone 390×844, iPad portrait 820×1180, iPad landscape 1024×768** (home scales 0.55–0.86;
   Settings/Progress/Catalog paginate where long; play screens mostly natural). **To redeploy after edits:**
   on the branch, `node scripts/build_deploy.mjs` then (with `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` in
   env) `npx wrangler deploy --config wrangler.experiment.toml`. ⚠️ Branch is local-only — `git push -u origin
   experiment/one-screen` to back it up (a non-main push won't deploy prod, but MAY trigger a Cloudflare preview
   build — left undone to avoid surprise build-credit use). ⚠️ Real-device pass still owed (emulation-verified).
   **➡️ Awaiting Ian's verdict: adopt the one-screen model, keep scrolling prod, or a hybrid.**

14. ✅ **MASTERY KEYPAD on NON-PHONE devices — DONE + QA'd + LIVE (csc-v52, 2026-06-21).** Ian after csc-v50:
   "the keyboard looks good on a phone now. on other devices, not so much." **DIAGNOSED via interactive visual QA**
   (`scripts/_arch/qa_keypad_look.mjs` — screenshots + geometry at iPad portrait 820×1180 / iPad landscape 1024×768 /
   desktop 1440×900): (a) the keypad was a small NARROW 540px island whose ~45px keys were DWARFED by the full-size
   word-display boxes (inverted hierarchy — the *passive* display bigger than the keys you press); (b) **iPad LANDSCAPE
   floored `--play-scale` to 0.35 → keys ≈9px, unreadable**, because the `.prompt` (hear button + 2-line sentence) +
   the big `.play-body` gap are FIXED costs that don't scale, so `fitPlayArea` crushed the keypad chasing a tiny
   overflow; desktop similarly shrank to 0.7. **FIX (styles.css, two scoped blocks):** ① `@media (min-width:481px) and
   (min-height:521px)` (= non-phone; excludes phone portrait by width + phone landscape by height, so the APPROVED phone
   keypad is untouched and there are no specificity fights with the `max-height:520` block): wider **720px** keyboard +
   bigger clamp-sized keys (`max-width 64px`, `height clamp(50,7.2vh,66)`, `font clamp(1.4rem,4.4vh,2rem)`), and the
   TYPE-mode word boxes (`.draw-boxes.display-only .lbox`, a passive display) shrunk to free vertical budget. ② the same
   query `and (orientation: landscape)`, scoped to `.mastery`: lay the prompt on ONE row, drop the sentence's 22ch wrap
   cap, cut the `.play-body` gap — so `fitPlayArea` keeps the keypad full-size in landscape. **RESULT:** all non-phone
   now `--play-scale=1` with ~36px keys (iPad-landscape 0.35→1.0, desktop 0.7→1.0); phone keypad byte-identical (keys
   31×40, scale 1). DRAW-mode boxes (`:not(.display-only)`) + the §31 iPad-portrait layout are untouched. **QA all green:**
   277 tests, `qa_s31` (draw+type wide / phone narrow), `qa_mastery`, `qa_autofill`, `qa_overflow`(Galaxy), `qa_responsive`,
   `qa_fold`, smoke; `qa_phone_audit` shows only the 2 documented by-design landscape home-menu fails (no new regression,
   iPad-portrait `--play-scale=1` preserved). Files: `styles.css`, `sw.js`, `src/version.js`. ⚠️ OWED: a real-device pass
   on an actual iPad (portrait + landscape) — judged via emulation + screenshots only. **The now-good PHONE keypad
   (`@media max-width:480`/`max-height:520`) must stay untouched in any follow-up.**

15. ⛔ **DESKTOP-CHROME HUMAN-QA PASS (Ian, 2026-06-21b) — THE CURRENT WORKING BACKLOG. See §36 below.** ~26
   items from a hands-on desktop-Chrome QA, grounded with file pointers + diagnoses + recommended approaches,
   grouped: **A** quick CSS bugs (Geo wink, desktop max-width, Progress padding, tiny phone geode, dead
   "Visit the Crystal Lab" link, back-button proportions, ugly/horizontal scrollbar) · **B** audio timing +
   spelling (lag/mid-phrase, praise↔next-word overlap, **British SPELLINGS in the word data + UI copy — NOT
   the voice**: flip `centre`/`programme`/`theatre` + UI "colour"/"practise") · **C** learning-model clarity
   (**diagnostic start-level placement = DISCUSS-FIRST**, scary "2881 new to find", the **two-systems "Repair"
   mismatch**) · **D** bigger design (first-run lands in locked Mining, **Crystal Lab redesign** = riff off a
   real word, set-size = 6 fixed + per-dig mining size, **100-level cavern map + hide SKIPPED levels**, catalog
   real photos+science) · **E** idle/pause/focus (hint not past last letter, **manual Pause button**, no hints
   while paused, **background tab must not advance/hint** — confirmed bug, screen-time off-ramp) · **F** defaults
   (mining 2 choices, daily reminder ON). **Ian (2026-06-21c): fix the less-involved items FIRST; the diagnostic
   placement (C1) needs a full design discussion before any build.** **Nothing coded yet — handoff only.**

> Ian ran a hands-on QA on **desktop Chrome** and gave the list below. This section captures every item
> with a grounded diagnosis + file pointer + recommended approach, grouped by size. **Nothing here is built
> yet** — this is the new working backlog (supersedes the now-DONE items #1–#14). Several items are DESIGN
> DECISIONS that need Ian's confirmation before building (flagged 🟡). The phone keypad (§11/§12, csc-v50)
> and the pixel-identical iPad-portrait layout must NOT regress while addressing these. Follow `QA.md`
> (interactive visual QA) — most of these are "looks/feels wrong," which the objective guards can't catch.

**ANSWERS to Ian's direct questions (so they're recorded, not just fixed):**
- **"How are words picked / sorted? Point me to the reference file."** The pipeline is three files:
  **`data/words.js`** = 2,919 words ordered by real-world FREQUENCY (most-common first), tagged with a
  `tier` (age band) + `pattern` (one of 63 spelling-pattern families) + `rank`. **`src/engine/categories.js`**
  = the §30 state machine: every word is `new → learning → known → mastered` (+ `tricky`). *Learning* is a
  fixed working set of `setSize` words (default 10); a word becomes *known* after being **crafted correctly
  TWICE IN A ROW**, and *mastered* after **one MASTERY (draw) success**. **`src/engine/selection.js`** turns
  those categories into each mode's word list (Craft focuses learning + ~25% review; Mining = known∪mastered;
  Mastery = known-lead). A word is introduced lowest-`rank` (most common) first at the current tier. *(There
  is ALSO a parallel legacy selector, `engine/session.js`+`engine/progress.js`, still used by the "Repair"
  path — see item C3, which is the source of Ian's confusion.)*
- **"How is 'Repair' determined?"** Two DIFFERENT systems are both live (the root cause of the mismatch):
  the green dots on the learning words come from `categories.learningProgress` (craftStreak 0→2 toward known),
  but the **home "Repair (N)" card** (`screens/home.js:103`) and Progress "Repair N words" (`screens/progress.js:148`)
  read the **legacy continuous tracker's "cracked crystals"** = `lapsedWords(state.tracker)` (words whose
  continuous mastery dipped after a miss), NOT the categories. So "6 words each with one green" (categories)
  vs "repair 4 words" (legacy tracker) don't reconcile, and Repair can appear even with nothing visibly
  "cracked." **This dual-bookkeeping is the bug to resolve (item C3).**
- **"How many cavern depths are there?"** `src/engine/narrative.js` defines **8 named ZONES**; cavern
  **depth = 1 + floor(mastered / 8)** (≈8 mastered words per new depth; see `app.js`). Depth is already
  driven by MASTERED count (what Ian wanted) but it's not surfaced well — see item D4 (the 100-level map idea).

### A. Quick visual / CSS bugs (low-risk, phone+desktop)
- **A1. Geo's wink sticks at start → wants normal eyes.** `screens/onboarding.js:99,120` render the mascot with
  `{ mood: 'wink' }`, and `.mascot.wink` (styles.css) holds the wink. Make the wink a brief one-shot GREETING
  animation that resolves back to normal eyes (e.g. timed class removal), not a persistent state.
- **A2. Desktop too wide → set a max-width.** The `.app` container has no desktop cap; on a wide monitor it
  stretches. Add a `max-width` (e.g. ~720–900px, centred) at wide breakpoints. Keep iPad/phone unchanged.
- **A3. Progress screen: category text (known/mastered/new-to-find) too close to the borders** (`screens/progress.js:143`
  `.seg` tiles) — looks janky. Add internal padding / breathing room.
- **A4. Progress screen: "personal bests" text also too close to the edge/border.** Same padding fix.
- **A5. Geode is tiny on phone, unusable** (`screens/geode.js` + its CSS). Size the tap-to-open geode up on
  `@media max-width:480` so it's a comfortable touch target.
- **A6. "Visit the Crystal Lab" does nothing.** `screens/progress.js:276` is STATIC text in the empty
  Specimen-Collection state, not a link. Make it a real button → `ctx.nav('lab')` (or route via home).
- **A7. Back button looks oddly proportioned on every screen.** The shared `header()` (`src/ui.js`) `.back`
  button + its CSS — re-proportion (size/padding/alignment).
- **A8. Ugly desktop scrollbar (Chrome) + a HORIZONTAL scrollbar appears when a box pulses/highlights.** The
  `.pulse`/highlight animation (styles.css) overflows by a sub-pixel and trips an x-scrollbar; style the
  scrollbar and contain the pulse (transform-based, or `overflow:clip` on the animating container). Ties into
  the §29 no-horizontal-pan guards — keep `qa_overflow`/`qa_galaxy` green.

### B. Audio / speech timing
- **B1. Audio lags / starts mid-phrase** (noted during setup). Likely the clip starts playing before it's
  buffered, or the iOS/Chrome audio-prime path races the first `say()`. Investigate `src/audio.js` clip
  playback + the §32.B "Tap to start" prime/`whenReady` gate (desktop has no gesture-gate, so first-play may
  fire un-buffered).
- **B2. Craft praise + next word overlap / praise sometimes silent / partial overlap.** Recurring race: `say()`
  cancels in-flight speech, so praise and the next dictation step on each other. There is NO real speech QUEUE
  — fix by serialising utterances (a proper queue with onDone chaining) in `src/audio.js`, and gate the
  next-word advance on praise completion (`speakPraise` onDone) in `modes/puzzle.js`/`mastery.js`. (Prior §31
  notes flagged this for mastery; it's still biting Craft.)
- **B2-NOTE — paused/background interaction:** B2 overlaps E-items (a paused or backgrounded session must not
  fire praise/next-word either). Fix the queue + visibility gate together.
- **B3. British SPELLINGS — NOT the voice (Ian CORRECTED 2026-06-21c).** Ian hit **"centre"** and
  **"practising"** in the app's INSTRUCTIONS and as a SPELLING WORD. This is a spelling audit, *not* an
  audio/accent change (the Kore-voice theory was wrong; ignore it). LOW-involvement (find-replace), do-first.
  Two fronts:
  - **Word data (`data/words.js`):** most entries are ALREADY American with the British form correctly listed
    as a `misspelling` (color/colour, license/licence, practice/practise, defense/defence, jewelry/jewellery,
    mom/mum, organization/organisation) — leave those. But exactly **THREE genuine British TARGET words slipped
    through and must flip to American** (confirmed by grep): **`centre`→`center`** (rank 762, tier 5),
    **`programme`→`program`** (rank 1344, tier 6), **`theatre`→`theater`** (rank 2199, tier 8). For each: flip
    the target, move the British form INTO `misspellings` (so it's the WRONG alternative, consistent with the
    rest), fix `syllables`/`pattern`/`sentence`, and REGENERATE that one clip (`center`/`program`/`theater`
    .mp3 — 3 clips, trivial). ALSO sweep the `sentence` fields for stray British spellings (e.g. centre's
    sentence reads "The gem centre had…"). If `data/words.js` is rebuilt via `scripts/merge.mjs`, fix at source.
  - **UI copy / instructions (user-VISIBLE strings):** "colour"→"color" in `engine/ui_phrases.js:24` ("Pick
    your crystal colour!"), `screens/onboarding.js:143` ("Pick your crystal colour."), `screens/settings.js:1139`
    ("Crystal colour" label) and the three `engine/catalog.js` facts (lines 37/49/61: "its colour…", "the
    colour of…", "changes colour…"); "practise/practising"→"practice/practicing" in `screens/printables.js:205`
    ("What to practise") and `modes/rhythm.js:461` ("⛏️ Keep practising"). **Do a FULL visible-string sweep**
    (the grep capped at 60 hits). CSS class names (`colour-grid` etc.) + code COMMENTS are internal — leave them
    or fix cosmetically, no rush.
  - 🟡 Optional later: a British-spelling SETTING so a UK family can opt in — but **American is the default**.

### C. Learning-model clarity (the confusing parts)
- **C1. ✅ BUILT + QA'd locally (csc-v55, 2026-06-22b) — see top banner. Designed with Ian (3 decisions),
  built test-first as `engine/placement.js` + the band-based level model; NOT yet deployed (awaiting review).**
  Original brief: Ian: the initial level must come from **DIAGNOSING the student** — specifically
  finding the **MOST COMMON word they DON'T know** — not from an age/level picker, and *"I don't think we're
  doing that well"* today. This SUPERSEDES the earlier "drop ages/descriptors from the picker" tweak: the
  picker leaking AGE labels (`screens/onboarding.js` level select) is just a symptom; the real fix is a
  PLACEMENT DIAGNOSTIC that walks the frequency-ordered list to find the first unknown word and seeds the
  start level there. ⚠️ **This is one of the "more involved" items and needs a FULL DESIGN DISCUSSION BEFORE
  ANY BUILD** — do the less-involved fixes first. (Hooks that exist: `data/words.js` is frequency-ordered, so a
  diagnostic could binary/linear-search it; `categories.setLevelAndRefill(state, level, pool)` already re-aims
  the working set once a level is chosen.)
- **C2. 🟡 "2881 new to find" is overwhelming.** `categories.categorySummary.newRemaining` (all unseen dataset
  words) shown on Progress/home. Replace the scary total with **"words to the next cavern depth"** (depth is
  already mastered-driven). Pairs with D4.
- **C3. Unify the "Repair" model (the 6-dots-vs-repair-4 bug).** Resolve the dual bookkeeping (see answer
  above): either drive Repair from the §30 categories (`tricky`/missed-learning) so it matches the dots, or
  clearly separate "in-progress learning" from "repair." **Add a YELLOW light** on words that were missed /
  need repair (Ian's suggestion) so the kid can SEE which need fixing. Files: `screens/home.js`,
  `screens/progress.js`, `modes/puzzle.js` (review mode), `engine/categories.js` vs `engine/{session,progress}.js`.

### D. Bigger design / feature requests (need a build plan; several 🟡 need Ian's sign-off on specifics)
- **D1. 🟡 First-run drops you into MINING, which then locks.** The intro starts a recognition/mining-style
  session, but the §30 unlock chain LOCKS mining until `setSize` words are mastered — contradictory + confusing.
  Desired: start first-run in **Craft**, or a **guided tour of the menu**. (Trace the first-run path:
  `app.js` boot routing → `onboarding` → first activity; reconcile with the home unlock gates.)
- **D2. 🟡 Crystal Lab REDESIGN (current build ≠ Ian's vision).** Today `modes/lab.js` invents a NONSENSE word
  → unscramble → draw → name. Ian envisioned: give a **REAL word**, let the kid **riff** off it by changing a
  letter **that doesn't break the spelling pattern** (ideally driven by the patterns giving them trouble) →
  hear the original spoken → modify → hear the new word again → DRAW it → save (NO rename). This is a from-scratch
  lab flow keyed off `engine/categories` troublesome patterns + `engine/nonsense`/pattern data. Confirm the exact
  "change a letter within the pattern" rule with Ian before building.
- **D3. 🟡 Set-size semantics change.** Make words-before-mastery **6 by default and UNCHANGEABLE** (the count for
  each Craft / Mastery set). Then for **MINING**, let the kid pick one of the four sizes (6/10/15/20) **before each
  dig** (the lever that used to live in Settings moves to a pre-dig choice). Touches `state.js` (`length`/setSize
  default 10→6 + lock for craft/mastery), `engine/categories.js` (setSize), `modes/rhythm.js` (per-dig size),
  Settings.
- **D4. 🟡 Real cavern MAP (100 levels) + HIDE SKIPPED levels (Ian 2026-06-21c).** Base depth on # mastered
  (already is), make it OBVIOUS — a scrollable cavern map of ~100 levels (~30 words each); current level big;
  tap to zoom; reached levels scrollable above, locked levels greyed below. **NEW (Ian):** if the adaptive
  level JUMPS a student ahead, the SKIPPED lower levels stay HIDDEN/locked TOO — creating an incentive to **go
  BACK and master the easier words** (so EVERYTHING gets mastered, not just the current tier; pairs with the
  §30 "tricky"/repair backfill). Big new screen (augments the 8-zone `narrative.js`); one of the more-involved
  items. Confirm scale (100 × 30 ≈ the 2,918 dataset — workable).
- **D5. 🟡 Crystal catalog detail: real photos + elementary science.** On a catalog crystal's detail view, pull
  in an actual PHOTO + kid-level facts (hardness, etc.). Files: `engine/catalog.js` + `screens/catalog.js`.
  ⚠️ Needs image SOURCING with a clear licence ([[prefer-free-services]] — e.g. CC0/Wikimedia mineral photos);
  flag any dependency. Confirm with Ian where assets come from.

### E. Idle / hints / pause / focus (engagement + healthy-use)
- **E1. Hints should STOP before the last letter is revealed; then escalate to the pause screen.** Today the
  idle guard nudges at 15s and the progressive HINT (`💡`/auto-reveal in `modes/puzzle.js`) can fill in letters;
  cap the auto-reveal so it never gives the FINAL letter, then let the 45s pause overlay take over.
- **E2. Add a user-initiated PAUSE button.** Currently the ONLY pause is the auto-overlay at 45s idle
  (`ui.js createIdleGuard`, `pauseMs=45000`). Add a manual Pause control to the play header.
- **E3. While PAUSED, give no more hints.** The auto-overlay already suppresses nudges (`arm()` returns when an
  overlay is up), but a MANUAL pause must also stop the progressive hint timers + the lab/mastery step timers.
- **E4. Background tab must NOT advance / hint / auto-fire — only when focused.** CONFIRMED bug: `createIdleGuard`
  (`src/ui.js`) and the step timers in `modes/lab.js`/`modes/mastery.js` use `setTimeout` with NO
  `document.hidden`/`visibilityState` check, so nudges, auto-reveals and auto-advances keep firing in a
  backgrounded/blurred tab. Gate ALL idle/auto-advance timers (and audio) on `document.visibilityState ===
  'visible'`; pause on `visibilitychange`→hidden, resume on visible. (Only `app.js`=sync and `pwa.js`=update
  check currently listen to visibility.)
- **E5. 🟡 Screen-time off-ramp / forced break.** Ian: define a MAX session length, then lock the child out for
  ~5 min showing just a printable WORD LIST to study with a partner (we already have `engine/printables.js`).
  Healthy-use guardrail. Confirm the time cap + lockout behaviour with Ian. (Pairs with the existing pause/idle
  system; this is a deliberate, not idle, break.)

### F. Defaults to change (small, but confirm the push one)
- **F1. Mining answer-tiles = 2 by default** (`state.js defaultSettings().optionCount` is **3** → 2); keep 3/4 as
  Settings options. (`modes/rhythm.js` reads `settings.optionCount`.)
- **F2. Daily reminder ON by default.** `defaultSettings()` has no reminder field → it's currently OFF/opt-in
  (`src/push.js`). ⚠️ Web Push needs OS permission, so "on by default" really means default the toggle ON +
  prompt for permission early (you can't silently force-enable). Confirm the prompt timing with Ian (COPPA:
  keep it behind the grown-up/parental context). Worker cron already exists (`0 16 * * *`).
- **F3. (from D3) words-per-dig default 10→6 + lock for craft/mastery** — listed under D3.

> **PRIORITISATION (Ian 2026-06-21c): "fix the others first, they are less involved."**
> - **DO-FIRST — less involved (no further discussion needed):** A1–A8 (CSS bugs) · **B3 (British SPELLINGS —
>   word data + UI copy; NOT the voice)** · B1/B2 (audio lag + the praise↔next-word queue) · C2 ("new to find"
>   → words-to-next-depth) · C3 (unify Repair + yellow light) · E1/E2/E3/E4 (hint cap, manual Pause, no-hints-
>   while-paused, **background-tab gating** — the confirmed bug) · F1 (mining 2 choices) · F2 (reminder default —
>   small; confirm the prompt timing).
> - **MORE INVOLVED / DISCUSS-FIRST (do AFTER the above; some need Ian's sign-off before any build):**
>   **C1 (diagnostic START-LEVEL placement — Ian wants a FULL DESIGN DISCUSSION first; "we're not doing that
>   well")** · D2 (Crystal Lab redesign) · D4 (100-level cavern map + hide skipped levels) · D1 (first-run flow)
>   · D3 (set-size = 6 fixed + per-dig mining size) · D5 (catalog photos+science) · E5 (screen-time off-ramp).
> - Bump `sw.js`/`version.js` per deploy; keep all §29/§33/§34 phone + iPad guards green; don't regress the
>   approved phone keypad or the pixel-identical iPad-portrait layout.

---

## §33 — PHONE LAYOUT: word + buttons co-visible for ANY word length (Ian 2026-06-20) — ✅ DONE + QA'd (csc-v41)

> **The user's ask:** "truly fix the phone version once and for all — buttons viewable at the same
> time as the word being filled in regardless of word length, nothing overlaps, is crammed, etc.
> throughout the app." (The alternative offered — a Phaser rebuild — was declined: the complaint is a
> DOM/CSS responsive-layout problem; Phaser is a canvas engine that would make co-visibility on varied
> screen sizes HARDER, not easier, and would discard the whole tested engine. So path A: fix the real thing.)
>
> **Root cause (found via `scripts/qa_phone_audit.mjs`, a new objective probe):** on a long word the
> word-slots WRAP to 2–3 rows, and that plus the iPad-tuned ~44px vertical gaps pushed the interaction
> surface below the fold — the **letter TRAY (Craft)** and the **Clear/Type buttons + candidates
> (Mastery)** fell off-screen, so you had to scroll and couldn't see the word AND the buttons together.
> Objectively reproduced: 360×740, 390×844, and 844×390 all clipped for words like "international"/"information".
>
> **The fix (no engine change):**
> - **`--play-scale` fit-to-viewport.** A CSS custom property multiplies into every slot / tray-tile /
>   candidate / draw-canvas / mastery-box / mining-tile dimension. `fitPlayArea(playBody)` (new, in
>   `src/ui.js`) shrinks it (1 → floor 0.35, in 0.05 steps) until `.play-body` no longer overflows its
>   own height — so the word, the interaction surface, AND the action buttons stay co-visible for ANY
>   word length. Wired into all four play modes (`puzzle`/`mastery`/`rhythm`, called per word + on
>   renderCandidates/clear + on resize/rotate). **Defaults to 1 → tablets are untouched when nothing
>   overflows.**
> - **Phone CSS compaction** (`styles.css`): a `@media (max-width:480px)` block tightens the play-body
>   gap/padding, the dictation prompt (hear button, sentence, verdict), the control rows; a
>   `@media (max-height:520px)` block collapses harder for LANDSCAPE (compact Check button + speedmeter,
>   drop the non-essential progress dots / empty combo bar / redundant draw-hint) so a 390px-tall band fits.
> - The clamp MAXes were all kept identical, so iPad (which always hits the max) renders pixel-for-pixel
>   as before. **iPad PORTRAIT verified scale=1 (the §31 user-approved layout, unchanged); iPad LANDSCAPE
>   now also shrinks a hair to keep its controls co-visible (looks great).**
>
> **QA (all green):** `npm test` 273; **`node scripts/qa_phone_audit.mjs`** = every PLAY screen co-visible
> at 360/390 portrait + 844 landscape + iPad portrait/landscape, for the longest words, FRESH + mid-draw
> candidate states (3/3 landscape sample runs clean; only the home MENU scrolls, which is by-design);
> `qa_responsive`/`qa_overflow`(Galaxy)/`qa_fold` green; `qa_mastery`(phone)/`qa_s31`(wide+narrow) green;
> `npm run smoke` green; `qa.mjs` 0 console errors. sw `csc-v40`→**`csc-v41`** + `src/version.js` bumped
> (no new precached files). Files: `styles.css`, `src/ui.js`, `src/modes/{puzzle,mastery,rhythm}.js`,
> `sw.js`, `src/version.js`; new probe `scripts/qa_phone_audit.mjs`.

---

## §34 — PHONE PROPORTIONS / VISUAL POLISH (Ian 2026-06-20) — ✅ DONE + QA'd + LIVE (csc-v44)

> **✅ SHIPPED (csc-v44).** Summary + root-cause + QA in §0 OPEN BACKLOG #9 above. In one line: the dead
> chrome strip above the play area (session dots + combo bar + EMPTY combo-label, ~107px) and the empty
> `.verdict`/`.verdict-chip` reserves (~57px) were collapsed on phones (`@media max-width:480px`, the
> `:empty{min-height:0}` idiom), so `fitPlayArea` keeps FULL-SIZE play tiles (scale 1, was 0.9) — the
> "play area too small" fix — plus a lighter home brand title + tighter hero spacing. iPad stays
> pixel-identical (phone-scoped edits only; audit re-confirms iPad-portrait scale=1). ⚠️ OWED: a
> real-device pass on an actual phone. The original brief is retained below for context.
>
> **Ian's feedback (verbatim sense), after §33 shipped:** "The app is usable now on phones but looks
> pretty weird. The proportions are off in a way that is hard to describe — like the **titles are too
> big and the play area too small**. But again, it works, so we've made progress. Particularly,
> **margins, padding, text sizes, etc. could be better optimized for phones.**"
>
> **Read this as:** §33 solved the FUNCTIONAL problem (word + interaction surface + buttons co-visible
> for any word length — no more clipping/scrolling). What's left is a VISUAL-HIERARCHY / proportions
> problem, NOT an overflow bug. The objective guards (`qa_overflow`/`qa_fold`/`qa_phone_audit`) are all
> green and CAN'T catch "looks weird" — so this needs **interactive visual QA** (screenshot → LOOK →
> adjust → repeat), per `QA.md` + [[interactive-visual-qa]]. iPad is the primary device and the
> §31-approved iPad layout must stay **pixel-identical** (don't regress it while tuning phones).
>
> **Likely root cause (a lead, not a diagnosis — verify with screenshots first):** §33's `--play-scale`
> SHRINKS the play area to fit the viewport height, but the surrounding CHROME (the home/header titles,
> per-screen `h1/h2`, mascot bubble, card titles, paddings, margins, header height) stayed iPad-tuned.
> So on a ~360–414px phone the big titles + generous spacing eat the viewport, `fitPlayArea` then has to
> shrink the tiles hard to fit what's left → the title dominates and the play area looks tiny/cramped.
> Net: the CHROME should shrink on phones so the PLAY AREA gets a larger share (and needs less
> down-scaling), and the type/spacing scale should step down for phones.
>
> **MEASURED EVIDENCE (2026-06-20, `scripts/qa_phone_audit.mjs` + screenshots — confirms the lead):**
> - **The top chrome is a ~250px FIXED block that doesn't shrink with the viewport.** Home content
>   (`.menu-card.craft`) starts at **top=252px on BOTH 360- and 390-wide phones** — i.e. **34% of a 740px
>   phone / 30% of an 844px phone is consumed by header + title before any content**, vs only **27% on the
>   1180px iPad** (where the same chrome is a smaller fraction, so iPad looks fine). The chrome is
>   iPad-proportioned and eats a disproportionate share of a short phone.
> - **Craft @390×844: an ~81px DEAD GAP** between the dictation sentence (`.sentence` bottom=330) and the
>   word slots (`.slots` top=411); the play content (slots h=135 + tray h=202) is squeezed into the lower
>   ~half. The screenshot shows the same: a big empty band in the upper-middle, loose spacing.
> - **`--play-scale` already drops to 0.9 (craft) / 0.85 (mastery candidates) at 360px** while the chrome
>   stays full-size — the play area shrinks *before* the chrome does. (At 390 scale is still 1, yet it
>   still "feels off" because the chrome is big + the gap is wide.) iPad portrait correctly stays scale=1.
> - The audit's only hard FAILs are the two LANDSCAPE home menus (a by-design scroll) — i.e. **no new
>   functional/overflow regression; this is purely proportions.** So the next session can tune freely
>   against `qa_phone_audit` numbers (push the chrome% DOWN, the play-area share UP) without fear of
>   breaking co-visibility, as long as the guards stay green.
>
> **Suggested approach (confirm with Ian if a direction is ambiguous; otherwise pick the obvious tuning):**
> - **Phone type scale** — step down the big type on `@media (max-width:480px)` (and a tighter tier at
>   `≤360px`): `.home-title`, `.header-title`, screen `h1/h2`, `.mascot` text, card/section titles. A
>   fluid `clamp(min, vw-based, max)` keyed to viewport width would scale smoothly phone↔tablet instead of
>   a hard breakpoint (and keeps the iPad max pinned).
> - **Tighten chrome spacing on phones** — header height, screen padding, card padding, section gaps,
>   the gem/depth header — so vertical budget goes to the play area, not margins.
> - **Give `.play-body` a bigger share of the phone viewport** so `fitPlayArea` rarely needs to drop below
>   ~0.8 (raise the effective floor by shrinking chrome, not tiles). Check the resulting `--play-scale`
>   values in the audit at 360/390/414 — if they're well under 1 on short words, the chrome is too greedy.
> - **Re-balance the dictation prompt** (hear button / sentence / verdict) sizes for phones — these sit
>   directly above the play area and contribute to the "title too big, play too small" feel.
>
> **Constraints / DoD:** iPad portrait + landscape unchanged (re-verify scale=1 on iPad portrait); keep
> `qa_responsive` / `qa_overflow`(Galaxy) / `qa_fold` / `qa_phone_audit` green (no new horizontal pan or
> below-fold regressions); vanilla CSS where possible. **Verify by EYE on real phone widths** (360×740,
> 390×844, 414×896 portrait; a landscape pass) — take before/after screenshots and judge proportions, not
> just overflow. Touches mainly `styles.css` (+ maybe `src/ui.js` `fitPlayArea` floor). Bump `sw.js` /
> `version.js` on deploy. iPad-primary, phones a strong second.
>
> **➡️ SUGGESTED PAIRING with §26-B (kidenv asset review):** consider doing §26-B first or alongside this
> — the kidenv inventory may surface reusable phone-friendly assets and, especially, **spacing / type-scale
> tokens** from the other kid-apps that this proportions tuning can adopt, so the two land together.

---

## §35 — REWARD-SCREEN OVERLAY FIX + ORIENTATION UNLOCK (Ian 2026-06-20) — ✅ DONE + QA'd + LIVE (csc-v45/v46) · ✅ ROTATION CONFIRMED WORKING

> **✅ UPDATE 2026-06-20: rotation now WORKS on Ian's device** after he removed + re-added the home-screen
> PWA (the installed-PWA orientation bake, below). Both §35 issues are fully resolved on-device.
>
> Two issues Ian reported after §34 shipped ("its working ok" + these):
>
> **(1) "When I end a crafting session, buttons appear overlaying a screen behind it that scrolls and
> can't really be seen."** ROOT CAUSE (reproduced objectively with a throwaway auto-solver probe): the
> end-of-session reward (`.reward`, shared by craft `modes/puzzle.js` + mastery + mining) pins its action
> `.row` to the bottom on short viewports (`@media max-height:800px`, the §27 CTA-reachability design). With
> up to **5 buttons** (Craft again · Master them · Mine · Progress · Home) the pinned row **flex-wrapped to
> ~388px = ~60% of a short phone**, so it COVERED the gem-haul / "now master them" text scrolling behind it.
> Measured: at 360×640 the reward overflowed +198px with the buttons overlapping "+gems crafted".
> **FIX (styles.css):** on NARROW phones (`max-height:800px AND max-width:480px`) the 1–2 PRIMARY CTAs go
> full-width + prominent and the 3 secondary nav buttons pack into ONE compact row → the pinned block drops
> to ~188px and the haul stays readable above it. In LANDSCAPE (`max-height:520px`) it drops the decorative
> emoji + the Total/next-step paragraphs and lays every button INLINE (auto-width) so all 5 fit in ~1–2 short
> rows. Scoped so iPad-landscape (1024×768, wide+short) keeps NATURAL-width buttons (no stretched primary)
> and **iPad PORTRAIT is unchanged** (1180px tall → the short-tier never applies). Also shortened
> `"⛏️ Mine (fast)"` → `"⛏️ Mine"` so the nav row fits a 360px phone. **Verified overflow=0 at 360/390
> portrait, 390×690 (toolbar), 740×360 landscape, 820×1180 iPad portrait, 1024×768 iPad landscape**, with
> before/after screenshots eyeballed. The same `.reward` fix automatically covers the mastery + mining
> reward screens (fewer buttons, also tidier).
>
> **(2) "I should be able to tilt into landscape and I'm locked in portrait."** The PWA `manifest.webmanifest`
> had `"orientation": "portrait"`, which locks an INSTALLED PWA. Changed to **`"orientation": "any"`** — the
> app already has full landscape CSS (§33 + the new §35 landscape reward tier), so rotation now works. (An
> already-installed PWA re-reads the manifest on the next SW update, so csc-v45 unlocks it.)
>
> **QA (all green):** 277 tests · `qa_phone_audit` (iPad-portrait `--play-scale=1` preserved, phones clean) ·
> `qa_overflow`(Galaxy) ✅ no inner-scroll/bleed · `qa_fold` PASS · `qa_responsive` all viewports `horiz=0` ·
> the dedicated reward repro across 6 viewports. Files: `styles.css`, `manifest.webmanifest`,
> `src/modes/puzzle.js` (label), `sw.js`, `src/version.js`. sw `csc-v44`→**`csc-v45`**.
>
> **⚠️ FOLLOW-UP (csc-v46): rotation still didn't work for Ian after csc-v45.** Root cause is NOT the app
> (verified: nothing in code locks orientation — no `screen.orientation.lock`, no rotate-overlay, no
> landscape-blocking CSS; the live manifest serves `orientation:any`; landscape RENDERS cleanly on home/
> craft/reward at phone-landscape + iPad-landscape, 0 horizontal overflow). It's the **installed-PWA
> orientation BAKE**: iOS (and Android via the generated WebAPK) read `orientation` at ADD-TO-HOME-SCREEN
> time and do NOT re-read it when the manifest changes — so an app installed under the old `portrait` stays
> portrait until it's REMOVED + RE-ADDED. csc-v46 adds `Cache-Control: no-cache` for `manifest.webmanifest`
> in `_headers` so the reinstall fetches the fresh manifest (not a stale HTTP copy). **RESOLUTION:** Ian
> deleted the home-screen icon → re-added it from the browser → **rotation now works** (2026-06-20). (For
> reference: in a plain browser tab the manifest doesn't apply at all, so there it rotates with the device,
> gated only by the OS rotation lock.) ➡️ **Follow-up landscape polish is now backlog #12** — in landscape
> phone the play buttons + chosen letters render too small; see §0 OPEN BACKLOG #12.

---

## §30 — LEARNING-MODEL REDESIGN + MASTERY (DRAW) MODE (Ian 2026-06-19d) — ✅ SHIPPED + LIVE (csc-v36)

> **DONE + DEPLOYED: all SIX build-order steps + the user's 2026-06-19f follow-ups, shipped + verified.**
> 262 tests green; `npm run smoke` green; `qa_overflow`/`qa_responsive`/`qa_fold` green; visual probes
> reviewed. **LIVE on prod (sw `csc-v36`).** The full §30 learning model runs end-to-end: discrete
> categories, focused craft with gem-cost hints, the ~5s mining timer, the **draw-the-letters Mastery
> mode**, the **Craft → Mastery → Mining unlock chain**, and the kid-visible Progress category view.
>
> **USER FOLLOW-UPS (2026-06-19f) — all SHIPPED:**
> - ✅ **Settings level change re-aims the learning set** (`categories.setLevelAndRefill`; was a no-op). v35.
> - ✅ **Craft gems trimmed** (`CRAFT_MULT` 1.5→1.2). v35. (Tunable if still high.)
> - ✅ **Draw mode auto-recognises** ~0.85s after the pen lifts — no "Read" button. v35.
> - ✅ **Recognizer REPLACED with a real on-device CNN** (the headline fix). The old grid/Dice
>   matcher confused round letters (a/q/c/s); now `src/cnn_recognizer.js` runs a small EMNIST-letters
>   CNN in TF.js (vendored `src/vendor/tf.min.js` + a 0.4MB model under `src/models/letters/`, trained
>   by `scripts/train_recognizer.mjs` with tfjs-node, ~94% top-1 / ~99% top-4). FULLY ON-DEVICE
>   (no strokes leave the device — COPPA), free, offline (SW-precached). Grid matcher kept as a
>   fallback if TF.js can't load. **Verified on prod: drawing 'a' → top='a'** (`qa_prod.mjs`). v36.
> - ✅ **Keyboard fallback in Mastery** — toggle draw ↔ type the word with the on-screen/physical
>   keyboard (`modes/mastery.js` type mode). v36.
> - ⚠️ **Owed: a real-device iPad pass** on the draw mode (recognition validated with emulated
>   drawing only — 7/7 letters top-1 incl. 'a'; real finger/stylus + a child's printing is the
>   final check). To RETRAIN the model: `node scripts/train_recognizer.mjs` (needs tfjs-node — on
>   Windows, copy `deps/lib/tensorflow.dll` next to `lib/napi-v8/` if it fails to load). Modules:
> - **`src/engine/categories.js`** (+`test/categories.test.js`, 16 tests) — the §30 state machine:
>   `new→learning→known→mastered` + `tricky`. API: `createCategoryState({setSize,level})`,
>   `recordCraft(state,word,correct,{pool})` (2-in-a-row→known; craft miss→learning; evicts the
>   hardest OTHER learning word→tricky on overflow; auto-refills), `recordDraw(state,word,correct)`
>   (known+success→mastered; mastered+miss→known; else no-op), `fillLearning(state,pool)`,
>   `demoteLevel`/`promoteLevel(state,pool)`, `unlocks(state)` → `{craft,mastery,mining}` (peaks,
>   never regress), `learningProgress`/`categorySummary`, `serialize/deserializeCategoryState`.
> - **`src/engine/selection.js`** (+`test/selection.test.js`, 7 tests) — `buildCraftPool` (focus
>   learning, ~25% review), `buildMiningPool` (known∪mastered), `buildMasteryPool` (known-lead),
>   `adaptiveLevelDecision`/`applyAdaptiveLevel` (medium: last-4 craft window, ≤1→down, all→up).
> - **`src/engine/handwriting.js`** (+`test/handwriting.test.js`, 9 tests) — FREE/OFFLINE draw
>   recognizer: `recognize(strokes, templates, {maxCandidates:4, minConfidence:0.7})` → up to 4
>   high-confidence lowercase candidate letters (or `[]` → force redraw). No rotation invariance
>   (b≠d≠p≠q). Browser side: capture canvas strokes + supply glyph templates (render from the app
>   font once, or ship as data), then call `recognize`.
>
> **➡️ UI INTEGRATION PLAN (next):** (a) add `categories` to each profile in `state.js` (serialize
> parallel to `tracker`; revive on load; reset/rollback/import paths); (b) CRAFT (`modes/puzzle.js`)
> — on each build call `categories.recordCraft` alongside `progress.recordAnswer`, source words via
> `buildCraftPool`, run `applyAdaptiveLevel`, keep `fillLearning` topped up; ADD gem-cost hints
> (step 3). (c) MINING (`modes/rhythm.js`) — source via `buildMiningPool`, gate behind
> `unlocks().mining`, retune the timer to ~5s same-for-all-difficulty with stretched speed tiers
> (step 4). (d) NEW MASTERY draw mode (`modes/mastery.js` + canvas UI) gated behind
> `unlocks().mastery`, calls `recognize` + `recordDraw` (step 5-UI). (e) home unlock-chain gating +
> Progress category display (tricky grown-up-only) + Words-per-dig help text (step 6). Keep the §29
> phone no-horizontal-scroll guards green throughout.

> The biggest change since the original build: a discrete **word-category state machine** with a
> fixed **10-word "learning" working set**, mode **gating/unlocks** tied to it, an **adaptive
> level** that moves up/down with performance, a new **draw-the-letters MASTERY mode**, and
> economy/feel tweaks (gem-cost hints, slower mining timer). ⚠️ This partly SUPERSEDES the §4
> "continuous mastery, no hard categories" decision — Ian is now explicitly asking for discrete
> categories with hard counts. Implement categories as a layer (can still be derived from the
> continuous score under the hood) but honour the hard rules below. **Build test-first** (pure
> engine), keep `npm test` green, follow `QA.md`, and **prevent any horizontal-scroll regressions
> on phones** (the §29 `qa_overflow.mjs` / `qa_galaxy.mjs` guards must stay green). iPad is still
> the primary viewport.

**SET SIZE = the existing "Words per dig" setting (CLARIFIED 2026-06-19d).** One lever (current
options 6/10/15/20, default **10**) now drives ALL of: the **learning-set size**, the **mastery
unlock threshold** (that many KNOWN), and the **mining unlock threshold** (that many MASTERED). One
"dig" = one pass over the learning set. Keeps Settings slim (no new lever) — but **update its help
text** so it reads as "how many words are in progress at once / to clear before the next mode
unlocks," not just session length. So everywhere below, **[set size] = the Words-per-dig value**
(default 10; lower = smaller working set + faster unlocks for younger kids, higher = longer climb).

**A. Word categories + the state machine (CLARIFIED 2026-06-19d).**
Categories: **new/unseen → learning → known → mastered**, plus **tricky** (a demotion/overflow bucket).
- **Learning = a fixed working set of exactly [set size]** (default 10) words the student does NOT
  yet know. Always kept full: when a word leaves learning (→known), another word takes its slot.
- **Known** = a word crafted correctly **twice in a row** in CRAFT. (A miss sends it back to learning.)
  Known words are eligible for MINING (once mining is unlocked).
- **Mastered** = a known word with **one success in the new MASTERY (draw) mode**. (A miss sends it
  back to known.) Mastered is set ONLY by mastery-mode results; a mastered word may appear in **all
  modes** again.
- **Tricky** = words that were in learning but had to be **moved out to keep learning at exactly 10**:
  the **hardest / lowest-accuracy** words, evicted when the student is **demoted a level** OR when
  there are already >10 in learning. (So tricky is the demotion/overflow pool, NOT a proactive target.
  The "10 known / 10 learning / 10 tricky" balance emerges from play, it isn't forced.)
- **Category display (CLARIFIED 2026-06-19d):** on the **Progress screen, kid-visible** — a "Words
  I'm learning" panel listing the current learning set (up to [set size], each with a 2-step
  progress toward known) + a tally of **known / mastered** and how many **new** words remain.
  **"Tricky" is GROWN-UP-ONLY** (behind the Settings "Grown-up settings" gate) — a child never sees
  a "hard/tricky" label on their words. Kid + grown-up otherwise share the same data (§4).
- **Learning-slot refill + tricky reintroduction (CLARIFIED 2026-06-19d).** When a slot frees up
  (a word → known), fill it in this priority order:
  1. A **new unseen word from the CURRENT level** (the normal discovery path).
  2. If current-level new words are **exhausted**, pull in a **TRICKY word that is same-level-or-
     lower** (tricky words are the LAST on-level source — only surfaced when deliberately introduced).
  3. If the only words left are **above level**, **move UP a level** and start with that level's new
     words (do NOT reach for above-level tricky words).
  - **Secondary reintroduction trigger (Ian's idea, adopted):** when the student has **mastered the
    spelling PATTERN** via other on-level words, reintroduce a same-pattern tricky word then (the
    pattern skill that made it hard is now in place — well-timed productive struggle, and it fits
    the existing pattern-family design in §4).
  - Net: tricky words never auto-resurface on their own; they return ONLY via (2) on-level
    exhaustion or the pattern-mastery trigger.

**B. CRAFT mode = the productive-struggle hub (fix it).** Today craft only serves words the student
does NOT know. Change it to balance **known / learning / tricky** in the productive-struggle zone,
but with the **focus on the 10 "learning" words**. ANY word may appear in craft; learning is the
priority. When a learning word becomes known, a different word rotates into learning.
- **Hints cost GEMS, charged as a % of the word given away (CLARIFIED 2026-06-19d).** A hint
  reveals one letter and **reduces the word's earned gems by `2 × wordPoints / wordLength` per
  letter** — i.e. revealing **half the word's letters consumes 100% of its points**, after which
  **crafting that word earns 0** (but still completes — eases frustration). **Never goes negative**
  (earned gems floored at 0; hints are never deducted from the existing balance). Example: a
  4-letter word worth 20 → each hinted letter costs 10; 2 hints → 0 points left.
- **Hint timing (CLARIFIED):** timers reset whenever a CORRECT letter is placed. After **4s** with
  no correct letter placed → **highlight the hint button**. After **8s** with no correct letter →
  **auto-fire a hint** (reveals a letter). **Auto-fired hints cost the same** as tapped ones.

**C. MINING mode (recognition) = known-words only + slower, less-pressured.**
- Only serves **known** words (crafted correctly 2× in a row).
- **Unlocked only after [set size] words are MASTERED** (i.e. via the draw mode — NOT merely known;
  Ian corrected this: the *mastered* count opens mining). So the unlock chain is **Craft (open from
  start) → Mastery (after [set size] KNOWN) → Mining (after [set size] MASTERED).**
- **Timer retune (CLARIFIED 2026-06-19d).** The bar **starts draining earlier but MUCH slower**,
  reaching the bottom in ~**5 seconds**, **the same for EVERY difficulty** (not shorter at higher
  difficulty). Reaching the bottom still scores the minimum (value retained, as today).
- **Keep the speed-tier bonus, STRETCHED** across the ~5s window: re-map the praise.js SPEED_TIERS
  (currently ~1.2/2.2/3.5s for perfect/amazing/great) proportionally to ~5s so a **thoughtful answer
  at ~2s still earns a strong tier** and only the **last ~1-2s** drops toward the minimum. Goal: the
  student actually considers all options before answering, without losing the DDR-style reward feel.

**D. Adaptive level (auto up/down) — "medium" aggressiveness (Ian).** The student picks a starting
level, but the game **adapts up or down based on performance** on that level. **Doing poorly → push
DOWN a level.** Use a MEDIUM cadence (not hair-trigger, not glacial — e.g. move after a short run of
clearly-strong or clearly-weak results). The near-term aim is to rapidly reach a balanced working
set, then evenly discover more known/unknown while continuously re-practising the learning set.

**E. 🆕 MASTERY mode = draw the letters (the new headline).** The student spells a word **without
choosing from given letters** — they **DRAW each letter** on screen; the app offers a few
**high-confidence letter matches** to what they drew (pick one) **or redraw**. The spelling
**populates one letter at a time** as each drawn letter is confirmed. This is the **mastery** test.
- **Unlocks after [set size] words are KNOWN** from craft.
- **One draw-mode success = mastered**; a miss drops the word back to known. **"Mastered" is set
  ONLY here.** A mastered word may then reappear in all modes.
- Recognition must be **FREE and OFFLINE** (Ian confirmed). Implement with on-device stroke/template
  matching (no cloud, no paid API).
- **Draw-mode UX (CLARIFIED 2026-06-19d):**
  - After each drawn letter, show **as many HIGH-CONFIDENCE candidates as there are, up to 4**,
    rendered **as the letterforms themselves** (tap the "a"). If **no high-confidence** match →
    **require a redraw** (no low-confidence guesses offered).
  - The spelling **populates one letter at a time** as each is confirmed; the student can **tap a
    placed letter to redo it**.
  - **Case-insensitive** matching — **expect lowercase but accept uppercase** letterforms (consistent
    with the rest of the app).

**F. Constraints.** iPad-primary; **no horizontal-scroll regressions on phones** (keep §29 guards
green). Stay vanilla / dependency-free where possible; flag any dep ([[prefer-free-services]]).

**ANSWERED (2026-06-19d):** ✅ tricky = demotion/overflow bucket (hardest words evicted to keep
learning at 10, on demotion or overflow). ✅ known = 2 correct crafts in a row (miss → learning);
mastered = 1 draw success (miss → known). ✅ unlock chain Craft→Mastery(after set-size known)→
Mining(after set-size mastered). ✅ mastery recognition = free + offline (on-device stroke/template
match). ✅ adaptive cadence = medium.

**MORE ANSWERED (2026-06-19d):** ✅ learning-slot refill priority = new-on-level → on-level-or-lower
tricky (when exhausted) → else level-up; tricky only via deliberate reintroduction or the
pattern-mastery trigger (adopted).

**MORE ANSWERED (2026-06-19d):** ✅ hint cost = 2×wordPoints/wordLength per revealed letter (half
the word → 0 points, floored, never negative); highlight hint @4s, auto-fire @8s without a correct
letter placed (timers reset on each correct letter); auto-fire costs the same.

**MORE ANSWERED (2026-06-19d):** ✅ draw-mode candidates = up to 4 high-confidence letterforms (tap
the letter); no high-confidence → force redraw; spelling builds one letter at a time, tap a placed
letter to redo; case-insensitive (expect lowercase, accept uppercase).

**MORE ANSWERED (2026-06-19d):** ✅ set size = the existing "Words per dig" setting (default 10),
driving learning-set size + both unlock thresholds; update its help text.

**MORE ANSWERED (2026-06-19d):** ✅ mining timer ~5s to bottom, SAME for every difficulty; keep the
speed-tier bonus stretched across the ~5s (≈2s still a strong tier; last ~1-2s → minimum).
✅ category display = Progress screen, kid-visible (learning list + known/mastered/new tally);
**tricky is grown-up-only** (no "hard" label shown to the child).

**✅ ALL OPEN QUESTIONS RESOLVED (2026-06-19d). Spec is build-ready.**

**PROPOSED TEST-FIRST BUILD ORDER (each a milestone; keep `npm test` green, follow `QA.md`, keep
the §29 phone no-horizontal-scroll guards green):**
1. ✅ **DONE (2026-06-19e) — Engine: word-category state machine** → `src/engine/categories.js`
   (+16 tests). New module (kept `progress.js` intact for gems/speed/recency). States + all
   transitions + learning kept at [set size] + hardest-eviction→tricky + refill priority +
   pattern-mastery reintroduction + serialization.
2. ✅ **DONE (2026-06-19e) — Engine: session/selection** → `src/engine/selection.js` (+7 tests):
   `buildCraftPool` (focus learning, ~25% review), `buildMiningPool` (known∪mastered),
   `buildMasteryPool` (known-lead), + the adaptive level (medium up/down). ⚠️ The UI WIRING of
   these into `state.js` + the modes is part of steps 3–6 below (not yet done).
3. ✅ **DONE (2026-06-19e) — Craft mode UI** (`modes/puzzle.js`): wired `categories.recordCraft` +
   `buildCraftPool` + `applyAdaptiveLevel` + `fillLearning` (pool excludes 1-2 letter words);
   gem-cost hints (2×value/len, half→0, never negative), highlight @4s + auto-fire @8s (clock
   resets on each correct letter; `.hint-ready` glow). `categories` persisted in `state.js`.
4. ✅ **MOSTLY DONE (2026-06-19e) — Mining mode** (`modes/rhythm.js`): sources via `buildMiningPool`
   (known∪mastered only); ~5s stretched timer (`MINING_SPEED_TIERS`, same for all difficulty).
   ⚠️ **INTERIM gate:** §30.C's "after [set size] MASTERED" needs the draw mode (deferred per the
   user's CRAFT+MINING-first choice), so until it ships mining opens once there are KNOWN words
   to mine (empty mine steers to Craft). Tighten to the mastered-gate when step 5-UI lands.
5. ✅ **DONE (2026-06-19e) — Mastery (draw) mode**: `src/engine/handwriting.js` GRID/Dice recognizer
   (`pointsToGrid`/`diceScore`/`recognizeGrid`, +6 tests; templates rasterised from the app font's
   glyphs) + `src/modes/mastery.js` (canvas capture, up-to-4 candidate letterforms, force-redraw on
   low confidence, build-one-letter-at-a-time, tap-to-redo, case-insensitive; `recordDraw`; ⭐+25
   gems on a mastered word). `GRID_MIN_CONFIDENCE=0.4` tuned in visual QA.
6. ✅ **DONE (2026-06-19e) — Unlock chain + gating UI** (Craft→Mastery→Mining via `unlocks(state)`:
   gated Mastery card; Practice card dimmed/🔒 until mining unlocks; rhythm.js gates on the
   mastered-gate), **Progress "Words I'm learning" category display** (kid-visible; tricky
   grown-up-only), **Words-per-dig help-text** updated.
7. **§26-B assets** — REVISED (Ian 2026-06-20): now an **inventory/review of `C:\Users\iango\kidenv`**
   for reusable assets → a documented **artifact** (read-only on kidenv; artifact written into this repo).
   Can run in parallel (independent). STILL OPEN. See §0 OPEN BACKLOG #4.

---

## §31 — MASTERY UX + MASTERY-FIRST NUDGING (Ian 2026-06-19g→20) — ✅ SHIPPED + LIVE on prod (csc-v40); writing APPROVED on iPad

> **✅ SHIPPED + LIVE on prod (csc-v40), merged to `main`, writing APPROVED by Ian on his iPad
> ("good on the writing").** (NB: §31.B "dictation" became the §32 VOICE mode, now SHELVED — see
> §32.) The two open questions were confirmed with Ian = the RECOMMENDED options:
> - **A per-box correction = auto-fill the top-1, tap a box to redo** (the fast "write freely" path).
> - **B = a toggle inside Mastery** (not a separate mode); **sentence = peekable** behind a 👀 button.
> - Wide-screen breakpoint = **`min-width:700px`** (width-only, NOT `pointer:fine` — keeps every narrow
>   viewport, incl. narrow desktop windows, on the proven single-canvas flow so the §29 guards can't
>   regress; the boxes also `flex-wrap` so a long word can't overflow a ~700px tablet). iPad-primary.
>
> **What shipped (all in this branch):**
> - **§31.A whole-word MULTI-BOX writing** (`modes/mastery.js` + `styles.css`): on ≥700px screens the
>   word is a ROW of per-letter mini-canvases (`.draw-boxes`/`.lbox`); draw in any box → auto-recognise
>   on pen-up debounce → **auto-fill the best guess**; **tap a box to redo**; all filled → auto-check
>   (same `recordDraw`). PHONE (<700px) keeps the single-canvas + up-to-4-candidate flow unchanged.
>   The KEYBOARD fallback fills the boxes left-to-right in wide layout (boxes stay as the word display
>   while typing). Layout swaps live on rotate (matchMedia). Reuses `cnn_recognizer.recognizeDrawing`
>   per box — no engine change. (QA: drew "lot" letter-by-letter into the boxes → recognised + mastered.)
> - **§31.B DICTATION toggle** (`modes/mastery.js`): a `📣 Dictation` button hides the example sentence
>   (pure auditory recall) with a `👀 Peek` button to reveal the blanked sentence; toggling re-speaks
>   the word. Resets to hidden each new word.
> - **§31.C MASTERY-FIRST nudging**: `screens/home.js` pulses the Mastery card + a "✍️ Master these!"
>   badge and **idle-routes** toward the recommended mode; craft (`modes/puzzle.js`) + mining
>   (`modes/rhythm.js`) reward screens grow a "✍️ Master them!" CTA when there's a known backlog.
> - **§31.D `recommendNext(categories)`** — NEW pure recommender in `src/engine/selection.js`
>   (+`test/recommend.test.js`, 5 tests): returns `{mode, reason, knownBacklog, masteredCount,
>   learningActive}`, **mastery-first** once unlocked + a known backlog exists, else craft to grow the
>   known set, else mining — the Craft→Mastery→cycle loop. Never recommends a locked mode.
> - **Tests/QA:** `npm test` **267 green** (+5); `npm run smoke` green (made the all-mastered home
>   sub-test robust to the new recommender nudge); **`node scripts/qa_s31.mjs`** (NEW probe) all checks
>   pass at wide 1024 + phone 390 (boxes, dictation, keyboard-fill master, phone fallback, 0 overflow);
>   §29 guards green (`qa_overflow`/`qa_responsive`/`qa_fold`); `qa.mjs` 0 console errors. `qa_mastery.mjs`
>   default viewport moved to phone (its single-canvas path) — use `W=1024 H=820` for the wide path.
> - sw `csc-v36`→**`csc-v37`** + `src/version.js` bumped (no new precached files — all changed files
>   were already in the SW CORE list).
>
> **STATUS:** merged + deployed (csc-v37→v40, all LIVE + prod-verified via `qa_prod.mjs`); the
> multi-box writing + ✓ Check + tap-to-redo got the real-device fixes (one ink overlay, centroid
> box routing, advance-waits-on-praise) and Ian APPROVED the writing on iPad.
> **➡️ The `/?dev=mastery` test unlock is now COMMENTED OUT in `app.js` (csc-v40, Ian 2026-06-20)** —
> disabled so it isn't live on prod, but KEPT (not removed): uncomment the boot block + `devUnlockMastery`
> + its two imports to re-enable. Original spec + answered open questions retained below.

> Captured after Ian confirmed the §30 draw mode works on his real iPad ("yes that works"). Four
> asks. When building: test-first for any engine/selection change, follow `QA.md`, keep the §29 phone
> no-horizontal-scroll guards green, bump `sw.js`/`version.js` on deploy. iPad-primary.

**A. Whole-word writing on tablet/desktop (wide screens).** On a screen wider than a phone, show the
WHOLE word as a ROW OF BOXES — one box per letter — and let the student write each letter into its
own box WITHOUT waiting for each detection to resolve first. It is still LETTER-BY-LETTER recognition
(the CNN runs per box), just without the stop-and-wait rhythm of today's single-canvas flow.
- Responsive: WIDE (tablet/desktop / landscape iPad, e.g. ≳700px or `pointer:fine`) → the multi-box
  row; PHONE (narrow) → keep the current single-canvas, one-letter-at-a-time flow (no room for a row).
- Each box = a mini draw canvas behaving like today's: draw → auto-recognise on pen-up debounce →
  the recognised letter fills THAT box. Per-box correction UX (confirm when building): simplest is
  auto-fill the top-1 and let a tap on a box re-open it to redraw; or show the up-to-4 candidates
  under the active box. The student writes box 1, 2, 3… freely without waiting; each box recognises
  independently; when all are filled → check the word (same `recordDraw` path). The §30 KEYBOARD
  fallback must keep working here (typing fills the boxes left-to-right).
- Reuses `cnn_recognizer.recognizeDrawing` per box — mostly a `modes/mastery.js` + CSS change
  (a responsive grid of per-letter canvases); no engine change.

**B. Dictation mode for Mastery.** Add a dictation variant: the app SPEAKS the word and the student
spells it from hearing ALONE — no sentence/blank shown (or hidden behind a "peek" button). Pure
auditory recall, the classic spelling-test format; the student still draws (or types, per §30) the
answer. (Confirm: a toggle inside Mastery — "📣 Dictation" — vs a separate mode; whether the sentence
is dropped entirely or peekable.) Likely a `modes/mastery.js` option that hides `sentenceEl` + dictates.

**C. Push students into Mastery once it's unlocked.** Mirror the §B craft-nudging for mastery: once
`unlocks(state.categories).mastery` is true, ACTIVELY steer toward it — highlight/pulse the Mastery
card on home, idle-route into Mastery, add CTAs from craft/mining rewards ("You've learned these —
now MASTER them! ✍️"). Goal: drive KNOWN → MASTERED instead of letting mastery sit ignored. (Touches
`screens/home.js` idle guard + the reward screens in `modes/*`.)

**D. Flexible known↔learning cycling (the pedagogical loop — the framing for B/C).** Ian's overarching
goal: flexibly move students toward **mastering all their KNOWN words** (draw mode), then back toward
**(re)learning them with CRAFT**. The nudging + selection should form a continuous loop — Craft
(new→learning→known) → Mastery (known→mastered) → cycle mastered/missed words back through Craft for
retention — adapting to where each student is: a backlog of known-but-unmastered words → push Mastery
(C); mastered + craft-missed words feed back into Craft. This ties §31.B/C together; refine the §30
unlock-chain nudging + the `selection.js` pools toward it (e.g. a "what should this student do next?"
recommender balancing mastering vs re-crafting).

**Open questions to confirm before building:** the wide-screen breakpoint + per-box correction UX (A);
dictation as a toggle vs separate mode, sentence dropped vs peekable (B).
**✅ ANSWERED (2026-06-19g, all = the recommended option):** breakpoint `min-width:700px` (width-only);
per-box correction = auto-fill top-1 + tap-to-redo; dictation = a toggle inside Mastery; sentence =
peekable behind a 👀 button. (See the §31 banner above — all built on branch `feat/s31-mastery-ux`.)

---

## §32 — VOICE SPELLING ⏸️ SHELVED (parked behind a flag) · INTERFACE-VOICE QUALITY (§32.A) + AUDIO-START GATING (§32.B) ✅ DONE (csc-v42) (Ian 2026-06-19g→20)

> **✅ §32.A INTERFACE AUDIO + §32.B AUDIO-START GATE — DONE + QA'd (csc-v42, 2026-06-20).** See OPEN
> BACKLOG #2 above for the full summary. In short: the fixed interface narration + mastery praise now
> play pre-rendered Gemini clips (centralized in `src/engine/ui_phrases.js` → `audio/ui/` bucket +
> folded `phrases`; `say()` resolves them at natural speed); first-run onboarding opens with a "Tap to
> start 🔊" gate (`onboarding.js` + `audio.whenReady()`) so the very first line plays a clip, killing
> the "two different voices on first run" bug. 13 clips generated on the first model (quota left for the
> word tail). QA: `test/ui_phrases.test.js`, `scripts/qa_uiaudio.mjs`, smoke + overflow/fold guards green.
> Settings voice-picker/speed previews intentionally STAY on TTS (they audition the device voice). ⚠️
> OWED: a real-device iPad/iOS pass to confirm the gate unlocks audio + the clips sound right on hardware.
> The §32.A/§32.B notes BELOW are the original spec, kept for reference.

> **⏸️ VOICE SPELLING is SHELVED (Ian's call after iPad testing) — LIVE prod (csc-v39) has the 🎤
> button REMOVED; draw + type are the spelling methods.** It was built + deployed (v37→v38) but the
> approach didn't work on a real iPad and Ian chose to park it (not remove) for a proper rebuild.
> **WHY it failed:** the browser **Web Speech API is the wrong tool** — it transcribes CONNECTED
> speech into WORDS, not isolated letters (saying "N-O-T" came back as the word "not"; "in" instead
> of the letter N), and the **open mic echoed the app's own TTS** dictating the word. A live on-screen
> "🗣️ heard:" readout (added v38) confirmed all this on-device.
>
> **➡️ THE RESEARCHED REBUILD PLAN (do this when revisiting — Ian wants the handwriting-CNN
> equivalent, not cloud):**
> 1. **PUSH-TO-TALK** — a "hold to say a letter" button: mic on only while held → no echo, ONE letter
>    per capture (kills the word-fusing + the delay). Ian's idea; adopt it.
> 2. **ON-DEVICE spoken-letter model** (mirrors `cnn_recognizer.js`): **TF.js Speech Commands**
>    (`BROWSER_FFT`) supports in-browser **transfer learning** to custom classes = the 26 letters;
>    train offline (like `scripts/train_recognizer.mjs`) on an **ISOLET**-style spoken-letter dataset
>    (7.8k utterances; CNNs hit ~95% on *adult/native/clean*). Offline + private → **drops the cloud +
>    the COPPA consent gate entirely**.
> 3. **USE THE KNOWN TARGET WORD AS A PRIOR** — the kid is spelling a KNOWN word, so it's a "did they
>    say the EXPECTED next letter?" 1-vs-rest check, NOT open 26-way recognition. This sidesteps most
>    of the **"E-set"** problem (B/D, P/T, V/Z, F/S, M/N sound alike — the core difficulty; children's
>    voices are harder still and aren't in ISOLET). This prior is the real accuracy unlock.
> 4. Don't fill from a whole-word transcript (Ian); push-to-talk + the prior handle this naturally.
> - Sources: tfjs Speech Commands + transfer-learning tutorial; ISOLET database. **Honest expectation:**
>   even on-device, kids' E-set letters are hard — the known-word prior is what makes it viable.
>
> **WHAT'S PARKED (not deleted) for the rebuild:** `src/speech.js` (`lettersFromTranscript` +6 tests
> still pass; the Web Speech wrapper), the voice mode in `modes/mastery.js` behind
> **`VOICE_SPELLING_ENABLED=false`** (flip to re-enable the parked Web Speech path), `ui.parentalGate`,
> `state.voiceConsent`/`setVoiceConsent` + the Settings revoke, and `scripts/qa_s32.mjs` (PARKED —
> fails until the flag is on). **PRIVACY.md reverted** (mic not used in shipped app). sw `csc-v39`.
>
> **The TWO ITEMS BELOW (interface-voice quality + audio-start gating) are STILL recorded-only — no code.**

> Captured during §31 real-device testing. **Recorded only — no code yet.** Two related audio asks;
> these are the FIRST things a new user hears, so they set the quality bar. Build test-first where it
> touches engine, follow `QA.md`, bump `sw.js`/`version.js` on deploy. Relates to [[prefer-free-services]]
> (Gemini free-tier TTS, ~3 req/min — see the §25 AUDIO-TAIL RESUME LOG + the lamejs reinstall GOTCHA).

**A. The INTERFACE speech is still the robotic device voice — run it through Gemini too. ⭐ PRIORITY:
Ian (2026-06-20) wants this done BEFORE the §0 #3 word-tail audio — both draw from the same rate-limited
daily Gemini quota, so the interface clips go FIRST, then the tail on later days.** Today
`scripts/gen_audio.mjs` only pre-generates Gemini clips for **dictated words** (`audio/words/`) and the
fixed **praise/gentle phrases** (`audio/phrases/`, sourced from `praise.js` `SPEED_TIERS` /
`GENTLE_PHRASES` / `COMBO_PHRASES`). **Every other spoken UI string** — the onboarding narration
(`screens/onboarding.js`: "Hi! I'm Geo, your crystal guide…", "Pick your crystal colour!", the
name/level/sync lines), mode hints, toasts, and the other `audio.say(...)` callers across
`screens/{onboarding,settings,boss,geode}` + `modes/{rhythm,puzzle,mastery,lab}` — has **no clip**, so
`audio.say()` falls through to `speakTTS()` (the device's robotic voice). Ian: "since these are the
first things the user hears, it's very off-putting." **Ask:** collect the fixed interface strings into a
catalog (like the phrases set), generate Gemini clips for them (probably a new `audio/ui/` bucket +
manifest section, or fold them into `phrases`), and have `say()`/`speakPraise()` resolve them to clips.
NOTE: only FIXED strings can be pre-generated — dynamic bits (the child's typed name, gem counts) can't,
so design the lines so the variable part is minimal/omittable from speech, or accept TTS for just that
token. Mind the free-tier rate cap (multi-day batches, per the §25 log).

**B. Don't auto-talk on the intro — FORCE an interaction first; fixes the two-different-voices bug.**
The onboarding intro currently **auto-speaks on mount** (`onboarding.js` `intro()` calls
`audio.say("Hi! I'm Geo…")` immediately), but iOS unlocks audio only inside a user GESTURE and
`audio.prime()` is wired to the FIRST `pointerdown` (`app.js:115`). So on first run the app tries to
talk **before** a guaranteed gesture → on some systems the first line is blocked/missed or takes a
different path than later (post-gesture) ones. Ian saw exactly this: **"one voice said the first thing,
then a different voice said everything after."** Root cause = the mix of paths: `say()` plays a Gemini
**clip** when the slug is in the manifest else falls back to device **TTS**, AND the manifest may not be
loaded yet for the very first utterance (it self-heals via `ensureManifest()` on later calls) — so the
first utterance can be TTS (one voice) and the rest clips (another), or blocked entirely. **Ask:** gate
the start behind an explicit **"Tap to start 🔊"** interaction so audio is primed + the manifest is
loaded BEFORE any narration, and every utterance then goes through the same (clip) path — consistent
voice from the very first word, and never missed on stricter autoplay policies. (Pairs naturally with
§32.A: once interface clips exist + audio is gated, the whole intro is one clean Gemini voice.)

**Open questions to confirm before building (B/A):** new `audio/ui/` bucket vs extend `phrases`; which
exact interface strings to voice (all `audio.say` literals, or a curated subset); whether the "Tap to
start" gate is onboarding-only (first run) or also on every "Who's playing?" launch.

---

History (all ✅ DONE, deployed, QA'd): **§28** user backlog (this section — pricier crystals,
always-ask who's-playing, offline printables, feedback-to-Ian + in-app archive); **§27** §26-A
design brief + audio-manifest retry fix; **§24** §23 App-Store polish + daily geode + word
discovery + the multi-user UI (kid-lock, grown-up gate, time machine); **§22/§20/§17** learning
model, multi-profile, family sync, economy/deploy.

**§25 — 2026-06-19 (csc-v22): the long-deferred user-gated items, now done where an agent can.**
- 🔑 **Gemini key rotated** by Ian (his Google action). Repo stays key-free (`gen_audio.mjs` reads
  `GEMINI_API_KEY` from the git-ignored `.env`).
- 🔊 **Audio NOW SHIPS to prod.** Root cause of the silent-on-prod bug: `audio/` was git-ignored, but
  prod builds via **Git-CD from the repo**, so the build never saw the clips (manifest 404 → every
  user got the robotic device voice). Fix: **un-git-ignored `audio/` and committed the clips**
  (`audio/_oneshot/` scratch stays ignored). Generated up to **1678 words + 32 phrases** (the
  frequency-TOP words — the ones actually dictated most); the free-tier preview-TTS models cap at
  ~3 req/min so the tail (~1271 least-frequent words) walled. The runtime already falls back to the
  device voice for any word without a clip, so this is purely additive.
  **TAIL PLAN — Ian chose the FREE multi-day path** (decided 2026-06-19): just re-run
  `npm run gen:audio` on a later day (it skips the **1708** clips done so far and grabs the next free
  batch), then commit the new `audio/` clips + bump `sw.js`/`version.js` + push. No re-asking needed.
  - 📅 **AUDIO-TAIL RESUME LOG** (update this each run):
    - 2026-06-19: generated 960 clips → **1708/≈2949** done; daily free quota **SPENT** for the day.
    - 2026-06-19c (§29 session): quota had reset → generated **+160** clips (1678→**1838 words** +32
      phrases) before all 3 preview-TTS models walled on the per-minute limit. **1081 words remain.**
      Committed (csc-v31). **Next run due: 2026-06-20+** (resets daily).
    - ⚠️ Before running, reinstall the codec: `npm i --no-save @breezystack/lamejs` (a stray
      `npm i --no-save` prunes it — see the gotcha note). Tip: install it ALONGSIDE `playwright`
      in one command so neither `--no-save` install prunes the other.
  - (Fast alt if Ian ever changes his mind: enable billing on the Gemini project → one `gen:audio`
    run finishes the tail in ~1hr for ≈$1–3; [[approval-before-consuming-limits]] governs that path.)
- 🔔 **Web push BUILT + runtime-validated** (deploy is account-gated). RFC 8291 (`aes128gcm`) + RFC
  8292 (VAPID) in `src/engine/webpush.js` on WebCrypto (runs on Workers AND `node --test`);
  `test/webpush.test.js` reproduces the RFC 8291 Appendix-A vector **byte-for-byte** (+ round-trip +
  JWT verify). Wired: Settings "Daily reminder" opt-in + "Send a test" (`src/push.js`), SW
  `push`/`notificationclick`, Worker `/api/push/subscribe` + `/api/push/test` + daily `scheduled()`
  sender, cron `0 16 * * *` (`wrangler.toml`). Subs reuse `FAMILY_SYNC` KV under a `push:` prefix.
  Validated end-to-end in local `workerd` (encrypt + VAPID sign run; routes return correctly).
  ✅ **NOW LIVE (§28.A session, 2026-06-19):** `VAPID_PRIVATE` secret is SET; daily-reminder cron is
  active; web push verified end-to-end on Ian's real devices (the feedback-alert path rides the same
  infra). `PUSH_SETUP.md` retained for reference.
- 📄 **Design + engine-migration research** delivered: `DESIGN_ANALYSIS.md` (pro UX critique vs
  best-in-class, cited) and `ENGINE_MIGRATION.md` (verdict: **stay vanilla**, upgrade assets/feel;
  PixiJS v8 / Phaser 4 only if a renderer is ever justified). Both built from live exploratory QA.

---

## §28 — USER BACKLOG (user 2026-06-19) — ✅ SHIPPED (code done + QA'd; see top banner)

> All four items below are BUILT, unit-tested, visually QA'd, and LIVE (csc-v24→v26, 220 tests).
> Decisions Ian made: prices ~2.5× (400/1200/3000/6500); printables = all four types; feedback
> delivery = KV + push + in-app archive (email DROPPED, free-first — see [[prefer-free-services]]);
> always-ask who's-playing = always-on for count≥1.

Four items Ian asked for after the §27 ship — all SHIPPED + LIVE (csc-v24→v26). What each became:

### A. Feedback must actually reach Ian — ✅ DONE
`POST /api/feedback` (`worker.js`) stores each feedback durably in KV under `feedback:<ts>-<id>`,
web-pushes the developer's admin device(s) instantly, and (dormant) emails. Client
`src/feedback_client.js` POSTs best-effort + queues unsent + flushes on next open;
`src/screens/feedback.js` sends the pseudonymous payload (nickname only). **In-app archive:**
`src/screens/admin_feedback.js` lists ALL feedback newest-first; reached by tapping a feedback
notification (deep-link `/?view=feedback`, handled in `app.js` boot) or the **7-tap version-line
unlock** in Settings. `src/admin.js` remembers the `ADMIN_KEY` on the admin device (localStorage
`csc_admin_key`). Admin push subs live under KV `adminpush:` (separate from family `push:`), gated
by `POST /api/push/admin` (`x-admin-key`). `GET /api/feedback` (gated) reads the archive.
**Email DROPPED** (free-first); see `FEEDBACK_SETUP.md` + `PRIVACY.md`. Secrets: `ADMIN_KEY`,
`VAPID_PRIVATE` set. Verified end-to-end on prod (KV + push to laptop + phone).

### B. Make crystals more expensive — ✅ DONE
`src/engine/catalog.js` `RARITIES` now **400 / 1200 / 3000 / 6500** (~2.5×; was 160/480/1200/2600).
Full 24-mineral set ≈47k gems (multi-month goal). `test/catalog.test.js` uses relative assertions
(ascending + ratio), still green.

### C. Offline printables — ✅ DONE
Pure `src/engine/printables.js` (8 tests) resolves a sheet spec into a capped word list; 3 sources
(current target words / pattern family / age tier) × 2 formats (word list / look-cover-write-check
grid). `src/screens/printables.js` renders + `window.print()`; `@media print` CSS hides all chrome
(big black-on-white). Entry: Settings → "Practice sheets". `scripts/qa_s28.mjs` covers it.

### D. Always ask "Who's playing?" + Add-player — ✅ DONE
`src/app.js` boot now routes to the `profiles` picker for **any count≥1** (was `>=2`; solo kids
were skipping straight to home). The picker already had the "Add explorer" card, so this one change
satisfies both halves. Only exception: a single profile still mid-onboarding resumes onboarding.
`scripts/qa_fold.mjs` was updated to tap through the picker.

---

## NEXT STEPS (§26 — from the §25 research)

Two independent workstreams came out of the §25 research. **Workstream A (DESIGN polish) is ✅
SHIPPED — see §27.** Workstream B (professional ASSETS) is the remaining open item (see OPEN
BACKLOG #3 in §0). Workstream A is kept below as the record of what was done.

### A. Act on the DESIGN brief — ✅ SHIPPED in §27 (kept for reference)
1. **Read `DESIGN_ANALYSIS.md` in full** and triage its prioritized table (impact × effort). The
   headline "free polish we can do now" items, in the report's own priority order:
   - **Landscape / short-phone top-heaviness** — phone-landscape home + wave-reward push ALL primary
     actions below the fold (reward overflows by a measured **+213px**); the hero must collapse in
     landscape. (S–M)
   - **Letter-distinct font** — replace Baloo 2 (poor b/d/p/q, I/l/1 distinction — wrong for a
     spelling task) with **Atkinson Hyperlegible** or **Lexend**; upgrade the thin "Easy-read" toggle
     into a real dyslexia mode. (M, free fonts)
   - **Differentiate locked catalog art** — all 24 un-owned minerals render as one identical grey
     hexagon, undercutting the collection motivator. (M)
   - **Raise two below-AA contrast spots** — white-on-Craft-pink (~3.95:1) and the slate wrong-answer
     subtext (4.12:1). (S)
   - **Tune the youngest-tier recognition mode** to further limit misspelling exposure. (S–M)
2. **Implement the agreed fixes test-first / `node --check` + Playwright-load each UI change** (the
   standing QA lesson — `npm test` does not cover screen/CSS files). Bump `sw.js` + `version.js`.
3. **Run ANOTHER design agent (same brief as §25 agent A) to VERIFY the fixes** — live exploratory
   QA at phone/tablet/landscape, confirm the flagged items are resolved and nothing regressed, and
   diff against the original `DESIGN_ANALYSIS.md` findings. Flag real-device-only items (notch/
   safe-area/OS-font-scaling) for Ian to check on hardware.

### B. Act on the ENGINE brief — acquire assets, then implement (stay vanilla)
The engine verdict was **do NOT migrate**; the real gap is **professional, engine-independent
assets** dropped into the current vanilla app. From `ENGINE_MIGRATION.md`:
1. **Acquire assets** matching the report's sourcing guidance — e.g. **Kenney** (CC0) and
   **CraftPix** 2D art/UI/particle packs, a **Spine** mascot animation (run via the plain-web Spine
   runtime, no build step), and drop-in libs **GSAP** (tween/motion) + **tsParticles** (effects),
   plus recorded/neural **audio** to replace synth SFX where it helps. Confirm **licensing** for each
   (CC0 / commercial-OK) before use, and keep the no-build, offline-PWA, dependency-free ethos
   (load via CDN/UMD or vendored static files; nothing that forces a bundler).
2. **Implement them on the existing surfaces only** (home, rhythm, craft, geode, catalog, onboarding
   mascot) — replace procedural-SVG art / CSS particles / Web-Audio synth with the acquired assets
   where they raise polish, **without touching `src/engine/**`** (the tested pedagogy IP). Mind PWA
   precache size (`sw.js` CORE) and offline behaviour; version-bump on ship.

> ⚠️ Asset acquisition may involve **paid packs or commissions** → falls under
> [[approval-before-consuming-limits]]: surface cost + get Ian's per-purchase OK before spending.
> Prefer CC0/free (Kenney) first. Both workstreams are agent-doable except the actual purchase
> approvals + any real-device design check.

**Still genuinely user-gated (agent cannot do):** any PAID asset purchase (workstream B,
[[approval-before-consuming-limits]]); enabling Gemini billing IF the audio tail is ever rushed
(the free multi-day path needs no gating). (The old `wrangler` push-deploy steps + real-device
push verification are now ✅ DONE — §28.A.)

Build **test-first where it's pure**, keep `npm test` green (a **PreToolUse gate runs `npm test`
before Bash**), **follow `QA.md` (interactive view-as-you-go QA) before shipping major UI**,
**commit per milestone**, and `git push` to deploy (Cloudflare CD). Bump `sw.js` VERSION **and**
`src/version.js` `APP_VERSION` (keep them equal) whenever a precached file changes.

---

## 1. What we're building (the goal, verbatim intent)

A **gamified spelling app for an iPad**, originally for a specific bright 9-year-old
who loves **Zelda, Brotato, and Brain Test** and enjoyed learning about **rocks &
minerals**. He's bright but currently a **weak speller**; the mission is to bring him
**up to or above his classmates over a few weeks**. (Per later instruction the content
range was widened to **ages 5–13**, so the same app serves a broad span.)

Non-negotiable design requirements pulled from the goal:

1. **Gamified pre-assessment** that figures out which words the learner does/doesn't know.
2. Targets the **most frequently used, developmentally-appropriate words first**, then
   extends to rarer/harder ones.
3. Teaches **groups of similarly-spelled words** to drive memorization through
   **productive struggle** — *without ever explicitly teaching spelling rules*.
4. **Iteratively introduces & reinforces unknown words** (adaptive/spaced repetition),
   keeping the learner in an engaged flow.
5. **Positive reinforcement like DDR / Pump It Up**: different levels of response based
   on **speed**, with **consistent, encouraging phrases spoken ALOUD** (this is "key").
6. Builds toward **fluency**: spelling **choices move easier → harder**, ending with
   correctly choosing between **very similar spellings** under **speed + accuracy** pressure.
7. **Creativity** element (he may have lacked this in school): **spell nonsense words
   using the same pattern as real words**, then **draw a made-up meaning** for them.
   But the **main purpose stays real-word spelling**.
8. **iPad-native interactions**: dragging/dropping letters, swipes, unscrambling.
9. **Two modes that alternate**: mostly **fast-paced choices**, broken up by slower
   **drag/drop / unscramble** puzzles that engage higher-order thinking.
10. **Kid-friendly configuration**: speed, difficulty, etc.
11. **Built-in feedback mechanism** so we can iterate.
12. **Progress tracking the kid can see** over time.

---

## 2. Status

### DONE ✅ (the entire word-research / data layer)
- **`data/words.js`** — the **final, engine-facing dataset**. AUTO-GENERATED; do not
  hand-edit. **2,919 words**, **frequency-ordered** (`rank` 1 = most common), spanning
  **ages 5–13** (difficulty `tier` 1–9). Re-exports `PATTERNS`. Imports cleanly in Node 22.
  (Was 2,829; +90 from the curated supplement below.)
- **`data/patterns.js`** — canonical **63 spelling-pattern families** (the single source
  of truth for `pattern` ids). Exports `PATTERNS`, `PATTERN_IDS` (Set), `PATTERN_BY_ID`.
- **`data/curated.js`** — the **317 hand-crafted entries** (great themed sentences +
  hand-picked misspellings). Used as a quality *overlay* by the merge.
- **`data/supplement.js`** — ✅ **~90 hand-enriched fill-ins** (2026-06-17) for common,
  age-appropriate words the frequency backbone missed and to fatten thin teaching families
  (esp. completed the **-ight** family: tight/slight/knight/fright/tonight/…). Same schema as
  curated.js; layered in by merge.mjs. `test/data.test.js` now guards this coverage. To add
  more common gaps, append here and re-run `node scripts/merge.mjs`.
- **`data/backbone.json`**, **`data/chunks/input_*.json`**, **`data/chunks/part_*.js`** —
  intermediate build artifacts (the 12 enriched chunks). Kept so the dataset is rebuildable.
- **`scripts/build_backbone.mjs`** — fetches a frequency list, filters to ~3000
  age-appropriate words in frequency order, splits into 12 chunk inputs.
- **`scripts/merge.mjs`** — merges chunks + curated overlay + supplement → `data/words.js`,
  drops `skip:true`, validates, sorts by frequency. **Rebuild the dataset anytime with
  `node scripts/merge.mjs`.**
- **`server.js`** — zero-dependency static server (`npm start`) that prints a LAN URL for
  the iPad. ES modules need http (won't load from `file://`), so this is how you run it.
- **`package.json`** — `type:module`; `npm test` (node --test), `npm start` (server).
- **`src/engine/lexicon.js`** — ✅ build-order step 1. PURE data-access layer over the
  dataset: `REAL_WORDS` (Set of all correct spellings, for distractor/nonsense exclusion),
  `wordsByPattern(id)`, `wordsByTier(t)`, `getWord(word)`, `byRank()` (sorted shallow copy),
  re-exports `WORDS`/`PATTERNS`.
- **`src/engine/distractors.js`** — ✅ build-order step 2. PURE wrong-answer engine:
  `mulberry32(seed)` seeded rng, `shuffle(arr,rng)`, `levenshtein(a,b)`,
  `generateMisspellings(word,{realWords,max})` (child-error transforms → ranked
  closest/most-confusable first, excludes the word + real words), and
  `buildOptions(word,{count,difficulty,curated,realWords,rng})` → shuffled
  `[{text,correct}]` with exactly `count` options (one correct); curated misspellings
  go first, `difficulty` 0→1 slides the distractor window easy(back)→hard(front).
- **`test/data.test.js`** — ✅ 14 tests locking dataset integrity (size, field types,
  syllables join to word, valid pattern ids, unique words, non-decreasing rank, no
  self-misspellings, `PATTERN_BY_ID` coverage) **and** the lexicon helpers. `npm test` green.
- **`test/distractors.test.js`** — ✅ 19 tests for the distractor engine (rng determinism
  & range, shuffle is a non-mutating permutation, levenshtein known cases, misspellings are
  well-formed + closest-first + real-word-excluded + capped + deduped, buildOptions count/
  one-correct/unique/no-real-word/deterministic/difficulty-ramp/curated-first/short-word).
- **`src/engine/praise.js`** — ✅ build-order step 3. PURE DDR/Pump-It-Up reinforcement:
  `SPEED_TIERS` (perfect ≤1200ms / amazing ≤2200 / great ≤3500 / good else; each with
  label, color, point mult, spoken-phrase pool), `MISS_TIER`, `BASE_POINTS`, `COMBO_PHRASES`,
  `GENTLE_PHRASES`, and `gradeAnswer({correct,responseMs,combo,rng})` →
  `{tier,label,phrase,points,mult,color,combo,isCombo}`. Points = `BASE_POINTS*mult*comboFactor`
  (combo bonus +0.1/streak, capped at 20). Milestones every 5 → celebratory combo phrase.
  Wrong → gentle phrase, 0 points, streak reset (no harsh buzz).
- **`test/praise.test.js`** — ✅ 12 tests (tier table shape/ordering, speed-tier boundaries,
  invalid-time fallback, faster/higher-combo scores more, combo cap, base scoring, milestone
  combo phrases, non-milestone uses tier pool, gentle wrong branch, seeded determinism, no-rng).
- **`src/engine/assessment.js`** — ✅ cold-start pre-assessment (the staircase). Exports
  `createAssessment / nextItem / submit / isDone / result`. `result()` → `{estimatedTier
  (PRIOR anchor), perPattern, responses (word/correct/responseMs/fast/tier), itemsAsked,
  correctCount}` — **no known/unknown sets** (continuous model). `test/assessment.test.js` ✅ (11).
- **`src/engine/progress.js`** — ✅ CONTINUOUS mastery tracker (heart of the model; replaces
  srs). `createTracker`, `recordAnswer(t,word,correct,{responseMs,fast})` (recency-weighted
  mastery EMA α=0.4 scored by correctness+speed; confidence=1−0.5^attempts), `mastery`,
  `confidence`, `effectiveDifficulty(t,word,prior)` (blends prior→observed by confidence),
  `predictedSuccess`, `isProductiveStruggle`, `summary` (display buckets known/learning/shaky,
  NOT gates), `seedFromAssessment`, `tierToPrior`. `test/progress.test.js` ✅ (11).
- **`src/engine/session.js`** — ✅ two-axis level builder. `DIFFICULTY_PRESETS`
  (easy/medium/hard as `{patternSpread, masteryTarget}` points), `UNLOCK_THRESHOLDS`,
  `CONFUSABLE_CLUSTERS` (real pattern ids), `resolveDifficulty` (preset name OR custom axes,
  clamped), `unlockedDifficulties`/`isUnlocked` (gate by "known" count — unlock, never force),
  `buildSession(tracker,{difficulty,length,rng,words})` → ordered word entries: opens with a
  shuffled mixed review of seen words, draws target-band words round-robin across chosen
  patterns (preferring confusable families as spread rises), orders blocked→interleaved.
  `test/session.test.js` ✅ (10).
- **`src/engine/nonsense.js`** — ✅ pattern-based nonsense-word generator (Crystal Lab).
  `ONSETS` (shared consonant clusters), `RIMES` (per-pattern {rimes, onsets?}),
  `NONSENSE_PATTERNS` (39 supported phonetic families), `makeNonsenseWord(patternId,
  {realWords, rng, avoid})` → pronounceable non-word embodying the pattern (onset+rime model,
  every combo a legal syllable), or null for unsupported/exhausted. `test/nonsense.test.js` ✅ (8).
  ⚠️ KNOWN LIMITATION: "real word" = in REAL_WORDS (the 2,829-word dataset only), so some real
  English words not in the dataset (e.g. "tight", "vogue", "joist") can slip through. Harmless
  for the Lab; to get true non-words, bundle a larger English exclusion list (polish follow-up).
- Git: clean history; latest commit `20aa853` (this milestone adds nonsense → next commit).

### 🎉 THE PURE ENGINE IS COMPLETE — all 6 modules done, 85 tests green.
### TODO ⛔ (the game itself — now the PWA UI; see §6 build order step 3+)
- The UI shell: `index.html` + `styles.css` + `src/ui.js` + `src/state.js` (localStorage,
  export/import) + `src/audio.js` (Web Speech + Web Audio) + `src/app.js` (bootstrap, prime
  audio on first tap) + a working home screen. **← START HERE (build-order step 3).**
- The UI: HTML/CSS shell, screen router, audio, state/persistence.
- The three play surfaces: **rhythm** (fast choices), **puzzle** (drag/drop), **lab**
  (nonsense-word creativity + drawing).
- Progress, settings, feedback screens.
- PWA packaging (manifest, service worker, home-screen icons).
- README.

---

## 3. The data — schema & key facts

Every entry in `data/words.js` `WORDS`:

```js
{
  word: "because",                 // lowercase, the correct spelling
  rank: 214,                       // frequency rank, 1 = most common. PRESENT WORDS IN THIS ORDER.
  tier: 5,                         // difficulty band 1..9  (1≈age5/K  …  9≈age13/grade7-8)
  pattern: "tricky",               // an id from PATTERNS (orthographic family) — INTERNAL ONLY
  syllables: ["be","cause"],       // joined === word, always
  misspellings: ["becuase","becouse","becase","becaus","becose","becawse"], // plausible child errors; never == word
  sentence: "I was late because I missed the bus."   // short, concrete, kid-safe (often cave/gem themed)
}
```

Facts the engine relies on:
- **`rank` drives "what to teach next"** (most-common unknown word first) and the
  pre-assessment sampling. **`tier` drives difficulty** of the multiple-choice distractors
  and the easy→hard ramp. They're related but independent — use both.
- **`pattern` is internal.** Never show the learner a rule or pattern name. Patterns exist
  so the game can (a) interleave similarly-spelled words for implicit learning and
  (b) generate same-pattern **nonsense words** for the creativity lab.
- Per-tier counts (post-supplement): `{1:145, 2:254, 3:448, 4:390, 5:187, 6:553, 7:487, 8:143, 9:312}`.
- Biggest patterns: `multisyllable`(348), `ending-ed-ing`(225), `advanced-multisyllable`(198),
  `schwa-er-or-ar`(133), `ee-ea`(116), `tricky`(106), `double-cons`(102), `tion`(92)…
- A few patterns are intentionally thin (`cious-tious:1`, `tricky-ould:4`, `wh:4`,
  `latin-roots:5`, `que-gue:6`, `suffix-ous:6`). Fine — those are genuinely rare spellings.
- `misspellings` are hand/AI-curated **hard, confusable** distractors. The runtime
  distractor engine (below) ALSO generates more, and chooses easy vs hard by difficulty.
- **KNOWN MINOR CONTENT ISSUE (verified, low priority):** 7 of 2829 sentences (0.25%)
  don't contain their exact word — 4 use a morphological variant (`rights`→"right",
  `charges`→"charge", `falls`→"fall", `matches`→"match") and **3 are off-topic**
  (`playstation`, `blonde`, `concerning` — sentence never references the word). The
  blanked-sentence context in rhythm mode degrades for those. `test/data.test.js` guards
  the property at the ≥99% level (catches a bad re-merge) but tolerates these. To fix
  properly, correct the sentence at the **source** (curated.js / the relevant
  `data/chunks/part_*.js`) and re-run `node scripts/merge.mjs` — never hand-edit `words.js`.

If you ever want MORE words: bump `TARGET` in `build_backbone.mjs`, re-run it, enrich the
new chunks the same way, re-run `merge.mjs`. The pipeline scales.

---

## 4. Architecture decisions (already made — don't relitigate)

- **Platform = installable PWA web app** (vanilla HTML/CSS + ES modules, **no build step**).
  Rationale: dev machine is Windows (no Xcode), and this runs perfectly in **iPad Safari**,
  installs to the home screen (full-screen, offline), and supports touch/drag/swipe. Native
  iOS was rejected for these reasons.
- **Spoken praise & dictation = Web Speech API (`speechSynthesis`).** The learner hears the
  target word (dictation) and hears speed-tiered praise. iOS requires audio/speech to be
  unlocked by a **user gesture** — prime it on the first tap (Start button).
- **Sound effects = Web Audio API** (synthesized chimes/zaps/fanfares — no asset files).
  Keep praise SNAPPY: short synth SFX on every correct, spoken phrases on speed tiers/combos
  (don't queue slow TTS on every single answer or it lags like crazy).
- **Persistence = `localStorage`** (single JSON blob). No backend. Include **export/import
  to a JSON file** so progress + feedback can leave the iPad for the parent/dev.
- **Logic vs UI split for testability:** all decision logic lives in PURE modules under
  `src/engine/` that import nothing browser-specific, so they run under `node --test`. UI
  modules (DOM/Audio/Canvas) live elsewhere and are never imported by tests. This satisfies
  the repo's **test-first** rule.

### Learning model (decided 2026-06-17 with the user — supersedes the old SRS plan)
The earlier plan centered a Leitner/spaced-repetition scheduler. **That is dropped.** The
user's model, backed by learning-science research (blocking→interleaving / contextual
interference; the spacing effect; the word-families "don't let it become rote pattern-zipping"
caution — see git history of this file / the design chat), is:
- **Pre-assessment is the GATE.** Build + run `assessment.js` **before any levels**. It
  establishes known vs. unknown so the game never wastes time on words he already spells.
- **Levels = pattern-based PRODUCTIVE STRUGGLE on the UNKNOWN words — NOT word "retirement".**
  The pre-assessment removes known words up front; the learning loop then teaches unknowns,
  grouped by spelling pattern, ramping **blocked → interleaved**.
- **Two kid-facing levers only: session DIFFICULTY and session LENGTH.** Difficulty bundles
  *(a)* how many NEW words and *(b)* how mixed the spelling patterns are (one family → a few →
  unrelated). The kid pulls these levers; the kid does **NOT** pick individual words.
- **Word selection + progress tracking are the PROGRAM's job**, fully automatic. (Picking
  specific words could be a hidden/advanced mode later — never a default lever.)
- **Student-guided, NOT parent-guided.** The kid drives. Parents get the **same** view of the
  data and the **same** levers (no separate teacher console). Progress is transparent to both.
- **Module consequence:** the planned `srs.js` is replaced by (1) a thin, program-owned
  **progress/mastery tracker** (what's learned, what to serve next) and (2) a **session
  builder** that turns the difficulty+length levers into a concrete word set with the
  blocked→interleaved pattern mix. No interval scheduler.

### Mastery model REFINEMENT (decided 2026-06-17 with the user — supersedes binary known/unknown)
- **NO flat known/unknown categorization — it's inaccurate.** Mastery is a CONTINUOUS,
  recency-weighted score per word that also factors **response speed** (fast-correct > slow-
  correct > wrong), plus a **confidence** that grows with attempt count. "new/learning/known"
  are only *display buckets* derived from score+confidence — never a gate the engine treats
  as truth. (This OVERRIDES `assessment.result()`'s `knownWords`/`unknownWords` Sets — those
  are being refactored into continuous, confidence-tagged seeds.)
- **Difficulty is OBSERVED, not assumed.** `tier`/`rank` are only a cold-start PRIOR. A word's
  real difficulty for THIS learner = his actual responses. `effectiveDifficulty =
  blend(prior, observed)` sliding prior→observed as confidence accrues. "Productive struggle"
  is only identifiable once there's enough data to place a word in the challenging-but-
  achievable band; before that, it's genuinely undetermined.
- **The pre-assessment is NOT a separate test — it's the COLD-START phase of the same game.**
  Identical presentation/gameplay (engine is presentation-agnostic). Only the data regime
  differs: no responses yet → lean on the prior; as answers arrive → shift to observed. No
  hard "assessment done → known words" moment; just an evolving tracker that earns confidence.
- **Module consequence (refined):** `assessment.js` = the cold-start word-selection policy +
  bootstrap prior (staircase survives only as efficient early sampling, NOT as a known/unknown
  classifier). The continuous mastery tracker (`progress.js`) is the heart; the cold-start
  phase and live play feed it IDENTICALLY.

### Difficulty = TWO ORTHOGONAL AXES + UNLOCK-not-force (decided 2026-06-17 with the user)
Backed by research (existing programs mostly use ONE graded axis; the adaptive-learning lit
treats interleaving & retrieval-strength as DISTINCT dimensions — Rau/Aleven/Rummel 2013
"which dimension should we interleave?"; spacing≠interleaving have distinct theoretical bases;
in an educational game blocked practice helps *in-game* scores but interleaved helps *transfer*).
- **Axis 1 `patternSpread` (0..1):** how many spelling patterns a session mixes (interleaving /
  discriminative contrast). Rising spread PREFERS CONFUSABLE families (not random ones — that's
  where the discrimination payoff is) and shifts ordering blocked → interleaved.
- **Axis 2 `masteryTarget` (0..1):** the average "learning score" (= `progress.predictedSuccess`)
  of the words pulled in. High = review-heavy/easy; low = new-and-shaky/hard (productive struggle).
- **easy/medium/hard are PRESETS = points in this 2-D space** (`DIFFICULTY_PRESETS`). An advanced
  config screen passes a custom `{patternSpread, masteryTarget}` — saveable custom levels that
  override the defaults. `buildSession` accepts a preset name OR a custom axes object.
- **Harder difficulties UNLOCK with demonstrated mastery — the game NEVER force-bumps.**
  Unlocking is the nudge (better than forcing, per the user). `unlockedDifficulties(tracker)`
  gates by the count of "known"-bucket words (`UNLOCK_THRESHOLDS`). Kid freely picks among
  unlocked; parents see the same.

### Theme (decided): **"Crystal Spell Caverns"**
A miner/explorer descends a glowing **crystal cavern** (ties his love of rocks/minerals +
Zelda exploration + Brotato waves). Each correct spelling **mines a gem**; mastering a
**pattern** opens a **deeper cavern level**; **nonsense words become new "crystal specimens"**
the learner draws, names, and catalogs in a **Specimen Collection**. Combos = power surges.

---

## 5. Planned file layout (what to create)

```
index.html                  ✅  app shell, full-screen iPad meta, loads src/app.js (type=module)
styles.css                  ✅  kid-friendly, big touch targets, cavern/crystal theme
manifest.webmanifest        ⛔  PWA install (name, icons, display:standalone, portrait)
sw.js                       ⛔  service worker — cache app + data for offline
README.md                   ⛔  how to run on the iPad, how to give feedback, how to iterate
UX.md                       ✅  UI/UX design guide (exemplars + child-UX principles, touch rules)
server.js                   ✅
package.json                ✅
data/  (all ✅)             words.js · patterns.js · curated.js · backbone.json · chunks/
scripts/                    build_backbone.mjs ✅ · merge.mjs ✅ · smoke.mjs ✅ (Playwright UI test)
src/
  engine/   (PURE, test-first)
    lexicon.js              ✅  load WORDS/PATTERNS; REAL_WORDS (Set of all words, for
                                distractor exclusion), wordsByPattern, wordsByTier, getWord, byRank
    distractors.js          ✅  misspelling generator + multiple-choice builder  (DESIGN in §7)
    assessment.js           ✅  cold-start pre-assessment (staircase, continuous) (DESIGN in §7)
    progress.js (engine)    ✅  continuous mastery tracker (replaces srs.js)      (DESIGN in §7)
    session.js              ✅  two-axis level builder (patternSpread+masteryTarget)(DESIGN in §7)
    praise.js               ✅  DDR-style speed→praise tiers + phrase pools        (DESIGN in §7)
    nonsense.js             ✅  pattern-based nonsense-word generator (onset+rime) (DESIGN in §7)
    (progress.js also adds serializeTracker/deserializeTracker for localStorage persistence)
  state.js                  ✅  localStorage store: profile, settings, gems, stats, feedback +
                                LIVE mastery tracker; export/import/reset JSON
  audio.js                  ✅  prime() on first gesture; say() dictation; speakPraise();
                                sfx() via Web Audio; respects settings; silent if no audio/voices
  ui.js                     ✅  screen router (render), el() helper, shared gem/depth header,
                                particle burst, toast
  app.js                    ✅  bootstrap: load state, ctx wiring, prime audio on first tap, routes
  modes/
    rhythm.js               ✅  CORE fast loop — DDR style, built + smoke-verified (DESIGN in §8)
    puzzle.js               ⛔  drag/drop unscramble + fill-the-blanks (DESIGN in §8)
    lab.js                  ⛔  nonsense-word spell + draw-a-meaning canvas (DESIGN in §8)
  screens/
    home.js                 ✅  big themed menu (Play live; Crystal Lab/Feedback stubbed)
    assess.js               ⛔  OPTIONAL — cold-start already happens inside rhythm (see §0/§4)
    progress.js             ✅  gem haul, cavern depth, mastery spectrum, recent-days strip
                                (TODO: specimen collection, pattern map)
    settings.js             ✅  difficulty (unlock-gated)/length/choices/voice/volume/name +
                                export/import/reset  (TODO: advanced 2-axis custom levels)
    feedback.js             ⛔  emoji fun-rating + "too hard / just right / too easy" + note +
                                "export my data" button  (state.addFeedback already exists)
test/
  data.test.js              ✅  dataset integrity (valid patterns, syllables join, no dups, sorted) + lexicon helpers
  distractors.test.js       ✅  rng/shuffle/levenshtein + generateMisspellings + buildOptions (ramp, curated, exclusions)
  assessment.test.js        ✅  cold-start staircase: frontier, responses+timing, seeds tracker
  progress.test.js          ✅  continuous mastery: EMA, confidence, prior→observed blend, buckets
  session.test.js           ✅  two axes, unlock gates, confusable-cluster pick, blocked↔interleaved
  praise.test.js            ✅  tier boundaries, speed+combo scoring, milestone phrases, gentle wrong branch
  nonsense.test.js          ✅  pronounceable non-words per pattern, signatures, avoid/realWord exclusion
```

---

## 6. Recommended build order (next session)

1. ~~**`src/engine/lexicon.js` + `test/data.test.js`** — load the data, expose helpers, lock in
   integrity with a test.~~ **✅ DONE** (commit `810487d`, 14 tests green). **← START HERE: step 2.**
2. ~~**Pure engine modules, test-first**: `distractors` → `praise` → `assessment` → `progress`
   → `session` → `nonsense`.~~ **✅ ALL DONE — engine complete, 85 tests green.**
3. **Shell ← START HERE** (read **`UX.md`** first — research-backed design guide): `index.html`
   + `styles.css` + `src/ui.js` + `src/state.js` + `src/audio.js` + `src/app.js` with a working
   **home screen** and audio priming on first tap. UI verified with **Playwright** (real browser).
4. **`src/screens/assess.js`** wired to `engine/assessment.js` — the gamified pre-assessment
   that seeds the unknown-word queue.
5. **`src/modes/rhythm.js`** — the core DDR loop (this is the heart of the game).
6. **`src/modes/puzzle.js`** then **`src/modes/lab.js`** — alternate modes + creativity.
7. **`progress.js`, `settings.js`, `feedback.js`**.
8. **PWA**: `manifest.webmanifest`, `sw.js`, icons. Test install on the iPad via `npm start`.
9. **README.md**. Final pass + commit.

Work **test-first** and **commit per milestone** (repo rule). The Stop-hook **goal** is still
active and will keep the session focused on finishing the game.

---

## 7. Pure-engine module designs (signatures to implement)

> NOTE: `distractors.js` ✅ and `praise.js` ✅ are implemented + tested. Per the §4 learning-
> model decision, the next module is **`assessment.js`** (the gate), then `progress.js`
> (engine mastery tracker, replacing the old `srs.js`) and `session.js` (the level builder).

**`distractors.js`** ✅ — lets the game scale to thousands of words without hand-authored wrong
answers, and produces the easy→hard "very similar spellings" endgame.
- `mulberry32(seed)` → seeded rng; `shuffle(arr, rng)`; `levenshtein(a,b)`.
- `generateMisspellings(word, {realWords, max})` → ranked list, **closest (most confusable)
  first**, via real child-error transforms (vowel-team swaps ai/ay/a, ee/ea/e, ie/ei; double/
  undouble consonant; silent-e add/drop; transpositions; dropped/swapped vowels; c/k, ph/f,
  tion/shun…). Excludes the word and (if `realWords` Set given) any real word.
- `buildOptions(word, {count=3, difficulty=0..1, curated=[], realWords, rng})` →
  shuffled `[{text, correct}]`. **difficulty 1 = hardest** (pick minimally-different
  distractors from the front of the closest-first pool); **0 = easy** (more obviously wrong).
  Use the word's curated `misspellings` first, then generated; guarantee enough options.

**`praise.js`** ✅ — DDR/Pump-It-Up reinforcement (implemented + tested, build-order step 3).
- `SPEED_TIERS` e.g. perfect(≤~1.2s) / amazing(≤~2.2s) / great(≤~3.5s) / good(else), each with
  label, color, point multiplier.
- `gradeAnswer({correct, responseMs, combo, rng})` → `{tier, label, phrase, points, mult, color}`.
  Phrase pools per tier + special **combo** phrases at milestones (every 5). `audio.speakPraise`
  speaks `phrase`; UI shows `label` big with `color`. Wrong → gentle "try again" (no harsh buzz).

**`progress.js` (engine mastery tracker)** ✅ — REPLACES the dropped `srs.js`. Program-owned
record of what the learner has learned; no interval scheduler. Drives word selection + the
data the kid/parent can read. (Implemented; continuous mastery — see §2 entry for the API.)
- `createTracker(seed?)` → state seeded from `assessment.result()` (knownWords pre-marked
  "known", unknownQueue as the to-learn pool, frequency-ordered).
- `recordAnswer(tracker, word, correct, {fast})` → updates that word's status
  (new → learning → known) on a short correct-streak; a miss drops it back and flags it to
  resurface sooner **within the learning set** (productive struggle, not interval scheduling).
- `summary(tracker)` → `{ known:Set, learning:Set, unseen:[...], perPattern, counts }` — the
  transparent progress view (same for kid + parent).
- NOTE: spaced *mixing* (open a session with a shuffled review of recent words) is enforced by
  `session.js`, not by per-card due-dates.

**`session.js` (level builder)** ✅ — turns the kid's two levers into an actual word set.
(Implemented + tested; see the §2 entry + §4 two-axis decision for the final API.)
- `buildSession(tracker, { difficulty: 'easy'|'medium'|'hard' | 0..1, length, rng })` →
  an ordered list of word entries to play, where **difficulty bundles** *(a)* how many NEW
  words to introduce vs. review and *(b)* the spelling-pattern MIX: `easy` = one pattern family
  (blocked); `medium` = a few contrasting families (light interleave); `hard` = unrelated /
  confusable patterns under speed (full interleave — the §1-#6 endgame). `length` sets how many
  items. Opens with a shuffled mixed-pattern review of recent words (the spacing benefit), then
  introduces new words grouped for productive struggle.
- All word selection is program-driven (the kid never picks words). Pulls from `tracker`.

**`nonsense.js`** ✅ — for the Crystal Lab (implemented + tested; see §2 entry for the API +
the known real-word-exclusion limitation).
- `ONSETS` list + `RIMES` per pattern id (e.g. `ight → ["ight"]`, `silent-e-a → ["ake","ame","ate"]`).
- `makeNonsenseWord(patternId, {realWords, rng, avoid})` → a pronounceable **non-word** in that
  pattern (e.g. "splight", "dathe"), excluded against `realWords` (the dataset) and `avoid`.

**`assessment.js`** — gamified adaptive pre-assessment (**THE GATE — build first**); **samples
by frequency**, adapts by tier. Presentation-agnostic: the engine yields words; the screen
decides MC ("tap the correct spelling") vs. type-in.
- `createAssessment(words, {startTier, batch, minItems, maxItems, climbThreshold, rng})`,
  `nextItem(state)` (→ word entry or null when done), `submit(state, word, correct, {fast})`,
  `isDone(state)`, `result(state)` → `{ knownWords:Set, unknownWords:Set,
  unknownQueue:[words frequency-ordered], estimatedTier, perPattern, itemsAsked }`.
- Staircase: ask `batch` items per tier from `startTier` up; climb while accuracy ≥
  `climbThreshold`, stop at the "frontier" where errors appear; `estimatedTier` = highest tier
  passed; ~18–25 items. Output seeds the `progress.js` tracker (unknown, most-common first).
- ✅ DONE (per §4 mastery-model refinement): `result()` no longer emits `knownWords`/
  `unknownWords` Sets. It returns `{estimatedTier, perPattern, responses (with responseMs/
  fast), itemsAsked, correctCount}`; `progress.seedFromAssessment(tracker, result)` replays
  those responses into the continuous tracker. The staircase remains the cold-start sampler.

---

## 8. Play-surface designs

**Rhythm mode (`modes/rhythm.js`)** — the core, fast, DDR-style loop:
- `audio.say(word)` dictates; show the sentence with the word blanked for context.
- 3–4 spelling options (from `buildOptions`, difficulty from settings + adapting per word/tier)
  slide/drop in; learner **taps the correct one fast**.
- On correct: `praise.gradeAnswer` → big colored label + spoken phrase + SFX + **combo meter**;
  mine a gem; `srs.review(card, true, {fast})`. On wrong: gentle nudge, show correct, schedule
  the word sooner, optionally bounce it to a puzzle round (productive struggle).
- Brotato-flavored "waves": N words per wave, then a short reward/break (or a Lab unlock).
- Difficulty auto-ramps: as a word's mastery rises, distractors get more similar (toward tier-hard).

**Puzzle mode (`modes/puzzle.js`)** — breaks the rhythm, higher-order:
- Drag letter tiles to **unscramble** the word, or **drag letters into blanks** / fill missing
  letters. Touch drag-drop + swipes. Slower, deliberate. Used for lapsing/harder words.
- Same SRS hooks; success feels earned (bigger gem).

**Crystal Lab (`modes/lab.js`)** — creativity, main-purpose-adjacent:
- Pick a **pattern the learner has been practicing**; `nonsense.makeNonsenseWord` invents a
  same-pattern non-word; `audio.say` it; learner **spells it with letter tiles**.
- Then **draw its "meaning" on a `<canvas>`** and **name the specimen**. Saved to the Specimen
  Collection (shown in Progress). Reinforces the pattern implicitly + adds the missing creativity.

---

## 9. Requirements → where each is satisfied

| # | Requirement | Where |
|---|---|---|
| 1 | Gamified pre-assessment | `engine/assessment.js` + `screens/assess.js` |
| 2 | Most-common words first | `rank` ordering in `data/words.js`; SRS queue by rank |
| 3 | Similar-spelling groups, no explicit rules | `pattern` field (internal); interleaving + Lab |
| 4 | Iterative introduce/reinforce unknowns | `engine/srs.js` `selectNext` + assessment seed |
| 5 | DDR-style speed praise ALOUD | `engine/praise.js` + `audio.speakPraise` |
| 6 | Easy→hard, very-similar spellings, speed+accuracy | `distractors.buildOptions(difficulty)` ramp |
| 7 | Creativity: nonsense words + drawing | `engine/nonsense.js` + `modes/lab.js` |
| 8 | iPad drag/drop/swipe | `modes/puzzle.js`, `modes/lab.js` (Pointer/touch) |
| 9 | Two alternating modes | rhythm ↔ puzzle switching in the session loop |
| 10 | Kid-friendly config (speed/difficulty) | `screens/settings.js` + `state.js` |
| 11 | Built-in feedback | `screens/feedback.js` + exportable log in `state.js` |
| 12 | Visible progress over time | `screens/progress.js` + telemetry in `state.js` |

---

## 10. How to run / test / git

- **Run on iPad:** `npm start` → it prints `http://<LAN-IP>:5173`. Open that on the iPad
  (same Wi-Fi) → Share → **Add to Home Screen** for full-screen.
- **Tests:** `npm test` (Node's built-in runner over `test/*.test.js`). Currently **14 green**.
- **Rebuild dataset:** `node scripts/merge.mjs` (or re-fetch with `build_backbone.mjs` first).
- **Git:** clean; HEAD = `810487d`. There is an active **Stop-hook goal** (build the game) and a
  **PreToolUse test gate** that runs `npm test` before Bash — keep the suite green or Bash is gated.
- Repo rules (from `~/.claude/CLAUDE.md`): commit baseline before big changes; **test-first**;
  run tests before every commit; prefer `curl` then Playwright for web fetches; decompose &
  delegate to subagents (sonnet for mechanical, opus for hard reasoning) and run them in parallel.

---

## 11. Open questions / concerns
- **Learner's name** for personalization? (default: "Explorer" / configurable in Settings)
- **Default theme color** of the cavern (default: crystal-blue; configurable).

### ⚠️ Play-test concerns raised by the user (2026-06-17)
1. **AUDIO QUALITY — RESOLVED (generation is incremental).** Browser `speechSynthesis` was
   too robotic. Now: pre-generated **Gemini neural TTS** clips (voice **"Kore"**), served as
   MP3 and played by `src/audio.js`, with Web Speech as the fallback for any word that
   doesn't have a clip yet. Pipeline = `scripts/gen_audio.mjs` (`npm run gen:audio`).
   - **Free-tier reality:** Gemini free tier allows only **10 requests/DAY per model** (3 TTS
     models ≈ 30/day). The generator works around this by **batching ~30 words per request**
     and **splitting the returned audio at the N−1 longest silences** (the word count is
     known, so the split is exact — proven clean at 15/15 and 30/30). That makes the full
     ~2,950-clip set **free over ~2–3 days**, most-common words first.
   - **To continue:** `GEMINI_API_KEY=<key> npm run gen:audio` once per day until the manifest
     covers everything (it's RESUMABLE — skips existing files, rotates across the 3 TTS models,
     stops when the daily caps are hit). Paid alternative: enable Gemini billing and it finishes
     in ~1hr for ~**$1–3 one-time** (25 audio-tokens/sec, ≈$0.03/min output) — not required.
   - **Files:** `audio/words/<slug>.mp3`, `audio/phrases/<slug>.mp3`, `audio/manifest.json`
     (slug = lowercase, non-alnum→`_`). `server.js` serves `.mp3`. `audio/` is **git-ignored**
     until a full single-voice set exists, then commit it (or keep regenerable).
   - ⚠️ **The user's Gemini API key was shared in chat — advise rotating it** in Google AI Studio.
   - Timing was also fixed earlier: the speed clock starts only after the word is fully spoken
     + a 1.5s comprehension grace.
2. **PEDAGOGY / TRANSFERENCE (shelved, must revisit).** Choosing the correct spelling from
   multiple choices is RECOGNITION, which may not build spelling PRODUCTION/recall. Need
   production modes (type-in, drag/tap-to-build letters = the puzzle/lab modes) and a way to
   **test real-world transference** (does in-game gain transfer to spelling the word
   unaided?). Keep the MC rhythm loop, but don't assume it teaches spelling on its own.

---

### One-paragraph summary for whoever picks this up
The **word data and the entire pure decision engine are finished and tested (87 tests green)**.
The data: a **2,919-word**, frequency-ordered, ages-5–13 dataset (`data/words.js`) in 63 internal
spelling-pattern families, each word with tier / syllables / plausible child misspellings /
kid-safe sentence — rebuildable via `scripts/merge.mjs` (chunks + `curated.js` + `supplement.js`).
The engine (`src/engine/`, all pure + UI-agnostic): `lexicon` (data access), `distractors`
(misspelling generator + multiple-choice builder), `praise` (DDR speed→praise tiers + combos),
`assessment` (cold-start adaptive staircase that seeds the tracker — NO binary known/unknown),
`progress` (CONTINUOUS mastery tracker: recency+speed-weighted score + confidence; difficulty is
observed, not assumed), `session` (TWO-axis level builder: `patternSpread` × `masteryTarget`,
easy/med/hard presets + custom, harder levels UNLOCK with mastery — never forced), and `nonsense`
(pattern-based Crystal-Lab specimens). The **key design decisions live in §4 — don't relitigate
them.** **Everything UI is still to build** (see §0 for the exact next action): a thin PWA shell
then the **rhythm mode** (DDR "tap the right spelling" with spoken praise + gem mining), then
puzzle mode, the Crystal Lab, and progress/settings/feedback screens — themed as a crystal-cavern
mining adventure, designed per **`UX.md`** (touch-first, big targets, tap-or-drag, gentle).
Verify UI with **Playwright**; run on the iPad with `npm start`. Keep `npm test` green; commit per
milestone.

---

## 12. SESSION UPDATE — 2026-06-17 (audio pipeline + what's next) — READ THIS

**The game is playable on the iPad and the user confirmed "it works."** This session added a
real-voice TTS pipeline and surfaced the next priorities. Git: several commits past the shell
(serialize tracker → shell+rhythm → play-test fixes → batched audio gen). `npm test` = **92 green**.

### Audio — current state & the PLAN (voice exploration is TABLED; stick with Kore)
- **Voice = "Kore"** via Gemini model **`gemini-3.1-flash-tts-preview`**. Decided to **stick with
  Kore for now** — do NOT keep auditioning voices (user tabled it to make game progress).
- **What's generated (updated 2026-06-18):** **722 word clips (top-722 by frequency) + 28 praise/
  gentle phrases**, in `audio/` (git-ignored), listed in `audio/manifest.json`. **~2,227 words still
  pending.** (+480 generated this session before the daily cap; re-run `npm run gen:audio` another day
  to continue — but FIRST add the fail-fast guard, see §17.C: it loops forever on a per-minute 429.)
- **Runtime (`src/audio.js`) plays `/audio/{words,phrases}/<slug>.mp3` when present, else Web Speech.**
  So uncovered words use the browser voice until their clip exists. `server.js` serves `.mp3`.
- **Generation = `scripts/gen_audio.mjs`** (`GEMINI_API_KEY=… npm run gen:audio`). It BATCHES ~30
  words/request and SPLITS the audio at the N-1 longest silences (proven clean). Resumable.
- **THE BLOCKER = Gemini FREE tier: 10 requests/DAY *per model*.** We exhausted today's flash quota.
  The pro TTS model is **free-tier `limit: 0`** (paid only). So bulk generation is gated.
  - **PLAN the user chose:** *periodically re-run the SAME batched method (Kore, `gen_audio.mjs`,
    single model `gemini-3.1-flash-tts-preview`) "every so often" to detect when the daily quota
    has reset, then let it generate more.* Each run resumes (skips the 242 done). ⚠️ Only run with
    the user's awareness — see the [[approval-before-consuming-limits]] memory: NEVER spin a
    quota-consuming job unattended, and stop the moment it walls (no-audio / 429). **RECOMMENDED
    small fix before the next retry: add a fail-fast guard to `gen_audio.mjs`** so a retry that hits
    the wall stops after 1–2 empty/429 responses instead of looping.
  - **The real unblock = enable BILLING** on the Gemini API (→ Tier 1, huge limits) → full set in
    ~1hr for **~$1–2 one-time** (pay-as-you-go, NOT a subscription). KEY FINDING: **Google AI Pro
    (the consumer monthly plan) does NOT raise API rate limits** — API tiers are billing-based only
    (rate-limits doc). The AI Studio *interactive* UI caps generation at ~10s; only the API (Tier 1)
    does bulk. User is still deciding billing vs. waiting; do not enable it for them.
- **Style prompts (not yet used):** Gemini TTS supports a "scene/sample context" style steer (AI
  Studio exposes it). Our API calls used NONE (plain Kore). If we later want slower/clearer
  dictation + cheerful feedback, pass a style instruction — but VERIFY it isn't spoken (would add a
  leading segment and break the silence-split). Suggested style text is in the chat log.
- **Local TTS (Piper) was tried and REJECTED** by the user as "terrible computer voice." The
  binary + voices live in `tools/` (git-ignored). Kept only as a fallback; not the path.
- ⚠️ **The user's Gemini API key was pasted in chat earlier — remind them to ROTATE it.**

### 🐞 OPEN BUG (reported this session): praise audio clipped
- Symptom: spoken praise (e.g. "Combo x5!") is **cut off** — the next word's dictation starts before
  the praise finishes.
- Cause: in `src/modes/rhythm.js`, after a correct answer we `audio.speakPraise(...)`, then ~850ms
  later `present()` runs and calls `audio.say(nextWord)`, which cancels/replaces the in-progress
  voice (both `speakTTS` → `speechSynthesis.cancel()` and `playClip` reuse the same `<audio>` el).
- Fix options (next turn): (a) don't speak praise + dictate so close together — lengthen the
  post-correct delay when `verdict.isCombo`/spoken praise fired, or chain (speak praise → on its
  `onDone`, then advance + dictate); (b) give praise its own player (already `praiseEl` separate
  from `clipEl`) AND make `say()` not cancel the praise player — but the ~850ms advance is the real
  culprit, so sequencing/longer delay is the clean fix.

### ▶️ NEXT TURN FOCUS (what the user wants built next): MORE GAME
Audio is parked. Spend the next turn building game surfaces (all NO-API, pure front-end/engine):
1. **`src/modes/puzzle.js`** — drag-OR-tap-to-BUILD the word from letter tiles (UX.md §0 forgiving
   drag + tap-to-place; big snap zones). This is the **production/recall** mode that answers the
   pedagogy concern (recognition ≠ recall). Wire to `progress.recordAnswer` + `praise`.
2. **`src/modes/lab.js`** — Crystal Lab: `nonsense.makeNonsenseWord` → spell with tap tiles → draw
   meaning on `<canvas>` → save to Specimen Collection (shown in Progress).
3. **`src/screens/feedback.js`** — emoji rating + too-hard/just-right/too-easy + note (`state.addFeedback` exists).
4. Polish: rhythm ↔ puzzle alternation in a session; the clipping bug fix; progress specimen view.
5. **PWA packaging** (`manifest.webmanifest`, `sw.js` offline cache incl. `audio/`, icons) + README.
Keep `npm test` green, verify UI with `npm run smoke`, commit per milestone.

### Server / housekeeping
- A dev server may be left running on `:5173` (`npm start`). `node_modules`, `audio/`, `tools/`,
  `scripts/smoke.png` are git-ignored. Tooling (`playwright`, `@breezystack/lamejs`) is in
  devDependencies; the shipped app stays zero-runtime-dependency.

---

## 13. SESSION UPDATE — 2026-06-17 (game surfaces complete) — READ THIS FIRST

This session built out the rest of the game. **It is now feature-complete and
installable.** `npm test` = **101 green**; `npm run smoke` drives every mode in a real
browser and passes. All committed; tree clean except the orphan experiment
`scripts/oneshot.mjs` (an untracked one-shot TTS test from the audio work — unrelated,
left untracked).

**Built + verified this session (each its own commit):**
1. **`src/modes/puzzle.js` — Craft mode (production / recall).** Hear a word, BUILD it
   from scrambled letter tiles (tap-to-place + pointer-drag). Answers the §12 pedagogy
   concern (recognition ≠ recall). Gentle: a wrong full build keeps the letters that fit
   + returns the rest; 💡 hint always available. Honest mastery — only a clean first try
   counts as a correct production. Pure core extracted to **`src/engine/puzzle.js`**
   (`scrambleTray` + `gradeBuild`), test-first in **`test/puzzle.test.js`** (9 tests).
2. **Praise-clipping bug FIXED** (was the §12 open bug). `audio.speakPraise` now takes an
   `{onDone}`; rhythm holds the next word's dictation until praise finishes (floor + cap
   backstop). No more cut-off "Combo x5!".
3. **`src/modes/lab.js` — Crystal Lab (creativity, requirement #7).** invent (nonsense
   word in a practised pattern, pattern never named) → spell (unscramble) → DRAW its
   meaning on a `<canvas>` (palette + erase/clear) → name + SAVE as a specimen. Earns
   gems; **never touches the mastery tracker** (nonsense words aren't real). Specimens
   persist (`state.specimens`, capped 60, drawing downscaled to a 220px PNG) and show in
   **Progress** (new specimen gallery).
4. **`src/screens/feedback.js` — built-in feedback (requirement #11).** emoji rating +
   too-easy/just-right/too-hard + note + "export my data". Uses `state.addFeedback`.
5. **PWA packaging (installable + offline).** `manifest.webmanifest`, `sw.js` (precaches
   the whole app shell + word data + icons; cache-first; **skips `/audio/`** to avoid
   ranged-media bugs — falls back to device voice offline), and **`icons/`** (a faceted-
   crystal SVG rasterized to 192/512 + a 180 apple-touch-icon via
   `scripts/gen_icons.mjs`, headless-Chromium, no image libs). `index.html` registers the
   SW. ⚠️ SW only runs in a **secure context** (HTTPS/localhost) — over plain LAN http it
   installs + runs online but won't cache offline (documented in README).
6. **`README.md`** — run-on-iPad guide, mode overview, test/dev, offline notes.
7. **Engagement / on-task system (user-requested).** A child can't blank out, draw
   forever, OR stall on a menu. `ui.js` `createIdleGuard` (document-wide pointer/key
   watchdog) + `pauseOverlay` + `pulse(node)`. Two escalation shapes:
   - **Active play** (rhythm/puzzle/lab spell+draw): ~12s no interaction → nudge
     (re-dictate + pulse tiles); ~26s → a BLOCKING "Paused — tap to resume" overlay.
     Rhythm pause freezes the speed clock; resume = fresh read window (no penalty).
   - **Menus** (home + the rhythm/puzzle wave-reward screens): pass `onTimeout` instead of
     the overlay → ~9s highlight the primary/Play card, ~18s **auto-start the next thing**
     ("let's go" → into a wave). Home gates auto-launch on `ctx.audio.isPrimed()` because
     iOS needs a tap to unlock audio — before the first tap it just keeps highlighting Play.
   - The open-ended LAB DRAW step also has a hard time cap — soft nudge at 25s, auto-advance
     to naming at 50s. `app.js` gained a **`ctx.onLeave(fn)`** teardown registry (run on nav)
     so guards/timers never leak. Thresholds scale via `window.__idleTest` for the smoke test.
     (Constants: `ui.js` defaults; per-screen overrides in home/rhythm/puzzle; `lab.js`
     `DRAW_SOFT_MS`/`DRAW_HARD_MS`.)

**Home menu is now:** Play · Craft · Crystal Lab · Progress · Settings · Feedback (all
live). Modes cross-link from their reward/finish screens.

### ▶️ What's LEFT (small / optional)
- **Audio generation is the only real parked item** — still gated by the Gemini free-tier
  daily cap; the device voice covers everything meanwhile. See §12 for the plan
  (`npm run gen:audio`, run only with the user's awareness — [[approval-before-consuming-limits]]).
  ⚠️ Still remind the user to **rotate the Gemini API key** pasted in chat earlier.
- **Nice-to-haves, not blockers:** within-a-single-session rhythm↔puzzle *alternation*
  (today they cross-link via buttons, but a session is still one mode); a dedicated
  gamified assessment intro (cold-start already happens inside rhythm — §0/§4); advanced
  2-axis custom difficulty screen; the §3 7-sentence content nit; the nonsense real-word
  exclusion polish (§2). The §12 PEDAGOGY/transference concern is now partly answered by
  Craft (production), but real-world transfer testing is still unbuilt.
- If picking up: the engine + all UI are done and verified — focus is polish + audio, not
  new surfaces. Keep `npm test` green, verify UI with `npm run smoke`, commit per milestone.

---

## 14. QA & ITERATION PROCESS — ⭐ DO THIS NEXT (the user's current priority)

The user play-tested and reports the app "doesn't seem to be working" — **a number of
UX/visual issues, not one crash.** Automated proof points are GREEN (101 node tests + the
Playwright smoke pass; an exploratory pass found **zero console / pageerror / network
errors**). So the remaining problems are **visual / layout / UX / behavioral** — precisely
what pass/fail tests miss. **The next session's job is an exploratory, visual QA-and-FIX
loop — NOT writing more persistent tests.** Fixes are applied directly and re-verified by
looking at screenshots. (The existing tests/smoke stay as the regression net; add a new
persistent assertion ONLY if a specific fix is subtle and regression-prone.)

### How to QA (every pass)
1. **Drive the LIVE app with Playwright** (`npm start`, then a scratch script). Do NOT trust
   the smoke's synthetic happy-path. Behave like a real kid: wrong answers, idling, long
   sentences, every mode + screen, edge cases, repeated waves.
2. **Attach + watch monitoring hooks** each pass: `console` (error+warning), `pageerror`,
   `requestfailed`. (`scripts/qa.mjs` already wires these and prints a summary.)
3. **Screenshot FREQUENTLY and read EACH PNG, judging it like a human:** layout balance,
   overflow/clipping, content jammed at edges, contrast/legibility, alignment, stuck or
   replayed animation states, broken art, off-screen content — things that look wrong even
   when no error fired. The bar is "does it look right to a person," not "did the selector
   resolve."
4. **Probe with measurements** when a screenshot is ambiguous (`getBoundingClientRect()` vs
   `innerHeight` to prove overflow, etc.). Test **several viewports** (iPad-10.2 810×1080,
   mini 744×1133, portrait + landscape) AND a **reduced height** (simulate Safari's toolbar
   in not-installed mode) AND **touch emulation** (`hasTouch:true` + real pointer drags) —
   the smoke only taps, so touch-DRAG in puzzle/lab is essentially untested.
5. Where possible, sanity-check on a **real iPad** (audio quality + dictation timing, touch
   drag, safe-area / home-indicator) — headless can't judge those.

### The harness — `scripts/qa.mjs` (committed; its `scripts/qa/` output is git-ignored)
`node scripts/qa.mjs` drives home→rhythm→puzzle→lab→progress→settings→feedback, screenshots
every state into `scripts/qa/NN-*.png`, and prints a console/error/network summary.
`VIEW=landscape node scripts/qa.mjs` for landscape. **It is a SCRATCH tool — extend it freely
as you probe; do not treat its output as a regression gate.**

### The fix loop (per issue)
**(a)** reproduce + screenshot → **(b)** form a root-cause hypothesis, naming the suspect
file/CSS → **(c)** fix in code → **(d)** re-drive + re-screenshot and **confirm visually** →
**(e)** mark it in the backlog (✅/notes). Commit per fix or per small cluster. Keep
`npm test` + `npm run smoke` green throughout.

### ISSUE BACKLOG — seeded from the 2026-06-18 exploratory pass (verify · fix · extend)
Screenshot refs `NN-*` are from that pass; re-run `qa.mjs` to regenerate them.

- **I1 — Rhythm & Puzzle vertical balance (MED).** Big empty void mid-screen with the
  tiles/slots/tray jammed ~14px from the bottom (measured: last answer tile sits only 14px
  above the viewport on iPad-10.2 / portrait / mini). Not a hard clip on those heights —
  the `flex:1` `.prompt`/`.lab-stage` absorbs the slack — but it looks bottom-heavy and
  leaves no breathing room under any browser chrome / the home-indicator. Fix idea: cap the
  prompt's growth, pull the answer area toward center, add real bottom padding. Suspect:
  `styles.css` `.prompt`, `.tiles`, `.puzzle`, `.lab-stage`. Refs: 02/03/04 (rhythm), 06/07 (puzzle).
- **I2 — Crystal Lab emits REAL words as "nonsense" (MED-HIGH).** The pass generated
  **"greet"** and presented it as a brand-new crystal to spell + name. Real-word leakage:
  `makeNonsenseWord` only excludes `REAL_WORDS` (the 2,919-word dataset), so common real
  words outside it slip through. Wrong/confusing for a spelling game. Fix: exclude against a
  larger bundled English word list (or post-filter candidates). Suspect: `src/engine/nonsense.js`,
  `src/engine/lexicon.js`. Refs: 12/13.
- **I3 — Home "Play" card description is low-contrast (LOW).** The "…spelling the words you
  hear" subtext is barely legible on the purple gradient. Suspect: `.menu-card .desc` vs
  `.menu-card.play` bg in `styles.css`. Ref: 01.
- **I4 — Engagement timings may feel wrong for a weak speller (NEEDS USER DECISION).** A 26s
  idle→"Paused" overlay can fire while a kid is legitimately thinking about a hard word (reads
  as broken); the 18s home/reward auto-launch can feel like the app "does things on its own."
  Re-tune (longer thresholds? nudge-only while actively thinking?). This was just added — it
  may BE part of what the user means by "not working." Confirm intended feel with the user.
  Files: `ui.js` defaults + per-screen overrides in `home/rhythm/puzzle`, `lab.js` draw caps.
- **I5 — Economy / progression sanity (LOW).** ~380 gems for one perfect-speed wave is very
  high — consider scaling. After one full wave, **0 words show "Mastered"** (mastery needs ≥2
  exposures: confidence = 1−0.5^attempts = 0.5 after one). Verify difficulty UNLOCK thresholds
  are reachable in real play and that the kid visibly progresses. Files: `engine/praise.js`
  (points), `engine/progress.js` (mastery/confidence), `engine/session.js` (UNLOCK_THRESHOLDS).
- **I6 — DEVICE / TOUCH-ONLY checks (MUST do via touch-emu and/or a real iPad).** Audio
  quality + dictation timing; **puzzle/lab touch-DRAG** (smoke only taps — drag is untested in
  a real touch context); safe-area / home-indicator layout; "Hear it again" actually replays.
  Use Playwright `hasTouch:true` + real `mouse`/touch drags; a real iPad where possible.
- **I7 — Known content nit (LOW, see §3).** 7/2829 sentences don't contain their exact word
  (3 off-topic: playstation/blonde/concerning) → blanked-sentence context degrades there. Fix
  at source (`curated.js` / the chunk) + `node scripts/merge.mjs`.
- **I8 — Minor polish.** Puzzle Hint/Clear stay visible after solve (harmless — consider
  hiding on solve). Add more as found.

⚠️ The list above is a SEED, not the full set — the user expects the next session to keep
exploring and **find the issues they didn't bother to enumerate.** Re-run `qa.mjs`, read the
screenshots, and add what you see.

---

## 15. SESSION UPDATE — 2026-06-18 (QA fixes DONE + research-backed improvements DONE) — READ FIRST

This session ran the §14 exploratory visual QA-and-fix loop to completion, then added a round
of engagement/pedagogy improvements grounded in research on successful kids' literacy apps
(Duolingo, Khan Kids, Teach Your Monster, Reading Eggs, Prodigy + learning-science studies).
`npm test` = **123 green**; `npm run smoke` green; `node scripts/qa.mjs` = 0 console/JS errors.
Every change verified by reading screenshots across iPad-10.2 / mini / landscape / reduced-height.
All committed; tree clean except the long-standing orphan `scripts/oneshot.mjs`.

### QA fixes (the §14 backlog I1–I8, all resolved + extras found)
- **I1 (layout) ✅** — rhythm + puzzle no longer leave a big mid-screen void with tiles jammed at
  the bottom. Play content lives in a `.play-body` (auto-margin-centered prompt zone + answer
  zone); tile/slot/tray sizes + gaps scale with viewport height so two tile rows fit and stay off
  the edge on short screens. (`styles.css`, `rhythm.js`, `puzzle.js`.)
- **I2 (Lab real words) ✅** — the nonsense generator leaked real words (e.g. "leaf", "greet").
  `scripts/build_nonsense_blocklist.mjs` precomputes the real-word combos → `data/nonsense_blocklist.js`
  (3,608 words, 26 KB); the Lab excludes `REAL_WORDS ∪ blocklist`. Regenerate if `nonsense.js`
  ONSETS/RIMES change. (`lab.js`, +2 tests.)
- **I3 / I8 (polish) ✅** — Play/Craft/Lab/Repair card descriptions brightened (were near-invisible
  on the gradients); puzzle Hint/Clear hide once a word is solved.
- **I4 (engagement timings) ✅, decision made** — every idle threshold lengthened so it never
  interrupts a weak speller mid-think: active play nudge 12→15s, blocking overlay 26→45s; menus
  nudge 9→13s, auto-continue 18→30-32s; Lab draw cap 25/50→40/90s. The user's "menus pull kids in"
  auto-launch was KEPT (deliberate feature) but softened. **If the user still finds auto-launch
  intrusive, it can be turned into nudge-only — surfaced for their call but not blocked on.**
- **I5 (economy/progression) ✅** — added a monotonic `knownPeak` to the tracker so difficulty
  UNLOCKS never regress when recency-weighted mastery dips (they used to re-lock — felt broken).
  Gem economy left as-is (big "haul" numbers motivate; no spend sink yet to scale against).
- **I7 (content) ✅** — all 13 sentences that used a morphological variant or were off-topic now
  contain their exact word (overrides in `data/supplement.js`, re-merged). 0/2919 sentences now
  lack their word.
- **I6 (touch) ✅** — touch-DRAG verified in puzzle/lab via Playwright `hasTouch` + real pointer
  drags across all viewports (`scripts/qa_probe.mjs`).
- **Extra (found in exploration):** long answer words (e.g. "communications") clipped in rhythm
  tiles → font max lowered + `overflow-wrap` so they shrink/wrap, never clip (`scripts/qa_probe2.mjs`).

### Research-backed improvements (the "improve as much as possible" pass)
A full research brief lives in **`RESEARCH.md`** (prioritized, cited). Implemented (highest value first):
1. **Anti-imprinting (rhythm)** — seeing misspellings imprints them (Roediger & Marsh 2005); after
   every answer the wrong tiles fade and the CORRECT spelling is spotlighted, so the last thing on
   screen is always right. (`rhythm.js`, `styles.css`.)
2. **"Cracked crystals" — production review of missed words (the big pedagogy win).** A miss tags a
   word `lapsed`; it resurfaces for PRODUCTION practice (build-the-word, recall ≠ recognition) until
   re-mastered. A SELECTOR over the continuous tracker, NOT a new SRS scheduler (honors §4).
   Surfaced as an amber **Repair (N)** home card + a Craft `{review:true}` mode + a Progress count.
   (`progress.js` `lapsedWords`, `session.js` `buildReviewSession`, `puzzle.js`, `home.js`, +5 tests.)
3. **Guilt-free daily streak + tiny daily gem goal** — `engine/streak.js` (free "lantern" freezes
   earned at milestones, lapse just resets to 1, "best N" remembered). Home streak chip + goal bar;
   Progress streak stat. (+8 tests.)
4. **Daily Cavern Quests + variable geode** — `engine/quests.js`: 3 date-seeded quests over
   today's tracked actions; finishing all opens a variable, always-positive geode once/day. Home
   "🎯 N/3 → 🎁 ready" chip; Progress quest panel + open button. (+5 tests.)
5. **Personal bests + tricky-words list + haptics** — best combo / best haul records (Progress);
   the ACTUAL cracked words shown as chips (shared kid+parent transparency, §4); subtle
   `navigator.vibrate()` paired with SFX (no-op on iPad Safari, adds feel on Android/Chromebook).
   `prefers-reduced-motion` was already fully handled.
6. **Cavern-map depth path + growth-mindset praise** — a visual "you are here + next level"
   depth strip on Progress (goal-gradient/endowed progress; answers I5 "visibly progresses"), and
   effort/process phrases ("You worked it out!", "Nice thinking!") mixed into the spoken praise pools.

New pure engine modules are precached by `sw.js` (VERSION **csc-v4**) for offline. New scratch QA
tools committed: `scripts/qa_probe.mjs` (viewports/overflow/touch-drag), `scripts/qa_probe2.mjs`
(long-word overflow). `words_alpha_tmp.txt` (the dictionary cache for the blocklist build) is
git-ignored.

### ▶️ Deferred nice-to-haves (from RESEARCH.md — not blockers; pick up anytime)
- ~~**Crystal Catalog**~~ **✅ DONE (§16).** ~~**First-run onboarding**~~ **✅ DONE (§16).**
  ~~**Light narrative spine + a "Geode Boss"**~~ **✅ DONE (§16).**
- **Audio generation** is still the only parked BUILD item (Gemini free-tier daily cap — §12; device
  voice covers it meanwhile). ⚠️ Still remind the user to **rotate the Gemini API key** pasted in chat.

---

## 16. SESSION UPDATE — 2026-06-18 (all deferred nice-to-haves DONE + a11y/pedagogy) — READ FIRST

This session cleared the ENTIRE §15 deferred list (Catalog, onboarding, narrative + Geode Boss)
and added two research-backed accessibility/pedagogy wins. `npm test` = **134 green** (added
`catalog.test.js` +8, `narrative.test.js` +3); `npm run smoke` green (now also walks the new
onboarding boot flow); `node scripts/qa.mjs` = 0 console/JS errors across portrait + landscape;
every new screen verified by reading screenshots. All committed; tree clean except the long-standing
orphan `scripts/oneshot.mjs` (still intentionally untracked).

### What shipped (each its own commit, with a scratch QA probe)
1. **Crystal Catalog — the gem SPEND SINK (fixes QA I5) + an endowed-progress collection.**
   `src/engine/catalog.js` (PURE, +8 tests): **24 real minerals** (ties to the rocks-&-minerals
   interest), a rarity→cost ladder (common 100 / rare 280 / epic 650 / legendary 1400, tuned to the
   ~100-380 gems/wave economy), ownership/affordability queries, a pure validated `purchaseResult`
   transaction, the milestone free-grant selector, and a **procedural faceted-gem SVG** (`crystalSvg`,
   no art assets). `state.js`: `catalog.owned` + `purchaseCrystal`/`grantMilestoneCrystal`/
   `ownedCrystals`/`lastMilestoneDepth`. `src/screens/catalog.js`: a grid (locked silhouettes show the
   goal; affordable ones glow + pulse), per-rarity progress, a real-world fact on tap. Home "Catalog"
   card (glows when something's affordable); Progress summary + link. NO randomised loot / FOMO / money
   — visible prices, kid chooses (guardrails). Scratch QA: `scripts/qa_catalog.mjs`.
2. **First-run onboarding — Geo the mascot + name + crystal colour + a guaranteed-win first wave.**
   `src/screens/onboarding.js`: welcome → name → colour → "let's dig!", Geo (a procedural gem
   "character" in `ui.mascot`) speaks each prompt. The colour choice is REAL personalization —
   `ui.applyTheme` wires `settings.themeColor` → the live `--accent` (was stored-but-unused); restored
   on boot, changeable in Settings → You. `app.js` routes to onboarding when `!profile.onboarded`. The
   first wave is `rhythm({firstRun:true})`: 5 hand-picked most-common easy words (tier ≤2, 3-6 letters)
   with obviously-wrong distractors, so the first experience is a sure WIN. smoke.mjs + qa.mjs walk
   the new boot flow (and seed `onboarded` for the isolated idle/menu sub-pages).
3. **Geode Boss + light narrative spine.** `src/engine/narrative.js` (PURE, +3 tests): named depth
   ZONES (the Glimmer Shallows → the Heart of the Mountain). `src/screens/boss.js`: breaking through
   to a new cavern depth (every 8 mastered words) routes here from rhythm/puzzle `finish()` — Geo
   announces a Great Geode, the kid TAPS it open (Brotato-style, guaranteed, auto-cracks if idle), it
   bursts to reveal the milestone mineral (granted free into the Catalog) + a bonus + the new zone's
   name. An always-positive celebration, never fail-able. Pending until cracked (gated on
   `state.lastMilestoneDepth`), so leaving early never skips it. Scratch QA: `scripts/qa_boss.mjs`.
4. **"Sound it out" — built, then DISABLED on user feedback.** `audio.saySlow(word, syllables)` was
   wired to a "🐢 Sound it out" button in Play + Craft to dictate a word syllable-by-syllable. On a
   real iPad the device TTS reads short isolated syllables as LETTER NAMES ("spells it out") instead
   of blending them, so it confused rather than helped — the user asked to disable it. The buttons are
   removed; `audio.saySlow` stays dormant (commented in rhythm/puzzle) for a future revisit with real
   phoneme audio (not Web-Speech fragments).
5. **"Easy-read text" (accessibility).** Opt-in Settings switch (`ui.applyReadable` → an `<html>.readable`
   class) adds letter-spacing/line-height to the spelling-critical text so similar spellings are easier
   to tell apart (beach/buach/beacch/bach). Scoped tightly; verified no tile overflow at 4-choice/high
   difficulty (`scripts/qa_readable.mjs`).
6. **Home grid rebalanced** for the new Catalog card: Repair is now a full-width amber CTA banner and
   Feedback a half-card paired with Settings, so the 2-col grid is always balanced.

### Plus polish (post-feature, each committed + QA'd)
- **Catalog detail card**: tapping a crystal opens a preview (big art + rarity + real-world fact) with
  a DELIBERATE "Unlock for 💎N" button — no accidental spends, nicer for admiring owned crystals.
- **Settings → "Test voice"** button + auto-preview on voice change, so a parent can audition the
  device voices and pick the clearest (the best quota-free lever on dictation quality).
- **Rhythm wave-reward now links to 🔨 Craft** (puzzle already linked back to Mine) — the two modes
  now alternate easily both ways (requirement #9).
- **Review-driven correctness fixes**: returning users are auto-onboarded (old saves lacked
  `profile.onboarded`); milestone crystals grant ONE PER LEVEL so a multi-depth jump skips none;
  Geo has a solid-colour fallback if `color-mix()` is unsupported.
- **QA tooling**: `qa.mjs` takes a custom viewport (`W=/H=`) for reduced-height sweeps; new probes
  `qa_catalog.mjs` / `qa_boss.mjs` / `qa_readable.mjs` / `qa_settings_you.mjs` / `qa_progress_full.mjs`
  / `qa_home_repair.mjs`. Verified portrait + landscape + reduced-height, 0 console/JS errors.

New engine modules precached by `sw.js` (VERSION **csc-v5**): `catalog.js`, `narrative.js`,
`screens/catalog.js`, `screens/onboarding.js`, `screens/boss.js`. New scratch QA tools committed:
`qa_catalog.mjs`, `qa_boss.mjs`, `qa_readable.mjs`, `qa_home_repair.mjs`.

### ▶️ What's LEFT
- See **§17 — the prioritized NEXT-SESSION backlog** (the user's 2026-06-18 review): cross-device +
  deployment + installable-app-on-iPad, UI polish consistency (app-store quality), an audio volume
  inconsistency, re-engagement alerts, and economy rebalancing. **Start there next session.**
- **Audio generation** stays partial: **722/2949 word clips + 28 phrases now exist** (Kore voice;
  +480 generated this session, most-common-first). Device voice covers the rest. Run only with the
  user's awareness ([[approval-before-consuming-limits]]). ⚠️ Still **rotate the Gemini API key**.

---

## 17. NEXT-SESSION BACKLOG — the path to "a real app on the iPad" (read FIRST next session)

The game is feature-complete and QA-clean in the dev browser, but the user's 2026-06-18
play-test review surfaced the work needed to make it feel like a **store-quality app the
kid taps into anytime**. Tackle these next (the user explicitly deferred them to a fresh
session). Roughly priority-ordered; each has pointers to where to look.

### A. Make it an installable app on the iPad (the headline goal)
The end state: **an app icon on the iPad home screen** the kid opens any time (offline-capable),
**plus a gentle re-engagement alert** when they haven't played in ~a day.
- **This IS achievable with the PWA** — no app store needed. iOS Safari → Share → **Add to Home
  Screen** places a full-screen icon (we already ship `manifest.webmanifest` display:standalone +
  the `apple-mobile-web-app-*` meta + `icons/`). VERIFY the installed launch looks right (icon,
  splash, no Safari chrome, safe-area). To skip the App Store entirely is fine for one kid; a true
  App Store listing would need a native wrapper (Capacitor/PWABuilder) — only if the user wants store
  distribution later.
- **Deployment (prereq for the icon + offline + alerts):** the app is a static site (no build step),
  so host it over **HTTPS** (GitHub Pages / Netlify / Cloudflare Pages / Vercel — drag-and-drop or a
  repo connect). HTTPS is REQUIRED for the service worker to cache offline (today it only works on
  localhost — README §Offline) and for web push. A stable hosted URL also fixes "works on other
  devices" (any device just opens the URL). `server.js` stays as the local-dev server only.
- **Re-engagement alerts ("it's been > a day"):** iOS supports **Web Push for INSTALLED PWAs since
  iOS 16.4** (must be added to home screen + user grants permission). BUT web push needs a push
  service → a tiny backend/serverless endpoint, which breaks the current "no backend" constraint —
  raise the tradeoff with the user (a minimal serverless push fn, or a managed service like
  OneSignal, vs. keeping it in-app-only). Pure local scheduled notifications are NOT reliably
  available to iOS PWAs in the background. MVP fallback: an in-app "welcome back, it's been N days!"
  moment (we already track `streak.lastPlayedDate` + `stats.byDay`) — no push, just a warm nudge on
  next open. Decide scope with the user.

### B. UI polish — consistency to "would pass app-store review" (HIGH; user's biggest concern)
Symptom (user): "text inside a box misaligned in some instances," inconsistent **vertical alignment
inside buttons**, inconsistent **padding**, general inconsistent polish.
- Do a **systematic pass over every interactive surface**: `.btn` / `.btn.primary` / `.btn.ghost`,
  `.tile`, `.tray-tile`, `.slot`, `.menu-card`, `.seg button`, `.hear-again`, `.rating`, the chips
  (`.streak-chip`, `.rarity-chip`), `.crystal-cell`. Likely root causes to hunt in `styles.css`:
  emoji-vs-text baseline misalignment in labels (emoji sit low → use `line-height`/flex
  `align-items:center` consistently), mixed `padding` units, buttons sized by content vs. a shared
  min-height, text not centered in fixed-height boxes. Establish a few shared button tokens and apply
  them everywhere rather than per-component one-offs.
- QA method is in §14: drive live with Playwright, screenshot EACH state across iPad-10.2 / mini /
  landscape / **reduced-height** (`W=/H=` now supported in `qa.mjs`), and judge each PNG like a
  reviewer. Pay attention to the NEW screens (catalog cells, boss, onboarding, detail overlay).

### C. Audio volume inconsistency (MED; user noticed)
Symptom (user): "volume seems to change with different voices or something." Almost certainly the
**pre-generated MP3 clips aren't loudness-normalized** (and differ from Web-Speech loudness), so
perceived volume jumps between a clip word, a Web-Speech word, and praise.
- Fix at generation: normalize each clip's PCM (peak or RMS) before MP3 encode in
  `scripts/gen_audio.mjs` (`pcmToMp3`) so all clips sit at a consistent level; consider matching the
  Web-Speech baseline. Re-generate (cheap to re-run; it's resumable). Also check `src/audio.js`
  `playClip` vs `speakTTS` apply the same `settings.volume`.
- **Also fix the `gen_audio.mjs` STUCK-LOOP bug found this session:** when the daily cap is reported
  as a plain HTTP 429 *without* the "per day" wording, the script treats it as a per-minute limit and
  **waits 30s forever** (it looped ~115×/~1hr before I killed it). Add a fail-fast: stop after N (e.g.
  3-5) consecutive rate-limit waits with no successful batch (HANDOFF §12 already recommended this).

### D. Economy rebalancing (MED; user noticed)
Symptom (user): "daily targets too easily [hit], too easy to buy all the gems."
- **Daily goal** `dailyGoalGems` default = **80** in `src/state.js` — one short wave clears it.
  Raise it / scale to session length, or make it a streak-aware moving target.
- **Per-answer gems** are generous (a perfect-speed wave mines ~380): `engine/praise.js`
  `BASE_POINTS` + speed/combo mults. **Catalog costs** (`engine/catalog.js` `RARITIES`: 100/280/650/
  1400) + the **boss bonus** (`40 + depth*10`) + **quest/geode** payouts (`engine/quests.js`).
  Rebalance so the full 24-mineral catalog is a multi-WEEK goal, not a day — either lower gem income
  or raise sinks. Keep it non-punitive (guardrails: no FOMO/loss), just slower-earned.
- Confirm difficulty UNLOCK thresholds + the cavern-depth pace still feel earned after rebalancing.

### E. Cross-device / robustness (MED)
- Test on **non-iPad devices** (Android tablet/Chromebook, desktop Chrome/Firefox, a phone) — layout,
  touch-drag, audio, install. The CSS uses `color-mix()` / `clamp()` / `backdrop-filter` (modern, but
  verify; Geo already has a `color-mix` fallback). Check safe-area insets on notched devices.
- Re-run `npm test` (134) + `npm run smoke` after any change; both must stay green (test-gate hook).

### Notes for whoever picks this up
- Engine is pure + tested (`src/engine/`, **149 tests**); UI is verified via Playwright (`npm run smoke`)
  + the scratch `qa*.mjs` probes. Logic↔UI split (§4) — keep new logic pure + test-first.
- `sw.js` VERSION is **csc-v6** — bump it whenever a precached file changes.
- The user wants this to FEEL finished and trustworthy (app-store bar), so favor consistency +
  correctness over new features now. Do NOT add new game surfaces unless asked.

---

## 18. SESSION UPDATE — 2026-06-18 (the §17 backlog — DONE) — READ FIRST

Worked the §17 backlog end-to-end in a QA↔feature loop, plus the user's new pedagogy
request. `npm test` = **149 green**; `npm run smoke` green; `qa.mjs` (portrait + landscape +
reduced-height) and the touch-drag probe = 0 console/JS errors. All committed; tree clean.

### Shipped (each its own commit, verified)
1. **Mastered-word SPACING (the user's headline request) — `progress.js` + `session.js`, +8 tests.**
   Once a word is essentially known, it is NOT re-served immediately (even after one correct
   answer): it rests for several sessions and the builder covers other words first, then revisits
   known words only over a LONG horizon (scales with mastery × confirmation count). Unknown/shaky
   words stay in frequent rotation. Pure SELECTOR (`serveCooldown`/`isEligible`/`serveOverdue`/
   `ticksSinceSeen`) over the continuous tracker — NOT a due-date scheduler (honors §4). `selectWords`
   skips resting words (review + new) with an overdue-first fallback so a session never starves.
2. **Economy rebalance (§17.D) — `praise.js`/`catalog.js`/`state.js`, +1 cross-module guardrail test.**
   `BASE_POINTS` 10→6 (flawless wave ~280, was ~465); catalog costs up (160/480/1200/2600 → full
   24-mineral set ~19k gems = a multi-WEEK goal); `dailyGoalGems` 80→250. Guardrail: whole catalog
   must cost > 30 flawless waves. Non-punitive; first common still ~1 wave; milestones still gift free.
3. **Audio volume (§17.C) — new pure `scripts/audio_dsp.mjs` (`normalizePcm`) + `gen_audio.mjs`, +5 tests.**
   Generated clips are now loudness-normalized (consistent RMS, peak-capped so they never clip) before
   MP3 encode, so volume no longer jumps between words/voices. Also fixed the gen STUCK-LOOP: a plain
   429 (no "per day" text) used to wait 30s forever; now fail-fast after 4 fruitless waits (rotate
   model / stop). NOTE: applies to FUTURE generation only — the 722 existing clips would need
   regeneration (quota-gated → the user's call; do NOT run unattended — [[approval-before-consuming-limits]]).
   Runtime `audio.js` already applies `settings.volume` identically to clip + Web-Speech paths.
4. **UI polish (§17.B, the user's biggest concern) — `styles.css`.** Shared flex-centering tokens on
   every fixed-height interactive box (`.btn`/`.btn.ghost`, `.btn-icon.back`, `.tile`, `.tray-tile`,
   `.seg button`) so labels/emoji/wrapped text are centered the SAME way instead of relying on the
   browser default (fragile across fonts/platforms — the iPad uses Apple emoji + a fallback font).
   Verified by reading screenshots of home/rhythm/puzzle/lab/settings/feedback/progress/catalog/boss/
   onboarding across portrait + landscape + reduced-height; touch-drag re-verified.
5. **Installable + deploy + re-engagement (§17.A) — `streak.js`/`home.js`/`netlify.toml`/`README`, +1 test.**
   In-app **welcome-back** nudge (no backend): home greets a returning learner by name with how long
   it's been (`streak.daysSinceLastPlayed`), streak-aware, never guilt-trippy. Verified manifest/icons/
   meta are correct for Add-to-Home-Screen. Added `netlify.toml` (static, root, no-cache SW/shell) + a
   README "Deploy as a real app on the iPad" section (root HTTPS hosting, the subpath caveat, install
   steps). `sw.js` bumped to **csc-v6**.

### ⤷ Still genuinely the USER's call (documented + surfaced, NOT done unilaterally)
- **Pick an HTTPS host + deploy** (Netlify/Cloudflare/Vercel/GitHub user-page) — needs their account;
  `netlify.toml` + README make it a 2-minute step. Then Add-to-Home-Screen on the iPad.
- **True web-push re-engagement** (app closed): iOS 16.4+ installed-PWA only, and needs a push
  service → a small backend or OneSignal (breaks the no-backend design). Left as a product decision;
  the in-app welcome-back covers the common case now.
- **Regenerate the 722 existing audio clips** at normalized loudness (Gemini quota-gated — only with
  the user's awareness). New clips are already normalized. ⚠️ Still **rotate the Gemini API key**.
- New scratch QA tools committed: `qa_welcome.mjs`; `qa_probe.mjs` now seeds an onboarded save.

### 18b. Cloud sync / backup (COPPA-compliant) — added same session at the user's request
The user asked "where's the data?" → it's all on-device `localStorage`, no backend (deliberate,
§4). They then asked for **cloud sync/backup that stays COPPA-compliant**. The compliant design:
**keep data parent-controlled; do NOT become an operator that stores a child's data on a server we
run** (that triggers verifiable-parental-consent + policy + retention). Built in two phases (161 tests):
- **Phase 1 (committed): parent-controlled backup + data minimization.** `engine/backup.js` (+6
  tests: versioned envelope adds only marker/version/timestamp, validated restore, reminder logic);
  `state.js` enveloped export / validated import / `lastBackupAt`/`markBackedUp`/`hasProgress`;
  Settings **"Parents & privacy"** panel (Back up → a file the parent keeps in their OWN iCloud/Drive,
  Restore, Delete all data, "backed up N days ago" + due highlight); name reframed as a NICKNAME (no
  real PII); **`PRIVACY.md`**.
- **Phase 2 (committed): optional Google-Drive auto-sync, still parent-owned.** `engine/cloudsync.js`
  (+6 tests: `progressScore`+`reconcile`, never-lose-progress push/pull); `src/cloud_drive.js` (Google
  Identity Services token flow — client ID only, no secret/backend — + Drive `appDataFolder` read/
  write + `syncNow`; GIS lazy-loaded only on connect; token in memory only); Settings "Auto-sync to
  your Google Drive" subsection (paste Client ID → Connect/Sync now/Disconnect, dormant until set up);
  `app.js` best-effort SILENT pull on open when connected; **`CLOUD_SYNC_SETUP.md`**. `settings.cloudClientId`
  + `cloudConnected`. `sw.js` → **csc-v8**.
- ⚠️ **NOT yet verified live:** the Google OAuth/Drive round-trip needs the parent's Client ID + a
  deployed HTTPS origin (can't be exercised headlessly). The PURE reconcile core IS unit-tested. To
  verify: deploy, follow `CLOUD_SYNC_SETUP.md`, Connect, then check a second device pulls the progress.
  Conflict rule = more learning-history wins (ties → newer); concurrent heavy OFFLINE play on two
  devices is the only lossy case (rare for one kid; manual file backup is the safety net).

---

## 19. SESSION UPDATE — 2026-06-18 (DEPLOYED + pivot to a REAL BACKEND) — READ FIRST

### Live deployment
- **The app is LIVE at https://spell-caverns.netlify.app/** (Netlify, static drag-and-drop of the
  `deploy/` bundle built by `scripts/build_deploy.mjs`). HTTPS ✓ → service worker + offline + installable.

### Decision: per-device Google-Drive OAuth is REJECTED → build a real backend (user, 2026-06-18)
- The §18b "OAuth to your own Drive" sync requires, ON EACH DEVICE, pasting a Google OAuth Client ID +
  clearing the "unverified app" consent popup. The user (correctly) called this unacceptable for a
  parent setting up multiple kids' devices. **It is being replaced by a real backend.** The Drive path
  (`src/cloud_drive.js`, the Settings "Auto-sync to your Google Drive" block) is DEPRECATED — remove or
  hide it as the backend lands. The PURE pieces stay reusable: `engine/cloudsync.js` (reconcile),
  `engine/backup.js` (envelope), and the manual file backup/restore (keep — offline safety net).
- **Chosen architecture (lowest friction, no new vendor — already on Netlify): Netlify Functions +
  Netlify Blobs, keyed by an opaque FAMILY SYNC CODE.** Parent creates a code once; each device enters
  that code once (a short string — NOT OAuth); the app then auto-syncs (pull on open, push on
  save/leave) through a serverless function. Server- and client-side conflict resolution reuses the
  tested `cloudsync.reconcile` (never-lose-progress). Data stored = pseudonymous gameplay only
  (nickname + stats; no real name, no email).
- **COPPA/regulatory consequence — we BECOME an operator now** (we hold a child's data on a service we
  run). Required + being built: a published privacy policy (extend PRIVACY.md), a one-time **parental
  consent** acknowledgement at sync setup, **data minimization** (already: nickname only), a **delete-
  from-cloud** action + retention stance, and reasonable security (HTTPS, opaque code, no PII). See
  PRIVACY.md "operated backend" section.
- **Deploy consequence:** Netlify Functions need a build/bundle step → the drag-and-drop static deploy
  is being replaced by **Git-connected Netlify** (push repo to GitHub → connect on Netlify → it builds
  functions + bundles `@netlify/blobs`). `netlify.toml` gains a `[functions]` dir + a `/api/sync`
  redirect. (Static `deploy/` bundle stays usable for the no-backend fallback.)
- STATUS: **BUILT + committed (162 tests green, sw csc-v9).** `netlify/functions/sync.mjs` (v2,
  `/api/sync`, GET/PUT/DELETE, Blobs, server-merge via `reconcile`); `src/cloud_sync_backend.js`
  (generate/pull/push/remove/syncNow); Settings "Family sync" (consent gate + create/enter code + sync
  now + stop + delete cloud); `app.js` pull-on-open + push-on-hidden; `engine/cloudsync.js`
  code helpers (+tests). Drive path removed (`src/cloud_drive.js` deleted). `netlify.toml` build+functions,
  `package.json` adds `@netlify/blobs`. Docs: `CLOUD_SYNC_SETUP.md` rewritten, `PRIVACY.md` operator
  section now ACTIVE, README updated.
- **Kid-friendly PICTURE password + sync moved into ONBOARDING (2026-06-18, user feedback).** A
  buried-in-Settings alphanumeric code was rejected. Now: `engine/picturecode.js` (+5 tests) maps a
  4-picture tap-sequence ↔ the sync code; first-run onboarding has a "Just this one / Sync our tablets"
  step → consent → make/enter a picture password; `ui.picturePicker` shared by onboarding + Settings;
  Settings shows the code AS PICTURES + sync/stop/delete. `sw.js` → **csc-v10**. Repo pushed to
  github.com/ian-gornall/spell-caverns. **167 tests green; smoke green.**
- ⛔ **BLOCKER — Netlify is NOT deploying from the repo.** After 3 pushes, the live site is STILL the
  old manual drag-and-drop deploy (`/sw.js` = csc-v8, `/api/sync` = 404, old `cloud_drive.js` still 200).
  So the function never shipped. Fixed one build-killer (the `@netlify/blobs` version was a nonexistent
  `^8.1.0` → now `^10.7.9`). The remaining cause is in the Netlify DASHBOARD (can't see it from here):
  the site is likely still in **manual-deploy** mode — linking a repo to a drag-drop site does NOT
  auto-enable continuous deployment. **Fix:** Netlify → site → **Site configuration → Build & deploy →
  Continuous deployment** → ensure the repo is linked, production branch = `main`, build command
  `node scripts/build_deploy.mjs`, publish `deploy`, functions `netlify/functions`; then **Deploys →
  Trigger deploy**. Check the build log for errors. Reliable alternative: `netlify-cli` →
  `netlify login` → `netlify link` → `netlify deploy --build --prod`. Verify with
  `/api/sync?code=TESTCODE` → `null` (not 404). Pure reconcile + picture-code are unit-tested; Netlify
  Blobs can't be exercised headlessly here.

---

## 20. SESSION UPDATE — 2026-06-18 (deployed + algorithm rework + MULTI-PROFILE) — READ FIRST

Deploy is WORKING (Netlify CD from github.com/ian-gornall/spell-caverns; the build-killer
was a bad `@netlify/blobs` version, now `^10.7.9`). Live at https://spell-caverns.netlify.app/.
This session shipped a run of user-requested changes (all committed + pushed; **172 tests
green**, smoke green; sw **csc-v12**):

- **Mastery = accuracy, not speed.** `answerScore` → 1 for any correct answer, 0 for wrong.
  Speed still drives gems/praise (praise.js), not what's "learned".
- **Target-words algorithm.** progress.js tracks recent attempts/word; `isTarget` (missed in
  last 3) + `targetWords`; `TARGET_CAP=10`. session.js `buildSession` is TARGET-FIRST: leads
  with the ~10 words the learner is actually missing, introduces NEW words progressively from
  the start tier until ~10 targets exist, PARKS correct-first-time words (spaced confirmation
  later), revisits known words only after targets are handled. New `startTier` option.
- **Grown-up family password** (not the picture password — reverted): a normal password set
  once per device, saved locally; entering the same one elsewhere auto-joins (server merges).
- **Clickable daily quests** → launch the matching activity (specimen→Lab, else→Play).
- **MULTI-PROFILE (the big one).** schema-2 CONTAINER (engine/profiles.js, tested): family
  (syncCode/consent/parentPassword) + per-profile (name/colour/**startLevel**/kidLock/snapshots
  + game state + tracker). "Who's playing?" picker every launch when >1 explorer; per-profile
  LEVEL-SELECT in onboarding (shows example words; sets the engine's start tier); Settings
  Players panel (switch/add/reset). Sync is family-level (container-aware reconcile). Legacy
  saves migrate to one profile. Auto dated snapshots per profile for parent rollback.
- **Configurable voice speed.** `settings.voiceRate` (per profile, default **0.85** — a little
  slower for a weak speller) drives both Web-Speech rate and clip `playbackRate` for dictation
  (praise unchanged). Settings → Sound → "Voice speed": Slow / Normal / Fast (each previews).

### ▶️ DEFERRED (chosen design, data + helpers EXIST, UI not built yet)
- **Kid-lock UI**: profiles can carry a `kidLock` code (the "who's playing" screen already
  challenges it) but there's no screen to SET one yet. (User wanted the picture password to
  return HERE as the optional per-kid lock.)
- **Parent-password zone**: `parentPassword` + `setParentPassword` exist; no UI to set it or
  to GATE sync changes / rollback behind it yet.
- **Snapshot rollback UI**: snapshots auto-captured (state.js) + `listSnapshots`/`rollback`
  exist; no parent screen to pick a restore point yet. (User chose "periodic snapshots +
  rollback" for revert.)
- Per-profile sync currently reconciles the whole family container by SUMMED progress
  (coarse). The tested `profiles.mergeFamily` (true per-profile merge) is ready to wire into
  the serverless function for divergent-multi-device correctness.

---

## 21. NEXT-SESSION BACKLOG — level select + the mastery-source fix (user 2026-06-18)

✅ **ALL FOUR DONE in §22** (A, B, C, D). The verbatim intent is kept below for reference;
see §22 for exactly how each was implemented + tested.

### A. Mastery = CRAFTING (production), NOT MINING (recognition) — the big learning-model fix
The user's rule: **a word is only "known"/mastered when spelled correctly in CRAFTING** (the
puzzle build-from-letters mode). MINING (rhythm multiple-choice) is helpful practice but is
NOT mastery — recognition ≠ production. Concretely:
- **Do NOT evaluate ACCURACY from mining — use mining only for SPEED** (gems / praise /
  engagement). A correct rhythm tap must NOT mark a word "known."
- **CRAFTING correctness is the source of truth for mastery**: a clean crafted build = known;
  a missed/assisted craft = a target.
- **Target-word selection order:** start with words on the learner's CHOSEN LEVEL (start tier),
  THEN the words MISSED in crafting. (Refines §20's target-first algorithm.)
- This REFINES §20's "mastery = accuracy, not speed": mining now contributes speed-only and
  never establishes mastery; crafting accuracy does.
- Pointers: `progress.recordAnswer` needs a SOURCE flag (mine vs craft); `modes/rhythm.js`
  (mining) records speed/engagement but NOT mastery-accuracy; `modes/puzzle.js` (crafting)
  records mastery (correct→known, miss→target). `engine/session.js buildSession` +
  `progress.targetWords` prioritize chosen-level words then craft-missed words. Update tests.

### B. Change the starting LEVEL in Settings
Level-select currently only exists in onboarding. Add a per-profile level control to Settings
(reuse `onboarding.LEVELS` + the level-card UI), writing `state.startLevel`. So a parent can
re-aim where the engine introduces new words at any time.

### C. BUG — the initial level choice doesn't take effect until a data reset
Symptom (user): the level picked during onboarding does NOT change what's served — but AFTER
"reset the data" (and re-picking) it works. So the first-run path isn't applying `startLevel`.
Likely cause(s) to investigate: the guaranteed-win FIRST wave (`rhythm({firstRun:true})`)
hand-picks tier ≤2 words and IGNORES `startLevel` by design — so a high level looks ignored at
first; and/or the freshly-created profile's `startLevel` isn't read by `buildSession` until the
profile is re-activated. Fix so the chosen level applies immediately after onboarding (e.g. make
the first wave respect `startLevel` when it's above the easy band, or re-activate the profile so
`state.startLevel` is live before the first non-first-run session). Repro + add a guard.

### D. More levels to choose from
With ~3,000 words across 9 tiers, the 5 current presets (tiers 1/3/5/7/9 in `onboarding.LEVELS`)
are too coarse. Expand to finer granularity — e.g. one level per tier (9), or sub-tier bands —
each still showing example words so a grown-up can gauge it. Shared by onboarding + the new
Settings level control (B).

---

## 22. SESSION UPDATE — 2026-06-18 (§21 backlog A/B/C/D shipped) — READ FIRST

All four §21 items done, **test-first** where pure, **committed locally** (2 commits), smoke +
qa green, **180 tests**. **NOT pushed yet** — `git push` to deploy (sw **csc-v15**).

- **A — Mastery = CRAFTING, not mining.** `progress.recordAnswer(tracker, word, correct, opts)`
  gained an `opts.source` flag. `source:'mine'` records ONLY a speed reading (`recentMs`) on an
  *already-tracked* word and touches nothing else — so a word the kid has only MINED stays
  untracked/unknown and can never become "known" or a target from recognition. `'craft'` /
  `'assess'` / **default** keep the mastery-bearing path (assessment + every existing test
  unchanged). `modes/rhythm.js` (mining) now calls with `source:'mine'`; `modes/puzzle.js`
  (crafting) with `source:'craft'` — crafting is the sole source of truth (clean build = known,
  missed/assisted = target). Mining still drives gems/praise/combo + lifetime stats as before.
- **A — chosen-level-led `buildSession`.** Rewritten: LEADS with fresh words at/above the start
  tier (so the picked level drives content) while RESERVING up to half the session (capped by
  how many targets exist) for craft-missed targets so repair is never crowded out; patterns are
  seeded from the chosen level + the missed words. *Interpretation note:* §21-A said "chosen
  level THEN missed"; implemented as level-led + a guaranteed target reserve so repair survives.
  (With mining no longer creating targets, early sessions are naturally level-dominated anyway.)
- **C — first-wave-ignores-level bug FIXED.** New pure `session.buildFirstWave(words,{startTier,
  length,rng})` picks the easiest spellable words in the easiest TWO tiers at/above the chosen
  level. `rhythm` firstRun uses it (distractors still forced obvious → still a guaranteed win).
  Verified end-to-end: at "Expert" (tier 9) the first wave serves tier-9 words (festival, premium,
  …), not tier-1 baby words. Root cause was the old hard-coded `tier ≤2` first wave.
- **D — 9 levels.** `onboarding.LEVELS` went 5→9 (one per tier, ages 5–13) with example words;
  `.level-grid` is now a 2-column CSS grid so 9 cards stay compact. Extracted a shared
  `onboarding.levelGrid(selected, onSelect)` helper.
- **B — Settings "Starting level".** A per-profile control in the Adventure panel (reuses the
  level cards) writes `state.startLevel`; the next session reflects it immediately. Lets a parent
  re-aim where new words start at any time.
- **Tests:** +8 (`progress.test.js`: mine-vs-craft source semantics; `session.test.js`:
  chosen-level-led ordering, target reserve, `buildFirstWave` level + starvation). New probe
  `scripts/qa_levels.mjs` (9-level select + first-wave level + Settings control) kept as a
  regression check; screenshots in `scripts/qa/levels-*.png`.

### Phone/PWA responsive fix (after §22, deployed csc-v16)
User reported the installed PWA "doesn't look right on my phone." A multi-resolution QA pass
(new `scripts/qa_responsive.mjs`, 7 viewports 360–820px) found the in-game header clipped the
**"Depth N"** chip off the right edge on every phone (≤430px), and the Settings level grid used
`94vw` so it overflowed the panel padding. Fixed in `styles.css` + `ui.js`: `.header-title`
shrinks (min-width:0 + ellipsis); a `@media (max-width:480px)` shrinks the gem/depth pills and
hides the word "Depth" (⛏️ + number remains); `.level-grid` is `width:100%`/`max-width:520px`.
iPad (design target) unchanged. 0 overflow at every tested size. (Caveat: headless Chromium can't
reproduce iOS safe-area insets — `#app` already pads with `env(safe-area-inset-*)` + viewport-fit
cover, so the notch is handled; if the kid still sees a notch issue on the real device, that's the
next thing to check on-device.)

### PWA update flow + visible version (after the responsive fix, deployed csc-v17)
User: on Android the installed PWA "isn't updating" + no visible version. In standalone mode
there's no reload button, so a new (network-first, skipWaiting) SW would activate but the open
page never reloaded. Fix: `src/pwa.js` (new) registers with `updateViaCache:'none'`, calls
`registration.update()` on launch + every foreground, and reloads ONCE on `controllerchange`
(guarded so a first uncontrolled load doesn't self-reload). `sw.js` gained a `GET_VERSION`
message handler; `src/version.js` (new) holds `APP_VERSION`; Settings → Parents & privacy shows
"Version csc-vNN · up to date ✓" (turns amber "cached <old> — reopen to finish updating" on a
mismatch). Netlify already serves `sw.js`/`index.html` `no-cache` and modules `must-revalidate`.
**KEEP `src/version.js` APP_VERSION == `sw.js` VERSION on every deploy.** A device stuck on a
pre-fix SW may need ONE extra full close+reopen to cross over to the auto-updating build.

### Phone exploratory-QA pass (deployed csc-v18) + a QA STANDARD
User: UI "still jank on a phone," and asked for real interactive QA (act→screenshot→LOOK→
decide), documented as a standard before major ships. Built a live-session harness
(`scripts/qa_session.mjs` = persistent CDP browser; `scripts/qa_do.mjs` = drive it one step at
a time, screenshots to `scripts/qa/live/`) and walked the app as a user. **Found + fixed:**
(1) home hero was tuned at iPad size and ate ~40% of a phone screen, pushing 4 of 7 menu cards
below the fold — compacted the hero/title/cards so the whole menu fits (scroll need 397px→47px);
(2) onboarding "Let's dig!" CTA sat below the 9 level cards on a phone — made it **sticky** to
the bottom; (3) compacted level cards. **CSS gotcha that bit us:** phone overrides must live in
ONE `@media (max-width:480px)` block at the END of `styles.css` (a media query adds no
specificity, so a phone override placed before its base rule silently loses). The full QA
process is now written up in **`QA.md` — read + follow it before shipping major UI changes.**
Limitation: headless Chromium can't reproduce iOS/Android standalone (notch/safe-area) — for
device-specific reports, get a screenshot from the real phone.

### Still DEFERRED (unchanged from §20 — the next job)
Kid-lock setter UI, parent-password zone, snapshot-rollback UI (all have data + tested helpers;
only the screens are unbuilt). Then: wire `profiles.mergeFamily` into the sync function, web-push,
regenerate 722 audio clips, rotate the Gemini key.

---

## 23. BACKLOG — APP-STORE QUALITY + craft-as-assessment (user 2026-06-19) — ✅ SHIPPED in §24

> **✅ DONE — all of A/B/C/D below shipped & deployed (csc-v21). See §24 for what was built.**
> Kept here as the verbatim intent that drove §24.

Recorded verbatim-intent; ~~NOT yet implemented~~ **DONE (§24)**. **Deployment is now settled** (Cloudflare Worker,
LIVE at https://spell.pryzmio.com, family sync working — see §0). The user's focus has shifted to
**quality and pedagogy**. This is the current top priority (ahead of the §20/§22 deferred
multi-user UI). Treat it as a SUSTAINED iteration campaign, not a one-shot.

### A. Make it feel like an APP, not a janky website (the #1 ask)
User, verbatim intent: *"it just looks like a janky website on a phone, not an app… it's very
broken still on the phone… a lot of the QA issues, visual problems, lack of polish, are either
creeping back in or were never fixed. We need to run iteration loops until this thing is app store
ready, like Apple App Store quality. This still looks like an amateur web application, not an
engaging spelling game for kids."*
- **Bar = Apple App Store quality** for a kids' game. Premium, polished, engaging — not a web form.
- **Phone is the broken surface.** iPad is *assumed* OK ("I hope so") — VERIFY it, but spend the
  effort on PHONE (portrait, the installed-PWA standalone view). 
- **Regressions are real**: polish that was fixed is creeping back. Each iteration must RE-VERIFY
  earlier fixes, not just add new ones. (The CSS-specificity gotcha in §22 is one reason fixes
  silently reverted — phone overrides must stay in the single end-of-file `@media` block.)
- **Process (mandatory): run real iteration LOOPS per `QA.md`** — drive the app on a phone
  viewport, screenshot, LOOK, fix, RE-VERIFY, repeat; walk the device matrix (360×740, 390×844,
  landscape) + the iPad target; check dynamic states (verdict flashes, transitions, rewards), not
  just idle screens. Don't declare done off green numbers — green overflow checks passed while the
  app still felt amateur (that's exactly what triggered this).
- Likely focus areas (investigate, don't assume): typography/scale hierarchy on phones, spacing &
  rhythm, the play surfaces (Mining/Crafting) feeling cramped or web-form-ish, motion/animation
  polish, tap feedback, color/contrast/theming consistency, iOS standalone safe-area (notch/home
  bar — only testable on a REAL device; ask the user for on-device screenshots when needed),
  empty/edge states, and overall "is this delightful for a kid" gut-check from the screenshots.

### B. MINING = practice, CRAFTING = the assessment (pedagogy rebalance — user)
User, verbatim intent: *"the mining is more like practice whereas the crafting is more of the
assessment. Pushing the kids to craft and prove their spelling is right is the key, so that should
be the most rewarded, most nudged towards, etc. But keeping some variety is good for engagement."*
- This BUILDS ON §21-A (already shipped: mining no longer establishes mastery; crafting is the
  source of truth via `recordAnswer source:'craft'` vs `'mine'`). Now extend it to the REWARD +
  NUDGE + flow layer:
  - **Crafting should be the most REWARDED** (gems/praise/celebration) and the most NUDGED-toward
    (home prominence, end-of-wave CTAs, idle auto-routing, copy). Today Mining ("Play") is the
    full-width hero card and the idle auto-launch target — reconsider so CRAFT is the headline act.
  - **Keep mining as engaging PRACTICE / variety** — don't remove it; it's the fast fun loop. The
    balance should STEER toward craft while keeping variety so it doesn't feel like a test.
  - Touch points to revisit: `screens/home.js` (card hierarchy/prominence + idle auto-route),
    `modes/rhythm.js` & `modes/puzzle.js` (reward sizing, cross-mode CTAs), praise/gem economy,
    and the quests/geode goals (below) to reward balanced, craft-leaning play.

### C. Daily GEODE reward — tap-to-open + animation + resetting harder goals (user)
User, verbatim intent: *"that daily award with the geode, if we can get that to include the
tapping to open and some nice animation, would be lovely, and then it resets with some harder
goals, so we are always encouraging that balanced play."*
- Today: daily quests (`engine/quests.js`, date-seeded) + a "geode ready" state when all done
  (`home.js` geodeReady, `store.geodeOpened`/`markGeodeOpened`); the Geode BOSS milestone screen
  (`screens/boss.js`) already has a tap-to-crack interaction we can draw from.
- Build the DAILY geode as a delightful moment: **tap-to-open + a satisfying animation** (juice:
  particles/burst/shine — see `ui.burst`), reveal the reward, **then reset with HARDER goals** for
  the next cycle — a ratcheting daily loop that keeps encouraging BALANCED (craft-leaning) play.
- Tie the goals to §B: weight them toward crafting (e.g. "craft N words" worth more) so the daily
  loop reinforces the assessment behavior while staying varied.

### D. Word discovery & testing — keep piloting (user)
User, verbatim intent: *"the other issue, of really discovering and testing the words that need to
be tested. I think we can continue iterating on that as well, kind of piloting different ideas."*
- Ongoing/experimental (builds on §21-A craft-is-mastery + the §20 target-words algorithm in
  `engine/session.js`/`progress.js`). Pilot different strategies for surfacing exactly the words a
  kid needs to prove (via crafting), measuring/iterating rather than a one-and-done change. Keep it
  test-first where the logic is pure.

### Process reminder for whoever picks this up
Iterate in small, verified loops; commit per milestone; bump `sw.js` VERSION **and**
`src/version.js` APP_VERSION together; push → Cloudflare CD deploys to spell.pryzmio.com; then
confirm live (version + the screen you changed). Follow `QA.md`. When something can only be judged
on a real iPhone/iPad (standalone safe-area, true feel), ASK the user for an on-device screenshot.

---

## 24. SESSION UPDATE — 2026-06-19 (the §23 backlog + multi-user UI — ALL SHIPPED) — READ FIRST

Autonomous build/QA session. Shipped the **entire §23 App-Store-quality backlog** AND the
long-deferred **multi-user UI**, all committed, deployed (**csc-v21**), and verified live on
prod. `npm test` **205 green**; `npm run smoke` green; `qa.mjs` 0 console errors; `qa_responsive`
0 overflow at every viewport. The only open items are **user-gated/external** (see §0 NEXT ACTION):
rotate the Gemini key (Ian's account action — repo is verified key-free), regenerate audio clips
(paid quota — needs Ian's OK), web push (needs VAPID/infra + opt-in).

**§23-B — CRAFT is the headline act (pedagogy).** Home now leads with a full-width **Craft hero**
(premium gradient + "Best gems" badge); mining is reframed as a calmer secondary **"Practice"**
banner. Crafting is the **best-paid** path: `praise.js` gained `CRAFT_MULT` (1.5×) applied via a
`craft` flag through `projectedScore`/`gradeAnswer` (puzzle passes `craft:true`). Crafting is the
**most-nudged**: the home idle auto-route now launches Craft, and the mining wave-reward's primary
CTA + idle auto-route both steer to "Craft these words — prove it!". (`home.js`, `rhythm.js`,
`puzzle.js`, `praise.js` + `test/praise.test.js`.)

**§23-C — daily GEODE.** New `src/screens/geode.js` (route `geode`, reuses the boss tap-to-crack
visuals): when the day's quests are all done the home/progress "Geode ready!" chip routes here →
tap-to-crack → burst → variable always-positive reward (`openGeode(rng,{round})`, bigger each
crack) → then the goals **RESET HARDER** for the next cycle. `quests.js`: `dailyQuests(date,{round})`
ratchets targets by `ROUND_GROWTH^round` and **always leads with a CRAFT quest**; `state.js`:
`geodeRound()` counts today's cracks, `dayStats().crafted` feeds the craft quest, `recordAnswerStat
(correct, source)`. round 0 = byte-for-byte the old behavior (backward compatible).

**§23-D — word discovery.** `progress.js`: `MIN_CRAFT_PROOF=2`, `needsCraftConfirmation`,
`isCraftConfirmed`; a word produced **once** by craft gets a short cooldown (not the long one) and a
reserved confirmation slot in `session.js buildSession` so it comes back soon for a second proof.

**§23-A — App-Store polish (a sustained loop, per `QA.md`).** Driven by a critical visual review on
phone viewports, fix → re-verify: (1) the Craft letter slots now read as **glowing crystal sockets**
(was a flat web form); (2) the level-select is a **depth ladder** (per-tier cool→warm accent stripe);
(3) home **utility cards gained depth** (gradient + inner highlight); (4) **fixed a real flexbox bug**
— `margin-top:auto` in the `overflow:auto` `.play-body` clipped the top of "Hear it again"
unreachably on short phones → now `justify-content: safe center`; (5) **fixed a small-home fold
regression** the taller hero introduced; (6) Progress "Your haul" → **treasure tiles**; (7)
colour-swatch selection **glow halo**; (8) wave-reward header no longer truncates. Smoke + idle-route
assertions updated for the new craft-nudge flow. A **second critical review** confirmed convergence
to App-Store quality and surfaced two final fixes (csc-v21): the onboarding "Let's dig!" sticky CTA
got a **full-bleed gradient footer** (level cards fade behind it, not peek around the pill), and the
craft verdict flash got more **breathing room** above the answer tiles on short phones.

**Multi-user UI (was deferred — now built).** Engine helpers already existed + were tested; this was
UI only. New `ui.picturePad({onComplete,length,icons})` — a kid-friendly **picture password** (tap a
3-icon sequence). **Kid lock**: set in Settings → "You" (set/confirm/change/remove), **enforced** on
the "Who's playing?" screen — a locked sibling's card demands the picture lock (wrong → shake +
retry, right → enter). **Grown-up password**: an optional soft gate over the Parents panel's sensitive
actions (Restore/Delete/Family-sync/Time-machine); Backup stays ungated; unlock persists across the
settings re-render. **Time machine**: lists per-profile dated snapshots newest-first with friendly
relative times + a Restore (`rollback`) button; empty-state hint otherwise. Verified end-to-end with
Playwright (set+enforce lock, gate lock/unlock, rollback) — 0 console errors. (`ui.js`, `settings.js`,
`profiles.js`, `styles.css`.)

**Gotcha logged for next time:** a subagent's editor silently replaced ASCII quotes with **smart
quotes** (`'` `'`) as *code* delimiters in `profiles.js` — invalid JS that `npm test` did NOT catch
(UI modules aren't unit-tested). Caught it by reading the diff + a Playwright load (0-console-errors
check). **Lesson: always runtime-load a UI change (Playwright), never trust `npm test` alone for
screen/mode files.** `node --check <file>` is a fast syntax gate for UI JS.

This session is complete: every §23 goal met, deferred multi-user UI built, everything committed +
deployed + QA'd. Nothing is left for an agent to build — only the three user-gated/external items.
