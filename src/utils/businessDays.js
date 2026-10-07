import { KR_PUBLIC_HOLIDAYS_2026, is2026PublicHoliday } from '../data/krPublicHolidays2026.js';

/** 공휴일 데이터가 있는 연도 (현재 2026만) */
const HOLIDAY_YEARS = new Set(KR_PUBLIC_HOLIDAYS_2026.map((h) => h.date.slice(0, 4)));

const pad = (n) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' → UTC 자정 Date (시간대 영향 없음) */
function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toKey(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function addCalendarDays(key, n) {
  const d = parseKey(key);
  d.setUTCDate(d.getUTCDate() + n);
  return toKey(d);
}

export function hasHolidayData(year) {
  return HOLIDAY_YEARS.has(String(year));
}

/** 주말·공휴일이 아닌 날. 공휴일 데이터가 없는 연도는 주말만 제외한다. */
export function isBusinessDay(key) {
  const day = parseKey(key).getUTCDay();
  if (day === 0 || day === 6) return false;
  return !is2026PublicHoliday(key);
}

/**
 * startKey 다음 날부터 세어 n번째 영업일.
 * @returns {{ date: string, holidayDataComplete: boolean }}
 *   holidayDataComplete=false: 계산 범위에 공휴일 데이터가 없는 연도가 있어 주말만 제외한 추정값
 */
export function addBusinessDays(startKey, n) {
  let key = startKey;
  let counted = 0;
  let complete = hasHolidayData(startKey.slice(0, 4));
  while (counted < n) {
    key = addCalendarDays(key, 1);
    if (!hasHolidayData(key.slice(0, 4))) complete = false;
    if (isBusinessDay(key)) counted += 1;
  }
  return { date: key, holidayDataComplete: complete };
}

/** 분기 마지막 날 ('2026-3Q' → '2026-09-30'). 형식이 다르면 null */
export function quarterEndKey(yq) {
  const m = /^(\d{4})-([1-4])Q$/.exec(yq || '');
  if (!m) return null;
  const year = Number(m[1]);
  const endMonth = Number(m[2]) * 3; // 1-based
  const last = new Date(Date.UTC(year, endMonth, 0)).getUTCDate();
  return `${year}-${pad(endMonth)}-${pad(last)}`;
}

/**
 * 확정 통보 마감 — 정의서 v6: 분기 말로부터 5영업일 이내 (분기 말 다음 날부터 센다)
 * @returns {{ quarterEnd: string, deadline: string, holidayDataComplete: boolean } | null}
 */
export function quarterNoticeDeadline(yq, businessDays = 5) {
  const end = quarterEndKey(yq);
  if (!end) return null;
  const { date, holidayDataComplete } = addBusinessDays(end, businessDays);
  return { quarterEnd: end, deadline: date, holidayDataComplete };
}

/** 오늘 날짜 키 (로컬 시간 기준) */
export function todayKey(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** 두 날짜 키의 일수 차이 (to - from) */
export function diffCalendarDays(fromKey, toKeyStr) {
  return Math.round((parseKey(toKeyStr) - parseKey(fromKey)) / 86400000);
}

/**
 * 화면용 마감 상태.
 * @returns {{ deadline: string, remainingDays: number, state: 'before-end'|'open'|'today'|'overdue', holidayDataComplete: boolean } | null}
 */
export function noticeDeadlineStatus(yq, now = new Date()) {
  const info = quarterNoticeDeadline(yq);
  if (!info) return null;
  const today = todayKey(now);
  const remainingDays = diffCalendarDays(today, info.deadline);
  let state;
  if (today <= info.quarterEnd) state = 'before-end';
  else if (remainingDays > 0) state = 'open';
  else if (remainingDays === 0) state = 'today';
  else state = 'overdue';
  return { deadline: info.deadline, remainingDays, state, holidayDataComplete: info.holidayDataComplete };
}
