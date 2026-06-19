// scripts/qa_s30.mjs — SCRATCH visual-QA probe for the §30 CRAFT + MINING integration.
// Drives the live app like a player and screenshots each state into scripts/qa/ for a LOOK.
// Run: npm start (one terminal) then: node scripts/qa_s30.mjs
import { chromium } from 'playwright';
import { mkdir, rm } from 'node:fs/promises';

const URL = process.env.URL || 'http://localhost:5173';
const OUT = 'scripts/qa';
await rm(OUT, { recursive: true, force: true }).catch(() => {});
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 820, height: 1180 } });
const issues = [];
page.on('console', (m) => {
  const t = m.text();
  if (m.type() !== 'error') return;
  if (/Failed to load resource.*\b404\b/.test(t)) return; // audio-tail TTS fallback, expected
  issues.push('console.error: ' + t);
});
page.on('pageerror', (e) => issues.push('pageerror: ' + e.message));
page.on('response', (r) => {
  if (r.status() !== 404) return;
  const u = r.url();
  if (/\/audio\/(words|phrases)\/[^/]+\.mp3(\?|$)/.test(u)) return;
  if (/\/api\//.test(u)) return;
  issues.push('404: ' + u);
});
const shot = async (name) => { await page.screenshot({ path: `${OUT}/${name}.png` }); console.log('  📸 ' + name); };
const overflow = async (label) =>
  console.log(`  ↔ ${label} scrollW=${await page.evaluate(() => document.documentElement.scrollWidth)} client=${await page.evaluate(() => document.documentElement.clientWidth)}`);

try {
  // --- onboarding (fresh context) ---
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('.onboarding .onboard-go', { timeout: 6000 });
  await page.click('.onboard-go');
  await page.waitForSelector('.onboard-name', { timeout: 4000 });
  await page.fill('.onboard-name', 'Probe');
  await page.click('.onboard-go');
  await page.waitForSelector('.colour-grid .colour-swatch', { timeout: 4000 });
  await page.locator('.colour-swatch').nth(1).click();
  await page.click('.onboard-go'); // level select
  await page.waitForSelector('.level-card', { timeout: 4000 });
  await page.click('.onboard-go'); // -> sync step
  await page.waitForSelector('text=Just this one', { timeout: 4000 });
  await page.click('text=Just this one');
  await page.waitForSelector('.onboard-go.big', { timeout: 4000 });
  await page.click('.onboard-go.big'); // -> firstRun wave
  await page.waitForSelector('.rhythm .tile', { timeout: 6000 });
  console.log('✓ onboarding -> first-run wave');

  // back to home
  await page.goto(URL, { waitUntil: 'networkidle' });
  if (await page.locator('.profile-card:not(.add)').count()) {
    await page.locator('.profile-card:not(.add)').first().click();
  }
  await page.waitForSelector('.menu-card.craft', { timeout: 6000 });
  await shot('01-home');
  await overflow('home');

  // --- CRAFT mode ---
  await page.click('.menu-card.craft');
  await page.waitForSelector('.puzzle .slot', { timeout: 8000 });
  const cur = await page.evaluate(() => window.__puzzleCurrent || null);
  console.log('✓ craft target:', cur && cur.word);
  await shot('02-craft-start');
  await overflow('craft');

  // hint highlight: wait past 4s with no correct letter -> the hint button should glow
  await page.waitForTimeout(4600);
  const glow = await page.locator('.btn.ghost.hint-ready').count();
  console.log(glow ? '✓ hint button highlighted @~4s (hint-ready)' : '✗ hint NOT highlighted @4s');
  await shot('03-hint-highlight');

  // tap the hint -> reveals one (locked) correct letter
  await page.click('.puzzle .puzzle-controls .btn.ghost:has-text("Hint")').catch(async () => {
    await page.locator('.puzzle-controls .btn.ghost').first().click();
  });
  await page.waitForTimeout(300);
  const lockedAfterHint = await page.locator('.puzzle .slot.locked').count();
  console.log(`✓ after hint: ${lockedAfterHint} locked (revealed) slot(s)`);
  await shot('04-after-hint');

  // auto-fire: wait past 8s of no correct letter from the last reset -> a hint auto-reveals
  await page.waitForTimeout(8600);
  const lockedAfterAuto = await page.locator('.puzzle .slot.locked').count();
  console.log(`✓ after ~8s idle: ${lockedAfterAuto} locked slot(s) (auto-fire should add one)`);
  await shot('05-after-autofire');

  // finish the word: place the remaining correct letters by clicking matching tray tiles
  const word = cur.word;
  for (let i = 0; i < word.length; i++) {
    const need = word[i];
    // skip if this slot is already correct/locked
    const placed = await page.evaluate((idx) => {
      const s = document.querySelectorAll('.puzzle .slot')[idx];
      return s ? s.textContent : '';
    }, i);
    if (placed && placed.toLowerCase() === need) continue;
    const tile = page.locator(`.puzzle .tray .tray-tile:not(.used)[data-letter="${need}"]`).first();
    if (await tile.count()) await tile.click().catch(() => {});
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(600);
  await shot('06-craft-solved');
  const gem = (await page.locator('.gem-count').first().textContent())?.trim();
  console.log('✓ gems after craft:', gem);

  // --- MINING gate (fresh profile: nothing known yet) ---
  await page.goto(URL, { waitUntil: 'networkidle' });
  if (await page.locator('.profile-card:not(.add)').count()) {
    await page.locator('.profile-card:not(.add)').first().click();
  }
  await page.waitForSelector('.menu-card.play', { timeout: 6000 });
  await page.click('.menu-card.play');
  await page.waitForSelector('.rhythm', { timeout: 6000 });
  await page.waitForTimeout(400);
  const gateText = (await page.locator('.rhythm .sentence').textContent())?.trim();
  const hasGateBtn = await page.locator('.rhythm .btn.primary').count();
  console.log(`✓ mining (no known words) gate: "${gateText}" · craft-CTA=${hasGateBtn}`);
  await shot('07-mining-gate');
  await overflow('mining-gate');

  console.log('\nISSUES:', issues.length ? issues : 'none');
} catch (e) {
  console.error('PROBE ERROR:', e.message);
  await shot('99-error');
  console.log('ISSUES so far:', issues);
} finally {
  await browser.close();
}
