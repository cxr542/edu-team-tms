import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAdminSessionCookie } from '../server/api-utils/adminSession.js';

const fromMock = vi.fn();

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
  const mod = await import('../api/announcement-comments.js');
  return mod.default;
}

describe('announcement-comments API', () => {
  beforeEach(() => {
    vi.resetModules();
    fromMock.mockReset();
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.TMS_ADMIN_GATE_PASSWORD = 'secret-gate';
    process.env.TMS_ADMIN_SESSION_SECRET = 'session-secret';
  });

  it('rejects empty body', async () => {
    fromMock.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { id: '11111111-1111-1111-1111-111111111111', is_published: true },
            error: null,
          }),
        }),
      }),
    });

    const handler = await loadHandler();
    const res = createRes();
    await handler(
      {
        method: 'POST',
        headers: { referer: 'https://edu-team-tms-ten.vercel.app/wschoi' },
        body: {
          announcementId: '11111111-1111-1111-1111-111111111111',
          memberCode: 'B',
          author: '최우성',
          body: '   ',
        },
      },
      res
    );
    expect(res.statusCode).toBe(400);
  });

  it('creates a comment for matching member', async () => {
    const announcementId = '11111111-1111-1111-1111-111111111111';
    fromMock
      .mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { id: announcementId, is_published: true },
              error: null,
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        insert: () => ({
          select: () => ({
            single: async () => ({
              data: {
                id: 'c1',
                announcement_id: announcementId,
                member_code: 'B',
                author: '최우성',
                body: '확인했습니다',
                is_deleted: false,
                created_at: '2026-07-15T00:00:00.000Z',
                updated_at: '2026-07-15T00:00:00.000Z',
              },
              error: null,
            }),
          }),
        }),
      });

    const handler = await loadHandler();
    const res = createRes();
    await handler(
      {
        method: 'POST',
        headers: { referer: 'https://edu-team-tms-ten.vercel.app/wschoi' },
        body: {
          announcementId,
          memberCode: 'B',
          author: '최우성',
          body: '확인했습니다',
        },
      },
      res
    );
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).data.body).toBe('확인했습니다');
  });

  it('rejects forged admin referer when deleting another member comment', async () => {
    const handler = await loadHandler();
    const res = createRes();
    await handler(
      {
        method: 'POST',
        headers: { referer: 'https://edu-team-tms-ten.vercel.app/admin' },
        body: { action: 'delete', commentId: 'c1', memberCode: 'A' },
      },
      res
    );
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).message).toMatch(/관리자 세션/);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('allows session-backed admin to soft-delete another member comment', async () => {
    const cookie = createAdminSessionCookie();
    fromMock
      .mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { id: 'c1', member_code: 'B', is_deleted: false },
              error: null,
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        update: () => ({
          eq: () => ({
            select: () => ({
              single: async () => ({
                data: {
                  id: 'c1',
                  announcement_id: 'a1',
                  member_code: 'B',
                  author: '최우성',
                  body: 'x',
                  is_deleted: true,
                  created_at: '2026-07-15T00:00:00.000Z',
                  updated_at: '2026-07-15T01:00:00.000Z',
                },
                error: null,
              }),
            }),
          }),
        }),
      });

    const handler = await loadHandler();
    const res = createRes();
    await handler(
      {
        method: 'POST',
        headers: {
          referer: 'https://edu-team-tms-ten.vercel.app/admin',
          cookie: cookie.split(';')[0],
        },
        body: { action: 'delete', commentId: 'c1', memberCode: 'A' },
      },
      res
    );
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).data.isDeleted).toBe(true);
  });
});
