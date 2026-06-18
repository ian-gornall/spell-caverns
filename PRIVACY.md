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
- **Auto-sync to your Google Drive (optional, off by default)** — if the parent turns it
  on (Settings → Parents & privacy → pasting their own Google OAuth Client ID; see
  `CLOUD_SYNC_SETUP.md`), the backup is read/written directly from the browser to a
  **hidden, per-app folder in the parent's own Google Drive** (the minimal `drive.appdata`
  scope — the app cannot see any other Drive files). **No server we operate receives the
  data**; the access token is held in memory only (no secret, no backend). The parent can
  disconnect, or revoke access at myaccount.google.com/permissions, at any time.

## Why this is COPPA-compliant (and why the design is what it is)

The U.S. Children's Online Privacy Protection Act (COPPA) regulates **operators that collect
personal information from children over the internet**. Because Crystal Spell Caverns keeps
all data **on the child's own device** and **transmits nothing to a server we run**, we are
not collecting children's personal information online — which keeps the heaviest obligations
(verifiable parental consent flows, operator data retention, etc.) from attaching, while still
giving the parent full control (review via the data, export, and delete). This is the
**data-minimization-first** approach the FTC and the equivalent EU/UK/California regimes all
favour.

If an **automatic cloud-sync backend** is added later (so data syncs across devices without
the parent moving a file), that is a meaningful change in posture: storing a child's data on a
service we operate **would** make us an "operator" under COPPA and a "controller" under GDPR.
That path would require, at minimum:

- a clear, child-/parent-facing privacy policy published before collection;
- **verifiable parental consent** before any child data leaves the device;
- data **minimization** (store only pseudonymous gameplay data — no real names), purpose
  limitation, and a defined **retention/deletion** policy with an easy "delete my data" path;
- reasonable **security** (encryption in transit and at rest, access controls);
- for the EU/UK: a lawful basis + data-subject/erasure rights; for California: CCPA/CPRA
  notice + deletion rights.

Until/unless that is built and those requirements are met, sync stays **parent-controlled and
file-based** (above), which needs none of that machinery.

## Contact

This is a personal/educational project. Questions about data handling go to the project owner.
