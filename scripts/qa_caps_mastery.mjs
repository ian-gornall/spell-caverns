// scripts/qa_caps_mastery.mjs — §4 caps in MASTERY (draw/type) mode (Ian 2026-06-22d): a proper
// noun's first letter DISPLAYS as a capital while the child still types/writes lowercase. Injects a
// profile where "Williams" is the ONLY known word (peakKnownish=10 high-water still unlocks mastery),
// so Mastery deterministically serves "Williams"; switches to TYPE mode, types the lowercase letters,
// and asserts the first box renders "W" while later boxes stay lowercase. Run: npm start, then node this.
import { chromium } from 'playwright';
import { mkdir, rm } from 'node:fs/promises';

const URL = process.env.URL || 'http://localhost:5173';
const OUT = 'scripts/qa_caps_mastery';
await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 1180 } }); // ≥700 → wide multi-box
const issues = [];
page.on('pageerror', (e) => issues.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource.*\b404\b/.test(m.text())) issues.push('console.error: ' + m.text()); });

// peakKnownish=10 (high-water) unlocks Mastery even though only ONE word is currently known, so the
// mastery pool serves exactly "Williams" — deterministic.
const SEED = {
  schema: 2, syncCode: null, syncConsent: false, parentPassword: null, activeId: 'M1',
  profiles: [{ id: 'M1', version: 1, profile: { name: 'Mas', onboarded: true }, startLevel: 35,
    placement: { done: true, age: 8, band: 35 },
    categories: { setSize: 10, level: 35, recent: [], order: 1100, peakKnownish: 10, peakMastered: 0,
      words: [{ word: 'Williams', tier: 2, band: 35, pattern: 'tricky', rank: 1021, category: 'known', craftStreak: 2, craftAttempts: 2, craftCorrect: 2, order: 1021 }] } }],
};

try {
  await page.addInitScript((s) => { try { localStorage.setItem('crystal-spell-caverns:v1', JSON.stringify(s)); } catch {} }, SEED);
  await page.goto(URL, { waitUntil: 'networkidle' });
  if (await page.$('.tap-to-start')) await page.click('.tap-to-start');
  if (await page.locator('.profile-card:not(.add)').count()) await page.locator('.profile-card:not(.add)').first().click();
  await page.waitForSelector('.menu-card.mastery', { timeout: 8000 });
  await page.click('.menu-card.mastery');
  await page.waitForSelector('.screen.mastery', { timeout: 8000 });
  await page.waitForTimeout(400);

  const c = await page.evaluate(() => window.__masteryCurrent || null);
  if (!c || c.word !== 'williams') { issues.push(`FAIL: expected Mastery to serve "williams", got "${c && c.word}"`); }
  if (c && !c.isProper) issues.push('FAIL: "williams" not flagged isProper in Mastery');

  // switch to TYPE mode
  const toggle = page.locator('.btn.ghost', { hasText: 'Type' });
  if (await toggle.count()) await toggle.first().click();
  await page.waitForTimeout(250);

  const w = 'williams';
  await page.keyboard.press(w[0]); // type the first (lowercase) letter
  await page.waitForTimeout(150);
  const box0 = await page.evaluate(() => { const b = document.querySelector('.box-guides .lbox .lbox-letter'); return b ? b.textContent : null; });
  const slotUpper = box0 === 'W';
  if (!slotUpper) issues.push(`FAIL: mastery proper noun "williams" first box rendered "${box0}", expected "W"`);

  for (let k = 1; k < w.length; k++) await page.keyboard.press(w[k]); // the rest, lowercase
  await page.waitForTimeout(200);
  const boxes = await page.evaluate(() => [...document.querySelectorAll('.box-guides .lbox .lbox-letter')].map((s) => s.textContent));
  if (boxes[1] !== 'i') issues.push(`FAIL: mastery box 1 should stay lowercase "i", got "${boxes[1]}"`);
  if (boxes.join('').toLowerCase() !== w) issues.push(`FAIL: typed boxes "${boxes.join('')}" don't spell "${w}" (case-insensitive)`);
  await page.screenshot({ path: `${OUT}/01-williams-mastery-cap.png` });

  console.log('\n— §4 caps (Mastery type mode) QA —');
  console.log('served word       :', c && c.word, '| isProper', c && c.isProper);
  console.log('typed boxes       :', JSON.stringify(boxes), '(box0 should be "W", rest lowercase)');
  console.log('first box capital :', box0, slotUpper ? '✅' : '❌');
  console.log('\n' + (issues.length ? `ISSUES (${issues.length}):\n- ` + issues.join('\n- ') : 'ISSUES: none ✅'));
} catch (e) {
  issues.push('PROBE ERROR: ' + e.message);
  console.log('\nISSUES:', issues);
} finally {
  await browser.close();
}
process.exit(issues.length ? 1 : 0);
