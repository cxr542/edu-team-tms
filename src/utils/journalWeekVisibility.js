export const JOURNAL_WEEK_COLLAPSE_KEY = 'tms-journal-week-collapse-v2';

function monthKey(year, monthIndex, memberCode = 'A') {
  return `${year}-${monthIndex}-${memberCode}`;
}

export function loadCollapsedWeekKeys(year, monthIndex, memberCode = 'A') {
  try {
    const raw = localStorage.getItem(JOURNAL_WEEK_COLLAPSE_KEY);
    if (!raw) return new Set();
    const data = JSON.parse(raw);
    const list = data[monthKey(year, monthIndex, memberCode)];
    return new Set(Array.isArray(list) ? list : []);
  } catch {
    return new Set();
  }
}

export function saveCollapsedWeekKeys(year, monthIndex, keys, memberCode = 'A') {
  try {
    const raw = localStorage.getItem(JOURNAL_WEEK_COLLAPSE_KEY);
    const data = raw ? JSON.parse(raw) : {};
    const next = [...keys];
    const key = monthKey(year, monthIndex, memberCode);
    if (next.length === 0) delete data[key];
    else data[key] = next;
    localStorage.setItem(JOURNAL_WEEK_COLLAPSE_KEY, JSON.stringify(data));
  } catch {
    /* ignore quota / private mode */
  }
}
