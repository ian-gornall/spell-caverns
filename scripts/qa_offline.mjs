// scripts/qa_offline.mjs — QA guard (2026-06-23): the installed PWA must boot OFFLINE from the
// service-worker cache. Loads the app once (so the SW installs + precaches CORE), waits for the SW
// to take control, flips the browser OFFLINE, hard-reloads, and asserts the app still renders its
// first screen (onboarding / who's-playing) with no network. Run: npm start, then node this.
import { chromium } from 'playwright';

const URL = process.env.URL || 'http://localhost:5173';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'allow' });
const page = await ctx.newPage();
const issues = [];
page.on('pageerror', (e) => issues.push('pageerror: ' + e.message));

try {
  // 1) warm load — let the SW install + precache, and take control of the page
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 8000 })
    .catch(() => issues.push('FAIL: no service-worker controller after warm load (offline boot impossible)'));
  const swVer = await page.evaluate(async () => {
    try { const r = await fetch('/src/version.js'); const t = await r.text(); return (t.match(/csc-v\d+/) || ['?'])[0]; } catch { return '?'; }
  });

  // 2) go OFFLINE and hard-reload — must still boot from cache
  await ctx.setOffline(true);
  let offlineOk = true;
  await page.reload({ waitUntil: 'domcontentloaded' }).catch((e) => { offlineOk = false; issues.push('FAIL: offline reload threw: ' + e.message); });
  // the app mounts a .screen (onboarding for a fresh profile) — wait for it
  const booted = await page.waitForSelector('.screen, #app .screen, .onboard-body, .menu-card', { timeout: 8000 })
    .then(() => true).catch(() => false);
  if (!booted) issues.push('FAIL: app did not render a screen after offline reload');
  const screenClass = await page.evaluate(() => document.querySelector('.screen')?.className || document.body.firstElementChild?.className || '(none)');
  await page.screenshot({ path: 'scripts/qa_offline.png' });

  await ctx.setOffline(false);
  console.log('\n— offline PWA boot guard —');
  console.log('precached version :', swVer);
  console.log('offline reload    :', offlineOk ? 'no throw' : 'THREW');
  console.log('booted a screen   :', booted, `(${screenClass})`);
  console.log('\n' + (issues.length ? `ISSUES (${issues.length}):\n- ` + issues.join('\n- ') : 'ISSUES: none ✅'));
} catch (e) {
  issues.push('PROBE ERROR: ' + e.message);
  console.log('\nISSUES:', issues);
} finally {
  await browser.close();
}
process.exit(issues.length ? 1 : 0);
