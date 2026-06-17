// scripts/gen_audio.mjs — pre-generate high-quality TTS audio with Gemini.
//
// Browser speechSynthesis sounds robotic, so we pre-render the dictation words and
// the fixed praise/gentle phrases to MP3 using a Gemini neural TTS voice, ONCE, on
// this machine (the API key never ships in the PWA). The app plays the files and
// falls back to Web Speech only for anything not yet generated.
//
// FREE-TIER TRICK: the quota is 10 *requests*/day PER MODEL (not per word), so we
// batch many words into ONE request (separated by pauses), then SPLIT the returned
// audio back into per-word clips at the N-1 longest silences (we know the word
// count, so no fragile threshold). With 3 TTS models that's ~30 requests/day ->
// ~1000+ words/day at zero cost. RESUMABLE (skips existing files) and validates
// each split, falling back to smaller batches (down to 1 word) if a split looks off.
//
// Output: audio/words/<slug>.mp3, audio/phrases/<slug>.mp3, audio/manifest.json.
//
// Usage:
//   GEMINI_API_KEY=... node scripts/gen_audio.mjs [what] [maxNewClips]
//     what        = phrases | words | all   (default: all)
//     maxNewClips = stop after this many NEW clips this run (default: 100000)
//   Env: GEMINI_VOICE (Kore), GEMINI_TTS_MODELS (csv, tried in order),
//        BATCH_SIZE (40), AUDIO_KBPS (64), GEN_DELAY_MS (4000), AUDIO_DIR (./audio)
import fs from 'node:fs';
import path from 'node:path';
import * as lame from '@breezystack/lamejs';
import { WORDS } from '../data/words.js';
import { SPEED_TIERS, COMBO_PHRASES, GENTLE_PHRASES } from '../src/engine/praise.js';

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error('Set GEMINI_API_KEY in the environment.');
  process.exit(1);
}
const MODELS = (
  process.env.GEMINI_TTS_MODELS ||
  'gemini-3.1-flash-tts-preview,gemini-2.5-flash-preview-tts,gemini-2.5-pro-preview-tts'
).split(',').map((s) => s.trim()).filter(Boolean);
const VOICE = process.env.GEMINI_VOICE || 'Kore';
const KBPS = parseInt(process.env.AUDIO_KBPS || '64', 10);
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '40', 10);
const DELAY_MS = parseInt(process.env.GEN_DELAY_MS || '4000', 10);
const AUDIO_DIR = process.env.AUDIO_DIR || path.join(process.cwd(), 'audio');

const what = (process.argv[2] || 'all').toLowerCase();
const maxNew = parseInt(process.argv[3] || '100000', 10);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let modelIdx = 0; // current model in MODELS (advances when one hits its daily cap)
let made = 0;

export function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}
const ensureDir = (d) => fs.mkdirSync(d, { recursive: true });
const outPath = (kind, s) => path.join(AUDIO_DIR, kind, `${s}.mp3`);

function pcmToMp3(samples, rate) {
  const enc = new lame.Mp3Encoder(1, rate, KBPS);
  const out = [];
  const block = 1152;
  for (let i = 0; i < samples.length; i += block) {
    const c = enc.encodeBuffer(samples.subarray(i, i + block));
    if (c.length) out.push(Buffer.from(c));
  }
  const tail = enc.flush();
  if (tail.length) out.push(Buffer.from(tail));
  return Buffer.concat(out);
}

// One TTS call -> { samples:Int16Array, rate }. Throws on HTTP error; the error
// carries .status and .perDay (true if the daily quota for this model is spent).
async function ttsCall(text) {
  const model = MODELS[modelIdx];
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } },
      },
    }),
  });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    let msg = '';
    try {
      msg = (await res.json())?.error?.message || '';
    } catch {
      /* ignore */
    }
    err.detail = msg;
    err.perDay = /per day|PerDay/i.test(msg);
    throw err;
  }
  const j = await res.json();
  const inl = j?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
  if (!inl?.data) throw new Error('no audio in response');
  const rate = parseInt((inl.mimeType.match(/rate=(\d+)/) || [])[1] || '24000', 10);
  const pcm = Buffer.from(inl.data, 'base64');
  return { samples: new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.length / 2)), rate };
}

// Split samples into exactly `n` voiced segments by cutting at the n-1 LONGEST
// interior silences. Returns { segs:[[a,b]...], ok:boolean }. ok=false if there
// weren't enough silences or a segment came out implausibly long/short.
function splitIntoN(samples, rate, n) {
  if (n === 1) return { segs: [[0, samples.length]], ok: true };
  const win = Math.floor(rate * 0.01);
  let peak = 1;
  for (let i = 0; i < samples.length; i++) {
    const a = Math.abs(samples[i]);
    if (a > peak) peak = a;
  }
  const thresh = peak * 0.04;
  const rms = [];
  for (let i = 0; i < samples.length; i += win) {
    let s = 0;
    let c = 0;
    for (let k = i; k < i + win && k < samples.length; k++) {
      s += samples[k] * samples[k];
      c++;
    }
    rms.push(Math.sqrt(s / Math.max(1, c)));
  }
  const silent = rms.map((r) => r < thresh);
  const runs = [];
  let st = -1;
  for (let i = 0; i < silent.length; i++) {
    if (silent[i]) {
      if (st < 0) st = i;
    } else if (st >= 0) {
      runs.push([st, i]);
      st = -1;
    }
  }
  if (st >= 0) runs.push([st, silent.length]);
  const interior = runs.filter((r) => r[0] > 0 && r[1] < silent.length);
  if (interior.length < n - 1) return { segs: [], ok: false };
  interior.sort((a, b) => b[1] - b[0] - (a[1] - a[0]));
  const cuts = interior
    .slice(0, n - 1)
    .map((r) => Math.floor(((r[0] + r[1]) / 2) * win))
    .sort((a, b) => a - b);
  const bounds = [0, ...cuts, samples.length];
  const segs = [];
  let ok = true;
  for (let i = 0; i + 1 < bounds.length; i++) {
    let a = bounds[i];
    let b = bounds[i + 1];
    while (a < b && Math.abs(samples[a]) < thresh) a++;
    while (b > a && Math.abs(samples[b - 1]) < thresh) b--;
    a = Math.max(bounds[i], a - win * 2); // tiny pad so we don't clip onsets
    b = Math.min(bounds[i + 1], b + win * 2);
    const dur = (b - a) / rate;
    if (dur < 0.12 || dur > 2.8) ok = false;
    segs.push([a, b]);
  }
  return { segs, ok };
}

