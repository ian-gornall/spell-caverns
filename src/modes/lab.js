// src/modes/lab.js — the CRYSTAL LAB: the creativity surface (requirement #7;
// HANDOFF §8). The "main purpose stays real-word spelling," so this is the spice:
//
//   invent  -> the lab conjures a brand-new NONSENSE word that embodies a spelling
//              pattern the learner has been practising (engine/nonsense.js). The
//              pattern is never named (requirement #3) — it's just "a new crystal".
//   spell   -> hear it + UNSCRAMBLE its letters into slots (implicit pattern
//              reinforcement). Forgiving: keep the letters that fit, 💡 reveals one.
//   draw    -> draw the crystal's made-up MEANING on a <canvas> (the missing
//              creativity element) with a small crystal-colour palette.
//   name    -> name the specimen; it's saved to the Specimen Collection (shown in
//              Progress) with its drawing. Earns a gem bonus — never the tracker
//              (nonsense words aren't real words, so they must not touch mastery).
//
// UI module — verified with Playwright, never imported by `node --test`.
import { el, header, burst } from '../ui.js';
import { mulberry32 } from '../engine/distractors.js';
import { makeNonsenseWord, NONSENSE_PATTERNS } from '../engine/nonsense.js';
import { scrambleTray, gradeBuild } from '../engine/puzzle.js';
import { getWord, REAL_WORDS } from '../engine/lexicon.js';

// Gems for crafting a whole specimen (positive reinforcement; mastery is untouched).
const SPECIMEN_GEMS = 15;
// Friendly cold-start patterns when the learner hasn't practised enough yet.
const SEED_PATTERNS = ['silent-e-a', 'ee-ea', 'ight', 'short-a', 'oo', 'ai-ay'].filter((p) =>
  NONSENSE_PATTERNS.includes(p),
);
// Crystal-themed drawing palette (+ an eraser that paints the canvas background).
const CANVAS_BG = '#0b1233';
const PALETTE = ['#36F1CD', '#FFD23F', '#7AE582', '#9D8DF1', '#FF7EB6', '#EAF0FF'];

// Patterns the learner has actually practised (most-practised first), limited to
// those the nonsense generator supports. Falls back to friendly seeds when sparse.
function candidatePatterns(tracker) {
  const counts = new Map();
  for (const rec of tracker.records.values()) {
    const w = getWord(rec.word);
    if (w && NONSENSE_PATTERNS.includes(w.pattern)) {
      counts.set(w.pattern, (counts.get(w.pattern) || 0) + 1);
    }
  }
  const practised = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([p]) => p);
  // always keep a few seeds at the end so generation can't dead-end
  return [...practised, ...SEED_PATTERNS.filter((p) => !practised.includes(p))];
}

