/*
 * «آشنا» — app.js
 * هماهنگ‌کنندهٔ اصلی: رویدادها، جریان ترجمه، PWA
 */

import {
  $,
  toast,
  initOverlay,
  openOverlay,
  closeOverlay,
  renderLangs,
  renderCount,
  setStatus,
  renderOutput,
  copyText,
  setIcon
} from './ui.js';
import { translate, TranslateError } from './translator.js';
import * as History from './history.js';
import * as Theme from './theme.js';
import * as Speech from './speech.js';
import { KEYS, get, set, onExternalChange } from './storage.js';

const DEBOUNCE_MS = 850;
const DEFAULT_SETTINGS = { auto: true };

const state = {
  from: 'fa',
  to: 'en',
  result: '',
  loading: false,
  controller: null,
  debTimer: null,
  lastKey: '',
  turn: 0,
  speechOK: true,
  settings: { ...DEFAULT_SETTINGS }
};

let els = {};

/* ---------- تنظیمات ---------- */

function loadSettings() {
  const raw = get(KEYS.SETTINGS, null);
  const merged = { ...DEFAULT_SETTINGS, ...(raw && typeof raw === 'object' ? raw : {}) };
  if (typeof merged.auto !== 'boolean') merged.auto = true;
  state.settings = merged;
}

function saveSettings() {
  set(KEYS.SETTINGS, state.settings);
}

/* ---------- وضعیت دکمه‌ها و شمارنده‌ها ---------- */

function hasSource() {
  return els.source.value.trim().length > 0;
}

function updateCounts() {
  renderCount(els.sourceCount, els.source.value.length);
  renderCount(els.targetCount, state.result.length);
}

function updateButtons() {
  const src = hasSource();
  const res = state.result.length > 0;
  els.translate.disabled = state.loading || !src;
  els.clear.disabled = els.source.value.length === 0;
  if (state.speechOK) {
    els.srcListen.disabled = !src;
    els.tgtListen.disabled = !res;
  }
  els.copy.disabled = !res;
  els.replace.disabled = !res;
}

function setLoading(value) {
  state.loading = value;
  els.translate.classList.toggle('is-loading', value);
  updateButtons();
}

/* ---------- ترجمه ---------- */

function cancelDebounce() {
  if (state.debTimer) {
    clearTimeout(state.debTimer);
    state.debTimer = null;
  }
}

function scheduleAuto() {
  cancelDebounce();
  if (!state.settings.auto) return;
  state.debTimer = setTimeout(() => {
    state.debTimer = null;
    doTranslate();
  }, DEBOUNCE_MS);
}

function abortActive() {
  if (state.controller) {
    state.controller.abort();
    state.controller = null;
  }
}

async function doTranslate() {
  const text = els.source.value;
  const trimmed = text.trim();
  if (!trimmed) return;

  const key = `${state.from}|${state.to}|${trimmed}`;
  if (key === state.lastKey && state.result) {
    renderOutput('ok', state.result);
    setStatus('ok');
    updateCounts();
    return;
  }

  abortActive();
  const ctrl = new AbortController();
  state.controller = ctrl;
  setLoading(true);
  renderOutput('loading');
  setStatus('loading');

  try {
    const out = await translate(trimmed, state.from, state.to, { signal: ctrl.signal });

    // اگر کاربر همین وسط متن را عوض کرده باشد، این پاسخ دیگر اعتبار ندارد.
    if (els.source.value.trim() !== trimmed) {
      renderOutput('empty');
      setStatus('edited');
      return;
    }

    state.result = out;
    state.lastKey = key;
    renderOutput('ok', out);
    setStatus('ok');
    updateCounts();
    updateButtons();
    History.add({ source: trimmed, result: out, from: state.from, to: state.to });
  } catch (err) {
    if (err && err.name === 'AbortError') return;
    const msg =
      err instanceof TranslateError
        ? err.userMessage
        : 'ترجمه انجام نشد. اتصال اینترنت یا سرویس ترجمه را بررسی کن.';
    renderOutput('error', '', msg);
    setStatus('error');
    updateButtons();
  } finally {
    if (state.controller === ctrl) state.controller = null;
    if (!state.controller) setLoading(false);
  }
}

