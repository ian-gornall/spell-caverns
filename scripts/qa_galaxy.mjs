// scripts/qa_galaxy.mjs — REAL-DEVICE-CLOSEST horizontal-pan test against PROD.
// Uses Playwright's Samsung Galaxy device descriptors (real Samsung UA + DPR + viewport +
// touch) and, on each key screen, ACTIVELY tries to scroll/pan the page right — then measures
// whether anything actually moved. This reproduces the user's exact symptom ("I can horizontally
// scroll a bit / it's oversize") as closely as a machine can, on the deployed site.
import { chromium, devices } from 'playwright';
const URL = process.env.URL || 'https://spell.pryzmio.com';
const NAMES = ['Galaxy S24', 'Galaxy A55', 'Galaxy S9+', 'Galaxy S8', 'Galaxy Z Fold 6'];
const SEED = {
  version: 1, profile: { name: 'Sam', onboarded: true },
  settings: { difficulty: 'easy', length: 10, optionCount: 3, voice: false, volume: 0.85, voiceRate: 0.85, themeColor: '#7AA2FF', dailyGoalGems: 250 },
  startLevel: 5, gems: 5400, stats: { sessionsPlayed: 5, answers: 60, correct: 44, byDay: {} },
  streak: { count: 3, lastPlayedDate: new Date().toISOString().slice(0, 10), longest: 6 },
  catalog: { owned: ['quartz', 'amethyst', 'citrine'], milestoneDepth: 1 },
};

// Try hard to pan right, then report the worst actual horizontal movement + the offending element.
async function panProbe(page) {
  return page.evaluate(async () => {
    const tryScroll = () => {
      window.scrollTo(99999, 0);
      document.scrollingElement && (document.scrollingElement.scrollLeft = 99999);
      for (const e of document.querySelectorAll('*')) { try { e.scrollLeft = 99999; } catch {} }
    };
    tryScroll();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const de = document.documentElement;
    let worst = { sel: null, left: 0 };
    for (const e of document.querySelectorAll('*')) {
      if (e.scrollLeft > worst.left) {
        const cls = (e.className && typeof e.className === 'string') ? '.' + e.className.trim().split(/\s+/)[0] : '';
        worst = { sel: e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + cls, left: e.scrollLeft };
      }
    }
    return {
      winScrollX: window.scrollX,
      docPannable: Math.max(de.scrollWidth - de.clientWidth, document.body.scrollWidth - document.body.clientWidth),
      worstInnerLeft: worst.left, worstSel: worst.sel,
      vw: window.innerWidth, vvw: Math.round(window.visualViewport ? window.visualViewport.width : window.innerWidth),
    };
  });
}

const browser = await chromium.launch();
const findings = [];
for (const name of NAMES) {
  const d = devices[name];
  const ctx = await browser.newContext({ ...d });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate((s) => localStorage.setItem('crystal-spell-caverns:v1', JSON.stringify(s)), SEED);
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  if (await page.locator('.profile-card:not(.add)').count()) await page.locator('.profile-card:not(.add)').first().click().catch(() => {});
  await page.waitForSelector('.menu-card.play', { timeout: 8000 }).catch(() => {});

  const screens = [['home', null], ['settings', '.menu-card.settings'], ['catalog', '.menu-card.catalog'], ['practice', '.menu-card.play']];
  for (const [sname, sel] of screens) {
    if (sel) {
      await page.locator('.menu-card.play').first().waitFor({ timeout: 5000 }).catch(() => {});
      await page.locator(sel).first().click().catch(() => {});
      await page.waitForTimeout(600);
    }
    const r = await panProbe(page);
    const pan = Math.max(r.winScrollX, r.docPannable, r.worstInnerLeft);
    const status = pan > 1 ? `⚠ PAN=${pan} (${r.worstSel} left=${r.worstInnerLeft}, doc=${r.docPannable}, winX=${r.winScrollX})` : 'ok';
    console.log(`  ${name.padEnd(16)} ${sname.padEnd(9)} vw=${r.vw} visual=${r.vvw} ${status}`);
    if (pan > 1) findings.push(`${name} [${sname}]: ${status}`);
    // back to home for next screen
    if (sel) { await page.goto(URL, { waitUntil: 'networkidle' }); await page.waitForTimeout(300); if (await page.locator('.profile-card:not(.add)').count()) await page.locator('.profile-card:not(.add)').first().click().catch(() => {}); await page.waitForSelector('.menu-card.play', { timeout: 6000 }).catch(() => {}); }
  }
  if (errs.length) console.log(`    console errors: ${errs.slice(0, 2).join(' | ')}`);
  await ctx.close();
}
console.log('\n============ GALAXY PAN TEST (prod) ============');
console.log(findings.length ? findings.join('\n') : '✅ no horizontal pan on any Galaxy device descriptor / screen — page cannot scroll right');
await browser.close();
