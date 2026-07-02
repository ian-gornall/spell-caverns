// src/screens/lesson_intro.js — the lesson INTRO CARD (§40 teaching loop step 1).
//
// Shown as a full-screen overlay (the parentalGate/activePauseOverlay shape) at each
// new spine pattern, and it is the ONLY element on screen — never stacked with the
// play surface (Ian's mobile-jumble complaint). Geo presents the kid-voiced rule
// with the pattern's exemplar words as chips; the rule is read aloud on mount and
// replayable via a button. Dismissing stops the audio and starts the trial stream.
import { el, mascot } from '../ui.js';
import { kidLesson } from '../engine/kidcopy.js';

// `lesson` is a lessonList() entry ({ band, id, label, rule, exemplars, words }).
// Returns the overlay node (already appended to body); onGo fires on dismiss.
export function lessonIntro({ lesson, audio, onGo }) {
  const kid = kidLesson(lesson);
  const speak = () => {
    audio.stop(); // a replay tap restarts the line rather than stacking on it
    audio.say(`Lesson ${lesson.band}. ${kid.name}. ${kid.rule}`);
  };
  const close = () => {
    audio.stop(); // dismiss silences the intro before the first dictation
    overlay.remove();
    if (onGo) onGo();
  };
  const chips = (kid.exemplars || []).slice(0, 5).map((w) => el('span', { class: 'lintro-chip' }, w));
  const overlay = el(
    'div',
    { class: 'gate-overlay lintro-overlay' },
    el(
      'div',
      { class: 'gate-box lintro-box' },
      mascot(`Lesson ${lesson.band}`, { mood: 'wink' }),
      el('h2', { class: 'lintro-name' }, kid.name),
      el('p', { class: 'lintro-rule' }, kid.rule),
      chips.length ? el('div', { class: 'lintro-chips' }, ...chips) : null,
      el(
        'div',
        { class: 'lintro-actions' },
        el('button', { class: 'btn ghost', onClick: speak }, '🔊 Hear it again'),
        el('button', { class: 'btn primary lintro-go', onClick: close }, "Let's go! ✨"),
      ),
    ),
  );
  document.body.appendChild(overlay);
  speak();
  return overlay;
}
