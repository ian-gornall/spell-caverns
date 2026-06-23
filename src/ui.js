// src/ui.js — tiny DOM toolkit + screen router for the app.
//
// No framework, no build step (HANDOFF §4). `el()` builds elements declaratively;
// `render()` swaps the active screen; `header()` is the shared gem/depth bar;
// `toast()` and `burst()` provide light feedback flourishes. UI module — never
// imported by `node --test` (those cover the pure engine).

// el('button', { class:'tile', onClick: fn }, 'text', childNode, [more, nodes])
// - on* keys become event listeners; `style`/`dataset` accept objects; falsy
//   children are skipped (so `cond && el(...)` works inline).
// Inputs must NOT show the mobile keyboard's autofill / autocomplete / autocorrect /
// spellcheck suggestion strip: kids type the spelling (and their name) themselves, the
// suggestion bar both defeats the exercise and clutters the small UI, and a contact-name
// autofill could leak into the child's name field. Spread into an el() input's attrs.
export const NO_AUTOFILL = {
  autocomplete: 'off',
  autocorrect: 'off',
  autocapitalize: 'off',
  spellcheck: 'false',
};

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    // `spellcheck` is a boolean IDL property — assigning the string 'false' to it is
    // TRUTHY (leaving spellcheck ON), so always reflect it through the attribute. Handle
    // it before the falsy-skip so `spellcheck: false` also disables it (not a no-op).
    if (k === 'spellcheck') {
      node.setAttribute('spellcheck', v === false || v === 'false' ? 'false' : 'true');
      continue;
    }
    if (v == null || v === false) continue;
    if (k === 'class' || k === 'className') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k === 'dataset' && typeof v === 'object') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k in node && k !== 'list') {
      try {
        node[k] = v;
      } catch {
        node.setAttribute(k, v);
      }
    } else node.setAttribute(k, v);
  }
  appendChildren(node, children);
  return node;
}

function appendChildren(node, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false || c === true) continue;
    node.appendChild(
      typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c,
    );
  }
}


let root = null;
export function setRoot(node) {
  root = node;
}

// Apply the learner's chosen "crystal colour" (Settings / onboarding) as the live
// --accent CSS variable, so the personalization actually shows on screen. No-op for
// a falsy colour.
export function applyTheme(color) {
  if (!color) return;
  try {
    document.documentElement.style.setProperty('--accent', color);
  } catch {
    /* ignore (no DOM) */
  }
}

// Accessibility: toggle "easy-read" text (extra letter-spacing + line-height on the
// spelling-critical text) for struggling readers. A class on <html> drives the CSS.
export function applyReadable(on) {
  try {
    document.documentElement.classList.toggle('readable', !!on);
  } catch {
    /* ignore (no DOM) */
  }
}

// Geo — the friendly crystal guide (mascot). A procedural gem "character" (no art
// assets) with a speech bubble; used on first-run onboarding (research Tier 2 #9:
// a named guide supports autonomy/competence). `text` is also a good thing to speak.
// `mood` adds a CSS expression state to Geo (DESIGN_ANALYSIS rec #6): 'cheer' (a happy
// bounce + bigger grin, for celebratory moments) or 'wink' (a friendly greeting). Default
// is the calm idle bob. Pure CSS on the existing hexagon — see styles.css `.mascot.cheer/.wink`.
export function mascot(text, { name = 'Geo', mood = '' } = {}) {
  return el(
    'div',
    { class: 'mascot' + (mood ? ' ' + mood : '') },
    el(
      'div',
      { class: 'mascot-char', 'aria-hidden': 'true' },
      el(
        'div',
        { class: 'mascot-face' },
        el('div', { class: 'mascot-eyes' }, el('span', { class: 'eye' }), el('span', { class: 'eye' })),
        el('div', { class: 'mascot-smile' }),
      ),
    ),
    text &&
      el(
        'div',
        { class: 'speech-bubble' },
        el('div', { class: 'speech-name' }, name),
        el('div', { class: 'speech-text' }, text),
      ),
  );
}

// Swap in a new screen. (Speech is stopped in nav() BEFORE the new screen is
// built, so a screen that dictates on mount — e.g. rhythm — isn't cut off here.)
export function render(screenNode) {
  if (!root) return;
  root.replaceChildren(screenNode);
}

