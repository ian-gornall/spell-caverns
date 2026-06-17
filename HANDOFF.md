# Crystal Spell Caverns — Project Handoff

> Read this top-to-bottom before continuing. It is written so a fresh session (with
> no prior context) can pick up and build the game without re-deriving any decisions.
> Project root: `C:\Users\iango\spell`  •  Last updated after **engine build-order step 3**
> (distractor + praise engines). Git HEAD `e3582b2`; tree clean; `npm test` green (45 tests).

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
  hand-edit. **2,829 words**, **frequency-ordered** (`rank` 1 = most common), spanning
  **ages 5–13** (difficulty `tier` 1–9). Re-exports `PATTERNS`. Imports cleanly in Node 22.
- **`data/patterns.js`** — canonical **63 spelling-pattern families** (the single source
  of truth for `pattern` ids). Exports `PATTERNS`, `PATTERN_IDS` (Set), `PATTERN_BY_ID`.
- **`data/curated.js`** — the **317 hand-crafted entries** (great themed sentences +
  hand-picked misspellings). Used as a quality *overlay* by the merge.
- **`data/backbone.json`**, **`data/chunks/input_*.json`**, **`data/chunks/part_*.js`** —
  intermediate build artifacts (the 12 enriched chunks). Kept so the dataset is rebuildable.
- **`scripts/build_backbone.mjs`** — fetches a frequency list, filters to ~3000
  age-appropriate words in frequency order, splits into 12 chunk inputs.
- **`scripts/merge.mjs`** — merges chunks + curated overlay → `data/words.js`, drops
  `skip:true`, validates, sorts by frequency. **Rebuild the dataset anytime with
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
- Git: clean history; latest commit `e3582b2` (this milestone adds praise → next commit).

### TODO ⛔ (everything that makes it a game — see §6 build order)
- The engine logic modules (SRS, assessment, nonsense) + their tests.
  *(`lexicon.js` + `distractors.js` + `praise.js` are done — **start at `srs.js`**.)*
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
- Per-tier counts: `{1:145, 2:254, 3:434, 4:344, 5:157, 6:553, 7:487, 8:143, 9:312}`.
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

### Theme (decided): **"Crystal Spell Caverns"**
A miner/explorer descends a glowing **crystal cavern** (ties his love of rocks/minerals +
Zelda exploration + Brotato waves). Each correct spelling **mines a gem**; mastering a
**pattern** opens a **deeper cavern level**; **nonsense words become new "crystal specimens"**
the learner draws, names, and catalogs in a **Specimen Collection**. Combos = power surges.

---

## 5. Planned file layout (what to create)

```
index.html                  ⛔  app shell, full-screen iPad meta, loads src/app.js (type=module)
styles.css                  ⛔  kid-friendly, big touch targets, cavern/crystal theme
manifest.webmanifest        ⛔  PWA install (name, icons, display:standalone, portrait)
sw.js                       ⛔  service worker — cache app + data for offline
README.md                   ⛔  how to run on the iPad, how to give feedback, how to iterate
server.js                   ✅
package.json                ✅
data/  (all ✅)             words.js · patterns.js · curated.js · backbone.json · chunks/
scripts/ (all ✅)          build_backbone.mjs · merge.mjs
src/
  engine/   (PURE, test-first)
    lexicon.js              ✅  load WORDS/PATTERNS; REAL_WORDS (Set of all words, for
                                distractor exclusion), wordsByPattern, wordsByTier, getWord, byRank
    distractors.js          ✅  misspelling generator + multiple-choice builder  (DESIGN in §7)
    srs.js                  ⛔  mastery / spaced-repetition engine                 (DESIGN in §7)
    assessment.js           ⛔  adaptive gamified pre-assessment                   (DESIGN in §7)
    praise.js               ✅  DDR-style speed→praise tiers + phrase pools        (DESIGN in §7)
    nonsense.js             ⛔  pattern-based nonsense-word generator              (DESIGN in §7)
  state.js                  ⛔  localStorage store: profile, settings, SRS cards, progress,
                                feedback log, telemetry; export/import JSON
  audio.js                  ⛔  primeAudio(gesture); say(word) dictation; speakPraise(phrase);
                                sfx(type) via Web Audio; respects settings (voice/volume)
  ui.js                     ⛔  screen router, el() helper, header (gem count + cavern depth),
                                particle/confetti burst, toast, transitions
  app.js                    ⛔  bootstrap: load state, prime audio on Start, route to home
  modes/
    rhythm.js               ⛔  CORE fast loop — DDR style (DESIGN in §8)
    puzzle.js               ⛔  drag/drop unscramble + fill-the-blanks (DESIGN in §8)
    lab.js                  ⛔  nonsense-word spell + draw-a-meaning canvas (DESIGN in §8)
  screens/
    home.js                 ⛔  big-button menu: Play / Crystal Lab / Pre-Assessment /
                                Progress / Settings / Feedback
    assess.js               ⛔  runs engine/assessment.js with gamified UI
    progress.js             ⛔  gems, depth, words mastered, pattern map, daily chart, specimens
    settings.js             ⛔  sliders/toggles: speed, difficulty, voice on/off, volume,
                                learner name, theme color, reset
    feedback.js             ⛔  emoji fun-rating + "too hard / just right / too easy" + note +
                                "export my data" button
test/
  data.test.js              ✅  dataset integrity (valid patterns, syllables join, no dups, sorted) + lexicon helpers
  distractors.test.js       ✅  rng/shuffle/levenshtein + generateMisspellings + buildOptions (ramp, curated, exclusions)
  srs.test.js               ⛔
  assessment.test.js        ⛔
  praise.test.js            ✅  tier boundaries, speed+combo scoring, milestone phrases, gentle wrong branch
  nonsense.test.js          ⛔
```

