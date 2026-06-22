// scripts/qa_cavernmap.mjs — §36 D4 (Ian 2026-06-22d): the scrollable cavern-level MAP on Progress.
// Injects a profile placed at cavern level 10 (so bands 1–9 are SKIPPED, 10 is CURRENT, 11+ LOCKED),
// opens Progress, and asserts the map renders the right statuses, the current level is present, and
// tapping a SKIPPED level re-aims the working set there and starts crafting it (the "go back and
// master" mechanic). Run: npm start, then node scripts/qa_cavernmap.mjs.
import { chromium } from 'playwright';
import { mkdir, rm } from 'node:fs/promises';

const URL = process.env.URL || 'http://localhost:5173';
const OUT = 'scripts/qa_cavernmap';
await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 820, height: 1180 } });
const issues = [];
page.on('pageerror', (e) => issues.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource.*\b404\b/.test(m.text())) issues.push('console.error: ' + m.text()); });

const SEED = {
  schema: 2, syncCode: null, syncConsent: false, parentPassword: null, activeId: 'M1',
  profiles: [{ id: 'M1', version: 1, profile: { name: 'Map', onboarded: true }, startLevel: 10,
    placement: { done: true, age: 8, band: 10 },
    categories: { setSize: 10, level: 10, peakLevel: 10, recent: [], order: 0, peakKnownish: 0, peakMastered: 0, words: [] } }],
};
const readLevel = () => page.evaluate(() => {
  const c = JSON.parse(localStorage.getItem('crystal-spell-caverns:v1'));
  const p = c.profiles.find((x) => x.id === c.activeId);
  return p.categories.level;
});

try {
  await page.addInitScript((s) => { try { localStorage.setItem('crystal-spell-caverns:v1', JSON.stringify(s)); } catch {} }, SEED);
  await page.goto(URL, { waitUntil: 'networkidle' });
  if (await page.$('.tap-to-start')) await page.click('.tap-to-start');
  if (await page.locator('.profile-card:not(.add)').count()) await page.locator('.profile-card:not(.add)').first().click();
  await page.waitForSelector('.menu-card', { timeout: 8000 });
  await page.locator('.menu-card', { hasText: 'Progress' }).first().click();
  await page.waitForSelector('.cavern-scroll', { timeout: 8000 });
  await page.waitForTimeout(300);

  const map = await page.evaluate(() => {
    const levels = [...document.querySelectorAll('.cavern-level')].map((b) => ({
      num: (b.querySelector('.cl-num')?.textContent || '').replace('Level ', ''),
      status: ['current', 'cleared', 'reached', 'skipped', 'locked'].find((s) => b.classList.contains(s)) || '?',
      disabled: b.disabled,
    }));
    const note = document.querySelector('.cavern-scroll')?.previousElementSibling?.textContent || '';
    return { count: levels.length, levels, note };
  });
  await page.screenshot({ path: `${OUT}/01-cavern-map.png` });

  const cur = map.levels.find((l) => l.status === 'current');
  const skippedBelow = map.levels.filter((l) => l.status === 'skipped').map((l) => +l.num);
  const lockedAbove = map.levels.filter((l) => l.status === 'locked').map((l) => +l.num);
  if (map.count < 90) issues.push(`FAIL: expected ~97 cavern levels, got ${map.count}`);
  if (!cur || cur.num !== '10') issues.push(`FAIL: current level should be 10, got "${cur && cur.num}"`);
  if (!(skippedBelow.length === 9 && Math.max(...skippedBelow) === 9)) issues.push(`FAIL: bands 1–9 should be skipped, got [${skippedBelow.join(',')}]`);
  if (!(lockedAbove.length > 0 && Math.min(...lockedAbove) === 11)) issues.push(`FAIL: bands 11+ should be locked, got min ${Math.min(...lockedAbove)}`);
  if (!/9 easier levels to go back and master/.test(map.note)) issues.push(`FAIL: note should mention 9 easier levels; got "${map.note}"`);

  // tap a SKIPPED level (Level 5) → re-aims there + goes to craft
  await page.locator('.cavern-level.skipped', { hasText: 'Level 5' }).first().click();
  await page.waitForSelector('.screen.puzzle', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(400);
  const newLevel = await readLevel();
  const onPuzzle = await page.$('.screen.puzzle');
  if (!onPuzzle) issues.push('FAIL: tapping a level did not start a craft session');
  if (newLevel !== 5) issues.push(`FAIL: tapping Level 5 should re-aim categories.level to 5, got ${newLevel}`);
  await page.screenshot({ path: `${OUT}/02-after-tap-level5.png` });

  console.log('\n— §36 D4 cavern-map QA —');
  console.log('levels rendered   :', map.count);
  console.log('current level     :', cur && cur.num);
  console.log('skipped below     :', skippedBelow.join(','));
  console.log('locked above start:', lockedAbove.length ? Math.min(...lockedAbove) : '—');
  console.log('note              :', JSON.stringify(map.note.trim().slice(0, 80)));
  console.log('tap Level 5 → level now:', newLevel, '| on craft:', !!onPuzzle);
  console.log('\n' + (issues.length ? `ISSUES (${issues.length}):\n- ` + issues.join('\n- ') : 'ISSUES: none ✅'));
} catch (e) {
  issues.push('PROBE ERROR: ' + e.message);
  console.log('\nISSUES:', issues);
} finally {
  await browser.close();
}
process.exit(issues.length ? 1 : 0);
