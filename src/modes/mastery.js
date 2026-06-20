// src/modes/mastery.js — §30 MASTERY mode: DRAW the letters (the new headline), with the
// §31 upgrades (whole-word writing on wide screens + a dictation toggle) and the 2026-06-19g
// real-device fixes (tap-to-redo, a Check/submit button, speech that doesn't talk over praise,
// and cross-box stroke capture that assigns each letter to the box it's MOSTLY written in).
//
// The mastery TEST: the learner hears a word and spells it with NO letter tiles to choose
// from — they DRAW each letter. A FREE + OFFLINE on-device recognizer (the EMNIST CNN in
// cnn_recognizer.js, with engine/handwriting.js grid matching as the fallback) reads each
// drawn letter. One clean success = MASTERED (categories.recordDraw); a wrong finish is a
// gentle miss. Gated behind unlocks().mastery (after [set size] words reach KNOWN via craft).
//
// §31.A — WHOLE-WORD WRITING on WIDE screens (≥700px): the word is a ROW of per-letter boxes.
//   A SINGLE ink overlay spans the whole row, so a kid can write "mostly in the box, a bit
//   outside" and every stroke is still captured; each finished stroke is assigned to the box
//   whose centre it's NEAREST (so a letter is graded by where MOST of it was written). Each box
//   auto-recognises its strokes and shows its best guess, but NOTHING is graded until the learner
//   taps ✓ Check — so a misread letter can be fixed first (tap a box to redo it). PHONE (<700px)
//   keeps the single-canvas, one-letter-at-a-time + tap-a-candidate flow.
// §31.B/§32 — DICTATION = SPELL OUT LOUD: the child says the letters and the app listens (Web
//   Speech), filling them in. The sentence is hidden (dictation) with a 👀 Peek. Gated behind a
//   one-time GROWN-UP consent (mic → cloud transcription; COPPA — see speech.js / PRIVACY.md).
//
// UI module — verified with Playwright.
import { el, header, burst, toast, createIdleGuard, pulse, parentalGate, fitPlayArea } from '../ui.js';
import { buildMasteryPool } from '../engine/selection.js';
import { recordDraw, unlocks } from '../engine/categories.js';
import { recognizeGrid, pointsToGrid, GRID_N } from '../engine/handwriting.js';
import { ensureRecognizer, recognizeDrawing } from '../cnn_recognizer.js';
import { speechSupported, createLetterRecognizer } from '../speech.js';
import { voiceConsent, setVoiceConsent } from '../state.js';
import { byRank } from '../engine/lexicon.js';
import { mulberry32 } from '../engine/distractors.js';
import { PRAISE } from '../engine/ui_phrases.js';

