// src/version.js — the single human-visible BUILD version of the app CODE.
//
// This is baked into the JS bundle, so whatever version the running app shows here is the
// version of the code actually loaded (not what's merely deployed). Settings displays it
// next to the SERVICE-WORKER cache version (see pwa.js / sw.js): if they differ, the PWA
// is serving a stale cache and an update is pending. KEEP THIS IN SYNC WITH sw.js VERSION
// on every deploy (bump both together).
export const APP_VERSION = 'csc-v47';
