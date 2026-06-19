// src/screens/progress.js — the transparent progress view (UX.md §8).
//
// Same view for kid AND parent (HANDOFF §4 — no separate teacher console). Shows
// gems, cavern depth, the mastery SPECTRUM (progress.summary buckets, as a
// friendly bar rather than raw numbers), and a tiny recent-days accuracy strip.
// Buckets are display-only — never a gate.
import { el, header, toast } from '../ui.js';
import { summary, lapsedWords } from '../engine/progress.js';
import { dailyQuests, questProgress, allQuestsDone } from '../engine/quests.js';
import { catalogSummary } from '../engine/catalog.js';

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
      cavernMap(ctx),
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
      catalogPanel(ctx),
      specimenPanel(ctx),
    ),
  );
}

// A compact Crystal Catalog summary + jump-in button (full collection on its screen).
function catalogPanel(ctx) {
  const sum = catalogSummary(ctx.store.ownedCrystals());
  const pct = Math.round((sum.owned / sum.total) * 100);
  return el(
    'div',
    { class: 'panel' },
    el('h3', {}, `Crystal Catalog (${sum.owned}/${sum.total})`),
    el('div', { class: 'goal-bar' }, el('div', { class: 'goal-fill', style: { width: pct + '%' } })),
    el(
      'button',
      { class: 'btn', style: { marginTop: '14px', width: '100%' }, onClick: () => ctx.nav('catalog') },
      '💠 Open your Crystal Catalog',
    ),
  );
}

// Cavern map — a visual "how deep have I dug" path with "you are here" + the next
// level as the goal (research Tier 2 #7: goal-gradient + endowed progress). Depth =
// 1 + floor(known/8), matching app.js, so it's never at a bare zero (Depth 1 is lit).
const WORDS_PER_DEPTH = 8;
function cavernMap(ctx) {
  const known = summary(ctx.state.tracker).counts.known;
  const depth = ctx.depth();
  const intoNext = known % WORDS_PER_DEPTH;
  const toNext = WORDS_PER_DEPTH - intoNext;
  const start = Math.max(1, depth - 2);

  const nodes = [];
  for (let d = start; d <= depth + 2; d++) {
    const state = d < depth ? 'done' : d === depth ? 'current' : 'locked';
    if (d > start) nodes.push(el('div', { class: 'depth-link' + (d <= depth ? ' lit' : '') }));
    nodes.push(
      el(
        'div',
        { class: 'depth-node ' + state },
        el('div', { class: 'depth-dot' }, d === depth ? '⛏️' : d < depth ? '💎' : '🔒'),
        el('div', { class: 'depth-cap' }, `D${d}`),
      ),
    );
  }

  return el(
    'div',
    { class: 'panel' },
    el('h3', {}, 'Cavern map'),
    el('div', { class: 'cavern-strip' }, ...nodes),
    el('div', { class: 'goal-bar', style: { marginTop: '12px' } }, el('div', { class: 'goal-fill', style: { width: `${(intoNext / WORDS_PER_DEPTH) * 100}%` } })),
    el(
      'p',
      { class: 'quest-note', style: { marginTop: '8px' } },
      `You're at Depth ${depth} — master ${toNext} more word${toNext === 1 ? '' : 's'} to reach Depth ${depth + 1}!`,
    ),
  );
}

// Daily Cavern Quests + the all-complete "geode" bonus (research Tier 1 #4 / #8).
function questsPanel(ctx) {
  const today = new Date().toISOString().slice(0, 10);
  // The geode "round" ratchets each crack today, so quests get harder each cycle (§C).
  const round = ctx.store.geodeRound();
  const quests = dailyQuests(today, { round });
  const day = ctx.store.dayStats();
  const allDone = allQuestsDone(quests, day);

  // Tapping a quest jumps straight into the activity that works toward it: craft + repair
  // quests -> Craft (the assessment, §B); a specimen quest -> the Lab; the fast ones ->
  // Practice/rhythm.
  const questNav = { crafted: 'puzzle', specimens: 'lab' };
  const rows = quests.map((q) => {
    const pr = questProgress(q, day);
    return el(
      'button',
      {
        class: 'quest quest-link' + (pr.done ? ' done' : ''),
        onClick: () => ctx.nav(questNav[q.metric] || 'rhythm'),
      },
      el('span', { class: 'quest-ic' }, pr.done ? '✅' : q.icon),
      el(
        'div',
        { class: 'quest-body' },
        el('div', { class: 'quest-text' }, q.text),
        el('div', { class: 'quest-bar' }, el('div', { class: 'quest-fill', style: { width: pr.pct + '%' } })),
      ),
      el('span', { class: 'quest-count' }, pr.done ? `${pr.have}/${pr.target}` : '▸'),
    );
  });

  const footer = allDone
    ? el(
        'button',
        { class: 'btn primary', style: { width: '100%', marginTop: '6px' }, onClick: () => ctx.nav('geode') },
        '🎁 Crack your geode!',
      )
    : round > 0
      ? el('p', { class: 'quest-note' }, `Round ${round + 1} — tougher goals! Finish them to crack another geode 🎁`)
      : el('p', { class: 'quest-note' }, 'Finish all three to crack open a geode! 🎁');

  const heading = round > 0 ? `Daily quests · Round ${round + 1}` : 'Daily quests';
  return el('div', { class: 'panel' }, el('h3', {}, heading), ...rows, footer);
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
