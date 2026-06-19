# Crystal Spell Caverns — Design Analysis

> A decision-grade product-design review of the Crystal Spell Caverns PWA (adaptive, gamified
> spelling game, ages ~5–13, tuned at iPad proportions, also run as an installed PWA on phones).
> Method: hands-on exploratory QA of the live app at four viewports (act → screenshot → look →
> note), plus research benchmarking against best-in-class children's literacy apps and primary
> design standards (WCAG 2.2, NN/g, Apple HIG, Material, the British Dyslexia Association, and the
> spelling/learning-science literature). The learner is a *weak speller* (possibly dyslexic-leaning),
> so dyslexia-friendliness, readability, low-anxiety feedback, and accessibility are weighted heavily.
>
> **Scope note:** I am a read-only reviewer. No app source was modified. The only files created are
> this report, a small Playwright capture script (`scripts/design_qa.mjs`), and screenshots under
> `scripts/qa/design/`. Reviewed against code at `sw csc-v21`, local server on `:5181`.
>
> **Honest limitation:** headless Chromium on Windows cannot reproduce iOS/Android *standalone*
> rendering — the notch / `env(safe-area-inset-*)` behavior, the home-gesture bar, or real
> Safari/Chrome quirks. Every finding that depends on safe-area or true-device rendering is flagged
> **[device-check]** and should be confirmed on a physical iPad and phone before acting.

---

## 1. Executive summary

**Verdict: this is a genuinely good, coherent, research-literate kids' app — well above the median
of the category on pedagogy, tone, and theme discipline — that is currently held back by a small
number of *layout and asset* problems rather than by any conceptual flaw.** The visual system is
consistent (a single tier-color language reused everywhere), the cavern theme is executed with
restraint and real depth (gradients, glows, sockets, treasure tiles), and the feedback model is
unusually thoughtful: errors are gentle ("Almost!" / "Try again!" in muted slate, never a red X),
wrong spellings fade out so the *correct* one is the last thing on screen, praise is process-and-
speed based, and the reward economy is bounded and non-predatory (no real money, no FOMO timers,
no leaderboards). On the four design pillars that matter most for a weak speller — readability,
low-anxiety feedback, theme/motivation, and pedagogical integrity — the app is strong.

The weaknesses are concentrated and fixable:

**The 5 highest-leverage improvements**

1. **Fix landscape and short-phone top-heaviness (biggest single problem).** In phone *landscape*
   the home screen and the wave-reward screen push **all** primary actions below the fold — a child
   in landscape literally cannot see "Craft / Keep practising / Home" or any menu card without
   knowing to scroll (the reward screen overflows by **+213px**). The hero must collapse hard in
   landscape and on short portrait phones. **(S–M, free.)**
2. **Adopt an evidence-based, letter-distinct typeface and ship dyslexia-mode mechanics properly.**
   The current stack starts with *Baloo 2* (a display/rounded font with relatively low letter
   differentiation). For a *spelling* task, glyph identity (I/l/1, b/d/p/q, 0/O) is the whole game.
   Switch UI/spelling type to **Atkinson Hyperlegible** or **Inter**, and upgrade the existing
   "Easy-read text" toggle to a fuller dyslexia mode (off-white surface option, 1.5 line-height,
   ~0.35× tracking). **(M, free — both fonts are SIL OFL / free.)**
3. **Differentiate the locked catalog art.** Every un-owned mineral renders as the *same* grey
   hexagon, so the collection's headline motivator ("gotta catch 'em all") reads as 24 identical
   placeholders. Give each locked mineral a distinct silhouette/tint so the collection feels like a
   real set to complete. **(M, free if procedural; or a small paid asset pack.)**
4. **Raise two below-AA contrast spots.** White body text on the Craft hero's pink gradient measures
   **~3.95:1** (below the 4.5:1 AA floor for normal text), and the slate wrong-verdict subtext is at
   **4.12:1**. Both are easy CSS fixes. **(S, free.)**
5. **Resolve the recognition-mode imprinting risk explicitly.** "Practice" (multiple-choice) still
   *displays plausible misspellings as tappable options*, which the spelling literature shows can
   imprint errors even when the learner knows they're wrong. The dim-out mitigation is excellent and
   CRAFT is correctly the mastery path — but consider reducing misspelling dwell time / option count
   for the youngest tiers. **(S–M, free; pedagogy decision.)**

Everything else in this report is polish on an already-solid foundation.

---

## 2. Visual design audit

### 2.1 Colour system & contrast

