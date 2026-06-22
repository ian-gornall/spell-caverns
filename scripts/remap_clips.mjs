// scripts/remap_clips.mjs — fix mislabeled word clips using the Whisper audit
// (scripts/_clip_audit.json from audit_clips.mjs). For each clip whose audio says the WRONG
// word, find the file that actually CONTAINS the target word and copy it into place — a free,
// content-addressed remap of the batch-split misalignment. DRY-RUN by default (prints a plan,
// changes nothing); pass --apply to execute (backs up every touched original to
// audio/words_backup/ first, copies from the BACKED-UP originals so the permutation is safe).
// Words whose audio exists in NO file (garbled batch edges) are listed as UNFIXABLE — they need
// regeneration or a TTS fallback (handled separately, not here). Re-run audit_clips.mjs after to verify.
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';

const APPLY = process.argv.includes('--apply');
const AUDIT = 'scripts/_clip_audit.json';
const WORDS_DIR = 'audio/words';
const BACKUP_DIR = 'audio/words_backup';
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z]/g, '');

if (!existsSync(AUDIT)) { console.error(`No ${AUDIT} — run: node scripts/audit_clips.mjs first.`); process.exit(1); }
const { summary, results } = JSON.parse(readFileSync(AUDIT, 'utf8'));
console.log('audit summary:', JSON.stringify(summary));

// content (what Whisper heard) -> [slugs whose clip says that]. SOURCES are restricted to
// MISMATCHED clips only: we only shuffle audio WITHIN broken batches, never pull from a clip
// Whisper scored "ok" — so a Whisper artifact on a correct clip can't make us overwrite it.
const byContent = new Map();
for (const r of results) {
  if (r.status !== 'MISMATCH') continue;
  const c = norm(r.heard);
  if (!c) continue;
  if (!byContent.has(c)) byContent.set(c, []);
  byContent.get(c).push(r.slug);
}

// Levenshtein — used to REJECT remaps where the source word is a near-homophone of the target
// (e.g. effect←affect, role←roll): there Whisper likely misheard the source's OWN correct audio
// as the target, so remapping would corrupt a good clip. Genuine batch shifts pair unrelated words.
function lev(a, b) {
  const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}

const remaps = []; // { word, from }  copy from.mp3 -> word.mp3
const unfixable = [];
const ambiguous = [];
const homophone = [];
for (const r of results) {
  if (r.status !== 'MISMATCH') continue;
  const want = norm(r.word);
  const files = byContent.get(want) || [];
  if (files.length === 1) {
    const from = files[0];
    if (lev(norm(r.slug), norm(from)) <= 2) homophone.push({ word: r.slug, from }); // too similar → unsafe
    else remaps.push({ word: r.slug, from, heard: r.heard });
  } else if (files.length === 0) unfixable.push({ word: r.slug, heard: r.heard });
  else ambiguous.push({ word: r.slug, heard: r.heard, candidates: files });
}

console.log(`\nMISMATCHED clips: ${results.filter((x) => x.status === 'MISMATCH').length}`);
console.log(`  → fixable by remap (unique source) : ${remaps.length}`);
console.log(`  → UNFIXABLE (no file has that word): ${unfixable.length}`);
console.log(`  → ambiguous (multiple sources)     : ${ambiguous.length}`);
console.log(`  → skipped (near-homophone source)  : ${homophone.length}${homophone.length ? ' [' + homophone.map((h) => `${h.word}←${h.from}`).join(', ') + ']' : ''}`);
writeFileSync('scripts/_remapped.json', JSON.stringify(remaps.map((r) => r.word)));
console.log('\nsample remaps (target ← source-file-that-actually-says-it):');
for (const m of remaps.slice(0, 20)) console.log(`  ${m.word.padEnd(16)} ← ${m.from}.mp3`);
if (unfixable.length) { console.log('\nUNFIXABLE (need regen / TTS fallback):'); console.log('  ' + unfixable.map((u) => u.word).join(', ')); }
if (ambiguous.length) { console.log('\nAMBIGUOUS (skipped — review):'); for (const a of ambiguous.slice(0, 20)) console.log(`  ${a.word} ← [${a.candidates.join(', ')}]`); }

if (!APPLY) { console.log('\nDRY RUN — no files changed. Re-run with --apply to remap (originals backed up to audio/words_backup/).'); process.exit(0); }

// APPLY: back up every source + target original first, then copy from the backups (safe permutation).
mkdirSync(BACKUP_DIR, { recursive: true });
const touched = new Set();
for (const m of remaps) { touched.add(m.from); touched.add(m.word); }
for (const s of touched) {
  const src = path.join(WORDS_DIR, `${s}.mp3`);
  const bak = path.join(BACKUP_DIR, `${s}.mp3`);
  if (existsSync(src) && !existsSync(bak)) copyFileSync(src, bak);
}
let done = 0;
for (const m of remaps) {
  const fromBak = path.join(BACKUP_DIR, `${m.from}.mp3`);
  const dst = path.join(WORDS_DIR, `${m.word}.mp3`);
  if (existsSync(fromBak)) { copyFileSync(fromBak, dst); done += 1; }
}
console.log(`\nAPPLIED ${done} remaps (originals in ${BACKUP_DIR}/). UNFIXABLE: ${unfixable.length} (left as-is — regen/TTS next).`);
console.log('Verify: node scripts/audit_clips.mjs   (mismatches should drop sharply)');
