import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from '../api/announcements.js';
import { createAdminSessionCookie } from '../server/api-utils/adminSession.js';
import { handleKpiApprovals } from '../server/api-utils/kpiApprovals.js';
import { makeFakeSupabase } from './helpers/fakeSupabase.mjs';

// 연결 테스트가 진짜 클라이언트를 만들지 않게 한다(Node 20 CI 에는 WebSocket 이 없어 생성 단계에서 실패한다).
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({}) }));

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://edu-team-tms-ten.vercel.app';

const adminCookie = () => createAdminSessionCookie().split(';')[0];
const admin = () => ({ referer: `${ORIGIN}/admin?module=kpi-approve`, cookie: adminCookie() });
const member = (slug) => ({ referer: `${ORIGIN}/${slug}?module=kpi` });

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
  await handleKpiApprovals({ headers: {}, ...req }, res, db);
  return res;
}

const monthlyKey = { kind: 'monthly', memberCode: 'B', yearMonth: '2026-11' };
const kpi2Key = { kind: 'kpi2', memberCode: 'B', dayKey: '2026-11-05', taskId: 'task-1' };

const submitRecord = (over = {}) => ({
  status: '제출',
  work: 10,
  improve: 5,
  leave: 1,
  available: 20,
  note: '메모',
  ...over,
});

const monthlyRow = (over = {}) => ({
  id: 'm1',
  member_code: 'B',
  year_month: '2026-11',
  status: 'submitted',
  submitted_at: '2026-11-05T00:00:00.000Z',
  approved_at: null,
  approver: null,
  reject_reason: null,
  monthly01: {
    work: 10,
    improve: 5,
    leave: 1,
    available: 20,
    status: '제출',
    submittedAt: '2026-11-05T00:00:00.000Z',
    approvedAt: null,
    approver: '',
    rejectReason: '',
    note: '메모',
  },
  payload_version: 1,
  updated_at: '2026-11-05T00:00:00.000Z',
  created_at: '2026-11-05T00:00:00.000Z',
  ...over,
});

const kpi2Row = (over = {}) => ({
  id: 'k1',
  member_code: 'B',
  day_key: '2026-11-05',
  task_id: 'task-1',
  status: 'submitted',
  submitted_at: '2026-11-05T00:00:00.000Z',
  approved_at: null,
  approver: null,
  reject_reason: null,
  kpi2_row_status: { status: '제출', submittedAt: '2026-11-05T00:00:00.000Z', approvedAt: null, approver: '', rejectReason: '' },
  payload_version: 1,
  updated_at: '2026-11-05T00:00:00.000Z',
  created_at: '2026-11-05T00:00:00.000Z',
  ...over,
});

const emptyDb = (seed = {}) => makeFakeSupabase({ kpi_monthly_approvals: [], kpi2_row_approvals: [], ...seed });

