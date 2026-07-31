import { describe, expect, it, vi } from 'vitest';
import handler from '../api/academizer.js';
import { resolveAcademizerUpstream } from '../server/api-utils/academizerUpstream.js';

function mockRes() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    setHeader(k, v) {
      this.headers[k] = v;
    },
    end(chunk) {
      this.body = chunk;
    },
  };
}

function parseBody(res) {
  return JSON.parse(res.body || '{}');
}

describe('academizerUpstream', () => {
  it('uses PPT_ACADEMIZER_API_URL when set', () => {
    const cfg = resolveAcademizerUpstream({
      PPT_ACADEMIZER_API_URL: 'https://ppt-academizer-api.onrender.com/',
    });
    expect(cfg.configured).toBe(true);
    expect(cfg.apiBase).toBe('https://ppt-academizer-api.onrender.com');
  });

  it('falls back to local default outside production', () => {
    const cfg = resolveAcademizerUpstream({ NODE_ENV: 'development' });
    expect(cfg.configured).toBe(true);
    expect(cfg.apiBase).toBe('http://127.0.0.1:8766');
  });

  it('is unconfigured in production without URL', () => {
    const cfg = resolveAcademizerUpstream({ NODE_ENV: 'production' });
    expect(cfg.configured).toBe(false);
  });
});

describe('academizer API health', () => {
  it('returns 503 when upstream is not configured', async () => {
    const req = {
      method: 'GET',
      url: '/api/academizer?action=health',
      headers: { origin: 'http://localhost:3000' },
    };
    const res = mockRes();
    await handler(req, res, { env: { NODE_ENV: 'production' } });
    expect(res.statusCode).toBe(503);
    expect(parseBody(res).available).toBe(false);
  });

  it('proxies upstream health and exposes apiBase', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        ok: true,
        template_configured: true,
        service_version: '1.6.5',
        max_upload_mb: 50,
        standard_max_slides: 40,
      }),
    }));
    const req = {
      method: 'GET',
      url: '/api/academizer?action=health',
      headers: { origin: 'https://edu-team-tms-ten.vercel.app' },
    };
    const res = mockRes();
    await handler(req, res, {
      env: { PPT_ACADEMIZER_API_URL: 'https://example-api.test' },
      fetchImpl,
    });
    expect(res.statusCode).toBe(200);
    const body = parseBody(res);
    expect(body.available).toBe(true);
    expect(body.apiBase).toBe('https://example-api.test');
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://example-api.test/health',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('marks unavailable when template is missing', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true, template_configured: false }),
    }));
    const res = mockRes();
    await handler(
      {
        method: 'GET',
        url: '/api/academizer?action=health',
        headers: { origin: 'http://localhost:3000' },
      },
      res,
      { env: { PPT_ACADEMIZER_API_URL: 'https://example-api.test' }, fetchImpl }
    );
    expect(res.statusCode).toBe(200);
    expect(parseBody(res).available).toBe(false);
  });
});
