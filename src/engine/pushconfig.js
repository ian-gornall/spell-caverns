// src/engine/pushconfig.js — the ONE public Web-Push constant shared by the client
// (src/push.js, as the PushManager applicationServerKey) and the Worker (worker.js, as the
// VAPID "k=" header param). Single source of truth so the two can never drift.
//
// This is the PUBLIC half of the VAPID keypair — safe to ship in the bundle and commit. The
// matching PRIVATE key is NEVER in the repo: it lives only as the Worker secret VAPID_PRIVATE
// (see PUSH_SETUP.md). Rotating push identity = regenerate the pair, replace this + the secret.
export const VAPID_PUBLIC =
  'BOGZrxryDVDncRi2RJ6LpzSc42NxX0hZ6sLv7AZD6Is46vgMf6WhJJrFiKJ8au2shzAPyoFyyVYzKAipYrcRYmc';
