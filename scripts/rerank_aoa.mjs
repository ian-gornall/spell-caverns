// scripts/rerank_aoa.mjs — re-rank the word list by child AGE-OF-ACQUISITION (Kuperman/
// Brysbaert 2012) instead of adult-literature frequency (Ian 2026-06-22b: "storm before
// relations"). Builds a word→AoA map from the OSF datasets in _aoa/, assigns each word an
// AoA (gaps estimated from current frequency), sorts ascending (earliest-learned = rank 1),
// and derives an age `tier` from AoA. PREVIEW by default (prints, writes nothing); --write
// regenerates data/words.js (same shape; clips are keyed by word, unaffected). Run: node scripts/rerank_aoa.mjs
//
// REPRODUCING the inputs (the _aoa/ datasets are git-ignored — large, free, from OSF project d7x6q):
//   npm i --no-save xlsx && mkdir -p _aoa
//   curl -sL -o _aoa/kuperman_brm.xlsx https://osf.io/download/vb9je/   # Kuperman 2012 30k AoA (Rating.Mean)
//   curl -sL -o _aoa/aoa_51715.xlsx     https://osf.io/download/bx7vm/   # extended 51k list (AoA_Kup)
import XLSX from 'xlsx';
import fs from 'node:fs';
import { WORDS, PATTERNS } from '../data/words.js';

const WRITE = process.argv.includes('--write');
const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
const sheet = (f) => { const wb = XLSX.readFile(f); return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null }); };

// word → AoA (years). Prefer the 51k list (AoA_Kup, then its lemma), then the 30k BRM Rating.Mean.
const aoa = new Map();
for (const r of sheet('_aoa/aoa_51715.xlsx')) { const w = String(r.Word || '').toLowerCase().trim(); const v = num(r.AoA_Kup) ?? num(r.AoA_Kup_lem); if (w && v != null && !aoa.has(w)) aoa.set(w, v); }
for (const r of sheet('_aoa/kuperman_brm.xlsx')) { const w = String(r.Word || '').toLowerCase().trim(); const v = num(r['Rating.Mean']); if (w && v != null && !aoa.has(w)) aoa.set(w, v); }

// estimate AoA for the gap words from frequency: among COVERED words sorted by current rank,
// interpolate the AoA at the gap word's rank (so a gap sits where its frequency-peers' AoA sits).
const covered = WORDS.filter((w) => aoa.has(w.word.toLowerCase())).sort((a, b) => a.rank - b.rank);
const estFromFreq = (rank) => {
  let lo = null, hi = null;
  for (const w of covered) { if (w.rank <= rank) lo = w; if (w.rank >= rank) { hi = w; break; } }
  const la = lo && aoa.get(lo.word.toLowerCase()), ha = hi && aoa.get(hi.word.toLowerCase());
  if (la != null && ha != null) return (la + ha) / 2;
  return la ?? ha ?? 8; // fallback mid
};
const aoaOf = (w) => aoa.get(w.word.toLowerCase()) ?? estFromFreq(w.rank);

// new order: ascending AoA, ties broken by current frequency (more frequent first)
const ranked = WORDS.map((w) => ({ ...w, _aoa: aoaOf(w), _gap: !aoa.has(w.word.toLowerCase()) }))
  .sort((a, b) => a._aoa - b._aoa || a.rank - b.rank);

const tierOf = (a) => Math.min(9, Math.max(1, Math.round(a) - 4)); // AoA years → tier 1..9 (age5→1 … age13→9)
ranked.forEach((w, i) => { w._newRank = i + 1; w._newTier = tierOf(w._aoa); });

// ---- preview ----
const byWord = new Map(ranked.map((w) => [w.word, w]));
const show = (w) => { const e = byWord.get(w); return e ? `${w} (AoA ${e._aoa.toFixed(1)}): rank ${e.rank}→${e._newRank}, tier ${e.tier}→${e._newTier}` : `${w}: not found`; };
console.log(`coverage: ${WORDS.length - WORDS.filter((w) => !aoa.has(w.word.toLowerCase())).length}/${WORDS.length} (${(100 * (1 - WORDS.filter((w) => !aoa.has(w.word.toLowerCase())).length / WORDS.length)).toFixed(1)}%), ${WORDS.filter((w) => !aoa.has(w.word.toLowerCase())).length} gaps`);
console.log('\nNEW first 30 (earliest-acquired):');
console.log('  ' + ranked.slice(0, 30).map((w) => w.word).join(', '));
console.log('\nKEY CHECK — storm vs relations:');
console.log('  ' + show('storm')); console.log('  ' + show('relations'));
console.log('  storm now BEFORE relations?', byWord.get('storm')._newRank < byWord.get('relations')._newRank ? 'YES ✅' : 'NO ❌');
console.log('\nsample movers:'); for (const w of ['cat', 'dog', 'the', 'of', 'documents', 'purpose', 'beautiful', 'question', 'mom', 'water']) console.log('  ' + show(w));
const dist = {}; for (const w of ranked) dist[w._newTier] = (dist[w._newTier] || 0) + 1;
console.log('\nnew tier distribution:', JSON.stringify(dist));
const gaps = ranked.filter((w) => w._gap);
console.log(`\ngap words (${gaps.length}) — placed by frequency estimate, sample:`, gaps.slice(0, 15).map((w) => w.word).join(', '));

