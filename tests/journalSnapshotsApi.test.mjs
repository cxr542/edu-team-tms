import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAdminSessionCookie } from '../server/api-utils/adminSession.js';

const fromMock = vi.fn();
const upsertMock = vi.fn();
const selectMock = vi.fn();
const eqMock = vi.fn();
const maybeSingleMock = vi.fn();
const singleMock = vi.fn();

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
  const mod = await import('../api/journal-snapshots.js');
  return mod.default;
}

describe('journal-snapshots API admin session', () => {
  beforeEach(() => {
    vi.resetModules();
    fromMock.mockReset();
    upsertMock.mockReset();
    selectMock.mockReset();
    eqMock.mockReset();
    maybeSingleMock.mockReset();
    singleMock.mockReset();
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.TMS_ADMIN_GATE_PASSWORD = 'secret-gate';
    process.env.TMS_ADMIN_SESSION_SECRET = 'session-secret';
  });

  it('rejects writes without a valid session cookie', async () => {
    const handler = await loadHandler();
    const req = {
      method: 'POST',
      headers: { referer: 'https://edu-team-tms-ten.vercel.app/admin' },
      body: { memberCode: 'A', payload: { days: {} } },
    };
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).status).toBe('forbidden');
  });

  it('saves a snapshot with a valid admin session', async () => {
    const saved = {
      member_code: 'A',
      payload: { days: {} },
      payload_version: 1,
      updated_at: '2026-07-09T00:00:00.000Z',
    };
    maybeSingleMock.mockResolvedValue({ data: null, error: null });
    eqMock.mockReturnValue({ maybeSingle: maybeSingleMock });
    singleMock.mockResolvedValue({ data: saved, error: null });
    selectMock
      .mockReturnValueOnce({ eq: eqMock })
      .mockReturnValueOnce({ single: singleMock });
    upsertMock.mockReturnValue({ select: selectMock });
    fromMock
      .mockReturnValueOnce({ select: selectMock })
      .mockReturnValueOnce({ upsert: upsertMock });

    const cookie = createAdminSessionCookie();
    const handler = await loadHandler();
    const req = {
      method: 'POST',
      headers: {
        referer: 'https://edu-team-tms-ten.vercel.app/admin?module=journal',
        cookie,
      },
      body: {
        memberCode: 'A',
        payload: { days: {} },
        updatedAt: saved.updated_at,
      },
    };
    const res = createRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({
      ok: true,
      status: 'ok',
      data: { member_code: 'A' },
    });
    expect(fromMock).toHaveBeenCalledWith('journal_snapshots');
    expect(upsertMock).toHaveBeenCalledWith(
      {
        member_code: 'A',
        payload: { days: {} },
        payload_version: 1,
        updated_at: saved.updated_at,
      },
      { onConflict: 'member_code' }
    );
  });

  it('rejects a stale snapshot write when Supabase has a newer row', async () => {
    const current = {
      member_code: 'B',
      payload: { days: { '2026-07-09': { tasks: [{ id: 'remote' }] } } },
      payload_version: 1,
      updated_at: '2026-07-09T12:00:00.000Z',
    };
    maybeSingleMock.mockResolvedValue({ data: current, error: null });
    eqMock.mockReturnValue({ maybeSingle: maybeSingleMock });
    selectMock.mockReturnValue({ eq: eqMock });
    fromMock.mockReturnValue({ select: selectMock });

    const cookie = createAdminSessionCookie();
    const handler = await loadHandler();
    const req = {
      method: 'POST',
      headers: {
        referer: 'https://edu-team-tms-ten.vercel.app/admin?module=journal',
        cookie,
      },
      body: {
        memberCode: 'B',
        payload: { days: {} },
        updatedAt: '2026-07-09T11:59:59.000Z',
      },
    };
    const res = createRes();
    await handler(req, res);

    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body)).toMatchObject({
      ok: false,
      status: 'conflict',
      data: { member_code: 'B', updated_at: current.updated_at },
    });
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it('loads a snapshot with a valid admin session', async () => {
    const row = {
      member_code: 'B',
      payload: { days: { '2026-07-01': {} } },
      payload_version: 1,
      updated_at: '2026-07-01T00:00:00.000Z',
    };
    maybeSingleMock.mockResolvedValue({ data: row, error: null });
    eqMock.mockReturnValue({ maybeSingle: maybeSingleMock });
    selectMock.mockReturnValue({ eq: eqMock });
    fromMock.mockReturnValue({ select: selectMock });

    const cookie = createAdminSessionCookie();
    const handler = await loadHandler();
    const req = {
      method: 'GET',
      query: { memberCode: 'B' },
      headers: {
        referer: 'https://edu-team-tms-ten.vercel.app/admin',
        cookie,
      },
    };
    const res = createRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({
      ok: true,
      status: 'ok',
      data: { member_code: 'B' },
    });
    expect(eqMock).toHaveBeenCalledWith('member_code', 'B');
  });
});
