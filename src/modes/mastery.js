// src/modes/mastery.js — §30 MASTERY mode: DRAW the letters (the new headline), with the
// §31 upgrades (whole-word writing on wide screens + a dictation toggle).
//
// The mastery TEST: the learner hears a word and spells it with NO letter tiles to choose
// from — they DRAW each letter. A FREE + OFFLINE on-device recognizer (the EMNIST CNN in
// cnn_recognizer.js, with engine/handwriting.js grid matching as the fallback) reads each
// drawn letter. One clean success = MASTERED (categories.recordDraw); a wrong finish is a
// gentle miss. Gated behind unlocks().mastery (after [set size] words reach KNOWN via craft).
//
// §31.A — WHOLE-WORD WRITING on WIDE screens (≥700px: tablet/desktop/landscape iPad): instead
//   of one canvas one-letter-at-a-time, show a ROW OF PER-LETTER MINI-CANVASES (one box per
//   letter). The learner writes box 1, 2, 3… freely WITHOUT waiting for each guess; each box
//   recognises independently on pen-up and AUTO-FILLS its best guess; tap a box to redo it.
//   PHONE (narrow) keeps the proven single-canvas flow (no room for a row). The keyboard
//   fallback still fills the word left-to-right in either layout.
// §31.B — DICTATION toggle: spell from HEARING ALONE — the example sentence is hidden by
//   default with a 👀 Peek button to reveal it (kid-friendly, not punishing).
//
// UI module — verified with Playwright.
import { el, header, burst, toast, createIdleGuard, pulse } from '../ui.js';
import { buildMasteryPool } from '../engine/selection.js';
import { recordDraw, unlocks } from '../engine/categories.js';
import { recognizeGrid, pointsToGrid, GRID_N } from '../engine/handwriting.js';
import { ensureRecognizer, recognizeDrawing } from '../cnn_recognizer.js';
import { byRank } from '../engine/lexicon.js';
import { mulberry32 } from '../engine/distractors.js';

const MASTERY_GEMS = 25; // flat reward for mastering a word (drawing is slow; speed is irrelevant)
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';
// §31.A: at/above this width the multi-box "write the whole word" layout fits; below it we keep
// the single-canvas flow (a phone has no room for a row of per-letter boxes — and this keeps the
// §29 narrow-viewport no-horizontal-scroll guards green, which only exercise phone widths).
const WIDE_QUERY = '(min-width: 700px)';

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