const MASTERY_GEMS = 25; // flat reward for mastering a word (drawing is slow; speed is irrelevant)
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';
// §32 SHELVED (Ian 2026-06-19g): the "spell out loud" voice mode is parked. The cloud Web Speech
// API transcribes connected speech into WORDS (and the open mic echoed the app's own dictation),
// so it couldn't reliably read isolated letters from a child. The right rebuild (recorded in
// HANDOFF §32) is PUSH-TO-TALK + an ON-DEVICE spoken-letter model (TF.js, ISOLET-style, like the
// handwriting CNN) + using the known target word as a prior. Flip this flag to re-enable the
// (parked) Web Speech path for experimentation; the recogniser + consent + UI are all still here.
const VOICE_SPELLING_ENABLED = false;
// §31.A: at/above this width the multi-box "write the whole word" layout fits; below it we keep
// the single-canvas flow (a phone has no room for a row of per-letter boxes — and this keeps the
// §29 narrow-viewport no-horizontal-scroll guards green, which only exercise phone widths).
const WIDE_QUERY = '(min-width: 700px)';
// Wait this long after the LAST pen-up before guessing, so a multi-stroke letter (t, i, x, k)
// isn't recognised after only its first stroke. A new stroke cancels + reschedules.
const RECOGNIZE_DEBOUNCE_MS = 850;
// A pen-down→up that barely moved is a TAP (used to redo a filled box), not a letter stroke.
const TAP_PX = 12;

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function strokeSpan(stroke) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of stroke) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return Math.hypot(maxX - minX, maxY - minY);
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
  // WIDE (§31.A): a row of per-letter box GUIDES + ONE ink overlay spanning them all (built per word).
  const boxGuidesEl = el('div', { class: 'box-guides' });
  const boxInk = el('canvas', { class: 'boxes-ink' });
  const boxesEl = el('div', { class: 'draw-boxes' }, boxGuidesEl, boxInk);
  // KEYBOARD fallback (user request): type the word — but with an APP-DRAWN A–Z keypad, NOT a native
  // <input>. A real text field raises the OS keyboard, whose word-SUGGESTION strip (iOS QuickType /
  // Android Gboard) GIVES AWAY THE SPELLING and can't be reliably disabled from the web. Our own
  // keypad has no OS keyboard → no suggestions, on any device, offline (Ian 2026-06-20, §11). It
  // drives `slots` directly (typeLetter/backspace); the .slots row (narrow) or boxes (wide) display it.
  const keyboardEl = el('div', { class: 'type-keyboard', style: { display: 'none' } });
  const hearBtn = el(
    'button',
    { class: 'hear-again', onClick: () => audio.say(session[index]?.word) },
    el('span', { class: 'spk' }, '🔊'),
    'Hear it again',
  );
  // §31.B dictation: a Peek button reveals the (otherwise hidden) example sentence.
  const peekBtn = el('button', { class: 'btn ghost peek-btn', onClick: () => { peeked = !peeked; applyLayout(); } }, '👀 Peek');
  const peekRow = el('div', { class: 'peek-row', style: { display: 'none' } }, peekBtn);

  // §31 (2026-06-19g): an explicit Check/submit so a misread letter can be FIXED before grading
  // (only the wide multi-box layout auto-fills guesses; the phone flow confirms each letter on tap).
  const checkBtn = el('button', { class: 'btn primary check-btn', onClick: () => checkWord() }, '✓ Check it');
  const submitRow = el('div', { class: 'draw-submit', style: { display: 'none' } }, checkBtn);

  // §32: a "listening" indicator + a live "heard:" readout while the child spells out loud.
  const micEl = el('div', { class: 'mic-indicator', style: { display: 'none' } }, '🎤 Listening… say the letters!');
  const voiceDbgEl = el('div', { class: 'voice-heard', style: { display: 'none' } }, '');

  const clearBtn = el('button', { class: 'btn ghost', onClick: clearCurrent }, '↺ Clear');
  const dictBtn = el('button', { class: 'btn ghost', onClick: () => toggleVoice() }, '🎤 Spell out loud');
  const toggleBtn = el('button', { class: 'btn ghost', onClick: () => setMode(inputMode === 'draw' ? 'type' : 'draw') }, '⌨️ Type it');
  // §32 shelved: omit the voice button (the rest of the voice code is parked behind VOICE_SPELLING_ENABLED).
  const controlsEl = el('div', { class: 'draw-controls' }, clearBtn, ...(VOICE_SPELLING_ENABLED ? [dictBtn] : []), toggleBtn);
  const hintEl = el('div', { class: 'draw-hint' }, '');

  const hdr = header(ctx, { title: 'Mastery', onBack: () => ctx.nav('home') });
  const gemCountEl = hdr.querySelector('.gem-count');

  const playBody = el(
    'div',
    { class: 'play-body' },
    el('div', { class: 'prompt' }, el('div', { class: 'hear-row' }, hearBtn), sentenceEl, peekRow, verdictEl, verdictChip),
    el('div', { class: 'answer-zone' }, slotsEl, drawStageEl, boxesEl, keyboardEl, micEl, voiceDbgEl, hintEl, submitRow, controlsEl),
  );
  const screen = el('div', { class: 'screen mastery' }, hdr, dots, playBody);
  // §33: keep the word slots + draw surface + Clear/Type buttons (and the candidate letters once
  // drawn) co-visible for ANY word length on a phone — shrink the tiles/canvas to fit (no-op on iPad).
  const fit = () => requestAnimationFrame(() => fitPlayArea(playBody));

  // --- per-session / per-word state ---------------------------------------
  let index = 0;
  let earned = 0;
  let target = '';
  let slots = []; // built spelling (letters or null)
  let cur = 0; // active slot (single-canvas + type flows; where the next drawn/typed letter lands)
  let locked = false; // true during the success/advance animation
  let strokes = []; // single-canvas: the current letter's pen strokes
  let drawing = false;
  let inputMode = 'draw'; // 'draw' (handwriting) | 'type' (keyboard) | 'voice' (§32 spell aloud)
  let peeked = false; // §31.B/§32 dictation: the sentence is hidden unless the kid peeks
  let voiceRec = null; // §32: the active Web Speech recogniser (or null)
  let recognizeTimer = 0; // single-canvas debounce: auto-recognise shortly after the pen lifts
  // §31.A multi-box (ONE ink overlay over a row of box guides):
  let boxGuides = []; // [{ guide, letterSpan }] per letter box
  let boxStrokes = []; // [[stroke,…]] the captured strokes assigned to each box
  let boxTimers = []; // per-box recognise debounce timers
  const inkCtx = boxInk.getContext('2d');
  let inkDrawing = false;
  let inkStroke = []; // the in-progress overlay stroke (CSS-px points)
  const ctx2d = canvas.getContext('2d');
  // §31.A responsive layout: re-evaluated live so rotating an iPad swaps layouts.
  const mediaWide = window.matchMedia ? window.matchMedia(WIDE_QUERY) : { matches: false, addEventListener() {}, removeEventListener() {} };
  let layoutWide = !!mediaWide.matches;

  // In WIDE layout the per-letter BOXES are the word display; in NARROW the .slots row is.
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
  const onResize = () => { sizeInk(); fit(); };
  // A PHYSICAL keyboard (iPad + case) still types in type mode — hardware keys have no suggestion
  // strip, so there's no spelling give-away. Ignored unless we're in type mode.
  const onPhysicalKey = (e) => {
    if (inputMode !== 'type' || locked) return;
    if (e.key === 'Enter') { checkWord(); return; }
    if (e.key === 'Backspace') { backspace(); e.preventDefault(); return; }
    if (/^[a-zA-Z]$/.test(e.key)) typeLetter(e.key.toLowerCase());
  };
  mediaWide.addEventListener?.('change', onMedia);
  window.addEventListener('resize', onResize);
  window.addEventListener('keydown', onPhysicalKey);
  ctx.onLeave(() => {
    guard.stop();
    clearTimeout(recognizeTimer);
    clearBoxTimers();
    stopVoice();
    mediaWide.removeEventListener?.('change', onMedia);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('keydown', onPhysicalKey);
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
    fit(); // candidates removed → the canvas can grow back to fit
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
    fit(); // the candidate row adds height → keep it (and the controls) on-screen
  }

  // --- §31.A multi-box drawing (WIDE): one ink overlay, strokes routed to the nearest box ----
  function clearBoxTimers() {
    for (const t of boxTimers) clearTimeout(t);
    boxTimers = boxTimers.map(() => 0);
  }
  function inkPaint() {
    inkCtx.lineWidth = 8;
    inkCtx.lineCap = 'round';
    inkCtx.lineJoin = 'round';
    inkCtx.strokeStyle = '#36F1CD';
  }
  // The overlay is drawn 1:1 in CSS px (square pixels) so letters keep their aspect and stored
  // strokes survive a resize. Resize the backing store to match the element when it changes.
  function sizeInk() {
    if (!layoutWide) return;
    const r = boxInk.getBoundingClientRect();
    const w = Math.round(r.width);
    const h = Math.round(r.height);
    if (w > 0 && (boxInk.width !== w || boxInk.height !== h)) {
      boxInk.width = w;
      boxInk.height = h;
      repaintInk();
    }
  }
  function inkXY(e) {
    const r = boxInk.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  // Assign a finished stroke to the box whose CENTRE its centroid is nearest — so a letter is
  // graded by where MOST of it was written, even if it spilled past the box edges (Ian 2026-06-19g).
  function boxForStroke(stroke) {
    const cx = stroke.reduce((a, p) => a + p.x, 0) / stroke.length;
    const cRect = boxInk.getBoundingClientRect();
    let best = 0;
    let bestD = Infinity;
    boxGuides.forEach((g, i) => {
      const r = g.guide.getBoundingClientRect();
      const gcx = (r.left + r.right) / 2 - cRect.left;
      const d = Math.abs(cx - gcx);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }
  function repaintInk() {
    inkCtx.clearRect(0, 0, boxInk.width, boxInk.height);
    inkPaint();
    const drawStroke = (s) => {
      if (!s.length) return;
      inkCtx.beginPath();
      inkCtx.moveTo(s[0].x, s[0].y);
      for (let i = 1; i < s.length; i++) inkCtx.lineTo(s[i].x, s[i].y);
      if (s.length === 1) inkCtx.lineTo(s[0].x + 0.1, s[0].y + 0.1);
      inkCtx.stroke();
    };
    boxStrokes.forEach((group, i) => {
      if (slots[i] == null) group.forEach(drawStroke); // a filled box shows its letter, not ink
    });
    if (inkDrawing) drawStroke(inkStroke);
  }
  boxInk.addEventListener('pointerdown', (e) => {
    if (locked || inputMode !== 'draw') return;
    sizeInk();
    inkDrawing = true;
    inkStroke = [inkXY(e)];
    boxInk.setPointerCapture?.(e.pointerId);
    inkPaint();
    inkCtx.beginPath();
    inkCtx.moveTo(inkStroke[0].x, inkStroke[0].y);
    e.preventDefault();
  });
  boxInk.addEventListener('pointermove', (e) => {
    if (!inkDrawing || locked) return;
    const p = inkXY(e);
    inkStroke.push(p);
    inkCtx.lineTo(p.x, p.y);
    inkCtx.stroke();
    e.preventDefault();
  });
  const endInk = () => {
    if (!inkDrawing) return;
    inkDrawing = false;
    const s = inkStroke;
    inkStroke = [];
    if (s.length) finalizeStroke(s);
  };
  boxInk.addEventListener('pointerup', endInk);
  boxInk.addEventListener('pointercancel', endInk);
  boxInk.addEventListener('pointerleave', endInk);

  function finalizeStroke(stroke) {
    const j = boxForStroke(stroke);
    const tap = strokeSpan(stroke) < TAP_PX;
    if (slots[j] != null) {
      // the box already shows a letter: a TAP redoes it; a real stroke replaces it.
      clearBox(j);
      if (tap) {
        repaintInk();
        return;
      }
    }
    boxStrokes[j].push(stroke);
    clearTimeout(boxTimers[j]);
    boxTimers[j] = setTimeout(() => recognizeBox(j), RECOGNIZE_DEBOUNCE_MS);
    repaintInk();
  }
  async function recognizeBox(j) {
    if (locked || inputMode !== 'draw' || !layoutWide) return;
    const flat = boxStrokes[j].reduce((n, s) => n + s.length, 0);
    if (flat < 2) return;
    const cands = await recognizeStrokes(boxStrokes[j], 1);
    if (!cands.length) {
      toast('🤔 Try that letter again');
      clearBox(j);
      pulse(boxInk);
      return;
    }
    fillBox(j, cands[0].letter);
  }
  function buildBoxes() {
    clearBoxTimers();
    boxStrokes = slots.map(() => []);
    boxTimers = slots.map(() => 0);
    boxGuides = slots.map((_, i) => {
      const letterSpan = el('span', { class: 'lbox-letter' });
      // In draw mode the ink overlay (on top) owns taps; in type/voice it's pass-through, so a
      // tap on a box re-opens it: focus the keyboard (type) or clear a mis-heard letter (voice).
      const guide = el('div', { class: 'lbox', onClick: () => onGuideTap(i) }, letterSpan);
      return { guide, letterSpan };
    });
    boxGuidesEl.replaceChildren(...boxGuides.map((g) => g.guide));
    boxInk.width = 0; // force a re-size to the new row on the next paint/pointer
    syncBoxes();
    requestAnimationFrame(sizeInk); // size once the row has laid out
  }
  function clearBox(i) {
    if (!boxGuides[i]) return;
    clearTimeout(boxTimers[i]);
    boxStrokes[i] = [];
    slots[i] = null;
    boxGuides[i].guide.classList.remove('filled', 'locked');
    boxGuides[i].letterSpan.textContent = '';
    repaintInk();
    updateBoxActive();
    updateCheck();
  }
  // AUTO-FILL the best guess for display only — grading waits for the Check button (Ian 2026-06-19g).
  function fillBox(i, letter) {
    if (!boxGuides[i]) return;
    slots[i] = letter.toLowerCase();
    boxGuides[i].guide.classList.add('filled');
    boxGuides[i].letterSpan.textContent = slots[i];
    audio.sfx('tap');
    repaintInk(); // the box's ink gives way to the recognised letter
    updateBoxActive();
    updateCheck();
  }
  function syncBoxes() {
    boxGuides.forEach((g, i) => {
      if (slots[i] != null) {
        g.guide.classList.add('filled');
        g.letterSpan.textContent = slots[i];
      } else {
        g.guide.classList.remove('filled', 'locked');
        g.letterSpan.textContent = '';
      }
    });
    repaintInk();
    updateBoxActive();
    updateCheck();
  }
  // Mark the first empty box as `current` — a gentle "write here next" hint (free order, though).
  function updateBoxActive() {
    const next = slots.findIndex((s) => s == null);
    boxGuides.forEach((g, i) => g.guide.classList.toggle('current', i === next));
  }
  // A tap on a box when the overlay isn't capturing (type/voice modes): focus the keyboard, or
  // clear a mis-heard voice letter so the child can re-say it. (In draw mode the overlay is on top.)
  function onGuideTap(i) {
    if (locked || inputMode === 'draw') return;
    if (inputMode === 'type') { if (slots[i] != null) clearBox(i); return; } // tap a box to fix that letter
    if (inputMode === 'voice' && slots[i] != null) clearBox(i);
  }

  // --- submit / check ------------------------------------------------------
  // Enable the Check button only once every box is filled (it's shown in the wide layout, where
  // boxes auto-fill guesses; the phone flow confirms each letter on tap, so it auto-checks).
  function updateCheck() {
    const all = slots.length > 0 && slots.every((s) => s != null);
    checkBtn.disabled = !all;
    checkBtn.classList.toggle('ready', all);
  }

  // --- keyboard fallback ---------------------------------------------------
  // Toggle between handwriting (draw) and typing (on-screen / physical keyboard). Switching
  // resets the current word's letters so there's no draw↔type alignment confusion. (Hidden
  // during voice mode; switching modes always lands back on draw vs type, never voice.)
  function setMode(m) {
    inputMode = m;
    slots = slots.map(() => null);
    cur = 0;
    applyLayout();
    rebuildSurface();
    renderBuilt();
  }
  // Build / reset whichever DRAW surface is now live (boxes in wide, single canvas in narrow).
  function rebuildSurface() {
    if (layoutWide) buildBoxes();
    else {
      clearBoxTimers();
      clearCanvas();
    }
  }
  // Show/hide the input surfaces + adjust labels & hint text for the current layout/mode.
  //   WIDE  → boxes are the word display (interactive in draw, a typed/voice mirror otherwise) + Check.
  //   NARROW→ the .slots row is the display + (single canvas | keyboard | voice), auto-checks (draw/type).
  //   VOICE (§32) → boxes/slots are a display only; a mic indicator + ✓ Check; sentence hidden (peek).
  function applyLayout() {
    const voice = inputMode === 'voice';
    boxesEl.style.display = layoutWide ? '' : 'none';
    boxesEl.classList.toggle('display-only', inputMode !== 'draw'); // overlay drawable only in draw mode
    slotsEl.style.display = layoutWide ? 'none' : '';
    drawStageEl.style.display = !layoutWide && inputMode === 'draw' ? '' : 'none';
    keyboardEl.style.display = inputMode === 'type' ? '' : 'none';
    micEl.style.display = voice ? '' : 'none';
    voiceDbgEl.style.display = voice ? '' : 'none';
    // explicit submit in the wide multi-box layout OR whenever spelling by voice (mis-hears → review first)
    submitRow.style.display = layoutWide || voice ? '' : 'none';
    clearBtn.style.display = inputMode === 'type' ? 'none' : '';
    toggleBtn.style.display = voice ? 'none' : ''; // the draw/type toggle is irrelevant during voice
    toggleBtn.textContent = inputMode === 'draw' ? '⌨️ Type it' : '✍️ Draw it';
    dictBtn.textContent = voice ? '✍️ Back to writing' : '🎤 Spell out loud';
    dictBtn.classList.toggle('on', voice);
    // §32: voice mode shows the blanked sentence like the other modes (the confusing 👀 Peek/Hide
    // toggle from the earlier draft is gone — the sentence context is just always visible).
    peekRow.style.display = 'none';
    sentenceEl.style.display = '';
    hintEl.textContent = voice
      ? '🎤 Say the letters out loud, then tap ✓ Check.'
      : inputMode === 'type'
        ? layoutWide
          ? 'Type the word, then tap ✓ Check.'
          : 'Type the word you hear.'
        : layoutWide
          ? 'Write each letter in its box, then tap ✓ Check. Tap a box to redo it.'
          : 'Draw a letter — I’ll guess it, then tap the one you meant.';
    updateCheck();
    fit(); // §33: re-fit whenever the layout/mode (and thus which surfaces show) changes
    try {
      if (window.__masteryCurrent) window.__masteryCurrent.mode = inputMode; // keep the QA hook fresh on mode change
    } catch {
      /* ignore */
    }
  }

  // The app-drawn A–Z keypad (no OS keyboard → no suggestion strip). A letter fills the next empty
  // slot; ⌫ removes the last filled one; tapping a placed letter clears just that one (the keypad
  // refills the gap). Narrow auto-checks when full; wide waits for the ✓ Check button — consistent
  // with the draw flows. Built once (the keys never change).
  function buildKeyboard() {
    const rows = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'].map((row, ri) => {
      const keys = [...row].map((ch) =>
        el('button', { class: 'key', type: 'button', onClick: () => typeLetter(ch) }, ch),
      );
      if (ri === 2) keys.push(el('button', { class: 'key key-back', type: 'button', 'aria-label': 'Delete', onClick: backspace }, '⌫'));
      return el('div', { class: 'key-row' }, ...keys);
    });
    keyboardEl.replaceChildren(...rows);
  }
  function typeLetter(letter) {
    if (locked || inputMode !== 'type') return;
    const next = slots.findIndex((s) => s == null);
    if (next === -1) return; // already full
    slots[next] = letter.toLowerCase();
    cur = slots.findIndex((s) => s == null);
    audio.sfx('tap');
    renderBuilt();
    if (!layoutWide && slots.every((s) => s != null)) checkWord();
  }
  function backspace() {
    if (locked || inputMode !== 'type') return;
    let last = -1;
    for (let i = slots.length - 1; i >= 0; i--) if (slots[i] != null) { last = i; break; }
    if (last === -1) return;
    slots[last] = null;
    cur = last;
    audio.sfx('tap');
    renderBuilt();
  }

  // --- placing / redoing (single-canvas + type) ---------------------------
  function placeLetter(letter) {
    if (locked || cur < 0 || cur >= slots.length) return;
    slots[cur] = letter.toLowerCase();
    audio.sfx('tap');
    clearCanvas();
    cur = slots.findIndex((s) => s == null);
    renderBuilt();
    if (cur === -1) checkWord(); // phone: each letter was confirmed on tap, so auto-check is fine
  }
  function redoSlot(i) {
    if (locked) return;
    if (inputMode === 'type') { // tap a letter to fix it — clear it; the keypad refills the gap
      if (slots[i] == null) return;
      slots[i] = null;
      cur = i;
      renderBuilt();
      return;
    }
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
    updateCheck();
  }
  // Clear button (draw mode only): clears all boxes (wide) or the single canvas (phone).
  function clearCurrent() {
    if (layoutWide) boxGuides.forEach((_, i) => clearBox(i));
    else clearCanvas();
  }
  function shakeBuilt() {
    const node = builtEl();
    node.classList.remove('shake');
    void node.offsetWidth;
    node.classList.add('shake');
  }

  // --- §32 dictation = SPELL OUT LOUD (voice input) -----------------------
  // The dictation button enters/leaves voice mode. Entering needs a one-time GROWN-UP consent
  // (mic → cloud transcription, COPPA) cleared via a parental gate; then we start listening.
  function toggleVoice() {
    if (inputMode === 'voice') return exitVoice();
    if (!voiceConsent()) return showVoiceConsent();
    enterVoice();
  }
  function showVoiceConsent() {
    parentalGate({
      title: '🎤 Spell out loud — grown-up OK',
      body: [
        'Your child can spell by SAYING the letters out loud instead of writing them.',
        'This turns on the microphone. Their voice is sent to your device’s speech service to turn the spoken letters into text — the app never saves the audio. See PRIVACY.md.',
      ],
      agree: 'I’m this child’s parent/guardian and I allow the microphone for voice spelling.',
      confirmLabel: '🎤 Allow microphone',
      onPass: () => {
        setVoiceConsent(true);
        enterVoice();
      },
    });
  }
  function enterVoice() {
    if (!speechSupported()) {
      toast('🎤 Voice spelling isn’t available on this device — try drawing or typing!');
      return;
    }
    inputMode = 'voice';
    peeked = false;
    slots = slots.map(() => null);
    cur = 0;
    applyLayout();
    rebuildSurface();
    renderBuilt();
    startVoice();
    if (!locked) audio.say(target); // dictation: hear the word, then spell it aloud
  }
  function exitVoice() {
    stopVoice();
    inputMode = 'draw';
    peeked = false;
    slots = slots.map(() => null);
    cur = 0;
    applyLayout();
    rebuildSurface();
    renderBuilt();
  }
  function startVoice() {
    stopVoice();
    voiceDbgEl.textContent = '';
    voiceRec = createLetterRecognizer({
      onLetters: (arr) => voiceLetters(arr),
      onTranscript: (text) => {
        // a live readout so it's clear the mic is working + what it heard (also helps tuning).
        voiceDbgEl.textContent = text ? `🗣️ heard: “${text}”` : '';
      },
      onState: (s) => setMic(s),
      onError: (err) => {
        if (err === 'not-allowed' || err === 'service-not-allowed') {
          toast('🎤 Microphone blocked — allow it in Settings, or draw/type instead.');
          exitVoice();
        } else if (err === 'no-speech' || err === 'aborted') {
          setMic('listening'); // normal silence/restart — keep going quietly
        } else {
          setMic('listening');
          voiceDbgEl.textContent = `⚠️ speech: ${err} (still trying — or tap Draw/Type)`;
        }
      },
    });
    if (!voiceRec) {
      toast('🎤 Voice spelling isn’t available here.');
      exitVoice();
      return;
    }
    voiceRec.start();
    setMic('listening');
  }
  function stopVoice() {
    if (voiceRec) {
      try {
        voiceRec.stop();
      } catch {
        /* ignore */
      }
      voiceRec = null;
    }
  }
  function setMic(stateStr) {
    const listening = stateStr === 'listening' || stateStr === 'hearing' || stateStr === 'speech';
    micEl.classList.toggle('listening', listening);
    micEl.textContent =
      stateStr === 'hearing' || stateStr === 'speech'
        ? '🎤 I can hear you — say the letters!'
        : listening
          ? '🎤 Listening… say the letters!'
          : '🎤 Paused — tap the button to resume';
  }
  // Fill the next empty slot(s) from the letters the recogniser heard (no auto-grade — the kid
  // taps ✓ Check, since voice can mis-hear). Tap a filled box/slot to clear+re-say a wrong letter.
  function voiceLetters(arr) {
    if (locked || inputMode !== 'voice') return;
    let changed = false;
    for (const L of arr) {
      const next = slots.findIndex((s) => s == null);
      if (next === -1) break;
      slots[next] = L;
      changed = true;
    }
    if (changed) {
      audio.sfx('tap');
      renderBuilt();
    }
  }

  // --- grading -------------------------------------------------------------
  function checkWord() {
    if (locked) return;
    if (slots.some((s) => s == null)) return; // not finished yet — nothing to grade
    const built = slots.join('');
    if (built === target) {
      locked = true;
      // §30: a draw success is the ONLY path to MASTERED.
      recordDraw(state.categories, target, true);
      earned += MASTERY_GEMS;
      ctx.store.addGems(MASTERY_GEMS);
      ctx.store.recordAnswerStat(true, 'mastery');
      audio.sfx('combo');
      flashVerdict('⭐ Mastered!', `+${MASTERY_GEMS} 💎 · ${inputMode === 'draw' ? 'Drawn from memory' : 'Spelled it!'}`, '#FFD23F');
      const node = builtEl();
      const r = node.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + r.height / 2, '#FFD23F', 22);
      bumpGems();
      node.querySelectorAll('.slot, .lbox').forEach((s) => s.classList.add('locked'));
      checkBtn.disabled = true;
      ctx.save();
      // Advance to the next word only AFTER the praise has finished speaking, so the next
      // dictation doesn't talk over "Mastered!" (Ian 2026-06-19g). A fallback timer covers the
      // no-audio / onDone-never-fires case.
      let advanced = false;
      const advance = () => {
        if (advanced) return;
        advanced = true;
        index += 1;
        present();
      };
      audio.speakPraise(PRAISE.mastered, { onDone: () => setTimeout(advance, 350) });
      setTimeout(advance, 2600);
    } else {
      // a wrong finish is a gentle MISS (recordDraw(false): a mastered word drops to known,
      // a merely-known word stays known). Keep the correct letters, clear the wrong ones to redo.
      recordDraw(state.categories, target, false);
      audio.sfx('miss');
      audio.speakPraise(inputMode === 'draw' ? PRAISE.redraw : PRAISE.retype);
      flashVerdict('Almost!', inputMode === 'draw' ? 'Fix the glowing letters' : 'Try again', '#8593A3');
      if (inputMode === 'type') {
        // the keypad fills the first empty slot, so we KEEP the right letters and clear only the
        // wrong ones (the old linear <input> couldn't show gaps); the kid retypes just those.
        for (let i = 0; i < slots.length; i++) if (slots[i] !== target[i]) slots[i] = null;
        cur = slots.findIndex((s) => s == null);
      } else if (layoutWide) {
        for (let i = 0; i < slots.length; i++) if (slots[i] !== target[i]) clearBox(i); // keep correct
      } else {
        for (let i = 0; i < slots.length; i++) if (slots[i] !== target[i]) slots[i] = null; // keep correct
        cur = slots.findIndex((s) => s == null);
      }
      shakeBuilt();
      renderBuilt();
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
    verdictEl.textContent = '';
    verdictChip.textContent = '';
    sentenceEl.replaceChildren(...blankedSentence(entry));
    applyLayout(); // also applies the dictation sentence-hide/peek for voice mode
    rebuildSurface();
    renderBuilt();
    renderDots();
    try {
      window.__masteryCurrent = { word: target, index, total: session.length, wide: layoutWide, mode: inputMode };
    } catch {
      /* ignore */
    }
    audio.say(target); // the recogniser ignores the whole word, so listening can keep running
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

  buildKeyboard(); // the A–Z keypad is static — build it once
  present();
  return screen;
}
