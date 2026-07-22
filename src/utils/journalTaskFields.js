import { getTaskMmAxis } from './journalMm';
import { resolveTaskSlotField } from '../constants/journalTaskSlot';
import { getKpi2EffectProjectId, hasKpi2EffectEnabled } from './computeTeamKpi';

/** KPI2 효과 건 저장 전 검증 — 향상 과제 필수 */
export function validateKpi2EffectEdit(editTask) {
  if (!hasKpi2EffectEnabled(editTask)) return { ok: true };
  if (!getKpi2EffectProjectId(editTask)) {
    return {
      ok: false,
      message: 'KPI2 효과 건은 향상 과제를 선택해야 저장할 수 있습니다.',
    };
  }
  return { ok: true };
}

/** 업무 편집 폼 → 저장 필드 (KPI2 effect 포함) */
export function taskFieldsFromEdit(editTask) {
  const fields = {
    id: editTask.id,
    cat: editTask.cat,
    title: editTask.title.trim(),
    note: editTask.note || '',
    plan: Number(editTask.plan) || 0,
    actual: Number(editTask.actual) || 0,
    done: editTask.done,
    mmAxis: getTaskMmAxis(editTask),
    slot: resolveTaskSlotField(editTask.slot),
  };
  if (editTask.kpi2Effect?.enabled) {
    fields.kpi2Effect = {
      enabled: true,
      projectId: editTask.kpi2Effect.projectId || '',
      baselineHours: Number(editTask.kpi2Effect.baselineHours) || Number(editTask.plan) || 0,
    };
  }
  if (editTask.improveProjectId) {
    fields.improveProjectId = editTask.improveProjectId;
    fields.improveProjectTitle = String(editTask.improveProjectTitle || '').trim();
  }
  return fields;
}

/** 기존 task에 편집 내용 병합 — KPI2 해제 시 kpi2Effect 제거 */
export function mergeTaskFromEdit(existingTask, editTask) {
  const next = { ...existingTask, ...taskFieldsFromEdit(editTask) };
  if (!editTask.kpi2Effect?.enabled) {
    delete next.kpi2Effect;
  }
  if (!editTask.improveProjectId) {
    delete next.improveProjectId;
    delete next.improveProjectTitle;
  }
  return next;
}
