# Crystal Spell Caverns — Design System

> **Canonical styling contract for the kid app AND the admin app.**
> Both must source every colour, font, radius, and shared component from here;
> neither hard-codes values or re-declares tokens. Last updated: 2026-06-23.
>
> Cross-references: `UX.md` (kid-UX rules — read it for target sizes, spacing,
> praise-tier colour meanings; not duplicated here), `ADMIN_APP.md` (admin spec).

---

## 1. Design tokens

All tokens are defined **once** in `styles.css` `:root`. Quoted values are verbatim
from that file. The admin app accesses them by linking the same `styles.css` (see §3).

### 1a. Praise-tier colours (semantic — same meaning everywhere)

| Token | Value | Meaning |
|---|---|---|
| `--gold` | `#ffd23f` | Perfect / best / treasure |
| `--cyan` | `#36f1cd` | Amazing |
| `--emerald` | `#7ae582` | Great |
| `--amethyst` | `#9d8df1` | Good |
| `--slate` | `#6c7a89` | Gentle "try again" (NOT an error red) |

These five tiers are the product's colour vocabulary. The same colour always
carries the same meaning — in praise, the mastery spectrum, progress bars, and
status indicators. The admin app reuses them for progress display (e.g. emerald
for "great accuracy", slate for "needs attention") — never inventing new meanings
for existing tier colours.

### 1b. Surface / structural colours

| Token | Value | Usage |
|---|---|---|
| `--bg-0` | `#070a1c` | Deepest background (gradient end) |
| `--bg-1` | `#0e1430` | Body background (gradient mid, measured baseline) |
| `--bg-2` | `#161d44` | Elevated surface background |
| `--panel` | `rgba(255,255,255,0.06)` | Panel / card fill (glass effect) |
| `--panel-border` | `rgba(150,180,255,0.18)` | Panel borders, dividers |
| `--ink` | `#eaf0ff` | Primary text (15.85:1 on `--bg-1` — AAA) |
| `--ink-dim` | `#9fb0d8` | Secondary / hint text (8.33:1 on `--bg-1` — AAA) |
| `--accent` | `#7aa2ff` | Interactive highlight; personalisation; links |

### 1c. Sizing tokens

| Token | Value | Usage |
|---|---|---|
| `--radius` | `22px` | Default border-radius for panels, cards, modals |
| `--tap-min` | `64px` | Kid minimum tap target (height of `.btn` and `.seg button`). Admin may relax — see §7. |
| base `font-size` | `18px` | `:root` font-size; `1rem = 18px` |

### 1d. Danger / destructive colour (gap filled by this document)

`styles.css` has **no `--danger` token**. The existing `.gate-err` uses the literal
`#ff9aa2` (a soft, desaturated rose — not alarm red, consistent with the no-harsh-
feedback tone). The admin app has destructive actions (Reset, Delete); it should
use the same rose as its danger colour rather than inventing a bright red that would
clash with the palette.

**`--danger` token: `#ff9aa2` — CONFIRMED (Ian 2026-06-23).** The existing `.gate-err`
rose, chosen for palette unity with the app's deliberately gentle, no-harsh-red tone
(destructive admin actions are guarded by the DANGER section + a confirm dialog +
auto-snapshot, so the colour need not shout).

**Where it lives — CONFIRMED:** added to `styles.css` `:root` as `--danger: #ff9aa2`
(single source of truth), and `.gate-err` is updated to `color: var(--danger)` (no
visual change — same value). The admin's `.btn.danger` (in `admin/admin.css`) and any
destructive element reference `var(--danger)` rather than a literal. This is the one
sanctioned edit to kid-app source — a zero-risk CSS custom-property addition.

---

## 2. Typography, spacing, and background

### 2a. Typeface stack

```css
font-family: "Atkinson Hyperlegible", "Quicksand", "Segoe UI Rounded", "Nunito",
             system-ui, -apple-system, sans-serif;
```

