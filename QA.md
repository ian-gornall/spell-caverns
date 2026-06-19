# QA process — Crystal Spell Caverns

**Read this before shipping any major change (especially UI).** The app is built/tuned at
iPad proportions but is used on **phones** (installed PWA) and tablets. Numeric/scripted
checks alone miss "jank" — oversized text, top-heavy layouts, content shoved below the fold,
empty voids. So QA here is **interactive and visual**, not just assertions.

There are two layers. Do **both** before a major ship.

---

## 1. Automated checks (fast, every change)

```bash
npm test                      # node --test — the pure engine (must be green)
npm run smoke                 # Playwright end-to-end: every mode + screen renders & plays
node scripts/qa.mjs           # 0 console / JS / network errors, screenshots to scripts/qa/
node scripts/qa_responsive.mjs  # horizontal-overflow check at 7 viewports (360–820px)
```

`qa_responsive.mjs` flags horizontal overflow + any element wider than the viewport across
iPhone SE/13/Max, Pixel, small Android, iPad portrait, and phone landscape. **0 overflow at
every resolution** is the bar. (It cannot judge vertical layout/jank — that's layer 2.)

`npm start` must be running (port 5173) for the Playwright scripts.

---

## 2. Interactive exploratory QA (the important one, before MAJOR changes)

**Drive the app like a real user, and LOOK at every step before deciding the next.** The loop
is: **act → screenshot → _view the screenshot_ → take a note → decide the next action.** Not
"fire 20 screenshots then skim." If you didn't look at it, you didn't test it.

### The live session harness

A long-lived browser whose page state PERSISTS between commands, so you navigate around like a
human instead of re-running a batch:

```bash
# 1. start the dev server + the persistent phone-sized browser (CDP on :9222)
node server.js &                       # port 5173
DEV=iphone13 node scripts/qa_session.mjs &   # DEV = iphone13 | small | big

# 2. drive it ONE step at a time; each call screenshots to scripts/qa/live/ and prints
#    route + horizontal + inner-scroll measurements. VIEW the PNG before the next step.
node scripts/qa_do.mjs <name> <action> [arg]
#   actions: goto · click <regex> · fill <text> · tap <css> · tapword · build ·
#            scroll <0..1|bottom> · seed · eval <js> · shot
```

Example loop (read each screenshot between calls):

```bash
node scripts/qa_do.mjs 01-home   eval "localStorage.clear(); location.reload()"
# → Read scripts/qa/live/NN-01-home.png, note anything off, THEN:
node scripts/qa_do.mjs 02-name   click "let.?s go"
node scripts/qa_do.mjs 03-colour fill "Leo"
# … etc.
```

`scripts/qa_explore.mjs` is a non-interactive scripted playthrough (handy for a quick batch
of viewport screenshots across a whole flow); `qa_session.mjs`+`qa_do.mjs` is the real
interactive loop. Use the interactive loop for anything you're actually debugging.

### What to actually look for (jank, not just overflow)

- **Fold position** — on a phone, is the primary action / most content visible without a
  hunt-scroll? (We tune at iPad size, so hero/headers are often too tall on phones.)
- **Top-heaviness** — title/header/hero eating a big fraction of a short screen.
- **Sizing** — `rem`-based text/icons that are fine on iPad but oversized on a phone.
- **Cut-offs** — content clipped at the right edge or under the (simulated) notch.
- **Voids** — large empty gaps that read as broken rather than deliberate framing.
- **Dynamic states** — verdict flashes, mid-build, wave-complete, boss — not just idle.

### Device matrix to walk

- **Phone portrait:** 360×740 (small Android) and 390×844 (iPhone 13) — the tight cases.
- **Phone landscape:** 844×390.
- **Tablet:** 820×1180 (the design target — confirm nothing regressed).
- **Large system font:** re-check key screens with `document.documentElement.style.fontSize`
  bumped to 20–24px (Android "Font size: Large/Largest" scales rem layouts).

### Known limitation (be honest about it)

Headless Chromium on Windows **cannot reproduce iOS/Android _standalone_ rendering** — the
notch / safe-area insets, the home-gesture bar, or real Safari/Chrome quirks. `#app` pads with
`env(safe-area-inset-*)` + `viewport-fit=cover`, but if a device-specific issue is reported,
**ask for a screenshot from the actual phone** — that class of bug can't be reproduced here.

---

## 3. CSS gotcha that bit us (remember this)

Phone overrides live in **one `@media (max-width: 480px)` block at the END of `styles.css`**.
A media query adds **no specificity**, so source order decides: an override placed before the
base rule it's trying to beat will silently lose. Keep phone overrides last.

---

## 4. Versioning on every ship

Bump **both** `sw.js` `VERSION` and `src/version.js` `APP_VERSION` to the same `csc-vNN`
whenever a precached file changes. Settings → Parents & privacy shows the running code version
and the active SW cache version; a mismatch means an update is pending. After deploy, poll the
live `sw.js`/`src/version.js` to confirm the new version is serving.
