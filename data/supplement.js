// data/supplement.js — curated SUPPLEMENT to the frequency backbone.
//
// The backbone was filtered to the ~top-3000 frequency words, which missed many
// common, age-appropriate words and left some teaching pattern-families thin
// (most notably -ight). These hand-enriched entries fill those gaps. They are
// layered in by scripts/merge.mjs exactly like data/curated.js (a curated word
// outside the backbone keeps its own rank), then validated + frequency-sorted.
//
// Same schema as curated.js: { word, rank, tier, pattern, syllables, misspellings, sentence }.
// `rank` here is an approximate frequency estimate so the word slots into the
// teaching order sensibly. Sentences are kid-safe and contain the exact word.
export const WORDS = [
  // ---- -ight family (pattern "ight") — the biggest gap ----
  { word: "tight",      rank: 1900, tier: 4, pattern: "ight", syllables: ["tight"],            misspellings: ["tite", "tighte", "tght"],       sentence: "The rope was pulled tight across the cave." },
  { word: "slight",     rank: 2600, tier: 4, pattern: "ight", syllables: ["slight"],           misspellings: ["slite", "slighte"],             sentence: "There was a slight crack in the rock." },
  { word: "knight",     rank: 2400, tier: 5, pattern: "ight", syllables: ["knight"],           misspellings: ["nite", "night", "knite"],       sentence: "The brave knight explored the dark tower." },
  { word: "fright",     rank: 2800, tier: 4, pattern: "ight", syllables: ["fright"],           misspellings: ["frite", "frigt"],               sentence: "The bat gave me a fright in the cave." },
  { word: "tonight",    rank: 1700, tier: 4, pattern: "ight", syllables: ["to", "night"],      misspellings: ["tonite", "tonyte"],             sentence: "We will camp by the cave tonight." },
  { word: "delight",    rank: 2700, tier: 5, pattern: "ight", syllables: ["de", "light"],      misspellings: ["delite", "dilight"],            sentence: "The glowing gems were a delight to see." },
  { word: "mighty",     rank: 2300, tier: 4, pattern: "ight", syllables: ["might", "y"],       misspellings: ["mity", "mightey"],              sentence: "A mighty river ran through the cavern." },
  { word: "lightning",  rank: 2100, tier: 5, pattern: "ight", syllables: ["light", "ning"],    misspellings: ["lightening", "litning"],        sentence: "Lightning lit up the cave entrance." },
  { word: "midnight",   rank: 2200, tier: 5, pattern: "ight", syllables: ["mid", "night"],     misspellings: ["midnite", "midnght"],           sentence: "We reached the cave at midnight." },
  { word: "frighten",   rank: 3000, tier: 5, pattern: "ight", syllables: ["fright", "en"],     misspellings: ["friten", "frightin"],           sentence: "The dark tunnel did not frighten her." },
  { word: "brighten",   rank: 3100, tier: 5, pattern: "ight", syllables: ["bright", "en"],     misspellings: ["briten", "brightin"],           sentence: "The gems brighten the whole cave." },
  { word: "tighten",    rank: 3200, tier: 5, pattern: "ight", syllables: ["tight", "en"],      misspellings: ["titen", "tightin"],             sentence: "I had to tighten the rope before we climbed." },
  { word: "highlight",  rank: 2900, tier: 5, pattern: "ight", syllables: ["high", "light"],    misspellings: ["highlite", "hilight"],          sentence: "The shiny gem was the highlight of our trip." },
  { word: "sunlight",   rank: 1800, tier: 5, pattern: "ight", syllables: ["sun", "light"],     misspellings: ["sunlite", "sunlght"],           sentence: "Sunlight poured into the cave mouth." },
  { word: "daylight",   rank: 2000, tier: 5, pattern: "ight", syllables: ["day", "light"],     misspellings: ["daylite", "daylght"],           sentence: "We climbed out into the daylight." },
  { word: "brightly",   rank: 2500, tier: 5, pattern: "ight", syllables: ["bright", "ly"],     misspellings: ["brightley", "britely"],         sentence: "The crystal glowed brightly in the dark." },
  { word: "frightened", rank: 2050, tier: 5, pattern: "ight", syllables: ["fright", "ened"],   misspellings: ["frightend", "frightned"],       sentence: "The frightened mouse hid behind a rock." },

  // ---- a_e silent-e (pattern "silent-e-a") ----
  { word: "brave",  rank: 1600, tier: 3, pattern: "silent-e-a", syllables: ["brave"],          misspellings: ["brav", "braive"],   sentence: "The brave explorer entered the cave." },
  { word: "blaze",  rank: 3300, tier: 4, pattern: "silent-e-a", syllables: ["blaze"],          misspellings: ["blaize", "blayze"], sentence: "The campfire grew into a bright blaze." },
  { word: "grace",  rank: 2400, tier: 3, pattern: "silent-e-a", syllables: ["grace"],          misspellings: ["grais", "grase"],   sentence: "She climbed the rocks with grace." },
  { word: "flame",  rank: 2200, tier: 3, pattern: "silent-e-a", syllables: ["flame"],          misspellings: ["flaim", "flayme"],  sentence: "A single flame lit the dark tunnel." },
  { word: "crane",  rank: 3400, tier: 4, pattern: "silent-e-a", syllables: ["crane"],          misspellings: ["crain", "crayne"],  sentence: "A tall crane lifted the heavy rocks." },
  { word: "shade",  rank: 2600, tier: 3, pattern: "silent-e-a", syllables: ["shade"],          misspellings: ["shaid", "shayde"],  sentence: "We rested in the shade of the cliff." },
  { word: "blade",  rank: 2700, tier: 3, pattern: "silent-e-a", syllables: ["blade"],          misspellings: ["blaid", "blayde"],  sentence: "The knife had a sharp blade." },
  { word: "scrape", rank: 3000, tier: 4, pattern: "silent-e-a", syllables: ["scrape"],         misspellings: ["scraip", "scrayp"], sentence: "I got a small scrape on my knee." },

  // ---- i_e silent-e (pattern "silent-e-i") ----
  { word: "prize",  rank: 2300, tier: 3, pattern: "silent-e-i", syllables: ["prize"],          misspellings: ["prise", "pryze"],   sentence: "The biggest gem was our prize." },
  { word: "stripe", rank: 2900, tier: 3, pattern: "silent-e-i", syllables: ["stripe"],         misspellings: ["stripp", "strype"], sentence: "The rock had a white stripe across it." },
  { word: "slime",  rank: 2800, tier: 3, pattern: "silent-e-i", syllables: ["slime"],          misspellings: ["slyme", "slimm"],   sentence: "Green slime covered the cave wall." },
  { word: "spine",  rank: 3100, tier: 4, pattern: "silent-e-i", syllables: ["spine"],          misspellings: ["spyne", "spinne"],  sentence: "A chill ran down my spine in the dark." },
  { word: "glide",  rank: 3000, tier: 4, pattern: "silent-e-i", syllables: ["glide"],          misspellings: ["glyde", "glied"],   sentence: "The bats glide through the cavern." },
  { word: "shrine", rank: 3700, tier: 5, pattern: "silent-e-i", syllables: ["shrine"],         misspellings: ["shryne", "shrein"], sentence: "We found an old shrine deep in the cave." },

  // ---- o_e silent-e (pattern "silent-e-o") ----
  { word: "stove",  rank: 3000, tier: 4, pattern: "silent-e-o", syllables: ["stove"],          misspellings: ["stoav", "stoave"],  sentence: "We cooked soup on the camp stove." },
  { word: "globe",  rank: 3100, tier: 4, pattern: "silent-e-o", syllables: ["globe"],          misspellings: ["gloab", "globb"],   sentence: "The crystal was round like a globe." },
  { word: "slope",  rank: 2700, tier: 4, pattern: "silent-e-o", syllables: ["slope"],          misspellings: ["sloap", "slopp"],   sentence: "We hiked up the steep slope." },
  { word: "stroke", rank: 3400, tier: 5, pattern: "silent-e-o", syllables: ["stroke"],         misspellings: ["stroak", "stroek"], sentence: "She gave the dog a gentle stroke." },

  // ---- ar r-controlled (pattern "r-ar") ----
  { word: "spark", rank: 2300, tier: 4, pattern: "r-ar", syllables: ["spark"],                 misspellings: ["spahk", "sparc"],   sentence: "A spark flew from the campfire." },
  { word: "charm", rank: 2600, tier: 4, pattern: "r-ar", syllables: ["charm"],                 misspellings: ["charem", "chram"],  sentence: "The little gem had a strange charm." },
  { word: "scar",  rank: 2900, tier: 4, pattern: "r-ar", syllables: ["scar"],                  misspellings: ["scarr", "skar"],    sentence: "The old rock had a deep scar." },
  { word: "harsh", rank: 2800, tier: 4, pattern: "r-ar", syllables: ["harsh"],                 misspellings: ["harsch", "harch"],  sentence: "The wind was harsh on the cliff." },
  { word: "marsh", rank: 3900, tier: 5, pattern: "r-ar", syllables: ["marsh"],                 misspellings: ["marsch", "marh"],   sentence: "Frogs lived in the muddy marsh." },

  // ---- or r-controlled (pattern "r-or") ----
  { word: "storm",  rank: 1500, tier: 4, pattern: "r-or", syllables: ["storm"],                misspellings: ["stom", "storrm"],   sentence: "A big storm rolled over the hills." },
  { word: "sword",  rank: 2600, tier: 4, pattern: "r-or", syllables: ["sword"],                misspellings: ["sord", "swerd"],    sentence: "The knight carried a shiny sword." },
  { word: "torch",  rank: 2700, tier: 4, pattern: "r-or", syllables: ["torch"],                misspellings: ["torche", "tourch"], sentence: "I lit a torch to see in the cave." },
  { word: "scorch", rank: 4200, tier: 5, pattern: "r-or", syllables: ["scorch"],               misspellings: ["scorche", "skorch"],sentence: "The hot sun can scorch the dry grass." },

  // ---- oo (pattern "oo") ----
  { word: "smooth", rank: 2000, tier: 4, pattern: "oo", syllables: ["smooth"],                 misspellings: ["smoth", "smoothe"], sentence: "The cave wall was cool and smooth." },
  { word: "gloom",  rank: 3500, tier: 5, pattern: "oo", syllables: ["gloom"],                  misspellings: ["gloomm", "gloum"],  sentence: "We could barely see in the gloom." },
  { word: "scoop",  rank: 3000, tier: 4, pattern: "oo", syllables: ["scoop"],                  misspellings: ["scoup", "skoop"],   sentence: "I used a scoop to dig for gems." },
  { word: "bloom",  rank: 2800, tier: 4, pattern: "oo", syllables: ["bloom"],                  misspellings: ["bloome", "bloum"],  sentence: "Flowers bloom near the cave entrance." },
  { word: "groom",  rank: 3300, tier: 5, pattern: "oo", syllables: ["groom"],                  misspellings: ["groome", "grume"],  sentence: "We groom the horses before the ride." },
  { word: "spoon",  rank: 2400, tier: 4, pattern: "oo", syllables: ["spoon"],                  misspellings: ["spune", "spoone"],  sentence: "I ate my soup with a spoon." },
  { word: "swoop",  rank: 3800, tier: 5, pattern: "oo", syllables: ["swoop"],                  misspellings: ["swoup", "swoope"],  sentence: "The bats swoop down from the ceiling." },

  // ---- s-blends (pattern "s-blend") ----
  { word: "shrink", rank: 3000, tier: 4, pattern: "s-blend", syllables: ["shrink"],            misspellings: ["shrinck", "shrik"], sentence: "The puddle will shrink in the sun." },
  { word: "swift",  rank: 2900, tier: 4, pattern: "s-blend", syllables: ["swift"],             misspellings: ["swiftt", "swifht"], sentence: "A swift stream ran through the rocks." },
  { word: "frost",  rank: 2600, tier: 4, pattern: "s-blend", syllables: ["frost"],             misspellings: ["frosst", "forst"],  sentence: "Frost covered the cave mouth at dawn." },
  { word: "crust",  rank: 3100, tier: 4, pattern: "s-blend", syllables: ["crust"],             misspellings: ["crustt", "crusd"],  sentence: "A thin crust of ice covered the pond." },
  { word: "blast",  rank: 2400, tier: 4, pattern: "s-blend", syllables: ["blast"],             misspellings: ["blastt", "blasst"], sentence: "A blast of cold air came from the tunnel." },
  { word: "snack",  rank: 2300, tier: 3, pattern: "s-blend", syllables: ["snack"],             misspellings: ["snak", "snacc"],    sentence: "We stopped for a snack on the trail." },
  { word: "stump",  rank: 3000, tier: 4, pattern: "s-blend", syllables: ["stump"],             misspellings: ["stumpp", "stomp"],  sentence: "I sat on an old tree stump to rest." },

  // ---- l-blends (pattern "l-blend") ----
  { word: "blank",  rank: 2400, tier: 3, pattern: "l-blend", syllables: ["blank"],             misspellings: ["blanck", "blanc"],  sentence: "The page was completely blank." },
  { word: "blink",  rank: 2700, tier: 3, pattern: "l-blend", syllables: ["blink"],             misspellings: ["blinck", "blinc"],  sentence: "Do not blink or you will miss it." },
  { word: "bland",  rank: 3600, tier: 4, pattern: "l-blend", syllables: ["bland"],             misspellings: ["blande", "blannd"], sentence: "The soup tasted a bit bland." },
  { word: "glance", rank: 2600, tier: 4, pattern: "l-blend", syllables: ["glance"],            misspellings: ["glanse", "glanc"],  sentence: "I took one quick glance at the map." },
  { word: "pluck",  rank: 3500, tier: 4, pattern: "l-blend", syllables: ["pluck"],             misspellings: ["pluk", "pluckk"],   sentence: "She will pluck the gem from the wall." },

  // ---- r-blends (pattern "r-blend") ----
  { word: "crash", rank: 2000, tier: 3, pattern: "r-blend", syllables: ["crash"],              misspellings: ["crashe", "crassh"], sentence: "The rocks fell with a loud crash." },
  { word: "crisp", rank: 2900, tier: 3, pattern: "r-blend", syllables: ["crisp"],              misspellings: ["crispe", "krisp"],  sentence: "The morning air was cool and crisp." },
  { word: "grasp", rank: 3000, tier: 4, pattern: "r-blend", syllables: ["grasp"],              misspellings: ["graspe", "grassp"], sentence: "I could not grasp the slippery rope." },
  { word: "prowl", rank: 4000, tier: 5, pattern: "r-blend", syllables: ["prowl"],              misspellings: ["proul", "prowle"],  sentence: "A fox likes to prowl at night." },
  { word: "brisk", rank: 3400, tier: 4, pattern: "r-blend", syllables: ["brisk"],              misspellings: ["brisck", "brsk"],   sentence: "We went for a brisk walk in the cold." },

  // ---- doubled consonants (pattern "double-cons") ----
  { word: "copper", rank: 2500, tier: 5, pattern: "double-cons", syllables: ["cop", "per"],    misspellings: ["coper", "coppor"],  sentence: "The old coin was made of copper." },
  { word: "hammer", rank: 2300, tier: 4, pattern: "double-cons", syllables: ["ham", "mer"],    misspellings: ["hamer", "hammor"],  sentence: "I used a hammer to break the rock." },
  { word: "ribbon", rank: 2600, tier: 4, pattern: "double-cons", syllables: ["rib", "bon"],    misspellings: ["ribon", "ribben"],  sentence: "She tied a red ribbon in her hair." },
  { word: "rabbit", rank: 2000, tier: 4, pattern: "double-cons", syllables: ["rab", "bit"],    misspellings: ["rabit", "rabbet"],  sentence: "A small rabbit hopped past the cave." },
  { word: "muddy",  rank: 2400, tier: 4, pattern: "double-cons", syllables: ["mud", "dy"],     misspellings: ["mudy", "muddey"],   sentence: "Our boots were muddy after the hike." },
  { word: "puppy",  rank: 1900, tier: 4, pattern: "double-cons", syllables: ["pup", "py"],     misspellings: ["pupy", "puppey"],   sentence: "The puppy chased its tail." },
  { word: "jelly",  rank: 2200, tier: 4, pattern: "double-cons", syllables: ["jel", "ly"],     misspellings: ["jely", "jelley"],   sentence: "I had jelly on my toast." },

  // ---- y as long e (pattern "y-long-e") ----
  { word: "lazy",   rank: 2100, tier: 4, pattern: "y-long-e", syllables: ["la", "zy"],         misspellings: ["lazey", "laisy"],   sentence: "The lazy cat slept all day." },
  { word: "plenty", rank: 1800, tier: 4, pattern: "y-long-e", syllables: ["plen", "ty"],       misspellings: ["plentey", "plenny"],sentence: "We had plenty of water for the trip." },
  { word: "dusty",  rank: 2600, tier: 4, pattern: "y-long-e", syllables: ["dus", "ty"],        misspellings: ["dustey", "dusti"],  sentence: "The old cave was dark and dusty." },
  { word: "sleepy", rank: 2200, tier: 4, pattern: "y-long-e", syllables: ["slee", "py"],       misspellings: ["sleepey", "sleapy"],sentence: "I felt sleepy after the long walk." },
  { word: "greedy", rank: 2900, tier: 4, pattern: "y-long-e", syllables: ["gree", "dy"],       misspellings: ["greedey", "greddy"],sentence: "The greedy troll hid all the gems." },

  // ---- soft c / g (pattern "soft-c-g") ----
  { word: "gem",    rank: 1500, tier: 3, pattern: "soft-c-g", syllables: ["gem"],              misspellings: ["jem", "gemm"],      sentence: "I found a shiny gem in the cave." },
  { word: "gentle", rank: 2200, tier: 5, pattern: "soft-c-g", syllables: ["gen", "tle"],       misspellings: ["gentel", "jentle"], sentence: "She gave the rock a gentle tap." },
  { word: "giant",  rank: 1700, tier: 5, pattern: "soft-c-g", syllables: ["gi", "ant"],        misspellings: ["jiant", "gient"],   sentence: "A giant boulder blocked the path." },
  { word: "germ",   rank: 3200, tier: 5, pattern: "soft-c-g", syllables: ["germ"],             misspellings: ["gerem", "jerm"],    sentence: "Wash your hands to get rid of each germ." },

  // ---- silent letters (pattern "silent-letters") ----
  { word: "climb", rank: 1800, tier: 5, pattern: "silent-letters", syllables: ["climb"],       misspellings: ["clim", "climbe"],   sentence: "We had to climb over the rocks." },
  { word: "thumb", rank: 2400, tier: 5, pattern: "silent-letters", syllables: ["thumb"],       misspellings: ["thum", "thumbe"],   sentence: "I hit my thumb with the hammer." },
  { word: "wreck", rank: 3000, tier: 5, pattern: "silent-letters", syllables: ["wreck"],       misspellings: ["reck", "wrek"],     sentence: "The storm left the camp a wreck." },
  { word: "wrist", rank: 2700, tier: 5, pattern: "silent-letters", syllables: ["wrist"],       misspellings: ["rist", "wrest"],    sentence: "I wear my watch on my wrist." },
  { word: "crumb", rank: 3400, tier: 5, pattern: "silent-letters", syllables: ["crumb"],       misspellings: ["crum", "crumbe"],   sentence: "Not a crumb of food was left." },
  { word: "numb",  rank: 3100, tier: 5, pattern: "silent-letters", syllables: ["numb"],        misspellings: ["num", "nummb"],     sentence: "My fingers went numb in the cold." },

  // ---- QA I7: sentence fixes — these words' chunk sentences used a morphological
  //      variant or were off-topic, so they never contained the exact word (the
  //      rhythm/puzzle "blank the word" context degraded). Same fields as the
  //      chunk entry; only the sentence is corrected to contain the exact word.
  //      (rank is ignored here — the merge keeps the backbone's authoritative rank.)
  { word: "rights",      rank: 145,  tier: 4, pattern: "ight",          syllables: ["rights"],         misspellings: ["rites", "rightes", "rihts"],                  sentence: "We learned about our rights at school." },
  { word: "cell",        rank: 638,  tier: 6, pattern: "double-cons",   syllables: ["cell"],           misspellings: ["sel", "ceel", "ceell"],                       sentence: "Every living thing is made of one tiny cell." },
  { word: "self",        rank: 640,  tier: 2, pattern: "end-blend",     syllables: ["self"],           misspellings: ["salf", "sellf", "selff"],                     sentence: "Be proud of your true self." },
  { word: "degree",      rank: 1128, tier: 3, pattern: "ee-ea",         syllables: ["de", "gree"],     misspellings: ["degre", "degrey", "digree"],                  sentence: "It is one degree warmer in the cave today." },
  { word: "super",       rank: 1134, tier: 6, pattern: "schwa-er-or-ar", syllables: ["su", "per"],     misspellings: ["souper", "supar", "supir"],                   sentence: "The new crystal drill is super fast." },
  { word: "smith",       rank: 1201, tier: 2, pattern: "sh",            syllables: ["smith"],          misspellings: ["smyth", "smithe", "smeeth"],                  sentence: "The smith shaped glowing metal in the cave." },
  { word: "sense",       rank: 1467, tier: 7, pattern: "soft-c-g",      syllables: ["sense"],          misspellings: ["sence", "sens", "senss"],                     sentence: "Use your sense of smell to find the gems." },
  { word: "charges",     rank: 2050, tier: 7, pattern: "soft-c-g",      syllables: ["charg", "es"],    misspellings: ["charjes", "chargas", "chargis", "chargez"],   sentence: "The miner charges his lamp before the dig." },
  { word: "falls",       rank: 2236, tier: 4, pattern: "aw-au-all",     syllables: ["falls"],          misspellings: ["fals", "fawls", "fallz"],                     sentence: "A gem falls into the cart with a clink." },
  { word: "matches",     rank: 2850, tier: 6, pattern: "multisyllable", syllables: ["match", "es"],    misspellings: ["matchs", "matchez", "matchess"],              sentence: "She matches each crystal to its color." },
  { word: "playstation", rank: 2864, tier: 9, pattern: "tion",          syllables: ["play", "sta", "tion"], misspellings: ["playsation", "plastation", "playstaion"], sentence: "He played a racing game on his PlayStation." },
  { word: "blonde",      rank: 2949, tier: 7, pattern: "silent-letters", syllables: ["blonde"],        misspellings: ["blond", "blunde", "blonnd"],                  sentence: "The doll has long blonde hair." },
  { word: "concerning",  rank: 2968, tier: 7, pattern: "ending-ed-ing", syllables: ["con", "cern", "ing"], misspellings: ["concurning", "consurning", "conserning", "concernning"], sentence: "The teacher wrote a note concerning the test." },
];
