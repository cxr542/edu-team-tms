import { describe, expect, it } from 'vitest';
import { computeMonthKpi1Totals } from '../src/utils/computeTeamKpi.js';
import {
  CHARACTER_KIND,
  KIND_TITLE,
  buildAiOfficeAgents,
  buildMemberTaskCounts,
  buildMonthlyMetrics,
  buildMonthlyProgress,
  buildWeeklyDone,
  deriveMemberStatus,
  listOpenTasks,
  mondayOf,
  pickRescues,
  summarizeMemberJournal,
  summarizeOffice,
  timeOfDay,
} from '../src/utils/aiOfficeModel.js';

const task = (done, actual = 1) => ({ id: `t${Math.random()}`, done, plan: 1, actual });

const journals = {
  A: {
    days: {
      '2026-06-08': { tasks: [task(true, 2), task(true, 3)] },
      '2026-06-10': { tasks: [task(false), task(true, 1)] },
      '2026-06-20': { tasks: [task(false), task(false)] },
    },
  },
  B: { days: { '2026-06-09': { tasks: [task(false), task(false), task(true)] } } },
  C: { days: {} },
};

describe('summarizeMemberJournal', () => {
  it('excludes planned tasks dated after today from the totals', () => {
    expect(summarizeMemberJournal(journals.A, '2026-06-11')).toEqual({
      total: 4,
      done: 3,
      hours: 7,
      todayTasks: 0,
    });
  });

  it('counts tasks written today', () => {
    expect(summarizeMemberJournal(journals.A, '2026-06-10').todayTasks).toBe(2);
  });
});

describe('deriveMemberStatus', () => {
  it('maps journal activity to a status', () => {
    expect(deriveMemberStatus({ total: 0, done: 0, todayTasks: 0 })).toBe('대기');
    expect(deriveMemberStatus({ total: 10, done: 6, todayTasks: 2 })).toBe('막힘');
    expect(deriveMemberStatus({ total: 10, done: 9, todayTasks: 2 })).toBe('작업중');
    expect(deriveMemberStatus({ total: 10, done: 9, todayTasks: 0 })).toBe('생각중');
    expect(deriveMemberStatus({ total: 10, done: 10, todayTasks: 0 })).toBe('대기');
  });
});

describe('buildAiOfficeAgents', () => {
  it('puts the admin first and reacts to a journal entry written today', () => {
    const before = buildAiOfficeAgents(journals, { today: '2026-06-11', adminPending: 2 });
    expect(before.map((a) => a.id)).toEqual(['admin', 'A', 'B', 'C']);
    expect(before.find((a) => a.id === 'A').status).toBe('생각중');
    expect(before.find((a) => a.id === 'admin').status).toBe('작업중');

    const withToday = {
      ...journals,
      A: { days: { ...journals.A.days, '2026-06-11': { tasks: [task(true)] } } },
    };
    const after = buildAiOfficeAgents(withToday, { today: '2026-06-11', adminPending: 0 });
    expect(after.find((a) => a.id === 'A').status).toBe('작업중');
    expect(after.find((a) => a.id === 'admin').status).toBe('대기');
  });
});

describe('pickRescues', () => {
  it('pairs each blocked member with a distinct helper, never the admin', () => {
    const agents = buildAiOfficeAgents(journals, { today: '2026-06-11' });
    const rescues = pickRescues(agents);
    expect(rescues).toHaveLength(1);
    expect(rescues[0].blocked.id).toBe('B');
    expect(rescues[0].helper.id).toBe('C');
  });
});

describe('summarizeOffice', () => {
  it('computes team totals over members that wrote journals', () => {
    const summary = summarizeOffice(buildAiOfficeAgents(journals, { today: '2026-06-11' }));
    expect(summary).toMatchObject({ headcount: 4, done: 4, blocked: 1 });
    expect(summary.rate).toBeCloseTo(4 / 7);
  });
});

describe('weekly done', () => {
  it('buckets by Monday and skips future days', () => {
    expect(mondayOf('2026-06-11')).toBe('2026-06-08');
    expect(buildWeeklyDone(journals, '2026-06-11')).toEqual([{ week: '2026-06-08', tasks: 4 }]);
  });
});

