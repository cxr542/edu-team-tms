import { describe, expect, it } from 'vitest';
import { KPI_STATUS } from '../src/constants/kpiStatuses.js';
import { kpi2RowId, createEmptyKpiOperationalStore } from '../src/constants/kpiOperationalStore.js';
import { normalizeMemberJournalSlice } from '../src/utils/journalMemberStore.js';
import {
  applyRemoteMemberJournalSave,
  mergeMemberJournalSlicesImport,
  normalizeJournalCloudSnapshot,
} from '../src/utils/journalCloudSnapshot.js';
import { buildJournalSnapshot, parseJournalSnapshotForImport } from '../src/utils/journalSnapshot.js';
import { mergeJournalKpiApprovalImport } from '../src/utils/journalKpiApprovalSlice.js';

describe('journal KPI approval backup round-trip', () => {
  const kpiOperational = createEmptyKpiOperationalStore();
  kpiOperational.months['2026-06'] = {
    B: {
      monthly01: {
        work: 1,
        improve: 0,
        leave: 0,
        available: 1,
        status: KPI_STATUS.SUBMITTED,
        submittedAt: '2026-06-20T10:00:00.000Z',
      },
    },
  };
  kpiOperational.kpi2RowStatus[kpi2RowId('B', '2026-06-16', 't1')] = {
    status: KPI_STATUS.APPROVED,
    approvedAt: '2026-06-21T10:00:00.000Z',
    approver: '팀장',
  };

  const store = {
    memberJournals: {
      A: { days: {} },
      B: {
        days: {
          '2026-06-16': {
            holiday: false,
            mm: { work: 0.5, improve: 0, leave: 0 },
            tasks: [
              {
                id: 't1',
                cat: 'prep',
                title: 'KPI2 task',
                plan: 8,
                actual: 4,
                done: true,
                kpi2Effect: { enabled: true, projectId: 'p1', baselineHours: 8 },
              },
            ],
          },
        },
      },
      C: { days: {} },
    },
    meta: { updatedAt: '2026-06-20T10:00:00.000Z', memberUpdatedAt: { B: '2026-06-20T10:00:00.000Z' } },
  };

  it('normalizeMemberJournalSlice preserves kpiApproval', () => {
    const slice = normalizeMemberJournalSlice({
      days: {},
      kpiApproval: {
        months: { '2026-06': { monthly01: { status: KPI_STATUS.SUBMITTED } } },
        kpi2RowStatus: { '2026-06-16|t1': { status: KPI_STATUS.SUBMITTED } },
      },
    });
    expect(slice.kpiApproval.months['2026-06'].monthly01.status).toBe(KPI_STATUS.SUBMITTED);
  });

  it('buildJournalSnapshot export includes kpiApproval per member', () => {
    const snapshot = buildJournalSnapshot(store, kpiOperational);
    expect(snapshot.memberJournals.B.kpiApproval.months['2026-06'].monthly01.status).toBe(
      KPI_STATUS.SUBMITTED
    );
    expect(snapshot.memberJournals.B.kpiApproval.kpi2RowStatus[kpi2RowId('B', '2026-06-16', 't1')].status).toBe(
      KPI_STATUS.APPROVED
    );
  });

  it('import round-trip restores KPI approval into operational store', () => {
    const exported = buildJournalSnapshot(store, kpiOperational);
    const parsed = parseJournalSnapshotForImport(exported);
    expect(parsed.memberJournals.B.kpiApproval).toBeTruthy();

    const empty = createEmptyKpiOperationalStore();
    const merged = mergeJournalKpiApprovalImport(empty, parsed);
    expect(merged.months['2026-06'].B.monthly01.status).toBe(KPI_STATUS.SUBMITTED);
    expect(merged.kpi2RowStatus[kpi2RowId('B', '2026-06-16', 't1')].status).toBe(KPI_STATUS.APPROVED);
  });

  it('mergeMemberJournalSlicesImport keeps remote kpiApproval', () => {
    const merged = mergeMemberJournalSlicesImport(
      { days: {}, kpiApproval: { months: {} } },
      {
        days: { '2026-06-01': { holiday: false, mm: {}, tasks: [] } },
        kpiApproval: {
          months: {
            '2026-06': { monthly01: { status: KPI_STATUS.SUBMITTED, submittedAt: '2026-06-01T00:00:00.000Z' } },
          },
          kpi2RowStatus: {},
        },
      }
    );
    expect(merged.kpiApproval.months['2026-06'].monthly01.status).toBe(KPI_STATUS.SUBMITTED);
  });

  it('applyRemoteMemberJournalSave updates only saved member', () => {
    const local = {
      memberJournals: {
        A: { days: { '2026-06-01': { holiday: false, mm: {}, tasks: [{ id: 'a1', title: 'A keep' }] } } },
        B: { days: { '2026-06-01': { holiday: false, mm: {}, tasks: [{ id: 'b-old', title: 'B old' }] } } },
        C: { days: {} },
      },
      meta: {
        updatedAt: '2026-06-10T08:00:00.000Z',
        memberUpdatedAt: { A: '2026-06-10T08:00:00.000Z', B: '2026-06-10T07:00:00.000Z' },
      },
    };
    const remote = normalizeJournalCloudSnapshot({
      publishedAt: '2026-06-11T08:00:00.000Z',
      meta: { updatedAt: '2026-06-11T08:00:00.000Z', memberUpdatedAt: { B: '2026-06-11T08:00:00.000Z' } },
      memberJournals: {
        B: {
          days: { '2026-06-02': { holiday: false, mm: {}, tasks: [{ id: 'b-new', title: 'B new' }] } },
          kpiApproval: {
            months: { '2026-06': { monthly01: { status: KPI_STATUS.SUBMITTED } } },
            kpi2RowStatus: {},
          },
        },
      },
    });
    const next = applyRemoteMemberJournalSave(local, remote, 'B');
    expect(next.memberJournals.A.days['2026-06-01'].tasks[0].title).toBe('A keep');
    expect(next.memberJournals.B.days['2026-06-02'].tasks[0].title).toBe('B new');
    expect(next.memberJournals.B.kpiApproval.months['2026-06'].monthly01.status).toBe(KPI_STATUS.SUBMITTED);
    expect(next.meta.memberUpdatedAt.B).toBe('2026-06-11T08:00:00.000Z');
    expect(next.meta.memberUpdatedAt.A).toBe('2026-06-10T08:00:00.000Z');
  });

  it('backup restore then single-member save keeps other member kpiApproval', () => {
    const exported = buildJournalSnapshot(store, kpiOperational);
    const parsed = parseJournalSnapshotForImport(exported);
    const restoredStore = {
      memberJournals: parsed.memberJournals,
      meta: parsed.meta,
    };
    const remote = normalizeJournalCloudSnapshot({
      publishedAt: '2026-06-21T08:00:00.000Z',
      meta: { updatedAt: '2026-06-21T08:00:00.000Z', memberUpdatedAt: { A: '2026-06-21T08:00:00.000Z' } },
      memberJournals: {
        A: { days: { '2026-06-03': { holiday: false, mm: {}, tasks: [{ id: 'a-new', title: 'A updated' }] } } },
      },
    });
    const next = applyRemoteMemberJournalSave(restoredStore, remote, 'A');
    expect(next.memberJournals.B.kpiApproval.months['2026-06'].monthly01.status).toBe(KPI_STATUS.SUBMITTED);
    expect(next.memberJournals.B.kpiApproval.kpi2RowStatus[kpi2RowId('B', '2026-06-16', 't1')].status).toBe(
      KPI_STATUS.APPROVED
    );
    expect(next.memberJournals.A.days['2026-06-03'].tasks[0].title).toBe('A updated');
  });
});
