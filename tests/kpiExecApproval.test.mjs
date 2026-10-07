import { describe, expect, it } from 'vitest';
import {
  EXEC_APPROVAL_LEVEL_THRESHOLD,
  createExecApproval,
  execApprovalStatus,
  isExecApprovalRecorded,
  isExecApprovalRequired,
  normalizeExecApproval,
} from '../src/utils/kpiExecApproval.js';

describe('상위 승인(본부장/CEO) 기록 — Level 4 이상', () => {
  it('필요 여부: 개인 분기 레벨 4.0 이상', () => {
    expect(EXEC_APPROVAL_LEVEL_THRESHOLD).toBe(4);
    expect(isExecApprovalRequired(3.99)).toBe(false);
    expect(isExecApprovalRequired(4)).toBe(true);
    expect(isExecApprovalRequired(4.2)).toBe(true);
    expect(isExecApprovalRequired(5)).toBe(true);
    expect(isExecApprovalRequired(0)).toBe(false);
    expect(isExecApprovalRequired(undefined)).toBe(false);
    expect(isExecApprovalRequired('x')).toBe(false);
  });

  it('createExecApproval: 승인자·승인일 검증', () => {
    const ea = createExecApproval({ approver: ' 홍본부장 ', approvedAt: '2026-10-08', evidenceNote: ' 메일 회신 ' }, new Date('2026-10-08T01:00:00Z'));
    expect(ea).toEqual({ approver: '홍본부장', approvedAt: '2026-10-08', evidenceNote: '메일 회신', recordedAt: '2026-10-08T01:00:00.000Z' });
    expect(createExecApproval({ approver: '  ', approvedAt: '2026-10-08' })).toBeNull();
    expect(createExecApproval({ approver: '홍', approvedAt: '2026-13-40' })).toBeNull();
    expect(createExecApproval({ approver: '홍', approvedAt: '' })).toBeNull();
  });

  it('normalize / recorded', () => {
    expect(normalizeExecApproval(undefined)).toBeNull();
    expect(normalizeExecApproval({})).toBeNull();
    expect(normalizeExecApproval('x')).toBeNull();
    expect(isExecApprovalRecorded({ approver: '홍', approvedAt: '2026-10-08' })).toBe(true);
    expect(isExecApprovalRecorded({ approver: '홍', approvedAt: '' })).toBe(false);
    expect(isExecApprovalRecorded({ approver: '', approvedAt: '2026-10-08' })).toBe(false);
  });

  it('execApprovalStatus', () => {
    const ok = { approver: '홍', approvedAt: '2026-10-08' };
    expect(execApprovalStatus(3.67, null)).toBe('not-required');
    expect(execApprovalStatus(4.2, null)).toBe('missing');
    expect(execApprovalStatus(4.2, ok)).toBe('recorded');
    expect(execApprovalStatus(3.5, ok)).toBe('recorded'); // 기록이 있으면 레벨이 달라져도 기록됨으로 표시
    expect(execApprovalStatus(4.2, { approver: '홍', approvedAt: 'bad' })).toBe('missing');
  });
});
