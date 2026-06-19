// scripts/train_recognizer.mjs — train an EMNIST-letters (a–z) CNN with tfjs-node and export
// a tfjs LayersModel the browser draw-mode loads. Free + offline once the data is cached.
//
// Why: the §30 draw-mode recognizer needs to tell round letters (a/q/c/s) apart — a learned
// CNN does this where the old grid/Dice template overlap could not. Data = EMNIST "letters"
// (26 case-merged classes, 28×28), fetched from a HuggingFace mirror (the 4 IDX files) and
// cached locally. Run: node scripts/train_recognizer.mjs
import * as tf from '@tensorflow/tfjs-node';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const CACHE = 'scripts/_emnist';
const BASE = 'https://huggingface.co/datasets/Royc30ne/emnist-letters/resolve/main/';
const FILES = {
  trainImages: 'emnist-letters-train-images-idx3-ubyte.gz',
  trainLabels: 'emnist-letters-train-labels-idx1-ubyte.gz',
  testImages: 'emnist-letters-test-images-idx3-ubyte.gz',
  testLabels: 'emnist-letters-test-labels-idx1-ubyte.gz',
};

async function ensure(file) {
  const out = path.join(CACHE, file);
  if (fs.existsSync(out)) return out;
  fs.mkdirSync(CACHE, { recursive: true });
  process.stdout.write(`downloading ${file} … `);
  const r = await fetch(BASE + file);
  if (!r.ok) throw new Error(`download failed ${file} ${r.status}`);
  fs.writeFileSync(out, Buffer.from(await r.arrayBuffer()));
  console.log('ok');
  return out;
}
const gunzip = (p) => zlib.gunzipSync(fs.readFileSync(p));

// IDX images: magic(4) count(4) rows(4) cols(4) then count*rows*cols bytes. EMNIST stores each
// glyph TRANSPOSED — un-transpose here so the trained model sees UPRIGHT letters, matching the
// canvas at inference (no orientation hack needed later). Normalize to [0,1].
function parseImages(buf) {
  const count = buf.readUInt32BE(4);
  const rows = buf.readUInt32BE(8);
  const cols = buf.readUInt32BE(12);
  const data = buf.subarray(16);
  const out = new Float32Array(count * rows * cols);
  for (let n = 0; n < count; n++) {
    const b = n * rows * cols;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out[b + r * cols + c] = data[b + c * rows + r] / 255;
  }
  return { out, count };
}
// IDX labels: magic(4) count(4) then bytes. EMNIST letters are 1..26 → shift to 0..25.
function parseLabels(buf) {
  const count = buf.readUInt32BE(4);
  const data = buf.subarray(8);
  const out = new Int32Array(count);
  for (let i = 0; i < count; i++) out[i] = data[i] - 1;
  return out;
}

const tImg = parseImages(gunzip(await ensure(FILES.trainImages)));
const tLab = parseLabels(gunzip(await ensure(FILES.trainLabels)));
const vImg = parseImages(gunzip(await ensure(FILES.testImages)));
const vLab = parseLabels(gunzip(await ensure(FILES.testLabels)));
console.log(`train=${tImg.count} test=${vImg.count}`);

const xs = tf.tensor4d(tImg.out, [tImg.count, 28, 28, 1]);
const ys = tf.oneHot(tf.tensor1d(tLab, 'int32'), 26); // one-hot + categoricalCrossentropy avoids
const vxs = tf.tensor4d(vImg.out, [vImg.count, 28, 28, 1]); // the sparse-loss int32 'floor' quirk
const vys = tf.oneHot(tf.tensor1d(vLab, 'int32'), 26);

const model = tf.sequential();
model.add(tf.layers.conv2d({ inputShape: [28, 28, 1], filters: 16, kernelSize: 3, padding: 'same', activation: 'relu' }));
model.add(tf.layers.maxPooling2d({ poolSize: 2 }));
model.add(tf.layers.conv2d({ filters: 32, kernelSize: 3, padding: 'same', activation: 'relu' }));
model.add(tf.layers.maxPooling2d({ poolSize: 2 }));
model.add(tf.layers.conv2d({ filters: 64, kernelSize: 3, padding: 'same', activation: 'relu' }));
model.add(tf.layers.maxPooling2d({ poolSize: 2 }));
model.add(tf.layers.flatten());
model.add(tf.layers.dense({ units: 128, activation: 'relu' }));
model.add(tf.layers.dropout({ rate: 0.3 }));
model.add(tf.layers.dense({ units: 26, activation: 'softmax' }));
model.compile({ optimizer: tf.train.adam(), loss: 'categoricalCrossentropy', metrics: ['accuracy'] });
model.summary();

await model.fit(xs, ys, {
  epochs: 8,
  batchSize: 128,
  validationData: [vxs, vys],
  callbacks: {
    onEpochEnd: (e, logs) =>
      console.log(`epoch ${e + 1}/8  loss=${logs.loss.toFixed(4)}  acc=${logs.acc.toFixed(4)}  val_acc=${logs.val_acc.toFixed(4)}`),
  },
});

fs.mkdirSync('src/models', { recursive: true });
await model.save('file://./src/models/letters');
console.log('✅ saved model → src/models/letters/ (model.json + weights.bin)');
