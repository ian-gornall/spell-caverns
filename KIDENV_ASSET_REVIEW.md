# KIDENV Asset Review for Crystal Spell Caverns (§26-B)

**Date:** 2026-06-20  
**Scope:** Read-only inventory of `C:\Users\iango\kidenv` — what exists there and whether Crystal Spell Caverns can reuse it.  
**Author:** Automated §26-B review pass.

---

## Executive Summary

- **The design-token system in `template/styles.css` is the highest-value find.** It is a complete, battle-tested CSS custom-property foundation (spacing, type scale, breakpoints, touch targets, color) built for the same kid/phone-first use-case as Crystal Spell Caverns. Several specific token values should be adopted verbatim for the §34 phone-proportions pass.
- **`gemgrid` has a directly relevant dark-cavern/gem visual theme** — deep-space dark background, gold accents, CSS gem shapes with glow — and its star-field CSS background technique is directly transplantable.
- **The shared `guides/phaser/assets/ofl/` font library** contains 7 redistributable (OFL) kid-legible typefaces, notably **Fredoka** (rounded, chunky, recommended as the top kid-heading pick) and **Nunito** (rounded body text), both variable-axis TTFs with clean OFL licences.
- **CC0 audio** (Kenney, via `guides/phaser/assets/cc0/audio/`) includes music jingles (NES/Hit/Pizzicato/Sax/Steel stingers) and sfx sets; per-app audio in `apps/*/assets/game/audio/` has correct/wrong/win/level-up clips. All Kenney: CC0, no attribution required.
- **Particle textures** (`circle_05.png`, `star_05.png`, `spark_0x.png`, `magic_04.png`) appear in all apps. Kenney CC0. Useful for gem-burst FX.
- **No pre-made fantasy/crystal/cave art exists** in kidenv. All sprite art is space-themed (spaceships, lasers, aliens, shooting-gallery ducks). CSS-only gem shapes in `gemgrid` are the closest thematic match.

---

## 1. Design Tokens (HIGHEST PRIORITY for §34)

### Source: `C:\Users\iango\kidenv\template\styles.css`

This is the canonical kidenv design system. Every app copies it verbatim and theme-overrides on top. The entire `:root` block and the landscape `@media (max-height: 480px)` block are directly relevant to §34 phone-proportions.

#### 1a. Spacing tokens

```css
--gap:  clamp(0.75rem, 2.5vw, 1.25rem);   /* stack/row gap; fluid 12–20px */
--pad:  clamp(1rem, 4vw, 2rem);            /* card / page padding; fluid 16–32px */
```

The landscape (short-viewport) override tightens these significantly:

```css
@media (max-height: 480px) {
  --pad: clamp(0.6rem, 2.5vw, 1rem);    /* tightened to 9.6–16px */
  --gap: clamp(0.4rem, 1.6vw, 0.8rem);  /* tightened to 6.4–12.8px */
}
```

**Recommendation for §34:** Adopt `--gap` and `--pad` naming and clamp ranges as Crystal Spell Caverns currently uses hardcoded pixel or %-based margins. The vw-anchored clamp keeps spacing proportional on all phone widths (320px → 430px). Also adopt the `max-height: 480px` landscape tightening pattern.

#### 1b. Type scale

```css
/* Base body copy */
font: clamp(16px, 2.4vw, 19px)/1.5 var(--font);

/* Headings */
h1 { font-size: clamp(2rem, 7vw, 3.25rem); line-height: 1.1; }
h2 { font-size: clamp(1.3rem, 4.5vw, 1.9rem); }

/* Landscape override */
@media (max-height: 480px) {
  h1 { font-size: clamp(1.4rem, 5vh, 2rem); }   /* switches to vh so portrait tall phones unaffected */
  .lead { font-size: 1em; }
}
```

**Recommendation for §34:** Crystal Spell Caverns uses mostly fixed `px` or `em` font sizes. The `clamp(16px, 2.4vw, 19px)` base and `clamp(2rem, 7vw, 3.25rem)` h1 are well-tuned for 360–430px phone widths. Adopt or use as a calibration reference. The h1 landscape override to `5vh` is a strong pattern — at `390×844` it gives ~42px; at landscape `844×390` it gives ~19.5px, fitting the condensed layout.

