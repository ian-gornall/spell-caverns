// src/screens/onboarding.js — create-an-explorer flow (first run AND "add explorer").
//
// Flow (one screen, internal steps): welcome → name → crystal colour → WHERE TO START
// (level select) → "let's dig!" → a guaranteed-win first wave. Geo (the crystal guide)
// speaks each prompt. On finish we CREATE a new profile (store.addProfile) and make it
// active, so siblings each get their own progress. Family sync is a parent/family concern
// and lives in Settings (not here). UI module — never imported by node --test.
import { el, mascot, applyTheme, toast, NO_AUTOFILL } from '../ui.js';
import { wordsByTier } from '../engine/lexicon.js';
import * as sync from '../cloud_sync_backend.js';
import * as push from '../push.js';
import { normalizeSyncCode, isValidSyncCode } from '../engine/cloudsync.js';
import { UI } from '../engine/ui_phrases.js';

// Crystal colours (sets settings.themeColor → --accent). Reused by Settings.
export const COLOURS = [
  { id: 'blue', value: '#7AA2FF', name: 'Sky' },
  { id: 'cyan', value: '#36F1CD', name: 'Aqua' },
  { id: 'emerald', value: '#7AE582', name: 'Leaf' },
  { id: 'gold', value: '#FFD23F', name: 'Sun' },
  { id: 'amethyst', value: '#9D8DF1', name: 'Violet' },
  { id: 'pink', value: '#FF7EB6', name: 'Rose' },
];

// Starting points the parent/learner can pick (the level-select). Each maps to a tier
// the engine anchors NEW words around; it then adapts up/down from there. We show a few
// example words per level so a grown-up can gauge difficulty (a starting point, NOT
// "learning from lists" — user 2026-06-18). ONE LEVEL PER TIER (1–9) for fine control
// (§21-D — the old 5 presets were too coarse for ~3,000 words). Reused by Settings (§21-B).
export const LEVELS = [
  { label: 'Just starting', age: 'age 5', tier: 1 },
  { label: 'Starting out', age: 'age 6', tier: 2 },
  { label: 'Beginner', age: 'ages 6–7', tier: 3 },
  { label: 'Growing', age: 'ages 7–8', tier: 4 },
  { label: 'Building', age: 'ages 8–9', tier: 5 },
  { label: 'Getting strong', age: 'ages 9–10', tier: 6 },
  { label: 'Confident', age: 'ages 10–11', tier: 7 },
  { label: 'Advanced', age: 'ages 11–12', tier: 8 },
  { label: 'Expert', age: 'ages 12–13', tier: 9 },
];

// A few short, common example words from a tier (for the level cards).
export function exampleWords(tier, n = 3) {
  return wordsByTier(tier)
    .slice()
    .sort((a, b) => a.rank - b.rank)
    .slice(0, n)
    .map((w) => w.word);
}

// The shared level-select grid: a card per LEVEL showing label/age/example words, with
// `selectedTier` highlighted. `onSelect(tier)` fires on tap (the card highlight is handled
// here). Used by BOTH onboarding (first run) and Settings (re-aim any time) — §21-B.
export function levelGrid(selectedTier, onSelect) {
  return el(
    'div',
    { class: 'level-grid' },
    ...LEVELS.map((lv) =>
      el(
        'button',
        {
          class: 'level-card' + (lv.tier === selectedTier ? ' on' : ''),
          onClick: (e) => {
            [...e.currentTarget.parentNode.children].forEach((n) => n.classList.remove('on'));
            e.currentTarget.classList.add('on');
            onSelect(lv.tier);
          },
        },
        el('div', { class: 'level-label' }, lv.label),
        el('div', { class: 'level-age' }, lv.age),
        el('div', { class: 'level-examples' }, exampleWords(lv.tier).join(' · ')),
      ),
    ),
  );
}

