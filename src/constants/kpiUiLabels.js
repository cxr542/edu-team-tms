/**
 * TMS 화면용 KPI 명칭 (엑셀 시트 코드 01c·01·02 와 분리)
 *
 * | 엑셀·내부 | UI 추천 |
 * |----------|---------|
 * | 01c 시트 | 주간 M/M · 주간 메모 |
 * | 01 시트  | 월 확정 M/M |
 * | 02 시트  | 생산성 효과 건 |
 */

/** 일지 주차별로 합산한 M/M (구 「01c 합」) */
export const KPI_WEEKLY_MM_SUM_LABEL = '주간 M/M 합계';

/** 월마감 탭에서 확정·제출하는 M/M (구 「01」) */
export const KPI_MONTHLY_MM_LABEL = '월 확정 M/M';

export const KPI_UI = {
  weeklyMmSum: KPI_WEEKLY_MM_SUM_LABEL,
  monthlyMm: KPI_MONTHLY_MM_LABEL,
  /** 월마감: 일지 → 확정 칸 채우기 */
  pullWeeklyToMonthly: '일지에서 가져오기',
  pullWeeklyToMonthlyHint: '주간 M/M 합계와 가용 M/M을 월 확정 칸에 넣습니다.',
  /** 월 제출 */
  submitMonthly: '월 확정 제출',
  submitMonthlyHint: '제출 시 일지 주간 합계를 자동으로 반영합니다.',
  withdrawMonthly: '제출 취소 (철회)',
  withdrawMonthlyHint: '제출을 취소하고 M/M을 다시 수정합니다.',
  withdrawMonthlyDisabledHint: '「월 확정 제출」을 눌러 상태가 「제출됨」이 되면 사용할 수 있습니다.',
  clearMonthlyDraft: '가져오기 취소',
  clearMonthlyDraftHint: '일지에서 넣은 M/M만 비우고 작성 중으로 둡니다 (제출 전).',
  mismatchWarn: (diffs, availDiff = null) => {
    let s = `주간 M/M 합계와 ${KPI_MONTHLY_MM_LABEL}이 다릅니다 (업무 ${diffs.work}, 향상 ${diffs.improve}, 휴일 ${diffs.leave}`;
    if (availDiff != null && Math.abs(availDiff) > 0.01) {
      s += `, 가용 ${availDiff > 0 ? '+' : ''}${availDiff.toFixed(2)}`;
    }
    return `${s})`;
  },
  weeklyRefLine: (totals, available) =>
    `일지 기준 ${KPI_WEEKLY_MM_SUM_LABEL}: 업무 ${totals.work} · 향상 ${totals.improve} · 휴일 ${totals.leave} · 가용 ${available}`,
};
