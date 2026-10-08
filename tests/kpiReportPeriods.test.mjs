import { describe, expect, it } from 'vitest';
import { TEAM_KPI_MEMBERS } from '../src/constants/kpiMembers.js';
import {
  aggregateMemberRows,
  buildAnnualView,
  buildQuarterView,
  monthIndexesOfQuarter,
  quarterOfMonthIndex,
} from '../src/utils/kpiReportPeriods.js';

const member = TEAM_KPI_MEMBERS[0];

const monthRows = (work, available, plan = 0, actual = 0, status = '승인') => [
  {
    member,
    kpi1: { work, improve: 0, leave: 0, available },
    rows02: plan
      ? [{ 상태: status, dayKey: '2026-01-05', 계획시간: plan, 실작업시간: actual }]
      : [],
  },
];

describe('분기·연간 리포트 집계', () => {
  it('분기 월 인덱스와 분기 판정', () => {
    expect(monthIndexesOfQuarter(3)).toEqual([6, 7, 8]);
    expect(monthIndexesOfQuarter(1)).toEqual([0, 1, 2]);
    expect(quarterOfMonthIndex(9)).toBe(4);
    expect(quarterOfMonthIndex(0)).toBe(1);
  });

  it('KPI1 은 월 평균이 아니라 분자·분모를 합산해 계산한다', () => {
    // 1월 18/20(90%), 2월 10/40(25%) → 합산 28/60 ≈ 46.7% (월 평균이면 57.5%)
    const rows = aggregateMemberRows([
      { rows: monthRows(18, 20) },
      { rows: monthRows(10, 40) },
    ]);
    expect(rows[0].kpi1.work).toBe(28);
    expect(rows[0].kpi1.available).toBe(60);
    expect(rows[0].kpi1.utilization).toBeCloseTo(46.6667, 3); // 단순 평균은 (90+25)/2=57.5
  });

  it('KPI2 는 계획시간 합 ÷ 실작업시간 합 (승인 건 기준)', () => {
    const rows = aggregateMemberRows([
      { rows: monthRows(1, 20, 8, 4) },
      { rows: monthRows(1, 20, 4, 4) },
    ]);
    expect(rows[0].kpi2.planSum).toBe(12);
    expect(rows[0].kpi2.actualSum).toBe(8);
    expect(rows[0].kpi2.productivityPct).toBe(150);
    expect(rows[0].kpi2UsesPreview).toBe(false);
  });

  it('승인된 효과 건이 없으면 미리보기 값을 쓰고 표시한다', () => {
    const rows = aggregateMemberRows([{ rows: monthRows(1, 20, 8, 4, '제출') }]);
    expect(rows[0].kpi2UsesPreview).toBe(true);
    expect(rows[0].kpi2DisplayPct).toBe(200);
  });

  it('가용 M/D 가 0이면 가동률을 계산하지 않는다', () => {
    const rows = aggregateMemberRows([{ rows: monthRows(0, 0) }]);
    expect(rows[0].kpi1.utilization).toBeNull();
  });

  const ctx = {
    year: 2026,
    getMemberDays: () => ({}),
    getMemberKpiWeekMemos: () => ({}),
    improveProjects: [],
  };

  it('분기 보기: 월 3개와 구성원 행, 분기 KPI3 를 만든다', () => {
    const kpiOperational = { quarters: {}, months: {}, kpi2RowStatus: {} };
    const view = buildQuarterView({ ...ctx, quarter: 3, kpiOperational });
    expect(view.months.map((m) => m.monthIndex)).toEqual([6, 7, 8]);
    expect(view.memberRows).toHaveLength(TEAM_KPI_MEMBERS.length);
    expect(view.quarterly).toHaveLength(TEAM_KPI_MEMBERS.length);
  });

  it('연간 보기: 4분기 확정 종합을 연간 값으로 쓰고 평균하지 않는다', () => {
    const q = (composite, locked, level = 4) => ({
      quarter: { composite, locked, level, dm: 4, leader: 4, practice: 4 },
      memos: [],
    });
    const kpiOperational = {
      months: {},
      kpi2RowStatus: {},
      quarters: {
        '2026-1Q': { [member.code]: q(4.0, true) },
        '2026-2Q': { [member.code]: q(3.0, true) },
        '2026-4Q': { [member.code]: q(4.6, true, 5) },
      },
    };
    const view = buildAnnualView({ ...ctx, kpiOperational });
    expect(view.months).toHaveLength(12);
    const row = view.memberKpi3.find((m) => m.member.code === member.code);
    expect(row.confirmedCount).toBe(3);
    expect(row.annualComposite).toBe(4.6);
    expect(row.annualLevel).toBe(5);
    expect(row.grade3).not.toBe('—');
    expect(view.teamKpi3.memberCount).toBe(1);
    expect(view.teamKpi3.composite).toBeGreaterThan(0);
  });

  it('4분기가 확정 전이면 앞선 분기가 확정이어도 연간 값은 없다', () => {
    const q = (composite, locked) => ({ quarter: { composite, locked, level: 4 }, memos: [] });
    const kpiOperational = {
      months: {},
      kpi2RowStatus: {},
      quarters: {
        '2026-3Q': { [member.code]: q(4.2, true) },
        '2026-4Q': { [member.code]: q(4.8, false) },
      },
    };
    const view = buildAnnualView({ ...ctx, kpiOperational });
    const row = view.memberKpi3.find((m) => m.member.code === member.code);
    expect(row.annualComposite).toBeNull();
    expect(row.grade3).toBe('—');
    expect(view.teamKpi3.composite).toBeNull();
  });

  it('확정 분기가 없으면 연간 KPI3 는 값도 등급도 없다', () => {
    const view = buildAnnualView({ ...ctx, kpiOperational: { months: {}, kpi2RowStatus: {}, quarters: {} } });
    expect(view.teamKpi3.composite).toBeNull();
    expect(view.teamKpi3.grade3).toBe('—');
  });
});

