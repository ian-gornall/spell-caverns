// test/voicequeue.test.js — the pure serial sequencer behind audio.js voice output.
// Guarantees spoken utterances (dictation + praise) run ONE AT A TIME so praise can
// never step on the next word's dictation (§36 B1/B2). Pure JS, no DOM/audio.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVoiceQueue } from '../src/engine/voicequeue.js';

test('jobs run strictly one at a time, in order', async () => {
  const q = createVoiceQueue();
  const log = [];
  let liveCount = 0;
  let maxLive = 0;
  const job = (name, ms) => (done) => {
    liveCount += 1; maxLive = Math.max(maxLive, liveCount);
    log.push(`start:${name}`);
    setTimeout(() => { liveCount -= 1; log.push(`end:${name}`); done(); }, ms);
  };
  const all = Promise.all([q.enqueue(job('a', 30)), q.enqueue(job('b', 5)), q.enqueue(job('c', 10))]);
  await all;
  assert.equal(maxLive, 1, 'never more than one utterance playing at once');
  assert.deepEqual(log, ['start:a', 'end:a', 'start:b', 'end:b', 'start:c', 'end:c']);
});

test('the enqueue promise resolves only after that job finishes', async () => {
  const q = createVoiceQueue();
  let finished = false;
  const p = q.enqueue((done) => setTimeout(() => { finished = true; done(); }, 15));
  assert.equal(finished, false, 'not resolved synchronously');
  await p;
  assert.equal(finished, true);
});

test('a praise job fully completes before the next word job starts', async () => {
  const q = createVoiceQueue();
  const events = [];
  q.enqueue((done) => { events.push('praise-start'); setTimeout(() => { events.push('praise-end'); done(); }, 20); });
  await q.enqueue((done) => { events.push('word-start'); done(); });
  // word must not start until praise has ended (no overlap)
  assert.deepEqual(events, ['praise-start', 'praise-end', 'word-start']);
});

test('clear() drops pending jobs and force-finishes the active one', async () => {
  const q = createVoiceQueue();
  let bRan = false;
  const a = q.enqueue((done) => { /* never calls done on its own */ void done; });
  const b = q.enqueue(() => { bRan = true; });
  // a is active (its done is held); b is pending
  q.clear();
  await Promise.all([a, b]); // both resolve despite a never finishing on its own
  assert.equal(bRan, false, 'pending job b is dropped, not run');
  assert.equal(q.busy, false, 'queue idle after clear');
});

test('a job that throws still advances the queue', async () => {
  const q = createVoiceQueue();
  const order = [];
  const bad = q.enqueue(() => { throw new Error('boom'); });
  await bad; // resolves (does not reject the chain)
  await q.enqueue((done) => { order.push('next'); done(); });
  assert.deepEqual(order, ['next']);
});

test('protectedCount tracks protected jobs (active + pending) and decrements on finish', async () => {
  const q = createVoiceQueue();
  let releaseA;
  const a = q.enqueue((done) => { releaseA = done; }, { protected: true });
  const mid = q.enqueue((done) => done(), { protected: false }); // pending, not protected
  const b = q.enqueue((done) => done(), { protected: true }); // pending, protected
  assert.equal(q.protectedCount, 2, 'one active protected + one pending protected');
  assert.equal(q.activeProtected, true, 'the active job is the protected one');
  releaseA(); // finish a → mid → b run in turn
  await Promise.all([a, mid, b]);
  assert.equal(q.protectedCount, 0, 'all protected jobs drained');
});

test('clear() resets protectedCount to 0', async () => {
  const q = createVoiceQueue();
  q.enqueue((done) => { void done; }, { protected: true });
  assert.equal(q.protectedCount, 1);
  q.clear();
  assert.equal(q.protectedCount, 0);
});

test('enqueue after the queue drained starts immediately', async () => {
  const q = createVoiceQueue();
  await q.enqueue((done) => done());
  assert.equal(q.busy, false);
  let ran = false;
  await q.enqueue((done) => { ran = true; done(); });
  assert.equal(ran, true);
});