**Why Atkinson Hyperlegible leads:** purpose-built to maximise letter distinction
(I/l/1, 0/O, b/d/p/q) — the exact property a spelling task needs. Self-hosted as
`/fonts/atkinson-hyperlegible-400.woff2` and `...-700.woff2` with `font-display:swap`.
`UX.md §3` explains the rationale in full.

The admin app uses **the same font stack** (linked via the shared `styles.css`). This
is not a concession to kid-UX aesthetics; letter distinction is genuinely useful for
reading student names, word lists, and data. The rounded fallbacks keep the cavern
warmth on devices where the woff2 hasn't loaded yet.

**Exception:** the decorative `.home-title` re-asserts `"Baloo 2", "Quicksand"` for
character on the kid home screen only. Admin headings stay in Atkinson Hyperlegible.

### 2b. Scale and spacing

- Base `font-size: 18px` (`1rem = 18px`).
- Fluid sizes via `clamp()` throughout (e.g. sentence text `clamp(1.3rem,4.4vw,2rem)`).
- Standard vertical spacing between panels: `margin-bottom: 16px` (`.panel` default).
- The body background is a **fixed** three-layer gradient:
  ```css
  background:
    radial-gradient(1200px 800px at 50% -10%, #21306e 0%, transparent 60%),
    radial-gradient(900px 700px at 90% 110%, #2a1b54 0%, transparent 55%),
    linear-gradient(160deg, var(--bg-1), var(--bg-0));
  background-attachment: fixed;
  ```
  The admin page inherits this (linking `styles.css` gives it for free). It reads as
  the same product world — dark crystal cavern — on the admin side, which is intentional.

### 2c. Border-radius scale

| Context | Value |
|---|---|
| Panels, modals, cards (default) | `var(--radius)` = `22px` |
| Smaller UI elements (inputs, seg buttons) | `14px–16px` |
| Very small chips / pills | `999px` (full pill) |
| Overlay dialog boxes (`.gate-box`, `.pause-box`) | `20px–28px` |

---

## 3. Styling sharing mechanism (the anti-drift rule)

**Recommendation: the admin page links the same global `styles.css`.**

```html
<!-- admin/index.html -->
<link rel="stylesheet" href="/styles.css" />
<link rel="stylesheet" href="/admin/admin.css" />
```

`admin.css` contains only admin-specific additions (the data table, sortable
column headers, compact density overrides, the `≥720px` desktop layout). It never
re-declares a colour token or redefines a class that already exists in `styles.css`.

**Why this approach over alternatives:**

- _Extract tokens into `tokens.css`_: Would require splitting `styles.css` and
  touching the kid-app build — unnecessary complexity for one additional page.
- _Copy tokens into `admin.css`_: Would create two sources of truth and drift
  the moment a token is updated.
- _One CSS file only_: `styles.css` contains kid-specific component rules the admin
  doesn't need (`.menu-card`, `.tile`, etc.), but they're harmless dead weight — they
  produce no visual output unless the HTML uses those class names.

**The rule (binding on both the admin app and any future feature):**

> All colour tokens, the font stack, `--radius`, `--tap-min`, and background
> treatment are defined ONCE in `styles.css` `:root`. The admin page imports
> `styles.css` unchanged. Neither app hard-codes colour values or re-declares
> tokens. Admin-only styles live in `admin/admin.css` as additions, not overrides.

---

## 4. Component conventions and styling

### 4a. Panels

```css
.panel {
  background: var(--panel);           /* rgba(255,255,255,0.06) */
  border: 1px solid var(--panel-border);
  border-radius: var(--radius);       /* 22px */
  padding: 18px;
  margin-bottom: 16px;
}
```

The admin app uses `.panel` for every labelled section (Identity, Settings, Progress,
etc.) in the student detail view. This is the direct equivalent of the settings
panel groups. Admin panels may omit `margin-bottom` in table/grid layouts.

### 4b. Buttons

