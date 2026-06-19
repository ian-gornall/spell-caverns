// scripts/qa_mastery.mjs — SCRATCH visual-QA probe for the §30 MASTERY (draw) mode.
// Seeds a mastery-unlocked profile, traces letter shapes on the canvas, checks the
// recognizer offers the right letterforms, and drives the full draw→pick→master flow.
// Run: npm start (one terminal) then: node scripts/qa_mastery.mjs
import { chromium } from 'playwright';
import { mkdir, rm } from 'node:fs/promises';

const URL = process.env.URL || 'http://localhost:5173';
const OUT = 'scripts/qa';
await rm(OUT, { recursive: true, force: true }).catch(() => {});
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const VIEW = { width: +(process.env.W || 820), height: +(process.env.H || 1180) };
const page = await browser.newPage({ viewport: VIEW });
const issues = [];
page.on('console', (m) => {
  const t = m.text();
  if (m.type() !== 'error') return;
  if (/Failed to load resource.*\b404\b/.test(t)) return;
  issues.push('console.error: ' + t);
});
page.on('pageerror', (e) => issues.push('pageerror: ' + e.message));
const shot = async (n) => { await page.screenshot({ path: `${OUT}/${n}.png` }); console.log('  📸 ' + n); };

// seed a profile with KNOWN words so mastery is unlocked (peakKnownish>=setSize) and the
// session is exactly the word we want to draw.
const known = (w, i) => ({ word: w, tier: 1, pattern: 'short-o', rank: 50 + i, category: 'known', craftStreak: 2, craftAttempts: 2, craftCorrect: 2, order: i + 1 });
const SEED = {
  schema: 2, syncCode: null, syncConsent: false, parentPassword: null, activeId: 'm1',
  profiles: [{
    id: 'm1', version: 1, profile: { name: 'Drawer', onboarded: true },
    categories: { setSize: 10, level: 1, recent: [], order: 2, peakKnownish: 10, peakMastered: 0, words: ['lot'].map(known) },
  }],
};

// canvas-fraction shapes for the letters we trace (rough but clear)
function fracPath(kind) {
  const P = [];
  if (kind === 'o') for (let i = 0; i <= 32; i++) { const a = (i / 32) * 2 * Math.PI; P.push([0.5 + 0.28 * Math.cos(a), 0.5 + 0.36 * Math.sin(a)]); }
  if (kind === 'l') for (let i = 0; i <= 16; i++) P.push([0.5, 0.14 + (0.72 * i) / 16]);
  if (kind === 'c') for (let i = 0; i <= 28; i++) { const a = Math.PI * (0.32 + (1.36 * i) / 28); P.push([0.5 + 0.28 * Math.cos(a), 0.5 + 0.36 * Math.sin(a)]); }
  return P;
}
// 't' is two strokes (stem + crossbar)
const tStrokes = () => [
  Array.from({ length: 17 }, (_, i) => [0.5, 0.12 + (0.76 * i) / 16]),
  Array.from({ length: 13 }, (_, i) => [0.3 + (0.4 * i) / 12, 0.3]),
];

async function traceStroke(box, fracPts) {
  const pt = (f) => [box.x + f[0] * box.width, box.y + f[1] * box.height];
  const [sx, sy] = pt(fracPts[0]);
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  for (let i = 1; i < fracPts.length; i++) { const [x, y] = pt(fracPts[i]); await page.mouse.move(x, y, { steps: 2 }); }
  await page.mouse.up();
}
async function drawLetter(box, strokes) {
  for (const s of strokes) await traceStroke(box, s);
}
const candLetters = async () => page.locator('.cand-letter').allTextContents();

try {
  await page.addInitScript((seed) => {
    try { localStorage.setItem('crystal-spell-caverns:v1', JSON.stringify(seed)); } catch {}
  }, SEED);

  // home: the Mastery card should be present (unlocked)
  await page.goto(URL, { waitUntil: 'networkidle' });
  if (await page.locator('.profile-card:not(.add)').count()) await page.locator('.profile-card:not(.add)').first().click();
  await page.waitForSelector('.menu-card', { timeout: 6000 });
  const hasMastery = await page.locator('.menu-card.mastery').count();
  console.log(hasMastery ? '✓ Mastery card shown on home (unlocked)' : '✗ Mastery card MISSING');
  await shot('m01-home');

  await page.locator('.menu-card.mastery').click();
  await page.waitForSelector('.draw-canvas', { timeout: 8000 });
  await page.waitForTimeout(400); // let templates build
  const word = await page.evaluate(() => window.__masteryCurrent?.word);
  console.log('✓ mastery word:', word);
  await shot('m02-start');
  const box = await page.locator('.draw-canvas').boundingBox();

  // recognition smoke: draw o / l / c in isolation and report candidates
  const tryShape = async (label, strokes) => {
    await drawLetter(box, strokes);
    await page.locator('.draw-read').click();
    await page.waitForTimeout(150);
    const cs = await candLetters();
    console.log(`  ✎ drew ${label} → candidates: [${cs.join(', ')}]  ${cs.includes(label) ? '✓ correct offered' : '✗'}`);
    return cs;
  };
  await shot('m03-before-read');
  // draw the full word "lot": l, o, t — pick the correct candidate each time
  const plan = [['l', [fracPath('l')]], ['o', [fracPath('o')]], ['t', tStrokes()]];
  for (const [letter, strokes] of plan) {
    await drawLetter(box, strokes);
    await page.locator('.draw-read').click();
    await page.waitForTimeout(150);
    const cs = await candLetters();
    console.log(`  ✎ ${letter} → [${cs.join(', ')}] ${cs.includes(letter) ? '✓' : '✗ (tapping first to continue)'}`);
    await shot(`m04-cand-${letter}`);
    const pick = cs.includes(letter) ? letter : cs[0];
    if (pick) await page.locator('.cand-letter', { hasText: new RegExp(`^${pick}$`) }).first().click();
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(400);
  const verdict = (await page.locator('.mastery .verdict').textContent())?.trim();
  const gem = (await page.locator('.gem-count').first().textContent())?.trim();
  console.log(`✓ after spelling: verdict="${verdict}" gems=${gem}`);
  await shot('m05-result');

  // overflow + gate
  console.log('  ↔ scrollW=' + (await page.evaluate(() => document.documentElement.scrollWidth)) + ' client=' + (await page.evaluate(() => document.documentElement.clientWidth)));

  // gate: a fresh profile (no known words) → no Mastery card + direct nav shows locked
  await page.evaluate(() => localStorage.removeItem('crystal-spell-caverns:v1'));
  console.log('\nISSUES:', issues.length ? issues : 'none');
} catch (e) {
  console.error('PROBE ERROR:', e.message);
  await shot('m99-error');
  console.log('ISSUES so far:', issues);
} finally {
  await browser.close();
}
