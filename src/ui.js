// src/ui.js — tiny DOM toolkit + screen router for the app.
//
// No framework, no build step (HANDOFF §4). `el()` builds elements declaratively;
// `render()` swaps the active screen; `header()` is the shared gem/depth bar;
// `toast()` and `burst()` provide light feedback flourishes. UI module — never
// imported by `node --test` (those cover the pure engine).

// el('button', { class:'tile', onClick: fn }, 'text', childNode, [more, nodes])
// - on* keys become event listeners; `style`/`dataset` accept objects; falsy
//   children are skipped (so `cond && el(...)` works inline).
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
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
export function mascot(text, { name = 'Geo' } = {}) {
  return el(
    'div',
    { class: 'mascot' },
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

// Shared header: a back chevron (optional), a title (optional), and the live
// gem + cavern-depth readout. `ctx.depth()` computes depth from mastery.
export function header(ctx, { title, onBack } = {}) {
  const gems = ctx.state.gems || 0;
  const depth = ctx.depth ? ctx.depth() : 1;
  return el(
    'header',
    { class: 'app-header' },
    onBack && el('button', { class: 'btn-icon back', onClick: onBack, 'aria-label': 'Back' }, '‹'),
    title && el('div', { class: 'header-title' }, title),
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
        { class: 'stat depth', title: 'Cavern depth' },
        el('span', { class: 'icon' }, '⛏️'),
        // the word "Depth" is hidden on phones (CSS) to keep the header from clipping —
        // the ⛏️ icon + number still reads as the cavern depth there.
        el('span', {}, el('span', { class: 'depth-word' }, 'Depth '), String(depth)),
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

// A gentle "do something" pulse on a node (used by idle nudges to highlight a card
// or the primary button). No-op for a missing node.
export function pulse(node) {
  if (!node) return;
  node.classList.remove('pulse');
  void node.offsetWidth;
  node.classList.add('pulse');
  setTimeout(() => node.classList.remove('pulse'), 1600);
}

// Keep a child ENGAGED. Watches document-wide pointer/key activity; after `nudgeMs`
// of NO activity it fires `onNudge` (a gentle prompt / re-dictate). Then at `pauseMs`:
//   - if `onTimeout` is given, it calls that instead (e.g. a MENU auto-starts the game
//     — "let's go") and shows NO overlay;
//   - otherwise it shows the blocking pause overlay (`onPause` when it appears,
//     `onResume` when the child taps to resume) — for active play, so they can't zone out.
// Self-manages its listeners + overlay — call `.stop()` on leaving the screen (register
// it via ctx.onLeave). `.poke()` resets the timer. Thresholds scale by window.__idleTest.
export function createIdleGuard({ nudgeMs = 15000, pauseMs = 45000, onNudge, onPause, onResume, onTimeout } = {}) {
  const scale = (typeof window !== 'undefined' && Number(window.__idleTest)) || 1;
  nudgeMs *= scale;
  pauseMs *= scale;
  let nudgeT = 0;
  let pauseT = 0;
  let stopped = false;
  let overlay = null;
  let last = 0;

  const clearTimers = () => {
    clearTimeout(nudgeT);
    clearTimeout(pauseT);
  };
  const arm = () => {
    clearTimers();
    if (stopped || overlay) return;
    if (onNudge) nudgeT = setTimeout(() => { if (!stopped && !overlay) onNudge(); }, nudgeMs);
    pauseT = setTimeout(() => {
      if (stopped || overlay) return;
      if (onTimeout) {
        onTimeout(); // menu auto-advance ("let's go") — no blocking overlay
        return;
      }
      if (onPause) onPause();
      overlay = pauseOverlay({
        onResume: () => {
          overlay = null;
          arm();
          if (onResume) onResume();
        },
      });
    }, pauseMs);
  };
  const poke = () => {
    if (stopped || overlay) return;
    const now = typeof performance !== 'undefined' ? performance.now() : 0;
    if (now - last < 300) return; // throttle the high-frequency pointermove
    last = now;
    arm();
  };
  const onAct = () => poke();
  document.addEventListener('pointerdown', onAct, true);
  document.addEventListener('pointermove', onAct, true);
  document.addEventListener('keydown', onAct, true);
  arm();

  return {
    poke,
    pausedNow: () => !!overlay,
    stop() {
      stopped = true;
      clearTimers();
      document.removeEventListener('pointerdown', onAct, true);
      document.removeEventListener('pointermove', onAct, true);
      document.removeEventListener('keydown', onAct, true);
      if (overlay) {
        overlay.remove();
        overlay = null;
      }
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
