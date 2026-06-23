// admin/admin.js — the operator admin SPA (ADMIN_APP.md). Login -> overview -> detail/edit ->
// export. A separate bundle served at /admin, NOT in the kid PWA precache. It reuses the kid
// app's shared styling + DOM helpers (DESIGN_SYSTEM.md) and the SAME pure engine modules, so its
// numbers can never drift from the game's. All writes go through the gated /api/admin/* endpoints;
// edits are authoritative (the worker bumps the container's adminRev, which the child's device
// adopts on next sync). Imports are absolute (/src/...) so this works served from /admin/.
import { el, toast } from '/src/ui.js';
import { flattenFamilies, flattenProfile } from '/src/engine/admin_view.js';
import { toCSV, COLUMNS, COLUMN_GROUPS, DEFAULT_COLUMNS } from '/src/engine/admin_export.js';
import { getAdminKey, setAdminKey, clearAdminKey } from '/src/admin.js';
import { pushSnapshot } from '/src/engine/profiles.js';
import { createCategoryState, serializeCategoryState } from '/src/engine/categories.js';
import { createTracker, serializeTracker } from '/src/engine/progress.js';
import { defaultStreak } from '/src/engine/streak.js';

const root = document.getElementById('admin-app');
let families = []; // [{ code, savedAt, adminRev, data:<container> }]
const view = { query: '', sortKey: 'name', sortDir: 1, groupBy: false };
let listEl = null;
let countEl = null;

