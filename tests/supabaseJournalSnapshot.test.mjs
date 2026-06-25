import { describe, expect, it, vi } from 'vitest';

async function loadJournalSnapshotModule() {
  vi.resetModules();
  return import('../src/utils/supabaseJournalSnapshot.js');
}

async function loadJournalSnapshotModuleWithClient(client) {
  vi.resetModules();
  vi.doMock('../src/constants/supabaseSync.js', () => ({
    SUPABASE_MANUAL_MIRROR_ENABLED: true,
    SUPABASE_MANUAL_MIRROR_DISABLED_MESSAGE: 'disabled',
  }));
  vi.doMock('../src/utils/supabaseClient.js', () => ({
    isSupabaseConfigured: true,
    getSupabaseClient: () => client,
  }));
  return import('../src/utils/supabaseJournalSnapshot.js');
}

describe('Supabase journal snapshot utility', () => {
  it('returns disabled when Supabase env vars are not configured', async () => {
    const mod = await loadJournalSnapshotModule();

    await expect(
      mod.saveJournalSnapshotToSupabase({ memberCode: 'B', payload: { days: {} } }),
    ).resolves.toMatchObject({
      ok: false,
      status: 'disabled',
    });

    await expect(mod.getJournalSnapshotFromSupabase('B')).resolves.toMatchObject({
      ok: false,
      status: 'disabled',
    });
  });

  it('returns an error when saving without a memberCode', async () => {
    const mod = await loadJournalSnapshotModule();

    await expect(
      mod.saveJournalSnapshotToSupabase({ payload: { days: {} } }),
    ).resolves.toMatchObject({
      ok: false,
      status: 'error',
      message: 'memberCode is required.',
      data: null,
    });
  });

  it('returns an error when loading without a memberCode', async () => {
    const mod = await loadJournalSnapshotModule();

    await expect(mod.getJournalSnapshotFromSupabase()).resolves.toMatchObject({
      ok: false,
      status: 'error',
      message: 'memberCode is required.',
      data: null,
    });
  });

  it('returns an error when payload is missing', async () => {
    const mod = await loadJournalSnapshotModule();

    await expect(
      mod.saveJournalSnapshotToSupabase({ memberCode: 'B' }),
    ).resolves.toMatchObject({
      ok: false,
      status: 'error',
      message: 'payload is required.',
      data: null,
    });
  });

  it('saves a journal snapshot when Supabase returns data', async () => {
    const savedSnapshot = {
      member_code: 'B',
      payload: { days: { '2026-06-24': { title: 'Journal entry' } } },
      payload_version: 1,
      updated_at: '2026-06-24T00:00:00.000Z',
    };
    const single = vi.fn().mockResolvedValue({ data: savedSnapshot, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const upsert = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ upsert });
    const mod = await loadJournalSnapshotModuleWithClient({ from });

    await expect(
      mod.saveJournalSnapshotToSupabase({
        memberCode: ' B ',
        payload: savedSnapshot.payload,
        updatedAt: savedSnapshot.updated_at,
      }),
    ).resolves.toEqual({
      ok: true,
      status: 'ok',
      message: 'Journal snapshot saved to Supabase.',
      data: savedSnapshot,
    });

    expect(from).toHaveBeenCalledWith('journal_snapshots');
    expect(upsert).toHaveBeenCalledWith(
      {
        member_code: 'B',
        payload: savedSnapshot.payload,
        payload_version: 1,
        updated_at: savedSnapshot.updated_at,
      },
      { onConflict: 'member_code' },
    );
    expect(select).toHaveBeenCalledWith();
    expect(single).toHaveBeenCalledWith();
  });

  it('returns a database error when saving a journal snapshot fails', async () => {
    const databaseError = { message: 'upsert failed' };
    const single = vi.fn().mockResolvedValue({ data: null, error: databaseError });
    const select = vi.fn().mockReturnValue({ single });
    const upsert = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ upsert });
    const mod = await loadJournalSnapshotModuleWithClient({ from });

    await expect(
      mod.saveJournalSnapshotToSupabase({ memberCode: 'B', payload: { days: {} } }),
    ).resolves.toEqual({
      ok: false,
      status: 'error',
      message: 'upsert failed',
      data: null,
    });
  });

  it('loads a journal snapshot when Supabase returns data', async () => {
    const snapshot = {
      member_code: 'B',
      payload: { days: { '2026-06-24': { title: 'Journal entry' } } },
      payload_version: 1,
      updated_at: '2026-06-24T00:00:00.000Z',
    };
    const maybeSingle = vi.fn().mockResolvedValue({ data: snapshot, error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const mod = await loadJournalSnapshotModuleWithClient({ from });

    await expect(mod.getJournalSnapshotFromSupabase(' B ')).resolves.toEqual({
      ok: true,
      status: 'ok',
      message: 'Journal snapshot loaded from Supabase.',
      data: snapshot,
    });

    expect(from).toHaveBeenCalledWith('journal_snapshots');
    expect(select).toHaveBeenCalledWith('member_code, payload, payload_version, updated_at');
    expect(eq).toHaveBeenCalledWith('member_code', 'B');
    expect(maybeSingle).toHaveBeenCalledWith();
  });

  it('returns a database error when loading a journal snapshot fails', async () => {
    const databaseError = { message: 'read failed' };
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: databaseError });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const mod = await loadJournalSnapshotModuleWithClient({ from });

    await expect(mod.getJournalSnapshotFromSupabase('B')).resolves.toEqual({
      ok: false,
      status: 'error',
      message: 'read failed',
      data: null,
    });
  });
});
