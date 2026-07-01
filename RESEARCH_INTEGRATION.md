# Research corpus integration

How the app moves from its single word list to the spelling-research corpus: many
pattern lessons, filtered by age of acquisition. This pass built the mechanism on a
sample; the full import happens once the research lists finish processing.

## The source

`C:/Users/iango/spelling-research/app_data/` (built by that repo's `assemble_app.py`):

- `words.jsonl`, 49,778 word forms. Each has an AoA band (`under6` through `15plus`),
  a governing pattern id, its spine position, length, zipf frequency, a grapheme span
  (which letters make the pattern's sound), a homophone cluster id, and a carrier sentence.
- `spine.json`, the single ordered sequence of 107 patterns everyone walks.
- `patterns.json`, the 108-lesson catalog: kid-facing rule, teach exemplars, target
  graphemes, watch notes.
- `homophones.json`, 803 clusters of words whose bare audio is ambiguous.

The teaching loop is locked in that repo's `APP_DESIGN.md`:

1. Pool is cumulative by age. A learner of age N gets the union of every band at or
   below N. Age is a ceiling, not a track.
2. Path is one phonics spine. A pattern surfaces only once the learner's pool actually
   contains words that need it.
3. Inside a pattern, words run shortest first, then most frequent first.
4. On a miss, reteach the pattern's rule and exemplars and highlight the grapheme.
5. Homophones are dictated with their carrier sentence.

## What this pass built

- `scripts/import_research.mjs`. The repeatable import step. Streams `words.jsonl` and
  keeps the top 2 words per (pattern x band) cell, chosen by the app's own
  within-pattern order, so the sample is the words each lesson would teach first.
  Emits `data/research_sample.js`: full spine, trimmed catalog, the sampled words
  (2,003 covering all 107 lessons and all 11 bands), and the 198 homophone clusters
  they reference. `--per-cell N` raises the cap; remove it at full import.
- `src/engine/lists.js`. Pure engine implementing the loop above: `buildPool(words, age)`,
  `lessonPlan(pool, spine)`, `orderWithinPattern`, `reteach(word, patterns)`,
  `needsCarrierSentence`. Nothing imports it from the live game path yet.
- `test/lists.test.js`. 13 tests: the loop on synthetic fixtures plus contract checks
  on the emitted sample (band names, spine coverage, per-cell cap, homophone links,
  end-to-end plan for ages 7 and 12).
- `scripts/demo_lists.mjs [age]`. Prints a learner's lesson plan, a reteach example,
  and a homophone dictation example from the sample.

## Live integration (shipped csc-v67, "Pattern lessons" mode)

The lists now run in the live app behind a per-profile mode. A grown-up flips it in
Settings, Grown-up settings, Word lists; classic stays the default while the research
lists finish processing upstream.

How it's wired: `lexiconEntries()` (engine/lists.js) turns the sample plus the
learner's age into classic-shaped entries where `band` is the 1-based lesson number in
spine order. `engine/lexicon.js` serves those from `byRank()` when the mode is on
(`setWordlistMode`, applied per profile in `app.refreshActive`). Everything downstream
runs unchanged, which means the categories level gate IS the pattern gate, and the
existing spaced review applies per lesson.

What the UI got:
- Settings: Word lists panel (Classic / Pattern lessons) plus an age stepper (5 to 15,
  seeded from the onboarding age). Switching restarts the word path at lesson 1 (gems,
  streaks, tracker kept). The classic re-test button hides in lessons mode; the level
  stepper reads "Lesson N of M".
- Craft and Mastery: a miss shows the pattern's rule in a reteach strip, and Craft
  glows the letters of the pattern's grapheme span amber.
- Dictation: homophone words are followed by their carrier sentence.
- Progress: the cavern map becomes the Lesson path, each entry named by its pattern.

Adapter details worth knowing: words under 3 letters are dropped (craft tiles need 3),
and lessons L1/L2 (defined as 2-letter-word lessons) are dropped whole, including the
corpus's stray longer placements there ("add", "spirit" — worth flagging upstream).
Tier maps the AoA band index clamped to the classic 1 to 9 range.

## What remains

1. Full-size re-import when the research lists are final (`--per-cell` up or removed).
   At full size move the data from a committed JS module to fetched, cache-versioned
   JSON chunks rather than one 15 MB module.
2. Diagnostic placement for lessons mode: sample patterns across the spine to set the
   floor (the classic walk diagnoses 30-word bands, so it is skipped in lessons mode
   and learners start at lesson 1).
3. Audio. Clips exist for the current 2,916 words only; research words fall back to
   device TTS. A gen_audio run over the research sample (and sentence audio for
   homophones) is the main content cost.
4. Printables still draw from the classic list regardless of mode.
5. Upstream data still in flight: the word-by-pattern recall pass (T4) will improve
   exception edges and may adjust placements. Re-run the importer after each upstream
   milestone rather than hand-patching.
