// scripts/qa.mjs — EXPLORATORY QA harness (NOT a pass/fail test). Drives the live
// app like a real player, with monitoring hooks (console / page errors / failed
// requests), and screenshots every meaningful state into scripts/qa/ for VISUAL
// review. Read each PNG and judge it like a human: layout, overflow, contrast,
// alignment, stuck animation states, broken art, off-screen content, etc.
//
// Usage:  npm start   (in one terminal)   then   node scripts/qa.mjs
// Optional: VIEW=landscape node scripts/qa.mjs   (1180x820 instead of portrait)
//
// This is a SCRATCH tool for the QA-and-fix loop in HANDOFF §14 — keep it handy,
// extend it as needed, do not treat its output as a regression gate.
import { chromium } from 'playwright';
import { mkdir, rm } from 'node:fs/promises';

const URL = process.env.URL || 'http://localhost:5173';
const OUT = 'scripts/qa';
// VIEW=landscape, or W=…/H=… for a custom viewport (e.g. W=820 H=860 to simulate an
// iPad portrait with Safari's URL + tab bars eating vertical space — reduced-height QA).
const VIEW =
  process.env.W && process.env.H
    ? { width: +process.env.W, height: +process.env.H }
    : process.env.VIEW === 'landscape'
      ? { width: 1180, height: 820 }
      : { width: 820, height: 1180 };

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: VIEW });

// --- monitoring hooks: surface anything the browser complains about ----------
const issues = [];
page.on('console', (m) => {
  const t = m.type();
  if (t === 'error' || t === 'warning') {
    const line = `console.${t}: ${m.text()}`;
    issues.push(line);
    console.log('  ⚠ ' + line);
  }
});
page.on('pageerror', (e) => {
  const line = `pageerror: ${e.message}`;
  issues.push(line);
  console.log('  ❌ ' + line);
});
page.on('requestfailed', (r) => {
  // favicon etc. can fail harmlessly; report all and judge in review
  const line = `requestfailed: ${r.url()} (${r.failure()?.errorText})`;
  issues.push(line);
  console.log('  ⚠ ' + line);
});

let n = 0;
const shot = async (label) => {
  const name = `${String(++n).padStart(2, '0')}-${label}`;
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`  📸 ${name}.png`);
};
const wait = (ms) => page.waitForTimeout(ms);
const target = () => page.evaluate(() => window.__rhythmCurrent || null);
const labCur = () => page.evaluate(() => window.__labCurrent || null);
const puzCur = () => page.evaluate(() => window.__puzzleCurrent || null);
const clickExactTile = async (sel, word) => {
  const ts = page.locator(sel);
  const c = await ts.count();
  for (let i = 0; i < c; i++) {
    if ((await ts.nth(i).textContent())?.trim() === word) {
      await ts.nth(i).click();
      return true;
    }
  }
  return false;
};
const section = (s) => console.log(`\n=== ${s} ===`);

