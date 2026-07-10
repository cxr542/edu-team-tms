import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAdminSessionCookie } from '../server/api-utils/adminSession.js';

const fromMock = vi.fn();
const insertMock = vi.fn();
const updateMock = vi.fn();
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

function mockSyncEventInsert() {
  const syncInsert = vi.fn().mockResolvedValue({ data: null, error: null });
  fromMock.mockReturnValueOnce({ insert: syncInsert });
  return syncInsert;
}

function mockEmptyReadThenInsert(saved) {
  const readMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const readEq = vi.fn().mockReturnValue({ maybeSingle: readMaybeSingle });
  const insertSingle = vi.fn().mockResolvedValue({ data: saved, error: null });
  const insertSelect = vi.fn().mockReturnValue({ single: insertSingle });
  insertMock.mockReturnValue({ select: insertSelect });

  fromMock
    .mockReturnValueOnce({ select: vi.fn().mockReturnValue({ eq: readEq }) })
    .mockReturnValueOnce({ insert: insertMock });

  const syncInsert = mockSyncEventInsert();
  return { readMaybeSingle, insertSingle, syncInsert };
}

function mockCurrentReadThenUpdate(current, saved) {
  const readMaybeSingle = vi.fn().mockResolvedValue({ data: current, error: null });
  const readEq = vi.fn().mockReturnValue({ maybeSingle: readMaybeSingle });
  const updateMaybeSingle = vi.fn().mockResolvedValue({ data: saved, error: null });
  const updateSelect = vi.fn().mockReturnValue({ maybeSingle: updateMaybeSingle });
  const updateEqUpdatedAt = vi.fn().mockReturnValue({ select: updateSelect });
  const updateEqMember = vi.fn().mockReturnValue({ eq: updateEqUpdatedAt });
  updateMock.mockReturnValue({ eq: updateEqMember });

  fromMock
    .mockReturnValueOnce({ select: vi.fn().mockReturnValue({ eq: readEq }) })
    .mockReturnValueOnce({ update: updateMock });

  const syncInsert = mockSyncEventInsert();
  return { updateEqMember, updateEqUpdatedAt, updateMaybeSingle, syncInsert };
}

