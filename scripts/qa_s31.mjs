// scripts/qa_s31.mjs — visual-QA probe for the §31 Mastery upgrades:
//   A. whole-word multi-box writing on WIDE screens (one mini-canvas per letter)
//   B. dictation toggle (sentence hidden + peekable)
//   C. mastery-first nudging (home card pulse + reward CTAs)
// Seeds a mastery-unlocked profile with a few KNOWN words (so recommendNext → mastery),
// then exercises WIDE (boxes) + dictation + the keyboard fill, and the NARROW (single-canvas)
// fallback. Run: npm start (one terminal) then: node scripts/qa_s31.mjs
import { chromium } from 'playwright';
import { mkdir, rm } from 'node:fs/promises';

const URL = process.env.URL || 'http://localhost:5173';
const OUT = 'scripts/qa_s31';
await rm(OUT, { recursive: true, force: true }).catch(() => {});
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const issues = [];
const ok = (c, m) => console.log((c ? '✓ ' : '✗ ') + m) || (!c && issues.push(m));

// seed: KNOWN words drawn from the {l,o,c,t} shapes the probe can trace, mastery unlocked.
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

function fracPath(kind) {
  const P = [];
  if (kind === 'o') for (let i = 0; i <= 32; i++) { const a = (i / 32) * 2 * Math.PI; P.push([0.5 + 0.28 * Math.cos(a), 0.5 + 0.36 * Math.sin(a)]); }
  if (kind === 'l') for (let i = 0; i <= 16; i++) P.push([0.5, 0.14 + (0.72 * i) / 16]);
  if (kind === 'c') for (let i = 0; i <= 28; i++) { const a = Math.PI * (0.32 + (1.36 * i) / 28); P.push([0.5 + 0.28 * Math.cos(a), 0.5 + 0.36 * Math.sin(a)]); }
  return [P];
}
const tStrokes = () => [
  Array.from({ length: 17 }, (_, i) => [0.5, 0.12 + (0.76 * i) / 16]),
  Array.from({ length: 13 }, (_, i) => [0.3 + (0.4 * i) / 12, 0.3]),
];
const shapesFor = (letter) => (letter === 't' ? tStrokes() : fracPath(letter));

