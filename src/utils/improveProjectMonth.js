/**
 * 구성원 일지 「운영 중인 생산성향상 과제」를 월 기준으로 거르는 도우미.
 * 과제 데이터에는 월 필드가 없어서 아래 중 하나라도 해당하면 그 달의 과제로 본다.
 *  1) 그 달 일지의 업무가 과제를 연결해 썼다 (improveProjectId / kpi2Effect.projectId)
 *  2) 일지 후보로 등록된 과제의 원본 일지 날짜(sourceJournalRefs)가 그 달이다
 *  3) 과제가 그 달에 등록되었다 (createdAt)
 */

const pad = (n) => String(n).padStart(2, '0');

export function monthPrefix(year, monthIndex) {
  return `${year}-${pad(monthIndex + 1)}`;
}

/** 그 달 일지 업무가 연결한 과제 id 집합 */
export function improveProjectIdsUsedInMonth(days, year, monthIndex) {
  const prefix = monthPrefix(year, monthIndex);
  const used = new Set();
  Object.entries(days || {}).forEach(([dayKey, day]) => {
    if (!String(dayKey).startsWith(prefix)) return;
    (day?.tasks || []).forEach((task) => {
      if (task?.improveProjectId) used.add(String(task.improveProjectId));
      if (task?.kpi2Effect?.projectId) used.add(String(task.kpi2Effect.projectId));
    });
  });
  return used;
}

function isoToLocalMonth(iso) {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function isImproveProjectRelevantToMonth(project, usedIds, prefix) {
  if (!project) return false;
  if (usedIds?.has(String(project.id))) return true;
  const refs = Array.isArray(project.sourceJournalRefs) ? project.sourceJournalRefs : [];
  if (refs.some((ref) => String(ref?.dayKey || '').startsWith(prefix))) return true;
  return isoToLocalMonth(project.createdAt) === prefix;
}

/** 해당 월에 해당하는 과제만 (입력 순서 유지) */
export function filterImproveProjectsForMonth(projects = [], days, year, monthIndex) {
  const prefix = monthPrefix(year, monthIndex);
  const used = improveProjectIdsUsedInMonth(days, year, monthIndex);
  return projects.filter((project) => isImproveProjectRelevantToMonth(project, used, prefix));
}
