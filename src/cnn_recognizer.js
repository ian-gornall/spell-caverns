// src/cnn_recognizer.js — the §30 draw-mode letter recognizer: a small EMNIST-letters CNN
// (trained offline by scripts/train_recognizer.mjs) run in TF.js, FULLY ON-DEVICE.
//
// Replaces the old grid/Dice template-overlap matcher, which couldn't tell round letters
// (a/q/c/s) apart. A CNN learns discriminative features, so it reliably puts the right letter
// in the top candidates. Free, offline, private (no strokes ever leave the device — COPPA).
// TF.js + the model are lazy-loaded on first use and service-worker-cached for offline.
//
// Browser-only (DOM canvas + window.tf) — never imported by node tests.

const TF_SRC = '/src/vendor/tf.min.js';
const MODEL_URL = '/src/models/letters/model.json';

let tfP = null;
let bundleP = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('failed to load ' + src));
    document.head.appendChild(s);
  });
}
async function ensureTf() {
  if (!tfP) {
    tfP = (async () => {
      if (!window.tf) await loadScript(TF_SRC);
      return window.tf;
    })();
  }
  return tfP;
}

// Lazy-load TF.js + the model once. Returns { tf, model } (cached). Call early to warm up.
export async function ensureRecognizer() {
  if (!bundleP) {
    bundleP = (async () => {
      const tf = await ensureTf();
      const model = await tf.loadLayersModel(MODEL_URL);
      return { tf, model };
    })();
  }
  return bundleP;
}

// Rasterize the drawn strokes into a 28×28 grayscale canvas in EMNIST style (white ink on a
// black field, the glyph uniform-scaled + centered), to match the model's training inputs.
function strokesTo28(strokes) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let n = 0;
  for (const s of strokes) for (const p of s) {
    n += 1;
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  if (n < 2) return null;
  const w = maxX - minX;
  const h = maxY - minY;
  const size = Math.max(w, h, 1);
  const BIG = 112;
  const FIT = 78; // draw the glyph into a ~78px box centered in 112, then downscale to 28
  const scale = FIT / size;
  const offX = (BIG - w * scale) / 2;
  const offY = (BIG - h * scale) / 2;
  const map = (p) => ({ x: (p.x - minX) * scale + offX, y: (p.y - minY) * scale + offY });

  const big = document.createElement('canvas');
  big.width = BIG;
  big.height = BIG;
  const bx = big.getContext('2d');
  bx.fillStyle = '#000';
  bx.fillRect(0, 0, BIG, BIG);
  bx.strokeStyle = '#fff';
  bx.lineWidth = 9;
  bx.lineCap = 'round';
  bx.lineJoin = 'round';
  for (const s of strokes) {
    if (!s.length) continue;
    bx.beginPath();
    const a = map(s[0]);
    bx.moveTo(a.x, a.y);
    for (let i = 1; i < s.length; i++) {
      const q = map(s[i]);
      bx.lineTo(q.x, q.y);
    }
    if (s.length === 1) bx.lineTo(a.x + 0.1, a.y + 0.1); // a dot still leaves a mark
    bx.stroke();
  }
  const small = document.createElement('canvas');
  small.width = 28;
  small.height = 28;
  const sx = small.getContext('2d');
  sx.drawImage(big, 0, 0, 28, 28);
  return small;
}

// recognizeDrawing(strokes, opts) → ranked candidate letters [{letter, confidence}] (lowercase
// a–z), highest first, capped at maxCandidates, filtered to >= minConfidence. [] when the top
// prediction is too weak (the UI then forces a redraw). Throws if TF.js/model can't load (the
// caller falls back to the grid recognizer).
export async function recognizeDrawing(strokes, { maxCandidates = 4, minConfidence = 0.05, redrawFloor = 0.12 } = {}) {
  const canvas = strokesTo28(strokes);
  if (!canvas) return [];
  const { tf, model } = await ensureRecognizer();
  const probs = tf.tidy(() => {
    const img = tf.browser.fromPixels(canvas, 1).toFloat().div(255).expandDims(0); // [1,28,28,1]
    return model.predict(img).dataSync();
  });
  const ranked = Array.from(probs)
    .map((p, i) => ({ letter: String.fromCharCode(97 + i), confidence: p }))
    .sort((a, b) => b.confidence - a.confidence);
  if (!ranked.length || ranked[0].confidence < redrawFloor) return []; // too unsure → redraw
  return ranked.filter((c) => c.confidence >= minConfidence).slice(0, maxCandidates);
}
