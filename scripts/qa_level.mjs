// scripts/qa_level.mjs — verify the §C1 Settings level NUDGE: stepping the cavern level
// (➖ Easier / Harder ➕, which replaced the 9-card picker) re-aims the learning set (old
// words → tricky, refilled from the new band). Run: npm start then: node scripts/qa_level.mjs
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

  // Settings → nudge the cavern level HARDER a few times (the new ➕ stepper)
  await page.locator('.menu-card', { hasText: 'Settings' }).first().click();
  await page.waitForSelector('.level-stepper', { timeout: 6000 });
  for (let i = 0; i < 3; i++) {
    await page.locator('.level-stepper .btn', { hasText: 'Harder' }).click();
    await page.waitForTimeout(300); // nudgeLevel re-renders Settings each step
    await page.waitForSelector('.level-stepper', { timeout: 4000 });
  }
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
