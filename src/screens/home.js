// src/screens/home.js — the home menu: a few BIG themed buttons (UX.md §8).
//
// Play (rhythm mode) is the live path; Crystal Lab + Feedback are stubbed for now
// and surface a friendly "coming soon" toast (the engine for the Lab exists; the
// screen comes later in the build order). Progress + Settings are wired.
import { el, header, toast } from '../ui.js';

export function homeScreen(ctx) {
  const name = ctx.state.profile.name || 'Explorer';

  const cards = [
    el(
      'button',
      { class: 'menu-card play', onClick: () => ctx.nav('rhythm') },
      el('span', { class: 'ic' }, '⛏️'),
      el('span', { class: 'lbl' }, 'Play'),
      el('span', { class: 'desc' }, 'Mine gems by spelling the words you hear'),
    ),
    el(
      'button',
      { class: 'menu-card craft', onClick: () => ctx.nav('puzzle') },
      el('span', { class: 'ic' }, '🔨'),
      el('span', { class: 'lbl' }, 'Craft'),
      el('span', { class: 'desc' }, 'Build words from letter tiles'),
    ),
    el(
      'button',
      { class: 'menu-card soon', onClick: () => toast('Crystal Lab coming soon! 🔮') },
      el('span', { class: 'ic' }, '🔮'),
      el('span', { class: 'lbl' }, 'Crystal Lab'),
      el('span', { class: 'desc' }, 'Invent crystals'),
    ),
    el(
      'button',
      { class: 'menu-card', onClick: () => ctx.nav('progress') },
      el('span', { class: 'ic' }, '🗺️'),
      el('span', { class: 'lbl' }, 'Progress'),
      el('span', { class: 'desc' }, 'Your gems & map'),
    ),
    el(
      'button',
      { class: 'menu-card', onClick: () => ctx.nav('settings') },
      el('span', { class: 'ic' }, '⚙️'),
      el('span', { class: 'lbl' }, 'Settings'),
      el('span', { class: 'desc' }, 'Difficulty, voice & more'),
    ),
  ];

  return el(
    'div',
    { class: 'screen home' },
    header(ctx, {}),
    el(
      'div',
      { class: 'home-hero' },
      el('h1', { class: 'home-title' }, 'Crystal Spell Caverns'),
      el('p', { class: 'home-sub' }, `Welcome back, ${name}! Ready to mine some gems?`),
    ),
    el('div', { class: 'home-grid' }, ...cards),
  );
}
