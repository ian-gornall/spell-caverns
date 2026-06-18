// scripts/qa_sync_onboard.mjs — screenshot the first-run family-sync step + picture picker.
import { chromium } from 'playwright';
const URL = process.env.URL || 'http://localhost:5173';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 820, height: 1180 } });
const errs = [];
p.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errs.push(m.text()));
p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.evaluate(() => localStorage.clear());
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForSelector('.onboard-go');
await p.click('.onboard-go'); // name
await p.waitForSelector('.onboard-name');
await p.fill('.onboard-name', 'Ada');
await p.click('.onboard-go'); // colour
await p.waitForSelector('.colour-swatch');
await p.locator('.colour-swatch').nth(1).click();
await p.click('.onboard-go'); // -> sync step
await p.waitForTimeout(300);
await p.screenshot({ path: 'scripts/qa/sync-01-step.png' });
await p.click('text=Sync our tablets'); // -> consent
await p.waitForSelector('.consent-row');
await p.waitForTimeout(200);
await p.screenshot({ path: 'scripts/qa/sync-02-consent.png' });
await p.locator('.consent-row input').check();
await p.click('text=Make a picture password'); // -> picker
await p.waitForSelector('.pic-grid');
await p.waitForTimeout(200);
await p.screenshot({ path: 'scripts/qa/sync-03-picker.png' });
// tap 2 pictures to show the slots filling
await p.locator('.pic-btn').nth(0).click();
await p.locator('.pic-btn').nth(5).click();
await p.waitForTimeout(150);
await p.screenshot({ path: 'scripts/qa/sync-04-picking.png' });
console.log('console/page errors:', errs.length);
for (const e of errs) console.log('  - ' + e);
console.log('shots: sync-01-step, sync-02-consent, sync-03-picker, sync-04-picking');
await b.close();
