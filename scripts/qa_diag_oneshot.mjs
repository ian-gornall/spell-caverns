// scripts/qa_diag_oneshot.mjs — §36 next-step #1 (Ian 2026-06-22c): in the PLACEMENT diagnostic a
// word is ONE shot. A WRONG full build must record the miss and advance STRAIGHT to the next word —
// the child does NOT get to keep the fitting letters and retry (that's normal Craft, unchanged).
//
// This drives the new first-run to the diagnostic, deliberately builds the FIRST word WRONG (a
// complete-but-incorrect arrangement), and asserts:
//   (a) the verdict chip shows the one-shot "Next word" outcome (NOT "Keep the letters that fit"),
//   (b) the displayed word ADVANCES (the old retry behaviour would stay on the same word).
// Run: npm start (port 5173), then `node scripts/qa_diag_oneshot.mjs`.
import { chromium } from 'playwright';
import { mkdir, rm } from 'node:fs/promises';

const URL = process.env.URL || 'http://localhost:5173';
const OUT = 'scripts/qa_diag_oneshot';
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

// --- onboarding → the diagnostic Craft (same flow as qa_placement) ---------
await page.waitForSelector('.tap-to-start, .onboard-go');
if (await page.$('.tap-to-start')) await page.click('.tap-to-start');
await page.waitForSelector('.onboard-go');
await goNext(); // Let's go
await page.waitForSelector('.onboard-name');
await page.fill('.onboard-name', 'Pip');
await goNext(); // That's me
await page.waitForSelector('.colour-swatch');
await page.click('.colour-swatch');
await goNext(); // → AGE step
await page.waitForSelector('.age-grid .age-btn');
await page.click('.age-grid .age-btn:nth-child(4)'); // age 8
await page.click('.onboard-go.level-cta');
await page.waitForSelector('.onboard-go');
if (await page.$('text=Just this one')) await page.click('text=Just this one');
if (await page.$('text=Maybe later')) await page.click('text=Maybe later');
await page.waitForSelector('.onboard-go.big, .screen.puzzle');
if (await page.$('.onboard-go.big')) await page.click('.onboard-go.big');

// --- the diagnostic: build the FIRST word WRONG ----------------------------
await page.waitForSelector('.screen.puzzle .slot');
const first = await page.evaluate(() => window.__puzzleCurrent || null);
if (!first || !first.placement) issues.push('FAIL: first Craft is not in placement mode');
const before = first && first.word;
await shot('01-first-word');

// Fill every slot with a deliberately-WRONG complete build: each click fills the first empty
// slot left-to-right, so for slot k prefer any unused tray tile whose letter != target[k]
// (guarantees at least slot 0 mismatches → gradeBuild reports complete-but-incorrect).
const res = await page.evaluate(() => {
  const w = window.__puzzleCurrent && window.__puzzleCurrent.word;
  if (!w) return { error: 'no word' };
  for (let k = 0; k < w.length; k++) {
    const free = [...document.querySelectorAll('.tray-tile')].filter((x) => !x.classList.contains('used'));
    if (!free.length) break;
    const pick = free.find((x) => x.textContent !== w[k]) || free[0];
    pick.click();
  }
  // read the outcome SYNCHRONOUSLY — flashVerdict runs inside the final click handler, the
  // advance is a 1.1s setTimeout, so the chip still shows the one-shot result right now.
  const filled = [...document.querySelectorAll('.slots .slot')].map((s) => s.textContent).join('');
  return {
    word: w,
    built: filled,
    wrongByConstruction: filled !== w,
    chip: (document.querySelector('.verdict-chip') || {}).textContent || '',
    verdict: (document.querySelector('.verdict') || {}).textContent || '',
  };
});
await shot('02-after-wrong-build');

if (res.error) issues.push('FAIL: ' + res.error);
if (!res.wrongByConstruction) issues.push(`FAIL: build was not actually wrong (built "${res.built}" === "${res.word}")`);
// the one-shot path sets the chip to "+N 💎 · Next word"; the OLD retry path sets the verdict to
// "Keep the letters that fit" and leaves the chip empty.
const oneShotChip = /Next word/i.test(res.chip);
const retryVerdict = /Keep the letters that fit/i.test(res.verdict);
// the spoken + shown phrase must NOT imply a retry (Ian: it said "give it another go" — wrong)
const retryPhrase = /again|another|try again|once more/i.test(res.verdict);
if (!oneShotChip) issues.push(`FAIL: expected a one-shot "Next word" chip, got chip="${res.chip}" verdict="${res.verdict}"`);
if (retryVerdict) issues.push('FAIL: diagnostic showed the RETRY verdict "Keep the letters that fit" (old behaviour)');
if (retryPhrase) issues.push(`FAIL: diagnostic miss phrase implies a retry: "${res.verdict}" (one-shot must move ON)`);

// the word must ADVANCE (old behaviour would stay on `before` to retry)
await page.waitForTimeout(1400);
const after = await page.evaluate(() => window.__puzzleCurrent || null);
const advanced = after && after.word && after.word !== before;
await shot('03-advanced');
if (!advanced) issues.push(`FAIL: word did not advance after a wrong build (still "${after && after.word}" — retry behaviour)`);

console.log('\n— §36 #1 diagnostic one-shot QA —');
console.log('first word        :', before, '(placement:', first && first.placement, ')');
console.log('wrong build built :', res.built, '(target', res.word + ')');
console.log('verdict chip      :', JSON.stringify(res.chip), '| verdict', JSON.stringify(res.verdict));
console.log('advanced to       :', after && after.word, advanced ? '(advanced ✅)' : '(STAYED ❌)');
console.log('\n' + (issues.length ? `ISSUES (${issues.length}):\n- ` + issues.join('\n- ') : 'ISSUES: none ✅'));
await browser.close();
process.exit(issues.length ? 1 : 0);
