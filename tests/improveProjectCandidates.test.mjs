import { describe, expect, it } from 'vitest';
import {
  findImproveProjectByTitle,
  isImproveProjectTitleRegistered,
  normalizeImproveProjectTitle,
} from '../src/constants/improveProjects.js';
import {
  collectImproveMmCandidates,
  formatImproveCandidateSources,
} from '../src/utils/improveProjectCandidates.js';

const IMPROVE_PROJECTS = [
  { id: 'ppt-academizer', name: 'PPT-Academizer', code: 'ppt-acad' },
];

function makeDays(tasksByKey) {
  return tasksByKey;
}

function collect(tasksByKey, improveProjects = []) {
  return collectImproveMmCandidates({
    year: 2026,
    monthIndex: 5,
    getMemberDays: () => makeDays(tasksByKey),
    memberCodes: ['B'],
    improveProjects,
  });
}

describe('collectImproveMmCandidates', () => {
  it('includes cat:ai tasks as improve-axis candidates', () => {
    const rows = collect({
      '2026-06-10': {
        tasks: [
          { id: 't1', cat: 'ai', title: '강의자료 자동화 개선', plan: 2, actual: 3, done: true },
        ],
      },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe('강의자료 자동화 개선');
    expect(rows[0].totalActual).toBe(3);
  });

  it('includes mmAxis:improve tasks when done', () => {
    const rows = collect({
      '2026-06-11': {
        tasks: [
          {
            id: 't2',
            cat: 'prep',
            mmAxis: 'improve',
            title: '팀 KPI 관리시스템',
            plan: 4,
            actual: 2,
            done: true,
          },
        ],
      },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe('팀 KPI 관리시스템');
  });

  it('excludes mmAxis:improve tasks when not done', () => {
    const rows = collect({
      '2026-06-11': {
        tasks: [
          {
            id: 't2',
            cat: 'prep',
            mmAxis: 'improve',
            title: '팀 KPI 관리시스템',
            plan: 4,
            actual: 2,
            done: false,
          },
        ],
      },
    });
    expect(rows).toHaveLength(0);
  });

  it('excludes mmAxis:work tasks', () => {
    const rows = collect({
      '2026-06-12': {
        tasks: [
          { id: 't3', cat: 'edu', mmAxis: 'work', title: '일반 교육', plan: 1, actual: 1, done: true },
        ],
      },
    });
    expect(rows).toHaveLength(0);
  });

  it('excludes empty-title tasks', () => {
    const rows = collect({
      '2026-06-12': {
        tasks: [{ id: 't4', cat: 'ai', title: '   ', plan: 1, actual: 1 }],
      },
    });
    expect(rows).toHaveLength(0);
  });

  it('excludes leave/memo tasks', () => {
    const rows = collect({
      '2026-06-13': {
        tasks: [{ id: 't5', cat: 'other', title: '연차 1일', plan: 0, actual: 0, done: true }],
      },
    });
    expect(rows).toHaveLength(0);
  });

  it('merges duplicate titles into one candidate', () => {
    const rows = collect({
      '2026-06-01': {
        tasks: [
          { id: 'a', cat: 'ai', title: '강의자료 자동화 개선', plan: 1, actual: 2, done: true },
        ],
      },
      '2026-06-02': {
        tasks: [
          { id: 'b', cat: 'ai', title: '  강의자료   자동화 개선 ', plan: 1, actual: 1.5, done: true },
        ],
      },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].occurrenceCount).toBe(2);
    expect(rows[0].totalActual).toBe(3.5);
    expect(rows[0].sources).toHaveLength(2);
  });

  it('excludes titles already registered in improveProjects', () => {
    const rows = collect(
      {
        '2026-06-14': {
          tasks: [
            { id: 't6', cat: 'ai', title: 'PPT-Academizer', plan: 1, actual: 2, done: true },
          ],
        },
      },
      IMPROVE_PROJECTS
    );
    expect(rows).toHaveLength(0);
  });

  it('includes registered titles when includeRegistered is true', () => {
    const rows = collectImproveMmCandidates({
      year: 2026,
      monthIndex: 5,
      getMemberDays: () =>
        makeDays({
          '2026-06-14': {
            tasks: [
              { id: 't6', cat: 'ai', title: 'PPT-Academizer', plan: 1, actual: 2, done: true },
            ],
          },
        }),
      memberCodes: ['B'],
      improveProjects: IMPROVE_PROJECTS,
      includeRegistered: true,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].alreadyRegistered).toBe(true);
  });

  it('sorts candidates with actual hours first', () => {
    const rows = collect({
      '2026-06-01': {
        tasks: [
          { id: 'a', cat: 'ai', title: '계획만', plan: 2, actual: 0, done: false },
          { id: 'b', cat: 'ai', title: '실적있음', plan: 1, actual: 4, done: true },
        ],
      },
    });
    expect(rows[0].title).toBe('실적있음');
  });

  it('does not mutate tasks or enable kpi2Effect', () => {
    const task = {
      id: 'x',
      cat: 'ai',
      title: '신규 과제',
      plan: 2,
      actual: 2,
      kpi2Effect: undefined,
    };
    collect({ '2026-06-15': { tasks: [task] } });
    expect(task.kpi2Effect).toBeUndefined();
  });
});

describe('improve project title helpers', () => {
  it('normalizeImproveProjectTitle collapses whitespace', () => {
    expect(normalizeImproveProjectTitle('  foo   bar ')).toBe('foo bar');
  });

  it('isImproveProjectTitleRegistered matches case-insensitively', () => {
    expect(isImproveProjectTitleRegistered('ppt-academizer', IMPROVE_PROJECTS)).toBe(true);
    expect(isImproveProjectTitleRegistered('신규 과제', IMPROVE_PROJECTS)).toBe(false);
  });

  it('findImproveProjectByTitle resolves registered project', () => {
    const p = findImproveProjectByTitle(IMPROVE_PROJECTS, 'ppt-academizer');
    expect(p?.id).toBe('ppt-academizer');
  });

  it('simulated registration makes title non-candidate', () => {
    const title = '강의자료 자동화 개선';
    const projects = [...IMPROVE_PROJECTS];
    expect(isImproveProjectTitleRegistered(title, projects)).toBe(false);
    projects.push({ id: 'lecture-auto', name: title, code: 'lecture-auto' });
    expect(isImproveProjectTitleRegistered(title, projects)).toBe(true);
    const rows = collect(
      {
        '2026-06-16': {
          tasks: [{ id: 't7', cat: 'ai', title, plan: 1, actual: 1, done: true }],
        },
      },
      projects
    );
    expect(rows).toHaveLength(0);
  });
});

describe('formatImproveCandidateSources', () => {
  it('summarizes member counts and hours', () => {
    const text = formatImproveCandidateSources(
      [
        { memberCode: 'B', dayKey: '2026-06-01', actual: 2 },
        { memberCode: 'B', dayKey: '2026-06-02', actual: 1 },
        { memberCode: 'C', dayKey: '2026-06-03', actual: 0 },
      ],
      (code) => code
    );
    expect(text).toContain('B 2건 · 3h');
    expect(text).toContain('C 1건');
  });
});
