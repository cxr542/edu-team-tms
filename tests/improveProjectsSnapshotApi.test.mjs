import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  IMPROVE_PROJECTS_LIVE_PATH,
  normalizeImproveProjectsSnapshot,
} from '../src/utils/improveProjectsCloudSnapshot.js';

const headMock = vi.fn();
const putMock = vi.fn();

vi.mock('@vercel/blob', () => ({
  head: (...args) => headMock(...args),
  put: (...args) => putMock(...args),
}));

function createRes() {
  const res = {
    statusCode: 200,
    headers: {},
    setHeader(key, value) {
      this.headers[key.toLowerCase()] = value;
    },
    end(body) {
      this.body = body;
    },
  };
  return res;
}

async function loadHandler() {
  const mod = await import('../api/improve-projects-snapshot.js');
  return mod.default;
}

describe('improve-projects-snapshot API', () => {
  beforeEach(() => {
    vi.resetModules();
    headMock.mockReset();
    putMock.mockReset();
    process.env.BLOB_READ_WRITE_TOKEN = 'test-token';
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        schemaVersion: 1,
        publishedAt: '2026-06-12T08:00:00.000Z',
        source: 'team-kpi-improve-projects',
        projects: [{ id: 'a', name: 'A', code: 'a' }],
        meta: { projectCount: 1, publishedBy: 'leader', app: 'edu-team-tms' },
      }),
    }));
  });

  it('GET returns empty snapshot when blob is missing', async () => {
    headMock.mockRejectedValue(new Error('not found'));
    const handler = await loadHandler();
    const req = { method: 'GET', headers: { referer: 'http://localhost:4173/' } };
    const res = createRes();
    await handler(req, res);
    const body = JSON.parse(res.body);
    expect(res.statusCode).toBe(200);
    expect(res.headers['x-improve-projects-source']).toBe('empty');
    expect(body.projects).toEqual([]);
  });

  it('GET returns blob snapshot when available', async () => {
    headMock.mockResolvedValue({ downloadUrl: 'https://blob.example/snap.json' });
    const handler = await loadHandler();
    const req = { method: 'GET', headers: { referer: 'http://localhost:4173/' } };
    const res = createRes();
    await handler(req, res);
    const body = JSON.parse(res.body);
    expect(res.statusCode).toBe(200);
    expect(res.headers['x-improve-projects-source']).toBe('blob');
    expect(body.projects).toHaveLength(1);
  });

  it('POST validates projects and writes live-latest only', async () => {
    putMock.mockResolvedValue({ url: 'https://blob.example/live.json' });
    const handler = await loadHandler();
    const req = {
      method: 'POST',
      headers: { referer: 'https://okestro-edu-team-tms.vercel.app/' },
      body: {
        projects: [{ id: 'team-kpi', name: '팀 KPI', code: 'team-kpi', ownerMemberId: 'B' }],
      },
    };
    const res = createRes();
    await handler(req, res);
    const body = JSON.parse(res.body);
    expect(res.statusCode).toBe(200);
    expect(body.ok).toBe(true);
    expect(putMock).toHaveBeenCalledTimes(1);
    const [pathname, content] = putMock.mock.calls[0];
    expect(pathname).toBe(IMPROVE_PROJECTS_LIVE_PATH);
    expect(pathname).not.toMatch(/live-\d/);
    const saved = JSON.parse(content);
    expect(saved.projects).toHaveLength(1);
    expect(normalizeImproveProjectsSnapshot(saved).projects[0].ownerMemberId).toBe('B');
  });

  it('POST rejects invalid payload', async () => {
    const handler = await loadHandler();
    const req = {
      method: 'POST',
      headers: { referer: 'https://okestro-edu-team-tms.vercel.app/' },
      body: { projects: [{ name: 'no id' }] },
    };
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(putMock).not.toHaveBeenCalled();
  });

  it('rejects disallowed referer', async () => {
    const handler = await loadHandler();
    const req = { method: 'GET', headers: { referer: 'https://evil.example/' } };
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(403);
  });

  it('returns 405 for unsupported methods', async () => {
    const handler = await loadHandler();
    const req = { method: 'DELETE', headers: { referer: 'http://localhost:4173/' } };
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });
});
