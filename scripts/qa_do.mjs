// scripts/qa_do.mjs — drive the live QA session (qa_session.mjs) one step at a time.
//
//   node scripts/qa_do.mjs <name> <action> [arg]
//
// actions:
//   shot                      just screenshot (after looking, decide next move)
//   goto <url|path>           navigate
//   click <regex>            click first button/card/tile whose text matches (case-insens.)
//   fill  <value>            type into the first text input
//   tap   <selector>         click a CSS selector
//   tapword                  rhythm: tap the correct tile (window.__rhythmCurrent)
//   build                    puzzle: place the correct letters in order
//   scroll <0..1|bottom>     scroll the inner .scroll/.play-body (or window) to a fraction
//   seed                     write a seeded onboarded profile then reload
//   eval  <js>               run arbitrary page JS (returns nothing)
// Always screenshots to scripts/qa/live/<NN>-<name>.png and prints overflow + a short DOM note.
import { chromium } from 'playwright';
import fs from 'node:fs';

const [, , name = 'shot', action = 'shot', ...rest] = process.argv;
const arg = rest.join(' ');
const DIR = 'scripts/qa/live';
const COUNT = `${DIR}/.count`;
let n = 1;
try { n = parseInt(fs.readFileSync(COUNT, 'utf8'), 10) + 1 || 1; } catch {}
fs.writeFileSync(COUNT, String(n));
const tag = String(n).padStart(2, '0');

const b = await chromium.connectOverCDP('http://localhost:9222');
const ctx = b.contexts()[0];
const page = ctx.pages()[0];

const clickByText = (src) => page.evaluate((s) => {
  const rx = new RegExp(s, 'i');
  const els = [...document.querySelectorAll('button, .menu-card, .level-card, .colour-swatch, a, .tile, .tray-tile')];
  const el = els.find((x) => rx.test(x.textContent || x.getAttribute('aria-label') || ''));
  if (el) { el.click(); return el.textContent.trim().slice(0, 30); }
  return null;
}, src);

try {
  if (action === 'goto') await page.goto(arg.startsWith('http') ? arg : 'http://localhost:5173' + (arg || '/'), { waitUntil: 'networkidle' });
  else if (action === 'click') { const t = await clickByText(arg); console.log('clicked:', t); }
  else if (action === 'fill') { await page.fill('input[type=text], .onboard-name, input', arg); }
  else if (action === 'tap') { await page.click(arg); }
  else if (action === 'tapword') {
    const r = await page.evaluate(() => { const w = window.__rhythmCurrent?.word; const t = [...document.querySelectorAll('.tile')].find((x) => x.textContent === w); if (t) { t.click(); return w; } return null; });
    console.log('tapped word:', r);
  } else if (action === 'build') {
    const r = await page.evaluate(() => { const w = window.__puzzleCurrent?.word; if (!w) return null; for (const ch of w) { const t = [...document.querySelectorAll('.tray-tile')].find((x) => !x.classList.contains('used') && x.textContent === ch); if (t) t.click(); } return w; });
    console.log('built:', r);
  } else if (action === 'scroll') {
    await page.evaluate((a) => { const s = document.querySelector('.scroll') || document.querySelector('.play-body') || document.scrollingElement; const to = a === 'bottom' ? s.scrollHeight : s.scrollHeight * parseFloat(a); s.scrollTo(0, to); }, arg || 'bottom');
  } else if (action === 'seed') {
    await page.evaluate(() => localStorage.setItem('crystal-spell-caverns:v1', JSON.stringify({ version: 1, profile: { name: 'Leo', onboarded: true }, settings: { difficulty: 'easy', length: 10, voice: false }, startLevel: 5, gems: 85, stats: { sessionsPlayed: 3, answers: 30, correct: 20, byDay: {} }, catalog: { owned: ['quartz'], milestoneDepth: 1 } })));
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  } else if (action === 'eval') {
    await page.evaluate((s) => { (0, eval)(s); }, arg);
  }
  await page.waitForTimeout(parseInt(process.env.WAIT || '400', 10));

  const note = await page.evaluate(() => {
    const de = document.documentElement;
    const overH = Math.max(0, de.scrollWidth - innerWidth);
    // deepest scrollable element overflow (inner scrollers hide from documentElement)
    let innerOver = 0, innerSel = '';
    for (const e of document.querySelectorAll('.scroll, .play-body, .onboard-body')) {
      const o = e.scrollHeight - e.clientHeight; if (o > innerOver) { innerOver = o; innerSel = e.className; }
    }
    const route = document.querySelector('.screen')?.className || document.body.firstElementChild?.className || '';
    return { route, overH, innerOver: Math.round(innerOver), innerSel, title: document.querySelector('.header-title,.home-title,h2,h3')?.textContent?.slice(0, 30) };
  });
  const path = `${DIR}/${tag}-${name}.png`;
  await page.screenshot({ path });
  console.log(`📸 ${path}`);
  console.log(`   route=${note.route} | hOver=${note.overH} | innerScroll=${note.innerOver}${note.innerSel ? ' (' + note.innerSel + ')' : ''}`);
} finally {
  // disconnect WITHOUT closing the long-lived browser
  process.exit(0);
}
