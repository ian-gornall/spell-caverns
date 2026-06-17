// src/engine/nonsense.js — PURE pattern-based nonsense-word generator (Crystal Lab).
//
// Invents a PRONOUNCEABLE non-word that visibly embodies a given spelling pattern
// (e.g. "splight" for `ight`, "dake" for `silent-e-a`), so spelling it reinforces
// the pattern implicitly. The learner then draws + names it as a crystal specimen.
//
// Model: word = ONSET + RIME. Rimes are always vowel-initial and onsets are valid
// consonant clusters, so EVERY combination is a pronounceable syllable by
// construction. The pattern lives in whichever piece carries it — the rime
// (`ight`, `ake`, `ark`, `oon`, coda blends…) or, for digraphs/blends/ph/silent
// letters, a fixed onset. Only phonetically-meaningful patterns are supported;
// arbitrary/morphological families (sight words, tricky, homophones,
// multisyllable, roots…) are intentionally absent — see NONSENSE_PATTERNS.
//
// "Real word" = present in the dataset's REAL_WORDS. An obscure English word that
// isn't in the dataset could slip through; harmless for a kids' game (it's still a
// valid in-pattern word to spell). Imports nothing browser-specific.
import { shuffle } from './distractors.js';

// Generic consonant onsets (single + common blends) for patterns whose signature
// lives in the rime.
export const ONSETS = [
  'b', 'c', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm', 'n', 'p', 'r', 's', 't', 'v', 'w', 'z',
  'bl', 'br', 'cl', 'cr', 'dr', 'fl', 'fr', 'gl', 'gr', 'pl', 'pr', 'sl', 'sm', 'sn',
  'sp', 'st', 'sw', 'tr', 'sk', 'spl', 'spr', 'str',
];

const L_BLENDS = ['bl', 'cl', 'fl', 'gl', 'pl', 'sl'];
const R_BLENDS = ['br', 'cr', 'dr', 'fr', 'gr', 'pr', 'tr'];
const S_BLENDS = ['sc', 'sk', 'sl', 'sm', 'sn', 'sp', 'st', 'sw'];

// Vowel-initial short rimes shared by the onset-carries-the-pattern families
// (digraphs, blends, ph, silent letters): onset + these = a CVC-ish syllable.
const SHORT_RIMES = [
  'ab', 'ad', 'ag', 'am', 'an', 'ap', 'at', 'eb', 'ed', 'eg', 'em', 'en', 'ep', 'et',
  'ib', 'id', 'ig', 'im', 'in', 'ip', 'it', 'ob', 'od', 'og', 'om', 'op', 'ot',
  'ub', 'ud', 'ug', 'um', 'un', 'up', 'ut',
];

