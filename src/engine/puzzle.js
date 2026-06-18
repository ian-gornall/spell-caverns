// src/engine/puzzle.js — PURE letter-tray logic for the BUILD-the-word puzzle
// (production / recall) mode. No DOM; runs under `node --test`.
//
// Puzzle mode is the pedagogy counterweight to rhythm's multiple-choice
// RECOGNITION (HANDOFF §12): the learner hears a word and PRODUCES its spelling by
// placing scrambled letter tiles into slots. This module owns the two pure pieces:
//   - scrambleTray: make the shuffled tray of tiles (always solvable, optionally
//     padded with red-herring letters at higher difficulty),
//   - gradeBuild: grade a built attempt POSITION-BY-POSITION so the UI can give
//     gentle per-letter feedback (keep the letters that fit, return the rest).
import { shuffle } from './distractors.js';

// Vowel + consonant pools used to pad the tray with plausible DISTRACTOR letters at
// higher difficulty. We only ever draw letters NOT in the word, so every extra tile
// is a genuine red herring (never an ambiguous duplicate of a needed letter).
const VOWELS = 'aeiou';
const CONSONANTS = 'bcdfghjklmnpqrstvwxyz';

// scrambleTray(word, { extra=0, rng }) -> array of lowercase single letters: every
// letter of `word` (so the word is ALWAYS buildable) plus up to `extra` distractor
// letters not in the word, all shuffled. With extra=0 the order is guaranteed not to
// already spell the word (re-shuffles a few times for a multi-letter word).
export function scrambleTray(word, { extra = 0, rng } = {}) {
  const w = String(word).toLowerCase();
  const letters = w.split('');
  const inWord = new Set(letters);
  // distractor pool: letters NOT in the word, shuffled so the extras vary by seed
  const pool = shuffle(
    (VOWELS + CONSONANTS).split('').filter((c) => !inWord.has(c)),
    rng,
  );
  for (let i = 0; i < extra && i < pool.length; i++) letters.push(pool[i]);

  let tray = shuffle(letters, rng);
  // don't hand back the word already spelled out (only possible when extra=0)
  for (let i = 0; i < 6 && w.length > 1 && tray.join('') === w; i++) {
    tray = shuffle(letters, rng);
  }
  return tray;
}

// gradeBuild(target, built) -> { complete, correct, perPosition, correctCount }.
//   `built` is an array (any length) of single letters, or null/'' for an empty slot.
//   - perPosition[i]: true/false if slot i is filled (matches target[i]), null if empty
//   - complete: the first target.length slots are all filled
//   - correct: complete AND the filled letters spell the target exactly
// Case-insensitive. Extra trailing entries beyond target.length are ignored.
export function gradeBuild(target, built) {
  const t = String(target).toLowerCase();
  const arr = Array.isArray(built) ? built : [];
  const perPosition = t.split('').map((ch, i) => {
    const b = arr[i];
    if (b == null || b === '') return null;
    return String(b).toLowerCase() === ch;
  });
  const head = arr.slice(0, t.length);
  const filled = head.filter((b) => b != null && b !== '').length;
  const complete = filled === t.length;
  const correct = complete && head.map((b) => String(b).toLowerCase()).join('') === t;
  const correctCount = perPosition.filter((x) => x === true).length;
  return { complete, correct, perPosition, correctCount };
}
