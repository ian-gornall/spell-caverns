// src/screens/progress.js — the transparent progress view (UX.md §8).
//
// Same view for kid AND parent (HANDOFF §4 — no separate teacher console). Shows
// gems, the cavern LEVEL, the learning set, the §36-D4 scrollable CAVERN MAP (every
// 30-word band as a level: current / cleared / reached / skipped / locked), daily
// quests, personal bests, recent-days accuracy, and the crystal catalog. Display-only.
import { el, header, toast } from '../ui.js';
import { categorySummary, cavernLevels, setLevelAndRefill } from '../engine/categories.js';
import { byRank, wordlistMode, lessonForBand, lessonList } from '../engine/lexicon.js';
import { kidLesson } from '../engine/kidcopy.js';
import { lessonStatus, wordState, graduatedWords, activeLessonWords, WIN } from '../engine/lessonrun.js';
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
            // §C1: show the CAVERN LEVEL (the 30-word band the diagnostic placed them at / they've
            // climbed to) — that's the "where am I" number. (cavern DEPTH = mastery zones, separate;
            // unifying the two is the D4 cavern-map redesign.)
            el('span', { class: 'big-num' }, `⛏️ ${wordlistMode() === 'lessons'
              ? lessonStatus(ctx.state.lessons, lessonList()).number || 1
              : (ctx.state.categories && ctx.state.categories.level) || 1}`),
            el('span', { class: 'haul-label' }, wordlistMode() === 'lessons' ? 'lesson' : 'cavern level'),
          ),
          el(
            'div',
            { class: 'stat haul-tile streak' },
            el('span', { class: 'big-num' }, `🔥 ${streak.count || 0}`),
            el('span', { class: 'haul-label' }, `day streak${streak.longest ? ` · best ${streak.longest}` : ''}`),
          ),
        ),
      ),
      wordlistMode() === 'lessons' ? lessonWordsPanel(ctx) : wordsPanel(ctx),
      wordlistMode() === 'lessons' ? lessonPath(ctx) : cavernMap(ctx),
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
  // §36 next-step #2 (Ian 2026-06-22c): words to the next cavern LEVEL (band) — the words in the
  // CURRENT level the child hasn't learned yet — friendly + accurate to the band model (was the
  // mastery-DEPTH count, and before that the scary "~2800 new to find" whole-dataset total).
  const toNext = s.toNextLevel;
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
    el('div', { class: 'seg', style: { marginTop: '12px' } }, tile('🌱', s.known, 'known'), tile('⭐', s.mastered, 'mastered'), tile('🪨', toNext, 'to next level')),
    cracked > 0 &&
      el(
        'button',
        { class: 'btn', style: { marginTop: '14px', width: '100%' }, onClick: () => ctx.nav('puzzle', { review: true }) },
        `🔧 Repair ${cracked} word${cracked === 1 ? '' : 's'} you missed`,
      ),
  );
}

// §40 lessons mode: "Words I'm learning" reads the RUN (the categories machine is
// bypassed) — the current lesson's in-progress words, each with its rolling last-5
// recall window as pips (● hit ○ miss), plus a learned/left tally.
function lessonWordsPanel(ctx) {
  const run = ctx.state.lessons;
  const lessons = lessonList();
  const st = lessonStatus(run, lessons);
  const active = activeLessonWords(run, lessons);
  const learnList = active.length
    ? el(
        'div',
        { class: 'learn-grid' },
        ...active.map((w) => {
          const win = (run.words[w]?.win || []).slice(-WIN);
          return el(
            'div',
            { class: 'learn-word' },
            el('span', { class: 'learn-text' }, w),
            el(
              'div',
              { class: 'learn-pips' },
              ...win.map((x) => el('span', { class: 'pip' + (x.c ? ' on' : '') })),
            ),
          );
        }),
      )
    : el('p', { style: { color: 'var(--ink-dim)' } }, 'Start your lesson to meet your next words! 📖');

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
    el(
      'div',
      { class: 'seg', style: { marginTop: '12px' } },
      tile('⭐', graduatedWords(run).length, 'learned'),
      tile('✨', st.graduated, 'this lesson'),
      tile('🪨', Math.max(0, st.pool - st.graduated), 'to finish it'),
    ),
  );
}

