// Temp QA: the mining (Practice) wave-complete reward (new Craft-first CTA) + a CORRECT
// craft build celebration.
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
await clickText('start digging');
await p.waitForSelector('.tiles', { timeout: 8000 });
// answer the whole wave correctly
for (let i = 0; i < 14; i++) {
  await p.waitForTimeout(450);
  const done = await p.evaluate(() => {
    if (document.querySelector('.reward')) return 'reward';
    const w = window.__rhythmCurrent && window.__rhythmCurrent.word;
    const t = [...document.querySelectorAll('.tile')].find((x) => x.textContent === w);
    if (t) { t.click(); return 'answered'; }
    return 'wait';
  });
  if (done === 'reward') break;
}
await p.waitForTimeout(1400);
await p.screenshot({ path: 'scripts/qa/live/reward-mining.png' });
const btns = await p.evaluate(() => [...document.querySelectorAll('.reward .btn')].map((x) => x.textContent.trim()));
console.log('reward buttons:', JSON.stringify(btns));
await b.close();
