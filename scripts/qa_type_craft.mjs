// scripts/qa_type_craft.mjs — §36e #2 (Ian 2026-06-22e): a PHYSICAL keyboard builds the word in
// Craft — typing a letter moves the matching tray tile into the next slot; Backspace returns the
// last. Drives the diagnostic Craft screen (same puzzle screen as normal play) with real keydowns.
// Run: node scripts/qa_type_craft.mjs   (needs `npm start`).
import { chromium } from 'playwright';

const URL = process.env.URL || 'http://localhost:5173';
const issues = [];
const ok = (m) => console.log('✅ ' + m);
const bad = (m) => { console.log('❌ ' + m); issues.push(m); };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 820, height: 1180 } });
page.on('pageerror', (e) => bad('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') bad('console: ' + m.text()); });

// --- boot through onboarding to the puzzle (same path as smoke.mjs) ---
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForSelector('.onboarding .onboard-go', { timeout: 6000 });
if (await page.locator('.tap-to-start').count()) {
  await page.click('.tap-to-start');
  await page.waitForSelector('.onboarding .onboard-go:not(.tap-to-start)', { timeout: 4000 });
}
await page.click('.onboard-go'); // -> name
await page.waitForSelector('.onboard-name', { timeout: 4000 });
await page.fill('.onboard-name', 'Typer');
await page.click('.onboard-go'); // -> colour
await page.waitForSelector('.colour-grid .colour-swatch', { timeout: 4000 });
await page.locator('.colour-swatch').nth(1).click();
await page.click('.onboard-go'); // -> age
await page.waitForSelector('.age-grid .age-btn', { timeout: 4000 });
await page.click('.age-grid .age-btn:nth-child(3)'); // age 7
await page.click('.onboard-go.level-cta'); // -> sync step
await page.waitForSelector('text=Just this one', { timeout: 4000 });
await page.click('text=Just this one');
if (await page.locator('text=Maybe later').count()) await page.click('text=Maybe later');
await page.waitForSelector('.onboard-go.big', { timeout: 4000 });
await page.click('.onboard-go.big'); // -> placement Craft
await page.waitForSelector('.screen.puzzle .slot', { timeout: 8000 });

const cur = await page.evaluate(() => window.__puzzleCurrent || null);
if (!cur || !cur.word) { bad('no puzzle word'); }
const word = (cur.word || '').toLowerCase();
console.log(`first craft word : "${word}" (len ${word.length}, placement ${cur.placement})`);
if (word.length < 3) bad('word too short to exercise typing');

// read the lowercased letters currently in the slots
const slotLetters = async () =>
  page.$$eval('.screen.puzzle .slots .slot', (els) => els.map((e) => (e.textContent || '').trim().toLowerCase()));
const filledCount = async () => (await slotLetters()).filter((c) => c).length;

// --- type all but the LAST letter via the PHYSICAL keyboard ---
for (let i = 0; i < word.length - 1; i++) await page.keyboard.press(word[i]);
await page.waitForTimeout(150);
let letters = await slotLetters();
const built = letters.slice(0, word.length - 1).join('');
if (built === word.slice(0, word.length - 1)) ok(`typing moved tiles into slots → "${built}" (first ${word.length - 1} letters)`);
else bad(`typed build mismatch: slots="${letters.join('')}" expected start "${word.slice(0, word.length - 1)}"`);
if (await filledCount() === word.length - 1) ok(`${word.length - 1} slots filled by typing`); else bad('wrong filled count after typing');

// --- Backspace returns the last placed tile ---
await page.keyboard.press('Backspace');
await page.waitForTimeout(120);
if (await filledCount() === word.length - 2) ok('Backspace returned the last typed tile'); else bad('Backspace did not return a tile');

// --- type the rest (re-add + final letter) → the build completes & advances ---
await page.keyboard.press(word[word.length - 2]); // re-add the backspaced letter
await page.keyboard.press(word[word.length - 1]); // final letter → auto-submit
await page.waitForTimeout(1400); // solve() advances after ~1100ms
const after = await page.evaluate(() => window.__puzzleCurrent || null);
const verdict = await page.locator('.screen.puzzle .verdict-chip').textContent().catch(() => '');
if ((after && after.word && after.word.toLowerCase() !== word) || /💎|Next word|Crafted|Level/.test(verdict || '')) {
  ok(`completed typed build → advanced (verdict "${(verdict || '').trim()}", next "${after?.word || '—'}")`);
} else {
  bad(`typed build did not complete/advance (still "${after?.word}", verdict "${verdict}")`);
}

await page.screenshot({ path: 'scripts/qa_type_craft.png' });
console.log('\n' + (issues.length ? `ISSUES: ${issues.length}` : 'ISSUES: none ✅'));
await browser.close();
process.exit(issues.length ? 1 : 0);