// ---- API ----------------------------------------------------------------------------------
async function api(path, opts = {}) {
  const res = await fetch(path, { ...opts, headers: { 'x-admin-key': getAdminKey(), ...(opts.headers || {}) } });
  if (res.status === 403) throw { status: 403 };
  if (!res.ok && res.status !== 204) throw { status: res.status };
  return res.status === 204 ? null : res.json();
}
const apiFamilies = () => api('/api/admin/families');
const apiPut = (code, data) =>
  api(`/api/admin/family/${encodeURIComponent(code)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ data }),
  });
const apiDelete = (code) => api(`/api/admin/family/${encodeURIComponent(code)}`, { method: 'DELETE' });

// ---- small helpers ------------------------------------------------------------------------
const pct = (a) => `${a ? Math.round(a * 100) : 0}%`;
function fmtDur(ms) {
  const m = Math.round((ms || 0) / 60000);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}
const now = () => Date.now();
const panel = (title, ...kids) => el('section', { class: 'panel' }, el('h3', {}, title), ...kids);
function kvGrid(pairs) {
  return el(
    'div',
    { class: 'kv' },
    ...pairs.flatMap(([k, v]) => [
      el('span', { class: 'k' }, k),
      v && v.nodeType ? v : el('span', { class: 'v' }, v == null || v === '' ? '—' : String(v)),
    ]),
  );
}
function findProfile(code, id) {
  const fam = families.find((f) => f.code === code);
  if (!fam || !fam.data) return null;
  const idx = (fam.data.profiles || []).findIndex((p) => p.id === id);
  return idx < 0 ? null : { fam, idx, profile: fam.data.profiles[idx] };
}

// A modal that reuses the shared .gate-overlay/.gate-box (DESIGN_SYSTEM.md §4c). z=60 for
// content/export modals; z=200 for confirms that must sit above everything.
function modal({ title, body = [], actions = [], z = 60, onClose }) {
  const close = () => {
    overlay.remove();
    if (onClose) onClose();
  };
  const overlay = el(
    'div',
    { class: 'gate-overlay', style: { zIndex: String(z) }, onPointerdown: (e) => { if (e.target === overlay) close(); } },
    el('div', { class: 'gate-box' }, title && el('h2', {}, title), el('div', { class: 'gate-body' }, ...body), el('div', { class: 'gate-actions' }, ...actions)),
  );
  overlay._close = close;
  document.body.appendChild(overlay);
  return overlay;
}
function confirmModal({ title, message, confirmLabel = 'Confirm', danger = false, onConfirm }) {
  const m = modal({
    title,
    z: 200,
    body: [el('p', {}, message)],
    actions: [
      el('button', { class: 'btn ghost', onClick: () => m._close() }, 'Cancel'),
      el('button', { class: `btn ${danger ? 'danger' : 'primary'}`, onClick: () => { m._close(); onConfirm(); } }, confirmLabel),
    ],
  });
  return m;
}

// editable-field factories (bind to a plain object the Save step then persists)
function textField(obj, key, { type = 'text', num = false } = {}) {
  const i = el('input', { type, value: obj[key] != null ? obj[key] : '' });
  i.addEventListener('input', () => { obj[key] = num ? (i.value === '' ? null : Number(i.value)) : i.value; });
  return i;
}
function checkField(obj, key) {
  const i = el('input', { type: 'checkbox' });
  i.checked = !!obj[key];
  i.addEventListener('change', () => { obj[key] = i.checked; });
  return i;
}
function selectField(obj, key, options) {
  const s = el('select', {}, ...options.map((o) => el('option', { value: o, selected: obj[key] === o }, o)));
  s.addEventListener('change', () => { obj[key] = s.value; });
  return s;
}

// ---- LOGIN --------------------------------------------------------------------------------
function renderLogin(msg) {
  const input = el('input', { type: 'password', value: getAdminKey() || '', placeholder: 'ADMIN_KEY' });
  const go = async () => {
    setAdminKey(input.value.trim());
    try {
      families = await apiFamilies();
      renderOverview();
    } catch (e) {
      renderLogin(e && e.status === 403 ? 'Key rejected.' : 'Could not connect (is ADMIN_KEY set on the server?).');
    }
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  root.replaceChildren(
    el(
      'div',
      { class: 'panel', style: { maxWidth: '420px', margin: '40px auto' } },
      el('h1', {}, '🔮 Spell Caverns Admin'),
      el('p', { class: 'muted' }, 'Enter the operator key to view all students.'),
      kvGrid([['Admin key', input]]),
      msg && el('div', { class: 'gate-err' }, msg),
      el('div', { style: { marginTop: '12px' } }, el('button', { class: 'btn primary', onClick: go }, 'Unlock')),
    ),
  );
}
function logout() {
  clearAdminKey();
  families = [];
  renderLogin();
}

// ---- OVERVIEW -----------------------------------------------------------------------------
const OV_COLS = [
  { key: 'name', label: 'Name', get: (r) => r.name },
  { key: 'familyCode', label: 'Family', get: (r) => r.familyCode },
  { key: 'level', label: 'Lvl', get: (r) => r.level },
  { key: 'accuracy', label: 'Acc', get: (r) => pct(r.accuracy) },
  { key: 'playMs', label: 'Play', get: (r) => fmtDur(r.playMs) },
  { key: 'gems', label: 'Gems', get: (r) => r.gems },
  { key: 'streakLastDay', label: 'Last seen', get: (r) => r.streakLastDay || '—' },
];

function rows() {
  let r = flattenFamilies(families);
  const q = view.query.trim().toLowerCase();
  if (q) r = r.filter((x) => (x.name || '').toLowerCase().includes(q) || (x.familyCode || '').toLowerCase().includes(q));
  const k = view.sortKey;
  r.sort((a, b) => {
    const av = a[k];
    const bv = b[k];
    const c = av < bv ? -1 : av > bv ? 1 : 0;
    return c * view.sortDir;
  });
  return r;
}
function grouped(data) {
  if (!view.groupBy) return [{ head: null, items: data }];
  const map = new Map();
  for (const r of data) {
    if (!map.has(r.familyCode)) map.set(r.familyCode, []);
    map.get(r.familyCode).push(r);
  }
  return [...map.entries()].map(([head, items]) => ({ head, items }));
}
function th(col) {
  const active = view.sortKey === col.key;
  return el(
    'th',
    {
      class: active ? 'sorted' : '',
      onClick: () => {
        if (active) view.sortDir *= -1;
        else { view.sortKey = col.key; view.sortDir = 1; }
        buildList();
      },
    },
    col.label + (active ? (view.sortDir > 0 ? ' ▲' : ' ▼') : ''),
  );
}
function card(r) {
  return el(
    'button',
    { class: 'admin-card', onClick: () => openDetail(r.familyCode, r.profileId) },
    el('div', { class: 'ac-name' }, r.name),
    el('div', { class: 'ac-sub' }, `Family ${r.familyCode} · Lvl ${r.level} · ${pct(r.accuracy)} · ${fmtDur(r.playMs)} · 💎${r.gems}`),
  );
}
function tableRow(r) {
  return el('tr', { onClick: () => openDetail(r.familyCode, r.profileId) }, ...OV_COLS.map((c) => el('td', {}, String(c.get(r)))));
}
function buildList() {
  const data = rows();
  if (countEl) countEl.textContent = `${data.length} students · ${families.length} families`;
  const groups = grouped(data);
  const cards = el('div', { class: 'admin-cards' });
  const tbody = el('tbody');
  for (const g of groups) {
    if (g.head) {
      cards.appendChild(el('div', { class: 'admin-group-head' }, `Family ${g.head}`));
      tbody.appendChild(el('tr', {}, el('td', { colspan: String(OV_COLS.length), class: 'admin-group-head' }, `Family ${g.head}`)));
    }
    for (const r of g.items) {
      cards.appendChild(card(r));
      tbody.appendChild(tableRow(r));
    }
  }
  const table = el('table', { class: 'admin-table' }, el('thead', {}, el('tr', {}, ...OV_COLS.map(th))), tbody);
  listEl.replaceChildren(cards, el('div', { class: 'admin-tablewrap' }, table));
}
function renderOverview() {
  const search = el('input', { type: 'text', value: view.query, placeholder: 'Search name or family…' });
  search.addEventListener('input', () => { view.query = search.value; buildList(); });
  countEl = el('div', { class: 'muted', style: { margin: '4px 0 10px' } }, '');
  listEl = el('div', {});
  const bar = el(
    'div',
    { class: 'admin-bar' },
    el('h1', {}, '🔮 Students'),
    search,
    el('button', { class: 'btn ghost', onClick: () => { view.groupBy = !view.groupBy; renderOverview(); } }, view.groupBy ? 'Ungroup' : 'Group by family'),
    el('button', { class: 'btn primary', onClick: () => openExport() }, 'Export CSV'),
    el('button', { class: 'btn ghost', onClick: logout }, 'Log out'),
  );
  root.replaceChildren(bar, countEl, listEl);
  buildList();
}

// ---- DETAIL -------------------------------------------------------------------------------
function openDetail(code, id) {
  const found = findProfile(code, id);
  if (!found) { toast('Profile not found'); renderOverview(); return; }
  const original = found.profile;
  const edited = JSON.parse(JSON.stringify(original)); // working copy for field edits
  edited.settings = edited.settings || {};
  edited.categories = edited.categories || {};
  const origLevel = original.categories ? original.categories.level : 1;
  const row = flattenProfile(code, original);

  const save = async () => {
    // keep setSize in step with the "words per dig" setting
    if (edited.settings.length != null) edited.categories.setSize = Number(edited.settings.length) || edited.categories.setSize;
    // a level change re-aims the served words (park current learning as tricky; the kid app refills)
    if (Number(edited.categories.level) !== Number(origLevel)) reaim(edited.categories, Number(edited.categories.level));
    found.fam.data.profiles[found.idx] = edited;
    try {
      const envelope = await apiPut(code, found.fam.data);
      adoptEnvelope(found.fam, envelope);
      toast('Saved — the device will pick this up on next sync');
      openDetail(code, id);
    } catch (e) { toast(`Save failed (${(e && e.status) || '?'})`); }
  };

  const bar = el(
    'div',
    { class: 'admin-bar' },
    el('button', { class: 'btn ghost', onClick: renderOverview }, '‹ Back'),
    el('h1', {}, edited.profile && edited.profile.name ? edited.profile.name : 'Explorer'),
    el('span', { class: 'muted' }, `family ${code} · rev ${found.fam.adminRev || 0}`),
    el('span', { class: 'spacer', style: { flex: '1 1 auto' } }),
    el('button', { class: 'btn primary', onClick: save }, 'Save'),
  );

  const identity = panel(
    'Identity',
    kvGrid([
      ['Name', textField(edited.profile, 'name')],
      ['Colour', textField(edited.settings, 'themeColor')],
      ['Age', row.age],
      ['Kid lock', row.kidLock ? 'yes' : 'no'],
      ['Profile ID', row.profileId],
    ]),
  );
  const settings = panel(
    'Settings',
    kvGrid([
      ['Difficulty', selectField(edited.settings, 'difficulty', ['easy', 'medium', 'hard'])],
      ['Words per dig', textField(edited.settings, 'length', { type: 'number', num: true })],
      ['Voice', checkField(edited.settings, 'voice')],
      ['Volume', textField(edited.settings, 'volume', { type: 'number', num: true })],
      ['Voice rate', textField(edited.settings, 'voiceRate', { type: 'number', num: true })],
      ['Readable text', checkField(edited.settings, 'readableText')],
      ['Daily goal gems', textField(edited.settings, 'dailyGoalGems', { type: 'number', num: true })],
      ['Reminders', checkField(edited.settings, 'reminders')],
      ['Disable Lab', checkField(edited.settings, 'labDisabled')],
    ]),
  );
  const progress = panel(
    'Progress',
    kvGrid([
      ['Cavern level', textField(edited.categories, 'level', { type: 'number', num: true })],
      ['Peak level', row.peakLevel],
      ['Start level', row.startLevel],
      ['Mastery unlocked', row.masteryUnlocked ? 'yes' : 'no'],
      ['Mining unlocked', row.miningUnlocked ? 'yes' : 'no'],
    ]),
  );
  const stats = panel(
    'Stats',
    kvGrid([
      ['Play time', fmtDur(row.playMs)],
      ['Sessions', row.sessionsPlayed],
      ['Accuracy', `${pct(row.accuracy)} (${row.correct}/${row.answers})`],
      ['Gems', textField(edited, 'gems', { type: 'number', num: true })],
      ['Streak', `${row.streakCurrent} (best ${row.streakBest})`],
      ['Last played', row.streakLastDay],
    ]),
  );
  const chips = (label, list) => el('div', {}, el('div', { class: 'k' }, `${label} (${list.length})`), el('div', { class: 'word-chips' }, ...list.map((w) => el('span', { class: 'word-chip' }, w))));
  const words = panel('Words', chips('Learning', row.learning), chips('Known', row.known), chips('Mastered', row.mastered), chips('Tricky', row.tricky));

  const detail = el('div', {}, bar, identity, settings, progress, stats, words, specimensPanel(code, id, original), restorePanel(code, id, original), dangerPanel(code, id, original));
  root.replaceChildren(detail);
}

// re-aim the working set at a new level: park current learning as tricky + reset the run window
// (the kid app's fillLearning then tops up from the new band). Pure object edit on the serialized
// categories — mirrors engine/categories.setLevelAndRefill minus the pool-dependent refill.
function reaim(cats, level) {
  cats.level = Math.max(1, Math.round(level) || 1);
  cats.peakLevel = Math.max(cats.peakLevel || 1, cats.level);
  cats.recent = [];
  for (const w of cats.words || []) if (w.category === 'learning') w.category = 'tricky';
}
function adoptEnvelope(fam, envelope) {
  if (!envelope || !envelope.data) return;
  fam.data = envelope.data;
  fam.savedAt = envelope.savedAt || fam.savedAt;
  fam.adminRev = Number(envelope.data.adminRev) || 0;
}

// SPECIMENS — thumbnail grid; tap to view large + delete (confirm-gated, immediate write).
function specimensPanel(code, id, profile) {
  const specs = Array.isArray(profile.specimens) ? profile.specimens : [];
  if (!specs.length) return panel('Specimens', el('p', { class: 'muted' }, 'No drawings.'));
  const grid = el(
    'div',
    { class: 'spec-grid' },
    ...specs.map((s) =>
      el(
        'div',
        { class: 'spec-thumb', onClick: () => openSpecimen(code, id, s) },
        s.image ? el('img', { src: s.image, alt: s.name || s.word || 'drawing' }) : el('div', { class: 'muted center' }, '(no image)'),
      ),
    ),
  );
  return panel('Specimens', el('div', { class: 'muted' }, `${specs.length} drawings · tap to view / delete`), grid);
}
function openSpecimen(code, id, spec) {
  const m = modal({
    title: spec.name || spec.word || 'Drawing',
    body: [spec.image ? el('img', { src: spec.image, alt: '', style: { width: '100%', borderRadius: '14px' } }) : el('p', { class: 'muted' }, '(no image)'), el('p', { class: 'muted center' }, spec.word ? `word: ${spec.word}` : '')],
    actions: [
      el('button', { class: 'btn ghost', onClick: () => m._close() }, 'Close'),
      el('button', { class: 'btn danger', onClick: () => { m._close(); confirmDeleteSpecimen(code, id, spec.ts); } }, 'Delete'),
    ],
  });
}
function confirmDeleteSpecimen(code, id, ts) {
  confirmModal({
    title: 'Delete drawing?',
    message: 'This permanently removes the drawing from the student’s data.',
    confirmLabel: 'Delete',
    danger: true,
    onConfirm: async () => {
      const f = findProfile(code, id);
      if (!f) return;
      f.profile.specimens = (f.profile.specimens || []).filter((s) => s.ts !== ts);
      await commit(code, id, f, 'Drawing deleted');
    },
  });
}

// RESTORE points (snapshot ring) — undo a reset/re-test, or any dated auto-snapshot.
function restorePanel(code, id, profile) {
  const snaps = Array.isArray(profile.snapshots) ? profile.snapshots : [];
  if (!snaps.length) return panel('Restore points', el('p', { class: 'muted' }, 'No snapshots yet.'));
  // newest first
  const rows_ = snaps.map((s, i) => ({ i, at: s.at, label: s.label })).reverse();
  return panel(
    'Restore points',
    ...rows_.map((s) =>
      el(
        'div',
        { class: 'detail-actions', style: { justifyContent: 'space-between' } },
        el('span', {}, `${new Date(s.at).toLocaleString()} — ${s.label || 'snapshot'}`),
        el('button', { class: 'btn ghost', onClick: () => confirmRestore(code, id, s.i) }, 'Restore'),
      ),
    ),
  );
}
function confirmRestore(code, id, index) {
  confirmModal({
    title: 'Restore this snapshot?',
    message: 'The student’s data will be rolled back to this restore point (the snapshot history is kept).',
    confirmLabel: 'Restore',
    onConfirm: async () => {
      const f = findProfile(code, id);
      if (!f) return;
      const snap = (f.profile.snapshots || [])[index];
      if (!snap) { toast('Snapshot gone'); return; }
      f.fam.data.profiles[f.idx] = { ...snap.data, id: f.profile.id, snapshots: f.profile.snapshots };
      await commit(code, id, f, 'Restored');
    },
  });
}

// DANGER — reset progress / re-test (snapshot FIRST per Ian) + delete profile / family.
function dangerPanel(code, id, profile) {
  return panel(
    'Danger zone',
    el('p', { class: 'muted' }, 'Reset and Re-test take a restore point first (see above).'),
    el(
      'div',
      { class: 'detail-actions' },
      el('button', { class: 'btn danger', onClick: () => confirmReset(code, id) }, 'Reset progress'),
      el('button', { class: 'btn danger', onClick: () => confirmRetest(code, id) }, 'Re-test level'),
      el('button', { class: 'btn danger', onClick: () => confirmDeleteProfile(code, id, profile) }, 'Delete profile'),
      el('button', { class: 'btn danger', onClick: () => confirmDeleteFamily(code) }, 'Delete whole family'),
    ),
  );
}
// A fresh profile keeping identity (mirrors state.defaultProfile + resetActiveProgress).
function freshProfile(old) {
  const setSize = (old.settings && old.settings.length) || 10;
  return {
    id: old.id,
    version: 1,
    profile: { ...(old.profile || {}), onboarded: true },
    settings: { ...(old.settings || {}) },
    startLevel: old.startLevel || 1,
    placement: { done: false, age: (old.placement && old.placement.age) || null },
    kidLock: old.kidLock || null,
    snapshots: [],
    gems: 0,
    feedback: [],
    specimens: [],
    stats: { sessionsPlayed: 0, answers: 0, correct: 0, playMs: 0, byDay: {} },
    streak: defaultStreak(),
    records: { bestCombo: 0, bestWaveGems: 0 },
    catalog: { owned: [], milestoneDepth: 1 },
    lastBackupAt: 0,
    tracker: serializeTracker(createTracker()),
    categories: serializeCategoryState(createCategoryState({ setSize, level: old.startLevel || 1 })),
  };
}
function confirmReset(code, id) {
  confirmModal({
    title: 'Reset all progress?',
    message: 'Wipes gems, stats, words and catalog (name/colour/settings kept). A restore point is saved first.',
    confirmLabel: 'Reset',
    danger: true,
    onConfirm: async () => {
      const f = findProfile(code, id);
      if (!f) return;
      const old = f.profile;
      const fresh = freshProfile(old);
      fresh.snapshots = pushSnapshot(old.snapshots || [], { at: now(), label: 'admin: before reset', data: { ...old, snapshots: [] } });
      f.fam.data.profiles[f.idx] = fresh;
      await commit(code, id, f, 'Progress reset (restore point saved)');
    },
  });
}
function confirmRetest(code, id) {
  confirmModal({
    title: 'Re-test starting level?',
    message: 'Re-runs the placement diagnostic next session (word progress kept, mastery/mining re-locked). A restore point is saved first.',
    confirmLabel: 'Re-test',
    danger: true,
    onConfirm: async () => {
      const f = findProfile(code, id);
      if (!f) return;
      const p = f.profile;
      p.snapshots = pushSnapshot(p.snapshots || [], { at: now(), label: 'admin: before re-test', data: { ...p, snapshots: [] } });
      const c = p.categories || (p.categories = {});
      c.level = 1;
      c.peakLevel = 1;
      c.peakKnownish = 0;
      c.peakMastered = 0;
      c.recent = [];
      c.reviewPending = { craft: 0, mastery: 0 };
      p.placement = { ...(p.placement || {}), done: false };
      await commit(code, id, f, 'Re-test armed (restore point saved)');
    },
  });
}
function confirmDeleteProfile(code, id, profile) {
  confirmModal({
    title: 'Delete this profile?',
    message: `Permanently deletes ${(profile.profile && profile.profile.name) || 'this explorer'} from the family. This cannot be undone.`,
    confirmLabel: 'Delete profile',
    danger: true,
    onConfirm: async () => {
      const f = findProfile(code, id);
      if (!f) return;
      f.fam.data.profiles = f.fam.data.profiles.filter((p) => p.id !== id);
      if (f.fam.data.activeId === id) f.fam.data.activeId = (f.fam.data.profiles[0] && f.fam.data.profiles[0].id) || null;
      try {
        const envelope = await apiPut(code, f.fam.data);
        adoptEnvelope(f.fam, envelope);
        toast('Profile deleted');
        renderOverview();
      } catch (e) { toast(`Delete failed (${(e && e.status) || '?'})`); }
    },
  });
}
function confirmDeleteFamily(code) {
  confirmModal({
    title: 'Delete the WHOLE family?',
    message: `Permanently deletes every profile under family ${code} and its cloud data. This cannot be undone.`,
    confirmLabel: 'Delete family',
    danger: true,
    onConfirm: async () => {
      try {
        await apiDelete(code);
        families = families.filter((f) => f.code !== code);
        toast('Family deleted');
        renderOverview();
      } catch (e) { toast(`Delete failed (${(e && e.status) || '?'})`); }
    },
  });
}
// PUT the family container, adopt the bumped envelope, toast, and re-open the detail.
async function commit(code, id, f, okMsg) {
  try {
    const envelope = await apiPut(code, f.fam.data);
    adoptEnvelope(f.fam, envelope);
    toast(okMsg);
    openDetail(code, id);
  } catch (e) { toast(`Failed (${(e && e.status) || '?'})`); }
}

// ---- EXPORT -------------------------------------------------------------------------------
function openExport() {
  const data = rows(); // current filter/sort
  const selected = new Set(DEFAULT_COLUMNS);
  let granularity = 'student';
  const radio = (val, label, checked, onSel) => {
    const i = el('input', { type: 'radio', name: 'gran', value: val });
    i.checked = checked;
    i.addEventListener('change', () => { if (i.checked) onSel(); });
    return el('label', {}, i, label);
  };
  const colBoxes = el(
    'div',
    {},
    ...Object.entries(COLUMN_GROUPS).map(([group, keys]) =>
      el(
        'div',
        { class: 'exp-group' },
        el('h4', {}, group),
        el(
          'div',
          { class: 'exp-cols' },
          ...keys.map((k) => {
            const cb = el('input', { type: 'checkbox' });
            cb.checked = selected.has(k);
            cb.addEventListener('change', () => { cb.checked ? selected.add(k) : selected.delete(k); });
            return el('label', {}, cb, (COLUMNS[k] && COLUMNS[k].label) || k);
          }),
        ),
      ),
    ),
  );
  const m = modal({
    title: 'Export CSV',
    body: [
      el('div', { class: 'exp-group' }, el('h4', {}, 'Granularity'), radio('student', 'One row per student', true, () => (granularity = 'student')), radio('word', 'One row per word per student', false, () => (granularity = 'word'))),
      el('p', { class: 'muted' }, `Scope: ${data.length} students (current filter). Columns (per-student only):`),
      colBoxes,
    ],
    actions: [
      el('button', { class: 'btn ghost', onClick: () => m._close() }, 'Cancel'),
      el('button', { class: 'btn primary', onClick: () => { download(data, granularity, Object.keys(COLUMNS).filter((k) => selected.has(k))); m._close(); } }, 'Download'),
    ],
  });
}
function download(data, granularity, columns) {
  const csv = toCSV(data, { granularity, columns });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: granularity === 'word' ? 'students_words.csv' : 'students.csv' });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('CSV downloaded');
}

// ---- BOOT ---------------------------------------------------------------------------------
(async function boot() {
  if (getAdminKey()) {
    try {
      families = await apiFamilies();
      renderOverview();
      return;
    } catch {
      /* fall through to login */
    }
  }
  renderLogin();
})();
