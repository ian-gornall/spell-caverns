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
  if (m.type() !== 'error') return;
  const t = m.text();
  // EXPECTED + handled: only ~1678/2949 audio clips ship, so dictating a word whose clip
  // isn't in the shipped subset makes the browser log a generic resource-load 404 while the
  // app silently falls back to TTS (see audio.js ensureManifest/self-heal). The response
  // listener below is the authoritative 404 check (it fails only on NON-audio misses), so
  // drop the generic resource-load console noise here.
  if (/Failed to load resource.*\b404\b/.test(t)) return;
  errors.push('console.error: ' + t);
});
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
// Authoritative 404 check: a missing pre-generated audio clip is the documented audio-tail
// gap (TTS fallback covers it). ANY OTHER 404 (JS/CSS/icon/manifest) is a real bug -> fail.
page.on('response', (r) => {
  if (r.status() !== 404) return;
  const u = r.url();
  if (/\/audio\/(words|phrases)\/[^/]+\.mp3(\?|$)/.test(u)) return; // audio-tail gap, tolerated
  // /api/* (sync, feedback, push) are Cloudflare Worker routes that don't exist on the local
  // static dev server (server.js). The client treats them as best-effort + queues on failure,
  // so a local 404 here is expected; only flag missing STATIC assets as real bugs.
  if (/\/api\//.test(u)) return;
  errors.push('404 (real missing asset): ' + u);
});

// §28.D: boot ALWAYS routes to the "Who's playing?" picker for any profile count >= 1.
// If the picker is showing on page `p`, select the (only) explorer to land on home.
async function dismissPicker(p) {
  await p.waitForSelector('.menu-card.play, .profile-card', { timeout: 5000 });
  if (await p.locator('.profile-card:not(.add)').count()) {
    await p.locator('.profile-card:not(.add)').first().click();
    await p.waitForSelector('.menu-card.play', { timeout: 5000 });
  }
}
// Reload the main page and land on home (through the picker).
async function gotoHome() {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await dismissPicker(page);
}

try {
  // --- first-run onboarding (mascot + name + colour + guaranteed-win wave) ---
  // A fresh browser context has no save, so the boot routes to onboarding. Walk it
  // once: this verifies the flow AND persists profile.onboarded so the rest of the
  // smoke starts from a normal home.
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('.onboarding .onboard-go', { timeout: 5000 });
  // §32.B: first run opens with a "Tap to start" audio gate — dismiss it to reach welcome.
  if (await page.locator('.tap-to-start').count()) {
    await page.click('.tap-to-start');
    await page.waitForSelector('.onboarding .onboard-go:not(.tap-to-start)', { timeout: 4000 });
  }
  ok('first run shows the onboarding welcome (Geo the mascot)');
  await page.click('.onboard-go'); // -> name
  await page.waitForSelector('.onboard-name', { timeout: 4000 });
  await page.fill('.onboard-name', 'Explorer');
  await page.click('.onboard-go'); // -> colour
  await page.waitForSelector('.colour-grid .colour-swatch', { timeout: 4000 });
  await page.locator('.colour-swatch').nth(1).click();
  await page.click('.onboard-go'); // -> §C1 AGE step (replaces the age-labelled level picker)
  await page.waitForSelector('.age-grid .age-btn', { timeout: 4000 });
  const ageBtns = await page.locator('.age-grid .age-btn').count();
  if (ageBtns === 9) ok('onboarding asks the age (9 buttons, 5–13) instead of a level picker');
  else fail(`age step expected 9 buttons, got ${ageBtns}`);
  await page.click('.age-grid .age-btn:nth-child(3)'); // age 7
  await page.click('.onboard-go.level-cta'); // "Let's dig!" -> family-sync step (first run)
  await page.waitForSelector('text=Just this one', { timeout: 4000 });
  await page.click('text=Just this one'); // skip sync -> reminder? -> ready (creates the profile)
  if (await page.locator('text=Maybe later').count()) await page.click('text=Maybe later'); // skip the reminder opt-in
  await page.waitForSelector('.onboard-go.big', { timeout: 4000 });
  await page.click('.onboard-go.big'); // "Start digging!" -> §C1 placement diagnostic (Craft, NOT locked Mining)

  // helper: read the current gem count (used here + in the puzzle section below)
  const gemText = async () => parseInt((await page.locator('.gem-count').first().textContent()) || '0', 10);

  // §C1/D1: the FIRST activity is the placement diagnostic, played as ORDINARY Craft so the
  // child never knows it's different (D1: no longer drops into locked Mining). Verify it runs
  // in placement mode, then drive the ±100 walk to completion — a clean build on short words, a
  // hinted "miss" on longer ones — so the explorer is PLACED at a cavern band before continuing.
  await page.waitForSelector('.screen.puzzle .slot', { timeout: 6000 });
  const diag0 = await page.evaluate(() => window.__puzzleCurrent || null);
  if (diag0 && diag0.placement) ok('first run launches the placement diagnostic (Craft, not locked Mining)');
  else fail(`first activity not in placement mode: ${JSON.stringify(diag0)}`);
  const diagGemsBefore = await gemText();
  let hintedWord = null;
  // §C1: the diagnostic spans MULTIPLE 6-word sessions — keep playing (clicking "Craft again"
  // between sessions) until the profile is PLACED (3 misses in one band).
  const isPlaced = () => page.evaluate(() => {
    const c = JSON.parse(localStorage.getItem('crystal-spell-caverns:v1'));
    const p = c.profiles.find((x) => x.id === c.activeId);
    return !!(p.placement && p.placement.done);
  });
  for (let guard = 0; guard < 80; guard++) {
    if (await isPlaced()) break;
    if ((await page.locator('.reward').count()) > 0) { // between-session reward → continue
      await page.locator('.reward .btn.primary').first().click();
      await page.waitForSelector('.screen.puzzle .slot, .reward', { timeout: 6000 }).catch(() => {});
      await page.waitForTimeout(300);
      continue;
    }
    const c = await page.evaluate(() => window.__puzzleCurrent || null);
    if (!c || !c.word) {
      await page.waitForTimeout(150);
      continue;
    }
    if (c.word.length > 5 && hintedWord !== c.word) {
      hintedWord = c.word;
      const h = page.locator('.puzzle-controls .btn.ghost').first();
      if (await h.count()) await h.click(); // a hinted build = NOT a clean build = a "miss"
    }
    // fill empty slots in index order, skipping filled (hint-locked) ones so placement stays aligned
    await page.evaluate(() => {
      const w = window.__puzzleCurrent?.word;
      if (!w) return;
      for (let p = 0; p < w.length; p++) {
        const slot = document.querySelectorAll('.slots .slot')[p];
        if (slot && slot.classList.contains('filled')) continue;
        const t = [...document.querySelectorAll('.tray-tile')].find((x) => !x.classList.contains('used') && x.textContent === w[p]);
        if (t) t.click();
      }
    });
    await page.waitForTimeout(900);
  }
  const placed = await page.evaluate(() => {
    const c = JSON.parse(localStorage.getItem('crystal-spell-caverns:v1'));
    const p = c.profiles.find((x) => x.id === c.activeId);
    return { done: p.placement && p.placement.done, band: p.categories && p.categories.level };
  });
  if (placed.done === true && placed.band >= 1)
    ok(`placement diagnostic placed the explorer at cavern level ${placed.band} (gems +${(await gemText()) - diagGemsBefore})`);
  else fail(`placement not finalised: ${JSON.stringify(placed)}`);

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

  // --- §30 mining GATE: a fresh profile has no KNOWN words yet, so the Practice (mining)
  //     card steers to Craft (the always-open assessment) instead of an empty mine. ---
  await gotoHome();
  await page.click('.menu-card.play');
  await page.waitForSelector('.rhythm', { timeout: 5000 });
  await page.waitForTimeout(300);
  const gateCta = await page.locator('.rhythm .btn.primary').count();
  const minableTiles = await page.locator('.rhythm .tile').count();
  if (gateCta >= 1 && minableTiles === 0) ok('mining gated until words are known — steers to Craft (§30)');
  else fail(`mining gate missing: craft-cta=${gateCta}, tiles=${minableTiles}`);

  // --- puzzle (build-the-word) mode: hear -> build from tiles -> gems + advance ---
  await gotoHome();
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
  await gotoHome();
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
  await gotoHome();
  await page.click('.menu-card.feedback');
  await page.waitForSelector('.rating-row .rating', { timeout: 4000 });
  await page.locator('.rating-row .rating').nth(4).click(); // 🤩
  await page.locator('.seg button', { hasText: 'Just right' }).click();
  await page.fill('.feedback-note', 'Smoke test note');
  const fbLen = () =>
    page.evaluate(() => {
      const c = JSON.parse(localStorage.getItem('crystal-spell-caverns:v1') || '{}');
      if (Array.isArray(c.profiles)) {
        const p = c.profiles.find((x) => x.id === c.activeId) || c.profiles[0] || {};
        return (p.feedback || []).length;
      }
      return c.feedback?.length || 0; // legacy single-blob fallback
    });
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
    try {
      const KEY = 'crystal-spell-caverns:v1';
      // §30: mining is gated until [set size] words are MASTERED, so seed a profile with a few
      // MASTERED words + the mastered high-water so the Practice wave is playable + the overlay fires.
      const mastered = (w, i) => ({ word: w, tier: 1, pattern: 'short-a', rank: 50 + i, category: 'mastered', craftStreak: 2, craftAttempts: 2, craftCorrect: 2, order: i + 1 });
      if (!localStorage.getItem(KEY))
        localStorage.setItem(
          KEY,
          JSON.stringify({
            schema: 2, syncCode: null, syncConsent: false, parentPassword: null, activeId: 'idle1',
            profiles: [{
              id: 'idle1', version: 1, profile: { name: 'Explorer', onboarded: true },
              categories: { setSize: 10, level: 1, recent: [], order: 3, peakKnownish: 10, peakMastered: 10, words: ['cat', 'dog', 'sun'].map(mastered) },
            }],
          }),
        );
    } catch {}
  });
  await idlePage.goto(URL, { waitUntil: 'networkidle' });
  await dismissPicker(idlePage);
  // §31.C: with everything MASTERED the home recommender nudges (pulses) + may idle-route to
  // Practice on its own. Force-click past the cosmetic pulse if we're still on home, then just
  // wait for the rhythm wave (whether we clicked in or the home auto-routed us there).
  const playCard = idlePage.locator('.menu-card.play');
  if (await playCard.count()) await playCard.click({ force: true }).catch(() => {});
  await idlePage.waitForSelector('.rhythm .tile', { timeout: 8000 });
  // deliberately do NOT interact -> the pause overlay must appear on its own
  await idlePage.waitForSelector('.pause-overlay', { timeout: 4000 });
  ok('idle with no interaction -> "Paused" overlay appeared (keeps kids on task)');
  await idlePage.click('.pause-overlay .btn.primary'); // Resume
  await idlePage.waitForSelector('.pause-overlay', { state: 'detached', timeout: 4000 });
  ok('tapping Resume dismissed the pause overlay');
  await idlePage.close();

  // --- engagement: staring at the MENU auto-starts CRAFTING (the headline act, §B) ---
  const menuPage = await browser.newPage({ viewport: { width: 820, height: 1180 } });
  menuPage.on('pageerror', (e) => errors.push('pageerror(menu): ' + e.message));
  await menuPage.addInitScript(() => {
    window.__idleTest = 0.04; // home nudge ~520ms, auto-launch ~1280ms
    try {
      const KEY = 'crystal-spell-caverns:v1';
      if (!localStorage.getItem(KEY)) localStorage.setItem(KEY, JSON.stringify({ profile: { name: 'Explorer', onboarded: true } }));
    } catch {}
  });
  await menuPage.goto(URL, { waitUntil: 'networkidle' });
  await dismissPicker(menuPage);
  await menuPage.click('.home-title'); // a harmless tap unlocks audio so it WILL launch
  // now sit idle on the menu — it should highlight Craft then drop into a craft round on its own
  await menuPage.waitForSelector('.puzzle .slot', { timeout: 5000 });
  ok('idle on the home menu auto-started crafting (the headline act) on its own');
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
