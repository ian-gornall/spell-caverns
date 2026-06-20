// src/engine/ui_phrases.js — the FIXED spoken interface lines, in ONE place.
//
// Why this module exists (§32.A): the dictation words (audio/words/) and the
// praise phrases (audio/phrases/) are pre-rendered to neural-TTS clips by
// scripts/gen_audio.mjs, but the INTERFACE narration (Geo's onboarding lines, the
// geode/boss prompts) had no clip — so audio.say() fell through to the robotic
// device voice. These are the FIRST things a user hears, so they set the quality
// bar. Centralizing the strings here means the RUNTIME say() string and the
// gen_audio PRE-RENDER use the exact same text → the slug() matches → the clip
// resolves. If a literal lived in a screen AND a separate catalog they could drift
// (clip silently un-findable). Pure data — no DOM, safe to import in both the
// browser screens and the Node generator (mirrors how praise.js is shared).
//
// Only FIXED strings can be pre-generated; anything with an interpolated value
// (a child's typed name, a gem count, a zone name) stays on TTS — so design the
// spoken line to omit the variable part (e.g. the onboarding "Let's dig!" drops the
// name from speech but the mascot bubble still shows it).

// Spoken via audio.say() → resolved to /audio/ui/<slug>.mp3 (the new 'ui' bucket).
export const UI = {
  // onboarding — the create-an-explorer flow (the very first run)
  welcome: "Hi! I'm Geo, your crystal guide. Ready to dig for gems with me?",
  askName: 'What should I call you, explorer?',
  pickColour: 'Pick your crystal colour!',
  chooseLevel:
    "Where should we start digging? Pick the words that look about right — I'll figure out the rest from there.",
  syncAsk: 'Do you play on more than one tablet?',
  letsDig: "Let's dig! You've got this!",
  // geode / boss reward moments
  greatGeode: 'A great geode! Tap to crack it open!',
  dailyGeode: 'Your daily geode! Tap to crack it open!',
  rareGeode: 'A rare geode! Amazing!',
  geodeCracked: 'Geode cracked! New goals unlocked.',
};

// Every UI line, for the generator to iterate.
export const UI_LINES = Object.values(UI);

// Spoken via audio.speakPraise() → resolved to /audio/phrases/<slug>.mp3 (the
// EXISTING bucket — speakPraise only looks there). These mastery-mode results were
// never in praise.js, so they fell to TTS; fold them into the phrases generation.
export const PRAISE = {
  mastered: 'Mastered!',
  redraw: 'Almost — try those letters again!',
  retype: 'Almost — try typing it again!',
};

export const UI_PHRASES = Object.values(PRAISE);
