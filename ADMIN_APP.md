# Admin App — Design Document

> _Status: **DESIGN — not yet built.** Created 2026-06-23. Author: Claude (for Ian).
> Decisions locked via AskUserQuestion this session are marked ✅. Open questions for Ian
> are collected in the last section. This supersedes the original §37 B "monitor mode" plan
> as the FIRST thing to build; the parent/teacher view is deferred and captured in §10._
>
> **Styling:** governed by [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md). The admin page links the
> same `styles.css` as the kid app plus an `admin/admin.css` for admin-only additions.
> No colour values or tokens are re-declared in `admin.css`. See `DESIGN_SYSTEM.md §3`.

## 1. Purpose & scope

A **standalone, operator-only admin app** for Crystal Spell Caverns. One admin (Ian, the
developer/operator). Its goals, in Ian's words:

1. **View ALL students' data** — every learner across every family that has turned on family
   sync, in one place.
2. **Modify all student settings** — and have the change actually *stick* on the child's
   device (this is the hard part — see §6).
3. **Export to CSV** — with **configuration as to what data to include** (column picker +
   row granularity).

It is **mobile-first, desktop-friendly**, and matches the visual language of the main app
(§7). It is a **separate app**: kids never see it, never load its code, and it lives behind
an auth wall.

**Explicitly OUT of scope for v1** (deferred — see §10): the parent/teacher "monitor" mode,
the many-to-many student↔monitor graph, groups, COPPA consent for teacher links, and live
Google Sheets OAuth. Ian's call: _"hold off … decide what a parent/teacher view will look
like based on this admin app."_ So we build the operator tool first, learn from it, then
design the parent/teacher view on top of what we learn.

## 2. Decisions locked (this session)

| # | Decision | Choice |
|---|----------|--------|
| ✅ | **Hosting** | **Gated route in the existing Worker.** A separate admin bundle served at `/admin`, with new `/api/admin/*` endpoints. Reuses the `FAMILY_SYNC` KV binding + the Git-CD deploy. **NOT** in the kid PWA's service-worker precache, so the kids' app never loads admin code and there's no SW collision. |
| ✅ | **Auth** | **Reuse the existing `ADMIN_KEY` secret** (already used for the feedback archive + admin push), sent as the `x-admin-key` header. Stored on the admin device in `localStorage` (`csc_admin_key`, the same key `src/admin.js` already uses). |
| ✅ | **Write-back** | **Authoritative edits that stick.** Add a server-side **admin revision** so an admin edit WINS the never-lose-progress merge and the child's device adopts it on next sync — even an edit that lowers a value (a reset). See §6 for the mechanism. |
| ✅ | **Google sync** | **CSV/JSON export first** (zero-dependency, imports into Sheets/Excel). Live Sheets-API OAuth deferred (a free-tier cliff to flag later). |
| ✅ | **Plumbing** | **Reuse** the multi-profile container + family-sync KV. No parallel system. |

## 3. How the data lives today (the substrate we build on)

Everything an admin needs is **already in KV `FAMILY_SYNC`**. Cross-device family sync stores
one envelope per opaque **family code** (a bare 8-char string — siblings share one code).

- **Key:** the family code itself (e.g. `K7M3PQ2R`). Bare — no prefix. _(Other keys in the
  same namespace are prefixed: `push:`, `adminpush:`, `feedback:` — see `worker.js`. The admin
  list must EXCLUDE those; see §5.)_
- **Value (the envelope):** `{ data: <container>, savedAt: <ms> }` (the `wrapBackup` shape
  from `engine/backup.js`).
- **`data` (the container, `engine/profiles.js`, schema 2):**

```jsonc
{
  "schema": 2,
  "syncCode": "K7M3PQ2R",     // family level
  "syncConsent": true,
  "parentPassword": null,      // grown-up gate hash (family level)
  "voiceConsent": false,
  "activeId": "p…",
  "profiles": [ <profile>, … ] // one per sibling
}
```

- **Each `<profile>`** (the per-learner blob, `state.js` `defaultProfile` + serialized
  `categories`/`tracker`). The fields the admin app surfaces:

