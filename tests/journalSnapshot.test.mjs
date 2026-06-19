import { describe, expect, it } from 'vitest';
import { kpi2RowId } from '../src/constants/kpiOperationalStore.js';
import { KPI_STATUS } from '../src/constants/kpiStatuses.js';
import { buildMemberJournalSnapshot } from '../src/utils/journalSnapshot.js';

describe('journal snapshot payloads', () => {
  it('includes member-scoped KPI approval state for cloud member saves', () => {
    const taskId = 'effect-task-1';
    const dayKey = '2026-06-19';
    const rowId = kpi2RowId('B', dayKey, taskId);
    const slice = {
      days: {
        [dayKey]: {
          tasks: [
            {
              id: taskId,
              title: 'automation effect',
              kpi2Effect: { enabled: true },
            },
          ],
        },
      },
      weekSummaries: {},
      nextWeekPlans: {},
      kpiWeekMemos: {},
      prefs: null,
    };
    const kpiOperational = {
      months: {
        '2026-06': {
          B: {
            monthly01: {
              status: KPI_STATUS.SUBMITTED,
              submittedAt: '2026-06-19T09:00:00.000Z',
            },
          },
        },
      },
      kpi2RowStatus: {
        [rowId]: {
          status: KPI_STATUS.SUBMITTED,
          submittedAt: '2026-06-19T09:30:00.000Z',
        },
      },
    };

    const payload = buildMemberJournalSnapshot('B', slice, kpiOperational);

    expect(payload.kpiApproval.months['2026-06'].monthly01.status).toBe(KPI_STATUS.SUBMITTED);
    expect(payload.kpiApproval.kpi2RowStatus[rowId].status).toBe(KPI_STATUS.SUBMITTED);
  });
});
