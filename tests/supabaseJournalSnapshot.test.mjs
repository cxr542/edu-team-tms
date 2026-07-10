import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

async function loadModule() {
  vi.resetModules();
  return import('../src/utils/supabaseJournalSnapshot.js');
}

describe('supabaseJournalSnapshot admin API client', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          status: 'ok',
          message: 'Journal snapshot saved to Supabase.',
          data: {
            member_code: 'B',
            payload: { days: {} },
            payload_version: 1,
            updated_at: '2026-07-09T00:00:00.000Z',
          },
        }),
      }))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns an error when saving without a memberCode', async () => {
    const mod = await loadModule();
    await expect(
      mod.saveJournalSnapshotToSupabase({ payload: { days: {} } })
    ).resolves.toMatchObject({
      ok: false,
      status: 'error',
      message: 'memberCode is required.',
    });
  });

  it('returns an error when payload is missing', async () => {
    const mod = await loadModule();
    await expect(mod.saveJournalSnapshotToSupabase({ memberCode: 'B' })).resolves.toMatchObject({
      ok: false,
      status: 'error',
      message: 'payload is required.',
    });
  });

  it('POSTs to /api/journal-snapshots with credentials', async () => {
    const mod = await loadModule();
    await expect(
      mod.saveJournalSnapshotToSupabase({
        memberCode: ' B ',
        payload: { days: {} },
        updatedAt: '2026-07-09T00:00:00.000Z',
      })
    ).resolves.toMatchObject({
      ok: true,
      status: 'ok',
      data: { member_code: 'B' },
    });

    expect(fetch).toHaveBeenCalledWith(
      '/api/journal-snapshots',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      })
    );
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body).toMatchObject({
      memberCode: 'B',
      payload: { days: {} },
      updatedAt: '2026-07-09T00:00:00.000Z',
    });
  });

  it('omits updatedAt when the caller has no member-specific timestamp', async () => {
    const mod = await loadModule();
    await mod.saveJournalSnapshotToSupabase({
      memberCode: 'B',
      payload: { days: {} },
      updatedAt: null,
    });

    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body).toMatchObject({
      memberCode: 'B',
      payload: { days: {} },
    });
    expect(body).not.toHaveProperty('updatedAt');
  });

  it('GETs /api/journal-snapshots?memberCode=', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        status: 'ok',
        message: 'Journal snapshot loaded from Supabase.',
        data: { member_code: 'A', payload: {}, payload_version: 1, updated_at: null },
      }),
    });
    const mod = await loadModule();
    await expect(mod.getJournalSnapshotFromSupabase('A')).resolves.toMatchObject({
      ok: true,
      status: 'ok',
      data: { member_code: 'A' },
    });
    expect(fetch).toHaveBeenCalledWith(
      '/api/journal-snapshots?memberCode=A',
      expect.objectContaining({ method: 'GET', credentials: 'include' })
    );
  });

  it('maps 403 to forbidden', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ ok: false, status: 'forbidden', message: 'need admin' }),
    });
    const mod = await loadModule();
    await expect(
      mod.saveJournalSnapshotToSupabase({ memberCode: 'A', payload: {} })
    ).resolves.toMatchObject({
      ok: false,
      status: 'forbidden',
    });
  });

  it('maps 409 to conflict with remote data', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({
        ok: false,
        status: 'conflict',
        message: 'remote newer',
        data: {
          member_code: 'A',
          payload: { days: {} },
          payload_version: 1,
          updated_at: '2026-07-09T12:00:00.000Z',
        },
      }),
    });
    const mod = await loadModule();
    await expect(
      mod.saveJournalSnapshotToSupabase({
        memberCode: 'A',
        payload: { days: {} },
        updatedAt: '2026-07-09T11:00:00.000Z',
      })
    ).resolves.toMatchObject({
      ok: false,
      status: 'conflict',
      message: 'remote newer',
      data: { member_code: 'A', updated_at: '2026-07-09T12:00:00.000Z' },
    });
  });

  it('builds a single-member remote snapshot from Supabase row data', async () => {
    const mod = await loadModule();
    const snapshot = mod.buildMemberRemoteSnapshotFromSupabase('B', {
      member_code: 'B',
      payload: {
        days: {
          '2026-07-09': {
            tasks: [{ id: 't1', title: 'from supabase', hours: 1 }],
          },
        },
      },
      updated_at: '2026-07-09T12:00:00.000Z',
    });

    expect(snapshot.meta.memberUpdatedAt.B).toBe('2026-07-09T12:00:00.000Z');
    expect(snapshot.memberJournals.B.days['2026-07-09'].tasks[0].title).toBe('from supabase');
    expect(snapshot.memberJournals.A.days).toEqual({});
  });
});
