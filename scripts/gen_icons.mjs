// scripts/gen_icons.mjs — rasterize icons/icon.svg into the PNG home-screen icons
// the PWA manifest + iOS need. No image libraries: we render the SVG in headless
// Chromium (already a devDependency for the smoke test) and screenshot it at each
// size. Re-run after editing icon.svg:  node scripts/gen_icons.mjs
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const SIZES = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'apple-touch-icon.png', size: 180 },
];

const svg = await readFile(new URL('../icons/icon.svg', import.meta.url), 'utf8');
await mkdir(new URL('../icons/', import.meta.url), { recursive: true });

const browser = await chromium.launch();
try {
  for (const { file, size } of SIZES) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    const html = `<!doctype html><meta charset=utf-8>
      <style>html,body{margin:0;padding:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`;
    await page.setContent(html, { waitUntil: 'networkidle' });
    const buf = await page.screenshot({ clip: { x: 0, y: 0, width: size, height: size }, omitBackground: false });
    await writeFile(new URL(`../icons/${file}`, import.meta.url), buf);
    await page.close();
    console.log(`  ✓ icons/${file} (${size}×${size}, ${buf.length} bytes)`);
  }
} finally {
  await browser.close();
}
console.log('done.');