| Group | Field (path) | Notes |
|-------|--------------|-------|
| Identity | `profile.name` | the chosen nickname (pseudonymous — never a real name; PRIVACY.md) |
| Identity | `settings.themeColor` | hex |
| Identity | `placement.age` | age entered in onboarding (or null) |
| Identity | `kidLock` | picture/PIN lock present? (don't export the code itself) |
| Settings | `settings.difficulty` | `easy`/`medium`/`hard` |
| Settings | `settings.length` | "Words per dig" = `categories.setSize` |
| Settings | `settings.optionCount`, `voice`, `volume`, `voiceRate`, `voiceName`, `readableText`, `dailyGoalGems`, `reminders` | play/display prefs |
| Progress | `startLevel` | placement anchor |
| Progress | `categories.level` | **current cavern level (band)** |
| Progress | `categories.peakLevel` | deepest band reached (map frontier) |
| Progress | `categories.peakKnownish`, `peakMastered` | unlock high-waters → `unlocks()` derives mastery/mining unlocked |
| Stats | `stats.playMs` | **active play time** (banked by §37 A) → "play time" metric |
| Stats | `stats.sessionsPlayed`, `answers`, `correct` | accuracy = `correct/answers` |
| Stats | `stats.byDay` | per-day `{answers,correct,gems,digs,crafted,…}` (for trends) |
| Stats | `gems` | current gem balance |
| Stats | `streak` | `{current,best,lastDay}` (`engine/streak.js`) |
| Words | `categories.words[]` | per-word records: `word, category(new/learning/known/mastered/tricky), band, pattern, craftAttempts, craftCorrect, craftStreak, lastSeen` |
| Catalog | `catalog.owned[]`, `milestoneDepth` | crystals collected |
| Other | `specimens[]` | lab drawings (base64) — **viewable thumbnails**, deletable + lockable by admin (§7, §11 Q4) |
| Other | `feedback[]` | local feedback notes |
| Dates | `lastBackupAt` | |

> **Derived metrics** (computed by the pure view layer, not stored): accuracy, mastery/mining
> unlocked (`categories.unlocks`), learning/known/mastered/tricky counts + lists
> (`categories.*Words`), `newRemaining`, `toNextLevel` (`categorySummary`), per-word accuracy
> (`craftCorrect/craftAttempts`). We reuse the EXISTING pure functions in
> `engine/categories.js` — no reimplementation.

**Nothing new is collected.** The admin app only *surfaces, edits, and exports* data that
already exists. (Pseudonymous by construction — see §8.)

## 4. Architecture

```
                         ┌─────────────────────────────────────────┐
  Admin's browser  ───▶  │  GET /admin           (static bundle)    │
  (phone/desktop)        │  GET /api/admin/families                 │
                         │  GET /api/admin/family/:code             │  ── x-admin-key gate
                         │  PUT /api/admin/family/:code (authoritative)│
                         └───────────────┬─────────────────────────┘
                                         │
                                    Cloudflare Worker (worker.js)
                                         │
                                   KV  FAMILY_SYNC  ◀── same namespace the kids' sync uses
                                         │
  Kid's device  ──── PUT /api/sync ──────┘  (never-lose-progress merge, now adminRev-aware)
```

- **One Worker, one KV.** New routes added to the existing `worker.js` `fetch` switch.
- **Separate bundle.** `admin/index.html` + `admin/admin.js` + `admin/admin.css`. Served as
  static assets by the Worker (or by a tiny route handler). **Not** added to `sw.js`'s CORE
  precache, so the kid PWA never caches or loads it.
- **Pure, testable core** (so we keep test-first, CLAUDE.md):
  - `engine/cloudsync.js` — extend `reconcile` to be **adminRev-aware** (§6). Already shared
    by the Worker AND the client, so one change fixes both sides.
  - `engine/admin_view.js` *(new)* — pure: `flattenContainer(code, container) → rows[]`
    (one object per profile with all derived metrics). No DOM, no network.
  - `engine/admin_export.js` *(new)* — pure: `toCSV(rows, columns, {granularity}) → string`.
    Both granularities (§9). No DOM.
  - `admin/admin.js` — the thin UI/network layer (fetch + render), like
    `cloud_sync_backend.js` is for sync.

### Endpoints (all gated by `x-admin-key`, 403 otherwise)

| Method · Path | Purpose | Returns |
|---|---|---|
| `GET /api/admin/families` | List every family + a light summary (code, #profiles, names, lastSaved). | `[{code, savedAt, adminRev, profiles:[{id,name,level,…}]}]` |
| `GET /api/admin/family/:code` | Full envelope for one family. | `{data, savedAt, adminRev}` |
| `PUT /api/admin/family/:code` | **Authoritative write** of an edited container — bumps `adminRev`, stamps `savedAt`. | the stored envelope |
| `DELETE /api/admin/family/:code` | _(optional, §11 Q2)_ remove a family. | 204 |

> The admin GET/PUT are SEPARATE from `/api/sync` (which stays the kid path). The only change
> to `/api/sync` is that its shared `reconcile` now respects `adminRev`.

## 5. Listing all families (the one KV wrinkle)

Family codes are stored under the **bare code** as the key, with no shared prefix, so a
`kv.list({prefix})` can't select just them. Two options:

- **v1 (recommended): list-and-filter.** `kv.list()` over the namespace, **exclude** keys
  starting with `push:`, `adminpush:`, `feedback:`. Simple, correct, fine at our scale
  (tens of families). Paginate with the `cursor` (already the pattern in `worker.js`).
- **If it grows: a `fam:` index.** On every `/api/sync` PUT, also write the code into a small
  index (e.g. a `famindex:` set or per-code marker) so the admin list is a clean prefix scan.
  Deferred until the namespace is big enough to matter (flagged, not built — [[precise-and-efficient]]).

## 6. Authoritative write-back (the hard part)

**Problem.** `/api/sync` merges with a **never-lose-progress** rule (`engine/cloudsync.js`
`reconcile` → `progressScore`: more answers/ticks/tracked/gems wins; ties → newer `savedAt`).
So a naive admin edit to KV is silently undone by the child's next sync:

- An edit that *lowers* a value (reset level/progress): the device has the higher
  `progressScore` → **device wins → admin reset lost.**
- An edit to a *non-score* field (name, colour, difficulty): scores tie → newer `savedAt`
  wins → the device (typically newer) → **admin edit lost.**

**Fix: an admin revision counter that outranks the score.** Add `adminRev` (integer, default
0) to the container `data`. The admin PUT bumps it. `reconcile` compares `adminRev` FIRST;
the higher one wins outright, regardless of `progressScore`/`savedAt`.

```js
// engine/cloudsync.js (sketch — the only logic change; both Worker & client get it)
const adminRev = (env) => (env && env.data && Number(env.data.adminRev)) || 0;

export function reconcile(local, remote) {
  const l = local && local.data ? local : null;
  const r = remote && remote.data ? remote : null;
  if (!l && !r) return { action: 'inSync', use: null, reason: 'nothing to sync' };
  if (!r) return { action: 'push', use: l, reason: 'no backup in Drive yet' };
  if (!l) return { action: 'pull', use: r, reason: 'no local progress yet' };

  // NEW: an authoritative admin edit wins outright.
  const la = adminRev(l), ra = adminRev(r);
  if (ra > la) return { action: 'pull', use: r, reason: 'admin edit (newer revision)' };
  if (la > ra) return { action: 'push', use: l, reason: 'admin edit (newer revision)' };

  // …unchanged: progressScore, then savedAt tiebreak…
}
```

**Semantics this gives us (correct + minimal):**

1. Admin GETs the family, edits a profile, PUTs → server stores it with
   `data.adminRev = (old||0) + 1`, `savedAt = now`.
2. Child's device next syncs: its container still has the OLD `adminRev`. `reconcile` →
   admin copy wins → server returns it → device adopts it (`state.importData`). **Edit
   applied, even a reset.**
3. The child keeps playing; the device now carries the new `adminRev` PLUS fresh progress.
   Next PUT: equal `adminRev` on both sides → falls through to the normal `progressScore`
   merge → the child's continued play is preserved. **The admin edit is a one-time
   authoritative baseline; normal never-lose-progress resumes from it.** This is exactly the
   behaviour we want.

**Round-trip safety.** `adminRev` lives in `data` (the container), so it survives
backup/export/import (`engine/backup.js` wraps `data` verbatim) and the client's
`importData` (which replaces the container wholesale). One unit test asserts a higher
`adminRev` wins even against a far higher `progressScore`, and that an equal `adminRev` falls
back to the score.

**Editable fields in v1** (the admin PATCHes these into the container before PUT):
- Profile: `profile.name`, `settings.themeColor`.
- Difficulty/level: `settings.difficulty`, `categories.level` (re-aim band — note this only
  changes which words are *served*; it doesn't fabricate mastery), `settings.length`/`setSize`.
- Voice/display: `settings.voice`, `volume`, `voiceRate`, `readableText`, `dailyGoalGems`,
  `reminders`.
- Guarded actions (confirm-gated, destructive): **reset a profile's progress** (mirror
  `state.resetActiveProgress` server-side), **re-test** (mirror `categories.resetForRetest`).
  **SAFETY RULE (Ian 2026-06-23): a restore point MUST be taken BEFORE any reset/re-test.**
  The destructive action first appends a labelled snapshot to that profile's `snapshots` ring
  (reusing `engine/profiles.pushSnapshot`, `MAX_SNAPSHOTS = 6`; entry shape
  `{ at, label:'admin: before reset', data:<profile-without-nested-snapshots> }`, exactly like
  `state.takeSnapshot`), THEN applies the reset — so the change is always undoable. The admin app
  also exposes snapshot **view + restore** (§7) so the operator can roll back their own edit; the
  on-device Time Machine (Settings) can restore it too. The action is blocked if the snapshot
  can't be written.
- **Specimen moderation** (Ian 2026-06-23, §11 Q4): **delete** any lab drawing (drop it from
  `specimens[]`), and a per-profile **`settings.labDisabled`** flag the admin can switch ON to
  turn OFF drawing/the Crystal Lab for a student who abuses it. The main app reads this flag to
  hide/disable the Lab — a small main-app change (see the **cross-cutting TODO**, §10a).

> The admin app edits the container JSON and PUTs the whole thing. It reuses the existing
> pure mutators' *shapes* (it doesn't import `state.js`, which is browser-only) — i.e. the
> admin's "reset progress" produces the same container a `defaultProfile` would, server-side.

## 7. UI / UX spec

**Design language = the main app's**, adapted for a data tool used by an adult.
Full token values and component styling are in [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md).
Summary of what the admin reuses and where it deviates:

- **Reuse the tokens** from `styles.css` `:root`: the cavern palette (`--bg-0/1/2`,
  `--panel` = `rgba(255,255,255,0.06)`, `--panel-border` = `rgba(150,180,255,0.18)`,
  `--ink` = `#eaf0ff`, `--ink-dim` = `#9fb0d8`, `--accent` = `#7aa2ff`, the praise
  colours `--gold/#ffd23f`, `--cyan/#36f1cd`, `--emerald/#7ae582`, `--amethyst/#9d8df1`,
  `--slate/#6c7a89`), `--radius` = `22px`, and the **Atkinson Hyperlegible** typeface.
  Exact values are canonical in `DESIGN_SYSTEM.md §1`.
- **Danger colour:** destructive actions (Reset, Delete) use `#ff9aa2` (the existing
  `.gate-err` colour — a soft rose, on-palette, not alarm-red). A `--danger` token
  is proposed in `DESIGN_SYSTEM.md §1d` — pending Ian's confirmation (see §11 Q6).
  Admin-specific button class `.btn.danger` defined in `admin/admin.css`.
- **Relax the kid sizing rules:** the `--tap-min: 64px` / "≥110px primary" sizing is
  for small children; the admin uses `min-height: 40–44px` for most controls
  (adult accessibility minimum). We keep the *look* (dark crystal theme, rounded panels,
  the accent) without oversized targets. Details: `DESIGN_SYSTEM.md §7a`.
- **Mobile-first, desktop-friendly:** single-column stacked **cards** on phones; at
  `≥720px` the overview becomes a **sortable table** and detail goes two-column.
  (The app's own breakpoints are at `480px` phone-narrow and `481px+` tablet/desktop;
  the `≥720px` admin table layout is a separate addition in `admin/admin.css`.
  The 700px mastery JS breakpoint is mode-internal only and has no admin relevance.)
- **Shared components to import from `src/ui.js`:** `el()`, `toast()`, overlay helpers.
  Do NOT import `header()` (assumes kid ctx). Use `.panel`, `.btn`, `.btn.primary`,
  `.btn.ghost`, `.seg`, `.scroll`, `.data-actions`, `.gate-overlay`/`.gate-box` from
  the shared `styles.css` directly.

### Screens

**A. Login** — a single `ADMIN_KEY` field (password input) + "Unlock". Stores the key in
`localStorage` (`csc_admin_key`), validates by calling `GET /api/admin/families` (403 →
"key rejected"). A "Forget key on this device" link. (Same key model as `src/admin.js`.)

**B. Students overview** — every profile across every family, searchable/sortable.

```
 mobile (≤719px)                         desktop (≥720px)
 ┌───────────────────────────┐          ┌──────────────────────────────────────────────────────┐
 │ 🔮 Admin · Students   [⎋] │          │ 🔮 Admin · Students            🔎[______]  [Export CSV]│
 │ 🔎 [_______]   [Export ⤓] │          ├──────────┬────────┬──────┬───────┬────────┬───────────┤
 │ ───────────────────────── │          │ Name ▲   │ Family │ Lvl  │ Acc   │ Play   │ Last seen │
 │ ┌───────────────────────┐ │          ├──────────┼────────┼──────┼───────┼────────┼───────────┤
 │ │ Lex  ·  K7M3PQ2R      │ │          │ Lex      │ K7M3PQ │  40  │ 86%   │ 4h 12m │ 2d ago    │
 │ │ Lvl 40 · 86% · 4h12m  │ │          │ Sam      │ K7M3PQ │   3  │ 71%   │ 0h 48m │ today     │
 │ │ ▸ tap for detail      │ │          │ …        │ …      │  …   │  …    │  …     │  …        │
 │ └───────────────────────┘ │          └──────────┴────────┴──────┴───────┴────────┴───────────┘
 │ ┌───────────────────────┐ │          (click a row → detail; click a header → sort)
 │ │ Sam  ·  K7M3PQ2R …    │ │
 └───────────────────────────┘
```

Default overview columns: **Name · Family · Level · Accuracy · Play time · Gems · Last seen**.
Filters: free-text (name/code), and a family chip to scope to one family's siblings.
**Default = a FLAT list of all students** (Ian 2026-06-23); a **"Group by family"** toggle
collapses it into per-family sections (the natural grouping today; a precursor to the §10
teacher "groups").

**C. Student detail** — the full picture for one profile, in labelled sections matching the
data groups in §3:

```
 ┌─────────────────────────────────────────────────────────┐
 │ ‹ Back     Lex  ·  family K7M3PQ2R            [Save] [⋯] │
 │ ─────────────────────────────────────────────────────── │
 │ IDENTITY     name [Lex      ]  colour [■]  age 8  🔒 lock │  ← editable
 │ SETTINGS     difficulty [easy▾]  words/dig [10]  voice ☑  │  ← editable
 │              volume ▮▮▮▮▯  rate 0.85  reminders ☑          │
 │ PROGRESS     cavern level 40   peak 41   mastery ✅ mining ✅│
 │ STATS        play 4h 12m · sessions 63 · accuracy 86%      │
 │              gems 1240 · streak 9 (best 14)                │
 │ WORDS        learning 8 · known 5 · mastered 212 · tricky 3│
 │              ▸ learning: cat, ship, …  (expandable lists)  │
 │ CATALOG      crystals 18/24 · milestone depth 22          │
 │ SPECIMENS    🖼 🖼 🖼 🖼  20 drawings   [Disable Lab ⏻]    │  ← thumbnails; tap = view/delete
 │ RESTORE      ◷ 2d ago "admin: before reset"  [Restore]    │  ← snapshot ring; undo a reset
 │              ◷ today "auto"                   [Restore]    │
 │ DANGER       [Reset progress]  [Re-test level]            │  ← auto-snapshots FIRST, then confirm
 └─────────────────────────────────────────────────────────┘
```

Editing a field marks the form dirty; **Save** PUTs the whole edited container authoritatively
(§6) and shows "Saved — the child's device will pick this up on next sync." Danger actions are
gated by an overlay confirm dialog — reuse the `.gate-overlay` / `.gate-box` structure from
`src/ui.js` (same dark modal, `border-radius: 20px`, `box-shadow: 0 24px 60px -20px #000d`).
Do NOT use the browser's native `window.confirm()` (plain OS dialog, no styling, wrong tone).
The maths `parentalGate` is NOT used on admin; the ADMIN_KEY is the auth boundary.

**Specimens panel** — a thumbnail grid of the child's lab drawings (rendered from the stored
base64). Tap a thumbnail to view it larger in a lightbox overlay (`.gate-overlay` / `.gate-box`
structure, `z-index: 60` — below any confirm dialog). The lightbox includes a **Delete** button
(`.btn.danger`, overlay-confirm-gated) that removes it from `specimens[]` on save. A **Disable
Lab** toggle sets `settings.labDisabled` so a student who draws inappropriate things loses the
drawing feature until re-enabled. (Pre-emptive, on-device content filtering of drawings is a
separate MAIN-APP job — §10a.)

