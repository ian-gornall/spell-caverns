// src/audio.js — multisensory feedback: spoken dictation/praise + synth SFX.
//
// Voice (dictation + spoken praise) prefers PRE-GENERATED neural-TTS clips
// (audio/words/<slug>.mp3, audio/phrases/<slug>.mp3, listed in audio/manifest.json
// — see scripts/gen_audio.mjs) because browser speechSynthesis sounds robotic. If a
// clip isn't available it falls back to Web Speech, so the app always has a voice.
// Web Audio synthesizes short chimes/zaps/fanfares for INSTANT feedback on every
// answer (TTS alone lags if queued every tap).
//
// iOS unlock: audio + speech must be started by a USER GESTURE — `prime()` is
// called from the first tap (see app.js). Everything is wrapped so a browser with
// no audio/voices (e.g. headless Playwright) degrades silently, never throws.
// This is a UI module — never imported by `node --test`.

import { createVoiceQueue } from './engine/voicequeue.js';

// All spoken output (dictation + praise) runs through ONE serial queue (§36 B1/B2):
// a new utterance waits for the prior one to FINISH, so praise never overlaps the
// next word's dictation and a fast re-trigger can't start a clip mid-phrase.
const voiceQueue = createVoiceQueue();

let actx = null; // Web Audio context (created on prime)
let primed = false;
let voices = [];
let settings = { voice: true, volume: 0.85, voiceName: null, voiceRate: 0.85 };

// Pre-generated clip manifest (sets of slugs) + reusable <audio> players.
let manifest = null; // { words:Set, phrases:Set } once loaded
let manifestPromise = null;
let clipEl = null; // dictation player
let praiseEl = null; // praise player

// Must match the slug() in scripts/gen_audio.mjs so runtime lookups hit the files.
function slug(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// Windows can't name a file after a reserved device name (con, prn, aux, nul, com1-9, lpt1-9),
// so such word clips are stored with a trailing '_' (con → con_.mp3); the manifest keeps the
// LOGICAL slug. Map slug → on-disk filename for the fetch. (Only "con" occurs in the dataset.)
const WIN_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
const clipFile = (s) => (WIN_RESERVED.test(s) ? s + '_' : s);

// Load audio/manifest.json. Absent manifest => Web Speech only (no error). CRUCIALLY this
// RETRIES on failure: a single transient miss (offline blip, or a load that happened before
// the clips finished deploying) must NOT permanently strand a long-lived (installed-PWA)
// session on the robotic device voice. On any non-OK/throw we clear manifestPromise so the
// next say()/speakPraise()/prime() re-attempts; once loaded we short-circuit forever.
function ensureManifest() {
  if (manifest) return Promise.resolve(); // already loaded — done
  if (manifestPromise) return manifestPromise; // a load is already in flight
  manifestPromise = (async () => {
    try {
      const res = await fetch('/audio/manifest.json', { cache: 'no-cache' });
      if (res.ok) {
        const m = await res.json();
        manifest = {
          words: new Set(m.words || []),
          phrases: new Set(m.phrases || []),
          ui: new Set(m.ui || []), // fixed interface narration (§32.A)
        };
      } else {
        manifestPromise = null; // non-OK (e.g. a stale 404) — allow a retry next call
      }
    } catch {
      manifestPromise = null; // transient/offline failure — allow a retry next call
    }
  })();
  return manifestPromise;
}
ensureManifest(); // kick off early (harmless if it 404s — it'll retry on the first dictation)

export function configure(s) {
  settings = { ...settings, ...s };
}

// Resolve once the clip manifest has loaded (or definitively failed). The onboarding
// "Tap to start" gate (§32.B) awaits this AFTER prime() so the very FIRST spoken line
// goes through the clip path — without it, the first utterance can race the manifest
// load and fall back to device TTS (a different voice than the clips that follow).
export async function whenReady() {
  try {
    await ensureManifest();
  } catch {
    /* manifest optional — say() still works via the TTS fallback */
  }
}

export function isPrimed() {
  return primed;
}

function loadVoices() {
  try {
    voices = window.speechSynthesis ? window.speechSynthesis.getVoices() || [] : [];
  } catch {
    voices = [];
  }
  return voices;
}

// Voices can populate asynchronously; refresh when the browser signals it.
try {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
  }
} catch {
  /* ignore */
}

