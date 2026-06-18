// src/engine/profiles.js — PURE multi-profile container model + snapshots + sync merge.
//
// Siblings can share ONE device (and one family sync password) yet each needs their OWN
// progress, because what the game serves is driven entirely by that learner's mastery
// data (user 2026-06-18). So persistence is a CONTAINER:
//
//   { schema:2, syncCode, syncConsent, parentPassword, activeId, profiles:[ <profile> ] }
//
// FAMILY-level fields (shared across siblings): the sync password + consent, and the
// parent admin password. PER-PROFILE: everything that is the child's own game state
// (name, colour, kid-lock, start level, gems, stats, streak, catalog, specimens, the
// mastery tracker — serialized) plus dated SNAPSHOTS for parent rollback.
//
// This module is the pure, testable core (schema/migration/snapshots/merge); the
// localStorage orchestration + tracker (de)serialization live in state.js. Browser-agnostic.

export const SCHEMA = 2;
export const MAX_SNAPSHOTS = 6; // dated rollback points kept per profile

export function emptyContainer() {
  return { schema: SCHEMA, syncCode: null, syncConsent: false, parentPassword: null, activeId: null, profiles: [] };
}

export function isContainer(data) {
  return !!data && typeof data === 'object' && data.schema === SCHEMA && Array.isArray(data.profiles);
}

// A pre-multi-profile save = the bare single blob (profile/settings/tracker, no schema:2).
export function isLegacyBlob(data) {
  return !!data && typeof data === 'object' && !isContainer(data) &&
    ('settings' in data || 'tracker' in data || 'profile' in data || data.version === 1);
}

// Wrap a legacy single blob as ONE profile so an existing learner keeps everything.
// `id` is supplied by the caller (state.js makes a time-based id). Family-level sync
// fields are lifted out of the old per-blob settings.
export function migrateLegacy(blob, id) {
  const settings = blob.settings || {};
  const profile = { ...blob, id, name: (blob.profile && blob.profile.name) || 'Explorer', snapshots: [] };
  return {
    schema: SCHEMA,
    syncCode: settings.syncCode || null,
    syncConsent: !!settings.syncConsent,
    parentPassword: null,
    activeId: id,
    profiles: [profile],
  };
}

export function getProfile(container, id) {
  return (container.profiles || []).find((p) => p.id === id) || null;
}

export function activeProfile(container) {
  return getProfile(container, container.activeId);
}

// A light list for the "Who's playing?" screen — never exposes another kid's data.
export function profileSummaries(container) {
  return (container.profiles || []).map((p) => ({
    id: p.id,
    name: (p.profile && p.profile.name) || p.name || 'Explorer',
    themeColor: (p.settings && p.settings.themeColor) || p.themeColor || null,
    locked: !!p.kidLock,
  }));
}

// Append a dated snapshot (the serialized profile data) to a profile's rollback ring,
// keeping at most `max` (newest last). Pure: returns the new snapshots array.
export function pushSnapshot(snapshots, entry, max = MAX_SNAPSHOTS) {
  const next = Array.isArray(snapshots) ? snapshots.slice() : [];
  next.push(entry);
  return next.length > max ? next.slice(next.length - max) : next;
}

// Merge a REMOTE family (pulled from the cloud) into the LOCAL container: for each
// profile present on either side, keep the version chosen by `pick(localProfile,
// remoteProfile)` (the never-lose-progress reconcile, applied per profile). Profiles only
// on one side are carried through. Family-level fields stay LOCAL (this device's). Pure.
//   pick(localProfile|null, remoteProfile|null) -> the winning profile object
export function mergeFamily(localContainer, remoteContainer, pick) {
  const out = { ...localContainer, profiles: [] };
  const local = localContainer && Array.isArray(localContainer.profiles) ? localContainer.profiles : [];
  const remote = remoteContainer && Array.isArray(remoteContainer.profiles) ? remoteContainer.profiles : [];
  const ids = [...new Set([...local.map((p) => p.id), ...remote.map((p) => p.id)])];
  const lBy = new Map(local.map((p) => [p.id, p]));
  const rBy = new Map(remote.map((p) => [p.id, p]));
  out.profiles = ids.map((id) => pick(lBy.get(id) || null, rBy.get(id) || null)).filter(Boolean);
  return out;
}
