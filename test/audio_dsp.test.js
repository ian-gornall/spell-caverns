// test/audio_dsp.test.js — PURE loudness normalizer for the TTS pipeline
// (scripts/audio_dsp.mjs). Guards the §17.C fix: clips should land at a consistent
// level without ever clipping. Runs under `node --test` (no browser, no network).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePcm, rmsOf, peakOf, FULL_SCALE } from '../scripts/audio_dsp.mjs';

// A mono Int16 sine of amplitude `amp` (peak), `samples` long.
function sine(amp, samples = 2400, freq = 220, rate = 24000) {
  const out = new Int16Array(samples);
  for (let i = 0; i < samples; i++) out[i] = Math.round(amp * Math.sin((2 * Math.PI * freq * i) / rate));
  return out;
}

test('quiet and loud inputs are normalized to nearly the SAME loudness', () => {
  const quiet = normalizePcm(sine(2000));
  const loud = normalizePcm(sine(30000));
  const rq = rmsOf(quiet);
  const rl = rmsOf(loud);
  // both should sit near the target RMS (~0.14 * full scale) and close to each other
  const target = 0.14 * FULL_SCALE;
  assert.ok(Math.abs(rq - target) / target < 0.1, `quiet RMS ${rq} not near target ${target}`);
  assert.ok(Math.abs(rl - target) / target < 0.1, `loud RMS ${rl} not near target ${target}`);
  assert.ok(Math.abs(rq - rl) / target < 0.1, `quiet(${rq}) and loud(${rl}) should match`);
});

test('normalization never clips: output peak stays under the ceiling', () => {
  for (const amp of [500, 5000, 20000, 32767]) {
    const out = normalizePcm(sine(amp));
    assert.ok(peakOf(out) <= 0.97 * FULL_SCALE + 1, `amp ${amp} -> peak ${peakOf(out)} over ceiling`);
  }
});

test('a peaky, mostly-silent segment is peak-limited (not boosted to clipping)', () => {
  // low RMS, but a couple of full-scale spikes -> RMS-to-target gain would clip; the
  // peak ceiling must win so we never distort.
  const s = new Int16Array(2400);
  s[100] = FULL_SCALE;
  s[1500] = -FULL_SCALE;
  const out = normalizePcm(s);
  assert.ok(peakOf(out) <= 0.97 * FULL_SCALE + 1, `peak ${peakOf(out)} exceeded ceiling`);
});

test('silence stays silent and the input is never mutated', () => {
  const z = new Int16Array(100); // all zeros
  const out = normalizePcm(z);
  assert.equal(peakOf(out), 0, 'silence stays silent (no NaN/garbage)');
  const src = sine(8000);
  const before = Int16Array.from(src);
  normalizePcm(src);
  assert.deepEqual(Array.from(src), Array.from(before), 'normalizePcm must not mutate its input');
});

test('empty input returns an empty buffer', () => {
  assert.equal(normalizePcm(new Int16Array(0)).length, 0);
});
