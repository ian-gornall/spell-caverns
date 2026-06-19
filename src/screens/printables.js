// src/screens/printables.js — OFFLINE practice-sheet printer (§28.C).
//
// A grown-up-initiated view (reached from Settings) that turns the app's word data into
// paper. Pick WHAT to print (the learner's current target words, a spelling pattern, or
// an age level) and a FORMAT (a plain word list, or a look-cover-write-check grid), then
// tap Print — the browser's print dialog saves a PDF or sends it to a printer. The word
// selection is pure engine (engine/printables.js, unit-tested); this file is just the UI.
// The @media print stylesheet (styles.css) hides all the app chrome so only the sheet
// prints, black-on-white, big type.
import { el, header, toast } from '../ui.js';
import {
  SOURCES,
  FORMATS,
  tierChoices,
  patternChoices,
  resolveWords,
  sheetTitle,
} from '../engine/printables.js';

export function printablesScreen(ctx) {
  const tracker = ctx.state && ctx.state.tracker;
  const learner = (ctx.state && ctx.state.profile && ctx.state.profile.name) || '';

  // Live selection. Default to the learner's own target words (the most useful sheet).
  const spec = { source: 'targets', value: null };
  let format = 'list';

  // Sub-picker (pattern/tier) + the printable preview both re-render on any change.
  const subWrap = el('div', { class: 'print-sub' });
  const sheet = el('div', { class: 'printable-sheet' });

  // The friendly label of the currently chosen pattern/tier (for the sheet title).
  const choiceLabelFor = () => {
    if (spec.source === 'pattern') {
      const c = patternChoices().find((p) => p.id === spec.value);
      return c ? c.label : '';
    }
    if (spec.source === 'tier') {
      const c = tierChoices().find((t) => String(t.id) === String(spec.value));
      return c ? c.label : '';
    }
    return '';
  };

  // Build the printable sheet from the resolved words + chosen format.
  const renderSheet = () => {
    const words = resolveWords(spec, { tracker });
    const title = sheetTitle(spec, choiceLabelFor());

    const head = el(
      'div',
      { class: 'sheet-head' },
      el('h2', { class: 'sheet-title' }, title),
      el(
        'div',
        { class: 'sheet-meta' },
        el('span', {}, learner ? `Name: ${learner}` : 'Name: ____________'),
        el('span', {}, 'Date: ____________'),
      ),
    );

    if (!words.length) {
      sheet.replaceChildren(
        head,
        el(
          'p',
          { class: 'sheet-empty' },
          spec.source === 'targets'
            ? 'No practice words yet — play a few crafting rounds first, then come back!'
            : 'No words to show. Pick another option above.',
        ),
      );
      return;
    }

    let bodyEl;
    if (format === 'grid') {
      // Look · cover · write · check: the word once, then three blanks to write from memory.
      const rows = words.map((w, i) =>
        el(
          'tr',
          {},
          el('td', { class: 'lcwc-n' }, String(i + 1)),
          el('td', { class: 'lcwc-word' }, w),
          el('td', { class: 'lcwc-blank' }, ''),
          el('td', { class: 'lcwc-blank' }, ''),
          el('td', { class: 'lcwc-blank' }, ''),
        ),
      );
      bodyEl = el(
        'table',
        { class: 'lcwc' },
        el(
          'thead',
          {},
          el(
            'tr',
            {},
            el('th', { class: 'lcwc-n' }, '#'),
            el('th', { class: 'lcwc-word' }, 'Look & cover'),
            el('th', {}, 'Write it'),
            el('th', {}, 'Write it'),
            el('th', {}, 'Write it'),
          ),
        ),
        el('tbody', {}, ...rows),
      );
    } else {
      // Plain word list — big numbered type, two columns on paper.
      bodyEl = el(
        'ol',
        { class: 'word-list' },
        ...words.map((w) => el('li', {}, w)),
      );
    }

    sheet.replaceChildren(head, bodyEl);
  };

  // The pattern/tier dropdown — only shown for those sources.
  const renderSub = () => {
    if (spec.source === 'targets') {
      spec.value = null;
      subWrap.replaceChildren();
      return;
    }
    const choices = spec.source === 'pattern' ? patternChoices() : tierChoices();
    if (spec.value == null && choices.length) spec.value = choices[0].id;
    const select = el(
      'select',
      {
        class: 'print-select',
        onChange: (e) => {
          spec.value = e.target.value;
          renderSheet();
        },
      },
      ...choices.map((c) =>
        el('option', { value: String(c.id), selected: String(c.id) === String(spec.value) }, `${c.label} (${c.count})`),
      ),
    );
    subWrap.replaceChildren(el('label', { class: 'print-sub-label' }, 'Which one?'), select);
  };

  // Segmented button row helper (source + format pickers) — reuses the app's .seg/.on style.
  const segRow = (items, getActive, onPick) => {
    const row = el('div', { class: 'seg print-seg' });
    const paint = () => {
      [...row.children].forEach((btn, i) => {
        btn.className = items[i].id === getActive() ? 'on' : '';
      });
    };
    items.forEach((it) => {
      row.appendChild(
        el(
          'button',
          {
            onClick: () => {
              onPick(it.id);
              paint();
            },
          },
          it.label,
        ),
      );
    });
    paint();
    return row;
  };

  const sourceSeg = segRow(SOURCES, () => spec.source, (id) => {
    spec.source = id;
    spec.value = null;
    renderSub();
    renderSheet();
  });

  const formatSeg = segRow(FORMATS, () => format, (id) => {
    format = id;
    renderSheet();
  });

  const printBtn = el(
    'button',
    {
      class: 'btn primary',
      onClick: () => {
        const words = resolveWords(spec, { tracker });
        if (!words.length) {
          toast('Nothing to print yet ✨');
          return;
        }
        window.print();
      },
    },
    '🖨️ Print this sheet',
  );

  const controls = el(
    'div',
    { class: 'print-controls no-print' },
    el(
      'div',
      { class: 'field' },
      el('label', {}, 'What to practise'),
      sourceSeg,
      subWrap,
    ),
    el('div', { class: 'field' }, el('label', {}, 'Sheet style'), formatSeg),
    el('p', { class: 'field-hint' }, 'Tap Print, then choose a printer or “Save as PDF”. Great for car trips and screen-free practice.'),
    printBtn,
  );

  renderSub();
  renderSheet();

  return el(
    'div',
    { class: 'screen printables' },
    el('div', { class: 'no-print' }, header(ctx, { title: 'Practice sheets', onBack: () => ctx.nav('settings') })),
    el('div', { class: 'scroll print-scroll' }, controls, sheet),
  );
}
