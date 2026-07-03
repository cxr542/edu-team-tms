import { describe, expect, it } from 'vitest';
import {
  getDayAvailableMm,
  getMmAxisSelectValue,
  getTaskMmAxis,
  getTaskLoggedHours,
  getWeekCompletionStats,
  sumCompletedDayMm,
  recalcDayMmFromHours,
  sumDayWorkHours,
} from '../src/utils/journalMm.js';
import { applyLeavePresetToDay } from '../src/utils/journalLeavePresets.js';

describe('journalMm axis', () => {
  it('getTaskMmAxis — AI만 자동 향상, 그 외 업무', () => {
    expect(getTaskMmAxis({ cat: 'ai', title: 'x' })).toBe('improve');
    expect(getTaskMmAxis({ cat: 'etc', title: 'x' })).toBe('work');
    expect(getTaskMmAxis({ cat: 'edu', mmAxis: 'improve', title: 'x' })).toBe('improve');
  });

  it('getMmAxisSelectValue — 미지정 시 AI는 향상, 그 외 업무', () => {
    expect(getMmAxisSelectValue({ cat: 'etc', title: '행정' })).toBe('work');
    expect(getMmAxisSelectValue({ cat: 'ai', title: '자동화' })).toBe('improve');
    expect(getMmAxisSelectValue({ cat: 'ai', mmAxis: 'work', title: 'x' })).toBe('work');
  });
});

describe('journalMm logged hours', () => {
  it('getDayAvailableMm — 모든 평일은 0.8125 M/M', () => {
    expect(getDayAvailableMm({ holiday: false, mm: { leave: 0 } })).toBeCloseTo(0.8125, 4);
    expect(getDayAvailableMm({ holiday: true, mm: { leave: 0.8125 } })).toBeCloseTo(0.8125, 4);
  });

  it('getTaskLoggedHours — 완료 건만 실작업 반환', () => {
    expect(getTaskLoggedHours({ title: '업무', actual: 4, done: true })).toBe(4);
    expect(getTaskLoggedHours({ title: '업무', actual: 4, done: false })).toBe(0);
    expect(getTaskLoggedHours({ title: '연차 1일', actual: 0, done: true })).toBe(0);
  });

  it('applyLeavePresetToDay — full/half leave policy uses 0.8125 based M/M', () => {
    const baseDay = { holiday: false, mm: { work: 0, improve: 0, leave: 0 }, tasks: [] };
    expect(applyLeavePresetToDay(baseDay, 'holiday').mm.leave).toBeCloseTo(0.8125, 4);
    expect(applyLeavePresetToDay(baseDay, 'annual').mm.leave).toBeCloseTo(0.8125, 4);
    expect(applyLeavePresetToDay(baseDay, 'half-am').mm.leave).toBeCloseTo(0.40625, 4);
    expect(applyLeavePresetToDay(baseDay, 'half-pm').mm.leave).toBeCloseTo(0.40625, 4);
    expect(applyLeavePresetToDay(baseDay, 'quarter').mm.leave).toBeCloseTo(0.203125, 6);
  });

  it('recalcDayMmFromHours — 미완료 실작업은 M/M에 미반영', () => {
    const day = {
      holiday: false,
      mm: { work: 0, improve: 0, leave: 0 },
      tasks: [
        { id: 'a', cat: 'edu', title: '교육', plan: 4, actual: 4, done: false },
        { id: 'b', cat: 'edu', title: '교육2', plan: 2, actual: 2, done: true },
      ],
    };
    recalcDayMmFromHours(day);
    expect(day.mm.work).toBeCloseTo(0.25, 4);
    expect(day.mm.improve).toBe(0);
  });

  it('sumDayWorkHours — 완료 건만 합산', () => {
    const day = {
      holiday: false,
      mm: { work: 0, improve: 0, leave: 0 },
      tasks: [
        { id: 'a', cat: 'edu', title: 'A', actual: 3, done: false },
        { id: 'b', cat: 'edu', title: 'B', actual: 2, done: true },
      ],
    };
    expect(sumDayWorkHours(day)).toBe(2);
  });

  it('sumCompletedDayMm — 완료된 task와 휴일 M/M만 반영한다', () => {
    const day = {
      holiday: false,
      mm: { work: 0, improve: 0, leave: 0.40625 },
      tasks: [
        { id: 'a', cat: 'edu', title: 'A', actual: 4, done: false },
        { id: 'b', cat: 'edu', title: 'B', actual: 4, done: true },
        { id: 'c', cat: 'edu', title: 'C', actual: 0, done: true },
      ],
    };
    expect(sumCompletedDayMm(day)).toBeCloseTo(0.9063, 4);
  });

  it('getWeekCompletionStats — 주차 완료 M/M를 반환한다', () => {
    const weekDays = [
      new Date(2026, 5, 1),
      new Date(2026, 5, 2),
      new Date(2026, 5, 3),
      new Date(2026, 5, 4),
      new Date(2026, 5, 5),
    ];
    const days = {
      '2026-06-01': {
        holiday: false,
        mm: { work: 0.8125, improve: 0, leave: 0 },
        tasks: [
          { id: 'd1', cat: 'edu', title: '완료 업무', actual: 4, done: true },
        ],
      },
      '2026-06-02': {
        holiday: false,
        mm: { work: 0.8125, improve: 0, leave: 0 },
        tasks: [
          { id: 'd2', cat: 'edu', title: '미완료 업무', actual: 4, done: false },
        ],
      },
      '2026-06-03': { holiday: true, mm: { work: 0, improve: 0, leave: 0.8125 }, tasks: [] },
      '2026-06-04': {
        holiday: false,
        mm: { work: 0, improve: 0, leave: 0 },
        tasks: [
          { id: 'd4', cat: 'edu', title: '0시간 완료', actual: 0, done: true },
        ],
      },
      '2026-06-05': {
        holiday: false,
        mm: { work: 0, improve: 0.125, leave: 0 },
        tasks: [
          { id: 'd5', cat: 'ai', title: '향상 완료', actual: 1, done: true, mmAxis: 'improve' },
        ],
      },
    };
    const stats = getWeekCompletionStats(weekDays, 5, (key) => days[key]);
    expect(stats.available).toBeCloseTo(4.0625, 4);
    expect(stats.logged).toBeCloseTo(1.4375, 4);
    expect(stats.shortage).toBeCloseTo(2.625, 4);
    expect(stats.pct).toBeCloseTo((1.4375 / 4.0625) * 100, 4);
  });
});