**Note for §34 specifically:** `gemgrid` overrides the body base slightly lower for a denser game layout: `clamp(14px, 2.2vw, 17px)`. Crystal Spell Caverns is a learning app, not a dense game UI, so the template's `16–19px` is the better reference.

#### 1c. Touch targets

```css
--tap-min:     64px;                       /* every interactive element minimum */
--tap-primary: clamp(72px, 11vh, 104px);   /* hero buttons (Start, Craft, etc.) */
```

The landscape override collapses `--tap-primary` to `64px` (still meets `--tap-min`):

```css
@media (max-height: 480px) {
  --tap-primary: 64px;
}
```

**Recommendation for §34:** Crystal Spell Caverns **already defines `--tap-min: 64px`** in its `:root` (styles.css) — it matches kidenv's stricter "kid hands" standard, so no change is needed here. (The 44px value that appears in CSC is a *local* `min-height` on the secondary `.btn.ghost` Hint/Clear controls inside the `≤480px` phone block, not the root token.) The token worth ADDING is `--tap-primary: clamp(72px, 11vh, 104px)` for hero buttons — at 844px viewport height it gives 92.8px (great); at 667px (iPhone SE) it gives 73.4px (still solid).

#### 1d. Shape tokens

```css
--radius:    18px;
--radius-lg: 28px;
--shadow:    0 6px 20px rgba(40, 20, 90, 0.12);
--shadow-lg: 0 14px 40px rgba(40, 20, 90, 0.20);
```

Crystal Spell Caverns uses similar radius values; these are a direct match. The template shadow uses a purple-tinted base (good for dark crystal themes). `gemgrid` darkens the shadow to `rgba(0,0,0,0.5/0.65)` which suits the dark canvas better.

#### 1e. Layout column width

```css
.app { width: min(36rem, 100%); }          /* portrait — 576px max, then full-width */

@media (max-height: 480px) {
  .app { width: min(52rem, 100%); }        /* landscape — wider column uses extra screen real estate */
}
```

**Recommendation for §34:** Crystal Spell Caverns already constrains content width. The `min(36rem, 100%)` → `min(52rem, 100%)` landscape shift is worth adopting — it prevents the landscape layout being a squeezed portrait clone.

#### 1f. Breakpoints present in kidenv apps

The kidenv design system is notably `max-height`-first for its primary responsive breakpoint, not `max-width`. Width-based breakpoints appear in per-app game layouts:

| Query | App | Purpose |
|---|---|---|
| `max-height: 480px` | template, all apps | Landscape phone tightening (primary system breakpoint) |
| `max-width: 480px` | mathblast (HUD compress) | Narrow phone HUD compress |
| `max-width: 360px` | mathblast | Very small phone — hide non-critical HUD elements |
| `max-width: 320px` | mathblast | Minimum-size override |
| `min-width: 420px` | gemgrid | Grid column expansion (3→4 cols) |
| `min-width: 560px` | gemgrid | Grid column expansion (4→5 cols) |
| `max-height: 480px and orientation: landscape` | mathblast | Landscape + short combined guard |

**Recommendation for §34:** The `max-height: 480px` hook is the system's standard landscape-phone trigger. Consider adding `@media (max-width: 390px)` as a secondary breakpoint for small-portrait phones (iPhone SE physical = 375px; many Androids = 360px) in addition to the existing `700px` breakpoint Crystal Spell Caverns already uses.

#### 1g. Safe-area / notch handling pattern

```css
body {
  padding:
    max(var(--pad), env(safe-area-inset-top))
    max(var(--pad), env(safe-area-inset-right))
    max(var(--pad), env(safe-area-inset-bottom))
    max(var(--pad), env(safe-area-inset-left));
}
```

**Recommendation for §34:** Adopt verbatim. Crystal Spell Caverns currently has partial safe-area handling; this `max(pad, inset)` pattern is the correct idiom (guarantees at least `--pad` but expands to inset when the notch is larger).

**Per-token summary table:**

