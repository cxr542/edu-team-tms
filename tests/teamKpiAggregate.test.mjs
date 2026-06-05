import { describe, expect, it } from 'vitest';
import { KPI_STATUS } from '../src/constants/kpiStatuses.js';
import { buildTeamIntegratedSummary } from '../src/utils/teamKpiAggregate.js';

describe('buildTeamIntegratedSummary', () => {
  it('KPI1 uses team M/M ratio not avg of member %', () => {
    const monthly = [
      {
        kpi1: { work: 1, improve: 0, leave: 0, available: 10, utilization: 10 },
        kpi2: { productivityPct: null },
        status: '작성중',
        rows02: [],
      },
      {
        kpi1: { work: 1, improve: 0, leave: 0, available: 2, utilization: 50 },
        kpi2: { productivityPct: null },
        status: '작성중',
        rows02: [],
      },
    ];
    const t = buildTeamIntegratedSummary(monthly, [{ quarter: { composite: 0 } }]);
    expect(t.kpi1.utilization).toBeCloseTo(16.67, 1);
    expect(t.kpi1.utilization).not.toBe((10 + 50) / 2);
  });

  it('KPI3 weighted composite from element averages', () => {
    const monthly = [{ kpi1: {}, kpi2: {}, rows02: [], status: '작성중' }];
    const quarterly = [
      { quarter: { level: 3.6, dm: 4, leader: 3.6, practice: 4, composite: 3.7 }, breakdown: {} },
      { quarter: { level: 3.2, dm: 3.5, leader: 3, practice: 3, composite: 3.2 }, breakdown: {} },
    ];
    const t = buildTeamIntegratedSummary(monthly, quarterly);
    expect(t.kpi3.level).toBe(3.4);
    expect(t.kpi3.composite).toBeGreaterThan(0);
    expect(t.grade3).not.toBe('—');
  });

  it('KPI2 shows preview rollup when no approved effect rows (matches member cards)', () => {
    const monthly = [
      {
        kpi1: { work: 0, improve: 0, leave: 0, available: 1 },
        kpi2: { productivityPct: null },
        status: KPI_STATUS.DRAFT,
        rows02: [
          { 상태: KPI_STATUS.SUBMITTED, 계획시간: 10, 실작업시간: 8 },
        ],
      },
    ];
    const t = buildTeamIntegratedSummary(monthly, [{ quarter: { composite: 0 } }]);
    expect(t.kpi2.productivityPct).toBeNull();
    expect(t.kpi2.displayPct).toBeCloseTo(125, 0);
    expect(t.kpi2.usesPreview).toBe(true);
    expect(t.grade2).not.toBe('—');
  });
});
