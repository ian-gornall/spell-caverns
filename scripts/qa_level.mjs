// scripts/qa_level.mjs — verify the §30 bug fix: picking a new Starting Level in Settings
// re-aims the learning set (old words → tricky, refilled from the new level). Run: npm start
// then: node scripts/qa_level.mjs
import { chromium } from 'playwright';
const URL = process.env.URL || 'http://localhost:5173';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 820, height: 1180 } });
const issues = [];
page.on('pageerror', (e) => issues.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource.*\b404\b/.test(m.text())) issues.push('console.error: ' + m.text()); });

const SEED = {
  schema: 2, syncCode: null, syncConsent: false, parentPassword: null, activeId: 'L1',
  profiles: [{ id: 'L1', version: 1, profile: { name: 'Lev', onboarded: true }, startLevel: 1,
    categories: { setSize: 10, level: 1, recent: [], order: 0, peakKnownish: 0, peakMastered: 0, words: [] } }],
};
const readCats = () => page.evaluate(() => {
  const c = JSON.parse(localStorage.getItem('crystal-spell-caverns:v1'));
  const p = c.profiles.find((x) => x.id === c.activeId);
  const cats = p.categories;
  const learning = cats.words.filter((w) => w.category === 'learning').map((w) => w.word);
  return { level: cats.level, learning };
});

try {
  await page.addInitScript((s) => { try { localStorage.setItem('crystal-spell-caverns:v1', JSON.stringify(s)); } catch {} }, SEED);
  await page.goto(URL, { waitUntil: 'networkidle' });
  if (await page.locator('.profile-card:not(.add)').count()) await page.locator('.profile-card:not(.add)').first().click();
  // Open Craft once so the learning set fills at level 1, then back home.
  await page.locator('.menu-card.craft').click();
  await page.waitForSelector('.puzzle .slot', { timeout: 8000 });
  await page.waitForTimeout(300);
  await page.goto(URL, { waitUntil: 'networkidle' });
  if (await page.locator('.profile-card:not(.add)').count()) await page.locator('.profile-card:not(.add)').first().click();
  const before = await readCats();
  console.log('BEFORE level change:', before);

  // Settings → pick a higher level card
  await page.locator('.menu-card', { hasText: 'Settings' }).first().click();
  await page.waitForSelector('.level-card', { timeout: 6000 });
  const cards = page.locator('.level-card');
  const n = await cards.count();
  await cards.nth(Math.min(n - 1, 3)).click(); // a clearly different (higher) level
  await page.waitForTimeout(400);
  const after = await readCats();
  console.log('AFTER level change:', after);

  const levelChanged = after.level !== before.level;
  const wordsChanged = JSON.stringify(after.learning.sort()) !== JSON.stringify(before.learning.slice().sort());
  console.log(levelChanged ? `✓ level moved ${before.level} → ${after.level}` : '✗ level did NOT change');
  console.log(wordsChanged ? '✓ learning set was re-aimed (words changed)' : '✗ learning set did NOT change (BUG)');
  console.log('ISSUES:', issues.length ? issues : 'none');
} catch (e) {
  console.error('PROBE ERROR:', e.message);
  console.log('ISSUES so far:', issues);
} finally {
  await browser.close();
}
