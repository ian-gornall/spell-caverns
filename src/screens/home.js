// src/screens/home.js — the home menu: a few BIG themed buttons (UX.md §8).
//
// Play (rhythm mode) is the live path; Crystal Lab + Feedback are stubbed for now
// and surface a friendly "coming soon" toast (the engine for the Lab exists; the
// screen comes later in the build order). Progress + Settings are wired.
import { el, header, toast, createIdleGuard, pulse } from '../ui.js';
import { lapsedWords } from '../engine/progress.js';
import { streakIsLive } from '../engine/streak.js';

export function homeScreen(ctx) {
  const name = ctx.state.profile.name || 'Explorer';
  const cracked = lapsedWords(ctx.state.tracker).length;

  // Daily streak ("glowing vein") + a tiny daily gem goal — guilt-free momentum.
  const streak = ctx.state.streak || {};
  const today = new Date().toISOString().slice(0, 10);
  const live = streakIsLive(streak, today);
  const goal = ctx.state.settings.dailyGoalGems || 80;
  const gemsToday = ctx.store.gemsToday();
  const goalMet = gemsToday >= goal;
  const goalPct = Math.min(100, Math.round((gemsToday / goal) * 100));
  const streakStrip = el(
    'div',
    { class: 'home-streak' },
    el(
      'div',
      { class: 'streak-row' },
      streak.count > 0 &&
        el('div', { class: 'streak-chip' + (live ? ' lit' : '') }, `🔥 ${streak.count}-day streak`),
      streak.freezes > 0 && el('div', { class: 'streak-chip lantern' }, `🏮 ×${streak.freezes}`),
    ),
    el(
      'div',
      { class: 'goal' },
      el('div', { class: 'goal-bar' }, el('div', { class: 'goal-fill', style: { width: goalPct + '%' } })),
      el(
        'div',
        { class: 'goal-label' },
        goalMet ? "✨ Today's goal done — nice!" : `Today: 💎 ${gemsToday} / ${goal}`,
      ),
    ),
  );

  const cards = [
    el(
      'button',
      { class: 'menu-card play', onClick: () => ctx.nav('rhythm') },
      el('span', { class: 'ic' }, '⛏️'),
      el('span', { class: 'lbl' }, 'Play'),
      el('span', { class: 'desc' }, 'Mine gems by spelling the words you hear'),
    ),
    // Cracked crystals = words the learner missed. Surface a repair path (production
    // practice of exactly those words) only when there are some to fix.
    cracked > 0 &&
      el(
        'button',
        { class: 'menu-card repair', onClick: () => ctx.nav('puzzle', { review: true }) },
        el('span', { class: 'ic' }, '🔧'),
        el('span', { class: 'lbl' }, `Repair${cracked >= 1 ? ` (${cracked})` : ''}`),
        el('span', { class: 'desc' }, 'Re-spell the crystals you cracked'),
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
      { class: 'menu-card lab', onClick: () => ctx.nav('lab') },
      el('span', { class: 'ic' }, '🔮'),
      el('span', { class: 'lbl' }, 'Crystal Lab'),
      el('span', { class: 'desc' }, 'Invent, spell & draw crystals'),
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
    el(
      'button',
      { class: 'menu-card feedback', onClick: () => ctx.nav('feedback') },
      el('span', { class: 'ic' }, '💬'),
      el('span', { class: 'lbl' }, 'Feedback'),
      el('span', { class: 'desc' }, 'Tell us what you think'),
    ),
  ];

  const node = el(
    'div',
    { class: 'screen home' },
    header(ctx, {}),
    el(
      'div',
      { class: 'home-hero' },
      el('h1', { class: 'home-title' }, 'Crystal Spell Caverns'),
      el('p', { class: 'home-sub' }, `Welcome back, ${name}! Ready to mine some gems?`),
      streakStrip,
    ),
    el('div', { class: 'home-grid' }, ...cards),
  );

  // Don't let them stare at the menu: highlight Play, then auto-start mining ("let's
  // go!"). iOS unlocks audio only on a tap, so BEFORE the first tap we can't start the
  // dictated game — we just keep highlighting Play until they tap once; after that, an
  // idle menu auto-drops them straight into a wave.
  const guard = createIdleGuard({
    nudgeMs: 13000,
    pauseMs: 32000,
    onNudge: () => {
      pulse(node.querySelector('.menu-card.play'));
      toast('💎 Ready to mine some gems? Tap Play!');
    },
    onTimeout: () => {
      if (ctx.audio.isPrimed && ctx.audio.isPrimed()) {
        toast('⛏️ Let’s go mining!');
        ctx.nav('rhythm');
      } else {
        pulse(node.querySelector('.menu-card.play'));
        toast('👆 Tap Play to hear your first word!');
        guard.poke(); // keep gently highlighting until they tap (audio needs a gesture)
      }
    },
  });
  ctx.onLeave(() => guard.stop());

  return node;
}
