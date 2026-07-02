// src/screens/settings.js — the kid-friendly config (UX.md §8).
//
// Exposes the two learner levers (difficulty + session length) plus voice/volume,
// learner name, and data export/import/reset. Harder difficulties show LOCKED
// until mastery unlocks them (HANDOFF §4: unlock, never force) — tapping a locked
// one explains how to unlock it rather than doing nothing.
import { el, header, toast, applyTheme, applyReadable, picturePad, NO_AUTOFILL } from '../ui.js';
import * as audio from '../audio.js';
import * as push from '../push.js';
import * as sync from '../cloud_sync_backend.js';
import { normalizeSyncCode, isValidSyncCode } from '../engine/cloudsync.js';
import { unlockedDifficulties, UNLOCK_THRESHOLDS } from '../engine/session.js';
import { summary } from '../engine/progress.js';
import { setLevelAndRefill, resetForRetest, createCategoryState } from '../engine/categories.js';
import { byRank, setWordlistMode, wordlistMode, lessonForBand, lessonCount, lessonList } from '../engine/lexicon.js';
import { kidLesson } from '../engine/kidcopy.js';
import { createLessonRun, syncLesson, lessonStatus } from '../engine/lessonrun.js';
import { COLOURS } from './onboarding.js';
import { APP_VERSION } from '../version.js';
import { swCacheVersion } from '../pwa.js';

const LENGTHS = [6, 10, 15, 20];

// Module-level flag: parent password unlocked for this visit (survives ctx.nav re-render).
let parentUnlocked = false;

// Build the kid-lock section for the "You" panel.
// States: no lock set → offer "Set a lock"; lock set → offer "Change lock" + "Remove lock".
function kidLockSection(ctx) {
  const activeProfileId = ctx.state.id;
  const currentLock = ctx.store.getKidLock(activeProfileId);
  const wrapper = el('div', { class: 'field' });

  const render = (content) => { wrapper.replaceChildren(content); };

  if (!currentLock) {
    // No lock: offer to set one.
    let step = 'idle'; // idle | first | confirm
    let firstCode = '';
    const hint = el('p', { class: 'field-hint' }, 'Tap 3 pictures to make a secret lock for your game.');
    const padWrap = el('div');

    const showPad = (onDone, label) => {
      padWrap.replaceChildren(
        el('label', {}, label),
        picturePad({ onComplete: onDone }),
      );
    };

    const startSet = () => {
      step = 'first';
      showPad((code) => {
        firstCode = code;
        step = 'confirm';
        showPad((code2) => {
          if (code2 === firstCode) {
            ctx.store.setKidLock(firstCode);
            ctx.save();
            toast('Game locked! 🔒');
            ctx.nav('settings');
          } else {
            toast('Those didn\'t match — try again');
            step = 'idle';
            padWrap.replaceChildren();
            hint.textContent = 'Hmm, those didn\'t match. Try again!';
          }
        }, 'Tap the same 3 pictures to confirm');
      }, 'Choose your 3 pictures');
    };

    const setBtn = el(
      'button',
      { class: 'btn', onClick: startSet },
      '🔒 Lock my game',
    );

    render(el(
      'div',
      {},
      el('label', {}, 'Kid lock'),
      hint,
      setBtn,
      padWrap,
    ));
  } else {
    // Lock is set: offer change + remove.
    const padWrap = el('div');
    let mode = null; // null | 'change-verify' | 'change-new' | 'change-confirm' | 'remove-verify'
    let newFirst = '';

    const startChange = () => {
      mode = 'change-verify';
      padWrap.replaceChildren(
        el('label', {}, 'Enter your current lock first'),
        picturePad({
          onComplete: (code) => {
            if (code !== currentLock) {
              toast('Oops, that\'s not the right lock. Try again.');
              startChange();
              return;
            }
            mode = 'change-new';
            padWrap.replaceChildren(
              el('label', {}, 'Choose your new 3 pictures'),
              picturePad({
                onComplete: (c1) => {
                  newFirst = c1;
                  mode = 'change-confirm';
                  padWrap.replaceChildren(
                    el('label', {}, 'Tap the same 3 pictures again to confirm'),
                    picturePad({
                      onComplete: (c2) => {
                        if (c2 !== newFirst) {
                          toast('Those didn\'t match — try again');
                          startChange();
                          return;
                        }
                        ctx.store.setKidLock(newFirst);
                        ctx.save();
                        toast('Lock changed! 🔒');
                        ctx.nav('settings');
                      },
                    }),
                  );
                },
              }),
            );
          },
        }),
      );
    };

    const startRemove = () => {
      mode = 'remove-verify';
      padWrap.replaceChildren(
        el('label', {}, 'Enter your lock to remove it'),
        picturePad({
          onComplete: (code) => {
            if (code !== currentLock) {
              toast('Oops, that\'s not the right lock. Try again.');
              startRemove();
              return;
            }
            ctx.store.setKidLock(null);
            ctx.save();
            toast('Lock removed.');
            ctx.nav('settings');
          },
        }),
      );
    };

    render(el(
      'div',
      {},
      el('label', {}, 'Kid lock'),
      el('p', { class: 'field-hint' }, 'Your game is locked with a picture password. 🔒'),
      el(
        'div',
        { class: 'data-actions' },
        el('button', { class: 'btn', onClick: startChange }, '🔑 Change lock'),
        el('button', { class: 'btn ghost', onClick: startRemove }, '🔓 Remove lock'),
      ),
      padWrap,
    ));
  }

  return wrapper;
}

