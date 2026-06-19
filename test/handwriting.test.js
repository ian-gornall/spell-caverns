// test/handwriting.test.js — §30 MASTERY (draw) mode recognizer (pure math).
// (src/engine/handwriting.js). Runs under `node --test` (no browser, no cloud).
//
// The recognizer is FREE + OFFLINE on-device template matching: resample → normalize
// (uniform scale, NO rotation/reflection invariance — letters need their orientation, e.g.
// b≠d≠p≠q) → nearest-template path distance → confidence. recognize() returns up to N
// HIGH-CONFIDENCE candidate letters (or none → the UI forces a redraw). Case-insensitive:
// a template letter is reported lowercased, and lower/upper templates for the same letter merge.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  resample,
  normalize,
  pathDistance,
  recognize,
  DIST_SCALE,
  DEFAULT_MIN_CONFIDENCE,
  pointsToGrid,
  diceScore,
  strokesToGrid,
  recognizeGrid,
  GRID_N,
} from '../src/engine/handwriting.js';

// ---- shape generators (return dense point arrays the way a canvas captures a drag) ----
function line(x1, y1, x2, y2, n = 24) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    pts.push({ x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) });
  }
  return pts;
}
function circle(cx, cy, r, n = 48) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / (n - 1)) * 2 * Math.PI;
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return pts;
}
const vee = (n = 24) => [...line(0, 0, 5, 10, n), ...line(5, 10, 10, 0, n)];

// templates: one (or more) reference strokes per letter (strokes = array of point arrays)
const TEMPLATES = [
  { letter: 'l', strokes: [line(5, 0, 5, 10)] }, // vertical bar
  { letter: 'o', strokes: [circle(5, 5, 5)] }, // round
  { letter: 'v', strokes: [vee()] }, // a vee
];

test('resample returns exactly n points spanning the path', () => {
  const r = resample(line(0, 0, 10, 0, 7), 16);
  assert.equal(r.length, 16);
  assert.ok(Math.abs(r[0].x - 0) < 1e-6);
  assert.ok(Math.abs(r[r.length - 1].x - 10) < 1e-6);
});

test('normalize centers at the origin and scales UNIFORMLY (aspect ratio preserved)', () => {
  const norm = normalize(resample(line(0, 0, 0, 10, 12), 16)); // a tall thin vertical line
  const xs = norm.map((p) => p.x);
  const ys = norm.map((p) => p.y);
  // centered: mean ~0
  assert.ok(Math.abs(xs.reduce((a, b) => a + b, 0) / xs.length) < 1e-6);
  // a vertical line keeps near-zero width but full height after uniform scaling (not stretched to a square)
  const w = Math.max(...xs) - Math.min(...xs);
  const h = Math.max(...ys) - Math.min(...ys);
  assert.ok(w < 1e-6, 'width stays ~0 — not stretched');
  assert.ok(Math.abs(h - 1) < 1e-6, 'tallest dimension scaled to 1');
});

test('pathDistance is ~0 for identical paths and larger for different ones', () => {
  const a = normalize(resample(line(0, 0, 0, 10), 32));
  const b = normalize(resample(line(0, 0, 0, 10), 32));
  const c = normalize(resample(line(0, 0, 10, 0), 32)); // horizontal vs vertical
  assert.ok(pathDistance(a, b) < 1e-6);
  assert.ok(pathDistance(a, c) > pathDistance(a, b));
});

test('recognize: a vertical stroke yields "l" as the top high-confidence candidate', () => {
  const drawn = [line(5.2, 0, 4.9, 10)]; // slightly wobbly vertical
  const cands = recognize(drawn, TEMPLATES);
  assert.ok(cands.length >= 1);
  assert.equal(cands[0].letter, 'l');
  assert.ok(cands[0].confidence >= DEFAULT_MIN_CONFIDENCE);
  // candidates are sorted by confidence descending
  for (let i = 1; i < cands.length; i++) assert.ok(cands[i - 1].confidence >= cands[i].confidence);
});

test('recognize: a vee stroke yields "v"', () => {
  const cands = recognize([vee()], TEMPLATES);
  assert.equal(cands[0].letter, 'v');
});

test('recognize: an unrecognizable scribble returns NO high-confidence candidate (force redraw)', () => {
  // a tiny tangle nothing like l/o/v
  const scribble = [
    [
      { x: 0, y: 0 },
      { x: 9, y: 1 },
      { x: 1, y: 8 },
      { x: 8, y: 9 },
      { x: 2, y: 2 },
    ],
  ];
  const cands = recognize(scribble, TEMPLATES, { minConfidence: 0.9 });
  assert.equal(cands.length, 0);
});

