// scripts/qa_responsive.mjs — full multi-resolution QA pass. Drives every key screen at
// phone / tablet / landscape sizes, screenshots each, and flags HORIZONTAL OVERFLOW and
// any element wider than the viewport (the #1 "looks wrong on my phone" cause).
//
// NOTE: headless Chromium on Windows cannot reproduce iOS PWA safe-area insets (the notch /
// home-indicator). It DOES faithfully reproduce narrow-width / short-height layout. Safe-area
// is reasoned about separately (see the report).
import { chromium } from 'playwright';
const URL = process.env.URL || 'http://localhost:5173';

const DEVICES = [
  { id: 'iphone-se', w: 375, h: 667, label: 'iPhone SE' },
  { id: 'iphone-13', w: 390, h: 844, label: 'iPhone 13/14' },
  { id: 'iphone-max', w: 430, h: 932, label: 'iPhone 14 Pro Max' },
  { id: 'pixel-7', w: 412, h: 915, label: 'Pixel 7' },
  { id: 'android-sm', w: 360, h: 740, label: 'small Android' },
  { id: 'ipad', w: 820, h: 1180, label: 'iPad portrait (design target)' },
  { id: 'iphone-land', w: 844, h: 390, label: 'iPhone landscape' },
];

// a seeded, onboarded single profile (legacy blob migrates to one profile -> lands on home)
const SEED = {
  version: 1,
  profile: { name: 'Sam', onboarded: true },
  settings: { difficulty: 'easy', length: 10, optionCount: 3, voice: false, volume: 0.85, voiceRate: 0.85, themeColor: '#7AA2FF', dailyGoalGems: 250 },
  startLevel: 5,
  gems: 540,
  feedback: [],
  specimens: [],
  stats: { sessionsPlayed: 5, answers: 60, correct: 44, byDay: {} },
  streak: { count: 3, lastPlayedDate: new Date().toISOString().slice(0, 10), longest: 6, freezes: 1 },
  records: { bestCombo: 8, bestWaveGems: 220 },
  catalog: { owned: ['quartz', 'amethyst'], milestoneDepth: 1 },
};

async function overflowReport(page) {
  return page.evaluate(() => {
    const de = document.documentElement;
    const vw = window.innerWidth;
    const horiz = Math.max(de.scrollWidth - vw, document.body.scrollWidth - vw);
    const wide = [...document.querySelectorAll('body *')]
      .map((e) => ({ e, r: e.getBoundingClientRect() }))
      .filter(({ r }) => r.width > vw + 1 || r.right > vw + 1.5 || r.left < -1.5)
      .slice(0, 6)
      .map(({ e, r }) => `${e.tagName.toLowerCase()}.${(e.className || '').toString().split(' ')[0]} w=${Math.round(r.width)} L=${Math.round(r.left)} R=${Math.round(r.right)}`);
    return { vw, horiz, vScroll: de.scrollHeight - de.clientHeight, wide };
  });
}

const browser = await chromium.launch();
const findings = [];

for (const d of DEVICES) {
  const ctx = await browser.newContext({ viewport: { width: d.w, height: d.h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  page.on('pageerror', (e) => errs.push(String(e)));

  // seed -> home
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate((s) => localStorage.setItem('crystal-spell-caverns:v1', JSON.stringify(s)), SEED);
  await page.goto(URL, { waitUntil: 'networkidle' });

  const shots = [];
  async function capture(name, ready) {
    if (ready) await page.waitForSelector(ready, { timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(250);
    const path = `scripts/qa/res/${d.id}-${name}.png`;
    await page.screenshot({ path });
    const o = await overflowReport(page);
    shots.push({ name, o });
    if (o.horiz > 1 || o.wide.length) findings.push(`${d.label} [${name}] horiz=${o.horiz} :: ${o.wide.join(' | ')}`);
  }

  // HOME
  await capture('home', '.home-grid');

  // RHYTHM (mid-word)
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button, .menu-card')].find((x) => /play|mine|dig/i.test(x.textContent));
    if (b) b.click();
  });
  await capture('rhythm', '.tiles');

  // back home -> PUZZLE
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button, .menu-card')].find((x) => /craft|build/i.test(x.textContent));
    if (b) b.click();
  });
  await capture('puzzle', '.tray');

  // SETTINGS (has the new level grid)
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button, .menu-card')].find((x) => /settings|⚙/i.test(x.textContent));
    if (b) b.click();
  });
  await capture('settings', '.level-grid');

  // PROGRESS
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button, .menu-card')].find((x) => /progress|map/i.test(x.textContent));
    if (b) b.click();
  });
  await capture('progress', '.screen');

  // ONBOARDING level-select (clear storage)
  await page.evaluate(() => localStorage.clear());
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.click('.onboard-go').catch(() => {});
  await page.fill('.onboard-name', 'Sam').catch(() => {});
  await page.click('.onboard-go').catch(() => {});
  await page.click('.onboard-go').catch(() => {}); // colour
  await capture('onboard-levels', '.level-grid');

  console.log(`\n=== ${d.label} (${d.w}x${d.h}) ===`);
  for (const s of shots) console.log(`  ${s.name.padEnd(16)} horiz=${s.o.horiz} vScroll=${s.o.vScroll} ${s.o.wide.length ? '⚠ ' + s.o.wide.join(' | ') : 'ok'}`);
  if (errs.length) console.log('  console errors:', errs.slice(0, 3));
  await ctx.close();
}

console.log('\n================ OVERFLOW FINDINGS ================');
console.log(findings.length ? findings.join('\n') : '✅ no horizontal overflow at any tested resolution');
await browser.close();