// Shared header: a back chevron (optional), a title (optional), an optional Pause
// button (play screens, §36 E2), and the live gem + cavern-LEVEL readout.
// §C1: the header shows the CAVERN LEVEL (the 30-word band the learner is on) — the "where
// am I" number — not the mastery-based depth (which still drives the geode boss internally).
export function header(ctx, { title, onBack, onPause } = {}) {
  const gems = ctx.state.gems || 0;
  const level = (ctx.state && ctx.state.categories && ctx.state.categories.level) || 1;
  return el(
    'header',
    { class: 'app-header' },
    onBack && el('button', { class: 'btn-icon back', onClick: onBack, 'aria-label': 'Back' }, '‹'),
    title && el('div', { class: 'header-title' }, title),
    onPause &&
      el('button', { class: 'btn-icon pause', onClick: onPause, 'aria-label': 'Pause' }, '⏸'),
    el(
      'div',
      { class: 'header-stats' },
      el(
        'div',
        { class: 'stat gems', title: 'Gems' },
        el('span', { class: 'icon' }, '💎'),
        el('span', { class: 'gem-count' }, String(gems)),
      ),
      el(
        'div',
        { class: 'stat depth', title: 'Cavern level' },
        el('span', { class: 'icon' }, '⛏️'),
        // the word "Level" is hidden on phones (CSS) to keep the header from clipping —
        // the ⛏️ icon + number still reads as the cavern level there.
        el('span', {}, el('span', { class: 'depth-word' }, 'Level '), String(level)),
      ),
    ),
  );
}

// Briefly show a message at the bottom of the screen.
export function toast(msg, ms = 1900) {
  const t = el('div', { class: 'toast' }, msg);
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 320);
  }, ms);
}

// A big blocking "Paused — tap to resume" modal. The idle guard shows this when a
// child fully blanks out mid-game so they can't just sit there indefinitely; it
// clears on tap and calls `onResume`. Returns the overlay node.
export function pauseOverlay({ onResume } = {}) {
  const resume = () => {
    overlay.remove();
    if (onResume) onResume();
  };
  const overlay = el(
    'div',
    { class: 'pause-overlay', onPointerdown: (e) => { if (e.target === overlay) resume(); } },
    el(
      'div',
      { class: 'pause-box' },
      el('div', { class: 'pause-emoji' }, '⏸️'),
      el('h2', {}, 'Paused'),
      el('p', {}, 'Still exploring? Tap to jump back in!'),
      el('button', { class: 'btn primary', onClick: resume }, '▶️ Resume'),
    ),
  );
  document.body.appendChild(overlay);
  return overlay;
}

// §32 PARENTAL GATE — a blocking modal a GROWN-UP must clear (a small arithmetic challenge: the
// standard kids-app gate, hard for a young child to tap through) before a sensitive action like
// turning on the microphone. `body` is an array of explanation nodes/strings shown above the
// challenge; `agree` (optional) is a consent line a grown-up confirms. onPass fires on a correct
// answer (+ ticked consent, if any); onCancel on dismiss. Returns the overlay node.
export function parentalGate({ title = 'Grown-ups only 🔒', body = [], agree = '', confirmLabel = 'Allow', onPass, onCancel } = {}) {
  const a = 2 + Math.floor(Math.random() * 8); // 2..9
  const b = 2 + Math.floor(Math.random() * 8);
  const close = (fn) => { overlay.remove(); if (fn) fn(); };
  const answerInput = el('input', {
    type: 'number', inputmode: 'numeric', autocomplete: 'off', class: 'gate-answer', 'aria-label': 'Answer the question',
    onKeydown: (e) => { if (e.key === 'Enter') submit(); },
  });
  let consented = !agree; // no consent line ⇒ already satisfied
  const consentRow = agree
    ? el('label', { class: 'gate-consent' },
        el('input', { type: 'checkbox', onChange: (e) => { consented = e.target.checked; } }),
        el('span', {}, agree))
    : null;
  const errEl = el('div', { class: 'gate-err' }, '');
  function submit() {
    if (!consented) { errEl.textContent = 'Please tick the box to agree first.'; return; }
    if (parseInt(answerInput.value, 10) === a + b) { close(onPass); return; }
    errEl.textContent = 'Not quite — ask a grown-up. Try again.';
    answerInput.value = '';
    answerInput.focus();
  }
  const overlay = el(
    'div',
    { class: 'gate-overlay', onPointerdown: (e) => { if (e.target === overlay) close(onCancel); } },
    el(
      'div',
      { class: 'gate-box' },
      el('h2', {}, title),
      el('div', { class: 'gate-body' }, ...body.map((n) => (typeof n === 'string' ? el('p', {}, n) : n))),
      consentRow,
      el('div', { class: 'gate-q' }, el('span', {}, `Grown-up check: what is ${a} + ${b}?`), answerInput),
      errEl,
      el(
        'div',
        { class: 'gate-actions' },
        el('button', { class: 'btn', onClick: () => close(onCancel) }, 'Cancel'),
        el('button', { class: 'btn primary', onClick: submit }, confirmLabel),
      ),
    ),
  );
  document.body.appendChild(overlay);
  setTimeout(() => answerInput.focus(), 30);
  return overlay;
}

