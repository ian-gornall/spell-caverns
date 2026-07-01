// scripts/demo_lists.mjs — show the multi-list teaching loop on the sampled corpus.
// Usage: node scripts/demo_lists.mjs [age]
import { RESEARCH } from '../data/research_sample.js';
import {
  buildPool, lessonPlan, reteach, needsCarrierSentence, ageToBandCeiling,
} from '../src/engine/lists.js';

const age = Number(process.argv[2] || 7);
const pool = buildPool(RESEARCH.words, age);
const plan = lessonPlan(pool, RESEARCH.spine);

console.log(`age ${age} (ceiling band ${ageToBandCeiling(age)}): pool ${pool.length} words, ${plan.length} lessons\n`);
for (const l of plan.slice(0, 8)) {
  console.log(`#${String(l.index).padStart(3)} ${l.id.padEnd(5)} ${l.label}`);
  console.log(`      rule: ${l.rule}`);
  console.log(`      words: ${l.words.map((e) => e.word).join(', ')}`);
}
console.log(`... ${plan.length - 8} more lessons\n`);

const miss = plan[0].words.find((e) => e.grapheme?.indices?.length) || plan[0].words[0];
const r = reteach(miss, RESEARCH.patterns);
console.log(`miss "${miss.word}" -> reteach [${r.label}]: ${r.rule}`);
console.log(`  exemplars: ${r.exemplars.join(', ')}  highlight letters: ${r.graphemeIndices.map((i) => miss.word[i]).join(',') || '(none)'}`);

const homo = pool.find(needsCarrierSentence);
if (homo) console.log(`\nhomophone "${homo.word}" -> dictate with sentence: "${homo.sentence}"`);
