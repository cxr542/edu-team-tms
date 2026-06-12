import { resolveTaskSlotField } from '../constants/journalTaskSlot';

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
    mmAxis: editTask.mmAxis || undefined,
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
