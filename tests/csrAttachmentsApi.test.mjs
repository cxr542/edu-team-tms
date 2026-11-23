import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from '../api/announcements.js';
import { createAdminSessionCookie } from '../server/api-utils/adminSession.js';
import { handleCsrAttachments } from '../server/api-utils/csrAttachments.js';
import { makeFakeSupabase } from './helpers/fakeSupabase.mjs';

// 연결 테스트가 진짜 클라이언트를 만들지 않게 한다(Node 20 CI 에는 WebSocket 이 없어 생성 단계에서 실패한다).
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({}) }));

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://edu-team-tms-ten.vercel.app';
const REQ_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_REQ_ID = '22222222-2222-4222-8222-222222222222';
const UNKNOWN_ID = '99999999-9999-4999-8999-999999999999';
const FILE_UUID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

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

async function call(client, req) {
  const res = createRes();
  await handleCsrAttachments({ headers: {}, ...req }, res, client);
  return res;
}

const requestRow = (over = {}) => ({ id: REQ_ID, requester_code: 'B', ...over });
const attachmentRow = (n) => ({
  id: `att-${n}`,
  request_id: REQ_ID,
  file_name: `f${n}.png`,
  storage_path: `${REQ_ID}/${FILE_UUID}-f${n}.png`,
  file_size_bytes: 10,
  uploaded_by: 'B',
});

function makeClient({ requests = [requestRow()], attachments = [], storedFiles = [], signError = null, listError = null } = {}) {
  const db = makeFakeSupabase({ csr_requests: requests, csr_request_attachments: attachments });
  const calls = [];
  return {
    db,
    calls,
    from: db.from,
    storage: {
      from: (bucket) => ({
        createSignedUploadUrl: async (storagePath) => {
          calls.push({ op: 'sign', bucket, storagePath });
          return signError ? { data: null, error: signError } : { data: { signedUrl: 'https://x', token: 'tok-1', path: storagePath }, error: null };
        },
        list: async (folder, options) => {
          calls.push({ op: 'list', bucket, folder, options });
          return listError ? { data: null, error: listError } : { data: storedFiles, error: null };
        },
      }),
    },
  };
}

const sign = (over = {}) => ({ action: 'sign', requestId: REQ_ID, fileName: '스크린샷 1.png', size: 1234, contentType: 'image/png', ...over });
const register = (over = {}) => ({
  action: 'register',
  requestId: REQ_ID,
  path: `${REQ_ID}/${FILE_UUID}-shot.png`,
  fileName: 'shot.png',
  size: 500,
  contentType: 'image/png',
  ...over,
});

