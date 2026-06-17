// data/patterns.js — the CANONICAL list of orthographic spelling-pattern families,
// the single source of truth for pattern ids across the whole dataset. Spans ages
// 5-13 (Kindergarten .. grade 8). `tier` 1..9 is the difficulty band.
//
// Patterns group words that are SPELLED similarly so the game can teach the group
// implicitly. They are INTERNAL only — the game never shows a child a spelling rule.
export const PATTERNS = [
  // ---- Tier 1 (age 5-6, K): short vowels (CVC) + easiest sight words ----
  { id: "short-a",        name: "short a (cat, map)",                 tier: 1 },
  { id: "short-e",        name: "short e (red, ten)",                 tier: 1 },
  { id: "short-i",        name: "short i (sit, big)",                 tier: 1 },
  { id: "short-o",        name: "short o (dog, hot)",                 tier: 1 },
  { id: "short-u",        name: "short u (sun, run)",                 tier: 1 },
  { id: "easy-sight",     name: "easiest sight words (the, and)",     tier: 1 },

  // ---- Tier 2 (age 6-7, G1): blends, digraphs, grade-1 sight words ----
  { id: "sh",             name: "sh digraph (ship, fish)",            tier: 2 },
  { id: "ch",             name: "ch digraph (chin, much)",            tier: 2 },
  { id: "th",             name: "th digraph (this, that, with)",      tier: 2 },
  { id: "wh",             name: "wh digraph (when, which)",           tier: 2 },
  { id: "l-blend",        name: "l-blends (black, glad, flag)",       tier: 2 },
  { id: "r-blend",        name: "r-blends (grass, drop, frog)",       tier: 2 },
  { id: "s-blend",        name: "s-blends (stop, swim, spell)",       tier: 2 },
  { id: "end-blend",      name: "ending blends (jump, hand, must)",   tier: 2 },
  { id: "ck-ng",          name: "-ck and -ng endings (back, sing)",   tier: 2 },

  // ---- Tier 3 (age 7-8, G2): silent-e (magic e) + common vowel teams ----
  { id: "silent-e-a",     name: "a_e silent-e (cake, made)",          tier: 3 },
  { id: "silent-e-i",     name: "i_e silent-e (time, ride)",          tier: 3 },
  { id: "silent-e-o",     name: "o_e silent-e (hope, home)",          tier: 3 },
  { id: "silent-e-u",     name: "u_e silent-e (cute, use)",           tier: 3 },
  { id: "ai-ay",          name: "ai / ay (rain, play)",               tier: 3 },
  { id: "ee-ea",          name: "ee / ea long e (tree, each)",        tier: 3 },
  { id: "oa-ow-long",     name: "oa / ow long o (boat, snow)",        tier: 3 },
  { id: "y-long-e",       name: "y as long e (happy, baby)",          tier: 3 },

  // ---- Tier 4 (age 8-9, G3): r-controlled, -ight, -tch, diphthongs ----
  { id: "r-ar",           name: "ar r-controlled (car, star)",        tier: 4 },
  { id: "r-or",           name: "or r-controlled (for, born)",        tier: 4 },
  { id: "r-er-ir-ur",     name: "er/ir/ur r-controlled (bird, turn)", tier: 4 },
  { id: "ight",           name: "the -ight family (light, night)",    tier: 4 },
  { id: "tch",            name: "-tch ending (catch, watch)",         tier: 4 },
  { id: "ou-ow-loud",     name: "ou / ow diphthong (cloud, how)",     tier: 4 },
  { id: "oi-oy",          name: "oi / oy diphthong (point, boy)",     tier: 4 },
  { id: "oo",             name: "oo (moon, book)",                    tier: 4 },
  { id: "aw-au-all",      name: "aw / au / all (saw, ball)",          tier: 4 },

  // ---- Tier 5 (age 9-10, G3-4): high-frequency tricky / irregular words ----
  { id: "tricky",         name: "tricky must-know words",             tier: 5 },
  { id: "tricky-ould",    name: "-ould words (would, could, should)", tier: 5 },
  { id: "tricky-wh-q",    name: "tricky wh/qu question words",        tier: 5 },

  // ---- Tier 6 (age 9-10, G4): multisyllable, suffixes, homophones ----
  { id: "tion",           name: "-tion / -sion endings (action)",     tier: 6 },
  { id: "suffix-ful-ly",  name: "-ful / -ly / -ment suffixes",        tier: 6 },
  { id: "multisyllable",  name: "longer multisyllable words",         tier: 6 },
  { id: "homophone",      name: "homophones (their/there, to/too)",   tier: 6 },
  { id: "double-cons",    name: "doubled consonants (dollar, supper)", tier: 6 },

  // ---- Tier 7 (age 10-11, G5): prefixes, endings, soft c/g, silent letters ----
  { id: "prefix-re-un-dis", name: "prefixes re-/un-/dis-/pre-/mis-",  tier: 7 },
  { id: "ending-ed-ing",  name: "-ed / -ing endings (hoped, running)",tier: 7 },
  { id: "suffix-er-est",  name: "-er / -est (bigger, fastest)",       tier: 7 },
  { id: "soft-c-g",       name: "soft c / g (city, page, gym)",       tier: 7 },
  { id: "silent-letters", name: "silent letters (know, write, lamb)", tier: 7 },
  { id: "schwa-er-or-ar", name: "-er/-or/-ar endings (teacher, doctor)", tier: 7 },
  { id: "ph",             name: "ph = f sound (phone, graph)",        tier: 7 },

  // ---- Tier 8 (age 11-12, G6): bigger suffixes, tricky vowel rules ----
  { id: "suffix-ous",     name: "-ous / -ious (famous, curious)",     tier: 8 },
  { id: "suffix-able-ible", name: "-able / -ible (comfortable, possible)", tier: 8 },
  { id: "suffix-ment-ness-less", name: "-ment / -ness / -less",       tier: 8 },
  { id: "sion-cian",      name: "-sion / -cian (decision, musician)", tier: 8 },
  { id: "ture-sure",      name: "-ture / -sure (picture, treasure)",  tier: 8 },
  { id: "ie-ei",          name: "ie / ei (believe, receive)",         tier: 8 },
  { id: "ough-augh",      name: "ough / augh (caught, through)",       tier: 8 },
  { id: "que-gue",        name: "-que / -gue (unique, league)",       tier: 8 },
  { id: "double-suffix",  name: "double before a suffix (beginning)", tier: 8 },

  // ---- Tier 9 (age 12-13, G7-8): advanced academic spellings ----
  { id: "cious-tious",    name: "-cious / -tious (delicious, ambitious)", tier: 9 },
  { id: "ial-ical",       name: "-ial / -ical (special, musical)",    tier: 9 },
  { id: "ant-ent-ance-ence", name: "-ant/-ent/-ance/-ence (science, important)", tier: 9 },
  { id: "ary-ery-ory",    name: "-ary/-ery/-ory (library, history)",  tier: 9 },
  { id: "greek-roots",    name: "Greek spellings (chemistry, rhythm)", tier: 9 },
  { id: "latin-roots",    name: "Latin roots (structure, transport)", tier: 9 },
  { id: "advanced-multisyllable", name: "long advanced words",        tier: 9 },
];

export const PATTERN_IDS = new Set(PATTERNS.map((p) => p.id));
export const PATTERN_BY_ID = Object.fromEntries(PATTERNS.map((p) => [p.id, p]));
