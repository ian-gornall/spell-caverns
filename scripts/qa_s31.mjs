// scripts/qa_s31.mjs — visual-QA probe for the §31 Mastery upgrades + the 2026-06-19g fixes:
//   A. whole-word multi-box writing on WIDE screens (ONE ink overlay over a row of box guides;
//      strokes routed to the nearest box; tap a box to redo; explicit ✓ Check submit)
//   B. dictation toggle (sentence hidden + peekable)
//   C. mastery-first nudging (home card pulse)
// Seeds a mastery-unlocked profile with a few KNOWN words, then exercises WIDE (boxes + Check +
// tap-to-redo) + dictation + the keyboard fill, and the NARROW single-canvas fallback.
// Run: npm start (one terminal) then: node scripts/qa_s31.mjs
import { chromium } from 'playwright';
import { mkdir, rm } from 'node:fs/promises';

const URL = process.env.URL || 'http://localhost:5173';
const OUT = 'scripts/qa_s31';
await rm(OUT, { recursive: true, force: true }).catch(() => {});
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const issues = [];
const ok = (c, m) => console.log((c ? '✓ ' : '✗ ') + m) || (!c && issues.push(m));

const known = (w, i) => ({ word: w, tier: 1, pattern: 'short-o', rank: 50 + i, category: 'known', craftStreak: 2, craftAttempts: 2, craftCorrect: 2, order: i + 1 });
const WORDS = ['lot', 'cot', 'tot'];
const SEED = {
  schema: 2, syncCode: null, syncConsent: false, parentPassword: null, activeId: 'm1',
  profiles: [{
    id: 'm1', version: 1, profile: { name: 'Drawer', onboarded: true },
    settings: { length: 5 },
    categories: { setSize: 3, level: 1, recent: [], order: WORDS.length, peakKnownish: 3, peakMastered: 0, words: WORDS.map(known) },
  }],
};

// canvas-fraction letter shapes (within a box's bounding box)
function shapesFor(letter) {
  const arc = (a0, a1, n) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * (i / n); return [0.5 + 0.26 * Math.cos(a), 0.5 + 0.34 * Math.sin(a)]; });
  if (letter === 'o') return [arc(0, 2 * Math.PI, 32)];
  if (letter === 'c') return [arc(Math.PI * 0.32, Math.PI * 1.68, 28)];
  if (letter === 'l') return [Array.from({ length: 17 }, (_, i) => [0.5, 0.16 + (0.68 * i) / 16])];
  if (letter === 't') return [Array.from({ length: 17 }, (_, i) => [0.5, 0.14 + (0.72 * i) / 16]), Array.from({ length: 13 }, (_, i) => [0.32 + (0.36 * i) / 12, 0.34])];
  return [[[0.4, 0.5], [0.6, 0.5]]];
}

async function traceStroke(page, box, fracPts) {
  const pt = (f) => [box.x + f[0] * box.width, box.y + f[1] * box.height];
  const [sx, sy] = pt(fracPts[0]);
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  for (let i = 1; i < fracPts.length; i++) { const [x, y] = pt(fracPts[i]); await page.mouse.move(x, y, { steps: 2 }); }
  await page.mouse.up();
}
// draw a letter INTO box i (mouse lands on the overlay that covers the guides)
async function drawBox(page, i, letter) {
  const box = await page.locator('.lbox').nth(i).boundingBox();
  for (const s of shapesFor(letter)) await traceStroke(page, box, s);
}
// tap box i (a no-move click on the overlay over that box) → used to redo a filled box
async function tapBox(page, i) {
  const b = await page.locator('.lbox').nth(i).boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
}
const builtBoxes = async (page) => (await page.locator('.lbox-letter').allTextContents()).join('');

