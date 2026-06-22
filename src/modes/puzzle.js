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
import { el, header, burst, toast, createIdleGuard, pulse, fitPlayArea, visibleTimeout } from '../ui.js';
import { buildCraftPool, buildRepairSession, applyAdaptiveLevel, recommendNext } from '../engine/selection.js';
import { fillLearning, recordCraft, repairWords, seedFromPlacement } from '../engine/categories.js';
import { createPlacement, nextWord as placementNext, submit as placementSubmit, result as placementResult, serialize as placementSerialize } from '../engine/placement.js';
import { byRank } from '../engine/lexicon.js';
import { mulberry32 } from '../engine/distractors.js';
import { gradeAnswer, projectedScore, GENTLE_PHRASES, NEXT_WORD_PHRASES } from '../engine/praise.js';
import { recordAnswer } from '../engine/progress.js';
import { scrambleTray, gradeBuild, isProperWord, displayCase } from '../engine/puzzle.js';

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

  // §C1 PLACEMENT DIAGNOSTIC: a new explorer's Craft sessions ARE the placement walk
  // (engine/placement.js) until they're placed. Each session plays `length` (6) words as an
  // ordinary-looking Craft set; the adaptive ±100 walk CONTINUES across sessions (its progress
  // is saved on the profile and resumed) and the diagnostic ends only when 3 misses land in one
  // 30-word band (or the maxItems safety net) — THEN it seeds the categories engine at that band
  // and normal play begins (Ian 2026-06-22b). (Repair never runs the diagnostic; timers relaxed.)
  const placement = !review && !(state.placement && state.placement.done);
  let walk = null;
  let sessionCount = 0; // words served in THIS craft session (placement is capped per-session, not total)
  if (placement) {
    const saved = state.placement && state.placement.walk;
    walk = createPlacement(byRank(), saved ? { restore: saved } : { age: state.placement && state.placement.age });
  }
  // §C1 debug toggle (Ian): the word-rank readout shows during placement ONLY when ?debug=1 is in
  // the URL (persisted to localStorage so it survives navigations) — kept OFF for real kids.
  const DEBUG = (() => {
    try {
      if (new URLSearchParams(location.search).has('debug')) { localStorage.setItem('csc_debug', '1'); return true; }
      return localStorage.getItem('csc_debug') === '1';
    } catch { return false; }
  })();

  // §30: CRAFT is the productive-struggle hub. The learning set (size = the "Words per dig"
  // setting) is kept full, and the session FOCUSES it (balanced with a little known/tricky).
  // The legacy continuous tracker still rides along for repair + distractor difficulty.
  // Exclude 1-2 letter words: you can't meaningfully BUILD "a"/"of" from tiles (and they'd
  // otherwise lead the set, being the most frequent). This filtered pool is the word source.
  const pool = byRank().filter((w) => w.word.length >= 3);
  if (!review && !placement) {
    state.categories.setSize = settings.length || state.categories.setSize || 10;
    fillLearning(state.categories, pool);
  }
  // §36 C3: Repair drills the §30 "cracked" words (crafted right before, since missed) so it
  // matches the Repair count + the yellow lights on Progress, not the legacy continuous tracker.
  // §C1: in placement the word source is the adaptive WALK, not a fixed session list.
  const session = placement
    ? []
    : review
      ? buildRepairSession(state.categories, pool, { length, rng })
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
    { class: 'hear-again', onClick: () => audio.say(target) },
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

  const hdr = header(ctx, {
    title: review ? 'Repair Crystals' : 'Crafting',
    onBack: () => ctx.nav('home'),
    onPause: () => guard.pauseNow(), // §36 E2 (guard is assigned below; the click fires later)
  });
  const gemCountEl = hdr.querySelector('.gem-count');

  const playBody = el(
    'div',
    { class: 'play-body' },
    el('div', { class: 'prompt' }, hearRow, sentenceEl, verdictEl, verdictChip),
    el('div', { class: 'answer-zone' }, slotsEl, controlsEl, trayEl),
  );
  // §C1 DEBUG (Ian 2026-06-22b): during the placement diagnostic ONLY, show the current word's
  // RANK / list-position / band + the running band-miss tally + jump, so the walk can be verified
  // (start word, ±100 jumps, "3 misses in a band" convergence). Never shown in normal play.
  const debugEl = el('div', { class: 'placement-debug' });
  const screen = el(
    'div',
    { class: 'screen puzzle' },
    hdr,
    placement && DEBUG && debugEl,
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
  let isProper = false; // §4 caps: this word's first letter displays as a capital (proper noun)
  let trayTiles = []; // [{ id, letter, used }]
  let slots = []; // [{ tileId, letter, locked } | null]
  let firstTry = true; // false after any wrong submit or hint (no clean-recall credit)
  let hintsUsed = 0; // §30: each hint reveals a letter and costs a % of the word's gems
  let locked = false; // true once solved, while the verdict shows
  let startTime = 0; // 0 until the read window passes
  let graceTimer = 0;
  let hintHiTimer = null; // visibleTimeout → highlight the hint button after HINT_HIGHLIGHT_MS
  let hintFireTimer = null; // visibleTimeout → auto-reveal a hint after HINT_AUTOFIRE_MS
  let suppressClick = false; // set right after a drag so the trailing click is ignored

  // (Re)start the no-correct-letter hint clock. Called when the word goes live and reset on
  // every correct letter placed; cleared once the word is solved or we leave the word.
  function armHintTimers() {
    clearHintTimers();
    if (locked) return;
    // §C1 Decision 1: during the placement diagnostic, RELAX the timers — no 4s highlight,
    // no 8s auto-reveal, no speed clock — so a slow/cautious first-time speller isn't
    // mis-placed too low. The manual 💡 hint still works (using it = NOT a clean build).
    if (placement) return;
    // thresholds scale by window.__idleTest (same hook the idle guard uses) so QA can drive them fast
    const tScale = (typeof window !== 'undefined' && Number(window.__idleTest)) || 1;
    // visibleTimeout (§36 E4): the highlight + auto-reveal never fire in a backgrounded tab.
    hintHiTimer = visibleTimeout(() => {
      if (!locked) {
        hintBtn.classList.add('hint-ready');
        pulse(hintBtn);
      }
    }, HINT_HIGHLIGHT_MS * tScale);
    hintFireTimer = visibleTimeout(() => {
      if (!locked) hint(true); // auto-fire (same gem cost as a tapped hint)
    }, HINT_AUTOFIRE_MS * tScale);
  }
  function clearHintTimers() {
    if (hintHiTimer) { hintHiTimer.cancel(); hintHiTimer = null; }
    if (hintFireTimer) { hintFireTimer.cancel(); hintFireTimer = null; }
    hintBtn.classList.remove('hint-ready');
  }
  ctx.onLeave(clearHintTimers);

  if (!placement && !session.length) {
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
    // §36 E3/E4: while PAUSED (manual or idle) or BACKGROUNDED, stop the hint clock so no
    // letter is auto-revealed behind a pause overlay or in a hidden tab; restart it on wake.
    onSuspend: () => clearHintTimers(),
    onWake: () => { if (!locked) armHintTimers(); },
    onResume: () => {
      if (locked) return;
      startTime = performance.now();
      audio.say(target);
      armHintTimers();
    },
  });
  ctx.onLeave(() => guard.stop());

  function renderDots() {
    // §C1: each placement session is a normal-looking `length`-word Craft set — show that many
    // dots filling with THIS session's words (the walk continues across sessions underneath).
    const done = placement ? sessionCount : index;
    const total = placement ? length : session.length;
    dots.replaceChildren(
      ...Array.from({ length: total }, (_, i) =>
        el('div', {
          class: 'dot' + (i < done ? ' done' : i === done ? ' current' : ''),
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
          // §4 caps: a proper noun's first slot DISPLAYS a capital (tiles stay lowercase)
          s ? displayCase(s.letter, i, isProper) : '',
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
    // §36 E1: an AUTO-reveal never fills the FINAL missing letter — the child must place
    // the last one themselves. If they keep stalling, the 45s idle pause overlay escalates
    // (we stop nudging here so it isn't perpetually re-armed). A tapped hint still helps fully.
    if (auto && g.perPosition.filter((p) => p !== true).length <= 1) {
      clearHintTimers();
      return;
    }
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
    // §C1 one-shot diagnostic (Ian 2026-06-22c): in the PLACEMENT diagnostic a word gets ONE try —
    // a wrong full build records the miss on the walk and advances straight to the NEXT word (no
    // keep-the-fitting-letters retry). Normal Craft keeps the retry behaviour below; a clean or
    // hinted build still completes via solve() either way (this is only the wrong-build path).
    if (placement) return diagnosticMiss();
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

  // §C1 one-shot diagnostic miss: record the miss + advance, no retry. Banks the same bookkeeping
  // a hinted-to-correct build did (walk + legacy tracker + answer stat), so placement signal and
  // distractor difficulty are unchanged; gives the gentle "good try" consolation so the child never
  // feels punished and never knows the first round is a diagnostic. The walk decides the next word.
  function diagnosticMiss() {
    locked = true;
    clearHintTimers();
    controlsEl.style.display = 'none'; // Hint/Clear are meaningless once we've moved on
    recordAnswer(state.tracker, target, false, { source: 'craft' }); // legacy tracker (distractor difficulty)
    ctx.store.recordAnswerStat(false, 'craft'); // counts as an answered (not-clean) word
    placementSubmit(walk, target, false); // the ±100 walk steps DOWN on a miss
    sessionCount += 1;
    const pts = CONSOLATION_GEMS; // gentle, non-shaming — same as a build that needed help
    earned += pts;
    ctx.store.addGems(pts);
    audio.sfx('great');
    // §36 #1: a FORWARD-moving phrase (NOT GENTLE_PHRASES' "try again") — the diagnostic is one shot,
    // so the spoken + shown copy must move the child ON, never imply retrying this word.
    const phrase = NEXT_WORD_PHRASES[Math.floor(rng() * NEXT_WORD_PHRASES.length)];
    audio.speakPraise(phrase);
    flashVerdict(phrase, `+${pts} 💎 · Next word`, '#9D8DF1');
    updateCombo(null);
    slots.forEach((s) => {
      if (s) s.locked = true;
    });
    render();
    bumpGems();
    ctx.save();
    setTimeout(present, 1100);
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
    // §C1: during placement the WALK (not the categories machine) decides the level — we record
    // each answer onto the walk and seed categories ALL AT ONCE when it finishes (finishPlacement),
    // so corrects already bank progress. Normal play feeds the §30 state machine per word:
    // a clean build advances toward KNOWN (2 in a row), an assisted one resets the streak, then
    // the adaptive level may nudge up/down (skipped for a repair drill of known-hard words).
    if (placement) {
      placementSubmit(walk, target, firstTry);
      sessionCount += 1;
    } else {
      recordCraft(state.categories, target, firstTry, { pool });
      if (!review) applyAdaptiveLevel(state.categories, pool);
    }

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
      if (!placement) index += 1; // placement advances via the walk, not a session index
      present();
    }, 1100);
  }

  // --- per-word setup -------------------------------------------------------
  function present() {
    // §C1: in placement, words come from the WALK. The walk persists across sessions: PLACE only
    // when it's done (3 misses in a band, or the safety net); otherwise end the session at `length`
    // words and resume next time. Outside placement, walk the fixed session list.
    let entry;
    if (placement) {
      if (walk.done) return finishPlacement();
      if (sessionCount >= length) return endDiagSession();
      entry = placementNext(walk);
      if (!entry) return finishPlacement();
    } else {
      if (index >= session.length) return finish();
      entry = session[index];
    }
    locked = false;
    firstTry = true;
    hintsUsed = 0;
    startTime = 0;
    controlsEl.style.display = ''; // restore Hint/Clear for the new word (QA I8)
    clearTimeout(graceTimer);
    clearHintTimers();
    target = entry.word.toLowerCase();
    isProper = isProperWord(entry.word); // §4 caps: capitalize the first slot's DISPLAY for proper nouns
    // §C1 debug readout (placement only): rank / list-position / band, the running band-miss
    // tally toward the "3 in a band" stop, the word number, and the jump the last answer caused.
    if (placement && DEBUG) {
      const bandMiss = walk.bandMiss.get(entry.band) || 0;
      const asked = walk.responses.length;
      const prev = asked ? walk.responses[asked - 1] : null;
      const jump = prev ? (prev.correct ? '↑ +100 (last clean)' : '↓ −100 (last miss)') : 'start';
      debugEl.textContent = `🔧 #${entry.rank} · pos ${entry.pos} · band ${entry.band} · band-miss ${bandMiss}/${walk.missesToEnter} · word #${asked + 1} · ${jump}`;
    }

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
      window.__puzzleCurrent = { word: target, isProper, index, total: session.length, placement, rank: entry.rank, pos: entry.pos, band: entry.band };
    } catch {
      /* ignore */
    }

    // §30 hint clock: 4s/8s measured from when the word appears (independent of the audio
    // chain), reset on each correct letter. (The gem speed clock still starts post-dictation.)
    armHintTimers();
    audio.say(target, {
      onDone: () => {
        if (locked || placement) return; // §C1: no speed clock during the placement diagnostic
        clearTimeout(graceTimer);
        graceTimer = setTimeout(() => {
          if (!locked) startTime = performance.now();
        }, GRACE_MS);
      },
    });
  }

  // §C1: the placement walk ended (3 misses in one 30-word band, or the safety cap). Seed the
  // categories engine at the diagnosed band — corrects already banked progress in the tracker —
  // mark this explorer PLACED so every future Craft is a normal session, then show the SAME
  // Craft reward so the child never knows the first round was a diagnostic.
  function finishPlacement() {
    const res = placementResult(walk);
    state.categories.setSize = settings.length || state.categories.setSize || 10;
    seedFromPlacement(state.categories, res.responses, res.enteredBand, pool);
    // replacing state.placement (no `walk` field) clears the saved diagnostic — they're placed now.
    state.placement = { done: true, age: (state.placement && state.placement.age) || null, band: res.enteredBand };
    state.startLevel = res.enteredBand; // keep the per-profile anchor in sync (Settings display)
    ctx.save();
    finish();
  }

  // §C1: a diagnostic craft session ended WITHOUT placing (fewer than 3 misses in any one band so
  // far). SAVE the walk's progress so the NEXT craft session resumes it, then show the normal Craft
  // reward — to the child this was just a normal set; "Craft again" keeps the diagnostic going.
  function endDiagSession() {
    state.placement = {
      done: false,
      age: (state.placement && state.placement.age) || null,
      walk: placementSerialize(walk),
    };
    ctx.save();
    finish();
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
    const moreToRepair = review && repairWords(state.categories).length > 0;
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
      el('p', { style: { color: 'var(--ink-dim)' } }, `Total: 💎 ${state.gems || 0}  ·  Level ⛏️ ${(state.categories && state.categories.level) || 1}`),
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
