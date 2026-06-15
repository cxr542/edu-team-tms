import { describe, expect, it } from 'vitest';
import { buildKpi02EffectRows } from '../src/utils/computeTeamKpi.js';
import { mergeTaskFromEdit, taskFieldsFromEdit } from '../src/utils/journalTaskFields.js';

const IMPROVE_PROJECTS = [{ id: 'ppt-academizer', name: 'PPT-Academizer', code: 'ppt-acad' }];

function baseTask(overrides = {}) {
  return {
    id: 't1',
    cat: 'prep',
    title: '강의자료 자동화',
    note: '메모',
    plan: 4,
    actual: 5,
    done: true,
    mmAxis: 'improve',
    slot: '',
    ...overrides,
  };
}

function editFromTask(task, patch = {}) {
  return { ...task, dayKey: '2026-06-10', ...patch };
}

describe('journalTaskFields — KPI2 effect persist', () => {
  it('mergeTaskFromEdit saves kpi2Effect when enabled', () => {
    const existing = baseTask();
    const edit = editFromTask(existing, {
      kpi2Effect: { enabled: true, projectId: 'ppt-academizer', baselineHours: 8 },
    });
    const saved = mergeTaskFromEdit(existing, edit);
    expect(saved.kpi2Effect).toEqual({
      enabled: true,
      projectId: 'ppt-academizer',
      baselineHours: 8,
    });
  });

  it('mergeTaskFromEdit keeps baselineHours and projectId', () => {
    const existing = baseTask({ kpi2Effect: { enabled: true, projectId: 'old', baselineHours: 3 } });
    const edit = editFromTask(existing, {
      kpi2Effect: { enabled: true, projectId: 'ppt-academizer', baselineHours: 6 },
    });
    const saved = mergeTaskFromEdit(existing, edit);
    expect(saved.kpi2Effect.projectId).toBe('ppt-academizer');
    expect(saved.kpi2Effect.baselineHours).toBe(6);
  });

  it('saved task appears in buildKpi02EffectRows', () => {
    const saved = mergeTaskFromEdit(
      baseTask(),
      editFromTask(baseTask(), {
        kpi2Effect: { enabled: true, projectId: 'ppt-academizer', baselineHours: 8 },
      })
    );
    const days = { '2026-06-10': { tasks: [saved] } };
    const rows = buildKpi02EffectRows(2026, 5, days, IMPROVE_PROJECTS);
    expect(rows).toHaveLength(1);
    expect(rows[0].업무명).toBe('강의자료 자동화');
    expect(rows[0].계획시간).toBe(8);
    expect(rows[0].실작업시간).toBe(5);
  });

  it('disabling KPI2 effect removes kpi2Effect from stored task', () => {
    const existing = baseTask({
      kpi2Effect: { enabled: true, projectId: 'ppt-academizer', baselineHours: 8 },
    });
    const edit = editFromTask(existing, { kpi2Effect: { enabled: false } });
    const saved = mergeTaskFromEdit(existing, edit);
    expect(saved.kpi2Effect).toBeUndefined();
    const days = { '2026-06-10': { tasks: [saved] } };
    expect(buildKpi02EffectRows(2026, 5, days, IMPROVE_PROJECTS)).toHaveLength(0);
  });

  it('preserves core journal fields on save', () => {
    const existing = baseTask();
    const edit = editFromTask(existing, {
      cat: 'ai',
      title: '  개선 업무  ',
      note: 'n2',
      plan: 2,
      actual: 3,
      done: false,
      mmAxis: 'improve',
      slot: 'am',
    });
    const saved = mergeTaskFromEdit(existing, edit);
    expect(saved.cat).toBe('ai');
    expect(saved.title).toBe('개선 업무');
    expect(saved.note).toBe('n2');
    expect(saved.plan).toBe(2);
    expect(saved.actual).toBe(3);
    expect(saved.done).toBe(false);
    expect(saved.mmAxis).toBe('improve');
    expect(saved.slot).toBe('am');
    expect(saved.id).toBe('t1');
  });

  it('taskFieldsFromEdit resolves mmAxis from category when unset', () => {
    expect(taskFieldsFromEdit(editFromTask(baseTask({ mmAxis: undefined }), { cat: 'ai', mmAxis: undefined })).mmAxis).toBe(
      'improve'
    );
    expect(taskFieldsFromEdit(editFromTask(baseTask({ mmAxis: undefined }), { cat: 'etc', mmAxis: undefined })).mmAxis).toBe(
      'work'
    );
  });

  it('taskFieldsFromEdit omits kpi2Effect when disabled', () => {
    const fields = taskFieldsFromEdit(
      editFromTask(baseTask(), { kpi2Effect: { enabled: false, projectId: 'x', baselineHours: 1 } })
    );
    expect(fields.kpi2Effect).toBeUndefined();
  });

  it('new task from taskFieldsFromEdit does not carry disabled kpi2Effect', () => {
    const fields = taskFieldsFromEdit(
      editFromTask(
        baseTask({ kpi2Effect: { enabled: true, projectId: 'ppt-academizer', baselineHours: 8 } }),
        { kpi2Effect: { enabled: false } }
      )
    );
    expect(fields.kpi2Effect).toBeUndefined();
  });

  it('persists improveProjectId without affecting kpi2Effect save', () => {
    const edit = editFromTask(baseTask(), {
      improveProjectId: 'ppt-academizer',
      improveProjectTitle: 'PPT-Academizer',
      kpi2Effect: { enabled: true, projectId: 'ppt-academizer', baselineHours: 8 },
    });
    const saved = mergeTaskFromEdit(baseTask(), edit);
    expect(saved.improveProjectId).toBe('ppt-academizer');
    expect(saved.improveProjectTitle).toBe('PPT-Academizer');
    expect(saved.kpi2Effect?.enabled).toBe(true);
  });
});
