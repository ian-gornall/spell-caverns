// scripts/qa_phone_audit.mjs — the GOAL audit: does the phone layout ever overlap / cram, and
// are the action BUTTONS visible at the same time as the word being filled in, REGARDLESS of
// word length? Seeds a fully-unlocked profile whose words are all LONG (the stress case), then
// drives Craft / Mastery / Mining / and the menu screens at small-phone + iPhone + landscape
// viewports. For each it screenshots AND prints objective metrics:
//   - body scroll  : does .play-body / .scroll overflow (you'd have to scroll)?
//   - hOver        : horizontal overflow (px past the viewport)
//   - covis        : are the KEY elements (the word display + the action buttons) ALL inside the
//                    viewport at once? lists any that are clipped above/below the fold or overlap.
// Run: npm start (one terminal), then: node scripts/qa_phone_audit.mjs
import { chromium } from 'playwright';
import { mkdir, rm } from 'node:fs/promises';

const URL = process.env.URL || 'http://localhost:5173';
const OUT = 'scripts/qa_phone_audit';
await rm(OUT, { recursive: true, force: true }).catch(() => {});
await mkdir(OUT, { recursive: true });

// ---- seed: every mode unlocked, every word LONG (9–13 chars) ----
const W = (word, tier, pattern, rank, category, extra = {}) => ({
  word, tier, pattern, rank, category,
  craftStreak: category === 'learning' ? 0 : 2, craftAttempts: 2, craftCorrect: 2, order: rank, ...extra,
});
const LEARN = [W('international', 9, 'suffix-tion', 193, 'learning'), W('university', 9, 'suffix', 173, 'learning'),
  W('community', 9, 'suffix', 227, 'learning'), W('government', 7, 'suffix-ment', 321, 'learning')];
const KNOWN = [W('information', 6, 'suffix-tion', 47, 'known'), W('different', 6, 'suffix', 383, 'known'),
  W('important', 6, 'suffix', 526, 'known'), W('something', 5, 'compound', 539, 'known')];
const MASTERED = [W('questions', 6, 'suffix-tion', 456, 'mastered'), W('beautiful', 6, 'suffix-ful', 1308, 'mastered'),
  W('knowledge', 7, 'silent', 832, 'mastered'), W('understand', 7, 'compound', 1229, 'mastered')];
const SEED = {
  schema: 2, syncCode: null, syncConsent: false, parentPassword: null, activeId: 'a1',
  profiles: [{
    id: 'a1', version: 1, profile: { name: 'Alexander', onboarded: true, colour: 'sky' },
    settings: { difficulty: 'medium', length: 4, voice: false },
    startLevel: 9, gems: 4200,
    catalog: { owned: ['quartz'], milestoneDepth: 1 },
    categories: {
      setSize: 4, level: 9, recent: [], order: 600, peakKnownish: 8, peakMastered: 4,
      words: [...LEARN, ...KNOWN, ...MASTERED],
    },
  }],
};

const VIEWS = [
  { name: 'small360', width: 360, height: 740 },
  { name: 'iphone390', width: 390, height: 844 },
  { name: 'land844', width: 844, height: 390 },
  // tablet regression guards: --play-scale must stay 1 here (the §31 iPad-approved layout is untouched)
  { name: 'ipadport820', width: 820, height: 1180 },
  { name: 'ipadland1024', width: 1024, height: 768 },
];

const browser = await chromium.launch();
const issues = [];
const flag = (m) => { issues.push(m); console.log('  ✗ ' + m); };

