import { KPI_STATUS } from '../constants/kpiStatuses.js';
import { readKpi2RowStatus } from '../constants/kpiOperationalStore.js';
import { ymKey } from '../constants/kpiApprovalPolicy.js';

function toMillis(value) {
  const t = value ? Date.parse(value) : NaN;
  return Number.isFinite(t) ? t : NaN;
}

/**
 * 승인 대기 목록의 항목을 이 브라우저(팀장)의 저장 상태 기준으로 이미 승인·반려했는지.
 * 목록은 서버 기록을 읽는데, 서버 반영이 늦거나 실패하면 방금 처리한 항목이 계속 남아 보인다.
 * 로컬 처리 시각이 제출 시각 이후일 때만 "처리됨"으로 본다 (구성원이 반려 후 다시 제출한 경우는 다시 대기).
 * KPI3(월간 역량 팀장 확정)는 다루지 않는다.
 * @param {{ type: string, year?: number, monthIndex?: number, member?: { code: string }, dayKey?: string, taskId?: string, submittedAt?: string|null }} item
 */
export function isHandledLocally(item, kpiOperational) {
  if (!item || !kpiOperational) return false;
  const code = item.member?.code;
  let local = null;
  if (item.type === 'KPI1') {
    if (!Number.isInteger(item.year) || !Number.isInteger(item.monthIndex) || !code) return false;
    local = kpiOperational.months?.[ymKey(item.year, item.monthIndex)]?.[code]?.monthly01 ?? null;
  } else if (item.type === 'KPI2') {
    if (!code || !item.dayKey || !item.taskId) return false;
    local = readKpi2RowStatus(kpiOperational.kpi2RowStatus, code, item.dayKey, item.taskId).value ?? null;
  } else {
    return false;
  }
  if (!local) return false;
  if (local.status !== KPI_STATUS.APPROVED && local.status !== KPI_STATUS.REJECTED) return false;
  const decidedAt = toMillis(local.approvedAt);
  if (Number.isNaN(decidedAt)) return false;
  const submittedAt = toMillis(item.submittedAt);
  if (Number.isNaN(submittedAt)) return true;
  return decidedAt >= submittedAt;
}

/** 일괄 승인 대상: KPI1·KPI2 만. KPI3(월간 역량 팀장 확정)는 팀장이 직접 평가·확정해야 해서 제외 */
export function selectBulkApprovalTargets(items = []) {
  return items.filter((item) => item.type === 'KPI1' || item.type === 'KPI2');
}
