// scripts/qa_active_pause.mjs — §37 A ACTIVE-ENGAGEMENT auto-pause (Ian 2026-06-23). Drives a fast-
// config session: ~continuous activity for > lockMs → the soft "brain break" overlay must appear,
// show the LEARNING words, and be (a) GROWN-UP-dismissable via the arithmetic gate and (b) AUTO-
// unlock after the (shortened) break. window.__active* knobs shrink the 20-min/5-min thresholds.
// Run: npm start, then node scripts/qa_active_pause.mjs
import { chromium } from 'playwright';

const URL = process.env.URL || 'http://localhost:5173';
const KEY = 'crystal-spell-caverns:v1';
// Fast config: lock after ~3s of continuous play, a 30s break-gap (so our taps never reset it),
// a 2.5s break, and a 300ms heartbeat (the overlay pops within ~300ms of crossing the threshold).
const LOCK_MS = 3000, BREAK_MS = 30000, PAUSE_MS = 2500, HEARTBEAT_MS = 300;
const issues = [];

// A PLACED profile with three LEARNING-category words (so the break shows the word chips).
const SEED = {
  schema: 2, syncCode: null, syncConsent: false, parentPassword: null, activeId: 'A1',
  profiles: [{ id: 'A1', version: 1, profile: { name: 'Active', onboarded: true }, startLevel: 1,
    placement: { done: true, age: 9, band: 1 },
    categories: { setSize: 10, level: 1, recent: [], order: 10, seen: 3, reviewPending: { craft: 0, mastery: 0 },
      peakKnownish: 0, peakMastered: 0, peakLevel: 1,
      words: [
        { word: 'cat', tier: 1, band: 1, pattern: 'short-a', rank: 1, category: 'learning', craftStreak: 0, craftAttempts: 0, craftCorrect: 0, order: 1, lastSeen: 1 },
        { word: 'ship', tier: 1, band: 1, pattern: 'sh', rank: 2, category: 'learning', craftStreak: 0, craftAttempts: 0, craftCorrect: 0, order: 2, lastSeen: 2 },
        { word: 'jump', tier: 1, band: 1, pattern: 'mp', rank: 3, category: 'learning', craftStreak: 0, craftAttempts: 0, craftCorrect: 0, order: 3, lastSeen: 3 },
      ] } }],
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on('pageerror', (e) => issues.push('pageerror: ' + e.message));

// Wiggle the pointer for `ms` (a mark every ~400ms — > the 300ms move-throttle, < the break-gap),
// keeping the active streak climbing. Returns once done driving.
async function drive(ms) {
  const end = Date.now() + ms;
  let x = 40;
  while (Date.now() < end) {
    x = x === 40 ? 80 : 40;
    await page.mouse.move(x, 120 + (x % 30));
    await page.waitForTimeout(400);
  }
}

try {
  await page.addInitScript((args) => {
    try { localStorage.setItem(args.k, JSON.stringify(args.s)); } catch {}
    window.__activeLockMs = args.lock;
    window.__activeBreakMs = args.brk;
    window.__activePauseMs = args.pause;
    window.__activeHeartbeatMs = args.hb;
  }, { k: KEY, s: SEED, lock: LOCK_MS, brk: BREAK_MS, pause: PAUSE_MS, hb: HEARTBEAT_MS });

  await page.goto(URL, { waitUntil: 'networkidle' });
  if (await page.$('.tap-to-start')) await page.click('.tap-to-start');
  if (await page.locator('.profile-card:not(.add)').count()) await page.locator('.profile-card:not(.add)').first().click();
  await page.waitForSelector('.menu-card', { timeout: 8000 });

  // 1) Drive continuous activity past the lock threshold → the brain break overlay must appear.
  await drive(LOCK_MS + 1500);
  await page.waitForSelector('.apause-overlay', { timeout: 4000 }).catch(() => {});
  const shown = await page.$('.apause-overlay');
  if (!shown) {
    issues.push('FAIL: the active-engagement brain-break overlay never appeared after continuous play');
  } else {
    await page.screenshot({ path: 'scripts/qa_active_pause_break.png' }); // LOOK: the brain-break overlay itself
    // 2) it shows the current LEARNING words as practice chips
    const chips = await page.$$eval('.apause-word', (els) => els.map((e) => e.textContent));
    console.log(`overlay : shown; learning chips = [${chips.join(', ')}]`);
    for (const w of ['cat', 'ship', 'jump']) if (!chips.includes(w)) issues.push(`FAIL: learning word "${w}" not shown on the break`);
    // 3) it shows a countdown
    if (!(await page.$('.apause-count'))) issues.push('FAIL: no countdown shown on the break overlay');

    // 4) GROWN-UP dismiss: open the arithmetic gate, solve it, and the break must end early.
    await page.click('.apause-skip');
    await page.waitForSelector('.gate-overlay', { timeout: 3000 });
    await page.screenshot({ path: 'scripts/qa_active_pause_gate.png' }); // LOOK: the gate must sit ON TOP of the break
    const q = await page.$eval('.gate-q span', (e) => e.textContent); // "Grown-up check: what is A + B?"
    const m = q.match(/(\d+)\s*\+\s*(\d+)/);
    const ans = m ? Number(m[1]) + Number(m[2]) : 0;
    await page.fill('.gate-answer', String(ans));
    await page.click('.gate-actions .btn.primary');
    await page.waitForTimeout(300);
    if (await page.$('.apause-overlay')) issues.push('FAIL: grown-up "End break" did not dismiss the lock');
    else console.log('skip    : grown-up gate solved → break ended early ✅');

    // 5) AUTO-unlock: re-trigger the lock, then wait out the (short) break — it must clear itself.
    await drive(LOCK_MS + 1500);
    await page.waitForSelector('.apause-overlay', { timeout: 4000 });
    console.log('re-lock : overlay re-appeared after a fresh streak ✅');
    await page.waitForTimeout(PAUSE_MS + 1200); // let the countdown run out
    if (await page.$('.apause-overlay')) issues.push('FAIL: the break did not AUTO-unlock after its duration');
    else console.log('auto    : break auto-unlocked after its duration ✅');
  }

  // play time was banked into stats for the §37 B parent view
  const playMs = await page.evaluate((key) => {
    const s = JSON.parse(localStorage.getItem(key) || '{}');
    const p = (s.profiles || []).find((x) => x.id === s.activeId) || (s.profiles || [])[0];
    return (p && p.stats && p.stats.playMs) || 0;
  }, KEY);
  console.log(`playMs  : banked ${playMs}ms of active play into stats`);
  if (!(playMs > 0)) issues.push('FAIL: stats.playMs was not accumulated');

  await page.screenshot({ path: 'scripts/qa_active_pause.png' });
  console.log('\n' + (issues.length ? `ISSUES (${issues.length}):\n- ` + issues.join('\n- ') : 'ISSUES: none ✅'));
} catch (e) {
  issues.push('PROBE ERROR: ' + e.message);
  console.log('ISSUES:', issues);
} finally {
  await browser.close();
}
process.exit(issues.length ? 1 : 0);
