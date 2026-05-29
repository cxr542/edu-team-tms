export const JOURNAL_WEEK_COLLAPSE_KEY = 'tms-journal-week-collapse-v1';

function monthKey(year, monthIndex) {
  return `${year}-${monthIndex}`;
}

export function loadCollapsedWeekKeys(year, monthIndex) {
  try {
    const raw = localStorage.getItem(JOURNAL_WEEK_COLLAPSE_KEY);
    if (!raw) return new Set();
    const data = JSON.parse(raw);
    const list = data[monthKey(year, monthIndex)];
    return new Set(Array.isArray(list) ? list : []);
  } catch {
    return new Set();
  }
}

export function saveCollapsedWeekKeys(year, monthIndex, keys) {
  try {
    const raw = localStorage.getItem(JOURNAL_WEEK_COLLAPSE_KEY);
    const data = raw ? JSON.parse(raw) : {};
    const next = [...keys];
    if (next.length === 0) delete data[monthKey(year, monthIndex)];
    else data[monthKey(year, monthIndex)] = next;
    localStorage.setItem(JOURNAL_WEEK_COLLAPSE_KEY, JSON.stringify(data));
  } catch {
    /* ignore quota / private mode */
  }
}