The palette is a disciplined, single source of truth: five "tier" colors (`--gold #ffd23f`,
`--cyan #36f1cd`, `--emerald #7ae582`, `--amethyst #9d8df1`, `--slate #6c7a89`) defined in
`:root` and reused for *meaning* everywhere — gold = perfect, cyan = amazing, green = great,
amethyst = good, slate = gentle "try again." This is exactly the "same color = same meaning"
consistency NN/g recommends for kids, and it is followed rigorously across praise, the mastery
spectrum, the depth ladder, and the catalog rarity chips. The dark cavern base
(`--bg-0 #070a1c` → `--bg-1 #0e1430`) with radial accent glows gives genuine depth.

**Measured contrast (computed from the CSS values against `--bg-1 #0e1430`; WCAG 2.2 AA = 4.5:1
normal text, 3:1 large text / non-text):**

| Pair | Ratio | Verdict |
|---|---:|---|
| `--ink #eaf0ff` body on bg | **15.85:1** | AAA |
| `--ink-dim #9fb0d8` on bg | **8.33:1** | AAA |
| `--ink-dim` on panel | **7.68:1** | AAA |
| `--gold` on bg | **12.52:1** | AAA |
| `--cyan` on bg | **12.59:1** | AAA |
| `--emerald` on bg | **11.50:1** | AAA |
| `--amethyst` on bg | **6.47:1** | AA (AAA for large) |
| `--accent #7aa2ff` on bg | **7.27:1** | AAA |
| badge ink `#1a1330` on gold badge | **12.33:1** | AAA |
| **`--slate #6c7a89` wrong-verdict subtext on bg** | **4.12:1** | **Large-text AA only; fails normal-text AA** |
| **white `.desc` on Craft hero pink (`~#b14bff`)** | **~3.95:1** | **Below AA for normal text** |

**Findings.** The body and accent palette is excellent — most pairs clear AAA. Two spots fall short:
(a) the white description line on the **Craft hero** card sits over a bright pink-to-magenta gradient
and measures ~3.95:1; it's already been hand-patched to near-white (`rgba(255,255,255,.86)`) but the
*gradient's pink end* is the problem, not the text. (b) The muted-slate wrong-verdict subtext
("The gem was…") is deliberately quiet, which is the *right instinct* (no alarm red), but at 4.12:1
it's borderline for the small subtext size. Both are minor and fixable (darken the hero gradient's
pink end ~10–15%, or add a subtle text-shadow / scrim; lift the wrong-subtext one notch).

**Colour-blindness:** because meaning is *also* always carried redundantly (label text "PERFECT!",
the gold spotlight ring, the spectrum legend labels, position), the app does not rely on hue alone —
good. The one watch item is the cracked/known/learning spectrum (emerald/amethyst/slate) which is
distinguishable by lightness but is labeled anyway. Fine.

### 2.2 Typography & readability (dyslexia lens)

Font stack: `"Baloo 2", "Quicksand", "Segoe UI Rounded", "Nunito", system-ui, sans-serif`, base
`font-size: 18px`. Sizes are generous and fluid (`clamp()` throughout): sentence text
`clamp(1.3rem, 4.4vw, 2rem)`, answer tiles `clamp(1.2rem, 5vw, 2.05rem)`, verdict
`clamp(2rem, 8vw, 3.4rem)`. Line-height on the dictated sentence is 1.5. This is all well above the
BDA's 16–19px / 1.5-line-height minimums and above the UX.md "≥24pt body" intent.

**The concern is glyph choice, not size.** *Baloo 2* is a rounded display family with comparatively
low letterform differentiation — exactly the wrong property for a task whose entire point is telling
**b/d/p/q, I/l/1, 0/O** apart. The British Dyslexia Association Style Guide (2023) calls for a clean
sans-serif with *distinct* letters, larger tracking, 1.5 line spacing, left-aligned ragged-right
text, no italics/all-caps, and an off-white (not pure-white) surface — and the research consensus
(Rello & Baeza-Yates 2013; Wery & Diliberto 2017; Kuster et al. 2018; IDA) is that *spacing and
letterform clarity* drive readability, **not** "special" dyslexia fonts like OpenDyslexic (which
multiple controlled studies found gave no benefit and was not preferred).

The app already has the right *mechanism* — an opt-in `html.readable` mode that adds tracking
(`letter-spacing: .03em` on sentences, `.06em` on tiles) and line-height 1.65 — but it's scoped thin
and the default font undercuts it. Note also: most spelling text is **center-aligned** (sentence,
tiles), which the BDA advises against (left-align reduces "rivers" and is easier to track); for the
sentence context line specifically, left-alignment would help a struggling reader.

