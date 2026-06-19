// scripts/check_deploy.mjs — poll the LIVE service worker until its VERSION matches the
// target (or time out), so a deploy can be verified instead of assumed. Reads the prod URL
// from a constant (kept out of the shell command). Usage: node scripts/check_deploy.mjs csc-v34
const URL = 'https://spell.pryzmio.com/sw.js';
const TARGET = process.argv[2] || 'csc-v34';
const deadlineMs = Date.now() + 6 * 60 * 1000;
let last = '';
while (Date.now() < deadlineMs) {
  try {
    const r = await fetch(URL, { cache: 'no-store' });
    const t = await r.text();
    const m = t.match(/const VERSION = '([^']+)'/);
    const v = m ? m[1] : '(no version found)';
    if (v !== last) {
      console.log(new Date().toISOString(), 'live sw =', v);
      last = v;
    }
    if (v === TARGET) {
      console.log('DEPLOYED ✅', TARGET);
      process.exit(0);
    }
  } catch (e) {
    console.log(new Date().toISOString(), 'fetch error:', e.message);
  }
  await new Promise((res) => setTimeout(res, 15000));
}
console.log('TIMED OUT waiting for', TARGET, '— last seen:', last);
process.exit(1);
