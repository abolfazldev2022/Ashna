/*
 * «آشنا» — history.js
 * تاریخچهٔ ترجمه‌ها در Local Storage (سقف ۵۰ مورد)
 */

import { KEYS, get, set } from './storage.js';
import { toast, faNum, ICONS } from './ui.js';

const MAX_ITEMS = 50;

let items = [];
let restoreCb = null;
let query = '';

function isValidEntry(e) {
  return Boolean(
    e &&
      typeof e.id === 'string' &&
      typeof e.source === 'string' &&
      typeof e.result === 'string' &&
      (e.from === 'fa' || e.from === 'en') &&
      (e.to === 'fa' || e.to === 'en') &&
      typeof e.ts === 'number'
  );
}

function load() {
  const raw = get(KEYS.HISTORY, []);
  items = Array.isArray(raw) ? raw.filter(isValidEntry) : [];
}

function makeId() {
  try {
    if (crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {
    /* بی‌خیال */
  }
  return `h${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function persist() {
  for (let guard = 0; guard < MAX_ITEMS + 2; guard++) {
    if (set(KEYS.HISTORY, items)) return true;
    if (!items.length) break;
    items.pop(); // در صورت پر شدن Local Storage، قدیمی‌تری‌ها حذف می‌شوند
  }
  set(KEYS.HISTORY, []);
  return false;
}

export function all() {
  return items.slice();
}

export function count() {
  return items.length;
}

export function add(entry) {
  const e = {
    id: makeId(),
    source: String(entry.source),
    result: String(entry.result),
    from: entry.from,
    to: entry.to,
    ts: Date.now()
  };
  items = items.filter(
    (i) => !(i.source === e.source && i.from === e.from && i.to === e.to)
  );
  items.unshift(e);
  if (items.length > MAX_ITEMS) items.length = MAX_ITEMS;
  persist();
  render();
  refreshMeta();
}

export function remove(id) {
  const el = document.querySelector(`.h-item[data-id="${id}"]`);
  const finish = () => {
    items = items.filter((i) => i.id !== id);
    persist();
    render();
    refreshMeta();
  };
  if (el) {
    el.classList.add('is-removing');
    setTimeout(finish, 240);
  } else {
    finish();
  }
}

export function clear() {
  items = [];
  persist();
  render();
  refreshMeta();
}

/* ---------- رندر ---------- */

function visibleItems() {
  if (!query) return items;
  const q = query.toLowerCase();
  return items.filter(
    (i) =>
      i.source.toLowerCase().includes(q) || i.result.toLowerCase().includes(q)
  );
}

function fmtTime(ts) {
  try {
    return new Date(ts).toLocaleString('fa-IR', {
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '';
  }
}

function buildItem(item) {
  const li = document.createElement('li');
  li.className = 'h-item';
  li.dataset.id = item.id;

  const main = document.createElement('button');
  main.type = 'button';
  main.className = 'h-restore';
  main.setAttribute('aria-label', 'برگرداندن این مورد به مترجم');

  const meta = document.createElement('span');
  meta.className = 'h-meta';

  const pillFrom = document.createElement('span');
  pillFrom.className = `mini-pill mini-pill--${item.from}`;
  pillFrom.textContent = item.from === 'fa' ? 'فارسی' : 'English';

  const arrow = document.createElement('span');
  arrow.className = 'h-arrow';
  arrow.innerHTML = ICONS.arrowL;

  const pillTo = document.createElement('span');
  pillTo.className = `mini-pill mini-pill--${item.to}`;
  pillTo.textContent = item.to === 'fa' ? 'فارسی' : 'English';

  const time = document.createElement('span');
  time.className = 'h-time';
  time.textContent = fmtTime(item.ts);

  meta.append(pillFrom, arrow, pillTo, time);

  const src = document.createElement('span');
  src.className = 'h-src';
  src.textContent = item.source;
  src.dir = item.from === 'fa' ? 'rtl' : 'ltr';
  src.lang = item.from;

  const res = document.createElement('span');
  res.className = 'h-res';
  res.textContent = item.result;
  res.dir = item.to === 'fa' ? 'rtl' : 'ltr';
  res.lang = item.to;

  main.append(meta, src, res);

  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'icon-btn icon-btn--sm h-del';
  del.setAttribute('data-del', '');
  del.setAttribute('aria-label', 'حذف این مورد از تاریخچه');
  del.title = 'حذف';
  del.innerHTML = ICONS.trash;

  li.append(main, del);
  return li;
}

export function render() {
  const list = document.getElementById('historyList');
  const emptyBox = document.getElementById('historyEmpty');
  if (!list || !emptyBox) return;

  const visible = visibleItems();
  list.textContent = '';
  for (const item of visible) list.appendChild(buildItem(item));

  const noneAtAll = items.length === 0;
  emptyBox.hidden = visible.length > 0;

  const msg = document.getElementById('historyEmptyMsg');
  const hint = document.getElementById('historyEmptyHint');
  if (msg) msg.textContent = noneAtAll ? 'هنوز ترجمه‌ای ذخیره نشده.' : 'چیزی با این جستجو پیدا نشد.';
  if (hint) {
    hint.textContent = noneAtAll
      ? 'ترجمه‌های اخیرت اینجا جمع می‌شن.'
      : 'یه کلمهٔ دیگه امتحان کن.';
  }
}

function refreshMeta() {
  const n = items.length;

  const badge = document.getElementById('historyCount');
  if (badge) {
    badge.hidden = n === 0;
    badge.textContent = faNum(n);
  }

  const chip = document.getElementById('historyDrawerCount');
  if (chip) chip.textContent = faNum(n);

  const modalCount = document.getElementById('historyCountModal');
  if (modalCount) modalCount.textContent = `${faNum(n)} مورد`;

  for (const id of ['clearHistoryBtn', 'clearHistoryBtnModal']) {
    const btn = document.getElementById(id);
    if (btn) {
      btn.disabled = n === 0;
      if (n === 0) resetConfirm(btn);
    }
  }
}

/* ---------- رویدادها ---------- */

function onListClick(event) {
  const li = event.target.closest('.h-item');
  if (!li) return;
  const id = li.dataset.id;

  if (event.target.closest('[data-del]')) {
    remove(id);
    return;
  }
  if (event.target.closest('.h-restore')) {
    const item = items.find((i) => i.id === id);
    if (item && restoreCb) restoreCb(item);
  }
}

function resetConfirm(btn) {
  delete btn.dataset.confirming;
  btn.classList.remove('is-confirm');
  if (btn.dataset.origLabel) btn.textContent = btn.dataset.origLabel;
}

function onClearAll(event) {
  const btn = event.currentTarget;
  if (btn.disabled) return;

  if (!btn.dataset.confirming) {
    btn.dataset.confirming = '1';
    btn.dataset.origLabel = btn.textContent;
    btn.classList.add('is-confirm');
    btn.textContent = 'پاک بشه؟';
    clearTimeout(btn._confirmTimer);
    btn._confirmTimer = setTimeout(() => resetConfirm(btn), 3200);
    return;
  }

  clearTimeout(btn._confirmTimer);
  resetConfirm(btn);
  clear();
  toast('تاریخچه پاک شد.', 'success');
}

export function init({ onRestore } = {}) {
  restoreCb = onRestore || null;
  load();

  // فقط یک بار به عناصر گوش بده (برای جلوگیری از شنوندهٔ تکراری)
  if (!init.bound) {
    init.bound = true;

    const list = document.getElementById('historyList');
    if (list) list.addEventListener('click', onListClick);

    const search = document.getElementById('historySearch');
    if (search) {
      search.addEventListener('input', () => {
        query = search.value.trim();
        render();
      });
    }

    for (const id of ['clearHistoryBtn', 'clearHistoryBtnModal']) {
      const btn = document.getElementById(id);
      if (btn) btn.addEventListener('click', onClearAll);
    }
  }

  render();
  refreshMeta();
}

/** خواندن دوبارهٔ تاریخچه از Local Storage (مثلاً وقتی تب دیگری تغییرش داد). */
export function reload() {
  load();
  render();
  refreshMeta();
}