// §37 A ACTIVE-ENGAGEMENT auto-pause — a soft, full-screen "brain break" shown after a long
// UNBROKEN session (the global createActiveTimer in app.js reaches its 20-min lockMs). Unlike the
// idle pauseOverlay (which fires on INACTIVITY and dismisses on a tap), this is a deliberate
// off-ramp: it shows the words the child is currently LEARNING so the break stays useful ("practise
// with a partner"), counts `durationMs` (5 min) down then AUTO-unlocks, and a grown-up can end it
// early through the arithmetic parentalGate (Ian design call #2: the lock is SOFT / grown-up-
// dismissable, not a hard wall). `learning` is the learningProgress() list (or plain word strings);
// an empty list just hides the word row. Returns { remove } for forced teardown.
export function activePauseOverlay({ learning = [], durationMs = 5 * 60 * 1000, onUnlock, onGrownupSkip } = {}) {
  let left = Math.max(1, Math.ceil(durationMs / 1000)); // whole seconds remaining
  let timerId = 0;
  let done = false;
  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const countEl = el('span', { class: 'apause-count' }, fmt(left));
  const finish = (fn) => {
    if (done) return;
    done = true;
    clearInterval(timerId);
    overlay.remove();
    if (fn) fn();
  };
  const words = learning.map((w) => (typeof w === 'string' ? w : w && w.word)).filter(Boolean);
  const wordRow = words.length
    ? el(
        'div',
        { class: 'apause-words' },
        ...words.map((w) => el('span', { class: 'apause-word' }, w)),
      )
    : null;
  const overlay = el(
    'div',
    { class: 'apause-overlay' }, // intentionally NO tap-to-dismiss (it is a real break, not the idle pause)
    el(
      'div',
      { class: 'apause-box' },
      el('div', { class: 'apause-emoji' }, '🌿'),
      el('h2', {}, 'Time for a brain break!'),
      el('p', {}, "You've been spelling really hard. Take a stretch, or practise these words out loud with a partner or grown-up."),
      wordRow,
      el('p', { class: 'apause-back' }, 'Back in ', countEl),
      el(
        'button',
        {
          class: 'btn ghost apause-skip',
          onClick: () =>
            parentalGate({
              title: 'Grown-ups only 🔒',
              body: ['End the brain break early?'],
              confirmLabel: 'End break',
              onPass: () => finish(onGrownupSkip || onUnlock),
            }),
        },
        'Grown-up: end the break',
      ),
    ),
  );
  document.body.appendChild(overlay);
  timerId = setInterval(() => {
    left -= 1;
    if (left <= 0) {
      finish(onUnlock);
      return;
    }
    countEl.textContent = fmt(left);
  }, 1000);
  return { remove: () => finish(null) };
}

// A gentle "do something" pulse on a node (used by idle nudges to highlight a card
// or the primary button). No-op for a missing node.
export function pulse(node) {
  if (!node) return;
  node.classList.remove('pulse');
  void node.offsetWidth;
  node.classList.add('pulse');
  setTimeout(() => node.classList.remove('pulse'), 1600);
}

