import { afterEach, describe, expect, it, vi } from 'vitest';

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

    // Test legacy empty requester_code resolution from displayName
    expect(
      normalizeCsrRequest({
        id: 'legacy-1',
        title: '신혜윤 개선',
        requester: '신혜윤',
        requester_code: '',
      })
    ).toMatchObject({
      id: 'legacy-1',
      requesterCode: 'C',
    });

    // Test adminComment camelCase fallback
    expect(
      normalizeCsrRequest({
        id: 'comment-1',
        title: '답변 테스트',
        requester: '김윤형',
        requester_code: 'A',
        adminComment: '카멜케이스 답변',
      })
    ).toMatchObject({
      id: 'comment-1',
      adminComment: '카멜케이스 답변',
    });
  });

  describe('writes go through /api/csr-requests', () => {
    const serverRow = {
      id: '11111111-1111-4111-8111-111111111111',
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
    };
    const respond = (status, body) => ({ ok: status < 400, status, json: async () => body });
    const stubFetch = (response) => {
      const fn = vi.fn(async () => response);
      vi.stubGlobal('fetch', fn);
      return fn;
    };
    const client = { from: vi.fn(() => {
      throw new Error('anon client must not be used for writes');
    }) };

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('creates a request by POST with only the member-controlled fields', async () => {
      const fetchMock = stubFetch(respond(200, { ok: true, status: 'ok', data: serverRow }));
      const mod = await loadModule(client);

      const result = await mod.createCsrRequestInSupabase({
        id: 'client-id',
        title: 'KPI 저장 오류',
        description: '상태가 저장되지 않음',
        category: 'bug',
        status: 'done',
        requester: '다른이름',
        requesterCode: 'A',
        adminComment: 'hacked',
      });

      expect(client.from).not.toHaveBeenCalled();
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('/api/csr-requests');
      expect(init.method).toBe('POST');
      expect(init.credentials).toBe('same-origin');
      expect(JSON.parse(init.body)).toEqual({
        title: 'KPI 저장 오류',
        description: '상태가 저장되지 않음',
        category: 'bug',
        requesterCode: 'A',
      });
      expect(result).toMatchObject({
        ok: true,
        status: 'ok',
        data: { id: serverRow.id, requesterCode: 'A', status: 'received', categoryLabel: '버그' },
      });
    });

    it('updates status and comment by PATCH and sends nothing else', async () => {
      const fetchMock = stubFetch(
        respond(200, { ok: true, status: 'ok', data: { ...serverRow, status: 'done', adminComment: '완료' } })
      );
      const mod = await loadModule(client);

      const result = await mod.updateCsrRequestStatusInSupabase({
        request: { ...serverRow, title: '바꾸려는 제목', requester: '위조' },
        id: serverRow.id,
        status: 'done',
        adminComment: '완료',
      });

      const [, init] = fetchMock.mock.calls[0];
      expect(init.method).toBe('PATCH');
      expect(JSON.parse(init.body)).toEqual({ id: serverRow.id, status: 'done', adminComment: '완료' });
      expect(result).toMatchObject({ ok: true, data: { status: 'done', adminComment: '완료' } });
      expect(client.from).not.toHaveBeenCalled();
    });

    it('explains an expired admin session on PATCH 403', async () => {
      stubFetch(respond(403, { ok: false, status: 'forbidden', message: '관리자 화면에서만' }));
      const mod = await loadModule(client);

      const result = await mod.updateCsrRequestStatusInSupabase({ request: serverRow, status: 'done' });

      expect(result).toMatchObject({ ok: false, status: 'forbidden' });
      expect(result.message).toContain('다시 로그인');
    });

    it('shows the server message on POST 403 and survives network errors', async () => {
      stubFetch(respond(403, { ok: false, status: 'forbidden', message: '본인 화면에서만 요청을 등록할 수 있습니다.' }));
      let mod = await loadModule(client);
      const draft = { title: '제목', description: '', category: 'bug', requesterCode: 'A' };

      let result = await mod.createCsrRequestInSupabase(draft);
      expect(result).toMatchObject({
        ok: false,
        status: 'forbidden',
        message: '본인 화면에서만 요청을 등록할 수 있습니다.',
      });

      vi.stubGlobal('fetch', vi.fn(async () => {
        throw new Error('Failed to fetch');
      }));
      mod = await loadModule(client);
      result = await mod.createCsrRequestInSupabase(draft);
      expect(result).toMatchObject({ ok: false, status: 'error', message: 'Failed to fetch' });
    });

    it('does not call the server when Supabase is not configured', async () => {
      const fetchMock = stubFetch(respond(200, {}));
      vi.resetModules();
      vi.doMock('../src/utils/supabaseClient.js', () => ({
        getSupabaseClient: () => null,
        isSupabaseConfigured: false,
      }));
      const mod = await import('../src/utils/csrRequestsSupabase.js');

      const created = await mod.createCsrRequestInSupabase({ title: '제목', requesterCode: 'A' });
      const updated = await mod.updateCsrRequestStatusInSupabase({ request: serverRow, status: 'done' });

      expect(created.status).toBe('disabled');
      expect(updated.status).toBe('disabled');
      expect(fetchMock).not.toHaveBeenCalled();
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
