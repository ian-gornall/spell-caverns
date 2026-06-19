// scripts/qa_shots.mjs — capture full screenshots at Galaxy width for eyeball QA.
// Clicks through the §28.D "Who's playing?" picker, then visits key screens + a play surface.
import { chromium } from 'playwright';
const URL = process.env.URL || 'http://localhost:5173';
const W = Number(process.env.W || 360), H = Number(process.env.H || 780);
const SEED = {
  version: 1, profile: { name: 'Sam', onboarded: true },
  settings: { difficulty: 'easy', length: 10, optionCount: 3, voice: false, volume: 0.85, voiceRate: 0.85, themeColor: '#7AA2FF', dailyGoalGems: 250 },
  startLevel: 5, gems: 5400, feedback: [], specimens: [],
  stats: { sessionsPlayed: 5, answers: 60, correct: 44, byDay: {} },
  streak: { count: 3, lastPlayedDate: new Date().toISOString().slice(0, 10), longest: 6, freezes: 1 },
  records: { bestCombo: 8, bestWaveGems: 220 }, catalog: { owned: ['quartz', 'amethyst'], milestoneDepth: 1 },
};
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const shot = async (name) => { await page.screenshot({ path: `scripts/qa/shots-${name}.png` }); console.log('shot', name); };
const home = async () => {
  await page.goto(URL, { waitUntil: 'networkidle' }); await page.waitForTimeout(300);
  if (await page.locator('.profile-card:not(.add)').count()) { await page.locator('.profile-card:not(.add)').first().click(); }
  await page.waitForSelector('.menu-card.play', { timeout: 5000 }); await page.waitForTimeout(300);
};
const tap = async (re) => { await page.evaluate((src) => { const r = new RegExp(src, 'i'); const b = [...document.querySelectorAll('button,.menu-card,.btn,.stat')].find((x) => r.test(x.textContent)); if (b) b.click(); }, re.source); await page.waitForTimeout(450); };

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate((s) => localStorage.setItem('crystal-spell-caverns:v1', JSON.stringify(s)), SEED);
await page.goto(URL, { waitUntil: 'networkidle' }); await page.waitForTimeout(350); await shot('picker');
await home(); await shot('home');
await home(); await tap(/practice|mine|dig|play/); await shot('rhythm');
await home(); await tap(/settings|⚙/); await shot('settings');
await home(); await tap(/progress|journey|map/); await shot('progress');
await home(); await tap(/collection|crystals|catalog/); await shot('catalog');
await home(); await tap(/geode|daily/); await shot('geode');
await browser.close();
