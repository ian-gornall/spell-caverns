// scripts/qa_placement.mjs — §C1 placement diagnostic, end-to-end (Ian 2026-06-22).
// Drives the NEW first-run: welcome → name → colour → AGE → (sync) → the diagnostic
// Craft session (the ±100 walk), spelling a MIXED speller (clean on short words, a
// hinted "miss" on longer ones) until the walk seeds a cavern level. Verifies the age
// step renders, the diagnostic runs + completes, categories.level is a real band, and
// placement is marked done — with 0 console errors. Run: npm start, then node this.
import { chromium } from 'playwright';
import { mkdir, rm } from 'node:fs/promises';

const URL = process.env.URL || 'http://localhost:5173';
const OUT = 'scripts/qa_placement';
await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 820, height: 1180 } });
const issues = [];
page.on('pageerror', (e) => issues.push('pageerror: ' + e.message));
page.on('console', (m) => {
  if (m.type() === 'error' && !/Failed to load resource.*\b404\b/.test(m.text())) issues.push('console.error: ' + m.text());
});

const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` });
const goNext = () => page.click('.onboard-go:not([disabled])');

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.goto(URL, { waitUntil: 'networkidle' });

// --- onboarding ------------------------------------------------------------
// step 0: Tap to start (first-run audio gate)
await page.waitForSelector('.tap-to-start, .onboard-go');
if (await page.$('.tap-to-start')) await page.click('.tap-to-start');
await page.waitForSelector('.onboard-go'); // welcome
await goNext(); // Let's go
await page.waitForSelector('.onboard-name');
await page.fill('.onboard-name', 'Pip');
await goNext(); // That's me
await page.waitForSelector('.colour-swatch');
await page.click('.colour-swatch'); // pick a colour
await goNext(); // Perfect → AGE step

// step 4: AGE (the new question)
await page.waitForSelector('.age-grid .age-btn');
const ageCount = await page.$$eval('.age-grid .age-btn', (els) => els.length);
await shot('01-age-step');
await page.click('.age-grid .age-btn:nth-child(4)'); // age 8 (5,6,7,8 → 4th)
await page.click('.onboard-go.level-cta'); // Let's dig →

// step 4b: sync option (first run)
await page.waitForSelector('.onboard-go');
if (await page.$('text=Just this one')) await page.click('text=Just this one');
// step 5b: reminder opt-in MAY appear (push-capable + permission default)
if (await page.$('text=Maybe later')) await page.click('text=Maybe later');
// step 5: "Start digging!"
await page.waitForSelector('.onboard-go.big, .screen.puzzle');
if (await page.$('.onboard-go.big')) await page.click('.onboard-go.big');

// --- the diagnostic Craft session -----------------------------------------
await page.waitForSelector('.screen.puzzle');
const firstHook = await page.evaluate(() => window.__puzzleCurrent || null);
if (!firstHook || !firstHook.placement) issues.push('FAIL: first Craft is not in placement mode');
await shot('02-diagnostic-first-word');

await page.evaluate(() => { window.__clipLog = []; }); // reset the actual-clip-URL log for the diagnostic
const seen = new Set();
const displayedOrder = []; // distinct words in the order they were shown (across all sessions)
let lastDisplayed = null;
let hintedWord = null;
let sessions = 0; // diagnostic craft sessions (reward screens) before placement
const isPlaced = () => page.evaluate(() => {
  const c = JSON.parse(localStorage.getItem('crystal-spell-caverns:v1'));
  const p = c.profiles.find((x) => x.id === c.activeId);
  return !!(p.placement && p.placement.done);
});
// the diagnostic spans MULTIPLE 6-word sessions — keep playing (clicking "Craft again" between
// sessions) until the profile is PLACED (3 misses in a band). A MIXED speller (miss on long words).
for (let i = 0; i < 80; i++) {
  if (await isPlaced()) break;
  if (await page.$('.reward')) { // between-session reward → continue the diagnostic
    sessions += 1;
    await page.click('.reward .btn.primary');
    await page.waitForSelector('.screen.puzzle .slot, .reward', { timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(300);
    continue;
  }
  const cur = await page.evaluate(() => window.__puzzleCurrent || null);
  if (!cur || !cur.word) { await page.waitForTimeout(150); continue; }
  seen.add(cur.word);
  if (cur.word !== lastDisplayed) { displayedOrder.push(cur.word); lastDisplayed = cur.word; }
  if (cur.word.length > 5 && hintedWord !== cur.word) {
    hintedWord = cur.word;
    const hintBtn = page.locator('.puzzle-controls .btn.ghost').first();
    if (await hintBtn.count()) await hintBtn.click(); // → firstTry false (counts as a miss)
  }
  await page.evaluate(() => {
    const w = window.__puzzleCurrent?.word;
    if (!w) return;
    for (let p = 0; p < w.length; p++) {
      const slot = document.querySelectorAll('.slots .slot')[p];
      if (slot && slot.classList.contains('filled')) continue; // already placed (e.g. hint-locked)
      const t = [...document.querySelectorAll('.tray-tile')].find((x) => !x.classList.contains('used') && x.textContent === w[p]);
      if (t) t.click();
    }
  });
  await page.waitForTimeout(900); // let solve()/wrongSubmit settle + advance
}
const built = seen.size;
await shot('03-completion');

// --- verify the seeded state ----------------------------------------------
const placed = await page.evaluate(() => {
  const c = JSON.parse(localStorage.getItem('crystal-spell-caverns:v1'));
  const p = c.profiles.find((x) => x.id === c.activeId);
  return { placement: p.placement, level: p.categories?.level, startLevel: p.startLevel, learning: (p.categories?.words || []).filter((w) => w.category === 'learning').length, known: (p.categories?.words || []).filter((w) => w.category === 'known').length };
});

console.log('\n— §C1 placement QA —');
console.log('age buttons shown :', ageCount);
console.log('diagnostic sessions:', sessions, '(6-word craft sets before placing)');
console.log('words crafted     :', built, '| distinct shown', displayedOrder.length);
console.log('placement state   :', JSON.stringify(placed.placement && { done: placed.placement.done, band: placed.placement.band }));
console.log('categories.level  :', placed.level, '(cavern band)');
console.log('startLevel synced :', placed.startLevel);
console.log('learning / known  :', placed.learning, '/', placed.known);

// Ian's bug: the diagnostic must NOT repeat words. Each distinct word should appear once.
if (displayedOrder.length !== built) issues.push(`FAIL: diagnostic repeated words (${displayedOrder.length} shown, ${built} distinct)`);
if (sessions < 1) issues.push('FAIL: diagnostic placed in a single session (should span multiple 6-word sets until 3-in-a-band)');

// AUDIO-ORDER check (§C1 fix): the words that ACTUALLY played must stay in DISPLAY order — never
// a stale word after a newer one was shown (the "heard the wrong word" bug). __spokenLog records
// only dictations that started playing (preempted/dropped stale ones never get here).
const spoken = await page.evaluate(() => window.__spokenLog || []);
const diagSet = new Set(displayedOrder);
const spokenWords = spoken.filter((w) => diagSet.has(w)); // ignore onboarding narration
let di = 0;
let audioInOrder = true;
for (const w of spokenWords) {
  let found = -1;
  for (let k = di; k < displayedOrder.length; k++) if (displayedOrder[k] === w) { found = k; break; }
  if (found < 0) { audioInOrder = false; break; } // a word played AFTER a later word was shown
  di = found; // repeats (hear-again / re-dictate) of the same word stay at the same index
}
console.log('words spoken      :', spokenWords.length, 'of', displayedOrder.length, 'shown', audioInOrder ? '(in display order ✅)' : '(OUT OF ORDER ❌)');

// stronger: the ACTUAL clip FILES that played must each match a displayed word, in order — this
// catches a wrong-FILE play (the "documents shows but purpose.mp3 plays" bug), which the text log
// can't. (__clipLog records every /audio/words/<slug>.mp3 that started playing.)
const clipLog = await page.evaluate(() => window.__clipLog || []);
const playedWords = clipLog.filter((u) => u.includes('/audio/words/')).map((u) => u.split('/words/')[1].replace('.mp3', ''));
const shownSlugs = displayedOrder.map((w) => w.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
let ci = 0;
let clipsInOrder = true;
let badClip = null;
for (const c of playedWords) {
  let f = -1;
  for (let k = ci; k < shownSlugs.length; k++) if (shownSlugs[k] === c) { f = k; break; }
  if (f < 0) { clipsInOrder = false; badClip = c; break; }
  ci = f;
}
console.log('clips played      :', playedWords.length, 'word-clips', clipsInOrder ? '(all matched the shown word, in order ✅)' : `(WRONG FILE: ${badClip} ❌)`);
if (!clipsInOrder) issues.push(`FAIL: clip "${badClip}.mp3" played while a different word was shown (the wrong-word bug)`);

if (ageCount !== 9) issues.push(`FAIL: expected 9 age buttons, got ${ageCount}`);
if (!placed.placement || placed.placement.done !== true) issues.push('FAIL: placement not marked done');
if (!(placed.level >= 1)) issues.push('FAIL: categories.level is not a band ≥ 1');
if (placed.startLevel !== placed.level) issues.push('FAIL: startLevel not synced to the entered band');
if (!(placed.learning > 0)) issues.push('FAIL: learning set is empty after placement');
if (!audioInOrder) issues.push('FAIL: spoken audio played a STALE word out of display order (the wrong-word bug)');

console.log('\n' + (issues.length ? `ISSUES (${issues.length}):\n- ` + issues.join('\n- ') : 'ISSUES: none ✅'));
await browser.close();
process.exit(issues.length ? 1 : 0);
