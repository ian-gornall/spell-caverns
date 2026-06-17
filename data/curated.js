// data/words.js
// Core word dataset for a children's spelling game (US grade 3-4, weak speller).
// Word selection & ordering are based on Fry's Instant Words (first ~600) and the
// Dolch sight word lists (pre-primer..grade 3 + Dolch nouns).
//
// Words are grouped by orthographic SPELLING PATTERN (word family) so the game can
// teach similarly-spelled groups implicitly. Patterns are INTERNAL-only (never shown
// to the child) and are named for developers.
//
// `rank` ~ Fry frequency rank (1 = most common). More-common words have lower ranks.
// `tier` 1..6 = difficulty band (Kindergarten .. Grade 4). See README of game.

export const PATTERNS = [
  // ---- Tier 1: short vowels (CVC) + easiest sight words ----
  { id: "short-a",        name: "short a (cat, map)",                 tier: 1 },
  { id: "short-e",        name: "short e (red, ten)",                 tier: 1 },
  { id: "short-i",        name: "short i (sit, big)",                 tier: 1 },
  { id: "short-o",        name: "short o (dog, hot)",                 tier: 1 },
  { id: "short-u",        name: "short u (sun, run)",                 tier: 1 },
  { id: "easy-sight",     name: "easiest sight words (the, and)",     tier: 1 },

  // ---- Tier 2: blends, digraphs, grade-1 sight words ----
  { id: "sh",             name: "sh digraph (ship, fish)",            tier: 2 },
  { id: "ch",             name: "ch digraph (chin, much)",            tier: 2 },
  { id: "th",             name: "th digraph (this, that, with)",      tier: 2 },
  { id: "wh",             name: "wh digraph (when, which)",           tier: 2 },
  { id: "l-blend",        name: "l-blends (black, glad, flag)",       tier: 2 },
  { id: "r-blend",        name: "r-blends (grass, drop, frog)",       tier: 2 },
  { id: "s-blend",        name: "s-blends (stop, swim, spell)",       tier: 2 },
  { id: "end-blend",      name: "ending blends (jump, hand, must)",   tier: 2 },
  { id: "ck-ng",          name: "-ck and -ng endings (back, sing)",   tier: 2 },

  // ---- Tier 3: silent-e (magic e) + common vowel teams ----
  { id: "silent-e-a",     name: "a_e silent-e (cake, made)",          tier: 3 },
  { id: "silent-e-i",     name: "i_e silent-e (time, ride)",          tier: 3 },
  { id: "silent-e-o",     name: "o_e silent-e (hope, home)",          tier: 3 },
  { id: "silent-e-u",     name: "u_e silent-e (cute, use)",           tier: 3 },
  { id: "ai-ay",          name: "ai / ay (rain, play)",               tier: 3 },
  { id: "ee-ea",          name: "ee / ea long e (tree, each)",        tier: 3 },
  { id: "oa-ow-long",     name: "oa / ow long o (boat, snow)",        tier: 3 },
  { id: "y-long-e",       name: "y as long e (happy, baby)",          tier: 3 },

  // ---- Tier 4: r-controlled, -ight, -tch, diphthongs, harder teams ----
  { id: "r-ar",           name: "ar r-controlled (car, star)",        tier: 4 },
  { id: "r-or",           name: "or r-controlled (for, born)",        tier: 4 },
  { id: "r-er-ir-ur",     name: "er/ir/ur r-controlled (bird, turn)", tier: 4 },
  { id: "ight",           name: "the -ight family (light, night)",    tier: 4 },
  { id: "tch",            name: "-tch ending (catch, watch)",         tier: 4 },
  { id: "ou-ow-loud",     name: "ou / ow diphthong (cloud, how)",     tier: 4 },
  { id: "oi-oy",          name: "oi / oy diphthong (point, boy)",     tier: 4 },
  { id: "oo",             name: "oo (moon, book)",                    tier: 4 },
  { id: "aw-au-all",      name: "aw / au / all (saw, ball)",          tier: 4 },

  // ---- Tier 5: high-frequency tricky / irregular must-know words ----
  { id: "tricky",         name: "tricky must-know words",             tier: 5 },
  { id: "tricky-ould",    name: "-ould words (would, could, should)", tier: 5 },
  { id: "tricky-wh-q",    name: "tricky wh/qu question words",        tier: 5 },

  // ---- Tier 6: multisyllable, suffixes/endings, homophones ----
  { id: "tion",           name: "-tion / -sion endings (action)",     tier: 6 },
  { id: "suffix-ful-ly",  name: "-ful / -ly / -ment suffixes",        tier: 6 },
  { id: "multisyllable",  name: "longer multisyllable words",         tier: 6 },
  { id: "homophone",      name: "homophones (their/there, to/too)",   tier: 6 },
  { id: "double-cons",    name: "doubled consonants (dollar, supper)", tier: 6 },
];

