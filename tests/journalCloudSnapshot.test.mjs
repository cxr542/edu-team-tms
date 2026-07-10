import { describe, expect, it } from 'vitest';
import { kpi2RowId } from '../src/constants/kpiOperationalStore.js';
import { KPI_STATUS } from '../src/constants/kpiStatuses.js';
import {
  applyRemoteMemberJournalSave,
  isJournalMemberUpdateStale,
  isMemberJournalEmpty,
  isMemberJournalWriteStale,
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

  it('detects stale same-member saves before they can replace newer shared data', () => {
    const current = normalizeJournalCloudSnapshot({
      publishedAt: '2026-06-09T10:00:00.000Z',
      meta: { memberUpdatedAt: { B: '2026-06-09T10:00:00.000Z' } },
      memberJournals: {
        B: { days: day('B newer remote') },
      },
    });

    expect(isJournalMemberUpdateStale(current, 'B', '2026-06-09T09:00:00.000Z')).toBe(true);
    expect(isJournalMemberUpdateStale(current, 'B', '2026-06-09T11:00:00.000Z')).toBe(false);
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

  it('isMemberJournalWriteStale rejects older client updatedAt', () => {
    const current = normalizeJournalCloudSnapshot({
      publishedAt: '2026-06-11T08:00:00.000Z',
      meta: { memberUpdatedAt: { B: '2026-06-11T08:00:00.000Z' } },
      memberJournals: { B: { days: day('B server') } },
    });
    expect(isMemberJournalWriteStale(current, 'B', '2026-06-10T08:00:00.000Z')).toBe(true);
    expect(isMemberJournalWriteStale(current, 'B', '2026-06-12T08:00:00.000Z')).toBe(false);
    expect(isMemberJournalWriteStale(current, 'B', null)).toBe(true);
    expect(isMemberJournalWriteStale(current, 'B', 'not-a-date')).toBe(true);

    const emptyRemote = normalizeJournalCloudSnapshot({
      publishedAt: '2026-06-11T08:00:00.000Z',
      memberJournals: {},
    });
    expect(isMemberJournalWriteStale(emptyRemote, 'B', null)).toBe(false);
  });

  it('sequential saves from two members preserve both latest slices', () => {
    let snapshot = normalizeJournalCloudSnapshot({
      publishedAt: '2026-06-09T00:00:00.000Z',
      memberJournals: {},
    });
    snapshot = mergeMemberIntoJournalSnapshot(snapshot, 'A', { days: day('A first') }, {
      updatedAt: '2026-06-09T01:00:00.000Z',
    });
    snapshot = mergeMemberIntoJournalSnapshot(snapshot, 'B', { days: day('B first') }, {
      updatedAt: '2026-06-09T02:00:00.000Z',
    });
    expect(snapshot.memberJournals.A.days['2026-06-09'].tasks[0].title).toBe('A first');
    expect(snapshot.memberJournals.B.days['2026-06-09'].tasks[0].title).toBe('B first');
    expect(snapshot.meta.memberUpdatedAt.A).toBe('2026-06-09T01:00:00.000Z');
    expect(snapshot.meta.memberUpdatedAt.B).toBe('2026-06-09T02:00:00.000Z');
  });

  it('member save preserves stronger cloud KPI approval decisions', () => {
    const rowId = kpi2RowId('B', '2026-06-09', 'kpi2-task');
    const current = normalizeJournalCloudSnapshot({
      publishedAt: '2026-06-09T10:00:00.000Z',
      meta: { memberUpdatedAt: { B: '2026-06-09T10:00:00.000Z' } },
      memberJournals: {
        B: {
          days: day('B approved remote'),
          kpiApproval: {
            months: {
              '2026-06': {
                monthly01: {
                  status: KPI_STATUS.APPROVED,
                  submittedAt: '2026-06-09T09:00:00.000Z',
                  approvedAt: '2026-06-09T10:00:00.000Z',
                  approver: '팀장',
                },
              },
            },
            kpi2RowStatus: {
              [rowId]: {
                status: KPI_STATUS.APPROVED,
                submittedAt: '2026-06-09T09:00:00.000Z',
                approvedAt: '2026-06-09T10:00:00.000Z',
                approver: '팀장',
              },
            },
          },
        },
      },
    });

    const next = mergeMemberIntoJournalSnapshot(
      current,
      'B',
      {
        days: day('B newer journal edit'),
        kpiApproval: {
          months: {
            '2026-06': {
              monthly01: {
                status: KPI_STATUS.SUBMITTED,
                submittedAt: '2026-06-09T11:00:00.000Z',
              },
            },
          },
          kpi2RowStatus: {
            '2026-06-09|kpi2-task': {
              status: KPI_STATUS.SUBMITTED,
              submittedAt: '2026-06-09T11:00:00.000Z',
            },
          },
        },
      },
      { updatedAt: '2026-06-09T11:00:00.000Z' }
    );

    expect(next.memberJournals.B.days['2026-06-09'].tasks[0].title).toBe('B newer journal edit');
    expect(next.memberJournals.B.kpiApproval.months['2026-06'].monthly01.status).toBe(
      KPI_STATUS.APPROVED
    );
    expect(next.memberJournals.B.kpiApproval.months['2026-06'].monthly01.approver).toBe('팀장');
    expect(next.memberJournals.B.kpiApproval.kpi2RowStatus[rowId].status).toBe(KPI_STATUS.APPROVED);
  });

  it('applyRemoteMemberJournalSave does not replace other members', () => {
    const local = {
      memberJournals: {
        A: { days: day('A local') },
        B: { days: day('B local') },
        C: { days: day('C local') },
      },
      meta: { memberUpdatedAt: { A: '2026-06-09T01:00:00.000Z', B: '2026-06-09T01:00:00.000Z', C: '2026-06-09T01:00:00.000Z' } },
    };
    const remote = normalizeJournalCloudSnapshot({
      publishedAt: '2026-06-11T08:00:00.000Z',
      meta: { memberUpdatedAt: { B: '2026-06-11T08:00:00.000Z' } },
      memberJournals: { B: { days: day('B remote') } },
    });
    const next = applyRemoteMemberJournalSave(local, remote, 'B');
    expect(next.memberJournals.A.days['2026-06-09'].tasks[0].title).toBe('A local');
    expect(next.memberJournals.B.days['2026-06-09'].tasks[0].title).toBe('B remote');
    expect(next.memberJournals.C.days['2026-06-09'].tasks[0].title).toBe('C local');
  });

  it('applyRemoteMemberJournalSave preserves a newer local edit for the saved member', () => {
    const local = {
      memberJournals: { A: { days: {} }, B: { days: day('B local newer') }, C: { days: {} } },
      meta: { memberUpdatedAt: { B: '2026-06-11T09:00:00.000Z' } },
    };
    const staleResponse = normalizeJournalCloudSnapshot({
      publishedAt: '2026-06-11T08:00:00.000Z',
      meta: { memberUpdatedAt: { B: '2026-06-11T08:00:00.000Z' } },
      memberJournals: { B: { days: day('B response older') } },
    });

    const next = applyRemoteMemberJournalSave(local, staleResponse, 'B');

    expect(next.memberJournals.B.days['2026-06-09'].tasks[0].title).toBe('B local newer');
    expect(next.meta.memberUpdatedAt.B).toBe('2026-06-11T09:00:00.000Z');
  });

  it('applyRemoteMemberJournalSave force overwrites a newer local edit', () => {
    const local = {
      memberJournals: { A: { days: {} }, B: { days: day('B local newer') }, C: { days: {} } },
      meta: { memberUpdatedAt: { B: '2026-06-11T09:00:00.000Z' } },
    };
    const remote = normalizeJournalCloudSnapshot({
      publishedAt: '2026-06-11T08:00:00.000Z',
      meta: { memberUpdatedAt: { B: '2026-06-11T08:00:00.000Z' } },
      memberJournals: { B: { days: day('B remote forced') } },
    });

    const next = applyRemoteMemberJournalSave(local, remote, 'B', { force: true });

    expect(next.memberJournals.B.days['2026-06-09'].tasks[0].title).toBe('B remote forced');
    expect(next.meta.memberUpdatedAt.B).toBe('2026-06-11T08:00:00.000Z');
  });
});
