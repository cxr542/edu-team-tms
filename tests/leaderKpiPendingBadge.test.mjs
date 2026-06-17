import { afterEach, describe, expect, it, vi } from 'vitest';
import { KPI_OPERATIONAL_STORAGE_KEY, kpi2LegacyRowId } from '../src/constants/kpiOperationalStore.js';
import { KPI_STATUS } from '../src/constants/kpiStatuses.js';
import { JOURNAL_STORAGE_KEY } from '../src/utils/journalSnapshot.js';
import {
  listPendingApprovalsFromBrowser,
  summarizePendingApprovals,
} from '../src/utils/kpiReportData.js';

describe('leader KPI pending badge data', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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
    items.forEach((item) => {
      expect(['KPI1', 'KPI2']).toContain(item.type);
      if (item.type === 'KPI1') {
        expect(item.member?.code).toBeTruthy();
      }
    });
  });

  it('counts legacy KPI2 row submissions before the KPI store hook migrates localStorage', () => {
    const storage = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    });

    storage.set(
      JOURNAL_STORAGE_KEY,
      JSON.stringify({
        memberJournals: {
          B: {
            days: {
              '2026-06-16': {
                holiday: false,
                mm: { work: 1, improve: 0, leave: 0 },
                tasks: [
                  {
                    id: 'legacy-kpi2',
                    cat: 'other',
                    title: 'Legacy KPI2 effect',
                    plan: 4,
                    actual: 2,
                    done: true,
                    kpi2Effect: { enabled: true, projectId: 'team-kpi-system', baselineHours: 4 },
                  },
                ],
              },
            },
          },
        },
      })
    );
    storage.set(
      KPI_OPERATIONAL_STORAGE_KEY,
      JSON.stringify({
        kpi2RowStatus: {
          [kpi2LegacyRowId('2026-06-16', 'legacy-kpi2')]: {
            status: KPI_STATUS.SUBMITTED,
            submittedAt: '2026-06-20T11:00:00.000Z',
          },
        },
      })
    );

    const items = listPendingApprovalsFromBrowser({ year: 2026, monthIndex: 5 });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      type: 'KPI2',
      member: { code: 'B' },
      dayKey: '2026-06-16',
      taskId: 'legacy-kpi2',
    });
  });
});