---

## 6. Recommended build order (next session)

1. ~~**`src/engine/lexicon.js` + `test/data.test.js`** — load the data, expose helpers, lock in
   integrity with a test.~~ **✅ DONE** (commit `810487d`, 14 tests green). **← START HERE: step 2.**
2. **Pure engine modules, test-first**, in this order: ~~`distractors`~~ ✅ → ~~`praise`~~ ✅
   → **`srs` ← START HERE** → `nonsense` → `assessment`. Each ships with a `*.test.js`. Keep
   `npm test` green (the **test gate hook runs `npm test` before `git commit`** — a red
   suite blocks the commit, so commit only on green).
3. **Shell**: `index.html` + `styles.css` + `src/ui.js` + `src/state.js` + `src/audio.js`
   + `src/app.js` with a working **home screen** and audio priming on first tap.
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

> NOTE: `distractors.js` is now ✅ implemented + tested (build-order step 2). Spec kept here
> for reference; the next module to build is `praise.js`.

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

**`srs.js`** — mastery via Leitner-style boxes; tuned so words recur **within a session**
(short intervals for low boxes) and **across sessions** (longer for high boxes).
- `createCard(word, now)`, `review(card, correct, {now, fast})` (fast correct advances faster),
  `isMastered(card)`, `isDue(card, now)`.
- `selectNext({cards:Map, queue:[words by rank], now, maxActive, rng})` → next word: prefer most-
  overdue due card; else introduce the next queued (most-common) new word, capping concurrent
  in-progress words (`maxActive ≈ 8`) so the learner isn't overwhelmed.

**`nonsense.js`** — for the Crystal Lab.
- `ONSETS` list + `RIMES` per pattern id (e.g. `ight → ["ight"]`, `silent-e-a → ["ake","ame","ate"]`).
- `makeNonsenseWord(patternId, {realWords, rng, avoid})` → a pronounceable **non-word** in that
  pattern (e.g. "splight", "dathe"), guaranteed not a real word and not in `avoid`.

**`assessment.js`** — gamified adaptive pre-assessment; **samples by frequency**, adapts by tier.
- `createAssessment(words, {startTier, rng})`, `nextItem(state)` (→ word or null when done),
  `submit(state, word, correct, {fast})`, `result(state)` →
  `{ knownWords:Set, unknownQueue:[words frequency-ordered], estimatedTier, perPattern }`.
- Staircase: climb tiers while accuracy high, stop at the "frontier" where errors appear; ~18–25
  items; keep it short and fun (mostly "tap the correct spelling", a few quick type-ins). Output
  seeds the SRS queue (unknown, most-common first).

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

## 11. Open questions to confirm with the user (have sensible defaults)
- **Learner's name** for personalization? (default: "Explorer" / configurable in Settings)
- **Voice** preference for dictation/praise (pick an upbeat English `speechSynthesis` voice; expose
  on/off + a voice picker in Settings).
- **Default theme color** of the cavern (default: crystal-blue; configurable).
None of these block building — defaults are fine; surface them in Settings.

---

### One-paragraph summary for whoever picks this up
The **word data is finished**: a 2,829-word, frequency-ordered, ages-5–13 dataset
(`data/words.js`) grouped into 63 internal spelling-pattern families, each word carrying a
difficulty tier, syllables, plausible child misspellings, and a kid-safe sentence — fully
rebuildable via `scripts/merge.mjs`. The **data-access layer** (`src/engine/lexicon.js`) and
its **integrity test suite** (`test/data.test.js`, 14 tests) are also done and green — that
was build-order step 1. **Everything else is still to build**: the rest of the pure engine
(distractors / SRS / assessment / praise / nonsense, test-first — **start at `distractors.js`**),
then the PWA UI — a
DDR-style fast "tap the right spelling" rhythm mode with spoken speed-tiered praise, a
drag/drop puzzle mode, and a "Crystal Lab" where the learner spells invented same-pattern
words and draws their meanings — plus progress, settings, and feedback screens, themed as a
crystal-cavern mining adventure. Follow §6 build order, keep `npm test` green, and run on the
iPad with `npm start`.
```
