// scratch: screenshot the Settings "You" panel (name + crystal colour + easy-read).
import { chromium } from 'playwright';
const URL = process.env.URL || 'http://localhost:5173';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 820, height: 1180 } });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.evaluate(() => localStorage.setItem('crystal-spell-caverns:v1', JSON.stringify({ gems: 100, profile: { name: 'Ada', onboarded: true }, settings: { difficulty: 'easy', length: 10, optionCount: 3, voice: true, volume: 0.85, themeColor: '#36F1CD', readableText: true } })));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.click('[class*="menu-card"]:has(.lbl:text-is("Settings"))');
await p.waitForSelector('.seg');
await p.waitForTimeout(300);
await p.evaluate(() => {
  const h = [...document.querySelectorAll('.panel h3')].find((x) => x.textContent === 'You');
  if (h) h.closest('.panel').scrollIntoView({ block: 'center' });
});
await p.waitForTimeout(300);
await p.screenshot({ path: 'scripts/qa/settings-you.png' });
console.log('errors:', errs.length);
await b.close();
