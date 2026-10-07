import { describe, expect, it } from 'vitest';
import { defaultQuarterRecord, normalizeKpiOperationalStore } from '../src/constants/kpiOperationalStore.js';
import { buildTeamQuarterReport } from '../src/utils/kpiReportData.js';
import { kpi3ExecApprovalLabel } from '../src/utils/kpiExcelExport.js';

describe('분기 레코드 — 상위 승인 기록 필드', () => {
  it('기본 레코드: execApproval=null', () => {
    expect(defaultQuarterRecord('A').execApproval).toBeNull();
  });

  it('필드가 없는 기존 저장 레코드는 값 그대로, 새 필드만 null', () => {
    const old = { quarters: { '2026-2Q': { A: { memos: [], quarter: { level: 4.2, composite: 4.1, grade: 'A', locked: true } } } } };
    const n = normalizeKpiOperationalStore(old).quarters['2026-2Q'].A;
    expect(n.execApproval).toBeNull();
    expect(n.quarter.level).toBe(4.2);
    expect(n.quarter.grade).toBe('A');
    expect(n.quarter.locked).toBe(true);
  });

  it('기록이 있으면 정규화 후에도 보존', () => {
    const raw = { quarters: { '2026-4Q': { A: { quarter: { level: 4.3 }, execApproval: { approver: '홍', approvedAt: '2027-01-08', evidenceNote: '메일' } } } } };
    const n = normalizeKpiOperationalStore(raw).quarters['2026-4Q'].A;
    expect(n.execApproval).toEqual({ approver: '홍', approvedAt: '2027-01-08', evidenceNote: '메일' });
  });

  it('리포트 행에 execApproval 전달', () => {
    const kpiOperational = normalizeKpiOperationalStore({
      quarters: { '2026-4Q': { A: { quarter: { level: 4.3 }, execApproval: { approver: '홍', approvedAt: '2027-01-08' } } } },
    });
    const rows = buildTeamQuarterReport({ year: 2026, monthIndex: 9, kpiOperational });
    expect(rows.find((r) => r.member.code === 'A').execApproval.approver).toBe('홍');
    expect(rows.find((r) => r.member.code === 'B').execApproval).toBeNull();
  });

  it('엑셀 상위승인 열: 해당없음 / 미기록 / 기록', () => {
    expect(kpi3ExecApprovalLabel(3.67, null)).toBe('해당없음');
    expect(kpi3ExecApprovalLabel(4.2, null)).toBe('미기록');
    expect(kpi3ExecApprovalLabel(4.2, { approver: '홍', approvedAt: '2027-01-08' })).toBe('기록');
  });
});
