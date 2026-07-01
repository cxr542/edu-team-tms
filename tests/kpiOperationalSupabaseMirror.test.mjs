import { describe, expect, it, vi } from 'vitest';

async function loadModule({ monthlyResult, rowResult } = {}) {
  vi.resetModules();
  const saveKpiMonthlyApprovalToSupabase = vi.fn().mockResolvedValue(
    monthlyResult ?? { ok: true, status: 'ok', message: 'saved' }
  );
  const saveKpi2RowApprovalToSupabase = vi.fn().mockResolvedValue(
    rowResult ?? { ok: true, status: 'ok', message: 'saved' }
  );
  vi.doMock('../src/utils/kpiOperationalSupabase.js', () => ({
    saveKpiMonthlyApprovalToSupabase,
    saveKpi2RowApprovalToSupabase,
  }));
  const mod = await import('../src/utils/kpiOperationalSupabaseMirror.js');
  return { mod, saveKpiMonthlyApprovalToSupabase, saveKpi2RowApprovalToSupabase };
}

describe('kpiOperationalSupabaseMirror', () => {
  it('forwards KPI1 status changes to the monthly approval upsert helper', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { mod, saveKpiMonthlyApprovalToSupabase } = await loadModule();

    await mod.mirrorKpiMonthlyApprovalToSupabase({
      year: 2026,
      monthIndex: 5,
      memberCode: ' B ',
      monthly01: { status: '제출', submittedAt: '2026-06-20T10:00:00.000Z' },
      updatedAt: '2026-06-20T11:00:00.000Z',
    });

    expect(saveKpiMonthlyApprovalToSupabase).toHaveBeenCalledWith({
      memberCode: ' B ',
      yearMonth: '2026-06',
      monthly01: { status: '제출', submittedAt: '2026-06-20T10:00:00.000Z' },
      updatedAt: '2026-06-20T11:00:00.000Z',
    });
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('forwards KPI2 status changes to the row approval upsert helper', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { mod, saveKpi2RowApprovalToSupabase } = await loadModule();

    await mod.mirrorKpi2RowApprovalToSupabase({
      memberCode: 'B',
      dayKey: '2026-06-16',
      taskId: 't1',
      kpi2RowStatus: {
        status: '승인',
        approvedAt: '2026-06-21T10:00:00.000Z',
        approver: '팀장',
      },
      updatedAt: '2026-06-21T11:00:00.000Z',
    });

    expect(saveKpi2RowApprovalToSupabase).toHaveBeenCalledWith({
      memberCode: 'B',
      dayKey: '2026-06-16',
      taskId: 't1',
      kpi2RowStatus: {
        status: '승인',
        approvedAt: '2026-06-21T10:00:00.000Z',
        approver: '팀장',
      },
      updatedAt: '2026-06-21T11:00:00.000Z',
    });
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('warns but does not throw when the Supabase mirror reports an error', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { mod } = await loadModule({
      monthlyResult: { ok: false, status: 'error', message: 'upsert failed' },
    });

    await expect(
      mod.mirrorKpiMonthlyApprovalToSupabase({
        year: 2026,
        monthIndex: 5,
        memberCode: 'B',
        monthly01: { status: '제출' },
        updatedAt: '2026-06-20T11:00:00.000Z',
      }),
    ).resolves.toMatchObject({ ok: false, status: 'error' });

    expect(warn).toHaveBeenCalledWith(
      '[kpiOperational] KPI1 monthly approval Supabase mirror failed: upsert failed'
    );
    warn.mockRestore();
  });
});
