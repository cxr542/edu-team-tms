import { describe, expect, it } from 'vitest';
import {
  filterImproveProjectsForMonth,
  improveProjectIdsUsedInMonth,
  monthPrefix,
} from '../src/utils/improveProjectMonth.js';

const projects = [
  { id: 'p-used', name: '이달 쓴 과제', createdAt: '2026-06-02T01:00:00.000Z' },
  { id: 'p-link', name: '효과 건에서 쓴 과제', createdAt: '2026-06-02T01:00:00.000Z' },
  { id: 'p-src', name: '이달 일지 후보', createdAt: '2026-06-02T01:00:00.000Z', sourceJournalRefs: [{ memberCode: 'A', dayKey: '2026-10-06' }] },
  { id: 'p-new', name: '이달 등록', createdAt: '2026-10-07T01:00:00.000Z' },
  { id: 'p-old', name: '지난 과제', createdAt: '2026-06-02T01:00:00.000Z', sourceJournalRefs: [{ memberCode: 'A', dayKey: '2026-06-03' }] },
  { id: 'p-nodate', name: '날짜 없는 과제' },
  { id: 'p-other-month-use', name: '다른 달에 쓴 과제', createdAt: '2026-05-02T01:00:00.000Z' },
];

const days = {
  '2026-10-05': { tasks: [{ id: 't1', improveProjectId: 'p-used' }] },
  '2026-10-07': { tasks: [{ id: 't2', kpi2Effect: { enabled: true, projectId: 'p-link' } }, { id: 't3' }] },
  '2026-09-30': { tasks: [{ id: 't4', improveProjectId: 'p-other-month-use' }] }, // 다른 달
  '2026-11-02': { tasks: [{ id: 't5', improveProjectId: 'p-old' }] }, // 다른 달
};

describe('구성원 일지 향상 과제 — 월 필터', () => {
  it('월 접두어', () => {
    expect(monthPrefix(2026, 9)).toBe('2026-10');
    expect(monthPrefix(2026, 0)).toBe('2026-01');
  });

  it('그 달 업무가 연결한 과제 id (improveProjectId, kpi2Effect.projectId), 다른 달 제외', () => {
    expect([...improveProjectIdsUsedInMonth(days, 2026, 9)].sort()).toEqual(['p-link', 'p-used']);
    expect(improveProjectIdsUsedInMonth(undefined, 2026, 9).size).toBe(0);
  });

  it('해당 월 과제만: 사용·효과 건 연결·원본 일지 날짜·등록 월', () => {
    const r = filterImproveProjectsForMonth(projects, days, 2026, 9);
    expect(r.map((p) => p.id)).toEqual(['p-used', 'p-link', 'p-src', 'p-new']);
  });

  it('다른 달에는 그 달 기준으로 달라진다 (6월)', () => {
    const r = filterImproveProjectsForMonth(projects, {}, 2026, 5);
    // 6월에 등록된 것 + 원본 일지가 6월인 것
    expect(r.map((p) => p.id)).toEqual(['p-used', 'p-link', 'p-src', 'p-old']);
  });

  it('날짜 정보가 없고 사용 기록도 없으면 포함되지 않음 / 목록이 없어도 안전', () => {
    expect(filterImproveProjectsForMonth([{ id: 'x', name: 'x' }], {}, 2026, 9)).toEqual([]);
    expect(filterImproveProjectsForMonth(undefined, undefined, 2026, 9)).toEqual([]);
  });
});
