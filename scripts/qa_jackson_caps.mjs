// scripts/qa_jackson_caps.mjs — reproduce Ian's report (2026-06-22f): "Jackson capitalization not
// working". Seeds a placed profile at band 40 with "Jackson" (rank 1200) explicitly in the learning
// set, opens Craft, finds it, and checks slot-0 caps for BOTH the TAP path and the new physical-
// keyboard TYPE path (#2). Run: npm start, then node scripts/qa_jackson_caps.mjs
import { chromium } from 'playwright';

const URL = process.env.URL || 'http://localhost:5173';
const issues = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 820, height: 1180 } });
page.on('pageerror', (e) => issues.push('pageerror: ' + e.message));

const SEED = {
  schema: 2, syncCode: null, syncConsent: false, parentPassword: null, activeId: 'C1',
  profiles: [{ id: 'C1', version: 1, profile: { name: 'Cap', onboarded: true }, startLevel: 40,
    placement: { done: true, age: 9, band: 40 },
    categories: { setSize: 10, level: 40, recent: [], order: 1, seen: 0, reviewPending: { craft: 0, mastery: 0 },
      peakKnownish: 0, peakMastered: 0, peakLevel: 40,
      words: [{ word: 'Jackson', tier: 2, band: 40, pattern: 'multisyllable', rank: 1200,
        category: 'learning', craftStreak: 0, craftAttempts: 0, craftCorrect: 0, order: 1, lastSeen: 0 }] } }],
};

const cur = () => page.evaluate(() => window.__puzzleCurrent || null);
const slot0Text = () => page.evaluate(() => { const s = document.querySelectorAll('.slots .slot')[0]; return s ? s.textContent.trim() : null; });
const clearAll = () => page.evaluate(() => { const b = [...document.querySelectorAll('.puzzle-controls .btn')].find((x) => /Clear/.test(x.textContent)); if (b) b.click(); });

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
    if (c.word.toLowerCase() === 'jackson') {
      found = true;
      console.log(`served word       : "${c.word}"  isProper=${c.isProper}`);
      if (!c.isProper) issues.push(`FAIL: __puzzleCurrent.isProper is FALSE for "${c.word}"`);

      // (1) TAP path: click the lowercase 'j' tile → slot 0 should render "J"
      await page.evaluate(() => { const t = [...document.querySelectorAll('.tray-tile')].find((x) => !x.classList.contains('used') && x.textContent === 'j'); if (t) t.click(); });
      await page.waitForTimeout(120);
      const tap = await slot0Text();
      console.log(`TAP  → slot0      : "${tap}" (expected "J")  ${tap === 'J' ? '✅' : '❌'}`);
      if (tap !== 'J') issues.push(`FAIL(tap): slot 0 rendered "${tap}", expected "J"`);
      await clearAll();
      await page.waitForTimeout(80);

      // (2) TYPE path (#2 physical keyboard): press 'j' → slot 0 should render "J"
      await page.keyboard.press('j');
      await page.waitForTimeout(120);
      const type = await slot0Text();
      console.log(`TYPE → slot0      : "${type}" (expected "J")  ${type === 'J' ? '✅' : '❌'}`);
      if (type !== 'J') issues.push(`FAIL(type): slot 0 rendered "${type}", expected "J"`);

      // (3) VISUAL: the DOM text being "J" isn't enough — a CSS text-transform:lowercase would render
      // it lowercase anyway (the csc-v60→v61 bug). Assert slot 0 is NOT being lowercased by CSS.
      const tt = await page.evaluate(() => getComputedStyle(document.querySelectorAll('.slots .slot')[0]).textTransform);
      console.log(`slot0 text-transform: "${tt}" (must NOT be "lowercase")  ${tt !== 'lowercase' ? '✅' : '❌'}`);
      if (tt === 'lowercase') issues.push('FAIL(visual): .slot text-transform:lowercase re-lowercases the capital — proper caps look broken');

      await page.screenshot({ path: 'scripts/qa_jackson_caps.png' });
      break;
    }
    // a non-jackson word: build it correctly to advance
    await page.evaluate(() => { const w = window.__puzzleCurrent.word; for (let p = 0; p < w.length; p++) { const slot = document.querySelectorAll('.slots .slot')[p]; if (slot && slot.classList.contains('filled')) continue; const t = [...document.querySelectorAll('.tray-tile')].find((x) => !x.classList.contains('used') && x.textContent === w[p]); if (t) t.click(); } });
    await page.waitForTimeout(1100);
  }
  if (!found) issues.push('FAIL: never served "jackson" within 80 iterations');
  console.log('\n' + (issues.length ? `ISSUES (${issues.length}):\n- ` + issues.join('\n- ') : 'ISSUES: none ✅'));
} catch (e) {
  issues.push('PROBE ERROR: ' + e.message);
  console.log('ISSUES:', issues);
} finally {
  await browser.close();
}
process.exit(issues.length ? 1 : 0);
