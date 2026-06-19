// src/screens/profiles.js — "Who's playing?" profile picker (multi-user).
//
// Siblings share a device but each has their OWN progress, and what the game serves is
// driven by THAT learner's mastery — so a kid must pick their name when they start, in
// case it's a different child (user 2026-06-18). Shown on launch whenever more than one
// profile exists. A profile can be optionally kid-locked; if so we ask for its picture
// lock before switching (so one kid can't open another's account).
import { el, mascot, toast, picturePad } from '../ui.js';

export function profilesScreen(ctx) {
  const body = el('div', { class: 'onboard-body' });
  const screen = el('div', { class: 'screen onboarding profiles' }, body);
  const profiles = ctx.store.listProfiles();

  const enter = (id) => {
    ctx.store.switchProfile(id);
    ctx.refreshActive();
    ctx.nav('home');
  };

  // Tapping a locked profile: show the picture pad inline (replacing the grid). On a
  // correct match → enter; on wrong → shake + toast + let them retry.
  const pick = (p) => {
    if (!p.locked) return enter(p.id);

    const lockCode = ctx.store.getKidLock(p.id);
    const padWrapper = el('div', { class: 'lock-pad-wrap' });

    const showPad = () => {
      padWrapper.replaceChildren(
        mascot(`Enter ${p.name}'s picture lock`),
        picturePad({
          onComplete: (code) => {
            if (code === lockCode) {
              enter(p.id);
            } else {
              padWrapper.classList.add('shake');
              setTimeout(() => padWrapper.classList.remove('shake'), 450);
              toast('Oops, try again 🔒');
              showPad(); // fresh pad so they can try again
            }
          },
        }),
        el(
          'button',
          {
            class: 'btn ghost',
            style: { marginTop: '16px' },
            onClick: () => { body.replaceChildren(mascot("Who's playing today?"), cards); },
          },
          '← Back',
        ),
      );
      body.replaceChildren(padWrapper);
    };

    showPad();
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