// Recognise a set of pen strokes → ranked candidate letters. Tries the CNN first, falls back
// to the grid template matcher if TF.js/model can't load on this device. `[]` = too unsure.
async function recognizeStrokes(strokes, maxCandidates) {
  try {
    return await recognizeDrawing(strokes, { maxCandidates }); // the on-device CNN
  } catch {
    try {
      return recognizeGrid(strokes, await ensureTemplates(), { maxCandidates });
    } catch {
      return [];
    }
  }
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
  ensureRecognizer().catch(() => {}); // lazy-load the CNN + model (cached); grid is the fallback
  ensureTemplates(); // warm the grid fallback recognizer

  // --- structure -----------------------------------------------------------
  const dots = el('div', { class: 'dots' });
  const verdictEl = el('div', { class: 'verdict' });
  const verdictChip = el('div', { class: 'verdict-chip' });
  const sentenceEl = el('div', { class: 'sentence' });
  const slotsEl = el('div', { class: 'slots draw-slots' });
  // PHONE (narrow): a single shared canvas + up-to-4 candidate letterforms.
  const canvas = el('canvas', { class: 'draw-canvas', width: 320, height: 200 });
  const candidatesEl = el('div', { class: 'draw-candidates' });
  const drawStageEl = el('div', { class: 'draw-stage' }, canvas, candidatesEl);
  // WIDE (§31.A): a row of per-letter mini-canvases — write the whole word freely.
  const boxesEl = el('div', { class: 'draw-boxes' });
  // keyboard fallback (user request): type the word with the on-screen / physical keyboard.
  const typeInput = el('input', {
    class: 'draw-type-input',
    type: 'text',
    inputmode: 'text',
    autocapitalize: 'off',
    autocomplete: 'off',
    autocorrect: 'off',
    spellcheck: 'false',
    'aria-label': 'Type the word',
    onInput: onTypeInput,
    onKeydown: (e) => {
      if (e.key === 'Enter') checkWord();
    },
  });
  const typeWrapEl = el('div', { class: 'draw-type-wrap', style: { display: 'none' } }, typeInput);
  const hearBtn = el(
    'button',
    { class: 'hear-again', onClick: () => audio.say(session[index]?.word) },
    el('span', { class: 'spk' }, '🔊'),
    'Hear it again',
  );
  // §31.B dictation: a Peek button reveals the (otherwise hidden) example sentence.
  const peekBtn = el('button', { class: 'btn ghost peek-btn', onClick: () => { peeked = !peeked; applyDictation(); } }, '👀 Peek');
  const peekRow = el('div', { class: 'peek-row', style: { display: 'none' } }, peekBtn);

  const clearBtn = el('button', { class: 'btn ghost', onClick: clearCurrent }, '↺ Clear');
  const dictBtn = el('button', { class: 'btn ghost', onClick: () => setDictation(!dictation) }, '📣 Dictation');
  const toggleBtn = el('button', { class: 'btn ghost', onClick: () => setMode(inputMode === 'draw' ? 'type' : 'draw') }, '⌨️ Type it');
  const controlsEl = el('div', { class: 'draw-controls' }, clearBtn, dictBtn, toggleBtn);
  const hintEl = el('div', { class: 'draw-hint' }, '');

  const hdr = header(ctx, { title: 'Mastery', onBack: () => ctx.nav('home') });
  const gemCountEl = hdr.querySelector('.gem-count');

  const screen = el(
    'div',
    { class: 'screen mastery' },
    hdr,
    dots,
    el(
      'div',
      { class: 'play-body' },
      el('div', { class: 'prompt' }, el('div', { class: 'hear-row' }, hearBtn), sentenceEl, peekRow, verdictEl, verdictChip),
      el('div', { class: 'answer-zone' }, slotsEl, drawStageEl, boxesEl, typeWrapEl, hintEl, controlsEl),
    ),
  );

  // --- per-session / per-word state ---------------------------------------
  let index = 0;
  let earned = 0;
  let target = '';
  let slots = []; // built spelling (letters or null)
  let cur = 0; // active slot (single-canvas + type flows; where the next drawn/typed letter lands)
  let locked = false; // true during the success/advance animation
  let strokes = []; // single-canvas: the current letter's pen strokes
  let drawing = false;
  let inputMode = 'draw'; // 'draw' (handwriting) | 'type' (keyboard fallback)
  let dictation = false; // §31.B: spell from hearing alone (sentence hidden unless peeked)
  let peeked = false;
  let recognizeTimer = 0; // single-canvas debounce: auto-recognise shortly after the pen lifts
  let boxStates = []; // §31.A: one per letter box { box, cv, ctx, strokes, timer, drawing, letterSpan }
  const ctx2d = canvas.getContext('2d');
  // §31.A responsive layout: re-evaluated live so rotating an iPad swaps layouts.
  const mediaWide = window.matchMedia ? window.matchMedia(WIDE_QUERY) : { matches: false, addEventListener() {}, removeEventListener() {} };
  let layoutWide = !!mediaWide.matches;
  // Wait this long after the LAST pen-up before guessing, so a multi-stroke letter (t, i, x, k)
  // isn't recognised after only its first stroke. A new stroke cancels + reschedules.
  const RECOGNIZE_DEBOUNCE_MS = 850;

  // In WIDE layout the per-letter BOXES are the word display (drawable in draw mode, a
  // typed mirror in type mode); in NARROW layout the .slots row is the display. The visible
  // "built spelling" container (for bursts / shake / lock styling) follows that.
  function builtEl() {
    return layoutWide ? boxesEl : slotsEl;
  }

  const guard = createIdleGuard({
    onNudge: () => {
      if (locked) return;
      audio.say(target);
      toast('✍️ Draw the next letter!');
      pulse(layoutWide ? boxesEl : canvas);
    },
    onResume: () => !locked && audio.say(target),
  });
  const onMedia = () => {
    const wide = !!mediaWide.matches;
    if (wide === layoutWide) return;
    layoutWide = wide; // rotating an iPad swaps single-canvas ↔ multi-box live
    applyLayout();
    rebuildSurface();
    renderBuilt();
  };
  mediaWide.addEventListener?.('change', onMedia);
  ctx.onLeave(() => {
    guard.stop();
    clearTimeout(recognizeTimer);
    clearBoxTimers();
    mediaWide.removeEventListener?.('change', onMedia);
  });

  // --- single-canvas drawing (PHONE) --------------------------------------
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

  // PHONE recognition: offer up to 4 high-confidence letterforms to tap.
  async function readLetter() {
    if (locked || inputMode !== 'draw' || layoutWide) return;
    const flat = strokes.reduce((n, s) => n + s.length, 0);
    if (flat < 2) return; // nothing meaningful drawn (auto-triggered — stay quiet)
    const cands = await recognizeStrokes(strokes, 4);
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

  // --- §31.A multi-box drawing (WIDE) -------------------------------------
  function clearBoxTimers() {
    for (const st of boxStates) clearTimeout(st.timer);
  }
  function boxPaint(st) {
    st.ctx.lineWidth = 8;
    st.ctx.lineCap = 'round';
    st.ctx.lineJoin = 'round';
    st.ctx.strokeStyle = '#36F1CD';
  }
  function makeBox(i) {
    const cv = el('canvas', { class: 'lbox-canvas', width: 132, height: 168 });
    const letterSpan = el('span', { class: 'lbox-letter' });
    const box = el('div', { class: 'lbox' }, cv, letterSpan);
    const st = { box, cv, ctx: cv.getContext('2d'), strokes: [], timer: 0, drawing: false, letterSpan };
    const xy = (e) => {
      const r = cv.getBoundingClientRect();
      return { x: (e.clientX - r.left) * (cv.width / r.width), y: (e.clientY - r.top) * (cv.height / r.height) };
    };
    cv.addEventListener('pointerdown', (e) => {
      if (locked) return;
      if (slots[i] != null) {
        clearBox(i); // tap a FILLED box → redo it (then this same tap starts a fresh stroke below)
      }
      clearTimeout(st.timer);
      st.drawing = true;
      cv.setPointerCapture?.(e.pointerId);
      const p = xy(e);
      st.strokes.push([p]);
      boxPaint(st);
      st.ctx.beginPath();
      st.ctx.moveTo(p.x, p.y);
      e.preventDefault();
    });
    cv.addEventListener('pointermove', (e) => {
      if (!st.drawing || locked) return;
      const p = xy(e);
      st.strokes[st.strokes.length - 1].push(p);
      st.ctx.lineTo(p.x, p.y);
      st.ctx.stroke();
      e.preventDefault();
    });
    const end = () => {
      if (!st.drawing) return;
      st.drawing = false;
      clearTimeout(st.timer);
      st.timer = setTimeout(() => readBox(i), RECOGNIZE_DEBOUNCE_MS);
    };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    cv.addEventListener('pointerleave', end);
    return st;
  }
  function buildBoxes() {
    clearBoxTimers();
    boxStates = slots.map((_, i) => makeBox(i));
    boxesEl.replaceChildren(...boxStates.map((b) => b.box));
    syncBoxes();
  }
  function clearBox(i) {
    const st = boxStates[i];
    if (!st) return;
    clearTimeout(st.timer);
    st.strokes = [];
    st.ctx.clearRect(0, 0, st.cv.width, st.cv.height);
    slots[i] = null;
    st.box.classList.remove('filled', 'locked');
    st.letterSpan.textContent = '';
    updateBoxActive();
  }
  // WIDE recognition: AUTO-FILL the single best guess (the chosen per-box UX); tap to redo.
  async function readBox(i) {
    if (locked || inputMode !== 'draw' || !layoutWide) return;
    const st = boxStates[i];
    if (!st) return;
    const flat = st.strokes.reduce((n, s) => n + s.length, 0);
    if (flat < 2) return;
    const cands = await recognizeStrokes(st.strokes, 1);
    if (!cands.length) {
      toast('🤔 Try that letter again');
      clearBox(i);
      pulse(st.cv);
      return;
    }
    fillBox(i, cands[0].letter);
  }
  function fillBox(i, letter) {
    const st = boxStates[i];
    if (!st) return;
    slots[i] = letter.toLowerCase();
    st.strokes = [];
    st.ctx.clearRect(0, 0, st.cv.width, st.cv.height);
    st.box.classList.add('filled');
    st.letterSpan.textContent = slots[i];
    audio.sfx('tap');
    updateBoxActive();
    if (slots.every((s) => s != null)) checkWord();
  }
  function syncBoxes() {
    boxStates.forEach((st, i) => {
      st.ctx.clearRect(0, 0, st.cv.width, st.cv.height);
      if (slots[i] != null) {
        st.box.classList.add('filled');
        st.letterSpan.textContent = slots[i];
      } else {
        st.box.classList.remove('filled', 'locked');
        st.letterSpan.textContent = '';
      }
    });
    updateBoxActive();
  }
  // Mark the first empty box as `current` — a gentle "write here next" hint (free order, though).
  function updateBoxActive() {
    const next = slots.findIndex((s) => s == null);
    boxStates.forEach((st, i) => st.box.classList.toggle('current', i === next));
  }

  // --- keyboard fallback ---------------------------------------------------
  // Toggle between handwriting (draw) and typing (on-screen / physical keyboard). Switching
  // resets the current word's letters so there's no draw↔type alignment confusion.
  function setMode(m) {
    inputMode = m;
    slots = slots.map(() => null);
    cur = 0;
    typeInput.value = '';
    applyLayout();
    rebuildSurface();
    renderBuilt();
    if (m === 'type') setTimeout(() => typeInput.focus(), 30); // raise the on-screen keyboard
  }
  // Build / reset whichever DRAW surface is now live (boxes in wide, single canvas in narrow).
  // In WIDE layout the boxes exist for BOTH draw and type (the word display), so build them
  // whenever wide; in NARROW only the single canvas needs resetting.
  function rebuildSurface() {
    if (layoutWide) buildBoxes();
    else {
      clearBoxTimers();
      clearCanvas();
    }
  }
  // Show/hide the input surfaces + adjust labels & hint text for the current layout/mode.
  //   WIDE  → boxes are the word display (interactive in draw, a typed mirror in type).
  //   NARROW→ the .slots row is the display + (single canvas | keyboard).
  function applyLayout() {
    boxesEl.style.display = layoutWide ? '' : 'none';
    boxesEl.classList.toggle('display-only', inputMode === 'type'); // not drawable while typing
    slotsEl.style.display = layoutWide ? 'none' : '';
    drawStageEl.style.display = !layoutWide && inputMode === 'draw' ? '' : 'none';
    typeWrapEl.style.display = inputMode === 'type' ? '' : 'none';
    clearBtn.style.display = inputMode === 'type' ? 'none' : '';
    toggleBtn.textContent = inputMode === 'draw' ? '⌨️ Type it' : '✍️ Draw it';
    hintEl.textContent =
      inputMode === 'type'
        ? 'Type the word you hear.'
        : layoutWide
          ? 'Write each letter in its box — tap a box to redo it.'
          : 'Draw a letter — I’ll guess it, then tap the one you meant.';
  }

  // Sync the slots from the typed text; auto-check once the whole word is typed.
  function onTypeInput() {
    if (locked) return;
    const v = (typeInput.value || '').toLowerCase().replace(/[^a-z]/g, '').slice(0, target.length);
    typeInput.value = v;
    for (let i = 0; i < slots.length; i++) slots[i] = v[i] || null;
    cur = Math.min(v.length, slots.length - 1);
    renderBuilt();
    if (v.length === target.length) checkWord();
  }

  // --- placing / redoing (single-canvas + type) ---------------------------
  function placeLetter(letter) {
    if (locked || cur < 0 || cur >= slots.length) return;
    slots[cur] = letter.toLowerCase();
    audio.sfx('tap');
    clearCanvas();
    cur = slots.findIndex((s) => s == null);
    renderBuilt();
    if (cur === -1) checkWord();
  }
  function redoSlot(i) {
    if (locked) return;
    if (inputMode === 'type') return typeInput.focus(); // the input is the editor in type mode
    if (!slots[i]) return;
    slots[i] = null;
    cur = i;
    clearCanvas();
    renderBuilt();
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
  // Render the built spelling into whichever surface is live.
  function renderBuilt() {
    if (layoutWide) syncBoxes();
    else renderSlots();
  }
  // Clear button (draw mode only): clears all boxes (wide) or the single canvas (phone).
  function clearCurrent() {
    if (layoutWide) boxStates.forEach((_, i) => clearBox(i));
    else clearCanvas();
  }
  function shakeBuilt() {
    const node = builtEl();
    node.classList.remove('shake');
    void node.offsetWidth;
    node.classList.add('shake');
  }

  // --- §31.B dictation -----------------------------------------------------
  function applyDictation() {
    dictBtn.textContent = dictation ? '📖 Show sentence' : '📣 Dictation';
    dictBtn.classList.toggle('on', dictation);
    peekRow.style.display = dictation ? '' : 'none';
    peekBtn.textContent = peeked ? '🙈 Hide' : '👀 Peek';
    sentenceEl.style.display = !dictation || peeked ? '' : 'none';
  }
  function setDictation(on) {
    dictation = on;
    peeked = false;
    applyDictation();
    if (!locked) audio.say(target); // hearing is now the only cue — say it
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
      flashVerdict('⭐ Mastered!', `+${MASTERY_GEMS} 💎 · ${inputMode === 'draw' ? 'Drawn from memory' : 'Spelled it!'}`, '#FFD23F');
      const node = builtEl();
      const r = node.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + r.height / 2, '#FFD23F', 22);
      bumpGems();
      node.querySelectorAll('.slot, .lbox').forEach((s) => s.classList.add('locked'));
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
      audio.speakPraise(inputMode === 'draw' ? 'Almost — try those letters again!' : 'Almost — try typing it again!');
      flashVerdict('Almost!', inputMode === 'draw' ? 'Fix the glowing letters' : 'Try again', '#8593A3');
      if (inputMode === 'type') {
        slots = slots.map(() => null); // a linear input can't show gaps — clear + retype
        typeInput.value = '';
        cur = 0;
      } else {
        for (let i = 0; i < slots.length; i++) if (slots[i] !== target[i]) slots[i] = null; // keep correct
        cur = slots.findIndex((s) => s == null);
      }
      shakeBuilt();
      renderBuilt();
      if (inputMode === 'type') setTimeout(() => typeInput.focus(), 30);
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
    peeked = false;
    const entry = session[index];
    target = entry.word.toLowerCase();
    slots = Array.from({ length: target.length }, () => null);
    cur = 0;
    typeInput.maxLength = target.length;
    typeInput.value = '';
    if (inputMode === 'type') setTimeout(() => typeInput.focus(), 30); // keep the keyboard up word-to-word
    verdictEl.textContent = '';
    verdictChip.textContent = '';
    sentenceEl.replaceChildren(...blankedSentence(entry));
    applyLayout();
    rebuildSurface();
    renderBuilt();
    applyDictation();
    renderDots();
    try {
      window.__masteryCurrent = { word: target, index, total: session.length, wide: layoutWide, dictation };
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
