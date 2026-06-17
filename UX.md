# Crystal Spell Caverns — UI/UX Design Guide

> Research-backed design reference for the **UI phase**. Read this before building any
> screen. It leans on **top-performing apps for this age group as exemplars**, with
> documented child-UX principles as the backing rationale. Platform = **iPad (Safari PWA)**,
> so **touch interaction is the design center of gravity**. Learner = a bright 9-year-old
> (content range ages 5–13), weak speller, loves Zelda / Brotato / Brain Test + rocks & gems.
> Compiled 2026-06-17. Sources at the bottom.

---

## 0. The one rule that overrides everything

**Tap and swipe are easy at every age; *precise dragging is hard and frustrating — even on a
touchscreen*.** In NN/G testing, kids quit a game because an item vanished when not dropped
exactly on target. Therefore, everywhere we'd use drag (puzzle unscramble, lab letter tiles):

- **Always offer tap-to-place as an equal alternative to dragging** (tap a tile, tap its slot).
  The apps that supported *both* worked for every kid tested.
- **Large, forgiving snap-to drop zones**; a near-miss snaps in, never rejects/resets.
- Never punish an imprecise drag. No "it disappeared, do it again."

Our learner is 9 (can drag), but designing forgiving-drag-or-tap makes the app serve down to
age 5 and keeps it frustration-free.

---

## 1. Exemplars — what to steal from the best apps

| App | Why it works | Steal for Crystal Spell Caverns |
|---|---|---|
| **Duolingo / Duolingo ABC** | One task per screen; instant, snappy feedback; **gentle on errors** (no punishment); layered economy (XP / gems / streak); bite-size sessions | Core loop = one word per beat; instant praise (our `praise.js`); never-harsh wrong handling; gem/XP economy |
| **Teach Your Monster to Read** | Personalized avatar on an **adventure through a world**; phonics embedded in play | Explorer avatar descending a **cavern depth map** = the progression spine |
| **Khan Academy Kids** | Warm **guide characters**; encouragement when stuck; free, exploratory | A friendly cavern-guide mascot; supportive hints; never scolding |
| **Endless Alphabet** | Delightful letter animations; **no fail state**; meaning shown via animation | Playful tile animations; the Crystal Lab "draw its meaning"; playful tone |
| **Osmo / LetterSchool** | **Multisensory** — visual + audio + tactile on every action | Multisensory feedback (Web Speech dictation + Web Audio SFX + gem-burst) on every tap |

**Meta-lesson from all of them:** the game mechanic *is* the learning act (Duolingo's tap-the-
answer = the exercise). For us, **mining a gem = spelling a word correctly** — integrated, not
bolted on.

---

## 2. Touch targets & layout (iPad)

- **Big targets.** NN/G recommends **~2cm × 2cm** for kids (4× the adult minimum). On iPad that's
  roughly **96–120 CSS px** for primary interactive elements (answer tiles, big buttons). Never
  below ~64px for anything tappable.
- **Generous spacing** between targets (≥ ~24px, NN/G suggests ~64px gaps) to prevent mis-taps.
- **No tiny controls.** No small "×" close buttons (kids rage-quit over a 5mm close button).
  Close/back = big, obvious, and forgiving.
- **Design portrait-first** but tolerate landscape; full-screen (PWA `display:standalone`).
- Keep primary actions in the **lower ⅔ of the screen** (easy thumb reach when held).

## 3. Typography & visual

- **Large text:** ≥ 24pt body; the word being spelled / answer tiles much larger.
- **Rounded, friendly font;** high contrast against the cavern background.
- **Lean on audio + icons over text** — the learner is a weak *speller* and may be a hesitant
  reader; never gate progress behind reading a paragraph.
- **Consistent color-coding** for meaning: reuse `praise.js` tier colors (gold = perfect, cyan =
  amazing, green = great, amethyst = good, muted slate = gentle "try again"). Same color/shape =
  same kind of action, everywhere.
- **Crystal-cavern theme:** glowing gems, crystal blues/purples with warm gem accents; depth =
  descending into the cavern.

## 4. Navigation & flow

- **Minimal menus.** Home = a few big buttons (Play / Crystal Lab / Progress). Recognizable icons.
- **Keep the loop going.** After a wave, surface "next / reward / keep mining" in-place rather
  than bouncing to a menu (NN/G: reduce navigation, recommend the next thing).
- **No surprise pop-ups** unless they're a useful, expected prompt.
- **One concept per screen.** Don't crowd.

## 5. Gamification — layer it (don't rely on one mechanic)

Top performers stack motivators and keep rewards *variable*:

- **Gems** = points/XP (mine one per correct spelling).
- **Combo meter** = "power surges" (our `praise.js` combos; celebratory phrase every 5).
- **Cavern depth** = mastery progression / levels; descending feels like Zelda exploration.
- **Unlocks** = the difficulty axes (per the §4 decision: **unlock, never force**) + new cavern
  zones. Unlocking harder content is the nudge toward the interleaved practice that builds
  transfer.
- **Specimen Collection** = the Crystal Lab's named/drawn nonsense-word creatures (collection =
  a strong "gotta catch 'em all" motivator).
