// src/audio.js — multisensory feedback: spoken dictation/praise + synth SFX.
//
// Two engines (HANDOFF §4):
//   - Web Speech (`speechSynthesis`) reads the target word aloud (dictation) and
//     speaks speed-tier / combo praise — the design's "key" requirement.
//   - Web Audio synthesizes short chimes/zaps/fanfares for INSTANT feedback on
//     every answer (no asset files; TTS alone lags if queued every tap).
//
// iOS unlock: audio + speech must be started by a USER GESTURE — `prime()` is
// called from the first tap (see app.js). Everything is wrapped so a browser
// with no audio/voices (e.g. headless Playwright) degrades silently, never throws.
// This is a UI module — never imported by `node --test`.

let actx = null; // Web Audio context (created on prime)
let primed = false;
let voices = [];
let settings = { voice: true, volume: 0.85, voiceName: null };

export function configure(s) {
  settings = { ...settings, ...s };
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

// Unlock audio during a user gesture. Resumes/creates the AudioContext and
// "warms up" speechSynthesis with a near-silent utterance so later speech works.
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

// Stop any in-flight speech immediately (called when changing screens).
export function stop() {
  try {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}

// English voices for the Settings picker.
export function listVoices() {
  loadVoices();
  return voices.filter((v) => /^en/i.test(v.lang));
}

function speak(text, { rate = 1, pitch = 1 } = {}) {
  if (!settings.voice || !text) return;
  try {
    if (!window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(String(text));
    const v = pickVoice();
    if (v) u.voice = v;
    u.rate = rate;
    u.pitch = pitch;
    u.volume = settings.volume ?? 1;
    window.speechSynthesis.cancel(); // never queue — keeps feedback snappy
    window.speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}

// Dictation: clear and only slightly slowed — too slow sounds robotic. Calls
// `onDone` when the word has FINISHED being spoken (so the rhythm meter can wait
// until then before the clock starts). A fallback timer guarantees `onDone` fires
// even on engines that never emit `onend` (or when speech is muted/unavailable),
// estimating the spoken duration from the word length.
export function say(word, { onDone } = {}) {
  const text = String(word || '');
  const estMs = 650 + text.length * 95; // rough spoken length
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    if (typeof onDone === 'function') onDone();
  };

  if (!settings.voice || !text) {
    setTimeout(finish, 200); // no dictation, but still hand control back promptly
    return;
  }
  try {
    if (!window.speechSynthesis) {
      setTimeout(finish, estMs);
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice();
    if (v) u.voice = v;
    u.rate = 0.92;
    u.pitch = 1.02;
    u.volume = settings.volume ?? 1;
    u.onend = finish;
    u.onerror = finish;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    setTimeout(finish, estMs + 600); // safety net if onend never arrives
  } catch {
    setTimeout(finish, estMs);
  }
}

// Spoken praise: warm + natural (only fired on speed tiers / combos by callers).
export function speakPraise(phrase) {
  speak(phrase, { rate: 1.0, pitch: 1.1 });
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

// Distinct, pleasant cues per outcome. `miss` is gentle + low — never a harsh
// buzzer (HANDOFF §4: wrong answers stay encouraging).
export function sfx(type) {
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
