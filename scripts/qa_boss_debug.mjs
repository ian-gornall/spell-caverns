// scripts/qa_boss_debug.mjs — §36 D4 (Ian 2026-06-22d): the "?boss=N" debug deep-link jumps straight
// to the GEODE BOSS at depth N so the boss screens can be exercised without grinding to a milestone.
// Injects a placed profile, opens /?boss=3, taps the geode open, and asserts the boss screen renders
// the right zone + the "Depth 3" reveal, with 0 console errors. Run: npm start, then node this.
import { chromium } from 'playwright';
import { mkdir, rm } from 'node:fs/promises';

const URL = process.env.URL || 'http://localhost:5173';
const OUT = 'scripts/qa_boss_debug';
await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 820, height: 1180 } });
const issues = [];
page.on('pageerror', (e) => issues.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource.*\b404\b/.test(m.text())) issues.push('console.error: ' + m.text()); });

const SEED = {
  schema: 2, syncCode: null, syncConsent: false, parentPassword: null, activeId: 'B1',
  profiles: [{ id: 'B1', version: 1, profile: { name: 'Boss', onboarded: true }, startLevel: 10,
    placement: { done: true, age: 8, band: 10 },
    categories: { setSize: 10, level: 10, recent: [], order: 0, peakKnownish: 0, peakMastered: 0, words: [] } }],
};

try {
  await page.addInitScript((s) => { try { localStorage.setItem('crystal-spell-caverns:v1', JSON.stringify(s)); } catch {} }, SEED);
  // first boot (no ?boss) to seed localStorage, then navigate to the debug link
  await page.goto(URL, { waitUntil: 'networkidle' });
  if (await page.$('.tap-to-start')) await page.click('.tap-to-start');
  await page.goto(URL + '/?boss=3', { waitUntil: 'networkidle' });
  if (await page.$('.tap-to-start')) await page.click('.tap-to-start');

  await page.waitForSelector('.screen.boss', { timeout: 8000 });
  const approachText = await page.evaluate(() => document.querySelector('.boss-body')?.textContent || '');
  if (!/Echoing Caverns/i.test(approachText)) issues.push(`FAIL: depth-3 boss should name "the Echoing Caverns"; got: ${approachText.slice(0, 80)}`);
  await page.screenshot({ path: `${OUT}/01-approach.png` });

  // tap the geode open (6 taps to crack)
  for (let i = 0; i < 8; i++) { const g = page.locator('.geode'); if (await g.count()) await g.first().click({ timeout: 1500 }).catch(() => {}); await page.waitForTimeout(120); }
  await page.waitForSelector('.depth-banner', { timeout: 8000 }).catch(() => {});
  const revealText = await page.evaluate(() => document.querySelector('.depth-banner')?.textContent || '');
  await page.screenshot({ path: `${OUT}/02-reveal.png` });
  if (!/Depth 3/.test(revealText)) issues.push(`FAIL: reveal banner should read "Depth 3"; got "${revealText}"`);

  console.log('\n— §36 D4 boss-debug QA —');
  console.log('approach names zone:', /Echoing Caverns/i.test(approachText) ? 'the Echoing Caverns ✅' : 'NO ❌');
  console.log('reveal banner     :', JSON.stringify(revealText));
  console.log('\n' + (issues.length ? `ISSUES (${issues.length}):\n- ` + issues.join('\n- ') : 'ISSUES: none ✅'));
} catch (e) {
  issues.push('PROBE ERROR: ' + e.message);
  console.log('\nISSUES:', issues);
} finally {
  await browser.close();
}
process.exit(issues.length ? 1 : 0);
