import { KPI_STATUS, formatKpiStatusLabel } from './kpiStatuses.js';

/**
 * 승인 생략(구두 승인 간주) 정책.
 * 교육팀원이 3명뿐인 소규모 운영 기간에는 KPI1 월 확정·KPI2 효과 건·KPI3 분기 입력(다면·리더 자체·실전 적용)의
 * 승인을 구두 승인으로 간주한다. 저장된 데이터는 바꾸지 않고, 읽을 때 「제출 → 승인」으로 해석한다.
 * - 적용: fromYearMonth 이후 월(분기)의 입력분. 이전 월은 기존대로 승인 필요.
 * - 사후 반려는 가능하다 (반려하면 REJECTED/rejected 로 바뀌어 간주가 풀린다).
 * - 팀장 필수 평가(월간 역량 팀장 확정, 리더 평가 점수, 실전 적용 건별 인정, 분기 확정,
 *   Level 4 이상 본부장/CEO 승인 기록)는 이 정책의 대상이 아니다.
 * 다시 승인을 받으려면 enabled 를 false 로 바꾼다.
 */
export const KPI_APPROVAL_WAIVER = {
  enabled: true,
  fromYearMonth: '2026-07',
};

export const WAIVED_APPROVAL_LABEL = '승인(구두)';

const pad = (n) => String(n).padStart(2, '0');

/** year + monthIndex(0-based) → 'YYYY-MM' */
export function ymKey(year, monthIndex) {
  return `${year}-${pad(monthIndex + 1)}`;
}

/** 'YYYY-MM' 입력분이 승인 생략 대상인지 */
export function isApprovalWaivedForYm(ym, policy = KPI_APPROVAL_WAIVER) {
  if (!policy?.enabled) return false;
  if (!/^\d{4}-\d{2}$/.test(String(ym || ''))) return false;
  return String(ym) >= policy.fromYearMonth;
}

/** '2026-3Q' 분기가 승인 생략 대상인지 (분기 첫 달 기준) */
export function isApprovalWaivedForYq(yq, policy = KPI_APPROVAL_WAIVER) {
  const m = /^(\d{4})-([1-4])Q$/.exec(String(yq || ''));
  if (!m) return false;
  return isApprovalWaivedForYm(`${m[1]}-${pad((Number(m[2]) - 1) * 3 + 1)}`, policy);
}

/** KPI1·KPI2 상태가 「제출」인데 승인 생략 기간이라 승인으로 간주되는 경우 */
export function isDeemedApproved(status, ym, policy = KPI_APPROVAL_WAIVER) {
  return status === KPI_STATUS.SUBMITTED && isApprovalWaivedForYm(ym, policy);
}

/** 계산·집계용 유효 상태 (저장값은 그대로, 제출만 승인으로 해석) */
export function effectiveKpiStatus(status, ym, policy = KPI_APPROVAL_WAIVER) {
  return isDeemedApproved(status, ym, policy) ? KPI_STATUS.APPROVED : status;
}

/** 화면 표기용 상태 라벨 (간주 승인이면 「승인(구두)」) */
export function kpiStatusLabelFor(status, ym, policy = KPI_APPROVAL_WAIVER) {
  return isDeemedApproved(status, ym, policy) ? WAIVED_APPROVAL_LABEL : formatKpiStatusLabel(status);
}

/** KPI3 분기 입력(다면·리더 자체·실전)의 제출 상태 → 팀장 화면용 유효 상태 */
export function effectiveSubmissionStatus(submissionStatus, yq, policy = KPI_APPROVAL_WAIVER) {
  return submissionStatus === 'submitted' && isApprovalWaivedForYq(yq, policy) ? 'approved' : submissionStatus;
}

/**
 * 승인 대기 목록을 처리 대상과 승인 생략(사후 반려만 가능)으로 나눈다.
 * KPI1·KPI2 만 대상이다. KPI3(월간 역량 팀장 확정)는 팀장 필수 평가라 항상 처리 대상이다.
 * @param {{ type: string, year?: number, monthIndex?: number }[]} items
 */
export function splitWaivedApprovalItems(items = [], policy = KPI_APPROVAL_WAIVER) {
  const actionable = [];
  const waived = [];
  items.forEach((item) => {
    const isWaivable = item.type === 'KPI1' || item.type === 'KPI2';
    const hasPeriod = Number.isInteger(item.year) && Number.isInteger(item.monthIndex);
    if (isWaivable && hasPeriod && isApprovalWaivedForYm(ymKey(item.year, item.monthIndex), policy)) {
      waived.push(item);
    } else {
      actionable.push(item);
    }
  });
  return { actionable, waived };
}
