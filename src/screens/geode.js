// src/screens/geode.js — the DAILY GEODE reward (§C). When the day's quests are all
// done, the home/progress "Geode ready!" chip routes here. The kid TAPS to crack a
// glowing geode (a satisfying, guaranteed power-tap that bursts open), reveals a
// variable, always-positive gem bonus (engine/quests.openGeode — bigger the more
// geodes you've already cracked today), then the daily goals RESET HARDER for the next
// cycle — a ratcheting loop that keeps encouraging balanced, craft-leaning play.
//
// Reuses the Geode-Boss tap visuals (.geode / .crack-* / .boss-*). UI module — verified
// with Playwright, never imported by node --test.
import { el, header, burst, toast, mascot, createIdleGuard, pulse } from '../ui.js';
import { mulberry32 } from '../engine/distractors.js';
import { dailyQuests, openGeode } from '../engine/quests.js';

const TAPS_TO_CRACK = 5;

export function geodeScreen(ctx) {
  const { audio } = ctx;
  const today = new Date().toISOString().slice(0, 10);
  const round = ctx.store.geodeRound(); // geodes already cracked today (0 = first)

  const body = el('div', { class: 'boss-body' });
  const hdr = header(ctx, { title: 'Daily Geode', onBack: () => ctx.nav('home') });
  const gemCountEl = hdr.querySelector('.gem-count');
  const screen = el('div', { class: 'screen boss geode-day' }, hdr, body);

  let guard = null;
  const resetGuard = () => {
    if (guard) { guard.stop(); guard = null; }
  };
  ctx.onLeave(resetGuard);

  const bumpGems = () => {
    if (!gemCountEl) return;
    gemCountEl.textContent = String(ctx.state.gems || 0);
    gemCountEl.classList.remove('bump');
    void gemCountEl.offsetWidth;
    gemCountEl.classList.add('bump');
  };

  // --- phase 1: crack the geode --------------------------------------------
  function approach() {
    resetGuard();
    let taps = 0;
    let cracked = false;

    const geode = el(
      'button',
      { class: 'geode', onClick: () => tap() },
      el('div', { class: 'geode-glow' }),
      el('div', { class: 'geode-shell' }),
    );
    geode.style.setProperty('--crack', '0');
    const crackFill = el('div', { class: 'crack-fill' });

    function tap() {
      if (cracked) return;
      taps += 1;
      geode.style.setProperty('--crack', String(Math.min(1, taps / TAPS_TO_CRACK)));
      crackFill.style.width = `${Math.min(100, (taps / TAPS_TO_CRACK) * 100)}%`;
      audio.sfx(taps >= TAPS_TO_CRACK ? 'combo' : 'tap');
      geode.classList.remove('hit');
      void geode.offsetWidth;
      geode.classList.add('hit');
      const r = geode.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + r.height / 2, '#FFD23F', 7);
      if (taps >= TAPS_TO_CRACK) {
        cracked = true;
        crack(geode);
      }
    }

    body.replaceChildren(
      mascot(
        round === 0
          ? "You did it — all your quests are done! Tap to crack open today's geode!"
          : "Another geode?! You're on fire today. Tap to crack it open!",
      ),
      geode,
      el('div', { class: 'crack-meter' }, crackFill),
      el('p', { class: 'boss-hint' }, '⛏️ Tap the geode to crack it!'),
    );
    audio.say('Your daily geode! Tap to crack it open!');

    guard = createIdleGuard({
      nudgeMs: 11000,
      pauseMs: 24000,
      onNudge: () => {
        if (cracked) return;
        pulse(geode);
        toast('⛏️ Tap the geode to crack it open!');
      },
      onTimeout: () => {
        if (!cracked) { cracked = true; crack(geode); }
      },
    });
  }

  // --- crack → grant + reveal ----------------------------------------------
  function crack(geode) {
    resetGuard();
    audio.sfx('combo');
    const reward = openGeode(mulberry32((Date.now() >>> 0) || 1), { round });
    const r = geode.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2, reward.rare ? '#FFD23F' : '#36F1CD', reward.rare ? 46 : 30);
    geode.classList.add('cracked');
    ctx.store.addGems(reward.gems);
    ctx.store.markGeodeOpened(); // advances the round → next goals are harder
    ctx.save();
    bumpGems();
    setTimeout(() => reveal(reward), 520);
  }

  // --- phase 2: reveal the bonus + the next (harder) goals ------------------
  function reveal(reward) {
    // The next cycle's goals (this round is now cracked, so round+1 is "next").
    const nextRound = round + 1;
    const nextGoals = dailyQuests(today, { round: nextRound });

    const goalRows = nextGoals.map((q) =>
      el(
        'div',
        { class: 'geode-goal' + (q.craft ? ' craft' : '') },
        el('span', { class: 'geode-goal-ic' }, q.icon),
        el('span', { class: 'geode-goal-text' }, q.text),
      ),
    );

    body.replaceChildren(
      el('div', { class: 'boss-burst' }, el('div', { class: 'boss-emoji' }, reward.rare ? '🌟' : '💎')),
      el('h2', { class: 'boss-crystal-name' }, reward.rare ? 'Rare geode!' : 'Geode cracked!'),
      el('div', { class: 'earned' }, `+${reward.gems} gems!  ·  Total 💎 ${ctx.state.gems || 0}`),
      el('div', { class: 'depth-banner' }, '⛏️ New goals unlocked — tougher this time!'),
      el('div', { class: 'geode-goals' }, ...goalRows),
      mascot('Crafting earns the biggest gems! 🔨'),
      el(
        'div',
        { class: 'row' },
        el('button', { class: 'btn primary', onClick: () => ctx.nav('puzzle') }, '🔨 Keep crafting'),
        el('button', { class: 'btn', onClick: () => ctx.nav('progress') }, '🗺️ Quests'),
        el('button', { class: 'btn', onClick: () => ctx.nav('home') }, '🏠 Home'),
      ),
    );
    audio.say(reward.rare ? 'A rare geode! Amazing!' : 'Geode cracked! New goals unlocked.');

    guard = createIdleGuard({
      nudgeMs: 14000,
      pauseMs: 32000,
      onNudge: () => pulse(screen.querySelector('.btn.primary')),
      onTimeout: () => { toast('🔨 Let’s craft!'); ctx.nav('puzzle'); },
    });
  }

  approach();
  return screen;
}
