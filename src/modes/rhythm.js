// src/modes/rhythm.js — THE CORE fast loop (DDR / Pump-It-Up style; HANDOFF §8).
//
// One word per beat:
//   dictate the word (audio.say) -> show its sentence with the word BLANKED for
//   context -> a LIVE "gems you'd earn right now" meter ticks DOWN to create speed
//   pressure -> 3-4 BIG answer tiles (distractors.buildOptions) -> learner TAPS one
//   -> praise.gradeAnswer drives instant SFX + the spoken praise phrase shown as the
//   on-screen feedback (so voice == text) + a gem-burst + the combo meter -> mastery
//   is recorded (progress.recordAnswer). Wrong stays gentle: soft sound, reveal the
//   correct spelling, no shaming.
//
// A "wave" = `length` words; then a reward screen that KEEPS THE LOOP GOING and
// surfaces progression — newly-unlocked difficulties to celebrate, a "go deeper"
// (harder) button when one is available, or a countdown to the next unlock — so it
// feels like you're getting somewhere (play-test feedback 2026-06-17).
//
// The session's words come from session.buildSession (the two-axis level builder).
// Distractor similarity adapts per word from predicted success. UI module — verified
// with Playwright, not node.
import { el, header, burst, toast, createIdleGuard, pulse } from '../ui.js';
import { buildSession, unlockedDifficulties, UNLOCK_THRESHOLDS } from '../engine/session.js';
import { buildOptions, mulberry32, shuffle } from '../engine/distractors.js';
import { byRank } from '../engine/lexicon.js';
import { gradeAnswer, projectedScore } from '../engine/praise.js';
import { recordAnswer, predictedSuccess, tierToPrior, summary } from '../engine/progress.js';
import { REAL_WORDS } from '../engine/lexicon.js';

