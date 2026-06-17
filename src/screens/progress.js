// src/screens/progress.js — the transparent progress view (UX.md §8).
//
// Same view for kid AND parent (HANDOFF §4 — no separate teacher console). Shows
// gems, cavern depth, the mastery SPECTRUM (progress.summary buckets, as a
// friendly bar rather than raw numbers), and a tiny recent-days accuracy strip.
// Buckets are display-only — never a gate.
import { el, header } from '../ui.js';
import { summary } from '../engine/progress.js';

export function progressScreen(ctx) {
  const sum = summary(ctx.state.tracker);
  const { known, learning, shaky, tracked } = sum.counts;
  const total = Math.max(1, tracked);
  const pct = (n) => `${(n / total) * 100}%`;

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
        ),
      ),
      el(
        'div',
        { class: 'panel' },
        el('h3', {}, `Words explored (${tracked})`),
        spectrum,
        legend,
      ),
      el('div', { class: 'panel' }, el('h3', {}, 'Recent digs'), daysRow),
    ),
  );
}
