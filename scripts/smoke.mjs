// scripts/smoke.mjs — Playwright smoke test of the UI in a REAL browser.
//
// Per repo tooling (UX.md §9): the pure engine is covered by `node --test`; the
// browser-only UI is verified here. We drive the actual app: load -> home -> Play
// -> a rhythm round accepts a CORRECT tap (gems go up, positive praise) and a
// WRONG tap (gentle "Try again", correct spelling revealed) -> the loop advances
// to the wave-complete reward. Any console/page error fails the run. Saves a
// screenshot to scripts/smoke.png.
//
// Run: node scripts/smoke.mjs   (server must be running: npm start)
import { chromium } from 'playwright';

const URL = process.env.URL || 'http://localhost:5173';
const errors = [];

function fail(msg) {
  console.error('❌ ' + msg);
  process.exitCode = 1;
}
function ok(msg) {
  console.log('✅ ' + msg);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 820, height: 1180 } }); // iPad-ish portrait

page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console.error: ' + m.text());
});
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

try {
  await page.goto(URL, { waitUntil: 'networkidle' });

  // --- home ---
  await page.waitForSelector('.menu-card.play', { timeout: 5000 });
  ok('home screen rendered (Play card present)');

  // --- start a wave ---
  await page.click('.menu-card.play');
  await page.waitForSelector('.rhythm .tile', { timeout: 5000 });
  const tileCount = await page.locator('.rhythm .tile').count();
  if (tileCount >= 3) ok(`rhythm round rendered ${tileCount} answer tiles`);
  else fail(`expected >=3 tiles, got ${tileCount}`);

  const sentence = (await page.locator('.sentence').textContent())?.trim();
  if (sentence && sentence.includes('_')) ok(`blanked sentence shown: "${sentence}"`);
  else fail(`sentence missing its blank: "${sentence}"`);

  // helper: read the current target word from the off-DOM test hook
  const target = async () => (await page.evaluate(() => window.__rhythmCurrent || null));
  const gemText = async () => parseInt((await page.locator('.gem-count').first().textContent()) || '0', 10);

  // --- a CORRECT tap: click the tile whose text EXACTLY equals the target word ---
  let cur = await target();
  const gemsBefore = await gemText();
  const clickExact = async (word) => {
    const ts = page.locator('.rhythm .tile');
    const c = await ts.count();
    for (let i = 0; i < c; i++) {
      if ((await ts.nth(i).textContent())?.trim() === word) {
        await ts.nth(i).click();
        return true;
      }
    }
    return false;
  };
  if (!(await clickExact(cur.word))) fail(`no tile matched the target word "${cur.word}"`);
  await page.waitForTimeout(250);
  const verdict1 = (await page.locator('.verdict').textContent())?.trim();
  const gemsAfter = await gemText();
  if (gemsAfter > gemsBefore) ok(`correct tap mined gems (${gemsBefore} -> ${gemsAfter}), praise "${verdict1}"`);
  else fail(`gems did not increase after correct tap (${gemsBefore} -> ${gemsAfter}); verdict "${verdict1}"`);

  // wait for advance to the next word
  await page.waitForFunction((prev) => window.__rhythmCurrent && window.__rhythmCurrent.index > prev, cur.index, { timeout: 4000 });
  ok('loop advanced to the next word after correct tap');

  // --- a WRONG tap: click a tile whose text != the target word ---
  cur = await target();
  const tiles = page.locator('.rhythm .tile');
  const n = await tiles.count();
  let wrongClicked = false;
  for (let i = 0; i < n; i++) {
    const txt = (await tiles.nth(i).textContent())?.trim();
    if (txt !== cur.word) {
      await tiles.nth(i).click();
      wrongClicked = true;
      break;
    }
  }
  if (!wrongClicked) fail('could not find a wrong tile to click');
  await page.waitForTimeout(250);
  const verdict2 = (await page.locator('.verdict').textContent())?.trim();
  const revealed = await page.locator('.rhythm .tile.reveal').count();
  if (/try again/i.test(verdict2 || '')) ok(`wrong tap stayed gentle: "${verdict2}"`);
  else fail(`wrong tap verdict not gentle: "${verdict2}"`);
  if (revealed >= 1) ok('correct spelling was revealed on the wrong tap');
  else fail('correct spelling was not revealed after a wrong tap');

  // --- play out the rest of the wave to the reward screen ---
  for (let guard = 0; guard < 40; guard++) {
    const reward = await page.locator('.reward').count();
    if (reward > 0) break;
    const live = await page.locator('.rhythm .tiles:not(.locked) .tile').count();
    if (live > 0) {
      await page.locator('.rhythm .tiles:not(.locked) .tile').first().click();
    }
    await page.waitForTimeout(300);
  }
  await page.waitForSelector('.reward', { timeout: 8000 });
  const rewardText = (await page.locator('.reward h2').textContent())?.trim();
  ok(`reached wave-complete reward: "${rewardText}"`);

  // --- reward keeps the loop going (Keep mining) ---
  await page.click('.reward .btn.primary');
  await page.waitForSelector('.rhythm .tile', { timeout: 5000 });
  ok('"Keep mining" started a fresh wave');

  await page.screenshot({ path: 'scripts/smoke.png', fullPage: false });
  ok('screenshot saved to scripts/smoke.png');
} catch (e) {
  fail('exception: ' + (e && e.stack ? e.stack : e));
} finally {
  if (errors.length) {
    console.error('\n--- page/console errors ---');
    errors.forEach((e) => console.error('  ' + e));
    process.exitCode = 1;
  }
  await browser.close();
  console.log(process.exitCode ? '\nSMOKE FAILED' : '\nSMOKE PASSED');
}
