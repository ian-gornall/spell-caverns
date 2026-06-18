// src/screens/progress.js — the transparent progress view (UX.md §8).
//
// Same view for kid AND parent (HANDOFF §4 — no separate teacher console). Shows
// gems, cavern depth, the mastery SPECTRUM (progress.summary buckets, as a
// friendly bar rather than raw numbers), and a tiny recent-days accuracy strip.
// Buckets are display-only — never a gate.
import { el, header, toast, burst } from '../ui.js';
import { summary, lapsedWords } from '../engine/progress.js';
import { mulberry32 } from '../engine/distractors.js';
import { dailyQuests, questProgress, allQuestsDone, openGeode } from '../engine/quests.js';

export function progressScreen(ctx) {
  const sum = summary(ctx.state.tracker);
  const { known, learning, shaky, tracked } = sum.counts;
  const total = Math.max(1, tracked);
  const pct = (n) => `${(n / total) * 100}%`;
  const crackedWords = lapsedWords(ctx.state.tracker);
  const cracked = crackedWords.length;
  const streak = ctx.state.streak || {};
  const records = ctx.state.records || {};

  const spectrum = el(
    'div',
    { class: 'spectrum' },
    el('span', { class: 'known', style: { width: pct(known) } }),
    el('span', { class: 'learning', style: { width: pct(learning) } }),
    el('span', { class: 'shaky', style: { width: pct(shaky) } }),
  );

  const legend = el(
    'div',
    { class: 'legend' },
    el('span', {}, el('i', { style: { background: 'var(--emerald)' } }), `Mastered (${known})`),
    el('span', {}, el('i', { style: { background: 'var(--amethyst)' } }), `Learning (${learning})`),
    el('span', {}, el('i', { style: { background: 'var(--slate)' } }), `Tricky (${shaky})`),
  );

  // recent-days accuracy strip
  const byDay = ctx.state.stats.byDay || {};
  const days = Object.keys(byDay).sort().slice(-7);
  const daysRow = days.length
    ? el(
        'div',
        { class: 'seg' },
        ...days.map((d) => {
          const { answers, correct } = byDay[d];
          const acc = answers ? Math.round((correct / answers) * 100) : 0;
          return el(
            'div',
            { class: 'stat', style: { flexDirection: 'column', gap: '2px' } },
            el('span', { style: { fontSize: '0.85rem', color: 'var(--ink-dim)' } }, d.slice(5)),
            el('span', {}, `${acc}%`),
          );
        }),
      )
    : el('p', { style: { color: 'var(--ink-dim)' } }, 'Play a dig to start your map!');

  return el(
    'div',
    { class: 'screen' },
    header(ctx, { title: 'Progress', onBack: () => ctx.nav('home') }),
    el(
      'div',
      { class: 'scroll' },
      el(
        'div',
        { class: 'panel' },
        el('h3', {}, 'Your haul'),
        el(
          'div',
          { class: 'seg' },
          el(
            'div',
            { class: 'stat', style: { flexDirection: 'column' } },
            el('span', { class: 'big-num' }, `💎 ${ctx.state.gems || 0}`),
            el('span', { style: { color: 'var(--ink-dim)' } }, 'gems mined'),
          ),
          el(
            'div',
            { class: 'stat', style: { flexDirection: 'column' } },
            el('span', { class: 'big-num' }, `⛏️ ${ctx.depth()}`),
            el('span', { style: { color: 'var(--ink-dim)' } }, 'cavern depth'),
          ),
          el(
            'div',
            { class: 'stat', style: { flexDirection: 'column' } },
            el('span', { class: 'big-num' }, `🔥 ${streak.count || 0}`),
            el('span', { style: { color: 'var(--ink-dim)' } }, `day streak${streak.longest ? ` · best ${streak.longest}` : ''}`),
          ),
        ),
      ),
      questsPanel(ctx),
      el(
        'div',
        { class: 'panel' },
        el('h3', {}, `Words explored (${tracked})`),
        spectrum,
        legend,
        cracked > 0 &&
          el(
            'div',
            { class: 'tricky' },
            ...crackedWords.slice(0, 12).map((w) => el('span', { class: 'tricky-word' }, w)),
            cracked > 12 && el('span', { class: 'tricky-word more' }, `+${cracked - 12}`),
          ),
        cracked > 0 &&
          el(
            'button',
            { class: 'btn', style: { marginTop: '14px', width: '100%' }, onClick: () => ctx.nav('puzzle', { review: true }) },
            `🔧 Repair ${cracked} cracked crystal${cracked === 1 ? '' : 's'}`,
          ),
      ),
      el(
        'div',
        { class: 'panel' },
        el('h3', {}, 'Personal bests'),
        el(
          'div',
          { class: 'seg' },
          el(
            'div',
            { class: 'stat', style: { flexDirection: 'column' } },
            el('span', { class: 'big-num' }, `⚡ ${records.bestCombo || 0}`),
            el('span', { style: { color: 'var(--ink-dim)' } }, 'best combo'),
          ),
          el(
            'div',
            { class: 'stat', style: { flexDirection: 'column' } },
            el('span', { class: 'big-num' }, `🏆 ${records.bestWaveGems || 0}`),
            el('span', { style: { color: 'var(--ink-dim)' } }, 'best haul'),
          ),
        ),
      ),
      el('div', { class: 'panel' }, el('h3', {}, 'Recent digs'), daysRow),
      specimenPanel(ctx),
    ),
  );
}