**D. Export modal** — the "configuration as to what to include":

Rendered as a `.gate-overlay` + `.gate-box` modal (`z-index: 60`; same dark rounded
card as all other overlays — `border-radius: 20px`, `background: linear-gradient(160deg,
#1a2350,#11183c)`, `border: 1px solid var(--panel-border)`).

```
 ┌──────────────────────────────────────────────┐
 │ Export CSV                                     │
 │ Granularity:  (•) One row per student          │
 │               ( ) One row per word per student │
 │ Scope:        (•) All families                 │
 │               ( ) This filter   ( ) One family │
 │ Columns:  [✓ Identity] [✓ Settings]            │
 │           [✓ Progress] [✓ Stats] [ ] Word lists│
 │   (expand each group → individual column boxes) │
 │                          [Cancel]  [Download ⤓] │
 └──────────────────────────────────────────────┘
```

Radio/checkbox groups use `.seg` (the shared segmented control) where options are
mutually exclusive. Cancel = `.btn.ghost`, Download = `.btn.primary`.

## 8. Security & privacy

- **The `ADMIN_KEY` is the whole boundary** — it gates every family's data. Set a strong
  value (`wrangler secret put ADMIN_KEY`). Every `/api/admin/*` handler checks it (constant
  consideration: compare safely; 403 on mismatch, like `handleFeedback`/`handleAdminPush`).
