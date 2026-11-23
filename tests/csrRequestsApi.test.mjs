import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from '../api/announcements.js';
import { createAdminSessionCookie } from '../server/api-utils/adminSession.js';
import { handleCsrRequests } from '../server/api-utils/csrRequests.js';
import { makeFakeSupabase } from './helpers/fakeSupabase.mjs';

// 연결 테스트가 진짜 클라이언트를 만들지 않게 한다(Node 20 CI 에는 WebSocket 이 없어 생성 단계에서 실패한다).
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({}) }));

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://edu-team-tms-ten.vercel.app';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_UNKNOWN = '99999999-9999-4999-8999-999999999999';

const adminCookie = () => createAdminSessionCookie().split(';')[0];
const admin = () => ({ referer: `${ORIGIN}/admin?module=csr`, cookie: adminCookie() });
const member = (slug) => ({ referer: `${ORIGIN}/${slug}?module=csr` });

function createRes() {
  return {
    statusCode: 200,
    headers: {},
    setHeader(k, v) {
      this.headers[k.toLowerCase()] = v;
    },
    end(body) {
      this.body = body ? JSON.parse(body) : null;
    },
  };
}

async function call(db, req) {
  const res = createRes();
  await handleCsrRequests({ headers: {}, ...req }, res, db);
  return res;
}

const draft = (over = {}) => ({
  title: '제목',
  description: '내용',
  category: 'bug',
  requesterCode: 'B',
  ...over,
});

const seedRow = (over = {}) => ({
  id: ID_A,
  title: '원래 제목',
  description: '원래 내용',
  category: 'bug',
  status: 'received',
  requester: '최우성',
  requester_code: 'B',
  admin_comment: '',
  completed_at: null,
  payload_version: 1,
  created_at: '2026-11-01T00:00:00.000Z',
  updated_at: '2026-11-01T00:00:00.000Z',
  ...over,
});

