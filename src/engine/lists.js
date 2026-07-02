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

// ---- lexicon adapter --------------------------------------------------------
// Turn the research dataset + a learner age into CLASSIC-shaped lexicon entries so
// the whole existing engine (categories, selection, modes, progress) runs unchanged:
//   band = 1-based LESSON number in spine order (so the categories level gate IS
//   APP_DESIGN's pattern gate), rank/pos = global teaching order, tier = AoA band
//   index (clamped to the classic 1..9 range the assessment/distractor code expects).
// Words under 3 letters are dropped (craft tiles need >= 3); a lesson with no
// servable words gets no band. Research extras (rule, lessonLabel, grapheme,
// homophoneId) ride along for the reteach + homophone UI.
// L1/L2 are BY DEFINITION 2-letter-word lessons ("2-letter VC/CV"), so they can never
// be served — dropped whole, including the corpus's few stray >=3-letter placements
// there ("add", "spirit"), whose rule text wouldn't describe them.
const UNSERVABLE_LESSONS = new Set(['L1', 'L2']);

export function lexiconEntries(research, age) {
  const pool = buildPool(research.words, age)
    .filter((e) => e.word.length >= 3 && !UNSERVABLE_LESSONS.has(e.pattern));
  const plan = lessonPlan(pool, research.spine);
  const entries = [];
  const lessons = new Map();
  let band = 0;
  for (const l of plan) {
    band += 1;
    // §40: each lesson carries its teach exemplars (intro card) and its own served
    // entries (the lessonrun pool) — filled with the very entry objects pushed below.
    const lessonWords = [];
    lessons.set(band, {
      id: l.id,
      label: l.label,
      rule: l.rule,
      index: l.index,
      exemplars: research.patterns?.[l.id]?.teach_exemplars || [],
      words: lessonWords,
    });
    for (const e of l.words) {
      const rank = entries.length + 1;
      entries.push({
        word: e.word,
        rank,
        pos: rank - 1,
        band,
        tier: Math.min(9, BAND_INDEX.get(e.band) + 1),
        pattern: e.pattern,
        syllables: [e.word],
        misspellings: [],
        sentence: e.sentence || '',
        rule: l.rule,
        lessonLabel: l.label,
        lessonId: l.id,
        grapheme: e.grapheme || null,
        homophoneId: e.homophoneId ?? null,
        aoaBand: e.band,
      });
      lessonWords.push(entries[entries.length - 1]);
    }
  }
  return { entries, lessons };
}
