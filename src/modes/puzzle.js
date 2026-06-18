// src/modes/puzzle.js — BUILD-the-word mode (production / recall; HANDOFF §8, §12).
//
// The pedagogy counterweight to rhythm's multiple-choice RECOGNITION: here the
// learner HEARS the word and must PRODUCE its spelling by placing scrambled letter
// tiles into slots — tap-to-place OR drag (iPad-native, requirement #8). Slower and
// deliberate (§8). Feedback stays gentle: a wrong full build keeps the letters that
// already fit and returns the rest, and a 💡 hint is always one tap away. Mastery is
// recorded HONESTLY — only a clean first-try build counts as a correct PRODUCTION
// (recall ≠ recognition, the §12 pedagogy concern). A clean build earns full
// speed/combo gems; a build that needed help still earns a small "you crafted it"
// reward (positive reinforcement, never shaming). UI module — verified with Playwright.
import { el, header, burst, toast, createIdleGuard, pulse } from '../ui.js';
import { buildSession, buildReviewSession } from '../engine/session.js';
import { mulberry32 } from '../engine/distractors.js';
import { gradeAnswer, GENTLE_PHRASES } from '../engine/praise.js';
import { recordAnswer, lapsedWords } from '../engine/progress.js';
import { scrambleTray, gradeBuild } from '../engine/puzzle.js';

