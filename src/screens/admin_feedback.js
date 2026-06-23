// src/screens/admin_feedback.js — DEVELOPER-ONLY feedback archive (§28.A).
//
// A hidden, key-gated view of ALL feedback players have sent (newest first), so the developer
// can read the latest AND browse the full history on-device — reached by tapping a feedback
// notification, or via the 7-tap unlock on the Settings version line. Fetches GET /api/feedback
// with the admin key remembered on this device (src/admin.js). Not in any family-facing menu.
import { el, header, toast } from '../ui.js';
import { fetchFeedback, isAdmin, clearAdminKey } from '../admin.js';

const STARS = (n) => (n ? '⭐'.repeat(Math.max(0, Math.min(5, n))) : '—');
const DIFF_LABEL = { 'too-easy': '😌 Too easy', 'just-right': '👌 Just right', 'too-hard': '😅 Too hard' };

function fmtDate(ts) {
  try {
    return new Date(ts).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return String(ts);
  }
}

export function adminFeedbackScreen(ctx) {
  const list = el('div', { class: 'feedback-archive' });
  const back = () => ctx.nav(ctx.state ? 'home' : 'profiles');

  const card = (fb) =>
    el(
      'div',
      { class: 'panel feedback-entry' },
      el(
        'div',
        { class: 'fb-row' },
        el('span', { class: 'fb-stars' }, STARS(fb.rating)),
        el('span', { class: 'fb-when' }, fmtDate(fb.ts)),
      ),
      el(
        'div',
        { class: 'fb-meta' },
        el('span', { class: 'fb-nick' }, fb.nick ? `👤 ${fb.nick}` : '👤 (no name)'),
        fb.difficulty ? el('span', { class: 'fb-diff' }, DIFF_LABEL[fb.difficulty] || fb.difficulty) : null,
      ),
      fb.note ? el('p', { class: 'fb-note' }, fb.note) : el('p', { class: 'fb-note muted' }, '(no note)'),
    );

  const render = async () => {
    if (!isAdmin()) {
      list.replaceChildren(
        el('p', { class: 'field-hint' }, 'This device isn’t set up to view feedback. In Settings, tap the version line 7 times and enter the admin key.'),
      );
      return;
    }
    list.replaceChildren(el('p', { class: 'field-hint' }, 'Loading feedback…'));
    try {
      const all = await fetchFeedback(); // already newest-first from the Worker
      if (!all.length) {
        list.replaceChildren(el('p', { class: 'field-hint' }, 'No feedback yet. It’ll show up here the moment someone sends some.'));
        return;
      }
      list.replaceChildren(
        el('p', { class: 'archive-count' }, `${all.length} total — newest first`),
        ...all.map(card),
      );
    } catch (e) {
      const msg = e && e.status === 403
        ? 'Admin key was rejected. Re-register this device (Settings → tap version 7×).'
        : 'Couldn’t load feedback (offline or server error). Pull again in a moment.';
      list.replaceChildren(
        ...[
          el('p', { class: 'field-hint' }, msg),
          // native replaceChildren stringifies a null arg into a "null" text node — filter it out
          // (only the 403 path adds the button; the offline/server-error path must not show "null").
          e && e.status === 403
            ? el('button', { class: 'btn ghost', onClick: () => { clearAdminKey(); toast('Cleared admin key'); back(); } }, 'Forget this device')
            : null,
        ].filter(Boolean),
      );
    }
  };

  const refreshBtn = el('button', { class: 'btn', onClick: () => render() }, '🔄 Refresh');

  const screen = el(
    'div',
    { class: 'screen' },
    header(ctx, { title: 'Feedback archive', onBack: back }),
    el('div', { class: 'scroll' }, el('div', { class: 'data-actions' }, refreshBtn), list),
  );

  render();
  return screen;
}
