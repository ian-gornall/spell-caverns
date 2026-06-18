// src/screens/settings.js — the kid-friendly config (UX.md §8).
//
// Exposes the two learner levers (difficulty + session length) plus voice/volume,
// learner name, and data export/import/reset. Harder difficulties show LOCKED
// until mastery unlocks them (HANDOFF §4: unlock, never force) — tapping a locked
// one explains how to unlock it rather than doing nothing.
import { el, header, toast, applyTheme } from '../ui.js';
import * as audio from '../audio.js';
import { unlockedDifficulties, UNLOCK_THRESHOLDS } from '../engine/session.js';
import { summary } from '../engine/progress.js';
import { COLOURS } from './onboarding.js';

const LENGTHS = [6, 10, 15, 20];

export function settingsScreen(ctx) {
  const s = ctx.state.settings;
  const unlocked = unlockedDifficulties(ctx.state.tracker);
  const knownCount = summary(ctx.state.tracker).counts.known;

  const apply = () => {
    audio.configure(s);
    ctx.save();
  };

  // difficulty segmented control (locked options explain themselves)
  const diffSeg = el(
    'div',
    { class: 'seg' },
    ...['easy', 'medium', 'hard'].map((d) => {
      const isUnlocked = unlocked.includes(d);
      const btn = el(
        'button',
        {
          class:
            (s.difficulty === d ? 'on ' : '') + (isUnlocked ? '' : 'locked'),
          onClick: () => {
            if (!isUnlocked) {
              toast(`Master ${UNLOCK_THRESHOLDS[d] - knownCount} more word(s) to unlock ${d}! 🔒`);
              return;
            }
            s.difficulty = d;
            apply();
            ctx.nav('settings'); // re-render to update selection
          },
        },
        (isUnlocked ? '' : '🔒 ') + d[0].toUpperCase() + d.slice(1),
      );
      return btn;
    }),
  );

  // session length
  const lenSeg = el(
    'div',
    { class: 'seg' },
    ...LENGTHS.map((n) =>
      el(
        'button',
        {
          class: s.length === n ? 'on' : '',
          onClick: () => {
            s.length = n;
            apply();
            ctx.nav('settings');
          },
        },
        String(n),
      ),
    ),
  );

  // option count 3/4
  const optSeg = el(
    'div',
    { class: 'seg' },
    ...[3, 4].map((n) =>
      el(
        'button',
        {
          class: s.optionCount === n ? 'on' : '',
          onClick: () => {
            s.optionCount = n;
            apply();
            ctx.nav('settings');
          },
        },
        `${n} choices`,
      ),
    ),
  );

  // voice toggle
  const voiceSeg = el(
    'div',
    { class: 'seg' },
    el(
      'button',
      {
        class: s.voice ? 'on' : '',
        onClick: () => {
          s.voice = true;
          apply();
          ctx.nav('settings');
        },
      },
      '🔊 On',
    ),
    el(
      'button',
      {
        class: !s.voice ? 'on' : '',
        onClick: () => {
          s.voice = false;
          apply();
          ctx.nav('settings');
        },
      },
      '🔇 Off',
    ),
  );

  // volume slider
  const vol = el('input', {
    type: 'range',
    min: '0',
    max: '1',
    step: '0.05',
    value: String(s.volume),
    onInput: (e) => {
      s.volume = parseFloat(e.target.value);
      audio.configure(s);
    },
    onChange: apply,
  });

  // learner name
  const nameInput = el('input', {
    type: 'text',
    value: ctx.state.profile.name || '',
    placeholder: 'Explorer',
    maxLength: '20',
    onChange: (e) => {
      ctx.state.profile.name = e.target.value.trim() || 'Explorer';
      ctx.save();
    },
  });

  // crystal colour (sets themeColor -> --accent; applied live)
  const colourRow = el(
    'div',
    { class: 'colour-grid', style: { justifyContent: 'flex-start' } },
    ...COLOURS.map((c) =>
      el(
        'button',
        {
          class: 'colour-swatch small' + (s.themeColor === c.value ? ' on' : ''),
          style: { background: c.value },
          'aria-label': c.name,
          onClick: (e) => {
            s.themeColor = c.value;
            applyTheme(c.value);
            apply();
            [...e.currentTarget.parentNode.children].forEach((n) => n.classList.remove('on'));
            e.currentTarget.classList.add('on');
          },
        },
      ),
    ),
  );

  // voice picker (best-effort; may be empty before voices load)
  const voices = audio.listVoices();
  const voicePicker = el(
    'select',
    {
      onChange: (e) => {
        s.voiceName = e.target.value || null;
        apply();
      },
    },
    el('option', { value: '' }, 'Auto (default English)'),
    ...voices.map((v) =>
      el('option', { value: v.name, selected: s.voiceName === v.name }, `${v.name} (${v.lang})`),
    ),
  );

  // export / import / reset
  const dataRow = el(
    'div',
    { class: 'seg' },
    el(
      'button',
      {
        onClick: () => {
          const blob = new Blob([ctx.store.exportData()], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = el('a', {
            href: url,
            download: `crystal-spell-${new Date().toISOString().slice(0, 10)}.json`,
          });
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
          toast('Saved your data file! 💾');
        },
      },
      '💾 Export',
    ),
    el(
      'button',
      {
        onClick: () => {
          const inp = el('input', {
            type: 'file',
            accept: 'application/json',
            style: { display: 'none' },
            onChange: (e) => {
              const file = e.target.files[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                try {
                  ctx.store.importData(reader.result);
                  audio.configure(ctx.state.settings);
                  toast('Data loaded! ✨');
                  ctx.nav('settings');
                } catch {
                  toast('That file did not load. 😕');
                }
              };
              reader.readAsText(file);
            },
          });
          document.body.appendChild(inp);
          inp.click();
          inp.remove();
        },
      },
      '📂 Import',
    ),
    el(
      'button',
      {
        onClick: () => {
          if (confirm('Start over? This erases gems and progress on this device.')) {
            ctx.store.reset();
            audio.configure(ctx.state.settings);
            toast('Fresh start! 🌟');
            ctx.nav('settings');
          }
        },
      },
      '🗑️ Reset',
    ),
  );

  return el(
    'div',
    { class: 'screen' },
    header(ctx, { title: 'Settings', onBack: () => ctx.nav('home') }),
    el(
      'div',
      { class: 'scroll' },
      el(
        'div',
        { class: 'panel' },
        el('h3', {}, 'Adventure'),
        el('div', { class: 'field' }, el('label', {}, 'Difficulty'), diffSeg),
        el('div', { class: 'field' }, el('label', {}, 'Words per dig'), lenSeg),
        el('div', { class: 'field' }, el('label', {}, 'Answer choices'), optSeg),
      ),
      el(
        'div',
        { class: 'panel' },
        el('h3', {}, 'Sound'),
        el('div', { class: 'field' }, el('label', {}, 'Spoken voice'), voiceSeg),
        el('div', { class: 'field' }, el('label', {}, 'Volume'), vol),
        el('div', { class: 'field' }, el('label', {}, 'Voice choice'), voicePicker),
      ),
      el(
        'div',
        { class: 'panel' },
        el('h3', {}, 'You'),
        el('div', { class: 'field' }, el('label', {}, 'Your explorer name'), nameInput),
        el('div', { class: 'field' }, el('label', {}, 'Crystal colour'), colourRow),
      ),
      el(
        'div',
        { class: 'panel' },
        el('h3', {}, 'Your data'),
        dataRow,
      ),
    ),
  );
}