// Extra red-herring tray letters per difficulty preset (raises the recall load).
const EXTRA_BY_DIFF = { easy: 0, medium: 1, hard: 2 };
// Hold the read window after the word is spoken before the speed clock starts.
const GRACE_MS = 1200;
// Consolation gems for a build that eventually succeeded with help (still positive).
const CONSOLATION_GEMS = 5;

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function startPuzzle(ctx, params = {}) {
  const { state, audio } = ctx;
  const settings = state.settings;
  const seed = (Date.now() >>> 0) || 1;
  const rng = mulberry32(seed);

  // "Repair" = a Craft session built from the learner's CRACKED CRYSTALS (words they
  // missed), practised in PRODUCTION form — recall, not recognition (transfer
  // research). Otherwise a normal Craft session from the level builder.
  const review = !!params.review;

  // Puzzle is deliberate/slower than rhythm — keep waves short so it never drags.
  const length = Math.min(settings.length || 10, 6);
  const session = review
    ? buildReviewSession(state.tracker, { length, rng })
    : buildSession(state.tracker, { difficulty: settings.difficulty, length, rng });
  const extra =
    typeof settings.difficulty === 'string' ? EXTRA_BY_DIFF[settings.difficulty] ?? 1 : 1;

  // --- static structure -----------------------------------------------------
  const dots = el('div', { class: 'dots' });
  const comboFill = el('div', { class: 'combo-fill' });
  const comboLabel = el('div', { class: 'combo-label' });
  const verdictEl = el('div', { class: 'verdict' });
  const verdictChip = el('div', { class: 'verdict-chip' });
  const sentenceEl = el('div', { class: 'sentence' });
  const slotsEl = el('div', { class: 'slots' });
  const trayEl = el('div', { class: 'tray' });

  const hearBtn = el(
    'button',
    { class: 'hear-again', onClick: () => audio.say(session[index]?.word) },
    el('span', { class: 'spk' }, '🔊'),
    'Hear it again',
  );
  const hintBtn = el('button', { class: 'btn ghost', onClick: hint }, '💡 Hint');
  const clearBtn = el('button', { class: 'btn ghost', onClick: clearAll }, '↺ Clear');
  const controlsEl = el('div', { class: 'puzzle-controls' }, hintBtn, clearBtn);

  const hdr = header(ctx, { title: review ? 'Repair Crystals' : 'Crafting', onBack: () => ctx.nav('home') });
  const gemCountEl = hdr.querySelector('.gem-count');

  const screen = el(
    'div',
    { class: 'screen puzzle' },
    hdr,
    dots,
    el('div', { class: 'combo-wrap' }, comboFill),
    comboLabel,
    el(
      'div',
      { class: 'play-body' },
      el('div', { class: 'prompt' }, hearBtn, sentenceEl, verdictEl, verdictChip),
      el('div', { class: 'answer-zone' }, slotsEl, controlsEl, trayEl),
    ),
  );

  // --- per-session state ----------------------------------------------------
  let index = 0;
  let combo = 0;
  let earned = 0;

  // --- per-word state -------------------------------------------------------
  let target = '';
  let trayTiles = []; // [{ id, letter, used }]
  let slots = []; // [{ tileId, letter, locked } | null]
  let firstTry = true; // false after any wrong submit or hint (no clean-recall credit)
  let locked = false; // true once solved, while the verdict shows
  let startTime = 0; // 0 until the read window passes
  let graceTimer = 0;
  let suppressClick = false; // set right after a drag so the trailing click is ignored

  if (!session.length) {
    sentenceEl.textContent = review
      ? 'No cracked crystals — every gem is sparkling! ✨'
      : 'No words to craft right now — try a different difficulty in Settings.';
    slotsEl.style.display = 'none';
    trayEl.style.display = 'none';
    controlsEl.style.display = 'none';
    return screen;
  }

  // Keep the crafter on task: nudge + re-dictate if they stall, pause overlay if they
  // fully blank out. Resuming restarts the speed clock so the idle gap isn't penalised.
  const guard = createIdleGuard({
    onNudge: () => {
      if (locked) return;
      audio.say(target);
      toast('✨ Tap a letter to keep building!');
      trayEl.classList.add('nudge');
      setTimeout(() => trayEl.classList.remove('nudge'), 1300);
    },
    onResume: () => {
      if (locked) return;
      startTime = performance.now();
      audio.say(target);
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
    return [s];
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

  function pickGentle() {
    return GENTLE_PHRASES[Math.floor(rng() * GENTLE_PHRASES.length)];
  }

  // --- rendering the slots + tray ------------------------------------------
  function render() {
    slotsEl.replaceChildren(
      ...slots.map((s, i) =>
        el(
          'button',
          {
            class: 'slot' + (s ? ' filled' : '') + (s && s.locked ? ' locked' : ''),
            onClick: () => {
              if (!locked && s && !s.locked) returnSlot(i);
            },
          },
          s ? s.letter : '',
        ),
      ),
    );
    trayEl.replaceChildren(
      ...trayTiles.map((t) =>
        el(
          'button',
          {
            class: 'tray-tile' + (t.used ? ' used' : ''),
            dataset: { letter: t.letter },
            onClick: () => {
              if (suppressClick || locked || t.used) return;
              placeFromTray(t.id);
            },
            onPointerdown: (e) => dragStart(e, t),
          },
          t.letter,
        ),
      ),
    );
  }

  // --- placement operations -------------------------------------------------
  function placeFromTray(tileId, slotIndex) {
    if (locked) return;
    const tile = trayTiles.find((x) => x.id === tileId && !x.used);
    if (!tile) return;
    let i = slotIndex;
    // ignore an out-of-range or locked target slot -> fall back to first empty
    if (i == null || i < 0 || i >= slots.length || (slots[i] && slots[i].locked)) i = -1;
    if (i >= 0 && slots[i] && !slots[i].locked) {
      const ex = trayTiles.find((x) => x.id === slots[i].tileId);
      if (ex) ex.used = false;
      slots[i] = null;
    }
    if (i < 0) i = slots.findIndex((s) => s == null);
    if (i < 0) return; // no empty slot
    tile.used = true;
    slots[i] = { tileId: tile.id, letter: tile.letter, locked: false };
    audio.sfx('tap');
    render();
    checkComplete();
  }

  function returnSlot(i) {
    const s = slots[i];
    if (!s || s.locked) return;
    const tile = trayTiles.find((x) => x.id === s.tileId);
    if (tile) tile.used = false;
    slots[i] = null;
    render();
  }

  function clearAll() {
    if (locked) return;
    slots.forEach((s, i) => {
      if (s && !s.locked) {
        const tile = trayTiles.find((x) => x.id === s.tileId);
        if (tile) tile.used = false;
        slots[i] = null;
      }
    });
    render();
  }

  function hint() {
    if (locked) return;
    const g = gradeBuild(target, slots.map((s) => (s ? s.letter : null)));
    const i = g.perPosition.findIndex((p) => p !== true);
    if (i < 0) return;
    firstTry = false;
    if (slots[i] && !slots[i].locked) returnSlot(i);
    const need = target[i];
    const tile = trayTiles.find((x) => !x.used && x.letter === need);
    if (tile) {
      tile.used = true;
      slots[i] = { tileId: tile.id, letter: need, locked: true };
    }
    audio.sfx('gem');
    render();
    checkComplete();
  }

  // --- drag (pointer events) — reuses placeFromTray; tap is the robust fallback --
  function slotIndexAtPoint(x, y) {
    const nodes = slotsEl.querySelectorAll('.slot');
    for (let i = 0; i < nodes.length; i++) {
      const r = nodes[i].getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return i;
    }
    return undefined;
  }

  function dragStart(e, tile) {
    if (tile.used || locked) return;
    const startX = e.clientX;
    const startY = e.clientY;
    let ghost = null;
    let moved = false;
    const move = (ev) => {
      if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 8) return;
      moved = true;
      if (!ghost) {
        ghost = el('div', { class: 'tray-tile drag-ghost' }, tile.letter);
        document.body.appendChild(ghost);
      }
      ghost.style.left = `${ev.clientX}px`;
      ghost.style.top = `${ev.clientY}px`;
    };
    const end = (ev) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      if (ghost) ghost.remove();
      if (!moved) return; // a tap — let the click handler place it
      suppressClick = true; // swallow the click that follows this drag
      setTimeout(() => {
        suppressClick = false;
      }, 60);
      if (locked || tile.used) return;
      placeFromTray(tile.id, slotIndexAtPoint(ev.clientX, ev.clientY));
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  }

  // --- grading --------------------------------------------------------------
  function checkComplete() {
    const g = gradeBuild(target, slots.map((s) => (s ? s.letter : null)));
    if (!g.complete) return;
    if (g.correct) solve();
    else wrongSubmit(g);
  }

  function wrongSubmit(g) {
    firstTry = false;
    combo = 0;
    audio.sfx('miss');
    const phrase = pickGentle();
    audio.speakPraise(phrase);
    flashVerdict(phrase, 'Keep the letters that fit', '#6C7A89');
    updateCombo(null);
    // lock the letters that are right; return the rest to the tray to retry
    slots.forEach((s, i) => {
      if (!s) return;
      if (g.perPosition[i]) s.locked = true;
      else {
        const tile = trayTiles.find((x) => x.id === s.tileId);
        if (tile) tile.used = false;
        slots[i] = null;
      }
    });
    render();
    slotsEl.classList.remove('shake');
    void slotsEl.offsetWidth;
    slotsEl.classList.add('shake');
  }

  function solve() {
    locked = true;
    controlsEl.style.display = 'none'; // Hint/Clear are meaningless once solved (QA I8)
    const responseMs = startTime ? performance.now() - startTime : 0;
    // honest mastery signal: only a clean first try is a real RECALL success
    recordAnswer(state.tracker, target, firstTry, { responseMs });
    ctx.store.recordAnswerStat(firstTry);

    if (firstTry) {
      combo += 1;
      ctx.store.recordCombo(combo); // best combo today (daily quest)
      const verdict = gradeAnswer({ correct: true, responseMs, combo, rng });
      earned += verdict.points;
      ctx.store.addGems(verdict.points);
      audio.sfx(verdict.isCombo ? 'combo' : verdict.tier);
      if (verdict.isCombo || verdict.tier === 'perfect' || verdict.tier === 'amazing') {
        audio.speakPraise(verdict.phrase);
      }
      flashVerdict(verdict.phrase, `+${verdict.points} 💎 · ${verdict.label}`, verdict.color);
      updateCombo(verdict);
    } else {
      combo = 0;
      earned += CONSOLATION_GEMS;
      ctx.store.addGems(CONSOLATION_GEMS);
      audio.sfx('great');
      const phrase = 'You crafted it!';
      audio.speakPraise(phrase);
      flashVerdict(phrase, `+${CONSOLATION_GEMS} 💎 · Crafted`, '#9D8DF1');
      updateCombo(null);
    }

    // lock the finished word + celebrate from its centre
    slots.forEach((s) => {
      if (s) s.locked = true;
    });
    render();
    const r = slotsEl.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2, firstTry ? '#36F1CD' : '#9D8DF1', firstTry ? 18 : 12);
    bumpGems();
    ctx.save();

    setTimeout(() => {
      index += 1;
      present();
    }, 1100);
  }

  // --- per-word setup -------------------------------------------------------
  function present() {
    if (index >= session.length) return finish();
    locked = false;
    firstTry = true;
    startTime = 0;
    controlsEl.style.display = ''; // restore Hint/Clear for the new word (QA I8)
    clearTimeout(graceTimer);
    const entry = session[index];
    target = entry.word.toLowerCase();

    const letters = scrambleTray(target, { extra, rng });
    trayTiles = letters.map((c, i) => ({ id: i, letter: c, used: false }));
    slots = Array.from({ length: target.length }, () => null);

    renderDots();
    verdictEl.classList.remove('flash');
    verdictEl.textContent = '';
    verdictChip.textContent = '';
    sentenceEl.replaceChildren(...blankedSentence(entry));
    render();

    // off-DOM test hook (Playwright) — current target + position, like rhythm's
    try {
      window.__puzzleCurrent = { word: target, index, total: session.length };
    } catch {
      /* ignore */
    }

    audio.say(target, {
      onDone: () => {
        if (locked) return;
        clearTimeout(graceTimer);
        graceTimer = setTimeout(() => {
          if (!locked) startTime = performance.now();
        }, GRACE_MS);
      },
    });
  }

  function finish() {
    guard.stop(); // crafting reward is a menu, not active play
    ctx.store.recordSessionPlayed();
    ctx.store.noteWaveEarned(earned); // personal best ("beat your best")
    ctx.save();
    const grade = earned >= length * 18 ? '🏆' : earned > 0 ? '💎' : '⛏️';
    const moreToRepair = review && lapsedWords(state.tracker).length > 0;
    const primary = moreToRepair
      ? el('button', { class: 'btn primary', onClick: () => ctx.nav('puzzle', { review: true }) }, '🔧 Repair more')
      : el('button', { class: 'btn primary', onClick: () => ctx.nav('puzzle') }, '🔨 Craft again');
    const reward = el(
      'div',
      { class: 'reward' },
      el('div', { class: 'big' }, review && !moreToRepair ? '✨' : grade),
      el('h2', {}, review ? (moreToRepair ? 'Crystals repaired!' : 'All crystals sparkling!') : 'Crafting complete!'),
      el('div', { class: 'earned' }, `+${earned} gems crafted`),
      el('p', { style: { color: 'var(--ink-dim)' } }, `Total: 💎 ${state.gems || 0}  ·  Depth ⛏️ ${ctx.depth()}`),
      el(
        'div',
        { class: 'row' },
        primary,
        el('button', { class: 'btn', onClick: () => ctx.nav('rhythm') }, '⛏️ Mine (fast)'),
        el('button', { class: 'btn', onClick: () => ctx.nav('progress') }, '🗺️ Progress'),
        el('button', { class: 'btn', onClick: () => ctx.nav('home') }, '🏠 Home'),
      ),
    );
    screen.replaceChildren(
      header(ctx, { title: review ? 'Repair complete' : 'Crafting complete', onBack: () => ctx.nav('home') }),
      reward,
    );
    if (earned > 0) audio.sfx('great');

    // Don't let them stall on the reward: highlight the primary action, then
    // auto-continue into another round ("let's go" — keep them crafting).
    const rewardGuard = createIdleGuard({
      nudgeMs: 13000,
      pauseMs: 30000,
      onNudge: () => pulse(reward.querySelector('.btn.primary')),
      onTimeout: () => {
        toast(moreToRepair ? '🔧 Keep repairing!' : '🔨 Keep crafting!');
        ctx.nav('puzzle', moreToRepair ? { review: true } : {});
      },
    });
    ctx.onLeave(() => rewardGuard.stop());
  }

  present();
  return screen;
}
