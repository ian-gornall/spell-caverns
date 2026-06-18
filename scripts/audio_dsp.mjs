// scripts/audio_dsp.mjs — tiny PURE audio DSP helpers for the TTS pipeline.
//
// Split out from gen_audio.mjs so it has NO side effects (no API key check, no
// network, no top-level main()) and can run under `node --test`. Browser-agnostic.

export const FULL_SCALE = 32767; // Int16 positive full scale

// Loudness-normalize a mono Int16 PCM segment toward a CONSISTENT level, so clips
// don't jump in volume between words / batches / models (§17.C — the user noticed the
// volume "changes with different voices"). We RMS-normalize for consistent PERCEIVED
// loudness, but cap the gain two ways: never push the PEAK past a ceiling (so we never
// clip/distort), and never over-amplify a near-silent segment. Returns a NEW Int16Array
// (never mutates the input — split segments can share a backing buffer).
//
// targetRms/peakCeil are fractions of full scale; maxGain bounds the boost. The default
// target (~0.14 ≈ −17 dBFS RMS) is a typical normalized-speech level and a reasonable
// match for browser speechSynthesis loudness, so clip↔Web-Speech transitions are gentle.
export function normalizePcm(samples, { targetRms = 0.14, peakCeil = 0.97, maxGain = 6 } = {}) {
  const n = samples.length;
  if (!n) return new Int16Array(0);
  let peak = 0;
  let sumSq = 0;
  for (let i = 0; i < n; i++) {
    const v = samples[i];
    const a = v < 0 ? -v : v;
    if (a > peak) peak = a;
    sumSq += v * v;
  }
  if (peak === 0) return Int16Array.from(samples); // pure silence — copy through
  const rms = Math.sqrt(sumSq / n);
  const targetRmsAbs = targetRms * FULL_SCALE;
  const peakCeilAbs = peakCeil * FULL_SCALE;
  let gain = rms > 0 ? targetRmsAbs / rms : 1;
  gain = Math.min(gain, peakCeilAbs / peak); // never exceed the peak ceiling (no clipping)
  gain = Math.min(gain, maxGain); // don't over-amplify a quiet/near-silent segment
  if (!(gain > 0) || !Number.isFinite(gain)) gain = 1;
  const out = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    let v = Math.round(samples[i] * gain);
    if (v > FULL_SCALE) v = FULL_SCALE;
    else if (v < -FULL_SCALE) v = -FULL_SCALE;
    out[i] = v;
  }
  return out;
}

// RMS of a mono Int16 buffer (used by the normalizer's tests + any QA probe).
export function rmsOf(samples) {
  const n = samples.length;
  if (!n) return 0;
  let sumSq = 0;
  for (let i = 0; i < n; i++) sumSq += samples[i] * samples[i];
  return Math.sqrt(sumSq / n);
}

// Peak absolute amplitude of a mono Int16 buffer.
export function peakOf(samples) {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const a = samples[i] < 0 ? -samples[i] : samples[i];
    if (a > peak) peak = a;
  }
  return peak;
}
