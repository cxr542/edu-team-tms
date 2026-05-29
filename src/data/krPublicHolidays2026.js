/**
 * 2026년 대한민국 법정 공휴일 (평일·대체공휴일 중심, 일지 M/M용)
 * 출처: 관공서 공휴일 규정·2026년 달력 (노동절 5/1, 제헌절 7/17 포함)
 */
export const KR_PUBLIC_HOLIDAYS_2026 = [
  { date: '2026-01-01', name: '신정' },
  { date: '2026-02-16', name: '설날 연휴' },
  { date: '2026-02-17', name: '설날' },
  { date: '2026-02-18', name: '설날 연휴' },
  { date: '2026-03-01', name: '삼일절' },
  { date: '2026-03-02', name: '삼일절 대체공휴일' },
  { date: '2026-05-01', name: '노동절' },
  { date: '2026-05-05', name: '어린이날' },
  { date: '2026-05-24', name: '부처님오신날' },
  { date: '2026-05-25', name: '부처님오신날 대체공휴일' },
  { date: '2026-06-03', name: '지방선거일' },
  { date: '2026-06-06', name: '현충일' },
  { date: '2026-07-17', name: '제헌절' },
  { date: '2026-08-15', name: '광복절' },
  { date: '2026-08-17', name: '광복절 대체공휴일' },
  { date: '2026-09-24', name: '추석 연휴' },
  { date: '2026-09-25', name: '추석' },
  { date: '2026-09-26', name: '추석 연휴' },
  { date: '2026-10-03', name: '개천절' },
  { date: '2026-10-05', name: '개천절 대체공휴일' },
  { date: '2026-10-09', name: '한글날' },
  { date: '2026-12-25', name: '성탄절' },
];

/** 일지 UI(월~금)에 자주 쓰이는 평일 공휴일만 */
export const KR_PUBLIC_HOLIDAY_DATES_2026 = KR_PUBLIC_HOLIDAYS_2026.map((h) => h.date);

const DATE_SET = new Set(KR_PUBLIC_HOLIDAY_DATES_2026);

export function is2026PublicHoliday(dateKey) {
  return DATE_SET.has(dateKey);
}

export function get2026HolidayName(dateKey) {
  return KR_PUBLIC_HOLIDAYS_2026.find((h) => h.date === dateKey)?.name ?? null;
}
