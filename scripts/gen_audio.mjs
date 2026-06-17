// scripts/gen_audio.mjs — pre-generate high-quality TTS audio with Gemini.
//
// Browser speechSynthesis sounds robotic, so we pre-render the dictation words and
// the fixed praise/gentle phrases to MP3 using a Gemini neural TTS voice, ONCE, on
// this machine (the API key never ships in the PWA). The app then just plays the
// files and falls back to Web Speech only for anything not yet generated.
//
// Output: audio/words/<slug>.mp3, audio/phrases/<slug>.mp3, audio/manifest.json.
// RESUMABLE: existing files are skipped, so it's safe to re-run / continue later
// (free-tier rate limits mean this is generated in batches).
//
// Usage:
//   GEMINI_API_KEY=... node scripts/gen_audio.mjs [what] [limit]
//     what  = phrases | words | all   (default: all)
//     limit = max NEW clips to make this run (default: 100000)
//   Env: GEMINI_VOICE (default Kore), GEMINI_TTS_MODEL, AUDIO_KBPS (default 64),
//        GEN_DELAY_MS (default 1400), AUDIO_DIR (default ./audio)
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
const MODEL = process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts';
const VOICE = process.env.GEMINI_VOICE || 'Kore';
const KBPS = parseInt(process.env.AUDIO_KBPS || '64', 10);
const DELAY_MS = parseInt(process.env.GEN_DELAY_MS || '1400', 10);
const AUDIO_DIR = process.env.AUDIO_DIR || path.join(process.cwd(), 'audio');

const what = (process.argv[2] || 'all').toLowerCase();
const limit = parseInt(process.argv[3] || '100000', 10);

const Mp3Encoder = lame.Mp3Encoder;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Shared with audio.js: a filesystem/url-safe slug for a word or phrase.
export function slug(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function ensureDir(d) {
  fs.mkdirSync(d, { recursive: true });
}

// raw 16-bit PCM (mono) -> MP3 bytes
function pcmToMp3(pcm, sampleRate) {
  const samples = new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.length / 2));
  const enc = new Mp3Encoder(1, sampleRate, KBPS);
  const out = [];
  const block = 1152;
  for (let i = 0; i < samples.length; i += block) {
    const chunk = enc.encodeBuffer(samples.subarray(i, i + block));
    if (chunk.length) out.push(Buffer.from(chunk));
  }
  const tail = enc.flush();
  if (tail.length) out.push(Buffer.from(tail));
  return Buffer.concat(out);
}

// One TTS call -> MP3 buffer. Throws on HTTP error (caller handles 429 backoff).
async function ttsToMp3(text) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;
  const body = {
    contents: [{ parts: [{ text }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } },
    },
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    err.retryAfter = parseInt(res.headers.get('retry-after') || '0', 10);
    try {
      err.detail = (await res.json())?.error?.message;
    } catch {
      /* ignore */
    }
    throw err;
  }
  const j = await res.json();
  const inl = j?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
  if (!inl?.data) throw new Error('no audio in response');
  const rate = parseInt((inl.mimeType.match(/rate=(\d+)/) || [])[1] || '24000', 10);
  return pcmToMp3(Buffer.from(inl.data, 'base64'), rate);
}

// Build the work list: { dir, slug, text } for every target we might generate.
function targets() {
  const list = [];
  if (what === 'phrases' || what === 'all') {
    const phrases = new Set();
    for (const t of SPEED_TIERS) for (const p of t.phrases) phrases.add(p);
    for (const p of GENTLE_PHRASES) phrases.add(p);
    for (const p of COMBO_PHRASES) if (!p.includes('{')) phrases.add(p); // templated ones stay Web-Speech
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

// The manifest is derived from what's actually ON DISK (the .mp3 filenames are
// already slugs), so it always matches reality and survives interrupted runs.
function saveManifest() {
  const listSlugs = (sub) =>
    fs
      .readdirSync(path.join(AUDIO_DIR, sub))
      .filter((f) => f.endsWith('.mp3'))
      .map((f) => f.replace(/\.mp3$/, ''))
      .sort();
  const m = {
    format: 'mp3',
    voice: VOICE,
    model: MODEL,
    words: listSlugs('words'),
    phrases: listSlugs('phrases'),
  };
  fs.writeFileSync(path.join(AUDIO_DIR, 'manifest.json'), JSON.stringify(m, null, 0));
  return m;
}

async function main() {
  ensureDir(path.join(AUDIO_DIR, 'words'));
  ensureDir(path.join(AUDIO_DIR, 'phrases'));

  const all = targets();
  // pending = not already on disk
  const pending = all.filter((t) => !fs.existsSync(path.join(AUDIO_DIR, t.kind, `${t.slug}.mp3`)));
  console.log(
    `targets: ${all.length} total, ${all.length - pending.length} already done, ${pending.length} pending. Making up to ${limit} this run (voice=${VOICE}, model=${MODEL}, ${KBPS}kbps).`,
  );

  let made = 0;
  let consecutive429 = 0;
  for (const t of pending) {
    if (made >= limit) break;
    const outPath = path.join(AUDIO_DIR, t.kind, `${t.slug}.mp3`);
    try {
      const mp3 = await ttsToMp3(t.text);
      fs.writeFileSync(outPath, mp3);
      made += 1;
      consecutive429 = 0;
      if (made % 10 === 0 || made === 1) {
        console.log(`  [${made}] ${t.kind}/${t.slug}.mp3 (${mp3.length}b) "${t.text}"`);
      }
      if (made % 25 === 0) saveManifest(); // checkpoint so progress survives interruption
      await sleep(DELAY_MS);
    } catch (e) {
      if (e.status === 429) {
        consecutive429 += 1;
        const wait = Math.min(60000, (e.retryAfter || 0) * 1000 || 5000 * consecutive429);
        console.warn(`  rate limited (429). backing off ${wait}ms [${consecutive429}]`);
        if (consecutive429 >= 6) {
          console.warn('  too many 429s — stopping; re-run later to resume.');
          break;
        }
        await sleep(wait);
      } else {
        console.warn(`  skip "${t.text}" (${e.status || ''} ${e.message}${e.detail ? ': ' + e.detail : ''})`);
        await sleep(DELAY_MS);
      }
    }
  }

  const m = saveManifest();
  console.log(
    `done: made ${made} new clip(s). manifest now has ${m.words.length} words + ${m.phrases.length} phrases.`,
  );
}

main().catch((e) => {
  console.error('fatal:', e);
  process.exit(1);
});
