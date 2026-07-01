// scripts/build_deploy.mjs — assemble a clean ./deploy folder containing ONLY the
// files the app needs at runtime, for drag-and-drop hosting (Netlify/Cloudflare/etc.).
//
// Excludes node_modules, .git, tests, build scripts, the dev server, and the dataset
// build inputs (data/chunks, backbone, curated, supplement) — keeping the upload tiny
// and tidy. Run:  node scripts/build_deploy.mjs   then drag the ./deploy folder to your
// host. (There is no build step in the app itself; this just copies the right files.)
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'deploy');

// Files + folders the running app + service worker actually reference. `_headers` carries the
// cache rules (Cloudflare Pages + Netlify both honor it in the output dir). netlify.toml is
// kept as a fallback host config (ignored by Cloudflare). Cloudflare Pages Functions live in
// the repo-root /functions dir and are processed by Cloudflare directly — NOT copied here.
const FILES = ['index.html', 'styles.css', 'manifest.webmanifest', 'sw.js', '_headers', 'netlify.toml'];
const DIRS = ['icons', 'src', 'audio', 'fonts', 'admin']; // audio optional (TTS clips, device-voice fallback); fonts = self-hosted Atkinson Hyperlegible (precached); admin = the operator dashboard bundle (ADMIN_APP.md, served at /admin, NOT precached)
const DATA = ['words.js', 'patterns.js', 'nonsense_blocklist.js', 'research_sample.js']; // the runtime dataset (not the build inputs)

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

let copied = 0;
const copy = (rel) => {
  const src = path.join(ROOT, rel);
  if (!fs.existsSync(src)) return false;
  fs.cpSync(src, path.join(OUT, rel), { recursive: true });
  copied += 1;
  return true;
};

for (const f of FILES) if (!copy(f)) console.warn(`  (skipped missing ${f})`);
for (const d of DIRS) if (!copy(d)) console.warn(`  (skipped missing ${d}/ — optional)`);
fs.mkdirSync(path.join(OUT, 'data'), { recursive: true });
for (const d of DATA) copy(path.join('data', d));

const size = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).reduce((sum, e) => {
    const p = path.join(dir, e.name);
    return sum + (e.isDirectory() ? size(p) : fs.statSync(p).size);
  }, 0);

console.log(`\n✅ Built ./deploy (${copied} top-level items, ${(size(OUT) / 1024 / 1024).toFixed(1)} MB).`);
console.log('   Drag the ./deploy folder onto https://app.netlify.com/drop to publish it.');
