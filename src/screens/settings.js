// src/screens/settings.js — the kid-friendly config (UX.md §8).
//
// Exposes the two learner levers (difficulty + session length) plus voice/volume,
// learner name, and data export/import/reset. Harder difficulties show LOCKED
// until mastery unlocks them (HANDOFF §4: unlock, never force) — tapping a locked
// one explains how to unlock it rather than doing nothing.
import { el, header, toast, applyTheme, applyReadable } from '../ui.js';
import * as audio from '../audio.js';
import * as sync from '../cloud_sync_backend.js';
import { normalizeSyncCode, isValidSyncCode } from '../engine/cloudsync.js';
import { unlockedDifficulties, UNLOCK_THRESHOLDS } from '../engine/session.js';
import { summary } from '../engine/progress.js';
import { COLOURS, levelGrid, LEVELS } from './onboarding.js';

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

  // starting level (per-profile) — re-aim where the engine introduces NEW words at any
  // time (§21-B). Writes state.startLevel; the next session reflects it. Reuses the same
  // level cards as onboarding. (This sets the FLOOR for new material; the game still
  // adapts up/down and surfaces craft-missed words for repair.)
  const curLevel = ctx.state.startLevel || 1;
  const curLevelLabel = (LEVELS.find((l) => l.tier === curLevel) || {}).label || `Tier ${curLevel}`;
  const levelGridEl = levelGrid(curLevel, (tier) => {
    ctx.state.startLevel = tier;
    ctx.save();
    const lbl = (LEVELS.find((l) => l.tier === tier) || {}).label || `Tier ${tier}`;
    toast(`New words now start around “${lbl}”. ⛏️`);
  });

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

  // voice speed (dictation rate) — default a little slow for a weak speller; tappable
  // presets that PREVIEW the new speed so a grown-up can pick what's clearest.
  const RATES = [
    { label: '🐢 Slow', v: 0.7 },
    { label: 'Normal', v: 0.85 },
    { label: '🐇 Fast', v: 1.0 },
  ];
  const curRate = s.voiceRate ?? 0.85;
  const rateSeg = el(
    'div',
    { class: 'seg' },
    ...RATES.map((r) =>
      el(
        'button',
        {
          class: Math.abs(curRate - r.v) < 0.001 ? 'on' : '',
          onClick: (e) => {
            s.voiceRate = r.v;
            apply();
            [...e.currentTarget.parentNode.children].forEach((n) => n.classList.remove('on'));
            e.currentTarget.classList.add('on');
            audio.say('Spell the word you hear.'); // preview at the new speed
          },
        },
        r.label,
      ),
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

  // --- Family sync (cross-device) — a GROWN-UP sets one family password ------------
  // The device saves it locally so the child never types it. Entering the SAME password
  // on another tablet auto-joins the family's progress (the server merges). We store only
  // pseudonymous gameplay data keyed by the code (COPPA: consent + minimize + delete).
  const getLocal = () => JSON.parse(ctx.store.exportData());
  const applyRemote = (envel) => ctx.store.importData(JSON.stringify(envel));
  const afterPull = () => {
    audio.configure(ctx.state.settings);
    applyTheme(ctx.state.settings.themeColor);
    applyReadable(ctx.state.settings.readableText);
  };
  const doSyncNow = async () => {
    try {
      const { action } = await sync.syncNow({ code: ctx.store.syncCode(), getLocal, applyRemote });
      if (action === 'pull') afterPull();
      ctx.save();
      toast(action === 'pull' ? 'Synced — pulled newer progress ✨' : 'Synced to the cloud ☁️');
      ctx.nav('settings');
    } catch {
      toast('Could not reach the sync server. Check your connection. 😕');
    }
  };
  const enableSync = async (raw) => {
    const code = normalizeSyncCode(raw);
    if (!isValidSyncCode(code)) {
      toast('Use at least 4 letters or numbers.');
      return;
    }
    ctx.store.setSyncCode(code);
    ctx.store.setSyncConsent(true);
    try {
      const { action } = await sync.syncNow({ code, getLocal, applyRemote });
      if (action === 'pull') afterPull();
    } catch {
      /* offline — saved locally, syncs later */
    }
    toast('Sync on — use the same password on your other tablets ☁️');
    ctx.nav('settings');
  };

  let cloudSyncBlock;
  if (ctx.store.syncCode()) {
    cloudSyncBlock = el(
      'div',
      { class: 'cloud-sync' },
      el('h4', { class: 'cloud-title' }, '🔗 Family sync (across devices)'),
      el('p', { class: 'backup-status' }, 'Family password:'),
      el('div', { class: 'sync-code' }, ctx.store.syncCode()),
      el('p', { class: 'field-hint' }, 'Type this same password on your other tablets to sync them.'),
      el(
        'div',
        { class: 'data-actions' },
        el('button', { class: 'btn primary', onClick: doSyncNow }, '🔄 Sync now'),
        el(
          'button',
          {
            class: 'btn ghost',
            onClick: () => {
              ctx.store.setSyncCode(null);
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
                await sync.remove(ctx.store.syncCode());
                toast('Cloud data deleted.');
              } catch {
                toast('Could not reach the sync server. 😕');
              }
            },
          },
          '🗑️ Delete cloud data',
        ),
      ),
    );
  } else {
    // Not syncing yet: consent (parent-gated) → type a family password → turn on.
    const codeInput = el('input', {
      type: 'text',
      placeholder: 'Family password',
      maxLength: 40,
      autocapitalize: 'none',
      autocomplete: 'off',
      disabled: 'disabled',
    });
    const goBtn = el('button', { class: 'btn primary', disabled: 'disabled', onClick: () => enableSync(codeInput.value) }, '☁️ Turn on sync');
    codeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !goBtn.hasAttribute('disabled')) enableSync(codeInput.value); });
    const consentRow = el(
      'label',
      { class: 'consent-row' },
      el('input', {
        type: 'checkbox',
        onChange: (e) => {
          const on = e.target.checked;
          ctx.store.setSyncConsent(on);
          for (const n of [codeInput, goBtn]) on ? n.removeAttribute('disabled') : n.setAttribute('disabled', 'disabled');
        },
      }),
      el(
        'span',
        {},
        "Grown-up: I'm this child's parent/guardian and I agree to store their progress " +
          '(a nickname + scores only) in the cloud to sync across devices. See PRIVACY.md.',
      ),
    );
    cloudSyncBlock = el(
      'div',
      { class: 'cloud-sync' },
      el('h4', { class: 'cloud-title' }, '🔗 Family sync (across devices)'),
      consentRow,
      el(
        'div',
        { class: 'sync-setup' },
        codeInput,
        goBtn,
        el('p', { class: 'field-hint' }, 'Grown-up sets one password; type the SAME one on each tablet. The child never needs it. See CLOUD_SYNC_SETUP.md.'),
      ),
    );
  }

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

  // --- Players (multi-user): switch, add, reset this explorer -------------------
  const resetExplorer = () => {
    if (confirm(`Reset ${ctx.state.profile.name}'s progress? Keeps their name + colour, clears gems and mastery.`)) {
      ctx.store.resetActiveProgress();
      ctx.refreshActive();
      toast('Progress reset for this explorer.');
      ctx.nav('settings');
    }
  };
  const playersPanel = el(
    'div',
    { class: 'panel' },
    el('h3', {}, 'Players'),
    el('p', { class: 'field-hint' }, `Playing now: ${ctx.state.profile.name}. Each explorer keeps their own progress.`),
    el(
      'div',
      { class: 'data-actions' },
      el('button', { class: 'btn', onClick: () => ctx.nav('profiles') }, '👥 Switch player'),
      el('button', { class: 'btn', onClick: () => ctx.nav('onboarding') }, '＋ Add explorer'),
      el('button', { class: 'btn ghost', onClick: resetExplorer }, '↺ Reset this explorer’s progress'),
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
        el(
          'div',
          { class: 'field' },
          el('label', {}, `Starting level — ${curLevelLabel}`),
          el('p', { class: 'field-hint' }, 'Where new words begin. The game still adapts up and down and revisits tricky words.'),
          levelGridEl,
        ),
        el('div', { class: 'field' }, el('label', {}, 'Difficulty'), diffSeg),
        el('div', { class: 'field' }, el('label', {}, 'Words per dig'), lenSeg),
        el('div', { class: 'field' }, el('label', {}, 'Answer choices'), optSeg),
      ),
      el(
        'div',
        { class: 'panel' },
        el('h3', {}, 'Sound'),
        el('div', { class: 'field' }, el('label', {}, 'Spoken voice'), voiceSeg),
        el('div', { class: 'field' }, el('label', {}, 'Voice speed'), rateSeg),
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
      playersPanel,
      el(
        'div',
        { class: 'panel' },
        el('h3', {}, 'Parents & privacy'),
        dataPanel,
      ),
    ),
  );
}