- **The admin bundle is harmless without the key** — `/admin` is just HTML/JS; with no valid
  key every API call 403s, so an unauthenticated visitor sees an empty login.
- **Not in the kid PWA.** `/admin` and `admin/*` are excluded from `sw.js` precache; the kids'
  app has no link to it and never fetches it.
- **Data is pseudonymous** (nicknames, gameplay only — PRIVACY.md §"What is stored"). The
  operator viewing it is consistent with the existing "developer sees pseudonymous feedback"
  posture. **No PRIVACY.md change is needed for v1** (no NEW data, no new sharing party — the
  operator already merges this data through `/api/sync`). _If_ we later expose data to parents/
  teachers (§10), PRIVACY.md must be revisited.
- Export files contain pseudonymous data; the admin keeps them locally (same as backups).

## 9. CSV export detail

- **Granularity A — one row per student** (wide): all scalar metrics as columns; word lists
  rendered as either counts or `;`-joined cells (a column toggle). Good for a roster overview.
- **Granularity B — one row per word per student** (long): `familyCode, profileName, word,
  category, band, pattern, craftAttempts, craftCorrect, accuracy, lastSeen`. Good for
  word-level analysis (which patterns are hardest across the cohort).
- **Column groups** (checkboxes; default-on except heavy ones): Identity, Settings, Progress,
  Stats, Word-lists (default OFF — verbose). The picker drives `toCSV(rows, columns)`.
