# Crystal Spell Caverns — Project Handoff

> Read this top-to-bottom before continuing. It is written so a fresh session (with
> no prior context) can pick up and build the game without re-deriving any decisions.
> Project root: `C:\Users\iango\spell`  •  Last updated 2026-06-17 after **ALL THREE play
> surfaces (rhythm + puzzle + Crystal Lab), the feedback screen, the PWA packaging
> (manifest/service-worker/icons), the README, and the praise-clipping bug fix were built
> & verified**. `npm test` green (**101 tests**); UI smoke-tested with Playwright
> (`npm run smoke`) across every mode. **The game is FEATURE-COMPLETE and installable.**
> **⚠️ Read §13 (latest SESSION UPDATE) for the current state; audio generation is the
> only parked item.** §12 has the audio status + history.

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

**→ NEXT ACTION — the game is now FEATURE-COMPLETE. ⇒ Read §13 (latest session update)
for exactly what's built and the small/optional items left.** In short: all three play
surfaces (rhythm/puzzle/lab), feedback, progress (with specimen gallery), settings, and
the PWA packaging are done and smoke-verified; the praise-clipping bug is fixed. The only
real parked item is **bulk audio generation** (Gemini free-tier daily cap — §12; the
device voice covers everything meanwhile; run only with the user's awareness). Remaining
work is **polish, not new surfaces** — see §13's "What's LEFT".

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
- **What's generated:** **242 word clips (top-242 by frequency) + 28 praise/gentle phrases**, in
  `audio/` (git-ignored), listed in `audio/manifest.json`. **2,677 words still pending.**
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
