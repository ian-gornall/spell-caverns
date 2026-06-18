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
import { el, mascot, applyTheme } from '../ui.js';

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
      el('button', { class: 'btn primary onboard-go', onClick: ready }, 'Perfect! →'),
    );
    audio.say('Pick your crystal colour!');
  }

  // --- step 4: ready -> guaranteed-win first wave ---------------------------
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
