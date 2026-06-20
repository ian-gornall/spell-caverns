// scripts/qa_s32.mjs — visual-QA probe for §32 voice spelling (spell out loud).
// ⚠️ PARKED: voice is SHELVED (VOICE_SPELLING_ENABLED=false in modes/mastery.js), so the 🎤 button
// no longer renders and this probe will fail until the flag is flipped back on. Kept for the
// eventual push-to-talk + on-device-letter-model rebuild (HANDOFF §32).
// Stubs window.webkitSpeechRecognition so spoken letters can be driven deterministically (a real
// mic can't be simulated headlessly — Ian verifies actual recognition on-device). Checks:
//   - first tap → GROWN-UP consent gate (math + consent box); wrong answer blocked, right passes
//   - voice mode UI (mic indicator, Check, draw/type hidden), letters fill as "spoken", Check grades
//   - consent is remembered (second entry skips the gate); Settings shows a revoke control
// Run: npm start (one terminal) then: node scripts/qa_s32.mjs
import { chromium } from 'playwright';
import { mkdir, rm } from 'node:fs/promises';

const URL = process.env.URL || 'http://localhost:5173';
const OUT = 'scripts/qa_s32';
await rm(OUT, { recursive: true, force: true }).catch(() => {});
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const issues = [];
const ok = (c, m) => console.log((c ? '✓ ' : '✗ ') + m) || (!c && issues.push(m));

const known = (w, i) => ({ word: w, tier: 1, pattern: 'short-o', rank: 50 + i, category: 'known', craftStreak: 2, craftAttempts: 2, craftCorrect: 2, order: i + 1 });
const WORDS = ['lot', 'cot', 'tot'];
const SEED = {
  schema: 2, syncCode: null, syncConsent: false, parentPassword: null, activeId: 'm1',
  profiles: [{
    id: 'm1', version: 1, profile: { name: 'Speaker', onboarded: true },
    settings: { length: 5 },
    categories: { setSize: 3, level: 1, recent: [], order: WORDS.length, peakKnownish: 3, peakMastered: 0, words: WORDS.map(known) },
  }],
};

// inject a fake SpeechRecognition that lets the test push a transcript via window.__emit().
const FAKE_SPEECH = () => {
  window.__fakeSpeech = { last: null };
  class FakeRec {
    constructor() { this.onresult = null; this.onerror = null; this.onend = null; }
    start() { window.__fakeSpeech.last = this; }
    stop() { if (this.onend) this.onend(); }
  }
  window.webkitSpeechRecognition = FakeRec;
  window.SpeechRecognition = FakeRec;
  // emit one spoken PHRASE: a final result, then onend (single-shot recogniser ends → restarts).
  window.__emit = (transcript) => {
    const r = window.__fakeSpeech.last;
    if (!r) return;
    if (r.onresult) {
      const result = { 0: { transcript, confidence: 0.9 }, length: 1, isFinal: true };
      r.onresult({ resultIndex: 0, results: { 0: result, length: 1 } });
    }
    if (r.onend) r.onend();
  };
};

async function newPage(seed = SEED) {
  const page = await browser.newPage({ viewport: { width: 1024, height: 820 } });
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource.*\b404\b/.test(m.text())) issues.push('console.error: ' + m.text()); });
  page.on('pageerror', (e) => issues.push('pageerror: ' + e.message));
  await page.addInitScript(FAKE_SPEECH);
  await page.addInitScript((s) => { try { if (!localStorage.getItem('crystal-spell-caverns:v1')) localStorage.setItem('crystal-spell-caverns:v1', JSON.stringify(s)); } catch {} }, seed);
  return page;
}
async function gotoMastery(page) {
  await page.goto(URL, { waitUntil: 'networkidle' });
  if (await page.locator('.profile-card:not(.add)').count()) await page.locator('.profile-card:not(.add)').first().click();
  await page.waitForSelector('.menu-card', { timeout: 6000 });
  await page.locator('.menu-card.mastery').click();
  await page.waitForSelector('.draw-boxes', { timeout: 8000 });
  await page.waitForTimeout(300);
}
async function clearGate(page, { tickConsent = true } = {}) {
  const q = await page.locator('.gate-q').textContent();
  const m = q.match(/what is (\d+) \+ (\d+)/i);
  const sum = +m[1] + +m[2];
  if (tickConsent) await page.locator('.gate-consent input').check();
  await page.locator('.gate-answer').fill(String(sum));
  await page.locator('.gate-actions .btn.primary').click();
  return sum;
}