if (!WRITE) { console.log('\nPREVIEW ONLY — nothing written. Re-run with --write to regenerate data/words.js.'); process.exit(0); }

// PROPER NOUNS — capitalize the first letter (Ian 2026-06-22b). Conservative, unambiguous set
// (excludes words that are ALSO common: may/march/august/states/united/fall/jan). Display only —
// craft/draw lowercase the target for spelling, and the audio slug is lowercase, so clips/grading
// are unaffected. Capitalizes the word + its occurrences in the sentence.
const PROPER = new Set([
  // continents / regions / oceans
  'europe', 'asia', 'africa', 'america', 'atlantic', 'pacific',
  // countries
  'france', 'germany', 'russia', 'china', 'india', 'canada', 'australia', 'spain', 'england',
  'scotland', 'ireland', 'japan', 'iraq', 'britain', 'mexico', 'italy', 'egypt', 'israel',
  // us states
  'texas', 'california', 'wisconsin', 'minnesota', 'pennsylvania', 'arizona', 'kansas', 'indiana',
  'oregon', 'hawaii', 'florida', 'ohio', 'georgia', 'virginia', 'michigan', 'colorado', 'nevada',
  // cities / places
  'houston', 'seattle', 'london', 'york', 'washington', 'ontario', 'paris', 'boston', 'chicago',
  // person / brand / religious names
  'smith', 'louis', 'john', 'michael', 'david', 'williams', 'harry', 'joe', 'jackson', 'james',
  'paul', 'jones', 'richard', 'mary', 'jesus', 'santa', 'google', 'playstation', 'linux',
  'microsoft', 'sony', 'amazon', 'apple', 'disney',
  // months (unambiguous)
  'january', 'february', 'april', 'june', 'july', 'september', 'october', 'november', 'december',
  // days
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  // nationalities / languages (capitalized in English)
  'english', 'spanish', 'german', 'french', 'japanese', 'greek', 'british', 'american', 'italian',
  'indian', 'asian', 'irish', 'european', 'americans', 'chinese', 'russian', 'latin', 'australian',
  'canadian', 'mexican', 'african', 'european', 'scottish', 'roman', 'arabic',
]);
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const capProper = (w) => {
  if (!PROPER.has(w.word.toLowerCase())) return w;
  const Word = cap(w.word);
  const sentence = (w.sentence || '').replace(new RegExp('\\b' + w.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi'), Word);
  // capitalize the first syllable too, so syllables still join back to the (capitalized) word
  const syllables = Array.isArray(w.syllables) && w.syllables.length ? [cap(w.syllables[0]), ...w.syllables.slice(1)] : w.syllables;
  return { ...w, word: Word, sentence, syllables };
};

// ---- regenerate data/words.js (same shape: rank + tier updated, everything else kept) ----
const outWords = ranked.map((w) => { const { _aoa, _gap, _newRank, _newTier, ...rest } = w; return capProper({ ...rest, rank: _newRank, tier: _newTier }); });
const body = outWords.map((w) => '  ' + JSON.stringify(w)).join(',\n');
const file = `// data/words.js — AUTO-GENERATED. Re-ranked by child AGE-OF-ACQUISITION (Kuperman/Brysbaert\n` +
  `// 2012); rank 1 = earliest-acquired. ${outWords.length} words. Gaps (no AoA) placed by frequency.\n` +
  `import { PATTERNS } from './patterns.js';\nexport { PATTERNS };\nexport const WORDS = [\n${body},\n];\n`;
fs.writeFileSync('data/words.js', file);
console.log('\nWROTE data/words.js (' + outWords.length + ' words, re-ranked by AoA).');
