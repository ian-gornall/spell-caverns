// src/screens/onboarding.js — first-run welcome (research Tier 2 #9: a named mascot
// guide + light personalization supports autonomy & competence; SDT, Kim 2015).
//
// Flow (one screen, internal steps — no router churn):
//   welcome → name → crystal colour → "let's dig!" → a GUARANTEED-WIN first wave.
// Geo (the crystal guide) speaks each prompt aloud. The colour choice becomes the
// live --accent theme; the name personalizes the whole app. On finish we mark
// profile.onboarded so this never shows again, then drop the learner straight into a
// short, very-easy rhythm wave (firstRun) so their first experience is a clear WIN.
//
// UI module — verified with Playwright, never imported by node --test.
import { el, mascot, applyTheme, toast, picturePicker } from '../ui.js';
import * as sync from '../cloud_sync_backend.js';

// A few friendly "crystal colours" the miner can pick (sets settings.themeColor →
// --accent). Each is a real accent already used elsewhere in the palette. Exported
// so Settings can reuse the same palette for changing the colour later.
export const COLOURS = [
  { id: 'blue', value: '#7AA2FF', name: 'Sky' },
  { id: 'cyan', value: '#36F1CD', name: 'Aqua' },
  { id: 'emerald', value: '#7AE582', name: 'Leaf' },
  { id: 'gold', value: '#FFD23F', name: 'Sun' },
  { id: 'amethyst', value: '#9D8DF1', name: 'Violet' },
  { id: 'pink', value: '#FF7EB6', name: 'Rose' },
];

