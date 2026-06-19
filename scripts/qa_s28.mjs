// scripts/qa_s28.mjs — interactive visual QA for the §28 backlog (D routing, C printables, B prices).
// Drives the live dev server (localhost:5173). Run: node scripts/qa_s28.mjs
import { chromium } from 'playwright';

const URL = process.env.URL || 'http://localhost:5173';
const OUT = 'scripts/_s28';
import fs from 'node:fs';
fs.mkdirSync(OUT, { recursive: true });

const log = (...a) => console.log(...a);
let fails = 0;
const check = (cond, msg) => {
  log(`${cond ? '✅' : '❌'} ${msg}`);
  if (!cond) fails++;
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 740 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

// Fresh state.
await page.goto(URL);
await page.evaluate(() => localStorage.clear());

// --- Seed ONE onboarded profile via the app's own store API, then reload. ---
await page.goto(URL);
await page.evaluate(async () => {
  const store = await import('/src/state.js');
  store.load();
  store.addProfile({ name: 'Robin', themeColor: '#36F1CD', startLevel: 3 });
});

// === D: a single-profile family must now see "Who's playing?" + Add explorer ===
await page.goto(URL);
await page.waitForTimeout(600);
const body1 = await page.innerText('body');
check(/who.?s playing/i.test(body1), 'D: "Who\'s playing?" shown for a 1-child family');
check(/add explorer/i.test(body1), 'D: "Add explorer" option is visible');
await page.screenshot({ path: `${OUT}/D-whos-playing.png` });

// Enter the profile.
await page.click('.profile-card:not(.add)');
await page.waitForTimeout(500);
check(/craft|practice|geode|dig|home/i.test(await page.innerText('body')), 'D: tapping the card enters the game');

// === B: catalog prices reflect the ~2.5x bump ===
await page.click('.menu-card.catalog');
await page.waitForTimeout(500);
const catBody = await page.innerText('body');
check(/\b400\b/.test(catBody), 'B: a common crystal now costs 400');
check(/\b6500\b/.test(catBody) || /\b6,500\b/.test(catBody), 'B: a legendary crystal now costs 6500');
check(!/\b160\b/.test(catBody), 'B: old 160 price no longer shown');
await page.screenshot({ path: `${OUT}/B-catalog.png`, fullPage: true });
// Back to home.
const back1 = await page.$('button:has-text("←"), .hdr-back, button[aria-label="Back"]');
if (back1) { await back1.click(); await page.waitForTimeout(400); }

// === C: Printables ===
await page.click('.menu-card:has-text("Settings")');
await page.waitForTimeout(400);
let sbody = await page.innerText('body');
check(/practice sheets/i.test(sbody), 'C: "Practice sheets" panel present in Settings');
await page.screenshot({ path: `${OUT}/C-settings.png`, fullPage: true });

const mkBtn = await page.$('button:has-text("Make a printable sheet")');
if (mkBtn) {
  await mkBtn.click();
  await page.waitForTimeout(400);
  const pbody = await page.innerText('body');
  check(/practice sheets/i.test(pbody) && /print this sheet/i.test(pbody), 'C: printables screen opens with a Print button');
  // Default = targets (no targets yet for fresh profile → empty-state copy)
  await page.screenshot({ path: `${OUT}/C-printables-targets.png`, fullPage: true });
  // Switch source to "An age level".
  const tierBtn = await page.$('button:has-text("An age level")');
  if (tierBtn) { await tierBtn.click(); await page.waitForTimeout(300); }
  check(!!(await page.$('select.print-select')), 'C: tier picker (select) appears for age-level source');
  // Switch format to grid.
  const gridBtn = await page.$('button:has-text("Look")');
  if (gridBtn) { await gridBtn.click(); await page.waitForTimeout(300); }
  check(!!(await page.$('table.lcwc')), 'C: look-cover-write-check grid renders');
  await page.screenshot({ path: `${OUT}/C-printables-grid.png`, fullPage: true });
  // Pattern source.
  const patBtn = await page.$('button:has-text("A spelling pattern")');
  if (patBtn) { await patBtn.click(); await page.waitForTimeout(300); }
  const listBtn = await page.$('button:has-text("Word list")');
  if (listBtn) { await listBtn.click(); await page.waitForTimeout(300); }
  check(!!(await page.$('ol.word-list li')), 'C: pattern word-list renders words');
  await page.screenshot({ path: `${OUT}/C-printables-pattern-list.png`, fullPage: true });
} else {
  check(false, 'C: could not find "Make a printable sheet" button');
}

await browser.close();
log(`\nConsole errors: ${errors.length}`);
errors.slice(0, 10).forEach((e) => log('   ⚠️', e));
log(fails === 0 ? '\n🎉 §28 QA PASS' : `\n💥 ${fails} check(s) failed`);
process.exit(fails === 0 && errors.length === 0 ? 0 : 1);