async function traceStroke(page, box, fracPts) {
  const pt = (f) => [box.x + f[0] * box.width, box.y + f[1] * box.height];
  const [sx, sy] = pt(fracPts[0]);
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  for (let i = 1; i < fracPts.length; i++) { const [x, y] = pt(fracPts[i]); await page.mouse.move(x, y, { steps: 2 }); }
  await page.mouse.up();
}
async function drawInBox(page, boxEl, letter) {
  const box = await boxEl.boundingBox();
  for (const s of shapesFor(letter)) await traceStroke(page, box, s);
}

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
  // §31.C home nudge
  ok(await wide.locator('.menu-card.mastery.nudge').count() > 0, 'home: Mastery card has the .nudge pulse');
  const badge = (await wide.locator('.menu-card.mastery .badge').textContent())?.trim();
  ok(/master these/i.test(badge || ''), `home: Mastery badge nudges ("${badge}")`);
  await wide.screenshot({ path: `${OUT}/w01-home-nudge.png` });

  await wide.locator('.menu-card.mastery').click();
  await wide.waitForSelector('.draw-boxes', { timeout: 8000 });
  await wide.waitForTimeout(400);
  const w1 = await wide.evaluate(() => window.__masteryCurrent);
  ok(w1?.wide === true, `mastery: wide layout active (flag=${w1?.wide})`);
  const boxesVisible = await wide.locator('.draw-boxes').isVisible();
  const canvasVisible = await wide.locator('.draw-canvas').isVisible();
  ok(boxesVisible && !canvasVisible, `mastery: boxes shown, single-canvas hidden (boxes=${boxesVisible} canvas=${canvasVisible})`);
  const nBoxes = await wide.locator('.lbox').count();
  ok(nBoxes === (w1?.word || '').length, `mastery: ${nBoxes} boxes == "${w1?.word}".length`);
  await wide.screenshot({ path: `${OUT}/w02-boxes.png` });
  await noOverflow(wide, 'wide mastery');

  // §31.B dictation toggle
  await wide.locator('.draw-controls button', { hasText: /Dictation/ }).click();
  await wide.waitForTimeout(150);
  ok(!(await wide.locator('.mastery .sentence').isVisible()), 'dictation ON → sentence hidden');
  ok(await wide.locator('.peek-row').isVisible(), 'dictation ON → Peek button shown');
  await wide.screenshot({ path: `${OUT}/w03-dictation.png` });
  await wide.locator('.peek-btn').click();
  await wide.waitForTimeout(150);
  ok(await wide.locator('.mastery .sentence').isVisible(), 'Peek → sentence revealed');
  await wide.locator('.draw-controls button', { hasText: /Show sentence/ }).click(); // dictation OFF
  await wide.waitForTimeout(150);

  // §31.A DRAW mechanism: write each letter into its own box, free order, auto-fill.
  const word1 = w1.word;
  for (let i = 0; i < word1.length; i++) {
    await drawInBox(wide, wide.locator('.lbox-canvas').nth(i), word1[i]);
    await wide.waitForTimeout(1050); // per-box auto-recognise debounce
  }
  await wide.waitForTimeout(400);
  const filled1 = await wide.locator('.lbox.filled').count();
  const built1 = (await wide.locator('.lbox-letter').allTextContents()).join('');
  ok(filled1 > 0, `draw: boxes auto-filled from handwriting (${filled1}/${word1.length}, built="${built1}")`);
  const verdict1 = (await wide.locator('.mastery .verdict').textContent().catch(() => ''))?.trim();
  console.log(`  draw result: target="${word1}" built="${built1}" verdict="${verdict1}"`);
  await wide.screenshot({ path: `${OUT}/w04-drawn.png` });
  await wide.close();

  // §31.A keyboard fill (deterministic master) — fresh page so the draw test's auto-advance
  // can't race this. Type the current word into the boxes (typing fills them left-to-right).
  console.log('\n=== WIDE keyboard fill → master ===');
  const wkb = await newPage({ width: 1024, height: 820 });
  await gotoHome(wkb);
  await wkb.locator('.menu-card.mastery').click();
  await wkb.waitForSelector('.draw-boxes', { timeout: 8000 });
  await wkb.waitForTimeout(300);
  const curWord = await wkb.evaluate(() => window.__masteryCurrent?.word);
  const gemsBefore = +(await wkb.locator('.gem-count').first().textContent());
  await wkb.locator('.draw-controls button', { hasText: /Type it/ }).click();
  await wkb.waitForTimeout(120);
  ok(await wkb.locator('.draw-type-input').isVisible(), 'type mode: keyboard input shown');
  ok(await wkb.locator('.draw-boxes').isVisible(), 'type mode (wide): boxes stay visible as the word display');
  await wkb.locator('.draw-type-input').fill(curWord);
  await wkb.waitForTimeout(600);
  const builtKb = (await wkb.locator('.lbox-letter').allTextContents()).join('');
  const verdict2 = (await wkb.locator('.mastery .verdict').textContent().catch(() => ''))?.trim();
  const gemsAfter = +(await wkb.locator('.gem-count').first().textContent());
  ok(builtKb === curWord, `type: boxes filled left-to-right ("${builtKb}")`);
  ok(/master/i.test(verdict2 || ''), `type: word "${curWord}" → "${verdict2}"`);
  ok(gemsAfter > gemsBefore, `type: gems rewarded (${gemsBefore} → ${gemsAfter})`);
  await wkb.screenshot({ path: `${OUT}/w05-typed-master.png` });
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
  await noOverflow(phone, 'phone mastery');
  // draw one letter → the up-to-4 candidate letterforms appear (phone flow intact)
  await drawInBox(phone, phone.locator('.draw-canvas'), p1.word[0]);
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