describe('CSR attachments API', () => {
  beforeEach(() => {
    process.env.TMS_ADMIN_GATE_PASSWORD = 'secret-gate';
    process.env.TMS_ADMIN_SESSION_SECRET = 'session-secret';
  });

  describe('권한', () => {
    it('rejects requests without a matching member route or admin session — and never touches the DB or storage', async () => {
      const client = makeClient();
      const cases = [
        { headers: {} },
        { headers: { referer: 'https://evil.example/wschoi' }, body: sign() },
        { headers: member('yhkim'), body: sign() }, // 요청자(B)가 아닌 구성원 주소
        { headers: { referer: `${ORIGIN}/admin` }, body: sign() }, // 세션 없는 관리자 주소
        { headers: { referer: `${ORIGIN}/yhkim`, cookie: adminCookie() }, body: sign() },
      ];
      for (const req of cases) {
        const res = await call(client, { method: 'POST', ...req });
        expect(res.statusCode).toBe(403);
        expect(res.body.status).toBe('forbidden');
      }
      // 마지막 두 건은 요청 조회까지는 가지만 쓰기·저장소 호출은 없다.
      expect(client.db.log.every((entry) => entry.op === 'select')).toBe(true);
      expect(client.calls).toEqual([]);
    });

    it('rejects anyone who is not the requester when the request belongs to someone else', async () => {
      const client = makeClient({ requests: [requestRow({ requester_code: 'A' })] });
      const res = await call(client, { method: 'POST', headers: member('wschoi'), body: sign() });
      expect(res.statusCode).toBe(403);
      expect(client.calls).toEqual([]);
    });

    it('answers non-POST methods with 405 and does nothing', async () => {
      const client = makeClient();
      for (const method of ['GET', 'PUT', 'PATCH', 'DELETE']) {
        const res = await call(client, { method, headers: admin() });
        expect(res.statusCode).toBe(405);
        expect(res.headers.allow).toBe('POST');
      }
      expect(client.db.log).toEqual([]);
    });
  });

  describe('sign', () => {
    it('issues a server-built path and token for the requester', async () => {
      const client = makeClient();
      const res = await call(client, { method: 'POST', headers: member('wschoi'), body: sign() });
      expect(res.statusCode).toBe(200);
      expect(res.body.data.token).toBe('tok-1');
      expect(res.body.data.path).toMatch(new RegExp(`^${REQ_ID}/[0-9a-f-]{36}-스크린샷 1\\.png$`));
      expect(client.calls[0]).toMatchObject({ op: 'sign', bucket: 'csr-attachments', storagePath: res.body.data.path });
    });

    it('lets an admin session attach to any request and sanitizes the file name in the path', async () => {
      const client = makeClient();
      const res = await call(client, { method: 'POST', headers: admin(), body: sign({ fileName: '../../위험<>:"/\\|?*.png' }) });
      expect(res.statusCode).toBe(200);
      const name = res.body.data.path.slice(REQ_ID.length + 1 + 37);
      expect(name).not.toMatch(/[\\/<>:"|?*]/);
      expect(res.body.data.path.startsWith(`${REQ_ID}/`)).toBe(true);
      expect(res.body.data.path.split('/')).toHaveLength(2);
    });

    it('rejects invalid input before touching storage', async () => {
      const client = makeClient();
      const bad = [
        sign({ action: 'delete' }),
        sign({ action: undefined }),
        sign({ requestId: 'bad-id' }),
        sign({ fileName: '   ' }),
        sign({ fileName: 'a'.repeat(256) }),
        sign({ size: 0 }),
        sign({ size: -5 }),
        sign({ size: 1.5 }),
        sign({ size: '100' }),
        sign({ size: 10 * 1024 * 1024 + 1 }),
        sign({ contentType: 5 }),
        sign({ contentType: 'a'.repeat(101) }),
        'not json',
      ];
      for (const body of bad) {
        const res = await call(client, { method: 'POST', headers: admin(), body });
        expect(res.statusCode).toBe(400);
      }
      expect(client.calls).toEqual([]);
    });

    it('returns 404 for an unknown request and 409 once five files are attached', async () => {
      let client = makeClient();
      let res = await call(client, { method: 'POST', headers: admin(), body: sign({ requestId: UNKNOWN_ID }) });
      expect(res.statusCode).toBe(404);
      expect(client.calls).toEqual([]);

      client = makeClient({ attachments: [1, 2, 3, 4, 5].map(attachmentRow) });
      res = await call(client, { method: 'POST', headers: member('wschoi'), body: sign() });
      expect(res.statusCode).toBe(409);
      expect(client.calls).toEqual([]);
    });

    it('does not leak storage errors', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const client = makeClient({ signError: { message: 'boom secret' } });
      const res = await call(client, { method: 'POST', headers: member('wschoi'), body: sign() });
      expect(res.statusCode).toBe(500);
      expect(res.body.message).not.toContain('boom');
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe('register', () => {
    const stored = (size = 500) => [{ name: `${FILE_UUID}-shot.png`, metadata: { size } }];

    it('records the attachment after verifying the uploaded file, with a server-chosen uploader', async () => {
      const client = makeClient({ storedFiles: stored() });
      const res = await call(client, { method: 'POST', headers: member('wschoi'), body: register({ uploadedBy: '해커' }) });
      expect(res.statusCode).toBe(200);
      expect(client.calls[0]).toMatchObject({ op: 'list', bucket: 'csr-attachments', folder: REQ_ID });
      expect(client.db.tables.csr_request_attachments).toHaveLength(1);
      // 가짜 DB 가 덧붙이는 컬럼(version 등) 말고 서버가 실제로 보낸 값을 검사한다.
      const insert = client.db.log.find((entry) => entry.table === 'csr_request_attachments' && entry.op === 'insert');
      expect(insert.payload).toEqual({
        request_id: REQ_ID,
        file_name: 'shot.png',
        storage_path: `${REQ_ID}/${FILE_UUID}-shot.png`,
        file_size_bytes: 500,
        content_type: 'image/png',
        uploaded_by: 'B',
      });
    });

    it('marks admin uploads as admin', async () => {
      const client = makeClient({ storedFiles: stored() });
      const res = await call(client, { method: 'POST', headers: admin(), body: register() });
      expect(res.statusCode).toBe(200);
      expect(client.db.tables.csr_request_attachments[0].uploaded_by).toBe('admin');
    });

    it('rejects paths that the server did not issue', async () => {
      const client = makeClient({ storedFiles: stored() });
      const bad = [
        `${OTHER_REQ_ID}/${FILE_UUID}-shot.png`, // 다른 요청 폴더
        `${REQ_ID}/shot.png`, // UUID 없음
        `${REQ_ID}/${FILE_UUID}-sub/shot.png`, // 하위 폴더
        `${REQ_ID}/${FILE_UUID}-../shot.png`,
        `${REQ_ID}/${FILE_UUID}-`,
        `${REQ_ID}/${FILE_UUID}-bad<name>.png`,
        '',
      ];
      for (const badPath of bad) {
        const res = await call(client, { method: 'POST', headers: member('wschoi'), body: register({ path: badPath }) });
        expect(res.statusCode).toBe(400);
      }
      expect(client.calls).toEqual([]);
      expect(client.db.tables.csr_request_attachments).toHaveLength(0);
    });

    it('rejects a file that is not in storage or whose size differs', async () => {
      let client = makeClient({ storedFiles: [] });
      let res = await call(client, { method: 'POST', headers: member('wschoi'), body: register() });
      expect(res.statusCode).toBe(409);
      expect(client.db.tables.csr_request_attachments).toHaveLength(0);

      client = makeClient({ storedFiles: stored(9_999) });
      res = await call(client, { method: 'POST', headers: member('wschoi'), body: register({ size: 500 }) });
      expect(res.statusCode).toBe(409);
      expect(client.db.tables.csr_request_attachments).toHaveLength(0);
    });

    it('rejects a duplicate registration and a sixth file', async () => {
      let client = makeClient({
        storedFiles: stored(),
        attachments: [{ ...attachmentRow(1), storage_path: `${REQ_ID}/${FILE_UUID}-shot.png` }],
      });
      let res = await call(client, { method: 'POST', headers: member('wschoi'), body: register() });
      expect(res.statusCode).toBe(409);
      expect(client.db.tables.csr_request_attachments).toHaveLength(1);

      client = makeClient({ storedFiles: stored(), attachments: [1, 2, 3, 4, 5].map(attachmentRow) });
      res = await call(client, { method: 'POST', headers: member('wschoi'), body: register() });
      expect(res.statusCode).toBe(409);
      expect(client.db.tables.csr_request_attachments).toHaveLength(5);
    });

    it('does not leak storage or DB errors', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const client = makeClient({ listError: { message: 'list boom secret' } });
      const res = await call(client, { method: 'POST', headers: member('wschoi'), body: register() });
      expect(res.statusCode).toBe(500);
      expect(res.body.message).not.toContain('boom');
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
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

    it('routes /api/csr-attachments through the announcements function', async () => {
      const res = createRes();
      await handler({ method: 'GET', url: '/api/csr-attachments', headers: { host: 'localhost' } }, res);
      expect(res.statusCode).toBe(405);
      expect(res.body.message).toBe('method not allowed');
      expect(res.headers.allow).toBe('POST');
    });

    it('has a vercel.json rewrite for /api/csr-attachments ahead of the SPA fallback', () => {
      const { rewrites } = JSON.parse(readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
      const index = rewrites.findIndex((rule) => rule.source === '/api/csr-attachments');
      expect(index).toBeGreaterThanOrEqual(0);
      expect(rewrites[index].destination).toBe('/api/announcements');
      expect(index).toBeLessThan(rewrites.length - 1);
    });
  });
});