// RIMES[patternId] = { rimes:[...], onsets?:[...] }. If `onsets` is omitted, the
// generic ONSETS are used. Every rime is vowel-initial.
export const RIMES = {
  // ---- short vowels (CVC) ----
  'short-a': { rimes: ['ab', 'ad', 'ag', 'am', 'an', 'ap', 'at', 'az'] },
  'short-e': { rimes: ['eb', 'ed', 'eg', 'em', 'en', 'ep', 'et', 'ez'] },
  'short-i': { rimes: ['ib', 'id', 'ig', 'im', 'in', 'ip', 'it', 'iz'] },
  'short-o': { rimes: ['ob', 'od', 'og', 'om', 'on', 'op', 'ot', 'oz'] },
  'short-u': { rimes: ['ub', 'ud', 'ug', 'um', 'un', 'up', 'ut', 'uz'] },

  // ---- digraphs (onset carries the pattern) ----
  sh: { onsets: ['sh'], rimes: SHORT_RIMES },
  ch: { onsets: ['ch'], rimes: SHORT_RIMES },
  th: { onsets: ['th'], rimes: SHORT_RIMES },
  wh: { onsets: ['wh'], rimes: ['id', 'ip', 'it', 'iz', 'eb', 'ed', 'eg', 'em', 'en', 'ud', 'ub', 'ug', 'um', 'op', 'od', 'og'] },

  // ---- blends (onset carries the pattern) ----
  'l-blend': { onsets: L_BLENDS, rimes: SHORT_RIMES },
  'r-blend': { onsets: R_BLENDS, rimes: SHORT_RIMES },
  's-blend': { onsets: S_BLENDS, rimes: SHORT_RIMES },

  // ---- ending blends / -ck -ng (coda carries the pattern) ----
  'end-blend': {
    rimes: ['amp', 'imp', 'ump', 'and', 'end', 'ind', 'und', 'ant', 'ent', 'int',
      'unk', 'ank', 'ink', 'onk', 'ast', 'est', 'ist', 'ost', 'ust', 'elt', 'ilt', 'olt'],
  },
  'ck-ng': { rimes: ['ack', 'ick', 'ock', 'uck', 'eck', 'ang', 'ing', 'ong', 'ung', 'ink', 'onk', 'unk'] },

  // ---- silent-e (a_e, i_e, o_e, u_e) ----
  'silent-e-a': { rimes: ['ake', 'ame', 'ane', 'ape', 'ate', 'ade', 'aze', 'ave', 'ale'] },
  'silent-e-i': { rimes: ['ike', 'ime', 'ine', 'ipe', 'ite', 'ide', 'ive', 'ize', 'ile'] },
  'silent-e-o': { rimes: ['oke', 'ome', 'one', 'ope', 'ote', 'ode', 'ove', 'oze', 'ole'] },
  'silent-e-u': { rimes: ['uke', 'ume', 'une', 'upe', 'ute', 'ude', 'uze', 'ule'] },

  // ---- vowel teams ----
  'ai-ay': { rimes: ['ain', 'aid', 'ail', 'aim', 'ait', 'ay', 'aith'] },
  'ee-ea': { rimes: ['eed', 'eel', 'een', 'eet', 'eam', 'ean', 'eat', 'each', 'eep', 'eaf'] },
  'oa-ow-long': { rimes: ['oat', 'oad', 'oal', 'oan', 'oach', 'ow', 'oam', 'oast'] },
  'y-long-e': { rimes: ['appy', 'ippy', 'obby', 'ummy', 'enny', 'izzy', 'olly', 'iggy'] },

  // ---- r-controlled ----
  'r-ar': { rimes: ['ar', 'ark', 'art', 'arn', 'arp', 'ard', 'arm', 'ark'] },
  'r-or': { rimes: ['or', 'ord', 'orn', 'ort', 'ork', 'orm', 'orp'] },
  'r-er-ir-ur': { rimes: ['erm', 'irt', 'urn', 'ird', 'urd', 'erk', 'irp', 'urt', 'erd'] },

  // ---- tier-4 vowel families ----
  ight: { rimes: ['ight'] },
  tch: { rimes: ['atch', 'etch', 'itch', 'otch', 'utch'] },
  'ou-ow-loud': { rimes: ['out', 'oud', 'ound', 'own', 'owl', 'ow', 'ouch', 'ount'] },
  'oi-oy': { rimes: ['oil', 'oin', 'oint', 'oid', 'oy', 'oist'] },
  oo: { rimes: ['ood', 'ool', 'oom', 'oon', 'oot', 'ook', 'oop', 'oof'] },
  'aw-au-all': { rimes: ['aw', 'awn', 'awl', 'aud', 'ault', 'all', 'alk', 'aught'] },

  // ---- assorted higher-tier orthographic families that still rime cleanly ----
  'double-cons': { rimes: ['abble', 'obble', 'atter', 'ummer', 'iggle', 'apple', 'otter', 'immer', 'ellow', 'uddle'] },
  'soft-c-g': { rimes: ['ace', 'ice', 'age', 'ige', 'yce', 'yge', 'ence', 'ince'] },
  'silent-letters': { onsets: ['kn', 'wr'], rimes: SHORT_RIMES },
  ph: { onsets: ['ph'], rimes: SHORT_RIMES },
  'ie-ei': { rimes: ['ield', 'ieve', 'eive', 'eight', 'iege', 'iece'] },
  'ough-augh': { rimes: ['ough', 'ought', 'augh', 'aught'] },
  'que-gue': { rimes: ['aque', 'eque', 'ique', 'ogue', 'ague'] },
  'ture-sure': { rimes: ['ature', 'iture', 'enture', 'asure', 'osure', 'isure'] },
};

// The pattern ids the Crystal Lab can generate specimens for. The Lab should offer
// the intersection of these with the patterns the learner has been practicing.
export const NONSENSE_PATTERNS = Object.keys(RIMES);

// makeNonsenseWord(patternId, {realWords, rng, avoid}) -> a pronounceable non-word
// in that pattern, or null if the pattern is unsupported / every combo is taken.
export function makeNonsenseWord(patternId, opts = {}) {
  const entry = RIMES[patternId];
  if (!entry) return null; // arbitrary/morphological pattern — no meaningful nonsense form

  const { realWords, rng = Math.random, avoid } = opts;
  const avoidSet = avoid instanceof Set ? avoid : new Set(avoid || []);
  const onsets = entry.onsets || ONSETS;

  const combos = [];
  for (const o of onsets) for (const r of entry.rimes) combos.push(o + r);

  for (const w of shuffle(combos, rng)) {
    if (w.length < 2) continue;
    if (realWords && realWords.has(w)) continue;
    if (avoidSet.has(w)) continue;
    return w;
  }
  return null; // exhausted (all combos are real or already used)
}
