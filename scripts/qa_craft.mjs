// Temp QA: the Craft (puzzle) surface — empty sockets, mid-build, and solved verdict.
import { chromium } from 'playwright';
const URL = 'http://localhost:5173';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
const clickText = async (re) => p.evaluate((src) => { const rx = new RegExp(src, 'i'); const el = [...document.querySelectorAll('button,.menu-card,.level-card,.colour-swatch')].find((x) => rx.test(x.textContent || x.getAttribute('aria-label') || '')); if (el) el.click(); return !!el; }, re);
await p.goto(URL, { waitUntil: 'networkidle' });
await p.evaluate(() => localStorage.clear());
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForSelector('.onboard-body');
await clickText('let.?s go'); await p.waitForSelector('.onboard-name');
await p.fill('.onboard-name', 'Leo'); await clickText('that.?s me'); await p.waitForSelector('.colour-grid');
await clickText('perfect'); await p.waitForSelector('.level-grid');
await p.locator('.level-card').nth(4).click(); await clickText('let.?s dig'); await p.waitForTimeout(400);
if (await p.locator('button:has-text("Just this one")').count()) { await clickText('just this one'); }
await p.waitForSelector('button:has-text("Start digging")');
// go home, then Craft
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForSelector('.home-grid');
await clickText('craft');
await p.waitForSelector('.tray', { timeout: 8000 });
await p.waitForTimeout(400);
await p.screenshot({ path: 'scripts/qa/live/craft-1-empty.png' });
// place ~half the letters
const word = await p.evaluate(() => window.__puzzleCurrent && window.__puzzleCurrent.word);
if (word) {
  const half = Math.ceil(word.length / 2);
  await p.evaluate((n) => {
    const w = window.__puzzleCurrent.word;
    for (let i = 0; i < n; i++) { const ch = w[i]; const t = [...document.querySelectorAll('.tray-tile')].find((x) => !x.classList.contains('used') && x.textContent === ch); if (t) t.click(); }
  }, half);
  await p.waitForTimeout(400);
  await p.screenshot({ path: 'scripts/qa/live/craft-2-mid.png' });
  // finish
  await p.evaluate(() => { const w = window.__puzzleCurrent.word; for (const ch of w) { const t = [...document.querySelectorAll('.tray-tile')].find((x) => !x.classList.contains('used') && x.textContent === ch); if (t) t.click(); } });
  await p.waitForTimeout(700);
  await p.screenshot({ path: 'scripts/qa/live/craft-3-solved.png' });
}
console.log('word:', word);
await b.close();
