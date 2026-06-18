# Optional: turn on Google Drive auto-sync

Crystal Spell Caverns can automatically sync a child's progress across devices by
storing a backup in **your own Google Drive** — in a hidden, per-app folder that only
this app can see. **No server we run ever receives the data** (that's what keeps it
COPPA-compliant; see `PRIVACY.md`). It's optional: without this, you can still back up
and restore a file manually (Settings → Parents & privacy).

This is a free, one-time, ~5-minute setup. You'll create a Google "OAuth Client ID" and
paste it into the app.

## Prerequisites

- The app must be served over **HTTPS at a stable URL** (see the Deploy section of
  `README.md`). Google sign-in won't work from a plain `http://` LAN address. (For local
  testing, `http://localhost:5173` is allowed by Google.)
- A Google account (the parent's).

## Steps

1. Go to the **Google Cloud Console** → <https://console.cloud.google.com/> and create a
   project (any name).
2. **APIs & Services → Library** → enable the **Google Drive API**.
3. **APIs & Services → OAuth consent screen** (newer consoles call this **Google Auth
   Platform → Branding / Audience**):
   - User type **External**, fill the app name + your email.
   - Add yourself as a **Test user** (your Google account). Leave it in "Testing" mode —
     fine for personal/family use; no Google verification needed.
   - **You do NOT need to add a scope here.** The app requests the `drive.appdata` scope
     **at runtime** (you approve it on the Google popup when you tap Connect), and a test
     user can grant it without pre-registering it. (Scopes now live under **Data Access**;
     only touch it if Connect ever complains about a missing scope — then add
     `.../auth/drive.appdata` there and retry.)
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID** (this screen
   has NO scope field — just the origins below; that's expected):
   - Application type **Web application**.
   - Under **Authorized JavaScript origins**, add your app's exact origin, e.g.
     `https://your-app.netlify.app` (and `http://localhost:5173` if you want to test
     locally). No redirect URI is needed (the app uses the token model).
   - Create, then **copy the Client ID** (looks like `1234-abc.apps.googleusercontent.com`).
5. In the app: **Settings → Parents & privacy → Auto-sync to your Google Drive** → paste
   the Client ID → tap **Connect Google Drive** → choose your Google account.
   - You'll see **"Google hasn't verified this app"** — that's normal in Testing mode (it's
     your own app). Tap **Advanced → Go to (app) (unsafe)**, then **Allow** the
     "see, create, and delete its own configuration data in your Drive" permission.

That's it. After connecting, the app:

- **pulls** the latest progress when it opens (silently, if your Google session is live),
- lets you **Sync now** any time from Settings, and
- keeps the file in your Drive's hidden `appDataFolder` (find it under Drive → Settings →
  *Manage Apps*; you can delete it there to wipe the cloud copy).

## How conflicts are handled

If two devices both have progress, sync keeps the copy with **more learning history**
(more words answered), breaking ties by which was saved more recently — so it never
silently throws away the more-advanced device. (Two devices played heavily *offline* at
the same time is the only lossy case; rare for one learner. The manual file backup is
always there as a belt-and-braces safety net.)

## Privacy

- Scope is **`drive.appdata` only** — the app cannot see or touch any of your other Drive
  files, just its own hidden backup.
- The access token lives in memory only and is never stored; there's no client secret and
  no backend.
- Disconnect any time (Settings → Disconnect), or revoke at
  <https://myaccount.google.com/permissions>.
