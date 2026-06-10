import { describe, expect, it } from 'vitest';
import {
  isMemberJournalEmpty,
  mergeJournalSnapshotsByMember,
  mergeMemberIntoJournalSnapshot,
  normalizeJournalCloudSnapshot,
} from '../src/utils/journalCloudSnapshot.js';

const day = (title) => ({
  '2026-06-09': {
    holiday: false,
    mm: { work: 0, improve: 0, leave: 0 },
    tasks: [{ id: title, cat: 'other', title, plan: 1, actual: 1, done: true }],
  },
});

describe('journalCloudSnapshot', () => {
  it('normalizes legacy single-member snapshots without copying A into B/C', () => {
    const snapshot = normalizeJournalCloudSnapshot({
      publishedAt: '2026-06-09T00:00:00.000Z',
      member: 'A',
      days: day('A task'),
    });

    expect(snapshot.memberJournals.A.days['2026-06-09'].tasks[0].title).toBe('A task');
    expect(isMemberJournalEmpty(snapshot.memberJournals.B)).toBe(true);
    expect(isMemberJournalEmpty(snapshot.memberJournals.C)).toBe(true);
  });

  it('merges one posted member while preserving the other members', () => {
    const current = normalizeJournalCloudSnapshot({
      publishedAt: '2026-06-09T00:00:00.000Z',
      memberJournals: {
        A: { days: day('A keep') },
        C: { days: day('C keep') },
      },
    });

    const next = mergeMemberIntoJournalSnapshot(current, 'B', {
      days: day('B update'),
      weekSummaries: { '2026-W24': 'B summary' },
    });

    expect(next.memberJournals.A.days['2026-06-09'].tasks[0].title).toBe('A keep');
    expect(next.memberJournals.B.days['2026-06-09'].tasks[0].title).toBe('B update');
    expect(next.memberJournals.C.days['2026-06-09'].tasks[0].title).toBe('C keep');
  });

  it('preserves local-only member data when merging a newer remote snapshot', () => {
    const local = normalizeJournalCloudSnapshot({
      publishedAt: '2026-06-09T01:00:00.000Z',
      meta: { memberUpdatedAt: { B: '2026-06-09T01:00:00.000Z' } },
      memberJournals: {
        B: { days: day('B local') },
      },
    });
    const remote = normalizeJournalCloudSnapshot({
      publishedAt: '2026-06-09T02:00:00.000Z',
      meta: { memberUpdatedAt: { A: '2026-06-09T02:00:00.000Z' } },
      memberJournals: {
        A: { days: day('A remote') },
      },
    });

    const merged = mergeJournalSnapshotsByMember(local, remote);

    expect(merged.memberJournals.A.days['2026-06-09'].tasks[0].title).toBe('A remote');
    expect(merged.memberJournals.B.days['2026-06-09'].tasks[0].title).toBe('B local');
  });
});
