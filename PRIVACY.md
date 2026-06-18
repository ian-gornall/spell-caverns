# Privacy & Data — Crystal Spell Caverns

_Last updated 2026-06-18._

This app is built for children (ages ~5–13), so it is designed around **collecting as
little as possible and keeping it on the child's device**. This document explains exactly
what is stored, where, and the controls a parent/guardian has — and the compliance posture
behind those choices (COPPA, and the same principles satisfy GDPR-K, CCPA/CPRA, and the UK
Age Appropriate Design Code).

## What is stored, and where

**Everything is stored locally in the browser's `localStorage` on the device** — a single
JSON record. Nothing is sent to us or to any third party. There is **no account, no login,
no server that receives the data, no analytics, no advertising, and no tracking.**

The stored data is:

- An **explorer nickname** (free text the player types; intended as a nickname, **not a real
  name** — the app says so and never requires a real name).
- **Gameplay data only:** gems, daily streak, per-day play stats, which spelling words have
  been practised and their mastery scores, collected minerals, lab specimens (drawings the
  child makes), and in-app feedback notes.
- App settings (difficulty, voice, volume, colour, etc.).

No email, phone number, address, precise location, contacts, photos, microphone, or camera
data is collected. (Dictation uses the device's built-in text-to-speech to *speak* words; the
microphone is never used.)

## How a parent controls the data

In **Settings → Parents & privacy**:

- **Back up progress** — saves a backup *file* the parent keeps in **their own** cloud
  (e.g. iCloud Drive or Google Drive via the iOS Files app). This is how data is made durable
  and moved to another device. **The parent controls this file; we never receive it.**
- **Restore from backup** — loads a backup file on any device.
- **Delete all data** — erases everything on the device immediately.
- **Family sync (optional, off by default)** — if the parent turns it on (Settings →
  Parents & privacy → Family sync), progress syncs across the family's devices via a short
  **family code** the parent creates. The data is sent to a small serverless function we
  operate and stored (in Netlify Blobs) **keyed only by that opaque code** — see the next
  section for exactly what this means for compliance.

## Compliance — on-device by default; family sync is opt-in & minimized

The U.S. Children's Online Privacy Protection Act (COPPA) regulates **operators that collect
personal information from children online**. The equivalent regimes (EU/UK GDPR-K, California
CCPA/CPRA, the UK Age Appropriate Design Code) share the same core principles: data
minimization, transparency, parental control, deletion, and security.

**By default, nothing leaves the device.** With family sync OFF (the default), all data stays
in `localStorage` and is transmitted nowhere — so the heaviest operator obligations don't
attach, and the parent still has full control (the data is right there to review, plus export
and delete).

**With family sync ON, we do act as an operator, and we hold to those obligations:**

- **Verifiable parental consent** — sync cannot be enabled without the parent ticking a
  consent statement confirming they're the parent/guardian and agree to cloud storage.
- **Data minimization** — only **pseudonymous gameplay data** is sent: the chosen nickname
  (we explicitly ask for a nickname, not a real name) and scores/progress. **No real name, no
  email, no contact info, no device/advertising identifiers** are collected or sent. The cloud
  record is keyed solely by the opaque family code the parent chose.
- **Deletion & control** — **Delete cloud data** wipes the stored copy immediately; **Stop
  syncing** unlinks a device; turning consent off stops further syncing. (Right to erasure /
  CCPA deletion.)
- **Security** — all transfer is over HTTPS; the code is unguessable; there are no ads, no
  third-party sharing, and no tracking/profiling beyond what's needed to sync progress.
- **No conditioning** — the full game works without sync; it's purely an optional convenience.

This is a deliberately small, single-purpose collection (sync, nothing else). The family code
is the access key, so a parent should keep it private.

## Contact

This is a personal/educational project. Questions about data handling go to the project owner.
