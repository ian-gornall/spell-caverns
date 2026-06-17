// src/modes/rhythm.js — THE CORE fast loop (DDR / Pump-It-Up style; HANDOFF §8).
//
// One word per beat:
//   dictate the word (audio.say) -> show its sentence with the word BLANKED for
//   context -> slide in 3-4 BIG answer tiles (distractors.buildOptions) -> learner
//   TAPS one fast -> praise.gradeAnswer drives instant SFX + a big colored label +
//   spoken speed/combo praise + a gem-mine burst + the combo meter -> mastery is
//   recorded (progress.recordAnswer). Wrong stays gentle: soft sound, reveal the
//   correct spelling, no shaming. A "wave" = `length` words, then a reward that
//   keeps the loop going (keep mining / home).
//
// The session's words come from session.buildSession (the two-axis level builder).
// Difficulty of the DISTRACTORS adapts per word from the learner's predicted
// success, so easy words get obvious wrong answers and mastered words get the
// very-similar-spelling endgame. UI module — verified with Playwright, not node.
import { el, header, burst, toast } from '../ui.js';
import { buildSession } from '../engine/session.js';
import { buildOptions, mulberry32 } from '../engine/distractors.js';
import { gradeAnswer } from '../engine/praise.js';
import { recordAnswer, predictedSuccess, tierToPrior } from '../engine/progress.js';
import { REAL_WORDS } from '../engine/lexicon.js';

// Per-preset baseline for how similar the distractors are (0 obvious -> 1 minimal
// difference). Adapted per word by the learner's predicted success below.
const DIST_BASE = { easy: 0.3, medium: 0.55, hard: 0.8 };

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function startRhythm(ctx) {
  const { state, audio } = ctx;
  const settings = state.settings;
  const seed = (Date.now() >>> 0) || 1;
  const rng = mulberry32(seed);

  const session = buildSession(state.tracker, {
    difficulty: settings.difficulty,
    length: settings.length || 10,
    rng,
  });

  // --- static structure -----------------------------------------------------
  const dots = el('div', { class: 'dots' });
  const comboFill = el('div', { class: 'combo-fill' });
  const comboLabel = el('div', { class: 'combo-label' });
  const verdictEl = el('div', { class: 'verdict' });
  const sentenceEl = el('div', { class: 'sentence' });
  const tilesEl = el('div', { class: 'tiles' });
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
    el(
      'div',
      { class: 'prompt' },
      hearBtn,
      sentenceEl,
      verdictEl,
    ),
    tilesEl,
  );

  // --- per-session state -----------------------------------------------------
  let index = 0;
  let combo = 0;
  let earned = 0; // gems earned this wave (for the reward screen)
  let startTime = 0;
  let locked = false;

  if (!session.length) {
    sentenceEl.textContent = 'No words to dig right now — try a different difficulty in Settings.';
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
    if (re.test(s)) {
      // split so the blank can be styled, the rest stays plain text
      const m = s.match(re);
      const before = s.slice(0, m.index);
      const after = s.slice(m.index + m[0].length);
      return [before, el('span', { class: 'blank' }, '_____'), after];
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

  function bumpGems() {
    if (!gemCountEl) return;
    gemCountEl.textContent = String(state.gems || 0);
    gemCountEl.classList.remove('bump');
    void gemCountEl.offsetWidth; // restart animation
    gemCountEl.classList.add('bump');
  }

  function flashVerdict(text, color) {
    verdictEl.textContent = text;
    verdictEl.style.color = color;
    verdictEl.classList.remove('flash');
    void verdictEl.offsetWidth;
    verdictEl.classList.add('flash');
  }

  function updateCombo(verdict) {
    const within = combo % 5;
    comboFill.style.width = `${(within / 5) * 100}%`;
    if (combo >= 2) comboLabel.textContent = `🔥 Combo x${combo}`;
    else comboLabel.textContent = '';
    if (verdict && verdict.isCombo) comboLabel.textContent = `⚡ ${verdict.phrase}`;
  }

  function present() {
    if (index >= session.length) return finish();
    locked = false;
    const entry = session[index];
    renderDots();
    verdictEl.classList.remove('flash');
    verdictEl.textContent = '';

    sentenceEl.replaceChildren(...blankedSentence(entry));
    audio.say(entry.word);

    // Test hook (Playwright): expose the current target off-DOM so a smoke test can
    // drive a deterministic correct/wrong tap. Not rendered, not used by gameplay.
    try {
      window.__rhythmCurrent = { word: entry.word, index, total: session.length };
    } catch {
      /* ignore */
    }

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
        el(
          'button',
          { class: 'tile', onClick: (e) => choose(o, entry, e.currentTarget) },
          o.text,
        ),
      ),
    );
    startTime = performance.now();
  }

  function choose(o, entry, btn) {
    if (locked) return;
    locked = true;
    tilesEl.classList.add('locked');

    const responseMs = performance.now() - startTime;
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
      // speak only on the moments that matter (fast tiers / combos) — not every tap
      if (verdict.isCombo || verdict.tier === 'perfect' || verdict.tier === 'amazing') {
        audio.speakPraise(verdict.phrase);
      }
      btn.classList.add('correct');
      flashVerdict(verdict.label, verdict.color);
      const r = btn.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + r.height / 2, verdict.color, verdict.isCombo ? 26 : 14);
      bumpGems();
    } else {
      combo = 0;
      audio.sfx('miss');
      audio.speakPraise(verdict.phrase); // gentle encouragement
      btn.classList.add('wrong');
      flashVerdict(verdict.label, verdict.color);
      // reveal the correct spelling so the word is still seen correctly
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
      correct ? 850 : 1500,
    );
  }

  function finish() {
    ctx.store.recordSessionPlayed();
    ctx.save();
    const grade = earned >= (settings.length || 10) * 18 ? '🏆' : earned > 0 ? '💎' : '⛏️';
    const reward = el(
      'div',
      { class: 'reward' },
      el('div', { class: 'big' }, grade),
      el('h2', {}, 'Wave complete!'),
      el('div', { class: 'earned' }, `+${earned} gems mined`),
      el('p', { style: { color: 'var(--ink-dim)' } }, `Total: 💎 ${state.gems || 0}`),
      el(
        'div',
        { class: 'row' },
        el('button', { class: 'btn primary', onClick: () => ctx.nav('rhythm') }, '⛏️ Keep mining'),
        el('button', { class: 'btn', onClick: () => ctx.nav('progress') }, '🗺️ Progress'),
        el('button', { class: 'btn', onClick: () => ctx.nav('home') }, '🏠 Home'),
      ),
    );
    // swap the play area for the reward, keep the header
    screen.replaceChildren(header(ctx, { title: 'Wave complete', onBack: () => ctx.nav('home') }), reward);
    if (earned > 0) audio.sfx('combo');
  }

  present();
  return screen;
}
