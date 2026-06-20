// src/speech.js — §32 VOICE SPELLING input: the child spells a word ALOUD and we detect the
// letters. Two parts:
//   - lettersFromTranscript(text): PURE — map a recogniser transcript ("see", "ay", "tee", or
//     single chars) to letters (c, a, t). Unit-tested under node.
//   - speechSupported() / createLetterRecognizer(): a thin wrapper over the browser Web Speech
//     API (SpeechRecognition / webkitSpeechRecognition). Browser-only.
//
// PRIVACY (§32): Web Speech streams audio to the platform's speech service (Apple/Google) to
// transcribe it. We use it SOLELY to turn spoken letters into text, never store the audio, and
// gate it behind a one-time GROWN-UP consent (COPPA "voice as a replacement for written input"
// exception). See PRIVACY.md. No good offline browser letter-speech recogniser exists today.

// Spoken forms → letter. Covers the letter NAMES (and their common homophones) a recogniser
// tends to return when a child says a single letter. "double u/you" is handled before tokenising.
const SOUNDS = {
  a: 'a', ay: 'a', eh: 'a',
  b: 'b', be: 'b', bee: 'b', bea: 'b',
  c: 'c', see: 'c', sea: 'c', si: 'c', cee: 'c',
  d: 'd', de: 'd', dee: 'd',
  e: 'e', ee: 'e', ea: 'e',
  f: 'f', ef: 'f', eff: 'f',
  g: 'g', ge: 'g', gee: 'g', jee: 'g',
  h: 'h', aitch: 'h', haitch: 'h', aytch: 'h',
  i: 'i', eye: 'i', ai: 'i',
  j: 'j', jay: 'j', jae: 'j',
  k: 'k', kay: 'k', kaye: 'k',
  l: 'l', el: 'l', ell: 'l',
  m: 'm', em: 'm', emm: 'm',
  n: 'n', en: 'n', enn: 'n',
  o: 'o', oh: 'o', ow: 'o',
  p: 'p', pe: 'p', pee: 'p', pea: 'p',
  q: 'q', cue: 'q', queue: 'q', kew: 'q', kyu: 'q', qu: 'q',
  r: 'r', ar: 'r', are: 'r', arr: 'r',
  s: 's', es: 's', ess: 's',
  t: 't', te: 't', tee: 't', tea: 't',
  u: 'u', you: 'u', yu: 'u', yoo: 'u', ewe: 'u',
  v: 'v', ve: 'v', vee: 'v',
  w: 'w', dub: 'w', dubya: 'w',
  x: 'x', ex: 'x', eks: 'x',
  y: 'y', why: 'y', wye: 'y',
  z: 'z', ze: 'z', zee: 'z', zed: 'z',
};

// Map a recogniser transcript to the ordered list of letters it spells. Unknown WORDS (e.g. the
// whole word "cat", or filler like "um") are ignored so we never fill a slot with a wrong guess.
export function lettersFromTranscript(text) {
  let t = String(text || '').toLowerCase();
  t = t.replace(/double[\s-]?(u|you|yu)\b/g, ' w '); // "double u/you" → w before tokenising
  const tokens = t.split(/[^a-z]+/).filter(Boolean);
  const out = [];
  for (const tok of tokens) {
    if (Object.prototype.hasOwnProperty.call(SOUNDS, tok)) out.push(SOUNDS[tok]);
  }
  return out;
}

// --- browser Web Speech wrapper (no-op / null under node) -------------------------------------
export function speechSupported() {
  return typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

// Start a continuous recogniser that emits detected LETTERS (via onLetters) as the child spells.
// Returns { start, stop } or null if unsupported. The recogniser auto-restarts after silence while
// active. start() triggers the OS mic-permission prompt; a denial surfaces via onError('not-allowed').
export function createLetterRecognizer({ onLetters, onState, onError } = {}) {
  const Ctor = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = 'en-US';
  rec.continuous = true;
  rec.interimResults = false;
  rec.maxAlternatives = 3;
  let running = false;
  rec.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (!r.isFinal) continue;
      let letters = [];
      for (let a = 0; a < r.length; a++) {
        const ls = lettersFromTranscript(r[a].transcript); // first alternative that yields letters wins
        if (ls.length) {
          letters = ls;
          break;
        }
      }
      if (letters.length && onLetters) onLetters(letters);
    }
  };
  rec.onerror = (e) => onError && onError((e && e.error) || 'error');
  rec.onend = () => {
    if (running) {
      try {
        rec.start(); // keep listening across the recogniser's natural silence timeouts
      } catch {
        /* already started / transient */
      }
    } else if (onState) {
      onState('stopped');
    }
  };
  return {
    start() {
      running = true;
      try {
        rec.start();
        onState && onState('listening');
      } catch {
        onError && onError('start-failed');
      }
    },
    stop() {
      running = false;
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    },
  };
}
