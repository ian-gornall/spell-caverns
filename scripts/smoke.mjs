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
        await ts.nth(i).click({ timeout: 1500 });
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
  // The verdict text is now the (random) spoken phrase; the WRONG branch is pinned
  // by its deterministic chip ("The gem was…") + the revealed correct spelling.
  const verdict2 = (await page.locator('.verdict').textContent())?.trim();
  const chip2 = (await page.locator('.verdict-chip').textContent())?.trim();
  const revealed = await page.locator('.rhythm .tile.reveal').count();
  if (/gem was/i.test(chip2 || '')) ok(`wrong tap stayed gentle (phrase "${verdict2}", chip "${chip2}")`);
  else fail(`wrong tap not handled as a miss: verdict "${verdict2}", chip "${chip2}"`);
  if (revealed >= 1) ok('correct spelling was revealed on the wrong tap');
  else fail('correct spelling was not revealed after a wrong tap');

  // --- play out the rest of the wave to the reward screen ---
  // Click the CORRECT tile each time: deterministic and quick (correct advances
  // faster), so the loop reliably reaches the wave reward.
  for (let guard = 0; guard < 120; guard++) {
    if ((await page.locator('.reward').count()) > 0) break;
    const unlocked = await page.locator('.rhythm .tiles:not(.locked) .tile').count();
    if (unlocked > 0) {
      const c = await target();
      try {
        if (!c || !(await clickExact(c.word))) {
          await page.locator('.rhythm .tiles:not(.locked) .tile').first().click({ timeout: 1000 });
        }
      } catch {
        /* tiles locked mid-poll — retry next iteration */
      }
    }
    await page.waitForTimeout(250);
  }
  await page.waitForSelector('.reward', { timeout: 12000 });
  const rewardText = (await page.locator('.reward h2').textContent())?.trim();
  ok(`reached wave-complete reward: "${rewardText}"`);

  // --- reward keeps the loop going (Keep mining) ---
  await page.click('.reward .btn.primary');
  await page.waitForSelector('.rhythm .tile', { timeout: 5000 });
  ok('"Keep mining" started a fresh wave');

  // --- pre-generated TTS clip wiring: a clip is a valid, loadable MP3 in-browser ---
  const clipOk = await page.evaluate(async () => {
    try {
      const res = await fetch('/audio/manifest.json', { cache: 'no-cache' });
      if (!res.ok) return 'no manifest (' + res.status + ')';
      const m = await res.json();
      if (!m.phrases || !m.phrases.length) return 'manifest has no phrases yet';
      const s = m.phrases[0];
      const a = new Audio(`/audio/phrases/${s}.mp3`);
      return await new Promise((resolve) => {
        a.addEventListener('loadeddata', () => resolve('ok:' + s));
        a.addEventListener('error', () => resolve('error loading ' + s));
        a.load();
        setTimeout(() => resolve('timeout loading ' + s), 4000);
      });
    } catch (e) {
      return 'exc:' + e.message;
    }
  });
  if (/^ok:/.test(clipOk)) ok(`generated TTS clip loads + decodes in-browser (${clipOk})`);
  else fail(`TTS clip did not load: ${clipOk}`);

  // --- puzzle (build-the-word) mode: hear -> build from tiles -> gems + advance ---
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.click('.menu-card.craft');
  await page.waitForSelector('.puzzle .slot', { timeout: 5000 });
  const slotCount = await page.locator('.puzzle .slot').count();
  ok(`puzzle rendered ${slotCount} letter slots`);
  const pcur = await page.evaluate(() => window.__puzzleCurrent || null);
  if (!pcur || !pcur.word) fail('puzzle test hook (window.__puzzleCurrent) missing');
  const trayCount = await page.locator('.puzzle .tray-tile').count();
  if (pcur && trayCount >= pcur.word.length) ok(`tray has ${trayCount} tiles for "${pcur.word}"`);
  else fail(`tray too small: ${trayCount} tiles for "${pcur && pcur.word}"`);

  const pGemsBefore = await gemText();
  // Tap tray tiles in the word's letter order -> fills slots left-to-right; when the
  // last slot fills it auto-checks. Picking the first un-used tile per letter handles
  // repeated letters (the placed tile becomes .used and drops out of the selector).
  for (const ch of pcur.word) {
    await page.locator(`.puzzle .tray-tile:not(.used)[data-letter="${ch}"]`).first().click({ timeout: 2000 });
    await page.waitForTimeout(80);
  }
  await page.waitForFunction(
    (prev) => parseInt(document.querySelector('.gem-count')?.textContent || '0', 10) > prev,
    pGemsBefore,
    { timeout: 4000 },
  );
  const pGemsAfter = await gemText();
  ok(`built "${pcur.word}" from tiles -> gems mined (${pGemsBefore} -> ${pGemsAfter})`);
  await page.waitForFunction(
    (prev) => (window.__puzzleCurrent && window.__puzzleCurrent.index > prev) || !!document.querySelector('.reward'),
    pcur.index,
    { timeout: 4000 },
  );
  ok('puzzle advanced to the next word after a correct build');

  // --- crystal lab: invent -> spell -> draw -> name -> save a specimen ---
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.click('.menu-card.lab');
  await page.waitForSelector('.lab .lab-go', { timeout: 5000 });
  ok('crystal lab opened (invent step)');
  await page.click('.lab .lab-go'); // "Let's build it!"
  await page.waitForSelector('.lab .slot', { timeout: 5000 });
  const lcur = await page.evaluate(() => window.__labCurrent || null);
  if (!lcur || !lcur.word) fail('lab test hook (window.__labCurrent) missing');
  ok(`lab invented a nonsense word to spell: "${lcur.word}"`);
  for (const ch of lcur.word) {
    await page.locator(`.lab .tray-tile:not(.used)[data-letter="${ch}"]`).first().click({ timeout: 2000 });
    await page.waitForTimeout(60);
  }
  await page.waitForSelector('.lab-canvas', { timeout: 5000 });
  ok('spelled the crystal -> advanced to the draw step (canvas shown)');
  // draw a stroke (exercises the canvas pointer handlers)
  const cbox = await page.locator('.lab-canvas').boundingBox();
  await page.mouse.move(cbox.x + cbox.width * 0.3, cbox.y + cbox.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(cbox.x + cbox.width * 0.7, cbox.y + cbox.height * 0.65, { steps: 8 });
  await page.mouse.up();
  await page.click('.lab .lab-go'); // "Name it"
  await page.waitForSelector('.lab-name', { timeout: 4000 });
  await page.fill('.lab-name', 'Smoky Quartzite');
  await page.click('.lab .lab-go'); // "Save specimen"
  await page.waitForSelector('.lab-saved', { timeout: 4000 });
  const savedCount = await page.evaluate(() => (window.__labCurrent && window.__labCurrent.specimens) || 0);
  if (savedCount >= 1) ok(`specimen saved to the collection (count ${savedCount})`);
  else fail(`specimen was not saved (count ${savedCount})`);
  // and it shows up in Progress
  await page.click('.lab-saved .btn:nth-child(2)'); // "My collection" -> progress
  await page.waitForSelector('.specimen-grid .specimen', { timeout: 4000 });
  ok('specimen appears in the Progress collection');

  // --- feedback: rate + send (state.addFeedback) ---
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.click('.menu-card.feedback');
  await page.waitForSelector('.rating-row .rating', { timeout: 4000 });
  await page.locator('.rating-row .rating').nth(4).click(); // 🤩
  await page.locator('.seg button', { hasText: 'Just right' }).click();
  await page.fill('.feedback-note', 'Smoke test note');
  const fbLen = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem('crystal-spell-caverns:v1') || '{}').feedback?.length || 0);
  const fbBefore = await fbLen();
  await page.click('.feedback-send');
  await page.waitForSelector('.menu-card.play', { timeout: 4000 }); // returns home
  const fbAfter = await fbLen();
  if (fbAfter > fbBefore) ok(`feedback recorded to the log (${fbBefore} -> ${fbAfter})`);
  else fail(`feedback was not recorded (${fbBefore} -> ${fbAfter})`);

  // --- PWA: manifest valid + icons load + service worker registers (offline) ---
  const pwa = await page.evaluate(async () => {
    const out = {};
    try {
      const m = await (await fetch('/manifest.webmanifest')).json();
      out.name = m.name;
      out.icons = (m.icons || []).length;
      const checks = await Promise.all((m.icons || []).map((i) => fetch(i.src).then((r) => r.ok)));
      out.iconsOk = checks.every(Boolean);
    } catch (e) {
      out.err = String(e);
    }
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      out.sw = !!reg;
    } catch (e) {
      out.swErr = String(e);
    }
    return out;
  });
  if (pwa.name === 'Crystal Spell Caverns' && pwa.icons >= 2 && pwa.iconsOk) {
    ok(`PWA manifest valid (${pwa.name}, ${pwa.icons} icons load)`);
  } else fail(`manifest/icons problem: ${JSON.stringify(pwa)}`);
  if (pwa.sw) ok('service worker registered (offline cache active on localhost/HTTPS)');
  else fail(`service worker did not register: ${JSON.stringify(pwa)}`);

  // --- engagement: idle with no interaction -> nudge -> "Paused" overlay ---
  // Scale the idle thresholds way down (window.__idleTest) so this is quick. Use a
  // SEPARATE page so it doesn't perturb the main flow's default timings.
  const idlePage = await browser.newPage({ viewport: { width: 820, height: 1180 } });
  idlePage.on('pageerror', (e) => errors.push('pageerror(idle): ' + e.message));
  await idlePage.addInitScript(() => {
    window.__idleTest = 0.03; // 15s nudge -> ~450ms, 45s pause -> ~1350ms
  });
  await idlePage.goto(URL, { waitUntil: 'networkidle' });
  await idlePage.click('.menu-card.play');
  await idlePage.waitForSelector('.rhythm .tile', { timeout: 5000 });
  // deliberately do NOT interact -> the pause overlay must appear on its own
  await idlePage.waitForSelector('.pause-overlay', { timeout: 4000 });
  ok('idle with no interaction -> "Paused" overlay appeared (keeps kids on task)');
  await idlePage.click('.pause-overlay .btn.primary'); // Resume
  await idlePage.waitForSelector('.pause-overlay', { state: 'detached', timeout: 4000 });
  ok('tapping Resume dismissed the pause overlay');
  await idlePage.close();

  // --- engagement: staring at the MENU auto-starts mining ("let's go") ---
  const menuPage = await browser.newPage({ viewport: { width: 820, height: 1180 } });
  menuPage.on('pageerror', (e) => errors.push('pageerror(menu): ' + e.message));
  await menuPage.addInitScript(() => {
    window.__idleTest = 0.04; // home nudge ~520ms, auto-launch ~1280ms
  });
  await menuPage.goto(URL, { waitUntil: 'networkidle' });
  await menuPage.click('.home-title'); // a harmless tap unlocks audio so it WILL launch
  // now sit idle on the menu — it should highlight Play then drop into a wave on its own
  await menuPage.waitForSelector('.rhythm .tile', { timeout: 5000 });
  ok('idle on the home menu auto-started mining (Play) on its own');
  await menuPage.close();

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
