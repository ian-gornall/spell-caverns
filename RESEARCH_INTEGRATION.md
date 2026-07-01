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

The sample data file is not in `build_deploy.mjs` or the `sw.js` precache, so nothing
ships to prod. The live game still runs on `data/words.js`.

## The full migration (when the research lists are final)

1. Re-run `import_research.mjs` against the finished corpus with a bigger or removed
   cap. The engine and tests hold as-is; only the data grows. At full size the data
   should move from a committed JS module to a fetched, cache-versioned JSON chunk
   (per band or per spine segment) rather than one 15 MB module.
2. Rewire selection. `engine/categories.js` currently levels by 30-word bands of the
   flat list. Replace the band concept with (spine pattern, age pool): `fillLearning`
   draws from the current lesson via `lessonPlan`, the level-up gate becomes the
   pattern gate (APP_DESIGN decision 7), and the learning-set refill order inside a
   lesson is already `orderWithinPattern`.
3. Reteach on miss. Craft/mastery miss handlers call `reteach()` and render the rule
   plus grapheme highlight (the span indices map straight onto the letter tiles).
4. Diagnostic placement. `engine/assessment.js` samples patterns across the spine
   instead of tiers 1 to 9 to set the floor; age sets the ceiling.
5. Audio. Clips exist for the current 2,916 words only. New words fall back to device
   TTS until a gen_audio run covers them; homophone words need their sentence audio
   or TTS. This is the main content cost of going wide.
6. Data still in flight upstream: the word-by-pattern recall pass (T4) and its
   follow-ups will improve exception edges and may adjust placements. The importer
   makes refreshing cheap, so import again after each upstream milestone rather than
   hand-patching.
