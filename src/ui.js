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
        el('span', {}, 'Depth ' + depth),
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