// §40 lessons mode: the LESSON PATH from the run — completed lessons ⭐, the current
// one highlighted with its graduated/pool bar, later lessons locked. Labels are
// kid-voiced (kidcopy). Tapping the current lesson jumps into the stream.
function lessonPath(ctx) {
  const run = ctx.state.lessons;
  const lessons = lessonList();
  const st = lessonStatus(run, lessons);
  let currentEl = null;
  const node = (l) => {
    const status = run.completed.includes(l.id) ? 'cleared' : l.id === run.lessonId ? 'current' : 'locked';
    const pool = l.words.length;
    const done = status === 'cleared' ? pool : l.words.filter((e) => wordState(run, e.word) === 'known').length;
    const b = el(
      'button',
      {
        class: `cavern-level ${status}`,
        disabled: status === 'locked',
        onClick: () => {
          if (status === 'current') ctx.nav('lesson');
          else if (status === 'cleared') toast('⭐ Done! Its words stay in your Practice mine.');
        },
      },
      el('span', { class: 'cl-icon' }, LEVEL_ICON[status]),
      el(
        'div',
        { class: 'cl-main' },
        el('span', { class: 'cl-num' }, `Lesson ${l.band}`),
        el('span', { class: 'cl-lesson' }, kidLesson(l).name),
        el('div', { class: 'cl-bar' }, el('div', { class: 'cl-fill', style: { width: pool ? `${Math.round((done / pool) * 100)}%` : '0%' } })),
      ),
      el('span', { class: 'cl-prog' }, pool ? `${done}/${pool}` : ''),
    );
    if (status === 'current') currentEl = b;
    return b;
  };
  const scroll = el('div', { class: 'cavern-scroll' }, ...lessons.map(node));
  setTimeout(() => {
    if (currentEl) scroll.scrollTop = Math.max(0, currentEl.offsetTop - scroll.clientHeight / 2 + currentEl.clientHeight / 2);
  }, 0);
  const note = st.allDone
    ? `Every lesson done — the whole path is yours! 🏆`
    : `You're at Lesson ${st.number} of ${st.total} — ${run.completed.length} done ⭐`;
  return el(
    'div',
    { class: 'panel' },
    el('h3', {}, 'Lesson path'),
    el('p', { class: 'quest-note', style: { marginTop: '0', marginBottom: '10px' } }, note),
    scroll,
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

// §36 D4 (Ian 2026-06-22d): the CAVERN MAP — a scrollable column of every cavern LEVEL (30-word band,
// ~97 of them). "You are here" (current) is highlighted + auto-centered; CLEARED levels (all words
// mastered) glow gold, REACHED levels show partial progress, SKIPPED levels (a placement jump leapt
// over them) are dashed + locked-looking to PULL the child back to master the easier words, and
// levels beyond the deepest reached (the peakLevel frontier) are greyed/locked. Tapping any reached/
// skipped/cleared level re-aims the working set there (setLevelAndRefill — the same Settings nudge)
// and starts crafting it; a locked level just nudges "keep digging". This replaces the old 5-node
// mastery-DEPTH strip (bosses still fire on mastery depth — engine/narrative — that's a separate axis).
// skipped = open (🔓: tap to go back & master it); locked = not yet reachable (🔒).
const LEVEL_ICON = { current: '⛏️', cleared: '⭐', reached: '💎', skipped: '🔓', locked: '🔒' };
function cavernMap(ctx) {
  const pool = byRank().filter((w) => w.word.length >= 3);
  const levels = cavernLevels(ctx.state.categories, pool);
  const current = (ctx.state.categories && ctx.state.categories.level) || 1;
  const skipped = levels.filter((l) => l.status === 'skipped').length;
  const cleared = levels.filter((l) => l.status === 'cleared').length;

  let currentEl = null;
  const onTap = (lv) => {
    if (lv.status === 'locked') {
      toast(`⛏️ Master more words to dig down to Level ${lv.band}!`);
      return;
    }
    if (lv.band !== current) {
      setLevelAndRefill(ctx.state.categories, lv.band, pool); // go practice that level (re-aims the set)
      ctx.save();
    }
    ctx.nav('puzzle');
  };
  const node = (lv) => {
    // §38 lessons mode: a band IS a spelling-pattern lesson — show its name under the number.
    const lesson = lessonForBand(lv.band);
    const b = el(
      'button',
      { class: `cavern-level ${lv.status}`, disabled: lv.status === 'locked', onClick: () => onTap(lv) },
      el('span', { class: 'cl-icon' }, LEVEL_ICON[lv.status]),
      el(
        'div',
        { class: 'cl-main' },
        el('span', { class: 'cl-num' }, lesson ? `Lesson ${lv.band}` : `Level ${lv.band}`),
        lesson ? el('span', { class: 'cl-lesson' }, kidLesson(lesson).name) : null, // §39 kid-voiced
        el('div', { class: 'cl-bar' }, el('div', { class: 'cl-fill', style: { width: lv.total ? `${Math.round((lv.done / lv.total) * 100)}%` : '0%' } })),
      ),
      el('span', { class: 'cl-prog' }, lv.total ? `${lv.done}/${lv.total}` : ''),
    );
    if (lv.status === 'current') currentEl = b;
    return b;
  };

  const scroll = el('div', { class: 'cavern-scroll' }, ...levels.map(node));
  // center the current level once the panel is in the DOM (scoped to the scroll container)
  setTimeout(() => {
    if (currentEl) scroll.scrollTop = Math.max(0, currentEl.offsetTop - scroll.clientHeight / 2 + currentEl.clientHeight / 2);
  }, 0);

  const lessonsMode = wordlistMode() === 'lessons';
  const unit = lessonsMode ? 'Lesson' : 'Level';
  const note = skipped
    ? `You're at ${unit} ${current} of ${levels.length}. ${skipped} easier ${unit.toLowerCase()}${skipped === 1 ? '' : 's'} to go back and master! ⛏️`
    : `You're at ${unit} ${current} of ${levels.length}${cleared ? ` — ${cleared} cleared ⭐` : ''}. Tap a ${unit.toLowerCase()} to practice it.`;

  return el(
    'div',
    { class: 'panel' },
    el('h3', {}, lessonsMode ? 'Lesson path' : 'Cavern map'),
    el('p', { class: 'quest-note', style: { marginTop: '0', marginBottom: '10px' } }, note),
    scroll,
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
