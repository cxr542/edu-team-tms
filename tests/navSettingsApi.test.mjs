import { beforeEach, describe, expect, it } from 'vitest';
import { createAdminSessionCookie } from '../server/api-utils/adminSession.js';
import { handleNavSettings } from '../server/api-utils/navSettings.js';
import { makeFakeSupabase } from './helpers/fakeSupabase.mjs';

const ORIGIN = 'https://edu-team-tms-ten.vercel.app';
const adminHeaders = () => ({ referer: `${ORIGIN}/admin`, cookie: createAdminSessionCookie().split(';')[0] });

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
  await handleNavSettings({ headers: {}, ...req }, res, db);
  return res;
}

describe('nav settings API', () => {
  let db;
  beforeEach(() => {
    process.env.TMS_ADMIN_GATE_PASSWORD = 'secret-gate';
    process.env.TMS_ADMIN_SESSION_SECRET = 'session-secret';
    db = makeFakeSupabase({ nav_settings: [] });
  });

  it('rejects reads and writes without an admin session, from member routes or foreign origins', async () => {
    const value = { order: { common: ['ai-office'] }, labels: {} };
    for (const headers of [
      { referer: `${ORIGIN}/admin` },
      { referer: `${ORIGIN}/wschoi`, cookie: createAdminSessionCookie().split(';')[0] },
      { referer: 'https://evil.example/admin', cookie: createAdminSessionCookie().split(';')[0] },
      {},
    ]) {
      for (const req of [{ method: 'GET' }, { method: 'PUT', body: { value } }]) {
        const res = await call(db, { ...req, headers });
        expect(res.statusCode).toBe(403);
        expect(res.body.status).toBe('forbidden');
      }
    }
    expect(db.log).toHaveLength(0);
  });

  it('answers "empty" when nothing is saved yet', async () => {
    const res = await call(db, { method: 'GET', headers: adminHeaders() });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ ok: true, status: 'empty', data: null });
  });

  it('saves the settings and reads them back, keeping one row', async () => {
    const value = { order: { common: ['ai-office', 'ledger'] }, labels: { ledger: '팀 빌딩비 관리' } };
    const saved = await call(db, { method: 'PUT', headers: adminHeaders(), body: { value } });
    expect(saved.statusCode).toBe(200);
    expect(saved.body.data.value).toEqual(value);

    await call(db, { method: 'PUT', headers: adminHeaders(), body: { value: { order: { common: ['ledger'] }, labels: {} } } });
    expect(db.tables.nav_settings).toHaveLength(1);

    const read = await call(db, { method: 'GET', headers: adminHeaders() });
    expect(read.body.status).toBe('ok');
    expect(read.body.data.value).toEqual({ order: { common: ['ledger'] }, labels: {} });
    expect(read.body.data.updatedAt).toBeTruthy();
  });

  it('drops unknown groups, unknown menu ids and over-long names before saving', async () => {
    const value = {
      order: { common: ['ledger', 7], hacked: ['x'] },
      labels: { ledger: ` ${'가'.repeat(60)} `, nope: '무시', kanban: '   ' },
    };
    const res = await call(db, { method: 'PUT', headers: adminHeaders(), body: { value } });
    expect(res.body.data.value.order).toEqual({ common: ['ledger'] });
    expect(Object.keys(res.body.data.value.labels)).toEqual(['ledger']);
    expect(res.body.data.value.labels.ledger).toHaveLength(40);
  });

  it('rejects a body without a value and unsupported methods', async () => {
    expect((await call(db, { method: 'PUT', headers: adminHeaders(), body: {} })).statusCode).toBe(400);
    expect((await call(db, { method: 'DELETE', headers: adminHeaders() })).statusCode).toBe(405);
  });

  it('tells the screen the table is not ready instead of failing with a generic error', async () => {
    const missing = {
      from: () => {
        const q = { select: () => q, eq: () => q, upsert: () => q, then: (ok) => Promise.resolve({ data: null, error: { code: '42P01', message: 'relation "public.nav_settings" does not exist' } }).then(ok) };
        return q;
      },
    };
    const get = await call(missing, { method: 'GET', headers: adminHeaders() });
    expect(get.statusCode).toBe(503);
    expect(get.body.status).toBe('not-ready');
    const put = await call(missing, { method: 'PUT', headers: adminHeaders(), body: { value: { order: {}, labels: {} } } });
    expect(put.body.status).toBe('not-ready');
  });
});
