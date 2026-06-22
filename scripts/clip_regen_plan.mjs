// scripts/clip_regen_plan.mjs — from the Whisper audit (_clip_audit.json) + the applied remap
// (_remapped.json), identify the clips that are GENUINELY mislabeled and still need regeneration:
// contiguous runs of mismatches in WORDS order (a bad TTS batch) — minus what the remap fixed.
// Isolated single mismatches (Whisper noise on short/homophone words) are EXCLUDED. Writes the
// regen list to scripts/_regen_targets.json. Read-only on audio. Run: node scripts/clip_regen_plan.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { WORDS } from '../data/words.js';

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const { results } = JSON.parse(readFileSync('scripts/_clip_audit.json', 'utf8'));
const fixed = new Set(existsSync('scripts/_remapped.json') ? JSON.parse(readFileSync('scripts/_remapped.json', 'utf8')) : []);

// index audit results by slug, then walk WORDS order to find contiguous mismatch runs
const bySlug = new Map(results.map((r) => [r.slug, r]));
const ordered = WORDS.map((w) => bySlug.get(slug(w.word))).filter(Boolean);

const runs = [];
let cur = [];
for (const r of ordered) {
  if (r.status === 'MISMATCH' || r.status === 'missing-file') cur.push(r);
  else { if (cur.length) runs.push(cur); cur = []; }
}
if (cur.length) runs.push(cur);

// A real bad batch is anchored on EVIDENCE of a genuine word→word shift, not run length (short
// common words mis-transcribe in noisy runs too). Evidence = the run contains a clip the remap
// already FIXED (verified shift), OR ≥2 clips whose `heard` is a distinctive DIFFERENT long word
// (len≥6, far from its own spelling). Whisper noise (heard = a short/phonetic version of the clip's
// OWN word, e.g. whether→"weather", ten→"10") fails both tests and is left alone.
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z]/g, '');
function lev(a, b) {
  const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}
const distinctiveShift = (r) => { const h = norm(r.heard); return h.length >= 6 && lev(h, norm(r.word)) > 3; };
const badRuns = runs.filter((run) => run.some((r) => fixed.has(r.slug)) || run.filter(distinctiveShift).length >= 2);
const regen = [];
for (const run of badRuns) for (const r of run) if (!fixed.has(r.slug)) regen.push(r.word);
const regenUniq = [...new Set(regen)];

writeFileSync('scripts/_regen_targets.json', JSON.stringify(regenUniq));
console.log(`runs of consecutive mismatches: ${runs.length} (bad batches ≥ threshold: ${badRuns.length})`);
console.log(`remap already fixed: ${fixed.size}`);
console.log(`STILL NEED REGEN: ${regenUniq.length} clips`);
console.log(`(lone mismatches treated as Whisper noise, left alone: ${runs.filter((r) => !badRuns.includes(r)).reduce((n, r) => n + r.length, 0)})`);
console.log('\nbad-batch runs (first 12) — file → heard:');
for (const run of badRuns.slice(0, 12)) {
  console.log(`  [${run.length} clips]`);
  for (const r of run.slice(0, 8)) console.log(`    ${r.slug.padEnd(16)} → "${r.heard || ''}"${fixed.has(r.slug) ? '  (remap-fixed)' : ''}`);
  if (run.length > 8) console.log(`    … +${run.length - 8} more`);
}
// safety: any LONG run (≥5) NOT classified as a bad batch — could be a real batch we missed
const missed = runs.filter((run) => run.length >= 5 && !badRuns.includes(run));
console.log(`\nlong unclassified runs (≥5, treated as noise — sanity check): ${missed.length}`);
for (const run of missed.slice(0, 8)) console.log(`  [${run.length}] ${run.map((r) => `${r.slug}→"${r.heard}"`).slice(0, 6).join('  ')}${run.length > 6 ? ' …' : ''}`);
console.log('\nregen list → scripts/_regen_targets.json');