| Token | Value | §34 recommendation |
|---|---|---|
| `--gap` | `clamp(0.75rem, 2.5vw, 1.25rem)` | **Adopt** — fluid phone spacing |
| `--pad` | `clamp(1rem, 4vw, 2rem)` | **Adopt** |
| `--gap` landscape override | `clamp(0.4rem, 1.6vw, 0.8rem)` | **Adopt** |
| `--pad` landscape override | `clamp(0.6rem, 2.5vw, 1rem)` | **Adopt** |
| `--tap-min` | `64px` | Already matches — CSC `:root` is already `64px` (no change) |
| `--tap-primary` | `clamp(72px, 11vh, 104px)` | **Adopt** |
| `--tap-primary` landscape override | `64px` | **Adopt** |
| `body font-size` | `clamp(16px, 2.4vw, 19px)` | **Reference** (calibrate against Atkinson Hyperlegible sizes) |
| `h1` | `clamp(2rem, 7vw, 3.25rem)` | **Reference** |
| `h1` landscape | `clamp(1.4rem, 5vh, 2rem)` | **Adopt** — vh-based is the correct axis for landscape |
| `--radius` | `18px` | Reference only (CSC already uses similar) |
| `--radius-lg` | `28px` | Reference only |
| `max-height: 480px` breakpoint | landscape hook | **Adopt** |
| safe-area `max(pad, inset)` | body padding pattern | **Adopt** |
| `.app width` landscape | `min(52rem, 100%)` | **Adopt** |

---

## 2. Art / Images

| Asset | Location | Format | Licence / Source | Fit for CSC | Recommendation |
|---|---|---|---|---|---|
| `simpleSpace_sheet.png` + `.xml` | `apps/alien-math-blaster/assets/game/sprites/`, `apps/mathzap/assets/game/sprites/` | PNG atlas (Kenney XML) | CC0 — Kenney "Simple Space" | Poor — space ships / alien ships, sci-fi, no gem/cave theme | Skip |
| `spritesheet_spaceships.png` + `.xml` | `apps/alien-math-blaster/`, `apps/mathzap/` | PNG atlas (Kenney XML) | CC0 — Kenney | Poor — space ships | Skip |
| `spritesheet_lasers.png` + `.xml` | `apps/mathzap/assets/game/sprites/` | PNG atlas (Kenney XML) | CC0 — Kenney | Poor — laser weapons | Skip |
| `spritesheet_objects.png` + `.xml` | `apps/phaserstarter/assets/game/sprites/` | PNG atlas (Kenney XML) | CC0 — Kenney "Shooting Gallery" | Poor — shooting gallery ducks/targets | Skip |
| `circle_05.png` | All apps' `assets/game/particles/` | PNG, ~256px, transparent | CC0 — Kenney "Particle Pack" | Good — generic particle; usable for gem-burst | Maybe — copy from `apps/gemgrid/assets/game/particles/` if particle FX needed |
| `star_05.png` | All apps' `assets/game/particles/` | PNG, ~256px, transparent | CC0 — Kenney "Particle Pack" | Good — star sparkle particle; fits "crystal" twinkle FX | Maybe — same as above |
| `magic_04.png` | `apps/gemgrid/assets/game/particles/` | PNG, transparent | CC0 — Kenney "Particle Pack" | Good — magic/sparkle texture; fits gem-glow FX well | **Recommended** if adding particle bursts for correct-word celebrations |
| `spark_06.png`, `spark_07.png` | `apps/alien-math-blaster/`, `apps/mathzap/` particles | PNG, transparent | CC0 — Kenney "Particle Pack" | Good — generic spark | Maybe |
| CSS gem shapes (`.gem-visual`, `.tier-*`) | `apps/gemgrid/styles.css` lines 440–501 | Pure CSS (clip-path polygon, CSS custom properties) | No licence needed — hand-written CSS | **Good** — 20 gem tiers with `--gem-color`/`--gem-dark`/`--gem-shine` CSS vars, glow filter, float animation; directly on-theme | **Recommended** — copy the `.gem-visual` CSS pattern and tier color table |
| CSS star-field background | `apps/gemgrid/styles.css` lines 843–863 | Pure CSS (`radial-gradient` dots on `::before`) | No licence needed | **Good** — static star dots pattern, fits cave/space ambience | **Recommended** for adding a subtle background texture to any dark CSC screen |
| CSS rocket illustration | `apps/mathblast/styles.css` (`.logo-rocket`, `.rocket-body`, `.rocket-flame`) | Pure CSS shapes | No licence needed | Poor — space rocket theme | Skip |

