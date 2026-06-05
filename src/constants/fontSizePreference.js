/** TMS 글자 크기 — localStorage + html font-size 배율 */

export const FONT_SIZE_STORAGE_KEY = 'tms-font-size-v1';

export const FONT_SIZE_OPTIONS = [
  { id: 'small', label: '작게', scale: 0.882 },
  { id: 'medium', label: '보통', scale: 1 },
  { id: 'large', label: '크게', scale: 1.118 },
  { id: 'xlarge', label: '매우 크게', scale: 1.235 },
];

const DEFAULT_ID = 'medium';

export function getFontSizeOption(id) {
  return FONT_SIZE_OPTIONS.find((o) => o.id === id) || FONT_SIZE_OPTIONS.find((o) => o.id === DEFAULT_ID);
}

export function getStoredFontSizeId() {
  try {
    const raw = localStorage.getItem(FONT_SIZE_STORAGE_KEY);
    if (raw && FONT_SIZE_OPTIONS.some((o) => o.id === raw)) return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_ID;
}

export function applyFontSizePreference(id = getStoredFontSizeId()) {
  const opt = getFontSizeOption(id);
  const scale = opt.scale;
  document.documentElement.style.setProperty('--tms-font-scale', String(scale));
  document.documentElement.dataset.tmsFontSize = opt.id;
  try {
    localStorage.setItem(FONT_SIZE_STORAGE_KEY, opt.id);
  } catch {
    /* ignore */
  }
  return opt;
}

/** 앱 부트 시 1회 (main.jsx) */
export function initFontSizePreference() {
  applyFontSizePreference(getStoredFontSizeId());
}
