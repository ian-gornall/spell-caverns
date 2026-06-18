// scripts/qa_probe2.mjs — SCRATCH: hunt for text-overflow in answer tiles / build
// slots when LONG words appear (rhythm 4-choice + puzzle), across viewports. The
// happy-path QA only saw short words; the dataset has 13-char words. Read the PNGs.
import { chromium } from 'playwright';
import { mkdir, rm } from 'node:fs/promises';

const URL = process.env.URL || 'http://localhost:5173';
const OUT = 'scripts/qa/probe2';
await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const VPS = [
  { name: 'ipad102', width: 810, height: 1080 },
  { name: 'mini', width: 744, height: 1133 },
];

for (const vp of VPS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'networkidle' });

  // Find the longest words + a long misspelling set, then render real .tile / .slot
  // nodes with them inside the live grid and measure horizontal overflow.
  const report = await page.evaluate(async () => {
    const { WORDS } = await import('/data/words.js');
    const longest = [...WORDS].sort((a, b) => b.word.length - a.word.length).slice(0, 8).map((w) => w.word);

    // build a throwaway rhythm-like tiles grid with the longest words as 4 options
    const screen = document.createElement('div');
    screen.className = 'screen rhythm';
    const body = document.createElement('div'); body.className = 'play-body';
    const az = document.createElement('div'); az.className = 'answer-zone';
    const tiles = document.createElement('div'); tiles.className = 'tiles';
    for (const w of longest.slice(0, 4)) {
      const b = document.createElement('button'); b.className = 'tile'; b.textContent = w; tiles.appendChild(b);
    }
    az.appendChild(tiles); body.appendChild(az); screen.appendChild(body);
    document.getElementById('app').replaceChildren(screen);

    // also a puzzle slot row for the longest word
    const slots = document.createElement('div'); slots.className = 'slots';
    for (const ch of longest[0]) {
      const s = document.createElement('button'); s.className = 'slot filled'; s.textContent = ch; slots.appendChild(s);
    }
    az.appendChild(slots);

    await new Promise((r) => requestAnimationFrame(r));
    const tileNodes = [...tiles.querySelectorAll('.tile')];
    const tileOverflow = tileNodes
      .map((n) => ({ w: n.textContent, over: n.scrollWidth - n.clientWidth }))
      .filter((x) => x.over > 1);
    const slotsRow = slots.getBoundingClientRect();
    return {
      longest,
      tileOverflow,
      slotsWrapped: slots.scrollHeight > slots.querySelector('.slot').offsetHeight + 8,
      slotsRight: Math.round(slotsRow.right),
      vw: window.innerWidth,
    };
  });

  await page.screenshot({ path: `${OUT}/${vp.name}-longwords.png` });
  console.log(`\n[${vp.name} ${vp.width}x${vp.height}] longest: ${report.longest.join(', ')}`);
  console.log(`  tile horizontal overflow: ${report.tileOverflow.length ? JSON.stringify(report.tileOverflow) : 'none'}`);
  console.log(`  slot row wrapped: ${report.slotsWrapped}  right=${report.slotsRight} vw=${report.vw}`);
  await ctx.close();
}
await browser.close();
console.log(`\nProbe2 screenshots in ${OUT}/`);
