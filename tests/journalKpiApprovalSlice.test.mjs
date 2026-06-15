import { describe, expect, it } from 'vitest';
import { KPI_STATUS } from '../src/constants/kpiStatuses.js';
import {
  extractMemberKpiApprovalSlice,
  mergeJournalKpiApprovalImport,
  mergeMemberKpiApprovalIntoStore,
} from '../src/utils/journalKpiApprovalSlice.js';
import { createEmptyKpiOperationalStore } from '../src/constants/kpiOperationalStore.js';

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
    operational.kpi2RowStatus['2026-06-16|t1'] = {
      status: KPI_STATUS.SUBMITTED,
      submittedAt: '2026-06-20T11:00:00.000Z',
    };

    const slice = extractMemberKpiApprovalSlice(operational, 'B', days);
    expect(slice.months['2026-06'].monthly01.status).toBe(KPI_STATUS.SUBMITTED);
    expect(slice.kpi2RowStatus['2026-06-16|t1'].status).toBe(KPI_STATUS.SUBMITTED);
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
    expect(merged.kpi2RowStatus['2026-06-16|t1'].status).toBe(KPI_STATUS.SUBMITTED);
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
});
