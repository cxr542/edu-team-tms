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
    data[key] = next;
    localStorage.setItem(JOURNAL_WEEK_COLLAPSE_KEY, JSON.stringify(data));
  } catch {
    /* ignore quota / private mode */
  }
}

/** 사용자가 (자동 포함) 한 번이라도 접기 상태를 저장했는지 — 없으면 완료 주차 자동 숨김 대상 */
export function hasSavedCollapsedWeekKeys(year, monthIndex, memberCode = 'A') {
  try {
    const raw = localStorage.getItem(JOURNAL_WEEK_COLLAPSE_KEY);
    if (!raw) return false;
    return Array.isArray(JSON.parse(raw)[monthKey(year, monthIndex, memberCode)]);
  } catch {
    return true;
  }
}