// A 0.05s silent WAV — played (muted) during the gesture to unlock <audio> on iOS
// so later programmatic clip playback (on auto-advance) is allowed.
const SILENT_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

// Unlock audio during a user gesture: resume the AudioContext, warm up
// speechSynthesis, and unlock the reusable <audio> players (iOS needs all three).
export function prime() {
  if (primed) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) {
      actx = actx || new AC();
      if (actx.state === 'suspended') actx.resume();
    }
  } catch {
    /* no Web Audio */
  }
  try {
    if (window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      window.speechSynthesis.speak(u);
      loadVoices();
    }
  } catch {
    /* no speech */
  }
  try {
    clipEl = clipEl || new Audio();
    praiseEl = praiseEl || new Audio();
    for (const a of [clipEl, praiseEl]) {
      a.muted = true;
      a.src = SILENT_WAV;
      const p = a.play();
      if (p && p.then) p.then(() => { a.pause(); a.muted = false; }).catch(() => { a.muted = false; });
      else a.muted = false;
    }
  } catch {
    /* no HTMLAudio */
  }
  ensureManifest();
  primed = true;
}

// Names/markers of the higher-quality (neural/natural) voices shipped by the
// major platforms — picking one of these over the default makes dictation sound
// far less robotic (play-test feedback). Ordered best-effort, most-natural first.
const NICE_VOICE = /natural|neural|premium|enhanced|siri|aria|jenny|guy|ava|samantha|allison|serena|google\s+(uk|us)|google us english/i;

function scoreVoice(v) {
  let s = 0;
  if (/^en[-_]?us/i.test(v.lang)) s += 3;
  else if (/^en/i.test(v.lang)) s += 2;
  if (NICE_VOICE.test(v.name)) s += 5;
  if (v.localService) s += 1; // local = no network hiccup mid-word
  return s;
}

function pickVoice() {
  if (!voices.length) loadVoices();
  if (settings.voiceName) {
    const named = voices.find((v) => v.name === settings.voiceName);
    if (named) return named;
  }
  // Prefer a natural-sounding English voice; fall back to any English, then any.
  const english = voices.filter((v) => /^en/i.test(v.lang));
  const pool = english.length ? english : voices;
  if (!pool.length) return null;
  return pool.slice().sort((a, b) => scoreVoice(b) - scoreVoice(a))[0];
}

