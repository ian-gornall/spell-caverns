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
import { el, header, burst } from '../ui.js';
import { buildSession, unlockedDifficulties, UNLOCK_THRESHOLDS } from '../engine/session.js';
import { buildOptions, mulberry32 } from '../engine/distractors.js';
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

export function startRhythm(ctx) {
  const { state, audio } = ctx;
  const settings = state.settings;
  const seed = (Date.now() >>> 0) || 1;
  const rng = mulberry32(seed);
  const unlockedAtStart = unlockedDifficulties(state.tracker);

  const session = buildSession(state.tracker, {
    difficulty: settings.difficulty,
    length: settings.length || 10,
    rng,
  });

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

  const hdr = header(ctx, { title: 'Mining', onBack: () => ctx.nav('home') });
  const gemCountEl = hdr.querySelector('.gem-count');

  const screen = el(
    'div',
    { class: 'screen rhythm' },
    hdr,
    dots,
    el('div', { class: 'combo-wrap' }, comboFill),
    comboLabel,
    el('div', { class: 'prompt' }, hearBtn, sentenceEl, verdictEl, verdictChip),
    speedMeter,
    tilesEl,
  );

  // --- per-session state -----------------------------------------------------
  let index = 0;
  let combo = 0;
  let earned = 0; // gems earned this wave (for the reward screen)
  let startTime = 0; // 0 = clock not started yet (still in the read window)
  let locked = false;
  let rafId = 0;
  let graceTimer = 0;

  if (!session.length) {
    sentenceEl.textContent = 'No words to dig right now — try a different difficulty in Settings.';
    speedMeter.style.display = 'none';
    return screen;
  }

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
    const base =
      typeof settings.difficulty === 'string' ? DIST_BASE[settings.difficulty] ?? 0.5 : 0.55;
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
    if (locked || !startTime) return;
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

    // Dictate, then hold the meter FULL (armed) until the word is fully spoken AND a
    // grace window passes — only THEN does the speed clock start ticking down.
    armMeter();
    audio.say(entry.word, {
      onDone: () => {
        if (locked) return;
        clearTimeout(graceTimer);
        graceTimer = setTimeout(() => {
          if (locked) return;
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
      earned += verdict.points;
      ctx.store.addGems(verdict.points);
      audio.sfx(verdict.isCombo ? 'combo' : verdict.tier);
      // speak the phrase on the moments that matter (fast tiers / combos), not every
      // tap (queued TTS lags). When spoken, it matches the on-screen phrase exactly.
      if (verdict.isCombo || verdict.tier === 'perfect' || verdict.tier === 'amazing') {
        audio.speakPraise(verdict.phrase);
      }
      btn.classList.add('correct');
      flashVerdict(verdict.phrase, `+${verdict.points} 💎 · ${verdict.label}`, verdict.color);
      const r = btn.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + r.height / 2, verdict.color, verdict.isCombo ? 26 : 14);
      bumpGems();
    } else {
      combo = 0;
      audio.sfx('miss');
      audio.speakPraise(verdict.phrase); // gentle encouragement (matches the text)
      btn.classList.add('wrong');
      flashVerdict(verdict.phrase, 'The gem was…', verdict.color);
      [...tilesEl.children].forEach((c) => {
        if (c.textContent === entry.word) c.classList.add('reveal');
      });
    }
    updateCombo(verdict);
    ctx.save();

    setTimeout(
      () => {
        index += 1;
        present();
      },
      correct ? 850 : 1600,
    );
  }

  function finish() {
    cancelAnimationFrame(rafId);
    ctx.store.recordSessionPlayed();
    ctx.save();

    const cur = typeof settings.difficulty === 'string' ? settings.difficulty : null;
    const unlockedNow = unlockedDifficulties(state.tracker);
    const newly = unlockedNow.filter((d) => !unlockedAtStart.includes(d));
    const harder = cur
      ? ORDER.slice(ORDER.indexOf(cur) + 1).filter((d) => unlockedNow.includes(d))
      : [];
    const nextHarder = harder[0];
    const nextLocked = ORDER.find((d) => !unlockedNow.includes(d));
    const knownCount = summary(state.tracker).counts.known;

    const grade = earned >= (settings.length || 10) * 18 ? '🏆' : earned > 0 ? '💎' : '⛏️';
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
  }

  present();
  return screen;
}
