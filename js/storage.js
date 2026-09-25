/*
 * «آشنا» — storage.js
 * لایهٔ امن دسترسی به Local Storage
 */

const PREFIX = 'ashna:';

export const KEYS = {
  THEME: PREFIX + 'theme',
  SETTINGS: PREFIX + 'settings',
  HISTORY: PREFIX + 'history'
};

export function get(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function set(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function remove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* بی‌خیال */
  }
}

export function isAvailable() {
  try {
    const probe = PREFIX + 'probe';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

/** وقتی تب دیگری همان کلید را عوض کرد، فراخوانی می‌شود. */
export function onExternalChange(key, callback) {
  window.addEventListener('storage', (event) => {
    if (event.key === key) callback(event.newValue);
  });
}