export function onboardingScreen(ctx) {
  const { audio } = ctx;
  const body = el('div', { class: 'onboard-body' });
  const screen = el('div', { class: 'screen onboarding' }, body);

  let chosenName = ctx.state.profile.name && ctx.state.profile.name !== 'Explorer' ? ctx.state.profile.name : '';
  let chosenColour = ctx.state.settings.themeColor || COLOURS[0].value;
  applyTheme(chosenColour);

  // --- step 1: welcome ------------------------------------------------------
  function welcome() {
    const line = "Hi! I'm Geo, your crystal guide. Ready to dig for sparkly gems with me?";
    body.replaceChildren(
      mascot(line),
      el('button', { class: 'btn primary onboard-go', onClick: askName }, "Let's go! ✨"),
    );
    audio.say("Hi! I'm Geo, your crystal guide. Ready to dig for gems with me?");
  }

  // --- step 2: name ---------------------------------------------------------
  function askName() {
    const line = 'What should I call you, explorer?';
    const input = el('input', {
      type: 'text',
      class: 'onboard-name',
      placeholder: 'Type your name',
      maxLength: 20,
      value: chosenName,
    });
    const next = () => {
      chosenName = (input.value || '').trim().slice(0, 20);
      chooseColour();
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') next();
    });
    body.replaceChildren(
      mascot(line),
      input,
      el('button', { class: 'btn primary onboard-go', onClick: next }, "That's me! →"),
    );
    try {
      input.focus();
    } catch {
      /* ignore */
    }
    audio.say(line);
  }

  // --- step 3: crystal colour ----------------------------------------------
  function chooseColour() {
    const who = chosenName || 'explorer';
    const line = `Nice to meet you, ${who}! Pick your crystal colour.`;
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
              applyTheme(chosenColour); // live preview
              [...e.currentTarget.parentNode.children].forEach((n) => n.classList.remove('on'));
              e.currentTarget.classList.add('on');
            },
          },
          el('span', { class: 'colour-name' }, c.name),
        ),
      ),
    );
    body.replaceChildren(
      mascot(line),
      swatches,
      el('button', { class: 'btn primary onboard-go', onClick: syncStep }, 'Perfect! →'),
    );
    audio.say('Pick your crystal colour!');
  }

  // --- step 4: family sync (across devices) --------------------------------
  // Surfaced at first run (not buried in Settings): "just this tablet" (the easy
  // default, no cloud), or set up cross-device sync with a kid-friendly PICTURE
  // PASSWORD (tap 4 pictures — usable by a 5-year-old). Cloud sync is parent-gated
  // (COPPA): the grown-up ticks consent before any data leaves the device.
  function syncStep() {
    const line = 'Do you play on more than one tablet?';
    body.replaceChildren(
      mascot(line),
      el('button', { class: 'btn primary onboard-go', onClick: ready }, '📱 Just this one!'),
      el('button', { class: 'btn onboard-go', onClick: syncSetup }, '👨‍👩‍👧 Sync our tablets'),
      el('p', { class: 'field-hint', style: { maxWidth: '420px' } }, 'Grown-ups: sync keeps progress the same on every tablet.'),
    );
    audio.say(line);
  }

  function syncSetup() {
    let consented = false;
    const newBtn = el('button', { class: 'btn primary onboard-go', disabled: 'disabled', onClick: () => picturePassword('create') }, '✨ Make a picture password');
    const haveBtn = el('button', { class: 'btn onboard-go', disabled: 'disabled', onClick: () => picturePassword('join') }, '🔑 I have a picture password');
    const setEnabled = (on) => {
      consented = on;
      for (const b of [newBtn, haveBtn]) {
        if (on) b.removeAttribute('disabled');
        else b.setAttribute('disabled', 'disabled');
      }
    };
    const consentRow = el(
      'label',
      { class: 'consent-row', style: { maxWidth: '440px', textAlign: 'left' } },
      el('input', { type: 'checkbox', onChange: (e) => setEnabled(e.target.checked) }),
      el('span', {}, "Grown-up: I'm this child's parent/guardian and I agree to store their progress (a nickname + scores only) in the cloud to sync devices. See PRIVACY.md."),
    );
    body.replaceChildren(
      mascot('Grown-ups: set up syncing. Tick the box, then make a new picture password — or enter the one from your other tablet.'),
      consentRow,
      newBtn,
      haveBtn,
      el('button', { class: 'btn ghost onboard-go', onClick: syncStep }, '← Back'),
    );
  }

  // Tap 4 pictures (the shared picker). mode 'create' = make a new family password
  // (must be unused); 'join' = enter the existing one (must already have progress).
  function picturePassword(mode) {
    const initial = mode === 'create' ? 'Tap 4 pictures — and remember them!' : 'Tap your 4 secret pictures.';
    const status = el('p', { class: 'field-hint' }, initial);
    let picker;
    const submit = async (code) => {
      status.textContent = 'Checking…';
      try {
        const existing = await sync.pull(code);
        if (mode === 'create') {
          if (existing) {
            status.textContent = 'Oops — those pictures are taken! Try a different secret.';
            picker.reset();
            return;
          }
          enableSync(code, /*pullFirst=*/ false);
        } else {
          if (!existing) {
            status.textContent = 'Hmm, no progress for those pictures. Check the order with a grown-up.';
            picker.reset();
            return;
          }
          enableSync(code, /*pullFirst=*/ true);
        }
      } catch {
        status.textContent = 'Could not reach the sync server. Try again, or use “just this tablet”.';
        picker.reset();
      }
    };
    picker = picturePicker(submit);
    body.replaceChildren(
      mascot(mode === 'create' ? 'Pick 4 pictures to make your secret password!' : 'Tap your 4 secret pictures!'),
      picker.node,
      status,
      el('button', { class: 'btn ghost onboard-go', onClick: () => { picker.reset(); status.textContent = initial; } }, '↺ Start over'),
      el('button', { class: 'btn ghost onboard-go', onClick: syncSetup }, '← Back'),
    );
  }

  // Persist the chosen code + consent, sync, then continue into the game.
  async function enableSync(code, pullFirst) {
    ctx.state.settings.syncCode = code;
    ctx.state.settings.syncConsent = true;
    ctx.save();
    try {
      await sync.syncNow({
        code,
        getLocal: () => JSON.parse(ctx.store.exportData()),
        applyRemote: (envel) => ctx.store.importData(JSON.stringify(envel)),
      });
    } catch {
      /* offline — local state is saved; it'll sync later */
    }
    // a pull may have changed name/colour/settings — re-apply before continuing
    chosenName = ctx.state.profile.name && ctx.state.profile.name !== 'Explorer' ? ctx.state.profile.name : chosenName;
    chosenColour = ctx.state.settings.themeColor || chosenColour;
    ctx.audio.configure(ctx.state.settings);
    applyTheme(chosenColour);
    toast(pullFirst ? 'Synced your progress! ✨' : 'Sync is on — same code on your other tablets. ☁️');
    ready();
  }

  // --- step 5: ready -> guaranteed-win first wave ---------------------------
  function ready() {
    const name = chosenName || 'Explorer';
    ctx.state.profile.name = name;
    ctx.state.profile.onboarded = true;
    ctx.state.settings.themeColor = chosenColour;
    ctx.audio.configure(ctx.state.settings);
    applyTheme(chosenColour);
    ctx.save();

    const line = `Let's dig, ${name}! Tap the word you hear — you've got this!`;
    body.replaceChildren(
      mascot(line),
      el('button', { class: 'btn primary onboard-go big', onClick: () => ctx.nav('rhythm', { firstRun: true }) }, '⛏️ Start digging!'),
    );
    audio.say(`Let's dig, ${name}! You've got this!`);
  }

  welcome();
  return screen;
}