describe('journal-snapshots API admin session', () => {
  beforeEach(() => {
    vi.resetModules();
    fromMock.mockReset();
    insertMock.mockReset();
    updateMock.mockReset();
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

  it('inserts a snapshot when no remote row exists', async () => {
    const payload = { days: { '2026-07-09': { tasks: [{ id: 'a1', title: 'task' }] } } };
    const saved = {
      member_code: 'A',
      payload,
      payload_version: 1,
      updated_at: '2026-07-09T00:00:00.000Z',
    };
    mockEmptyReadThenInsert(saved);

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
        payload,
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
    expect(insertMock).toHaveBeenCalledWith({
      member_code: 'A',
      payload,
      payload_version: 1,
      updated_at: saved.updated_at,
    });
    expect(fromMock).toHaveBeenCalledWith('sync_events');
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('still saves when sync_events audit insert fails (J7e best-effort)', async () => {
    const payload = { days: { '2026-07-09': { tasks: [{ id: 'a2', title: 'task' }] } } };
    const saved = {
      member_code: 'A',
      payload,
      payload_version: 1,
      updated_at: '2026-07-09T04:00:00.000Z',
    };
    const readMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const readEq = vi.fn().mockReturnValue({ maybeSingle: readMaybeSingle });
    const insertSingle = vi.fn().mockResolvedValue({ data: saved, error: null });
    const insertSelect = vi.fn().mockReturnValue({ single: insertSingle });
    insertMock.mockReturnValue({ select: insertSelect });
    const syncInsert = vi.fn().mockResolvedValue({ data: null, error: { message: 'no grant' } });

    fromMock
      .mockReturnValueOnce({ select: vi.fn().mockReturnValue({ eq: readEq }) })
      .mockReturnValueOnce({ insert: insertMock })
      .mockReturnValueOnce({ insert: syncInsert });

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
        payload,
        updatedAt: saved.updated_at,
      },
    };
    const res = createRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).ok).toBe(true);
    expect(syncInsert).toHaveBeenCalledWith({
      source: 'journal',
      member_code: 'A',
      event_type: 'snapshot_updated',
      payload: { updated_at: saved.updated_at },
    });
  });

  it('updates with optimistic lock when remote row exists and is not newer', async () => {
    const current = {
      member_code: 'A',
      payload: { days: { old: true } },
      payload_version: 1,
      updated_at: '2026-07-09T00:00:00.000Z',
    };
    const saved = {
      ...current,
      payload: { days: { new: true } },
      updated_at: '2026-07-09T01:00:00.000Z',
    };
    const { updateEqMember, updateEqUpdatedAt } = mockCurrentReadThenUpdate(current, saved);

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
        payload: { days: { new: true } },
        updatedAt: saved.updated_at,
      },
    };
    const res = createRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({
      ok: true,
      status: 'ok',
      data: { member_code: 'A', updated_at: saved.updated_at },
    });
    expect(updateMock).toHaveBeenCalledWith({
      payload: { days: { new: true } },
      payload_version: 1,
      updated_at: saved.updated_at,
    });
    expect(updateEqMember).toHaveBeenCalledWith('member_code', 'A');
    expect(updateEqUpdatedAt).toHaveBeenCalledWith('updated_at', current.updated_at);
    expect(insertMock).not.toHaveBeenCalled();
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
        payload: { days: { '2026-07-09': { tasks: [{ id: 'local' }] } } },
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
    expect(insertMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('returns conflict when optimistic lock update matches zero rows', async () => {
    const current = {
      member_code: 'A',
      payload: { days: { old: true } },
      payload_version: 1,
      updated_at: '2026-07-09T00:00:00.000Z',
    };
    const raced = {
      ...current,
      payload: { days: { winner: true } },
      updated_at: '2026-07-09T02:00:00.000Z',
    };

    const readMaybeSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: current, error: null })
      .mockResolvedValueOnce({ data: raced, error: null });
    const readEq = vi.fn().mockReturnValue({ maybeSingle: readMaybeSingle });
    const updateMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const updateSelect = vi.fn().mockReturnValue({ maybeSingle: updateMaybeSingle });
    const updateEqUpdatedAt = vi.fn().mockReturnValue({ select: updateSelect });
    const updateEqMember = vi.fn().mockReturnValue({ eq: updateEqUpdatedAt });
    updateMock.mockReturnValue({ eq: updateEqMember });

    fromMock
      .mockReturnValueOnce({ select: vi.fn().mockReturnValue({ eq: readEq }) })
      .mockReturnValueOnce({ update: updateMock })
      .mockReturnValueOnce({ select: vi.fn().mockReturnValue({ eq: readEq }) });

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
        payload: { days: { loser: true } },
        updatedAt: '2026-07-09T01:00:00.000Z',
      },
    };
    const res = createRes();
    await handler(req, res);

    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body)).toMatchObject({
      ok: false,
      status: 'conflict',
      data: { member_code: 'A', updated_at: raced.updated_at },
    });
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