**Note:** There are no illustrations, character art, background images, or SVG decorative assets in kidenv. All art is either Kenney sprites (space-themed, Phaser-rendered) or CSS-only. The `gemgrid` CSS gem shapes are the only art that fits Crystal Spell Caverns' gem/crystal theme.

---

## 3. Icons

| Asset | Location | Format | Licence | Fit | Recommendation |
|---|---|---|---|---|---|
| Kenney "Game Icons" (star, heart, gear, pause…) | `guides/phaser/assets/cc0/ui/game-icons/` | Individual PNGs, 1x/2x | CC0 — Kenney | Maybe — generic HUD icons (heart/star/gear could fit CSC settings) | Reference only; CSC uses emoji icons; switch only if a specific icon is needed |
| Kenney "Input Prompts" (tap, drag, hold glyphs) | `guides/phaser/assets/cc0/ui/input-prompts/` | Individual PNGs | CC0 — Kenney | Maybe — tap/hold glyphs for onboarding hints | Reference only |
| Kenney "UI Pack" (buttons/panels in 6 themes) | `guides/phaser/assets/cc0/ui/ui-pack/` | Individual PNGs + UI font | CC0 — Kenney | Poor — styled for in-canvas Phaser UI, not DOM | Skip |
| No PWA/favicon icons exist in kidenv | — | — | — | — | CSC already has its own PWA icons; nothing to take |

---

## 4. Fonts

| Font | Location | Format | Licence | Vibe | Fit for CSC | Recommendation |
|---|---|---|---|---|---|---|
| **Fredoka** (variable) | `guides/phaser/assets/ofl/fredoka/Fredoka-wdth-wght.ttf` | TTF variable, 159 KB | OFL — Google Fonts | Rounded, chunky, friendly; ASSETS.md marks as "top pick for kid UI/headings" | **Good** — rounded letterforms aid readability for kids; complementary to Atkinson Hyperlegible (could use Fredoka for display/headings, Atkinson for body) | **Recommended** for §34 — test as heading/CTA font |
| **Nunito** (variable) | `guides/phaser/assets/ofl/nunito/Nunito-wght.ttf` | TTF variable, 277 KB | OFL — Google Fonts | Rounded body text | Good — dyslexia-adjacent rounded terminal letters; similar philosophy to Atkinson | Reference — CSC already has Atkinson; Nunito is a plausible alternative/pairing but not an upgrade |
| **Quicksand** (variable) | `guides/phaser/assets/ofl/quicksand/Quicksand-wght.ttf` | TTF variable, 125 KB | OFL — Google Fonts | Geometric rounded | Maybe | Reference only |
| **Comic Neue** (6 weights) | `guides/phaser/assets/ofl/comicneue/ComicNeue-*.ttf` | Static TTFs, ~55 KB each | OFL — Google Fonts | Clean comic book style | Maybe — Comic Sans descendant without the stigma | Reference only |
| **Baloo 2** (variable) | `guides/phaser/assets/ofl/baloo2/Baloo2-wght.ttf` | TTF variable, 683 KB | OFL — Google Fonts | Thick rounded display | Maybe — very bold/chunky | Reference only; large file weight |
| **Bubblegum Sans** | `guides/phaser/assets/ofl/bubblegumsans/BubblegumSans-Regular.ttf` | Static TTF, 38 KB | OFL — Google Fonts | Playful display, very small file | Maybe — compact and playful | Reference only |
| **Patrick Hand** | `guides/phaser/assets/ofl/patrickhand/PatrickHand-Regular.ttf` | Static TTF, 215 KB | OFL — Google Fonts | Handwritten feel | Poor for CSC — handwriting style clashes with a precision-spelling app | Skip |
| **Kenney Future** TTF | `apps/phaserstarter/assets/game/fonts/KenneyFuture.ttf` | TTF | CC0 — Kenney | Pixel/retro | Poor — retro pixel style, not appropriate for a learning app | Skip |

