// scripts/qa_autofill.mjs — QA guard for OPEN BACKLOG #11 (disable keyboard autofill).
// Proves the mobile keyboard's autofill / autocomplete / autocorrect / spellcheck suggestion
// strip is OFF on every app text input. The headline check is `input.spellcheck === false`:
// the old el() helper set the boolean property to the string 'false' (TRUTHY → spellcheck ON),
// which is why suggestions still showed despite the attribute being present.
// Run: npm start (one terminal) then: node scripts/qa_autofill.mjs
import { chromium } from 'playwright';

const URL = process.env.URL || 'http://localhost:5173';
const browser = await chromium.launch();
const fails = [];

// Read the live autofill-relevant props of an input/textarea handle.
const PROPS = (n) => ({
  spellcheck: n.spellcheck, // the boolean PROPERTY — must be false (the bug was a truthy 'false')
  autocomplete: n.getAttribute('autocomplete'),
  autocorrect: n.getAttribute('autocorrect'),
  autocapitalize: n.getAttribute('autocapitalize'),
});
function expectOff(label, p, { needAutocorrect = true, needAutocap = true } = {}) {
  if (p.spellcheck !== false) fails.push(`${label}: spellcheck=${p.spellcheck} (want false)`);
  if (p.autocomplete !== 'off' && p.autocomplete !== 'new-password') fails.push(`${label}: autocomplete=${p.autocomplete} (want off/new-password)`);
  if (needAutocorrect && p.autocorrect !== 'off') fails.push(`${label}: autocorrect=${p.autocorrect} (want off)`);
  if (needAutocap && p.autocapitalize !== 'off') fails.push(`${label}: autocapitalize=${p.autocapitalize} (want off)`);
  const ok = !fails.some((f) => f.startsWith(label + ':'));
  console.log(`  ${ok ? '✓' : '✗'} ${label}: spellcheck=${p.spellcheck} autocomplete=${p.autocomplete} autocorrect=${p.autocorrect} autocapitalize=${p.autocapitalize}`);
}

const seedKnown = (w, i) => ({ word: w, tier: 1, pattern: 'short-o', rank: 50 + i, category: 'known', craftStreak: 2, craftAttempts: 2, craftCorrect: 2, order: i + 1 });
const SEED = {
  schema: 2, syncCode: null, syncConsent: false, parentPassword: null, activeId: 'm1',
  profiles: [{
    id: 'm1', version: 1, profile: { name: 'Drawer', onboarded: true },
    categories: { setSize: 10, level: 1, recent: [], order: 2, peakKnownish: 10, peakMastered: 0, words: ['lot'].map(seedKnown) },
  }],
};

const pickProfile = async (page) => {
  if (await page.locator('.profile-card:not(.add)').count()) await page.locator('.profile-card:not(.add)').first().click();
  await page.waitForSelector('.menu-card', { timeout: 8000 });
};

