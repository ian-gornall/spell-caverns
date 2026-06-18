// scripts/qa_levels.mjs — verifies §21-B/C/D: the expanded 9-level select (onboarding +
// Settings) and that a HIGH chosen level actually drives the FIRST wave (no baby words).
import { chromium } from 'playwright';
const URL = process.env.URL || 'http://localhost:5173';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 820, height: 1180 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.goto(URL, { waitUntil: 'networkidle' });

// --- onboarding: welcome -> name -> colour -> LEVEL SELECT ---
await page.click('.onboard-go'); // Let's go
await page.waitForSelector('.onboard-name');
await page.fill('.onboard-name', 'Max');
await page.click('.onboard-go'); // That's me
await page.waitForSelector('.colour-swatch');
await page.click('.onboard-go'); // Perfect (keep default colour)
await page.waitForSelector('.level-grid');

const cardCount = await page.locator('.level-card').count();
const labels = await page.locator('.level-label').allTextContents();
console.log('level cards:', cardCount, '| labels:', labels.join(', '));
await page.screenshot({ path: 'scripts/qa/levels-onboarding.png' });
console.log('  📸 levels-onboarding.png');

// pick the HARDEST level (Expert = tier 9), then continue
await page.locator('.level-card').last().click();
await page.click('.onboard-go'); // Let's dig (first run -> sync step OR ready)
// first run shows the sync step; choose "Just this one"
const syncBtn = page.locator('button:has-text("Just this one")');
if (await syncBtn.count()) {
  await syncBtn.click();
}
await page.waitForSelector('button:has-text("Start digging")');
await page.click('button:has-text("Start digging")');

// --- first wave: the words served should reflect the EXPERT level (high tier) ---
await page.waitForFunction(() => window.__rhythmCurrent && window.__rhythmCurrent.word, null, { timeout: 8000 });
const words = [];
for (let i = 0; i < 5; i++) {
  const cur = await page.evaluate(() => window.__rhythmCurrent && window.__rhythmCurrent.word);
  if (cur && !words.includes(cur)) words.push(cur);
  // tap the correct tile to advance
  const tapped = await page.evaluate(() => {
    const w = window.__rhythmCurrent && window.__rhythmCurrent.word;
    const tile = [...document.querySelectorAll('.tile')].find((t) => t.textContent === w);
    if (tile) { tile.click(); return true; }
    return false;
  });
  await page.waitForTimeout(900);
}
// look up the tiers of those words from the live dataset
const tiers = await page.evaluate(async (ws) => {
  const { byRank } = await import('/src/engine/lexicon.js');
  const by = new Map(byRank().map((w) => [w.word, w.tier]));
  return ws.map((w) => ({ w, tier: by.get(w) ?? null }));
}, words);
console.log('first-wave words/tiers (Expert level):', JSON.stringify(tiers));
const minTier = Math.min(...tiers.map((t) => t.tier ?? 99));
console.log(minTier >= 6 ? '  ✅ first wave reflects the high level (no baby words)' : '  ❌ first wave still serving low-tier words');

// --- Settings: the new Starting level control renders with 9 cards ---
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForSelector('.home-sub', { timeout: 8000 }).catch(() => {});
// navigate to settings via the gear/Settings button
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => /settings|⚙/i.test(x.textContent));
  if (b) b.click();
});
await page.waitForSelector('.level-grid', { timeout: 8000 });
const setCards = await page.locator('.level-card').count();
const onLabel = await page.locator('.level-card.on .level-label').first().textContent().catch(() => '(none)');
console.log('settings level cards:', setCards, '| selected:', onLabel);
await page.screenshot({ path: 'scripts/qa/levels-settings.png', fullPage: true });
console.log('  📸 levels-settings.png');

console.log('console errors:', errors.length ? errors : 'none');
await browser.close();
