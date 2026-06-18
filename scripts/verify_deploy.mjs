// scripts/verify_deploy.mjs — serve ./deploy on a throwaway port and load it headless,
// confirming the clean bundle runs standalone (no file referenced but not copied).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const ROOT = join(process.cwd(), 'deploy');
const PORT = 5174;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent((req.url || '/').split('?')[0]);
    if (p === '/') p = '/index.html';
    let fp = join(ROOT, normalize(p).replace(/^(\.\.[/\\])+/, ''));
    const info = await stat(fp).catch(() => null);
    if (info && info.isDirectory()) fp = join(fp, 'index.html');
    res.writeHead(200, { 'Content-Type': (MIME[extname(fp).toLowerCase()] || 'application/octet-stream') + '; charset=utf-8' });
    res.end(await readFile(fp));
  } catch {
    res.writeHead(404); res.end('404');
  }
});

await new Promise((r) => server.listen(PORT, r));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 820, height: 1180 } });
const errs = [];
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errs.push(m.text()));
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
page.on('requestfailed', (r) => errs.push('requestfailed: ' + r.url()));
await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle' });
// first run -> onboarding; confirm the app booted to a known screen
const onboard = await page.locator('.onboarding .onboard-go').count();
const home = await page.locator('.menu-card.play').count();
console.log('booted to:', onboard ? 'onboarding' : home ? 'home' : 'UNKNOWN');
console.log('console/page/request errors:', errs.length);
for (const e of errs.slice(0, 10)) console.log('  - ' + e);
await browser.close();
server.close();
