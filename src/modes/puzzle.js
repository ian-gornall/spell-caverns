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
import { el, header, burst, toast, createIdleGuard, pulse, fitPlayArea } from '../ui.js';
import { buildReviewSession } from '../engine/session.js';
import { buildCraftPool, applyAdaptiveLevel, recommendNext } from '../engine/selection.js';
import { fillLearning, recordCraft } from '../engine/categories.js';
import { byRank } from '../engine/lexicon.js';
import { mulberry32 } from '../engine/distractors.js';
import { gradeAnswer, projectedScore, GENTLE_PHRASES } from '../engine/praise.js';
import { recordAnswer, lapsedWords } from '../engine/progress.js';
import { scrambleTray, gradeBuild } from '../engine/puzzle.js';

// §30 hint timing: with no CORRECT letter placed, highlight the hint button at 4s and
// auto-fire a hint at 8s (the timer resets on every correct letter). Auto-fired hints
// cost the same as tapped ones — the gem cost is a % of the word given away (see solve()).
const HINT_HIGHLIGHT_MS = 4000;
const HINT_AUTOFIRE_MS = 8000;

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
  // §30: CRAFT is the productive-struggle hub. The learning set (size = the "Words per dig"
  // setting) is kept full, and the session FOCUSES it (balanced with a little known/tricky).
  // The legacy continuous tracker still rides along for repair + distractor difficulty.
  // Exclude 1-2 letter words: you can't meaningfully BUILD "a"/"of" from tiles (and they'd
  // otherwise lead the set, being the most frequent). This filtered pool is the word source.
  const pool = byRank().filter((w) => w.word.length >= 3);
  if (!review) {
    state.categories.setSize = settings.length || state.categories.setSize || 10;
    fillLearning(state.categories, pool);
  }
  const session = review
    ? buildReviewSession(state.tracker, { length, rng })
    : buildCraftPool(state.categories, pool, { length, rng });
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
  // NOTE: "Sound it out" (audio.saySlow) is DISABLED for now — on iOS the device TTS
  // reads short isolated syllables as letter names ("spells it out") rather than
  // blending them (user feedback 2026-06-18). Helper kept for a future revisit with
  // real phoneme audio. Prompt shows only "Hear it again" meanwhile.
  const hearRow = el('div', { class: 'hear-row' }, hearBtn);
  const hintBtn = el('button', { class: 'btn ghost', onClick: () => hint(false) }, '💡 Hint');
  const clearBtn = el('button', { class: 'btn ghost', onClick: clearAll }, '↺ Clear');
  const controlsEl = el('div', { class: 'puzzle-controls' }, hintBtn, clearBtn);

  const hdr = header(ctx, { title: review ? 'Repair Crystals' : 'Crafting', onBack: () => ctx.nav('home') });
  const gemCountEl = hdr.querySelector('.gem-count');

  const playBody = el(
    'div',
    { class: 'play-body' },
    el('div', { class: 'prompt' }, hearRow, sentenceEl, verdictEl, verdictChip),
    el('div', { class: 'answer-zone' }, slotsEl, controlsEl, trayEl),
  );
  const screen = el(
    'div',
    { class: 'screen puzzle' },
    hdr,
    dots,
    el('div', { class: 'combo-wrap' }, comboFill),
    comboLabel,
    playBody,
  );

  // §33: after a word renders (and on rotate/resize), shrink the tiles to fit so the word slots,
  // the letter tray, and the Hint/Clear buttons stay co-visible for ANY word length on a phone.
  const fit = () => requestAnimationFrame(() => fitPlayArea(playBody));
  window.addEventListener('resize', fit);
  ctx.onLeave(() => window.removeEventListener('resize', fit));

  // --- per-session state ----------------------------------------------------
  let index = 0;
  let combo = 0;
  let earned = 0;

  // --- per-word state -------------------------------------------------------
  let target = '';
  let trayTiles = []; // [{ id, letter, used }]
  let slots = []; // [{ tileId, letter, locked } | null]
  let firstTry = true; // false after any wrong submit or hint (no clean-recall credit)
  let hintsUsed = 0; // §30: each hint reveals a letter and costs a % of the word's gems
  let locked = false; // true once solved, while the verdict shows
  let startTime = 0; // 0 until the read window passes
  let graceTimer = 0;
  let hintHiTimer = 0; // → highlight the hint button after HINT_HIGHLIGHT_MS with no correct letter
  let hintFireTimer = 0; // → auto-fire a hint after HINT_AUTOFIRE_MS with no correct letter
  let suppressClick = false; // set right after a drag so the trailing click is ignored

  // (Re)start the no-correct-letter hint clock. Called when the word goes live and reset on
  // every correct letter placed; cleared once the word is solved or we leave the word.
  function armHintTimers() {
    clearHintTimers();
    if (locked) return;
    hintHiTimer = setTimeout(() => {
      if (!locked) {
        hintBtn.classList.add('hint-ready');
        pulse(hintBtn);
      }
    }, HINT_HIGHLIGHT_MS);
    hintFireTimer = setTimeout(() => {
      if (!locked) hint(true); // auto-fire (same gem cost as a tapped hint)
    }, HINT_AUTOFIRE_MS);
  }
  function clearHintTimers() {
    clearTimeout(hintHiTimer);
    clearTimeout(hintFireTimer);
    hintBtn.classList.remove('hint-ready');
  }
  ctx.onLeave(clearHintTimers);

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
    // §30: a CORRECT letter in its slot resets the hint clock (the kid is making progress).
    if (tile.letter === target[i] && startTime) armHintTimers();
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

  // Reveal the first not-yet-correct letter. `auto` marks an 8s auto-fired hint (same cost).
  // Each hint reveals one letter and costs gems = a % of the word given away (applied in solve).
  function hint(auto = false) {
    if (locked) return;
    const g = gradeBuild(target, slots.map((s) => (s ? s.letter : null)));
    const i = g.perPosition.findIndex((p) => p !== true);
    if (i < 0) return;
    firstTry = false;
    hintsUsed += 1;
    if (slots[i] && !slots[i].locked) returnSlot(i);
    const need = target[i];
    const tile = trayTiles.find((x) => !x.used && x.letter === need);
    if (tile) {
      tile.used = true;
      slots[i] = { tileId: tile.id, letter: need, locked: true };
    }
    audio.sfx('gem');
    if (auto) toast('💡 Here’s a letter to help!');
    armHintTimers(); // a revealed letter is progress → restart the no-correct-letter clock
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
    flashVerdict(phrase, 'Keep the letters that fit', '#8593A3'); // AA-lifted slate (see praise.MISS_TIER)
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
    clearHintTimers();
    controlsEl.style.display = 'none'; // Hint/Clear are meaningless once solved (QA I8)
    const responseMs = startTime ? performance.now() - startTime : 0;
    // CRAFTING is the SOURCE OF TRUTH for mastery (§21-A): a clean first-try build = known,
    // a missed/assisted build = a target. (Recognition/mining never sets this — only craft.)
    recordAnswer(state.tracker, target, firstTry, { responseMs, source: 'craft' });
    ctx.store.recordAnswerStat(firstTry, 'craft'); // clean builds feed the "craft N words" quest
    // §30 state machine: a clean build advances the word toward KNOWN (2 in a row); an assisted
    // one resets that streak. Then the adaptive level may nudge up/down (normal play only — a
    // repair drill of known-hard words shouldn't drag the level down).
    recordCraft(state.categories, target, firstTry, { pool });
    if (!review) applyAdaptiveLevel(state.categories, pool);

    if (firstTry) {
      combo += 1;
      ctx.store.recordCombo(combo); // best combo today (daily quest)
      const verdict = gradeAnswer({ correct: true, responseMs, combo, craft: true, rng });
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
      // §30 gem-cost hints: each hinted letter gives away 2×value/length of the word, so
      // revealing HALF the letters → 0 points (still completes — eases frustration; never
      // negative). A build that was only wrong-submitted (no hint) keeps the gentle consolation.
      let pts = CONSOLATION_GEMS;
      if (hintsUsed > 0) {
        const value = projectedScore({ responseMs, combo: 0, craft: true }).points;
        pts = Math.max(0, Math.round(value * (1 - (2 * hintsUsed) / target.length)));
      }
      earned += pts;
      ctx.store.addGems(pts);
      audio.sfx('great');
      const phrase = 'You crafted it!';
      audio.speakPraise(phrase);
      flashVerdict(phrase, `+${pts} 💎 · Crafted`, '#9D8DF1');
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
    hintsUsed = 0;
    startTime = 0;
    controlsEl.style.display = ''; // restore Hint/Clear for the new word (QA I8)
    clearTimeout(graceTimer);
    clearHintTimers();
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
    fit(); // §33: size the slots + tray to fit this word's length on this screen

    // off-DOM test hook (Playwright) — current target + position, like rhythm's
    try {
      window.__puzzleCurrent = { word: target, index, total: session.length };
    } catch {
      /* ignore */
    }

    // §30 hint clock: 4s/8s measured from when the word appears (independent of the audio
    // chain), reset on each correct letter. (The gem speed clock still starts post-dictation.)
    armHintTimers();
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
    // Broke through to a new cavern depth? Hand off to the GEODE BOSS milestone.
    if (ctx.depth() > ctx.store.lastMilestoneDepth()) {
      // crack the NEXT uncracked level (one per boss, even if depth jumped several)
      return ctx.nav('boss', { depth: ctx.store.lastMilestoneDepth() + 1, earned, from: 'puzzle' });
    }
    const grade = earned >= length * 18 ? '🏆' : earned > 0 ? '💎' : '⛏️';
    const moreToRepair = review && lapsedWords(state.tracker).length > 0;
    const primary = moreToRepair
      ? el('button', { class: 'btn primary', onClick: () => ctx.nav('puzzle', { review: true }) }, '🔧 Repair more')
      : el('button', { class: 'btn primary', onClick: () => ctx.nav('puzzle') }, '🔨 Craft again');
    // §31.C: once words are KNOWN and mastery is unlocked, steer toward DRAWING them from
    // memory ("now MASTER them!") — the next rung of the Craft→Mastery cycle.
    const rec = recommendNext(state.categories);
    const masterCta =
      rec.mode === 'mastery' &&
      el('button', { class: 'btn primary nudge', onClick: () => ctx.nav('mastery') }, '✍️ Master them!');
    const reward = el(
      'div',
      { class: 'reward' },
      el('div', { class: 'big' }, review && !moreToRepair ? '✨' : grade),
      el('h2', {}, review ? (moreToRepair ? 'Crystals repaired!' : 'All crystals sparkling!') : 'Crafting complete!'),
      el('div', { class: 'earned' }, `+${earned} gems crafted`),
      masterCta && el('p', { style: { color: 'var(--gold, #ffd23f)' } }, `You’ve learned ${rec.knownBacklog} word${rec.knownBacklog === 1 ? '' : 's'} — now master ${rec.knownBacklog === 1 ? 'it' : 'them'}! ✍️`),
      el('p', { style: { color: 'var(--ink-dim)' } }, `Total: 💎 ${state.gems || 0}  ·  Depth ⛏️ ${ctx.depth()}`),
      el(
        'div',
        { class: 'row' },
        primary,
        masterCta,
        el('button', { class: 'btn', onClick: () => ctx.nav('rhythm') }, '⛏️ Mine'),
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
