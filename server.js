// Tiny zero-dependency static file server so the game can be served over http(s)
// (ES modules don't load from file:// in Safari). Run: `npm start` then open the
// printed URL on the iPad (same Wi-Fi). Add to Home Screen for a full-screen app.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import os from 'node:os';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 5173;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const server = createServer(async (req, res) => {
  try {
    let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    if (urlPath === '/') urlPath = '/index.html';
    // prevent path traversal
    const safe = normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
    let filePath = join(ROOT, safe);
    let info;
    try { info = await stat(filePath); } catch { info = null; }
    if (info && info.isDirectory()) { filePath = join(filePath, 'index.html'); }
    const data = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
  }
});

server.listen(PORT, () => {
  const nets = os.networkInterfaces();
  const addrs = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) addrs.push(net.address);
    }
  }
  console.log('\n  💎 Crystal Spell Caverns is running!\n');
  console.log(`  On this computer:   http://localhost:${PORT}`);
  for (const a of addrs) console.log(`  On the iPad (Wi-Fi): http://${a}:${PORT}`);
  console.log('\n  (iPad must be on the same Wi-Fi. Then tap Share → Add to Home Screen.)\n');
});