describe('buildMonthlyProgress', () => {
  it('splits a month into done / open (up to today) / planned, ignoring leave memos', () => {
    const mj = {
      A: {
        days: {
          '2026-06-03': { tasks: [task(true), task(false), { ...task(false), title: '오후 반차' }] },
          '2026-06-20': { tasks: [task(false), task(true)] },
          '2025-12-01': { tasks: [task(true)] },
        },
      },
    };
    const jun = buildMonthlyProgress(mj, 2026, '2026-06-11')[5];
    expect(jun).toMatchObject({ month: 6, done: 2, open: 1, planned: 1, total: 4 });
    expect(jun.rate).toBeCloseTo(2 / 3);
    expect(buildMonthlyProgress(mj, 2026, '2026-06-11')).toHaveLength(12);
  });
});

describe('buildMonthlyMetrics', () => {
  const effect = { ...task(true, 4), cat: 'ai', plan: 8, title: 'AI로 자료 제작', kpi2Effect: { enabled: true } };
  const mj = {
    A: { days: { '2026-06-08': { holiday: false, mm: { work: 1, improve: 0, leave: 0 }, tasks: [effect] } } },
    B: { days: {} },
  };

  it("reuses the app's KPI1 utilization and KPI2 productivity for the month", () => {
    const { members, team } = buildMonthlyMetrics(mj, 2026, 5);
    const a = members.find((m) => m.code === 'A');
    expect(a.hasEntries).toBe(true);
    expect(a.utilization).toBe(computeMonthKpi1Totals(2026, 5, mj.A.days).utilization);
    expect(a.productivity).toBe(200);
    expect(team.productivity).toBe(200);
  });

  it('leaves members without journal entries blank and out of the team total', () => {
    const { members, team } = buildMonthlyMetrics(mj, 2026, 5);
    expect(members.find((m) => m.code === 'B')).toMatchObject({ hasEntries: false, utilization: null });
    expect(team.activeCount).toBe(1);
    expect(team.utilization).toBeCloseTo(members.find((m) => m.code === 'A').utilization, 1);
  });

  it('reports no team figures for a month nobody wrote', () => {
    expect(buildMonthlyMetrics(mj, 2026, 0).team).toMatchObject({ activeCount: 0, utilization: null, productivity: null });
  });
});

describe('detail data', () => {
  const mj = {
    A: {
      days: {
        '2026-06-03': { tasks: [{ ...task(false), title: '자료 정리', cat: 'edu', plan: 2 }, task(true)] },
        '2026-06-09': { tasks: [{ ...task(false), title: '강의 준비' }, { ...task(false), title: '반차' }] },
        '2026-06-20': { tasks: [task(false)] },
      },
    },
    B: { days: { '2026-06-05': { tasks: [{ ...task(false), title: 'B 업무' }] } } },
  };

  it('counts done / open / planned per member', () => {
    const [a, b, c] = buildMemberTaskCounts(mj, '2026-06-11');
    expect(a).toMatchObject({ code: 'A', done: 1, open: 2, planned: 1 });
    expect(b).toMatchObject({ code: 'B', done: 0, open: 1, planned: 0 });
    expect(c).toMatchObject({ code: 'C', done: 0, open: 0, planned: 0 });
  });

  it('lists open tasks newest first, skipping future days and leave memos', () => {
    const { items, total } = listOpenTasks(mj, { today: '2026-06-11' });
    expect(total).toBe(3);
    expect(items.map((i) => i.title)).toEqual(['강의 준비', 'B 업무', '자료 정리']);
  });

  it('filters by member and honours the limit', () => {
    const { items, total } = listOpenTasks(mj, { today: '2026-06-11', memberCode: 'A', limit: 1 });
    expect(total).toBe(2);
    expect(items).toHaveLength(1);
    expect(items[0].code).toBe('A');
  });
});

describe('timeOfDay', () => {
  it('maps the clock hour to day / dusk / night', () => {
    const at = (h) => new Date(2026, 5, 11, h, 30);
    expect([5, 6, 12, 16].map((h) => timeOfDay(at(h)))).toEqual(['night', 'day', 'day', 'day']);
    expect([17, 19].map((h) => timeOfDay(at(h)))).toEqual(['dusk', 'dusk']);
    expect([20, 23, 0].map((h) => timeOfDay(at(h)))).toEqual(['night', 'night', 'night']);
  });
});

describe('kingdom characters', () => {
  it('gives every agent a kind from the configured mapping', () => {
    const agents = buildAiOfficeAgents(journals, { today: '2026-06-11' });
    expect(Object.fromEntries(agents.map((a) => [a.id, a.kind]))).toEqual({
      admin: 'wizard',
      A: 'prince',
      B: 'prince',
      C: 'princess',
    });
    expect(Object.keys(CHARACTER_KIND)).toEqual(['A', 'B', 'C', 'admin']);
    agents.forEach((a) => expect(KIND_TITLE[a.kind]).toBeTruthy());
  });
});