describe('journal-snapshots API member referer (J7b)', () => {
  beforeEach(() => {
    vi.resetModules();
    fromMock.mockReset();
    insertMock.mockReset();
    updateMock.mockReset();
    selectMock.mockReset();
    eqMock.mockReset();
    maybeSingleMock.mockReset();
    singleMock.mockReset();
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.TMS_ADMIN_GATE_PASSWORD = 'secret-gate';
    process.env.TMS_ADMIN_SESSION_SECRET = 'session-secret';
  });

  it('allows B member route to insert own snapshot without admin session', async () => {
    const payload = {
      days: { '2026-07-09': { tasks: [{ id: 'b1', title: 'B share' }] } },
    };
    const saved = {
      member_code: 'B',
      payload,
      payload_version: 1,
      updated_at: '2026-07-09T03:00:00.000Z',
    };
    mockEmptyReadThenInsert(saved);

    const handler = await loadHandler();
    const req = {
      method: 'POST',
      headers: {
        referer: 'https://edu-team-tms-ten.vercel.app/wschoi?module=journal',
      },
      body: {
        memberCode: 'B',
        payload,
        updatedAt: saved.updated_at,
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
    expect(insertMock).toHaveBeenCalled();
  });

  it('rejects B member route writing C snapshot', async () => {
    const handler = await loadHandler();
    const req = {
      method: 'POST',
      headers: {
        referer: 'https://edu-team-tms-ten.vercel.app/wschoi?module=journal',
      },
      body: {
        memberCode: 'C',
        payload: { days: { '2026-07-09': { tasks: [{ id: 'c1' }] } } },
        updatedAt: '2026-07-09T03:00:00.000Z',
      },
    };
    const res = createRes();
    await handler(req, res);

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body)).toMatchObject({
      ok: false,
      status: 'forbidden',
    });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('rejects empty payload writes', async () => {
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
        updatedAt: '2026-07-09T00:00:00.000Z',
      },
    };
    const res = createRes();
    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body)).toMatchObject({
      ok: false,
      status: 'empty-payload',
    });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('allows B member route to GET own snapshot', async () => {
    const row = {
      member_code: 'B',
      payload: { days: { '2026-07-01': { tasks: [] } } },
      payload_version: 1,
      updated_at: '2026-07-01T00:00:00.000Z',
    };
    maybeSingleMock.mockResolvedValue({ data: row, error: null });
    eqMock.mockReturnValue({ maybeSingle: maybeSingleMock });
    selectMock.mockReturnValue({ eq: eqMock });
    fromMock.mockReturnValue({ select: selectMock });

    const handler = await loadHandler();
    const req = {
      method: 'GET',
      query: { memberCode: 'B' },
      headers: {
        referer: 'https://edu-team-tms-ten.vercel.app/wschoi',
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
  });

  it('allows B member route to GET team scope for peer pull (J7c)', async () => {
    const rows = [
      {
        member_code: 'A',
        payload: { days: { '2026-07-01': { tasks: [{ id: 'a1' }] } } },
        payload_version: 1,
        updated_at: '2026-07-01T00:00:00.000Z',
      },
      {
        member_code: 'B',
        payload: { days: { '2026-07-02': { tasks: [{ id: 'b1' }] } } },
        payload_version: 1,
        updated_at: '2026-07-02T00:00:00.000Z',
      },
    ];
    const inMock = vi.fn().mockResolvedValue({ data: rows, error: null });
    selectMock.mockReturnValue({ in: inMock });
    fromMock.mockReturnValue({ select: selectMock });

    const handler = await loadHandler();
    const req = {
      method: 'GET',
      query: { scope: 'team' },
      headers: {
        referer: 'https://edu-team-tms-ten.vercel.app/wschoi?module=journal',
      },
    };
    const res = createRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toMatchObject({ ok: true, status: 'ok' });
    expect(body.data.rows).toHaveLength(2);
    expect(body.data.rows.map((r) => r.member_code).sort()).toEqual(['A', 'B']);
    expect(inMock).toHaveBeenCalledWith('member_code', ['A', 'B', 'C']);
  });

  it('rejects team scope from non-member non-admin referer', async () => {
    const handler = await loadHandler();
    const req = {
      method: 'GET',
      query: { scope: 'team' },
      headers: {
        referer: 'https://edu-team-tms-ten.vercel.app/',
      },
    };
    const res = createRes();
    await handler(req, res);

    expect(res.statusCode).toBe(403);
    expect(fromMock).not.toHaveBeenCalled();
  });
});