**Recommendation:** make the default UI/spelling font **Atkinson Hyperlegible** (purpose-built to
maximize letter distinction — distinct I/l/1, 0/O, b/d; free SIL OFL, on Google Fonts) or **Inter**
(tall x-height, open apertures; free). Keep Baloo 2 only for the big *decorative* title if desired.
Upgrade "Easy-read text" into a fuller dyslexia mode: off-white reading surface option, 1.5
line-height globally on text, ~0.35× tracking, left-aligned sentence. Offer OpenDyslexic only as an
*optional* extra toggle, **not** marketed as evidence-based.

### 2.3 Spacing, layout & hierarchy

At the **iPad design target (820×1180) the layout is excellent** — the home hub reads as one game
world: a gradient CRAFT hero spanning full width with a "Best gems" badge, a clearly-subordinate
"Practice" banner, then a balanced 2×2 of utility cards (Crystal Lab / Catalog / Progress /
Settings) and a Feedback card. Hierarchy is unambiguous: Craft is biggest and brightest, Practice is
calmer, utilities are flat slate. This is textbook "few big buttons, clear primary action."

**The problem is everything narrower or shorter than the iPad.** The app is tuned at iPad
proportions and the hero (title + welcome line + streak/quest chips + the daily-goal bar) consumes a
large vertical band. On a **phone portrait (390×844)** that's tolerable — the Craft hero and Practice
banner are visible, utilities peek below the fold. On a **small Android (360×740)** the hero eats
~55–60% and only Craft + the *tops* of Crystal Lab/Catalog show. In **landscape (844×390)** it
collapses: the visible viewport is *just* the title + streak chips + the top edge of the Craft card —
**zero menu cards reachable**, including Craft itself. (Detail in §6.)

