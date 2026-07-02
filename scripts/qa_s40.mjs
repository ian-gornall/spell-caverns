// scripts/qa_s40.mjs — visual-QA guard for the §40 lessons-mode rehaul (csc-v69):
//   A. home hero = 📖 Today's lesson; Practice locked before 4 graduations
//   B. intro card shows ONCE (with replay), never stacked with the play surface
//   C. errorless exposure: grey ghost letters; typing the word fills them
//   D. the trial stream: no two unknowns adjacent (knowns available), MIN_REGAP,
//      graduation to KNOWN after 4 clean recalls (rolling window in the saved run)
//   E. a wrong submit clears the wrong letters immediately
//   F. the free timed hint ladder: rung 1 = exactly one .reteach + grapheme glow,
//      rung 2 = grey copy of the correct spelling
//   G. lesson complete → celebration → next lesson's intro; Practice unlocks (>=4)
//   H. Progress: lesson path + per-word window pips; no overflow at 390 AND 320
// Run: npm start (one terminal) then: node scripts/qa_s40.mjs
import { chromium } from 'playwright';
import { mkdir, rm } from 'node:fs/promises';
import { RESEARCH } from '../data/research_sample.js';
import { lexiconEntries } from '../src/engine/lists.js';

const URL = process.env.URL || 'http://localhost:5173';
const OUT = 'scripts/qa_s40';
await rm(OUT, { recursive: true, force: true }).catch(() => {});
await mkdir(OUT, { recursive: true });

const AGE = 8;
const { lessons } = lexiconEntries(RESEARCH, AGE);
const L1 = lessons.get(1); // the first lesson on the age-8 path
const L1_WORDS = L1.words.map((e) => e.word);

const browser = await chromium.launch();
const issues = [];
const ok = (c, m) => console.log((c ? '✓ ' : '✗ ') + m) || (!c && issues.push(m));

const knownRec = (lessonId) => ({
  lessonId, exposed: 1, seeded: 0, last: 0,
  win: Array.from({ length: 5 }, () => ({ c: 1, r: 0, ms: null })),
});

const profileSeed = (lessonsState) => ({
  schema: 2, syncCode: null, syncConsent: false, parentPassword: null, activeId: 'p1',
  profiles: [{
    id: 'p1', version: 1, profile: { name: 'Tester', onboarded: true },
    settings: { length: 5, voice: false, wordlists: 'lessons', age: AGE },
    placement: { done: true, age: AGE },
    categories: { setSize: 5, level: 1, recent: [], order: 0, words: [] },
    lessons: lessonsState,
  }],
});

// Fresh run with a few seeded knowns (the IR interleave scaffold; seeded = not earned).
const SEED_FRESH = profileSeed({
  v: 1, placed: true, diag: null, lessonId: null, seenIntro: [], completed: [], trial: 0, prev: null,
  words: {
    tree: { ...knownRec('Z'), seeded: 1 },
    moon: { ...knownRec('Z'), seeded: 1 },
    rain: { ...knownRec('Z'), seeded: 1 },
  },
});

// Lesson 1 one clean recall from completion (celebration path) — all pool words known
// (earned) except the last, which sits at 3/3 correct; intro already seen.
const nearWords = {};
for (const w of L1_WORDS.slice(0, -1)) nearWords[w] = knownRec(L1.id);
const LAST = L1_WORDS[L1_WORDS.length - 1];
nearWords[LAST] = { lessonId: L1.id, exposed: 1, seeded: 0, last: 0, win: Array.from({ length: 3 }, () => ({ c: 1, r: 0, ms: null })) };
const SEED_NEAR = profileSeed({
  v: 1, placed: true, diag: null, lessonId: L1.id, seenIntro: [L1.id], completed: [], trial: 10, prev: null,
  words: nearWords,
});

async function newPage(view, seed, init) {
  const page = await browser.newPage({ viewport: view });
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource.*\b404\b/.test(m.text())) issues.push('console.error: ' + m.text()); });
  page.on('pageerror', (e) => issues.push('pageerror: ' + e.message));
  await page.addInitScript((s) => { try { localStorage.setItem('crystal-spell-caverns:v1', JSON.stringify(s)); } catch {} }, seed);
  if (init) await page.addInitScript(init);
  return page;
}
async function gotoHome(page) {
  await page.goto(URL, { waitUntil: 'networkidle' });
  if (await page.locator('.profile-card:not(.add)').count()) await page.locator('.profile-card:not(.add)').first().click();
  await page.waitForSelector('.menu-card', { timeout: 6000 });
}
const overflow = async (page, label) => {
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  const cw = await page.evaluate(() => document.documentElement.clientWidth);
  ok(sw <= cw + 1, `${label}: no horizontal overflow (scrollW=${sw} clientW=${cw})`);
};

