/*
 * «آشنا» — ui.js
 * عناصر رابط کاربری: آیکون‌ها، Toast، کپی، وضعیت‌ها، کشو/مودال
 */

import { ERROR_MESSAGES } from './translator.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const numberFormat = typeof Intl !== 'undefined' ? new Intl.NumberFormat('fa-IR') : null;

export function faNum(n) {
  return numberFormat ? numberFormat.format(n) : String(n);
}

/* ---------- آیکون‌ها (SVG با currentColor) ---------- */
const svg = (inner, sw = 1.8) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" ` +
  `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

export const ICONS = {
  sun: svg(
    '<circle cx="12" cy="12" r="4"/>' +
    '<path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/>'
  ),
  moon: svg('<path d="M20.5 13.2A8.5 8.5 0 1 1 10.8 3.5a6.8 6.8 0 0 0 9.7 9.7z"/>'),
  monitor: svg('<rect x="3" y="4.5" width="18" height="12.5" rx="2"/><path d="M8.5 20.5h7M12 17v3.5"/>'),
  speaker: svg(
    '<path d="M11 5.5 6.5 9H3.5v6h3L11 18.5z"/>' +
    '<path d="M14.8 9.2a4 4 0 0 1 0 5.6"/>' +
    '<path d="M17.5 6.5a8 8 0 0 1 0 11"/>'
  ),
  stop: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor"/></svg>`,
  copy: svg(
    '<rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2.4"/>' +
    '<path d="M15.5 8.5V6.4A2.4 2.4 0 0 0 13.1 4H6.4A2.4 2.4 0 0 0 4 6.4v6.7a2.4 2.4 0 0 0 2.4 2.4h2.1"/>'
  ),
  check: svg('<path d="M4.5 12.5 10 18 19.5 6.5"/>', 2),
  trash: svg(
    '<path d="M4 7h16M9.5 7V5.2A1.7 1.7 0 0 1 11.2 3.5h1.6A1.7 1.7 0 0 1 14.5 5.2V7"/>' +
    '<path d="M6.5 7l.9 12.1A2 2 0 0 0 9.4 21h5.2a2 2 0 0 0 2-1.9L17.5 7"/>'
  ),
  arrowL: svg('<path d="M20 12H7m0 0 4-4m-4 4 4 4"/>', 1.9),
  checkCircle: svg('<circle cx="12" cy="12" r="8.6"/><path d="M8.4 12.4l2.5 2.5 4.7-5.1"/>'),
  alertCircle: svg('<circle cx="12" cy="12" r="8.6"/><path d="M12 7.6v5.4"/><circle cx="12" cy="16.3" r="0.55" fill="currentColor" stroke="none"/>'),
  infoCircle: svg('<circle cx="12" cy="12" r="8.6"/><path d="M12 11.6v5"/><circle cx="12" cy="8.2" r="0.55" fill="currentColor" stroke="none"/>')
};

export function setIcon(container, name) {
  if (container) container.innerHTML = ICONS[name] || '';
}

/* ---------- Toast ---------- */
export function toast(message, type = 'info') {
  const host = document.getElementById('toastHost');
  if (!host) return;
  while (host.children.length >= 3) {
    host.firstElementChild.remove();
  }
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  const iconKey = type === 'success' ? 'checkCircle' : type === 'error' ? 'alertCircle' : 'infoCircle';
  el.innerHTML = ICONS[iconKey];
  const span = document.createElement('span');
  span.textContent = message;
  el.appendChild(span);

  let timer = setTimeout(dismiss, 3400);
  function dismiss() {
    clearTimeout(timer);
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 260);
  }
  el.addEventListener('click', dismiss);
  host.appendChild(el);
}