try {
  // ============ SEEDED CONTEXT: unit check + mastery + settings + feedback ============
  const ctx = await browser.newContext({ viewport: { width: 390, height: 780 } });
  await ctx.addInitScript((seed) => { try { localStorage.setItem('crystal-spell-caverns:v1', JSON.stringify(seed)); } catch {} }, SEED);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => fails.push('pageerror: ' + e.message));

  // ---- 1. DECISIVE UNIT CHECK of the el() fix (the root cause) ----
  await page.goto(URL, { waitUntil: 'networkidle' });
  console.log('1) el() helper — spellcheck reflected via attribute, not a truthy string property:');
  const unit = await page.evaluate(async () => {
    const { el, NO_AUTOFILL } = await import('/src/ui.js');
    const read = (n) => ({ spellcheck: n.spellcheck, autocomplete: n.getAttribute('autocomplete'), autocorrect: n.getAttribute('autocorrect'), autocapitalize: n.getAttribute('autocapitalize') });
    return {
      spread: read(el('input', { type: 'text', ...NO_AUTOFILL })),
      strFalse: el('input', { type: 'text', spellcheck: 'false' }).spellcheck, // the historical bug input
      boolFalse: el('input', { type: 'text', spellcheck: false }).spellcheck, // falsy-skip must not leave it default-on
      hasConst: !!NO_AUTOFILL,
    };
  });
  if (!unit.hasConst) fails.push('unit: NO_AUTOFILL not exported');
  expectOff('NO_AUTOFILL spread', unit.spread);
  if (unit.strFalse !== false) fails.push(`unit: el(spellcheck:'false').spellcheck=${unit.strFalse} (want false) — the original bug`);
  if (unit.boolFalse !== false) fails.push(`unit: el(spellcheck:false).spellcheck=${unit.boolFalse} (want false)`);
  console.log(`  ${unit.strFalse === false ? '✓' : '✗'} el(spellcheck:'false') → property false (was the bug)`);
  console.log(`  ${unit.boolFalse === false ? '✓' : '✗'} el(spellcheck:false)  → property false`);

  // ---- 2. MASTERY type-mode input (the prime suspect) ----
  console.log('\n2) Mastery keyboard-fallback "type the word" input:');
  await pickProfile(page);
  await page.locator('.menu-card.mastery').click();
  await page.waitForSelector('.draw-canvas', { timeout: 8000 });
  await page.locator('.draw-controls .btn.ghost', { hasText: 'Type' }).click(); // ⌨️ Type it
  await page.waitForSelector('.draw-type-input', { state: 'visible', timeout: 4000 });
  expectOff('mastery type input', await page.locator('.draw-type-input').evaluate(PROPS));

  // ---- 3. SETTINGS learner-name input ----
  console.log('\n3) Settings learner-name input:');
  await page.goto(URL, { waitUntil: 'networkidle' });
  await pickProfile(page);
  await page.locator('.menu-card', { hasText: 'Settings' }).click();
  await page.waitForSelector('input[placeholder="Explorer"]', { timeout: 6000 });
  expectOff('settings name', await page.locator('input[placeholder="Explorer"]').first().evaluate(PROPS));

  // ---- 4. FEEDBACK textarea ----
  console.log('\n4) Feedback note textarea:');
  await page.goto(URL, { waitUntil: 'networkidle' });
  await pickProfile(page);
  await page.locator('.menu-card.feedback').click();
  await page.waitForSelector('.feedback-note', { timeout: 6000 });
  expectOff('feedback note', await page.locator('.feedback-note').first().evaluate(PROPS));
  await ctx.close();

  // ============ FRESH CONTEXT (no seed): onboarding name ============
  console.log('\n5) Onboarding "type your name" input (fresh install):');
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 780 } });
  const page2 = await ctx2.newPage();
  page2.on('pageerror', (e) => fails.push('pageerror(onboarding): ' + e.message));
  await page2.goto(URL, { waitUntil: 'networkidle' });
  const onboardName = page2.locator('input.onboard-name');
  for (let i = 0; i < 10 && !(await onboardName.count()); i++) {
    const go = page2.locator('.onboard-go, .tap-start, .btn.primary').first();
    if (await go.count()) await go.click().catch(() => {});
    await page2.waitForTimeout(300);
  }
  if (await onboardName.count()) expectOff('onboarding name', await onboardName.first().evaluate(PROPS));
  else { fails.push('onboarding name: input not reached in 10 steps'); console.log('  ✗ onboarding name input not reached'); }
  await ctx2.close();

  console.log('\n' + (fails.length ? `❌ FAIL (${fails.length}):\n  - ` + fails.join('\n  - ') : '✅ PASS — autofill/autocorrect/spellcheck OFF on all checked inputs'));
} catch (e) {
  fails.push('PROBE ERROR: ' + e.message);
  console.error('\n❌ PROBE ERROR:', e.message);
} finally {
  await browser.close();
}
process.exit(fails.length ? 1 : 0);