try {
  console.log('\n=== §32 voice spelling ===');
  const page = await newPage();
  await gotoMastery(page);
  const word = await page.evaluate(() => window.__masteryCurrent?.word);

  // tap "Spell out loud" → consent gate appears
  await page.locator('.draw-controls button', { hasText: /Spell out loud/ }).click();
  ok(await page.locator('.gate-overlay').count() > 0, 'first tap → grown-up consent gate appears');
  await page.screenshot({ path: `${OUT}/v01-consent-gate.png` });

  // wrong math answer is rejected
  await page.locator('.gate-consent input').check();
  await page.locator('.gate-answer').fill('999');
  await page.locator('.gate-actions .btn.primary').click();
  ok(await page.locator('.gate-overlay').count() > 0 && (await page.locator('.gate-err').textContent())?.length > 0, 'wrong math answer is rejected (gate stays up)');

  // correct answer (consent already ticked) passes → voice mode
  await clearGate(page, { tickConsent: false });
  await page.waitForTimeout(200);
  ok(await page.locator('.gate-overlay').count() === 0, 'correct answer closes the gate');
  const mode = await page.evaluate(() => window.__masteryCurrent?.mode);
  ok(mode === 'voice', `voice mode active (mode=${mode})`);
  ok(await page.locator('.mic-indicator').isVisible(), 'mic "Listening…" indicator shown');
  ok(!(await page.locator('.draw-controls button', { hasText: /Type it|Draw it/ }).isVisible()), 'draw/type toggle hidden during voice');
  ok(await page.locator('.mastery .sentence').isVisible(), 'voice: blanked sentence shown (no confusing peek/hide)');
  await page.screenshot({ path: `${OUT}/v02-listening.png` });

  // "speak" the letters → slots fill; nothing grades until Check
  for (const ltr of word) await page.evaluate((t) => window.__emit(t), ltr);
  await page.waitForTimeout(200);
  const built = (await page.locator('.lbox-letter').allTextContents()).join('');
  ok(built === word, `spoken letters filled the boxes ("${built}" == "${word}")`);
  ok(/heard/i.test((await page.locator('.voice-heard').textContent()) || ''), 'live "heard:" readout shows what the mic understood');
  ok((await page.locator('.mastery .verdict').textContent())?.trim() === '', 'no grading before Check');
  ok(!(await page.locator('.check-btn').isDisabled()), 'Check enabled once all letters are in');
  await page.screenshot({ path: `${OUT}/v03-spoken.png` });

  // tap a box to clear a letter, re-say it
  await page.locator('.lbox').first().click();
  await page.waitForTimeout(150);
  ok(await page.locator('.lbox.filled').count() === word.length - 1, 'tap a box → clears that letter (re-say)');
  await page.evaluate((t) => window.__emit(t), word[0]);
  await page.waitForTimeout(150);
  ok(await page.locator('.lbox.filled').count() === word.length, 're-said letter re-fills');

  // submit
  const gemsBefore = +(await page.locator('.gem-count').first().textContent());
  await page.locator('.check-btn').click();
  await page.waitForTimeout(500);
  const verdict = (await page.locator('.mastery .verdict').textContent().catch(() => ''))?.trim();
  ok(/master/i.test(verdict || ''), `Check graded the spoken word ("${verdict}")`);
  ok(+(await page.locator('.gem-count').first().textContent()) > gemsBefore, 'gems rewarded');
  await page.screenshot({ path: `${OUT}/v04-mastered.png` });
  await page.close();

  // consent is REMEMBERED: a profile that already consented goes straight to voice (no gate)
  console.log('\n=== consent remembered + revoke ===');
  const SEED2 = JSON.parse(JSON.stringify(SEED));
  SEED2.voiceConsent = true;
  const page2 = await newPage(SEED2);
  await gotoMastery(page2);
  await page2.locator('.draw-controls button', { hasText: /Spell out loud/ }).click();
  await page2.waitForTimeout(250);
  ok(await page2.locator('.gate-overlay').count() === 0, 'consent remembered → no gate on a later visit');
  ok((await page2.evaluate(() => window.__masteryCurrent?.mode)) === 'voice', 'goes straight to voice mode');

  // Settings shows the revoke control (rendered eagerly inside the collapsed grown-up disclosure)
  await page2.goto(URL, { waitUntil: 'networkidle' });
  if (await page2.locator('.profile-card:not(.add)').count()) await page2.locator('.profile-card:not(.add)').first().click();
  await page2.locator('.menu-card', { hasText: 'Settings' }).click();
  await page2.waitForTimeout(300);
  ok(await page2.locator('text=Turn off voice spelling').count() > 0, 'Settings → Parents has a "Turn off voice spelling" revoke');
  await page2.close();

  console.log('\nISSUES:', issues.length ? issues : 'none');
  process.exitCode = issues.length ? 1 : 0;
} catch (e) {
  console.error('PROBE ERROR:', e.message);
  console.log('ISSUES so far:', issues);
  process.exitCode = 1;
} finally {
  await browser.close();
}
