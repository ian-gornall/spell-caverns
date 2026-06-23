// scripts/qa_admin.mjs — visual + functional QA of the operator ADMIN APP (ADMIN_APP.md).
//
// The admin bundle (/admin) is static; its /api/admin/* calls are MOCKED here with an in-memory
// store that mimics the worker (a PUT bumps the container's adminRev). Drives the real UI:
// login -> overview (desktop table + phone cards + group-by-family) -> detail -> edit+Save
// (asserts the authoritative adminRev bump + the field persisted) -> CSV export (asserts a BOM +
// header). Any console/page error fails the run. Screenshots -> scripts/qa_admin/. Self-contained:
// spawns server.js on its own port. Run: node scripts/qa_admin.mjs   (needs `npm i --no-save playwright`)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const PORT = process.env.PORT || 5199;
const BASE = `http://localhost:${PORT}`; // not `URL` — that would shadow the global URL constructor
const SHOTS = 'scripts/qa_admin';
mkdirSync(SHOTS, { recursive: true });

const errors = [];
const ok = (m) => console.log('✅ ' + m);
const fail = (m) => { console.error('❌ ' + m); process.exitCode = 1; };

// ---- seed data (two families) -------------------------------------------------------------
const W = (word, category, over = {}) => ({ word, category, band: 1, pattern: 'short a', craftAttempts: 2, craftCorrect: 2, craftStreak: 1, lastSeen: 1, order: 1, ...over });
const cats = (words) => ({ setSize: 3, level: 5, recent: [], order: words.length, seen: 5, reviewPending: { craft: 0, mastery: 0 }, peakKnownish: 3, peakMastered: 3, peakLevel: 5, words });
const profile = (id, name, over = {}) => ({
  id, version: 1, profile: { name, onboarded: true },
  settings: { themeColor: '#7aa2ff', difficulty: 'easy', length: 10, voice: true, ...(over.settings || {}) },
  placement: { done: true, age: over.age || 8 }, kidLock: null,
  gems: over.gems || 100, feedback: [], specimens: over.specimens || [],
  stats: { sessionsPlayed: over.sessions || 5, answers: over.answers || 10, correct: over.correct || 8, playMs: over.playMs || 600000, byDay: {} },
  streak: { count: 4, lastPlayedDate: '2026-06-22', longest: 9, freezes: 0 },
  catalog: { owned: ['amethyst'], milestoneDepth: 3 },
  categories: cats(over.words || [W('cat', 'mastered'), W('hat', 'mastered'), W('map', 'known'), W('ship', 'learning'), W('split', 'tricky')]),
});
// a tiny 1x1 png dataURL for a specimen thumbnail
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const store = {
  K7M3PQ2R: { app: 'crystal-spell-caverns', backupVersion: 1, savedAt: 1718900000000, data: { schema: 2, syncCode: 'K7M3PQ2R', activeId: 'p1', adminRev: 0, profiles: [
    profile('p1', 'Lex', { gems: 1240, playMs: 15120000, sessions: 63, answers: 50, correct: 43, specimens: [{ ts: 1, word: 'cat', name: 'Sparkle', image: PNG }, { ts: 2, word: 'dog', name: 'Rocky', image: PNG }] }),
    profile('p2', 'Sam, Jr', { gems: 30, playMs: 120000, sessions: 2, answers: 6, correct: 4 }),
  ] } },
  ABCD2345: { app: 'crystal-spell-caverns', backupVersion: 1, savedAt: 1718800000000, data: { schema: 2, syncCode: 'ABCD2345', activeId: 'p3', adminRev: 0, profiles: [
    profile('p3', 'Maya', { gems: 500, playMs: 3600000, sessions: 20 }),
  ] } },
};