export function onboardingScreen(ctx) {
  const { audio } = ctx;
  const body = el('div', { class: 'onboard-body' });
  const screen = el('div', { class: 'screen onboarding' }, body);

  const active = ctx.state;
  // first run (no profiles yet) shows the family-sync option; "add explorer" (a profile
  // already exists, so the family is set up) skips straight to creating the new explorer.
  const firstRun = ctx.store.profileCount() === 0;
  let chosenName = active?.profile?.name && active.profile.name !== 'Explorer' ? active.profile.name : '';
  let chosenColour = active?.settings?.themeColor || COLOURS[0].value;
  let chosenAge = 7; // §C1: asked below; seeds the placement diagnostic's start word (not a level pick)
  applyTheme(chosenColour);

  // --- step 0 (first run only): "Tap to start" audio gate (§32.B) -----------
  // iOS unlocks audio only inside a user GESTURE, and the neural-TTS clip manifest may
  // not have loaded on the first paint — so auto-speaking the welcome here would fall
  // back to the robotic device voice, and a LATER clip would then sound like a different
  // voice (the "two voices on first run" bug). One tap primes audio + awaits the manifest,
  // so every line from welcome on plays the same clip voice. (Skipped for "add explorer":
  // audio is already primed by the taps that got there.)
  function tapToStart() {
    body.replaceChildren(
      mascot('Ready for a crystal adventure?', { mood: 'wink' }),
      el(
        'button',
        {
          class: 'btn primary onboard-go big tap-to-start',
          onClick: async (e) => {
            try { e.currentTarget.disabled = true; } catch { /* ignore */ }
            audio.prime(); // this click is the gesture that unlocks iOS audio
            await audio.whenReady(); // ...and wait for the clip manifest before speaking
            welcome();
          },
        },
        'Tap to start 🔊',
      ),
    );
  }

  // --- step 1: welcome ------------------------------------------------------
  function welcome() {
    const line = "Hi! I'm Geo, your crystal guide. Ready to dig for sparkly gems with me?";
    body.replaceChildren(
      mascot(line, { mood: 'wink' }),
      el('button', { class: 'btn primary onboard-go', onClick: askName }, "Let's go! ✨"),
    );
    audio.say(UI.welcome);
  }

  // --- step 2: name ---------------------------------------------------------
  function askName() {
    const line = UI.askName;
    const input = el('input', { type: 'text', class: 'onboard-name', placeholder: 'Type your name', maxLength: 20, value: chosenName, ...NO_AUTOFILL });
    const next = () => {
      chosenName = (input.value || '').trim().slice(0, 20);
      chooseColour();
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') next(); });
    body.replaceChildren(mascot(line), input, el('button', { class: 'btn primary onboard-go', onClick: next }, "That's me! →"));
    try { input.focus(); } catch { /* ignore */ }
    audio.say(line);
  }

  // --- step 3: crystal colour ----------------------------------------------
  function chooseColour() {
    const who = chosenName || 'explorer';
    const line = `Nice to meet you, ${who}! Pick your crystal color.`;
    const swatches = el(
      'div',
      { class: 'colour-grid' },
      ...COLOURS.map((c) =>
        el(
          'button',
          {
            class: 'colour-swatch' + (c.value === chosenColour ? ' on' : ''),
            style: { background: c.value },
            'aria-label': c.name,
            onClick: (e) => {
              chosenColour = c.value;
              applyTheme(chosenColour);
              [...e.currentTarget.parentNode.children].forEach((n) => n.classList.remove('on'));
              e.currentTarget.classList.add('on');
            },
          },
          el('span', { class: 'colour-name' }, c.name),
        ),
      ),
    );
    body.replaceChildren(mascot(line), swatches, el('button', { class: 'btn primary onboard-go', onClick: chooseAge }, 'Perfect! →'));
    audio.say(UI.pickColour);
  }

  // --- step 4: how old are you? (§C1) --------------------------------------
  // Replaces the old age-labelled LEVEL picker (Ian 2026-06-22): the child's age only seeds
  // WHERE the placement diagnostic starts walking the frequency list (5→#1, 6→#300, +300/yr).
  // The real start level is then DIAGNOSED from how they spell — not chosen here.
  function chooseAge() {
    const line = "How old are you? Tap your age and we'll find the perfect crystals for you!";
    // The ends are OPEN ranges (Ian 2026-06-22b): the youngest button covers ages 2–5 (all seed
    // the easiest start word) and the oldest covers 13+ (the hardest start). The diagnostic then
    // adapts up/down from there, so an age outside 5–13 is never turned away.
    const AGES = [
      { value: 5, label: '2–5' },
      { value: 6, label: '6' },
      { value: 7, label: '7' },
      { value: 8, label: '8' },
      { value: 9, label: '9' },
      { value: 10, label: '10' },
      { value: 11, label: '11' },
      { value: 12, label: '12' },
      { value: 13, label: '13+' },
    ];
    const pickBtn = (a) =>
      el(
        'button',
        {
          class: 'age-btn' + (a.value === chosenAge ? ' on' : ''),
          onClick: (e) => {
            chosenAge = a.value;
            [...e.currentTarget.parentNode.children].forEach((c) => c.classList.remove('on'));
            e.currentTarget.classList.add('on');
          },
        },
        a.label,
      );
    const grid = el('div', { class: 'age-grid' }, ...AGES.map(pickBtn));
    body.replaceChildren(
      mascot('How old are you?'),
      el('p', { class: 'field-hint', style: { maxWidth: '460px' } }, "Grown-ups: this just sets a starting point. The game then finds the words they don't know yet and adjusts."),
      grid,
      // `level-cta` keeps this button STICKY to the bottom on phones so it stays visible.
      el('button', { class: 'btn primary onboard-go level-cta', onClick: firstRun ? syncStep : ready }, "Let's dig! →"),
    );
    audio.say(line);
  }

  // --- step 4b (first run only): family sync option ------------------------
  // Optional cross-device sync. A grown-up sets ONE family password; the device saves it
  // so the child never types it again. Entering the SAME password that another tablet
  // already uses JOINS the family — its existing explorers appear in "Who's playing?"
  // (we don't make a duplicate). A brand-new password starts a fresh family.
  function syncStep() {
    const line = UI.syncAsk;
    body.replaceChildren(
      mascot(line),
      el('button', { class: 'btn primary onboard-go', onClick: ready }, '📱 Just this one!'),
      el('button', { class: 'btn onboard-go', onClick: syncSetup }, '👨‍👩‍👧 Sync our tablets'),
      el('p', { class: 'field-hint', style: { maxWidth: '420px' } }, 'Grown-ups: sync keeps every explorer the same on every tablet.'),
    );
    audio.say(line);
  }

  function syncSetup() {
    const input = el('input', { type: 'text', class: 'onboard-name', placeholder: 'Family password', maxLength: 40, ...NO_AUTOFILL, disabled: 'disabled' });
    const goBtn = el('button', { class: 'btn primary onboard-go', disabled: 'disabled', onClick: () => enableSync(input.value) }, '☁️ Turn on sync');
    const consentRow = el(
      'label',
      { class: 'consent-row', style: { maxWidth: '440px', textAlign: 'left' } },
      el('input', {
        type: 'checkbox',
        onChange: (e) => {
          const on = e.target.checked;
          for (const n of [input, goBtn]) on ? n.removeAttribute('disabled') : n.setAttribute('disabled', 'disabled');
          if (on) try { input.focus(); } catch { /* ignore */ }
        },
      }),
      el('span', {}, "Grown-up: I'm this child's parent/guardian and I agree to store the family's progress (nicknames + scores only) in the cloud to sync devices. See PRIVACY.md."),
    );
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !goBtn.hasAttribute('disabled')) enableSync(input.value); });
    body.replaceChildren(
      mascot('Grown-ups: set one family password. Type the SAME one on each tablet to keep them in sync.'),
      consentRow,
      input,
      el('p', { class: 'field-hint', style: { maxWidth: '440px' } }, 'Pick something only your family knows. New tablets that enter it join your explorers automatically.'),
      goBtn,
      el('button', { class: 'btn ghost onboard-go', onClick: syncStep }, '← Back'),
    );
  }

  async function enableSync(raw) {
    const code = normalizeSyncCode(raw);
    if (!isValidSyncCode(code)) {
      toast('Use at least 4 letters or numbers.');
      return;
    }
    ctx.store.setSyncCode(code);
    ctx.store.setSyncConsent(true);
    try {
      await sync.syncNow({
        code,
        getLocal: () => JSON.parse(ctx.store.exportData()),
        applyRemote: (envel) => ctx.store.importData(JSON.stringify(envel)),
      });
    } catch {
      /* offline — saved locally; syncs later */
    }
    // Joined an EXISTING family (its explorers came down) → pick who's playing. A brand-
    // new family (still no profiles) → continue creating this first explorer.
    if (ctx.store.profileCount() > 0) {
      toast('Synced your family! Pick who’s playing. ✨');
      ctx.nav('profiles');
    } else {
      ready();
    }
  }

  // --- step 5: create the profile -> reminder prompt -> guaranteed-win first wave ---
  function ready() {
    const name = chosenName || 'Explorer';
    // Create a NEW profile (first-run, or "add explorer") and make it active. §C1: `age` seeds
    // the placement diagnostic (the first Craft session); the real start level is diagnosed there.
    ctx.store.addProfile({ name, themeColor: chosenColour, age: chosenAge });
    ctx.refreshActive();
    applyTheme(chosenColour);
    // §36 F2: at the END of onboarding (a grown-up just set this explorer up) offer the daily
    // reminder + ask the OS for notification permission — only where push can actually work
    // (an installed PWA / supported browser), only on first run, and only if permission hasn't
    // been decided yet (don't re-nag if already granted/denied). Otherwise, straight to play.
    const undecided = typeof Notification !== 'undefined' && Notification.permission === 'default';
    if (firstRun && push.isSupported() && undecided) reminderStep(name);
    else startDig(name);
  }

  // --- step 5b (first run, push-capable): the grown-up daily-reminder opt-in (F2) ---
  // Reminders DEFAULT ON, but OS push permission can't be silently force-enabled — so we ask
  // here, behind grown-up framing (COPPA). The setting is honest: ON only if permission is
  // actually granted; declining/"maybe later" turns it off (re-enable anytime in Settings).
  function reminderStep(name) {
    const enable = async (e) => {
      try { e.currentTarget.disabled = true; } catch { /* ignore */ }
      let ok = false;
      try { const r = await push.enable(); ok = !!(r && r.ok); } catch { /* ignore */ }
      ctx.state.settings.reminders = ok;
      ctx.save();
      toast(ok ? 'Daily reminder on 💎' : 'No reminder for now — turn it on anytime in Settings.');
      startDig(name);
    };
    const later = () => {
      ctx.state.settings.reminders = false;
      ctx.save();
      startDig(name);
    };
    body.replaceChildren(
      mascot(`One thing for grown-ups: want a gentle daily reminder so ${name} keeps their streak?`),
      el('button', { class: 'btn primary onboard-go', onClick: enable }, '🔔 Yes, remind us'),
      el('button', { class: 'btn onboard-go', onClick: later }, 'Maybe later'),
      el('p', { class: 'field-hint', style: { maxWidth: '440px' } }, 'Grown-ups only — one friendly notification a day. Change it anytime in Settings.'),
    );
  }

  function startDig(name) {
    // §C1/D1: first activity is CRAFT (the placement diagnostic), NOT the locked Mining mode the
    // old first-run dropped into. The new profile's placement.done=false makes this Craft run the
    // diagnostic (modes/puzzle.js); it then flows into normal play, seamlessly.
    const lineTxt = `Let's dig, ${name}! Spell the word you hear — you've got this!`;
    body.replaceChildren(
      mascot(lineTxt),
      el('button', { class: 'btn primary onboard-go big', onClick: () => ctx.nav('puzzle') }, '⛏️ Start digging!'),
    );
    audio.say(UI.letsDig); // name dropped from speech so it's a fixed clip; bubble keeps it
  }

  // First run: gate behind a tap so audio is primed + the manifest is loaded before any
  // narration (§32.B). "Add explorer": audio is already live, go straight to welcome.
  if (firstRun) tapToStart();
  else welcome();
  return screen;
}
