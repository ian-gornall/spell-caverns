// src/screens/onboarding.js — create-an-explorer flow (first run AND "add explorer").
//
// Flow (one screen, internal steps): welcome → name → crystal colour → WHERE TO START
// (level select) → "let's dig!" → a guaranteed-win first wave. Geo (the crystal guide)
// speaks each prompt. On finish we CREATE a new profile (store.addProfile) and make it
// active, so siblings each get their own progress. Family sync is a parent/family concern
// and lives in Settings (not here). UI module — never imported by node --test.
import { el, mascot, applyTheme, toast } from '../ui.js';
import { wordsByTier } from '../engine/lexicon.js';
import * as sync from '../cloud_sync_backend.js';
import { normalizeSyncCode, isValidSyncCode } from '../engine/cloudsync.js';

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
  let chosenLevel = active?.startLevel || 1;
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
    const input = el('input', { type: 'text', class: 'onboard-name', placeholder: 'Type your name', maxLength: 20, value: chosenName });
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
              applyTheme(chosenColour);
              [...e.currentTarget.parentNode.children].forEach((n) => n.classList.remove('on'));
              e.currentTarget.classList.add('on');
            },
          },
          el('span', { class: 'colour-name' }, c.name),
        ),
      ),
    );
    body.replaceChildren(mascot(line), swatches, el('button', { class: 'btn primary onboard-go', onClick: chooseLevel }, 'Perfect! →'));
    audio.say('Pick your crystal colour!');
  }

  // --- step 4: where to start (level select) -------------------------------
  function chooseLevel() {
    const line = "Where should we start digging? Pick the words that look about right — I'll figure out the rest from there.";
    const cards = levelGrid(chosenLevel, (tier) => {
      chosenLevel = tier;
    });
    body.replaceChildren(
      mascot('Where should we start?'),
      el('p', { class: 'field-hint', style: { maxWidth: '460px' } }, "Pick the words that look about right — the game finds the ones you don't know yet and adjusts."),
      cards,
      // `level-cta` makes this button STICKY to the bottom on phones (CSS) so it stays visible
      // while the 9 level cards scroll — otherwise the CTA sits below the fold on a phone.
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
    const line = 'Do you play on more than one tablet?';
    body.replaceChildren(
      mascot(line),
      el('button', { class: 'btn primary onboard-go', onClick: ready }, '📱 Just this one!'),
      el('button', { class: 'btn onboard-go', onClick: syncSetup }, '👨‍👩‍👧 Sync our tablets'),
      el('p', { class: 'field-hint', style: { maxWidth: '420px' } }, 'Grown-ups: sync keeps every explorer the same on every tablet.'),
    );
    audio.say(line);
  }

  function syncSetup() {
    const input = el('input', { type: 'text', class: 'onboard-name', placeholder: 'Family password', maxLength: 40, autocapitalize: 'none', autocomplete: 'off', disabled: 'disabled' });
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

  // --- step 5: create the profile -> guaranteed-win first wave --------------
  function ready() {
    const name = chosenName || 'Explorer';
    // Create a NEW profile (first-run, or "add explorer") and make it active.
    ctx.store.addProfile({ name, themeColor: chosenColour, startLevel: chosenLevel });
    ctx.refreshActive();
    applyTheme(chosenColour);

    const lineTxt = `Let's dig, ${name}! Tap the word you hear — you've got this!`;
    body.replaceChildren(
      mascot(lineTxt),
      el('button', { class: 'btn primary onboard-go big', onClick: () => ctx.nav('rhythm', { firstRun: true }) }, '⛏️ Start digging!'),
    );
    audio.say(`Let's dig, ${name}! You've got this!`);
  }

  welcome();
  return screen;
}