test('recognize: case-insensitive — uppercase templates report lowercase and merge with lowercase', () => {
  const t = [
    { letter: 'O', strokes: [circle(5, 5, 5)] },
    { letter: 'o', strokes: [circle(5, 5, 5, 40)] },
    { letter: 'l', strokes: [line(5, 0, 5, 10)] },
  ];
  const cands = recognize([circle(5, 5, 5, 36)], t);
  assert.equal(cands[0].letter, 'o'); // reported lowercase
  // 'O' and 'o' merge into a single 'o' candidate (no duplicate letters)
  const letters = cands.map((c) => c.letter);
  assert.equal(new Set(letters).size, letters.length);
});

test('recognize: caps the candidate list at maxCandidates', () => {
  const many = [];
  for (let i = 0; i < 8; i++) many.push({ letter: String.fromCharCode(97 + i), strokes: [line(5, 0, 5, 10)] });
  const cands = recognize([line(5, 0, 5, 10)], many, { maxCandidates: 4, minConfidence: 0 });
  assert.ok(cands.length <= 4);
});

test('DIST_SCALE and DEFAULT_MIN_CONFIDENCE are exported and sane', () => {
  assert.ok(DIST_SCALE > 0);
  assert.ok(DEFAULT_MIN_CONFIDENCE > 0 && DEFAULT_MIN_CONFIDENCE < 1);
});

// ------------------------------------------------------ GRID recognizer (draw-mode UI)
test('pointsToGrid rasterises into an N×N grid, uniformly scaled + centred', () => {
  const g = pointsToGrid(line(5, 0, 5, 10), GRID_N, 0); // a vertical line
  assert.equal(g.length, GRID_N * GRID_N);
  // it has ink, and the ink is a NARROW vertical band near the centre column
  let cols = new Set();
  let rows = 0;
  for (let y = 0; y < GRID_N; y++)
    for (let x = 0; x < GRID_N; x++)
      if (g[y * GRID_N + x]) { cols.add(x); rows += 1; }
  assert.ok(rows > 0);
  assert.ok(cols.size <= 2, 'a vertical line occupies ~one column (uniform scale, not stretched)');
});

test('diceScore is 1 for identical grids, 0 for disjoint, and partial in between', () => {
  const a = pointsToGrid(line(0, 0, 0, 10));
  const b = pointsToGrid(line(0, 0, 0, 10));
  const c = pointsToGrid(line(0, 0, 10, 0)); // horizontal — mostly disjoint from vertical
  assert.equal(diceScore(a, b), 1);
  assert.ok(diceScore(a, c) < 0.5);
  assert.equal(diceScore(new Uint8Array(4), new Uint8Array(4)), 0);
});

// glyph templates built through the SAME pointsToGrid (mirrors the browser's font rasterisation)
const GRID_TEMPLATES = [
  { letter: 'l', grid: pointsToGrid(line(5, 0, 5, 10)) },
  { letter: 'o', grid: pointsToGrid(circle(5, 5, 5)) },
  { letter: 'v', grid: pointsToGrid(vee()) },
];

test('recognizeGrid: a vertical stroke → "l"; a circle → "o"; a vee → "v"', () => {
  assert.equal(recognizeGrid([line(5.2, 0, 4.8, 10)], GRID_TEMPLATES)[0].letter, 'l');
  assert.equal(recognizeGrid([circle(5, 5, 5, 40)], GRID_TEMPLATES)[0].letter, 'o');
  assert.equal(recognizeGrid([vee(20)], GRID_TEMPLATES)[0].letter, 'v');
});

test('recognizeGrid: candidates are sorted, capped, case-insensitively merged', () => {
  const t = [
    { letter: 'O', grid: pointsToGrid(circle(5, 5, 5)) },
    { letter: 'o', grid: pointsToGrid(circle(5, 5, 5, 30)) },
    { letter: 'l', grid: pointsToGrid(line(5, 0, 5, 10)) },
  ];
  const cands = recognizeGrid([circle(5, 5, 5, 36)], t, { minConfidence: 0 });
  assert.equal(cands[0].letter, 'o'); // lowercased
  const letters = cands.map((c) => c.letter);
  assert.equal(new Set(letters).size, letters.length); // 'O' and 'o' merged
  for (let i = 1; i < cands.length; i++) assert.ok(cands[i - 1].confidence >= cands[i].confidence);
  assert.ok(recognizeGrid([line(5, 0, 5, 10)], t, { maxCandidates: 1, minConfidence: 0 }).length <= 1);
});

test('recognizeGrid: an unrecognisable scribble clears nothing high-confidence (force redraw)', () => {
  const scribble = [[{ x: 0, y: 0 }, { x: 9, y: 1 }, { x: 1, y: 8 }, { x: 8, y: 9 }]];
  assert.equal(recognizeGrid(scribble, GRID_TEMPLATES, { minConfidence: 0.95 }).length, 0);
});

test('strokesToGrid produces a populated grid for a real stroke', () => {
  const g = strokesToGrid([line(0, 0, 10, 10)]);
  assert.ok(g.reduce((a, b) => a + b, 0) > 0);
});
