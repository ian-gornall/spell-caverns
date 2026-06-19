// scripts/qa_session.mjs — a LONG-LIVED browser for interactive exploratory QA.
//
// Launches one Chromium (phone viewport) with a CDP endpoint on :9222 and KEEPS IT OPEN.
// Step scripts (scripts/qa_do.mjs) connect over CDP, act on the SAME page, screenshot, and
// disconnect WITHOUT closing — so page/app state persists between steps and the tester
// (me) can navigate → screenshot → LOOK → decide the next action, like a human. Run this
// in the background; drive it with qa_do.mjs.
import { chromium } from 'playwright';

const DEV = process.env.DEV || 'iphone13';
const SIZES = { iphone13: { width: 390, height: 844 }, small: { width: 360, height: 740 }, big: { width: 430, height: 932 } };
const viewport = SIZES[DEV] || SIZES.iphone13;

const ctx = await chromium.launchPersistentContext('', {
  headless: true,
  viewport,
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  args: ['--remote-debugging-port=9222'],
});
const page = ctx.pages()[0] || (await ctx.newPage());
await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
console.log(`SESSION READY :9222  (device=${DEV} ${viewport.width}x${viewport.height})`);
await new Promise(() => {}); // keep alive until the process is killed
