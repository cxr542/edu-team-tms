import { isDateKey } from './kpiAppeals.js';

/** 정의서 v6: Level 4 이상은 수행 업무 결과 증빙 필수, 본부장/CEO 최종 승인 */
export const EXEC_APPROVAL_LEVEL_THRESHOLD = 4;

/** 개인 분기 레벨이 4.0 이상이면 상위 승인 필요 */
export function isExecApprovalRequired(level) {
  const n = Number(level);
  return Number.isFinite(n) && n >= EXEC_APPROVAL_LEVEL_THRESHOLD;
}

/** 저장된 값을 안전하게 읽는다 (없거나 형식이 다르면 null) */
export function normalizeExecApproval(value) {
  if (!value || typeof value !== 'object') return null;
  const approver = String(value.approver ?? '').trim();
  const approvedAt = String(value.approvedAt ?? '');
  if (!approver && !approvedAt) return null;
  return {
    approver,
    approvedAt,
    evidenceNote: String(value.evidenceNote ?? ''),
    recordedAt: value.recordedAt ?? null,
  };
}

/** 승인자와 승인일(날짜 형식)이 모두 있어야 "기록됨" */
export function isExecApprovalRecorded(value) {
  const ea = normalizeExecApproval(value);
  return Boolean(ea && ea.approver && isDateKey(ea.approvedAt));
}

/**
 * 상위 승인 기록 생성. 승인자가 비었거나 승인일 형식이 틀리면 null.
 * @param {{ approver: string, approvedAt: string, evidenceNote?: string }} input
 */
export function createExecApproval({ approver, approvedAt, evidenceNote = '' }, now = new Date()) {
  const name = String(approver ?? '').trim();
  if (!name || !isDateKey(approvedAt)) return null;
  return {
    approver: name,
    approvedAt,
    evidenceNote: String(evidenceNote ?? '').trim(),
    recordedAt: now.toISOString(),
  };
}

/**
 * 'not-required' | 'recorded' | 'missing'
 * (필요한데 기록이 없으면 missing — 분기 확정 시 경고 대상)
 */
export function execApprovalStatus(level, execApproval) {
  if (isExecApprovalRecorded(execApproval)) return 'recorded';
  return isExecApprovalRequired(level) ? 'missing' : 'not-required';
}
