import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ADMIN_SESSION_COOKIE,
  createAdminSessionCookie,
  hasValidAdminSession,
} from '../server/api-utils/adminSession.js';

const fromMock = vi.fn();
const upsertMock = vi.fn();
const selectMock = vi.fn();
const orderMock = vi.fn();
const eqMock = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (...args) => fromMock(...args),
  }),
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
  const mod = await import('../api/announcements.js');
  return mod.default;
}

function makeQuery(result) {
  const query = {
    order: orderMock.mockImplementation(() => query),
    eq: eqMock.mockImplementation(() => query),
    select: selectMock.mockImplementation(() => query),
    upsert: upsertMock.mockImplementation(() => query),
    single: vi.fn(async () => result),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return query;
}

describe('announcements API admin session', () => {
  beforeEach(() => {
    vi.resetModules();
    fromMock.mockReset();
    upsertMock.mockReset();
    selectMock.mockReset();
    orderMock.mockReset();
    eqMock.mockReset();
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.TMS_ADMIN_GATE_PASSWORD = 'secret-gate';
    process.env.TMS_ADMIN_SESSION_SECRET = 'session-secret';
  });

  it('rejects admin writes without a valid session cookie', async () => {
    const handler = await loadHandler();
    const req = {
      method: 'POST',
      headers: { referer: 'https://edu-team-tms-ten.vercel.app/admin' },
      body: {
        announcement: {
          id: 'ann-1',
          title: '공지',
          body: '본문',
          category: 'notice',
          author: '신혜윤',
          authorCode: 'C',
        },
      },
    };
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).status).toBe('forbidden');
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('allows admin writes with a valid session cookie', async () => {
    const cookie = createAdminSessionCookie();
    const query = makeQuery({
      data: {
        id: 'ann-1',
        title: '공지',
        body: '본문',
        category: 'notice',
        is_pinned: false,
        is_published: true,
        author: '신혜윤',
        author_code: 'C',
        created_at: '2026-07-03T00:00:00.000Z',
        updated_at: '2026-07-03T00:00:00.000Z',
        published_at: '2026-07-03T00:00:00.000Z',
      },
      error: null,
    });
    fromMock.mockReturnValue(query);

    const handler = await loadHandler();
    const req = {
      method: 'POST',
      headers: {
        referer: 'https://edu-team-tms-ten.vercel.app/admin',
        cookie: cookie.split(';')[0],
      },
      body: {
        announcement: {
          id: 'ann-1',
          title: '공지',
          body: '본문',
          category: 'notice',
          author: '신혜윤',
          authorCode: 'C',
          isPublished: true,
        },
      },
    };
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).ok).toBe(true);
    expect(fromMock).toHaveBeenCalledWith('announcements');
    expect(upsertMock).toHaveBeenCalled();
  });

  it('validates signed admin session cookies', () => {
    const cookie = createAdminSessionCookie();
    const value = decodeURIComponent(cookie.split('=')[1].split(';')[0]);
    expect(
      hasValidAdminSession({
        headers: { cookie: `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(value)}` },
      })
    ).toBe(true);
    expect(
      hasValidAdminSession({
        headers: { cookie: `${ADMIN_SESSION_COOKIE}=tampered` },
      })
    ).toBe(false);
  });
});