// §33 fit-to-viewport: shrink a play screen's tiles (via the --play-scale custom property the
// CSS multiplies into every slot / tray-tile / candidate / canvas dimension) until its `.play-body`
// no longer overflows its own visible height. This is what guarantees the GOAL — the word being
// filled in, the interaction surface, AND the action buttons stay co-visible REGARDLESS of word
// length, on any phone — without ever pushing the tray/controls below the fold. Defaults to 1, so
// tablets/iPad (where nothing overflows) are untouched; it only bites when content would clip.
// Call after each word renders and on resize. `playBody` = the mode's `.play-body` element.
export function fitPlayArea(playBody) {
  if (!playBody || !playBody.clientHeight) return;
  // Floor: below this letters get too small to read, so we stop (the body may then scroll as a last
  // resort). The loop only REACHES the floor when even the smallest tiles can't fit — e.g. a long
  // word on a ~390px-tall landscape phone — so lowering it only ever helps the most cramped cases;
  // any screen that fits at a larger scale keeps that larger scale.
  const MIN = 0.35;
  const STEP = 0.05;
  let scale = 1;
  playBody.style.setProperty('--play-scale', '1');
  // Each pass forces a reflow read of scrollHeight; shrink until the content fits (max ~9 passes).
  while (scale > MIN && playBody.scrollHeight - playBody.clientHeight > 1) {
    scale = Math.round((scale - STEP) * 100) / 100;
    playBody.style.setProperty('--play-scale', String(scale));
  }
}

// Keep a child ENGAGED. Watches document-wide pointer/key activity; after `nudgeMs`
// of NO activity it fires `onNudge` (a gentle prompt / re-dictate). Then at `pauseMs`:
//   - if `onTimeout` is given, it calls that instead (e.g. a MENU auto-starts the game
//     — "let's go") and shows NO overlay;
//   - otherwise it shows the blocking pause overlay (`onPause` when it appears,
//     `onResume` when the child taps to resume) — for active play, so they can't zone out.
// Self-manages its listeners + overlay — call `.stop()` on leaving the screen (register
// it via ctx.onLeave). `.poke()` resets the timer. Thresholds scale by window.__idleTest.
//
// §36 hooks + visibility (E2/E3/E4):
//   - `.pauseNow()` shows the pause overlay on demand (the manual Pause button, E2).
//   - `onPause`/`onResume` fire when the OVERLAY appears / is dismissed (existing).
//   - `onSuspend` fires when the screen should freeze its OWN auto timers — i.e. the overlay
//     appears OR the tab goes hidden; `onWake` fires when the tab becomes visible again with
//     no overlay. Together they let a screen pause hint/step/clock timers while paused or
//     backgrounded (E3) and resume on return. The idle timers themselves never fire while the
//     tab is hidden (visibleTimeout + an explicit visibility check), fixing the background-tab
//     auto-advance/nudge bug (E4).
export function createIdleGuard({ nudgeMs = 15000, pauseMs = 45000, onNudge, onPause, onResume, onTimeout, onSuspend, onWake } = {}) {
  const scale = (typeof window !== 'undefined' && Number(window.__idleTest)) || 1;
  nudgeMs *= scale;
  pauseMs *= scale;
  let nudgeT = null;
  let pauseT = null;
  let stopped = false;
  let overlay = null;
  let last = 0;

  const isHidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';
  const clearTimers = () => {
    if (nudgeT) { nudgeT.cancel(); nudgeT = null; }
    if (pauseT) { pauseT.cancel(); pauseT = null; }
  };
  // The idle countdown only runs while the tab is VISIBLE and not stopped/overlaid (§36 E4):
  // a backgrounded tab must never nudge, auto-advance, or pop the pause overlay. visibleTimeout
  // itself also withholds firing while hidden, so this is belt-and-suspenders.
  const arm = () => {
    clearTimers();
    if (stopped || overlay || isHidden()) return;
    if (onNudge) nudgeT = visibleTimeout(() => { if (!stopped && !overlay) onNudge(); }, nudgeMs);
    pauseT = visibleTimeout(() => {
      if (stopped || overlay) return;
      if (onTimeout) {
        onTimeout(); // menu auto-advance ("let's go") — no blocking overlay
        return;
      }
      showOverlay();
    }, pauseMs);
  };
  // Show the blocking pause overlay (idle timeout OR the manual Pause button). onPause +
  // onSuspend let the screen stop its OWN auto timers (hints/steps) while paused (E3).
  const showOverlay = () => {
    if (stopped || overlay) return;
    clearTimers();
    if (onPause) onPause();
    if (onSuspend) onSuspend();
    overlay = pauseOverlay({
      onResume: () => {
        overlay = null;
        arm();
        if (onResume) onResume();
      },
    });
  };
  const poke = () => {
    if (stopped || overlay) return;
    const now = typeof performance !== 'undefined' ? performance.now() : 0;
    if (now - last < 300) return; // throttle the high-frequency pointermove
    last = now;
    arm();
  };
  const onAct = () => poke();
  // On tab hide: stop the idle timers + suspend the screen's auto timers; on return:
  // re-arm + wake. Showing-on-return is avoided (no nudge fires the instant they look back).
  const onVis = () => {
    if (stopped) return;
    if (isHidden()) {
      clearTimers();
      if (onSuspend) onSuspend();
    } else if (!overlay) {
      if (onWake) onWake();
      arm();
    }
  };
  document.addEventListener('pointerdown', onAct, true);
  document.addEventListener('pointermove', onAct, true);
  document.addEventListener('keydown', onAct, true);
  document.addEventListener('visibilitychange', onVis);
  arm();

  return {
    poke,
    pausedNow: () => !!overlay,
    pauseNow: showOverlay, // §36 E2: the manual Pause button triggers the same overlay
    stop() {
      stopped = true;
      clearTimers();
      document.removeEventListener('pointerdown', onAct, true);
      document.removeEventListener('pointermove', onAct, true);
      document.removeEventListener('keydown', onAct, true);
      document.removeEventListener('visibilitychange', onVis);
      if (overlay) {
        overlay.remove();
        overlay = null;
      }
    },
  };
}

