// scripts/qa_privacy.mjs — scratch probe for the Parents & Privacy panel (cloud
// backup/restore + data-minimization). Seeds an onboarded user with some progress.
import { chromium } from 'playwright';
const URL = process.env.URL || 'http://localhost:5173';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 820, height: 1180 } });
const errs = [];
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errs.push(m.text()));
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('crystal-spell-caverns:v1', JSON.stringify({
    version: 1, profile: { name: 'Ada', onboarded: true }, gems: 540,
    stats: { sessionsPlayed: 3, answers: 30, correct: 24, byDay: {} },
  }));
});
await page.goto(URL, { waitUntil: 'networkidle' });
await page.click('[class*="menu-card"]:has(.lbl:text-is("Settings"))');
await page.waitForSelector('.data-actions');
// scroll the settings panel to the Parents & privacy block
await page.locator('.privacy-note').scrollIntoViewIfNeeded();
await page.waitForTimeout(200);
await page.screenshot({ path: 'scripts/qa/privacy-panel.png' });
console.log('  📸 privacy-panel.png');
console.log('  backup status:', JSON.stringify(await page.locator('.backup-status').textContent()));

// verify the export envelope is well-formed (round-trips through the pure module)
const ok = await page.evaluate(async () => {
  const m = await import('/src/engine/backup.js');
  const env = m.wrapBackup({ version: 1, gems: 5 }, 1234);
  const back = m.readBackup(env);
  return env.app === 'crystal-spell-caverns' && back.gems === 5;
});
console.log('  backup envelope round-trip OK:', ok);
console.log('  console/page errors:', errs.length);
for (const e of errs) console.log('   - ' + e);
await browser.close();