try {
  // start from a clean slate so progress/specimens reflect THIS pass
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.goto(URL, { waitUntil: 'networkidle' });

  section('ONBOARDING (first run)');
  await page.waitForSelector('.onboarding .onboard-go');
  await wait(300);
  await shot('onboard-welcome');
  await page.click('.onboard-go'); // -> name
  await page.waitForSelector('.onboard-name');
  await page.fill('.onboard-name', 'Ada');
  await shot('onboard-name');
  await page.click('.onboard-go'); // -> colour
  await page.waitForSelector('.colour-grid .colour-swatch');
  await page.locator('.colour-swatch').nth(1).click();
  await shot('onboard-colour');
  await page.click('.onboard-go'); // -> level select
  await page.waitForSelector('.level-card');
  await page.click('.onboard-go'); // "Let's dig!" -> family-sync step
  await page.waitForSelector('text=Just this one');
  await page.click('text=Just this one'); // skip sync -> ready
  await page.waitForSelector('.onboard-go.big');
  await shot('onboard-ready');
  await page.click('.onboard-go.big'); // -> guaranteed-win first wave
  await page.waitForSelector('.rhythm .tile');
  await wait(400);
  await shot('onboard-firstwave');
  // finish onboarding cleanly so the rest of the pass starts from a normal home
  await page.goto(URL, { waitUntil: 'networkidle' });

  section('HOME');
  await page.waitForSelector('.menu-card.play');
  await shot('home');

  section('RHYTHM (Play)');
  await page.click('.menu-card.play');
  await page.waitForSelector('.rhythm .tile');
  await wait(400);
  await shot('rhythm-question');
  // a correct tap -> capture the praise/verdict + gem burst
  let cur = await target();
  if (cur) await clickExactTile('.rhythm .tile', cur.word);
  await wait(350);
  await shot('rhythm-correct-verdict');
  // a wrong tap on the next word -> capture the gentle reveal
  await page.waitForFunction((p) => window.__rhythmCurrent && window.__rhythmCurrent.index > p, cur?.index ?? 0, { timeout: 4000 }).catch(() => {});
  cur = await target();
  const tiles = page.locator('.rhythm .tile');
  const tc = await tiles.count();
  for (let i = 0; i < tc; i++) {
    if ((await tiles.nth(i).textContent())?.trim() !== cur?.word) {
      await tiles.nth(i).click();
      break;
    }
  }
  await wait(350);
  await shot('rhythm-wrong-reveal');
  // play out the wave to the reward
  for (let g = 0; g < 80; g++) {
    if (await page.locator('.reward').count()) break;
    if (await page.locator('.rhythm .tiles:not(.locked) .tile').count()) {
      const c = await target();
      if (!c || !(await clickExactTile('.rhythm .tile', c.word))) {
        await page.locator('.rhythm .tiles:not(.locked) .tile').first().click().catch(() => {});
      }
    }
    await wait(200);
  }
  await page.waitForSelector('.reward', { timeout: 8000 }).catch(() => {});
  await wait(300);
  await shot('rhythm-reward');

  section('PUZZLE (Craft)');
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.click('.menu-card.craft');
  await page.waitForSelector('.puzzle .slot');
  await wait(400);
  await shot('puzzle-start');
  const pc = await puzCur();
  if (pc) {
    // place half the letters to capture a mid-build state
    const half = Math.ceil(pc.word.length / 2);
    for (let i = 0; i < half; i++) {
      await page.locator(`.puzzle .tray-tile:not(.used)[data-letter="${pc.word[i]}"]`).first().click().catch(() => {});
      await wait(80);
    }
    await shot('puzzle-midbuild');
    for (let i = half; i < pc.word.length; i++) {
      await page.locator(`.puzzle .tray-tile:not(.used)[data-letter="${pc.word[i]}"]`).first().click().catch(() => {});
      await wait(80);
    }
    await wait(350);
    await shot('puzzle-solved');
  }

  section('CRYSTAL LAB');
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.click('.menu-card.lab');
  await page.waitForSelector('.lab .lab-go');
  await wait(300);
  await shot('lab-invent');
  await page.click('.lab .lab-go');
  await page.waitForSelector('.lab .slot');
  await wait(300);
  await shot('lab-spell');
  const lc = await labCur();
  if (lc) {
    for (const ch of lc.word) {
      await page.locator(`.lab .tray-tile:not(.used)[data-letter="${ch}"]`).first().click().catch(() => {});
      await wait(70);
    }
  }
  await page.waitForSelector('.lab-canvas', { timeout: 5000 }).catch(() => {});
  await wait(300);
  await shot('lab-draw-empty');
  // draw a crystal-ish shape so the specimen + name preview look real
  const box = await page.locator('.lab-canvas').boundingBox();
  if (box) {
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const pts = [[cx, cy - 80], [cx + 55, cy - 5], [cx + 35, cy + 80], [cx - 35, cy + 80], [cx - 55, cy - 5], [cx, cy - 80], [cx, cy + 80]];
    await page.mouse.move(pts[0][0], pts[0][1]);
    await page.mouse.down();
    for (const [x, y] of pts.slice(1)) await page.mouse.move(x, y, { steps: 6 });
    await page.mouse.up();
  }
  await shot('lab-draw-drawn');
  await page.click('.lab .lab-go'); // Name it
  await page.waitForSelector('.lab-name', { timeout: 4000 }).catch(() => {});
  await wait(200);
  await shot('lab-name');
  await page.fill('.lab-name', 'Aurora Geode');
  await page.click('.lab .lab-go'); // Save
  await page.waitForSelector('.lab-saved', { timeout: 4000 }).catch(() => {});
  await wait(300);
  await shot('lab-saved');

  section('PROGRESS / SETTINGS / FEEDBACK');
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.click('.menu-card', { position: { x: 10, y: 10 } }).catch(() => {});
  await page.goto(URL, { waitUntil: 'networkidle' });
  // Progress (now has a played wave + a specimen)
  await page.click('[class*="menu-card"]:has(.lbl:text-is("Progress"))').catch(async () => {
    await page.evaluate(() => {});
  });
  await page.waitForSelector('.spectrum', { timeout: 4000 }).catch(() => {});
  await wait(300);
  await shot('progress');
  // Settings
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.click('[class*="menu-card"]:has(.lbl:text-is("Settings"))').catch(() => {});
  await page.waitForSelector('.seg', { timeout: 4000 }).catch(() => {});
  await wait(300);
  await shot('settings');
  // Feedback
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.click('.menu-card.feedback').catch(() => {});
  await page.waitForSelector('.rating-row', { timeout: 4000 }).catch(() => {});
  await wait(300);
  await shot('feedback');
} catch (e) {
  console.log('\n❌ QA run threw: ' + (e?.stack || e));
} finally {
  console.log(`\n--- monitoring summary: ${issues.length} console/error/network notes ---`);
  for (const i of issues) console.log('  ' + i);
  await browser.close();
  console.log(`\nScreenshots in ${OUT}/ — review each visually.`);
}
