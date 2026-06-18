// scripts/qa_catalog.mjs — scratch visual QA for the Crystal Catalog (spend sink +
// collection). Seeds a gem balance, screenshots the catalog (locked + affordable),
// buys one, and checks the home card + a milestone grant banner. NOT a regression
// gate — read the PNGs in scripts/qa/ and judge visually.
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

const shot = async (label) => { await page.screenshot({ path: `${OUT}/cat-${label}.png` }); console.log('  📸 cat-' + label + '.png'); };

try {
  await page.goto(URL, { waitUntil: 'networkidle' });
  // Seed gems so several crystals are affordable (incl. an epic), nothing owned yet.
  await page.evaluate(() => {
    localStorage.setItem('crystal-spell-caverns:v1', JSON.stringify({ gems: 800, profile: { name: 'Tester' } }));
  });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('.menu-card.catalog');
  await shot('home-card');

  await page.click('.menu-card.catalog');
  await page.waitForSelector('.catalog-grid .crystal-cell');
  await page.waitForTimeout(400);
  await shot('grid-locked');

  // buy the first affordable crystal
  const affordable = page.locator('.crystal-cell.affordable');
  const n = await affordable.count();
  console.log(`  affordable crystals: ${n}`);
  if (n > 0) {
    await affordable.first().click();
    await page.waitForTimeout(600);
    await shot('after-buy');
  }
  const ownedCount = await page.locator('.crystal-cell.owned').count();
  console.log(`  owned after buy: ${ownedCount}`);

  // tap an owned crystal -> fact toast
  if (ownedCount > 0) {
    await page.locator('.crystal-cell.owned').first().click();
    await page.waitForTimeout(300);
    await shot('owned-fact');
  }
} catch (e) {
  console.log('❌ threw: ' + (e?.stack || e));
} finally {
  console.log(`\n--- ${issues.length} console/error notes ---`);
  issues.forEach((i) => console.log('  ' + i));
  await browser.close();
}
