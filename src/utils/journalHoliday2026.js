import { is2026PublicHoliday, KR_PUBLIC_HOLIDAY_DATES_2026 } from '../data/krPublicHolidays2026';
import { recalcDayMmFromHours } from './journalMm';

/** 공휴일 프리셋과 동일: 휴일 M/M 1.0 */
export function createPublicHolidayDay(existing) {
  return {
    holiday: true,
    mm: { work: 0, improve: 0, leave: 1 },
    tasks: existing?.tasks ? [...existing.tasks] : [],
  };
}

export function apply2026PublicHolidaysToDays(days) {
  if (!days || typeof days !== 'object') return days;
  const next = { ...days };
  KR_PUBLIC_HOLIDAY_DATES_2026.forEach((key) => {
    next[key] = createPublicHolidayDay(next[key]);
    recalcDayMmFromHours(next[key]);
  });
  return next;
}

export function defaultDayForKey(key) {
  if (is2026PublicHoliday(key)) {
    return createPublicHolidayDay();
  }
  return { holiday: false, mm: { work: 0, improve: 0, leave: 0 }, tasks: [] };
}

/** 저장값·미등록일 모두 2026 공휴일 규칙 반영 (렌더·M/M 집계용) */
export function resolveJournalDay(key, stored) {
  if (stored && is2026PublicHoliday(key)) {
    if (!stored.holiday || (Number(stored.mm?.leave) || 0) < 1) {
      return createPublicHolidayDay(stored);
    }
    return stored;
  }
  if (stored) return stored;
  return defaultDayForKey(key);
}
