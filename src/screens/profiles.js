// src/screens/profiles.js — "Who's playing?" profile picker (multi-user).
//
// Siblings share a device but each has their OWN progress, and what the game serves is
// driven by THAT learner's mastery — so a kid must pick their name when they start, in
// case it's a different child (user 2026-06-18). Shown on launch whenever more than one
// profile exists. A profile can be optionally kid-locked; if so we ask for its lock
// before switching (so one kid can't open another's account).
import { el, mascot, toast } from '../ui.js';
import { normalizeSyncCode } from '../engine/cloudsync.js';

export function profilesScreen(ctx) {
  const body = el('div', { class: 'onboard-body' });
  const screen = el('div', { class: 'screen onboarding profiles' }, body);
  const profiles = ctx.store.listProfiles();

  const enter = (id) => {
    ctx.store.switchProfile(id);
    ctx.refreshActive();
    ctx.nav('home');
  };

  // Tapping a profile: if it has a kid-lock, ask for it first (a simple typed code the
  // grown-up/kid set); otherwise enter straight away.
  const pick = (p) => {
    if (!p.locked) return enter(p.id);
    const guess = normalizeSyncCode(prompt(`${p.name}'s secret word?`) || '');
    if (guess && guess === ctx.store.getKidLock(p.id)) enter(p.id);
    else toast('That secret word doesn’t match. 🔒');
  };

  const cards = el(
    'div',
    { class: 'profile-grid' },
    ...profiles.map((p) =>
      el(
        'button',
        { class: 'profile-card', onClick: () => pick(p) },
        el('span', { class: 'profile-dot', style: { background: p.themeColor || 'var(--accent)' } }, p.locked ? '🔒' : ''),
        el('span', { class: 'profile-name' }, p.name),
      ),
    ),
    el(
      'button',
      { class: 'profile-card add', onClick: () => ctx.nav('onboarding') },
      el('span', { class: 'profile-dot' }, '＋'),
      el('span', { class: 'profile-name' }, 'Add explorer'),
    ),
  );

  body.replaceChildren(mascot("Who's playing today?"), cards);
  return screen;
}
