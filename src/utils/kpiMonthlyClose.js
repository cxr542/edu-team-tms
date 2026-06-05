import { KPI_STATUS } from '../constants/kpiStatuses';
import { MM_VALIDATION_TOLERANCE } from '../constants/kpiRules';

function round4(n) {
  return Math.round(n * 10000) / 10000;
}

/** 01c 주차 합 → 월 E~G (P~R 검증용) */
export function sum01cTotals(rows01c) {
  return rows01c.reduce(
    (acc, row) => ({
      work: round4(acc.work + (Number(row.업무MM) || 0)),
      improve: round4(acc.improve + (Number(row.생산향상MM) || 0)),
      leave: round4(acc.leave + (Number(row.휴일MM) || 0)),
    }),
    { work: 0, improve: 0, leave: 0 }
  );
}

/** 승인 전인데 M/M이 모두 0에 가까우면 「월 확정 미입력」으로 간주 → 일지·01c 파생값 사용 */
export function isMonthly01ContentUnset(monthly01) {
  if (!monthly01) return true;
  if (monthly01.status === KPI_STATUS.APPROVED) return false;
  const sum =
    (Number(monthly01.work) || 0) + (Number(monthly01.improve) || 0) + (Number(monthly01.leave) || 0);
  return sum <= MM_VALIDATION_TOLERANCE;
}

export function validate01cVsMonthly(month01cTotals, monthly01) {
  const diffs = {
    work: round4(month01cTotals.work - (Number(monthly01.work) || 0)),
    improve: round4(month01cTotals.improve - (Number(monthly01.improve) || 0)),
    leave: round4(month01cTotals.leave - (Number(monthly01.leave) || 0)),
  };
  const ok =
    Math.abs(diffs.work) <= MM_VALIDATION_TOLERANCE &&
    Math.abs(diffs.improve) <= MM_VALIDATION_TOLERANCE &&
    Math.abs(diffs.leave) <= MM_VALIDATION_TOLERANCE;
  return { ok, diffs };
}

export function computeUtilization(monthly01) {
  const work = Number(monthly01.work) || 0;
  const improve = Number(monthly01.improve) || 0;
  const leave = Number(monthly01.leave) || 0;
  const available = Number(monthly01.available) || 0;
  const total = round4(work + improve + leave);
  if (available <= 0) return { total, utilization: null };
  return { total, utilization: round4((total / available) * 100) };
}

export function apply01cToMonthly01(month01cTotals, monthly01, availableOverride) {
  return {
    ...monthly01,
    work: month01cTotals.work,
    improve: month01cTotals.improve,
    leave: month01cTotals.leave,
    available:
      availableOverride != null && availableOverride !== ''
        ? Number(availableOverride)
        : monthly01.available,
  };
}
