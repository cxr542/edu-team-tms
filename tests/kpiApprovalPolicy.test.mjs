import { describe, expect, it } from 'vitest';
import {
  KPI_APPROVAL_WAIVER,
  WAIVED_APPROVAL_LABEL,
  effectiveKpiStatus,
  effectiveSubmissionStatus,
  isApprovalWaivedForYm,
  isApprovalWaivedForYq,
  isDeemedApproved,
  kpiStatusLabelFor,
  splitWaivedApprovalItems,
  ymKey,
} from '../src/constants/kpiApprovalPolicy.js';
import { KPI_STATUS } from '../src/constants/kpiStatuses.js';

const off = { ...KPI_APPROVAL_WAIVER, enabled: false };

describe('승인 생략(구두 승인 간주) 정책', () => {
  it('기본값: 켜짐, 2026-07(3Q)부터', () => {
    expect(KPI_APPROVAL_WAIVER.enabled).toBe(true);
    expect(KPI_APPROVAL_WAIVER.fromYearMonth).toBe('2026-07');
  });

  it('월 판정: 2026-06 이전은 기존 승인, 2026-07 이후는 생략', () => {
    expect(isApprovalWaivedForYm('2026-06')).toBe(false);
    expect(isApprovalWaivedForYm('2026-07')).toBe(true);
    expect(isApprovalWaivedForYm('2026-12')).toBe(true);
    expect(isApprovalWaivedForYm('2027-01')).toBe(true);
    expect(isApprovalWaivedForYm('bad')).toBe(false);
    expect(isApprovalWaivedForYm('2026-07', off)).toBe(false);
    expect(ymKey(2026, 6)).toBe('2026-07');
  });

  it('분기 판정: 3Q부터', () => {
    expect(isApprovalWaivedForYq('2026-2Q')).toBe(false);
    expect(isApprovalWaivedForYq('2026-3Q')).toBe(true);
    expect(isApprovalWaivedForYq('2026-4Q')).toBe(true);
    expect(isApprovalWaivedForYq('2027-1Q')).toBe(true);
    expect(isApprovalWaivedForYq('x')).toBe(false);
    expect(isApprovalWaivedForYq('2026-3Q', off)).toBe(false);
  });

  it('제출만 승인으로 간주 — 작성중·반려·이미 승인은 그대로', () => {
    expect(isDeemedApproved(KPI_STATUS.SUBMITTED, '2026-07')).toBe(true);
    expect(effectiveKpiStatus(KPI_STATUS.SUBMITTED, '2026-09')).toBe(KPI_STATUS.APPROVED);
    expect(effectiveKpiStatus(KPI_STATUS.DRAFT, '2026-09')).toBe(KPI_STATUS.DRAFT);
    expect(effectiveKpiStatus(KPI_STATUS.REJECTED, '2026-09')).toBe(KPI_STATUS.REJECTED); // 사후 반려는 유지
    expect(effectiveKpiStatus(KPI_STATUS.APPROVED, '2026-09')).toBe(KPI_STATUS.APPROVED);
    expect(effectiveKpiStatus(KPI_STATUS.SUBMITTED, '2026-06')).toBe(KPI_STATUS.SUBMITTED); // 3Q 이전은 그대로
    expect(effectiveKpiStatus(KPI_STATUS.SUBMITTED, '2026-09', off)).toBe(KPI_STATUS.SUBMITTED);
  });

  it('표시 라벨', () => {
    expect(WAIVED_APPROVAL_LABEL).toBe('승인(구두)');
    expect(kpiStatusLabelFor(KPI_STATUS.SUBMITTED, '2026-08')).toBe('승인(구두)');
    expect(kpiStatusLabelFor(KPI_STATUS.SUBMITTED, '2026-06')).toBe('제출됨');
    expect(kpiStatusLabelFor(KPI_STATUS.APPROVED, '2026-08')).toBe('승인됨');
    expect(kpiStatusLabelFor(KPI_STATUS.REJECTED, '2026-08')).toBe('반려됨');
  });

  it('KPI3 분기 입력 제출 상태', () => {
    expect(effectiveSubmissionStatus('submitted', '2026-3Q')).toBe('approved');
    expect(effectiveSubmissionStatus('submitted', '2026-2Q')).toBe('submitted');
    expect(effectiveSubmissionStatus('rejected', '2026-3Q')).toBe('rejected');
    expect(effectiveSubmissionStatus('', '2026-3Q')).toBe('');
    expect(effectiveSubmissionStatus('approved', '2026-3Q')).toBe('approved');
  });

  it('승인 대기 목록 분리: KPI1·KPI2 의 생략 기간만 분리, KPI3(팀장 평가 확정)는 항상 처리 대상', () => {
    const items = [
      { type: 'KPI1', year: 2026, monthIndex: 6 }, // 7월
      { type: 'KPI2', year: 2026, monthIndex: 8 }, // 9월
      { type: 'KPI1', year: 2026, monthIndex: 5 }, // 6월 (3Q 이전)
      { type: 'KPI3', year: 2026, monthIndex: 7 }, // 월간 역량 팀장 확정
      { type: 'KPI1' }, // 기간 정보 없음 → 안전하게 처리 대상
    ];
    const { actionable, waived } = splitWaivedApprovalItems(items);
    expect(waived.map((i) => `${i.type}:${i.monthIndex}`)).toEqual(['KPI1:6', 'KPI2:8']);
    expect(actionable).toHaveLength(3);
    expect(splitWaivedApprovalItems(items, off).waived).toHaveLength(0);
  });
});
