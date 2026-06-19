// scripts/qa_s30b.mjs — SCRATCH probe for §30 step 6: the unlock-chain home + the
// kid-visible "Words I'm learning" Progress panel. Seeds a mixed-category profile.
// Run: npm start then: node scripts/qa_s30b.mjs
import { chromium } from 'playwright';
import { mkdir, rm } from 'node:fs/promises';

const URL = process.env.URL || 'http://localhost:5173';
const OUT = 'scripts/qa';
await rm(OUT, { recursive: true, force: true }).catch(() => {});
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: +(process.env.W || 820), height: +(process.env.H || 1180) } });
const issues = [];
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource.*\b404\b/.test(m.text())) issues.push('console.error: ' + m.text()); });
page.on('pageerror', (e) => issues.push('pageerror: ' + e.message));
const shot = async (n) => { await page.screenshot({ path: `${OUT}/${n}.png`, fullPage: true }); console.log('  📸 ' + n); };

const W = (word, cat, streak, i) => ({ word, tier: 2, pattern: 'p', rank: 100 + i, category: cat, craftStreak: streak, craftAttempts: 3, craftCorrect: streak ? 3 : 1, order: i + 1 });
const SEED = {
  schema: 2, syncCode: null, syncConsent: false, parentPassword: null, activeId: 's1',
  profiles: [{
    id: 's1', version: 1, profile: { name: 'Spella', onboarded: true }, gems: 120,
    categories: {
      setSize: 10, level: 2, recent: [], order: 7, peakKnownish: 10, peakMastered: 2,
      words: [
        W('friend', 'learning', 1, 0), W('because', 'learning', 0, 1), W('through', 'learning', 1, 2), W('people', 'learning', 0, 3),
        W('said', 'known', 2, 4), W('were', 'known', 2, 5),
        W('light', 'mastered', 2, 6), W('night', 'mastered', 2, 7),
      ],
    },
  }],
};

try {
  await page.addInitScript((seed) => { try { localStorage.setItem('crystal-spell-caverns:v1', JSON.stringify(seed)); } catch {} }, SEED);
  await page.goto(URL, { waitUntil: 'networkidle' });
  if (await page.locator('.profile-card:not(.add)').count()) await page.locator('.profile-card:not(.add)').first().click();
  await page.waitForSelector('.menu-card.craft', { timeout: 6000 });

  const mastery = await page.locator('.menu-card.mastery').count();
  const practiceLocked = await page.locator('.menu-card.practice.locked').count();
  console.log(`unlock chain — Mastery card: ${mastery ? 'shown ✓' : 'MISSING ✗'} · Practice: ${practiceLocked ? 'LOCKED ✓ (mining needs mastered)' : 'unlocked'}`);
  await shot('s6-01-home');
  console.log('  ↔ home scrollW=' + (await page.evaluate(() => document.documentElement.scrollWidth)) + '/' + (await page.evaluate(() => document.documentElement.clientWidth)));

  // Progress → the §30 "Words I'm learning" panel
  await page.locator('.menu-card', { hasText: 'Progress' }).first().click();
  await page.waitForSelector('.panel', { timeout: 6000 });
  const hasPanel = await page.locator('h3', { hasText: "Words I’m learning" }).count();
  const learnWords = await page.locator('.learn-word .learn-text').allTextContents();
  const pipsOn = await page.locator('.learn-pips .pip.on').count();
  console.log(`Progress panel: ${hasPanel ? 'present ✓' : 'MISSING ✗'} · learning=[${learnWords.join(', ')}] · pips-on=${pipsOn}`);
  // no "tricky/hard" label visible to the kid
  const trickyLabel = await page.getByText(/tricky|hard/i).count();
  console.log(`  kid-visible "tricky/hard" labels: ${trickyLabel} (should be 0)`);
  await shot('s6-02-progress');
  console.log('  ↔ progress scrollW=' + (await page.evaluate(() => document.documentElement.scrollWidth)) + '/' + (await page.evaluate(() => document.documentElement.clientWidth)));

  // mining gate: click Practice (locked) → should show the "master words" gate
  await page.locator('.menu-card', { hasText: 'Progress' }).first().click().catch(() => {});
  await page.goBack().catch(() => {});
  await page.locator('.menu-card.practice').click();
  await page.waitForSelector('.rhythm', { timeout: 6000 });
  await page.waitForTimeout(300);
  const gate = (await page.locator('.rhythm .sentence').textContent())?.trim();
  console.log(`mining gate (locked): "${gate}"`);

  console.log('\nISSUES:', issues.length ? issues : 'none');
} catch (e) {
  console.error('PROBE ERROR:', e.message);
  await shot('s6-99-error');
  console.log('ISSUES so far:', issues);
} finally {
  await browser.close();
}