- Proper CSV quoting (commas/quotes/newlines in nicknames). UTF-8 with BOM so Excel opens it
  cleanly. `engine/admin_export.js` is pure and unit-tested (round-trip + quoting edge cases).

## 10. DEFERRED — parent/teacher "monitor" mode (the original §37 B)

Captured here per Ian so it isn't lost; **we decide its shape AFTER the admin app exists.**
The concerns to settle before building it:

1. **Identity / auth for monitors.** Today the app is on-device + opt-in family sync (one
   shared family password). A monitor↔student graph is a NEW sharing model → needs monitor
   identity (accounts? invite/link codes?) and a server-side relationship store.
2. **Many-to-many + groups.** A student ↔ many monitors AND a monitor ↔ many students (a
   teacher with a class; a child with mum + dad + teacher); monitors sort students into
   groups (class / reading group).
3. **Privacy / COPPA.** Sharing a child's data with a *teacher* is a different posture than a
   parent seeing their own child — it needs a consent/authorization model (who can link to
   whom; how a guardian approves a teacher link) and a PRIVACY.md update.
4. **Google sync — free first** ([[prefer-free-services]]): a CSV/JSON export the monitor
   imports into Sheets is the zero-dependency option (this admin app builds exactly that
   exporter — reuse it); a live Google Sheets API sync needs OAuth + the Drive/Sheets API
   (free tier — flag the cliff).
