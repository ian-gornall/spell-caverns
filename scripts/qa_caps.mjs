// scripts/qa_caps.mjs — §4 caps (Ian 2026-06-22d): proper nouns are SPELLED with lowercase tiles
// (and lowercase handwriting), but the FIRST placed letter DISPLAYS as a capital so the child sees
// the correct proper form (e.g. "Williams"). This injects a PLACED profile at cavern level 35 —
// where "Williams" is the lowest-rank (first-served) word in the band — opens Craft, finds the
// proper noun, and asserts: the tray TILE is lowercase, slot 0 RENDERS uppercase, other slots stay
// lowercase, and the build still grades correct from lowercase input. Run: npm start, then node this.
import { chromium } from 'playwright';
import { mkdir, rm } from 'node:fs/promises';

const URL = process.env.URL || 'http://localhost:5173';
const OUT = 'scripts/qa_caps';
await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 820, height: 1180 } });
const issues = [];
page.on('pageerror', (e) => issues.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource.*\b404\b/.test(m.text())) issues.push('console.error: ' + m.text()); });

// A PLACED profile (placement.done) at level 35 so Craft runs normally (not the diagnostic) and
// serves band-35 words — "Williams" (rank 1021) is the lowest-rank servable word there.
const SEED = {
  schema: 2, syncCode: null, syncConsent: false, parentPassword: null, activeId: 'C1',
  profiles: [{ id: 'C1', version: 1, profile: { name: 'Cap', onboarded: true }, startLevel: 35,
    placement: { done: true, age: 8, band: 35 },
    categories: { setSize: 10, level: 35, recent: [], order: 0, peakKnownish: 0, peakMastered: 0, words: [] } }],
};

const cur = () => page.evaluate(() => window.__puzzleCurrent || null);

try {
  await page.addInitScript((s) => { try { localStorage.setItem('crystal-spell-caverns:v1', JSON.stringify(s)); } catch {} }, SEED);
  await page.goto(URL, { waitUntil: 'networkidle' });
  if (await page.$('.tap-to-start')) await page.click('.tap-to-start');
  if (await page.locator('.profile-card:not(.add)').count()) await page.locator('.profile-card:not(.add)').first().click();
  await page.locator('.menu-card.craft').click();
  await page.waitForSelector('.puzzle .slot', { timeout: 8000 });

  let verified = false;
  let sawProper = null;
  for (let i = 0; i < 60 && !verified; i++) {
    // craft sessions are 6 words; click "Craft again" on the reward to keep going (top of loop)
    if (await page.$('.reward')) { await page.click('.reward .btn.primary'); await page.waitForSelector('.puzzle .slot', { timeout: 6000 }).catch(() => {}); await page.waitForTimeout(250); continue; }
    const c = await cur();
    if (!c || !c.word) { await page.waitForTimeout(150); continue; }

    if (c.isProper) {
      sawProper = c.word;
      // place ONLY the first letter, then inspect the rendered slot vs the tray tile
      const check = await page.evaluate(() => {
        const w = window.__puzzleCurrent.word;
        const tile = [...document.querySelectorAll('.tray-tile')].find((x) => !x.classList.contains('used') && x.textContent === w[0]);
        const tileText = tile ? tile.textContent : null;
        if (tile) tile.click();
        const slot0 = document.querySelectorAll('.slots .slot')[0];
        return { w, tileText, slot0: slot0 ? slot0.textContent : null };
      });
      const slotUpper = check.slot0 === check.w[0].toUpperCase();
      const tileLower = check.tileText === check.w[0]; // data target is lowercased → tile is lowercase
      if (!tileLower) issues.push(`FAIL: tray tile for "${check.w}" was not lowercase ("${check.tileText}")`);
      if (!slotUpper) issues.push(`FAIL: proper noun "${check.w}" slot 0 rendered "${check.slot0}", expected "${check.w[0].toUpperCase()}"`);

      // place the SECOND letter too — it must stay lowercase
      const check2 = await page.evaluate(() => {
        const w = window.__puzzleCurrent.word;
        const tile = [...document.querySelectorAll('.tray-tile')].find((x) => !x.classList.contains('used') && x.textContent === w[1]);
        if (tile) tile.click();
        const slot1 = document.querySelectorAll('.slots .slot')[1];
        return { c1: w[1], slot1: slot1 ? slot1.textContent : null };
      });
      if (check2.slot1 !== check2.c1) issues.push(`FAIL: slot 1 should stay lowercase "${check2.c1}", got "${check2.slot1}"`);

      await page.screenshot({ path: `${OUT}/01-${check.w}-capitalized.png` });

      // finish the build correctly (lowercase) → must grade correct (caps are display-only)
      await page.evaluate(() => {
        const w = window.__puzzleCurrent.word;
        for (let p = 0; p < w.length; p++) {
          const slot = document.querySelectorAll('.slots .slot')[p];
          if (slot && slot.classList.contains('filled')) continue;
          const t = [...document.querySelectorAll('.tray-tile')].find((x) => !x.classList.contains('used') && x.textContent === w[p]);
          if (t) t.click();
        }
      });
      await page.waitForTimeout(1300);
      const after = await cur();
      const advanced = !after || after.word !== c.word || !!(await page.$('.reward'));
      if (!advanced) issues.push(`FAIL: lowercase build of proper noun "${c.word}" did not grade correct / advance`);
      verified = true;
      console.log(`proper noun       : "${check.w}" → slot0 "${check.slot0}" (tile "${check.tileText}") ${slotUpper && tileLower ? '✅' : '❌'}`);
      break;
    }

    // a common word: build it correctly to advance toward the proper noun
    await page.evaluate(() => {
      const w = window.__puzzleCurrent.word;
      for (let p = 0; p < w.length; p++) {
        const slot = document.querySelectorAll('.slots .slot')[p];
        if (slot && slot.classList.contains('filled')) continue;
        const t = [...document.querySelectorAll('.tray-tile')].find((x) => !x.classList.contains('used') && x.textContent === w[p]);
        if (t) t.click();
      }
    });
    await page.waitForTimeout(1200);
  }

  if (!verified) issues.push(`FAIL: no proper noun was served within 24 words (saw: ${sawProper || 'none'}) — cannot verify caps`);

  console.log('\n— §4 caps QA —');
  console.log('proper noun seen  :', sawProper || 'NONE');
  console.log('\n' + (issues.length ? `ISSUES (${issues.length}):\n- ` + issues.join('\n- ') : 'ISSUES: none ✅'));
} catch (e) {
  issues.push('PROBE ERROR: ' + e.message);
  console.log('\nISSUES:', issues);
} finally {
  await browser.close();
}
process.exit(issues.length ? 1 : 0);