const server = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try { const r = await fetch(BASE + '/admin/admin.js'); if (r.ok) return true; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

const browser = await chromium.launch();
try {
  if (!(await waitForServer())) { fail('server did not start'); throw new Error('no server'); }
  const page = await browser.newPage({ viewport: { width: 1000, height: 820 } });
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

  // Mock /api/admin/* with an in-memory store that mimics the worker (PUT bumps adminRev).
  await page.route('**/api/admin/**', async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const json = (status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (u.pathname === '/api/admin/families' && req.method() === 'GET') {
      return json(200, Object.entries(store).map(([code, e]) => ({ code, savedAt: e.savedAt, adminRev: e.data.adminRev || 0, data: e.data })));
    }
    const m = u.pathname.match(/^\/api\/admin\/family\/(.+)$/);
    if (m) {
      const code = decodeURIComponent(m[1]);
      if (req.method() === 'PUT') {
        const data = JSON.parse(req.postData()).data;
        data.adminRev = ((store[code] && store[code].data.adminRev) || 0) + 1;
        store[code] = { app: 'crystal-spell-caverns', backupVersion: 1, data, savedAt: 1718999999999 };
        return json(200, store[code]);
      }
      if (req.method() === 'DELETE') { delete store[code]; return route.fulfill({ status: 204, body: '' }); }
      if (req.method() === 'GET') return json(200, store[code] || null);
    }
    return json(404, { error: 'not found' });
  });

  // --- 1. LOGIN -----------------------------------------------------------------------------
  await page.goto(BASE + '/admin', { waitUntil: 'networkidle' });
  await page.waitForSelector('input[type=password]', { timeout: 5000 });
  ok('admin /admin shows the login screen (no key yet)');
  await page.screenshot({ path: `${SHOTS}/01_login.png` });

  // --- 2. OVERVIEW (desktop table) ----------------------------------------------------------
  await page.fill('input[type=password]', 'test-admin-key');
  await page.click('.btn.primary');
  await page.waitForSelector('.admin-table tbody tr', { timeout: 5000 });
  const rowCount = await page.locator('.admin-table tbody tr').count();
  if (rowCount === 3) ok('overview lists all 3 students across 2 families (desktop table)');
  else fail(`expected 3 student rows, got ${rowCount}`);
  await page.screenshot({ path: `${SHOTS}/02_overview_desktop.png` });

  // group-by-family
  await page.click('.btn.ghost:has-text("Group by family")');
  await page.waitForSelector('.admin-table .admin-group-head', { timeout: 4000 });
  const heads = await page.locator('.admin-table .admin-group-head').count();
  if (heads === 2) ok('group-by-family shows 2 family group headers');
  else fail(`expected 2 group headers, got ${heads}`);
  await page.click('.btn.ghost:has-text("Ungroup")');
  await page.waitForSelector('.admin-table tbody tr', { timeout: 4000 });

  // search filter
  await page.fill('.admin-bar input[type=text]', 'maya');
  await page.waitForFunction(() => document.querySelectorAll('.admin-table tbody tr').length === 1, null, { timeout: 4000 });
  ok('search filters the roster (maya -> 1 row)');
  await page.fill('.admin-bar input[type=text]', '');

  // --- 3. DETAIL ----------------------------------------------------------------------------
  await page.click('.admin-table tbody tr:has-text("Lex")');
  await page.waitForSelector('.panel:has-text("Identity")', { timeout: 5000 });
  for (const sec of ['Identity', 'Settings', 'Progress', 'Stats', 'Words', 'Specimens', 'Restore points', 'Danger zone']) {
    if (await page.locator(`.panel:has-text("${sec}")`).count()) ok(`detail has the ${sec} section`);
    else fail(`detail missing the ${sec} section`);
  }
  const thumbs = await page.locator('.spec-thumb img').count();
  if (thumbs === 2) ok('specimen thumbnails render (2 drawings)');
  else fail(`expected 2 specimen thumbnails, got ${thumbs}`);
  await page.screenshot({ path: `${SHOTS}/03_detail_desktop.png`, fullPage: true });

  // --- 4. EDIT + SAVE (authoritative adminRev bump) -----------------------------------------
  // change "Words per dig" to 7 and Save; assert the mock store bumped adminRev and stored 7.
  const wpd = page.locator('.panel:has-text("Settings") input[type=number]').first();
  await wpd.fill('7');
  await page.click('.admin-bar .btn.primary:has-text("Save")');
  await page.waitForSelector('.toast', { timeout: 4000 });
  await page.waitForTimeout(400);
  const after = store.K7M3PQ2R.data;
  const lex = after.profiles.find((p) => p.id === 'p1');
  if (after.adminRev === 1) ok('Save bumped the container adminRev (0 -> 1, authoritative)');
  else fail(`adminRev not bumped: ${after.adminRev}`);
  if (lex.settings.length === 7 && lex.categories.setSize === 7) ok('edit persisted (words-per-dig 7, setSize synced)');
  else fail(`edit not persisted: length=${lex.settings.length} setSize=${lex.categories.setSize}`);

  // --- 5. EXPORT CSV ------------------------------------------------------------------------
  await page.click('.admin-bar .btn.ghost:has-text("Back")');
  await page.waitForSelector('.admin-table tbody tr', { timeout: 4000 });
  await page.click('.admin-bar .btn.primary:has-text("Export CSV")');
  await page.waitForSelector('.gate-box:has-text("Export CSV")', { timeout: 4000 });
  ok('export modal opens with the column picker');
  await page.screenshot({ path: `${SHOTS}/04_export_modal.png` });
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 5000 }),
    page.click('.gate-actions .btn.primary:has-text("Download")'),
  ]);
  const path = await download.path();
  const { readFile } = await import('node:fs/promises');
  const csv = await readFile(path, 'utf8');
  if (csv.charCodeAt(0) === 0xfeff) ok('exported CSV begins with a UTF-8 BOM');
  else fail('CSV missing BOM');
  if (csv.includes('Name') && csv.includes('Lex') && csv.includes('Mastered #')) ok('CSV has the default header + a student row');
  else fail('CSV content unexpected');

  // --- 6. PHONE (cards) ---------------------------------------------------------------------
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForSelector('.admin-cards .admin-card', { timeout: 4000 });
  const cards = await page.locator('.admin-cards .admin-card').count();
  if (cards === 3) ok('phone viewport shows the card list (3 cards)');
  else fail(`expected 3 phone cards, got ${cards}`);
  // no horizontal overflow
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow <= 1) ok('no horizontal overflow on phone');
  else fail(`horizontal overflow on phone: ${overflow}px`);
  await page.screenshot({ path: `${SHOTS}/05_overview_phone.png` });

  await page.close();
} catch (e) {
  fail('exception: ' + (e && e.stack ? e.stack : e));
} finally {
  if (errors.length) {
    console.error('\n--- page/console errors ---');
    errors.forEach((e) => console.error('  ' + e));
    process.exitCode = 1;
  }
  await browser.close();
  server.kill();
  console.log(process.exitCode ? '\nQA_ADMIN FAILED' : '\nQA_ADMIN PASSED');
}