export function startLab(ctx) {
  const { state, audio } = ctx;
  const seed = (Date.now() >>> 0) || 1;
  const rng = mulberry32(seed);

  const hdr = header(ctx, { title: 'Crystal Lab', onBack: () => ctx.nav('home') });
  const gemCountEl = hdr.querySelector('.gem-count');
  const body = el('div', { class: 'lab-body scroll' });
  const screen = el('div', { class: 'screen lab' }, hdr, body);

  // current specimen-in-progress
  let word = '';
  let imageData = null; // PNG dataURL of the drawing (or null)

  function setHook(step) {
    try {
      window.__labCurrent = { step, word, specimens: state.specimens.length };
    } catch {
      /* ignore */
    }
  }

  function bumpGems() {
    if (!gemCountEl) return;
    gemCountEl.textContent = String(state.gems || 0);
    gemCountEl.classList.remove('bump');
    void gemCountEl.offsetWidth;
    gemCountEl.classList.add('bump');
  }

  // ---- step: invent --------------------------------------------------------
  function invent() {
    const avoid = new Set(state.specimens.map((s) => s.word));
    word = '';
    for (const p of candidatePatterns(state.tracker)) {
      const w = makeNonsenseWord(p, { realWords: REAL_WORDS, rng, avoid });
      if (w) {
        word = w;
        break;
      }
    }
    if (!word) word = makeNonsenseWord('short-a', { realWords: REAL_WORDS, rng }) || 'zib';
    imageData = null;
    setHook('invent');

    body.replaceChildren(
      el(
        'div',
        { class: 'lab-stage' },
        el('div', { class: 'lab-emoji' }, '🔮'),
        el('h2', { class: 'lab-title' }, 'A brand-new crystal!'),
        el('p', { class: 'lab-lead' }, 'Listen to its made-up name, then build it from the glowing letters.'),
        el(
          'button',
          { class: 'hear-again big', onClick: () => audio.say(word) },
          el('span', { class: 'spk' }, '🔊'),
          'Hear the name',
        ),
        el('button', { class: 'btn primary lab-go', onClick: spell }, "Let's build it! ✨"),
      ),
    );
    // say it once on arrival (nav() stopped any prior speech first)
    audio.say(word);
  }

  // ---- step: spell (unscramble the nonsense word) --------------------------
  function spell() {
    setHook('spell');
    const target = word;
    const letters = scrambleTray(target, { extra: 0, rng });
    const tiles = letters.map((c, i) => ({ id: i, letter: c, used: false }));
    let slots = Array.from({ length: target.length }, () => null);
    let locked = false;

    const slotsEl = el('div', { class: 'slots' });
    const trayEl = el('div', { class: 'tray' });
    const verdictEl = el('div', { class: 'verdict' });

    const render = () => {
      slotsEl.replaceChildren(
        ...slots.map((s, i) =>
          el(
            'button',
            {
              class: 'slot' + (s ? ' filled' : '') + (s && s.locked ? ' locked' : ''),
              onClick: () => {
                if (locked || !s || s.locked) return;
                const t = tiles.find((x) => x.id === s.tileId);
                if (t) t.used = false;
                slots[i] = null;
                render();
              },
            },
            s ? s.letter : '',
          ),
        ),
      );
      trayEl.replaceChildren(
        ...tiles.map((t) =>
          el(
            'button',
            {
              class: 'tray-tile' + (t.used ? ' used' : ''),
              dataset: { letter: t.letter },
              onClick: () => place(t.id),
            },
            t.letter,
          ),
        ),
      );
    };

    const place = (tileId) => {
      if (locked) return;
      const t = tiles.find((x) => x.id === tileId && !x.used);
      if (!t) return;
      const i = slots.findIndex((s) => s == null); // tap fills the first empty slot
      if (i < 0) return;
      t.used = true;
      slots[i] = { tileId: t.id, letter: t.letter, locked: false };
      audio.sfx('tap');
      render();
      check();
    };

    const check = () => {
      const g = gradeBuild(target, slots.map((s) => (s ? s.letter : null)));
      if (!g.complete) return;
      if (g.correct) {
        locked = true;
        slots.forEach((s) => s && (s.locked = true));
        render();
        audio.sfx('combo');
        verdictEl.textContent = 'Crystal formed! 💎';
        verdictEl.style.color = 'var(--cyan)';
        verdictEl.classList.add('flash');
        const r = slotsEl.getBoundingClientRect();
        burst(r.left + r.width / 2, r.top + r.height / 2, '#36F1CD', 18);
        setTimeout(draw, 950);
      } else {
        audio.sfx('miss');
        verdictEl.textContent = 'Almost — keep the letters that fit!';
        verdictEl.style.color = 'var(--slate)';
        slots.forEach((s, i) => {
          if (!s) return;
          if (g.perPosition[i]) s.locked = true;
          else {
            const t = tiles.find((x) => x.id === s.tileId);
            if (t) t.used = false;
            slots[i] = null;
          }
        });
        render();
        slotsEl.classList.remove('shake');
        void slotsEl.offsetWidth;
        slotsEl.classList.add('shake');
      }
    };

    const hint = () => {
      if (locked) return;
      const g = gradeBuild(target, slots.map((s) => (s ? s.letter : null)));
      const i = g.perPosition.findIndex((p) => p !== true);
      if (i < 0) return;
      if (slots[i]) {
        const old = tiles.find((x) => x.id === slots[i].tileId);
        if (old) old.used = false;
        slots[i] = null;
      }
      const t = tiles.find((x) => !x.used && x.letter === target[i]);
      if (t) {
        t.used = true;
        slots[i] = { tileId: t.id, letter: target[i], locked: true };
      }
      audio.sfx('gem');
      render();
      check();
    };

    render();
    body.replaceChildren(
      el(
        'div',
        { class: 'lab-stage' },
        el('h2', { class: 'lab-title' }, 'Spell the crystal'),
        el(
          'button',
          { class: 'hear-again', onClick: () => audio.say(target) },
          el('span', { class: 'spk' }, '🔊'),
          'Hear it again',
        ),
        slotsEl,
        verdictEl,
        el(
          'div',
          { class: 'puzzle-controls' },
          el('button', { class: 'btn ghost', onClick: hint }, '💡 Hint'),
        ),
        trayEl,
      ),
    );
  }

  // ---- step: draw the meaning ---------------------------------------------
  function draw() {
    setHook('draw');
    const size = Math.max(220, Math.min((window.innerWidth || 420) - 40, 440));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const canvas = el('canvas', {
      class: 'lab-canvas',
      width: Math.round(size * dpr),
      height: Math.round(size * dpr),
      style: { width: `${size}px`, height: `${size}px` },
    });
    const g = canvas.getContext('2d');
    g.scale(dpr, dpr);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    const clear = () => {
      g.fillStyle = CANVAS_BG;
      g.fillRect(0, 0, size, size);
    };
    clear();

    let color = PALETTE[0];
    let brush = 9;
    let drawing = false;
    let last = null;
    const pos = (e) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const dot = (p) => {
      g.fillStyle = color;
      g.beginPath();
      g.arc(p.x, p.y, brush / 2, 0, Math.PI * 2);
      g.fill();
    };
    canvas.addEventListener('pointerdown', (e) => {
      drawing = true;
      last = pos(e);
      dot(last);
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drawing) return;
      const p = pos(e);
      g.strokeStyle = color;
      g.lineWidth = brush;
      g.beginPath();
      g.moveTo(last.x, last.y);
      g.lineTo(p.x, p.y);
      g.stroke();
      last = p;
    });
    const endStroke = () => {
      drawing = false;
    };
    canvas.addEventListener('pointerup', endStroke);
    canvas.addEventListener('pointercancel', endStroke);
    canvas.addEventListener('pointerleave', endStroke);

    const swatches = PALETTE.map((c) =>
      el('button', {
        class: 'swatch' + (c === color ? ' on' : ''),
        style: { background: c },
        'aria-label': 'colour',
        onClick: (e) => {
          color = c;
          brush = 9;
          [...e.currentTarget.parentNode.children].forEach((n) => n.classList.remove('on'));
          e.currentTarget.classList.add('on');
        },
      }),
    );
    const eraser = el(
      'button',
      {
        class: 'btn ghost',
        onClick: () => {
          color = CANVAS_BG;
          brush = 26;
          swatches.forEach((n) => n.classList.remove('on'));
        },
      },
      '🧽 Erase',
    );

    body.replaceChildren(
      el(
        'div',
        { class: 'lab-stage' },
        el('h2', { class: 'lab-title' }, `What does "${word}" look like?`),
        el('p', { class: 'lab-lead' }, 'Draw its made-up meaning!'),
        canvas,
        el('div', { class: 'palette' }, ...swatches, eraser, el('button', { class: 'btn ghost', onClick: clear }, '↺ Clear')),
        el(
          'button',
          {
            class: 'btn primary lab-go',
            onClick: () => {
              // downscale the drawing to keep localStorage small
              try {
                const off = document.createElement('canvas');
                off.width = 220;
                off.height = 220;
                off.getContext('2d').drawImage(canvas, 0, 0, 220, 220);
                imageData = off.toDataURL('image/png');
              } catch {
                imageData = null;
              }
              name();
            },
          },
          'Name it ✏️',
        ),
      ),
    );
  }

  // ---- step: name + save ---------------------------------------------------
  function name() {
    setHook('name');
    const suggestion = word.charAt(0).toUpperCase() + word.slice(1);
    const input = el('input', {
      type: 'text',
      class: 'lab-name',
      value: suggestion,
      maxLength: 24,
      placeholder: 'Name your crystal',
    });
    const save = () => {
      const specimenName = (input.value || suggestion).trim().slice(0, 24) || suggestion;
      ctx.store.addSpecimen({ word, name: specimenName, image: imageData });
      ctx.store.addGems(SPECIMEN_GEMS);
      ctx.save();
      bumpGems();
      audio.sfx('combo');
      saved(specimenName);
    };

    body.replaceChildren(
      el(
        'div',
        { class: 'lab-stage' },
        el('h2', { class: 'lab-title' }, 'Name your crystal'),
        imageData && el('img', { class: 'lab-preview', src: imageData, alt: 'your drawing' }),
        el('div', { class: 'lab-word' }, `🔮 sounds like “${word}”`),
        input,
        el('button', { class: 'btn primary lab-go', onClick: save }, `Save specimen 💎 +${SPECIMEN_GEMS}`),
      ),
    );
    try {
      input.focus();
      input.select();
    } catch {
      /* ignore */
    }
  }

  // ---- step: saved confirmation -------------------------------------------
  function saved(specimenName) {
    setHook('saved');
    body.replaceChildren(
      el(
        'div',
        { class: 'lab-stage lab-saved' },
        el('div', { class: 'lab-emoji' }, '✨'),
        el('h2', { class: 'lab-title' }, 'Specimen catalogued!'),
        imageData && el('img', { class: 'lab-preview', src: imageData, alt: specimenName }),
        el('div', { class: 'lab-word' }, specimenName),
        el('div', { class: 'earned' }, `+${SPECIMEN_GEMS} gems · ${state.specimens.length} in your collection`),
        el(
          'div',
          { class: 'row' },
          el('button', { class: 'btn primary', onClick: invent }, '🔮 Invent another'),
          el('button', { class: 'btn', onClick: () => ctx.nav('progress') }, '🗺️ My collection'),
          el('button', { class: 'btn', onClick: () => ctx.nav('home') }, '🏠 Home'),
        ),
      ),
    );
  }

  invent();
  return screen;
}
