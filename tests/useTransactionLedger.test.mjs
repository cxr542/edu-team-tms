import { describe, expect, it } from 'vitest';
import teamBuildingData from '../src/data/teamBuilding2026.json';
import { DEFAULT_USAGE_CATEGORIES } from '../src/constants/usageCategories.js';
import {
  buildBundledLedgerResetState,
  isImplicitBundledLedgerSeed,
  shouldAdoptPublishedSnapshot,
  validateLedgerSnapshotAdoption,
} from '../src/hooks/useTransactionLedger.js';

describe('shouldAdoptPublishedSnapshot', () => {
  it('keeps existing local transactions even when the published snapshot is newer', () => {
    expect(
      shouldAdoptPublishedSnapshot({
        readOnly: false,
        storedTransactions: [{ id: 'local-1' }],
        publishedSnapshot: {
          publishedAt: '2026-06-11T09:10:41.545Z',
          transactions: [{ id: 'remote-1' }],
        },
        ledgerMeta: {
          updatedAt: '2026-06-01T00:00:00.000Z',
          syncedPublishedAt: '2026-06-01T00:00:00.000Z',
        },
      })
    ).toBe(false);
  });

  it('keeps local edits when they are newer than the published snapshot', () => {
    expect(
      shouldAdoptPublishedSnapshot({
        readOnly: false,
        storedTransactions: [{ id: 'local-1' }],
        publishedSnapshot: {
          publishedAt: '2026-06-11T09:10:41.545Z',
          transactions: [{ id: 'remote-1' }],
        },
        ledgerMeta: {
          updatedAt: '2026-06-12T00:00:00.000Z',
          syncedPublishedAt: '2026-06-11T09:10:41.545Z',
        },
      })
    ).toBe(false);
  });

  it('keeps existing local transactions when sync metadata is missing', () => {
    expect(
      shouldAdoptPublishedSnapshot({
        readOnly: false,
        storedTransactions: [{ id: 'local-1' }],
        publishedSnapshot: {
          publishedAt: '2026-06-11T09:10:41.545Z',
          transactions: [{ id: 'remote-1' }],
        },
        ledgerMeta: {},
      })
    ).toBe(false);
  });

  it('adopts a published snapshot only when no local transactions exist', () => {
    expect(
      shouldAdoptPublishedSnapshot({
        readOnly: false,
        storedTransactions: [],
        publishedSnapshot: {
          publishedAt: '2026-06-11T09:10:41.545Z',
          transactions: [{ id: 'remote-1' }],
        },
        ledgerMeta: {},
      })
    ).toBe(true);
  });
});


describe('isImplicitBundledLedgerSeed', () => {
  it('recognizes bundled seed data saved before ledger metadata exists', () => {
    expect(
      isImplicitBundledLedgerSeed({
        storedTransactions: teamBuildingData,
        categories: DEFAULT_USAGE_CATEGORIES,
        ledgerMeta: {},
      })
    ).toBe(true);
  });

  it('does not treat bundled data as implicit seed once sync metadata exists', () => {
    expect(
      isImplicitBundledLedgerSeed({
        storedTransactions: teamBuildingData,
        categories: DEFAULT_USAGE_CATEGORIES,
        ledgerMeta: { updatedAt: '2026-06-25T00:00:00.000Z' },
      })
    ).toBe(false);
  });

  it('does not treat edited transaction data as implicit seed', () => {
    expect(
      isImplicitBundledLedgerSeed({
        storedTransactions: [{ ...teamBuildingData[0], amount: teamBuildingData[0].amount + 1 }],
        categories: DEFAULT_USAGE_CATEGORIES,
        ledgerMeta: {},
      })
    ).toBe(false);
  });
});


describe('buildBundledLedgerResetState', () => {
  it('marks explicit bundled resets as editable local data so published snapshots are not auto-adopted', () => {
    const resetState = buildBundledLedgerResetState(
      DEFAULT_USAGE_CATEGORIES,
      new Date('2026-06-27T12:00:00.000Z')
    );

    expect(resetState.transactions).toHaveLength(teamBuildingData.length);
    expect(resetState.meta).toEqual({ updatedAt: '2026-06-27T12:00:00.000Z' });
    expect(resetState.usingBundledSeed).toBe(false);
    expect(
      shouldAdoptPublishedSnapshot({
        readOnly: false,
        storedTransactions: resetState.transactions,
        publishedSnapshot: {
          publishedAt: '2026-06-27T13:00:00.000Z',
          transactions: [{ id: 'remote-1' }],
        },
        ledgerMeta: resetState.meta,
      })
    ).toBe(false);
  });
});


describe('validateLedgerSnapshotAdoption', () => {
  it('blocks adopting a snapshot with fewer transactions than the current ledger', () => {
    expect(
      validateLedgerSnapshotAdoption(
        [{ id: 'current-1', date: '2026-06-01' }, { id: 'current-2', date: '2026-06-02' }],
        [{ id: 'incoming-1', date: '2026-06-01' }]
      )
    ).toMatchObject({
      ok: false,
      reason: 'transaction-count-decrease',
      currentCount: 2,
      incomingCount: 1,
    });
  });

  it('blocks adopting a snapshot that removes an existing month', () => {
    expect(
      validateLedgerSnapshotAdoption(
        [{ id: 'current-1', date: '2026-06-12' }, { id: 'current-2', date: '2026-05-01' }],
        [
          { id: 'incoming-1', date: '2026-05-01' },
          { id: 'incoming-2', date: '2026-05-02' },
        ]
      )
    ).toMatchObject({
      ok: false,
      reason: 'month-data-removed',
      month: '2026-06',
      currentCount: 1,
      incomingCount: 0,
    });
  });

  it('allows adopting a snapshot that preserves transaction count and month coverage', () => {
    expect(
      validateLedgerSnapshotAdoption(
        [{ id: 'current-1', date: '2026-06-12' }],
        [{ id: 'incoming-1', date: '2026-06-12' }, { id: 'incoming-2', date: '2026-06-13' }]
      )
    ).toEqual({ ok: true });
  });
});