async function newPage(view) {
  const page = await browser.newPage({ viewport: { width: view.width, height: view.height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  page.on('pageerror', (e) => flag(`pageerror: ${e.message}`));
  await page.addInitScript((seed) => { try { localStorage.setItem('crystal-spell-caverns:v1', JSON.stringify(seed)); } catch {} }, SEED);
  return page;
}
async function gotoHome(page) {
  await page.goto(URL, { waitUntil: 'networkidle' });
  if (await page.locator('.profile-card:not(.add)').count()) await page.locator('.profile-card:not(.add)').first().click();
  await page.waitForSelector('.menu-card', { timeout: 8000 });
  await page.waitForTimeout(300);
}

// Measure: horizontal overflow, whether the main scroller overflows, and whether each named
// element is fully inside the viewport (so the word + buttons are co-visible without scrolling).
// HIDDEN elements (display:none → zero box) are reported but NEVER count as "clipped" (the wide
// boxes are hidden on a phone, the narrow canvas on a tablet — that's correct, not a bug).
async function measure(page, view, keyEls) {
  return await page.evaluate(({ vh, keys }) => {
    const de = document.documentElement;
    const hOver = Math.max(0, de.scrollWidth - de.clientWidth);
    const scroller = document.querySelector('.play-body') || document.querySelector('.scroll') || document.querySelector('.onboard-body');
    const bodyScroll = scroller ? Math.max(0, scroller.scrollHeight - scroller.clientHeight) : 0;
    const header = document.querySelector('.app-header');
    const headBottom = header ? header.getBoundingClientRect().bottom : 0;
    const pb = document.querySelector('.play-body');
    const playScale = pb ? (pb.style.getPropertyValue('--play-scale') || '1') : '';
    const out = [];
    for (const sel of keys) {
      const e = document.querySelector(sel);
      if (!e) { out.push({ sel, missing: true }); continue; }
      const r = e.getBoundingClientRect();
      const hidden = r.width === 0 && r.height === 0; // display:none / not rendered
      out.push({
        sel, hidden,
        top: Math.round(r.top), bottom: Math.round(r.bottom),
        clippedTop: !hidden && r.top < headBottom - 1,  // hidden under the header
        belowFold: !hidden && r.bottom > vh + 1,        // runs past the bottom edge
        h: Math.round(r.height),
      });
    }
    return { hOver, bodyScroll, vh, headBottom: Math.round(headBottom), playScale, els: out };
  }, { vh: view.height, keys: keyEls });
}

// covis:true (default) = a PLAY screen — the keyed elements MUST all be on-screen at once.
// covis:false = a CONTENT screen (catalog/progress/settings) — it legitimately scrolls; we only
// require no horizontal overflow + capture it for a visual cramming check.
async function shot(page, view, label, keyEls, { allowBodyScroll = false, covis = true } = {}) {
  const m = await measure(page, view, keyEls);
  await page.screenshot({ path: `${OUT}/${view.name}-${label}.png` });
  const clipped = m.els.filter((e) => !e.missing && !e.hidden && (e.clippedTop || e.belowFold));
  console.log(`\n[${view.name}] ${label}  hOver=${m.hOver} bodyScroll=${m.bodyScroll} vh=${m.vh} scale=${m.playScale}`);
  // iPad PORTRAIT is the §31 user-approved layout — it has ample height, so it must stay at scale 1
  // (any shrink there would be a real regression). iPad LANDSCAPE (768 tall) legitimately shrinks a
  // little for long words to keep the controls co-visible — that's the same goal, and it looks great.
  if (view.name === 'ipadport820' && m.playScale && parseFloat(m.playScale) < 1) flag(`${view.name}/${label}: portrait iPad --play-scale=${m.playScale} (should be 1 — approved layout changed!)`);
  for (const e of m.els) {
    if (e.missing) { console.log(`   - ${e.sel}: MISSING`); continue; }
    if (e.hidden) { console.log(`   - ${e.sel}: (hidden)`); continue; }
    const tag = e.clippedTop ? ' ⬆CLIPPED-UNDER-HEADER' : e.belowFold ? ' ⬇BELOW-FOLD' : '';
    console.log(`   - ${e.sel}: top=${e.top} bottom=${e.bottom} h=${e.h}${tag}`);
  }
  if (m.hOver > 1) flag(`${view.name}/${label}: horizontal overflow ${m.hOver}px`);
  if (covis && clipped.length) flag(`${view.name}/${label}: NOT co-visible (must scroll): ${clipped.map((e) => e.sel).join(', ')}`);
  if (covis && !allowBodyScroll && m.bodyScroll > 1) flag(`${view.name}/${label}: play area scrolls ${m.bodyScroll}px (word/buttons not all on screen)`);
  return m;
}

for (const view of VIEWS) {
  console.log(`\n================ ${view.name} (${view.width}x${view.height}) ================`);
  const wide = view.width >= 700; // §31 multi-box mastery layout kicks in at ≥700px
  const reHome = async () => {
    await page.goto(URL, { waitUntil: 'networkidle' });
    if (await page.locator('.profile-card:not(.add)').count()) await page.locator('.profile-card:not(.add)').first().click();
    await page.waitForSelector('.menu-card', { timeout: 8000 });
    await page.waitForTimeout(250);
  };
  const page = await newPage(view);
  try {
    // HOME — a scrolling menu; only require the PRIMARY actions to be above the fold (not all 9 cards).
    await reHome(page);
    await shot(page, view, '00-home', ['.menu-card.craft', '.menu-card.mastery', '.menu-card.play'], { allowBodyScroll: true });

    // CRAFT (puzzle) — the long-word word-build. Fresh = word slots + tray + Hint/Clear co-visible.
    await page.locator('.menu-card.craft').click();
    await page.waitForSelector('.slots', { timeout: 8000 });
    await page.waitForTimeout(600);
    const cw = await page.evaluate(() => window.__puzzleCurrent?.word);
    console.log(`  craft word="${cw}" (len ${cw?.length})`);
    await shot(page, view, `01-craft-fresh-${cw}`, ['.sentence', '.slots', '.puzzle-controls', '.tray']);

    // MASTERY (draw). PHONE (<700) = single canvas + candidates + Clear/Type. WIDE (≥700) = boxes + Check.
    await reHome(page);
    await page.locator('.menu-card.mastery').click();
    await page.waitForSelector(wide ? '.draw-boxes' : '.draw-canvas', { state: 'visible', timeout: 8000 });
    await page.waitForTimeout(600);
    const mw = await page.evaluate(() => window.__masteryCurrent);
    console.log(`  mastery word="${mw?.word}" (len ${mw?.word?.length}) wide=${mw?.wide}`);
    const mKeys = wide
      ? ['.draw-boxes', '.draw-submit', '.draw-controls']
      : ['.slots.draw-slots', '.draw-canvas', '.draw-candidates', '.draw-controls'];
    await shot(page, view, `02-mastery-${mw?.word}`, mKeys);

    // NARROW: draw a stroke so the "Is it…" candidate row appears, then re-measure — the canvas
    // must shrink (fitPlayArea) so the candidates AND the Clear/Type buttons stay on screen for a
    // long word (the GOAL: buttons visible WITH the word being filled, even mid-interaction).
    if (!wide) {
      const cb = await page.locator('.draw-canvas').boundingBox();
      if (cb) {
        await page.mouse.move(cb.x + cb.width * 0.5, cb.y + cb.height * 0.2);
        await page.mouse.down();
        await page.mouse.move(cb.x + cb.width * 0.5, cb.y + cb.height * 0.8, { steps: 4 });
        await page.mouse.up();
        await page.waitForTimeout(1100); // recognise debounce → candidates render → fit re-runs
        await shot(page, view, `02b-mastery-candidates-${mw?.word}`, ['.slots.draw-slots', '.draw-canvas', '.draw-candidates', '.draw-controls']);
      }
    }

    // MINING (rhythm) — sentence + 4 answer tiles.
    await reHome(page);
    await page.locator('.menu-card.play').click();
    await page.waitForSelector('.tiles', { timeout: 8000 });
    await page.waitForTimeout(500);
    await shot(page, view, '03-mining', ['.sentence', '.speedmeter', '.tiles']);

    // SECONDARY content screens — these legitimately scroll; we only require NO horizontal overflow
    // and that the screenshot reads as un-crammed (visual check). Capture each for a look.
    for (const [card, sel, label] of [
      ['.menu-card.catalog', '.catalog-grid, .catalog', '04-catalog'],
      ['.menu-card.lab', '.lab, .lab-stage', '05-lab'],
    ]) {
      await reHome(page);
      const c = page.locator(card);
      if (await c.count()) {
        await c.first().click();
        await page.waitForTimeout(700);
        await shot(page, view, label, [sel.split(',')[0].trim()], { covis: false });
      }
    }
    // Progress + Settings reached by their cards (last two of the grid).
    for (const [rx, label] of [['Progress', '06-progress'], ['Settings', '07-settings']]) {
      await reHome(page);
      const c = page.locator('.menu-card', { hasText: rx });
      if (await c.count()) {
        await c.first().click();
        await page.waitForTimeout(700);
        await shot(page, view, label, ['.screen'], { covis: false });
      }
    }
  } catch (e) {
    flag(`${view.name}: drive error ${e.message}`);
  } finally {
    await page.close();
  }
}

console.log('\n================ SUMMARY ================');
console.log(issues.length ? `${issues.length} issue(s):\n - ${issues.join('\n - ')}` : 'No layout issues detected.');
await browser.close();
process.exitCode = issues.length ? 1 : 0;
