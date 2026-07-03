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
    let query;
    const client = {
      from: vi.fn(() => {
        query = makeQuery({
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
        });
        return query;
      }),
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
    expect(query.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        requester: '김윤형',
        requester_code: 'A',
      }),
      { onConflict: 'id' }
    );
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
    let query;
    const client = {
      from: vi.fn(() => {
        query = makeQuery({
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
        });
        return query;
      }),
    };
    const mod = await loadModule(client);
    const result = await mod.listCsrRequestsFromSupabase({ requesterCode: 'A' });

    expect(query.eq).toHaveBeenCalledWith('requester_code', 'A');
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

  it('rejects CSR request drafts without a requester code', async () => {
    const { buildCsrRequestDraft } = await loadModule({});

    const draft = buildCsrRequestDraft({
      title: '권한 문의',
      description: '구성원 코드가 필요합니다.',
      category: 'question',
      requester: '신혜윤',
    });

    expect(draft).toMatchObject({
      ok: false,
      status: 'error',
      message: 'requesterCode is required.',
    });
  });
});
