// src/engine/kidcopy.js — the ONE read for kid-facing lesson copy (§39/§40).
//
// Every surface that shows a lesson to the child (reteach strip, intro card,
// lesson chip, Progress path, Settings label) calls kidLesson() instead of
// reading the corpus strings directly, so the kid-voiced overlay in
// data/kid_rules.js wins wherever it has an entry and the corpus label/rule
// is only the fallback for a lesson the overlay doesn't know. Pure; runs
// under `node --test`.

import { KID_RULES } from '../../data/kid_rules.js';

// Accepts either a lesson-shaped object ({ id, label, rule, exemplars }) from
// lessonForBand()/lessonList(), or an entry-shaped one ({ lessonId, lessonLabel,
// rule }) from lexiconEntries. Returns { id, name, rule, exemplars } or null.
export function kidLesson(l) {
  if (!l) return null;
  const id = l.id || l.lessonId || null;
  const kid = (id && KID_RULES[id]) || {};
  return {
    id,
    name: kid.name || l.label || l.lessonLabel || id || '',
    rule: kid.rule || l.rule || '',
    exemplars: Array.isArray(l.exemplars) ? l.exemplars : [],
  };
}