// Per-preset baseline for how similar the distractors are (0 obvious -> 1 minimal
// difference). Adapted per word by the learner's predicted success below.
const DIST_BASE = { easy: 0.3, medium: 0.55, hard: 0.8 };
// The live meter spans roughly the speed tiers (perfect 1.2s .. great 3.5s); after
// this it sits at the floor ("Good", still full credit, just no speed bonus).
const METER_MS = 3500;
// After the word finishes being spoken, hold the meter FULL for this long so the
// learner can comprehend the word and read the choices before the clock starts
// (play-test feedback 2026-06-17: don't start the timer until the word is spoken).
const GRACE_MS = 1500;
const ORDER = ['easy', 'medium', 'hard'];
const cap = (s) => s[0].toUpperCase() + s.slice(1);

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function startRhythm(ctx, params = {}) {
  const { state, audio } = ctx;
  const settings = state.settings;
  const seed = (Date.now() >>> 0) || 1;
  const rng = mulberry32(seed);
  const unlockedAtStart = unlockedDifficulties(state.tracker);

  // First-run wave (from onboarding): short + easiest difficulty + obviously-wrong
  // distractors, so the learner's very first experience is a guaranteed WIN (SDT
  // competence). Otherwise the normal level builder from the kid's chosen settings.
  const firstRun = !!params.firstRun;
  const difficulty = firstRun ? 'easy' : settings.difficulty;
  const length = firstRun ? 5 : settings.length || 10;

  // First run: hand-pick the most common, easiest, spellable words (tier ≤2, 3-6
  // letters) so the welcome wave is a sure win — the level builder optimises for a
  // mastery TARGET and can surface a harder word, which we don't want here.
  const session = firstRun
    ? shuffle(
        byRank().filter((w) => w.tier <= 2 && w.word.length >= 3 && w.word.length <= 6).slice(0, 14),
        rng,
      ).slice(0, length)
    : buildSession(state.tracker, { difficulty, length, rng, startTier: state.startLevel || 1 });

  // --- static structure -----------------------------------------------------
  const dots = el('div', { class: 'dots' });
  const comboFill = el('div', { class: 'combo-fill' });
  const comboLabel = el('div', { class: 'combo-label' });
  const verdictEl = el('div', { class: 'verdict' }); // the SPOKEN phrase, shown big
  const verdictChip = el('div', { class: 'verdict-chip' }); // "+N 💎 · PERFECT"
  const sentenceEl = el('div', { class: 'sentence' });
  const tilesEl = el('div', { class: 'tiles' });

  const potentialEl = el('div', { class: 'speed-pot' });
  const speedFill = el('div', { class: 'speed-fill' });
  const speedMeter = el(
    'div',
    { class: 'speedmeter' },
    potentialEl,
    el('div', { class: 'speed-bar' }, speedFill),
  );

  const hearBtn = el(
    'button',
    { class: 'hear-again', onClick: () => audio.say(session[index]?.word) },
    el('span', { class: 'spk' }, '🔊'),
    'Hear it again',
  );
  // NOTE: "Sound it out" (syllable-by-syllable dictation, audio.saySlow) is DISABLED
  // for now — on iOS the device TTS reads short isolated syllables as letter names
  // ("spells it out") instead of blending them, so it confuses rather than helps
  // (user feedback 2026-06-18). The audio.saySlow helper stays in place for a future
  // revisit (e.g. real phoneme audio). Until then the prompt shows only "Hear it again".
  const hearRow = el('div', { class: 'hear-row' }, hearBtn);

  const hdr = header(ctx, { title: 'Mining', onBack: () => ctx.nav('home') });
  const gemCountEl = hdr.querySelector('.gem-count');

  const screen = el(
    'div',
    { class: 'screen rhythm' },
    hdr,
    dots,
    el('div', { class: 'combo-wrap' }, comboFill),
    comboLabel,
    el(
      'div',
      { class: 'play-body' },
      el('div', { class: 'prompt' }, hearRow, sentenceEl, verdictEl, verdictChip),
      el('div', { class: 'answer-zone' }, speedMeter, tilesEl),
    ),
  );

  // --- per-session state -----------------------------------------------------
  let index = 0;
  let combo = 0;
  let earned = 0; // gems earned this wave (for the reward screen)
  let startTime = 0; // 0 = clock not started yet (still in the read window)
  let locked = false;
  let paused = false; // true while the idle pause overlay is up (freeze the clock)
  let rafId = 0;
  let graceTimer = 0;
  let praiseDone = Promise.resolve(); // resolves when the last spoken praise finishes

  // Speak praise AND remember when it finishes, so the next word's dictation can
  // wait for it instead of cancelling it mid-phrase (clipping bug, HANDOFF §12).
  const speakPraiseTracked = (phrase) => {
    praiseDone = new Promise((res) => audio.speakPraise(phrase, { onDone: res }));
  };

  if (!session.length) {
    sentenceEl.textContent = 'No words to dig right now — try a different difficulty in Settings.';
    speedMeter.style.display = 'none';
    return screen;
  }

  // Keep the miner on task: if they stall, re-dictate + a gentle nudge; if they fully
  // blank out, a blocking "Paused — tap to resume" overlay (can't just zone out).
  const guard = createIdleGuard({
    onNudge: () => {
      if (locked) return; // mid-feedback / advancing — don't nag
      audio.say(session[index]?.word);
      toast('👂 Tap the word you heard!');
      tilesEl.classList.add('nudge');
      setTimeout(() => tilesEl.classList.remove('nudge'), 1300);
    },
    onPause: () => {
      paused = true; // freeze the speed clock while the overlay is up
      cancelAnimationFrame(rafId);
      clearTimeout(graceTimer);
    },
    onResume: () => {
      if (locked || index >= session.length) return;
      armAndDictate(session[index]); // fresh read window so the pause isn't penalised
    },
  });
  ctx.onLeave(() => guard.stop());

  function renderDots() {
    dots.replaceChildren(
      ...session.map((_, i) =>
        el('div', {
          class: 'dot' + (i < index ? ' done' : i === index ? ' current' : ''),
        }),
      ),
    );
  }

  function blankedSentence(entry) {
    const s = entry.sentence || '';
    const re = new RegExp('\\b' + escapeRegex(entry.word) + '\\b', 'i');
    const m = s.match(re);
    if (m) {
      return [s.slice(0, m.index), el('span', { class: 'blank' }, '_____'), s.slice(m.index + m[0].length)];
    }
    return [s]; // fallback: keep full sentence (still gives context)
  }

  // Distractor difficulty for THIS word: preset baseline nudged by how well the
  // learner is predicted to do — confident words get harder, closer distractors.
  function distractorDifficulty(entry) {
    if (firstRun) return 0.12; // obviously-wrong options for the guaranteed-win first wave
    const base = typeof difficulty === 'string' ? DIST_BASE[difficulty] ?? 0.5 : 0.55;
    const ps = predictedSuccess(state.tracker, entry.word, tierToPrior(entry.tier));
    return Math.max(0, Math.min(1, base + (ps - 0.5) * 0.4));
  }

  // "Armed" state: meter visible and FULL but not counting down yet — shown while
  // the word is spoken and during the grace window after it.
  function armMeter() {
    speedMeter.style.visibility = 'visible';
    speedMeter.classList.add('armed');
    const proj = projectedScore({ responseMs: 0, combo: combo + 1 });
    potentialEl.textContent = `💎 +${proj.points}`;
    potentialEl.style.color = proj.color;
    speedFill.style.width = '100%';
    speedFill.style.background = proj.color;
  }

  // Live "gems if you answer NOW" meter — depletes as the clock runs (the pressure
  // to be fast). Uses the exact scoring the award uses (projectedScore). Only runs
  // once the clock has started (startTime set, i.e. after the read window).
  function meterLoop() {
    if (locked || paused || !startTime) return;
    const elapsed = performance.now() - startTime;
    const proj = projectedScore({ responseMs: elapsed, combo: combo + 1 });
    potentialEl.textContent = `💎 +${proj.points}`;
    potentialEl.style.color = proj.color;
    const frac = Math.max(0.04, 1 - elapsed / METER_MS);
    speedFill.style.width = `${frac * 100}%`;
    speedFill.style.background = proj.color;
    rafId = requestAnimationFrame(meterLoop);
  }

  function bumpGems() {
    if (!gemCountEl) return;
    gemCountEl.textContent = String(state.gems || 0);
    gemCountEl.classList.remove('bump');
    void gemCountEl.offsetWidth;
    gemCountEl.classList.add('bump');
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

  function updateCombo(verdict) {
    comboFill.style.width = `${((combo % 5) / 5) * 100}%`;
    if (verdict && verdict.isCombo) comboLabel.textContent = `⚡ ${verdict.phrase}`;
    else if (combo >= 2) comboLabel.textContent = `🔥 Combo x${combo}`;
    else comboLabel.textContent = '';
  }

  function present() {
    if (index >= session.length) return finish();
    locked = false;
    startTime = 0; // read window: clock not started yet
    clearTimeout(graceTimer);
    cancelAnimationFrame(rafId);
    const entry = session[index];
    renderDots();
    verdictEl.classList.remove('flash');
    verdictEl.textContent = '';
    verdictChip.textContent = '';

    sentenceEl.replaceChildren(...blankedSentence(entry));

    const opts = buildOptions(entry.word, {
      count: settings.optionCount || 3,
      difficulty: distractorDifficulty(entry),
      curated: entry.misspellings,
      realWords: REAL_WORDS,
      rng,
    });

    tilesEl.classList.remove('locked');
    tilesEl.replaceChildren(
      ...opts.map((o) =>
        el('button', { class: 'tile', onClick: (e) => choose(o, entry, e.currentTarget) }, o.text),
      ),
    );

    // Test hook (Playwright): expose the current target off-DOM so a smoke test can
    // drive a deterministic correct/wrong tap. Not rendered, not used by gameplay.
    try {
      window.__rhythmCurrent = { word: entry.word, index, total: session.length };
    } catch {
      /* ignore */
    }

    armAndDictate(entry);
  }

  // Dictate the word and hold the meter FULL (armed) until it's fully spoken AND a
  // grace window passes — only THEN does the speed clock start. Also used to RESUME
  // after an idle pause (fresh read window + clock, so the pause isn't penalised).
  function armAndDictate(entry) {
    paused = false;
    startTime = 0;
    clearTimeout(graceTimer);
    cancelAnimationFrame(rafId);
    armMeter();
    audio.say(entry.word, {
      onDone: () => {
        if (locked || paused) return;
        clearTimeout(graceTimer);
        graceTimer = setTimeout(() => {
          if (locked || paused) return;
          startTime = performance.now(); // the speed clock starts now
          speedMeter.classList.remove('armed');
          cancelAnimationFrame(rafId);
          rafId = requestAnimationFrame(meterLoop);
        }, GRACE_MS);
      },
    });
  }

  function choose(o, entry, btn) {
    if (locked) return;
    locked = true;
    clearTimeout(graceTimer);
    cancelAnimationFrame(rafId);
    tilesEl.classList.add('locked');
    speedMeter.style.visibility = 'hidden';
    speedMeter.classList.remove('armed');

    // Tapping during the read window (clock not started) counts as the fastest tier —
    // no penalty for answering before the timer begins.
    const responseMs = startTime ? performance.now() - startTime : 0;
    const correct = !!o.correct;
    const streak = correct ? combo + 1 : 0;
    const verdict = gradeAnswer({ correct, responseMs, combo: streak, rng });

    // feed the continuous mastery tracker + lifetime stats (same path as assessment)
    recordAnswer(state.tracker, entry.word, correct, { responseMs });
    ctx.store.recordAnswerStat(correct);

    if (correct) {
      combo = streak;
      ctx.store.recordCombo(combo); // best combo today (daily quest)
      earned += verdict.points;
      ctx.store.addGems(verdict.points);
      audio.sfx(verdict.isCombo ? 'combo' : verdict.tier);
      // speak the phrase on the moments that matter (fast tiers / combos), not every
      // tap (queued TTS lags). When spoken, it matches the on-screen phrase exactly.
      if (verdict.isCombo || verdict.tier === 'perfect' || verdict.tier === 'amazing') {
        speakPraiseTracked(verdict.phrase);
      }
      btn.classList.add('correct');
      flashVerdict(verdict.phrase, `+${verdict.points} 💎 · ${verdict.label}`, verdict.color);
      const r = btn.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + r.height / 2, verdict.color, verdict.isCombo ? 26 : 14);
      bumpGems();
    } else {
      combo = 0;
      audio.sfx('miss');
      speakPraiseTracked(verdict.phrase); // gentle encouragement (matches the text)
      btn.classList.add('wrong');
      flashVerdict(verdict.phrase, 'The gem was…', verdict.color);
    }
    // Spotlight the CORRECT spelling and fade the wrong options, so the last thing
    // on screen is the right answer — seeing misspellings linger imprints them
    // (Roediger & Marsh 2005), and our learner is a weak speller.
    [...tilesEl.children].forEach((c) => {
      if (c.textContent === entry.word) c.classList.add('reveal');
      else c.classList.add('dim-out');
    });
    updateCombo(verdict);
    ctx.save();

    // Advance only AFTER any spoken praise has finished, so dictating the next word
    // doesn't cut it off (clipping bug, HANDOFF §12). `floor` keeps the verdict on
    // screen long enough to read; `cap` is a backstop so a missing onDone never
    // stalls the loop. When no praise was spoken, praiseDone is already resolved.
    const floor = correct ? 850 : 1400;
    const cap = correct ? 2400 : 2800;
    let advanced = false;
    const go = () => {
      if (advanced) return;
      advanced = true;
      index += 1;
      present();
    };
    const t0 = performance.now();
    praiseDone.then(() => setTimeout(go, Math.max(0, floor - (performance.now() - t0))));
    setTimeout(go, cap);
  }

  function finish() {
    guard.stop(); // wave reward is a menu, not active play
    cancelAnimationFrame(rafId);
    ctx.store.recordSessionPlayed();
    ctx.store.noteWaveEarned(earned); // personal best ("beat your best")
    ctx.save();
    // Broke through to a new cavern depth? Hand off to the GEODE BOSS milestone
    // (named-zone celebration + the free catalog mineral). Pending until cracked, so
    // leaving early never skips it. Otherwise show the normal wave reward.
    if (ctx.depth() > ctx.store.lastMilestoneDepth()) {
      // crack the NEXT uncracked level (one per boss, even if depth jumped several)
      return ctx.nav('boss', { depth: ctx.store.lastMilestoneDepth() + 1, earned, from: 'rhythm' });
    }

    const cur = typeof settings.difficulty === 'string' ? settings.difficulty : null;
    const unlockedNow = unlockedDifficulties(state.tracker);
    const newly = unlockedNow.filter((d) => !unlockedAtStart.includes(d));
    const harder = cur
      ? ORDER.slice(ORDER.indexOf(cur) + 1).filter((d) => unlockedNow.includes(d))
      : [];
    const nextHarder = harder[0];
    const nextLocked = ORDER.find((d) => !unlockedNow.includes(d));
    const knownCount = summary(state.tracker).counts.known;

    const grade = earned >= session.length * 18 ? '🏆' : earned > 0 ? '💎' : '⛏️';
    const goHarder = () => {
      settings.difficulty = nextHarder;
      ctx.save();
      ctx.nav('rhythm');
    };

    const buttons = [];
    if (nextHarder) {
      buttons.push(
        el('button', { class: 'btn primary', onClick: goHarder }, `⏫ Go deeper: ${cap(nextHarder)}`),
        el('button', { class: 'btn', onClick: () => ctx.nav('rhythm') }, '⛏️ Same depth'),
      );
    } else {
      buttons.push(
        el('button', { class: 'btn primary', onClick: () => ctx.nav('rhythm') }, '⛏️ Keep mining'),
      );
    }
    buttons.push(
      // Cross-link to Craft so the two modes ALTERNATE easily (requirement #9: fast
      // choices broken up by slower build puzzles). Puzzle already links back to Mine.
      el('button', { class: 'btn', onClick: () => ctx.nav('puzzle') }, '🔨 Craft (build)'),
      el('button', { class: 'btn', onClick: () => ctx.nav('progress') }, '🗺️ Progress'),
      el('button', { class: 'btn', onClick: () => ctx.nav('home') }, '🏠 Home'),
    );

    const progressLine =
      newly.length > 0
        ? el('div', { class: 'unlock-banner' }, `🔓 New depth unlocked: ${newly.map(cap).join(', ')}!`)
        : nextLocked
          ? el(
              'div',
              { class: 'unlock-hint' },
              `🔒 ${cap(nextLocked)} unlocks in ${Math.max(0, UNLOCK_THRESHOLDS[nextLocked] - knownCount)} more mastered word(s)`,
            )
          : el('div', { class: 'unlock-banner' }, '🌟 All depths unlocked — you’re a master miner!');

    const reward = el(
      'div',
      { class: 'reward' },
      el('div', { class: 'big' }, grade),
      el('h2', {}, 'Wave complete!'),
      el('div', { class: 'earned' }, `+${earned} gems mined`),
      progressLine,
      el('p', { style: { color: 'var(--ink-dim)' } }, `Total: 💎 ${state.gems || 0}  ·  Depth ⛏️ ${ctx.depth()}`),
      el('div', { class: 'row' }, ...buttons),
    );

    screen.replaceChildren(
      header(ctx, { title: 'Wave complete', onBack: () => ctx.nav('home') }),
      reward,
    );
    if (newly.length > 0) audio.sfx('combo');
    else if (earned > 0) audio.sfx('great');

    // Don't let them stall on the reward: highlight the primary action, then
    // auto-continue into another wave ("let's go" — keep them mining).
    const primaryAction = nextHarder ? goHarder : () => ctx.nav('rhythm');
    const rewardGuard = createIdleGuard({
      nudgeMs: 13000,
      pauseMs: 30000,
      onNudge: () => pulse(reward.querySelector('.btn.primary')),
      onTimeout: () => {
        toast('⛏️ Back to mining!');
        primaryAction();
      },
    });
    ctx.onLeave(() => rewardGuard.stop());
  }

  present();
  return screen;
}
