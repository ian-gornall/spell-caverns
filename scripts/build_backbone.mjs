// scripts/build_backbone.mjs
// Reads the fetched frequency list (data/_raw_freq.txt), filters it down to the
// ~3000 most-common AGE-APPROPRIATE (5-13) words IN FREQUENCY ORDER, then splits
// them into chunk input files that parallel enrichment agents will turn into the
// full rich dataset. rank = frequency position (1 = most common).
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const TARGET = 3000;   // desired final backbone size
const CHUNK = 250;     // words per enrichment chunk

// real 2-letter (and a couple 1-letter) words worth keeping; other <=2-letter tokens are dropped
const VALID_SHORT = new Set([
  'a','i','am','an','as','at','be','by','do','go','he','hi','if','in','is','it',
  'me','my','no','of','oh','on','or','so','to','up','us','we','ox',
]);

// abbreviations / initialisms that slip into web frequency lists
const ABBREV = new Set([
  'mr','mrs','ms','dr','st','ave','etc','vs','inc','ltd','dept','jr','sr','co',
  'pm','am','ad','bc','ok','tv','dvd','cd','pc','id','ip','url','faq','diy','asap',
  'pdf','doc','jpg','png','gif','mp','kb','mb','gb','www','http','https',
]);

// clearly inappropriate-for-school / off-topic adult content (the source already
// strips profanity; this catches sexual/drug/gambling/heavy-adult + web/tech junk
// + bureaucratic jargon a 5-13 year old wouldn't read or want to spell).
const BLOCK = new Set([
  // sexual / mature
  'sex','sexy','sexual','nude','naked','porn','adult','dating','singles','escort',
  'lingerie','bikini','breast','penis','virgin','horny','erotic','intimate',
  // substances / gambling
  'beer','wine','vodka','whiskey','alcohol','liquor','drunk','cigarette','tobacco',
  'cocaine','heroin','marijuana','weed','casino','poker','gambling','betting','lottery','jackpot',
  // crime / heavy violence (kept mild combat words like fight/battle/sword for the gamer)
  'rape','murder','suicide','heroin','cocaine','prostitute','assault','homicide',
  // web / tech / file junk
  'website','online','internet','download','upload','login','logout','username',
  'password','email','server','browser','cookie','blog','blogs','href','html','xml',
  'javascript','php','css','api','url','urls','href','login','signup','newsletter',
  'click','cursor','toolbar','default','config','admin','users','login',
  // finance / legal / corporate / bureaucratic abstractions
  'mortgage','equity','dividend','invoice','liability','revenue','corporate',
  'investor','shareholder','taxation','remittance','collateral','amortization',
  'plaintiff','defendant','jurisdiction','pursuant','hereby','thereof','wherein',
  'liaison','procurement','compliance','workflow','synergy','leverage','stakeholder',
  'demographic','infrastructure','methodology','statutory','municipal','fiscal',
  // misc adult/abstract not useful for a kid speller
  'viagra','insurance','premiums','deductible','catalog','wholesale','vendor',
]);

// substrings that mark off-topic tokens
const BLOCK_SUBSTR = ['xxx', 'http', 'www', '.com', 'sex'];

const raw = (await readFile('data/_raw_freq.txt', 'utf8'))
  .split(/\r?\n/)
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const seen = new Set();
const kept = [];
for (const w of raw) {
  if (kept.length >= TARGET) break;
  if (!/^[a-z]+$/.test(w)) continue;
  if (w.length < 2) continue;
  if (w.length === 2 && !VALID_SHORT.has(w)) continue;
  if (ABBREV.has(w)) continue;
  if (BLOCK.has(w)) continue;
  if (BLOCK_SUBSTR.some((s) => w.includes(s))) continue;
  if (seen.has(w)) continue;
  seen.add(w);
  kept.push(w);
}

const backbone = kept.map((word, i) => ({ word, rank: i + 1 }));
await mkdir('data/chunks', { recursive: true });
await writeFile('data/backbone.json', JSON.stringify(backbone));

const chunks = [];
for (let i = 0; i < backbone.length; i += CHUNK) chunks.push(backbone.slice(i, i + CHUNK));
for (let c = 0; c < chunks.length; c++) {
  const id = String(c).padStart(2, '0');
  await writeFile(`data/chunks/input_${id}.json`, JSON.stringify({ chunk: c, words: chunks[c] }, null, 0));
}

console.log('rawLines', raw.length, '-> kept', backbone.length, 'in', chunks.length, 'chunks of', CHUNK);
console.log('first :', backbone.slice(0, 14).map((x) => x.word).join(' '));
console.log('r700  :', backbone.slice(700, 712).map((x) => x.word).join(' '));
console.log('r1500 :', backbone.slice(1500, 1512).map((x) => x.word).join(' '));
console.log('last  :', backbone.slice(-14).map((x) => x.word).join(' '));
