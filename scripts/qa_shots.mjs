// scripts/qa_shots.mjs — capture full-page screenshots at a Galaxy width for eyeball QA.
import { chromium } from 'playwright';
const URL = process.env.URL || 'http://localhost:5173';
const SEED = {
  version: 1, profile: { name: 'Sam', onboarded: true },
  settings: { difficulty: 'easy', length: 10, optionCount: 3, voice: false, volume: 0.85, voiceRate: 0.85, themeColor: '#7AA2FF', dailyGoalGems: 250 },
  startLevel: 5, gems: 5400, feedback: [], specimens: [],
  stats: { sessionsPlayed: 5, answers: 60, correct: 44, byDay: {} },
  streak: { count: 3, lastPlayedDate: new Date().toISOString().slice(0, 10), longest: 6, freezes: 1 },
  records: { bestCombo: 8, bestWaveGems: 220 }, catalog: { owned: ['quartz', 'amethyst'], milestoneDepth: 1 },
};
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate((s) => localStorage.setItem('crystal-spell-caverns:v1', JSON.stringify(s)), SEED);
const open = async (re) => { await page.goto(URL, { waitUntil: 'networkidle' }); await page.waitForTimeout(300); await page.evaluate((src) => { const r = new RegExp(src, 'i'); const b = [...document.querySelectorAll('button,.menu-card,.btn,.stat')].find((x) => r.test(x.textContent)); if (b) b.click(); }, re.source); await page.waitForTimeout(450); };
const shot = async (name) => { await page.screenshot({ path: `scripts/qa/shots-${name}.png` }); console.log('shot', name); };
await page.goto(URL, { waitUntil: 'networkidle' }); await page.waitForTimeout(400); await shot('home');
await open(/settings|⚙/); await shot('settings');
await open(/progress|journey|map/); await shot('progress');
await open(/collection|crystals|catalog/); await shot('catalog');
await browser.close();