describe('KPI approvals API', () => {
  beforeEach(() => {
    process.env.TMS_ADMIN_GATE_PASSWORD = 'secret-gate';
    process.env.TMS_ADMIN_SESSION_SECRET = 'session-secret';
  });

  describe('POST (구성원 제출·회수)', () => {
    it('rejects requests without a matching member route or admin session — and never touches the DB', async () => {
      const db = emptyDb();
      const record = submitRecord();
      const cases = [
        { headers: {} },
        { headers: { referer: 'https://evil.example/wschoi' }, body: { ...monthlyKey, record } },
        { headers: member('yhkim'), body: { ...monthlyKey, record } }, // 다른 구성원 주소
        { headers: { referer: `${ORIGIN}/admin` }, body: { ...monthlyKey, record } }, // 세션 없는 관리자 주소
        { headers: { referer: `${ORIGIN}/yhkim`, cookie: adminCookie() }, body: { ...monthlyKey, record } },
      ];
      for (const req of cases) {
        const res = await call(db, { method: 'POST', ...req });
        expect(res.statusCode).toBe(403);
        expect(res.body.status).toBe('forbidden');
      }
      expect(db.log).toEqual([]);
    });

    it('lets a member submit their own month and ignores every server-controlled field', async () => {
      const db = emptyDb();
      const res = await call(db, {
        method: 'POST',
        headers: member('wschoi'),
        body: {
          ...monthlyKey,
          record: submitRecord({
            submittedAt: '2020-01-01T00:00:00.000Z',
            approvedAt: '2020-01-01T00:00:00.000Z',
            approver: '해커',
            rejectReason: 'x',
            evil: 'extra',
          }),
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.body.data).toMatchObject({ kind: 'monthly', memberCode: 'B', yearMonth: '2026-11', status: 'submitted' });
      expect(db.tables.kpi_monthly_approvals).toHaveLength(1);
      const row = db.tables.kpi_monthly_approvals[0];
      expect(row).toMatchObject({
        member_code: 'B',
        year_month: '2026-11',
        status: 'submitted',
        approved_at: null,
        approver: null,
        reject_reason: null,
        payload_version: 1,
      });
      expect(row.submitted_at).not.toBe('2020-01-01T00:00:00.000Z');
      expect(row.monthly01).toEqual({
        work: 10,
        improve: 5,
        leave: 1,
        available: 20,
        note: '메모',
        status: '제출',
        submittedAt: row.submitted_at,
        approvedAt: null,
        approver: '',
        rejectReason: '',
      });
      expect(row.monthly01).not.toHaveProperty('evil');
    });

    it('lets a member submit a KPI2 row', async () => {
      const db = emptyDb();
      const res = await call(db, {
        method: 'POST',
        headers: member('wschoi'),
        body: { ...kpi2Key, record: { status: '제출', approver: '해커' } },
      });
      expect(res.statusCode).toBe(200);
      const row = db.tables.kpi2_row_approvals[0];
      expect(row).toMatchObject({ member_code: 'B', day_key: '2026-11-05', task_id: 'task-1', status: 'submitted', approver: null });
      expect(row.kpi2_row_status).toMatchObject({ status: '제출', approver: '', approvedAt: null, rejectReason: '' });
    });

    it('lets an admin session submit on behalf of a member', async () => {
      const db = emptyDb();
      const res = await call(db, { method: 'POST', headers: admin(), body: { ...monthlyKey, memberCode: 'A', record: submitRecord() } });
      expect(res.statusCode).toBe(200);
      expect(db.tables.kpi_monthly_approvals[0].member_code).toBe('A');
    });

    it('withdraws a submitted row back to draft and records the withdrawal time', async () => {
      const db = emptyDb({ kpi_monthly_approvals: [monthlyRow()] });
      const res = await call(db, { method: 'POST', headers: member('wschoi'), body: { ...monthlyKey, record: submitRecord({ status: '작성중' }) } });
      expect(res.statusCode).toBe(200);
      const row = db.tables.kpi_monthly_approvals[0];
      expect(row).toMatchObject({ status: 'draft', submitted_at: null });
      expect(row.monthly01.status).toBe('작성중');
      expect(typeof row.monthly01.withdrawnAt).toBe('string');
    });

    it('does not let a member overwrite an approved row, but lets an admin session', async () => {
      const approved = monthlyRow({
        status: 'approved',
        approved_at: '2026-11-06T00:00:00.000Z',
        approver: '팀장',
        monthly01: { ...monthlyRow().monthly01, status: '승인', approver: '팀장', approvedAt: '2026-11-06T00:00:00.000Z' },
      });
      const db = emptyDb({ kpi_monthly_approvals: [approved] });

      for (const status of ['작성중', '제출']) {
        const res = await call(db, { method: 'POST', headers: member('wschoi'), body: { ...monthlyKey, record: submitRecord({ status, work: 999 }) } });
        expect(res.statusCode).toBe(409);
        expect(res.body.status).toBe('conflict');
      }
      expect(db.log.some((entry) => entry.op === 'update' || entry.op === 'insert')).toBe(false);
      expect(db.tables.kpi_monthly_approvals[0]).toMatchObject({ status: 'approved', approver: '팀장' });
      expect(db.tables.kpi_monthly_approvals[0].monthly01.work).toBe(10);

      const byAdmin = await call(db, { method: 'POST', headers: admin(), body: { ...monthlyKey, record: submitRecord({ status: '작성중' }) } });
      expect(byAdmin.statusCode).toBe(200);
      expect(db.tables.kpi_monthly_approvals[0].status).toBe('draft');
    });

    it('lets a member resubmit a rejected row and clears the rejection', async () => {
      const rejected = monthlyRow({
        status: 'rejected',
        approver: '팀장',
        reject_reason: '다시 작성',
        monthly01: { ...monthlyRow().monthly01, status: '반려', rejectReason: '다시 작성' },
      });
      const db = emptyDb({ kpi_monthly_approvals: [rejected] });
      const res = await call(db, { method: 'POST', headers: member('wschoi'), body: { ...monthlyKey, record: submitRecord() } });
      expect(res.statusCode).toBe(200);
      expect(db.tables.kpi_monthly_approvals[0]).toMatchObject({ status: 'submitted', approver: null, reject_reason: null });
      expect(db.tables.kpi_monthly_approvals[0].monthly01.rejectReason).toBe('');
    });

    it('rejects invalid payloads before touching the DB', async () => {
      const db = emptyDb();
      const ok = { ...monthlyKey, record: submitRecord() };
      const bad = [
        { ...ok, record: submitRecord({ status: '승인' }) },
        { ...ok, record: submitRecord({ status: '반려' }) },
        { ...ok, record: submitRecord({ status: 'approved' }) },
        { ...ok, record: submitRecord({ status: 'weird' }) },
        { ...ok, record: {} },
        { ...ok, kind: 'other' },
        { ...ok, kind: 'constructor' },
        { ...ok, memberCode: 'Z' },
        { ...ok, yearMonth: '2026-13' },
        { ...ok, yearMonth: undefined },
        { ...kpi2Key, dayKey: '2026/11/05', record: { status: '제출' } },
        { ...kpi2Key, taskId: 'a|b', record: { status: '제출' } },
        { ...kpi2Key, taskId: '', record: { status: '제출' } },
        { ...kpi2Key, taskId: 'a'.repeat(121), record: { status: '제출' } },
        { ...ok, record: submitRecord({ work: -1 }) },
        { ...ok, record: submitRecord({ work: '10' }) },
        { ...ok, record: submitRecord({ work: 1e9 }) },
        { ...ok, record: submitRecord({ note: 'a'.repeat(2_001) }) },
        { ...ok, record: submitRecord({ note: 5 }) },
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
        from: () => {
          const q = { select: () => q, eq: () => q, then: (resolve) => resolve({ data: null, error: { message: 'boom: secret detail' } }) };
          return q;
        },
      };
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const res = await call(failing, { method: 'POST', headers: member('wschoi'), body: { ...monthlyKey, record: submitRecord() } });
      expect(res.statusCode).toBe(500);
      expect(res.body.message).not.toContain('boom');
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe('PATCH (관리자 승인·반려)', () => {
    const decide = (db, body, headers = admin()) => call(db, { method: 'PATCH', headers, body });

    it('rejects anything without an admin session on an admin route — and never touches the DB', async () => {
      const db = emptyDb({ kpi_monthly_approvals: [monthlyRow()] });
      for (const headers of [
        { referer: `${ORIGIN}/admin` },
        member('wschoi'),
        { referer: `${ORIGIN}/wschoi`, cookie: adminCookie() },
        { referer: 'https://evil.example/admin', cookie: adminCookie() },
        {},
      ]) {
        const res = await decide(db, { ...monthlyKey, action: 'approve' }, headers);
        expect(res.statusCode).toBe(403);
      }
      expect(db.log).toEqual([]);
      expect(db.tables.kpi_monthly_approvals[0].status).toBe('submitted');
    });

    it('approves a month, keeps the submitted content, and sets the time on the server', async () => {
      const db = emptyDb({ kpi_monthly_approvals: [monthlyRow()] });
      const res = await decide(db, { ...monthlyKey, action: 'approve', approvedAt: '2020-01-01T00:00:00.000Z' });
      expect(res.statusCode).toBe(200);
      const row = db.tables.kpi_monthly_approvals[0];
      expect(row).toMatchObject({ status: 'approved', approver: '팀장', reject_reason: null });
      expect(row.approved_at).not.toBe('2020-01-01T00:00:00.000Z');
      expect(row.monthly01).toMatchObject({
        work: 10,
        improve: 5,
        note: '메모',
        status: '승인',
        approver: '팀장',
        rejectReason: '',
        approvedAt: row.approved_at,
        submittedAt: '2026-11-05T00:00:00.000Z',
      });
      expect(res.body.data).toMatchObject({ kind: 'monthly', status: 'approved' });
    });

    it('rejects a month with a reason (default 반려) and a custom approver', async () => {
      let db = emptyDb({ kpi_monthly_approvals: [monthlyRow()] });
      let res = await decide(db, { ...monthlyKey, action: 'reject', reason: '  수치 확인  ', approver: '김윤형' });
      expect(res.statusCode).toBe(200);
      expect(db.tables.kpi_monthly_approvals[0]).toMatchObject({ status: 'rejected', approver: '김윤형', reject_reason: '수치 확인' });
      expect(db.tables.kpi_monthly_approvals[0].monthly01).toMatchObject({ status: '반려', rejectReason: '수치 확인' });

      db = emptyDb({ kpi_monthly_approvals: [monthlyRow()] });
      await decide(db, { ...monthlyKey, action: 'reject' });
      expect(db.tables.kpi_monthly_approvals[0].reject_reason).toBe('반려');
    });

    it('approves and rejects a KPI2 row', async () => {
      let db = emptyDb({ kpi2_row_approvals: [kpi2Row()] });
      let res = await decide(db, { ...kpi2Key, action: 'approve' });
      expect(res.statusCode).toBe(200);
      expect(db.tables.kpi2_row_approvals[0]).toMatchObject({ status: 'approved', approver: '팀장' });
      expect(db.tables.kpi2_row_approvals[0].kpi2_row_status).toMatchObject({ status: '승인', approver: '팀장', rejectReason: '' });

      db = emptyDb({ kpi2_row_approvals: [kpi2Row()] });
      await decide(db, { ...kpi2Key, action: 'reject', reason: '근거 부족' });
      expect(db.tables.kpi2_row_approvals[0]).toMatchObject({ status: 'rejected', reject_reason: '근거 부족' });
    });

    it('returns 404 for an unknown row and 409 for a draft row, without writing', async () => {
      const unknown = emptyDb({ kpi_monthly_approvals: [monthlyRow()] });
      let res = await decide(unknown, { ...monthlyKey, yearMonth: '2026-10', action: 'approve' });
      expect(res.statusCode).toBe(404);
      expect(unknown.log.some((entry) => entry.op === 'update')).toBe(false);

      const draft = emptyDb({ kpi_monthly_approvals: [monthlyRow({ status: 'draft' })] });
      res = await decide(draft, { ...monthlyKey, action: 'approve' });
      expect(res.statusCode).toBe(409);
      expect(draft.log.some((entry) => entry.op === 'update')).toBe(false);
      expect(draft.tables.kpi_monthly_approvals[0].status).toBe('draft');
    });

    it('rejects invalid input instead of silently coercing it', async () => {
      const db = emptyDb({ kpi_monthly_approvals: [monthlyRow()] });
      const bad = [
        { ...monthlyKey },
        { ...monthlyKey, action: 'delete' },
        { ...monthlyKey, action: 'constructor' },
        { ...monthlyKey, action: 'approve', approver: 'a'.repeat(41) },
        { ...monthlyKey, action: 'reject', reason: 'a'.repeat(501) },
        { ...monthlyKey, action: 'reject', reason: 5 },
        { ...monthlyKey, kind: 'other', action: 'approve' },
        { ...monthlyKey, yearMonth: 'bad', action: 'approve' },
        'not json',
      ];
      for (const body of bad) {
        const res = await decide(db, body);
        expect(res.statusCode).toBe(400);
      }
      expect(db.log).toEqual([]);
      expect(db.tables.kpi_monthly_approvals[0].status).toBe('submitted');
    });
  });

  it('answers other methods with 405', async () => {
    const db = emptyDb();
    for (const method of ['GET', 'PUT', 'DELETE']) {
      const res = await call(db, { method, headers: admin() });
      expect(res.statusCode).toBe(405);
      expect(res.headers.allow).toBe('POST, PATCH');
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

    it('routes /api/kpi-approvals through the announcements function', async () => {
      const res = createRes();
      await handler({ method: 'GET', url: '/api/kpi-approvals', headers: { host: 'localhost' } }, res);
      expect(res.statusCode).toBe(405);
      expect(res.body.message).toBe('method not allowed');
    });

    it('has a vercel.json rewrite for /api/kpi-approvals ahead of the SPA fallback', () => {
      const { rewrites } = JSON.parse(readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
      const index = rewrites.findIndex((rule) => rule.source === '/api/kpi-approvals');
      expect(index).toBeGreaterThanOrEqual(0);
      expect(rewrites[index].destination).toBe('/api/announcements');
      expect(index).toBeLessThan(rewrites.length - 1);
    });
  });
});
