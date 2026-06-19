// src/screens/home.js — the home menu: a few BIG themed buttons (UX.md §8).
//
// Play (rhythm mode) is the live path; Crystal Lab + Feedback are stubbed for now
// and surface a friendly "coming soon" toast (the engine for the Lab exists; the
// screen comes later in the build order). Progress + Settings are wired.
import { el, header, toast, createIdleGuard, pulse } from '../ui.js';
import { lapsedWords } from '../engine/progress.js';
import { unlocks } from '../engine/categories.js';
import { streakIsLive, daysSinceLastPlayed } from '../engine/streak.js';
import { dailyQuests, questProgress } from '../engine/quests.js';
import { catalogSummary, affordableLocked } from '../engine/catalog.js';

export function homeScreen(ctx) {
  const name = ctx.state.profile.name || 'Explorer';
  const cracked = lapsedWords(ctx.state.tracker).length;
  const owned = ctx.store.ownedCrystals();
  const cat = catalogSummary(owned);
  const canUnlock = affordableLocked(owned, ctx.state.gems || 0).length;
  // §30 unlock chain: Craft (always) → Mastery (after [set size] known) → Mining (gated).
  const gates = unlocks(ctx.state.categories);

  // Daily streak ("glowing vein") + a tiny daily gem goal — guilt-free momentum.
  const streak = ctx.state.streak || {};
  const today = new Date().toISOString().slice(0, 10);
  const live = streakIsLive(streak, today);
  const awayDays = daysSinceLastPlayed(streak, today);

  // In-app re-engagement (§17.A MVP — no backend / push): a warm, contextual welcome
  // line that recognises a returning learner. Streak-aware and never guilt-trippy.
  let greeting = `Welcome back, ${name}! Ready to spell some sparkly words?`;
  if (awayDays >= 1 && awayDays !== Infinity) {
    if (awayDays === 1) {
      greeting = `Welcome back, ${name}! A new day of digging awaits. 💎`;
    } else if (streak.freezes > 0 && awayDays === 2) {
      greeting = `Welcome back, ${name}! It's been ${awayDays} days — a 🏮 lantern is keeping your streak glowing. Let's dig!`;
    } else if (awayDays <= 7) {
      greeting = `Welcome back, ${name}! It's been ${awayDays} days — let's get back to mining. ⛏️`;
    } else {
      greeting = `Welcome back, ${name}! It's been a while — the caverns missed you. Let's dig! ⛏️`;
    }
  }
  const goal = ctx.state.settings.dailyGoalGems || 250;
  const gemsToday = ctx.store.gemsToday();
  const goalMet = gemsToday >= goal;
  const goalPct = Math.min(100, Math.round((gemsToday / goal) * 100));
  // Daily quests summary (full list lives on Progress). The "round" ratchets each time
  // a geode is cracked today, so the goals get harder (§C). Opening the geode advances
  // the round → the new (harder) quests aren't done yet, so "ready" naturally resets.
  const round = ctx.store.geodeRound();
  const quests = dailyQuests(today, { round });
  const questsDone = quests.filter((q) => questProgress(q, ctx.store.dayStats()).done).length;
  const geodeReady = questsDone === quests.length;

  const streakStrip = el(
    'div',
    { class: 'home-streak' },
    el(
      'div',
      { class: 'streak-row' },
      streak.count > 0 &&
        el('div', { class: 'streak-chip' + (live ? ' lit' : '') }, `🔥 ${streak.count}-day streak`),
      streak.freezes > 0 && el('div', { class: 'streak-chip lantern' }, `🏮 ×${streak.freezes}`),
      el(
        'button',
        { class: 'streak-chip quest-chip' + (geodeReady ? ' lit' : ''), onClick: () => ctx.nav(geodeReady ? 'geode' : 'progress') },
        geodeReady ? '🎁 Geode ready!' : `🎯 Quests ${questsDone}/${quests.length}`,
      ),
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
    // CRAFT is the headline act (§B): spelling a word from scratch is the assessment —
    // the thing we most want kids to do and prove — so it's the full-width hero AND the
    // best-paying path (gems carry the craft bonus). Mining is reframed as practice.
    el(
      'button',
      { class: 'menu-card craft hero', onClick: () => ctx.nav('puzzle') },
      el('span', { class: 'badge' }, '✨ Best gems'),
      el('span', { class: 'ic' }, '🔨'),
      el('span', { class: 'lbl' }, 'Craft'),
      el('span', { class: 'desc' }, 'Spell the words yourself and prove you know them'),
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
    // §30 MASTERY (draw): the headline test — spell a word by DRAWING each letter from memory.
    // Unlocks once enough words are KNOWN from crafting (the unlock chain's middle rung).
    gates.mastery &&
      el(
        'button',
        { class: 'menu-card mastery', onClick: () => ctx.nav('mastery') },
        el('span', { class: 'badge' }, '⭐ Master it'),
        el('span', { class: 'ic' }, '✍️'),
        el('span', { class: 'lbl' }, 'Mastery'),
        el('span', { class: 'desc' }, 'Draw the letters from memory — no tiles!'),
      ),
    // Mining is RECOGNITION practice — fast, fun, low-stakes warm-up. Kept engaging but
    // clearly secondary to crafting (§B): the calmer, shorter "practice" banner.
    el(
      'button',
      { class: 'menu-card play practice' + (gates.mining ? '' : ' locked'), onClick: () => ctx.nav('rhythm') },
      el('span', { class: 'ic' }, gates.mining ? '⛏️' : '🔒'),
      el('span', { class: 'lbl' }, 'Practice'),
      el('span', { class: 'desc' }, gates.mining ? 'Warm up — spell the words you hear' : 'Master words in Mastery to unlock fast mining'),
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
      { class: 'menu-card catalog' + (canUnlock ? ' has-unlock' : ''), onClick: () => ctx.nav('catalog') },
      el('span', { class: 'ic' }, '💠'),
      el('span', { class: 'lbl' }, 'Catalog'),
      el('span', { class: 'desc' }, canUnlock ? `${canUnlock} ready to unlock! · ${cat.owned}/${cat.total}` : `Collect minerals with gems · ${cat.owned}/${cat.total}`),
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
      el('p', { class: 'home-sub' }, greeting),
      streakStrip,
    ),
    el('div', { class: 'home-grid' }, ...cards),
  );

  // Don't let them stare at the menu: highlight CRAFT (the headline act, §B), then
  // auto-start a crafting round. iOS unlocks audio only on a tap, so BEFORE the first
  // tap we can't start the dictated game — we just keep highlighting Craft until they
  // tap once; after that, an idle menu auto-drops them straight into crafting.
  const guard = createIdleGuard({
    nudgeMs: 13000,
    pauseMs: 32000,
    onNudge: () => {
      pulse(node.querySelector('.menu-card.craft'));
      toast('✨ Ready to craft some words? Tap Craft!');
    },
    onTimeout: () => {
      if (ctx.audio.isPrimed && ctx.audio.isPrimed()) {
        toast('🔨 Let’s craft some words!');
        ctx.nav('puzzle');
      } else {
        pulse(node.querySelector('.menu-card.craft'));
        toast('👆 Tap Craft to hear your first word!');
        guard.poke(); // keep gently highlighting until they tap (audio needs a gesture)
      }
    },
  });
  ctx.onLeave(() => guard.stop());

  return node;
}
