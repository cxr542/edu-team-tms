import { describe, expect, it } from 'vitest';
import { computeMonthKpi2Summary, buildKpi02EffectRows } from '../src/utils/computeTeamKpi.js';
import { KPI_STATUS } from '../src/constants/kpiStatuses.js';

const row = (dayKey, status, plan = 2, actual = 1) => ({ dayKey, 상태: status, 계획시간: plan, 실작업시간: actual });

describe('KPI2 공식 생산성 — 승인 생략(구두 승인 간주) 반영', () => {
  it('3Q(2026-07~) 제출 건은 공식 집계에 포함, 반려·작성중은 제외', () => {
    const rows = [
      row('2026-08-03', KPI_STATUS.SUBMITTED, 4, 2), // 간주 승인
      row('2026-08-04', KPI_STATUS.APPROVED, 2, 1), // 승인
      row('2026-08-05', KPI_STATUS.REJECTED, 100, 1), // 사후 반려 → 제외
      row('2026-08-06', KPI_STATUS.DRAFT, 100, 1), // 작성중 → 제외
    ];
    const official = computeMonthKpi2Summary(rows, true);
    expect(official.submittedCount).toBe(2);
    expect(official.planSum).toBe(6);
    expect(official.actualSum).toBe(3);
    expect(official.productivityPct).toBe(200);
  });

  it('3Q 이전(2026-06) 제출 건은 기존대로 승인이 있어야 공식 집계', () => {
    const rows = [row('2026-06-10', KPI_STATUS.SUBMITTED, 4, 2), row('2026-06-11', KPI_STATUS.APPROVED, 2, 1)];
    const official = computeMonthKpi2Summary(rows, true);
    expect(official.submittedCount).toBe(1); // 승인된 1건만
    expect(official.planSum).toBe(2);
  });

  it('미리보기(approvedOnly=false) 규칙은 그대로: 반려만 제외', () => {
    const rows = [row('2026-08-03', KPI_STATUS.SUBMITTED), row('2026-08-04', KPI_STATUS.DRAFT), row('2026-08-05', KPI_STATUS.REJECTED)];
    expect(computeMonthKpi2Summary(rows, false).submittedCount).toBe(2);
  });

  it('사후 반려하면 간주가 풀려 집계에서 빠진다', () => {
    const before = computeMonthKpi2Summary([row('2026-09-01', KPI_STATUS.SUBMITTED, 3, 1)], true);
    const after = computeMonthKpi2Summary([row('2026-09-01', KPI_STATUS.REJECTED, 3, 1)], true);
    expect(before.submittedCount).toBe(1);
    expect(after.submittedCount).toBe(0);
  });
});

describe('buildKpi02EffectRows — 간주승인 표시', () => {
  const makeDays = (key) => ({
    [key]: {
      holiday: false,
      mm: { work: 0, improve: 0.25, leave: 0 },
      tasks: [
        {
          id: 't1',
          title: '교안 자동화',
          cat: 'ai',
          done: true,
          plan: 2,
          actual: 1,
          kpi2Effect: { enabled: true, baselineHours: 2, projectId: 'p1' },
        },
      ],
    },
  });
  const projects = [{ id: 'p1', name: '교안 자동화 도구', code: 'p1' }];

  it('저장 상태 「제출」: 3Q(2026-08)면 간주승인=true, 상태 값은 그대로', () => {
    const status = { 'A|2026-08-03|t1': { status: KPI_STATUS.SUBMITTED } };
    const rows = buildKpi02EffectRows(2026, 7, makeDays('2026-08-03'), projects, 'A', status);
    expect(rows).toHaveLength(1);
    expect(rows[0].상태).toBe(KPI_STATUS.SUBMITTED);
    expect(rows[0].간주승인).toBe(true);
  });

  it('2026-06 제출은 간주승인 아님, 작성중·반려도 아님', () => {
    const june = buildKpi02EffectRows(2026, 5, makeDays('2026-06-03'), projects, 'A', {
      'A|2026-06-03|t1': { status: KPI_STATUS.SUBMITTED },
    });
    expect(june[0].간주승인).toBe(false);
    const draft = buildKpi02EffectRows(2026, 7, makeDays('2026-08-03'), projects, 'A', {});
    expect(draft[0].간주승인).toBe(false);
    const rejected = buildKpi02EffectRows(2026, 7, makeDays('2026-08-03'), projects, 'A', {
      'A|2026-08-03|t1': { status: KPI_STATUS.REJECTED },
    });
    expect(rejected[0].간주승인).toBe(false);
  });
});
