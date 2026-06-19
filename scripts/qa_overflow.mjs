// scripts/qa_overflow.mjs — DEEP horizontal-overflow hunt.
//
// Why this exists: qa_responsive.mjs only measures document/body scrollWidth. But the app
// scrolls inside PER-SCREEN containers (.home, .settings, ... each `overflow-y:auto`, which
// forces overflow-x:auto too). A child wider than that container makes the INNER box pannable
// right — invisible to a document-level check, but the user feels it as "I can scroll a bit /
// things are cut off on the right". This script walks EVERY element and flags any that is its
// own horizontal-scroll container (scrollWidth > clientWidth) or that paints past the app's
// right content edge. It also runs a TEXT-SCALED pass (Samsung/Android large-font users).
import { chromium } from 'playwright';
const URL = process.env.URL || 'http://localhost:5173';

// Real Samsung Galaxy CSS-px viewports (One UI default density) + a couple of references.
const DEVICES = [
  { id: 'galaxy-s22', w: 360, h: 780, label: 'Galaxy S22/S21' },
  { id: 'galaxy-s8', w: 360, h: 740, label: 'Galaxy S8/S9 (narrow)' },
  { id: 'galaxy-a', w: 412, h: 915, label: 'Galaxy A-series / S20+' },
  { id: 'galaxy-fold-out', w: 384, h: 854, label: 'Galaxy (384)' },
];

const SEED = {
  version: 1,
  profile: { name: 'Sam', onboarded: true },
  settings: { difficulty: 'easy', length: 10, optionCount: 3, voice: false, volume: 0.85, voiceRate: 0.85, themeColor: '#7AA2FF', dailyGoalGems: 250 },
  startLevel: 5, gems: 5400, feedback: [], specimens: [],
  stats: { sessionsPlayed: 5, answers: 60, correct: 44, byDay: {} },
  streak: { count: 3, lastPlayedDate: new Date().toISOString().slice(0, 10), longest: 6, freezes: 1 },
  records: { bestCombo: 8, bestWaveGems: 220 },
  catalog: { owned: ['quartz', 'amethyst'], milestoneDepth: 1 },
};

// Returns every element that is a horizontal-scroll container, or paints past #app's right edge.
async function scan(page, label) {
  return page.evaluate((label) => {
    const app = document.getElementById('app');
    const appRight = app ? app.getBoundingClientRect().right - parseFloat(getComputedStyle(app).paddingRight || '0') : window.innerWidth;
    const vw = window.innerWidth;
    const path = (e) => {
      let s = e.tagName.toLowerCase();
      if (e.id) s += '#' + e.id;
      if (e.className && typeof e.className === 'string') s += '.' + e.className.trim().split(/\s+/).join('.');
      return s;
    };
    const out = { label, vw, appRight: Math.round(appRight), scrollers: [], bleeders: [], docHoriz: Math.round(Math.max(document.documentElement.scrollWidth - vw, document.body.scrollWidth - vw)) };
    const ROOTS = new Set([document.documentElement, document.body, app]);
    for (const e of document.querySelectorAll('*')) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      // inner horizontal scroll container (the bug class qa_responsive can't see)
      if (e.scrollWidth - e.clientWidth > 1 && /(auto|scroll)/.test(cs.overflowX)) {
        out.scrollers.push(`${path(e)} scrollW=${e.scrollWidth} clientW=${e.clientWidth} (+${e.scrollWidth - e.clientWidth})`);
      }
      // painting past the TRUE viewport edge = a real right-side cut-off. Skip the root boxes
      // (html/body/#app legitimately span the full viewport; only their CONTENT is inset).
      if (ROOTS.has(e)) continue;
      const r = e.getBoundingClientRect();
      if (r.width > 0 && r.right > vw + 1.5) {
        out.bleeders.push(`${path(e)} right=${Math.round(r.right)} > vw=${vw} (w=${Math.round(r.width)})`);
      }
    }
    out.scrollers = out.scrollers.slice(0, 8);
    out.bleeders = out.bleeders.slice(0, 8);
    return out;
  }, label);
}

async function gotoHome(page) {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate((s) => localStorage.setItem('crystal-spell-caverns:v1', JSON.stringify(s)), SEED);
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(250);
}

async function openByText(page, re) {
  await page.evaluate((src) => {
    const re = new RegExp(src, 'i');
    const b = [...document.querySelectorAll('button, .menu-card, .btn, .stat, a')].find((x) => re.test(x.textContent));
    if (b) b.click();
  }, re.source);
  await page.waitForTimeout(350);
}

const browser = await chromium.launch();
const findings = [];

for (const scale of [1, 1.3]) {
  for (const d of DEVICES) {
    const ctx = await browser.newContext({ viewport: { width: d.w, height: d.h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    if (scale !== 1) await page.addInitScript((s) => { document.documentElement.style.fontSize = (18 * s) + 'px'; }, scale);
    const tag = `${d.label} @${scale}x`;

    await gotoHome(page);
    // re-assert font scale after navigations (init script runs on each nav, but be safe)
    if (scale !== 1) await page.evaluate((s) => (document.documentElement.style.fontSize = 18 * s + 'px'), scale);

    const screens = [
      ['home', null],
      ['settings', /settings|⚙/],
      ['progress', /progress|map|journey/],
      ['catalog', /collection|catalog|crystals|specimens/],
      ['craft', /craft|build/],
      ['practice', /practice|mine|dig|play/],
    ];
    for (const [name, re] of screens) {
      if (re) { await gotoHome(page); if (scale !== 1) await page.evaluate((s) => (document.documentElement.style.fontSize = 18 * s + 'px'), scale); await openByText(page, re); }
      const r = await scan(page, `${tag} [${name}]`);
      const probs = [];
      if (r.scrollers.length) probs.push(`INNER-SCROLL: ${r.scrollers.join(' || ')}`);
      if (r.bleeders.length) probs.push(`BLEED: ${r.bleeders.join(' || ')}`);
      if (r.docHoriz > 1) probs.push(`docHoriz=${r.docHoriz}`);
      console.log(`  ${name.padEnd(10)} vw=${r.vw} appRight=${r.appRight} ${probs.length ? '⚠ ' + probs.join(' ;; ') : 'ok'}`);
      if (probs.length) findings.push(`${tag} [${name}]: ${probs.join(' ;; ')}`);
    }
    console.log(`=== ${tag} done ===\n`);
    await ctx.close();
  }
}

console.log('\n================ DEEP OVERFLOW FINDINGS ================');
console.log(findings.length ? findings.join('\n') : '✅ no inner-scroll / bleed at any tested Galaxy size or text scale');
await browser.close();
