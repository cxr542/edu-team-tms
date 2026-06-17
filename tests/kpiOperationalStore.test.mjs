import { describe, expect, it } from 'vitest';
import {
  createEmptyKpiOperationalStore,
  kpi2LegacyRowId,
  kpi2RowId,
  migrateLegacyKpi2RowStatus,
  readKpi2RowStatus,
} from '../src/constants/kpiOperationalStore.js';

describe('kpiOperationalStore kpi2 row id migration', () => {
  it('readKpi2RowStatus - scoped 키만 조회한다', () => {
    const status = {
      [kpi2LegacyRowId('2026-06-01', 't1')]: { status: '제출' },
      [kpi2RowId('A', '2026-06-01', 't1')]: { status: '승인' },
    };
    expect(readKpi2RowStatus(status, 'A', '2026-06-01', 't1').value.status).toBe('승인');
    expect(readKpi2RowStatus(status, 'B', '2026-06-01', 't1').value).toBeNull();
  });

  it('migrateLegacyKpi2RowStatus - 단일 멤버 매칭 legacy 키 승격', () => {
    const store = createEmptyKpiOperationalStore();
    store.kpi2RowStatus = {
      [kpi2LegacyRowId('2026-06-01', 't1')]: { status: '제출', submittedAt: '2026-06-01T00:00:00.000Z' },
    };
    const migrated = migrateLegacyKpi2RowStatus(store, (dayKey, taskId) =>
      dayKey === '2026-06-01' && taskId === 't1' ? 'A' : null
    );
    expect(migrated.kpi2RowStatus[kpi2RowId('A', '2026-06-01', 't1')].status).toBe('제출');
    expect(migrated.kpi2RowStatus[kpi2LegacyRowId('2026-06-01', 't1')]).toBeUndefined();
  });

  it('migrateLegacyKpi2RowStatus - 미해결 legacy 키 제거', () => {
    const store = createEmptyKpiOperationalStore();
    store.kpi2RowStatus = {
      [kpi2LegacyRowId('2026-06-01', 't1')]: { status: '제출' },
    };
    const migrated = migrateLegacyKpi2RowStatus(store, () => null);
    expect(Object.keys(migrated.kpi2RowStatus)).toHaveLength(0);
  });
});