5. **Reuse** the multi-profile + family-sync plumbing rather than a parallel system.

The admin app deliberately builds the pieces the parent/teacher view will reuse: the
pure container→rows flattener (`engine/admin_view.js`), the CSV exporter
(`engine/admin_export.js`), and the authoritative-write mechanism. The parent/teacher view
is then "the admin app, scoped to *your* linked students, with a consent + linking layer."

## 10a. Cross-cutting MAIN-APP TODO (arose from this design)

- **Content-filter inappropriate lab drawings (main app).** The admin app can DELETE a
  drawing and DISABLE the Lab per student (§6/§7), but that's reactive. Add a PRE-EMPTIVE,
  on-device check in the main app so abusive drawings are less likely to reach the admin in
  the first place. Options to weigh later (free-first [[prefer-free-services]]): a tiny
  on-device image classifier, a "report this" path, and/or rate/size limits. **Also: the main
  app must READ the new `settings.labDisabled` flag** the admin sets, and hide/disable the
  Crystal Lab + specimen drawing when it's on. _(Recorded in HANDOFF backlog too.)_

## 11. Open questions for Ian — ALL RESOLVED (2026-06-23)

1. ✅ **Default CSV columns** — Identity (name, family, age), Progress (level, mastery/mining
   unlocked), Stats (play time, sessions, accuracy, gems, streak), Words (learning/known/
   mastered/tricky *counts*). Word *lists* off by default.
