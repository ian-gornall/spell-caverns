// scratch: verify the Settings "Daily reminder" opt-in renders + the module graph (incl. the
// new push.js / pushconfig.js imports) loads with no console/page errors. Throwaway QA check.
import { chromium } from 'playwright';
const URL = process.env.URL || 'http://localhost:5183';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.evaluate(() => localStorage.setItem('crystal-spell-caverns:v1', JSON.stringify({ gems: 100, profile: { name: 'Ada', onboarded: true }, settings: { difficulty: 'easy', length: 10, optionCount: 3, voice: true, volume: 0.85, themeColor: '#36F1CD', readableText: true } })));
await p.goto(URL, { waitUntil: 'networkidle' });
let openedSettings = false;
try {
  await p.click('[class*="menu-card"]:has(.lbl:text-is("Settings"))', { timeout: 4000 });
  await p.waitForSelector('.seg', { timeout: 4000 });
  openedSettings = true;
} catch {
  // onboarding still showing (schema mismatch) — at least the app booted; report below.
}
await p.waitForTimeout(300);
let hasReminder = false;
if (openedSettings) {
  hasReminder = await p.evaluate(() => [...document.querySelectorAll('label')].some((l) => l.textContent.trim() === 'Daily reminder'));
  await p.evaluate(() => {
    const h = [...document.querySelectorAll('.panel h3')].find((x) => x.textContent === 'Sound');
    if (h) h.closest('.panel').scrollIntoView({ block: 'center' });
  });
  await p.waitForTimeout(200);
  await p.screenshot({ path: 'scripts/qa/reminders.png' });
}
console.log(JSON.stringify({ openedSettings, hasReminder, errorCount: errs.length, errors: errs.slice(0, 8) }, null, 2));
await b.close();
