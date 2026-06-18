import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { KPI_STATUS } from '../src/constants/kpiStatuses.js';
import {
  KPI_OPERATIONAL_STORAGE_KEY,
  createEmptyKpiOperationalStore,
  kpi2LegacyRowId,
} from '../src/constants/kpiOperationalStore.js';
import { JOURNAL_STORAGE_KEY } from '../src/utils/journalSnapshot.js';
import {
  listPendingApprovals,
  listPendingApprovalsFromBrowser,
  summarizePendingApprovals,
} from '../src/utils/kpiReportData.js';

const IMPROVE_PROJECTS = [{ id: 'p1', name: 'proj', code: 'p1' }];

describe('leader KPI pending badge data', () => {
  it('summarizePendingApprovals counts KPI1 and KPI2 items', () => {
    const summary = summarizePendingApprovals([
      { type: 'KPI1' },
      { type: 'KPI2' },
      { type: 'KPI2' },
    ]);
    expect(summary).toEqual({ total: 3, kpi1: 1, kpi2: 2 });
  });

  it('listPendingApprovalsFromBrowser returns array', () => {
    const items = listPendingApprovalsFromBrowser({ year: 2026, monthIndex: 5 });
    expect(Array.isArray(items)).toBe(true);
  });

  it('legacy KPI2 submitted rows count toward pending badge', () => {
    const memberJournals = {
      B: {
        days: {
          '2026-06-16': {
            holiday: false,
            mm: { work: 0.5, improve: 0, leave: 0 },
            tasks: [
              {
                id: 't1',
                cat: 'prep',
                title: 'legacy KPI2',
                plan: 8,
                actual: 4,
                done: true,
                kpi2Effect: { enabled: true, projectId: 'p1', baselineHours: 8 },
              },
            ],
          },
        },
      },
    };
    const kpiOperational = createEmptyKpiOperationalStore();
    kpiOperational.kpi2RowStatus[kpi2LegacyRowId('2026-06-16', 't1')] = {
      status: KPI_STATUS.SUBMITTED,
      submittedAt: '2026-06-20T11:00:00.000Z',
    };

    const items = listPendingApprovals({
      year: 2026,
      monthIndex: 5,
      getMemberDays: (code) => memberJournals[code]?.days || {},
      kpiOperational,
      improveProjects: IMPROVE_PROJECTS,
    });
    const summary = summarizePendingApprovals(items);
    expect(summary.kpi2).toBe(1);
    expect(items.some((item) => item.type === 'KPI2' && item.member.code === 'B')).toBe(true);
  });

  it('approved legacy KPI2 rows are excluded from pending badge', () => {
    const memberJournals = {
      B: {
        days: {
          '2026-06-16': {
            holiday: false,
            mm: { work: 0.5, improve: 0, leave: 0 },
            tasks: [
              {
                id: 't1',
                cat: 'prep',
                title: 'legacy KPI2',
                plan: 8,
                actual: 4,
                done: true,
                kpi2Effect: { enabled: true, projectId: 'p1', baselineHours: 8 },
              },
            ],
          },
        },
      },
    };
    const kpiOperational = createEmptyKpiOperationalStore();
    kpiOperational.kpi2RowStatus[kpi2LegacyRowId('2026-06-16', 't1')] = {
      status: KPI_STATUS.APPROVED,
      approvedAt: '2026-06-21T10:00:00.000Z',
    };

    const items = listPendingApprovals({
      year: 2026,
      monthIndex: 5,
      getMemberDays: (code) => memberJournals[code]?.days || {},
      kpiOperational,
      improveProjects: IMPROVE_PROJECTS,
    });
    expect(items.filter((item) => item.type === 'KPI2')).toHaveLength(0);
  });

  it('draft legacy KPI2 rows are excluded from pending badge', () => {
    const memberJournals = {
      B: {
        days: {
          '2026-06-16': {
            holiday: false,
            mm: { work: 0.5, improve: 0, leave: 0 },
            tasks: [
              {
                id: 't1',
                cat: 'prep',
                title: 'legacy KPI2',
                plan: 8,
                actual: 4,
                done: true,
                kpi2Effect: { enabled: true, projectId: 'p1', baselineHours: 8 },
              },
            ],
          },
        },
      },
    };
    const kpiOperational = createEmptyKpiOperationalStore();
    kpiOperational.kpi2RowStatus[kpi2LegacyRowId('2026-06-16', 't1')] = {
      status: KPI_STATUS.DRAFT,
    };

    const items = listPendingApprovals({
      year: 2026,
      monthIndex: 5,
      getMemberDays: (code) => memberJournals[code]?.days || {},
      kpiOperational,
      improveProjects: IMPROVE_PROJECTS,
    });
    expect(items.filter((item) => item.type === 'KPI2')).toHaveLength(0);
  });

  describe('listPendingApprovalsFromBrowser readonly migration', () => {
    let storage;

    beforeEach(() => {
      storage = new Map();
      vi.stubGlobal('localStorage', {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, value),
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('does not mutate KPI operational localStorage during badge load', () => {
      const kpiOperational = createEmptyKpiOperationalStore();
      kpiOperational.kpi2RowStatus[kpi2LegacyRowId('2026-06-16', 't1')] = {
        status: KPI_STATUS.SUBMITTED,
        submittedAt: '2026-06-20T11:00:00.000Z',
      };
      const journalStore = {
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
                    title: 'legacy KPI2',
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
        meta: {},
      };
      storage.set(KPI_OPERATIONAL_STORAGE_KEY, JSON.stringify(kpiOperational));
      storage.set(JOURNAL_STORAGE_KEY, JSON.stringify(journalStore));

      const items = listPendingApprovalsFromBrowser({ year: 2026, monthIndex: 5 });
      expect(summarizePendingApprovals(items).kpi2).toBe(1);

      const persisted = JSON.parse(storage.get(KPI_OPERATIONAL_STORAGE_KEY));
      expect(persisted.kpi2RowStatus[kpi2LegacyRowId('2026-06-16', 't1')]).toBeTruthy();
      expect(persisted.kpi2RowStatus['B|2026-06-16|t1']).toBeUndefined();
    });
  });
});