2. ✅ **Delete in v1** — YES, with a clear **warning + confirm**. Family delete and
   single-profile delete, both confirm-gated.
3. ✅ **Editable scope** — **Full operator control** (Ian 2026-06-23): prefs + difficulty +
   words-per-dig + `categories.level` re-aim + the guarded reset/re-test. **Condition: a
   restore point is ALWAYS taken before a reset/re-test** (auto-snapshot first; restore exposed
   in the admin UI — see §6 + §7). Destructive actions stay behind warning+confirm.
4. ✅ **Lab specimens** — **viewable thumbnails**, easily **deleted**, and **lockable**
   (admin can DISABLE the Lab per student via `settings.labDisabled` if abused). Plus a
   main-app content-filter TODO (§10a).
5. ✅ **Overview default** — **flat list** of all students by default, with a **group-by-family**
   toggle.
6. ✅ **Danger colour** (Ian 2026-06-23) — **`--danger: #ff9aa2`** (the existing `.gate-err`
   rose — palette-unified, on-brand with the no-harsh-red ethos; destructive actions are already
   guarded by the DANGER section + confirm + auto-snapshot). **Added to `styles.css` `:root`**
   (single source of truth) and **`.gate-err` updated to `color: var(--danger)`** (no visual
   change). `.btn.danger` styling lives in `admin/admin.css`. See `DESIGN_SYSTEM.md §1d`. _(This
   is the one sanctioned touch of kid-app source — a zero-risk CSS token add.)_

## 12. Build plan (test-first, when approved)

1. **Shared reconcile** — `engine/cloudsync.js` `adminRev` awareness + unit tests (admin
   wins over score; equal adminRev falls back). _No behaviour change for existing syncs
   (adminRev defaults 0 everywhere)._
2. **Pure core** — `engine/admin_view.js` (`flattenContainer`) + `engine/admin_export.js`
   (`toCSV`, both granularities) + unit tests (derived metrics, CSV quoting/BOM).
3. **Worker endpoints** — `GET /api/admin/families|family/:code`, `PUT` (authoritative),
   optional `DELETE`, all `x-admin-key`-gated. Add routes to `worker.js`.
4. **Admin bundle** — `admin/index.html` + `admin/admin.css` + `admin/admin.js` (login →
   overview → detail/edit → export). `admin/index.html` links `/styles.css` FIRST, then
   `/admin/admin.css` — the anti-drift rule from `DESIGN_SYSTEM.md §3`. NOT precached in
   `sw.js`.
5. **QA** — Playwright visual pass at phone + desktop viewports (view-as-you-go,
   [[interactive-visual-qa]]): login, overview sort/filter, detail edit + save, export modal,
   CSV download. A guard script (`scripts/qa_admin.mjs`) seeding a fake KV (or a local mock of
   the admin API).
6. **Deploy** — bump `sw.js`/`version.js` (the reconcile change ships in the kid bundle too),
   push `main` (Git-CD), verify with `check_deploy.mjs` + `qa_prod.mjs`, then set/confirm
   `ADMIN_KEY` and smoke-test `/admin` on prod.
```

This is purely a design doc — no app code is written or changed by it.
