// scripts/qa_tts.mjs — §40 probe: lessons-mode dictation reaches the hardened
// device-TTS fallback (research words have no clips): __spokenLog gets the word,
// __ttsLog gets the word (the §39 speakTTS fix actually issued speak()), and NO
// /audio/words/ clip fetch was attempted. The run is seeded at a lesson whose
// words are ALL clipless (classic clips cover the common research words, so
// lesson 1 would dictate via clips — correct, but not the path under test).
// Run: npm start (one terminal) then: node scripts/qa_tts.mjs
import { chromium } from 'playwright';
import { mkdir, rm } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import { RESEARCH } from '../data/research_sample.js';
import { lexiconEntries } from '../src/engine/lists.js';

const URL = process.env.URL || 'http://localhost:5173';
const OUT = 'scripts/qa_tts';
await rm(OUT, { recursive: true, force: true }).catch(() => {});
await mkdir(OUT, { recursive: true });

const AGE = 8;
const { lessons } = lexiconEntries(RESEARCH, AGE);
// find the first lesson whose words ALL lack clips (band 62 D-less at import time)
const man = JSON.parse(await readFile('audio/manifest.json', 'utf8'));
const clips = new Set(man.words || []);
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
const target = [...lessons.entries()].find(([, l]) => l.words.length >= 4 && l.words.every((e) => !clips.has(slug(e.word))));
if (!target) {
  console.log('No fully-clipless lesson found — nothing to probe.');
  process.exit(1);
}
const [BAND, LESSON] = target;

const browser = await chromium.launch();
const issues = [];
const ok = (c, m) => console.log((c ? '✓ ' : '✗ ') + m) || (!c && issues.push(m));

// an onboarded lessons profile with VOICE ON, seeded mid-path at the clipless lesson
// (intro already seen, so the first dictation comes fast)
const SEED = {
  schema: 2, syncCode: null, syncConsent: false, parentPassword: null, activeId: 'p1',
  profiles: [{
    id: 'p1', version: 1, profile: { name: 'Tester', onboarded: true },
    settings: { length: 5, voice: true, wordlists: 'lessons', age: AGE },
    placement: { done: true, age: AGE },
    categories: { setSize: 5, level: BAND, recent: [], order: 0, words: [] },
    lessons: { v: 1, placed: true, diag: null, lessonId: LESSON.id, seenIntro: [LESSON.id], completed: [], trial: 0, prev: null, words: {} },
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

  await page.locator('.menu-card.lesson').click();
  await page.waitForFunction(() => window.__lessonCurrent, null, { timeout: 8000 });
  await page.waitForTimeout(1800); // dictation queue + the 60ms deferred speak()
  const cur = await page.evaluate(() => window.__lessonCurrent);
  ok(cur && cur.lessonId === LESSON.id, `the stream serves the seeded clipless lesson (${cur?.lessonId}, word="${cur?.word}")`);
  const logs = await page.evaluate(() => ({
    spoken: window.__spokenLog || [],
    tts: window.__ttsLog || [],
    clips: window.__clipLog || [],
  }));
  ok(logs.spoken.includes(cur.word), `__spokenLog has the word (${JSON.stringify(logs.spoken)})`);
  ok(logs.tts.includes(cur.word), `__ttsLog has the word — speak() was actually issued (${JSON.stringify(logs.tts)})`);
  const wordClips = logs.clips.filter((u) => u.includes('/audio/words/'));
  ok(wordClips.length === 0, `no word-clip fetch attempted for clipless research words (${JSON.stringify(wordClips)})`);
  await page.screenshot({ path: `${OUT}/01-lesson-dictated.png` });
  await page.close();
} catch (e) {
  issues.push('SCRIPT ERROR: ' + e.message);
}

await browser.close();
console.log(issues.length ? `\nISSUES (${issues.length}):\n- ` + issues.join('\n- ') : '\nISSUES: none');
process.exit(issues.length ? 1 : 0);