import { buildMonthlyCompetencyReport } from '../src/utils/kpiReportPeriods.js';

describe('월별 레벨(역량) 평가 리포트', () => {
  const side = (intLevel, proposed) => ({ intLevel, computed: { proposed } });

  it('구성원마다 한 행을 만들고 기록이 없으면 값은 비어 있다', () => {
    const kpiOperational = {
      competencyMonths: {
        '2026-07': {
          [member.code]: {
            self: side(3, 3.6),
            manager: side(4, 4.0),
            selfLocked: true,
            managerLocked: true,
          },
        },
      },
    };
    const report = buildMonthlyCompetencyReport({ year: 2026, monthIndex: 6, kpiOperational });
    expect(report.rows).toHaveLength(TEAM_KPI_MEMBERS.length);
    const mine = report.rows.find((r) => r.member.code === member.code);
    expect(mine.selfLevel).toBe(3);
    expect(mine.managerLevel).toBe(4);
    expect(mine.monthlyFinal).toBeGreaterThan(0);
    expect(mine.managerLocked).toBe(true);
    const empty = report.rows.find((r) => r.member.code !== member.code);
    expect(empty.monthlyFinal).toBeNull();
    expect(empty.selfLevel).toBeNull();
    expect(report.confirmedCount).toBe(1);
    expect(report.submittedCount).toBe(1);
    expect(report.teamAverage).toBe(report.rows.find((r) => r.monthlyFinal != null).monthlyFinal);
  });

  it('기록이 전혀 없으면 팀 평균도 없다', () => {
    const report = buildMonthlyCompetencyReport({ year: 2026, monthIndex: 6, kpiOperational: { competencyMonths: {} } });
    expect(report.teamAverage).toBeNull();
    expect(report.confirmedCount).toBe(0);
  });
});

describe('연간 리포트 분기별 합산', () => {
  const ctx2 = { year: 2026, getMemberDays: () => ({}), getMemberKpiWeekMemos: () => ({}), improveProjects: [] };

  it('분기별 구성원 합산 4개와 분기 레벨을 만든다', () => {
    const kpiOperational = {
      months: {},
      kpi2RowStatus: {},
      quarters: {
        '2026-3Q': { [member.code]: { quarter: { composite: 4.2, locked: true, level: 4 }, memos: [] } },
      },
    };
    const view = buildAnnualView({ ...ctx2, kpiOperational });
    expect(view.quarterRows.map((q) => q.quarter)).toEqual([1, 2, 3, 4]);
    expect(view.quarterRows[0].memberRows).toHaveLength(TEAM_KPI_MEMBERS.length);
    expect(view.quarterRows[0].memberRows[0].monthCount).toBe(3);
    const row = view.memberKpi3.find((m) => m.member.code === member.code);
    expect(row.perQuarter[2].level).toBe(4);
    expect(row.perQuarter[0].level).toBeNull();
  });
});
