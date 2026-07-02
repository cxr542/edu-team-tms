import { describe, expect, it, vi } from 'vitest';
import { KPI1_NAME, KPI2_NAME } from '../src/constants/kpiDisplayNames.js';
import { KPI_STATUS } from '../src/constants/kpiStatuses.js';
import { buildAdminKpiPendingApprovalItemsFromSupabaseRows } from '../src/utils/kpiApprovePendingApprovals.js';

const IMPROVE_PROJECTS = [{ id: 'p1', name: '프로젝트A' }];

function getMemberDaysForKpi2() {
  return {
    '2026-06-16': {
      holiday: false,
      mm: { work: 0.5, improve: 0, leave: 0 },
      tasks: [
        {
          id: 't1',
          title: '업무A',
          plan: 8,
          actual: 4,
          done: true,
          kpi2Effect: { enabled: true, projectId: 'p1', baselineHours: 8 },
        },
      ],
    },
  };
}

async function loadModuleWithSupabaseResult(result) {
  vi.resetModules();
  const listSubmittedKpiApprovalRowsFromSupabase = vi.fn().mockResolvedValue(result);
  vi.doMock('../src/utils/kpiOperationalSupabaseReads.js', () => ({
    listSubmittedKpiApprovalRowsFromSupabase,
  }));
  const mod = await import('../src/utils/kpiApprovePendingApprovals.js');
  return { mod, listSubmittedKpiApprovalRowsFromSupabase };
}

describe('kpiApprovePendingApprovals', () => {
  it('maps KPI1 Supabase rows to approval card items', () => {
    const items = buildAdminKpiPendingApprovalItemsFromSupabaseRows({
      year: 2026,
      monthIndex: 5,
      monthlyApprovals: [
        {
          member_code: 'A',
          year_month: '2026-06',
          status: 'submitted',
          submitted_at: '2026-06-20T10:00:00.000Z',
          monthly01: { status: KPI_STATUS.SUBMITTED, submittedAt: '2026-06-20T10:00:00.000Z' },
        },
      ],
      kpi2RowApprovals: [],
      getMemberDays: () => ({}),
      improveProjects: [],
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      type: 'KPI1',
      member: { code: 'A', displayName: '김윤형' },
      label: `김윤형 · 6월 ${KPI1_NAME} · 승인 요청`,
      submittedAt: '2026-06-20T10:00:00.000Z',
    });
  });

  it('maps KPI2 Supabase rows to approval card items', () => {
    const items = buildAdminKpiPendingApprovalItemsFromSupabaseRows({
      year: 2026,
      monthIndex: 5,
      monthlyApprovals: [],
      kpi2RowApprovals: [
        {
          member_code: 'B',
          day_key: '2026-06-16',
          task_id: 't1',
          status: 'submitted',
          submitted_at: '2026-06-21T09:00:00.000Z',
          kpi2_row_status: { status: KPI_STATUS.SUBMITTED, submittedAt: '2026-06-21T09:00:00.000Z' },
        },
      ],
      getMemberDays: getMemberDaysForKpi2,
      improveProjects: IMPROVE_PROJECTS,
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      type: 'KPI2',
      member: { code: 'B', displayName: '최우성' },
      dayKey: '2026-06-16',
      taskId: 't1',
      label: `최우성 · ${KPI2_NAME} · 업무A · 승인 요청`,
      submittedAt: '2026-06-21T09:00:00.000Z',
    });
    expect(items[0].row).toMatchObject({
      업무명: '업무A',
      상태: 'submitted',
      승인자: '',
      승인일: '',
    });
  });

  it('prefers Supabase rows over local fallback when Supabase succeeds', async () => {
    const fallbackPendingApprovals = vi.fn().mockReturnValue([
      {
        type: 'LOCAL',
        member: { code: 'C', displayName: '신혜윤' },
      },
    ]);
    const { mod, listSubmittedKpiApprovalRowsFromSupabase } = await loadModuleWithSupabaseResult({
      ok: true,
      status: 'ok',
      message: 'ok',
      data: {
        monthlyApprovals: [
          {
            member_code: 'A',
            year_month: '2026-06',
            status: 'submitted',
            submitted_at: '2026-06-20T10:00:00.000Z',
            monthly01: { status: KPI_STATUS.SUBMITTED, submittedAt: '2026-06-20T10:00:00.000Z' },
          },
        ],
        kpi2RowApprovals: [],
      },
    });

    const result = await mod.loadAdminKpiPendingApprovals({
      year: 2026,
      monthIndex: 5,
      getMemberDays: () => ({}),
      improveProjects: [],
      fallbackPendingApprovals,
    });

    expect(listSubmittedKpiApprovalRowsFromSupabase).toHaveBeenCalledWith({
      year: 2026,
      monthIndex: 5,
    });
    expect(fallbackPendingApprovals).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      source: 'supabase',
      status: 'ok',
    });
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({ type: 'KPI1', member: { code: 'A' } });
  });

  it('falls back to localStorage when Supabase is disabled', async () => {
    const fallbackPendingApprovals = vi.fn().mockReturnValue([
      {
        type: 'LOCAL',
        member: { code: 'C', displayName: '신혜윤' },
      },
    ]);
    const { mod } = await loadModuleWithSupabaseResult({
      ok: false,
      status: 'disabled',
      message: 'disabled',
    });

    const result = await mod.loadAdminKpiPendingApprovals({
      year: 2026,
      monthIndex: 5,
      getMemberDays: () => ({}),
      improveProjects: [],
      fallbackPendingApprovals,
    });

    expect(fallbackPendingApprovals).toHaveBeenCalledWith();
    expect(result).toMatchObject({
      source: 'localStorage',
      status: 'disabled',
    });
    expect(result.data).toEqual([
      {
        type: 'LOCAL',
        member: { code: 'C', displayName: '신혜윤' },
      },
    ]);
  });

  it('falls back to localStorage when Supabase errors', async () => {
    const fallbackPendingApprovals = vi.fn().mockReturnValue([]);
    const { mod } = await loadModuleWithSupabaseResult({
      ok: false,
      status: 'error',
      message: 'boom',
    });

    const result = await mod.loadAdminKpiPendingApprovals({
      year: 2026,
      monthIndex: 5,
      getMemberDays: () => ({}),
      improveProjects: [],
      fallbackPendingApprovals,
    });

    expect(fallbackPendingApprovals).toHaveBeenCalledWith();
    expect(result).toMatchObject({
      source: 'localStorage',
      status: 'error',
    });
    expect(result.data).toEqual([]);
  });
});
