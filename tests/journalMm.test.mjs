import { describe, expect, it } from 'vitest';
import {
  getMmAxisSelectValue,
  getTaskMmAxis,
  getTaskLoggedHours,
  recalcDayMmFromHours,
  sumDayWorkHours,
} from '../src/utils/journalMm.js';

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
  it('getTaskLoggedHours — 완료 건만 실작업 반환', () => {
    expect(getTaskLoggedHours({ title: '업무', actual: 4, done: true })).toBe(4);
    expect(getTaskLoggedHours({ title: '업무', actual: 4, done: false })).toBe(0);
    expect(getTaskLoggedHours({ title: '연차 1일', actual: 0, done: true })).toBe(0);
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
});
