// scripts/audit_clips.mjs — transcribe EVERY word clip with Whisper (transformers.js, in a
// headless browser; no ffmpeg/python) and compare what's SPOKEN to the filename, to find clips
// whose audio is mislabeled (the §gen_audio batch-split misalignment — e.g. documents.mp3 says
// "purpose"). Read-only: writes a report to scripts/_clip_audit.json, modifies NO audio.
// Run: npm start (server on :5173), then: node scripts/audit_clips.mjs
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { WORDS } from '../data/words.js';

const URL = process.env.URL || 'http://localhost:5173';
// NOTE: matches the app's slug (audio.js / gen_audio) — UNDERSCORE separator, not hyphen.
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
const norm = (s) => String(s).toLowerCase().replace(/[^a-z]/g, '');

// WORDS env (comma-separated) limits the audit to a subset (used to VERIFY a remap) and writes
// the report to _clip_audit_verify.json instead of clobbering the full audit.
const SUBSET = process.env.WORDS ? process.env.WORDS.split(',').map((s) => s.trim()).filter(Boolean) : null;
const OUTFILE = SUBSET ? 'scripts/_clip_audit_verify.json' : 'scripts/_clip_audit.json';
const words = (SUBSET || WORDS.map((w) => w.word)).filter((w) => slug(w) && w.length >= 1);
const browser = await chromium.launch();
const ctx = await browser.newContext({ bypassCSP: true });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'networkidle' });

console.log(`loading Whisper… (transcribing ${words.length} clips; first run downloads ~75MB)`);
await page.evaluate(async () => {
  const { pipeline, env } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');
  env.allowLocalModels = false;
  window.__asr = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en');
  window.__ac = new (window.AudioContext || window.webkitAudioContext)();
  window.__tx = async (w) => {
    try {
      const file = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(w) ? w + '_' : w; // Windows-reserved → con_.mp3
      const r = await fetch(`/audio/words/${file}.mp3`);
      if (!r.ok) return { miss: true };
      const buf = await window.__ac.decodeAudioData(await r.arrayBuffer());
      const off = new OfflineAudioContext(1, Math.ceil(buf.duration * 16000), 16000);
      const src = off.createBufferSource(); src.buffer = buf; src.connect(off.destination); src.start();
      const pcm = (await off.startRendering()).getChannelData(0);
      const t = await window.__asr(pcm);
      return { text: (t.text || '').trim(), dur: +buf.duration.toFixed(3) };
    } catch (e) { return { err: String(e).slice(0, 60) }; }
  };
});

const results = [];
const CHUNK = 25;
for (let i = 0; i < words.length; i += CHUNK) {
  const batch = words.slice(i, i + CHUNK);
  const got = await page.evaluate(async (batch) => {
    const out = [];
    for (const w of batch) out.push([w, await window.__tx(w)]);
    return out;
  }, batch.map(slug));
  for (let k = 0; k < batch.length; k++) {
    const word = batch[k];
    const r = got[k][1];
    const heard = r.text || '';
    const status = r.miss ? 'missing-file' : r.err ? 'err' : norm(heard) === norm(word) ? 'ok' : 'MISMATCH';
    results.push({ word, slug: slug(word), heard, dur: r.dur, status });
  }
  const done = Math.min(i + CHUNK, words.length);
  const mm = results.filter((x) => x.status === 'MISMATCH').length;
  console.log(`  ${done}/${words.length}  (mismatches so far: ${mm})`);
}

const mism = results.filter((x) => x.status === 'MISMATCH');
const summary = {
  total: results.length,
  ok: results.filter((x) => x.status === 'ok').length,
  mismatch: mism.length,
  missing: results.filter((x) => x.status === 'missing-file').length,
  err: results.filter((x) => x.status === 'err').length,
};
writeFileSync(OUTFILE, JSON.stringify({ summary, results }, null, 0));
console.log('\n=== SUMMARY ===', JSON.stringify(summary));
console.log('first 25 mismatches (file → heard):');
for (const m of mism.slice(0, 25)) console.log(`  ${m.slug.padEnd(16)} → "${m.heard}"`);
console.log('\nfull report: scripts/_clip_audit.json');
await browser.close();
