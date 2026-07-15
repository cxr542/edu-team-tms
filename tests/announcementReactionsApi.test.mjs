import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  const mod = await import('../api/announcement-reactions.js');
  return mod.default;
}

describe('announcement-reactions API', () => {
  beforeEach(() => {
    vi.resetModules();
    fromMock.mockReset();
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
  });

  it('rejects bad origin', async () => {
    const handler = await loadHandler();
    const res = createRes();
    await handler(
      {
        method: 'POST',
        headers: { referer: 'https://evil.example/' },
        body: { announcementId: 'a', memberCode: 'A', emoji: '👍' },
      },
      res
    );
    expect(res.statusCode).toBe(403);
  });

  it('rejects unsupported emoji', async () => {
    const handler = await loadHandler();
    const res = createRes();
    await handler(
      {
        method: 'POST',
        headers: { referer: 'https://edu-team-tms-ten.vercel.app/yhkim' },
        body: { announcementId: '11111111-1111-1111-1111-111111111111', memberCode: 'A', emoji: '🔥' },
      },
      res
    );
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).message).toMatch(/emoji/i);
  });

  it('rejects member reacting on unpublished announcement', async () => {
    fromMock.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { id: '11111111-1111-1111-1111-111111111111', is_published: false },
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
        headers: { referer: 'https://edu-team-tms-ten.vercel.app/yhkim' },
        body: {
          announcementId: '11111111-1111-1111-1111-111111111111',
          memberCode: 'A',
          emoji: '👍',
        },
      },
      res
    );
    expect(res.statusCode).toBe(403);
  });

  it('toggles reaction insert for member', async () => {
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
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        insert: async () => ({ error: null }),
      })
      .mockReturnValueOnce({
        select: () => ({
          eq: async () => ({
            data: [{ announcement_id: announcementId, member_code: 'A', emoji: '👍' }],
            error: null,
          }),
        }),
      });

    const handler = await loadHandler();
    const res = createRes();
    await handler(
      {
        method: 'POST',
        headers: { referer: 'https://edu-team-tms-ten.vercel.app/yhkim' },
        body: { announcementId, memberCode: 'A', emoji: '👍' },
      },
      res
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.ok).toBe(true);
    expect(body.data['👍'].count).toBe(1);
    expect(body.data['👍'].mine).toBe(true);
  });

  it('lists aggregated reactions', async () => {
    fromMock.mockReturnValueOnce({
      select: () => ({
        in: async () => ({
          data: [
            { announcement_id: 'a1', member_code: 'A', emoji: '👍' },
            { announcement_id: 'a1', member_code: 'B', emoji: '👍' },
          ],
          error: null,
        }),
      }),
    });

    const handler = await loadHandler();
    const res = createRes();
    await handler(
      {
        method: 'GET',
        headers: { referer: 'https://edu-team-tms-ten.vercel.app/yhkim' },
        url: '/api/announcement-reactions?announcementIds=a1&memberCode=A',
        query: { announcementIds: 'a1', memberCode: 'A' },
      },
      res
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.a1['👍'].count).toBe(2);
    expect(body.data.a1['👍'].mine).toBe(true);
  });
});
