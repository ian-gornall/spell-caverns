// scripts/qa_apostrophe.mjs — Ian 2026-06-22f: "the apostrophe is not working for typing it in".
// Seeds "you're" (band 21) into a Craft learning set and TYPES it on a physical keyboard, including
// the apostrophe key — asserts the apostrophe tile lands in its slot and the build completes.
// Run: npm start, then node scripts/qa_apostrophe.mjs
import { chromium } from 'playwright';

const URL = process.env.URL || 'http://localhost:5173';
const issues = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 820, height: 1180 } });
page.on('pageerror', (e) => issues.push('pageerror: ' + e.message));

const SEED = {
  schema: 2, syncCode: null, syncConsent: false, parentPassword: null, activeId: 'C1',
  profiles: [{ id: 'C1', version: 1, profile: { name: 'Apos', onboarded: true }, startLevel: 21,
    placement: { done: true, age: 9, band: 21 },
    categories: { setSize: 10, level: 21, recent: [], order: 1, seen: 0, reviewPending: { craft: 0, mastery: 0 },
      peakKnownish: 0, peakMastered: 0, peakLevel: 21,
      words: [{ word: "you're", tier: 1, band: 21, pattern: 'contraction', rank: 618,
        category: 'learning', craftStreak: 0, craftAttempts: 0, craftCorrect: 0, order: 1, lastSeen: 0 }] } }],
};
const cur = () => page.evaluate(() => window.__puzzleCurrent || null);

try {
  await page.addInitScript((s) => { try { localStorage.setItem('crystal-spell-caverns:v1', JSON.stringify(s)); } catch {} }, SEED);
  await page.goto(URL, { waitUntil: 'networkidle' });
  if (await page.$('.tap-to-start')) await page.click('.tap-to-start');
  if (await page.locator('.profile-card:not(.add)').count()) await page.locator('.profile-card:not(.add)').first().click();
  await page.locator('.menu-card.craft').click();
  await page.waitForSelector('.puzzle .slot', { timeout: 8000 });

  let found = false;
  for (let i = 0; i < 80 && !found; i++) {
    if (await page.$('.reward')) { await page.click('.reward .btn.primary'); await page.waitForSelector('.puzzle .slot', { timeout: 6000 }).catch(() => {}); await page.waitForTimeout(200); continue; }
    const c = await cur();
    if (!c || !c.word) { await page.waitForTimeout(120); continue; }
    if (c.word === "you're") {
      found = true;
      console.log(`served word       : "${c.word}" (apostrophe at index ${c.word.indexOf("'")})`);
      // TYPE the whole word incl. the apostrophe via the physical keyboard
      for (const ch of "you're") await page.keyboard.press(ch === "'" ? "'" : ch);
      await page.waitForTimeout(300);
      const slots = await page.$$eval('.screen.puzzle .slots .slot', (els) => els.map((e) => (e.textContent || '').trim()));
      const built = slots.join('');
      console.log(`typed slots       : ${JSON.stringify(slots)} → "${built}"`);
      if (built.toLowerCase() !== "you're") issues.push(`FAIL: typed build was "${built}", expected "you're" (apostrophe not placed by typing)`);
      else console.log('apostrophe typed  : ✅ landed in its slot');
      await page.waitForTimeout(1300);
      const after = await cur();
      const advanced = !after || after.word !== c.word || !!(await page.$('.reward'));
      if (!advanced) issues.push('FAIL: typed contraction did not grade correct / advance');
      else console.log('build completed   : ✅ advanced');
      await page.screenshot({ path: 'scripts/qa_apostrophe.png' });
      break;
    }
    await page.evaluate(() => { const w = window.__puzzleCurrent.word; for (let p = 0; p < w.length; p++) { const slot = document.querySelectorAll('.slots .slot')[p]; if (slot && slot.classList.contains('filled')) continue; const t = [...document.querySelectorAll('.tray-tile')].find((x) => !x.classList.contains('used') && x.textContent === w[p]); if (t) t.click(); } });
    await page.waitForTimeout(1100);
  }
  if (!found) issues.push('FAIL: never served "you’re" within 80 iterations');
  console.log('\n' + (issues.length ? `ISSUES (${issues.length}):\n- ` + issues.join('\n- ') : 'ISSUES: none ✅'));
} catch (e) {
  issues.push('PROBE ERROR: ' + e.message);
  console.log('ISSUES:', issues);
} finally {
  await browser.close();
}
process.exit(issues.length ? 1 : 0);
