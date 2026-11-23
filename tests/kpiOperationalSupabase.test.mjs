import { afterEach, describe, expect, it, vi } from 'vitest';
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

  describe('writes go through /api/kpi-approvals', () => {
    const respond = (status, body) => ({ ok: status < 400, status, json: async () => body });
    const stubFetch = (response) => {
      const fn = vi.fn(async () => response);
      vi.stubGlobal('fetch', fn);
      return fn;
    };
    const anonClient = {
      from: vi.fn(() => {
        throw new Error('anon client must not be used for writes');
      }),
    };

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('sends a KPI1 submission by POST with only the member-controlled fields', async () => {
      const fetchMock = stubFetch(respond(200, { ok: true, status: 'ok', data: { status: 'submitted' } }));
      const mod = await loadModuleWithClient(anonClient);

      const result = await mod.saveKpiMonthlyApprovalToSupabase({
        memberCode: ' B ',
        yearMonth: '2026-06',
        monthly01: {
          status: KPI_STATUS.SUBMITTED,
          submittedAt: '2026-06-20T10:00:00.000Z',
          approvedAt: '2020-01-01T00:00:00.000Z',
          approver: '해커',
          rejectReason: 'x',
          work: 12,
          improve: 3,
          leave: 0,
          available: 20,
          note: '메모',
        },
        updatedAt: '2026-06-20T10:00:00.000Z',
      });

      expect(result).toMatchObject({ ok: true, status: 'ok' });
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('/api/kpi-approvals');
      expect(init.method).toBe('POST');
      expect(init.credentials).toBe('same-origin');
      expect(JSON.parse(init.body)).toEqual({
        kind: 'monthly',
        memberCode: 'B',
        yearMonth: '2026-06',
        record: { status: 'submitted', work: 12, improve: 3, leave: 0, available: 20, note: '메모' },
      });
      expect(anonClient.from).not.toHaveBeenCalled();
    });

    it('sends a withdrawal as POST with the draft status', async () => {
      const fetchMock = stubFetch(respond(200, { ok: true, status: 'ok', data: {} }));
      const mod = await loadModuleWithClient(anonClient);
      await mod.saveKpiMonthlyApprovalToSupabase({
        memberCode: 'B',
        yearMonth: '2026-06',
        monthly01: { status: KPI_STATUS.DRAFT, work: 1 },
      });
      const [, init] = fetchMock.mock.calls[0];
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body).record.status).toBe('draft');
    });

    it('sends KPI1 approval and rejection by PATCH', async () => {
      let fetchMock = stubFetch(respond(200, { ok: true, status: 'ok', data: {} }));
      let mod = await loadModuleWithClient(anonClient);
      await mod.saveKpiMonthlyApprovalToSupabase({
        memberCode: 'B',
        yearMonth: '2026-06',
        monthly01: { status: KPI_STATUS.APPROVED, approver: '팀장', approvedAt: '2026-06-21T10:00:00.000Z', work: 99 },
      });
      let [, init] = fetchMock.mock.calls[0];
      expect(init.method).toBe('PATCH');
      expect(JSON.parse(init.body)).toEqual({
        kind: 'monthly',
        memberCode: 'B',
        yearMonth: '2026-06',
        action: 'approve',
        approver: '팀장',
        reason: '',
      });

      fetchMock = stubFetch(respond(200, { ok: true, status: 'ok', data: {} }));
      mod = await loadModuleWithClient(anonClient);
      await mod.saveKpiMonthlyApprovalToSupabase({
        memberCode: 'B',
        yearMonth: '2026-06',
        monthly01: { status: KPI_STATUS.REJECTED, approver: '팀장', rejectReason: '수치 확인' },
      });
      [, init] = fetchMock.mock.calls[0];
      expect(JSON.parse(init.body)).toMatchObject({ action: 'reject', reason: '수치 확인' });
    });

    it('explains an expired admin session on a PATCH 403 and keeps the server message on 409', async () => {
      stubFetch(respond(403, { ok: false, status: 'forbidden', message: 'x' }));
      let mod = await loadModuleWithClient(anonClient);
      let result = await mod.saveKpiMonthlyApprovalToSupabase({
        memberCode: 'B',
        yearMonth: '2026-06',
        monthly01: { status: KPI_STATUS.APPROVED },
      });
      expect(result).toMatchObject({ ok: false, status: 'forbidden' });
      expect(result.message).toContain('다시 로그인');

      stubFetch(respond(409, { ok: false, status: 'conflict', message: '이미 승인된 항목은 변경할 수 없습니다.' }));
      mod = await loadModuleWithClient(anonClient);
      result = await mod.saveKpiMonthlyApprovalToSupabase({
        memberCode: 'B',
        yearMonth: '2026-06',
        monthly01: { status: KPI_STATUS.SUBMITTED },
      });
      expect(result).toMatchObject({ ok: false, status: 'conflict', message: '이미 승인된 항목은 변경할 수 없습니다.' });
    });

    it('survives network errors and skips the server when Supabase is not configured', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => {
        throw new Error('Failed to fetch');
      }));
      let mod = await loadModuleWithClient(anonClient);
      const input = { memberCode: 'B', yearMonth: '2026-06', monthly01: { status: KPI_STATUS.SUBMITTED } };
      await expect(mod.saveKpiMonthlyApprovalToSupabase(input)).resolves.toMatchObject({
        ok: false,
        status: 'error',
        message: 'Failed to fetch',
      });

      const fetchMock = stubFetch(respond(200, {}));
      vi.resetModules();
      vi.doMock('../src/utils/supabaseClient.js', () => ({ isSupabaseConfigured: false, getSupabaseClient: () => null }));
      mod = await import('../src/utils/kpiOperationalSupabase.js');
      await expect(mod.saveKpiMonthlyApprovalToSupabase(input)).resolves.toMatchObject({ status: 'disabled' });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('validates input before calling the server', async () => {
      const fetchMock = stubFetch(respond(200, {}));
      const mod = await loadModuleWithClient(anonClient);
      for (const input of [
        { memberCode: '', yearMonth: '2026-06', monthly01: {} },
        { memberCode: 'B', yearMonth: '2026-13', monthly01: {} },
        { memberCode: 'B', yearMonth: '2026-06', monthly01: null },
      ]) {
        expect((await mod.saveKpiMonthlyApprovalToSupabase(input)).ok).toBe(false);
      }
      for (const input of [
        { memberCode: 'B', dayKey: '', taskId: 't1', kpi2RowStatus: {} },
        { memberCode: 'B', dayKey: '2026-06-16', taskId: '', kpi2RowStatus: {} },
        { memberCode: 'B', dayKey: '2026-06-16', taskId: 't1', kpi2RowStatus: null },
      ]) {
        expect((await mod.saveKpi2RowApprovalToSupabase(input)).ok).toBe(false);
      }
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('sends KPI2 submission by POST and approval by PATCH', async () => {
      let fetchMock = stubFetch(respond(200, { ok: true, status: 'ok', data: {} }));
      let mod = await loadModuleWithClient(anonClient);
      await mod.saveKpi2RowApprovalToSupabase({
        memberCode: 'B',
        dayKey: '2026-06-16',
        taskId: 't1',
        kpi2RowStatus: { status: KPI_STATUS.SUBMITTED, approver: '해커' },
      });
      let [, init] = fetchMock.mock.calls[0];
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body)).toEqual({
        kind: 'kpi2',
        memberCode: 'B',
        dayKey: '2026-06-16',
        taskId: 't1',
        record: { status: 'submitted' },
      });

      fetchMock = stubFetch(respond(200, { ok: true, status: 'ok', data: {} }));
      mod = await loadModuleWithClient(anonClient);
      await mod.saveKpi2RowApprovalToSupabase({
        memberCode: 'B',
        dayKey: '2026-06-16',
        taskId: 't1',
        kpi2RowStatus: { status: KPI_STATUS.APPROVED, approver: '팀장' },
      });
      [, init] = fetchMock.mock.calls[0];
      expect(init.method).toBe('PATCH');
      expect(JSON.parse(init.body)).toMatchObject({ kind: 'kpi2', dayKey: '2026-06-16', taskId: 't1', action: 'approve' });
    });
  });

  it('loads a KPI1 monthly approval row from Supabase', async () => {
    const row = {
      member_code: 'B',
      year_month: '2026-06',
      status: 'approved',
      submitted_at: '2026-06-20T10:00:00.000Z',
      approved_at: '2026-06-21T10:00:00.000Z',
      approver: '팀장',
      reject_reason: null,
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
    expect(select).toHaveBeenCalledWith(
      'member_code, year_month, status, submitted_at, approved_at, approver, reject_reason, monthly01, payload_version, updated_at'
    );
    expect(query.eq).toHaveBeenCalledWith('member_code', 'B');
    expect(query.eq).toHaveBeenCalledWith('year_month', '2026-06');
    expect(query.maybeSingle).toHaveBeenCalledWith();
  });

  it('loads a KPI2 approval row from Supabase', async () => {
    const savedRow = {
      member_code: 'B',
      day_key: '2026-06-16',
      task_id: 't1',
      status: 'approved',
      kpi2_row_status: { status: KPI_STATUS.APPROVED, approver: '팀장' },
      payload_version: 1,
    };
    const loadQuery = createChainableQuery({ data: savedRow, error: null });
    const loadSelect = vi.fn().mockReturnValue(loadQuery);
    const from = vi.fn().mockReturnValue({ select: loadSelect });
    const mod = await loadModuleWithClient({ from });

    await expect(mod.getKpi2RowApprovalFromSupabase('B', '2026-06-16', 't1')).resolves.toMatchObject({
      ok: true,
      status: 'ok',
    });

    expect(from).toHaveBeenCalledWith('kpi2_row_approvals');
    expect(loadSelect).toHaveBeenCalledWith(
      'member_code, day_key, task_id, status, submitted_at, approved_at, approver, reject_reason, kpi2_row_status, payload_version, updated_at'
    );
    expect(loadQuery.eq).toHaveBeenCalledWith('member_code', 'B');
    expect(loadQuery.eq).toHaveBeenCalledWith('day_key', '2026-06-16');
    expect(loadQuery.eq).toHaveBeenCalledWith('task_id', 't1');
    expect(loadQuery.maybeSingle).toHaveBeenCalledWith();
  });
});
