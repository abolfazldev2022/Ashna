/*
 * «آشنا» — theme.js
 * روشن / تاریک / سیستم — با ذخیره در Local Storage
 */

import { KEYS, get, set, onExternalChange } from './storage.js';
import { setIcon } from './ui.js';

const MODES = ['system', 'light', 'dark'];
const LABELS = { system: 'سیستم', light: 'روشن', dark: 'تاریک' };
const META_COLORS = { light: '#F3F5FB', dark: '#0D1120' };

let mode = 'system';
let media = null;

function normalize(value) {
  return MODES.includes(value) ? value : 'system';
}

function resolvedDark() {
  if (mode === 'system') return Boolean(media && media.matches);
  return mode === 'dark';
}

export function currentMode() {
  return mode;
}

function apply() {
  const dark = resolvedDark();
  const root = document.documentElement;
  root.dataset.theme = dark ? 'dark' : 'light';
  root.dataset.themeMode = mode;

  const meta = document.getElementById('themeColorMeta');
  if (meta) meta.content = META_COLORS[dark ? 'dark' : 'light'];

  // دکمهٔ چرخاندن تم در هدر
  const btn = document.getElementById('themeBtn');
  const iconWrap = document.getElementById('themeBtnIcon');
  if (btn && iconWrap) {
    setIcon(iconWrap, mode === 'system' ? 'monitor' : mode === 'dark' ? 'moon' : 'sun');
    const label = `تم: ${LABELS[mode]}`;
    btn.setAttribute('data-tooltip', label);
    btn.setAttribute('aria-label', `${label} — کلیک برای تغییر`);
  }

  // گروه انتخاب در تنظیمات
  const map = { light: 'themeLightBtn', dark: 'themeDarkBtn', system: 'themeSystemBtn' };
  for (const key of Object.keys(map)) {
    const el = document.getElementById(map[key]);
    if (el) el.setAttribute('aria-pressed', String(key === mode));
  }
}

export function setMode(next) {
  mode = normalize(next);
  set(KEYS.THEME, mode);
  apply();
}

export function cycle() {
  // هر کلیک باید تغییر محسوسی بدهد؛ اگر گزینه‌ای هم‌جهتِ وضعیت فعلی است، رد می‌شود.
  const resolvedNow = resolvedDark() ? 'dark' : 'light';
  const start = MODES.indexOf(mode);
  for (let step = 1; step <= MODES.length; step++) {
    const candidate = MODES[(start + step) % MODES.length];
    const candidateDark =
      candidate === 'system' ? Boolean(media && media.matches) : candidate === 'dark';
    const candidateResolved = candidateDark ? 'dark' : 'light';
    if (candidateResolved !== resolvedNow || step === MODES.length) {
      setMode(candidate);
      return;
    }
  }
}

export function init() {
  mode = normalize(get(KEYS.THEME, 'system'));

  media = window.matchMedia('(prefers-color-scheme: dark)');
  const onSystemChange = () => {
    if (mode === 'system') apply();
  };
  if (typeof media.addEventListener === 'function') {
    media.addEventListener('change', onSystemChange);
  } else if (typeof media.addListener === 'function') {
    media.addListener(onSystemChange);
  }

  const themeBtn = document.getElementById('themeBtn');
  if (themeBtn) themeBtn.addEventListener('click', cycle);

  const segments = { themeLightBtn: 'light', themeDarkBtn: 'dark', themeSystemBtn: 'system' };
  for (const id of Object.keys(segments)) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', () => setMode(segments[id]));
  }

  // همگام‌سازی بین تب‌ها
  onExternalChange(KEYS.THEME, (raw) => {
    let value = 'system';
    try {
      value = normalize(raw === null ? 'system' : JSON.parse(raw));
    } catch {
      value = 'system';
    }
    if (value !== mode) {
      mode = value;
      apply();
    }
  });

  apply();
}
