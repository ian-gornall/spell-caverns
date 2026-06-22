// src/engine/voicequeue.js — a tiny SERIAL job runner for spoken audio (§36 B1/B2).
//
// Why: dictation (say) and praise (speakPraise) used independent <audio> elements +
// speechSynthesis.cancel(), so a clip of praise and the next word's dictation could
// play AT THE SAME TIME (or a fast re-trigger could restart a clip mid-phrase). This
// queue makes every utterance run ONE AT A TIME: a new utterance waits for the prior
// one to FINISH before it starts. Praise therefore always completes before the next
// word is spoken — no overlap, in every mode, with zero per-mode wiring.
//
// Pure: a "job" is a function(done) that starts an utterance and calls done() exactly
// once when it finishes (clip 'ended' / TTS onend / failure / safety timer). No DOM or
// audio dependency, so it is unit-tested under `node --test`.
export function createVoiceQueue() {
  let queue = []; // pending { job, resolve, protected }
  let busy = false; // is a job currently playing?
  let activeProtected = false; // is the in-flight job protected (praise)?
  let activeFinish = null; // finishes the in-flight job (so clear() can force it)
  let protectedCount = 0; // protected jobs anywhere (active + pending)

  function pump() {
    if (busy || !queue.length) return;
    const { job, resolve, protected: prot } = queue.shift();
    busy = true;
    activeProtected = !!prot;
    let done = false;
    const finish = () => {
      if (done) return; // a job's done() must only count once
      done = true;
      if (activeFinish === finish) activeFinish = null;
      if (prot) protectedCount = Math.max(0, protectedCount - 1);
      busy = false;
      activeProtected = false;
      try {
        resolve();
      } catch {
        /* ignore */
      }
      pump(); // start the next queued utterance
    };
    activeFinish = finish;
    try {
      job(finish);
    } catch {
      finish(); // a throwing job must not stall the chain
    }
  }

  return {
    // Queue an utterance. Returns a promise that resolves when THIS job finishes.
    // `protected` jobs (praise) are never preempted — a following utterance waits for
    // them, so praise always completes before the next word is spoken.
    enqueue(job, { protected: prot = false } = {}) {
      if (prot) protectedCount += 1;
      return new Promise((resolve) => {
        queue.push({ job, resolve, protected: prot });
        pump();
      });
    },
    // §C1 audio-lag fix: a NEW word/narration supersedes any STALE dictation WITHOUT cutting
    // praise. Drops PENDING non-protected (dictation/narration) jobs, and if the ACTIVE job is
    // itself a plain dictation (not praise), force-finishes it so the caller can hard-stop its
    // audio and start the new word now. Protected (praise) jobs — active or pending — are kept,
    // so the new word simply queues right behind any praise still being spoken. (Without this,
    // solving a word before its long clip finishes left a stale dictation that the next word's
    // say() couldn't preempt — because queued praise bumped protectedCount — so the audio lagged
    // the display and played the WRONG word; worst in the placement diagnostic's harder words.)
    preemptDictation() {
      const kept = [];
      for (const p of queue) {
        if (p.protected) kept.push(p);
        else { try { p.resolve(); } catch { /* ignore */ } }
      }
      queue = kept;
      if (busy && !activeProtected && activeFinish) {
        const f = activeFinish;
        activeFinish = null;
        f(); // force-finish the stale active dictation (busy → false, pumps any kept praise)
      }
    },
    // Drop everything pending and force-finish the active job (so awaiters resolve and
    // the chain doesn't hang). Callers pair this with a hard-stop of the actual audio.
    clear() {
      const pending = queue;
      queue = [];
      protectedCount = 0;
      for (const p of pending) {
        try {
          p.resolve();
        } catch {
          /* ignore */
        }
      }
      if (activeFinish) {
        const f = activeFinish;
        activeFinish = null;
        f();
      }
    },
    get size() {
      return queue.length + (busy ? 1 : 0);
    },
    get busy() {
      return busy;
    },
    // how many protected (praise) jobs are in flight (active + pending) — a new
    // dictation preempts the queue ONLY when this is 0 (so it never cuts praise).
    get protectedCount() {
      return protectedCount;
    },
    get activeProtected() {
      return activeProtected;
    },
  };
}
