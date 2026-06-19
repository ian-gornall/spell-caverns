// src/screens/feedback.js — the built-in feedback mechanism (requirement #11;
// HANDOFF §12). Kid-facing and tiny: a fun-rating (emoji), a was-it-too-hard
// dial, an optional note, and an "export my data" button so the parent/dev can
// pull the feedback log + progress off the iPad (state.addFeedback already exists).
//
// Student-guided (HANDOFF §4): the kid gives feedback in their own words; it's
// stored locally and leaves only via export. Giving feedback earns a few gems so
// it feels worth doing. UI module — never imported by `node --test`.
import { el, header, toast } from '../ui.js';
import { postFeedback } from '../feedback_client.js';

const RATINGS = [
  { v: 1, emoji: '😞', label: 'Meh' },
  { v: 2, emoji: '😐', label: 'Okay' },
  { v: 3, emoji: '🙂', label: 'Good' },
  { v: 4, emoji: '😄', label: 'Great' },
  { v: 5, emoji: '🤩', label: 'Best!' },
];
const DIFFICULTIES = [
  { v: 'too-easy', label: '😌 Too easy' },
  { v: 'just-right', label: '👌 Just right' },
  { v: 'too-hard', label: '😅 Too hard' },
];
const FEEDBACK_GEMS = 10;

export function feedbackScreen(ctx) {
  let rating = 0;
  let difficulty = '';

  // emoji fun-rating — clicking one selects it (highlights, clears siblings)
  const ratingRow = el(
    'div',
    { class: 'rating-row' },
    ...RATINGS.map((r) =>
      el(
        'button',
        {
          class: 'rating',
          onClick: (e) => {
            rating = r.v;
            [...ratingRow.children].forEach((n) => n.classList.remove('on'));
            e.currentTarget.classList.add('on');
          },
        },
        el('span', { class: 'rating-emoji' }, r.emoji),
        el('span', { class: 'rating-label' }, r.label),
      ),
    ),
  );

  const diffSeg = el(
    'div',
    { class: 'seg' },
    ...DIFFICULTIES.map((d) =>
      el(
        'button',
        {
          onClick: (e) => {
            difficulty = d.v;
            [...diffSeg.children].forEach((n) => n.classList.remove('on'));
            e.currentTarget.classList.add('on');
          },
        },
        d.label,
      ),
    ),
  );

  const note = el('textarea', {
    class: 'feedback-note',
    rows: '3',
    maxLength: '400',
    placeholder: 'Anything you want to tell us? (optional)',
  });

  const send = () => {
    if (!rating && !difficulty && !note.value.trim()) {
      toast('Tap a face or pick a level first! 🙂');
      return;
    }
    // Store on-device first (never lose it), then deliver to the developer best-effort: on
    // success mark it sent; on failure it stays queued for the next app open (§28.A).
    const nick = (ctx.state && ctx.state.profile && ctx.state.profile.name) || '';
    const rec = ctx.store.addFeedback({ rating, difficulty, note: note.value.trim(), nick });
    postFeedback(rec).then((ok) => ok && ctx.store.markFeedbackSent(rec.ts));
    ctx.store.addGems(FEEDBACK_GEMS);
    ctx.save();
    toast(`Thanks! +${FEEDBACK_GEMS} gems for helping 💎`);
    ctx.nav('home');
  };

  const exportBtn = el(
    'button',
    {
      onClick: () => {
        const blob = new Blob([ctx.store.exportData()], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = el('a', {
          href: url,
          download: `crystal-spell-${new Date().toISOString().slice(0, 10)}.json`,
        });
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast('Saved your data file! 💾');
      },
    },
    '💾 Export my data',
  );

  return el(
    'div',
    { class: 'screen' },
    header(ctx, { title: 'Feedback', onBack: () => ctx.nav('home') }),
    el(
      'div',
      { class: 'scroll' },
      el(
        'div',
        { class: 'panel' },
        el('h3', {}, 'How fun was that?'),
        ratingRow,
      ),
      el(
        'div',
        { class: 'panel' },
        el('h3', {}, 'How hard was it?'),
        diffSeg,
      ),
      el(
        'div',
        { class: 'panel' },
        el('h3', {}, 'Tell us more'),
        note,
      ),
      el('button', { class: 'btn primary feedback-send', onClick: send }, '✨ Send feedback'),
      el('div', { class: 'panel' }, el('h3', {}, 'For grown-ups'), el('div', { class: 'seg' }, exportBtn)),
    ),
  );
}
