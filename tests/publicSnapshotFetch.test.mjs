import { beforeEach, describe, expect, it, vi } from 'vitest';

let client;
let fetchFromSupabase;

vi.mock('../src/utils/supabaseClient.js', () => ({
  getSupabaseClient: () => client,
  isSupabaseConfigured: Boolean(client),
  supabase: client,
}));
vi.mock('../src/utils/ledgerSupabaseRead.js', () => ({
  fetchLedgerSnapshotFromSupabase: (...args) => fetchFromSupabase(...args),
}));

const snapshotPayload = {
  publishedAt: '2026-10-06T00:00:00.000Z',
  categories: [{ id: 'c1', label: '식비', matchKeywords: [] }],
  transactions: [{ id: 't1', category: '식비', amount: 1000, date: '2026-10-01' }],
};

async function load() {
  vi.resetModules();
  return import('../src/utils/publishSnapshot.js');
}

describe('fetchPublicSnapshot (Supabase only)', () => {
  beforeEach(() => {
    client = {};
    fetchFromSupabase = vi.fn().mockResolvedValue(snapshotPayload);
  });

  it('returns the snapshot read from Supabase', async () => {
    const { fetchPublicSnapshot } = await load();
    await expect(fetchPublicSnapshot()).resolves.toEqual(snapshotPayload);
    expect(fetchFromSupabase).toHaveBeenCalledTimes(1);
  });

  it('returns null for an empty ledger so the screen shows the empty state', async () => {
    fetchFromSupabase = vi.fn().mockResolvedValue(null);
    const { fetchPublicSnapshot } = await load();
    await expect(fetchPublicSnapshot()).resolves.toBeNull();
  });

  it('throws a clear error when Supabase is not configured, without touching the network', async () => {
    client = null;
    const { fetchPublicSnapshot } = await load();
    await expect(fetchPublicSnapshot()).rejects.toThrow('Supabase');
    expect(fetchFromSupabase).not.toHaveBeenCalled();
  });

  it('propagates query errors instead of falling back to any other source', async () => {
    fetchFromSupabase = vi.fn().mockRejectedValue(new Error('ledger_transactions: permission denied'));
    const { fetchPublicSnapshot } = await load();
    await expect(fetchPublicSnapshot()).rejects.toThrow('permission denied');
  });
});

describe('empty ledger snapshot copy', () => {
  it('no longer mentions publishing or a snapshot file', async () => {
    const { EMPTY_LEDGER_SNAPSHOT_TITLE, EMPTY_LEDGER_SNAPSHOT_DETAIL } = await load();
    expect(EMPTY_LEDGER_SNAPSHOT_TITLE).toContain('장부');
    expect(`${EMPTY_LEDGER_SNAPSHOT_TITLE} ${EMPTY_LEDGER_SNAPSHOT_DETAIL}`).not.toMatch(/게시|snapshot|Blob/);
  });
});
