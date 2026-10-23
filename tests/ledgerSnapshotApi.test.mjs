import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAdminSessionCookie } from '../server/api-utils/adminSession.js';

const blobPut = vi.fn();
vi.mock('@vercel/blob', () => ({ put: (...a) => blobPut(...a), head: vi.fn(), del: vi.fn(), list: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from: () => { throw new Error('db must not be touched'); } }) }));

function createRes() {
  return {
    statusCode: 200,
    headers: {},
    setHeader(k, v) {
      this.headers[k.toLowerCase()] = v;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

async function call(req) {
  const handler = (await import('../api/ledger-snapshot.js')).default;
  const res = createRes();
  await handler({ headers: {}, ...req }, res);
  return res;
}

describe('ledger-snapshot API after the Blob removal', () => {
  beforeEach(() => {
    vi.resetModules();
    blobPut.mockReset();
    process.env.TMS_ADMIN_GATE_PASSWORD = 'secret-gate';
    process.env.TMS_ADMIN_SESSION_SECRET = 'session-secret';
    process.env.BLOB_READ_WRITE_TOKEN = 'test-token';
    delete process.env.LEDGER_PUBLISH_SECRET;
  });

  it('GET answers 404 "snapshot not found" (the deploy smoke check accepts exactly this)', async () => {
    const res = await call({ method: 'GET', url: '/api/ledger-snapshot' });
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('snapshot not found');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(blobPut).not.toHaveBeenCalled();
  });

  it('the old snapshot-overwrite POST is gone, even with a valid admin session or publish key', async () => {
    process.env.LEDGER_PUBLISH_SECRET = 'publish-secret';
    const body = { transactions: [{ id: 'malicious' }] };
    const adminSession = await call({
      method: 'POST',
      url: '/api/ledger-snapshot',
      headers: { referer: 'https://edu-team-tms-ten.vercel.app/admin', cookie: createAdminSessionCookie().split(';')[0] },
      body,
    });
    const publishKey = await call({
      method: 'POST',
      url: '/api/ledger-snapshot',
      headers: { 'x-ledger-publish-key': 'publish-secret' },
      body,
    });
    for (const res of [adminSession, publishKey]) {
      expect(res.statusCode).toBe(410);
      expect(res.body.error).toBe('blob-publish-removed');
    }
    expect(blobPut).not.toHaveBeenCalled();
  });

  it('rejects unsupported methods with 405', async () => {
    const res = await call({ method: 'OPTIONS', url: '/api/ledger-snapshot' });
    expect(res.statusCode).toBe(405);
  });

  it('no longer imports the Blob client at all', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync('api/ledger-snapshot.js', 'utf8');
    expect(src).not.toMatch(/@vercel\/blob|blobClient|putWithRetry|live-latest/);
  });
});
