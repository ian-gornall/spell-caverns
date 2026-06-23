// scripts/qa_boss_nullname.mjs — REGRESSION GUARD (QA loop, 2026-06-22g): the GEODE BOSS reveal must
// NEVER render the literal text "null". Root cause it guards: boss.js reveal() passed `crystal && el(...)`
// children straight into native `body.replaceChildren(...)`. When no milestone crystal is granted
// (crystal === null) — which happens in REAL late-game play once all 24 crystals are collected, since
// grantMilestoneCrystal → nextFreeCrystal returns null — those two `&&` expressions are `null`, and
// native replaceChildren STRINGIFIES each null into a "null" text node → "nullnull" on screen.
// (The el() helper filters null/false children; native replaceChildren does NOT — that's the trap.)
//
// Repro here: seed a profile that already owns EVERY crystal, then open a geode boss and crack it.
// Run: npm start (one terminal), then: node scripts/qa_boss_nullname.mjs
import { chromium } from 'playwright';

const URL = process.env.URL || 'http://localhost:5173';

// all 24 species ids (engine/catalog.js CRYSTAL_SPECIES) — owning them all makes nextFreeCrystal()
// return null, so the next boss grants no crystal (crystal === null in reveal()).
const ALL_OWNED = [
  'quartz', 'amethyst', 'citrine', 'rose-quartz', 'jade', 'agate', 'pyrite', 'fluorite',
  'emerald', 'sapphire', 'topaz', 'garnet', 'aquamarine', 'peridot', 'turquoise', 'lapis',
  'ruby', 'opal', 'moonstone', 'tourmaline', 'malachite',
  'diamond', 'alexandrite', 'star-sapphire',
];

const SEED = {
  schema: 2, syncCode: null, syncConsent: false, parentPassword: null, activeId: 'B1',
  profiles: [{
    id: 'B1', version: 1, profile: { name: 'Collector', onboarded: true }, startLevel: 10,
    placement: { done: true, age: 8, band: 10 }, gems: 9999,
    catalog: { owned: ALL_OWNED, milestoneDepth: 1 }, // every crystal already owned
    categories: { setSize: 10, level: 10, recent: [], order: 0, peakKnownish: 0, peakMastered: 0, words: [] },
  }],
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const issues = [];
page.on('pageerror', (e) => issues.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource.*\b404\b/.test(m.text())) issues.push('console.error: ' + m.text()); });

try {
  await page.addInitScript((s) => { try { localStorage.setItem('crystal-spell-caverns:v1', JSON.stringify(s)); } catch {} }, SEED);
  await page.goto(URL, { waitUntil: 'networkidle' });
  if (await page.$('.tap-to-start')) await page.click('.tap-to-start');
  await page.goto(URL + '/?boss=5', { waitUntil: 'networkidle' });
  if (await page.$('.tap-to-start')) await page.click('.tap-to-start');

  await page.waitForSelector('.screen.boss', { timeout: 8000 });
  // crack the geode (6 taps)
  for (let i = 0; i < 8; i++) { const g = page.locator('.geode'); if (await g.count()) await g.first().click({ timeout: 1500 }).catch(() => {}); await page.waitForTimeout(120); }
  await page.waitForSelector('.depth-banner', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(400);

  // inspect the reveal: there must be NO text node whose content is exactly "null", and the visible
  // text must not contain the literal word "null".
  const probe = await page.evaluate(() => {
    const bb = document.querySelector('.boss-body');
    const nullTextNodes = [];
    if (bb) bb.childNodes.forEach((n) => { if (n.nodeType === 3 && n.textContent.trim() === 'null') nullTextNodes.push(true); });
    return {
      nullTextNodeCount: nullTextNodes.length,
      visibleHasNull: /\bnull\b/.test((bb?.innerText || bb?.textContent || '')),
      bannerOk: /Depth 5/.test(document.querySelector('.depth-banner')?.textContent || ''),
    };
  });
  await page.screenshot({ path: 'scripts/qa_boss_nullname.png' });

  if (probe.nullTextNodeCount > 0) issues.push(`FAIL: boss reveal has ${probe.nullTextNodeCount} "null" text node(s) (the null-crystal bug)`);
  if (probe.visibleHasNull) issues.push('FAIL: boss reveal shows the literal text "null"');
  if (!probe.bannerOk) issues.push('FAIL: reveal banner should read "Depth 5"');

  console.log('\n— geode boss null-name guard —');
  console.log('null text nodes :', probe.nullTextNodeCount);
  console.log('visible has null:', probe.visibleHasNull);
  console.log('banner Depth 5  :', probe.bannerOk);
  console.log('\n' + (issues.length ? `ISSUES (${issues.length}):\n- ` + issues.join('\n- ') : 'ISSUES: none ✅'));
} catch (e) {
  issues.push('PROBE ERROR: ' + e.message);
  console.log('\nISSUES:', issues);
} finally {
  await browser.close();
}
process.exit(issues.length ? 1 : 0);
