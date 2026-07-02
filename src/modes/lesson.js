// src/modes/lesson.js — LESSONS MODE's one play surface: the incremental-rehearsal
// trial stream (§40; supersedes the §38 Craft/Mastery split for lessons profiles).
//
// One stream per block, driven entirely by engine/lessonrun.js: a kid-voiced INTRO
// CARD at each new pattern (screens/lesson_intro.js), an ERRORLESS EXPOSURE for each
// new word (grey ghost letters, the keypad accepts only the correct next letter),
// then RECALL trials interleaved among known words. Input is dictation + the same
// app-drawn A–Z keypad Mastery uses (duplicated here with cross-link comments — see
// modes/mastery.js buildKeyboard; extract to ui.js only if a shared bug appears).
// No OS keyboard, so no suggestion strip can give the spelling away.
//
// The FREE TIMED HINT LADDER replaces gem-cost hints in this mode (reveal-wait
// scaled by word length): rung 1 re-teaches the kid rule (+ grapheme glow +
// exemplars) and re-dictates; rung 2 shows the correct spelling in grey for the
// child to copy; still stalled → warm praise and move on. Hint-assisted = a
// recorded miss with the rung logged. A wrong submit clears the wrong letters
// immediately — the wrong spelling is never left on screen.
//
// Blocks end at a response cap (the §40 slice-4 fatigue knee joins later); gems
// scale with responses completed, with a reward pulse every ~5 responses. Classic
// mode never routes here. UI module — verified with Playwright (scripts/qa_s40.mjs).
import { el, header, burst, toast, createIdleGuard, pulse, fitPlayArea, visibleTimeout } from '../ui.js';
import { lessonList } from '../engine/lexicon.js';
import { kidLesson } from '../engine/kidcopy.js';
import {
  syncLesson, needsIntro, markIntroSeen, beginSession, nextTrial,
  recordExposure, recordRecall, lessonStatus, seedKnown,
} from '../engine/lessonrun.js';
import { createSpineDiag, nextProbe, submitProbe, serializeDiag, diagResult } from '../engine/spinediag.js';
import { createFatigueMeter } from '../engine/fatigue.js';
import { gradeAnswer } from '../engine/praise.js';
import { recordAnswer } from '../engine/progress.js';
import { isProperWord, displayCase } from '../engine/puzzle.js';
import { lessonIntro } from '../screens/lesson_intro.js';

// Block economy (§40): gems scale with responses completed — banked at the block end,
// with an instant graduation bonus and a loud lesson-complete celebration.
const RESPONSE_GEMS = 8; // per response (exposure or recall), paid at block end
const GRAD_GEMS = 25; // instant, when a word graduates to KNOWN (matches MASTERY_GEMS)
const LESSON_GEMS = 100; // instant, on the lesson-complete celebration
const PULSE_EVERY = 5; // reward pulse cadence (responses)
const RESPONSES_PER_BLOCK = 15; // block length (window.__lessonBlockLen overrides for QA)

// Free timed hint ladder: the reveal-wait grows with word length. Rung 1 fires after
// one step, rung 2 after two, move-on after three. window.__idleTest scales the steps
// (the same QA hook createIdleGuard uses).
const LADDER_BASE_MS = 3000;
const LADDER_PER_LETTER_MS = 700;