**No font is currently bundled in Crystal Spell Caverns beyond the system-font stack.** CSC loads Atkinson Hyperlegible via CDN. The OFL fonts above are local TTF files that could be self-hosted. All are free, redistributable, no attribution required for OFL.

---

## 5. Audio

### Per-app audio (in `apps/*/assets/game/audio/`) — Kenney CC0, OGG format

| File | App | Use |
|---|---|---|
| `correct.ogg` | alien-math-blaster, mathzap | Correct-answer positive ding |
| `wrong.ogg` | alien-math-blaster, mathzap | Wrong-answer gentle negative |
| `win.ogg` | mathzap, phaserstarter | Win/success stinger |
| `wave-complete.ogg` | alien-math-blaster | Wave / level complete |
| `explode.ogg` | alien-math-blaster | Explosion SFX |
| `shoot.ogg` | alien-math-blaster | Shoot/fire SFX |
| `escape.ogg` | alien-math-blaster | Enemy-escaped negative |
| `streak.ogg` | alien-math-blaster | Streak/combo achievement |
| `laser.ogg` | mathzap | Laser fire SFX |
| `wave.ogg` | mathzap | New wave start |
| `coin.ogg` | gemgrid | Coin collect / reward |
| `levelup.ogg` | gemgrid | Level-up celebration |
| `merge.ogg` | gemgrid | Gem merge action |
| `place.ogg` | gemgrid | Gem placement |
| `select.ogg` | gemgrid | Selection |
| `click.ogg` | phaserstarter | UI click |
| `oops.ogg` | phaserstarter | Gentle error |
| `pop.ogg` | phaserstarter | Pop/bubble SFX |

**Fit for CSC:** `correct.ogg`, `wrong.ogg`, `win.ogg`, `coin.ogg`, `levelup.ogg`, `select.ogg`, `click.ogg`, `pop.ogg` could fill gaps. CSC already has Gemini-generated voice clips for words and some praise; these SFX could supplement non-voiced UI interactions. **Licence: CC0 (Kenney), no attribution required.**

### Shared library audio (`guides/phaser/assets/cc0/audio/`) — Kenney CC0

| Folder | Content |
|---|---|
| `music/music-jingles/Audio/8-Bit jingles/` | 17 NES-style short jingles (jingles_NES00–NES16.ogg) |
| `music/music-jingles/Audio/Hit jingles/` | 17 orchestral hit stingers (jingles_HIT00–HIT16.ogg) |
| `music/music-jingles/Audio/Pizzicato jingles/` | 17 playful pizzicato stingers |
| `music/music-jingles/Audio/Sax jingles/` | 17 jazzy sax stingers |
| `music/music-jingles/Audio/Steel jingles/` | 17 steel-drum stingers |
| `sfx/interface-sounds/` | UI: click, confirm, error, back, toggle |
| `sfx/impact-sounds/` | Hits, bumps, collisions |
| `sfx/digital-audio/` | Retro blips, zaps, powerups |
| `sfx/sci-fi-sounds/` | Lasers, space UI, engines |
| `sfx/rpg-audio/` | Footsteps, doors, coins, swings |
| `voice/voiceover-pack/` | Spoken numbers and words |

**Fit for CSC:** The `sfx/interface-sounds/` set (confirm, click, toggle, error) is directly usable for UI sounds to replace robotic TTS interface audio. The `voice/voiceover-pack/` contains **spoken numbers and words** — potentially useful as a supplementary voice source, though CSC already uses Gemini clips for spelling words. The music jingles are short stingers suited for level-complete and reward moments.

---

## 6. Animation Keyframes and CSS Patterns

Reusable CSS animation recipes found across kidenv apps (all hand-written, no licence concerns):

