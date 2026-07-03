import { describe, expect, it, vi } from 'vitest';

function makeQuery(result) {
  const query = {
    order: vi.fn(() => query),
    eq: vi.fn(() => query),
    select: vi.fn(() => query),
    upsert: vi.fn(() => query),
    maybeSingle: vi.fn(async () => result),
    single: vi.fn(async () => result),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return query;
}

async function loadModule(client) {
  vi.resetModules();
  vi.doMock('../src/utils/supabaseClient.js', () => ({
    getSupabaseClient: () => client,
    isSupabaseConfigured: true,
  }));
  return import('../src/utils/csrRequestsSupabase.js');
}

describe('csrRequestsSupabase', () => {
  it('builds and normalizes CSR request payloads', async () => {
    const { buildCsrRequestDraft, normalizeCsrRequest } = await loadModule({});

    const draft = buildCsrRequestDraft({
      title: 'KPI 저장 오류',
      description: '상태가 저장되지 않음',
      category: 'bug',
      requester: '김윤형',
      requesterCode: 'A',
    });

    expect(draft.ok).toBe(true);
    expect(draft.data).toMatchObject({
      title: 'KPI 저장 오류',
      description: '상태가 저장되지 않음',
      category: 'bug',
      status: 'received',
      requester: '김윤형',
      requesterCode: 'A',
      adminComment: '',
      completedAt: null,
    });

    expect(
      normalizeCsrRequest({
        id: '1',
        title: '문의',
        description: '  답변 요청  ',
        category: 'question',
        status: 'inProgress',
        requester: '김윤형',
        requester_code: 'A',
        admin_comment: '확인 중',
        created_at: '2026-07-01T00:00:00.000Z',
        updated_at: '2026-07-02T00:00:00.000Z',
        completed_at: null,
      })
    ).toMatchObject({
      id: '1',
      description: '답변 요청',
      category: 'question',
      status: 'inProgress',
      requester: '김윤형',
      requesterCode: 'A',
      adminComment: '확인 중',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-02T00:00:00.000Z',
      completedAt: null,
      categoryLabel: '문의',
    });
  });

  it('upserts CSR requests to Supabase', async () => {
    const client = {
      from: vi.fn(() =>
        makeQuery({
          data: {
            id: 'csr-1',
            title: 'KPI 저장 오류',
            description: '상태가 저장되지 않음',
            category: 'bug',
            status: 'received',
            requester: '김윤형',
            requester_code: 'A',
            admin_comment: '',
            created_at: '2026-07-03T00:00:00.000Z',
            updated_at: '2026-07-03T00:00:00.000Z',
            completed_at: null,
          },
          error: null,
        })
      ),
    };
    const mod = await loadModule(client);

    const result = await mod.upsertCsrRequestToSupabase({
      id: 'csr-1',
      title: 'KPI 저장 오류',
      description: '상태가 저장되지 않음',
      category: 'bug',
      status: 'received',
      requester: '김윤형',
      requesterCode: 'A',
      adminComment: '',
      createdAt: '2026-07-03T00:00:00.000Z',
      updatedAt: '2026-07-03T00:00:00.000Z',
      completedAt: null,
    });

    expect(client.from).toHaveBeenCalledWith('csr_requests');
    expect(result).toMatchObject({
      ok: true,
      status: 'ok',
      data: {
        id: 'csr-1',
        requesterCode: 'A',
        status: 'received',
      },
    });
  });

  it('lists requester scoped CSR requests', async () => {
    const client = {
      from: vi.fn(() =>
        makeQuery({
          data: [
            {
              id: 'csr-1',
              title: '개선 요청',
              description: '',
              category: 'improvement',
              status: 'received',
              requester: '김윤형',
              requester_code: 'A',
              admin_comment: '',
              created_at: '2026-07-03T00:00:00.000Z',
              updated_at: '2026-07-03T00:00:00.000Z',
              completed_at: null,
            },
          ],
          error: null,
        })
      ),
    };
    const mod = await loadModule(client);
    const result = await mod.listCsrRequestsFromSupabase({ requesterCode: 'A' });

    expect(result).toMatchObject({
      ok: true,
      status: 'ok',
      data: [
        {
          id: 'csr-1',
          requesterCode: 'A',
        },
      ],
    });
  });
});
