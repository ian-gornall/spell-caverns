// scripts/qa_welcome.mjs — scratch probe for the §17.A in-app "welcome back" nudge.
// Seeds a save where the learner last played a few days ago, then screenshots home.
import { chromium } from 'playwright';
const URL = process.env.URL || 'http://localhost:5173';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 820, height: 1180 } });
await page.goto(URL, { waitUntil: 'networkidle' });
// Seed a returning, onboarded user who last played 3 days ago with a small streak.
await page.evaluate(() => {
  const d = new Date();
  d.setDate(d.getDate() - 3);
  const iso = d.toISOString().slice(0, 10);
  const blob = {
    version: 1,
    profile: { name: 'Ada', onboarded: true },
    settings: { difficulty: 'easy', length: 10, optionCount: 3, voice: true, volume: 0.85, dailyGoalGems: 250 },
    gems: 540,
    streak: { count: 4, lastPlayedDate: iso, longest: 6, freezes: 1 },
    stats: { sessionsPlayed: 5, answers: 50, correct: 40, byDay: {} },
    records: { bestCombo: 8, bestWaveGems: 220 },
    catalog: { owned: ['quartz'], milestoneDepth: 1 },
  };
  localStorage.setItem('crystal-spell-caverns:v1', JSON.stringify(blob));
});
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForSelector('.home-sub');
const greeting = await page.locator('.home-sub').textContent();
console.log('greeting:', JSON.stringify(greeting));
await page.screenshot({ path: 'scripts/qa/welcome-back.png' });
console.log('  📸 welcome-back.png');
await browser.close();
