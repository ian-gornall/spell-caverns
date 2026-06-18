// scripts/qa_boss.mjs — scratch visual QA for the Geode Boss milestone. Seeds a save
// where 8 words are mastered (cavern depth 2) but the depth-2 boss is still UNCRACKED
// (catalog.milestoneDepth = 1), so finishing one wave routes to the boss. Then taps
// the geode open and screenshots the reveal. NOT a regression gate — read the PNGs.
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const URL = process.env.URL || 'http://localhost:5173';
const OUT = 'scripts/qa';
const VIEW = process.env.VIEW === 'landscape' ? { width: 1180, height: 820 } : { width: 820, height: 1180 };
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: VIEW });
const issues = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') { issues.push('console.' + m.type() + ': ' + m.text()); console.log('  ⚠ ' + m.text()); } });
page.on('pageerror', (e) => { issues.push('pageerror: ' + e.message); console.log('  ❌ ' + e.message); });
const shot = async (label) => { await page.screenshot({ path: `${OUT}/boss-${label}.png` }); console.log('  📸 boss-' + label + '.png'); };
const wait = (ms) => page.waitForTimeout(ms);
const target = () => page.evaluate(() => window.__rhythmCurrent || null);
const clickExact = async (word) => {
  const ts = page.locator('.rhythm .tile');
  const c = await ts.count();
  for (let i = 0; i < c; i++) if ((await ts.nth(i).textContent())?.trim() === word) { await ts.nth(i).click().catch(() => {}); return true; }
  return false;
};

try {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const records = ['the', 'and', 'you', 'was', 'for', 'are', 'not', 'but'].map((w, i) => ({
      word: w, attempts: 3, mastery: 0.95, confidence: 0.875, lastSeen: i + 1, recentMs: 1000, lapsed: false,
    }));
    localStorage.setItem('crystal-spell-caverns:v1', JSON.stringify({
      gems: 300, profile: { name: 'Tester', onboarded: true },
      settings: { difficulty: 'easy', length: 6, optionCount: 3, voice: true, volume: 0.85, themeColor: '#36F1CD' },
      catalog: { owned: [], milestoneDepth: 1 },
      tracker: { tick: 8, knownPeak: 8, records },
    }));
  });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('.menu-card.play');
  await page.click('.menu-card.play');
  await page.waitForSelector('.rhythm .tile');

  // play out the wave clicking the correct tile each time, until the boss appears
  for (let g = 0; g < 80; g++) {
    if (await page.locator('.boss').count()) break;
    if (await page.locator('.rhythm .tiles:not(.locked) .tile').count()) {
      const c = await target();
      if (!c || !(await clickExact(c.word))) await page.locator('.rhythm .tiles:not(.locked) .tile').first().click().catch(() => {});
    }
    await wait(180);
  }
  await page.waitForSelector('.boss .geode', { timeout: 8000 });
  await wait(400);
  await shot('approach');

  // crack the geode (6 taps)
  for (let i = 0; i < 6; i++) { await page.locator('.geode').click().catch(() => {}); await wait(140); }
  await page.waitForSelector('.boss-burst', { timeout: 5000 });
  await wait(500);
  await shot('reveal');

  const owned = await page.evaluate(() => JSON.parse(localStorage.getItem('crystal-spell-caverns:v1')).catalog.owned);
  console.log('  owned after boss:', JSON.stringify(owned));
} catch (e) {
  console.log('❌ threw: ' + (e?.stack || e));
} finally {
  console.log(`\n--- ${issues.length} console/error notes ---`);
  issues.forEach((i) => console.log('  ' + i));
  await browser.close();
}
