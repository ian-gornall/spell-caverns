// scripts/qa_s38.mjs — visual-QA probe for the §38 research-corpus word lists:
//   A. Settings grown-up "Word lists" panel: Classic ↔ Pattern lessons toggle + age stepper
//   B. lessons mode serves lesson-1 words in Craft (band = spine lesson)
//   C. reteach-on-miss: rule strip + grapheme glow in Craft
//   D. Progress shows the Lesson path with pattern names
//   E. classic profile unchanged (no reteach strip, cavern naming intact)
// Run: npm start (one terminal) then: node scripts/qa_s38.mjs
import { chromium } from 'playwright';
import { mkdir, rm } from 'node:fs/promises';

const URL = process.env.URL || 'http://localhost:5173';
const OUT = 'scripts/qa_s38';
await rm(OUT, { recursive: true, force: true }).catch(() => {});
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const issues = [];
const ok = (c, m) => console.log((c ? '✓ ' : '✗ ') + m) || (!c && issues.push(m));

// one onboarded, placed profile — starts on the CLASSIC list (the default)
const SEED = {
  schema: 2, syncCode: null, syncConsent: false, parentPassword: null, activeId: 'p1',
  profiles: [{
    id: 'p1', version: 1, profile: { name: 'Tester', onboarded: true },
    settings: { length: 5, voice: false },
    placement: { done: true, age: 8 },
    categories: { setSize: 5, level: 1, recent: [], order: 0, words: [] },
  }],
};

async function newPage(view) {
  const page = await browser.newPage({ viewport: view });
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource.*\b404\b/.test(m.text())) issues.push('console.error: ' + m.text()); });
  page.on('pageerror', (e) => issues.push('pageerror: ' + e.message));
  await page.addInitScript((seed) => { try { localStorage.setItem('crystal-spell-caverns:v1', JSON.stringify(seed)); } catch {} }, SEED);
  return page;
}
async function gotoHome(page) {
  await page.goto(URL, { waitUntil: 'networkidle' });
  if (await page.locator('.profile-card:not(.add)').count()) await page.locator('.profile-card:not(.add)').first().click();
  await page.waitForSelector('.menu-card', { timeout: 6000 });
}
const backHome = async (page) => { await page.locator('.back, .hdr-back, header button').first().click().catch(() => {}); await page.waitForSelector('.menu-card', { timeout: 6000 }); };

// Fill every craft slot, forcing at least one WRONG letter (tap tray tiles).
async function buildWrong(page) {
  const target = (await page.evaluate(() => window.__puzzleCurrent?.word)) || '';
  let forcedWrong = false;
  for (let i = 0; i < target.length; i++) {
    const tiles = page.locator('.tray-tile:not(.used)');
    const n = await tiles.count();
    let pick = 0;
    if (!forcedWrong) {
      for (let t = 0; t < n; t++) {
        const letter = (await tiles.nth(t).textContent())?.trim().toLowerCase();
        if (letter && letter !== target[i]) { pick = t; forcedWrong = true; break; }
      }
    }
    await tiles.nth(pick).click();
    await page.waitForTimeout(120);
  }
  return { target, forcedWrong };
}

