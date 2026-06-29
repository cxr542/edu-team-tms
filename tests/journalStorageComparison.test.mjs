import { describe, expect, it } from 'vitest';
import { compareJournalSnapshots, summarizeJournalSnapshot } from '../src/utils/journalStorageComparison.js';

const blobSnapshot = {
  publishedAt: '2026-06-29T08:00:00.000Z',
  meta: { updatedAt: '2026-06-29T08:00:00.000Z' },
  memberJournals: {
    A: { updatedAt: '2026-06-29T07:30:00.000Z', days: { '2026-06-29': { tasks: [{}, {}] } } },
    B: { updatedAt: '2026-06-29T07:10:00.000Z', days: { '2026-06-29': { tasks: [{}] } } },
  },
};

const supabaseSnapshot = {
  publishedAt: '2026-06-29T08:10:00.000Z',
  meta: { updatedAt: '2026-06-29T08:10:00.000Z' },
  memberJournals: {
    A: { updatedAt: '2026-06-29T08:05:00.000Z', days: { '2026-06-29': { tasks: [{}, {}, {}] } } },
    C: { updatedAt: '2026-06-29T08:03:00.000Z', days: { '2026-06-29': { tasks: [{}] } } },
  },
};

describe('journal storage comparison', () => {
  it('summarizes snapshot existence and per-member counts', () => {
    const summary = summarizeJournalSnapshot(blobSnapshot);

    expect(summary.exists).toBe(true);
    expect(summary.publishedAt).toBe('2026-06-29T08:00:00.000Z');
    expect(summary.members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'A', exists: true, tasks: 2, days: 1 }),
        expect.objectContaining({ code: 'B', exists: true, tasks: 1, days: 1 }),
        expect.objectContaining({ code: 'C', exists: false, tasks: 0, days: 0 }),
      ])
    );
  });

  it('compares blob and supabase member presence, timestamps, and task counts', () => {
    const result = compareJournalSnapshots(blobSnapshot, supabaseSnapshot);

    expect(result.diff.blobOnlyMembers).toEqual(['B']);
    expect(result.diff.supabaseOnlyMembers).toEqual(['C']);
    expect(result.diff.updatedAtDiffMembers).toEqual(['A']);
    expect(result.diff.taskCountDiffMembers).toEqual(['A']);
    expect(result.diff.sameMembers).toEqual([]);
    expect(result.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'A', status: 'different', updatedAtMatches: false, taskCountMatches: false }),
        expect.objectContaining({ code: 'B', status: 'blob-only' }),
        expect.objectContaining({ code: 'C', status: 'supabase-only' }),
      ])
    );
  });
});

