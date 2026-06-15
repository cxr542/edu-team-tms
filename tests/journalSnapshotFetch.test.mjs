import { describe, expect, it } from 'vitest';
import {
  isJournalSnapshotImportable,
  isJsonSnapshotResponse,
} from '../src/utils/journalSnapshot.js';

describe('journal snapshot fetch validation', () => {
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
});