try {
  console.log('\n=== PHONE 390×844 ===');
  const page = await newPage({ width: 390, height: 844 });
  await gotoHome(page);
  await page.screenshot({ path: `${OUT}/01-home-classic.png` });

  // ---------- A. Settings: toggle to Pattern lessons ----------
  await page.locator('.menu-card', { hasText: 'Settings' }).click();
  await page.waitForSelector('.gp-disclosure', { timeout: 6000 });
  await page.locator('.gp-disclosure summary').click();
  await page.waitForTimeout(200);
  const wlPanel = page.locator('.panel', { has: page.locator('h3', { hasText: 'Word lists' }) });
  ok(await wlPanel.count() === 1, 'settings: Word lists panel present in grown-up section');
  await wlPanel.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${OUT}/02-settings-wordlists.png` });
  page.once('dialog', (d) => d.accept());
  await wlPanel.locator('button', { hasText: 'Pattern lessons' }).click();
  await page.waitForTimeout(400);
  await page.locator('.gp-disclosure summary').click(); // re-render collapsed it; reopen
  await page.waitForTimeout(200);
  const ageField = page.locator('.field', { hasText: 'Age' }).filter({ has: page.locator('.level-readout') });
  ok(await ageField.count() >= 1, 'settings: age stepper appears in lessons mode');
  const ageTxt = (await ageField.first().locator('.level-readout').textContent())?.trim();
  ok(/8 years/.test(ageTxt || ''), `settings: age seeded from placement (got "${ageTxt}")`);
  const lvlTxt = (await page.locator('.level-control .level-readout').textContent())?.trim();
  ok(/^Lesson 1 of \d+$/.test(lvlTxt || ''), `settings: level readout is lesson-aware ("${lvlTxt}")`);
  ok(await page.locator('button', { hasText: 'Re-test starting level' }).count() === 0, 'settings: classic re-test hidden in lessons mode');
  await page.locator('.panel', { has: page.locator('h3', { hasText: 'Word lists' }) }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${OUT}/03-settings-lessons-on.png` });

  // age stepper: Older nudges to 9
  await page.locator('button', { hasText: 'Older ➕' }).click();
  await page.waitForTimeout(300);
  await page.locator('.gp-disclosure summary').click();
  await page.waitForTimeout(200);
  const age2 = (await page.locator('.field', { hasText: 'Age' }).filter({ has: page.locator('.level-readout') }).first().locator('.level-readout').textContent())?.trim();
  ok(/9 years/.test(age2 || ''), `settings: Older ➕ nudges the age (got "${age2}")`);
  await backHome(page);

  // ---------- B+C. the hero routes into the §40 LESSON STREAM (not classic Craft) ----------
  // A JUST-SWITCHED profile is UNPLACED, so the first round is the invisible spine
  // diagnostic (no intro card yet — that follows placement). The stream's own behavior
  // (exposure/ghosts/ladder/reteach/graduation/diagnostic) is guarded by scripts/qa_s40.mjs.
  await page.locator('.menu-card.lesson').click();
  await page.waitForFunction(() => window.__lessonCurrent, null, { timeout: 8000 });
  const cur = await page.evaluate(() => window.__lessonCurrent);
  ok(!!cur && !!cur.word, `lessons: the stream serves a trial ("${cur?.word}")`);
  ok(cur.diag != null, 'lessons: a fresh switch starts with the (invisible) spine diagnostic');
  ok(await page.locator('.lintro-overlay').count() === 0, 'lessons: no intro card during the diagnostic');
  ok(await page.locator('.type-keyboard .key').count() > 20, 'lessons: the app keypad is the input');
  await page.screenshot({ path: `${OUT}/05-lesson-trial.png` });

  // ---------- D. Progress: lesson path ----------
  await backHome(page);
  await page.locator('.menu-card', { hasText: 'Progress' }).click();
  await page.waitForSelector('.cavern-scroll', { timeout: 6000 });
  ok(await page.locator('h3', { hasText: 'Lesson path' }).count() === 1, 'progress: panel titled "Lesson path"');
  ok(await page.locator('.cl-lesson').count() > 5, 'progress: lesson names render in the path');
  ok((await page.locator('.haul-label', { hasText: 'lesson' }).count()) >= 1, 'progress: haul tile says "lesson"');
  await page.locator('.cavern-scroll').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${OUT}/06-progress-lessonpath.png` });
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  const cw = await page.evaluate(() => document.documentElement.clientWidth);
  ok(sw <= cw + 1, `no horizontal overflow (scrollW=${sw} clientW=${cw})`);
  await page.close();

  // ---------- E. classic regression: fresh page, default profile stays classic ----------
  console.log('\n=== CLASSIC regression (phone) ===');
  const cls = await newPage({ width: 390, height: 844 });
  await gotoHome(cls);
  await cls.locator('.menu-card', { hasText: 'Progress' }).click();
  await cls.waitForSelector('.cavern-scroll', { timeout: 6000 });
  ok(await cls.locator('h3', { hasText: 'Cavern map' }).count() === 1, 'classic: panel still "Cavern map"');
  ok(await cls.locator('.cl-lesson').count() === 0, 'classic: no lesson labels');
  await cls.screenshot({ path: `${OUT}/07-classic-progress.png` });
  await cls.close();
} catch (e) {
  issues.push('SCRIPT ERROR: ' + e.message);
}

await browser.close();
console.log(issues.length ? `\nISSUES (${issues.length}):\n- ` + issues.join('\n- ') : '\nISSUES: none');
process.exit(issues.length ? 1 : 0);
