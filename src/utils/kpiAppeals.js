import { addBusinessDays } from './businessDays.js';

/** 이의 제기 처리 단계 — 정의서 v6: 팀장 1차 검토 → 본부장 2차 검토 */
export const APPEAL_STATUS = {
  RECEIVED: '접수',
  LEADER_REVIEW: '팀장 1차 검토',
  EXEC_REVIEW: '본부장 2차 검토',
  CLOSED: '종결',
};
export const APPEAL_STATUS_LIST = Object.values(APPEAL_STATUS);

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateKey(value) {
  if (!DATE_KEY_RE.test(value || '')) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** 저장된 appeals 배열을 안전하게 읽는다 (없거나 형식이 다르면 빈 배열) */
export function normalizeAppeals(appeals) {
  if (!Array.isArray(appeals)) return [];
  return appeals.filter((a) => a && typeof a === 'object' && a.id);
}

/**
 * 이의 접수 기록 생성. 접수일 형식이 틀리거나 내용이 비면 null.
 * @param {{ receivedAt: string, text: string }} input
 */
export function createAppeal({ receivedAt, text }, now = new Date()) {
  const body = String(text ?? '').trim();
  if (!isDateKey(receivedAt) || !body) return null;
  const ts = now.toISOString();
  return {
    id: `a-${now.getTime()}-${Math.random().toString(36).slice(2, 6)}`,
    receivedAt,
    text: body,
    status: APPEAL_STATUS.RECEIVED,
    reviewNote: '',
    createdAt: ts,
    updatedAt: ts,
  };
}

/** 상태·처리 메모·내용만 수정 가능 (접수일·id·생성 시각은 유지). 잘못된 상태 값은 무시 */
export function applyAppealPatch(appeal, patch, now = new Date()) {
  const next = { ...appeal };
  if (patch.status !== undefined && APPEAL_STATUS_LIST.includes(patch.status)) next.status = patch.status;
  if (patch.reviewNote !== undefined) next.reviewNote = String(patch.reviewNote ?? '');
  if (patch.text !== undefined && String(patch.text).trim()) next.text = String(patch.text).trim();
  next.updatedAt = now.toISOString();
  return next;
}

/**
 * 접수일의 기한 적합성.
 * 'no-notice': 통보일 미기록 / 'before-notice': 통보 전 접수 / 'in-time': 기한 내 / 'late': 기한 경과 후 접수
 */
export function appealTimeliness(receivedAt, noticedAt) {
  if (!isDateKey(noticedAt) || !isDateKey(receivedAt)) return 'no-notice';
  if (receivedAt < noticedAt) return 'before-notice';
  const { date } = addBusinessDays(noticedAt, 5);
  return receivedAt <= date ? 'in-time' : 'late';
}

export function openAppealCount(appeals) {
  return normalizeAppeals(appeals).filter((a) => a.status !== APPEAL_STATUS.CLOSED).length;
}