// Hard-silence the actual audio (speech + both clip players). Does NOT touch the queue.
function hardStopAudio() {
  clearTimeout(ttsSpeakTimer); // a deferred speakTTS speak() must not fire after a stop
  try {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
  for (const a of [clipEl, praiseEl]) {
    if (!a) continue;
    try {
      a.pause();
    } catch {
      /* ignore */
    }
  }
}

// Stop any in-flight voice immediately (speech + clip players) when changing screens.
// Drains the serial queue first (force-finishing the active job + dropping pending so
// no awaiter hangs), then hard-silences the actual audio. clear() does NOT fire the
// jobs' caller-onDone callbacks, so navigating away can't start a stale gem clock.
export function stop() {
  voiceQueue.clear();
  hardStopAudio();
}

// English voices for the Settings picker.
export function listVoices() {
  loadVoices();
  return voices.filter((v) => /^en/i.test(v.lang));
}

// Speak via Web Speech (the fallback path). Calls `onDone` when finished, with a
// length-based safety timer for engines that never fire `onend`.
//
// §39 iOS WebKit hardening (lessons-mode research words have NO clips, so this path
// must actually speak): (1) keep a module-level reference to the active utterance —
// iOS garbage-collects an unreferenced one MID-SPEECH and the audio just stops;
// (2) only cancel() when something is speaking/pending — an idle cancel() can wedge
// the synthesizer; (3) defer speak() ~60ms after a cancel() and resume() first —
// iOS silently drops a speak() issued in the same tick as cancel(), and leaves the
// synthesizer PAUSED after <audio> playback (our clips), which also swallows speech.
let ttsUtterance = null; // module-level: keeps the active utterance out of GC's reach
let ttsSpeakTimer = null; // the pending deferred speak(); superseded by a newer call

function speakTTS(text, { rate = 1, pitch = 1, onDone } = {}) {
  const done = onceFn(onDone);
  // estimate duration, scaled by rate so the safety timer doesn't fire before a SLOW
  // (low-rate) utterance finishes — otherwise dictation would "end" early.
  const estMs = (650 + String(text).length * 95) / Math.max(0.5, rate);
  if (!settings.voice || !text) {
    setTimeout(done, 160);
    return;
  }
  try {
    const synth = window.speechSynthesis;
    if (!synth) {
      setTimeout(done, estMs);
      return;
    }
    const u = new SpeechSynthesisUtterance(String(text));
    const v = pickVoice();
    if (v) u.voice = v;
    u.rate = rate;
    u.pitch = pitch;
    u.volume = settings.volume ?? 1;
    u.onend = done;
    u.onerror = done;
    ttsUtterance = u;
    if (synth.speaking || synth.pending) synth.cancel(); // never queue — keeps feedback snappy
    clearTimeout(ttsSpeakTimer); // a superseded deferred speak must not fire after our cancel
    ttsSpeakTimer = setTimeout(() => {
      try {
        synth.resume();
        synth.speak(u);
        // Off-DOM test hook (mirrors __spokenLog/__clipLog): the text actually handed to
        // the device TTS, so QA can prove the fallback path runs when no clip exists.
        try { (window.__ttsLog = window.__ttsLog || []).push(String(text)); } catch { /* ignore */ }
      } catch {
        done();
      }
    }, 60);
    setTimeout(done, estMs + 700); // safety net (covers the 60ms defer too)
  } catch {
    setTimeout(done, estMs);
  }
}

function onceFn(fn) {
  let called = false;
  return () => {
    if (called) return;
    called = true;
    if (typeof fn === 'function') fn();
  };
}

// Play a pre-generated clip on a reusable <audio>. onDone on 'ended'; onFail on any
// load/play error (caller then falls back to Web Speech).
function playClip(el, url, { onDone, onFail, rate = 1 } = {}) {
  const a = el || new Audio();
  const done = onceFn(onDone);
  const fail = onceFn(onFail);
  // Off-DOM test hook: the ACTUAL clip URL that starts playing (so QA can confirm the audio
  // file matches the displayed word — catches a slug/clip mismatch __spokenLog can't see).
  try { (window.__clipLog = window.__clipLog || []).push(url); } catch { /* ignore */ }
  try {
    a.pause(); // B1: clear any prior playback on this reused element before re-loading
    a.onended = done;
    a.onerror = fail;
    a.volume = settings.volume ?? 1;
    a.playbackRate = rate; // dictation can be slowed via the voice-speed setting
    a.muted = false;
    a.src = url;
    a.currentTime = 0;
    a.load(); // (re)load from the start so playback can't begin mid-phrase on a reused element
    const p = a.play();
    if (p && p.catch) p.catch(fail);
  } catch {
    fail();
  }
  return a;
}

// Dictation: play the word's clip if we have one, else Web Speech. Calls `onDone`
// when the word has FINISHED (so the rhythm meter waits before the clock starts).
export function say(word, { onDone } = {}) {
  const text = String(word || '');
  const cb = onceFn(onDone);
  if (!settings.voice || !text) {
    setTimeout(cb, 160); // silent: no utterance, don't tie up the queue
    return;
  }
  const s = slug(text);
  const rate = settings.voiceRate ?? 0.85; // dictation speed (configurable; default a bit slow)
  // A new dictation/narration SUPERSEDES any stale dictation (a word solved before its clip
  // finished, an onboarding step advance, an idle re-dictate) — drop it and speak now. But
  // NEVER cut praise: preemptDictation preserves protected (praise) jobs, so a new word simply
  // queues right behind any praise still being spoken (the §36 B2 guarantee). We only hard-stop
  // the audio when we actually preempted a PLAYING dictation (not while praise is mid-phrase).
  const preemptedPlaying = voiceQueue.busy && !voiceQueue.activeProtected;
  voiceQueue.preemptDictation();
  if (preemptedPlaying) hardStopAudio();
  voiceQueue.enqueue((finish) => {
    // `done` fires the caller's onDone AND releases the queue for the next utterance,
    // exactly once. (stop()/clear() force-finishes the queue WITHOUT calling cb.)
    const done = onceFn(() => {
      cb();
      finish();
    });
    // Off-DOM test hook (like __puzzleCurrent): record words that ACTUALLY start playing
    // (a preempted/dropped stale dictation never reaches here), so QA can verify the spoken
    // sequence stays in display order — i.e. audio never lags onto the WRONG word (§C1 fix).
    try { (window.__spokenLog = window.__spokenLog || []).push(text); } catch { /* ignore */ }
    // A fixed interface line (§32.A) — Geo's narration, the geode prompts. These are
    // sentences (no slug-collision with a single dictation word) and should speak at a
    // NATURAL pace, NOT the slowed dictation rate. Checked first; words next.
    if (manifest && manifest.ui && manifest.ui.has(s)) {
      clipEl = playClip(clipEl, `/audio/ui/${s}.mp3`, {
        rate: 1,
        onDone: done,
        onFail: () => speakTTS(text, { rate: 1, pitch: 1.02, onDone: done }),
      });
    } else if (manifest && manifest.words.has(s)) {
      clipEl = playClip(clipEl, `/audio/words/${clipFile(s)}.mp3`, {
        rate,
        onDone: done,
        onFail: () => speakTTS(text, { rate, pitch: 1.02, onDone: done }),
      });
    } else {
      if (!manifest) ensureManifest(); // self-heal: (re)load the manifest so later words use clips
      speakTTS(text, { rate, pitch: 1.02, onDone: done });
    }
  });
}

// CURRENTLY UNUSED (the "Sound it out" buttons were disabled 2026-06-18 — iOS TTS
// reads short isolated syllables as letter names instead of blending them). Kept for
// a future revisit with real phoneme audio. See rhythm.js / puzzle.js for the note.
// "Sound it out": dictate a word SYLLABLE BY SYLLABLE (slow, with a gap between
// each) then say the whole word once — a core spelling strategy for a weak speller
// (segment → blend). Uses Web Speech directly (no per-syllable clips exist) at a
// slow rate. Falls back to the whole word if there's only one syllable / none given.
// Degrades silently when voice is off. `onDone` fires after the final whole-word say.
export function saySlow(word, syllables, { onDone } = {}) {
  const cb = onceFn(onDone);
  const text = String(word || '');
  if (!settings.voice || !text) {
    setTimeout(cb, 160);
    return;
  }
  const parts = Array.isArray(syllables) && syllables.length > 1 ? syllables.slice() : null;
  voiceQueue.enqueue((finish) => {
    const done = onceFn(() => {
      cb();
      finish();
    });
    if (!parts) {
      speakTTS(text, { rate: 0.78, pitch: 1.0, onDone: done });
      return;
    }
    let i = 0;
    const next = () => {
      if (i >= parts.length) {
        // a beat, then the whole word at a gentle pace to "blend" the parts
        setTimeout(() => speakTTS(text, { rate: 0.85, pitch: 1.0, onDone: done }), 260);
        return;
      }
      const part = parts[i++];
      speakTTS(part, { rate: 0.7, pitch: 1.02, onDone: () => setTimeout(next, 300) });
    };
    next();
  });
}

// Spoken praise: prefer the clip; warm + natural Web Speech otherwise. (Only fired
// on speed tiers / combos by callers, so it never lags the per-tap feedback.) Calls
// `onDone` when the phrase has FINISHED so the rhythm loop can hold the next word's
// dictation until then — otherwise dictation cancels praise mid-word (HANDOFF §12).
export function speakPraise(phrase, { onDone } = {}) {
  const cb = onceFn(onDone);
  if (!settings.voice || !phrase) {
    setTimeout(cb, 0);
    return;
  }
  const s = slug(phrase);
  // protected: praise plays to completion; a following dictation waits for it.
  voiceQueue.enqueue(
    (finish) => {
      const done = onceFn(() => {
        cb();
        finish();
      });
      if (manifest && manifest.phrases.has(s)) {
        praiseEl = playClip(praiseEl, `/audio/phrases/${s}.mp3`, {
          onDone: done,
          onFail: () => speakTTS(phrase, { rate: 1.0, pitch: 1.1, onDone: done }),
        });
      } else {
        if (!manifest) ensureManifest(); // self-heal: (re)load the manifest so later praise uses clips
        speakTTS(phrase, { rate: 1.0, pitch: 1.1, onDone: done });
      }
    },
    { protected: true },
  );
}

// --- Web Audio synth SFX -----------------------------------------------------

function tone(freq, startAt, dur, type = 'sine', gain = 0.2) {
  if (!actx) return;
  const o = actx.createOscillator();
  const g = actx.createGain();
  o.type = type;
  o.frequency.value = freq;
  const t0 = actx.currentTime + startAt;
  const vol = gain * (settings.volume ?? 1);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(actx.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.03);
}

// Subtle haptic to pair with the SFX (research Tier 3 #12). The target is iPad
// Safari, which has NO Vibration API, so this is a silent no-op there — it only
// adds a light buzz on Android/Chromebook (the audience spans ages 5-13 / devices).
// Independent of the audio context, so it works even if Web Audio failed to init.
const HAPTIC = { perfect: 18, amazing: 14, great: 12, good: 10, combo: [10, 30, 12, 30, 22], miss: 30, gem: 8 };
function haptic(type) {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate && HAPTIC[type] != null) {
      navigator.vibrate(HAPTIC[type]);
    }
  } catch {
    /* ignore */
  }
}

