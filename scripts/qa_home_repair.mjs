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
  // §36 C3: Repair is now driven by the §30 categories — "cracked" = a LEARNING word crafted
  // right before but since missed (craftStreak 0, craftCorrect > 0). Seed three such words.
  const cracked = (word, rank) => ({
    word, tier: 1, pattern: 'short-a', rank, category: 'learning',
    craftStreak: 0, craftAttempts: 3, craftCorrect: 2, order: rank,
  });
  localStorage.setItem('crystal-spell-caverns:v1', JSON.stringify({
    schema: 2, activeId: 'a1', profiles: [{
      id: 'a1', version: 1, profile: { name: 'Ada', onboarded: true, colour: 'gold' },
      settings: { difficulty: 'easy', length: 10, optionCount: 2, voice: true, volume: 0.85, themeColor: '#FFD23F' },
      startLevel: 1, gems: 250, catalog: { owned: ['quartz', 'amethyst'], milestoneDepth: 1 },
      categories: { setSize: 6, level: 1, recent: [], words: [
        cracked('friend', 1), cracked('because', 2), cracked('through', 3) ] },
    }],
  }));
});
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForTimeout(300);
if (await p.locator('.profile-card:not(.add)').count()) await p.locator('.profile-card:not(.add)').first().click();
await p.waitForSelector('.menu-card.repair');
const label = await p.locator('.menu-card.repair .lbl').textContent();
await p.screenshot({ path: 'scripts/qa/home-repair.png' });
console.log('repair card present, label:', label, '; console/page errors:', errs.length);
await b.close();
