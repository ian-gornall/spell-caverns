// scripts/qa_home_repair.mjs — scratch: screenshot home with the full-width Repair
// banner present (cracked words) + some catalog owned. Verifies the balanced grid.
import { chromium } from 'playwright';
const URL = process.env.URL || 'http://localhost:5173';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 820, height: 1180 } });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.evaluate(() => {
  const records = ['friend', 'because', 'through'].map((w, i) => ({
    word: w, attempts: 2, mastery: 0.3, confidence: 0.75, lastSeen: i + 1, recentMs: 3000, lapsed: true,
  }));
  localStorage.setItem('crystal-spell-caverns:v1', JSON.stringify({
    gems: 250, profile: { name: 'Ada', onboarded: true },
    settings: { difficulty: 'easy', length: 10, optionCount: 3, voice: true, volume: 0.85, themeColor: '#FFD23F' },
    catalog: { owned: ['quartz', 'amethyst'], milestoneDepth: 1 },
    tracker: { tick: 3, knownPeak: 0, records },
  }));
});
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForSelector('.menu-card.repair');
await p.screenshot({ path: 'scripts/qa/home-repair.png' });
console.log('repair card present; console/page errors:', errs.length);
await b.close();
