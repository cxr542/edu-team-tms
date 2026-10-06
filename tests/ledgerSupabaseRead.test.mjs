import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildSnapshotFromRows,
  fetchLedgerSnapshotFromSupabase,
  resolveLedgerReadSource,
  transactionFromRow,
} from '../src/utils/ledgerSupabaseRead.js';
import { toCategoryRow, toTransactionRow } from '../scripts/ledger-migration-core.mjs';

const tx = {
  id: 'tx-kakao-1',
  date: '2026-10-02',
  category: '티타임',
  description: '카페',
  amount: 5800,
  balance: 39200,
  paymentMethod: '법인카드',
  attendees: '팀 모두',
  extraData: { 비고: '카카오 법인카드 알림', 원문: '카페이오\n5,800원 승인' },
};
const cat = { id: 'teatime', label: '티타임', color: '#ec4899', description: 'd', matchKeywords: ['티타임'] };

describe('resolveLedgerReadSource', () => {
  it('defaults to blob and honours the env flag', () => {
    expect(resolveLedgerReadSource()).toBe('blob');
    expect(resolveLedgerReadSource({ envValue: 'false' })).toBe('blob');
    expect(resolveLedgerReadSource({ envValue: 'TRUE' })).toBe('supabase');
  });
  it('lets the URL override the flag in both directions', () => {
    expect(resolveLedgerReadSource({ envValue: 'true', search: '?ledgerSource=blob' })).toBe('blob');
    expect(resolveLedgerReadSource({ envValue: '', search: '?ledgerSource=supabase' })).toBe('supabase');
    expect(resolveLedgerReadSource({ envValue: 'true', search: '?ledgerSource=other' })).toBe('supabase');
  });
});

describe('snapshot mapping', () => {
  it('round-trips a transaction through the DB row shape unchanged', () => {
    expect(transactionFromRow(toTransactionRow(tx, 0))).toEqual(tx);
  });
  it('drops empty extraData and null optional fields like the Blob API does', () => {
    const plain = { id: 'a', date: '2026-01-05', category: '기타', description: '점심', amount: 1, balance: 2 };
    expect(transactionFromRow(toTransactionRow({ ...plain, extraData: {} }, 0))).toEqual(plain);
  });
  it('builds a snapshot with the latest updated_at and the menu setting', () => {
    const snap = buildSnapshotFromRows({
      transactions: [{ ...toTransactionRow(tx, 0), updated_at: '2026-10-06T01:00:00Z' }],
      categories: [{ ...toCategoryRow(cat, 0), updated_at: '2026-10-06T02:00:00Z' }],
      settings: [{ key: 'viewer_menu_visibility', value: { ledger: true }, updated_at: '2026-10-05T00:00:00Z' }],
    });
    expect(snap.publishedAt).toBe('2026-10-06T02:00:00.000Z');
    expect(snap.categories).toEqual([cat]);
    expect(snap.viewerMenuVisibility).toEqual({ ledger: true });
  });
  it('returns null for an empty ledger so callers fall back to Blob', () => {
    expect(buildSnapshotFromRows({ transactions: [] })).toBeNull();
  });
});

describe('fetchLedgerSnapshotFromSupabase', () => {
  const tables = {
    ledger_transactions: [{ ...toTransactionRow(tx, 0), updated_at: '2026-10-06T01:00:00Z' }],
    ledger_categories: [{ ...toCategoryRow(cat, 0), updated_at: '2026-10-06T01:00:00Z' }],
    ledger_settings: [],
  };
  const fakeClient = (failOn) => ({
    from: (table) => {
      const q = {
        select: () => q,
        order: () => q,
        range: () =>
          Promise.resolve(failOn === table ? { data: null, error: { message: 'boom' } } : { data: tables[table], error: null }),
      };
      return q;
    },
  });

  it('is null when Supabase is not configured', async () => {
    expect(await fetchLedgerSnapshotFromSupabase(null)).toBeNull();
  });
  it('reads all three tables into the snapshot shape', async () => {
    const snap = await fetchLedgerSnapshotFromSupabase(fakeClient());
    expect(snap.transactions).toEqual([tx]);
    expect(snap.viewerMenuVisibility).toBeUndefined();
  });
  it('throws on a query error so the caller can fall back', async () => {
    await expect(fetchLedgerSnapshotFromSupabase(fakeClient('ledger_categories'))).rejects.toThrow('boom');
  });
});

describe('fetchPublicSnapshot source selection', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.doUnmock('../src/utils/ledgerSupabaseRead.js');
  });

  const blobPayload = { publishedAt: 'blob', transactions: [{ id: 'b' }] };
  const okJson = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });

  async function load({ source, supabase }) {
    vi.doMock('../src/utils/ledgerSupabaseRead.js', () => ({
      getLedgerReadSource: () => source,
      fetchLedgerSnapshotFromSupabase: supabase,
    }));
    fetch.mockImplementation(() => okJson(blobPayload));
    return (await import('../src/utils/publishSnapshot.js')).fetchPublicSnapshot;
  }

  it('never touches Supabase for the editor screen', async () => {
    const supabase = vi.fn();
    const fetchPublicSnapshot = await load({ source: 'supabase', supabase });
    expect((await fetchPublicSnapshot({ preferSupabase: false })).publishedAt).toBe('blob');
    expect(supabase).not.toHaveBeenCalled();
  });
  it('stays on Blob while the flag is off', async () => {
    const supabase = vi.fn();
    const fetchPublicSnapshot = await load({ source: 'blob', supabase });
    expect((await fetchPublicSnapshot({ preferSupabase: true })).publishedAt).toBe('blob');
    expect(supabase).not.toHaveBeenCalled();
  });
  it('uses Supabase for viewers when the flag is on', async () => {
    const supabase = vi.fn().mockResolvedValue({ publishedAt: 'sb', transactions: [{ id: 's' }] });
    const fetchPublicSnapshot = await load({ source: 'supabase', supabase });
    expect((await fetchPublicSnapshot({ preferSupabase: true })).publishedAt).toBe('sb');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('falls back to Blob when Supabase errors or is empty', async () => {
    for (const supabase of [vi.fn().mockRejectedValue(new Error('down')), vi.fn().mockResolvedValue(null)]) {
      vi.resetModules();
      const fetchPublicSnapshot = await load({ source: 'supabase', supabase });
      expect((await fetchPublicSnapshot({ preferSupabase: true })).publishedAt).toBe('blob');
    }
  });
});
