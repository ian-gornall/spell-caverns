// scripts/qa_mastery_apos.mjs — Ian 2026-06-22f: the Mastery on-screen keypad needs an APOSTROPHE
// key so contractions (you're/they're/there's) can be spelled in type mode. Seeds "you're" as the
// only known word (mastery unlocked via peakKnownish high-water), switches to TYPE mode, builds the
// word using the on-screen KEYS incl. the apostrophe key, and asserts it masters.
// Run: npm start, then node scripts/qa_mastery_apos.mjs
import { chromium } from 'playwright';

const URL = process.env.URL || 'http://localhost:5173';
const issues = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 1180 } });
page.on('pageerror', (e) => issues.push('pageerror: ' + e.message));

const SEED = {
  schema: 2, syncCode: null, syncConsent: false, parentPassword: null, activeId: 'M1',
  profiles: [{ id: 'M1', version: 1, profile: { name: 'Apo', onboarded: true }, startLevel: 21,
    placement: { done: true, age: 9, band: 21 },
    categories: { setSize: 10, level: 21, recent: [], order: 700, seen: 0, reviewPending: { craft: 0, mastery: 0 },
      peakKnownish: 10, peakMastered: 0, peakLevel: 21,
      words: [{ word: "you're", tier: 1, band: 21, pattern: 'contraction', rank: 618,
        category: 'known', craftStreak: 1, craftAttempts: 1, craftCorrect: 1, order: 618, lastSeen: 1 }] } }],
};

// click the on-screen keypad key whose label is `label` (the apostrophe key displays ’)
const tapKey = async (label) => {
  const ok = await page.evaluate((lab) => {
    const k = [...document.querySelectorAll('.type-keyboard .key')].find((b) => b.textContent === lab);
    if (k) { k.click(); return true; }
    return false;
  }, label);
  if (!ok) issues.push(`FAIL: no on-screen key labelled "${label}"`);
  await page.waitForTimeout(80);
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
  console.log(`mastery word      : "${c && c.word}"`);
  if (!c || c.word !== "you're") issues.push(`FAIL: expected Mastery to serve "you're", got "${c && c.word}"`);

  // switch to TYPE mode → the on-screen keypad shows
  const toggle = page.locator('.btn.ghost', { hasText: 'Type' });
  if (await toggle.count()) await toggle.first().click();
  await page.waitForSelector('.type-keyboard .key', { timeout: 4000 });

  // is the apostrophe key present?
  const hasApos = await page.evaluate(() => [...document.querySelectorAll('.type-keyboard .key')].some((b) => b.textContent === '’'));
  console.log(`apostrophe key    : ${hasApos ? 'present ✅' : 'MISSING ❌'}`);
  if (!hasApos) issues.push('FAIL: apostrophe key missing from the mastery keypad');

  // build "you're" with the on-screen keys (apostrophe via its key)
  for (const ch of "you're") await tapKey(ch === "'" ? '’' : ch);
  await page.waitForTimeout(200);
  const boxes = await page.evaluate(() => [...document.querySelectorAll('.box-guides .lbox .lbox-letter')].map((s) => s.textContent));
  console.log(`built boxes       : ${JSON.stringify(boxes)} → "${boxes.join('')}"`);
  if (boxes.join('').toLowerCase() !== "you're") issues.push(`FAIL: keypad built "${boxes.join('')}", expected "you're"`);

  // Check it → should master
  await page.evaluate(() => { const b = [...document.querySelectorAll('.check-btn')][0]; if (b && !b.disabled) b.click(); });
  await page.waitForTimeout(700);
  const verdict = await page.locator('.screen.mastery .verdict').textContent().catch(() => '');
  console.log(`verdict           : "${(verdict || '').trim()}"`);
  if (!/Mastered/i.test(verdict || '')) issues.push(`FAIL: building "you're" via the keypad did not master it (verdict "${verdict}")`);

  await page.screenshot({ path: 'scripts/qa_mastery_apos.png' });
  console.log('\n' + (issues.length ? `ISSUES (${issues.length}):\n- ` + issues.join('\n- ') : 'ISSUES: none ✅'));
} catch (e) {
  issues.push('PROBE ERROR: ' + e.message);
  console.log('ISSUES:', issues);
} finally {
  await browser.close();
}
process.exit(issues.length ? 1 : 0);
