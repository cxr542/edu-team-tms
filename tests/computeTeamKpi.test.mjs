import { describe, expect, it } from 'vitest';
import {
  JOURNAL_SEED_ACADEMIZER_SCENARIO,
  KPI_WEEK_MEMOS_ACADEMIZER_SCENARIO,
} from '../src/data/journalSeedAcademizerScenario.js';
import {
  kpi2LegacyRowId,
  kpi2RowId,
} from '../src/constants/kpiOperationalStore.js';
import {
  buildKpi01cRows,
  buildKpi02EffectRows,
  computeTeamKpi,
  isImproveInvestmentTask,
  isKpi2EffectTask,
} from '../src/utils/computeTeamKpi.js';
import { recalcDayMmFromHours } from '../src/utils/journalMm.js';

const IMPROVE_PROJECTS = [
  { id: 'team-kpi-system', name: '팀 KPI 관리시스템', code: 'kpi-sys' },
  { id: 'ppt-academizer', name: 'PPT-Academizer', code: 'ppt-acad' },
];

/** 2026-06 시나리오 (법인카드=업무, KPI시스템=향상, academizer 효과=KPI2) */
const juneDays = {
  '2026-06-01': {
    holiday: false,
    mm: { work: 0.375, improve: 0, leave: 0 },
    tasks: [
      { id: 'a1', cat: 'other', title: '5월 법인카드 품의 등 행정', plan: 0.5, actual: 1, done: true },
      {
        id: 'a2',
        cat: 'ai',
        title: '팀 KPI 관리시스템',
        plan: 3,
        actual: 0,
        done: false,
        mmAxis: 'improve',
      },
      {
        id: 'a3',
        cat: 'prep',
        title: 'PPT 신규 작성 (Academizer)',
        plan: 4,
        actual: 5,
        done: true,
        kpi2Effect: { enabled: true, projectId: 'ppt-academizer', baselineHours: 8 },
      },
    ],
  },
  '2026-06-03': {
    holiday: true,
    mm: { work: 0, improve: 0, leave: 1 },
    tasks: [],
  },
};