// Hold the read window after dictation before the response-time clock starts (RT hygiene).
const GRACE_MS = 1200;

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Every lesson finished — a rare, proud screen (also the safe fallback if this mode
// is ever reached without a lesson path, e.g. classic mode).
function allDoneScreen(ctx) {
  const lessonsOn = lessonList().length > 0;
  return el(
    'div',
    { class: 'screen lesson' },
    header(ctx, { title: 'Lessons', onBack: () => ctx.nav('home') }),
    el(
      'div',
      { class: 'reward' },
      el('div', { class: 'big' }, lessonsOn ? '🏆' : '📖'),
      el('h2', {}, lessonsOn ? 'Every lesson done!' : 'Lessons'),
      el('p', { style: { color: 'var(--ink-dim)' } }, lessonsOn
        ? 'You’ve finished the whole lesson path — amazing! Keep your words sharp in Practice.'
        : 'Pattern lessons aren’t switched on for this explorer.'),
      el(
        'div',
        { class: 'row' },
        lessonsOn && el('button', { class: 'btn primary', onClick: () => ctx.nav('rhythm') }, '⛏️ Practice'),
        el('button', { class: 'btn', onClick: () => ctx.nav('home') }, '🏠 Home'),
      ),
    ),
  );
}

export function startLesson(ctx) {
  const { state, audio } = ctx;
  const run = state.lessons;
  const lessons = lessonList();
  syncLesson(run, lessons);
  if (!run.lessonId) return allDoneScreen(ctx);

  const session = beginSession();
  const blockLen = (typeof window !== 'undefined' && Number(window.__lessonBlockLen)) || RESPONSES_PER_BLOCK;
  const tScale = (typeof window !== 'undefined' && Number(window.__idleTest)) || 1;
  // §40 slice 4: an unplaced run opens with the SPINE DIAGNOSTIC — played as ordinary
  // trials (one-shot misses, ladder capped at rung 1, the spelling never revealed), so
  // the child never knows the first round is a check. Resumes across blocks (run.diag).
  let diag = !run.placed ? createSpineDiag(lessons, { restore: run.diag }) : null;
  // §40 slice 4: the fatigue knee — clean known-word recall times, checked between trials.
  const meter = createFatigueMeter();
  let rtTainted = false; // a pause/hidden-tab taints the in-flight trial's RT

  // --- static structure -----------------------------------------------------
  const dots = el('div', { class: 'dots' });
  const chipEl = el('div', { class: 'lesson-chip' });
  const verdictEl = el('div', { class: 'verdict' });
  const verdictChip = el('div', { class: 'verdict-chip' });
  const sentenceEl = el('div', { class: 'sentence' });
  const reteachEl = el('div', { class: 'reteach' });
  const slotsEl = el('div', { class: 'slots' });
  // Cross-link: duplicated from modes/mastery.js buildKeyboard (the §11 app-drawn
  // keypad — no OS keyboard, no suggestion strip). Keep the two in sync on key changes.
  const keyboardEl = el('div', { class: 'type-keyboard' });
  const hearBtn = el(
    'button',
    { class: 'hear-again', onClick: () => dictate() },
    el('span', { class: 'spk' }, '🔊'),
    'Hear it again',
  );
  const hdr = header(ctx, {
    title: 'Lesson',
    onBack: () => ctx.nav('home'),
    onPause: () => guard.pauseNow(),
  });
  const gemCountEl = hdr.querySelector('.gem-count');
  const playBody = el(
    'div',
    { class: 'play-body' },
    el('div', { class: 'prompt' }, el('div', { class: 'hear-row' }, hearBtn), sentenceEl, verdictEl, verdictChip, reteachEl),
    el('div', { class: 'answer-zone' }, slotsEl, keyboardEl),
  );
  const screen = el('div', { class: 'screen lesson' }, hdr, chipEl, dots, playBody);
  const fit = () => requestAnimationFrame(() => fitPlayArea(playBody));
  window.addEventListener('resize', fit);
  ctx.onLeave(() => window.removeEventListener('resize', fit));

  // --- per-block / per-trial state -------------------------------------------
  let trial = null; // the engine's current pick { word, expose, known, reteach }
  let target = '';
  let entry = null; // the lexicon entry (sentence / grapheme / homophone)
  let isProper = false;
  let slots = []; // letters | null
  let copyMode = false; // exposure or rung-2: ghost letters, only the correct next letter lands
  let rung = 0; // 0 none | 1 rule re-taught | 2 grey copy
  let dirty = false; // a wrong submit happened (this recall is a miss even if finished)
  let locked = false;
  let earned = 0; // everything this block (banked response gems + instant bonuses)
  let startTime = 0;
  let graceTimer = 0;
  let ladderTimer = null; // visibleTimeout → the next ladder rung
  let celebrating = false;
  let introOverlay = null;
  let left = false; // set on nav-away so a pending advance() can't present a stale word

  ctx.onLeave(() => {
    left = true;
    guard.stop();
    clearLadder();
    clearTimeout(graceTimer);
    if (introOverlay) introOverlay.remove();
  });

  // The 45s idle guard would double-fire against the hint ladder (§40 risk): the nudge
  // is disabled (no onNudge) and the pause threshold sits past the full ladder. The
  // ladder itself suspends behind the pause overlay / a hidden tab and re-arms on wake.
  const guard = createIdleGuard({
    pauseMs: 75000,
    onSuspend: () => {
      clearLadder();
      startTime = 0; // discard the in-flight trial's RT across a pause/break
      rtTainted = true; // and keep it out of the fatigue meter
      clearTimeout(graceTimer);
    },
    onResume: () => {
      if (locked || celebrating || introOverlay) return;
      dictate();
      armLadder();
    },
  });

  // Physical keyboard (iPad + case) — same contract as the on-screen keypad.
  // Cross-link: mirrors modes/mastery.js onPhysicalKey.
  const onPhysicalKey = (e) => {
    if (locked || celebrating || introOverlay) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Backspace') { backspace(); e.preventDefault(); return; }
    const apostrophe = e.key === "'" || e.key === '’';
    if (!apostrophe && !/^[a-zA-Z]$/.test(e.key)) return;
    typeLetter(apostrophe ? "'" : e.key.toLowerCase());
    e.preventDefault();
  };
  window.addEventListener('keydown', onPhysicalKey);
  ctx.onLeave(() => window.removeEventListener('keydown', onPhysicalKey));

  // --- the hint ladder ---------------------------------------------------------
  function ladderStepMs() {
    return (LADDER_BASE_MS + LADDER_PER_LETTER_MS * target.length) * tScale;
  }
  function clearLadder() {
    if (ladderTimer) { ladderTimer.cancel(); ladderTimer = null; }
  }
  // (Re)arm the wait for the NEXT rung. Reset on every accepted letter and every
  // wrong submit — the ladder is for a stalled child, not a busy one. During the
  // diagnostic the ladder caps at rung 1: a stall past it is a one-shot miss and
  // the spelling is NEVER revealed (a probe can't be taught into a false pass).
  function armLadder() {
    clearLadder();
    if (locked || copyMode && rung < 2) return; // exposure copy has no ladder
    if (trial && trial.expose) return;
    if (diag && rung >= 1) { ladderTimer = visibleTimeout(moveOn, ladderStepMs()); return; }
    if (rung >= 2) { ladderTimer = visibleTimeout(moveOn, ladderStepMs()); return; }
    ladderTimer = visibleTimeout(() => (rung === 0 ? rungOne() : rungTwo()), ladderStepMs());
  }
  // Rung 1: kid rule + grapheme glow + exemplars, re-dictate. Free.
  function rungOne() {
    if (locked) return;
    rung = 1;
    showReteach();
    glowGrapheme();
    dictate();
    armLadder();
  }
  // Rung 2: the correct spelling appears in grey; the child copies it to finish.
  function rungTwo() {
    if (locked) return;
    rung = 2;
    for (let i = 0; i < slots.length; i++) if (slots[i] !== target[i]) slots[i] = null; // never leave wrong letters
    copyMode = true;
    renderSlots();
    pulse(slotsEl);
    armLadder(); // one more step of silence → move on
  }
  // Still stalled after the last allowed rung: praise the attempt and move on
  // (a one-shot miss during the diagnostic; a rung-2 recorded miss otherwise).
  function moveOn() {
    if (locked) return;
    locked = true;
    clearLadder();
    audio.speakPraise('Good try! Let’s keep going.');
    flashVerdict('Good try!', 'On to the next one', '#9D8DF1');
    if (diag) return settleProbe(false);
    settleRecall({ correct: false, rung: 2, quiet: true });
  }

  // --- keypad -------------------------------------------------------------------
  // Cross-link: duplicated from modes/mastery.js buildKeyboard (qwerty rows + ’ + ⌫).
  function buildKeyboard() {
    const rows = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'].map((row, ri) => {
      const keys = [...row].map((ch) =>
        el('button', { class: 'key', type: 'button', onClick: () => typeLetter(ch) }, ch),
      );
      if (ri === 2) {
        keys.push(el('button', { class: 'key', type: 'button', 'aria-label': 'Apostrophe', onClick: () => typeLetter("'") }, '’'));
        keys.push(el('button', { class: 'key key-back', type: 'button', 'aria-label': 'Delete', onClick: backspace }, '⌫'));
      }
      return el('div', { class: 'key-row' }, ...keys);
    });
    keyboardEl.replaceChildren(...rows);
  }
  function typeLetter(letter) {
    if (locked || celebrating || introOverlay) return;
    const next = slots.findIndex((s) => s == null);
    if (next === -1) return;
    if (copyMode) {
      // errorless copy: only the correct next letter lands; a wrong key just wobbles
      if (letter !== target[next]) {
        audio.sfx('tap');
        shakeSlots();
        return;
      }
    }
    slots[next] = letter;
    audio.sfx('tap');
    renderSlots();
    armLadder();
    if (slots.every((s) => s != null)) checkWord();
  }
  function backspace() {
    if (locked || copyMode) return; // nothing wrong to remove while copying
    let last = -1;
    for (let i = slots.length - 1; i >= 0; i--) if (slots[i] != null) { last = i; break; }
    if (last === -1) return;
    slots[last] = null;
    audio.sfx('tap');
    renderSlots();
  }
  function tapSlot(i) {
    if (locked || copyMode || slots[i] == null) return;
    slots[i] = null; // tap a letter to redo just that one
    renderSlots();
  }

  // --- rendering ------------------------------------------------------------------
  function renderSlots() {
    const glow = (rung >= 1 || (trial && trial.expose) || (trial && trial.reteach)) && entry?.grapheme?.indices;
    slotsEl.replaceChildren(
      ...slots.map((s, i) => {
        const ghost = copyMode && s == null;
        return el(
          'button',
          {
            class: 'slot'
              + (s != null ? ' filled' : '')
              + (ghost ? ' ghost' : '')
              + (glow && glow.includes(i) ? ' grapheme' : ''),
            onClick: () => tapSlot(i),
          },
          s != null ? displayCase(s, i, isProper) : ghost ? displayCase(target[i], i, isProper) : '',
        );
      }),
    );
  }
  function shakeSlots() {
    slotsEl.classList.remove('shake');
    void slotsEl.offsetWidth;
    slotsEl.classList.add('shake');
  }
  function flashVerdict(phrase, chip, color) {
    verdictEl.textContent = phrase;
    verdictEl.style.color = color;
    verdictChip.textContent = chip;
    verdictChip.style.color = color;
    verdictEl.classList.remove('flash');
    void verdictEl.offsetWidth;
    verdictEl.classList.add('flash');
  }
  function bumpGems() {
    if (!gemCountEl) return;
    gemCountEl.textContent = String(state.gems || 0);
    gemCountEl.classList.remove('bump');
    void gemCountEl.offsetWidth;
    gemCountEl.classList.add('bump');
  }
  function renderChip() {
    const st = lessonStatus(run, lessons);
    const kid = kidLesson(lessons.find((l) => l.id === st.lessonId));
    chipEl.textContent = st.lessonId ? `Lesson ${st.number} · ${kid ? kid.name : ''} · ✨${st.graduated}/${st.pool}` : '';
  }
  function renderDots() {
    dots.replaceChildren(
      ...Array.from({ length: blockLen }, (_, i) =>
        el('div', { class: 'dot' + (i < session.responses ? ' done' : i === session.responses ? ' current' : '') })),
    );
  }
  function showReteach() {
    const kid = kidLesson(entry || lessons.find((l) => l.id === run.lessonId));
    const lesson = lessons.find((l) => l.id === (entry?.lessonId || run.lessonId));
    const ex = (lesson?.exemplars || []).slice(0, 3);
    reteachEl.replaceChildren(
      el('span', { class: 'reteach-icon' }, '💡'),
      el('span', {}, kid.rule + (ex.length ? ` Like ${ex.join(', ')}.` : '')),
    );
  }
  function glowGrapheme() {
    renderSlots(); // the glow class keys off rung/trial state
  }
  function blankedSentence(e) {
    const s = e.sentence || '';
    const re = new RegExp('\\b' + escapeRegex(e.word) + '\\b', 'i');
    const m = s.match(re);
    if (m) return [s.slice(0, m.index), el('span', { class: 'blank' }, '_____'), s.slice(m.index + m[0].length)];
    return [s];
  }
  function dictate() {
    audio.say(target, {
      onDone: () => {
        // §38 homophone: bare audio is ambiguous — follow with the carrier sentence.
        if (!locked && entry && entry.homophoneId != null && entry.sentence) audio.say(entry.sentence);
        if (locked) return;
        clearTimeout(graceTimer);
        graceTimer = setTimeout(() => {
          if (!locked && !startTime) startTime = performance.now();
        }, GRACE_MS);
      },
    });
  }

  // --- grading ----------------------------------------------------------------------
  function checkWord() {
    if (locked) return;
    const built = slots.join('');
    if (built !== target) {
      // §40 slice 4 — diagnostic probes are ONE-SHOT: a wrong build records the miss
      // and moves straight on (forward-moving copy, never "try again" — csc-v60 lesson).
      if (diag) {
        locked = true;
        clearLadder();
        audio.sfx('great');
        audio.speakPraise('Let’s keep going!');
        flashVerdict('Let’s keep going!', 'Next word', '#9D8DF1');
        return settleProbe(false);
      }
      // a wrong submit clears the wrong letters IMMEDIATELY — never left on screen
      dirty = true;
      audio.sfx('miss');
      flashVerdict('So close!', 'Keep the letters that fit', '#8593A3');
      for (let i = 0; i < slots.length; i++) if (slots[i] !== target[i]) slots[i] = null;
      shakeSlots();
      renderSlots();
      armLadder();
      return;
    }
    locked = true;
    clearLadder();
    if (diag) {
      // a probe success — dirty (a hinted rung-1) still passes only if the build was clean
      const clean = !dirty && rung === 0;
      audio.sfx(clean ? 'great' : 'good');
      flashVerdict('You got it! ✨', '', '#36F1CD');
      return settleProbe(clean);
    }
    if (trial.expose) {
      // errorless first exposure completed — warm, small; never graded
      recordExposure(run, session, target);
      audio.sfx('good');
      flashVerdict('You wrote it! ✨', 'Now remember it', '#36F1CD');
      afterResponse();
      advance(900);
      return;
    }
    const ms = startTime ? performance.now() - startTime : null;
    settleRecall({ correct: !dirty && rung === 0, rung, ms });
  }

  // §40 slice 4: record a diagnostic probe's outcome + persist the walk so it can
  // resume across blocks/sessions. Probes feed the same store hooks as recalls.
  function settleProbe(correct) {
    submitProbe(diag, correct);
    run.diag = serializeDiag(diag);
    recordAnswer(state.tracker, target, correct, { responseMs: 0, source: 'craft' });
    ctx.store.recordAnswerStat(correct, 'craft');
    session.responses += 1;
    renderDots();
    ctx.save();
    advance(correct ? 1000 : 1300);
  }

  // §40 slice 4: the walk converged — seed below-frontier words as KNOWN (capped at
  // the 40 nearest the frontier) so IR has knowns to interleave from day one, place
  // the run at the frontier lesson, and roll straight into the normal stream (the
  // intro card is the child's first hint a "lesson" started — the check was invisible).
  function finishDiag() {
    const res = diagResult(diag);
    const knownIds = new Set(res.knownLessonIds);
    const below = [];
    for (const l of lessons) {
      if (!knownIds.has(l.id)) continue;
      for (const e of l.words) below.push({ word: e.word, lessonId: l.id });
    }
    seedKnown(run, below, { cap: 40 });
    run.placed = true;
    run.diag = null;
    run.lessonId = res.startLessonId;
    syncLesson(run, lessons);
    diag = null;
    const cur = lessons.find((l) => l.id === run.lessonId);
    if (cur) {
      state.categories.level = cur.band; // mirror for residual readers (admin export)
      state.startLevel = cur.band;
    }
    ctx.save();
    renderChip();
    renderDots();
    maybeIntroThen();
  }

  // Record a finished recall (clean, hinted, or moved-on) + fire the feedback.
  function settleRecall({ correct, rung: r, ms = null, quiet = false }) {
    const res = recordRecall(run, session, target, { correct, rung: r, ms }, lessons);
    // the same store hooks Craft feeds, so quests/geode-bosses/admin stay truthful (§40)
    recordAnswer(state.tracker, target, correct, { responseMs: ms || 0, source: 'craft' });
    ctx.store.recordAnswerStat(correct, 'craft');
    // §40 slice 4 RT hygiene: only clean (correct, rung-0) KNOWN-word recalls with an
    // untainted clock feed the fatigue knee — never new-word struggle or post-pause times.
    if (correct && r === 0 && trial.known && Number.isFinite(ms) && !rtTainted) meter.record(ms);
    if (correct) {
      const verdict = gradeAnswer({ correct: true, responseMs: ms ?? Infinity, combo: 0 });
      audio.sfx(verdict.tier);
      if (verdict.tier === 'perfect' || verdict.tier === 'amazing') audio.speakPraise(verdict.phrase);
      flashVerdict(verdict.phrase, verdict.label, verdict.color);
      const rct = slotsEl.getBoundingClientRect();
      burst(rct.left + rct.width / 2, rct.top + rct.height / 2, '#36F1CD', 14);
    } else if (!quiet) {
      // finished with help (wrong submits and/or the ladder) — warm, recorded as a miss
      audio.sfx('great');
      audio.speakPraise('You got there!');
      flashVerdict('You got there!', 'We’ll see it again soon', '#9D8DF1');
    }
    slotsEl.querySelectorAll('.slot').forEach((s) => s.classList.add('locked'));
    if (res.graduated) {
      earned += GRAD_GEMS;
      ctx.store.addGems(GRAD_GEMS);
      audio.sfx('combo');
      toast(`⭐ “${target}” learned! +${GRAD_GEMS} 💎`);
      bumpGems();
    }
    afterResponse();
    ctx.save();
    if (res.lessonComplete) return celebrate();
    advance(correct ? 1100 : 1400);
  }

  // Shared per-response bookkeeping: chip/dots refresh + the ~5-response reward pulse.
  function afterResponse() {
    renderChip();
    renderDots();
    if (session.responses > 0 && session.responses % PULSE_EVERY === 0) {
      audio.sfx('gem');
      pulse(gemCountEl);
    }
    ctx.save();
  }

  function advance(ms) {
    visibleTimeout(() => {
      if (celebrating || left) return;
      present();
    }, ms);
  }

  // --- lesson complete ------------------------------------------------------------
  function celebrate() {
    celebrating = true;
    guard.stop();
    clearLadder();
    const st = lessonStatus(run, lessons);
    const finished = lessons.find((l) => l.id === run.lessonId) || null;
    const kid = finished ? kidLesson(finished) : null;
    earned += LESSON_GEMS;
    ctx.store.addGems(LESSON_GEMS);
    // advance the run to the next lesson NOW; the CTA starts a fresh block (whose
    // intro card then presents it). Mirror categories.level to the new band so
    // residual readers (admin export, Settings) stay truthful (§40).
    syncLesson(run, lessons);
    const nextLesson = lessons.find((l) => l.id === run.lessonId) || null;
    if (nextLesson) state.categories.level = nextLesson.band;
    endBlockStats();
    ctx.save();
    audio.sfx('combo');
    audio.speakPraise('Lesson complete! Amazing work!');
    const rewardEl = el(
      'div',
      { class: 'reward lesson-complete' },
      el('div', { class: 'big' }, '🏅'),
      el('h2', {}, `Lesson ${st.number} complete!`),
      kid && el('p', { class: 'lesson-complete-name' }, kid.name),
      el('div', { class: 'earned' }, `+${LESSON_GEMS} 💎 lesson bonus · +${earned} this round`),
      el('p', { style: { color: 'var(--ink-dim)' } }, nextLesson
        ? `Next up: Lesson ${nextLesson.band} — ${kidLesson(nextLesson).name}`
        : 'That was the LAST lesson — you finished the whole path! 🏆'),
      el(
        'div',
        { class: 'row' },
        nextLesson
          ? el('button', { class: 'btn primary', onClick: () => ctx.nav('lesson') }, '📖 Next lesson!')
          : el('button', { class: 'btn primary', onClick: () => ctx.nav('rhythm') }, '⛏️ Practice'),
        el('button', { class: 'btn', onClick: () => ctx.nav('home') }, '🏠 Home'),
      ),
    );
    screen.replaceChildren(header(ctx, { title: 'Lesson complete!', onBack: () => ctx.nav('home') }), rewardEl);
    const rct = rewardEl.getBoundingClientRect();
    burst(rct.left + rct.width / 2, 220, '#FFD23F', 26);
  }

  // --- block end --------------------------------------------------------------------
  function endBlockStats() {
    const bank = session.responses * RESPONSE_GEMS;
    earned += bank;
    ctx.store.addGems(bank);
    ctx.store.recordSessionPlayed();
    ctx.store.noteWaveEarned(earned);
  }

  function finish({ breather = false } = {}) {
    guard.stop();
    clearLadder();
    endBlockStats();
    ctx.save();
    // Broke through to a new depth? Hand off to the GEODE BOSS milestone.
    // Cross-link: same handoff as modes/puzzle.js finish().
    if (ctx.depth() > ctx.store.lastMilestoneDepth()) {
      return ctx.nav('boss', { depth: ctx.store.lastMilestoneDepth() + 1, earned, from: 'lesson' });
    }
    const st = lessonStatus(run, lessons);
    const reward = el(
      'div',
      { class: 'reward' + (breather ? ' breather' : '') },
      el('div', { class: 'big' }, breather ? '🌿' : session.capped ? '🌱' : '💎'),
      el('h2', {}, breather ? 'Time for a breather!' : session.capped ? 'Great effort!' : 'Round done!'),
      // §40 slice 4: the fatigue knee ends the block WARMLY — effort-proportional gems,
      // a gentle stretch suggestion, and NO auto-relaunch (the child chooses).
      breather && el('p', { style: { color: 'var(--ink-dim)' } }, 'You worked really hard. Stretch your legs or grab some water.'),
      el('div', { class: 'earned' }, `+${earned} gems`),
      el('p', { style: { color: 'var(--ink-dim)' } }, `Lesson ${st.number}: ✨ ${st.graduated}/${st.pool} words learned · Total 💎 ${state.gems || 0}`),
      el(
        'div',
        { class: 'row' },
        breather
          ? el('button', { class: 'btn primary', onClick: () => ctx.nav('home') }, '🏠 Home')
          : el('button', { class: 'btn primary', onClick: () => ctx.nav('lesson') }, '📖 Keep going'),
        el('button', { class: 'btn', onClick: () => ctx.nav('progress') }, '🗺️ Progress'),
        breather
          ? el('button', { class: 'btn', onClick: () => ctx.nav('lesson') }, '📖 One more round')
          : el('button', { class: 'btn', onClick: () => ctx.nav('home') }, '🏠 Home'),
      ),
    );
    screen.replaceChildren(header(ctx, { title: breather ? 'Break time' : 'Round done', onBack: () => ctx.nav('home') }), reward);
    if (earned > 0) audio.sfx('great');
    if (breather) return; // no auto-relaunch after a fatigue end — resting is the point
    const rewardGuard = createIdleGuard({
      nudgeMs: 13000,
      pauseMs: 30000,
      onNudge: () => pulse(reward.querySelector('.btn.primary')),
      onTimeout: () => {
        toast('📖 Keep going!');
        ctx.nav('lesson');
      },
    });
    ctx.onLeave(() => rewardGuard.stop());
  }

  // --- per-trial setup ----------------------------------------------------------------
  function present() {
    if (celebrating) return;
    if (session.responses >= blockLen) return finish();
    if (diag) return presentProbe();
    // §40 slice 4: the fatigue knee ends the block warmly, checked BETWEEN trials only
    // (the meter's min-samples guard keeps a block from ending in its first minute).
    if (meter.knee() || (typeof window !== 'undefined' && window.__lessonKnee)) {
      return finish({ breather: true });
    }
    trial = nextTrial(run, session, lessons);
    if (!trial) return finish();
    const pool = lessons.find((l) => l.id === run.lessonId)?.words || [];
    entry = pool.find((e) => e.word === trial.word) || null;
    mountTrial();
  }

  // §40 slice 4: a diagnostic probe, presented as an ordinary trial.
  function presentProbe() {
    const probe = nextProbe(diag);
    if (!probe) return finishDiag();
    trial = { word: probe.word, expose: false, known: false, reteach: false, probe };
    entry = (lessons[probe.lessonIdx]?.words || []).find((e) => e.word === probe.word) || null;
    mountTrial(probe.lessonIdx);
  }

  function mountTrial(probeIdx = null) {
    target = trial.word.toLowerCase();
    isProper = isProperWord(entry ? entry.word : trial.word);
    slots = Array.from({ length: target.length }, () => null);
    copyMode = !!trial.expose;
    rung = 0;
    dirty = false;
    locked = false;
    startTime = 0;
    rtTainted = false; // a fresh trial's RT is clean again (fatigue-meter hygiene)
    clearTimeout(graceTimer);
    clearLadder();
    verdictEl.textContent = '';
    verdictChip.textContent = '';
    reteachEl.replaceChildren();
    sentenceEl.replaceChildren(...(entry ? blankedSentence(entry) : []));
    // a decayed (forgotten) word re-teaches on serve — rule + exemplars BEFORE input
    if (trial.reteach) showReteach();
    renderSlots();
    renderChip();
    renderDots();
    fit();
    // off-DOM test hooks (Playwright): the current trial + the block's trial log
    try {
      window.__lessonCurrent = {
        word: target, expose: !!trial.expose, known: !!trial.known, reteach: !!trial.reteach,
        lessonId: run.lessonId, rung, responses: session.responses,
        diag: probeIdx, // non-null while the spine diagnostic is probing
      };
      (window.__lessonTrialLog = window.__lessonTrialLog || []).push({ word: target, expose: !!trial.expose, known: !!trial.known });
    } catch {
      /* ignore */
    }
    dictate();
    armLadder();
  }

  // Show the current lesson's intro card first when it hasn't been seen, then play.
  // Used at boot and when the diagnostic finishes (the intro is the child's first
  // "a lesson started" moment — the check itself stays invisible).
  function maybeIntroThen() {
    if (needsIntro(run)) {
      const lesson = lessons.find((l) => l.id === run.lessonId);
      introOverlay = lessonIntro({
        lesson,
        audio,
        onGo: () => {
          introOverlay = null;
          markIntroSeen(run);
          ctx.save();
          present();
        },
      });
    } else {
      present();
    }
  }

  // --- boot: diagnostic first for an unplaced run; else intro card, then the stream ----
  buildKeyboard();
  renderChip();
  renderDots();
  if (diag) present();
  else maybeIntroThen();
  return screen;
}
