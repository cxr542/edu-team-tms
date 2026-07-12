import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  const mod = await import('../api/journal-snapshot.js');
  return mod.default;
}

const bDay = {
  '2026-06-15': {
    holiday: false,
    mm: { work: 1, improve: 0, leave: 0 },
    tasks: [{ id: 'b-only', cat: 'other', title: 'B first share', plan: 1, actual: 1, done: true }],
  },
};

describe('journal-snapshot API', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.resetModules();
    headMock.mockReset();
    putMock.mockReset();
    process.env.BLOB_READ_WRITE_TOKEN = 'test-token';
    delete process.env.BLOB_STORE_ID;
    delete process.env.VITE_SUPABASE_MANUAL_MIRROR_ENABLED;
    delete process.env.VITE_JOURNAL_BLOB_POST_ENABLED;
    delete process.env.JOURNAL_BLOB_POST_ENABLED;
  });

  it('does not return bundled static data when configured Blob is empty', async () => {
    headMock.mockRejectedValue(new Error('not found'));
    const handler = await loadHandler();
    const req = { method: 'GET', headers: { referer: 'http://localhost:4173/' } };
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body)).toEqual({ error: 'snapshot not found' });
  });

  it('starts the first configured Blob save from an empty journal snapshot', async () => {
    headMock.mockRejectedValue(new Error('not found'));
    putMock.mockResolvedValue({ url: 'https://blob.example/journal/live-latest.json' });
    const handler = await loadHandler();
    const req = {
      method: 'POST',
      headers: { referer: 'http://localhost:4173/wschoi' },
      body: {
        memberCode: 'B',
        updatedAt: '2026-06-15T09:00:00.000Z',
        journal: { days: bDay },
      },
    };
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(putMock).toHaveBeenCalledTimes(1);
    const [, content] = putMock.mock.calls[0];
    const saved = JSON.parse(content);
    expect(Object.keys(saved.memberJournals.A.days)).toHaveLength(0);
    expect(saved.memberJournals.B.days['2026-06-15'].tasks[0].title).toBe('B first share');
    expect(saved.meta.memberUpdatedAt.B).toBe('2026-06-15T09:00:00.000Z');
  });

  it('rejects saving a member slice from a different member route', async () => {
    headMock.mockRejectedValue(new Error('not found'));
    const handler = await loadHandler();
    const req = {
      method: 'POST',
      headers: { referer: 'http://localhost:4173/wschoi' },
      body: {
        memberCode: 'C',
        updatedAt: '2026-06-15T09:00:00.000Z',
        journal: { days: bDay },
      },
    };
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).error).toBe('journal-member-forbidden');
    expect(headMock).not.toHaveBeenCalled();
    expect(putMock).not.toHaveBeenCalled();
  });

  it('rejects empty journal team-share saves (J7b)', async () => {
    headMock.mockRejectedValue(new Error('not found'));
    const handler = await loadHandler();
    const req = {
      method: 'POST',
      headers: { referer: 'http://localhost:4173/wschoi' },
      body: {
        memberCode: 'B',
        updatedAt: '2026-06-15T09:00:00.000Z',
        journal: { days: {} },
      },
    };
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toBe('journal-empty-payload');
    expect(putMock).not.toHaveBeenCalled();
  });

  it('rejects far-future updatedAt before reading or writing Blob', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-09T03:00:00.000Z'));

    const handler = await loadHandler();
    const req = {
      method: 'POST',
      headers: { referer: 'http://localhost:4173/wschoi' },
      body: {
        memberCode: 'B',
        updatedAt: '2099-01-01T00:00:00.000Z',
        journal: { days: bDay },
      },
    };
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toBe('invalid-updated-at');
    expect(headMock).not.toHaveBeenCalled();
    expect(putMock).not.toHaveBeenCalled();
  });

  it('clamps slightly future updatedAt to server time before saving Blob', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-09T03:00:00.000Z'));
    headMock.mockRejectedValue(new Error('not found'));
    putMock.mockResolvedValue({ url: 'https://blob.example/journal/live-latest.json' });
    const handler = await loadHandler();
    const req = {
      method: 'POST',
      headers: { referer: 'http://localhost:4173/wschoi' },
      body: {
        memberCode: 'B',
        updatedAt: '2026-07-09T03:02:00.000Z',
        journal: { days: bDay },
      },
    };
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const [, content] = putMock.mock.calls[0];
    const saved = JSON.parse(content);
    expect(saved.meta.updatedAt).toBe('2026-07-09T03:00:00.000Z');
    expect(saved.meta.memberUpdatedAt.B).toBe('2026-07-09T03:00:00.000Z');
  });

  it('rejects Blob POST when MANUAL_MIRROR demotes writes (J7d)', async () => {
    process.env.VITE_SUPABASE_MANUAL_MIRROR_ENABLED = 'true';
    headMock.mockRejectedValue(new Error('not found'));
    const handler = await loadHandler();
    const req = {
      method: 'POST',
      headers: { referer: 'http://localhost:4173/wschoi' },
      body: {
        memberCode: 'B',
        updatedAt: '2026-06-15T09:00:00.000Z',
        journal: { days: bDay },
      },
    };
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(501);
    expect(JSON.parse(res.body).error).toBe('journal-blob-post-disabled');
    expect(putMock).not.toHaveBeenCalled();
  });

  it('allows Blob POST rollback via JOURNAL_BLOB_POST_ENABLED=true (J7d)', async () => {
    process.env.VITE_SUPABASE_MANUAL_MIRROR_ENABLED = 'true';
    process.env.JOURNAL_BLOB_POST_ENABLED = 'true';
    headMock.mockRejectedValue(new Error('not found'));
    putMock.mockResolvedValue({ url: 'https://blob.example/journal/live-latest.json' });
    const handler = await loadHandler();
    const req = {
      method: 'POST',
      headers: { referer: 'http://localhost:4173/wschoi' },
      body: {
        memberCode: 'B',
        updatedAt: '2026-06-15T09:00:00.000Z',
        journal: { days: bDay },
      },
    };
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(putMock).toHaveBeenCalledTimes(1);
  });
});
