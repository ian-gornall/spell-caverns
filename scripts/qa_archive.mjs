import { chromium } from 'playwright';
const BASE = process.env.URL || 'http://localhost:5173';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 740 } });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
let sentKey = null;
await page.route('**/api/feedback', (route) => {
  sentKey = route.request().headers()['x-admin-key'];
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
    { ts: 1781880000000, rating: 5, difficulty: 'just-right', note: 'Loves the geode!', nick: 'Robin' },
    { ts: 1781870000000, rating: 2, difficulty: 'too-hard', note: 'spelling words too tricky', nick: 'Sam' },
    { ts: 1781860000000, rating: 4, difficulty: '', note: '', nick: '' },
  ]) });
});

let fails = 0; const check = (c, m) => { console.log(`${c ? '✅' : '❌'} ${m}`); if (!c) fails++; };

await page.goto(BASE); await page.evaluate(() => localStorage.clear());
await page.goto(BASE);
await page.evaluate(async () => {
  const s = await import('/src/state.js'); s.load(); s.addProfile({ name: 'Robin', startLevel: 2 });
  localStorage.setItem('csc_admin_key', 'RQf7mSNNs9_32mEvwlL5UXis7EeeAwdD');
});

await page.goto(BASE + '/?view=feedback'); await page.waitForTimeout(700);
const body = await page.innerText('body');
check(/feedback archive/i.test(body), 'deep-link ?view=feedback opens the archive');
check(/3 total/i.test(body), 'shows total count (3)');
check(/Loves the geode/.test(body), 'renders a note');
check(/Robin/.test(body) && /Sam/.test(body), 'renders nicknames');
check(/too tricky/i.test(body), 'renders the second entry');
check(sentKey === 'RQf7mSNNs9_32mEvwlL5UXis7EeeAwdD', 'fetched with the stored admin key');
await page.screenshot({ path: 'scripts/_arch/archive.png', fullPage: true });

await page.goto(BASE); await page.waitForTimeout(400);
await page.click('.profile-card:not(.add)'); await page.waitForTimeout(300);
await page.click('.menu-card:has-text("Settings")'); await page.waitForTimeout(300);
// the version line now lives INSIDE the collapsed "Grown-up settings" <details> (csc-v54) —
// open the disclosure first, else .version-line is in the DOM but not visible (click times out).
await page.evaluate(() => { const d = document.querySelector('details'); if (d) d.open = true; });
const vl = await page.$('.version-line');
await vl.scrollIntoViewIfNeeded();
for (let i = 0; i < 7; i++) { await vl.click(); }
await page.waitForTimeout(600);
check(/feedback archive/i.test(await page.innerText('body')), '7-tap opens archive when already admin (no prompt)');

await browser.close();
console.log('console errors:', errors.length); errors.slice(0, 6).forEach((e) => console.log('  ', e));
console.log(fails === 0 ? '\n🎉 archive QA PASS' : `\n💥 ${fails} failed`);
process.exit(fails === 0 && errors.length === 0 ? 0 : 1);
