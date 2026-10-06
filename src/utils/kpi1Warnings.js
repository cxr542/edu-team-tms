const MM_TOLERANCE = 0.05;
const OVER_UTILIZATION_PCT = 100.05;

function differs(a, b) {
  return Math.abs((Number(a) || 0) - (Number(b) || 0)) > MM_TOLERANCE;
}

/**
 * KPI1 월 확정 경고 (표시 전용, 데이터는 바꾸지 않는다).
 * - drift: 월 확정 저장값(제출본)이 일지 기준 집계와 다름 (제출 후 일지·계산 로직이 바뀐 경우 등)
 * - over: 가동률 100% 초과
 * @param {{ kpi1?: object, kpi1Journal?: object }} row buildTeamMonthlyReport 의 구성원 행
 * @returns {{ code: 'drift'|'over', label: string, message: string }[]}
 */
export function detectKpi1Warnings(row) {
  const warnings = [];
  const stored = row?.kpi1;
  const journal = row?.kpi1Journal;
  if (!stored || !journal) return warnings;

  const drift =
    differs(stored.work, journal.work) ||
    differs(stored.improve, journal.improve) ||
    differs(stored.leave, journal.leave) ||
    differs(stored.available, journal.available);
  if (drift) {
    warnings.push({
      code: 'drift',
      label: '일지와 다름',
      message:
        '월 확정 값이 일지와 다릅니다. 「월 확정」 탭에서 「일지에서 가져오기」를 누르세요. ' +
        '(제출됨이면 먼저 「제출 취소 (철회)」 후 가져오기 → 재제출) ' +
        `저장값 업무 ${stored.work}·향상 ${stored.improve}·휴일 ${stored.leave}·가용 ${stored.available} / ` +
        `일지 업무 ${journal.work}·향상 ${journal.improve}·휴일 ${journal.leave}·가용 ${journal.available}`,
    });
  }

  if (Number(stored.utilization) > OVER_UTILIZATION_PCT) {
    warnings.push({
      code: 'over',
      label: '100% 초과',
      message:
        '가동률이 100%를 넘습니다. 「월 확정」 탭에서 「일지에서 가져오기」로 값을 일지 기준으로 맞추세요.',
    });
  }
  return warnings;
}
