import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EMPTY_LEDGER_SNAPSHOT_TITLE,
  fetchPublicSnapshot,
  isLedgerSnapshotAccessDenied,
  isLedgerSnapshotNotFound,
} from '../src/utils/publishSnapshot.js';

const snapshotPayload = {
  publishedAt: '2026-06-11T00:00:00.000Z',
  categories: [{ id: 'c1', label: '식비', matchKeywords: [] }],
  transactions: [{ id: 't1', category: '식비', amount: 1000, date: '2026-06-01' }],
};

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  };
}

describe('isLedgerSnapshotNotFound', () => {
  it('detects API empty snapshot responses', () => {
    expect(isLedgerSnapshotNotFound(404, { error: 'snapshot not found' })).toBe(true);
    expect(isLedgerSnapshotNotFound(404, { error: 'other' })).toBe(false);
    expect(isLedgerSnapshotNotFound(500, { error: 'snapshot not found' })).toBe(false);
  });
});

describe('isLedgerSnapshotAccessDenied', () => {
  it('detects auth failures', () => {
    expect(isLedgerSnapshotAccessDenied(401)).toBe(true);
    expect(isLedgerSnapshotAccessDenied(403)).toBe(true);
    expect(isLedgerSnapshotAccessDenied(404)).toBe(false);
  });
});

describe('fetchPublicSnapshot', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null for 404 snapshot not found without static snapshot', async () => {
    fetch.mockImplementation((url) => {
      const target = String(url);
      if (target.includes('/api/ledger-snapshot')) {
        return Promise.resolve(jsonResponse(404, { error: 'snapshot not found' }));
      }
      return Promise.resolve(jsonResponse(404, {}));
    });

    await expect(fetchPublicSnapshot()).resolves.toBeNull();
  });

  it('returns snapshot data for HTTP 200', async () => {
    fetch.mockImplementation((url) => {
      if (String(url).includes('/api/ledger-snapshot')) {
        return Promise.resolve(jsonResponse(200, snapshotPayload));
      }
      throw new Error('static should not be requested');
    });

    await expect(fetchPublicSnapshot()).resolves.toEqual(snapshotPayload);
  });

  it('throws for HTTP 500', async () => {
    fetch.mockImplementation((url) => {
      const target = String(url);
      if (target.includes('/api/ledger-snapshot')) {
        return Promise.resolve(jsonResponse(500, { error: 'internal error' }));
      }
      return Promise.resolve(jsonResponse(404, {}));
    });

    await expect(fetchPublicSnapshot()).rejects.toMatchObject({ status: 500 });
  });

  it('throws a network error when API and static are unavailable', async () => {
    fetch.mockRejectedValue(new TypeError('network down'));

    await expect(fetchPublicSnapshot()).rejects.toThrow(/네트워크/);
  });

  it('falls back to static snapshot when API returns 404 snapshot not found', async () => {
    fetch.mockImplementation((url) => {
      const target = String(url);
      if (target.includes('/api/ledger-snapshot')) {
        return Promise.resolve(jsonResponse(404, { error: 'snapshot not found' }));
      }
      return Promise.resolve(jsonResponse(200, snapshotPayload));
    });

    await expect(fetchPublicSnapshot()).resolves.toEqual(snapshotPayload);
  });

  it('throws warning-style errors for HTTP 403 when static is missing', async () => {
    fetch.mockImplementation((url) => {
      const target = String(url);
      if (target.includes('/api/ledger-snapshot')) {
        return Promise.resolve(jsonResponse(403, { error: 'forbidden' }));
      }
      return Promise.resolve(jsonResponse(404, {}));
    });

    await expect(fetchPublicSnapshot()).rejects.toMatchObject({
      status: 403,
      isWarning: true,
    });
  });
});

describe('empty ledger snapshot copy', () => {
  it('exposes user-facing empty title', () => {
    expect(EMPTY_LEDGER_SNAPSHOT_TITLE).toContain('snapshot');
  });
});
