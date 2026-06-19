// Temp QA: drive the daily-geode flow (§C). Onboards, seeds today's stats so every
// possible quest is complete, then cracks the geode and screenshots approach + reveal.
import { chromium } from 'playwright';
const URL = 'http://localhost:5173';
const today = new Date().toISOString().slice(0, 10);
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
const errs = [];
p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
p.on('pageerror', (e) => errs.push(String(e)));
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

// seed every metric complete for today across all profiles, then reload
await p.evaluate((today) => {
  const KEY = 'crystal-spell-caverns:v1';
  const c = JSON.parse(localStorage.getItem(KEY));
  const full = { answers: 99, correct: 99, gems: 999, digs: 9, bestCombo: 99, specimens: 9, crafted: 99 };
  for (const prof of c.profiles || []) {
    const stats = prof.stats || (prof.state && prof.state.stats);
    if (stats) { stats.byDay = stats.byDay || {}; stats.byDay[today] = full; }
  }
  localStorage.setItem(KEY, JSON.stringify(c));
}, today);
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForSelector('.home-grid');
await p.waitForTimeout(300);
await p.screenshot({ path: 'scripts/qa/live/geode-1-home.png' });
const chipText = await p.evaluate(() => [...document.querySelectorAll('.quest-chip')].map((x) => x.textContent).join(' | '));
console.log('CHIP:', chipText);

// click the geode chip → geode screen
await p.evaluate(() => { const c = [...document.querySelectorAll('.quest-chip')].find((x) => /geode/i.test(x.textContent)); if (c) c.click(); });
await p.waitForTimeout(500);
await p.screenshot({ path: 'scripts/qa/live/geode-2-approach.png' });
const onGeode = await p.evaluate(() => !!document.querySelector('.geode'));
console.log('ON GEODE SCREEN:', onGeode);

// tap to crack (5 taps)
for (let i = 0; i < 6; i++) { await p.evaluate(() => document.querySelector('.geode')?.click()); await p.waitForTimeout(180); }
await p.waitForTimeout(800);
await p.screenshot({ path: 'scripts/qa/live/geode-3-reveal.png' });
const revealText = await p.evaluate(() => document.querySelector('.boss-body')?.innerText?.slice(0, 200));
console.log('REVEAL:', JSON.stringify(revealText));
console.log('console errors:', errs.length ? errs.slice(0, 5) : 'none');
await b.close();