async function newPage(view) {
  const page = await browser.newPage({ viewport: view });
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource.*\b404\b/.test(m.text())) issues.push('console.error: ' + m.text()); });
  page.on('pageerror', (e) => issues.push('pageerror: ' + e.message));
  await page.addInitScript((seed) => { try { localStorage.setItem('crystal-spell-caverns:v1', JSON.stringify(seed)); } catch {} }, SEED);
  return page;
}
async function gotoHome(page) {
  await page.goto(URL, { waitUntil: 'networkidle' });
  if (await page.locator('.profile-card:not(.add)').count()) await page.locator('.profile-card:not(.add)').first().click();
  await page.waitForSelector('.menu-card', { timeout: 6000 });
}
const noOverflow = async (page, label) => {
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  const cw = await page.evaluate(() => document.documentElement.clientWidth);
  ok(sw <= cw + 1, `${label}: no horizontal overflow (scrollW=${sw} clientW=${cw})`);
};

try {
  // ---------- WIDE (iPad landscape) ----------
  console.log('\n=== WIDE 1024×820 (multi-box) ===');
  const wide = await newPage({ width: 1024, height: 820 });
  await gotoHome(wide);
  ok(await wide.locator('.menu-card.mastery.nudge').count() > 0, 'home: Mastery card has the .nudge pulse');
  const badge = (await wide.locator('.menu-card.mastery .badge').textContent())?.trim();
  ok(/master these/i.test(badge || ''), `home: Mastery badge nudges ("${badge}")`);
  await wide.screenshot({ path: `${OUT}/w01-home-nudge.png` });

  await wide.locator('.menu-card.mastery').click();
  await wide.waitForSelector('.draw-boxes', { timeout: 8000 });
  await wide.waitForTimeout(400);
  const w1 = await wide.evaluate(() => window.__masteryCurrent);
  ok(w1?.wide === true, `mastery: wide layout active (flag=${w1?.wide})`);
  ok(await wide.locator('.boxes-ink').isVisible() && !(await wide.locator('.draw-canvas').isVisible()), 'mastery: ink overlay shown, single-canvas hidden');
  const nBoxes = await wide.locator('.lbox').count();
  ok(nBoxes === (w1?.word || '').length, `mastery: ${nBoxes} boxes == "${w1?.word}".length`);
  ok(await wide.locator('.check-btn').isDisabled(), 'Check button starts DISABLED (nothing written yet)');
  await wide.screenshot({ path: `${OUT}/w02-boxes.png` });
  await noOverflow(wide, 'wide mastery');
  // (§31.B dictation is now the §32 VOICE mode — covered by scripts/qa_s32.mjs.)

  // §31.A write each letter → boxes auto-fill (display only); NOTHING graded until Check.
  const word1 = w1.word;
  for (let i = 0; i < word1.length; i++) { await drawBox(wide, i, word1[i]); await wide.waitForTimeout(1050); }
  await wide.waitForTimeout(300);
  const filled1 = await wide.locator('.lbox.filled').count();
  const built1 = await builtBoxes(wide);
  ok(filled1 === word1.length, `draw: all ${word1.length} boxes auto-filled (built="${built1}")`);
  ok((await wide.locator('.mastery .verdict').textContent())?.trim() === '', 'no grading happened before Check (verdict empty)');
  ok(!(await wide.locator('.check-btn').isDisabled()), 'Check button ENABLED once every box is filled');
  await wide.screenshot({ path: `${OUT}/w04-written.png` });

  // tap-to-redo: tap box 0 → it clears; redraw it
  await tapBox(wide, 0);
  await wide.waitForTimeout(200);
  ok(await wide.locator('.lbox.filled').count() === word1.length - 1, 'tap a filled box → it clears (redo)');
  ok(await wide.locator('.check-btn').isDisabled(), 'Check disables again while a box is empty');
  await drawBox(wide, 0, word1[0]);
  await wide.waitForTimeout(1050);
  ok(await wide.locator('.lbox.filled').count() === word1.length, 'redrawn box re-fills');

  // submit
  const built2 = await builtBoxes(wide);
  await wide.locator('.check-btn').click();
  await wide.waitForTimeout(500);
  const verdict1 = (await wide.locator('.mastery .verdict').textContent().catch(() => ''))?.trim();
  console.log(`  submit: target="${word1}" built="${built2}" verdict="${verdict1}"`);
  ok(/master/i.test(verdict1 || ''), `Check graded the word ("${verdict1}")`);
  await wide.screenshot({ path: `${OUT}/w05-checked.png` });
  await wide.close();

  // ---------- WIDE keyboard fill → Check → master ----------
  console.log('\n=== WIDE keyboard fill → Check ===');
  const wkb = await newPage({ width: 1024, height: 820 });
  await gotoHome(wkb);
  await wkb.locator('.menu-card.mastery').click();
  await wkb.waitForSelector('.draw-boxes', { timeout: 8000 });
  await wkb.waitForTimeout(300);
  const curWord = await wkb.evaluate(() => window.__masteryCurrent?.word);
  const gemsBefore = +(await wkb.locator('.gem-count').first().textContent());
  await wkb.locator('.draw-controls button', { hasText: /Type it/ }).click();
  await wkb.waitForTimeout(120);
  ok(await wkb.locator('.type-keyboard').isVisible(), 'type mode: app keypad shown (no native input)');
  ok((await wkb.locator('.mastery input, .mastery textarea, .mastery [contenteditable]').count()) === 0, 'type mode: NO native text input (so no OS keyboard / suggestion strip)');
  ok(await wkb.locator('.draw-boxes').isVisible(), 'type mode (wide): boxes stay visible as the word display');
  for (const ch of curWord) await wkb.locator('.type-keyboard .key', { hasText: new RegExp(`^${ch}$`) }).first().click();
  await wkb.waitForTimeout(200);
  ok((await builtBoxes(wkb)) === curWord, `type: boxes filled left-to-right ("${curWord}")`);
  ok(!(await wkb.locator('.check-btn').isDisabled()), 'type: Check enabled once filled');
  await wkb.locator('.check-btn').click();
  await wkb.waitForTimeout(500);
  const verdict2 = (await wkb.locator('.mastery .verdict').textContent().catch(() => ''))?.trim();
  const gemsAfter = +(await wkb.locator('.gem-count').first().textContent());
  ok(/master/i.test(verdict2 || ''), `type+Check: "${curWord}" → "${verdict2}"`);
  ok(gemsAfter > gemsBefore, `type: gems rewarded (${gemsBefore} → ${gemsAfter})`);
  await wkb.screenshot({ path: `${OUT}/w06-typed-master.png` });
  await wkb.close();

  // ---------- NARROW (phone) ----------
  console.log('\n=== NARROW 390×780 (single-canvas) ===');
  const phone = await newPage({ width: 390, height: 780 });
  await gotoHome(phone);
  await phone.locator('.menu-card.mastery').click();
  await phone.waitForSelector('.draw-canvas', { timeout: 8000 });
  await phone.waitForTimeout(400);
  const p1 = await phone.evaluate(() => window.__masteryCurrent);
  ok(p1?.wide === false, `phone: narrow layout active (flag=${p1?.wide})`);
  ok(await phone.locator('.draw-canvas').isVisible() && !(await phone.locator('.draw-boxes').isVisible()), 'phone: single canvas shown, boxes hidden');
  ok(!(await phone.locator('.draw-submit').isVisible()), 'phone: no Check button (auto-checks on tap)');
  await noOverflow(phone, 'phone mastery');
  const pbox = await phone.locator('.draw-canvas').boundingBox();
  for (const s of shapesFor(p1.word[0])) await traceStroke(phone, pbox, s);
  await phone.waitForTimeout(1050);
  const cands = await phone.locator('.cand-letter').allTextContents();
  ok(cands.length > 0, `phone: drawing offers candidate letterforms [${cands.join(', ')}]`);
  await phone.screenshot({ path: `${OUT}/p01-phone-candidates.png` });
  await phone.close();

  console.log('\nISSUES:', issues.length ? issues : 'none');
  process.exitCode = issues.length ? 1 : 0;
} catch (e) {
  console.error('PROBE ERROR:', e.message);
  console.log('ISSUES so far:', issues);
  process.exitCode = 1;
} finally {
  await browser.close();
}
