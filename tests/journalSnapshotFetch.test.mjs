import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchJournalSnapshot,
  isJournalSnapshotImportable,
  isJsonSnapshotResponse,
} from '../src/utils/journalSnapshot.js';

function jsonResponse(status, body, headers = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: {
      get: (name) => headers[name.toLowerCase()] || null,
    },
    json: async () => body,
  };
}

describe('journal snapshot fetch validation', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('accepts application/json responses', () => {
    expect(
      isJsonSnapshotResponse({
        headers: { get: (name) => (name === 'content-type' ? 'application/json; charset=utf-8' : null) },
      })
    ).toBe(true);
  });

  it('rejects SPA index.html responses that vite preview returns for /api/*', () => {
    expect(
      isJsonSnapshotResponse({
        headers: { get: (name) => (name === 'content-type' ? 'text/html; charset=utf-8' : null) },
      })
    ).toBe(false);
  });

  it('rejects empty JSON bodies that are not importable snapshots', () => {
    expect(isJournalSnapshotImportable({})).toBe(false);
    expect(isJournalSnapshotImportable({ version: 1 })).toBe(false);
  });

  it('falls back to static JSON only when the API has no snapshot response', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (String(url).startsWith('/api/journal-snapshot')) {
        return jsonResponse(404, '<html>not found</html>', { 'content-type': 'text/html' });
      }
      return jsonResponse(
        200,
        {
          version: 1,
          publishedAt: '2026-06-10T08:00:00.000Z',
          memberJournals: { A: { days: {} } },
        },
        { 'content-type': 'application/json' }
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchJournalSnapshot();

    expect(result.source).toBe('static');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not fall back to stale static JSON when the API reports an empty Blob', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (String(url).startsWith('/api/journal-snapshot')) {
        return jsonResponse(
          404,
          { error: 'snapshot not found' },
          { 'content-type': 'application/json; charset=utf-8' }
        );
      }
      throw new Error('static snapshot should not be fetched');
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchJournalSnapshot();

    expect(result).toEqual({ snapshot: null, source: 'empty' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not merge stale static JSON after an API error', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(
        503,
        { error: 'blob-read-unavailable', message: 'Blob read failed' },
        { 'content-type': 'application/json' }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchJournalSnapshot()).rejects.toThrow(/Blob read failed/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not fall back to static JSON after a non-json API error page', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(502, '<html>Bad Gateway</html>', { 'content-type': 'text/html' })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchJournalSnapshot()).rejects.toThrow(/502/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
