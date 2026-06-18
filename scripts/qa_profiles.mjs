// scripts/qa_profiles.mjs — verify the multi-profile flow: create two explorers, the
// "Who's playing?" picker, and that each keeps separate progress. Screenshots key states.
import { chromium } from 'playwright';
const URL = process.env.URL || 'http://localhost:5173';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 820, height: 1180 } });
const errs = [];
p.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errs.push(m.text()));
p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));

const onboard = async (name, levelIdx) => {
  await p.waitForSelector('.onboard-go');
  await p.click('.onboard-go'); // welcome -> name
  await p.waitForSelector('.onboard-name');
  await p.fill('.onboard-name', name);
  await p.click('.onboard-go'); // -> colour
  await p.waitForSelector('.colour-swatch');
  await p.locator('.colour-swatch').nth(1).click();
  await p.click('.onboard-go'); // -> level
  await p.waitForSelector('.level-card');
  await p.locator('.level-card').nth(levelIdx).click();
  return; // caller continues (firstRun shows sync step; add-explorer goes straight to ready)
};

await p.goto(URL, { waitUntil: 'networkidle' });
await p.evaluate(() => localStorage.clear());
await p.goto(URL, { waitUntil: 'networkidle' });

// First explorer "Ada" (first run -> sync step -> just this one)
await onboard('Ada', 2);
await p.click('.onboard-go'); // "Let's dig!" -> sync step
await p.waitForSelector('text=Just this one');
await p.screenshot({ path: 'scripts/qa/prof-level.png' }); // shows we passed the level select
await p.click('text=Just this one');
await p.waitForSelector('.onboard-go.big');
await p.click('.onboard-go.big');
await p.waitForSelector('.rhythm .tile');
await p.goto(URL, { waitUntil: 'networkidle' }); // back to home (1 profile -> auto)
await p.waitForSelector('.menu-card.play');

// Add a second explorer "Bo" via Settings
await p.click('[class*="menu-card"]:has(.lbl:text-is("Settings"))');
await p.waitForSelector('text=Add explorer');
await p.click('text=Add explorer');
await onboard('Bo', 4); // add-explorer: not first run -> level "Let's dig!" goes straight to ready
await p.click('.onboard-go'); // "Let's dig!" -> ready (no sync step for add-explorer)
await p.waitForSelector('.onboard-go.big');
await p.click('.onboard-go.big');
await p.waitForSelector('.rhythm .tile');

// Reload -> now 2 profiles -> "Who's playing?"
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForSelector('.profile-card');
const names = await p.locator('.profile-name').allTextContents();
await p.screenshot({ path: 'scripts/qa/prof-whos-playing.png' });

const container = await p.evaluate(() => JSON.parse(localStorage.getItem('crystal-spell-caverns:v1')));
console.log('schema:', container.schema, '| profiles:', container.profiles.map((x) => x.name));
console.log('who\'s-playing names:', names);
console.log('distinct start levels:', container.profiles.map((x) => x.startLevel));
console.log('console/page errors:', errs.length);
for (const e of errs) console.log('  - ' + e);
await b.close();