| Pattern | Source | Code location | Fit for CSC |
|---|---|---|---|
| `@keyframes pop` + `.pop` class | template, all apps | `template/styles.css` line 144–145 | **Adopt** — identical to or improvable over CSC's existing pop |
| `@keyframes float` (gentle Y hover) | gemgrid | `apps/gemgrid/styles.css` line 179–183 | **Recommended** — the 0→-4px Y-translate suits gem floating animations |
| `@keyframes glow-pulse` (box-shadow cycle) | gemgrid | `apps/gemgrid/styles.css` line 184–187 | **Recommended** — gem glow pulse directly on-theme |
| `@keyframes gem-float` + `.gem-visual` CSS gem | gemgrid | `apps/gemgrid/styles.css` lines 440–468 | **Recommended** — the full CSS gem + float + sparkle block |
| `.gem-visual::after` specular highlight | gemgrid | `apps/gemgrid/styles.css` lines 457–467 | **Recommended** — the `clip-path` specular dot trick |
| `@keyframes title-shimmer` (gradient background-position text shimmer) | gemgrid | `apps/gemgrid/styles.css` lines 225–229 | Maybe — gold/pink/purple gradient text shimmer suits CSC title |
| `@keyframes levelup-bounce` (spring scale + rotate entrance) | gemgrid | `apps/gemgrid/styles.css` lines 165–171 | Maybe — strong entrance for gem/word rewards |
| Star-field `::before` (CSS radial-gradient dots) | gemgrid | `apps/gemgrid/styles.css` lines 843–863 | **Recommended** — subtle background texture for dark CSC screens |
| `@keyframes sheet-in` (dialog slide-up) | template | `template/styles.css` lines 179–180 | **Reference** — CSC has its own dialog animation |
| `.segmented` / `.seg` (segmented control) | template | `template/styles.css` lines 211–217 | **Reference** — CSC uses custom tab UI |
| `.switch` toggle | template | `template/styles.css` lines 195–208 | **Reference** — CSC has its own toggles |
| Neon glow variables | mathblast, gemgrid | `--glow-green`, `--glow-blue`, `--glow-pink` | **Recommended** — CSC already uses `box-shadow` glows; formalise as named tokens |
| Gem tier color variables (20 tiers) | gemgrid | `apps/gemgrid/styles.css` lines 482–501 | **Recommended** — the `--gem-color/--gem-dark/--gem-shine` per-tier pattern is directly adoptable for CSC gem levels |

---

## 7. Recommended Next Actions (§34 Focus)

Listed in priority order for the §34 phone-proportions polish pass:

### Immediate — adopt into CSS (no file copy needed, values only)

1. **Add `--gap`, `--pad`, `--tap-primary` custom properties** to Crystal Spell Caverns' `:root` with the kidenv clamp values (`--tap-min: 64px` is **already** defined in CSC — leave it). Replace hardcoded spacing values with these tokens across `styles.css`. This is the single highest-leverage change for phone proportions.
   - `--gap: clamp(0.75rem, 2.5vw, 1.25rem)`
   - `--pad: clamp(1rem, 4vw, 2rem)`
   - `--tap-primary: clamp(72px, 11vh, 104px)`
   - (`--tap-min: 64px` — already present in CSC `:root`)

2. **Add the `@media (max-height: 480px)` landscape block** overriding `--pad`, `--gap`, `--tap-primary`, `h1` font-size, and `.app` width. Crystal Spell Caverns currently lacks this; it is the cause of landscape phone overflow/scroll issues.

3. **Adopt the `max(var(--pad), env(safe-area-inset-*))` body padding pattern** to correctly handle Dynamic Island / notch on iPad/iPhone without overcrowding on standard phones.

4. **Add `--tap-primary` landscape collapse to `64px`** so hero buttons shrink to minimum (not below) on landscape phones.

5. **Lift the h1 landscape size to `clamp(1.4rem, 5vh, 2rem)`** (switch to `vh` axis in landscape). CSC's current h1 uses `vw` which doesn't help in landscape because `vw` is large; `vh` correctly compresses with the short viewport height.

### Recommended — CSS snippets to copy (no licence, self-hosted CSS)

6. **Copy `.gem-visual` + tier colors from `apps/gemgrid/styles.css`** (lines 440–501) if CSC will add a pure-CSS gem illustration to any screen (reward states, craft confirmation). The 20-tier color table (`--gem-color`/`--gem-dark`/`--gem-shine`) maps directly to CSC gem levels.