// Type a word on the app keypad (clicks the .key buttons).
async function typeWord(page, word) {
  for (const chr of word) {
    const key = chr === "'" ? page.locator('.key[aria-label="Apostrophe"]') : page.locator('.key', { hasText: new RegExp(`^${chr}$`) }).first();
    await key.click();
    await page.waitForTimeout(90);
  }
}
// Wait for the Nth response's trial to be on screen (present() refreshes the hook).
async function waitTrial(page, n) {
  await page.waitForFunction((want) => window.__lessonCurrent && window.__lessonCurrent.responses === want, n, { timeout: 15000 });
  return page.evaluate(() => window.__lessonCurrent);
}

try {
  // ================= 390×844: the main flow =================
  console.log('\n=== PHONE 390×844 · fresh lessons profile ===');
  const page = await newPage({ width: 390, height: 844 }, SEED_FRESH, () => { window.__lessonBlockLen = 40; });
  await gotoHome(page);

  // ---- A. home hero + locked Practice ----
  const hero = page.locator('.menu-card.lesson');
  ok(await hero.count() === 1, 'home: 📖 Today\'s lesson is the hero');
  ok(await page.locator('.menu-card.craft.hero:not(.lesson)').count() === 0, 'home: no separate Craft hero in lessons mode');
  ok(await page.locator('.menu-card.mastery').count() === 0, 'home: no Mastery card in lessons mode');
  ok(await page.locator('.menu-card.play.locked').count() === 1, 'home: Practice locked before 4 graduations');
  await page.screenshot({ path: `${OUT}/01-home-lessons.png` });
  await overflow(page, 'home 390');

  // ---- B. intro card once + replay ----
  await hero.click();
  await page.waitForSelector('.lintro-overlay', { timeout: 6000 });
  ok(await page.locator('.lintro-rule').count() === 1, 'intro: kid rule shown');
  ok(await page.locator('.lintro-chip').count() >= 2, 'intro: exemplar chips shown');
  ok(await page.locator('.lintro-overlay button', { hasText: 'Hear it again' }).count() === 1, 'intro: replay button');
  await page.screenshot({ path: `${OUT}/02-intro.png` });
  await page.locator('.lintro-go').click();

  // ---- C. errorless exposure: ghost letters ----
  const t0 = await waitTrial(page, 0);
  ok(t0.expose === true, `first trial is an exposure ("${t0.word}")`);
  ok(await page.locator('.slot.ghost').count() === t0.word.length, 'exposure: every slot shows a grey ghost letter');
  await page.screenshot({ path: `${OUT}/03-exposure-ghost.png` });
  // a wrong key must NOT land during the copy
  const wrongKey = t0.word[0] === 'z' ? 'x' : 'z';
  await page.locator('.key', { hasText: new RegExp(`^${wrongKey}$`) }).first().click();
  await page.waitForTimeout(150);
  ok(await page.locator('.slot.filled').count() === 0, 'exposure: a wrong key does not land');
  await typeWord(page, t0.word);

  // ---- D. drive the stream; track the first word to graduation ----
  const watched = t0.word;
  let graduated = false;
  for (let n = 1; n < 30 && !graduated; n++) {
    const tr = await waitTrial(page, n);
    await page.waitForTimeout(250); // let dictation settle (voice off: ~160ms cb)
    await typeWord(page, tr.word);
    graduated = await page.evaluate((w) => {
      try {
        const c = JSON.parse(localStorage.getItem('crystal-spell-caverns:v1'));
        const rec = c.profiles[0].lessons.words[w];
        return !!rec && rec.win.length >= 4 && rec.win.every((x) => x.c === 1) && rec.win.length <= 5;
      } catch { return false; }
    }, watched);
  }
  ok(graduated, `"${watched}" graduated (4 clean recalls in the saved window)`);
  const chipTxt = (await page.locator('.lesson-chip').textContent()) || '';
  ok(/✨[1-9]/.test(chipTxt), `lesson chip counts the graduation ("${chipTxt.trim()}")`);
  const log = await page.evaluate(() => window.__lessonTrialLog || []);
  ok(log.length >= 10, `trial log captured ${log.length} trials`);
  for (let i = 1; i < log.length; i++) {
    if (log[i].known === false && log[i - 1].known === false) {
      ok(false, `unknowns adjacent at ${i - 1}/${i}: ${log[i - 1].word}, ${log[i].word}`);
      break;
    }
  }
  const lastAt = new Map();
  let regapOk = true;
  log.forEach((tr, i) => {
    if (lastAt.has(tr.word) && i - lastAt.get(tr.word) < 2) regapOk = false;
    lastAt.set(tr.word, i);
  });
  ok(regapOk, 'no word repeats within 2 trials (MIN_REGAP)');
  await page.screenshot({ path: `${OUT}/04-stream.png` });
  await overflow(page, 'lesson 390');

  // ---- E. wrong submit clears the wrong letters ----
  {
    let tr = await page.evaluate(() => window.__lessonCurrent);
    let n = tr.responses;
    // find a RECALL trial (not exposure)
    while (tr.expose) {
      await page.waitForTimeout(250);
      await typeWord(page, tr.word);
      n += 1;
      tr = await waitTrial(page, n);
    }
    const word = tr.word;
    const bad = [...'zxqjvk'].find((c) => !word.includes(c)); // a letter the word never uses
    await page.waitForTimeout(250);
    await typeWord(page, bad + word.slice(1)); // first letter wrong -> auto-check fails
    await page.waitForTimeout(400);
    const letters = await page.locator('.slots .slot').allTextContents();
    ok(!letters.some((l) => l.trim().toLowerCase() === bad), `wrong submit: the wrong letter is cleared (slots: ${JSON.stringify(letters)})`);
    const firstCls = (await page.locator('.slots .slot').first().getAttribute('class')) || '';
    ok(!firstCls.includes('filled'), 'wrong submit: the cleared slot is empty again');
    await page.screenshot({ path: `${OUT}/05-wrong-cleared.png` });
    await typeWord(page, word[0]); // finish it
  }
  await page.close();

  // ================= hint ladder (fast timers) =================
  console.log('\n=== hint ladder (scaled timers) ===');
  const lad = await newPage({ width: 390, height: 844 }, SEED_NEAR, () => { window.__lessonBlockLen = 40; window.__idleTest = 0.12; });
  await gotoHome(lad);
  await lad.locator('.menu-card.lesson').click();
  // no intro (seenIntro contains L1) — straight into a trial
  await lad.waitForFunction(() => window.__lessonCurrent, null, { timeout: 8000 });
  // find a recall of an UNKNOWN (the ladder doesn't help knowns any differently, but
  // reteach copy needs the entry rule — any lesson word works; knowns are lesson words too)
  // rung 1 fires ~ (3000+700*len)*0.12 ms after present; wait generously then assert
  await lad.waitForSelector('.reteach:not(:empty)', { timeout: 8000 });
  ok(await lad.locator('.reteach').count() === 1, 'rung 1: exactly one .reteach strip');
  const rule = (await lad.locator('.reteach').textContent()) || '';
  ok(rule.length > 15 && !/consonant|vowel/i.test(rule), `rung 1: kid rule shown ("${rule.slice(0, 50)}…")`);
  await lad.screenshot({ path: `${OUT}/06-rung1-reteach.png` });
  // rung 2: ghost copy appears one step later
  await lad.waitForSelector('.slot.ghost', { timeout: 8000 });
  ok(true, 'rung 2: correct spelling appears as grey ghosts to copy');
  await lad.screenshot({ path: `${OUT}/07-rung2-ghost.png` });
  await lad.close();

  // ================= celebration → next intro + unlocked Practice =================
  console.log('\n=== lesson complete (near-complete seed) ===');
  const cel = await newPage({ width: 390, height: 844 }, SEED_NEAR, () => { window.__lessonBlockLen = 40; });
  await gotoHome(cel);
  ok(await cel.locator('.menu-card.play.locked').count() === 0, 'home: Practice UNLOCKED with >=4 graduated words');
  await cel.locator('.menu-card.lesson').click();
  // drive until the last word is served, answer it clean -> lesson completes
  let done = false;
  for (let n = 0; n < 25 && !done; n++) {
    const tr = await waitTrial(cel, n);
    await cel.waitForTimeout(250);
    await typeWord(cel, tr.word);
    if (tr.word === LAST) done = true;
  }
  ok(done, `served + solved the last unfinished word ("${LAST}")`);
  await cel.waitForSelector('.reward.lesson-complete', { timeout: 8000 });
  const celTxt = (await cel.locator('.reward.lesson-complete').textContent()) || '';
  ok(/Lesson 1 complete/i.test(celTxt), 'celebration: loud lesson-complete screen');
  ok(/Next up: Lesson 2/i.test(celTxt), 'celebration: names the next lesson');
  await cel.screenshot({ path: `${OUT}/08-celebration.png` });
  await cel.locator('button', { hasText: 'Next lesson' }).click();
  await cel.waitForSelector('.lintro-overlay', { timeout: 8000 });
  ok(true, 'next lesson\'s intro card shows after the celebration');
  await cel.screenshot({ path: `${OUT}/09-next-intro.png` });
  await cel.close();

  // ================= spine diagnostic (§40 slice 4) =================
  console.log('\n=== spine diagnostic (unplaced profile, child knows first 2 lessons) ===');
  const FRESH_UNPLACED = profileSeed({
    v: 1, placed: false, diag: null, lessonId: null, seenIntro: [], completed: [], trial: 0, prev: null, words: {},
  });
  const LESSON_LIST = [...lessons.values()];
  const K = 2; // the simulated child spells lessons 0..1 (bands 1..2) and misses beyond
  const dg = await newPage({ width: 390, height: 844 }, FRESH_UNPLACED, () => { window.__lessonBlockLen = 60; });
  await gotoHome(dg);
  await dg.locator('.menu-card.lesson').click();
  await dg.waitForFunction(() => window.__lessonCurrent, null, { timeout: 8000 });
  ok(await dg.locator('.lintro-overlay').count() === 0, 'diagnostic: NO intro card before placement (the check is invisible)');
  const chip = (await dg.locator('.lesson-chip').textContent()) || '';
  ok(/starting spot/i.test(chip) && !/Three-sound/i.test(chip), `diagnostic: the chip is neutral, not a lesson label ("${chip.trim()}")`);
  let placedNow = false;
  let repairChecked = false;
  for (let i = 0; i < 40 && !placedNow; i++) {
    const cur = await dg.evaluate(() => window.__lessonCurrent);
    if (cur.diag == null) break; // walk finished (intro should be up)
    const know = cur.diag < K;
    await dg.waitForTimeout(250);
    if (know) {
      await typeWord(dg, cur.word);
    } else {
      // one wrong build = the miss is BOOKED, then the child repairs it (uncounted)
      const bad = [...'zxqjvk'].find((c) => !cur.word.includes(c));
      await typeWord(dg, bad + cur.word.slice(1));
      await dg.waitForTimeout(400);
      if (!repairChecked) {
        repairChecked = true;
        ok((await dg.locator('.reteach').textContent() || '').length > 15, 'diagnostic: a missed probe re-teaches the rule (repair open)');
        const firstCls = (await dg.locator('.slots .slot').first().getAttribute('class')) || '';
        ok(!firstCls.includes('filled'), 'diagnostic: the wrong letter cleared for the repair');
      }
      await typeWord(dg, cur.word[0]); // finish the repair — closure, not a re-grade
    }
    const before = cur.responses;
    await dg.waitForFunction((b) => {
      const c = window.__lessonCurrent;
      return c && (c.responses > b || c.diag == null);
    }, before, { timeout: 15000 }).catch(() => {});
    placedNow = await dg.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('crystal-spell-caverns:v1')).profiles[0].lessons.placed; } catch { return false; }
    });
  }
  ok(placedNow, 'diagnostic: the walk converged and placed the run');
  await dg.waitForSelector('.lintro-overlay', { timeout: 8000 });
  ok(true, 'diagnostic: the frontier lesson\'s intro card follows placement');
  const savedRun = await dg.evaluate(() => JSON.parse(localStorage.getItem('crystal-spell-caverns:v1')).profiles[0].lessons);
  ok(savedRun.lessonId === LESSON_LIST[K].id, `diagnostic: placed at the frontier lesson (${savedRun.lessonId} = lesson ${K + 1})`);
  const seededCount = Object.values(savedRun.words).filter((w) => w.seeded).length;
  ok(seededCount > 0 && seededCount <= 40, `diagnostic: below-frontier words seeded KNOWN (${seededCount}, cap 40)`);
  ok(savedRun.diag === null, 'diagnostic: the walk state is cleared once placed');
  await dg.screenshot({ path: `${OUT}/13-diag-placed-intro.png` });
  await dg.close();

  // a stalled probe NEVER reveals the spelling: rung 1 reteach, then a one-shot miss
  console.log('\n=== diagnostic ladder cap (scaled timers) ===');
  const dg2 = await newPage({ width: 390, height: 844 }, FRESH_UNPLACED, () => { window.__lessonBlockLen = 60; window.__idleTest = 0.12; });
  await gotoHome(dg2);
  await dg2.locator('.menu-card.lesson').click();
  await dg2.waitForFunction(() => window.__lessonCurrent && window.__lessonCurrent.diag != null, null, { timeout: 8000 });
  await dg2.waitForSelector('.reteach:not(:empty)', { timeout: 8000 });
  ok(true, 'diag ladder: rung 1 reteach still fires');
  let sawGhost = false;
  const t0resp = await dg2.evaluate(() => window.__lessonCurrent.responses);
  for (let i = 0; i < 30; i++) {
    if (await dg2.locator('.slot.ghost').count()) { sawGhost = true; break; }
    const r = await dg2.evaluate(() => window.__lessonCurrent.responses);
    if (r > t0resp) break; // moved on as a one-shot miss
    await dg2.waitForTimeout(200);
  }
  ok(!sawGhost, 'diag ladder: the spelling is NEVER revealed (no grey copy during probes)');
  const moved = await dg2.evaluate((b) => window.__lessonCurrent.responses > b, t0resp);
  ok(moved, 'diag ladder: a stalled probe moves on as a one-shot miss');
  await dg2.close();

  // ================= fatigue breather (forced knee) =================
  console.log('\n=== fatigue breather (forced knee) ===');
  const fb = await newPage({ width: 390, height: 844 }, SEED_NEAR, () => { window.__lessonKnee = true; });
  await gotoHome(fb);
  await fb.locator('.menu-card.lesson').click();
  await fb.waitForSelector('.reward.breather', { timeout: 8000 });
  const fbTxt = (await fb.locator('.reward.breather').textContent()) || '';
  ok(/breather/i.test(fbTxt), 'fatigue: the knee ends the block with the gentle breather screen');
  ok(await fb.locator('.reward.breather .btn.primary', { hasText: 'Home' }).count() === 1, 'fatigue: Home is the primary action (no auto-relaunch)');
  await fb.screenshot({ path: `${OUT}/14-breather.png` });
  await fb.close();

  // ================= Progress (lesson path + pips) =================
  console.log('\n=== progress (390) ===');
  const pg = await newPage({ width: 390, height: 844 }, SEED_FRESH, null);
  await gotoHome(pg);
  await pg.locator('.menu-card', { hasText: 'Progress' }).click();
  await pg.waitForSelector('.cavern-scroll', { timeout: 6000 });
  ok(await pg.locator('h3', { hasText: 'Lesson path' }).count() === 1, 'progress: Lesson path panel');
  ok(await pg.locator('.cavern-level.current').count() === 1, 'progress: one current lesson node');
  ok(await pg.locator('.cl-lesson').count() > 5, 'progress: kid lesson names render');
  await pg.screenshot({ path: `${OUT}/10-progress-path.png` });
  await overflow(pg, 'progress 390');
  await pg.close();

  // ================= 320px sweep =================
  console.log('\n=== PHONE 320×568 ===');
  const nw = await newPage({ width: 320, height: 568 }, SEED_FRESH, null);
  await gotoHome(nw);
  await overflow(nw, 'home 320');
  await nw.locator('.menu-card.lesson').click();
  await nw.waitForSelector('.lintro-overlay', { timeout: 6000 });
  await nw.screenshot({ path: `${OUT}/11-intro-320.png` });
  await overflow(nw, 'intro 320');
  await nw.locator('.lintro-go').click();
  await nw.waitForFunction(() => window.__lessonCurrent, null, { timeout: 8000 });
  await nw.waitForTimeout(400);
  await nw.screenshot({ path: `${OUT}/12-lesson-320.png` });
  await overflow(nw, 'lesson 320');
  await nw.close();
} catch (e) {
  issues.push('SCRIPT ERROR: ' + e.message);
}

await browser.close();
console.log(issues.length ? `\nISSUES (${issues.length}):\n- ` + issues.join('\n- ') : '\nISSUES: none');
process.exit(issues.length ? 1 : 0);