The phone media-query block (`@media (max-width:480px)`) does real work — it shrinks the header pills,
drops the word "Depth," compacts the hero and cards, and pins the onboarding CTA sticky — and it's
correctly placed last so source order wins (per the project's documented CSS gotcha). But it has **no
landscape branch**, and the in-game `.play-body` "safe center" can still strand content (see §3/§6).

### 2.4 Iconography, illustration & asset quality/consistency

The app is almost entirely **emoji + procedural CSS/SVG** — a deliberate, defensible choice for a
zero-build, offline, dependency-free PWA. Within that constraint it's done well:

- **Procedural faceted-gem SVG** for catalog minerals and crystal grants — attractive, themed,
  scalable, free.
- **Geo the mascot** is a pure-CSS hexagon with a gradient, a bobbing animation, and a simple face.
  It's charming and on-theme, but it is a *single static expression*. Best-in-class comparators
  (Duolingo's Duo, Khan's Kodi, Endless Alphabet's monsters, Teach Your Monster's *custom-built*
  avatar) lean on an expressive, reactive character as the emotional spine. Geo greets and then
  vanishes; he never reacts to a great combo, a miss, or a milestone.
- **Emoji icons** (⛏️ pick, 🔨 hammer, 💎 gem, 🏆 trophy, 🔮 lab) are consistent and legible but
  render differently per platform (Apple vs. Android vs. the dev's fallback font) — a known
  consistency risk the code comments themselves acknowledge.

**Two concrete asset issues.** (1) **Locked catalog minerals are all the identical grey hexagon** —
the collection's main pull is undercut because the 24 "specimens to collect" look like 24 copies of
one placeholder. (2) The mascot's lack of reactivity is a missed engagement lever.

### 2.5 "Crystal cavern" theme execution

Strong and consistent — this is one of the app's best qualities. The theme is carried by *systemic*
detail, not a one-off backdrop: empty puzzle slots are "glowing crystal sockets" with a breathing
inner glow (`@keyframes socket-glow`); the level-select is a cool→warm **depth ladder** (cyan shallow
→ magenta deep) so picking a level *reads as choosing how deep to dig*; Progress reframes raw stats
as a **"Your haul"** treasure-tile row + a "Cavern map" with "you are here"; combos are "power
surges"; the daily reward is a tap-to-crack **geode**. Correct/wrong are "mined gem" / "the gem
was…". The metaphor is coherent from onboarding ("Ready to dig for sparkly gems?") through reward.
Restrained, not garish. Good.

### 2.6 Depth & polish

High for a hand-built app. Cards have layered gradients + inset highlights + drop shadows; buttons
have a consistent `:active { transform: scale(.96) }` press; the verdict has a satisfying
`verdict-pop` scale animation; particles fly on a correct answer; the geode shakes then pops. The
`screen-in` transition gives every route a gentle entrance. Reduced-motion is respected globally
(`@media (prefers-reduced-motion: reduce)` zeroes all animation/transition durations). The polish
level genuinely approaches App-Store quality on the iPad target.

---

## 3. Motion, feedback & game-feel

**This is the app's strongest dimension and it is research-aligned.** Verified across captured
states:

- **Correct verdict:** big colored label ("Crystal clear!", "Brilliant!") in the speed-tier color +
  `+20 💎 · PERFECT!` chip + particle burst + combo bump + spoken praise. The `verdict-pop` keyframe
  (scale 0.6 → 1.15 → 1) lands with a confident pop. Speed tiers (perfect/amazing/great/good) map to
  gold/cyan/emerald/amethyst — consistent meaning, and praise is *process/speed* praise, which aligns
  with Mueller & Dweck 1998 (praise effort/strategy, not the person).
- **Wrong reveal:** gentle. The verdict is **"Almost!" / "Try again!" in muted slate** (never red, no
  buzzer), the chosen wrong tile dims, and — critically — the **other wrong tiles fade out
  (`.tile.dim-out`, opacity .1 + blur) while the correct tile is spotlighted in gold**
  (`.tile.reveal`, gold ring + glow). So the *last thing on screen is the correct spelling.* This is a
  direct, well-executed implementation of the negative-suggestion / misspelling-imprinting research
  (Brown 1988; Jacoby & Hollingshead 1990): you end on the correct form. Excellent.
- **Reward moments:** wave-complete shows a trophy, gem haul, an unlock progress line, and routes the
  child toward CRAFT as the headline CTA. The daily **geode** is tap-to-crack with a shake→pop and a
  glow that scales with crack progress — a bounded, always-positive variable reward (no money, no
  timer), which is the *ethical* version of Duolingo's chest mechanic rather than the Prodigy
  anti-pattern.
- **SFX/haptics:** synthesized Web Audio chimes are snappy on every answer; spoken praise is reserved
  for speed tiers/combos (avoiding TTS lag); `navigator.vibrate()` adds haptics where supported
  (no-op on iPad Safari — correctly treated as enhancement, with audio as the primary layer, matching
  Apple's haptics-complement-don't-replace guidance). **[device-check]** confirm haptic + real-voice
  timing on a physical device.

**The one nuance worth flagging (pedagogy, not feel):** the *recognition* ("Practice") mode by design
*displays plausible misspellings as tappable options*. The spelling literature is unusually firm that
**merely seeing** plausible misspellings can imprint them, even when the learner knows which is wrong.
The app mitigates this better than almost anything in the category (dim-out + correct-spotlight +
making CRAFT/production the mastery spine), but for the youngest tiers consider fewer options and
shorter misspelling dwell time. This is a tuning decision, not a redesign.

**Age-appropriateness / anxiety:** nothing observed is anxiety-inducing. No fail state, no shaming,
no loss framing on errors. This is exactly right for a weak/at-risk speller (anxiety and low
self-efficacy are documented secondary harms of reading/spelling difficulty).

---

## 4. UX & information architecture

**Onboarding** (Geo → name → crystal colour → level-select → guaranteed-win first wave) is clear,
low-text, mascot-led, and personalizing — matching Khan/Duolingo-ABC patterns (weave the child's name
in; let them pick an identity color; ability-based start). The level-select depth-ladder with age
bands and example words ("the · of · and" … "university · international") is a genuinely good way to
let a parent/child pick a starting point without a "test." **Weakness:** the welcome and "invent a
crystal" screens are **vertically top-heavy** — Geo + bubble + CTA cluster in the top ~45% with a
large empty void below, which reads as unfinished framing rather than deliberate negative space.
Center the mascot block, or give the bottom void purpose (a faint cavern parallax, drifting gem
particles).

**Home/hub hierarchy** is strong on iPad (see §2.3): Craft hero > Practice > utilities. The
**CRAFT-as-hero decision is correct and well-supported** — production (build-the-word from memory) is
the active ingredient for spelling transfer, and making it the biggest, best-paid (`CRAFT_MULT`),
most-nudged path is the right pedagogical bet. Reframing recognition as "Practice / warm up" is honest
labeling.

**Navigation** is shallow and forgiving: big back chevrons (64px circles), in-place "keep the loop
going" CTAs on the reward screen (Craft / Keep practising / Progress / Home) rather than bouncing to a
menu — matching the NN/g "recommend the next thing" guidance.

**Discoverability:** the catalog surfaces affordable minerals with a cyan glow/pulse; quests are
tappable to launch their activity; the "Repair" card appears only when there are cracked words. Good.

**Cognitive load for 5–13:** generally one concept per screen. The two screens that crowd are
**Settings** (a long scroll: Adventure level grid → difficulty → word count → answer count → voice →
sync → time machine → parent password) and the **Progress** screen (haul + map + 3 quests + words-
explored + personal bests). For the *child* end these are fine because the home stays simple; but the
Settings "Adventure" 9-card level grid plus advanced levers is a lot — consider collapsing
advanced/parent items behind the existing parent gate by default so the child-facing Settings is
shorter.

---

## 5. Accessibility

- **Contrast:** mostly AAA; two below-AA spots (Craft-hero pink text ~3.95:1; slate wrong-subtext
  4.12:1) — see §2.1. Fixable in CSS.
- **Touch targets (WCAG 2.2: 24px AA min, 44px AAA; Apple 44pt; Material 48dp; NN/g kids ~2cm ≈
  ~75px):** primary targets are well above all thresholds — `--tap-min: 64px`, answer tiles
  `clamp(84px, 11vh, 116px)` tall, back button 64px, colour swatches 84px. This squarely meets the
  *child* 2cm bar, not just the adult minimum. Smaller controls — the catalog detail **"Close" pill**,
  the puzzle **"Hint/Clear"** ghost buttons (min-height 52px), and the lab palette swatches (46px) —
  are all still ≥44px, so AAA-compliant, though the 46px palette swatches sit right at the child-
  comfort edge. The picture-pad kid-lock buttons are large (`aspect-ratio:1`, clamp to 2.6rem).
  **No target is below the 24px AA floor.** Good.
- **Reduced motion:** fully honored (`prefers-reduced-motion: reduce` zeroes durations) — satisfies
  WCAG 2.3.3.
- **Font scaling:** layout is `rem`/`clamp`-based, so OS font scaling (Android Large/Largest) reflows
  rather than clipping — but this is the project's documented weak spot and the QA matrix calls for
  re-checking key screens at 20–24px root. **[device-check]** verify tiles/sentence at Largest font.
- **Colour-blindness:** meaning is redundant (text labels + position + shape), not hue-only. Good.
- **Kid-lock / parent gate:** the picture-password kid-lock (tap pictures, no typing) is age-
  appropriate and avoids a literacy barrier for a weak reader; the optional grown-up-password gate over
  the Parents panel is correctly framed as "a soft guard, not real security." Both are reasonable and
  the flows are large-target and forgiving.
- **Safe-area:** `#app` pads with `env(safe-area-inset-*)` and the manifest is `display: standalone`
  with `viewport-fit=cover` — the correct pattern. **[device-check]** the notch/home-bar interaction
  cannot be verified in headless Chromium.

---

## 6. Responsive / device quality

| Viewport | State | Result |
|---|---|---|
| **iPad 820×1180** (target) | home, play, progress, settings | **Excellent** — balanced, clear hierarchy, no clipping. |
| **Phone 390×844** | home | OK — hero is tall but Craft+Practice visible, utilities below fold (acceptable scroll). |
| **Phone 390×844** | play / reward | Good — `.play-body` "safe center" keeps prompt+tiles framed; reward CTA stack fits. |
| **Small Android 360×740** | home | **Top-heavy** — hero eats ~55–60%; only Craft + tops of two cards above fold. |
| **Phone landscape 844×390** | **home** | **Broken-feeling** — only title + streak chips + top edge of Craft card visible; **no menu card reachable** without scrolling. |
| **Phone landscape 844×390** | **wave reward** | **Primary actions below fold** — header + trophy + "Wave complete!" + gem count fill the viewport; Craft/Keep/Progress/Home buttons require a scroll (**measured +213px overflow**). |
| **Phone landscape 844×390** | rhythm play | "Hear it again" prompt is top-clipped and only the **top row** of the 2×2 tiles shows; bottom row below fold. |

**This is the report's top fix.** The known weak spots in QA.md (top-heaviness, fold position, voids)
are all real and all concentrated in **landscape** and **short portrait**. The hero is the culprit:
on a 390px-tall landscape viewport, the title + welcome + streak/quest chips + goal bar simply don't
leave room for the action surface. The phone media query handles *narrow* but not *short*.

**Concrete remedies (free):**
- Add an **`@media (orientation: landscape) and (max-height: 480px)`** branch that: hides or
  one-lines the home title, collapses the streak/quest chips into a single compact row, and shrinks
  the hero padding — so at least the Craft hero + Practice banner are above the fold.
- On the **reward/boss/geode** screens in short viewports, pin the action-button row to the bottom
  (sticky, like the onboarding `.level-cta` already does) so the primary CTA is never below the fold.
- For **rhythm in landscape**, consider a 1×4 (or 4×1 side) tile layout, or guarantee the answer zone
  height so the full option set is visible without scrolling.
- Re-run the project's `qa_responsive.mjs` *plus a short-height landscape case* and re-check the OS
  Largest-font scenario.

There are **no horizontal-overflow problems** (consistent with the project's 0-overflow bar); the
issues are purely *vertical* fold/void problems that the automated overflow check can't catch — which
is exactly why QA.md mandates the interactive visual pass.

---

## 7. Benchmark table

Dimensions scored relative to category best-in-class (✅ strong / ➖ adequate / ⚠️ weak).

| Dimension | Crystal Spell Caverns | Duolingo ABC | Khan Academy Kids | Teach Your Monster | Endless Alphabet |
|---|---|---|---|---|---|
| **Theme/world coherence** | ✅ Cavern metaphor carried systemically | ✅ Owl + 3-shape system | ✅ Warm animal cast | ✅ Custom monster + island map | ✅ Monsters + personified letters |
| **Mascot expressiveness** | ⚠️ Static CSS hexagon, non-reactive | ✅ Duo reacts | ✅ Kodi cast | ✅ *Player-built* avatar | ✅ Reactive monsters |
| **Typography for weak/dyslexic readers** | ➖ Big & fluid, but Baloo 2 = low letter distinction; readable-mode thin | ➖ Custom display type | ➖ | ➖ | ➖ |
| **Gentle, low-anxiety error feedback** | ✅ Slate verdict, fade-wrong/spotlight-correct, no fail state | ✅ Forgiving | ✅ Encouraging | ✅ | ✅ "No failures/stress" |
| **Reward loop ethics** | ✅ Bounded daily geode, no money/FOMO/leaderboard | ✅ Book library | ✅ Animal prizes | ✅ Monster accessories | ✅ Narrative-only |
| **Pedagogical integrity (production-led)** | ✅ CRAFT = mastery; spacing/interleaving; anti-imprinting | ➖ Phonics recognition | ➖ | ➖ | ➖ Meaning-led |
| **Onboarding & personalization** | ✅ Name + colour + level, mascot-guided | ✅ Name woven in | ✅ | ✅ Avatar design | ➖ |
| **Responsive across devices** | ⚠️ Great on iPad; landscape/short-phone break | n/a (native) | n/a | ➖ (web; fine-motor nav) | n/a (native) |
| **Asset richness** | ⚠️ Emoji + procedural; locked items identical | ✅ Bespoke art | ✅ Bespoke | ✅ Bespoke | ✅ Bespoke |
| **Cost/trust (free, ad-free, no dark patterns)** | ✅ Free, offline, COPPA-minded | ✅ Free+ad-free | ✅ Free+ad-free | ✅ Free (web) | ➖ Paid |
| **Anti-example** | — | — | — | — | *Prodigy* = FTC-flagged upsell/shaming (the trap this app avoids) |

**Takeaways.** On *pedagogy, error tone, and reward ethics* Crystal Spell Caverns is at or above the
best-in-class set — and it pointedly avoids the Prodigy dark-pattern trap (no membership envy, no
upsell, no FOMO). It trails the funded apps only where money buys things a hobby PWA can't easily
match: **bespoke, reactive character art and richer asset variety**, and it trails *itself* on
**cross-device layout** (landscape/short phone) and on **dyslexia-grade typography** — the two
gaps that are cheapest to close.

---

## 8. Prioritized recommendations

Ranked by impact × effort. Effort: **S** ≈ hours, **M** ≈ a day or two, **L** ≈ multi-day / needs
assets. "Cost" calls out anything beyond engineering time.

### Free polish we can do now (no assets/budget)

| # | Recommendation | Impact | Effort | Concrete change |
|---|---|---|---|---|
| 1 | **Landscape + short-phone hero collapse** | ★★★★★ | S–M | Add `@media (orientation:landscape) and (max-height:480px)` (and a `max-height` portrait branch): one-line/hide `.home-title`, collapse `.home-streak` chips to one compact row, cut hero padding — get Craft + Practice above the fold. |
| 2 | **Pin reward/boss/geode CTA in short viewports** | ★★★★★ | S | Make the action-button row `position: sticky; bottom` (reuse the `.level-cta` pattern) so "Craft / Keep / Home" is never below the fold (fixes the +213px landscape overflow). |
| 3 | **Switch UI/spelling font to Atkinson Hyperlegible / Inter** | ★★★★☆ | S–M | Self-host the woff2 (free, SIL OFL) in `/fonts`, swap the `body` stack; keep Baloo 2 only for the decorative title. Precache in `sw.js`, bump version. |
| 4 | **Fix two below-AA contrast spots** | ★★★☆☆ | S | Darken the Craft hero gradient's pink end ~10–15% (or add a 1px text-shadow/scrim under `.desc`); lift the slate wrong-subtext one step (e.g. `#8593a3`) — still calm, now ≥4.5:1. |
| 5 | **Upgrade "Easy-read text" → full dyslexia mode** | ★★★★☆ | M | Global 1.5 line-height + ~0.35× tracking on text, optional off-white reading surface, left-align the dictated sentence. Keep it a toggle. |
| 6 | **Make Geo reactive** | ★★★☆☆ | M | Add 2–3 CSS expression states (cheer on combo, "thinking" on idle, wink on milestone) — pure CSS classes on the existing hexagon; cheap engagement win. |
| 7 | **Center/justify the onboarding & lab voids** | ★★☆☆☆ | S | Vertically center the mascot block (`safe center` already used elsewhere) or add a faint drifting-gem particle layer so the lower half reads as deliberate. |
| 8 | **Slim child-facing Settings** | ★★☆☆☆ | S–M | Put advanced levers + time-machine + parent password behind the existing parent gate by default; child Settings = level, difficulty, voice, length only. |
| 9 | **Re-tune youngest-tier recognition** | ★★★☆☆ | S | Fewer options + shorter misspelling dwell time for tiers 1–2 to further limit imprinting exposure. |
| 10 | **Add a short-height landscape case to `qa_responsive.mjs`** | ★★☆☆☆ | S | Lock in the §6 fixes so they can't regress. |

### Needs assets / budget

| # | Recommendation | Impact | Effort | Cost |
|---|---|---|---|---|
| A | **Distinct locked-mineral art** (24 silhouettes/tints, not one grey hexagon) | ★★★★☆ | M–L | Free if extended procedurally (per-mineral SVG shape/hue seed); or a **small icon/asset pack (~$30–150)** or a one-off illustration commission. |
| B | **Bespoke reactive mascot illustration set** (Geo with a handful of poses) | ★★★☆☆ | L | Illustration commission (**~$200–800** for a small expressive set) — optional; the CSS-reactive version (#6) captures most of the value for free. |
| C | **Real-voice audio completion** (722/2949 clips done) | ★★★☆☆ | — | Paid Gemini TTS quota (project notes ~**$1–3 one-time** with billing on). *User-gated per the standing approval rule; device voice already covers the gap.* |
| D | **Optional self-hosted OpenDyslexic toggle** | ★★☆☆☆ | S | Free font; offer as an *option only* (not default, not marketed as evidence-based). |

---

## Appendix — Evidence

### Screenshots I captured (this review)
Capture script: `C:\Users\iango\spell\scripts\design_qa.mjs` (writes to the dir below).
Directory: `C:\Users\iango\spell\scripts\qa\design\`

Phone (390×844): `phone-01-onb-welcome.png` … `phone-16-settings-bottom.png`
(onboarding, play question/correct-verdict/wrong-reveal, reward, home, catalog, catalog-detail,
progress top/bottom, settings top/bottom).
Tablet (820×1180): `tablet-01-…` … `tablet-16-…` (same flow; the design target).
Landscape (844×390): `land-01-…` … `land-16-…` — note `land-09-play-reward-or-boss.png`
recorded **+213px vertical overflow** and `land-10-home.png` shows the no-card-above-fold problem.
Console/page errors across all three passes: **0**.

### Pre-existing screenshots reviewed (not re-shot)
`C:\Users\iango\spell\scripts\qa\` — `01–05` onboarding, `06-home`, `07-rhythm-question`,
`08-rhythm-correct-verdict`, `09-rhythm-wrong-reveal` (anti-imprinting dim-out), `10-rhythm-reward`,
`11–13` puzzle (build-the-word), `14–19` lab (invent/spell/draw/name), `20-progress`, `21-settings`,
`22-feedback`.
`C:\Users\iango\spell\scripts\qa\res\` — per-device matrix (iPad, iPhone SE/13/Max, Pixel 7,
small Android, iPhone landscape) for home/onboard-levels/progress/puzzle/rhythm/settings. The
`iphone-se-home`, `android-sm-home`, and `iphone-land-*` shots corroborate the §6 top-heaviness.

### Contrast measurement
Computed with the WCAG relative-luminance formula from the CSS color tokens (see §2.1 table).

### Key sources cited
- **WCAG 2.2** — Contrast Minimum 1.4.3 (4.5:1 / 3:1 large): https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html · Enhanced 1.4.6 (7:1): https://www.w3.org/WAI/WCAG22/Understanding/contrast-enhanced.html · Non-text 1.4.11 (3:1): https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html · Target Size Min 2.5.8 (24px): https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html · Enhanced 2.5.5 (44px): https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html · Animation 2.3.3: https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html · Reflow 1.4.10: https://www.w3.org/WAI/WCAG22/Understanding/reflow.html
- **NN/g — Design for Kids by Stage of Physical Development** (~2cm targets, precise-drag-is-hard, age bands): https://www.nngroup.com/articles/children-ux-physical-development/ · Error-message guidelines: https://www.nngroup.com/articles/error-message-guidelines/ · Progressive disclosure: https://www.nngroup.com/videos/progressive-disclosure/
- **Apple HIG** — Layout/safe area (44pt, safe-area): https://developer.apple.com/design/human-interface-guidelines/layout · Playing haptics: https://developer.apple.com/design/human-interface-guidelines/playing-haptics
- **Material** — touch target 48dp: https://m1.material.io/usability/accessibility.html ; https://support.google.com/accessibility/android/answer/7101858
- **British Dyslexia Association Style Guide 2023** (sans-serif, 12–14pt, 1.5 line, tracking, no italics/all-caps/justify, off-white): https://cdn.bdadyslexia.org.uk/uploads/documents/Advice/style-guide/BDA-Style-Guide-2023.pdf
- **Lexend** (spacing/scaling readability): https://www.lexend.com/ · **Atkinson Hyperlegible** (letter distinction): https://www.brailleinstitute.org/freefont/ ; https://fonts.google.com/specimen/Atkinson+Hyperlegible · **Inter**: https://fonts.google.com/specimen/Inter
- **Special-font evidence (no benefit)** — Rello & Baeza-Yates 2013: https://www.researchgate.net/publication/262320823_Good_fonts_for_dyslexia · Wery & Diliberto 2017: https://pubmed.ncbi.nlm.nih.gov/26993270/ · Kuster et al. 2018: https://pmc.ncbi.nlm.nih.gov/articles/PMC5934461/ · IDA: https://dyslexiaida.org/do-special-fonts-help-people-with-dyslexia/
- **Praise / mindset** — Mueller & Dweck 1998: https://pubmed.ncbi.nlm.nih.gov/9686450/
- **Misspelling-imprinting / negative suggestion** — Brown 1988: https://eric.ed.gov/?id=EJ389959 · Jacoby & Hollingshead 1990: https://www.larryjacoby.ca/images/spelling.pdf
- **Comparators** — Duolingo ABC: https://www.commonsensemedia.org/app-reviews/duolingo-abc-learn-to-read ; Duolingo design (color/shape): https://design.duolingo.com/identity/color · Khan Academy Kids: https://www.commonsensemedia.org/app-reviews/khan-academy-kids · Teach Your Monster: https://www.teachyourmonster.org/teach-your-monster-to-read-overview/ · Lingokids: https://lingokids.com/lingokids-universe · Endless Alphabet: https://www.originatorkids.com/endless-alphabet/ · Osmo Words: https://www.playosmo.com/products/genius-words
- **Reward ethics / dark patterns** — Fairplay vs. Prodigy (FTC complaint): https://fairplayforkids.org/feb-19-2021-advocates-to-ftc-prodigy-math-game-preys-on-kids-and-families/ · FTC "Bringing Dark Patterns to Light" 2022: https://www.ftc.gov/system/files/ftc_gov/pdf/P214800+Dark+Patterns+Report+9.14.2022+-+FINAL.pdf · AAP Family Media Plan: https://www.healthychildren.org/English/family-life/Media/Pages/How-to-Make-a-Family-Media-Use-Plan.aspx
- **PWA / mobile feel** — safe-area `env()`: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/env ; https://polypane.app/blog/using-safe-area-inset-to-build-mobile-safe-layouts/ · Thumb zones: https://www.smashingmagazine.com/2016/09/the-thumb-zone-designing-for-mobile-users/ · Web App Manifest / display modes: https://web.dev/learn/pwa/web-app-manifest

*Sourcing caveats: Apple HIG / Material m3 pages are JS-rendered (figures cross-checked via static
mirrors and Android accessibility docs); the BDA site blocks automated fetch (numbers read from the
BDA-hosted PDF); the Duolingo "~15% chest lift" is analyst-reported, not first-party.*
