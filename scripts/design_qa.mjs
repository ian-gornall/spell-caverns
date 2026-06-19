// design_qa.mjs — design-review capture pass. Drives the app at phone / tablet / landscape
// and screenshots key + dynamic states into scripts/qa/design/. Read each PNG after.
import { chromium } from 'playwright';
const URL = process.env.URL || 'http://localhost:5181';
const PROFILE = process.env.PROFILE || 'phone';
const SIZES = {
  phone: { w: 390, h: 844 },     // iPhone 13
  small: { w: 360, h: 740 },     // small Android
  tablet: { w: 820, h: 1180 },   // iPad portrait (design target)
  land: { w: 844, h: 390 },      // phone landscape
};
const { w, h } = SIZES[PROFILE];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: w, height: h }, deviceScaleFactor: 2,
  isMobile: PROFILE !== 'tablet', hasTouch: true,
});
const page = await ctx.newPage();
const errs = [];
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
page.on('pageerror', (e) => errs.push(String(e)));

let n = 0;
const shot = async (label) => {
  n += 1;
  const tag = String(n).padStart(2, '0');
  await page.waitForTimeout(250);
  await page.screenshot({ path: `scripts/qa/design/${PROFILE}-${tag}-${label}.png` });
  const m = await page.evaluate(() => {
    const de = document.documentElement;
    return { overV: Math.max(0, de.scrollHeight - window.innerHeight), overH: Math.max(0, de.scrollWidth - window.innerWidth) };
  });
  console.log(`${PROFILE} ${tag} ${label.padEnd(22)} ${m.overV ? 'vScroll+' + m.overV : ''} ${m.overH ? 'hScroll+' + m.overH : ''}`.trimEnd());
};
const clickText = async (re) => page.evaluate((src) => {
  const rx = new RegExp(src, 'i');
  const b = [...document.querySelectorAll('button, .menu-card, .level-card, .colour-swatch, .quest-link, .crystal-cell')].find((x) => rx.test(x.textContent || x.getAttribute('aria-label') || ''));
  if (b) { b.click(); return true; }
  return false;
}, re.source || re);

const seed = async () => {
  // give the profile gems + some progress so catalog/progress/geode have content
  await page.evaluate(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('csc_state_v2') || localStorage.getItem('csc-state') || 'null');
    } catch {}
  });
};

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.goto(URL, { waitUntil: 'networkidle' });

// ---- ONBOARDING ----
await page.waitForSelector('.onboard-body');
await shot('onb-welcome');
await clickText(/let.?s go/); await page.waitForSelector('.onboard-name'); await shot('onb-name');
await page.fill('.onboard-name', 'Ada');
await clickText(/that.?s me/); await page.waitForSelector('.colour-grid'); await shot('onb-colour');
await clickText(/perfect/); await page.waitForSelector('.level-grid'); await shot('onb-levels');
await page.locator('.level-card').nth(4).click();
await page.waitForTimeout(200);
await clickText(/let.?s dig/);
await page.waitForTimeout(600);
if (await page.locator('button:has-text("Just this one")').count()) { await clickText(/just this one/); await page.waitForTimeout(500); }
await page.waitForSelector('button:has-text("Start digging")', { timeout: 8000 });
await shot('onb-ready');

// ---- FIRST WAVE (rhythm / practice) ----
await clickText(/start digging/);
await page.waitForSelector('.tiles', { timeout: 8000 });
await shot('play-question');
// answer correctly to capture a verdict
await page.waitForTimeout(400);
await page.evaluate(() => {
  const w = window.__rhythmCurrent && window.__rhythmCurrent.word;
  const t = [...document.querySelectorAll('.tile')].find((x) => x.textContent === w);
  if (t) t.click();
});
await page.waitForTimeout(350);
await shot('play-correct-verdict');
// next, answer WRONG to capture gentle reveal
await page.waitForTimeout(1400);
await page.evaluate(() => {
  const w = window.__rhythmCurrent && window.__rhythmCurrent.word;
  const t = [...document.querySelectorAll('.tile')].find((x) => x.textContent !== w);
  if (t) t.click();
});
await page.waitForTimeout(400);
await shot('play-wrong-reveal');
// blast through to a reward / boss
for (let i = 0; i < 8; i++) {
  await page.waitForTimeout(700);
  const ok = await page.evaluate(() => {
    const w = window.__rhythmCurrent && window.__rhythmCurrent.word;
    const t = [...document.querySelectorAll('.tile')].find((x) => x.textContent === w);
    if (t) { t.click(); return true; }
    return false;
  });
  if (!ok) break;
}
await page.waitForTimeout(1200);
await shot('play-reward-or-boss');
if (await page.locator('.geode, .boss-body, button:has-text("Crack")').count()) {
  // tap geode/boss a few times to crack
  for (let i = 0; i < 14; i++) { await clickText(/crack|tap|open/).catch(()=>{}); await page.locator('.geode').click({ timeout: 300 }).catch(()=>{}); await page.waitForTimeout(120); }
  await shot('boss-cracked');
}

// back home
await clickText(/home/).catch(()=>{});
await page.waitForTimeout(400);
if (await page.locator('.home').count() === 0) { await page.goto(URL, { waitUntil: 'networkidle' }); await page.waitForTimeout(400); }
await shot('home');

// ---- CATALOG ----
await clickText(/catalog/);
await page.waitForTimeout(500);
await shot('catalog');
// tap a crystal detail
await page.locator('.crystal-cell').first().click().catch(()=>{});
await page.waitForTimeout(400);
await shot('catalog-detail');
await page.keyboard.press('Escape').catch(()=>{});
await clickText(/back|home|✕|×/).catch(()=>{});
await page.waitForTimeout(300);

// ---- PROGRESS ----
await page.goto(URL, { waitUntil: 'networkidle' }); await page.waitForTimeout(400);
await clickText(/progress/);
await page.waitForTimeout(500);
await shot('progress-top');
await page.evaluate(() => { const s = document.querySelector('.scroll'); if (s) s.scrollTop = s.scrollHeight; });
await page.waitForTimeout(300);
await shot('progress-bottom');

// ---- SETTINGS + PARENTS ----
await page.goto(URL, { waitUntil: 'networkidle' }); await page.waitForTimeout(400);
await clickText(/settings/);
await page.waitForTimeout(500);
await shot('settings-top');
await page.evaluate(() => { const s = document.querySelector('.scroll'); if (s) s.scrollTop = s.scrollHeight; });
await page.waitForTimeout(300);
await shot('settings-bottom');

console.log(`\n${PROFILE} DONE. console/page errors: ${errs.length}`);
errs.slice(0, 8).forEach((e) => console.log('  ! ' + e));
await browser.close();
