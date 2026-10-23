import { describe, expect, it } from 'vitest';
import { validateLedgerSnapshotAdoption } from '../src/utils/ledgerAdoption.js';

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
