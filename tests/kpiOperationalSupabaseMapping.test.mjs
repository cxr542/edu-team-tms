import { describe, expect, it, vi } from 'vitest';

async function loadModuleWithClient(client) {
  vi.resetModules();
  vi.doMock('../src/utils/supabaseClient.js', () => ({
    isSupabaseConfigured: true,
    getSupabaseClient: () => client,
  }));
  return import('../src/utils/kpiOperationalSupabase.js');
}

describe('kpiOperationalSupabase mapping', () => {
  it.each([
    [
      '작성중',
      {
        status: 'draft',
        submittedAt: null,
        approvedAt: null,
        approver: null,
        rejectReason: null,
      },
    ],
    [
      '제출',
      {
        status: 'submitted',
        submittedAt: '2026-06-20T10:00:00.000Z',
        approvedAt: null,
        approver: null,
        rejectReason: null,
      },
    ],
    [
      '승인',
      {
        status: 'approved',
        submittedAt: '2026-06-20T10:00:00.000Z',
        approvedAt: '2026-06-21T10:00:00.000Z',
        approver: '팀장',
        rejectReason: null,
      },
    ],
    [
      '반려',
      {
        status: 'rejected',
        submittedAt: '2026-06-20T10:00:00.000Z',
        approvedAt: '2026-06-21T10:00:00.000Z',
        approver: '팀장',
        rejectReason: '사유',
      },
    ],
  ])('maps KPI1 monthly01 status %s to top-level Supabase fields', async (inputStatus, expectedFields) => {
    const single = vi.fn().mockResolvedValue({
      data: {
        member_code: 'B',
        year_month: '2026-06',
        ...expectedFields,
        monthly01: {
          status: inputStatus,
          submittedAt: expectedFields.submittedAt,
          approvedAt: expectedFields.approvedAt,
          approver: expectedFields.approver,
          rejectReason: expectedFields.rejectReason,
        },
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
      monthly01: {
        status: inputStatus,
        submittedAt: expectedFields.submittedAt,
        approvedAt: expectedFields.approvedAt,
        approver: expectedFields.approver,
        rejectReason: expectedFields.rejectReason,
      },
      updatedAt: '2026-06-20T10:00:00.000Z',
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: expectedFields.status,
        submitted_at: expectedFields.submittedAt,
        approved_at: expectedFields.approvedAt,
        approver: expectedFields.approver,
        reject_reason: expectedFields.rejectReason,
        monthly01: expect.objectContaining({
          status: inputStatus,
          submittedAt: expectedFields.submittedAt,
          approvedAt: expectedFields.approvedAt,
          approver: expectedFields.approver,
          rejectReason: expectedFields.rejectReason,
        }),
      }),
      { onConflict: 'member_code,year_month' },
    );
  });

  it.each([
    [
      '작성중',
      {
        status: 'draft',
        submittedAt: null,
        approvedAt: null,
        approver: null,
        rejectReason: null,
      },
    ],
    [
      '제출',
      {
        status: 'submitted',
        submittedAt: '2026-06-21T09:00:00.000Z',
        approvedAt: null,
        approver: null,
        rejectReason: null,
      },
    ],
    [
      '승인',
      {
        status: 'approved',
        submittedAt: '2026-06-21T09:00:00.000Z',
        approvedAt: '2026-06-21T10:00:00.000Z',
        approver: '팀장',
        rejectReason: null,
      },
    ],
    [
      '반려',
      {
        status: 'rejected',
        submittedAt: '2026-06-21T09:00:00.000Z',
        approvedAt: '2026-06-21T10:00:00.000Z',
        approver: '팀장',
        rejectReason: '사유',
      },
    ],
  ])('maps KPI2 row status %s to top-level Supabase fields', async (inputStatus, expectedFields) => {
    const single = vi.fn().mockResolvedValue({
      data: {
        member_code: 'B',
        day_key: '2026-06-16',
        task_id: 't1',
        ...expectedFields,
        kpi2_row_status: {
          status: inputStatus,
          submittedAt: expectedFields.submittedAt,
          approvedAt: expectedFields.approvedAt,
          approver: expectedFields.approver,
          rejectReason: expectedFields.rejectReason,
        },
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
      kpi2RowStatus: {
        status: inputStatus,
        submittedAt: expectedFields.submittedAt,
        approvedAt: expectedFields.approvedAt,
        approver: expectedFields.approver,
        rejectReason: expectedFields.rejectReason,
      },
      updatedAt: '2026-06-21T10:00:00.000Z',
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: expectedFields.status,
        submitted_at: expectedFields.submittedAt,
        approved_at: expectedFields.approvedAt,
        approver: expectedFields.approver,
        reject_reason: expectedFields.rejectReason,
        kpi2_row_status: expect.objectContaining({
          status: inputStatus,
          submittedAt: expectedFields.submittedAt,
          approvedAt: expectedFields.approvedAt,
          approver: expectedFields.approver,
          rejectReason: expectedFields.rejectReason,
        }),
      }),
      { onConflict: 'member_code,day_key,task_id' },
    );
  });
});