/* ---------- عملیات روی متن ---------- */

function onInput() {
  updateCounts();
  updateButtons();

  if (!hasSource()) {
    cancelDebounce();
    abortActive();
    state.result = '';
    state.lastKey = '';
    renderOutput('empty');
    setStatus('empty');
    updateCounts();
    updateButtons();
    return;
  }

  setStatus('edited');
  scheduleAuto();
}

function doSwap() {
  Speech.stop();
  cancelDebounce();
  abortActive();

  const srcText = els.source.value;
  const hadResult = Boolean(state.result);

  const tmp = state.from;
  state.from = state.to;
  state.to = tmp;

  if (hadResult) {
    els.source.value = state.result;
    state.result = srcText;
    state.lastKey = '';
  }

  state.turn += 1;
  els.swap.style.setProperty('--turn', `${state.turn * 180}deg`);

  renderLangs(state.from, state.to);
  updateCounts();
  updateButtons();

  if (hadResult) {
    renderOutput('ok', state.result);
    setStatus('ok');
  } else {
    renderOutput('empty');
    setStatus(hasSource() ? 'edited' : 'empty');
  }

  toast('زبان‌ها جابه‌جایی شدند.', 'info');
}

function doReplace() {
  if (!state.result) return;
  Speech.stop();
  cancelDebounce();
  abortActive();

  els.source.value = state.result;
  state.result = '';
  state.lastKey = '';

  const tmp = state.from;
  state.from = state.to;
  state.to = tmp;

  renderLangs(state.from, state.to);
  renderOutput('empty');
  setStatus(hasSource() ? 'edited' : 'empty');
  updateCounts();
  updateButtons();

  toast('ترجمه در متن ورودی قرار گرفت.', 'success');
  els.source.focus();
}

function doClear() {
  Speech.stop();
  cancelDebounce();
  abortActive();

  els.source.value = '';
  state.result = '';
  state.lastKey = '';
  renderOutput('empty');
  setStatus('empty');
  updateCounts();
  updateButtons();
  els.source.focus();
}

async function doCopy() {
  if (!state.result) return;
  const ok = await copyText(state.result);
  const ico = els.copy.querySelector('.btn-ico');
  if (ok) {
    toast('کپی شد.', 'success');
    if (ico) {
      setIcon(ico, 'check');
      setTimeout(() => setIcon(ico, 'copy'), 1500);
    }
  } else {
    toast('کپی انجام نشد؛ متن رو انتخاب و کپی کن.', 'error');
  }
}

/* ---------- تاریخچه ---------- */

function onRestoreFromHistory(item) {
  Speech.stop();
  cancelDebounce();
  abortActive();

  state.from = item.from;
  state.to = item.to;
  els.source.value = item.source;
  state.result = item.result;
  state.lastKey = `${item.from}|${item.to}|${item.source.trim()}`;

  renderLangs(state.from, state.to);
  renderOutput('ok', item.result);
  setStatus('ok');
  updateCounts();
  updateButtons();

  closeOverlay();
  toast('برگشت به مترجم.', 'info');
}

/* ---------- PWA ---------- */

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (!/^https?:$/.test(location.protocol)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {
      /* ثبت نشد؛ وب‌اپ همچنان کار می‌کند */
    });
  });
}

function bindInstallPrompt() {
  let deferred = null;
  const row = els.installRow;
  const btn = els.installBtn;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferred = event;
    if (row) row.hidden = false;
  });

  window.addEventListener('appinstalled', () => {
    deferred = null;
    if (row) row.hidden = true;
    toast('«آشنا» روی دستگاهت نصب شد.', 'success');
  });

  if (btn) {
    btn.addEventListener('click', async () => {
      if (!deferred) return;
      deferred.prompt();
      try {
        const choice = await deferred.userChoice;
        if (choice && choice.outcome === 'accepted') {
          toast('نصب «آشنا» انجام شد.', 'success');
        }
      } catch {
        /* بی‌خیال */
      }
      deferred = null;
      if (row) row.hidden = true;
    });
  }
}

