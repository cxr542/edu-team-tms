import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadModule() {
  vi.resetModules();
  vi.doMock('../src/utils/supabaseClient.js', () => ({
    isSupabaseConfigured: true,
    getSupabaseClient: () => ({}),
  }));
  return import('../src/utils/kpiOperationalSupabase.js');
}

function stubFetch() {
  const fn = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true, status: 'ok', data: {} }) }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

// 화면의 상태(작성중·제출·승인·반려)가 서버로 어떻게 보내지는지: 제출·회수는 POST, 승인·반려는 PATCH.
// 상태 컬럼·시각 같은 실제 저장 값은 서버가 정하고, tests/kpiApprovalsApi.test.mjs 에서 검증한다.
const CASES = [
  ['작성중', 'POST', { status: 'draft' }],
  ['제출', 'POST', { status: 'submitted' }],
  ['승인', 'PATCH', { action: 'approve', approver: '팀장', reason: '' }],
  ['반려', 'PATCH', { action: 'reject', approver: '팀장', reason: '사유' }],
];

describe('kpiOperationalSupabase mapping', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each(CASES)('maps KPI1 monthly01 status %s to the server request', async (inputStatus, method, expected) => {
    const fetchMock = stubFetch();
    const mod = await loadModule();

    await mod.saveKpiMonthlyApprovalToSupabase({
      memberCode: 'B',
      yearMonth: '2026-06',
      monthly01: {
        status: inputStatus,
        submittedAt: '2026-06-20T10:00:00.000Z',
        approvedAt: '2026-06-21T10:00:00.000Z',
        approver: '팀장',
        rejectReason: expected.reason ?? '',
      },
    });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(init.method).toBe(method);
    expect(body).toMatchObject({ kind: 'monthly', memberCode: 'B', yearMonth: '2026-06' });
    if (method === 'POST') {
      expect(body.record).toEqual({ status: expected.status });
    } else {
      expect(body).toMatchObject(expected);
      expect(body).not.toHaveProperty('record');
    }
  });

  it.each(CASES)('maps KPI2 row status %s to the server request', async (inputStatus, method, expected) => {
    const fetchMock = stubFetch();
    const mod = await loadModule();

    await mod.saveKpi2RowApprovalToSupabase({
      memberCode: 'B',
      dayKey: '2026-06-16',
      taskId: 't1',
      kpi2RowStatus: {
        status: inputStatus,
        submittedAt: '2026-06-20T10:00:00.000Z',
        approvedAt: '2026-06-21T10:00:00.000Z',
        approver: '팀장',
        rejectReason: expected.reason ?? '',
      },
    });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(init.method).toBe(method);
    expect(body).toMatchObject({ kind: 'kpi2', memberCode: 'B', dayKey: '2026-06-16', taskId: 't1' });
    if (method === 'POST') {
      expect(body.record).toEqual({ status: expected.status });
    } else {
      expect(body).toMatchObject(expected);
    }
  });
});
