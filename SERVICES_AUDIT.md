# Free-Tier Dependency Audit — Crystal Spell Caverns

> Done 2026-06-19 (HANDOFF §0 OPEN BACKLOG #1, [[prefer-free-services]]). Re-run this audit
> whenever a new third-party/service dependency is added, or yearly. Bottom line: every
> RUNTIME dependency sits at **>95% free-tier headroom** with a **fail-closed (never auto-bill)**
> posture. Nothing here can produce a surprise charge at this app's scale.

Scale baseline: personal/family education PWA. <100 daily users (realistically a handful).
Push to a few devices. KV holds kilobytes/family. Worker traffic in the low thousands of
requests/day at most.

| Dependency | What it's used for | Free-tier limits (2026) | Headroom at this scale | Verdict |
|---|---|---|---|---|
| **Cloudflare Workers** (requests/CPU) | `worker.js` dynamic API: `/api/sync`, `/api/push`, `/api/feedback`, daily `scheduled()` cron. Static asset hits do NOT count. | **100,000 requests/day**; **10 ms CPU/request** (I/O wait on KV/fetch is free). Resets 00:00 UTC. | Hundreds of API calls/day vs 100k → **~0.1–1% used**. Each handler is tiny. | ✅ Safe. |
| **Cloudflare Static Assets** | Serves `deploy/` (HTML/JS/CSS, ~1,678 audio clips, printables, icons) via the `ASSETS` binding. | Asset **requests free & unlimited**. Upload caps: **20,000 assets/version**, **25 MiB/file**. | Requests uncapped. File count low-thousands < 20k. No file near 25 MiB. | ✅ Safe (watch file count if clips expand). |
| **Cloudflare KV** (`FAMILY_SYNC`) | Family-sync blobs, `push:`/`adminpush:` subs, `feedback:` entries. | **100k reads/day**, **1,000 writes/day**, **1,000 deletes/day**, **1,000 lists/day**, **1 GB storage**. Resets 00:00 UTC. | Writes are tightest: tens/day vs 1,000. Storage in KB vs 1 GB. **~95%+ free on every axis.** | ✅ Safe — **writes are the real ceiling** if usage grows ~20–50×. |
| **Cloudflare Cron Triggers** | Daily reminder push at `0 16 * * *`. | **5 cron triggers/account** (free). Each invocation = one normal Worker request. | Using **1 of 5**. ~1 invocation/day. | ✅ Safe. |
| **Web Push** (FCM / Mozilla autopush) | Browser Push API delivery for VAPID-signed reminders. Self-implemented RFC 8291+8292 — **no Firebase SDK, no push SaaS**. | **Free, no published per-app quota**; only generic per-endpoint fairness throttling + 4 KB payload limit. No billing path. | One reminder/day to a few endpoints — orders of magnitude below any throttle. | ✅ Safe (keep payloads <4 KB). |
| **Gemini TTS** (build-time only) | `scripts/gen_audio.mjs` generates word clips offline. **Never called at runtime.** | Preview-TTS free tier: **~3 req/min, ~960 clips/day** *(verify — model-specific; general Flash free tier is 10 RPM / 250 RPD)*. | Runtime exposure = **none**. Build-time: tail just needs repeated free runs (or billing). | ✅ Build-time only. **Licensing RESOLVED 2026-06-21 — OK to ship** (see "Gemini TTS commercial-licensing" note below). |
| **Resend** (email) | Wired but **dormant** — activates only if `RESEND_API_KEY` is set; currently a no-op. | **3,000 emails/month** *and* **100 emails/day** (the daily cap is the trip-wire); 1 verified domain. | **0 used** (inactive). | ⚠️ Dormant — no cost while unset. If enabled, the **100/day** cap is the limiter. |

## Cliffs to watch
- **KV writes (1,000/day)** — the single tightest Cloudflare axis. Each family-sync save,
  feedback submit, and push (un)subscribe is a write. Fine now (tens/day); batch/debounce if a
  chatty auto-sync loop or ~20–50× user growth appears.
- **KV reads (100,000/day)** — far looser, but keep sync reads event-driven, not on a tight timer.
- **Static Assets count (20,000/version)** — only relevant if the audio library expands toward
  the full word list *and* multiplies (multiple voices/formats). Reassess before a large expansion.
- **Resend 100/day** — harmless while dormant; becomes the limiter the moment `RESEND_API_KEY`
  is set. Don't wire it to per-event sends without a daily cap.
- **Gemini TTS commercial-use licensing** — a *legal*, not cost, cliff: confirm free-tier
  preview-TTS output is licensed for a shared/published app. Cost-wise it's build-time only.
- **Cloudflare resets at 00:00 UTC** — if any limit is neared, it's a hard fail for that op-type
  until UTC midnight, **never a soft overage charge**. The free plan never auto-bills; it fails
  closed — the safest possible failure mode for this app.

## Bottom line
Every runtime dependency is **>95% free-tier headroom** and **fail-closed**. The only items
needing eyes are the **KV write ceiling** (only if the app scales ~20×+) and the **dormant Resend
100/day cap** (only if switched on). The Gemini free-tier TTS commercial-licensing question is
now **RESOLVED — OK to ship** (note below). None bite at current family scale.

## Gemini TTS commercial-licensing — RESOLVED 2026-06-21 (✅ OK to ship)
Checked the governing **Gemini API Additional Terms of Service** (https://ai.google.dev/gemini-api/terms).
Verdict: **the pre-generated word clips are fine to ship in this published app.** Reasoning, with the
two material clauses quoted verbatim:

- **Ownership / use grant — "Use of Generated Content":** *"Some of our Services allow you to generate
  original content. Google won't claim ownership over that content… You're responsible for your use of
  generated content, and for the use of that content by anyone you share it with."* → Google does **not**
  claim ownership of the audio and does **not** restrict its use to non-commercial contexts. The user
  carries responsibility for the content (fine — it's TTS of plain dictionary words). Caveat the terms add:
  Google "may generate the same or similar content for others," so the clips aren't *exclusive* to us —
  irrelevant for spoken-word pronunciations.
- **The one real restriction — "Use Restrictions" (EEA/UK/Switzerland):** *"You may use only Paid Services
  when making API Clients available to users in the European Economic Area, Switzerland, or the United
  Kingdom."* → This restricts **making an API Client available to end-users** (i.e. real-time serving the
  Gemini API to users) in those regions. **This app does NOT do that**: the API is called **only at build
  time** by the developer to bake static MP3s; **no end-user ever calls Gemini at runtime** (sw.js never
  intercepts `/audio/*`; the model isn't in the shipped bundle). So shipping the pre-rendered clips is the
  developer's own build-time use, not distributing an API Client — the paid-only clause does not apply.
  (The developer is UK-based, but generating one's own assets ≠ "making an API Client available to users.")
- **Free-tier data handling — "Unpaid Services":** Google may use submitted content + generated responses
  to improve its products, with possible human review. Our inputs are **single dictionary words (no PII)**,
  so this is privacy-immaterial. Bonus: for UK/EEA/Swiss accounts the stricter **Paid-Services data terms
  apply to all Services** (including unpaid quota), so the data posture is actually the better one.
- **Preview models** (`gemini-*-tts-preview`): preview/pre-GA models may change or be discontinued and are
  "not recommended for production." Neutralized here because generation is **one-time and offline** — the
  shipped artifact is a plain MP3; model availability never touches the running app.

**Net:** ✅ Ship it. The app is also free + educational (lowest-risk profile). Re-check only if the app ever
starts calling Gemini **at runtime** for users (then the EEA/UK paid-only clause would bite), or if Google
revises these Additional Terms.
