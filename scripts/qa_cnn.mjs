// scripts/qa_cnn.mjs — verify the §30 CNN draw-mode recognizer + the keyboard fallback.
// Draws several letter shapes (incl. the round a/c/o/s the old matcher confused) and checks
// the right letter lands in the candidates; then toggles to TYPE mode and spells the word.
// Run: npm start then: node scripts/qa_cnn.mjs   (URL env overrides the target)
import { chromium } from 'playwright';
const URL = process.env.URL || 'http://localhost:5173';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 820, height: 1180 } });
const issues = [];
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource.*\b404\b/.test(m.text())) issues.push('console.error: ' + m.text()); });
page.on('pageerror', (e) => issues.push('pageerror: ' + e.message));

const known = (w, i) => ({ word: w, tier: 1, pattern: 'short-a', rank: 50 + i, category: 'known', craftStreak: 2, craftAttempts: 2, craftCorrect: 2, order: i + 1 });
const SEED = {
  schema: 2, syncCode: null, syncConsent: false, parentPassword: null, activeId: 'c1',
  profiles: [{ id: 'c1', version: 1, profile: { name: 'Cnn', onboarded: true }, categories: { setSize: 10, level: 1, recent: [], order: 2, peakKnownish: 10, peakMastered: 0, words: ['cat'].map(known) } }],
};

// letter shapes as arrays of strokes; each stroke = [ [fx,fy], ... ] in canvas fractions
const circle = (cx, cy, r, n = 30, a0 = 0, a1 = 2 * Math.PI) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });
const seg = (x1, y1, x2, y2, n = 12) => Array.from({ length: n + 1 }, (_, i) => [x1 + (x2 - x1) * i / n, y1 + (y2 - y1) * i / n]);
const SHAPES = {
  o: [circle(0.5, 0.5, 0.3)],
  c: [circle(0.55, 0.5, 0.3, 26, Math.PI * 0.32, Math.PI * 1.68)],
  a: [circle(0.45, 0.55, 0.22), seg(0.67, 0.32, 0.67, 0.82)], // bowl + right stem
  s: [[[0.66, 0.28], [0.5, 0.22], [0.38, 0.32], [0.5, 0.46], [0.62, 0.56], [0.5, 0.72], [0.34, 0.7]]],
  l: [seg(0.5, 0.14, 0.5, 0.86)],
  v: [seg(0.2, 0.16, 0.5, 0.84), seg(0.5, 0.84, 0.8, 0.16)],
  t: [seg(0.5, 0.12, 0.5, 0.88), seg(0.3, 0.32, 0.7, 0.32)],
};

async function draw(box, strokes) {
  for (const s of strokes) {
    const pt = (f) => [box.x + f[0] * box.width, box.y + f[1] * box.height];
    const [sx, sy] = pt(s[0]);
    await page.mouse.move(sx, sy); await page.mouse.down();
    for (let i = 1; i < s.length; i++) { const [x, y] = pt(s[i]); await page.mouse.move(x, y, { steps: 2 }); }
    await page.mouse.up();
  }
}
const cands = () => page.locator('.cand-letter').allTextContents();

try {
  await page.addInitScript((s) => { try { localStorage.setItem('crystal-spell-caverns:v1', JSON.stringify(s)); } catch {} }, SEED);
  await page.goto(URL, { waitUntil: 'networkidle' });
  if (await page.locator('.profile-card:not(.add)').count()) await page.locator('.profile-card:not(.add)').first().click();
  await page.locator('.menu-card.mastery').click();
  await page.waitForSelector('.draw-canvas', { timeout: 8000 });
  const box = await page.locator('.draw-canvas').boundingBox();
  console.log('drawing letters (CNN warming up on first)…\n');
  let first = true;
  let hit = 0;
  let total = 0;
  for (const [letter, strokes] of Object.entries(SHAPES)) {
    await draw(box, strokes);
    await page.waitForTimeout(first ? 4000 : 1200); // first wait loads tf.min.js + model
    first = false;
    const cs = await cands();
    const top = cs[0] || '—';
    const inTop = cs.includes(letter);
    total += 1; if (inTop) hit += 1;
    console.log(`  drew '${letter}'  → top='${top}'  candidates=[${cs.join(', ')}]  ${inTop ? '✓ in top-4' : '✗ MISSING'}`);
    await page.locator('.btn.ghost', { hasText: 'Clear' }).first().click().catch(() => {});
    await page.waitForTimeout(200);
  }
  console.log(`\nrecognition: ${hit}/${total} letters had the right answer in the top-4`);

  // redraw an 'a' for a candidates screenshot to eyeball
  await draw(box, SHAPES.a);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'scripts/qa/cnn-01-draw-a.png' });
  console.log('  ↔ mastery scrollW=' + (await page.evaluate(() => document.documentElement.scrollWidth)) + '/' + (await page.evaluate(() => document.documentElement.clientWidth)));

  // keyboard fallback: toggle to type mode, type the word
  await page.locator('.btn.ghost', { hasText: 'Type it' }).first().click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'scripts/qa/cnn-02-type.png' });
  const word = await page.evaluate(() => window.__masteryCurrent?.word);
  await page.locator('.draw-type-input').fill(word);
  await page.waitForTimeout(600);
  const verdict = (await page.locator('.mastery .verdict').textContent())?.trim();
  console.log(`\nkeyboard fallback: typed "${word}" → verdict="${verdict}"  ${/master/i.test(verdict || '') ? '✓ mastered' : '✗'}`);
  console.log('ISSUES:', issues.length ? issues : 'none');
} catch (e) {
  console.error('PROBE ERROR:', e.message);
  console.log('ISSUES so far:', issues);
} finally {
  await browser.close();
}
