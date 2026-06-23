// scripts/qa_retest.mjs — §37 D (Ian 2026-06-22f): "Re-test starting level" must give a CLEAN
// re-diagnosis. Seeds a PLACED profile at band 35 with Mastery already UNLOCKED (high-water peaks)
// + some known/mastered words, taps Settings → Re-test, and asserts: the next Craft runs the
// DIAGNOSTIC (placement), the level reset to 1, Mastery/Mining RE-LOCKED, and word progress was KEPT.
// Run: npm start, then node scripts/qa_retest.mjs
import { chromium } from 'playwright';

const URL = process.env.URL || 'http://localhost:5173';
const KEY = 'crystal-spell-caverns:v1';
const issues = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 820, height: 1180 } });
page.on('pageerror', (e) => issues.push('pageerror: ' + e.message));

// PLACED at band 35; peakKnownish/peakMastered = 10 → Mastery + Mining already unlocked; 2 known + 1
// mastered word records present (so we can prove word progress is KEPT through the re-test).
const SEED = {
  schema: 2, syncCode: null, syncConsent: false, parentPassword: null, activeId: 'R1',
  profiles: [{ id: 'R1', version: 1, profile: { name: 'Retest', onboarded: true }, startLevel: 35,
    placement: { done: true, age: 9, band: 35 },
    categories: { setSize: 10, level: 35, recent: [], order: 50, seen: 5, reviewPending: { craft: 0, mastery: 0 },
      peakKnownish: 10, peakMastered: 10, peakLevel: 35,
      words: [
        { word: 'planet', tier: 4, band: 35, pattern: 'x', rank: 1040, category: 'mastered', craftStreak: 1, craftAttempts: 2, craftCorrect: 2, order: 1, lastSeen: 3 },
        { word: 'forest', tier: 4, band: 35, pattern: 'y', rank: 1041, category: 'known', craftStreak: 1, craftAttempts: 1, craftCorrect: 1, order: 2, lastSeen: 4 },
        { word: 'rocket', tier: 4, band: 35, pattern: 'z', rank: 1042, category: 'known', craftStreak: 1, craftAttempts: 1, craftCorrect: 1, order: 3, lastSeen: 5 },
      ] } }],
};

const activeCats = () => page.evaluate((key) => {
  const s = JSON.parse(localStorage.getItem(key) || '{}');
  const p = (s.profiles || []).find((x) => x.id === s.activeId) || (s.profiles || [])[0];
  return { cats: p && p.categories, placement: p && p.placement };
}, KEY);
const masteryUnlocked = (c) => (c.peakKnownish || 0) >= (c.setSize || 10);
const miningUnlocked = (c) => (c.peakMastered || 0) >= (c.setSize || 10);
const cat = (c, w) => (c.words.find((r) => (r.word || '').toLowerCase() === w) || {}).category;

try {
  await page.addInitScript((args) => { try { localStorage.setItem(args.k, JSON.stringify(args.s)); } catch {} }, { k: KEY, s: SEED });
  await page.goto(URL, { waitUntil: 'networkidle' });
  if (await page.$('.tap-to-start')) await page.click('.tap-to-start');
  if (await page.locator('.profile-card:not(.add)').count()) await page.locator('.profile-card:not(.add)').first().click();
  await page.waitForSelector('.menu-card', { timeout: 8000 });

  // sanity: BEFORE re-test, mastery + mining are unlocked and level is 35
  let { cats } = await activeCats();
  console.log(`BEFORE  : level=${cats.level} masteryUnlocked=${masteryUnlocked(cats)} miningUnlocked=${miningUnlocked(cats)} known/mastered=${cats.words.filter(w=>w.category==='known').length}/${cats.words.filter(w=>w.category==='mastered').length}`);
  if (!masteryUnlocked(cats)) issues.push('SETUP FAIL: mastery should start unlocked');

  // open Settings → tap Re-test
  await page.evaluate(() => { const b = [...document.querySelectorAll('button, .menu-card, a')].find((x) => /settings|⚙/i.test(x.textContent)); if (b) b.click(); });
  await page.waitForTimeout(400);
  // some builds reach settings via a gear in the header; fall back to the hash route
  if (!(await page.$('text=Re-test'))) { await page.goto(URL + '#settings', { waitUntil: 'networkidle' }).catch(() => {}); await page.waitForTimeout(400); }
  const retestBtn = page.locator('button', { hasText: 'Re-test' });
  if (!(await retestBtn.count())) { issues.push('FAIL: could not find the Re-test button in Settings'); }
  else {
    await retestBtn.first().click();
    await page.waitForSelector('.screen.puzzle .slot', { timeout: 8000 }); // re-test navigates straight to Craft
    await page.waitForTimeout(300);

    const pc = await page.evaluate(() => window.__puzzleCurrent || null);
    console.log(`puzzle  : placement=${pc && pc.placement} (must be true = diagnostic running)`);
    if (!pc || pc.placement !== true) issues.push('FAIL: after Re-test the Craft screen is NOT in placement/diagnostic mode');

    ({ cats } = await activeCats());
    const { placement } = await activeCats();
    console.log(`AFTER   : level=${cats.level} masteryUnlocked=${masteryUnlocked(cats)} miningUnlocked=${miningUnlocked(cats)} placement.done=${placement.done}`);
    console.log(`progress: ${cat(cats, 'planet')}=planet, ${cat(cats, 'forest')}=forest, ${cat(cats, 'rocket')}=rocket (must be kept)`);

    if (cats.level !== 1) issues.push(`FAIL: level should reset to 1, got ${cats.level}`);
    if (masteryUnlocked(cats)) issues.push('FAIL: Mastery should be RE-LOCKED during the re-test (peakKnownish not zeroed)');
    if (miningUnlocked(cats)) issues.push('FAIL: Mining should be RE-LOCKED during the re-test (peakMastered not zeroed)');
    if (placement.done !== false) issues.push('FAIL: placement.done should be false (diagnostic re-armed)');
    // word progress KEPT (soft reset)
    if (cat(cats, 'planet') !== 'mastered') issues.push('FAIL: mastered word "planet" was not kept');
    if (cat(cats, 'forest') !== 'known' || cat(cats, 'rocket') !== 'known') issues.push('FAIL: known words were not kept');

    await page.screenshot({ path: 'scripts/qa_retest.png' });
  }
  console.log('\n' + (issues.length ? `ISSUES (${issues.length}):\n- ` + issues.join('\n- ') : 'ISSUES: none ✅'));
} catch (e) {
  issues.push('PROBE ERROR: ' + e.message);
  console.log('ISSUES:', issues);
} finally {
  await browser.close();
}
process.exit(issues.length ? 1 : 0);
