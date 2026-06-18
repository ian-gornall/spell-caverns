// src/cloud_drive.js — Google Drive sync adapter (NO backend).
//
// The backup file lives in the PARENT's own Google Drive, in the hidden, per-app
// `appDataFolder` — so we (a) never run a server that holds the child's data and (b)
// can't even see the rest of the user's Drive (the minimal `drive.appdata` scope). This
// keeps the COPPA-minimizing posture (see PRIVACY.md) while giving near-automatic
// cross-device sync.
//
// Auth is client-side via Google Identity Services (a public OAuth Client ID only — no
// secret, no backend). The GIS script is lazy-loaded ONLY when the parent chooses to
// connect, so normal play loads zero third-party code. Access tokens are short-lived and
// kept in memory only (never persisted); GIS can re-issue one silently while the Google
// session is alive, else it prompts. UI module — not imported by `node --test`; the pure
// push/pull decision is engine/cloudsync.js.
import { reconcile } from './engine/cloudsync.js';

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const FILE_NAME = 'crystal-spell-backup.json';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';

let gisPromise = null;
let tokenClient = null;
let accessToken = null;
let tokenClientId = null;

function loadGis() {
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve();
    const s = document.createElement('script');
    s.src = GIS_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load Google sign-in.'));
    document.head.appendChild(s);
  });
  return gisPromise;
}

export function isConnected() {
  return !!accessToken;
}

// Obtain an access token for `clientId`. interactive=false tries SILENTLY (no popup) —
// used for best-effort sync on app open; interactive=true shows the Google consent/
// account picker (used when the parent taps "Connect"). Resolves true on success.
export async function connect(clientId, { interactive = true } = {}) {
  if (!clientId) throw new Error('No Google Client ID configured.');
  await loadGis();
  if (!tokenClient || tokenClientId !== clientId) {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: () => {}, // replaced per-request below
    });
    tokenClientId = clientId;
  }
  return new Promise((resolve, reject) => {
    tokenClient.callback = (resp) => {
      if (resp && resp.access_token) {
        accessToken = resp.access_token;
        resolve(true);
      } else {
        reject(new Error(resp?.error || 'Google sign-in was cancelled.'));
      }
    };
    try {
      tokenClient.requestAccessToken({ prompt: interactive ? '' : 'none' });
    } catch (e) {
      reject(e);
    }
  });
}

export function disconnect() {
  try {
    if (accessToken && window.google?.accounts?.oauth2) {
      window.google.accounts.oauth2.revoke(accessToken, () => {});
    }
  } catch {
    /* ignore */
  }
  accessToken = null;
}

async function authed(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { Authorization: `Bearer ${accessToken}`, ...(opts.headers || {}) },
  });
  if (!res.ok) throw new Error(`Drive request failed (${res.status})`);
  return res;
}

async function findFileId() {
  const q = encodeURIComponent(`name='${FILE_NAME}'`);
  const res = await authed(`${API}/files?spaces=appDataFolder&q=${q}&fields=files(id,modifiedTime)`);
  const j = await res.json();
  return j.files && j.files.length ? j.files[0].id : null;
}

// Download the backup envelope from Drive, or null if none exists yet.
export async function download() {
  const id = await findFileId();
  if (!id) return null;
  const res = await authed(`${API}/files/${id}?alt=media`);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// Upload the backup envelope (a JSON string) to Drive — create the file in
// appDataFolder, or update it in place if it already exists.
export async function upload(jsonString) {
  const id = await findFileId();
  if (id) {
    await authed(`${UPLOAD}/files/${id}?uploadType=media`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: jsonString,
    });
    return id;
  }
  const boundary = 'cscboundary' + String(jsonString.length);
  const metadata = JSON.stringify({ name: FILE_NAME, parents: ['appDataFolder'] });
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${jsonString}\r\n--${boundary}--`;
  const res = await authed(`${UPLOAD}/files?uploadType=multipart&fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  return (await res.json()).id;
}

// Orchestrate one sync: ensure connected, fetch the remote, reconcile against the local
// envelope (never-lose-progress rule in engine/cloudsync.js), then push or pull.
//   getLocal()    -> the local backup envelope (parsed object)
//   applyRemote(e)-> adopt a pulled remote envelope locally (state.importData)
// Returns { action, reason }. Throws on auth/network failure (caller shows a toast).
export async function syncNow({ clientId, getLocal, applyRemote, interactive = true }) {
  if (!isConnected()) await connect(clientId, { interactive });
  const remote = await download();
  const local = getLocal();
  const { action, use, reason } = reconcile(local, remote);
  if (action === 'push') await upload(JSON.stringify(local));
  else if (action === 'pull') applyRemote(use);
  return { action, reason };
}