- **Variable/surprise rewards** — occasional bonus gem bursts, a rare crystal — for pleasant
  unpredictability.
- **Gentle streak / daily goal** OPTIONAL and low-pressure — encouragement, never guilt
  (consistent with the no-harsh-feedback design). A "streak freeze"-style forgiveness if used.

## 6. Feedback & audio (the "key" requirement)

- **Instant + multisensory on every answer:** short Web Audio SFX (chime/zap) immediately, big
  colored `label` flash, gem-mine animation, combo bump.
- **Spoken praise** (`speechSynthesis`) on speed tiers / combo milestones — NOT on every single
  answer (slow TTS queued every tap lags badly). Snappy SFX always; spoken phrase on the moments
  that matter.
- **Dictation:** `audio.say(word)` reads the target word aloud; show its sentence with the word
  blanked for context.
- **iOS gesture unlock:** Web Speech + Web Audio must be primed by a **user gesture** — prime on
  the first tap (the Start button).
- **Wrong answers stay gentle:** soft sound, show the correct spelling, encourage, reschedule the
  word sooner. No buzzer, no red X shaming.

## 7. Motor/cognitive notes by age (we span 5–13, target 9)

- **Under ~9:** simplest gestures (tap, swipe, forgiving drag); biggest targets; least text.
- **9–12 (our learner):** tolerates richer content, more exploration, slightly more complex
  navigation — but still simpler than an adult UI. Default to the simpler end with depth
  available, so the same app serves the whole range.

---

## 8. Application to each screen / mode

- **Home (`screens/home.js`):** few huge themed buttons; mascot greeting (spoken). Big "Play".
- **Pre-assessment (`screens/assess.js`):** looks/plays like the rhythm mode (it IS the cold-start
  phase) — tap-the-correct-spelling, with the same gems/praise; no "test" framing.
- **Rhythm mode (`modes/rhythm.js`) — THE CORE, build first:** dictate word → show blanked
  sentence → 3–4 BIG answer tiles slide in → tap the correct one fast → instant SFX + colored
  label + spoken speed praise + gem-mine + combo. Wrong → gentle nudge + show correct. Brotato-
  style "waves" with a short reward/break. Tiles from `distractors.buildOptions`; difficulty from
  the session axes; grading from `praise.gradeAnswer`; mastery via `progress.recordAnswer`.
- **Puzzle mode (`modes/puzzle.js`):** unscramble / fill-the-blank with letter tiles — **drag OR
  tap-to-place**, large snap-to slots (see §0). Slower, deliberate; for lapsing/harder words.
- **Crystal Lab (`modes/lab.js`):** pick a practiced pattern → `nonsense.makeNonsenseWord` invents
  a specimen → dictate it → spell with **tap-to-place** letter tiles → **draw its meaning on a
  `<canvas>`** with a finger → name + save to the Specimen Collection.
- **Progress (`screens/progress.js`):** the same transparent view for kid AND parent — gems,
  cavern depth, the mastery spectrum (`progress.summary` buckets, shown as a friendly map, not
  raw numbers), specimens, a simple daily chart. The two difficulty levers + unlock state live
  here too (parents pull the same levers, no separate console).
- **Settings (`screens/settings.js`):** big sliders/toggles — difficulty + length levers, voice
  on/off + picker, volume, learner name, theme color, reset. Advanced (hidden-ish) config exposes
  the two raw difficulty axes (`patternSpread`, `masteryTarget`) + saving custom levels.
- **Feedback (`screens/feedback.js`):** emoji fun-rating + "too hard / just right / too easy" +
  optional note + "export my data" — minimal typing, mostly taps.

---

## 9. Testing the UI

Pure engine = `node --test` (done, 87 green). **UI is verified with Playwright** (real browser,
per repo tooling): smoke-drive each screen — Start primes audio, home routes, a rhythm round
accepts a tap and advances, the loop renders. Engine logic stays unit-tested; Playwright covers
wiring/rendering/interaction, not pixel-perfection.

---

## Sources

- NN/G — [Design for Kids Based on Their Stage of Physical Development](https://www.nngroup.com/articles/children-ux-physical-development/) (touch targets, the drag caveat, age bands)
- [Best spelling apps for kids 2025](https://brooklynletters.com/best-spelling-apps-for-kids/); app notes on Duolingo ABC, Khan Academy Kids, Teach Your Monster to Read, Endless Alphabet, LetterSchool
- Duolingo gamification: [Orizon](https://www.orizon.co/blog/duolingos-gamification-secrets), [StriveCloud](https://www.strivecloud.io/blog/gamification-examples-boost-user-retention-duolingo)
- Child-UX guidance: [ungrammary](https://www.ungrammary.com/post/designing-for-kids-ux-design-tips-for-children-apps), [Gapsy](https://gapsystudio.com/blog/ux-design-for-kids/), [Aufait UX](https://www.aufaitux.com/blog/ui-ux-designing-for-children/)
- Educational-game desirable difficulties (blocked helps in-game, interleaved helps transfer): [AIED 2023 chapter](https://link.springer.com/chapter/10.1007/978-3-031-36336-8_21)
