// src/engine/handwriting.js — PURE §30 MASTERY-mode handwriting recognizer.
//
// Ian's constraint: the draw-the-letters mastery test must be FREE and OFFLINE — no cloud,
// no paid API. This is classic on-device single-glyph template matching (a non-rotation
// variant of the $1 recognizer, Wobbrock/Wilson/Li 2007):
//   resample the drawn path to a fixed point count → normalize (translate to centre + UNIFORM
//   scale; NO rotation/reflection invariance, because letters depend on orientation: b≠d≠p≠q,
//   n≠u, M≠W) → nearest-template average path distance → a confidence in [0,1].
//
// recognize() returns up to `maxCandidates` HIGH-CONFIDENCE candidate letters (the §30 UX:
// "as many high-confidence candidates as there are, up to 4, rendered as the letterforms").
// If nothing clears the bar it returns [] and the UI forces a redraw (no low-confidence
// guesses). Case-insensitive: candidate letters are reported lowercased and lower/upper
// templates for the same letter merge (expect lowercase, accept uppercase).
//
// The BROWSER side captures pointer strokes from the canvas and supplies `templates`
// (reference strokes per letter — generated once from the app font, or shipped as data).
// This module is pure point math so it runs under `node --test`. Imports nothing browser-specific.

// Number of points every path is resampled to before comparison.
export const RESAMPLE_N = 32;
// Distance→confidence scale. Normalized coords sit in roughly [-0.5, 0.5]; a clean match
// lands well under ~0.12 average point distance, a wrong glyph well above. confidence =
// max(0, 1 - dist/DIST_SCALE). Tunable; the UI's threshold (minConfidence) is the real gate.
export const DIST_SCALE = 0.4;
// "High-confidence" bar below which a candidate is dropped (and, if none clear it, redraw).
export const DEFAULT_MIN_CONFIDENCE = 0.7;

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function pathLength(pts) {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += dist(pts[i - 1], pts[i]);
  return len;
}

// Resample `points` to exactly `n` points equally spaced along the path length.
export function resample(points, n = RESAMPLE_N) {
  const pts = points.filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y));
  if (pts.length === 0) return Array.from({ length: n }, () => ({ x: 0, y: 0 }));
  if (pts.length === 1) return Array.from({ length: n }, () => ({ ...pts[0] }));
  const I = pathLength(pts) / (n - 1);
  if (!(I > 0)) return Array.from({ length: n }, () => ({ ...pts[0] })); // zero-length (all same point)
  const out = [{ ...pts[0] }];
  let D = 0;
  const work = pts.slice();
  for (let i = 1; i < work.length; i++) {
    const d = dist(work[i - 1], work[i]);
    if (D + d >= I) {
      const t = (I - D) / d;
      const q = { x: work[i - 1].x + t * (work[i].x - work[i - 1].x), y: work[i - 1].y + t * (work[i].y - work[i - 1].y) };
      out.push(q);
      work.splice(i, 0, q); // continue measuring from the inserted point
      D = 0;
    } else {
      D += d;
    }
  }
  while (out.length < n) out.push({ ...work[work.length - 1] });
  return out.slice(0, n);
}

// Translate to the bounding-box centre and scale UNIFORMLY by the larger dimension, so a
// tall thin 'l' stays tall and thin (a non-uniform fit-to-square would erase that signal).
export function normalize(points) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const w = maxX - minX;
  const h = maxY - minY;
  const size = Math.max(w, h) || 1;
  const cx = minX + w / 2;
  const cy = minY + h / 2;
  return points.map((p) => ({ x: (p.x - cx) / size, y: (p.y - cy) / size }));
}

// Average Euclidean distance between corresponding points of two equal-length normalized paths.
export function pathDistance(a, b) {
  const n = Math.min(a.length, b.length);
  if (!n) return Infinity;
  let s = 0;
  for (let i = 0; i < n; i++) s += dist(a[i], b[i]);
  return s / n;
}

// Concatenate a letter's strokes (array of point arrays) into one path in draw order.
function combineStrokes(strokes) {
  const out = [];
  for (const s of strokes || []) for (const p of s || []) out.push(p);
  return out;
}

// Preprocess raw strokes → a normalized, resampled path ready for comparison.
export function preprocess(strokes, n = RESAMPLE_N) {
  return normalize(resample(combineStrokes(strokes), n));
}

const confidenceFromDistance = (d) => Math.max(0, Math.min(1, 1 - d / DIST_SCALE));

// recognize(strokes, templates, opts) → ranked high-confidence candidates [{letter, confidence}].
//   strokes    : the drawn glyph (array of point arrays — one per pen stroke)
//   templates  : [{ letter, strokes }] reference glyphs (any number per letter; best wins)
//   opts.n, opts.maxCandidates (default 4), opts.minConfidence (default DEFAULT_MIN_CONFIDENCE)
// Returns [] when nothing clears the confidence bar (→ the UI forces a redraw).
export function recognize(strokes, templates, opts = {}) {
  const { n = RESAMPLE_N, maxCandidates = 4, minConfidence = DEFAULT_MIN_CONFIDENCE } = opts;
  const drawn = preprocess(strokes, n);
  if (combineStrokes(strokes).length < 2) return []; // nothing meaningful drawn

  // best (min) distance per lowercased letter across all its templates → case-insensitive merge
  const best = new Map();
  for (const tpl of templates || []) {
    if (!tpl || typeof tpl.letter !== 'string') continue;
    const letter = tpl.letter.toLowerCase();
    const tplPts = tpl._norm || preprocess(tpl.strokes, n);
    const d = pathDistance(drawn, tplPts);
    if (!best.has(letter) || d < best.get(letter)) best.set(letter, d);
  }

  return [...best.entries()]
    .map(([letter, d]) => ({ letter, confidence: confidenceFromDistance(d) }))
    .filter((c) => c.confidence >= minConfidence)
    .sort((a, b) => b.confidence - a.confidence || (a.letter < b.letter ? -1 : 1))
    .slice(0, maxCandidates);
}
