import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAdminSessionCookie } from '../server/api-utils/adminSession.js';
import { makeFakeSupabase } from './helpers/fakeSupabase.mjs';

let db;
vi.mock('@supabase/supabase-js', () => ({ createClient: () => db }));
vi.mock('@vercel/blob', () => ({ put: vi.fn(), head: vi.fn(), del: vi.fn(), list: vi.fn() }));

function createRes() {
  return {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader() {},
    json(body) {
      this.body = body;
      return this;
    },
  };
}

const ORIGIN = 'https://edu-team-tms-ten.vercel.app';
const adminHeaders = () => ({
  referer: `${ORIGIN}/admin`,
  cookie: createAdminSessionCookie().split(';')[0],
});

async function call(req) {
  const handler = (await import('../api/ledger-snapshot.js')).default;
  const res = createRes();
  await handler({ headers: {}, ...req }, res);
  return res;
}

describe('ledger-snapshot row-level write routes', () => {
  beforeEach(() => {
    vi.resetModules();
    db = makeFakeSupabase();
    process.env.TMS_ADMIN_GATE_PASSWORD = 'secret-gate';
    process.env.TMS_ADMIN_SESSION_SECRET = 'session-secret';
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    delete process.env.LEDGER_PUBLISH_SECRET;
  });

  const body = { transaction: { id: 'a', date: '2026-09-03', category: '티타임', amount: 5000 } };

  it('rejects member-scoped and session-less writes with 403 and touches nothing', async () => {
    for (const headers of [
      { referer: `${ORIGIN}/wschoi?module=ledger` },
      { referer: `${ORIGIN}/admin` },
      { referer: 'https://evil.example/admin', cookie: createAdminSessionCookie().split(';')[0] },
    ]) {
      const res = await call({ method: 'POST', url: '/api/ledger-snapshot?resource=transactions', headers, body });
      expect(res.statusCode).toBe(403);
    }
    expect(db.log).toHaveLength(0);
  });

  it('lets an admin session insert, update (with version) and delete', async () => {
    const created = await call({ method: 'POST', url: '/api/ledger-snapshot?resource=transactions', headers: adminHeaders(), body });
    expect(created.statusCode).toBe(201);
    expect(created.body.transaction).toMatchObject({ id: 'a', balance: 40000, version: 1 });

    const stale = await call({
      method: 'PATCH',
      url: '/api/ledger-snapshot?resource=transactions&id=a',
      headers: adminHeaders(),
      body: { transaction: { ...body.transaction, amount: 1000 }, expectedVersion: 7 },
    });
    expect(stale.statusCode).toBe(409);
    expect(stale.body).toMatchObject({ error: 'version-conflict', currentVersion: 1 });

    const ok = await call({
      method: 'PATCH',
      url: '/api/ledger-snapshot?resource=transactions&id=a',
      headers: adminHeaders(),
      body: { transaction: { ...body.transaction, amount: 1000 }, expectedVersion: 1 },
    });
    expect(ok.body.transaction).toMatchObject({ amount: 1000, balance: 44000, version: 2 });

    const del = await call({
      method: 'DELETE',
      url: '/api/ledger-snapshot?resource=transactions&id=a&expectedVersion=2',
      headers: adminHeaders(),
    });
    expect(del.statusCode).toBe(200);
    expect(db.tables.ledger_transactions).toHaveLength(0);
  });

  it('returns 400 for invalid input and 405 for unsupported combinations', async () => {
    const bad = await call({
      method: 'POST',
      url: '/api/ledger-snapshot?resource=transactions',
      headers: adminHeaders(),
      body: { transaction: { id: 'a', date: 'x', category: 'c', amount: 1 } },
    });
    expect(bad.statusCode).toBe(400);
    const wrong = await call({ method: 'PUT', url: '/api/ledger-snapshot?resource=transactions', headers: adminHeaders(), body: {} });
    expect(wrong.statusCode).toBe(405);
  });

  it('returns 501 when the service role key is not configured', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const res = await call({ method: 'POST', url: '/api/ledger-snapshot?resource=transactions', headers: adminHeaders(), body });
    expect(res.statusCode).toBe(501);
  });

  it('bulk replace without confirmation is refused', async () => {
    const res = await call({
      method: 'POST',
      url: '/api/ledger-snapshot?resource=transactions-bulk',
      headers: adminHeaders(),
      body: { transactions: [body.transaction], mode: 'replace' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('confirm-required');
  });
});
