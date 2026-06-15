import { describe, expect, it } from 'vitest';
import { shouldAdoptPublishedSnapshot } from '../src/hooks/useTransactionLedger.js';

describe('shouldAdoptPublishedSnapshot', () => {
  it('adopts a newer published snapshot even when stale local transactions exist', () => {
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
    ).toBe(true);
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

  it('adopts a published snapshot when local transactions exist but sync metadata is missing', () => {
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
    ).toBe(true);
  });
});
