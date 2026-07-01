// src/engine/lists.js — multi-list teaching loop over the spelling-research corpus.
//
// Implements the locked APP_DESIGN.md loop from C:/Users/iango/spelling-research:
//   pool  = cumulative by age (union of every AoA band <= the learner's ceiling),
//   path  = one phonics spine (a pattern surfaces only when the pool has its words),
//   order = shortest first, then most-frequent first, inside each pattern,
//   miss  = reteach the pattern's rule + highlight the grapheme span.
// Pure functions over the dataset emitted by scripts/import_research.mjs
// (data/research_sample.js). Nothing here touches the live single-list path
// (data/words.js + engine/lexicon.js); this is the parallel mechanism the app
// migrates onto once the research lists are final.

// AoA bands, youngest first — the research repo's band vocabulary.
export const BAND_ORDER = [
  'under6', '6_7', '7_8', '8_9', '9_10', '10_11',
  '11_12', '12_13', '13_14', '14_15', '15plus',
];

const BAND_INDEX = new Map(BAND_ORDER.map((b, i) => [b, i]));

// Age is a ceiling, not a track: a 9.5yo's ceiling band is 9_10.
export function ageToBandCeiling(age) {
  if (age < 6) return 'under6';
  if (age >= 15) return '15plus';
  const lo = Math.floor(age);
  return `${lo}_${lo + 1}`;
}

export function bandWithinCeiling(band, ceiling) {
  return BAND_INDEX.get(band) <= BAND_INDEX.get(ceiling);
}

// Cumulative pool: every word from every band at or below the learner's age.
export function buildPool(words, age) {
  const ceiling = ageToBandCeiling(age);
  return words.filter((e) => bandWithinCeiling(e.band, ceiling));
}

// Within a pattern: length ascending, then zipf descending (missing zipf last).
export function orderWithinPattern(words) {
  return [...words].sort((a, b) =>
    (a.length - b.length) || ((b.zipf ?? -Infinity) - (a.zipf ?? -Infinity)));
}

// Walk the spine in order; emit a lesson for each pattern the pool has words for.
export function lessonPlan(pool, spine) {
  const byPattern = new Map();
  for (const e of pool) {
    if (!byPattern.has(e.pattern)) byPattern.set(e.pattern, []);
    byPattern.get(e.pattern).push(e);
  }
  const plan = [];
  for (const s of spine) {
    const words = byPattern.get(s.id);
    if (!words || !words.length) continue;
    plan.push({
      index: s.index,
      id: s.id,
      label: s.label,
      rule: s.rule,
      category: s.category,
      words: orderWithinPattern(words),
    });
  }
  return plan;
}

// On a miss: the governing pattern's rule + exemplars, and which letters to highlight.
export function reteach(entry, patterns) {
  const p = patterns[entry.pattern] || {};
  return {
    label: p.label || entry.pattern,
    rule: p.rule || '',
    exemplars: p.teach_exemplars || [],
    graphemeIndices: entry.grapheme?.indices || [],
  };
}

// Homophones are the words whose bare audio is ambiguous — dictate with the sentence.
export function needsCarrierSentence(entry) {
  return entry.homophoneId != null;
}
