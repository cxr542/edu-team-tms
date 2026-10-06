import { describe, expect, it } from 'vitest';
import { KPI_STATUS } from '../src/constants/kpiStatuses.js';
import {
  mergeKpiApprovalSlices,
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

  it('mergeJournalKpiApprovalImport — excludes preserved own-member approval on view-only pull', () => {
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
    const snapshot = {
      memberJournals: {
        B: {
          kpiApproval: {
            months: {
              '2026-06': {
                monthly01: {
                  work: 1,
                  status: KPI_STATUS.SUBMITTED,
                  submittedAt: '2026-06-20T10:00:00.000Z',
                },
              },
            },
            kpi2RowStatus: {
              '2026-06-16|b1': {
                status: KPI_STATUS.SUBMITTED,
                submittedAt: '2026-06-20T11:00:00.000Z',
              },
            },
          },
        },
        C: {
          kpiApproval: {
            months: {
              '2026-06': {
                monthly01: {
                  work: 1,
                  status: KPI_STATUS.SUBMITTED,
                  submittedAt: '2026-06-20T12:00:00.000Z',
                },
              },
            },
            kpi2RowStatus: {
              '2026-06-17|c1': {
                status: KPI_STATUS.SUBMITTED,
                submittedAt: '2026-06-20T13:00:00.000Z',
              },
            },
          },
        },
      },
    };

    const merged = mergeJournalKpiApprovalImport(store, snapshot, { excludeMemberCodes: ['B'] });

    expect(merged.months['2026-06'].B.monthly01.status).toBe(KPI_STATUS.DRAFT);
    expect(merged.months['2026-06'].C.monthly01.status).toBe(KPI_STATUS.SUBMITTED);
    expect(merged.kpi2RowStatus[kpi2RowId('B', '2026-06-16', 'b1')]).toBeUndefined();
    expect(merged.kpi2RowStatus[kpi2RowId('C', '2026-06-17', 'c1')].status).toBe(KPI_STATUS.SUBMITTED);
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

  it('mergeMemberKpiApprovalIntoStore — accepts later resubmission after rejection', () => {
    const store = createEmptyKpiOperationalStore();
    store.months['2026-06'] = {
      B: {
        monthly01: {
          status: KPI_STATUS.REJECTED,
          submittedAt: '2026-06-21T10:00:00.000Z',
          approvedAt: '2026-06-21T11:00:00.000Z',
        },
      },
    };
    const incoming = {
      months: {
        '2026-06': {
          monthly01: {
            status: KPI_STATUS.SUBMITTED,
            submittedAt: '2026-06-21T12:00:00.000Z',
          },
        },
      },
      kpi2RowStatus: {},
    };

    const merged = mergeMemberKpiApprovalIntoStore(store, 'B', incoming);

    expect(merged.months['2026-06'].B.monthly01.status).toBe(KPI_STATUS.SUBMITTED);
    expect(merged.months['2026-06'].B.monthly01.submittedAt).toBe('2026-06-21T12:00:00.000Z');
  });

  it('mergeMemberKpiApprovalIntoStore — accepts later KPI2 row resubmission after rejection', () => {
    const store = createEmptyKpiOperationalStore();
    const rowId = kpi2RowId('B', '2026-06-16', 't1');
    store.kpi2RowStatus[rowId] = {
      status: KPI_STATUS.REJECTED,
      submittedAt: '2026-06-21T10:00:00.000Z',
      approvedAt: '2026-06-21T11:00:00.000Z',
      rejectReason: '수정 필요',
    };
    const incoming = {
      months: {},
      kpi2RowStatus: {
        '2026-06-16|t1': {
          status: KPI_STATUS.SUBMITTED,
          submittedAt: '2026-06-21T12:00:00.000Z',
        },
      },
    };

    const merged = mergeMemberKpiApprovalIntoStore(store, 'B', incoming);

    expect(merged.kpi2RowStatus[rowId].status).toBe(KPI_STATUS.SUBMITTED);
    expect(merged.kpi2RowStatus[rowId].submittedAt).toBe('2026-06-21T12:00:00.000Z');
    expect(merged.kpi2RowStatus[rowId].rejectReason).toBeUndefined();
  });

  it('mergeMemberKpiApprovalIntoStore — uses the newer timestamp when ranks match', () => {
    const store = createEmptyKpiOperationalStore();
    store.months['2026-06'] = {
      B: { monthly01: { status: KPI_STATUS.SUBMITTED, submittedAt: '2026-06-21T10:00:00.000Z' } },
    };
    const incoming = {
      months: {
        '2026-06': {
          monthly01: { status: KPI_STATUS.SUBMITTED, submittedAt: '2026-06-21T12:00:00.000Z' },
        },
      },
      kpi2RowStatus: {},
    };

    const merged = mergeMemberKpiApprovalIntoStore(store, 'B', incoming);

    expect(merged.months['2026-06'].B.monthly01.submittedAt).toBe('2026-06-21T12:00:00.000Z');
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
  describe('월 확정 철회(withdraw) 병합', () => {
    const wrap = (monthly01) => ({ months: { '2026-09': { monthly01 } }, kpi2RowStatus: {} });
    const submitted = wrap({
      status: KPI_STATUS.SUBMITTED,
      submittedAt: '2026-09-30T01:00:00.000Z',
      work: 20.5,
    });
    const withdrawnLater = wrap({
      status: KPI_STATUS.DRAFT,
      submittedAt: null,
      withdrawnAt: '2026-10-06T05:00:00.000Z',
      work: 20.5,
    });
    const resubmitted = wrap({
      status: KPI_STATUS.SUBMITTED,
      submittedAt: '2026-10-06T06:00:00.000Z',
      withdrawnAt: '2026-10-06T05:00:00.000Z',
      work: 22,
    });
    const status = (slice) => slice.months['2026-09'].monthly01.status;

    it('더 늦은 철회가 기존 제출본을 이긴다', () => {
      expect(status(mergeKpiApprovalSlices(submitted, withdrawnLater, 'B'))).toBe(KPI_STATUS.DRAFT);
    });

    it('옛 제출본이 들어와도 더 늦은 철회를 되돌리지 못한다', () => {
      expect(status(mergeKpiApprovalSlices(withdrawnLater, submitted, 'B'))).toBe(KPI_STATUS.DRAFT);
    });

    it('철회 이후 재제출은 철회를 이긴다', () => {
      expect(status(mergeKpiApprovalSlices(withdrawnLater, resubmitted, 'B'))).toBe(KPI_STATUS.SUBMITTED);
      expect(status(mergeKpiApprovalSlices(resubmitted, withdrawnLater, 'B'))).toBe(KPI_STATUS.SUBMITTED);
    });

    it('withdrawnAt 없는 옛 철회 기록은 기존 규칙대로 제출본이 이긴다(하위 호환)', () => {
      const legacy = wrap({ status: KPI_STATUS.DRAFT, submittedAt: null });
      expect(status(mergeKpiApprovalSlices(submitted, legacy, 'B'))).toBe(KPI_STATUS.SUBMITTED);
    });

    it('승인된 기록은 철회로 다운그레이드되지 않는다', () => {
      const approved = wrap({
        status: KPI_STATUS.APPROVED,
        submittedAt: '2026-09-30T01:00:00.000Z',
        approvedAt: '2026-09-30T02:00:00.000Z',
      });
      expect(status(mergeKpiApprovalSlices(approved, withdrawnLater, 'B'))).toBe(KPI_STATUS.APPROVED);
    });
  });
});
