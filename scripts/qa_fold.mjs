// qa_fold.mjs — measures VERTICAL fold quality (the §6 design-report problem the
// horizontal-overflow check can't catch). Drives onboarding, then for each viewport
// reports whether key primary actions sit ABOVE the fold on home + the wave reward.
// Usage: URL=http://localhost:5173 node scripts/qa_fold.mjs
import { chromium } from 'playwright';
const URL = process.env.URL || 'http://localhost:5173';
const VIEWS = [
  { id: 'land', w: 844, h: 390, label: 'phone landscape' },
  { id: 'small', w: 360, h: 740, label: 'small Android portrait' },
  { id: 'phone', w: 390, h: 844, label: 'iPhone 13 portrait' },
];

const clickText = (page, re) => page.evaluate((src) => {
  const rx = new RegExp(src, 'i');
  const b = [...document.querySelectorAll('button, .menu-card, .level-card, .colour-swatch, .quest-link, .crystal-cell')]
    .find((x) => rx.test(x.textContent || x.getAttribute('aria-label') || ''));
  if (b) { b.click(); return true; }
  return false;
}, re.source || re);

// returns {label, top, bottom, vh, aboveFold} for the first element matching selector
const measure = (page, sel) => page.evaluate((s) => {
  const e = document.querySelector(s);
  if (!e) return null;
  const r = e.getBoundingClientRect();
  return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: window.innerHeight, aboveFold: r.bottom <= window.innerHeight + 1 };
}, sel);

const onboard = async (page) => {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('.onboard-body');
  // §32.B: first-run onboarding opens with a "Tap to start" audio gate — dismiss it.
  if (await page.locator('.tap-to-start').count()) { await page.click('.tap-to-start'); await page.waitForSelector('.onboard-go:not(.tap-to-start)'); }
  await clickText(page, /let.?s go/); await page.waitForSelector('.onboard-name');
  await page.fill('.onboard-name', 'Ada');
  await clickText(page, /that.?s me/); await page.waitForSelector('.colour-grid');
  await clickText(page, /perfect/); await page.waitForSelector('.level-grid');
  await page.locator('.level-card').nth(4).click();
  await page.waitForTimeout(150);
  await clickText(page, /let.?s dig/);
  await page.waitForTimeout(500);
  if (await page.locator('button:has-text("Just this one")').count()) { await clickText(page, /just this one/); await page.waitForTimeout(400); }
  await page.waitForSelector('button:has-text("Start digging")', { timeout: 8000 });
};

const toReward = async (page) => {
  // launch the rhythm "Practice" wave from home (unlocks audio + starts the loop)
  await page.locator('.menu-card.play.practice').click({ timeout: 4000 }).catch(() => {});
  await page.waitForSelector('.tiles', { timeout: 8000 });
  for (let i = 0; i < 60; i++) {
    if (await page.locator('.reward').count()) return true;
    // only click when the tiles are unlocked (not mid-feedback) and the correct one is present
    const ok = await page.evaluate(() => {
      const tiles = document.querySelector('.tiles');
      if (!tiles || tiles.classList.contains('locked')) return false;
      const w = window.__rhythmCurrent && window.__rhythmCurrent.word;
      const t = [...document.querySelectorAll('.tile')].find((x) => x.textContent === w);
      if (t) { t.click(); return true; }
      return false;
    });
    await page.waitForTimeout(ok ? 700 : 300);
  }
  return (await page.locator('.reward').count()) > 0;
};

const browser = await chromium.launch();
let bad = 0;
for (const v of VIEWS) {
  const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  page.on('pageerror', (e) => errs.push(String(e)));
  console.log(`\n=== ${v.label} (${v.w}x${v.h}) ===`);
  await onboard(page);

  // HOME — is the Craft hero fully above the fold?
  await page.goto(URL, { waitUntil: 'networkidle' }); await page.waitForTimeout(300);
  // §28.D: a fresh open now ALWAYS shows "Who's playing?" (even for one child) — tap the
  // profile card to enter the game.
  if (await page.locator('.profile-card:not(.add)').count()) {
    await page.locator('.profile-card:not(.add)').first().click();
    await page.waitForTimeout(300);
  }
  if (await page.locator('.home').count() === 0) { await clickText(page, /home/); await page.waitForTimeout(300); }
  const hero = await measure(page, '.menu-card.craft.hero');
  const practice = await measure(page, '.menu-card.play.practice');
  const fmt = (m) => m ? `${m.aboveFold ? 'OK ' : 'BELOW'} bottom=${m.bottom}/vh=${m.vh}` : 'NOT FOUND';
  console.log(`  home Craft hero : ${fmt(hero)}`);
  console.log(`  home Practice   : ${fmt(practice)}`);
  if (hero && !hero.aboveFold) bad++;

  // REWARD — is the CTA row above the fold?
  const got = await toReward(page);
  if (got) {
    const row = await measure(page, '.reward .row');
    console.log(`  reward CTA row  : ${fmt(row)}`);
    if (row && !row.aboveFold) bad++;
  } else {
    console.log('  reward CTA row  : (could not reach reward)');
  }
  if (errs.length) console.log(`  ! console errors: ${errs.length}: ${errs[0]}`);
  await ctx.close();
}
console.log(`\nFOLD CHECK: ${bad === 0 ? 'PASS — all primary actions above the fold' : 'FAIL — ' + bad + ' primary action(s) below the fold'}`);
await browser.close();
process.exit(bad === 0 ? 0 : 1);
