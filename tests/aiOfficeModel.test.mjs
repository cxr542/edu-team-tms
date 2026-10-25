import { describe, expect, it } from 'vitest';
import {
  buildAiOfficeAgents,
  buildWeeklyDone,
  deriveMemberStatus,
  mondayOf,
  pickRescues,
  summarizeMemberJournal,
  summarizeOffice,
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