7. **Copy the `body::before` star-field from `apps/gemgrid/styles.css`** (lines 843–863) as a background texture for dark CSC screens. It is pure CSS, zero performance cost, and adds ambient depth.

8. **Copy the `@keyframes glow-pulse` and `@keyframes float`** from gemgrid as named animation utilities in CSC's stylesheet.

### Maybe — evaluate during §34

9. **Fredoka variable font (`guides/phaser/assets/ofl/fredoka/Fredoka-wdth-wght.ttf`, 159 KB, OFL)** — test as a display/heading font paired with Atkinson Hyperlegible body text. Would give headings a rounder, more kid-friendly personality. Self-host directly; OFL allows this with no attribution required in UI. Note the 159 KB weight (a single WOFF2 conversion would reduce this further).

10. **Kenney SFX from `guides/phaser/assets/cc0/audio/sfx/interface-sounds/`** — consider for UI click/confirm/toggle sounds to replace robotic TTS interface feedback. CC0, no attribution, OGG format (already used in CSC via audio.js).

11. **`coin.ogg` and `levelup.ogg` from `apps/gemgrid/assets/game/audio/`** — these have a gem/collect register that fits CSC's gem reward moments better than the spelling-word audio. CC0 (Kenney). Worth auditioning.

### Skip

- All space/alien/laser/ship sprites — wrong theme entirely.
- Patrick Hand font — handwriting style inappropriate for a precision-spelling app.
- Kenney Future font — retro pixel, not appropriate.
- Tobu Tobu Girl art (CC-BY, Game-Boy sprites) — no fit.
- Endless Sky / Flare art (CC-BY-SA, space/RPG) — theme mismatch and copyleft.
- Unity/itch EULA assets — not redistributable.

---

## Appendix: Directory Structure

```
C:\Users\iango\kidenv\
  README.md                      — workspace overview
  HANDOFF.md
  template/                      — per-app skeleton (canonical CSS/HTML/JS)
    styles.css                   *** THE DESIGN SYSTEM — read this first ***
    DESIGN.md                    — design rules (13 non-negotiables)
    CHECKLIST.md                 — ship gate
  apps/
    alien-math-blaster/          — space math game (Phaser, space sprites/audio)
    gemgrid/                     — gem merge idle game (CSS gems, dark cave theme)
    mathblast/                   — DOM math game (aliens CSS only, space theme)
    mathvaders/                  — space invaders math variant
    mathzap/                     — laser math game (Phaser, space sprites)
    phaserstarter/               — template Phaser app
  guides/phaser/
    GUIDE.md                     — Phaser usage guide
    ASSETS.md                    — asset library index (read this for licence details)
    assets/
      cc0/                       — CC0 Kenney sprites, particles, audio, fonts
        audio/music/music-jingles/   — 5 styles × 17 stingers each (NES/Hit/Pizzicato/Sax/Steel)
        audio/sfx/               — interface, impact, digital, sci-fi, rpg SFX
        audio/voice/voiceover-pack/  — spoken numbers and words
        particles/particle-pack/ — star/circle/spark/magic/smoke textures
        sprites/                 — space, platformer, shooting-gallery, fish, alien, racing art
        ui/                      — game-icons, input-prompts, ui-pack
        fonts/kenney-fonts/      — pixel/retro TTFs (Kenney Pixel/Mini/Future/High/Blocks)
      ofl/                       — 7 kid-legible OFL fonts (Fredoka, Nunito, Quicksand, etc.)
      cc-by/                     — Tobu Tobu Girl sprites (attribution required)
      cc-by-sa/                  — Endless Sky + Flare art (copyleft share-alike)
  scripts/                       — new-app generator, improve-watch daemon
```

**Asset counts (non-QA-screenshot, non-node_modules):**
- CSS design-system files: 7 (1 canonical template + 1 per app)
- Audio files (OGG, in apps): 19 unique clips across 4 apps (+ deploy copies)
- Audio files (OGG, in shared CC0 library): ~85 jingles + full sfx/rpg/sci-fi sets
- Image/sprite files (in apps, non-QA): 14 unique images across 4 apps (+ deploy copies)
- Font files (OFL): 11 TTF files (7 families)
- Font files (CC0 Kenney): 1 TTF (KenneyFuture)