**Base (any button):**
```css
.btn {
  min-height: var(--tap-min);   /* 64px — RELAXED in admin, see §7 */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45em;
  border-radius: var(--radius); /* 22px */
  padding: 16px 26px;
  font-size: 1.2rem;
  font-weight: 700;
  background: var(--panel);
  border: 1px solid var(--panel-border);
  transition: transform 0.1s ease;
}
.btn:active { transform: scale(0.96); }
```

**Primary (`.btn.primary`):**
```css
background: linear-gradient(150deg, #5f7bff, #8a5cff);
border-color: transparent;
box-shadow: 0 10px 30px -8px #5f7bff88;
```

**Ghost (`.btn.ghost`):**
```css
min-height: 52px;
padding: 10px 22px;
font-size: 1.05rem;
opacity: 0.92;
```

**Danger (admin only — not in kid app):**
Reuses `.btn` shape with danger colour overrides:
```css
/* admin.css */
.btn.danger {
  color: #ff9aa2;
  border-color: rgba(255, 154, 162, 0.45);
}
.btn.danger:hover {
  background: rgba(255, 154, 162, 0.08);
  box-shadow: 0 0 14px -4px rgba(255, 154, 162, 0.4);
}
```
Danger buttons are ALWAYS inside the `DANGER` labelled section (§7 student detail).
They never appear in overview rows.

**Disabled (all variants):**
```css
.btn[disabled] { opacity: 0.4; pointer-events: none; }
```

### 4c. Overlays and modals

The z-index ladder (verbatim from `styles.css` comments):

| z-index | Element | Class |
|---|---|---|
| 40 | Gem burst particles | `.particle` |
| 50 | Toast notification | `.toast` |
| 60 | Crystal detail overlay, drag ghost | `.crystal-detail-overlay`, `.tray-tile.drag-ghost` |
| 100 | Idle pause overlay | `.pause-overlay` |
| 120 | Active-engagement brain-break overlay | `.apause-overlay` |
| 200 | Parental gate — **always top-most** | `.gate-overlay` |

**Admin overlay rules:**
- The Export modal is a standard overlay (use the `.gate-overlay` + `.gate-box` HTML
  structure and CSS; `z-index` 60 is appropriate since the admin has no idle/brain-break
  overlays).
- The "view specimen larger" lightbox: same overlay structure, `z-index: 60`.
- Destructive confirm dialogs: reuse the `.gate-overlay` + `.gate-box` structure
  and styling (already a dark modal with rounded corners). Do NOT use `window.confirm()`
  — use the same overlay component the main app uses. The math gate (parentalGate)
  is NOT needed on the admin — admin auth is the ADMIN_KEY, not a maths challenge.

**Overlay anatomy (from `src/ui.js`):**
```js
// overlay = position:fixed; inset:0; backdrop blur; flex-center
// box = border-radius:20–28px; background linear-gradient(160deg,#1a2350,#11183c);
//       border: 1px solid var(--panel-border); box-shadow: 0 24px 60px -20px #000d
```
The admin's custom overlay dialog (`admin.css`) should follow the `.gate-box` styling
exactly (same background gradient, border, shadow, radius).

### 4d. Toast

```css
.toast {
  position: fixed; left: 50%; bottom: 8%;
  background: #11183c;
  border: 1px solid var(--panel-border);
  color: var(--ink);
  padding: 14px 22px;
  border-radius: 999px;
  font-weight: 700; font-size: 1.1rem;
  z-index: 50;
}
```
The admin app calls `toast()` from `src/ui.js` for lightweight confirmations
("Saved", "Deleted", "Copied"). The admin bundle imports `ui.js` for `el()`, `toast()`,
and overlay helpers — NOT for child-specific functions (audio, idle guard, etc.).

### 4e. Grown-up gate

