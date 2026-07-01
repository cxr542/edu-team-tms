import { describe, expect, it, vi } from 'vitest';
import { KPI_STATUS } from '../src/constants/kpiStatuses.js';
import { createEmptyKpiOperationalStore } from '../src/constants/kpiOperationalStore.js';

async function loadModule() {
  vi.resetModules();
  return import('../src/utils/kpiOperationalSupabase.js');
}

async function loadModuleWithClient(client) {
  vi.resetModules();
  vi.doMock('../src/utils/supabaseClient.js', () => ({
    isSupabaseConfigured: true,
    getSupabaseClient: () => client,
  }));
  return import('../src/utils/kpiOperationalSupabase.js');
}

function createChainableQuery(result) {
  const query = {
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  query.eq.mockReturnValue(query);
  return query;
}

describe('kpiOperationalSupabase', () => {
  it('extracts and reapplies KPI1 and KPI2 approval rows', async () => {
    const mod = await loadModule();
    const store = createEmptyKpiOperationalStore();
    store.months['2026-06'] = {
      B: {
        monthly01: {
          status: KPI_STATUS.SUBMITTED,
          submittedAt: '2026-06-20T10:00:00.000Z',
        },
      },
    };
    store.kpi2RowStatus['B|2026-06-16|t1'] = {
      status: KPI_STATUS.APPROVED,
      approvedAt: '2026-06-21T10:00:00.000Z',
      approver: '팀장',
    };

    const rows = mod.extractKpiApprovalRowsFromStore(store);

    expect(rows.monthlyApprovals).toEqual([
      {
        member_code: 'B',
        year_month: '2026-06',
        status: 'submitted',
        monthly01: {
          status: KPI_STATUS.SUBMITTED,
          submittedAt: '2026-06-20T10:00:00.000Z',
        },
        payload_version: 1,
        updated_at: '2026-06-20T10:00:00.000Z',
      },
    ]);
    expect(rows.kpi2RowApprovals).toEqual([
      {
        member_code: 'B',
        day_key: '2026-06-16',
        task_id: 't1',
        status: 'approved',
        kpi2_row_status: {
          status: KPI_STATUS.APPROVED,
          approvedAt: '2026-06-21T10:00:00.000Z',
          approver: '팀장',
        },
        payload_version: 1,
        updated_at: '2026-06-21T10:00:00.000Z',
      },
    ]);

    const restored = mod.applyKpiApprovalRowsToStore(createEmptyKpiOperationalStore(), rows);

    expect(restored.months['2026-06'].B.monthly01.status).toBe(KPI_STATUS.SUBMITTED);
    expect(restored.months['2026-06'].B.monthly01.submittedAt).toBe('2026-06-20T10:00:00.000Z');
    expect(restored.kpi2RowStatus['B|2026-06-16|t1'].approver).toBe('팀장');
  });

  it('returns disabled when Supabase env vars are not configured', async () => {
    const mod = await loadModule();

    await expect(
      mod.saveKpiMonthlyApprovalToSupabase({
        memberCode: 'B',
        yearMonth: '2026-06',
        monthly01: { status: KPI_STATUS.SUBMITTED },
      }),
    ).resolves.toMatchObject({ ok: false, status: 'disabled' });

    await expect(mod.getKpi2RowApprovalFromSupabase('B', '2026-06-16', 't1')).resolves.toMatchObject({
      ok: false,
      status: 'disabled',
    });
  });

  it('saves a KPI1 monthly approval row with the expected conflict key', async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        member_code: 'B',
        year_month: '2026-06',
        status: 'submitted',
        monthly01: { status: KPI_STATUS.SUBMITTED },
        payload_version: 1,
        updated_at: '2026-06-20T10:00:00.000Z',
      },
      error: null,
    });
    const select = vi.fn().mockReturnValue({ single });
    const upsert = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ upsert });
    const mod = await loadModuleWithClient({ from });

    await expect(
      mod.saveKpiMonthlyApprovalToSupabase({
        memberCode: ' B ',
        yearMonth: '2026-06',
        monthly01: { status: KPI_STATUS.SUBMITTED },
        updatedAt: '2026-06-20T10:00:00.000Z',
      }),
    ).resolves.toMatchObject({ ok: true, status: 'ok' });

    expect(from).toHaveBeenCalledWith('kpi_monthly_approvals');
    expect(upsert).toHaveBeenCalledWith(
      {
        member_code: 'B',
        year_month: '2026-06',
        status: 'submitted',
        monthly01: { status: KPI_STATUS.SUBMITTED },
        payload_version: 1,
        updated_at: '2026-06-20T10:00:00.000Z',
      },
      { onConflict: 'member_code,year_month' },
    );
    expect(select).toHaveBeenCalledWith();
    expect(single).toHaveBeenCalledWith();
  });

  it('loads a KPI1 monthly approval row from Supabase', async () => {
    const row = {
      member_code: 'B',
      year_month: '2026-06',
      monthly01: { status: KPI_STATUS.APPROVED, approver: '팀장' },
      payload_version: 1,
      updated_at: '2026-06-21T10:00:00.000Z',
    };
    const query = createChainableQuery({ data: row, error: null });
    const select = vi.fn().mockReturnValue(query);
    const from = vi.fn().mockReturnValue({ select });
    const mod = await loadModuleWithClient({ from });

    await expect(mod.getKpiMonthlyApprovalFromSupabase(' B ', '2026-06')).resolves.toEqual({
      ok: true,
      status: 'ok',
      message: 'KPI approval row loaded from Supabase.',
      data: row,
    });

    expect(from).toHaveBeenCalledWith('kpi_monthly_approvals');
    expect(select).toHaveBeenCalledWith('member_code, year_month, status, monthly01, payload_version, updated_at');
    expect(query.eq).toHaveBeenCalledWith('member_code', 'B');
    expect(query.eq).toHaveBeenCalledWith('year_month', '2026-06');
    expect(query.maybeSingle).toHaveBeenCalledWith();
  });

  it.each([
    ['작성중', 'draft'],
    ['제출', 'submitted'],
    ['승인', 'approved'],
    ['반려', 'rejected'],
  ])('maps KPI1 monthly01 status %s to %s', async (inputStatus, expectedStatus) => {
    const single = vi.fn().mockResolvedValue({
      data: {
        member_code: 'B',
        year_month: '2026-06',
        status: expectedStatus,
        monthly01: { status: inputStatus, submittedAt: '2026-06-20T10:00:00.000Z' },
        payload_version: 1,
        updated_at: '2026-06-20T10:00:00.000Z',
      },
      error: null,
    });
    const select = vi.fn().mockReturnValue({ single });
    const upsert = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ upsert });
    const mod = await loadModuleWithClient({ from });

    await mod.saveKpiMonthlyApprovalToSupabase({
      memberCode: 'B',
      yearMonth: '2026-06',
      monthly01: { status: inputStatus, submittedAt: '2026-06-20T10:00:00.000Z' },
      updatedAt: '2026-06-20T10:00:00.000Z',
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: expectedStatus,
        monthly01: expect.objectContaining({ status: inputStatus }),
      }),
      { onConflict: 'member_code,year_month' },
    );
  });

  it('saves and loads a KPI2 approval row from Supabase', async () => {
    const savedRow = {
      member_code: 'B',
      day_key: '2026-06-16',
      task_id: 't1',
      status: 'approved',
      kpi2_row_status: { status: KPI_STATUS.APPROVED, approver: '팀장' },
      payload_version: 1,
      updated_at: '2026-06-21T10:00:00.000Z',
    };
    const single = vi.fn().mockResolvedValue({ data: savedRow, error: null });
    const query = createChainableQuery({ data: savedRow, error: null });
    const select = vi.fn().mockReturnValue({ single, ...query });
    const upsert = vi.fn().mockReturnValue({ select });
    const loadQuery = createChainableQuery({ data: savedRow, error: null });
    const loadSelect = vi.fn().mockReturnValue(loadQuery);
    const from = vi
      .fn()
      .mockReturnValueOnce({ upsert })
      .mockReturnValueOnce({ select: loadSelect });
    const mod = await loadModuleWithClient({ from });

    await expect(
      mod.saveKpi2RowApprovalToSupabase({
        memberCode: 'B',
        dayKey: '2026-06-16',
        taskId: 't1',
        kpi2RowStatus: { status: KPI_STATUS.APPROVED, approver: '팀장' },
        updatedAt: '2026-06-21T10:00:00.000Z',
      }),
    ).resolves.toMatchObject({ ok: true, status: 'ok' });

    await expect(mod.getKpi2RowApprovalFromSupabase('B', '2026-06-16', 't1')).resolves.toMatchObject({
      ok: true,
      status: 'ok',
    });

    expect(from).toHaveBeenNthCalledWith(1, 'kpi2_row_approvals');
    expect(from).toHaveBeenNthCalledWith(2, 'kpi2_row_approvals');
    expect(loadSelect).toHaveBeenCalledWith('member_code, day_key, task_id, status, kpi2_row_status, payload_version, updated_at');
    expect(loadQuery.eq).toHaveBeenCalledWith('member_code', 'B');
    expect(loadQuery.eq).toHaveBeenCalledWith('day_key', '2026-06-16');
    expect(loadQuery.eq).toHaveBeenCalledWith('task_id', 't1');
    expect(loadQuery.maybeSingle).toHaveBeenCalledWith();
  });

  it.each([
    ['작성중', 'draft'],
    ['제출', 'submitted'],
    ['승인', 'approved'],
    ['반려', 'rejected'],
  ])('maps KPI2 row status %s to %s', async (inputStatus, expectedStatus) => {
    const single = vi.fn().mockResolvedValue({
      data: {
        member_code: 'B',
        day_key: '2026-06-16',
        task_id: 't1',
        status: expectedStatus,
        kpi2_row_status: { status: inputStatus, approver: '팀장' },
        payload_version: 1,
        updated_at: '2026-06-21T10:00:00.000Z',
      },
      error: null,
    });
    const select = vi.fn().mockReturnValue({ single });
    const upsert = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ upsert });
    const mod = await loadModuleWithClient({ from });

    await mod.saveKpi2RowApprovalToSupabase({
      memberCode: 'B',
      dayKey: '2026-06-16',
      taskId: 't1',
      kpi2RowStatus: { status: inputStatus, approver: '팀장' },
      updatedAt: '2026-06-21T10:00:00.000Z',
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: expectedStatus,
        kpi2_row_status: expect.objectContaining({ status: inputStatus }),
      }),
      { onConflict: 'member_code,day_key,task_id' },
    );
  });
});
