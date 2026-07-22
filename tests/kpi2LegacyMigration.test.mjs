import { describe, expect, it } from 'vitest';
import { KPI_STATUS } from '../src/constants/kpiStatuses.js';
import {
  createEmptyKpiOperationalStore,
  kpi2LegacyRowId,
  kpi2RowId,
} from '../src/constants/kpiOperationalStore.js';
import {
  migrateKpiOperationalStoreReadonly,
  resolveLegacyKpi2Member,
} from '../src/utils/kpi2LegacyMigration.js';

describe('kpi2LegacyMigration', () => {
  it('resolves legacy KPI2 approval rows from effect toggle even before project selection', () => {
    const memberJournals = {
      B: {
        days: {
          '2026-06-16': {
            tasks: [
              {
                id: 'legacy-effect',
                title: 'Legacy effect row',
                kpi2Effect: { enabled: true, projectId: '', baselineHours: 8 },
              },
            ],
          },
        },
      },
    };

    expect(resolveLegacyKpi2Member(memberJournals, '2026-06-16', 'legacy-effect')).toBe('B');
  });

  it('preserves projectless legacy KPI2 approval status by scoping it to the resolved member', () => {
    const store = createEmptyKpiOperationalStore();
    store.kpi2RowStatus[kpi2LegacyRowId('2026-06-16', 'legacy-effect')] = {
      status: KPI_STATUS.APPROVED,
      submittedAt: '2026-06-20T10:00:00.000Z',
      approvedAt: '2026-06-21T10:00:00.000Z',
      approver: '팀장',
    };
    const memberJournals = {
      B: {
        days: {
          '2026-06-16': {
            tasks: [
              {
                id: 'legacy-effect',
                title: 'Legacy effect row',
                kpi2Effect: { enabled: true, projectId: '', baselineHours: 8 },
              },
            ],
          },
        },
      },
    };

    const migrated = migrateKpiOperationalStoreReadonly(store, memberJournals);

    expect(migrated.kpi2RowStatus[kpi2LegacyRowId('2026-06-16', 'legacy-effect')]).toBeUndefined();
    expect(migrated.kpi2RowStatus[kpi2RowId('B', '2026-06-16', 'legacy-effect')]).toMatchObject({
      status: KPI_STATUS.APPROVED,
      approver: '팀장',
    });
  });
});