```css
.gate-overlay { position: fixed; inset: 0; z-index: 200; /* ... */ }
.gate-box     { width: min(440px,100%); border-radius: 20px; /* ... */ }
.gate-err     { color: #ff9aa2; }  /* the existing danger colour */
```
The admin does NOT use the parental maths gate (it's for restricting child access).
The admin uses the same `z-index: 200` for any admin confirmation modal that must sit
above all other content.

### 4f. Form controls

These styles come from `styles.css` and apply unchanged in the admin:
```css
input[type="text"] {
  min-height: var(--tap-min); /* relaxed in admin — see §7 */
  border-radius: 14px;
  border: 2px solid var(--panel-border);
  background: rgba(0,0,0,0.25);
  color: var(--ink);
  font-size: 1.2rem;
  padding: 0 16px;
}
select {
  min-height: var(--tap-min);
  border-radius: 14px;
  border: 2px solid var(--panel-border);
  background: rgba(0,0,0,0.25);
  color: var(--ink);
  font-size: 1.1rem;
  padding: 0 12px;
}
```
The admin's `admin.css` may tighten `min-height` for these (adult tool — see §7).

### 4g. Segmented controls

```css
.seg { display: flex; gap: 10px; flex-wrap: wrap; }
.seg button {
  min-height: var(--tap-min);
  border-radius: 16px;
  font-weight: 800; font-size: 1.1rem;
  background: var(--panel);
  border: 2px solid var(--panel-border);
}
.seg button.on {
  background: linear-gradient(150deg, #5f7bff, #8a5cff);
  border-color: transparent;
}
```
Used in the admin for compact option pickers (granularity, scope). Admin may override
`min-height` to `44px` (adult tool).

### 4h. Feedback archive / `admin_feedback.js` precedent

The existing `src/screens/admin_feedback.js` screen demonstrates the correct pattern
for an admin-style data view in this codebase:
- Uses `el()` from `src/ui.js` for DOM building.
- Uses `.panel.feedback-entry` for each record card.
- Uses `.scroll` wrapper with `overflow-y: auto` for the scrollable list.
- Uses `.data-actions` for action button rows.
- Uses `header(ctx, { title, onBack })` for the top bar.
The admin app follows the same conventions. Class names referenced here (`panel`,
`feedback-entry`, `scroll`, `data-actions`) are real `styles.css` classes.

---

## 5. DOM-building conventions

### 5a. `el()` — the DOM builder (`src/ui.js`)

```js
el(tag, attrs, ...children)
```

- `on*` keys become `addEventListener` calls.
- `style` / `dataset` accept objects.
- Falsy children are skipped — `cond && el(...)` works inline.
- **`replaceChildren(...nodes.filter(Boolean))`** — the project-wide rule for safe
  DOM replacement. Never pass `null` / `undefined` as a `replaceChildren` arg directly
  (native `replaceChildren` stringifies `null` into a `"null"` text node). Always
  `.filter(Boolean)` arrays before spreading.

The admin's `admin.js` imports `el`, `toast`, and overlay helpers from `src/ui.js`.
It does NOT import `header()` (which assumes a kid app ctx with `state.gems`/`level`);
the admin writes its own thin header.

### 5b. Z-index ladder (summary)

Repeated from §4c for quick reference: 40 → 50 → 60 → 100 → 120 → 200.
Admin overlays use 60 (content lightboxes) or 200 (critical confirmations / topmost).

---

## 6. Responsive rules

### 6a. CSS breakpoints in `styles.css` (authoritative)

| Query | Purpose |
|---|---|
| `max-width: 480px` | Phone portrait — compact spacing, smaller stats |
| `max-width: 560px` | Picture-pad grid narrow adjustment |
| `min-width: 481px` and `min-height: 521px` | Tablet / desktop keypad sizing |
| `min-width: 1025px` and `pointer: fine` | Desktop wide — cap `#app` at 900px, centered |
| `max-height: 520px` | Short viewports / landscape phone — collapse home hero |
| `max-height: 800px` | Phone-height viewports — pin reward CTA row |
| `prefers-reduced-motion: reduce` | Zero looping animations |

**The 700px breakpoint** is a JS `matchMedia` in `src/modes/mastery.js` only
(`const WIDE_QUERY = '(min-width: 700px)'`) — it controls the whole-word multi-box
vs. single-canvas layout for Mastery mode. It is **NOT a CSS media query** and has
no admin relevance.

### 6b. Admin breakpoint (`≥720px`)

`ADMIN_APP.md §7` specifies `≥720px` for the admin's desktop table layout. This is
consistent with the app's conventions: the app's effective "non-phone" boundary is
`481px` (the narrow-phone compact styles cut out below `480px`), and `720px` for the
admin's two-column layout sits safely above that, adding a meaningful density increase.
The `720px` value is retained as-is — it is intentional rather than a drift.

### 6c. Mobile-first

`styles.css` is mobile-first: base styles target phones; wider/taller viewports
add via `min-width` / `min-height` queries. The admin `admin.css` follows the same
convention: base = mobile single-column card list; `@media (min-width: 720px)` adds
the sortable data table and two-column detail.

---

## 7. Admin-app adaptations (intentional deviations)

These deviations from kid-UX rules are deliberate and documented here so they are
not confused with styling drift.

### 7a. Touch target sizes (relaxed)

`UX.md §2` requires `--tap-min: 64px` for kids (≥96–120px for primary targets).
The admin is an adult tool used on a desktop or a grown-up's phone. Admin `admin.css`
overrides:

```css
/* admin.css — adult tool density */
.btn       { min-height: 40px; padding: 8px 18px; font-size: 1rem; }
.btn.ghost { min-height: 36px; }
.seg button { min-height: 40px; }
input[type="text"], select { min-height: 40px; }
```

The minimum for adult accessibility (WCAG 2.5.5) is 44px. The admin's primary
action buttons (Save, Export CSV, Reset) stay at 44px+. Inline table controls
(sort arrows, small toggles) may go to 36px as they are not the primary interaction.

The relaxation applies to **size only**. All colours, fonts, and radius tokens remain
from the shared system.

### 7b. Data density

The admin overview at `≥720px` is a **sortable HTML table** — not a grid of cards.
Tables have denser row heights (`min-height: 48px` per row) and multi-column layouts.
This is adult-appropriate and is not a regression; the kid app never shows tabular data.

The admin `admin.css` provides `.admin-table` styles (borders coloured with
`var(--panel-border)`, header row using `var(--panel)` background, hover using
`rgba(255,255,255,0.04)`, sorted column header using `var(--accent)` for the arrow).
These are new admin-only classes, not overrides of existing shared classes.

### 7c. User-select

`styles.css body` sets `-webkit-user-select: none; user-select: none` (kids tap, don't
select text). The admin often needs to copy family codes, names, and data. `admin.css`
restores selectability on admin content:

```css
/* admin.css */
#admin-app { user-select: text; -webkit-user-select: text; }
```

### 7d. No idle guard / brain break

The admin does not run `createIdleGuard()` or `activePauseOverlay()`. Those are
kid-facing features. The admin session stays open indefinitely.

### 7e. Tone and copy

The kid app uses warm, playful copy ("Keep digging!", "Grown-ups only 🔒"). Admin
copy is direct and informational ("Saved — device will pick this up on next sync").
Both use the same Atkinson Hyperlegible typeface; the admin's copy is less emoji-heavy.

---

## 8. Open questions for Ian — RESOLVED (2026-06-23)

1. ✅ **`--danger` colour** — `#ff9aa2` (the existing `.gate-err` rose). Palette-unified;
   destructive actions rely on the DANGER section + confirm + auto-snapshot for weight,
   not an alarm colour. See §1d.

2. ✅ **`--danger` home** — added to `styles.css` `:root`; `.gate-err` updated to
   `var(--danger)` (no visual change). One source of truth; the admin references the
   token, never a literal. See §1d / §3.

---

*This document is the single source of truth for design token values and shared
component conventions. When a token is updated in `styles.css`, update the verbatim
values in §1 of this document in the same commit.*
