import { beforeEach, describe, expect, it, vi } from 'vitest';

const putMock = vi.fn();

vi.mock('@vercel/blob', () => ({
  put: (...args) => putMock(...args),
}));

function createRes() {
  return {
    statusCode: 200,
    headers: {},
    setHeader(key, value) {
      this.headers[key.toLowerCase()] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = JSON.stringify(body);
      return this;
    },
  };
}

async function loadHandler() {
  const mod = await import('../api/ledger-snapshot.js');
  return mod.default;
}

describe('ledger-snapshot API write scope', () => {
  beforeEach(() => {
    vi.resetModules();
    putMock.mockReset();
    process.env.BLOB_READ_WRITE_TOKEN = 'test-token';
    delete process.env.BLOB_STORE_ID;
    delete process.env.LEDGER_PUBLISH_SECRET;
  });

  it('rejects member-scoped POSTs before writing Blob', async () => {
    const handler = await loadHandler();
    const req = {
      method: 'POST',
      headers: { referer: 'https://edu-team-tms-ten.vercel.app/wschoi?module=ledger' },
      body: { transactions: [{ id: 'malicious' }] },
    };
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).error).toBe('forbidden');
    expect(putMock).not.toHaveBeenCalled();
  });

  it('allows admin-scoped POSTs', async () => {
    putMock.mockResolvedValue({ url: 'https://blob.example/ledger/live-latest.json' });
    const handler = await loadHandler();
    const req = {
      method: 'POST',
      headers: { referer: 'https://edu-team-tms-ten.vercel.app/admin' },
      body: { transactions: [{ id: 'admin-save' }], publishedAt: '2026-06-29T00:00:00.000Z' },
    };
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).ok).toBe(true);
    expect(putMock).toHaveBeenCalledTimes(1);
  });

  it('keeps publish-secret POSTs working without a referer', async () => {
    process.env.LEDGER_PUBLISH_SECRET = 'secret';
    putMock.mockResolvedValue({ url: 'https://blob.example/ledger/live-latest.json' });
    const handler = await loadHandler();
    const req = {
      method: 'POST',
      headers: { 'x-ledger-publish-key': 'secret' },
      body: { transactions: [{ id: 'script-save' }] },
    };
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(putMock).toHaveBeenCalledTimes(1);
  });
});
