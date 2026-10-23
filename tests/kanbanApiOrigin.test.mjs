import { beforeEach, describe, expect, it, vi } from 'vitest';

const insertMock = vi.fn();
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({ order: async () => ({ data: [], error: null }) }),
      insert: (...a) => {
        insertMock(...a);
        return { select: () => ({ single: async () => ({ data: { id: 1, title: 't', status: 'todo', assignee: 'unassigned', category: 'other', plan_hours: 0, notes: '' }, error: null }) }) };
      },
      update: () => ({ eq: () => ({ select: () => ({ single: async () => ({ data: null, error: { message: 'not reached' } }) }) }) }),
      delete: () => ({ eq: async () => ({ error: null }) }),
    }),
  }),
}));

function makeReq({ method, headers = {}, url = '/api/kanban-tasks', body = '' }) {
  const handlers = {};
  return {
    method,
    url,
    headers: { host: 'edu-team-tms-ten.vercel.app', ...headers },
    on(ev, fn) {
      handlers[ev] = fn;
      if (ev === 'end') queueMicrotask(() => { handlers.data?.(body); handlers.end(); });
      return this;
    },
  };
}
function makeRes() {
  return {
    statusCode: 200,
    headers: {},
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    end(b) { this.body = b ? JSON.parse(b) : null; },
  };
}
async function call(req) {
  const handler = (await import('../api/kanban-tasks.js')).default;
  const res = makeRes();
  await handler(req, res);
  return res;
}

describe('kanban API requires an allowed origin for writes', () => {
  beforeEach(() => {
    vi.resetModules();
    insertMock.mockReset();
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    process.env.TMS_ADMIN_GATE_PASSWORD = 'secret-gate';
    process.env.TMS_ADMIN_SESSION_SECRET = 'session-secret';
  });

  it('rejects POST/PUT/DELETE with no Origin/Referer or a foreign one, without touching the table', async () => {
    for (const method of ['POST', 'PUT', 'DELETE']) {
      for (const headers of [{}, { origin: 'https://evil.example' }, { referer: 'https://evil.example/x' }]) {
        const res = await call(makeReq({ method, headers, body: '{"title":"x"}' }));
        expect(res.statusCode, `${method} ${JSON.stringify(headers)}`).toBe(403);
        expect(res.body.status).toBe('forbidden');
      }
    }
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('still lets the app create a card (same-origin browsers always send Origin on writes)', async () => {
    const res = await call(makeReq({ method: 'POST', headers: { origin: 'https://edu-team-tms-ten.vercel.app' }, body: '{"title":"카드"}' }));
    expect(res.statusCode).toBe(200);
    expect(insertMock).toHaveBeenCalledTimes(1);
  });

  it('keeps reads open and keeps reset/clear behind the admin session', async () => {
    expect((await call(makeReq({ method: 'GET' }))).statusCode).toBe(200);
    const reset = await call(makeReq({ method: 'DELETE', url: '/api/kanban-tasks?clear=true', headers: { origin: 'https://edu-team-tms-ten.vercel.app' } }));
    expect(reset.statusCode).toBe(403);
  });
});