// Distinct, pleasant cues per outcome. `miss` is gentle + low — never a harsh
// buzzer (HANDOFF §4: wrong answers stay encouraging).
export function sfx(type) {
  haptic(type);
  if (!actx) return;
  try {
    switch (type) {
      case 'perfect':
        [880, 1175, 1568, 2093].forEach((f, i) => tone(f, i * 0.055, 0.18, 'triangle', 0.22));
        break;
      case 'amazing':
        [784, 1047, 1319].forEach((f, i) => tone(f, i * 0.06, 0.17, 'triangle', 0.2));
        break;
      case 'great':
        [659, 988].forEach((f, i) => tone(f, i * 0.06, 0.16, 'sine', 0.2));
        break;
      case 'good':
        tone(659, 0, 0.16, 'sine', 0.18);
        break;
      case 'combo':
        [1047, 1319, 1568, 2093, 2637].forEach((f, i) => tone(f, i * 0.05, 0.22, 'triangle', 0.2));
        break;
      case 'miss':
        tone(330, 0, 0.18, 'sine', 0.14);
        tone(247, 0.09, 0.24, 'sine', 0.12);
        break;
      case 'tap':
        tone(523, 0, 0.05, 'square', 0.07);
        break;
      case 'gem':
        [1320, 1760].forEach((f, i) => tone(f, i * 0.04, 0.12, 'triangle', 0.16));
        break;
      default:
        tone(660, 0, 0.12, 'sine', 0.16);
    }
  } catch {
    /* ignore */
  }
}
