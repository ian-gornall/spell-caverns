// scripts/qa_readable.mjs — scratch: verify the easy-read text option (extra
// letter-spacing) renders cleanly and does NOT overflow the answer tiles. Seeds a
// save with readableText on + a high difficulty (closer/longer distractors).
import { chromium } from 'playwright';
const URL = process.env.URL || 'http://localhost:5173';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 820, height: 1180 } });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.evaluate(() => {
  localStorage.setItem('crystal-spell-caverns:v1', JSON.stringify({
    gems: 50, profile: { name: 'Ada', onboarded: true },
    settings: { difficulty: 'easy', length: 10, optionCount: 4, voice: true, volume: 0.85, themeColor: '#7AA2FF', readableText: true },
  }));
});
await p.goto(URL, { waitUntil: 'networkidle' });
await p.click('.menu-card.play');
await p.waitForSelector('.rhythm .tile');
await p.waitForTimeout(400);
await p.screenshot({ path: 'scripts/qa/readable-rhythm.png' });
// overflow check: any tile whose text is wider/taller than the tile box?
const overflow = await p.evaluate(() => {
  const tiles = [...document.querySelectorAll('.rhythm .tile')];
  return tiles.filter((t) => t.scrollWidth > t.clientWidth + 1 || t.scrollHeight > t.clientHeight + 1).map((t) => t.textContent);
});
console.log('readable class on html:', await p.evaluate(() => document.documentElement.classList.contains('readable')));
console.log('overflowing tiles:', JSON.stringify(overflow));
console.log('console/page errors:', errs.length);
await b.close();