describe('computeTeamKpi june', () => {
  it('isImproveInvestmentTask — KPI 시스템 개발', () => {
    const task = juneDays['2026-06-01'].tasks[1];
    expect(isImproveInvestmentTask(task)).toBe(true);
    expect(isKpi2EffectTask(task)).toBe(false);
  });

  it('buildKpi02EffectRows — 효과 건만', () => {
    const rows = buildKpi02EffectRows(2026, 5, juneDays, IMPROVE_PROJECTS);
    expect(rows.length).toBe(1);
    expect(rows[0].업무명).toBe('PPT 신규 작성 (Academizer)');
    expect(rows[0].계획시간).toBe(8);
    expect(rows[0].실작업시간).toBe(5);
    expect(rows[0]['생산성%']).toBeGreaterThan(150);
  });

  it('buildKpi02EffectRows — 행정·KPI 개발 제외', () => {
    const rows = buildKpi02EffectRows(2026, 5, juneDays, IMPROVE_PROJECTS);
    expect(rows.some((r) => r.업무명.includes('법인카드'))).toBe(false);
    expect(rows.some((r) => r.업무명.includes('KPI 관리시스템'))).toBe(false);
  });

  it('buildKpi01cRows — 6월 주차·휴일', () => {
    const rows = buildKpi01cRows(2026, 5, juneDays, {});
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.some((r) => r.휴일MM >= 1)).toBe(true);
  });

  it('buildKpi01cRows — KPI 탭 주간메모만 01c에 반영', () => {
    const weeks = buildKpi01cRows(2026, 5, juneDays, {});
    const weekKey = weeks[0]?.weekKey;
    expect(weekKey).toBeTruthy();
    const withMemo = buildKpi01cRows(2026, 5, juneDays, { [weekKey]: '  법인·KPI 정리  ' });
    expect(withMemo[0].주간메모).toBe('법인·KPI 정리');
  });

  it('computeTeamKpi — monthly01이 0만 저장돼 있으면 일지 M/M 사용', () => {
    const days = { ...JOURNAL_SEED_ACADEMIZER_SCENARIO };
    Object.values(days).forEach((day) => recalcDayMmFromHours(day));
    const m = computeTeamKpi({
      year: 2026,
      monthIndex: 5,
      days,
      kpiWeekMemos: {},
      improveProjects: IMPROVE_PROJECTS,
      monthly01: { work: 0, improve: 0, leave: 0, available: 1, status: '제출' },
    });
    expect(m.kpi1.improve).toBeCloseTo(1.25, 2);
  });

  it('computeTeamKpi — monthly01 없으면 일지 M/M로 가동률', () => {
    const m = computeTeamKpi({
      year: 2026,
      monthIndex: 5,
      days: juneDays,
      kpiWeekMemos: {},
      improveProjects: IMPROVE_PROJECTS,
      monthly01: null,
    });
    expect(m.kpi1.work).toBeGreaterThan(0);
    expect(m.kpi1.utilization).toBeGreaterThan(0);
  });

  it('academizer scenario — 개발 주 생산향상MM ≈ 1.25, KPI2 없음', () => {
    const days = { ...JOURNAL_SEED_ACADEMIZER_SCENARIO };
    Object.values(days).forEach((day) => recalcDayMmFromHours(day));
    const devWeek = buildKpi01cRows(2026, 5, days, KPI_WEEK_MEMOS_ACADEMIZER_SCENARIO);
    const wDev = devWeek.find((r) => r.weekKey === 'w2');
    expect(wDev).toBeTruthy();
    expect(wDev.생산향상MM).toBeCloseTo(1.25, 2);
    expect(wDev.업무MM).toBeCloseTo(0, 2);
    expect(wDev.주간메모).toContain('Academizer');
    const kpi2 = buildKpi02EffectRows(2026, 5, days, IMPROVE_PROJECTS);
    expect(kpi2.some((r) => r.업무명.includes('개발'))).toBe(false);
    expect(kpi2.length).toBe(1);
    expect(kpi2[0]['생산성%']).toBeCloseTo(160, 0);
  });

  it('buildKpi02EffectRows — 완료만 해도 기본 상태는 작성중', () => {
    const days = {
      '2026-06-20': {
        holiday: false,
        mm: { work: 0.625, improve: 0, leave: 0 },
        tasks: [
          {
            id: 'done-only',
            cat: 'prep',
            title: 'PPT (완료만)',
            plan: 8,
            actual: 5,
            done: true,
            kpi2Effect: { enabled: true, projectId: 'ppt-academizer', baselineHours: 8 },
          },
        ],
      },
    };
    const rows = buildKpi02EffectRows(2026, 5, days, IMPROVE_PROJECTS);
    expect(rows).toHaveLength(1);
    expect(rows[0].상태).toBe('작성중');
    expect(rows[0].실작업시간).toBe(5);
  });

  it('buildKpi02EffectRows — 미완료 실작업은 KPI2 행 실작업 0', () => {
    const days = {
      '2026-06-20': {
        holiday: false,
        mm: { work: 0, improve: 0, leave: 0 },
        tasks: [
          {
            id: 'draft',
            cat: 'prep',
            title: 'PPT (미완료)',
            plan: 8,
            actual: 5,
            done: false,
            kpi2Effect: { enabled: true, projectId: 'ppt-academizer', baselineHours: 8 },
          },
        ],
      },
    };
    recalcDayMmFromHours(days['2026-06-20']);
    expect(days['2026-06-20'].mm.work).toBe(0);
    const rows = buildKpi02EffectRows(2026, 5, days, IMPROVE_PROJECTS);
    expect(rows).toHaveLength(1);
    expect(rows[0].실작업시간).toBe(0);
  });

  it('computeTeamKpi — KPI2 요약 (승인 건만 집계)', () => {
    const task = juneDays['2026-06-01'].tasks[2];
    const rowId = kpi2RowId('A', '2026-06-01', task.id);
    const m = computeTeamKpi({
      year: 2026,
      monthIndex: 5,
      days: juneDays,
      kpiWeekMemos: {},
      improveProjects: IMPROVE_PROJECTS,
      memberCode: 'A',
      kpi2RowStatus: { [rowId]: { status: '승인' } },
    });
    expect(m.kpi2.effectCount).toBe(1);
    expect(m.kpi2.submittedCount).toBe(1);
    expect(m.kpi2.productivityPct).toBeGreaterThan(100);
  });

  it('computeTeamKpi — member 스코프 키가 겹침 없이 분리된다', () => {
    const memberDays = {
      '2026-06-10': {
        holiday: false,
        mm: { work: 0.5, improve: 0, leave: 0 },
        tasks: [
          {
            id: 'same-task',
            cat: 'prep',
            title: '공통 task id',
            plan: 8,
            actual: 4,
            done: true,
            kpi2Effect: { enabled: true, projectId: 'ppt-academizer', baselineHours: 8 },
          },
        ],
      },
    };
    const scoped = computeTeamKpi({
      year: 2026,
      monthIndex: 5,
      days: memberDays,
      improveProjects: IMPROVE_PROJECTS,
      memberCode: 'B',
      kpi2RowStatus: {
        [kpi2RowId('A', '2026-06-10', 'same-task')]: { status: '반려' },
        [kpi2RowId('B', '2026-06-10', 'same-task')]: { status: '승인' },
      },
    });
    expect(scoped.rows02Effect[0].상태).toBe('승인');
  });

  it('computeTeamKpi — legacy KPI2 row id는 직접 조회하지 않는다', () => {
    const m = computeTeamKpi({
      year: 2026,
      monthIndex: 5,
      days: juneDays,
      improveProjects: IMPROVE_PROJECTS,
      memberCode: 'A',
      kpi2RowStatus: {
        [kpi2LegacyRowId('2026-06-01', 'a3')]: { status: '제출' },
      },
    });
    expect(m.rows02Effect[0].상태).toBe('작성중');
  });
});
