import { describe, expect, it } from 'vitest';
import {
  buildSnapshotFromRows,
  fetchLedgerSnapshotFromSupabase,
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

describe('snapshot mapping', () => {
  it('round-trips a transaction through the DB row shape unchanged', () => {
    expect(transactionFromRow(toTransactionRow(tx, 0))).toEqual(tx);
  });
  it('drops empty extraData and null optional fields like the former Blob API did', () => {
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
  it('returns null for an empty ledger so the UI shows the empty state', () => {
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
  it('throws on a query error so the UI can show the error', async () => {
    await expect(fetchLedgerSnapshotFromSupabase(fakeClient('ledger_categories'))).rejects.toThrow('boom');
  });
});
