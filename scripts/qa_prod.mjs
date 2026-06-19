// scripts/qa_prod.mjs — post-deploy smoke of the LIVE site (prod URL in-file to keep it off
// the shell command line). Verifies the real csc-v34 bundle boots + the new Mastery draw mode
// runs. Seeds an EPHEMERAL profile via addInitScript; makes NO /api writes (no feedback spam).
import { chromium } from 'playwright';
const URL = 'https://spell.pryzmio.com';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 820, height: 1180 } });
const issues = [];
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource.*\b404\b/.test(m.text())) issues.push('console.error: ' + m.text()); });
page.on('pageerror', (e) => issues.push('pageerror: ' + e.message));

const known = (w, i) => ({ word: w, tier: 1, pattern: 'short-o', rank: 50 + i, category: 'known', craftStreak: 2, craftAttempts: 2, craftCorrect: 2, order: i + 1 });
const SEED = {
  schema: 2, syncCode: null, syncConsent: false, parentPassword: null, activeId: 'p1',
  profiles: [{ id: 'p1', version: 1, profile: { name: 'Probe', onboarded: true }, categories: { setSize: 10, level: 1, recent: [], order: 2, peakKnownish: 10, peakMastered: 0, words: ['lot'].map(known) } }],
};
const line = (x1, y1, x2, y2, n = 16) => Array.from({ length: n + 1 }, (_, i) => [x1 + (x2 - x1) * i / n, y1 + (y2 - y1) * i / n]);

try {
  await page.addInitScript((s) => { try { localStorage.setItem('crystal-spell-caverns:v1', JSON.stringify(s)); } catch {} }, SEED);
  await page.goto(URL, { waitUntil: 'networkidle' });
  // confirm we're on the new build
  const ver = await page.evaluate(async () => { try { return (await (await fetch('/src/version.js', { cache: 'no-store' })).text()).match(/csc-v\d+/)?.[0]; } catch { return '?'; } });
  console.log('live APP_VERSION =', ver);
  if (await page.locator('.profile-card:not(.add)').count()) await page.locator('.profile-card:not(.add)').first().click();
  await page.waitForSelector('.menu-card.craft', { timeout: 8000 });
  console.log('boot ✓ home rendered · Mastery card:', (await page.locator('.menu-card.mastery').count()) ? 'shown ✓' : 'MISSING ✗');

  await page.locator('.menu-card.mastery').click();
  await page.waitForSelector('.draw-canvas', { timeout: 8000 });
  await page.waitForTimeout(500);
  const word = await page.evaluate(() => window.__masteryCurrent?.word);
  console.log('mastery word:', word);
  // draw a vertical line, recognise → candidates should appear (templates from the live font)
  const box = await page.locator('.draw-canvas').boundingBox();
  const pts = line(0.5, 0.14, 0.5, 0.86).map(([fx, fy]) => [box.x + fx * box.width, box.y + fy * box.height]);
  await page.mouse.move(pts[0][0], pts[0][1]); await page.mouse.down();
  for (const [x, y] of pts.slice(1)) await page.mouse.move(x, y, { steps: 2 });
  await page.mouse.up();
  await page.waitForTimeout(1100); // auto-recognise after the pen lifts (no button)
  const cands = await page.locator('.cand-letter').allTextContents();
  console.log('drew a vertical stroke → candidates:', cands.length ? `[${cands.join(', ')}] ✓` : 'NONE ✗');
  console.log('\nISSUES:', issues.length ? issues : 'none');
} catch (e) {
  console.error('PROD PROBE ERROR:', e.message);
  console.log('ISSUES so far:', issues);
} finally {
  await browser.close();
}
