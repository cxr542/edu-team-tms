import { beforeEach, describe, expect, it, vi } from 'vitest';

const headMock = vi.fn();
const putMock = vi.fn();

vi.mock('@vercel/blob', () => ({
  head: (...args) => headMock(...args),
  put: (...args) => putMock(...args),
}));

function createRes() {
  return {
    statusCode: 200,
    headers: {},
    setHeader(key, value) {
      this.headers[key.toLowerCase()] = value;
    },
    end(body) {
      this.body = body;
    },
  };
}

async function loadHandler() {
  const mod = await import('../api/kpi-operational-snapshot.js');
  return mod.default;
}

function saveableCompetencyMonth() {
  return {
    self: { intLevel: 2 },
    selfUpdatedAt: '2026-06-29T00:00:00.000Z',
  };
}

describe('kpi-operational-snapshot API write scope', () => {
  beforeEach(() => {
    vi.resetModules();
    headMock.mockReset();
    putMock.mockReset();
    process.env.BLOB_READ_WRITE_TOKEN = 'test-token';
    delete process.env.BLOB_STORE_ID;
  });

  it('rejects cross-member POSTs from member-scoped routes before Blob access', async () => {
    const handler = await loadHandler();
    const req = {
      method: 'POST',
      headers: { referer: 'https://edu-team-tms-ten.vercel.app/wschoi?module=competency' },
      body: {
        memberCode: 'C',
        yearMonth: '2026-06',
        competencyMonth: saveableCompetencyMonth(),
        updatedAt: '2026-06-29T00:00:00.000Z',
      },
    };
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).error).toBe('kpi-operational-member-forbidden');
    expect(headMock).not.toHaveBeenCalled();
    expect(putMock).not.toHaveBeenCalled();
  });

  it('allows same-member POSTs from member-scoped routes', async () => {
    headMock.mockRejectedValue(new Error('not found'));
    putMock.mockResolvedValue({ url: 'https://blob.example/kpi-operational/live-latest.json' });
    const handler = await loadHandler();
    const req = {
      method: 'POST',
      headers: { referer: 'https://edu-team-tms-ten.vercel.app/wschoi?module=competency' },
      body: {
        memberCode: 'B',
        yearMonth: '2026-06',
        competencyMonth: saveableCompetencyMonth(),
        updatedAt: '2026-06-29T00:00:00.000Z',
      },
    };
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).ok).toBe(true);
    expect(putMock).toHaveBeenCalledTimes(1);
  });

  it('allows admin routes to save any member', async () => {
    headMock.mockRejectedValue(new Error('not found'));
    putMock.mockResolvedValue({ url: 'https://blob.example/kpi-operational/live-latest.json' });
    const handler = await loadHandler();
    const req = {
      method: 'POST',
      headers: { referer: 'https://edu-team-tms-ten.vercel.app/admin?module=competency' },
      body: {
        memberCode: 'C',
        yearMonth: '2026-06',
        competencyMonth: saveableCompetencyMonth(),
        updatedAt: '2026-06-29T00:00:00.000Z',
      },
    };
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).ok).toBe(true);
    expect(putMock).toHaveBeenCalledTimes(1);
  });
});
