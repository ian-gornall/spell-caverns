// scripts/qa_tts.mjs — §39/§40 slice-1 probe: lessons-mode VOICE + KID COPY.
//   A. dictation in lessons mode reaches the device-TTS fallback (research words have
//      no clips): __spokenLog gets the word, __ttsLog gets the word (the hardened
//      speakTTS actually issued speak()), and NO /audio/words/ clip was attempted.
//   B. the reteach strip on a miss shows the KID-VOICED rule (data/kid_rules.js),
//      byte-equal to the overlay entry for the word's lesson — not the corpus string.
// Run: npm start (one terminal) then: node scripts/qa_tts.mjs
import { chromium } from 'playwright';
import { mkdir, rm } from 'node:fs/promises';
import { KID_RULES } from '../data/kid_rules.js';
import { RESEARCH } from '../data/research_sample.js';
import { lexiconEntries } from '../src/engine/lists.js';

const URL = process.env.URL || 'http://localhost:5173';
const OUT = 'scripts/qa_tts';
await rm(OUT, { recursive: true, force: true }).catch(() => {});
await mkdir(OUT, { recursive: true });

const AGE = 8;
// Classic clips COVER the common research words (the lists overlap), so lesson 1 would
// dictate via clips — correct behavior, but not the path under test. Band 62 (D-less,
// age-8 numbering) is all research-only words with NO clips: dictation MUST fall to TTS.
const SEED_LEVEL = 62;
// the same band -> lesson map the app builds for this profile (band 1 = first lesson)
const { lessons } = lexiconEntries(RESEARCH, AGE);

const browser = await chromium.launch();
const issues = [];
const ok = (c, m) => console.log((c ? '✓ ' : '✗ ') + m) || (!c && issues.push(m));

// an onboarded, placed profile already IN lessons mode, with VOICE ON (the point of the probe)
const SEED = {
  schema: 2, syncCode: null, syncConsent: false, parentPassword: null, activeId: 'p1',
  profiles: [{
    id: 'p1', version: 1, profile: { name: 'Tester', onboarded: true },
    settings: { length: 5, voice: true, wordlists: 'lessons', age: AGE },
    placement: { done: true, age: AGE },
    categories: { setSize: 5, level: SEED_LEVEL, recent: [], order: 0, words: [] },
  }],
};

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource.*\b404\b/.test(m.text())) issues.push('console.error: ' + m.text()); });
  page.on('pageerror', (e) => issues.push('pageerror: ' + e.message));
  await page.addInitScript((seed) => { try { localStorage.setItem('crystal-spell-caverns:v1', JSON.stringify(seed)); } catch {} }, SEED);

  await page.goto(URL, { waitUntil: 'networkidle' });
  if (await page.locator('.profile-card:not(.add)').count()) await page.locator('.profile-card:not(.add)').first().click();
  await page.waitForSelector('.menu-card', { timeout: 6000 });

  // ---------- A. dictation goes through the hardened TTS fallback ----------
  await page.locator('.menu-card.craft').click();
  await page.waitForSelector('.tray-tile', { timeout: 8000 });
  await page.waitForTimeout(1800); // dictation queue + the 60ms deferred speak()
  const cur = await page.evaluate(() => window.__puzzleCurrent);
  ok(cur && cur.band === SEED_LEVEL, `craft serves the seeded lesson (band=${cur?.band}, word="${cur?.word}")`);
  const logs = await page.evaluate(() => ({
    spoken: window.__spokenLog || [],
    tts: window.__ttsLog || [],
    clips: window.__clipLog || [],
  }));
  ok(logs.spoken.includes(cur.word), `__spokenLog has the word (${JSON.stringify(logs.spoken)})`);
  ok(logs.tts.includes(cur.word), `__ttsLog has the word — speak() was actually issued (${JSON.stringify(logs.tts)})`);
  const wordClips = logs.clips.filter((u) => u.includes('/audio/words/'));
  ok(wordClips.length === 0, `no word-clip fetch attempted for clipless research words (${JSON.stringify(wordClips)})`);
  await page.screenshot({ path: `${OUT}/01-craft-dictated.png` });

  // ---------- B. a miss reteaches the KID-VOICED rule ----------
  const target = cur.word;
  let forcedWrong = false;
  for (let i = 0; i < target.length; i++) {
    const tiles = page.locator('.tray-tile:not(.used)');
    const n = await tiles.count();
    let pick = 0;
    if (!forcedWrong) {
      for (let t = 0; t < n; t++) {
        const letter = (await tiles.nth(t).textContent())?.trim().toLowerCase();
        if (letter && letter !== target[i]) { pick = t; forcedWrong = true; break; }
      }
    }
    await tiles.nth(pick).click();
    await page.waitForTimeout(120);
  }
  ok(forcedWrong, `built a wrong "${target}" on purpose`);
  await page.waitForTimeout(600);
  const shown = (await page.locator('.reteach').first().textContent().catch(() => ''))?.replace('💡', '').trim();
  const lesson = lessons.get(SEED_LEVEL);
  const expected = KID_RULES[lesson.id]?.rule;
  ok(!!expected, `overlay has an entry for the lesson (${lesson.id})`);
  ok(shown === expected, `reteach strip shows the KID rule ("${shown?.slice(0, 60)}…")`);
  ok(!/consonant|vowel|\/[a-z]+\//i.test(shown || ''), 'reteach copy is jargon-free');
  await page.screenshot({ path: `${OUT}/02-craft-kid-reteach.png` });
  await page.close();
} catch (e) {
  issues.push('SCRIPT ERROR: ' + e.message);
}

await browser.close();
console.log(issues.length ? `\nISSUES (${issues.length}):\n- ` + issues.join('\n- ') : '\nISSUES: none');
process.exit(issues.length ? 1 : 0);
