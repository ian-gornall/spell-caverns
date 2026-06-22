// scripts/qa_stay_in_level.mjs — §36 stay-in-level (Ian 2026-06-22d): after the diagnostic places the
// explorer at a cavern level (band), the game must keep serving ONLY that band's words and must NOT
// jump to another level until the band is MASTERED. The fix removed BOTH movers that used to jump the
// level during craft: (1) the MEDIUM adaptive up/down (engine/selection.applyAdaptiveLevel) and
// (2) fillLearning's auto-climb when the band ran out of NEW words. The level now only advances via
// advanceLevelIfCleared (all words in the band mastered, in draw mode) or a manual re-aim.
//
// This seeds a profile PLACED at a mid-dataset cavern band, opens Craft, and builds several words
// CLEANLY in a row. Under the OLD code a 4-in-a-row clean run promoted the level (adaptive UP); under
// the fix the level must stay put. Asserts: (a) every crafted word stays in the seeded band (no climb),
// (b) the cavern level is UNCHANGED after the session (no jumping), (c) no console / page errors.
// Run: npm start (port 5173), then `node scripts/qa_stay_in_level.mjs`.
import { chromium } from 'playwright';
import { mkdir, rm } from 'node:fs/promises';

const URL = process.env.URL || 'http://localhost:5173';
const OUT = 'scripts/qa_stay_in_level';
const BAND = 20; // a mid-dataset band: real band-20 words exist AND deeper bands exist (so the OLD code COULD climb)
await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 820, height: 1180 } });
const issues = [];
page.on('pageerror', (e) => issues.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource.*\b404\b/.test(m.text())) issues.push('console.error: ' + m.text()); });

const SEED = {
  schema: 2, syncCode: null, syncConsent: false, parentPassword: null, activeId: 'S1',
  profiles: [{ id: 'S1', version: 1, profile: { name: 'Stay', onboarded: true }, startLevel: BAND,
    placement: { done: true, age: 8, band: BAND },
    categories: { setSize: 10, level: BAND, peakLevel: BAND, recent: [], order: 0, peakKnownish: 0, peakMastered: 0, words: [] } }],
};
const readLevel = () => page.evaluate(() => {
  const c = JSON.parse(localStorage.getItem('crystal-spell-caverns:v1'));
  const p = c.profiles.find((x) => x.id === c.activeId);
  return p.categories.level;
});
// Build the current craft word CORRECTLY: each tray-tile click fills the first empty slot L→R, so for
// slot k click an unused tray tile whose letter === target[k]. Returns the word + whether it built clean.
const buildCorrect = () => page.evaluate(() => {
  const w = window.__puzzleCurrent && window.__puzzleCurrent.word;
  if (!w) return { error: 'no __puzzleCurrent word' };
  for (let k = 0; k < w.length; k++) {
    const free = [...document.querySelectorAll('.tray-tile')].filter((x) => !x.classList.contains('used'));
    const pick = free.find((x) => x.textContent === w[k]);
    if (pick) pick.click();
  }
  const filled = [...document.querySelectorAll('.slots .slot')].map((s) => s.textContent).join('');
  return { word: w, band: window.__puzzleCurrent.band, built: filled, ok: filled === w };
});

try {
  await page.addInitScript((s) => { try { localStorage.setItem('crystal-spell-caverns:v1', JSON.stringify(s)); } catch {} }, SEED);
  await page.goto(URL, { waitUntil: 'networkidle' });
  if (await page.$('.tap-to-start')) await page.click('.tap-to-start');
  if (await page.locator('.profile-card:not(.add)').count()) await page.locator('.profile-card:not(.add)').first().click();

  await page.waitForSelector('.menu-card.craft', { timeout: 8000 });
  const levelBefore = await readLevel();
  await page.locator('.menu-card.craft').click(); // open Craft (before the idle auto-start can route)
  await page.waitForSelector('.screen.puzzle .slot', { timeout: 8000 });

  const crafted = [];
  const offBand = [];
  for (let i = 0; i < 5; i++) {
    if (!(await page.$('.screen.puzzle .slot'))) break; // wave finished early (reward screen) — stop
    await page.waitForFunction(() => document.querySelectorAll('.tray-tile:not(.used)').length > 0, { timeout: 8000 });
    const r = await buildCorrect();
    if (r.error) { issues.push('FAIL: ' + r.error); break; }
    if (!r.ok) issues.push(`FAIL: could not build "${r.word}" cleanly (built "${r.built}")`);
    crafted.push(r.word);
    if (r.band !== BAND) offBand.push(`${r.word}@band${r.band}`);
    if (i === 0) await page.screenshot({ path: `${OUT}/01-crafting.png` });
    await page.waitForTimeout(1300); // let the 1.1s post-solve advance present the next word
  }
  const levelAfter = await readLevel();
  await page.screenshot({ path: `${OUT}/02-after-session.png` });

  if (levelBefore !== BAND) issues.push(`FAIL: expected to start placed at band ${BAND}, got ${levelBefore}`);
  if (crafted.length < 4) issues.push(`FAIL: only crafted ${crafted.length} words — need ≥4 to exercise the old 4-in-a-row promote`);
  if (offBand.length) issues.push(`FAIL: a crafted word came from a DIFFERENT band (the set climbed out): ${offBand.join(', ')}`);
  if (levelAfter !== levelBefore) issues.push(`FAIL: crafting moved the cavern level ${levelBefore} → ${levelAfter} (the "jumping" the fix removes; OLD code promoted after 4 clean builds)`);

  console.log('\n— §36 stay-in-level QA —');
  console.log('placed band       :', levelBefore);
  console.log('clean builds       :', crafted.join(', '), `(${crafted.length})`);
  console.log('all in placed band:', offBand.length ? `NO — ${offBand.join(', ')}` : `yes (all band ${BAND}) ✅`);
  console.log('cavern level after:', levelAfter, levelAfter === levelBefore ? '(unchanged ✅)' : '(JUMPED ❌)');
} catch (e) {
  issues.push('THREW: ' + e.message);
}

console.log('\n' + (issues.length ? `ISSUES (${issues.length}):\n- ` + issues.join('\n- ') : 'ISSUES: none ✅'));
await browser.close();
process.exit(issues.length ? 1 : 0);
