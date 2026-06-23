// scripts/seed_admin_demo.mjs — generate DEMO family-sync data for exploring the admin app.
//
// Writes a wrangler "kv bulk put" file (scripts/_seed_demo.json) of {key,value} envelopes — the
// SAME shape the family-sync backend stores in KV FAMILY_SYNC (one per family code). Run this,
// then: npx wrangler kv bulk put scripts/_seed_demo.json --binding FAMILY_SYNC
// These are FAKE families (codes won't collide with real ones); delete them anytime from the
// admin app's "Delete whole family" button, or with wrangler kv key delete.
import { writeFileSync } from 'node:fs';

const now = Date.now();
const day = 86400000;

// a tiny 1x1 png dataURL so specimen thumbnails render
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

let ord = 0;
const W = (word, category, band) => ({ word, category, band, pattern: 'demo', rank: band * 30, tier: 1, craftAttempts: category === 'learning' ? 1 : 2, craftCorrect: category === 'mastered' || category === 'known' ? 2 : (category === 'learning' ? 0 : 1), craftStreak: category === 'known' || category === 'mastered' ? 1 : 0, lastSeen: ++ord, order: ord });
const cats = ({ level, words, setSize = 10, peakKnownish, peakMastered }) => ({
  setSize, level, recent: [], order: ord, seen: ord,
  reviewPending: { craft: 0, mastery: 0 },
  peakKnownish, peakMastered, peakLevel: level,
  words,
});

function profile(id, name, o) {
  const p = {
    id, version: 1,
    profile: { name, onboarded: true },
    settings: { difficulty: o.difficulty || 'easy', length: 10, optionCount: 2, voice: true, volume: 0.85, voiceRate: 0.85, themeColor: o.colour || '#7aa2ff', readableText: false, dailyGoalGems: 250, reminders: true, labDisabled: false },
    startLevel: o.level, placement: { done: true, age: o.age },
    kidLock: o.kidLock || null, snapshots: o.snapshots || [],
    gems: o.gems, feedback: [], specimens: o.specimens || [],
    stats: { sessionsPlayed: o.sessions, answers: o.answers, correct: o.correct, playMs: o.playMs, byDay: {} },
    streak: { count: o.streak, lastPlayedDate: o.last, longest: o.best || o.streak, freezes: 0 },
    records: { bestCombo: 8, bestWaveGems: 60 },
    catalog: { owned: o.crystals || [], milestoneDepth: o.depth || 1 },
    lastBackupAt: 0,
    categories: cats({ level: o.level, words: o.words, peakKnownish: o.peakKnownish, peakMastered: o.peakMastered }),
  };
  return p;
}

// give Lex one prior snapshot so the admin "Restore points" panel has a real entry
const lexSnapshot = { at: now - 2 * day, label: 'daily auto-save', data: { id: 'p1', profile: { name: 'Lex', onboarded: true }, settings: { difficulty: 'easy', length: 10, themeColor: '#7aa2ff' }, startLevel: 9, placement: { done: true, age: 8 }, gems: 800, stats: { sessionsPlayed: 40, answers: 30, correct: 25, playMs: 9000000, byDay: {} }, streak: { count: 6, lastPlayedDate: '2026-06-21', longest: 9, freezes: 0 }, catalog: { owned: ['amethyst'], milestoneDepth: 2 }, specimens: [], snapshots: [], categories: cats({ level: 9, words: [W('water', 'mastered', 9)], peakKnownish: 8, peakMastered: 4 }) } };