/* ---------- اتصال رویدادها ---------- */

function bindEvents() {
  // متن ورودی
  els.source.addEventListener('input', onInput);
  els.source.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      cancelDebounce();
      doTranslate();
    }
  });

  // دکمه‌های اصلی
  els.translate.addEventListener('click', () => {
    cancelDebounce();
    doTranslate();
  });
  els.retry.addEventListener('click', () => doTranslate());
  els.swap.addEventListener('click', doSwap);
  els.clear.addEventListener('click', doClear);
  els.copy.addEventListener('click', doCopy);
  els.replace.addEventListener('click', doReplace);

  // پخش صدا
  els.srcListen.addEventListener('click', () => {
    Speech.toggle(els.source.value, state.from, els.srcListen);
  });
  els.tgtListen.addEventListener('click', () => {
    Speech.toggle(state.result, state.to, els.tgtListen);
  });

  // کشوی تاریخچه
  els.historyBtn.addEventListener('click', () => openOverlay(els.drawer, els.historyBtn));
  els.closeHistory.addEventListener('click', () => closeOverlay());

  // مودال تنظیمات
  els.settingsBtn.addEventListener('click', () => openOverlay(els.modal, els.settingsBtn));
  els.closeSettings.addEventListener('click', () => closeOverlay());

  // ترجمه خودکار
  els.autoToggle.checked = state.settings.auto;
  els.autoToggle.addEventListener('change', () => {
    state.settings.auto = els.autoToggle.checked;
    saveSettings();
    if (state.settings.auto) {
      if (hasSource() && !state.loading) scheduleAuto();
    } else {
      cancelDebounce();
      if (hasSource() && !state.loading) setStatus('edited');
    }
  });

  onExternalChange(KEYS.SETTINGS, (raw) => {
    let parsed = null;
    try {
      parsed = raw === null ? null : JSON.parse(raw);
    } catch {
      parsed = null;
    }
    const auto = parsed && typeof parsed.auto === 'boolean' ? parsed.auto : true;
    if (auto !== state.settings.auto) {
      state.settings.auto = auto;
      els.autoToggle.checked = auto;
      if (!auto) cancelDebounce();
      else if (hasSource() && !state.loading) scheduleAuto();
    }
  });

  // وقتی تب دیگری تاریخچه را عوض کرد
  onExternalChange(KEYS.HISTORY, () => {
    History.reload();
  });
}

/* ---------- راه‌اندازی ---------- */

function cacheElements() {
  els = {
    source: $('#sourceText'),
    sourceCount: $('#sourceCount'),
    targetCount: $('#targetCount'),
    translate: $('#translateBtn'),
    clear: $('#clearBtn'),
    swap: $('#swapBtn'),
    copy: $('#copyBtn'),
    replace: $('#replaceBtn'),
    retry: $('#retryBtn'),
    srcListen: $('#sourceListenBtn'),
    tgtListen: $('#targetListenBtn'),
    historyBtn: $('#historyBtn'),
    settingsBtn: $('#settingsBtn'),
    drawer: $('#historyDrawer'),
    closeHistory: $('#closeHistory'),
    modal: $('#settingsModal'),
    closeSettings: $('#closeSettings'),
    autoToggle: $('#autoToggle'),
    installRow: $('#installRow'),
    installBtn: $('#installBtn')
  };
}

function init() {
  cacheElements();
  if (!els.source) return;

  loadSettings();
  initOverlay();
  Theme.init();
  state.speechOK = Speech.init();

  if (!state.speechOK) {
    for (const btn of [els.srcListen, els.tgtListen]) {
      btn.disabled = true;
      btn.setAttribute('aria-label', 'پخش صدا در این مرورگر در دسترس نیست');
      btn.setAttribute('data-tooltip', 'پخش صدا در دسترس نیست');
    }
  }

  renderLangs(state.from, state.to);
  renderOutput('empty');
  setStatus('empty');
  updateCounts();

  History.init({ onRestore: onRestoreFromHistory });
  bindEvents();
  updateButtons();
  registerServiceWorker();
  bindInstallPrompt();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
