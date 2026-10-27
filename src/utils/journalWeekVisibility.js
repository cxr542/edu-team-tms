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

const JOURNAL_WEEK_COLLAPSE_SOURCE_KEY = 'tms-journal-week-collapse-source-v1';

function loadSourceMap() {
  try {
    const raw = localStorage.getItem(JOURNAL_WEEK_COLLAPSE_SOURCE_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

/** 접기 상태의 출처 기록: 'auto'(완료 주차 자동 숨김) | 'user'(직접 접기/펼치기) */
export function saveCollapseSource(year, monthIndex, source, memberCode = 'A') {
  try {
    const data = loadSourceMap();
    data[monthKey(year, monthIndex, memberCode)] = source;
    localStorage.setItem(JOURNAL_WEEK_COLLAPSE_SOURCE_KEY, JSON.stringify(data));
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * 완료 주차 자동 숨김이 접기 상태를 소유하는지 판단.
 * - 저장값 없음 → 자동 대상
 * - 출처가 'auto' → 데이터 변화(클라우드 동기화 등)에 맞춰 재계산
 * - 출처 기록이 없는 구버전 저장값은 자동 저장분일 수 있으므로, 비어 있거나 현재 완료 주차의
 *   부분집합이면 자동 대상 (완료되지 않은 주차를 접어 둔 경우만 사용자 설정으로 존중)
 */
export function isCollapseAutoManaged(year, monthIndex, memberCode = 'A', doneKeys = new Set()) {
  try {
    const key = monthKey(year, monthIndex, memberCode);
    const raw = localStorage.getItem(JOURNAL_WEEK_COLLAPSE_KEY);
    const saved = raw ? JSON.parse(raw)[key] : undefined;
    if (!Array.isArray(saved)) return true;
    const source = loadSourceMap()[key];
    if (source === 'auto') return true;
    if (source === 'user') return false;
    return saved.every((k) => doneKeys.has(k));
  } catch {
    return false;
  }
}
