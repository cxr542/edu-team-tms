import { describe, expect, it } from 'vitest';
import { KPI_STATUS } from '../src/constants/kpiStatuses.js';
import {
  extractMemberKpiApprovalSlice,
  mergeJournalKpiApprovalImport,
  mergeMemberKpiApprovalIntoStore,
} from '../src/utils/journalKpiApprovalSlice.js';
import {
  createEmptyKpiOperationalStore,
  kpi2LegacyRowId,
  kpi2RowId,
} from '../src/constants/kpiOperationalStore.js';

describe('journalKpiApprovalSlice', () => {
  it('extractMemberKpiApprovalSlice — months and kpi2 rows for member', () => {
    const days = {
      '2026-06-16': {
        tasks: [{ id: 't1', kpi2Effect: { enabled: true, projectId: 'p1', baselineHours: 8 }, done: true }],
      },
    };
    const operational = createEmptyKpiOperationalStore();
    operational.months['2026-06'] = {
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
    operational.kpi2RowStatus[kpi2RowId('B', '2026-06-16', 't1')] = {
      status: KPI_STATUS.SUBMITTED,
      submittedAt: '2026-06-20T11:00:00.000Z',
    };

    const slice = extractMemberKpiApprovalSlice(operational, 'B', days);
    expect(slice.months['2026-06'].monthly01.status).toBe(KPI_STATUS.SUBMITTED);
    expect(slice.kpi2RowStatus[kpi2RowId('B', '2026-06-16', 't1')].status).toBe(KPI_STATUS.SUBMITTED);
  });

  it('mergeJournalKpiApprovalImport — restores member approval from snapshot', () => {
    const store = createEmptyKpiOperationalStore();
    const snapshot = {
      memberJournals: {
        B: {
          kpiApproval: {
            months: {
              '2026-06': {
                monthly01: {
                  work: 1,
                  improve: 0,
                  leave: 0,
                  available: 1,
                  status: KPI_STATUS.SUBMITTED,
                  submittedAt: '2026-06-20T10:00:00.000Z',
                },
              },
            },
            kpi2RowStatus: {
              '2026-06-16|t1': {
                status: KPI_STATUS.SUBMITTED,
                submittedAt: '2026-06-20T11:00:00.000Z',
              },
            },
          },
        },
      },
    };

    const merged = mergeJournalKpiApprovalImport(store, snapshot);
    expect(merged.months['2026-06'].B.monthly01.status).toBe(KPI_STATUS.SUBMITTED);
    expect(merged.kpi2RowStatus[kpi2RowId('B', '2026-06-16', 't1')].status).toBe(KPI_STATUS.SUBMITTED);
  });

  it('mergeMemberKpiApprovalIntoStore — keeps newer submittedAt', () => {
    const store = createEmptyKpiOperationalStore();
    store.months['2026-06'] = {
      B: {
        monthly01: {
          work: 0.5,
          status: KPI_STATUS.DRAFT,
          submittedAt: null,
        },
      },
    };
    const incoming = {
      months: {
        '2026-06': {
          monthly01: {
            work: 1,
            status: KPI_STATUS.SUBMITTED,
            submittedAt: '2026-06-21T10:00:00.000Z',
          },
        },
      },
      kpi2RowStatus: {},
    };
    const merged = mergeMemberKpiApprovalIntoStore(store, 'B', incoming);
    expect(merged.months['2026-06'].B.monthly01.work).toBe(1);
    expect(merged.months['2026-06'].B.monthly01.status).toBe(KPI_STATUS.SUBMITTED);
  });

  it('mergeMemberKpiApprovalIntoStore — keeps approved monthly01 over stale submitted backup', () => {
    const store = createEmptyKpiOperationalStore();
    store.months['2026-06'] = {
      B: {
        monthly01: {
          work: 1,
          status: KPI_STATUS.APPROVED,
          submittedAt: '2026-06-21T10:00:00.000Z',
          approvedAt: '2026-06-21T11:00:00.000Z',
          approver: '팀장',
        },
      },
    };
    const incoming = {
      months: {
        '2026-06': {
          monthly01: {
            work: 1,
            status: KPI_STATUS.SUBMITTED,
            submittedAt: '2026-06-21T10:00:00.000Z',
          },
        },
      },
      kpi2RowStatus: {},
    };

    const merged = mergeMemberKpiApprovalIntoStore(store, 'B', incoming);

    expect(merged.months['2026-06'].B.monthly01.status).toBe(KPI_STATUS.APPROVED);
    expect(merged.months['2026-06'].B.monthly01.approver).toBe('팀장');
  });

  it('mergeMemberKpiApprovalIntoStore — keeps approved KPI2 row over stale submitted backup', () => {
    const store = createEmptyKpiOperationalStore();
    const rowId = kpi2RowId('B', '2026-06-16', 't1');
    store.kpi2RowStatus[rowId] = {
      status: KPI_STATUS.APPROVED,
      submittedAt: '2026-06-21T10:00:00.000Z',
      approvedAt: '2026-06-21T11:00:00.000Z',
      approver: '팀장',
    };
    const incoming = {
      months: {},
      kpi2RowStatus: {
        '2026-06-16|t1': {
          status: KPI_STATUS.SUBMITTED,
          submittedAt: '2026-06-21T10:00:00.000Z',
        },
      },
    };

    const merged = mergeMemberKpiApprovalIntoStore(store, 'B', incoming);

    expect(merged.kpi2RowStatus[rowId].status).toBe(KPI_STATUS.APPROVED);
    expect(merged.kpi2RowStatus[rowId].approver).toBe('팀장');
  });

  it('mergeMemberKpiApprovalIntoStore — keeps approved monthly01 over later submitted backup', () => {
    const store = createEmptyKpiOperationalStore();
    store.months['2026-06'] = {
      B: {
        monthly01: {
          status: KPI_STATUS.APPROVED,
          submittedAt: '2026-06-19T09:00:00.000Z',
          approvedAt: '2026-06-19T10:00:00.000Z',
          approver: '팀장',
        },
      },
    };
    const incoming = {
      months: {
        '2026-06': {
          monthly01: {
            status: KPI_STATUS.SUBMITTED,
            submittedAt: '2026-06-19T11:00:00.000Z',
            approvedAt: null,
            approver: '',
          },
        },
      },
      kpi2RowStatus: {},
    };

    const merged = mergeMemberKpiApprovalIntoStore(store, 'B', incoming);

    expect(merged.months['2026-06'].B.monthly01.status).toBe(KPI_STATUS.APPROVED);
    expect(merged.months['2026-06'].B.monthly01.approvedAt).toBe('2026-06-19T10:00:00.000Z');
  });

  it('mergeMemberKpiApprovalIntoStore — keeps rejected KPI2 row over later submitted backup', () => {
    const store = createEmptyKpiOperationalStore();
    const rowId = kpi2RowId('B', '2026-06-19', 'task-1');
    store.kpi2RowStatus[rowId] = {
      status: KPI_STATUS.REJECTED,
      submittedAt: '2026-06-19T09:00:00.000Z',
      approvedAt: '2026-06-19T10:00:00.000Z',
      approver: '팀장',
      rejectReason: 'needs evidence',
    };
    const incoming = {
      months: {},
      kpi2RowStatus: {
        [rowId]: {
          status: KPI_STATUS.SUBMITTED,
          submittedAt: '2026-06-19T11:00:00.000Z',
          approvedAt: null,
          approver: '',
          rejectReason: '',
        },
      },
    };

    const merged = mergeMemberKpiApprovalIntoStore(store, 'B', incoming);

    expect(merged.kpi2RowStatus[rowId].status).toBe(KPI_STATUS.REJECTED);
    expect(merged.kpi2RowStatus[rowId].rejectReason).toBe('needs evidence');
  });

  it('extractMemberKpiApprovalSlice — legacy row id도 포함', () => {
    const days = {
      '2026-06-16': {
        tasks: [{ id: 't1', kpi2Effect: { enabled: true }, done: true }],
      },
    };
    const operational = createEmptyKpiOperationalStore();
    operational.kpi2RowStatus[kpi2LegacyRowId('2026-06-16', 't1')] = {
      status: KPI_STATUS.SUBMITTED,
      submittedAt: '2026-06-20T11:00:00.000Z',
    };
    const slice = extractMemberKpiApprovalSlice(operational, 'B', days);
    expect(slice.kpi2RowStatus[kpi2LegacyRowId('2026-06-16', 't1')].status).toBe(KPI_STATUS.SUBMITTED);
  });
});
