import { describe, expect, it } from 'vitest';
import { computeTeamKpi, computeMonthKpi1Totals } from '../src/utils/computeTeamKpi.js';
import { apply2026PublicHolidaysToDays } from '../src/utils/journalHoliday2026.js';
import { apply01cToMonthly01 } from '../src/utils/kpiMonthlyClose.js';

const SEP = 8; // monthIndex

function workDay() {
  return { holiday: false, mm: { work: 1, improve: 0, leave: 0 }, tasks: [] };
}

/**
 * 2026-09 시나리오 (최우성 실제 사례)
 * - 9월 평일 22일 (추석 9/24·9/25 = 휴일 2, 나머지 20일 = 업무)
 * - 9월 밖 날짜(8/31, 10/1, 10/2)에도 업무 1.0 입력
 * - 토요일 공휴일 9/26 이 휴일 1.0 레코드로 저장소에 존재 (apply2026PublicHolidaysToDays)
 */
function buildSeptemberDays() {
  const days = {};
  const addWeekdays = (y, m, from, to) => {
    for (let d = from; d <= to; d += 1) {
      const dt = new Date(y, m, d);
      if (dt.getDay() === 0 || dt.getDay() === 6) continue;
      const key = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days[key] = workDay();
    }
  };
  addWeekdays(2026, 7, 31, 31); // 8/31
  addWeekdays(2026, 8, 1, 30); // 9/1 ~ 9/30
  addWeekdays(2026, 9, 1, 2); // 10/1, 10/2
  return apply2026PublicHolidaysToDays(days);
}

describe('월 KPI1 집계 — 월 경계 (일지 화면과 동일 범위)', () => {
  const days = buildSeptemberDays();

  it('가용 M/M 은 해당 월 평일 수 (토요일 공휴일 제외)', () => {
    const t = computeMonthKpi1Totals(2026, SEP, days);
    expect(t.available).toBe(22);
  });

  it('업무·휴일 M/M 은 해당 월 날짜만 합산', () => {
    const t = computeMonthKpi1Totals(2026, SEP, days);
    expect(t.work).toBe(20);
    expect(t.leave).toBe(2);
    expect(t.total).toBe(22);
    expect(t.utilization).toBe(100);
  });

  it('01c 주차 합계(월 확정 제출에 쓰임)도 월 밖 날짜를 포함하지 않는다', () => {
    const m = computeTeamKpi({ year: 2026, monthIndex: SEP, days });
    expect(m.month01cTotals).toEqual({ work: 20, improve: 0, leave: 2 });
    expect(m.kpi1.available).toBe(22);
  });

  it('월 확정 제출 후에도 일지 기준과 같은 가동률(100%)', () => {
    const live = computeTeamKpi({ year: 2026, monthIndex: SEP, days });
    const patch = apply01cToMonthly01(live.month01cTotals, { status: 'submitted' }, live.kpi1.available);
    const submitted = computeTeamKpi({ year: 2026, monthIndex: SEP, days, monthly01: patch });
    expect(submitted.kpi1.utilization).toBe(100);
    expect(submitted.kpi1.total).toBe(22);
    expect(submitted.kpi1.available).toBe(22);
  });

  it('2026 3분기 가용 M/M — 일지 화면 값과 동일 (7월 23 · 8월 21 · 9월 22)', () => {
    // 일지 화면 「월 KPI1 집계」 실측값. 토요일 공휴일(8/15, 9/26)이 저장소에 있어도 가용에 더하지 않는다.
    const all = apply2026PublicHolidaysToDays({});
    expect(computeMonthKpi1Totals(2026, 6, all).available).toBe(23);
    expect(computeMonthKpi1Totals(2026, 7, all).available).toBe(21);
    expect(computeMonthKpi1Totals(2026, 8, all).available).toBe(22);
  });
});

describe('일지 기준 가용 — 월 확정 저장값과 분리', () => {
  it('저장값 available 이 옛 값(23)이어도 journalAvailable 은 일지 기준(22)', () => {
    const days = buildSeptemberDays();
    const stale = { work: 20.5, improve: 0, leave: 4.5, available: 23, status: '제출' };
    const m = computeTeamKpi({ year: 2026, monthIndex: SEP, days, monthly01: stale });
    expect(m.kpi1.available).toBe(23); // 화면 표시는 저장값 유지
    expect(m.journalAvailable).toBe(22);
    const patch = apply01cToMonthly01(m.month01cTotals, stale, m.journalAvailable);
    expect(patch.available).toBe(22);
    expect(patch.work).toBe(20);
  });
});
