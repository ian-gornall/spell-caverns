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

// Start a recogniser that emits detected LETTERS (via onLetters) as the child spells. Returns
// { start, stop } or null if unsupported. Tuned for iOS Safari, which is fussy: `continuous`
// is unreliable, so we run SINGLE-SHOT and RESTART after each phrase; `interimResults` is on so
// partial guesses surface immediately; and we emit only the NEW letters of the growing transcript
// (so "see" → c, then "see ay" → a, without re-placing c). Restarts only fire while `running`.
//   onLetters(fresh[])     — newly recognised letters since the last event in this phrase
//   onTranscript(text, fin)— the raw transcript so far (for the on-screen "heard:" readout)
//   onState(s)             — 'listening' | 'hearing' (audio detected) | 'speech' | 'stopped'
//   onError(code)          — the recogniser error code (e.g. not-allowed / network / no-speech)
// start() must be called inside a user gesture (iOS mic-permission rule); a denial → onError('not-allowed').
export function createLetterRecognizer({ onLetters, onTranscript, onState, onError } = {}) {
  const Ctor = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = 'en-US';
  rec.continuous = false; // iOS ignores/!supports continuous reliably — restart instead
  rec.interimResults = true;
  rec.maxAlternatives = 3;
  let running = false;
  let emitted = 0; // letters already emitted for the CURRENT phrase (reset each restart)

  rec.onresult = (e) => {
    // Build the full transcript so far across results (best alternative that yields letters).
    let full = '';
    for (let i = 0; i < e.results.length; i++) {
      const r = e.results[i];
      let alt = r[0] ? r[0].transcript : '';
      for (let a = 0; a < r.length; a++) {
        if (lettersFromTranscript(r[a].transcript).length) { alt = r[a].transcript; break; }
      }
      full += ' ' + alt;
    }
    full = full.trim();
    const letters = lettersFromTranscript(full);
    if (letters.length > emitted) {
      const fresh = letters.slice(emitted);
      emitted = letters.length;
      if (onLetters) onLetters(fresh);
    }
    if (onTranscript) onTranscript(full, !!(e.results[e.results.length - 1] || {}).isFinal);
  };
  rec.onaudiostart = () => onState && onState('hearing');
  rec.onspeechstart = () => onState && onState('speech');
  rec.onerror = (e) => onError && onError((e && e.error) || 'error');
  rec.onend = () => {
    emitted = 0; // the next phrase starts fresh
    if (running) {
      try {
        rec.start(); // keep listening (single-shot ended) — same session, no new gesture needed on most builds
      } catch {
        /* a restart can throw transiently; the next onend retries */
      }
    } else if (onState) {
      onState('stopped');
    }
  };
  return {
    start() {
      running = true;
      emitted = 0;
      try {
        rec.start();
        onState && onState('listening');
      } catch (err) {
        onError && onError((err && err.name) || 'start-failed');
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