// Generate clips for a list of items via ONE batched request + split. On a bad
// split, recurse into halves (more requests, still correct) down to single words.
async function processBatch(items) {
  if (!items.length) return;
  const text = items.map((it) => `${it.text.replace(/[.!?]+\s*$/, '')}.`).join('\n\n');
  let resp;
  try {
    resp = await ttsCall(text);
  } catch (e) {
    if (e.status === 429) throw e; // bubble up to the model-rotation handler
    console.warn(`  skip batch of ${items.length} (${e.status || ''} ${e.detail || e.message})`);
    return;
  }
  const { segs, ok } = splitIntoN(resp.samples, resp.rate, items.length);
  if (items.length > 1 && !ok) {
    // split looked wrong — bisect and retry (each half is its own request)
    const mid = Math.ceil(items.length / 2);
    console.warn(`  split uncertain for ${items.length} words; bisecting`);
    await sleep(DELAY_MS);
    await processBatch(items.slice(0, mid));
    await sleep(DELAY_MS);
    await processBatch(items.slice(mid));
    return;
  }
  items.forEach((it, i) => {
    const [a, b] = segs[i];
    fs.writeFileSync(outPath(it.kind, it.slug), pcmToMp3(resp.samples.subarray(a, b), resp.rate));
    made += 1;
  });
  console.log(
    `  +${items.length} clips (${MODELS[modelIdx]}) e.g. "${items[0].text}"…"${items[items.length - 1].text}" [total ${made}]`,
  );
}

function targets() {
  const list = [];
  if (what === 'phrases' || what === 'all') {
    const phrases = new Set();
    for (const t of SPEED_TIERS) for (const p of t.phrases) phrases.add(p);
    for (const p of GENTLE_PHRASES) phrases.add(p);
    for (const p of COMBO_PHRASES) if (!p.includes('{')) phrases.add(p);
    for (const text of phrases) list.push({ kind: 'phrases', slug: slug(text), text });
  }
  if (what === 'words' || what === 'all') {
    const seen = new Set();
    for (const w of WORDS) {
      if (seen.has(w.word)) continue;
      seen.add(w.word);
      list.push({ kind: 'words', slug: slug(w.word), text: w.word });
    }
  }
  return list;
}

function saveManifest() {
  const listSlugs = (sub) =>
    fs.readdirSync(path.join(AUDIO_DIR, sub)).filter((f) => f.endsWith('.mp3')).map((f) => f.replace(/\.mp3$/, '')).sort();
  const m = { format: 'mp3', voice: VOICE, models: MODELS, words: listSlugs('words'), phrases: listSlugs('phrases') };
  fs.writeFileSync(path.join(AUDIO_DIR, 'manifest.json'), JSON.stringify(m, null, 0));
  return m;
}

async function main() {
  ensureDir(path.join(AUDIO_DIR, 'words'));
  ensureDir(path.join(AUDIO_DIR, 'phrases'));
  const all = targets();
  const pending = all.filter((t) => !fs.existsSync(outPath(t.kind, t.slug)));
  console.log(
    `targets ${all.length}, done ${all.length - pending.length}, pending ${pending.length}. Batch=${BATCH_SIZE}, models=[${MODELS.join(', ')}], voice=${VOICE}.`,
  );

  let i = 0;
  while (i < pending.length && made < maxNew) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    try {
      await processBatch(batch);
      i += batch.length;
      saveManifest();
      await sleep(DELAY_MS);
    } catch (e) {
      if (e.status === 429) {
        if (e.perDay) {
          console.warn(`  ${MODELS[modelIdx]} daily quota reached.`);
          modelIdx += 1;
          if (modelIdx >= MODELS.length) {
            console.warn('  all models hit their daily cap — stopping. Re-run tomorrow to resume.');
            break;
          }
          console.warn(`  switching to ${MODELS[modelIdx]}`);
        } else {
          console.warn('  per-minute rate limit; waiting 30s');
          await sleep(30000);
        }
      } else {
        console.warn('  unexpected error:', e.message);
        i += batch.length; // skip this batch
      }
    }
  }

  const m = saveManifest();
  console.log(`done: ${made} new clip(s). manifest: ${m.words.length} words + ${m.phrases.length} phrases.`);
}

main().catch((e) => {
  console.error('fatal:', e);
  process.exit(1);
});