/* ---------- کپی متن ---------- */
export async function copyText(text) {
  if (!text) return false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* روش جایگزین پایین‌تر */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-9999px;opacity:0;';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/* ---------- کشو و مودال (Overlay) ---------- */
const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let openEl = null;
let lastTrigger = null;

export function isOverlayOpen() {
  return Boolean(openEl);
}

export function openOverlay(el, trigger) {
  if (!el) return;
  if (openEl === el) return;
  if (openEl) closeOverlay(true);
  openEl = el;
  lastTrigger = trigger || document.activeElement;

  el.removeAttribute('inert');
  el.setAttribute('aria-hidden', 'false');
  el.classList.add('is-open');
  const overlay = document.getElementById('overlay');
  if (overlay) overlay.classList.add('is-open');
  document.body.classList.add('no-scroll');

  requestAnimationFrame(() => {
    const target =
      el.querySelector('[data-autofocus]') ||
      el.querySelector('input:not([disabled])') ||
      el.querySelector(FOCUSABLE);
    if (target) target.focus();
  });
}

export function closeOverlay(skipFocusRestore) {
  if (!openEl) return;
  const el = openEl;
  openEl = null;

  el.classList.remove('is-open');
  el.setAttribute('aria-hidden', 'true');
  el.setAttribute('inert', '');
  const overlay = document.getElementById('overlay');
  if (overlay) overlay.classList.remove('is-open');
  document.body.classList.remove('no-scroll');

  if (!skipFocusRestore && lastTrigger && document.contains(lastTrigger)) {
    lastTrigger.focus();
  }
  lastTrigger = null;
}

function trapTab(event) {
  if (!openEl) return;
  const nodes = $$(FOCUSABLE, openEl).filter((n) => n.getClientRects().length > 0);
  if (!nodes.length) return;
  const first = nodes[0];
  const last = nodes[nodes.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

export function initOverlay() {
  const overlay = document.getElementById('overlay');
  if (overlay) overlay.addEventListener('click', () => closeOverlay());

  // کلیک روی پس‌زمینهٔ مودال (بیرون از کارت) آن را می‌بندد
  const modal = document.querySelector('.modal');
  if (modal) {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeOverlay();
    });
  }

  document.addEventListener('keydown', (event) => {
    if (!openEl) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeOverlay();
      return;
    }
    if (event.key === 'Tab') trapTab(event);
  });
}

/* ---------- زبان‌ها ---------- */
const LANG_NAMES = { fa: 'فارسی', en: 'English' };

export function langName(code) {
  return LANG_NAMES[code] || code;
}

export function renderLangs(from, to) {
  const srcName = document.getElementById('sourceLangName');
  const tgtName = document.getElementById('targetLangName');
  if (srcName) srcName.textContent = langName(from);
  if (tgtName) tgtName.textContent = langName(to);

  const srcPill = document.getElementById('sourcePill');
  const tgtPill = document.getElementById('targetPill');
  if (srcPill) {
    srcPill.classList.toggle('lang-pill--fa', from === 'fa');
    srcPill.classList.toggle('lang-pill--en', from === 'en');
  }
  if (tgtPill) {
    tgtPill.classList.toggle('lang-pill--fa', to === 'fa');
    tgtPill.classList.toggle('lang-pill--en', to === 'en');
  }

  const source = document.getElementById('sourceText');
  if (source) {
    source.dir = from === 'fa' ? 'rtl' : 'ltr';
    source.lang = from;
  }
  const output = document.getElementById('outputText');
  if (output) {
    output.dir = to === 'fa' ? 'rtl' : 'ltr';
    output.lang = to;
  }

  const swap = document.getElementById('swapBtn');
  if (swap) {
    swap.setAttribute('aria-label', `جابه‌جایی زبان‌ها: ${langName(from)} و ${langName(to)}`);
  }
}

/* ---------- شمارندهٔ نویسه ---------- */
export function renderCount(el, n) {
  if (!el) return;
  el.textContent = `${faNum(n)} نویسه`;
  el.classList.toggle('is-warn', n >= 4800);
}

/* ---------- نشانگر وضعیت ---------- */
const STATUS_TEXT = {
  empty: 'منتظر متن',
  edited: 'آماده ترجمه',
  loading: 'در حال ترجمه…',
  ok: 'ترجمه انجام شد',
  error: 'ترجمه ناموفق'
};

export function setStatus(state) {
  const pill = document.getElementById('statusPill');
  const text = document.getElementById('statusText');
  if (!pill || !text) return;
  pill.className = `status-pill status--${state}`;
  text.textContent = STATUS_TEXT[state] || STATUS_TEXT.empty;
}

/* ---------- ناحیهٔ خروجی ---------- */
export function renderOutput(state, text = '', message = '') {
  const area = document.getElementById('outputArea');
  if (!area) return;
  area.dataset.state = state;
  area.setAttribute('aria-busy', state === 'loading' ? 'true' : 'false');

  if (state === 'ok') {
    const out = document.getElementById('outputText');
    if (out) out.textContent = text;
  }
  if (state === 'error') {
    const msg = document.getElementById('errorMsg');
    if (msg) msg.textContent = message || ERROR_MESSAGES.service;
  }
}
