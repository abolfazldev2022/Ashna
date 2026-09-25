/*
 * «آشنا» — speech.js
 * پخش صدا با SpeechSynthesis مرورگر
 * برای انگلیسی اولویت با لهجهٔ آمریکایی (en-US) است.
 */

import { setIcon, toast } from './ui.js';

let synth = null;
let supported = false;
let keepAlive = null;
let activeBtn = null;

export function isSupported() {
  return supported;
}

export function init() {
  if (typeof window === 'undefined' || typeof window.SpeechSynthesisUtterance === 'undefined') {
    supported = false;
    return false;
  }
  supported = 'speechSynthesis' in window;
  if (!supported) return false;

  synth = window.speechSynthesis;
  try {
    synth.getVoices(); // شروع بارگذاری صداها
    if (typeof synth.addEventListener === 'function') {
      synth.addEventListener('voiceschanged', () => {
        try { synth.getVoices(); } catch { /* بی‌خیال */ }
      });
    }
  } catch {
    /* بی‌خیال */
  }
  return true;
}

function allVoices() {
  try {
    return (synth && synth.getVoices()) || [];
  } catch {
    return [];
  }
}

/** انتخاب بهترین صدا: برای انگلیسی اول en-US (و گوگل) انتخاب می‌شود. */
function pickVoice(lang) {
  const list = allVoices();
  if (!list.length) return null;

  if (lang === 'fa') {
    const fa = list.filter((v) => /^fa/i.test(v.lang || ''));
    return fa.find((v) => /[-_]IR/i.test(v.lang)) || fa[0] || null;
  }

  const en = list.filter((v) => /^en/i.test(v.lang || ''));
  const us = en.filter((v) => /[-_]US/i.test(v.lang || ''));
  const googleUS = us.find((v) => /google/i.test(v.name || ''));
  return googleUS || us[0] || en[0] || null;
}

function rememberOriginal(btn) {
  if (!btn.dataset.origLabel) {
    btn.dataset.origLabel = btn.getAttribute('aria-label') || '';
  }
  if (!btn.dataset.origTip) {
    btn.dataset.origTip = btn.getAttribute('data-tooltip') || '';
  }
}

function setActive(btn) {
  if (!btn) return;
  rememberOriginal(btn);
  btn.classList.add('is-active');
  btn.setAttribute('aria-label', 'توقف پخش');
  btn.setAttribute('data-tooltip', 'توقف');
  const ico = btn.querySelector('.btn-ico');
  if (ico) setIcon(ico, 'stop');
}

function clearActive() {
  const btn = activeBtn;
  activeBtn = null;
  if (!btn) return;
  btn.classList.remove('is-active');
  if (btn.dataset.origLabel) btn.setAttribute('aria-label', btn.dataset.origLabel);
  if (btn.dataset.origTip) btn.setAttribute('data-tooltip', btn.dataset.origTip);
  const ico = btn.querySelector('.btn-ico');
  if (ico) setIcon(ico, 'speaker');
}

export function stop() {
  if (synth) {
    try { synth.cancel(); } catch { /* بی‌خیال */ }
  }
  if (keepAlive) {
    clearInterval(keepAlive);
    keepAlive = null;
  }
  clearActive();
}

/** پخش/توقف یک متن؛ اگر همین دکمه در حال پخش باشد، توقف می‌شود. */
export function toggle(text, lang, btn) {
  if (!supported) {
    toast('پخش صدا توی این مرورگر پشتیبانی نمی‌شه.', 'error');
    return false;
  }

  if (activeBtn === btn && synth.speaking) {
    stop();
    return false;
  }

  stop();

  const content = String(text || '').trim();
  if (!content) return false;

  const voice = pickVoice(lang);
  const available = allVoices();
  if (!voice && lang === 'fa' && available.length) {
    toast('روی این دستگاه صدای فارسی پیدا نشد.', 'error');
    return false;
  }

  let utter;
  try {
    utter = new SpeechSynthesisUtterance(content);
  } catch {
    toast('پخش صدا توی این مرورگر پشتیبانی نمی‌شه.', 'error');
    return false;
  }

  if (voice) utter.voice = voice;
  utter.lang = voice && voice.lang ? voice.lang : lang === 'fa' ? 'fa-IR' : 'en-US';
  utter.rate = 1;
  utter.pitch = 1;

  const btnRef = btn;
  activeBtn = btnRef;
  setActive(btnRef);

  utter.onend = () => {
    if (activeBtn === btnRef) stop();
  };
  utter.onerror = (event) => {
    const err = event && event.error;
    if (err === 'interrupted' || err === 'canceled') return;
    if (activeBtn === btnRef) stop();
    toast('پخش صدا انجام نشد. دوباره امتحان کن.', 'error');
  };

  // در برخی مرورگرها پخش متون بلند ناگهان قطع می‌شود؛ با یک نبض حل می‌شود.
  keepAlive = setInterval(() => {
    if (synth.speaking && !synth.paused) {
      try {
        synth.pause();
        synth.resume();
      } catch { /* بی‌خیال */ }
    }
  }, 9000);

  try {
    synth.speak(utter);
  } catch {
    stop();
    toast('پخش صدا انجام نشد. دوباره امتحان کن.', 'error');
    return false;
  }
  return true;
}
