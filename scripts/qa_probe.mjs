// scripts/qa_probe.mjs — SCRATCH probe for the QA-and-fix loop (HANDOFF §14).
// Tests the I1 layout across several viewports + a reduced height (Safari chrome),
// measures whether the answer area overflows the viewport, and exercises a real
// touch-DRAG in puzzle (I6). Not a regression gate — read the PNGs + the printed
// measurements. Usage:  npm start   then   node scripts/qa_probe.mjs
import { chromium } from 'playwright';
import { mkdir, rm } from 'node:fs/promises';

const URL = process.env.URL || 'http://localhost:5173';
const OUT = 'scripts/qa/probe';
await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

const VIEWPORTS = [
  { name: 'ipad102-portrait', width: 810, height: 1080 },
  { name: 'ipad-mini-portrait', width: 744, height: 1133 },
  { name: 'landscape', width: 1080, height: 810 },
  { name: 'reduced-height', width: 820, height: 680 }, // Safari toolbar showing
];

const browser = await chromium.launch();

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    hasTouch: true,
    isMobile: true,
  });
  const page = await ctx.newPage();
  const issues = [];
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && issues.push(`console.${m.type()}: ${m.text()}`));
  page.on('pageerror', (e) => issues.push(`pageerror: ${e.message}`));

  await page.goto(URL, { waitUntil: 'networkidle' });
  // Seed an ONBOARDED save so we land on home (skip first-run onboarding, which was
  // added after this probe was written — otherwise .menu-card.play never appears).
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem(
      'crystal-spell-caverns:v1',
      JSON.stringify({ version: 1, profile: { name: 'QA', onboarded: true } }),
    );
  });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${OUT}/${vp.name}-01home.png` });

  // rhythm
  await page.click('.menu-card.play');
  await page.waitForSelector('.rhythm .tile');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${vp.name}-02rhythm.png` });
  const rOver = await page.evaluate(() => {
    const tiles = [...document.querySelectorAll('.rhythm .tile')];
    const last = tiles[tiles.length - 1];
    const r = last.getBoundingClientRect();
    return { bottom: Math.round(r.bottom), vh: window.innerHeight, overflow: Math.round(r.bottom - window.innerHeight) };
  });

  // puzzle + touch drag
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.click('.menu-card.craft');
  await page.waitForSelector('.puzzle .slot');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${vp.name}-03puzzle.png` });
  const pOver = await page.evaluate(() => {
    const tray = [...document.querySelectorAll('.puzzle .tray-tile')];
    const last = tray[tray.length - 1];
    const r = last.getBoundingClientRect();
    return { bottom: Math.round(r.bottom), vh: window.innerHeight, overflow: Math.round(r.bottom - window.innerHeight) };
  });

  // real touch-DRAG: drag the first needed letter tile onto the first slot
  let dragResult = 'n/a';
  try {
    const pc = await page.evaluate(() => window.__puzzleCurrent || null);
    if (pc) {
      const need = pc.word[0];
      const tile = page.locator(`.puzzle .tray-tile:not(.used)[data-letter="${need}"]`).first();
      const slot = page.locator('.puzzle .slot').first();
      const tb = await tile.boundingBox();
      const sb = await slot.boundingBox();
      // simulate a finger drag with pointer events (touch context)
      await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2);
      await page.mouse.down();
      await page.mouse.move(tb.x + 20, tb.y - 20, { steps: 4 });
      await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2, { steps: 8 });
      await page.mouse.up();
      await page.waitForTimeout(150);
      const filled = await page.evaluate((n) => {
        const s = document.querySelector('.puzzle .slot');
        return s && s.textContent.trim() === n;
      }, need);
      dragResult = filled ? `OK (dropped "${need}" into slot 0)` : `FAILED (slot 0 not filled with "${need}")`;
      await page.screenshot({ path: `${OUT}/${vp.name}-04puzzle-afterdrag.png` });
    }
  } catch (e) {
    dragResult = 'threw: ' + e.message;
  }

  console.log(`\n[${vp.name} ${vp.width}x${vp.height}]`);
  console.log(`  rhythm last tile bottom=${rOver.bottom} vh=${rOver.vh} overflow=${rOver.overflow}px`);
  console.log(`  puzzle last tray bottom=${pOver.bottom} vh=${pOver.vh} overflow=${pOver.overflow}px`);
  console.log(`  touch-drag: ${dragResult}`);
  if (issues.length) console.log('  ISSUES: ' + issues.join(' | '));
  await ctx.close();
}

await browser.close();
console.log(`\nProbe screenshots in ${OUT}/`);
