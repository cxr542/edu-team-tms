import { describe, expect, it } from 'vitest';
import {
  isLedgerSnapshotImportable,
  parseLedgerSnapshotForImport,
} from '../src/utils/publishSnapshot.js';

describe('ledger snapshot import', () => {
  it('accepts team snapshot with transactions array', () => {
    const raw = {
      publishedAt: '2026-06-01T00:00:00.000Z',
      categories: [{ label: '식사', color: '#fff' }],
      transactions: [{ id: 'tx-1', date: '2026-06-01', amount: 1000 }],
    };
    expect(isLedgerSnapshotImportable(raw)).toBe(true);
    const parsed = parseLedgerSnapshotForImport(raw);
    expect(parsed.transactions).toHaveLength(1);
    expect(parsed.categories).toHaveLength(1);
  });

  it('rejects invalid backup shape', () => {
    expect(isLedgerSnapshotImportable(null)).toBe(false);
    expect(isLedgerSnapshotImportable({ categories: [] })).toBe(false);
    expect(() => parseLedgerSnapshotForImport({})).toThrow(/transactions/);
  });
});
