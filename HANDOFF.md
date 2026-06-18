# Crystal Spell Caverns — Project Handoff

> Read this top-to-bottom before continuing. It is written so a fresh session (with
> no prior context) can pick up and build the game without re-deriving any decisions.
> Project root: `C:\Users\iango\spell`  •  Last updated 2026-06-18. The game is
> **FEATURE-COMPLETE** (all play surfaces + catalog + onboarding + boss + feedback +
> progress + settings + PWA). `npm test` green (**134 tests**); smoke + multi-viewport
> visual QA found **no console/JS errors**.
> **➡️ START AT §17 — the NEXT-SESSION BACKLOG** (the user's 2026-06-18 review: installable-
> app-on-iPad + deployment, app-store-quality UI polish, an audio volume bug, re-engagement
> alerts, and economy rebalancing). §16 = what the last session shipped (all deferred
> nice-to-haves: Catalog, onboarding+mascot, Geode Boss+narrative, a11y). §15/§14 = the
> earlier QA + research rounds. §12 = audio status (722/2949 word clips generated so far).

---

## 0. CURRENT STATE & NEXT ACTION (read first)

**Done so far (all committed, tree clean):**
- **Word data:** `data/words.js` = **2,919 words**, frequency-ordered, ages 5–13, 63 internal
  spelling-pattern families. Rebuildable: `node scripts/merge.mjs` (chunks + `curated.js` +
  `supplement.js`).
- **The entire PURE DECISION ENGINE is complete + tested** (`src/engine/`, all `node --test`):
  `lexicon` · `distractors` · `praise` · `assessment` · `progress` (now also
  `serializeTracker`/`deserializeTracker` for persistence) · `session` · `nonsense`.
  **90 tests green.** See §2 for each module's API and §4 for the design decisions behind them.
- **`UX.md`** — research-backed UI/UX design guide. Followed for the shell below.
- **✅ PWA SHELL + RHYTHM MODE — built and verified in a real browser (the game is PLAYABLE):**
  - `index.html` (iPad full-screen PWA meta) + `styles.css` (crystal-cavern theme, big touch
    targets, praise tier colors).
  - `src/state.js` (localStorage store: profile/settings/gems/stats/feedback + the LIVE mastery
    tracker; export/import/reset), `src/audio.js` (Web Speech dictation + spoken praise, Web Audio
    synth SFX; primed on first gesture; **degrades silently with no audio/voices**), `src/ui.js`
    (`el()` helper, screen router, shared gem/depth header, toast, particle burst), `src/app.js`
    (bootstrap, `ctx` wiring, audio priming, route table).
  - `src/screens/home.js` (big themed menu), `src/screens/settings.js` (difficulty/length/voice/
    volume/name + export-import-reset; **locked difficulties explain how to unlock**),
    `src/screens/progress.js` (gem haul, cavern depth, mastery spectrum, recent-days strip).
  - `src/modes/rhythm.js` — **THE CORE LOOP**: `buildSession` → dictate + blanked sentence →
    `buildOptions` tiles → tap → `gradeAnswer` (SFX + big colored label + spoken speed/combo praise +
    gem-burst + combo meter) → `recordAnswer` → advance → wave-complete reward that keeps the loop
    going. Distractor similarity adapts per word from `predictedSuccess`. Wrong stays gentle + reveals
    the correct spelling. (Carries a small off-DOM test hook `window.__rhythmCurrent` for the smoke test.)
  - `scripts/smoke.mjs` — **Playwright** smoke test (home → Play → correct tap mines gems + PERFECT
    praise → loop advances → wrong tap gentle + reveal → wave reward → Keep mining; zero console
    errors). Run: `npm start` then `node scripts/smoke.mjs`. (Playwright installed `--no-save`, so
    `package.json` stays dependency-free; `node_modules` + `scripts/smoke.png` are git-ignored.)

**→ NEXT ACTION — ⭐ run the EXPLORATORY VISUAL QA-AND-FIX LOOP in §14.** The user
play-tested and reports the app "doesn't seem to be working" — multiple UX/visual issues
(they didn't enumerate them). Automated checks are green and there are NO console/JS errors,
so the problems are visual/layout/UX/behavioral. §14 has the full method (drive the live app
with Playwright + monitoring hooks, screenshot frequently and **analyze each visually**,
document + FIX each, re-verify visually — NOT new persistent tests), the `scripts/qa.mjs`
harness, and a **seeded issue backlog** (I1–I8: rhythm/puzzle layout balance, Lab emitting
real words like "greet", low-contrast Play card, engagement-timing tuning, economy sanity,
device/touch-drag checks, …). Keep finding the ones the user didn't list.

The game is otherwise FEATURE-COMPLETE (all three play surfaces + feedback + progress +
settings + PWA, all smoke-verified; see §13). Only parked build item is **bulk audio
generation** (Gemini free-tier cap — §12; device voice covers it meanwhile; run only with
the user's awareness).

Build **test-first where it's pure**, keep `npm test` green (the **test gate hook runs `npm test`
before every `git commit`**), **verify UI changes with `scripts/smoke.mjs`**, and **commit per milestone**.

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
