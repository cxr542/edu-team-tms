import { describe, expect, it, vi } from 'vitest';

async function loadJournalSnapshotModule() {
  vi.resetModules();
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

  it('returns an error when memberCode is missing', async () => {
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
});
