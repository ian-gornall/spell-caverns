// src/modes/mastery.js — §30 MASTERY mode: DRAW the letters (the new headline).
//
// The mastery TEST: the learner hears a word and spells it with NO letter tiles to choose
// from — they DRAW each letter on a canvas. A FREE + OFFLINE on-device recognizer
// (engine/handwriting.js, grid/Dice matching against templates rendered from the app font)
// offers up to 4 HIGH-CONFIDENCE letterforms; the learner taps the right one (or redraws if
// none are offered). The spelling fills one letter at a time; tapping a placed letter redoes
// it. Case-insensitive (expect lowercase, accept uppercase). One clean success = MASTERED
// (categories.recordDraw); a wrong finish is a gentle miss. Gated behind unlocks().mastery
// (after [set size] words reach KNOWN via craft). UI module — verified with Playwright.
import { el, header, burst, toast, createIdleGuard, pulse } from '../ui.js';
import { buildMasteryPool } from '../engine/selection.js';
import { recordDraw, unlocks } from '../engine/categories.js';
import { recognizeGrid, pointsToGrid, GRID_N } from '../engine/handwriting.js';
import { byRank } from '../engine/lexicon.js';
import { mulberry32 } from '../engine/distractors.js';

const MASTERY_GEMS = 25; // flat reward for mastering a word (drawing is slow; speed is irrelevant)
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// --- letter templates: rasterise each glyph of the app font ONCE (cached) ---------------
let templatesPromise = null;
function ensureTemplates() {
  if (!templatesPromise) templatesPromise = buildTemplates();
  return templatesPromise;
}
async function buildTemplates() {
  try {
    await document.fonts.load("48px 'Atkinson Hyperlegible'");
    await document.fonts.ready;
  } catch {
    /* fall back to whatever font is available */
  }
  const S = 64;
  const cv = document.createElement('canvas');
  cv.width = S;
  cv.height = S;
  const c = cv.getContext('2d', { willReadFrequently: true });
  const templates = [];
  for (const letter of ALPHABET) {
    c.clearRect(0, 0, S, S);
    c.fillStyle = '#fff';
    c.font = `700 ${S - 14}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(letter, S / 2, S / 2 + 2);
    const data = c.getImageData(0, 0, S, S).data;
    const pts = [];
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        if (data[(y * S + x) * 4 + 3] > 80) pts.push({ x, y });
      }
    }
    templates.push({ letter, grid: pointsToGrid(pts, GRID_N, 1) });
  }
  return templates;
}

function lockedScreen(ctx, message) {
  return el(
    'div',
    { class: 'screen mastery' },
    header(ctx, { title: 'Mastery', onBack: () => ctx.nav('home') }),
    el(
      'div',
      { class: 'reward' },
      el('div', { class: 'big' }, '🔒'),
      el('h2', {}, 'Mastery'),
      el('p', { style: { color: 'var(--ink-dim)' } }, message),
      el(
        'div',
        { class: 'row' },
        el('button', { class: 'btn primary', onClick: () => ctx.nav('puzzle') }, '🔨 Go craft words'),
        el('button', { class: 'btn', onClick: () => ctx.nav('home') }, '🏠 Home'),
      ),
    ),
  );
}

export function startMastery(ctx, params = {}) {
  const { state, audio } = ctx;
  const settings = state.settings;
  const rng = mulberry32((Date.now() >>> 0) || 1);

  // Gate: mastery opens once [set size] words have reached KNOWN via crafting (§30 unlock chain).
  if (!unlocks(state.categories).mastery) {
    return lockedScreen(ctx, 'Mastery opens once you’ve learned some words by crafting them. Keep crafting! 🔨');
  }
  const pool = byRank().filter((w) => w.word.length >= 3);
  const length = Math.min(settings.length || 10, 5); // drawing is deliberate — keep waves short
  const session = buildMasteryPool(state.categories, pool, { length, rng });
  if (!session.length) {
    return lockedScreen(ctx, 'You’ve mastered all your learned words — go craft some new ones! ✨');
  }
  ensureTemplates(); // warm the recognizer

  // --- structure -----------------------------------------------------------
  const dots = el('div', { class: 'dots' });
  const verdictEl = el('div', { class: 'verdict' });
  const verdictChip = el('div', { class: 'verdict-chip' });
  const sentenceEl = el('div', { class: 'sentence' });
  const slotsEl = el('div', { class: 'slots draw-slots' });
  const canvas = el('canvas', { class: 'draw-canvas', width: 320, height: 200 });
  const candidatesEl = el('div', { class: 'draw-candidates' });
  const hearBtn = el(
    'button',
    { class: 'hear-again', onClick: () => audio.say(session[index]?.word) },
    el('span', { class: 'spk' }, '🔊'),
    'Hear it again',
  );
  const clearBtn = el('button', { class: 'btn ghost', onClick: clearCanvas }, '↺ Clear');
  const controlsEl = el('div', { class: 'draw-controls' }, clearBtn);
  const hintEl = el('div', { class: 'draw-hint' }, 'Draw a letter — I’ll guess it, then tap the one you meant.');

  const hdr = header(ctx, { title: 'Mastery — draw it', onBack: () => ctx.nav('home') });
  const gemCountEl = hdr.querySelector('.gem-count');

  const screen = el(
    'div',
    { class: 'screen mastery' },
    hdr,
    dots,
    el(
      'div',
      { class: 'play-body' },
      el('div', { class: 'prompt' }, el('div', { class: 'hear-row' }, hearBtn), sentenceEl, verdictEl, verdictChip),
      el('div', { class: 'answer-zone' }, slotsEl, el('div', { class: 'draw-stage' }, canvas, candidatesEl), hintEl, controlsEl),
    ),
  );

  // --- per-session / per-word state ---------------------------------------
  let index = 0;
  let earned = 0;
  let target = '';
  let slots = []; // built spelling (letters or null)
  let cur = 0; // active slot (where the next drawn letter lands)
  let locked = false; // true during the success/advance animation
  let strokes = []; // [[{x,y}...] ...] the current letter's pen strokes
  let drawing = false;
  let recognizeTimer = 0; // debounce: auto-recognise shortly after the pen lifts (no button)
  const ctx2d = canvas.getContext('2d');
  // Wait this long after the LAST pen-up before guessing, so a multi-stroke letter (t, i, x, k)
  // isn't recognised after only its first stroke. A new stroke cancels + reschedules.
  const RECOGNIZE_DEBOUNCE_MS = 850;

  const guard = createIdleGuard({
    onNudge: () => {
      if (locked) return;
      audio.say(target);
      toast('✍️ Draw the next letter!');
      pulse(canvas);
    },
    onResume: () => !locked && audio.say(target),
  });
  ctx.onLeave(() => {
    guard.stop();
    clearTimeout(recognizeTimer);
  });

  // --- canvas drawing ------------------------------------------------------
  function paintStyle() {
    ctx2d.lineWidth = 9;
    ctx2d.lineCap = 'round';
    ctx2d.lineJoin = 'round';
    ctx2d.strokeStyle = '#36F1CD';
  }
  function canvasXY(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) };
  }
  function clearCanvas() {
    clearTimeout(recognizeTimer);
    strokes = [];
    ctx2d.clearRect(0, 0, canvas.width, canvas.height);
    candidatesEl.replaceChildren();
  }
  canvas.addEventListener('pointerdown', (e) => {
    if (locked) return;
    clearTimeout(recognizeTimer); // a new stroke: cancel any pending guess + drop stale candidates
    candidatesEl.replaceChildren();
    drawing = true;
    canvas.setPointerCapture?.(e.pointerId);
    const p = canvasXY(e);
    strokes.push([p]);
    paintStyle();
    ctx2d.beginPath();
    ctx2d.moveTo(p.x, p.y);
    e.preventDefault();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drawing || locked) return;
    const p = canvasXY(e);
    strokes[strokes.length - 1].push(p);
    ctx2d.lineTo(p.x, p.y);
    ctx2d.stroke();
    e.preventDefault();
  });
  const endStroke = () => {
    if (!drawing) return;
    drawing = false;
    // auto-recognise after a short pause (so multi-stroke letters finish first) — no button
    clearTimeout(recognizeTimer);
    recognizeTimer = setTimeout(readLetter, RECOGNIZE_DEBOUNCE_MS);
  };
  canvas.addEventListener('pointerup', endStroke);
  canvas.addEventListener('pointercancel', endStroke);
  canvas.addEventListener('pointerleave', endStroke);

  // --- recognition ---------------------------------------------------------
  async function readLetter() {
    if (locked) return;
    const flat = strokes.reduce((n, s) => n + s.length, 0);
    if (flat < 2) return; // nothing meaningful drawn (auto-triggered — stay quiet)
    const templates = await ensureTemplates();
    const cands = recognizeGrid(strokes, templates, { maxCandidates: 4 });
    if (!cands.length) {
      toast('🤔 Hmm, try drawing that letter again');
      clearCanvas();
      pulse(canvas);
      return;
    }
    renderCandidates(cands);
  }

  function renderCandidates(cands) {
    candidatesEl.replaceChildren(
      el('div', { class: 'cand-label' }, 'Is it…'),
      el(
        'div',
        { class: 'cand-row' },
        ...cands.map((c) =>
          el('button', { class: 'cand-letter', onClick: () => placeLetter(c.letter) }, c.letter),
        ),
      ),
    );
  }

  // --- placing / redoing ---------------------------------------------------
  function placeLetter(letter) {
    if (locked || cur < 0 || cur >= slots.length) return;
    slots[cur] = letter.toLowerCase();
    audio.sfx('tap');
    clearCanvas();
    cur = slots.findIndex((s) => s == null);
    renderSlots();
    if (cur === -1) checkWord();
  }

  function redoSlot(i) {
    if (locked || !slots[i]) return;
    slots[i] = null;
    cur = i;
    clearCanvas();
    renderSlots();
  }

  function renderSlots() {
    slotsEl.replaceChildren(
      ...slots.map((s, i) =>
        el(
          'button',
          {
            class: 'slot' + (s ? ' filled' : '') + (i === cur ? ' current' : ''),
            onClick: () => redoSlot(i),
          },
          s || '',
        ),
      ),
    );
  }

  // --- grading -------------------------------------------------------------
  function checkWord() {
    const built = slots.join('');
    if (built === target) {
      locked = true;
      // §30: a draw success is the ONLY path to MASTERED.
      recordDraw(state.categories, target, true);
      earned += MASTERY_GEMS;
      ctx.store.addGems(MASTERY_GEMS);
      ctx.store.recordAnswerStat(true, 'mastery');
      audio.sfx('combo');
      audio.speakPraise('Mastered!');
      flashVerdict('⭐ Mastered!', `+${MASTERY_GEMS} 💎 · Drawn from memory`, '#FFD23F');
      const r = slotsEl.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + r.height / 2, '#FFD23F', 22);
      bumpGems();
      slotsEl.querySelectorAll('.slot').forEach((s) => s.classList.add('locked'));
      ctx.save();
      setTimeout(() => {
        index += 1;
        present();
      }, 1300);
    } else {
      // a wrong finish is a gentle MISS (recordDraw(false): a mastered word drops to known,
      // a merely-known word stays known). Keep the correct letters, clear the wrong ones to redo.
      recordDraw(state.categories, target, false);
      audio.sfx('miss');
      audio.speakPraise('Almost — try those letters again!');
      flashVerdict('Almost!', 'Fix the glowing letters', '#8593A3');
      for (let i = 0; i < slots.length; i++) if (slots[i] !== target[i]) slots[i] = null;
      cur = slots.findIndex((s) => s == null);
      slotsEl.classList.remove('shake');
      void slotsEl.offsetWidth;
      slotsEl.classList.add('shake');
      renderSlots();
      ctx.save();
    }
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
  function renderDots() {
    dots.replaceChildren(
      ...session.map((_, i) => el('div', { class: 'dot' + (i < index ? ' done' : i === index ? ' current' : '') })),
    );
  }
  function blankedSentence(entry) {
    const s = entry.sentence || '';
    const re = new RegExp('\\b' + escapeRegex(entry.word) + '\\b', 'i');
    const m = s.match(re);
    if (m) return [s.slice(0, m.index), el('span', { class: 'blank' }, '_____'), s.slice(m.index + m[0].length)];
    return [s];
  }

  // --- per-word setup ------------------------------------------------------
  function present() {
    if (index >= session.length) return finish();
    locked = false;
    const entry = session[index];
    target = entry.word.toLowerCase();
    slots = Array.from({ length: target.length }, () => null);
    cur = 0;
    clearCanvas();
    verdictEl.textContent = '';
    verdictChip.textContent = '';
    sentenceEl.replaceChildren(...blankedSentence(entry));
    renderDots();
    renderSlots();
    try {
      window.__masteryCurrent = { word: target, index, total: session.length };
    } catch {
      /* ignore */
    }
    audio.say(target);
  }

  function finish() {
    guard.stop();
    ctx.store.recordSessionPlayed();
    ctx.store.noteWaveEarned(earned);
    ctx.save();
    const reward = el(
      'div',
      { class: 'reward' },
      el('div', { class: 'big' }, earned > 0 ? '⭐' : '✍️'),
      el('h2', {}, 'Mastery round done!'),
      el('div', { class: 'earned' }, `+${earned} gems`),
      el('p', { style: { color: 'var(--ink-dim)' } }, `Total: 💎 ${state.gems || 0}`),
      el(
        'div',
        { class: 'row' },
        el('button', { class: 'btn primary', onClick: () => ctx.nav('mastery') }, '✍️ Draw more'),
        el('button', { class: 'btn', onClick: () => ctx.nav('puzzle') }, '🔨 Craft'),
        el('button', { class: 'btn', onClick: () => ctx.nav('home') }, '🏠 Home'),
      ),
    );
    screen.replaceChildren(header(ctx, { title: 'Mastery done', onBack: () => ctx.nav('home') }), reward);
    if (earned > 0) audio.sfx('great');
  }

  present();
  return screen;
}
