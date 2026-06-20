// src/screens/boss.js — the GEODE BOSS: a milestone celebration when the learner
// breaks through to a new cavern depth (every 8 mastered words). Light narrative
// spine (engine/narrative.js: named zones) + an always-positive reward moment — NOT
// a fail-able fight (RESEARCH.md guardrails: milestones are celebrations, not gates).
//
// Flow: Geo announces a Great Geode blocking the way down → the kid TAPS to crack it
// (a satisfying Brotato-style power-tap; guaranteed to crack, auto-cracks if idle) →
// it bursts open to reveal the milestone mineral (granted free into the Catalog) +
// a bonus + the new zone's name & flavour. Then "descend deeper" continues play.
//
// UI module — verified with Playwright, never imported by node --test.
import { el, header, burst, toast, mascot, createIdleGuard, pulse } from '../ui.js';
import { zoneForDepth, bossAnnounce } from '../engine/narrative.js';
import { crystalSvg } from '../engine/catalog.js';
import { UI } from '../engine/ui_phrases.js';

const TAPS_TO_CRACK = 6;

export function bossScreen(ctx, params = {}) {
  const { audio } = ctx;
  const depth = params.depth || ctx.depth();
  const zone = zoneForDepth(depth);
  const from = params.from && ctx.nav ? params.from : 'home';
  const bonus = 40 + depth * 10; // a celebratory, always-positive milestone bonus

  const body = el('div', { class: 'boss-body' });
  const hdr = header(ctx, { title: 'Geode Boss', onBack: () => ctx.nav('home') });
  const gemCountEl = hdr.querySelector('.gem-count');
  const screen = el('div', { class: 'screen boss' }, hdr, body);

  let guard = null;
  const resetGuard = () => {
    if (guard) {
      guard.stop();
      guard = null;
    }
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
      burst(r.left + r.width / 2, r.top + r.height / 2, '#FFD23F', 6);
      if (taps >= TAPS_TO_CRACK) {
        cracked = true;
        crack(geode);
      }
    }

    body.replaceChildren(
      mascot(`A Great Geode blocks the way down to ${zone.name}. Crack it open!`),
      geode,
      el('div', { class: 'crack-meter' }, crackFill),
      el('p', { class: 'boss-hint' }, '⛏️ Tap the geode to crack it!'),
    );
    audio.say(UI.greatGeode);

    guard = createIdleGuard({
      nudgeMs: 12000,
      pauseMs: 26000,
      onNudge: () => {
        if (cracked) return;
        pulse(geode);
        toast('⛏️ Tap the geode to crack it open!');
      },
      onTimeout: () => {
        if (!cracked) {
          cracked = true;
          crack(geode);
        }
      },
    });
  }

  // --- crack → grant + reveal ----------------------------------------------
  function crack(geode) {
    resetGuard();
    audio.sfx('combo');
    const r = geode.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2, '#FFD23F', 40);
    geode.classList.add('cracked');
    // grant the milestone mineral (idempotent per depth) + the bonus
    const crystal = ctx.store.grantMilestoneCrystal(depth);
    ctx.store.addGems(bonus);
    ctx.save();
    bumpGems();
    setTimeout(() => reveal(crystal), 520);
  }

  // --- phase 2: reveal the new zone + mineral ------------------------------
  function reveal(crystal) {
    const line = bossAnnounce(depth);
    body.replaceChildren(
      el('div', { class: 'depth-banner' }, `⛏️ Depth ${depth} — ${zone.name}`),
      el(
        'div',
        { class: 'boss-burst' },
        crystal
          ? el('div', { class: 'crystal-art big', html: crystalSvg(crystal, { size: 168 }) })
          : el('div', { class: 'boss-emoji' }, '💠'),
      ),
      crystal && el('h2', { class: 'boss-crystal-name' }, crystal.name),
      crystal && el('p', { class: 'boss-fact' }, crystal.fact),
      mascot(line, { mood: 'cheer' }),
      el('div', { class: 'earned' }, `+${bonus} bonus gems!  ·  Total 💎 ${ctx.state.gems || 0}`),
      el(
        'div',
        { class: 'row' },
        el('button', { class: 'btn primary', onClick: () => ctx.nav(from) }, '⛏️ Descend deeper'),
        crystal && el('button', { class: 'btn', onClick: () => ctx.nav('catalog') }, '💠 Catalog'),
        el('button', { class: 'btn', onClick: () => ctx.nav('home') }, '🏠 Home'),
      ),
    );
    audio.say(line);

    // don't let them stall on the reveal — gently pulse Descend, then auto-continue
    guard = createIdleGuard({
      nudgeMs: 14000,
      pauseMs: 32000,
      onNudge: () => pulse(screen.querySelector('.btn.primary')),
      onTimeout: () => {
        toast('⛏️ Onward!');
        ctx.nav(from);
      },
    });
  }

  approach();
  return screen;
}
