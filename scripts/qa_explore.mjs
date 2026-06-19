// scripts/qa_explore.mjs — EXPLORATORY QA: drive the app as a real user on a PHONE viewport
// and capture VIEWPORT screenshots (what's actually on screen, not full-page) at every step,
// so we can SEE jank — cramped spacing, oversized text, empty voids, content clipped at the
// fold, things that scroll when they shouldn't. Run, then read each PNG and take notes.
import { chromium } from 'playwright';
const URL = process.env.URL || 'http://localhost:5173';
const DEV = (process.env.DEV || 'iphone13');
const SIZES = { iphone13: { w: 390, h: 844 }, small: { w: 360, h: 740 }, big: { w: 430, h: 932 } };
const { w, h } = SIZES[DEV];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errs = [];
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
page.on('pageerror', (e) => errs.push(String(e)));

let n = 0;
const shot = async (label) => {
  n += 1;
  const tag = String(n).padStart(2, '0');
  await page.waitForTimeout(250);
  await page.screenshot({ path: `scripts/qa/explore/${DEV}-${tag}-${label}.png` });
  // measure if the screen overflows the FOLD (vertical) — jank signal
  const m = await page.evaluate(() => {
    const de = document.documentElement;
    return { overV: Math.max(0, de.scrollHeight - window.innerHeight), overH: Math.max(0, de.scrollWidth - window.innerWidth) };
  });
  console.log(`${tag} ${label.padEnd(22)} ${m.overV ? 'vScroll+' + m.overV : ''} ${m.overH ? 'hScroll+' + m.overH : ''}`.trimEnd());
};
const clickText = async (re) => page.evaluate((src) => {
  const rx = new RegExp(src, 'i');
  const b = [...document.querySelectorAll('button, .menu-card, .level-card, .colour-swatch')].find((x) => rx.test(x.textContent || x.getAttribute('aria-label') || ''));
  if (b) b.click();
  return !!b;
}, re.source || re);

// fresh user
await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.goto(URL, { waitUntil: 'networkidle' });

// ---- ONBOARDING ----
await page.waitForSelector('.onboard-body');
await shot('onb-welcome');
await clickText(/let.?s go/); await page.waitForSelector('.onboard-name'); await shot('onb-name');
await page.fill('.onboard-name', 'Leo');
await clickText(/that.?s me/); await page.waitForSelector('.colour-grid'); await shot('onb-colour');
await clickText(/perfect/); await page.waitForSelector('.level-grid'); await shot('onb-levels');
await page.locator('.level-card').nth(4).click(); // Building (tier 5)
await clickText(/let.?s dig/);
await page.waitForTimeout(400);
if (await page.locator('button:has-text("Just this one")').count()) { await shot('onb-sync'); await clickText(/just this one/); }
await page.waitForSelector('button:has-text("Start digging")'); await shot('onb-ready');

// ---- FIRST WAVE (rhythm) ----
await clickText(/start digging/);
await page.waitForSelector('.tiles', { timeout: 8000 });
await shot('rhythm-firstword');
// answer correctly, capture a verdict + a mid-wave + the reward
for (let i = 0; i < 5; i++) {
  await page.waitForTimeout(500);
  const ok = await page.evaluate(() => {
    const w = window.__rhythmCurrent && window.__rhythmCurrent.word;
    const t = [...document.querySelectorAll('.tile')].find((x) => x.textContent === w);
    if (t) { t.click(); return true; }
    return false;
  });
  if (i === 0) { await page.waitForTimeout(300); await shot('rhythm-verdict'); }
  if (!ok) break;
}
await page.waitForTimeout(1600);
await shot('rhythm-after5'); // either next word, wave reward, or boss

// if a boss/geode appeared, capture + tap through
if (await page.locator('.screen.boss, .boss, button:has-text("Crack")').count()) {
  await shot('boss');
  await clickText(/crack|open|continue|tap/);
  await page.waitForTimeout(800);
  await shot('boss-after');
}
// reach a wave reward if not already
if (await page.locator('.reward').count()) await shot('rhythm-reward');

// ---- HOME ----
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForSelector('.home-grid'); await shot('home');
// scroll home to see the bottom cards
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await shot('home-scrolled');

// ---- CRAFT (puzzle) ----
await clickText(/craft|build/);
await page.waitForSelector('.tray', { timeout: 8000 }); await shot('craft-start');
// build the word from tiles (place correct letters in order)
await page.evaluate(() => {
  const word = window.__puzzleCurrent && window.__puzzleCurrent.word;
  if (!word) return;
  for (const ch of word) {
    const tile = [...document.querySelectorAll('.tray-tile')].find((t) => !t.classList.contains('used') && t.textContent === ch);
    if (tile) tile.click();
  }
});
await page.waitForTimeout(600); await shot('craft-built');

// ---- LAB ----
await page.goto(URL, { waitUntil: 'networkidle' });
await clickText(/lab|invent/);
await page.waitForTimeout(800); await shot('lab-invent');

// ---- PROGRESS (fullpage too, it scrolls) ----
await page.goto(URL, { waitUntil: 'networkidle' });
await clickText(/progress|map/);
await page.waitForSelector('.screen'); await shot('progress-top');
await page.evaluate(() => { const s = document.querySelector('.scroll') || document.scrollingElement; s.scrollTo(0, s.scrollHeight); });
await shot('progress-bottom');

// ---- SETTINGS (scrolls a lot) ----
await page.goto(URL, { waitUntil: 'networkidle' });
await clickText(/settings|⚙/);
await page.waitForSelector('.level-grid'); await shot('settings-top');
await page.evaluate(() => { const s = document.querySelector('.scroll'); if (s) s.scrollTo(0, s.scrollHeight * 0.4); });
await shot('settings-mid');
await page.evaluate(() => { const s = document.querySelector('.scroll'); if (s) s.scrollTo(0, s.scrollHeight); });
await shot('settings-bottom');

// ---- PROFILES ("who's playing") — need 2 profiles; add one via settings flow is long, skip ----
console.log('\nconsole errors:', errs.length ? errs.slice(0, 5) : 'none');
console.log(`screenshots in scripts/qa/explore/  (device=${DEV} ${w}x${h})`);
await browser.close();
