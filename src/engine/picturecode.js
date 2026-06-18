// src/engine/picturecode.js — PURE "picture password" <-> sync-code mapping.
//
// A family sync code must be usable/memorable by a child as young as five — typing
// "K7QF2M9P" is not. So instead the child taps a sequence of 4 PICTURES (e.g. dog, star,
// pizza, moon). Each picture maps to a fixed 2-char token, so 4 pictures = an 8-char
// code that the sync backend treats like any other code (matches cloudsync SYNC_CODE_RE,
// 6–12 chars). The child only ever sees pictures; the alphanumeric code is internal.
//
// Collisions: 18 pictures ^ 4 = ~105k sequences. That's plenty for this app's scale, and
// the "create" flow additionally checks the backend that a freshly-picked code is unused
// (picks again if not), so two families can never end up on the same code.

// Friendly, instantly-recognizable pictures with a unique 2-char token each.
export const PICTURES = [
  { id: 'dog', emoji: '🐶', name: 'Dog', token: 'DG' },
  { id: 'cat', emoji: '🐱', name: 'Cat', token: 'CT' },
  { id: 'lion', emoji: '🦁', name: 'Lion', token: 'LN' },
  { id: 'frog', emoji: '🐸', name: 'Frog', token: 'FG' },
  { id: 'unicorn', emoji: '🦄', name: 'Unicorn', token: 'UN' },
  { id: 'turtle', emoji: '🐢', name: 'Turtle', token: 'TT' },
  { id: 'dolphin', emoji: '🐬', name: 'Dolphin', token: 'DP' },
  { id: 'butterfly', emoji: '🦋', name: 'Butterfly', token: 'BF' },
  { id: 'bee', emoji: '🐝', name: 'Bee', token: 'BE' },
  { id: 'apple', emoji: '🍎', name: 'Apple', token: 'AP' },
  { id: 'banana', emoji: '🍌', name: 'Banana', token: 'BN' },
  { id: 'pizza', emoji: '🍕', name: 'Pizza', token: 'PZ' },
  { id: 'icecream', emoji: '🍦', name: 'Ice cream', token: 'IC' },
  { id: 'star', emoji: '🌟', name: 'Star', token: 'ST' },
  { id: 'rainbow', emoji: '🌈', name: 'Rainbow', token: 'RB' },
  { id: 'moon', emoji: '🌙', name: 'Moon', token: 'MN' },
  { id: 'rocket', emoji: '🚀', name: 'Rocket', token: 'RK' },
  { id: 'ball', emoji: '⚽', name: 'Ball', token: 'BL' },
];

// How many pictures make a password.
export const PICTURE_CODE_LEN = 4;

const BY_ID = new Map(PICTURES.map((p) => [p.id, p]));
const BY_TOKEN = new Map(PICTURES.map((p) => [p.token, p]));

export function pictureById(id) {
  return BY_ID.get(id);
}

// A sequence of picture ids -> the internal sync code (token concatenation), or null if
// the wrong count or an unknown id.
export function picturesToCode(ids) {
  if (!Array.isArray(ids) || ids.length !== PICTURE_CODE_LEN) return null;
  let code = '';
  for (const id of ids) {
    const p = BY_ID.get(id);
    if (!p) return null;
    code += p.token;
  }
  return code;
}

// A sync code -> the sequence of picture objects it represents, or null if it isn't a
// valid picture code (e.g. an old typed alphanumeric code). Used to SHOW a code as
// pictures (so a parent/kid can read it off one device and re-tap it on another).
export function codeToPictures(code) {
  const s = String(code || '').toUpperCase();
  if (s.length !== PICTURE_CODE_LEN * 2) return null;
  const out = [];
  for (let i = 0; i < s.length; i += 2) {
    const p = BY_TOKEN.get(s.slice(i, i + 2));
    if (!p) return null;
    out.push(p);
  }
  return out;
}
