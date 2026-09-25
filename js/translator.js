/*
 * «آشنا» — translator.js
 * منطق ترجمه: بدون وابستگی به DOM تا قابل آزمون باشد.
 *
 * زنجیرهٔ سرویس‌ها (بدون نیاز به API Key خصوصی، سازگار با GitHub Pages):
 *   1) سرویس ترجمه گوگل با POST   2) همان با GET   3) MyMemory برای متون کوتاه
 * خروجی انگلیسی با tl=en گرفته می‌شود که American English است.
 */

const GTX_URL = 'https://translate.googleapis.com/translate_a/single';
const MYMEMORY_URL = 'https://api.mymemory.translated.net/get';

const CHUNK_LIMIT = 1500;   // حداکثر طول هر تکهٔ ارسالی
const TIMEOUT_MS = 15000;   // مهلت هر درخواست

export const ERROR_MESSAGES = {
  offline: 'اینترنت وصل نیست. بعد از وصل شدن دوباره امتحان کن.',
  network: 'ترجمه انجام نشد. اتصال اینترنت یا سرویس ترجمه را بررسی کن.',
  timeout: 'سرویس ترجمه جواب نداد. چند ثانیه دیگه دوباره امتحان کن.',
  rate: 'چند لحظه صبر کن و بعد دوباره بفرست؛ الان درخواست‌ها زیاده.',
  service: 'ترجمه انجام نشد. اتصال اینترنت یا سرویس ترجمه را بررسی کن.',
  empty: 'متنی برای ترجمه نیست.'
};

export class TranslateError extends Error {
  constructor(code, cause) {
    const message = ERROR_MESSAGES[code] || ERROR_MESSAGES.service;
    super(message);
    this.name = 'TranslateError';
    this.code = code;
    this.userMessage = message;
    if (cause) this.cause = cause;
  }
}

function abortError() {
  return new DOMException('The request was aborted.', 'AbortError');
}

function isAbort(err) {
  return Boolean(err) && err.name === 'AbortError';
}

async function fetchWithTimeout(url, options, outerSignal) {
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, TIMEOUT_MS);

  const onOuterAbort = () => ctrl.abort();
  if (outerSignal) {
    if (outerSignal.aborted) {
      clearTimeout(timer);
      throw abortError();
    }
    outerSignal.addEventListener('abort', onOuterAbort, { once: true });
  }

  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } catch (err) {
    if (outerSignal && outerSignal.aborted) throw abortError();
    if (timedOut) throw new TranslateError('timeout', err);
    throw new TranslateError('network', err);
  } finally {
    clearTimeout(timer);
    if (outerSignal) outerSignal.removeEventListener('abort', onOuterAbort);
  }
}

/** پاسخ سرویس گوگل را به متن ترجمه تبدیل می‌کند. */
export function parseGoogleResponse(data) {
  if (!Array.isArray(data) || !Array.isArray(data[0])) {
    throw new TranslateError('service');
  }
  const text = data[0]
    .map((seg) => (Array.isArray(seg) && typeof seg[0] === 'string' ? seg[0] : ''))
    .join('');
  if (!text.trim()) throw new TranslateError('service');
  return text;
}

function checkStatus(res) {
  if (res.ok) return;
  if (res.status === 429 || res.status === 403) throw new TranslateError('rate');
  throw new TranslateError('service');
}

async function viaGooglePOST(chunk, from, to, signal) {
  const body = new URLSearchParams({
    client: 'gtx',
    sl: from,
    tl: to,
    dt: 't',
    q: chunk
  });
  const res = await fetchWithTimeout(
    GTX_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: body.toString()
    },
    signal
  );
  checkStatus(res);
  let data;
  try {
    data = await res.json();
  } catch (err) {
    throw new TranslateError('service', err);
  }
  return parseGoogleResponse(data);
}

async function viaGoogleGET(chunk, from, to, signal) {
  const url =
    `${GTX_URL}?client=gtx&sl=${encodeURIComponent(from)}` +
    `&tl=${encodeURIComponent(to)}&dt=t&q=${encodeURIComponent(chunk)}`;
  const res = await fetchWithTimeout(url, {}, signal);
  checkStatus(res);
  let data;
  try {
    data = await res.json();
  } catch (err) {
    throw new TranslateError('service', err);
  }
  return parseGoogleResponse(data);
}