// Relative-date formatter for snapshot timestamps (ms epoch).
function relativeDate(ms) {
  const now = Date.now();
  const diff = now - ms;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins} minutes ago`;
  if (hours < 24) {
    const d = new Date(ms);
    const hh = d.getHours();
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ampm = hh < 12 ? 'am' : 'pm';
    return `today ${hh % 12 || 12}:${mm}${ampm}`;
  }
  if (days === 1) {
    const d = new Date(ms);
    const hh = d.getHours();
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ampm = hh < 12 ? 'am' : 'pm';
    return `yesterday ${hh % 12 || 12}:${mm}${ampm}`;
  }
  return `${days} days ago`;
}

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

  // §C1 starting level (per-profile). The level is now a CAVERN LEVEL (a 30-word band found by
  // the placement diagnostic), not an age picker. A grown-up can RE-TEST (re-run the diagnostic
  // next Craft) or nudge the level ±1 band — the game still adapts up/down and revisits tricky
  // words. Writes state.categories.level (+ keeps startLevel in sync for display).
  const curBand = wordlistMode() === 'lessons'
    ? lessonStatus(ctx.state.lessons, lessonList()).number || 1
    : ctx.state.categories.level || 1;
  const levelPool = () => byRank().filter((w) => w.word.length >= 3);
  const nudgeLevel = (delta) => {
    // §40 lessons mode: the stepper moves the RUN through the lesson path (the categories
    // machine is bypassed there — its level is just a mirror). Stepping onto a lesson
    // re-opens it (drops it from completed) so it's playable again.
    if (wordlistMode() === 'lessons') {
      const lessons = lessonList();
      const run = ctx.state.lessons;
      let idx = lessons.findIndex((l) => l.id === run.lessonId);
      if (idx === -1) idx = 0;
      const target = lessons[Math.max(0, Math.min(lessons.length - 1, idx + delta))];
      if (!target) return;
      run.lessonId = target.id;
      run.completed = run.completed.filter((id) => id !== target.id);
      ctx.state.categories.level = target.band; // mirror for residual readers (admin export)
      ctx.state.startLevel = target.band;
      ctx.save();
      ctx.nav('settings');
      return;
    }
    const next = Math.max(1, (ctx.state.categories.level || 1) + delta);
    setLevelAndRefill(ctx.state.categories, next, levelPool());
    ctx.state.startLevel = ctx.state.categories.level;
    ctx.save();
    ctx.nav('settings'); // re-render the read-out
  };
  const levelControlEl = el(
    'div',
    { class: 'level-control' },
    el(
      'div',
      { class: 'level-stepper' },
      el('button', { class: 'btn ghost', onClick: () => nudgeLevel(-1) }, '➖ Easier'),
      el('span', { class: 'level-readout' },
        wordlistMode() === 'lessons' ? `Lesson ${curBand} of ${lessonCount()}` : `Cavern level ${curBand}`),
      el('button', { class: 'btn ghost', onClick: () => nudgeLevel(1) }, 'Harder ➕'),
    ),
    // §38/§40: the classic placement walk diagnoses 30-word bands; lessons mode has its
    // own SPINE diagnostic — re-running it re-places the run on the lesson path.
    wordlistMode() === 'lessons' ? el(
      'button',
      {
        class: 'btn',
        style: { marginTop: '10px', width: '100%' },
        onClick: () => {
          ctx.state.lessons.placed = false;
          ctx.state.lessons.diag = null;
          ctx.save();
          toast('The next lesson round starts with a quick check. ✨');
          ctx.nav('lesson');
        },
      },
      '🔁 Re-run lesson check',
    ) : el(
      'button',
      {
        class: 'btn',
        style: { marginTop: '10px', width: '100%' },
        onClick: () => {
          // §37 D (Ian 2026-06-22f): re-test = a CLEAN re-diagnosis. SOFT-reset the categories (level→1,
          // re-lock mastery/mining by zeroing the unlock peaks) so the old level + unlocks don't show
          // through stale — but KEEP word progress (the diagnostic re-aims known/mastered on completion).
          resetForRetest(ctx.state.categories);
          ctx.state.startLevel = 1; // keep the per-profile anchor (Settings display) in sync
          // reset placement so the NEXT crafting round re-diagnoses the right level (multi-session walk)
          ctx.state.placement = { done: false, age: (ctx.state.placement && ctx.state.placement.age) || null };
          ctx.save();
          toast('Re-testing — the next crafting round finds the right level. ✨');
          ctx.nav('puzzle');
        },
      },
      '🔁 Re-test starting level',
    ),
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

  // option count 2/3/4 (§36 F1: 2 is the default; 3/4 stay available)
  const optSeg = el(
    'div',
    { class: 'seg' },
    ...[2, 3, 4].map((n) =>
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
    ...NO_AUTOFILL,
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

  // --- Daily reminder (opt-in Web Push) -----------------------------------------
  // A gentle once-a-day "your geode is ready" nudge. Off by default; a grown-up turns it on,
  // which prompts the OS for notification permission and subscribes via the service worker
  // (see src/push.js + worker.js). Unsupported browsers (e.g. an iOS tab that isn't installed
  // to the Home Screen) just show a hint instead of a broken toggle.
  const reasonMsg = {
    denied: 'Allow notifications for this app in your device settings, then try again.',
    unsupported: 'Add the app to your Home Screen first, then reminders can be turned on.',
    'no-sw': 'Reminders need the installed app — try reopening it from your Home Screen.',
    server: 'Couldn’t reach the reminder service. Try again later.',
    error: 'Couldn’t turn on reminders just now.',
  };
  const remindersField = push.isSupported()
    ? el(
        'div',
        { class: 'field' },
        el('label', {}, 'Daily reminder'),
        el('p', { class: 'field-hint' }, 'A friendly once-a-day nudge to open the daily geode and keep the streak going.'),
        el(
          'div',
          { class: 'seg' },
          el(
            'button',
            {
              class: s.reminders ? 'on' : '',
              onClick: async (e) => {
                e.currentTarget.disabled = true;
                const r = await push.enable();
                if (r.ok) {
                  s.reminders = true;
                  apply();
                  toast('Daily reminder on 💎');
                } else {
                  toast(reasonMsg[r.reason] || reasonMsg.error);
                }
                ctx.nav('settings');
              },
            },
            '🔔 On',
          ),
          el(
            'button',
            {
              class: !s.reminders ? 'on' : '',
              onClick: async () => {
                await push.disable();
                s.reminders = false;
                apply();
                toast('Reminder off');
                ctx.nav('settings');
              },
            },
            'Off',
          ),
        ),
        s.reminders
          ? el(
              'button',
              {
                class: 'btn ghost',
                style: { marginTop: '10px' },
                onClick: async (e) => {
                  e.currentTarget.disabled = true;
                  const r = await push.sendTest();
                  toast(r.ok ? 'Sent! Check your notifications 🔔' : 'Couldn’t send a test just now.');
                  ctx.nav('settings');
                },
              },
              '🔔 Send a test',
            )
          : null,
      )
    : el(
        'div',
        { class: 'field' },
        el('label', {}, 'Daily reminder'),
        el('p', { class: 'field-hint' }, 'Add the app to your Home Screen on a supported device to enable a gentle daily reminder.'),
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
      ...NO_AUTOFILL,
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

  // Visible build version (so a grown-up can confirm the app updated). Shows the running
  // CODE version and the SERVICE-WORKER cache version; if they differ, an update is pending
  // (reopen the app to apply). Updates async once the SW answers.
  const versionLine = el('p', { class: 'version-line' }, `Version ${APP_VERSION}`);
  // Hidden DEVELOPER unlock (§28.A): tap the version line 7× to register THIS device for instant
  // feedback alerts. Invisible to families; still requires the ADMIN_KEY secret, so a curious kid
  // tapping it achieves nothing. No on-screen affordance — by design (Android-style build-tap).
  let versionTaps = 0;
  let versionTapTimer = null;
  versionLine.addEventListener('click', () => {
    versionTaps += 1;
    clearTimeout(versionTapTimer);
    versionTapTimer = setTimeout(() => {
      versionTaps = 0;
    }, 1500);
    if (versionTaps < 7) return;
    versionTaps = 0;
    // Already an admin device? Go straight to the feedback archive. Otherwise prompt for the
    // key, register for push (which remembers the key), then open the archive.
    import('../admin.js').then((admin) => {
      if (admin.isAdmin()) {
        ctx.nav('admin');
        return;
      }
      const key = window.prompt('Developer: enter admin key to view feedback + get alerts on this device');
      if (!key) return;
      toast('Registering this device…');
      push.registerAdmin(key.trim()).then((r) => {
        if (r.ok) {
          toast('✅ Feedback alerts on; opening archive');
          ctx.nav('admin');
        } else if (r.reason === 'forbidden') toast('Wrong admin key 🔒');
        else if (r.reason === 'denied') toast('Allow notifications first, then retry');
        else if (r.reason === 'unsupported') toast('This device can’t receive push (install the app first)');
        else toast('Could not register this device 😕');
      });
    });
  });
  swCacheVersion().then((sw) => {
    if (!sw) {
      versionLine.textContent = `Version ${APP_VERSION}`;
    } else if (sw === APP_VERSION) {
      versionLine.textContent = `Version ${APP_VERSION} · up to date ✓`;
    } else {
      versionLine.textContent = `Version ${APP_VERSION} · cached ${sw} — reopen the app to finish updating`;
      versionLine.classList.add('stale');
    }
  });

  // --- Snapshot rollback (“Time machine”) -----------------------------------
  const snapshotList = (() => {
    const snaps = (ctx.store.listSnapshots ? ctx.store.listSnapshots() : []).slice().reverse();
    if (!snaps.length) {
      return el('p', { class: 'field-hint' }, 'Daily auto-saves will appear here so you can rewind if needed.');
    }
    return el(
      'div',
      { class: 'data-actions' },
      ...snaps.map((snap) => {
        const labelText = snap.label === 'auto' || snap.label === ''
          ? (snap.label === 'auto' ? 'daily auto-save' : 'save point')
          : snap.label;
        const when = relativeDate(snap.at);
        return el(
          'div',
          { class: 'snapshot-row' },
          el('div', { class: 'snapshot-info' },
            el('span', { class: 'snapshot-when' }, when),
            el('span', { class: 'snapshot-label' }, ' — ' + labelText),
          ),
          el(
            'button',
            {
              class: 'btn ghost',
              style: { minHeight: '44px', padding: '8px 18px', fontSize: '0.95rem' },
              onClick: () => {
                if (!confirm('Restore this explorer to this point? Progress since then will be replaced.')) return;
                const ok = ctx.store.rollback(snap.index);
                if (ok) {
                  if (ctx.refreshActive) ctx.refreshActive();
                  applyTheme(ctx.state.settings.themeColor);
                  applyReadable(ctx.state.settings.readableText);
                  toast('Rolled back! ⏳');
                  ctx.nav('settings');
                } else {
                  toast('Could not restore that save point. 😕');
                }
              },
            },
            'Restore',
          ),
        );
      }),
    );
  })();

  // --- Build the sensitive (gated) block -----------------------------------
  // Restore, Delete, Family sync, Time machine. Gated by parent password if set.
  const pw = ctx.store.parentPassword ? ctx.store.parentPassword() : null;

  const sensitiveBlock = el('div', { class: 'sensitive-block' });

  const renderSensitive = () => {
    if (pw && !parentUnlocked) {
      // Show the lock gate.
      const pwInput = el('input', {
        type: 'password',
        autocomplete: 'off',
        placeholder: 'Grown-up password',
        style: { display: 'none' },
      });
      const unlockBtn = el(
        'button',
        {
          class: 'btn primary',
          onClick: () => {
            // Toggle input visibility or attempt unlock.
            if (pwInput.style.display === 'none') {
              pwInput.style.display = '';
              pwInput.focus();
            } else {
              if (pwInput.value === pw) {
                parentUnlocked = true;
                renderSensitive();
              } else {
                toast('That\'s not the grown-up password.');
                pwInput.value = '';
              }
            }
          },
        },
        '🔒 Grown-ups only — tap to unlock',
      );
      pwInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          if (pwInput.value === pw) {
            parentUnlocked = true;
            renderSensitive();
          } else {
            toast('That\'s not the grown-up password.');
            pwInput.value = '';
          }
        }
      });
      sensitiveBlock.replaceChildren(unlockBtn, pwInput);
    } else {
      // Unlocked (or no password set): show full controls.
      const changeRemovePw = pw
        ? el(
            'div',
            { class: 'field' },
            el('label', {}, 'Grown-up password'),
            el('p', { class: 'field-hint' }, 'A password is set. Change or remove it below.'),
            (() => {
              const inp = el('input', { type: 'password', autocomplete: 'new-password', placeholder: 'New password (4+ chars), blank to remove' });
              const saveBtn = el(
                'button',
                {
                  class: 'btn',
                  onClick: () => {
                    const v = inp.value.trim();
                    if (v && v.length < 4) { toast('Use at least 4 characters.'); return; }
                    if (ctx.store.setParentPassword) ctx.store.setParentPassword(v || null);
                    parentUnlocked = false;
                    toast(v ? 'Password updated.' : 'Password removed.');
                    ctx.nav('settings');
                  },
                },
                'Save',
              );
              return el('div', { class: 'sync-setup' }, inp, saveBtn);
            })(),
          )
        : null;

      const timeMachine = el(
        'div',
        { class: 'cloud-sync' },
        el('h4', { class: 'cloud-title' }, '⏳ Time machine'),
        el('p', { class: 'field-hint' }, 'Restore your explorer\'s progress to an earlier save point.'),
        snapshotList,
      );

      // §32: revoke the one-time grown-up consent for the "Spell out loud" mic mode.
      const voiceBlock =
        ctx.store.voiceConsent && ctx.store.voiceConsent()
          ? el(
              'div',
              { class: 'cloud-sync' },
              el('h4', { class: 'cloud-title' }, '🎤 Voice spelling'),
              el('p', { class: 'field-hint' }, 'Your child can spell out loud (the microphone is on for this mode). The audio is never stored — see PRIVACY.md.'),
              el(
                'button',
                {
                  class: 'btn',
                  onClick: () => {
                    ctx.store.setVoiceConsent(false);
                    toast('🎤 Voice spelling turned off.');
                    ctx.nav('settings');
                  },
                },
                '🔇 Turn off voice spelling',
              ),
            )
          : el('span', {});

      sensitiveBlock.replaceChildren(
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
        voiceBlock,
        changeRemovePw || el('span', {}),
        timeMachine,
      );
    }
  };
  renderSensitive();

  // --- Set grown-up password (shown only when none is set) -----------------
  const setPwBlock = !pw
    ? (() => {
        const inp = el('input', { type: 'password', autocomplete: 'new-password', placeholder: 'Choose a password (4+ chars)' });
        const saveBtn = el(
          'button',
          {
            class: 'btn',
            onClick: () => {
              const v = inp.value.trim();
              if (!v || v.length < 4) { toast('Use at least 4 characters.'); return; }
              if (ctx.store.setParentPassword) ctx.store.setParentPassword(v);
              toast('Grown-up password set! 🔒');
              ctx.nav('settings');
            },
          },
          'Save',
        );
        return el(
          'div',
          { class: 'cloud-sync' },
          el('h4', { class: 'cloud-title' }, '🔒 Set a grown-up password (optional)'),
          el('p', { class: 'field-hint' }, 'Stops a child from changing settings or deleting data. Totally optional — a soft guard, not real security.'),
          el('div', { class: 'sync-setup' }, inp, saveBtn),
        );
      })()
    : null;

  const dataPanel = el(
    'div',
    { class: 'data-actions' },
    el('p', { class: 'backup-status' + (backupDue ? ' due' : '') }, backupStatusText),
    backupBtn,
    sensitiveBlock,
    setPwBlock || el('span', {}),
    versionLine,
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

  // --- Practice sheets (parent tool — tucked into the grown-up disclosure below) ---
  const printablesPanel = el(
    'div',
    { class: 'panel' },
    el('h3', {}, 'Practice sheets'),
    el('p', { class: 'field-hint' }, 'Print word lists and look-cover-write-check sheets for screen-free practice.'),
    el(
      'div',
      { class: 'data-actions' },
      el('button', { class: 'btn', onClick: () => ctx.nav('printables') }, '🖨️ Make a printable sheet'),
    ),
  );

  // --- §38 Word lists (grown-up): classic flat list vs the research-corpus pattern
  // lessons filtered by age. Switching replaces the word universe, so the categories
  // machine restarts fresh (level 1, mastery/mining re-lock); gems, streaks, and the
  // long-term tracker are untouched. Lessons mode skips the classic placement walk
  // (its bands are 30-word chunks, not lessons) — the spine diagnostic comes later.
  const switchWordlists = (mode) => {
    if ((s.wordlists || 'classic') === mode) return;
    const name = mode === 'lessons' ? 'Pattern lessons' : 'Classic';
    if (!confirm(`Switch ${ctx.state.profile.name} to ${name}? The word path starts fresh at level 1 (gems and streaks are kept).`)) return;
    s.wordlists = mode;
    if (mode === 'lessons' && s.age == null) s.age = ctx.state.placement?.age || 8;
    ctx.state.categories = createCategoryState({ setSize: s.length, level: 1 });
    ctx.state.startLevel = 1;
    ctx.state.placement = { done: true, age: ctx.state.placement?.age || s.age || null };
    // §40: switching word universes restarts the lesson run too (word records would
    // point at the other list's words) — UNPLACED, so lessons mode opens with the
    // spine diagnostic. syncLesson re-aims it at the new path.
    ctx.state.lessons = createLessonRun({ placed: false });
    setWordlistMode(s.wordlists, s.age);
    syncLesson(ctx.state.lessons, lessonList());
    ctx.save();
    toast(mode === 'lessons' ? 'Pattern lessons on — the path starts at lesson 1. ✨' : 'Back to the classic word list.');
    ctx.nav('settings');
  };
  const wordlistSeg = el(
    'div',
    { class: 'seg' },
    ...[['classic', 'Classic'], ['lessons', 'Pattern lessons']].map(([id, label]) =>
      el('button', { class: (s.wordlists || 'classic') === id ? 'on' : '', onClick: () => switchWordlists(id) }, label)),
  );
  const nudgeAge = (delta) => {
    const next = Math.max(5, Math.min(15, (s.age || 8) + delta));
    if (next === s.age) return;
    s.age = next;
    setWordlistMode('lessons', next);
    // The pool (and so the lesson numbering) changed: clamp the level and refill.
    const lvl = Math.max(1, Math.min(ctx.state.categories.level || 1, lessonCount()));
    setLevelAndRefill(ctx.state.categories, lvl, levelPool());
    syncLesson(ctx.state.lessons, lessonList()); // §40: heal the run against the new path
    ctx.state.startLevel = ctx.state.categories.level;
    ctx.save();
    ctx.nav('settings');
  };
  const ageField = s.wordlists === 'lessons'
    ? el(
        'div',
        { class: 'field' },
        el('label', {}, 'Age'),
        el('p', { class: 'field-hint' }, 'Words are chosen for this age and below (age is a ceiling, not a track).'),
        el(
          'div',
          { class: 'level-stepper' },
          el('button', { class: 'btn ghost', onClick: () => nudgeAge(-1) }, '➖ Younger'),
          el('span', { class: 'level-readout' }, `${s.age || 8} years`),
          el('button', { class: 'btn ghost', onClick: () => nudgeAge(1) }, 'Older ➕'),
        ),
      )
    : null;
  const wordlistsPanel = el(
    'div',
    { class: 'panel' },
    el('h3', {}, 'Word lists'),
    el('p', { class: 'field-hint' }, 'Classic is the original list. Pattern lessons is the new spelling programme: one lesson per spelling pattern, walked in order, with words picked by age. Missed words reteach their rule.'),
    el('div', { class: 'field' }, el('label', {}, 'List'), wordlistSeg),
    ageField || el('span', {}),
  );

  // --- Advanced play levers (parent-facing): answer-count + the device voice picker.
  // The two CORE kid levers (difficulty + length) stay on the always-visible Adventure panel;
  // these finer knobs move behind the grown-up disclosure (DESIGN_ANALYSIS rec #8). ---
  const advancedPanel = el(
    'div',
    { class: 'panel' },
    el('h3', {}, 'Advanced'),
    el('div', { class: 'field' }, el('label', {}, 'Answer choices'), optSeg),
    el('div', { class: 'field' }, el('label', {}, 'Voice choice'), voicePicker, testVoiceBtn),
  );

  // §26-A rec #8 — SLIM the child-facing Settings. The default view is just the simple,
  // safe kid controls (level, difficulty, length, voice on/off + speed + volume, name,
  // colour, easy-read, kid-lock). The advanced levers, players admin, practice sheets, and
  // the whole Parents & privacy block (backup/restore/delete/family-sync/time-machine/
  // grown-up password) live inside a collapsed <details> disclosure so a child isn't faced
  // with — and can't idly wander into — the grown-up tools. Native <details> = zero-JS,
  // accessible, and keyboard-toggleable; the destructive items inside still sit behind the
  // parent-password gate (renderSensitive) when one is set.
  const grownupSection = el(
    'details',
    { class: 'gp-disclosure' },
    el(
      'summary',
      { class: 'gp-summary' },
      el('span', { class: 'gp-summary-label' }, '🔧 Grown-up settings'),
      el('span', { class: 'gp-summary-hint' }, 'players · printables · backup · privacy'),
    ),
    el(
      'div',
      { class: 'gp-body' },
      wordlistsPanel,
      advancedPanel,
      playersPanel,
      printablesPanel,
      el(
        'div',
        { class: 'panel' },
        el('h3', {}, 'Parents & privacy'),
        dataPanel,
      ),
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
          el('label', {}, wordlistMode() === 'lessons'
            ? `Starting level — Lesson ${curBand}${lessonForBand(curBand) ? `: ${kidLesson(lessonForBand(curBand)).name}` : ''}`
            : `Starting level — Cavern level ${curBand}`),
          el('p', { class: 'field-hint' }, wordlistMode() === 'lessons'
            ? 'The lesson path walks the spelling patterns in order. Nudge it easier/harder any time; the game still adapts and revisits tricky words.'
            : 'Found by a quick spelling check when an explorer starts. Re-test any time, or nudge it easier/harder. The game still adapts and revisits tricky words.'),
          levelControlEl,
        ),
        el('div', { class: 'field' }, el('label', {}, 'Difficulty'), diffSeg),
        el(
          'div',
          { class: 'field' },
          el('label', {}, 'Words per dig'),
          el('p', { class: 'field-hint' }, 'How many words are being learned at once — and how many to master before Mastery, then Mining, unlock. Smaller = quicker unlocks for younger spellers.'),
          lenSeg,
        ),
      ),
      el(
        'div',
        { class: 'panel' },
        el('h3', {}, 'Sound'),
        el('div', { class: 'field' }, el('label', {}, 'Spoken voice'), voiceSeg),
        el('div', { class: 'field' }, el('label', {}, 'Voice speed'), rateSeg),
        el('div', { class: 'field' }, el('label', {}, 'Volume'), vol),
        remindersField,
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
        el('div', { class: 'field' }, el('label', {}, 'Crystal color'), colourRow),
        el(
          'div',
          { class: 'field' },
          el('label', {}, 'Easy-read text (dyslexia-friendly)'),
          readableSeg,
          el(
            'p',
            { class: 'field-hint' },
            'Roomier letter-spacing, taller lines, and left-aligned sentences — evidence-based spacing that helps a struggling or dyslexic reader.',
          ),
        ),
        kidLockSection(ctx),
      ),
      grownupSection,
    ),
  );
}