// Daily Cavern Quests + the all-complete "geode" bonus (research Tier 1 #4 / #8).
function questsPanel(ctx) {
  const today = new Date().toISOString().slice(0, 10);
  const quests = dailyQuests(today);
  const day = ctx.store.dayStats();
  const allDone = allQuestsDone(quests, day);
  const opened = ctx.store.geodeOpenedToday();

  const openGeodeNow = () => {
    const reward = openGeode(mulberry32((Date.now() >>> 0) || 1));
    ctx.store.addGems(reward.gems);
    ctx.store.markGeodeOpened();
    ctx.save();
    burst(window.innerWidth / 2, window.innerHeight / 2, reward.rare ? '#FFD23F' : '#36F1CD', reward.rare ? 32 : 18);
    toast(`🎁 Geode cracked: +${reward.gems} gems${reward.rare ? ' ✨ RARE crystal!' : ''}!`);
    ctx.nav('progress'); // re-render (geode now opened)
  };

  const rows = quests.map((q) => {
    const pr = questProgress(q, day);
    return el(
      'div',
      { class: 'quest' + (pr.done ? ' done' : '') },
      el('span', { class: 'quest-ic' }, pr.done ? '✅' : q.icon),
      el(
        'div',
        { class: 'quest-body' },
        el('div', { class: 'quest-text' }, q.text),
        el('div', { class: 'quest-bar' }, el('div', { class: 'quest-fill', style: { width: pr.pct + '%' } })),
      ),
      el('span', { class: 'quest-count' }, `${pr.have}/${pr.target}`),
    );
  });

  const footer =
    allDone && !opened
      ? el('button', { class: 'btn primary', style: { width: '100%', marginTop: '6px' }, onClick: openGeodeNow }, '🎁 Open your geode!')
      : opened
        ? el('p', { class: 'quest-note' }, '🎉 Geode opened — fresh quests tomorrow!')
        : el('p', { class: 'quest-note' }, 'Finish all three to crack open a geode! 🎁');

  return el('div', { class: 'panel' }, el('h3', {}, 'Daily quests'), ...rows, footer);
}

// The Specimen Collection — crystals invented, spelled & drawn in the Crystal Lab.
function specimenPanel(ctx) {
  const specimens = (ctx.state.specimens || []).slice().reverse(); // newest first
  const body = specimens.length
    ? el(
        'div',
        { class: 'specimen-grid' },
        ...specimens.map((s) =>
          el(
            'div',
            { class: 'specimen' },
            s.image
              ? el('img', { class: 'specimen-img', src: s.image, alt: s.name, loading: 'lazy' })
              : el('div', { class: 'specimen-img placeholder' }, '🔮'),
            el('div', { class: 'specimen-name' }, s.name || s.word),
          ),
        ),
      )
    : el(
        'p',
        { style: { color: 'var(--ink-dim)' } },
        'Visit the 🔮 Crystal Lab to invent, spell and draw your first crystal!',
      );
  return el(
    'div',
    { class: 'panel' },
    el('h3', {}, `Specimen collection (${specimens.length})`),
    body,
  );
}