async function viaMyMemory(chunk, from, to, signal) {
  const bytes = new TextEncoder().encode(chunk).length;
  if (bytes > 480) throw new TranslateError('service'); // محدودیت نسخهٔ رایگان
  const url =
    `${MYMEMORY_URL}?q=${encodeURIComponent(chunk)}` +
    `&langpair=${encodeURIComponent(`${from}|${to}`)}`;
  const res = await fetchWithTimeout(url, {}, signal);
  checkStatus(res);
  let data;
  try {
    data = await res.json();
  } catch (err) {
    throw new TranslateError('service', err);
  }
  const out = data && data.responseData && data.responseData.translatedText;
  if (
    typeof out !== 'string' ||
    !out.trim() ||
    /^MYMEMORY WARNING/i.test(out) ||
    /QUERY LENGTH LIMIT/i.test(out)
  ) {
    throw new TranslateError('service');
  }
  return out;
}

async function translateChunk(chunk, from, to, signal) {
  let firstError = null;

  try {
    return await viaGooglePOST(chunk, from, to, signal);
  } catch (err) {
    if (isAbort(err)) throw err;
    firstError = err;
    // فقط وقتی پاسخِ نامعتبر بود امتحان کن؛ خطای شبکه/مهلت/محدودیت را رد کن.
    if (err.code !== 'service') {
      try {
        return await viaMyMemory(chunk, from, to, signal);
      } catch (mmErr) {
        if (isAbort(mmErr)) throw mmErr;
      }
      throw firstError;
    }
  }

  try {
    return await viaGoogleGET(chunk, from, to, signal);
  } catch (err) {
    if (isAbort(err)) throw err;
    if (!firstError) firstError = err;
  }

  try {
    return await viaMyMemory(chunk, from, to, signal);
  } catch (err) {
    if (isAbort(err)) throw err;
  }

  throw firstError || new TranslateError('service');
}

/** جمله‌ها را جدا می‌کند تا ترجمه روان بماند و درخواست‌ها کوچک بمانند. */
function splitSentences(s) {
  const out = [];
  let start = 0;
  const enders = '.!?؟';
  const trailers = '"\'»”)]';
  for (let i = 0; i < s.length; i++) {
    if (enders.indexOf(s[i]) === -1) continue;
    let j = i + 1;
    while (j < s.length && trailers.indexOf(s[j]) !== -1) j++;
    if (j >= s.length || /\s/.test(s[j])) {
      out.push(s.slice(start, j));
      while (j < s.length && /\s/.test(s[j])) j++;
      start = j;
      i = j - 1;
    }
  }
  if (start < s.length) out.push(s.slice(start));
  return out.length ? out : [s];
}

/**
 * متن را به تکه‌های کوچک می‌شکند.
 * خروجی: آرایه‌ای از { text, sep } که sep پیشوند این تکه است ('\n' یا ' ' یا '').
 */
export function splitForTranslation(text, limit = CHUNK_LIMIT) {
  const pieces = [];
  const paragraphs = String(text).split('\n');

  paragraphs.forEach((para, pIdx) => {
    const paraSep = pIdx === 0 ? '' : '\n';
    if (para.trim() === '') {
      pieces.push({ text: '', sep: paraSep, raw: true });
      return;
    }
    const sentences = splitSentences(para);
    let buf = '';
    let firstInPara = true;

    const flush = () => {
      if (!buf) return;
      pieces.push({ text: buf, sep: firstInPara ? paraSep : ' ' });
      firstInPara = false;
      buf = '';
    };

    for (const s of sentences) {
      const candidate = buf ? `${buf} ${s}` : s;
      if (candidate.length > limit && buf) {
        flush();
        buf = s;
      } else if (s.length > limit) {
        flush();
        for (let i = 0; i < s.length; i += limit) {
          pieces.push({
            text: s.slice(i, i + limit),
            sep: firstInPara ? paraSep : ' '
          });
          firstInPara = false;
        }
      } else {
        buf = candidate;
      }
    }
    flush();
  });

  return pieces;
}

/**
 * ترجمهٔ متن از `from` به `to`.
 * لغو درخواست با `signal` (AbortController) انجام می‌شود.
 */
export async function translate(text, from, to, { signal } = {}) {
  const source = String(text || '').trim();
  if (!source) throw new TranslateError('empty');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new TranslateError('offline');
  }

  const pieces = splitForTranslation(source);
  let out = '';

  for (const piece of pieces) {
    if (signal && signal.aborted) throw abortError();
    if (piece.raw || !piece.text) {
      out += piece.sep;
      continue;
    }
    const translated = await translateChunk(piece.text, from, to, signal);
    out += piece.sep + translated;
  }

  return out.trim();
}
