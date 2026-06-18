// scratch: full-page Progress screenshot to verify every panel (incl. the new
// Catalog summary) renders in context. Seeds some played state + owned crystals.
import { chromium } from 'playwright';
const URL = process.env.URL || 'http://localhost:5173';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 820, height: 1180 } });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.evaluate(() => {
  const records = ['the', 'and', 'you', 'cave', 'rock', 'gold'].map((w, i) => ({ word: w, attempts: 2, mastery: i < 3 ? 0.95 : 0.4, confidence: 0.75, lastSeen: i + 1, recentMs: 1500, lapsed: i >= 4 }));
  localStorage.setItem('crystal-spell-caverns:v1', JSON.stringify({
    gems: 429, profile: { name: 'Ada', onboarded: true },
    settings: { difficulty: 'easy', length: 10, optionCount: 3, voice: true, volume: 0.85, themeColor: '#36F1CD' },
    catalog: { owned: ['quartz', 'amethyst', 'citrine'], milestoneDepth: 1 },
    records: { bestCombo: 7, bestWaveGems: 240 },
    streak: { count: 3, lastPlayedDate: new Date().toISOString().slice(0, 10), longest: 5, freezes: 1 },
    stats: { sessionsPlayed: 4, answers: 30, correct: 24, byDay: { [new Date().toISOString().slice(0, 10)]: { answers: 12, correct: 10, gems: 200, digs: 2 } } },
    specimens: [{ ts: 1, word: 'flonk', name: 'Flonkite', image: null }],
    tracker: { tick: 6, knownPeak: 3, records },
  }));
});
await p.goto(URL, { waitUntil: 'networkidle' });
await p.click('[class*="menu-card"]:has(.lbl:text-is("Progress"))');
await p.waitForSelector('.spectrum');
await p.waitForTimeout(400);
// scroll the Catalog + specimen panels into view (inner .scroll container)
await p.evaluate(() => {
  const h = [...document.querySelectorAll('.panel h3')].find((x) => /Crystal Catalog/.test(x.textContent));
  if (h) h.closest('.panel').scrollIntoView({ block: 'start' });
});
await p.waitForTimeout(300);
await p.screenshot({ path: 'scripts/qa/progress-catalog-panel.png' });
const hasCatalogPanel = await p.evaluate(() => [...document.querySelectorAll('.panel h3')].some((h) => /Crystal Catalog/.test(h.textContent)));
console.log('catalog panel present:', hasCatalogPanel, '· errors:', errs.length);
await b.close();