// A setTimeout that NEVER fires while the tab is hidden (§36 E4): if the tab goes hidden
// mid-countdown the pending fire is cancelled, and on becoming visible again the FULL delay
// restarts. So auto-advance / hint / idle timers can't fire, reveal, or nudge in a
// backgrounded tab — they wait until the child is actually looking. Returns { cancel }.
// (In a non-DOM context it degrades to a plain setTimeout.)
export function visibleTimeout(fn, ms) {
  let id = 0;
  let done = false;
  const visible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden';
  const cleanup = () => {
    clearTimeout(id);
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVis);
  };
  const start = () => {
    clearTimeout(id);
    if (done || !visible()) return;
    id = setTimeout(() => {
      done = true;
      cleanup();
      fn();
    }, ms);
  };
  function onVis() {
    if (done) return;
    if (visible()) start();
    else clearTimeout(id); // paused while hidden
  }
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVis);
  start();
  return {
    cancel() {
      done = true;
      cleanup();
    },
  };
}

// picturePad — a kid-friendly "picture password" entry pad.
//
// Shows a grid of `icons` (default 6 distinct emoji). The child taps a sequence of
// `length` icons; each tap fills a progress dot. When `length` taps are entered,
// onComplete(codeString) is called where codeString is the tapped icons joined
// (e.g. "🌟💎⛏️"). A reset button lets them start over. Returns a DOM node.
const PAD_ICONS = ['🌟', '⛏️', '💎', '🔮', '🐢', '🔥'];

export function picturePad({ onComplete, length = 3, icons = PAD_ICONS } = {}) {
  let chosen = [];

  const dotsRow = el('div', { class: 'pic-chosen' });
  const renderDots = () => {
    dotsRow.replaceChildren(
      ...Array.from({ length }, (_, i) =>
        el('div', { class: 'pic-slot' + (i < chosen.length ? ' filled' : '') },
          chosen[i] || ''),
      ),
    );
  };
  renderDots();

  const resetBtn = el(
    'button',
    {
      class: 'btn ghost',
      style: { fontSize: '0.95rem', minHeight: '44px', padding: '8px 18px' },
      onClick: () => { chosen = []; renderDots(); },
    },
    '↺ Clear',
  );

  const grid = el(
    'div',
    { class: 'pic-grid' },
    ...icons.map((ic) =>
      el(
        'button',
        {
          class: 'pic-btn',
          onClick: () => {
            if (chosen.length >= length) return;
            chosen.push(ic);
            renderDots();
            if (chosen.length === length) {
              const code = chosen.join('');
              chosen = [];
              renderDots();
              onComplete(code);
            }
          },
        },
        ic,
      ),
    ),
  );

  return el(
    'div',
    { class: 'pic-pad' },
    dotsRow,
    grid,
    el('div', { style: { textAlign: 'center', marginTop: '10px' } }, resetBtn),
  );
}

// A little particle burst at (x,y) — used when a gem is mined.
export function burst(x, y, color = '#36F1CD', n = 14) {
  for (let i = 0; i < n; i++) {
    const p = el('div', { class: 'particle' });
    const ang = (Math.PI * 2 * i) / n + Math.random() * 0.6;
    const dist = 40 + Math.random() * 80;
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    p.style.background = color;
    p.style.setProperty('--dx', `${Math.cos(ang) * dist}px`);
    p.style.setProperty('--dy', `${Math.sin(ang) * dist}px`);
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 760);
  }
}
