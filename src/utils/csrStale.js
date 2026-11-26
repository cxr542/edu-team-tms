/**
 * 오래 처리 안 된 CSR 요청 점검 규칙 (읽기 전용).
 * CSR 에는 「닫힘」 상태가 없고 「완료」가 곧 끝난 상태다. 그래서 정리할 대상은 완료가 아니라
 * 접수·진행 중인 채로 CSR_STALE_DAYS 일 넘게 갱신되지 않은 요청이다.
 */
export const CSR_STALE_DAYS = 30;
export const CSR_STALE_MAX_ITEMS = 100;
export const CSR_STALE_STATUSES = ['received', 'inProgress'];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function csrStaleCutoffIso(now = new Date(), days = CSR_STALE_DAYS) {
  return new Date(now.getTime() - days * MS_PER_DAY).toISOString();
}

/** DB 행(snake_case)이 점검 대상인지: 접수·진행 중이고 마지막 갱신(없으면 등록)이 N일 전보다 오래됨 */
export function isStaleCsr(row, now = new Date(), days = CSR_STALE_DAYS) {
  if (!row || !CSR_STALE_STATUSES.includes(row.status)) return false;
  const touched = Date.parse(row.updated_at || row.created_at || '');
  if (!Number.isFinite(touched)) return false;
  return touched <= now.getTime() - days * MS_PER_DAY;
}
