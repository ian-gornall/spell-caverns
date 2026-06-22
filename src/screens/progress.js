// src/screens/progress.js — the transparent progress view (UX.md §8).
//
// Same view for kid AND parent (HANDOFF §4 — no separate teacher console). Shows
// gems, cavern depth, the mastery SPECTRUM (progress.summary buckets, as a
// friendly bar rather than raw numbers), and a tiny recent-days accuracy strip.
// Buckets are display-only — never a gate.
import { el, header, toast } from '../ui.js';
import { summary } from '../engine/progress.js';
import { categorySummary } from '../engine/categories.js';
import { byRank } from '../engine/lexicon.js';
import { dailyQuests, questProgress, allQuestsDone } from '../engine/quests.js';
import { catalogSummary } from '../engine/catalog.js';

export function progressScreen(ctx) {
  const streak = ctx.state.streak || {};
  const records = ctx.state.records || {};

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
          { class: 'seg haul' },
          el(
            'div',
            { class: 'stat haul-tile gem' },
            el('span', { class: 'big-num' }, `💎 ${ctx.state.gems || 0}`),
            el('span', { class: 'haul-label' }, 'gems mined'),
          ),
          el(
            'div',
            { class: 'stat haul-tile depth' },
            el('span', { class: 'big-num' }, `⛏️ ${ctx.depth()}`),
            el('span', { class: 'haul-label' }, 'cavern depth'),
          ),
          el(
            'div',
            { class: 'stat haul-tile streak' },
            el('span', { class: 'big-num' }, `🔥 ${streak.count || 0}`),
            el('span', { class: 'haul-label' }, `day streak${streak.longest ? ` · best ${streak.longest}` : ''}`),
          ),
        ),
      ),
      wordsPanel(ctx),
      cavernMap(ctx),
      questsPanel(ctx),
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

// §30 kid-visible category view: the "Words I'm learning" working set (each with a 2-step
// progress toward KNOWN) + a known / mastered / new-remaining tally. The `tricky` bucket is
// GROWN-UP-ONLY (never shown here) — a child never sees a "tricky/hard" label on their words.
function wordsPanel(ctx) {
  const pool = byRank().filter((w) => w.word.length >= 3);
  const s = categorySummary(ctx.state.categories, pool);
  const cracked = s.repair.length; // §36 C3: from categories, so it matches the pips/yellow lights
  // §36 C2: how many to the next cavern depth (friendly + small) instead of the scary
  // "~2800 new to find" total. Computed like cavernMap so the two agree.
  const known = summary(ctx.state.tracker).counts.known;
  const toNext = WORDS_PER_DEPTH - (known % WORDS_PER_DEPTH);
  const learnList = s.learning.length
    ? el(
        'div',
        { class: 'learn-grid' },
        ...s.learning.map((w) =>
          el(
            // §36 C3: a YELLOW light on a word the child got right before but has since missed,
            // so they can SEE which need fixing (matches the Repair count + drill).
            'div',
            { class: 'learn-word' + (w.needsRepair ? ' needs-repair' : '') },
            w.needsRepair && el('span', { class: 'repair-dot', title: 'Needs repair' }, '🟡'),
            el('span', { class: 'learn-text' }, w.word),
            el(
              'div',
              { class: 'learn-pips' },
              ...Array.from({ length: w.needed }, (_, i) => el('span', { class: 'pip' + (i < w.steps ? ' on' : '') })),
            ),
          ),
        ),
      )
    : el('p', { style: { color: 'var(--ink-dim)' } }, 'Craft some words to start your learning set! 🔨');

  const tile = (ic, n, label) =>
    el(
      'div',
      { class: 'stat', style: { flexDirection: 'column' } },
      el('span', { class: 'big-num' }, `${ic} ${n}`),
      el('span', { style: { color: 'var(--ink-dim)' } }, label),
    );

  return el(
    'div',
    { class: 'panel' },
    el('h3', {}, 'Words I’m learning'),
    learnList,
    el('div', { class: 'seg', style: { marginTop: '12px' } }, tile('🌱', s.known, 'known'), tile('⭐', s.mastered, 'mastered'), tile('🪨', toNext, 'to next depth')),
    cracked > 0 &&
      el(
        'button',
        { class: 'btn', style: { marginTop: '14px', width: '100%' }, onClick: () => ctx.nav('puzzle', { review: true }) },
        `🔧 Repair ${cracked} word${cracked === 1 ? '' : 's'} you missed`,
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
        'div',
        { style: { textAlign: 'center' } },
        el(
          'p',
          { style: { color: 'var(--ink-dim)' } },
          'Invent, spell and draw your first crystal!',
        ),
        // A6: this used to be dead text. Make it a real button into the Crystal Lab.
        el(
          'button',
          { class: 'btn primary', style: { marginTop: '10px' }, onClick: () => ctx.nav('lab') },
          '🔮 Visit the Crystal Lab',
        ),
      );
  return el(
    'div',
    { class: 'panel' },
    el('h3', {}, `Specimen collection (${specimens.length})`),
    body,
  );
}