const families = {
  SUNNYDAY3: [
    profile('p1', 'Lex', { age: 8, level: 12, gems: 1240, playMs: 15120000, sessions: 63, answers: 50, correct: 43, streak: 9, best: 14, last: '2026-06-23', colour: '#7aa2ff', crystals: ['amethyst', 'quartz', 'topaz'], depth: 4, peakKnownish: 10, peakMastered: 5,
      specimens: [{ ts: now - day, word: 'because', name: 'Sparkle Gem', image: PNG }, { ts: now - 2 * day, word: 'friend', name: 'Rocky', image: PNG }],
      snapshots: [lexSnapshot],
      words: [W('because', 'mastered', 12), W('friend', 'mastered', 11), W('people', 'mastered', 12), W('school', 'mastered', 10), W('water', 'mastered', 9), W('kitchen', 'known', 12), W('garden', 'known', 11), W('through', 'learning', 12), W('enough', 'learning', 12), W('island', 'tricky', 13)] }),
    profile('p2', 'Ava', { age: 6, level: 3, gems: 180, playMs: 1800000, sessions: 8, answers: 20, correct: 13, streak: 2, last: '2026-06-22', colour: '#ff9ad1', peakKnownish: 3, peakMastered: 2,
      words: [W('cat', 'mastered', 1), W('dog', 'mastered', 1), W('sun', 'known', 2), W('ship', 'learning', 3), W('frog', 'learning', 3), W('tree', 'learning', 3)] }),
    profile('p3', 'Sam', { age: 10, level: 20, gems: 3200, playMs: 28800000, sessions: 110, answers: 80, correct: 74, streak: 21, best: 30, last: '2026-06-23', colour: '#7ae582', crystals: ['amethyst', 'quartz', 'topaz', 'emerald'], depth: 7, peakKnownish: 12, peakMastered: 11,
      words: [W('beautiful', 'mastered', 20), W('different', 'mastered', 19), W('important', 'mastered', 20), W('remember', 'mastered', 18), W('sentence', 'mastered', 19), W('question', 'mastered', 20), W('favourite', 'mastered', 21), W('necessary', 'known', 22), W('rhythm', 'learning', 23), W('weird', 'tricky', 24)] }),
  ],
  RIVERBED7: [
    profile('p4', 'Maya', { age: 9, level: 8, gems: 640, playMs: 3960000, sessions: 31, answers: 40, correct: 32, streak: 5, best: 11, last: '2026-06-23', colour: '#36f1cd', crystals: ['amethyst'], depth: 3, peakKnownish: 10, peakMastered: 4,
      words: [W('little', 'mastered', 7), W('under', 'mastered', 8), W('happy', 'mastered', 6), W('water', 'known', 8), W('after', 'known', 7), W('always', 'learning', 8), W('around', 'learning', 8), W('could', 'tricky', 9)] }),
  ],
  MOUNTAIN5: [
    profile('p5', 'Theo', { age: 7, level: 5, gems: 220, playMs: 2400000, sessions: 12, answers: 15, correct: 11, streak: 3, last: '2026-06-21', colour: '#ffd23f', peakKnownish: 4, peakMastered: 1,
      words: [W('play', 'mastered', 4), W('jump', 'mastered', 5), W('rain', 'known', 5), W('blue', 'learning', 5), W('green', 'learning', 5), W('sky', 'learning', 4)] }),
    profile('p6', 'Nina', { age: 11, level: 25, gems: 5400, playMs: 36000000, sessions: 140, answers: 120, correct: 110, streak: 28, best: 41, last: '2026-06-23', colour: '#9d8df1', kidLock: '🌟💎⛏️', crystals: ['amethyst', 'quartz', 'topaz', 'emerald', 'sapphire'], depth: 9, peakKnownish: 16, peakMastered: 15,
      specimens: [{ ts: now - 3 * day, word: 'gorgeous', name: 'Crown Jewel', image: PNG }],
      words: [W('gorgeous', 'mastered', 25), W('separate', 'mastered', 24), W('definitely', 'mastered', 26), W('conscience', 'mastered', 27), W('mischievous', 'mastered', 28), W('parliament', 'mastered', 26), W('rhythm', 'mastered', 23), W('vengeance', 'known', 27), W('liaison', 'learning', 28), W('bureaucracy', 'tricky', 30)] }),
  ],
  MEADOW42: [
    profile('p7', 'Kit', { age: 5, level: 1, gems: 20, playMs: 300000, sessions: 2, answers: 6, correct: 3, streak: 1, last: '2026-06-23', colour: '#ff9ad1', peakKnownish: 0, peakMastered: 0,
      words: [W('at', 'learning', 1), W('it', 'learning', 1), W('in', 'learning', 1)] }),
  ],
};

const bulk = Object.entries(families).map(([code, profiles], i) => ({
  key: code,
  value: JSON.stringify({ app: 'crystal-spell-caverns', backupVersion: 1, savedAt: now - i * 3600000, data: { schema: 2, syncCode: code, syncConsent: true, parentPassword: null, activeId: profiles[0].id, adminRev: 0, profiles } }),
}));

writeFileSync('scripts/_seed_demo.json', JSON.stringify(bulk, null, 2));
const totalStudents = Object.values(families).reduce((n, ps) => n + ps.length, 0);
console.log(`Wrote scripts/_seed_demo.json: ${bulk.length} families, ${totalStudents} students.`);
for (const [code, ps] of Object.entries(families)) console.log(`  ${code}: ${ps.map((p) => p.profile.name).join(', ')}`);
console.log('\nNow run:  npx wrangler kv bulk put scripts/_seed_demo.json --binding FAMILY_SYNC');