export const WORDS = [
  // ============================================================
  // TIER 1 — Kindergarten / pre-primer: CVC + easiest sight words
  // ============================================================

  // short a
  { word: "cat",  rank: 250, tier: 1, pattern: "short-a", syllables: ["cat"], misspellings: [], sentence: "The cat sat on my lap." },
  { word: "map",  rank: 300, tier: 1, pattern: "short-a", syllables: ["map"], misspellings: [], sentence: "We used a map to find the cave." },
  { word: "bat",  rank: 360, tier: 1, pattern: "short-a", syllables: ["bat"], misspellings: [], sentence: "A bat flew out of the dark cave." },
  { word: "hat",  rank: 340, tier: 1, pattern: "short-a", syllables: ["hat"], misspellings: [], sentence: "I wore a red hat in the sun." },
  { word: "ran",  rank: 110, tier: 1, pattern: "short-a", syllables: ["ran"], misspellings: [], sentence: "We ran all the way home." },
  { word: "bag",  rank: 320, tier: 1, pattern: "short-a", syllables: ["bag"], misspellings: [], sentence: "I put the rocks in my bag." },
  { word: "can",  rank: 56,  tier: 1, pattern: "short-a", syllables: ["can"], misspellings: [], sentence: "I can spell my name." },
  { word: "had",  rank: 30,  tier: 1, pattern: "short-a", syllables: ["had"], misspellings: [], sentence: "We had fun at the park." },

  // short e
  { word: "red",  rank: 130, tier: 1, pattern: "short-e", syllables: ["red"], misspellings: [], sentence: "The gem was a deep red." },
  { word: "ten",  rank: 230, tier: 1, pattern: "short-e", syllables: ["ten"], misspellings: [], sentence: "I found ten shiny stones." },
  { word: "bed",  rank: 280, tier: 1, pattern: "short-e", syllables: ["bed"], misspellings: [], sentence: "I read a book in bed." },
  { word: "leg",  rank: 290, tier: 1, pattern: "short-e", syllables: ["leg"], misspellings: [], sentence: "I hurt my leg on the rock." },
  { word: "yes",  rank: 175, tier: 1, pattern: "short-e", syllables: ["yes"], misspellings: [], sentence: "Yes, I want to go exploring." },
  { word: "get",  rank: 70,  tier: 1, pattern: "short-e", syllables: ["get"], misspellings: [], sentence: "Let me get my backpack." },
  { word: "men",  rank: 95,  tier: 1, pattern: "short-e", syllables: ["men"], misspellings: [], sentence: "Two men climbed the hill." },
  { word: "let",  rank: 96,  tier: 1, pattern: "short-e", syllables: ["let"], misspellings: [], sentence: "Let me try to spell it." },

  // short i
  { word: "sit",  rank: 200, tier: 1, pattern: "short-i", syllables: ["sit"], misspellings: [], sentence: "Please sit by the fire." },
  { word: "big",  rank: 100, tier: 1, pattern: "short-i", syllables: ["big"], misspellings: [], sentence: "We found a big rock." },
  { word: "pig",  rank: 330, tier: 1, pattern: "short-i", syllables: ["pig"], misspellings: [], sentence: "The pig rolled in the mud." },
  { word: "him",  rank: 33,  tier: 1, pattern: "short-i", syllables: ["him"], misspellings: [], sentence: "I gave him the map." },
  { word: "did",  rank: 80,  tier: 1, pattern: "short-i", syllables: ["did"], misspellings: [], sentence: "We did it together." },
  { word: "win",  rank: 240, tier: 1, pattern: "short-i", syllables: ["win"], misspellings: [], sentence: "I hope we win the game." },
  { word: "dig",  rank: 350, tier: 1, pattern: "short-i", syllables: ["dig"], misspellings: [], sentence: "We dig for gems in the sand." },
  { word: "is",   rank: 9,   tier: 1, pattern: "short-i", syllables: ["is"],  misspellings: [], sentence: "This is my favorite stone." },

  // short o
  { word: "dog",  rank: 220, tier: 1, pattern: "short-o", syllables: ["dog"], misspellings: [], sentence: "My dog ran across the yard." },
  { word: "hot",  rank: 170, tier: 1, pattern: "short-o", syllables: ["hot"], misspellings: [], sentence: "The sand was very hot." },
  { word: "top",  rank: 165, tier: 1, pattern: "short-o", syllables: ["top"], misspellings: [], sentence: "We climbed to the top." },
  { word: "box",  rank: 215, tier: 1, pattern: "short-o", syllables: ["box"], misspellings: [], sentence: "I keep my rocks in a box." },
  { word: "got",  rank: 85,  tier: 1, pattern: "short-o", syllables: ["got"], misspellings: [], sentence: "I got a new map." },
  { word: "not",  rank: 26,  tier: 1, pattern: "short-o", syllables: ["not"], misspellings: [], sentence: "It is not far now." },
  { word: "pot",  rank: 370, tier: 1, pattern: "short-o", syllables: ["pot"], misspellings: [], sentence: "We cooked soup in a pot." },
  { word: "on",   rank: 14,  tier: 1, pattern: "short-o", syllables: ["on"],  misspellings: [], sentence: "Put the gem on the table." },

  // short u
  { word: "sun",  rank: 160, tier: 1, pattern: "short-u", syllables: ["sun"], misspellings: [], sentence: "The sun is bright today." },
  { word: "run",  rank: 150, tier: 1, pattern: "short-u", syllables: ["run"], misspellings: [], sentence: "Let's run to the cave." },
  { word: "fun",  rank: 260, tier: 1, pattern: "short-u", syllables: ["fun"], misspellings: [], sentence: "Exploring is so much fun." },
  { word: "bug",  rank: 310, tier: 1, pattern: "short-u", syllables: ["bug"], misspellings: [], sentence: "A bug crawled on the leaf." },
  { word: "cup",  rank: 275, tier: 1, pattern: "short-u", syllables: ["cup"], misspellings: [], sentence: "I drank from a tin cup." },
  { word: "but",  rank: 22,  tier: 1, pattern: "short-u", syllables: ["but"], misspellings: [], sentence: "I tried, but it was hard." },
  { word: "cut",  rank: 190, tier: 1, pattern: "short-u", syllables: ["cut"], misspellings: [], sentence: "Be careful not to cut your hand." },
  { word: "up",   rank: 36,  tier: 1, pattern: "short-u", syllables: ["up"],  misspellings: [], sentence: "We climbed up the steep hill." },

  // easiest sight words
  { word: "the",  rank: 1,   tier: 1, pattern: "easy-sight", syllables: ["the"], misspellings: [], sentence: "The map showed a hidden cave." },
  { word: "and",  rank: 3,   tier: 1, pattern: "easy-sight", syllables: ["and"], misspellings: [], sentence: "We packed food and water." },
  { word: "a",    rank: 5,   tier: 1, pattern: "easy-sight", syllables: ["a"],   misspellings: [], sentence: "I found a gold coin." },
  { word: "to",   rank: 7,   tier: 1, pattern: "easy-sight", syllables: ["to"],  misspellings: [], sentence: "We walked to the river." },
  { word: "in",   rank: 6,   tier: 1, pattern: "easy-sight", syllables: ["in"],  misspellings: [], sentence: "The gem was in the rock." },
  { word: "it",   rank: 10,  tier: 1, pattern: "easy-sight", syllables: ["it"],  misspellings: [], sentence: "It was a long climb." },
  { word: "he",   rank: 16,  tier: 1, pattern: "easy-sight", syllables: ["he"],  misspellings: [], sentence: "He found the secret path." },
  { word: "we",   rank: 24,  tier: 1, pattern: "easy-sight", syllables: ["we"],  misspellings: [], sentence: "We will explore tomorrow." },
  { word: "see",  rank: 90,  tier: 1, pattern: "easy-sight", syllables: ["see"], misspellings: [], sentence: "I can see the mountain." },
  { word: "go",   rank: 75,  tier: 1, pattern: "easy-sight", syllables: ["go"],  misspellings: [], sentence: "Let's go to the cave." },
  { word: "me",   rank: 78,  tier: 1, pattern: "easy-sight", syllables: ["me"],  misspellings: [], sentence: "Come with me on the trail." },
  { word: "my",   rank: 110, tier: 1, pattern: "easy-sight", syllables: ["my"],  misspellings: [], sentence: "My bag is full of rocks." },

  // ============================================================
  // TIER 2 — Grade 1: blends, digraphs, grade-1 sight words
  // ============================================================

  // sh
  { word: "ship", rank: 380, tier: 2, pattern: "sh", syllables: ["ship"], misspellings: [], sentence: "The ship sailed across the sea." },
  { word: "fish", rank: 400, tier: 2, pattern: "sh", syllables: ["fish"], misspellings: ["fich"], sentence: "We caught a fish in the river." },
  { word: "shop", rank: 410, tier: 2, pattern: "sh", syllables: ["shop"], misspellings: [], sentence: "We stopped at a rock shop." },
  { word: "wish", rank: 420, tier: 2, pattern: "sh", syllables: ["wish"], misspellings: [], sentence: "I wish I could find gold." },
  { word: "dish", rank: 430, tier: 2, pattern: "sh", syllables: ["dish"], misspellings: [], sentence: "She put the gem in a dish." },
  { word: "shut", rank: 440, tier: 2, pattern: "sh", syllables: ["shut"], misspellings: [], sentence: "Please shut the heavy door." },

  // ch
  { word: "chin", rank: 450, tier: 2, pattern: "ch", syllables: ["chin"], misspellings: [], sentence: "Mud was on his chin." },
  { word: "much", rank: 140, tier: 2, pattern: "ch", syllables: ["much"], misspellings: ["mutch"], sentence: "We did not have much time." },
  { word: "chip", rank: 460, tier: 2, pattern: "ch", syllables: ["chip"], misspellings: [], sentence: "A small chip broke off the rock." },
  { word: "rich", rank: 470, tier: 2, pattern: "ch", syllables: ["rich"], misspellings: ["ritch"], sentence: "The cave was rich with gems." },
  { word: "chop", rank: 480, tier: 2, pattern: "ch", syllables: ["chop"], misspellings: [], sentence: "We had to chop the wood." },
  { word: "such", rank: 145, tier: 2, pattern: "ch", syllables: ["such"], misspellings: ["sutch"], sentence: "It was such a long day." },

  // th
  { word: "this", rank: 20,  tier: 2, pattern: "th", syllables: ["this"], misspellings: [], sentence: "This is the right path." },
  { word: "that", rank: 12,  tier: 2, pattern: "th", syllables: ["that"], misspellings: [], sentence: "That rock is full of crystals." },
  { word: "with", rank: 17,  tier: 2, pattern: "th", syllables: ["with"], misspellings: ["whith"], sentence: "Come with us to explore." },
  { word: "then", rank: 64,  tier: 2, pattern: "th", syllables: ["then"], misspellings: [], sentence: "First we dig, then we wash the stones." },
  { word: "them", rank: 58,  tier: 2, pattern: "th", syllables: ["them"], misspellings: [], sentence: "I gave them to my friend." },
  { word: "thin", rank: 490, tier: 2, pattern: "th", syllables: ["thin"], misspellings: [], sentence: "The ice was very thin." },
  { word: "bath", rank: 495, tier: 2, pattern: "th", syllables: ["bath"], misspellings: [], sentence: "I took a bath after the hike." },
  { word: "path", rank: 425, tier: 2, pattern: "th", syllables: ["path"], misspellings: [], sentence: "We followed the rocky path." },

  // wh
  { word: "when", rank: 52,  tier: 2, pattern: "wh", syllables: ["when"], misspellings: ["wen"], sentence: "When can we go to the cave?" },
  { word: "which",rank: 92,  tier: 2, pattern: "wh", syllables: ["which"], misspellings: ["wich","whitch"], sentence: "Which path should we take?" },
  { word: "whip", rank: 500, tier: 2, pattern: "wh", syllables: ["whip"], misspellings: ["wip"], sentence: "The wind began to whip the trees." },
  { word: "white",rank: 270, tier: 2, pattern: "wh", syllables: ["white"], misspellings: ["whyte","wite"], sentence: "The stone was a clean white." },

  // l-blend
  { word: "black",rank: 235, tier: 2, pattern: "l-blend", syllables: ["black"], misspellings: ["blak","blac"], sentence: "The cave was black inside." },
  { word: "glad", rank: 510, tier: 2, pattern: "l-blend", syllables: ["glad"], misspellings: [], sentence: "I was glad we found the gem." },
  { word: "flag", rank: 520, tier: 2, pattern: "l-blend", syllables: ["flag"], misspellings: [], sentence: "We put a flag on the hill." },
  { word: "flat", rank: 530, tier: 2, pattern: "l-blend", syllables: ["flat"], misspellings: [], sentence: "The rock had a flat top." },
  { word: "club", rank: 540, tier: 2, pattern: "l-blend", syllables: ["club"], misspellings: [], sentence: "We started a rock club." },
  { word: "clap", rank: 550, tier: 2, pattern: "l-blend", syllables: ["clap"], misspellings: [], sentence: "We clap when she spells it right." },

  // r-blend
  { word: "grass",rank: 245, tier: 2, pattern: "r-blend", syllables: ["grass"], misspellings: ["gras"], sentence: "We sat in the tall grass." },
  { word: "drop", rank: 360, tier: 2, pattern: "r-blend", syllables: ["drop"], misspellings: [], sentence: "Do not drop the gem." },
  { word: "frog", rank: 560, tier: 2, pattern: "r-blend", syllables: ["frog"], misspellings: [], sentence: "A frog jumped into the pond." },
  { word: "trip", rank: 255, tier: 2, pattern: "r-blend", syllables: ["trip"], misspellings: [], sentence: "Our trip to the cave was great." },
  { word: "grab", rank: 570, tier: 2, pattern: "r-blend", syllables: ["grab"], misspellings: [], sentence: "Grab your bag and let's go." },
  { word: "crab", rank: 580, tier: 2, pattern: "r-blend", syllables: ["crab"], misspellings: [], sentence: "A crab hid under the rock." },

  // s-blend
  { word: "stop", rank: 185, tier: 2, pattern: "s-blend", syllables: ["stop"], misspellings: [], sentence: "We had to stop and rest." },
  { word: "swim", rank: 590, tier: 2, pattern: "s-blend", syllables: ["swim"], misspellings: [], sentence: "We swim in the cool lake." },
  { word: "spell",rank: 600, tier: 2, pattern: "s-blend", syllables: ["spell"], misspellings: ["spel"], sentence: "I can spell a new word." },
  { word: "step", rank: 195, tier: 2, pattern: "s-blend", syllables: ["step"], misspellings: [], sentence: "Watch your step on the rocks." },
  { word: "spin", rank: 610, tier: 2, pattern: "s-blend", syllables: ["spin"], misspellings: [], sentence: "The top began to spin." },
  { word: "skip", rank: 620, tier: 2, pattern: "s-blend", syllables: ["skip"], misspellings: [], sentence: "Do not skip the hard words." },

  // end-blend
  { word: "jump", rank: 350, tier: 2, pattern: "end-blend", syllables: ["jump"], misspellings: [], sentence: "We had to jump over the stream." },
  { word: "hand", rank: 120, tier: 2, pattern: "end-blend", syllables: ["hand"], misspellings: [], sentence: "Hold my hand on the bridge." },
  { word: "must", rank: 88,  tier: 2, pattern: "end-blend", syllables: ["must"], misspellings: [], sentence: "We must be home by dark." },
  { word: "fast", rank: 155, tier: 2, pattern: "end-blend", syllables: ["fast"], misspellings: [], sentence: "The river flows very fast." },
  { word: "went", rank: 65,  tier: 2, pattern: "end-blend", syllables: ["went"], misspellings: [], sentence: "We went to the deep cave." },
  { word: "land", rank: 125, tier: 2, pattern: "end-blend", syllables: ["land"], misspellings: [], sentence: "We stood on dry land." },
  { word: "best", rank: 135, tier: 2, pattern: "end-blend", syllables: ["best"], misspellings: [], sentence: "This is my best gem." },
  { word: "help", rank: 158, tier: 2, pattern: "end-blend", syllables: ["help"], misspellings: [], sentence: "Can you help me dig?" },

  // ck-ng
  { word: "back", rank: 105, tier: 2, pattern: "ck-ng", syllables: ["back"], misspellings: ["bak","bac"], sentence: "We walked back to camp." },
  { word: "sick", rank: 630, tier: 2, pattern: "ck-ng", syllables: ["sick"], misspellings: ["sik"], sentence: "I felt sick after the long hike." },
  { word: "duck", rank: 640, tier: 2, pattern: "ck-ng", syllables: ["duck"], misspellings: ["duk"], sentence: "A duck swam in the pond." },
  { word: "sing", rank: 650, tier: 2, pattern: "ck-ng", syllables: ["sing"], misspellings: [], sentence: "We sing songs by the fire." },
  { word: "ring", rank: 265, tier: 2, pattern: "ck-ng", syllables: ["ring"], misspellings: [], sentence: "She wore a gold ring." },
  { word: "king", rank: 285, tier: 2, pattern: "ck-ng", syllables: ["king"], misspellings: [], sentence: "The king kept his gems in a chest." },
  { word: "long", rank: 60,  tier: 2, pattern: "ck-ng", syllables: ["long"], misspellings: [], sentence: "It was a long, long trail." },

  // ============================================================
  // TIER 3 — Grade 2: silent-e (magic e) + common vowel teams
  // ============================================================

  // a_e
  { word: "cake", rank: 660, tier: 3, pattern: "silent-e-a", syllables: ["cake"], misspellings: ["cak","caik"], sentence: "We ate cake after the trip." },
  { word: "made", rank: 112, tier: 3, pattern: "silent-e-a", syllables: ["made"], misspellings: ["maid","mad"], sentence: "We made a map of the cave." },
  { word: "name", rank: 115, tier: 3, pattern: "silent-e-a", syllables: ["name"], misspellings: ["naim","nam"], sentence: "Write your name on the page." },
  { word: "game", rank: 205, tier: 3, pattern: "silent-e-a", syllables: ["game"], misspellings: ["gaim","gam"], sentence: "This spelling game is fun." },
  { word: "gave", rank: 210, tier: 3, pattern: "silent-e-a", syllables: ["gave"], misspellings: ["gaiv","gav"], sentence: "She gave me a shiny stone." },
  { word: "late", rank: 225, tier: 3, pattern: "silent-e-a", syllables: ["late"], misspellings: ["lait","lat"], sentence: "We were late getting home." },
  { word: "same", rank: 130, tier: 3, pattern: "silent-e-a", syllables: ["same"], misspellings: ["saim","sam"], sentence: "We took the same path back." },
  { word: "face", rank: 235, tier: 3, pattern: "silent-e-a", syllables: ["face"], misspellings: ["fase","faice"], sentence: "A smile spread across her face." },

  // i_e
  { word: "time", rank: 71,  tier: 3, pattern: "silent-e-i", syllables: ["time"], misspellings: ["tim","tyme"], sentence: "It is time to go exploring." },
  { word: "ride", rank: 280, tier: 3, pattern: "silent-e-i", syllables: ["ride"], misspellings: ["rid","ryde"], sentence: "We ride bikes to the trail." },
  { word: "like", rank: 89,  tier: 3, pattern: "silent-e-i", syllables: ["like"], misspellings: ["lik","liek"], sentence: "I like to collect rocks." },
  { word: "side", rank: 175, tier: 3, pattern: "silent-e-i", syllables: ["side"], misspellings: ["sid","syde"], sentence: "The cave was on the other side." },
  { word: "nice", rank: 290, tier: 3, pattern: "silent-e-i", syllables: ["nice"], misspellings: ["nise","nyce"], sentence: "It was a nice day for a hike." },
  { word: "mile", rank: 300, tier: 3, pattern: "silent-e-i", syllables: ["mile"], misspellings: ["mil","myle"], sentence: "We walked one more mile." },
  { word: "fire", rank: 230, tier: 3, pattern: "silent-e-i", syllables: ["fire"], misspellings: ["fier","fyre"], sentence: "We built a fire at camp." },
  { word: "five", rank: 220, tier: 3, pattern: "silent-e-i", syllables: ["five"], misspellings: ["fiv","fyve"], sentence: "I found five gems today." },

  // o_e
  { word: "hope", rank: 310, tier: 3, pattern: "silent-e-o", syllables: ["hope"], misspellings: ["hop","hoap"], sentence: "I hope we find treasure." },
  { word: "home", rank: 95,  tier: 3, pattern: "silent-e-o", syllables: ["home"], misspellings: ["hom","hoam"], sentence: "We walked home before dark." },
  { word: "nose", rank: 320, tier: 3, pattern: "silent-e-o", syllables: ["nose"], misspellings: ["noze","noes"], sentence: "Dust got up my nose in the cave." },
  { word: "rose", rank: 330, tier: 3, pattern: "silent-e-o", syllables: ["rose"], misspellings: ["roze","roes"], sentence: "The sun rose over the hills." },
  { word: "those",rank: 165, tier: 3, pattern: "silent-e-o", syllables: ["those"], misspellings: ["thoze","thows"], sentence: "Those rocks are full of crystals." },
  { word: "note", rank: 340, tier: 3, pattern: "silent-e-o", syllables: ["note"], misspellings: ["noat","not"], sentence: "I left a note for my friend." },
  { word: "stone",rank: 350, tier: 3, pattern: "silent-e-o", syllables: ["stone"], misspellings: ["stoan","ston"], sentence: "I picked up a smooth stone." },

  // u_e
  { word: "use",  rank: 73,  tier: 3, pattern: "silent-e-u", syllables: ["use"], misspellings: ["uze","yoos"], sentence: "We use a map to explore." },
  { word: "cute", rank: 360, tier: 3, pattern: "silent-e-u", syllables: ["cute"], misspellings: ["coot","kute"], sentence: "The baby fox was so cute." },
  { word: "tube", rank: 370, tier: 3, pattern: "silent-e-u", syllables: ["tube"], misspellings: ["toob","toube"], sentence: "We kept the map in a tube." },
  { word: "rule", rank: 380, tier: 3, pattern: "silent-e-u", syllables: ["rule"], misspellings: ["rool","ruol"], sentence: "The first rule is to stay safe." },

  // ai-ay
  { word: "rain", rank: 250, tier: 3, pattern: "ai-ay", syllables: ["rain"], misspellings: ["rane","rayn"], sentence: "The rain made the trail muddy." },
  { word: "train",rank: 240, tier: 3, pattern: "ai-ay", syllables: ["train"], misspellings: ["trane","trayn"], sentence: "We took a train to the mountains." },
  { word: "play", rank: 118, tier: 3, pattern: "ai-ay", syllables: ["play"], misspellings: ["plai","plae"], sentence: "We play near the big rocks." },
  { word: "day",  rank: 55,  tier: 3, pattern: "ai-ay", syllables: ["day"], misspellings: ["dai","daye"], sentence: "It was a sunny day to explore." },
  { word: "way",  rank: 48,  tier: 3, pattern: "ai-ay", syllables: ["way"], misspellings: ["wai","waye"], sentence: "Which way leads to the cave?" },
  { word: "wait", rank: 260, tier: 3, pattern: "ai-ay", syllables: ["wait"], misspellings: ["wate","wayt"], sentence: "Wait for me at the bridge." },
  { word: "tail", rank: 270, tier: 3, pattern: "ai-ay", syllables: ["tail"], misspellings: ["tale","tayl"], sentence: "The fox had a bushy tail." },
  { word: "stay", rank: 215, tier: 3, pattern: "ai-ay", syllables: ["stay"], misspellings: ["stai","staye"], sentence: "Please stay on the path." },
  { word: "mail", rank: 280, tier: 3, pattern: "ai-ay", syllables: ["mail"], misspellings: ["male","mayl"], sentence: "A letter came in the mail." },

  // ee-ea
  { word: "tree", rank: 175, tier: 3, pattern: "ee-ea", syllables: ["tree"], misspellings: ["tre","trea"], sentence: "We rested under a tall tree." },
  { word: "green",rank: 180, tier: 3, pattern: "ee-ea", syllables: ["green"], misspellings: ["grean","grene"], sentence: "The stone had a green glow." },
  { word: "need", rank: 110, tier: 3, pattern: "ee-ea", syllables: ["need"], misspellings: ["nead","ned"], sentence: "We need more water." },
  { word: "feet", rank: 200, tier: 3, pattern: "ee-ea", syllables: ["feet"], misspellings: ["feat","fete"], sentence: "My feet were tired after the hike." },
  { word: "keep", rank: 145, tier: 3, pattern: "ee-ea", syllables: ["keep"], misspellings: ["keap","kep"], sentence: "I will keep this special rock." },
  { word: "each", rank: 100, tier: 3, pattern: "ee-ea", syllables: ["each"], misspellings: ["eech","eatch"], sentence: "We checked each rock for gems." },
  { word: "read", rank: 130, tier: 3, pattern: "ee-ea", syllables: ["read"], misspellings: ["red","reed"], sentence: "I read the map carefully." },
  { word: "sea",  rank: 190, tier: 3, pattern: "ee-ea", syllables: ["sea"], misspellings: ["see","sae"], sentence: "The waves rolled in from the sea." },
  { word: "team", rank: 210, tier: 3, pattern: "ee-ea", syllables: ["team"], misspellings: ["teem","teme"], sentence: "Our team found the hidden cave." },
  { word: "clean",rank: 240, tier: 3, pattern: "ee-ea", syllables: ["clean"], misspellings: ["clene","cleen"], sentence: "We washed the gems until they were clean." },

  // oa-ow long o
  { word: "boat", rank: 255, tier: 3, pattern: "oa-ow-long", syllables: ["boat"], misspellings: ["bote","bowt"], sentence: "We rowed the boat to the island." },
  { word: "road", rank: 160, tier: 3, pattern: "oa-ow-long", syllables: ["road"], misspellings: ["rode","rowd"], sentence: "The road led up the mountain." },
  { word: "snow", rank: 230, tier: 3, pattern: "oa-ow-long", syllables: ["snow"], misspellings: ["sno","snowe"], sentence: "Snow covered the high peaks." },
  { word: "coat", rank: 265, tier: 3, pattern: "oa-ow-long", syllables: ["coat"], misspellings: ["cote","cowt"], sentence: "Wear a warm coat in the cave." },
  { word: "soap", rank: 275, tier: 3, pattern: "oa-ow-long", syllables: ["soap"], misspellings: ["sope","sowp"], sentence: "We used soap to clean the rocks." },
  { word: "grow", rank: 220, tier: 3, pattern: "oa-ow-long", syllables: ["grow"], misspellings: ["groe","groa"], sentence: "Crystals grow inside the rock." },
  { word: "low",  rank: 285, tier: 3, pattern: "oa-ow-long", syllables: ["low"], misspellings: ["lowe","lo"], sentence: "The cave roof was very low." },
  { word: "goat", rank: 295, tier: 3, pattern: "oa-ow-long", syllables: ["goat"], misspellings: ["gote","gowt"], sentence: "A goat climbed the rocky cliff." },
  { word: "show", rank: 170, tier: 3, pattern: "oa-ow-long", syllables: ["show"], misspellings: ["sho","showe"], sentence: "Let me show you the gem." },

  // y as long e
  { word: "happy",rank: 305, tier: 3, pattern: "y-long-e", syllables: ["hap","py"], misspellings: ["happey","hapy"], sentence: "I was happy to find the cave." },
  { word: "baby", rank: 315, tier: 3, pattern: "y-long-e", syllables: ["ba","by"], misspellings: ["babey","babie"], sentence: "The baby bird sat in the nest." },
  { word: "very", rank: 80,  tier: 3, pattern: "y-long-e", syllables: ["ver","y"], misspellings: ["verry","vary"], sentence: "The cave was very deep." },
  { word: "city", rank: 325, tier: 3, pattern: "y-long-e", syllables: ["cit","y"], misspellings: ["citty","sity"], sentence: "We left the city to go camping." },
  { word: "lady", rank: 335, tier: 3, pattern: "y-long-e", syllables: ["la","dy"], misspellings: ["ladey","ladie"], sentence: "A kind lady showed us the trail." },
  { word: "sunny",rank: 345, tier: 3, pattern: "y-long-e", syllables: ["sun","ny"], misspellings: ["suny","sunney"], sentence: "It was a sunny day for digging." },

  // ============================================================
  // TIER 4 — Grade 3: r-controlled, -ight, -tch, diphthongs, oo
  // ============================================================

  // ar
  { word: "car",   rank: 200, tier: 4, pattern: "r-ar", syllables: ["car"], misspellings: ["cor","care"], sentence: "We drove the car to the trail." },
  { word: "star",  rank: 290, tier: 4, pattern: "r-ar", syllables: ["star"], misspellings: ["stahr","starr"], sentence: "The gem shone like a star." },
  { word: "far",   rank: 130, tier: 4, pattern: "r-ar", syllables: ["far"], misspellings: ["fahr","farr"], sentence: "The cave was not far away." },
  { word: "hard",  rank: 175, tier: 4, pattern: "r-ar", syllables: ["hard"], misspellings: ["hardd","hord"], sentence: "The rock was very hard." },
  { word: "dark",  rank: 240, tier: 4, pattern: "r-ar", syllables: ["dark"], misspellings: ["darck","derk"], sentence: "It was dark inside the cave." },
  { word: "part",  rank: 95,  tier: 4, pattern: "r-ar", syllables: ["part"], misspellings: ["parte","pard"], sentence: "This is the best part of the trip." },
  { word: "start", rank: 165, tier: 4, pattern: "r-ar", syllables: ["start"], misspellings: ["strat","stort"], sentence: "Let's start our adventure." },
  { word: "garden",rank: 350, tier: 4, pattern: "r-ar", syllables: ["gar","den"], misspellings: ["gardin","gardan"], sentence: "We found rocks in the garden." },

  // or
  { word: "for",   rank: 12,  tier: 4, pattern: "r-or", syllables: ["for"], misspellings: ["fore","fer"], sentence: "We searched for hidden gems." },
  { word: "born",  rank: 360, tier: 4, pattern: "r-or", syllables: ["born"], misspellings: ["borne","bourn"], sentence: "The baby goat was born in spring." },
  { word: "corn",  rank: 370, tier: 4, pattern: "r-or", syllables: ["corn"], misspellings: ["corne","korn"], sentence: "We ate corn around the fire." },
  { word: "story", rank: 180, tier: 4, pattern: "r-or", syllables: ["sto","ry"], misspellings: ["storey","storry"], sentence: "She told a story about the cave." },
  { word: "more",  rank: 50,  tier: 4, pattern: "r-or", syllables: ["more"], misspellings: ["mor","moore"], sentence: "We found more gems than ever." },
  { word: "short", rank: 220, tier: 4, pattern: "r-or", syllables: ["short"], misspellings: ["shorrt","shert"], sentence: "It was a short walk to the river." },
  { word: "north", rank: 280, tier: 4, pattern: "r-or", syllables: ["north"], misspellings: ["norht","nourth"], sentence: "The cave was to the north." },

  // er-ir-ur
  { word: "bird",  rank: 255, tier: 4, pattern: "r-er-ir-ur", syllables: ["bird"], misspellings: ["berd","burd"], sentence: "A bird sang in the tree." },
  { word: "turn",  rank: 145, tier: 4, pattern: "r-er-ir-ur", syllables: ["turn"], misspellings: ["tern","tirn"], sentence: "Turn left at the big rock." },
  { word: "first", rank: 60,  tier: 4, pattern: "r-er-ir-ur", syllables: ["first"], misspellings: ["frist","ferst"], sentence: "I found my first gem today." },
  { word: "girl",  rank: 210, tier: 4, pattern: "r-er-ir-ur", syllables: ["girl"], misspellings: ["gril","gurl"], sentence: "The girl led us to the cave." },
  { word: "her",   rank: 28,  tier: 4, pattern: "r-er-ir-ur", syllables: ["her"], misspellings: ["hur","herr"], sentence: "I gave her the shiny stone." },
  { word: "after", rank: 90,  tier: 4, pattern: "r-er-ir-ur", syllables: ["af","ter"], misspellings: ["affter","aftar"], sentence: "We rested after the long hike." },
  { word: "under", rank: 105, tier: 4, pattern: "r-er-ir-ur", syllables: ["un","der"], misspellings: ["undr","undar"], sentence: "The gem was hidden under a rock." },
  { word: "winter",rank: 320, tier: 4, pattern: "r-er-ir-ur", syllables: ["win","ter"], misspellings: ["wintr","wintar"], sentence: "The cave was cold in winter." },
  { word: "dirt",  rank: 385, tier: 4, pattern: "r-er-ir-ur", syllables: ["dirt"], misspellings: ["dert","durt"], sentence: "We brushed the dirt off the gem." },

  // ight
  { word: "light", rank: 195, tier: 4, pattern: "ight", syllables: ["light"], misspellings: ["lite","lihgt","ligt"], sentence: "We used a light in the dark cave." },
  { word: "night", rank: 185, tier: 4, pattern: "ight", syllables: ["night"], misspellings: ["nite","nihgt","nigt"], sentence: "Stars filled the night sky." },
  { word: "right", rank: 75,  tier: 4, pattern: "ight", syllables: ["right"], misspellings: ["rite","ryte","rihgt"], sentence: "Turn right at the old tree." },
  { word: "bright",rank: 310, tier: 4, pattern: "ight", syllables: ["bright"], misspellings: ["brite","bryte","brihgt"], sentence: "The gem was bright and clear." },
  { word: "fight", rank: 380, tier: 4, pattern: "ight", syllables: ["fight"], misspellings: ["fite","fyte","fihgt"], sentence: "The knights did not want to fight." },
  { word: "high",  rank: 150, tier: 4, pattern: "ight", syllables: ["high"], misspellings: ["hye","hi","hihg"], sentence: "We climbed very high up the cliff." },
  { word: "might", rank: 290, tier: 4, pattern: "ight", syllables: ["might"], misspellings: ["mite","myte","mihgt"], sentence: "We might find gold today." },
  { word: "sight", rank: 400, tier: 4, pattern: "ight", syllables: ["sight"], misspellings: ["site","syte","sihgt"], sentence: "The cave came into sight at last." },

  // tch
  { word: "catch", rank: 330, tier: 4, pattern: "tch", syllables: ["catch"], misspellings: ["cach","catsh","cathc"], sentence: "Try to catch the falling rock." },
  { word: "watch", rank: 230, tier: 4, pattern: "tch", syllables: ["watch"], misspellings: ["wach","wotch","watsh"], sentence: "Watch your step near the edge." },
  { word: "match", rank: 360, tier: 4, pattern: "tch", syllables: ["match"], misspellings: ["mach","matsh","matche"], sentence: "We lit a match by the fire." },
  { word: "kitchen",rank: 420,tier: 4, pattern: "tch", syllables: ["kitch","en"], misspellings: ["kichen","kitchin","kitschen"], sentence: "We washed the rocks in the kitchen." },
  { word: "pitch", rank: 440, tier: 4, pattern: "tch", syllables: ["pitch"], misspellings: ["pich","pitsh","pitche"], sentence: "We had to pitch the tent before dark." },

  // ou-ow loud
  { word: "cloud", rank: 300, tier: 4, pattern: "ou-ow-loud", syllables: ["cloud"], misspellings: ["clowd","clood","cloued"], sentence: "A dark cloud rolled over the hills." },
  { word: "found", rank: 110, tier: 4, pattern: "ou-ow-loud", syllables: ["found"], misspellings: ["fownd","fount","founde"], sentence: "We found a glowing gem." },
  { word: "about", rank: 40,  tier: 4, pattern: "ou-ow-loud", syllables: ["a","bout"], misspellings: ["abowt","abuot","aboutt"], sentence: "We learned about caves at school." },
  { word: "house", rank: 125, tier: 4, pattern: "ou-ow-loud", syllables: ["house"], misspellings: ["howse","huose","hause"], sentence: "Rocks lined the path to the house." },
  { word: "mouth", rank: 270, tier: 4, pattern: "ou-ow-loud", syllables: ["mouth"], misspellings: ["mowth","mouht","moth"], sentence: "The cave's mouth was wide and dark." },
  { word: "out",   rank: 35,  tier: 4, pattern: "ou-ow-loud", syllables: ["out"], misspellings: ["owt","oute","aut"], sentence: "We climbed out of the deep cave." },
  { word: "how",   rank: 68,  tier: 4, pattern: "ou-ow-loud", syllables: ["how"], misspellings: ["howe","hau","haow"], sentence: "How do crystals form?" },
  { word: "down",  rank: 80,  tier: 4, pattern: "ou-ow-loud", syllables: ["down"], misspellings: ["doun","dowwn","daown"], sentence: "We climbed down the steep cliff." },
  { word: "town",  rank: 240, tier: 4, pattern: "ou-ow-loud", syllables: ["town"], misspellings: ["toun","towne","taown"], sentence: "The rock shop is in town." },
  { word: "ground",rank: 215, tier: 4, pattern: "ou-ow-loud", syllables: ["ground"], misspellings: ["grownd","grond","grounde"], sentence: "Gems were buried in the ground." },

  // oi-oy
  { word: "point", rank: 175, tier: 4, pattern: "oi-oy", syllables: ["point"], misspellings: ["poynt","pont","pointe"], sentence: "The arrow shows which point to dig." },
  { word: "boy",   rank: 220, tier: 4, pattern: "oi-oy", syllables: ["boy"], misspellings: ["boi","boye","bouy"], sentence: "The boy found a rare crystal." },
  { word: "join",  rank: 350, tier: 4, pattern: "oi-oy", syllables: ["join"], misspellings: ["joyn","jion","joine"], sentence: "Come join us in the cave." },
  { word: "soil",  rank: 410, tier: 4, pattern: "oi-oy", syllables: ["soil"], misspellings: ["soyl","sole","soile"], sentence: "We dug through the dark soil." },
  { word: "enjoy", rank: 430, tier: 4, pattern: "oi-oy", syllables: ["en","joy"], misspellings: ["enjoi","injoy","enjoye"], sentence: "I enjoy hunting for gems." },
  { word: "coin",  rank: 440, tier: 4, pattern: "oi-oy", syllables: ["coin"], misspellings: ["coyn","cion","coine"], sentence: "We found an old gold coin." },

  // oo
  { word: "moon",  rank: 290, tier: 4, pattern: "oo", syllables: ["moon"], misspellings: ["mune","moone","mun"], sentence: "The moon lit up the trail." },
  { word: "book",  rank: 100, tier: 4, pattern: "oo", syllables: ["book"], misspellings: ["buk","booke","bok"], sentence: "I read a book about rocks." },
  { word: "look",  rank: 70,  tier: 4, pattern: "oo", syllables: ["look"], misspellings: ["luk","looke","lok"], sentence: "Look at this shiny gem!" },
  { word: "soon",  rank: 160, tier: 4, pattern: "oo", syllables: ["soon"], misspellings: ["sune","soone","son"], sentence: "We will reach the cave soon." },
  { word: "food",  rank: 230, tier: 4, pattern: "oo", syllables: ["food"], misspellings: ["fude","foode","fud"], sentence: "We packed food for the trip." },
  { word: "room",  rank: 170, tier: 4, pattern: "oo", syllables: ["room"], misspellings: ["rume","roome","rom"], sentence: "There was room for one more gem." },
  { word: "good",  rank: 45,  tier: 4, pattern: "oo", syllables: ["good"], misspellings: ["gud","goode","god"], sentence: "It was a good day to explore." },
  { word: "tooth", rank: 360, tier: 4, pattern: "oo", syllables: ["tooth"], misspellings: ["tuth","toothe","tooht"], sentence: "We found a shark tooth in the rock." },
  { word: "wood",  rank: 250, tier: 4, pattern: "oo", syllables: ["wood"], misspellings: ["wud","woode","wod"], sentence: "We gathered wood for the fire." },

  // aw-au-all
  { word: "saw",   rank: 140, tier: 4, pattern: "aw-au-all", syllables: ["saw"], misspellings: ["sawe","sau","soar"], sentence: "We saw a bat in the cave." },
  { word: "ball",  rank: 245, tier: 4, pattern: "aw-au-all", syllables: ["ball"], misspellings: ["bal","baul","balle"], sentence: "The round rock looked like a ball." },
  { word: "call",  rank: 155, tier: 4, pattern: "aw-au-all", syllables: ["call"], misspellings: ["cal","caul","calle"], sentence: "Call me if you find gold." },
  { word: "fall",  rank: 195, tier: 4, pattern: "aw-au-all", syllables: ["fall"], misspellings: ["fal","faul","falle"], sentence: "Be careful not to fall." },
  { word: "small", rank: 130, tier: 4, pattern: "aw-au-all", syllables: ["small"], misspellings: ["smal","smaul","smalle"], sentence: "I found a small green gem." },
  { word: "draw",  rank: 300, tier: 4, pattern: "aw-au-all", syllables: ["draw"], misspellings: ["drawe","drau","drow"], sentence: "I like to draw the rocks I find." },
  { word: "wall",  rank: 290, tier: 4, pattern: "aw-au-all", syllables: ["wall"], misspellings: ["wal","waul","walle"], sentence: "Crystals grew on the cave wall." },
  { word: "yawn",  rank: 460, tier: 4, pattern: "aw-au-all", syllables: ["yawn"], misspellings: ["yaun","yon","yawne"], sentence: "I let out a big yawn after the hike." },

  // ============================================================
  // TIER 5 — Grade 3: high-frequency TRICKY / IRREGULAR words
  // ============================================================

  // tricky
  { word: "because",rank: 152, tier: 5, pattern: "tricky", syllables: ["be","cause"], misspellings: ["becuase","becouse","becase","becaus"], sentence: "I was late because I missed the bus." },
  { word: "friend", rank: 220, tier: 5, pattern: "tricky", syllables: ["friend"], misspellings: ["freind","frend","frien"], sentence: "My friend helped me find the cave." },
  { word: "said",   rank: 50,  tier: 5, pattern: "tricky", syllables: ["said"], misspellings: ["sed","sayd","saed"], sentence: "She said the gem was real." },
  { word: "were",   rank: 32,  tier: 5, pattern: "tricky", syllables: ["were"], misspellings: ["wer","wur","ware"], sentence: "We were deep inside the cave." },
  { word: "there",  rank: 38,  tier: 5, pattern: "tricky", syllables: ["there"], misspellings: ["thair","ther","theyr"], sentence: "The treasure is over there." },
  { word: "people", rank: 145, tier: 5, pattern: "tricky", syllables: ["peo","ple"], misspellings: ["peeple","peopel","pepole"], sentence: "Many people search for gold." },
  { word: "school", rank: 165, tier: 5, pattern: "tricky", syllables: ["school"], misspellings: ["skool","scool","schoole"], sentence: "We learned about rocks at school." },
  { word: "again",  rank: 130, tier: 5, pattern: "tricky", syllables: ["a","gain"], misspellings: ["agian","agen","agane"], sentence: "Let's explore the cave again." },
  { word: "does",   rank: 175, tier: 5, pattern: "tricky", syllables: ["does"], misspellings: ["dose","duz","dus"], sentence: "Does this rock have crystals?" },
  { word: "want",   rank: 110, tier: 5, pattern: "tricky", syllables: ["want"], misspellings: ["wont","wnat","wante"], sentence: "I want to find a rare gem." },
  { word: "work",   rank: 78,  tier: 5, pattern: "tricky", syllables: ["work"], misspellings: ["werk","wrok","worke"], sentence: "It takes work to dig for gems." },
  { word: "world",  rank: 185, tier: 5, pattern: "tricky", syllables: ["world"], misspellings: ["wurld","wrold","worled"], sentence: "Caves are found all over the world." },
  { word: "always", rank: 235, tier: 5, pattern: "tricky", syllables: ["al","ways"], misspellings: ["allways","alway","alwayz"], sentence: "I always wear boots when I explore." },
  { word: "many",   rank: 82,  tier: 5, pattern: "tricky", syllables: ["man","y"], misspellings: ["meny","manny","menny"], sentence: "There were many gems in the cave." },
  { word: "any",    rank: 88,  tier: 5, pattern: "tricky", syllables: ["an","y"], misspellings: ["eny","anny","enny"], sentence: "Did you find any gold?" },
  { word: "every",  rank: 100, tier: 5, pattern: "tricky", syllables: ["ev","ery"], misspellings: ["evry","everry","evrey"], sentence: "We checked every rock in the cave." },
  { word: "once",   rank: 190, tier: 5, pattern: "tricky", syllables: ["once"], misspellings: ["wonce","onse","wunce"], sentence: "Once we found gold in the river." },
  { word: "buy",    rank: 250, tier: 5, pattern: "tricky", syllables: ["buy"], misspellings: ["by","bye","bui"], sentence: "We went to buy a new map." },
  { word: "money",  rank: 200, tier: 5, pattern: "tricky", syllables: ["mon","ey"], misspellings: ["mony","muney","monney"], sentence: "The old coin was worth a lot of money." },
  { word: "love",   rank: 205, tier: 5, pattern: "tricky", syllables: ["love"], misspellings: ["luv","lovv","lov"], sentence: "I love finding shiny gems." },
  { word: "come",   rank: 66,  tier: 5, pattern: "tricky", syllables: ["come"], misspellings: ["cum","comme","kome"], sentence: "Come and see the crystal cave." },
  { word: "some",   rank: 44,  tier: 5, pattern: "tricky", syllables: ["some"], misspellings: ["sum","somme","som"], sentence: "We kept some of the best stones." },
  { word: "they",   rank: 18,  tier: 5, pattern: "tricky", syllables: ["they"], misspellings: ["thay","thei","tey"], sentence: "They climbed to the top of the hill." },
  { word: "been",   rank: 95,  tier: 5, pattern: "tricky", syllables: ["been"], misspellings: ["bin","ben","bean"], sentence: "We have been to that cave before." },
  { word: "though",  rank: 240, tier: 5, pattern: "tricky", syllables: ["though"], misspellings: ["tho","thogh","thou"], sentence: "We kept digging even though it was late." },

  // tricky-ould
  { word: "would",  rank: 70,  tier: 5, pattern: "tricky-ould", syllables: ["would"], misspellings: ["wood","wuld","woud"], sentence: "I would love to explore that cave." },
  { word: "could",  rank: 72,  tier: 5, pattern: "tricky-ould", syllables: ["could"], misspellings: ["cud","culd","coud"], sentence: "We could see the gem glowing." },
  { word: "should", rank: 120, tier: 5, pattern: "tricky-ould", syllables: ["should"], misspellings: ["shud","shuld","shoud"], sentence: "We should bring a light." },

  // tricky wh / question words
  { word: "where",  rank: 54,  tier: 5, pattern: "tricky-wh-q", syllables: ["where"], misspellings: ["wher","ware","were"], sentence: "Where did you find that stone?" },
  { word: "what",   rank: 30,  tier: 5, pattern: "tricky-wh-q", syllables: ["what"], misspellings: ["wat","whut","whatt"], sentence: "What kind of gem is this?" },
  { word: "who",    rank: 42,  tier: 5, pattern: "tricky-wh-q", syllables: ["who"], misspellings: ["hoo","whoo","ho"], sentence: "Who found the hidden cave?" },
  { word: "why",    rank: 115, tier: 5, pattern: "tricky-wh-q", syllables: ["why"], misspellings: ["wy","whye","whi"], sentence: "Why do crystals shine?" },
  { word: "whose",  rank: 380, tier: 5, pattern: "tricky-wh-q", syllables: ["whose"], misspellings: ["hooz","whos","whoze"], sentence: "Whose backpack is full of rocks?" },

  // ============================================================
  // TIER 6 — Grade 4: multisyllable, suffixes/endings, homophones
  // ============================================================

  // tion / sion
  { word: "question",  rank: 230, tier: 6, pattern: "tion", syllables: ["ques","tion"], misspellings: ["questian","questoin","queston"], sentence: "I have a question about this rock." },
  { word: "action",    rank: 250, tier: 6, pattern: "tion", syllables: ["ac","tion"], misspellings: ["actoin","acshun","actian"], sentence: "The explorers sprang into action." },
  { word: "station",   rank: 270, tier: 6, pattern: "tion", syllables: ["sta","tion"], misspellings: ["statoin","stashun","statian"], sentence: "We met at the train station." },
  { word: "nation",    rank: 290, tier: 6, pattern: "tion", syllables: ["na","tion"], misspellings: ["natoin","nashun","natian"], sentence: "Caves are found across the nation." },
  { word: "motion",    rank: 310, tier: 6, pattern: "tion", syllables: ["mo","tion"], misspellings: ["motoin","moshun","motian"], sentence: "The water was in constant motion." },
  { word: "vacation",  rank: 330, tier: 6, pattern: "tion", syllables: ["va","ca","tion"], misspellings: ["vacatoin","vacashun","vaction"], sentence: "We explored caves on our vacation." },

  // suffix -ful / -ly / -ment
  { word: "beautiful", rank: 320, tier: 6, pattern: "suffix-ful-ly", syllables: ["beau","ti","ful"], misspellings: ["beutiful","beautifull","butiful"], sentence: "The crystal cave was beautiful." },
  { word: "careful",   rank: 340, tier: 6, pattern: "suffix-ful-ly", syllables: ["care","ful"], misspellings: ["carefull","carful","carefal"], sentence: "Be careful on the slippery rocks." },
  { word: "really",    rank: 160, tier: 6, pattern: "suffix-ful-ly", syllables: ["real","ly"], misspellings: ["realy","rilly","reallly"], sentence: "That gem is really rare." },
  { word: "finally",   rank: 350, tier: 6, pattern: "suffix-ful-ly", syllables: ["fi","nal","ly"], misspellings: ["finaly","finalley","fianlly"], sentence: "We finally reached the cave." },
  { word: "movement",  rank: 360, tier: 6, pattern: "suffix-ful-ly", syllables: ["move","ment"], misspellings: ["movment","movemant","moovment"], sentence: "We saw a movement in the dark cave." },
  { word: "wonderful", rank: 370, tier: 6, pattern: "suffix-ful-ly", syllables: ["won","der","ful"], misspellings: ["wonderfull","wunderful","wonderfal"], sentence: "It was a wonderful adventure." },

  // multisyllable
  { word: "different", rank: 200, tier: 6, pattern: "multisyllable", syllables: ["dif","fer","ent"], misspellings: ["diffrent","diferent","differant"], sentence: "Each rock looked different." },
  { word: "important", rank: 210, tier: 6, pattern: "multisyllable", syllables: ["im","por","tant"], misspellings: ["importent","importnt","impotant"], sentence: "It is important to stay safe in caves." },
  { word: "remember",  rank: 240, tier: 6, pattern: "multisyllable", syllables: ["re","mem","ber"], misspellings: ["remeber","rember","remembar"], sentence: "Remember to bring a light." },
  { word: "favorite",  rank: 380, tier: 6, pattern: "multisyllable", syllables: ["fa","vor","ite"], misspellings: ["favorit","favrite","faverite"], sentence: "The green gem is my favorite." },
  { word: "animal",    rank: 190, tier: 6, pattern: "multisyllable", syllables: ["an","i","mal"], misspellings: ["animul","aminal","animel"], sentence: "We saw a small animal near the cave." },
  { word: "family",    rank: 180, tier: 6, pattern: "multisyllable", syllables: ["fam","i","ly"], misspellings: ["famly","familey","famaly"], sentence: "My family loves to go camping." },
  { word: "october",   rank: 400, tier: 6, pattern: "multisyllable", syllables: ["oc","to","ber"], misspellings: ["octobor","octber","octobre"], sentence: "We hiked the trail in october." },
  { word: "special",   rank: 260, tier: 6, pattern: "multisyllable", syllables: ["spe","cial"], misspellings: ["speshul","specal","speical"], sentence: "This is a very special stone." },
  { word: "another",   rank: 130, tier: 6, pattern: "multisyllable", syllables: ["an","oth","er"], misspellings: ["anuther","anther","anothr"], sentence: "Let's explore another cave." },
  { word: "together",  rank: 170, tier: 6, pattern: "multisyllable", syllables: ["to","geth","er"], misspellings: ["togather","togethr","togeather"], sentence: "We dug for gems together." },
  { word: "morning",   rank: 220, tier: 6, pattern: "multisyllable", syllables: ["morn","ing"], misspellings: ["mornin","moring","morrning"], sentence: "We set out early in the morning." },
  { word: "mountain",  rank: 350, tier: 6, pattern: "multisyllable", syllables: ["moun","tain"], misspellings: ["mountian","mountan","montain"], sentence: "We climbed the tall mountain." },

  // homophones
  { word: "their",   rank: 39,  tier: 6, pattern: "homophone", syllables: ["their"], misspellings: ["thier","thair","ther"], sentence: "The explorers packed their gear." },
  { word: "they're", rank: 410, tier: 6, pattern: "homophone", syllables: ["they're"], misspellings: ["thier","theyre","their"], sentence: "They're going to the crystal cave." },
  { word: "too",     rank: 110, tier: 6, pattern: "homophone", syllables: ["too"], misspellings: ["to","tow","tou"], sentence: "I want to come too!" },
  { word: "two",     rank: 76,  tier: 6, pattern: "homophone", syllables: ["two"], misspellings: ["too","to","tuo"], sentence: "We found two golden coins." },
  { word: "four",    rank: 165, tier: 6, pattern: "homophone", syllables: ["four"], misspellings: ["for","fore","fuor"], sentence: "We dug for four hours straight." },
  { word: "there's", rank: 420, tier: 6, pattern: "homophone", syllables: ["there's"], misspellings: ["theres","thairs","theirs"], sentence: "There's a gem in that rock." },
  { word: "your",    rank: 58,  tier: 6, pattern: "homophone", syllables: ["your"], misspellings: ["yor","youre","yore"], sentence: "Bring your light into the cave." },
  { word: "you're",  rank: 430, tier: 6, pattern: "homophone", syllables: ["you're"], misspellings: ["your","youre","yore"], sentence: "You're the best at finding gems." },
  { word: "here",    rank: 84,  tier: 6, pattern: "homophone", syllables: ["here"], misspellings: ["hear","heer","heir"], sentence: "The treasure is buried here." },
  { word: "hear",    rank: 240, tier: 6, pattern: "homophone", syllables: ["hear"], misspellings: ["here","heer","hier"], sentence: "I can hear water dripping in the cave." },
  { word: "knew",    rank: 250, tier: 6, pattern: "homophone", syllables: ["knew"], misspellings: ["new","nu","knu"], sentence: "I knew we would find the cave." },
  { word: "know",    rank: 86,  tier: 6, pattern: "homophone", syllables: ["know"], misspellings: ["no","now","knoe"], sentence: "I know where the gold is hidden." },

  // doubled consonants
  { word: "dollar",  rank: 390, tier: 6, pattern: "double-cons", syllables: ["dol","lar"], misspellings: ["doller","dolar","dollor"], sentence: "The old coin was worth a dollar." },
  { word: "listen",  rank: 280, tier: 6, pattern: "double-cons", syllables: ["lis","ten"], misspellings: ["lisen","listin","lissen"], sentence: "Listen for water inside the cave." },
  { word: "summer",  rank: 300, tier: 6, pattern: "double-cons", syllables: ["sum","mer"], misspellings: ["sumer","summor","sommer"], sentence: "We explore caves every summer." },
  { word: "little",  rank: 62,  tier: 6, pattern: "double-cons", syllables: ["lit","tle"], misspellings: ["litle","littel","liddle"], sentence: "A little gem sparkled in the dirt." },
  { word: "better",  rank: 140, tier: 6, pattern: "double-cons", syllables: ["bet","ter"], misspellings: ["beter","bettr","bettor"], sentence: "This gem is better than the last." },
  { word: "letter",  rank: 230, tier: 6, pattern: "double-cons", syllables: ["let","ter"], misspellings: ["leter","lettr","lettor"], sentence: "I wrote a letter about our trip." },
  { word: "sudden",  rank: 410, tier: 6, pattern: "double-cons", syllables: ["sud","den"], misspellings: ["suden","suddin","sodden"], sentence: "There was a sudden noise in the cave." },
  { word: "happen",  rank: 320, tier: 6, pattern: "double-cons", syllables: ["hap","pen"], misspellings: ["hapen","happin","happan"], sentence: "What will happen if we dig deeper?" },
];
