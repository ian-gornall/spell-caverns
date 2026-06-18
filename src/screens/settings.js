// src/screens/settings.js — the kid-friendly config (UX.md §8).
//
// Exposes the two learner levers (difficulty + session length) plus voice/volume,
// learner name, and data export/import/reset. Harder difficulties show LOCKED
// until mastery unlocks them (HANDOFF §4: unlock, never force) — tapping a locked
// one explains how to unlock it rather than doing nothing.
import { el, header, toast, applyTheme, applyReadable } from '../ui.js';
import * as audio from '../audio.js';
import * as sync from '../cloud_sync_backend.js';
import { isValidSyncCode, normalizeSyncCode } from '../engine/cloudsync.js';
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

  // easy-read text toggle (accessibility for struggling readers)
  const readableSeg = el(
    'div',
    { class: 'seg' },
    el(
      'button',
      {
        class: s.readableText ? 'on' : '',
        onClick: () => {
          s.readableText = true;
          applyReadable(true);
          apply();
          ctx.nav('settings');
        },
      },
      '🅰️ On',
    ),
    el(
      'button',
      {
        class: !s.readableText ? 'on' : '',
        onClick: () => {
          s.readableText = false;
          applyReadable(false);
          apply();
          ctx.nav('settings');
        },
      },
      'Off',
    ),
  );

  // voice picker (best-effort; may be empty before voices load) + a "test" button so a
  // parent can audition the device voices and pick the clearest one (the best lever on
  // perceived dictation quality without generating any audio clips).
  const voices = audio.listVoices();
  const voicePicker = el(
    'select',
    {
      onChange: (e) => {
        s.voiceName = e.target.value || null;
        apply();
        audio.say('Hello! Ready to spell some words?'); // preview the chosen voice
      },
    },
    el('option', { value: '' }, 'Auto (default English)'),
    ...voices.map((v) =>
      el('option', { value: v.name, selected: s.voiceName === v.name }, `${v.name} (${v.lang})`),
    ),
  );
  const testVoiceBtn = el(
    'button',
    { class: 'btn ghost', style: { marginTop: '10px' }, onClick: () => audio.say('Hello! Ready to spell some words?') },
    '🔊 Test voice',
  );

  // --- Parents & Privacy: backup / restore / delete + a plain-language data note ---
  // All data lives on THIS device. A "backup" is a file the PARENT keeps in their own
  // cloud (iCloud Drive / Google Drive via the Files app), so no server we operate ever
  // holds the child's data — the COPPA-minimizing design (see PRIVACY.md).
  const backupDays = ctx.store.lastBackupDays();
  const backupDue = ctx.store.hasProgress() && backupDays >= 7;
  const backupStatusText =
    backupDays === Infinity
      ? 'Not backed up yet.'
      : backupDays === 0
        ? 'Backed up today. ✅'
        : `Last backup: ${backupDays} day${backupDays === 1 ? '' : 's'} ago.`;

  const backupBtn = el(
    'button',
    {
      class: 'btn' + (backupDue ? ' primary' : ''),
      onClick: () => {
        const blob = new Blob([ctx.store.exportData()], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = el('a', {
          href: url,
          download: `crystal-spell-backup-${new Date().toISOString().slice(0, 10)}.json`,
        });
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        ctx.store.markBackedUp();
        toast('Backup saved! Keep it in Files → iCloud Drive. ☁️');
        ctx.nav('settings'); // refresh the "last backup" line
      },
    },
    '☁️ Back up progress',
  );

  const restoreBtn = el(
    'button',
    {
      class: 'btn',
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
                applyTheme(ctx.state.settings.themeColor);
                applyReadable(ctx.state.settings.readableText);
                toast('Progress restored! ✨');
                ctx.nav('settings');
              } catch {
                toast('That file is not a Crystal Spell Caverns backup. 😕');
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
    '📂 Restore from backup',
  );

  const deleteBtn = el(
    'button',
    {
      class: 'btn ghost',
      onClick: () => {
        if (confirm('Delete ALL progress on this device? This cannot be undone. Back up first if you want to keep it.')) {
          ctx.store.reset();
          audio.configure(ctx.state.settings);
          applyTheme(ctx.state.settings.themeColor);
          applyReadable(ctx.state.settings.readableText);
          toast('All data deleted. Fresh start! 🌟');
          ctx.nav('settings');
        }
      },
    },
    '🗑️ Delete all data',
  );

  // --- Family sync (cross-device, via a simple code — no OAuth, no accounts) -------
  // The parent creates a code once, types it on each device once; progress then syncs
  // through our serverless function. We store only pseudonymous gameplay data keyed by
  // that code (COPPA: parental consent below + data minimization + delete-from-cloud).
  const getLocal = () => JSON.parse(ctx.store.exportData());
  const applyRemote = (envel) => ctx.store.importData(JSON.stringify(envel));
  const afterPull = () => {
    audio.configure(ctx.state.settings);
    applyTheme(ctx.state.settings.themeColor);
    applyReadable(ctx.state.settings.readableText);
  };
  const doSyncNow = async () => {
    try {
      const { action } = await sync.syncNow({ code: s.syncCode, getLocal, applyRemote });
      if (action === 'pull') afterPull();
      ctx.save();
      toast(action === 'pull' ? 'Synced — pulled newer progress ✨' : 'Synced to the cloud ☁️');
      ctx.nav('settings');
    } catch {
      toast('Could not reach the sync server. Check your connection. 😕');
    }
  };
  const startSync = async (code) => {
    const norm = normalizeSyncCode(code);
    if (!isValidSyncCode(norm)) {
      toast('That code looks off — 6–12 letters/numbers.');
      return;
    }
    if (!s.syncConsent) {
      toast('Please tick the parent consent box first.');
      return;
    }
    s.syncCode = norm;
    ctx.save();
    await doSyncNow();
  };

  let consent = !!s.syncConsent;
  const consentRow = el(
    'label',
    { class: 'consent-row' },
    el('input', {
      type: 'checkbox',
      checked: s.syncConsent ? 'checked' : undefined,
      onChange: (e) => {
        consent = e.target.checked;
        s.syncConsent = consent;
        ctx.save();
      },
    }),
    el(
      'span',
      {},
      "I'm this child's parent/guardian and I agree to store their game progress in the " +
        'cloud to sync across devices (a nickname + scores only — no real name or email). ' +
        'See PRIVACY.md.',
    ),
  );
  const codeEntry = el('input', {
    type: 'text',
    placeholder: 'Enter a family code',
    spellcheck: 'false',
    autocapitalize: 'characters',
    style: { textTransform: 'uppercase' },
  });

  const cloudSyncBlock = el(
    'div',
    { class: 'cloud-sync' },
    el('h4', { class: 'cloud-title' }, '🔗 Family sync (across devices)'),
    s.syncCode
      ? el(
          'div',
          { class: 'data-actions' },
          el('p', { class: 'backup-status' }, 'Family code:'),
          el('div', { class: 'sync-code' }, s.syncCode),
          el('p', { class: 'field-hint' }, 'Type this same code on each device to sync them.'),
          el('button', { class: 'btn primary', onClick: doSyncNow }, '🔄 Sync now'),
          el(
            'button',
            {
              class: 'btn ghost',
              onClick: () => {
                s.syncCode = null;
                ctx.save();
                toast('Sync turned off on this device.');
                ctx.nav('settings');
              },
            },
            'Stop syncing on this device',
          ),
          el(
            'button',
            {
              class: 'btn ghost',
              onClick: async () => {
                if (!confirm('Delete the family progress stored in the cloud? Devices keep their local copy.')) return;
                try {
                  await sync.remove(s.syncCode);
                  toast('Cloud data deleted.');
                } catch {
                  toast('Could not reach the sync server. 😕');
                }
              },
            },
            '🗑️ Delete cloud data',
          ),
        )
      : el(
          'div',
          { class: 'field' },
          consentRow,
          el(
            'div',
            { class: 'sync-setup' },
            el(
              'button',
              { class: 'btn primary', onClick: () => startSync(sync.generateSyncCode()) },
              '✨ Create a family code',
            ),
            el('p', { class: 'field-hint' }, '…or enter one from another device:'),
            codeEntry,
            el('button', { class: 'btn', onClick: () => startSync(codeEntry.value) }, 'Use this code'),
          ),
          el(
            'p',
            { class: 'field-hint' },
            'No accounts, no OAuth — just a short code. Setup details in CLOUD_SYNC_SETUP.md.',
          ),
        ),
  );

  const dataPanel = el(
    'div',
    { class: 'data-actions' },
    el('p', { class: 'backup-status' + (backupDue ? ' due' : '') }, backupStatusText),
    backupBtn,
    restoreBtn,
    deleteBtn,
    el(
      'p',
      { class: 'privacy-note' },
      'Everything stays on this device — nothing is sent to us or anyone else. ' +
        'The “explorer name” is just a nickname (no real names needed). ' +
        'Back up to keep a copy in your own iCloud/Drive or move progress to another iPad; ' +
        'delete any time. See PRIVACY.md for details.',
    ),
    cloudSyncBlock,
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
        el('div', { class: 'field' }, el('label', {}, 'Voice choice'), voicePicker, testVoiceBtn),
      ),
      el(
        'div',
        { class: 'panel' },
        el('h3', {}, 'You'),
        el(
          'div',
          { class: 'field' },
          el('label', {}, 'Your explorer name'),
          nameInput,
          el('p', { class: 'field-hint' }, 'A nickname is perfect — no real name needed.'),
        ),
        el('div', { class: 'field' }, el('label', {}, 'Crystal colour'), colourRow),
        el('div', { class: 'field' }, el('label', {}, 'Easy-read text'), readableSeg),
      ),
      el(
        'div',
        { class: 'panel' },
        el('h3', {}, 'Parents & privacy'),
        dataPanel,
      ),
    ),
  );
}
