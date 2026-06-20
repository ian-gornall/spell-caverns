// scripts/qa_uiaudio.mjs — verify §32.A INTERFACE AUDIO end-to-end in a real browser.
//
// Drives the first-run onboarding (the showcase narration) + a geode and asserts that
// the FIXED interface lines resolve to PRE-RENDERED /audio/ui/ clips (not the robotic
// device TTS), and that no console/page errors slipped into the edited screen/mode files
// (npm test can't see runtime import errors in UI modules — the standing QA lesson).
//
// Usage:  npm start  (one terminal)  then  node scripts/qa_uiaudio.mjs
import { chromium } from 'playwright';
import { UI } from '../src/engine/ui_phrases.js';

const URL = process.env.URL || 'http://localhost:5173';
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 820, height: 1180 } });

const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
// every /audio/ request the page makes (clips it tried to play) + any that 404'd
const audioReqs = [];
page.on('request', (r) => { const u = r.url(); if (u.includes('/audio/')) audioReqs.push(u); });
page.on('response', (r) => { const u = r.url(); if (u.includes('/audio/') && r.status() >= 400) errors.push(`audio ${r.status()}: ${u}`); });

const requestedUi = (line) => audioReqs.some((u) => u.endsWith(`/audio/ui/${slug(line)}.mp3`));
const wait = (ms) => page.waitForTimeout(ms);

let failures = 0;
const check = (cond, msg) => { console.log(`${cond ? '  ✓' : '  ✗'} ${msg}`); if (!cond) failures++; };

try {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.goto(URL, { waitUntil: 'networkidle' });

  console.log('=== ONBOARDING narration ===');
  await page.waitForSelector('.onboarding .onboard-go');
  // §32.B: first run opens with a "Tap to start" gate. Tapping it primes audio + awaits
  // the manifest, THEN speaks welcome — so welcome must now resolve to a CLIP (the fix
  // for the "first line is a different/robotic voice" bug).
  check(await page.locator('.tap-to-start').count() > 0, 'first-run "Tap to start" gate is shown');
  await page.click('.tap-to-start');
  await page.waitForSelector('.onboarding .onboard-go:not(.tap-to-start)');
  await wait(600);
  check(requestedUi(UI.welcome), 'welcome → /audio/ui/ clip AFTER the start gate (no TTS first-line)');

  await page.click('.onboard-go'); // → name step
  await page.waitForSelector('.onboard-name');
  await wait(400);
  check(requestedUi(UI.askName), 'askName → /audio/ui/ clip');

  await page.fill('.onboard-name', 'Ada');
  await page.click('.onboard-go'); // → colour
  await page.waitForSelector('.colour-grid .colour-swatch');
  await wait(400);
  check(requestedUi(UI.pickColour), 'pickColour → /audio/ui/ clip');

  await page.locator('.colour-swatch').nth(1).click();
  await page.click('.onboard-go'); // → level select
  await page.waitForSelector('.level-card');
  await wait(400);
  check(requestedUi(UI.chooseLevel), 'chooseLevel → /audio/ui/ clip');

  await page.click('.onboard-go'); // "Let's dig!" → sync step
  await page.waitForSelector('text=Just this one');
  await wait(400);
  check(requestedUi(UI.syncAsk), 'syncAsk → /audio/ui/ clip');

  await page.click('text=Just this one'); // → ready
  await page.waitForSelector('.onboard-go.big');
  await wait(400);
  check(requestedUi(UI.letsDig), 'letsDig → /audio/ui/ clip (name dropped from speech)');

  console.log('\n=== summary ===');
  console.log(`  /audio/ui/ clips requested: ${audioReqs.filter((u) => u.includes('/audio/ui/')).length}`);
  check(errors.length === 0, `no console/page/audio errors (${errors.length})`);
  for (const e of errors) console.log('    ' + e);
} catch (e) {
  console.log('❌ run threw: ' + (e?.stack || e));
  failures++;
} finally {
  await browser.close();
  console.log(failures === 0 ? '\n✅ PASS — interface audio resolves to clips, no errors.' : `\n❌ FAIL — ${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}