describe('CSR requests API', () => {
  beforeEach(() => {
    process.env.TMS_ADMIN_GATE_PASSWORD = 'secret-gate';
    process.env.TMS_ADMIN_SESSION_SECRET = 'session-secret';
  });

  describe('POST (등록)', () => {
    it('rejects requests without a matching member route or admin session — and never touches the DB', async () => {
      const db = makeFakeSupabase({ csr_requests: [] });
      const cases = [
        { headers: {} },
        { headers: { referer: 'https://evil.example/yhkim' }, body: draft({ requesterCode: 'A' }) },
        { headers: member('wschoi'), body: draft({ requesterCode: 'A' }) }, // 다른 구성원 주소
        { headers: member('yhkim'), body: draft({ requesterCode: 'Z' }) }, // 존재하지 않는 코드
        { headers: { referer: `${ORIGIN}/admin` }, body: draft() }, // 세션 없는 관리자 주소
        { headers: { referer: `${ORIGIN}/yhkim`, cookie: adminCookie() }, body: draft({ requesterCode: 'B' }) },
      ];
      for (const req of cases) {
        const res = await call(db, { method: 'POST', ...req });
        expect(res.statusCode).toBe(403);
        expect(res.body.status).toBe('forbidden');
      }
      expect(db.log).toEqual([]);
      expect(db.tables.csr_requests).toHaveLength(0);
    });

    it('lets a member register their own request and ignores every server-controlled field', async () => {
      const db = makeFakeSupabase({ csr_requests: [] });
      const res = await call(db, {
        method: 'POST',
        headers: member('wschoi'),
        body: draft({
          title: '  제목  ',
          id: 'attacker-id',
          status: 'done',
          adminComment: 'hacked',
          requester: '다른이름',
          completedAt: '2020-01-01T00:00:00.000Z',
          createdAt: '2020-01-01T00:00:00.000Z',
        }),
      });

      expect(res.statusCode).toBe(200);
      expect(res.body.ok).toBe(true);
      const { data } = res.body;
      expect(data.id).toMatch(UUID_RE);
      expect(data.id).not.toBe('attacker-id');
      expect(data).toMatchObject({
        title: '제목',
        description: '내용',
        category: 'bug',
        categoryLabel: '버그',
        status: 'received',
        requester: '최우성',
        requesterCode: 'B',
        adminComment: '',
        completedAt: null,
      });

      expect(db.tables.csr_requests).toHaveLength(1);
      const row = db.tables.csr_requests[0];
      expect(row).toMatchObject({
        id: data.id,
        status: 'received',
        requester: '최우성',
        requester_code: 'B',
        admin_comment: '',
        completed_at: null,
      });
      expect(row.created_at).not.toBe('2020-01-01T00:00:00.000Z');
      expect(row.created_at).toBe(row.updated_at);
    });

    it('lets an admin session register on behalf of a member', async () => {
      const db = makeFakeSupabase({ csr_requests: [] });
      const res = await call(db, { method: 'POST', headers: admin(), body: draft({ requesterCode: 'A' }) });
      expect(res.statusCode).toBe(200);
      expect(res.body.data).toMatchObject({ requester: '김윤형', requesterCode: 'A', status: 'received' });
    });

    it('rejects invalid payloads before touching the DB', async () => {
      const db = makeFakeSupabase({ csr_requests: [] });
      const bad = [
        draft({ title: '   ' }),
        draft({ title: 'a'.repeat(201) }),
        draft({ description: 'a'.repeat(20_001) }),
        draft({ category: 'weird' }),
        draft({ category: 'constructor' }),
        draft({ requesterCode: 'Z' }),
        draft({ requesterCode: undefined }),
        'not json',
      ];
      for (const body of bad) {
        const res = await call(db, { method: 'POST', headers: admin(), body });
        expect(res.statusCode).toBe(400);
        expect(res.body.status).toBe('error');
      }
      expect(db.log).toEqual([]);
    });

    it('does not leak the DB error text to the caller', async () => {
      const failing = {
        from: () => ({
          insert: () => ({ select: async () => ({ data: null, error: { message: 'boom: secret detail' } }) }),
        }),
      };
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const res = await call(failing, { method: 'POST', headers: member('wschoi'), body: draft() });
      expect(res.statusCode).toBe(500);
      expect(res.body.message).not.toContain('boom');
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe('PATCH (상태·코멘트 수정)', () => {
    it('rejects anything without an admin session on an admin route — and never touches the DB', async () => {
      const db = makeFakeSupabase({ csr_requests: [seedRow()] });
      const headersList = [
        { referer: `${ORIGIN}/admin` },
        member('yhkim'),
        { referer: `${ORIGIN}/yhkim`, cookie: adminCookie() },
        { referer: 'https://evil.example/admin', cookie: adminCookie() },
        {},
      ];
      for (const headers of headersList) {
        const res = await call(db, { method: 'PATCH', headers, body: { id: ID_A, status: 'done' } });
        expect(res.statusCode).toBe(403);
        expect(res.body.status).toBe('forbidden');
      }
      expect(db.log).toEqual([]);
      expect(db.tables.csr_requests[0].status).toBe('received');
    });

    it('changes only status and admin comment, and manages completedAt', async () => {
      const db = makeFakeSupabase({ csr_requests: [seedRow()] });
      const patch = (body) => call(db, { method: 'PATCH', headers: admin(), body: { id: ID_A, ...body } });
      const row = () => db.tables.csr_requests[0];

      let res = await patch({ status: 'inProgress', adminComment: '  확인 중  ' });
      expect(res.statusCode).toBe(200);
      expect(res.body.data).toMatchObject({ status: 'inProgress', adminComment: '확인 중', completedAt: null });
      expect(row()).toMatchObject({
        title: '원래 제목',
        description: '원래 내용',
        category: 'bug',
        requester: '최우성',
        requester_code: 'B',
        created_at: '2026-11-01T00:00:00.000Z',
      });

      res = await patch({ status: 'done' });
      expect(res.body.data.status).toBe('done');
      expect(res.body.data.adminComment).toBe('확인 중'); // 코멘트를 보내지 않으면 그대로
      const completedAt = row().completed_at;
      expect(typeof completedAt).toBe('string');

      res = await patch({ status: 'done', adminComment: '완료' });
      expect(row().completed_at).toBe(completedAt); // 이미 완료였으면 완료 시각 유지
      expect(res.body.data.adminComment).toBe('완료');

      await patch({ adminComment: '메모만' }); // 상태 없이 코멘트만
      expect(row().status).toBe('done');
      expect(row().admin_comment).toBe('메모만');
      expect(row().completed_at).toBe(completedAt);

      res = await patch({ status: 'hold' });
      expect(res.body.data).toMatchObject({ status: 'hold', completedAt: null });
    });

    it('rejects invalid input instead of silently coercing it', async () => {
      const db = makeFakeSupabase({ csr_requests: [seedRow()] });
      const bad = [
        { id: 'bad-id', status: 'done' },
        { status: 'done' },
        { id: ID_A },
        { id: ID_A, status: 'weird' },
        { id: ID_A, status: 'constructor' },
        { id: ID_A, adminComment: 123 },
        { id: ID_A, adminComment: 'a'.repeat(2_001) },
        'not json',
      ];
      for (const body of bad) {
        const res = await call(db, { method: 'PATCH', headers: admin(), body });
        expect(res.statusCode).toBe(400);
      }
      expect(db.log).toEqual([]);
      expect(db.tables.csr_requests[0].status).toBe('received');
    });

    it('returns 404 for an unknown request without writing', async () => {
      const db = makeFakeSupabase({ csr_requests: [seedRow()] });
      const res = await call(db, { method: 'PATCH', headers: admin(), body: { id: ID_UNKNOWN, status: 'done' } });
      expect(res.statusCode).toBe(404);
      expect(res.body.status).toBe('not-found');
      expect(db.log.some((entry) => entry.op === 'update')).toBe(false);
    });
  });

  describe('PATCH (제목·내용·분류 수정)', () => {
    const patch = (db, body, headers = admin()) => call(db, { method: 'PATCH', headers, body: { id: ID_A, ...body } });

    it('lets an admin edit title, description and category without touching the rest', async () => {
      const db = makeFakeSupabase({ csr_requests: [seedRow({ status: 'inProgress', admin_comment: '메모' })] });
      const res = await patch(db, { title: '  새 제목  ', description: '새 내용', category: 'feature' });
      expect(res.statusCode).toBe(200);
      expect(res.body.data).toMatchObject({ title: '새 제목', description: '새 내용', category: 'feature' });
      expect(db.tables.csr_requests[0]).toMatchObject({
        title: '새 제목',
        description: '새 내용',
        category: 'feature',
        status: 'inProgress',
        admin_comment: '메모',
        requester: '최우성',
        requester_code: 'B',
        created_at: '2026-11-01T00:00:00.000Z',
      });
    });

    it('rejects invalid content edits and non-admin edits before touching the DB', async () => {
      const db = makeFakeSupabase({ csr_requests: [seedRow()] });
      for (const body of [
        { title: '   ' },
        { title: 'a'.repeat(201) },
        { description: 'a'.repeat(20_001) },
        { category: 'weird' },
        { category: 'constructor' },
      ]) {
        expect((await patch(db, body)).statusCode).toBe(400);
      }
      expect((await patch(db, { title: '해킹' }, member('wschoi'))).statusCode).toBe(403);
      expect((await patch(db, { title: '해킹' }, { referer: `${ORIGIN}/admin` })).statusCode).toBe(403);
      expect(db.log).toEqual([]);
      expect(db.tables.csr_requests[0].title).toBe('원래 제목');
    });
  });

  describe('DELETE (삭제)', () => {
    function storageStub({ files = [], listError = null, removeError = null } = {}) {
      const calls = [];
      return {
        calls,
        storage: {
          from: (bucket) => ({
            list: async (folder, options) => {
              calls.push({ op: 'list', bucket, folder, options });
              return { data: listError ? null : files.map((name) => ({ name })), error: listError };
            },
            remove: async (paths) => {
              calls.push({ op: 'remove', bucket, paths });
              return { data: null, error: removeError };
            },
          }),
        },
      };
    }
    const withStorage = (db, stub) => ({ from: db.from, storage: stub.storage });
    const del = (client, headers = admin(), body = { id: ID_A }) => call(client, { method: 'DELETE', headers, body });

    it('rejects anything without an admin session on an admin route — and never touches the DB or storage', async () => {
      const db = makeFakeSupabase({ csr_requests: [seedRow()] });
      const stub = storageStub();
      const client = withStorage(db, stub);
      for (const headers of [
        { referer: `${ORIGIN}/admin` },
        member('wschoi'),
        { referer: `${ORIGIN}/wschoi`, cookie: adminCookie() },
        { referer: 'https://evil.example/admin', cookie: adminCookie() },
        {},
      ]) {
        const res = await del(client, headers);
        expect(res.statusCode).toBe(403);
      }
      expect(db.log).toEqual([]);
      expect(stub.calls).toEqual([]);
      expect(db.tables.csr_requests).toHaveLength(1);
    });

    it('rejects bad ids and returns 404 for an unknown request without deleting', async () => {
      const db = makeFakeSupabase({ csr_requests: [seedRow()] });
      const stub = storageStub();
      const client = withStorage(db, stub);
      expect((await del(client, admin(), { id: 'bad-id' })).statusCode).toBe(400);
      expect((await del(client, admin(), 'not json')).statusCode).toBe(400);
      const res = await del(client, admin(), { id: ID_UNKNOWN });
      expect(res.statusCode).toBe(404);
      expect(db.log.some((entry) => entry.op === 'delete')).toBe(false);
      expect(stub.calls).toEqual([]);
      expect(db.tables.csr_requests).toHaveLength(1);
    });

    it('removes attachment files first, then the request row', async () => {
      const db = makeFakeSupabase({ csr_requests: [seedRow(), seedRow({ id: ID_UNKNOWN })] });
      const stub = storageStub({ files: ['a-file.png', 'b-file.pdf'] });
      const res = await del(withStorage(db, stub));

      expect(res.statusCode).toBe(200);
      expect(res.body.data).toEqual({ id: ID_A, removedFiles: 2 });
      expect(stub.calls[0]).toMatchObject({ op: 'list', bucket: 'csr-attachments', folder: ID_A });
      expect(stub.calls[1]).toEqual({
        op: 'remove',
        bucket: 'csr-attachments',
        paths: [`${ID_A}/a-file.png`, `${ID_A}/b-file.pdf`],
      });
      expect(db.tables.csr_requests.map((row) => row.id)).toEqual([ID_UNKNOWN]); // 다른 요청은 그대로
    });

    it('skips the storage remove call when there are no files', async () => {
      const db = makeFakeSupabase({ csr_requests: [seedRow()] });
      const stub = storageStub({ files: [] });
      const res = await del(withStorage(db, stub));
      expect(res.statusCode).toBe(200);
      expect(stub.calls.map((c) => c.op)).toEqual(['list']);
      expect(db.tables.csr_requests).toHaveLength(0);
    });

    it('keeps the request row when listing or removing files fails, without leaking the error text', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      for (const stubOptions of [
        { listError: { message: 'list boom secret' } },
        { files: ['a.png'], removeError: { message: 'remove boom secret' } },
      ]) {
        const db = makeFakeSupabase({ csr_requests: [seedRow()] });
        const res = await del(withStorage(db, storageStub(stubOptions)));
        expect(res.statusCode).toBe(500);
        expect(res.body.message).not.toContain('boom');
        expect(db.tables.csr_requests).toHaveLength(1);
        expect(db.log.some((entry) => entry.op === 'delete')).toBe(false);
      }
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  it('answers other methods with 405', async () => {
    const db = makeFakeSupabase({ csr_requests: [] });
    for (const method of ['GET', 'PUT']) {
      const res = await call(db, { method, headers: admin() });
      expect(res.statusCode).toBe(405);
      expect(res.headers.allow).toBe('POST, PATCH, DELETE');
    }
    expect(db.log).toEqual([]);
  });

  describe('wiring', () => {
    const saved = {};
    beforeEach(() => {
      for (const key of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) saved[key] = process.env[key];
      process.env.SUPABASE_URL = 'https://example.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    });
    afterEach(() => {
      for (const [key, value] of Object.entries(saved)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    });

    it('routes /api/csr-requests through the announcements function', async () => {
      const res = createRes();
      await handler({ method: 'GET', url: '/api/csr-requests', headers: { host: 'localhost' } }, res);
      expect(res.statusCode).toBe(405);
      expect(res.body.message).toBe('method not allowed');
    });

    it('has a vercel.json rewrite for /api/csr-requests ahead of the SPA fallback', () => {
      const { rewrites } = JSON.parse(readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
      const index = rewrites.findIndex((rule) => rule.source === '/api/csr-requests');
      expect(index).toBeGreaterThanOrEqual(0);
      expect(rewrites[index].destination).toBe('/api/announcements');
      expect(index).toBeLessThan(rewrites.length - 1);
    });
  });
});
