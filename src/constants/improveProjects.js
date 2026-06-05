export const IMPROVE_PROJECTS_STORAGE_KEY = 'tms-improve-projects-v1';

export const DEFAULT_IMPROVE_PROJECTS = [
  { id: 'ppt-academizer', name: 'PPT-Academizer', code: 'ppt-acad' },
  { id: 'team-kpi-system', name: '팀 KPI 관리시스템', code: 'kpi-sys' },
];

export function loadImproveProjects() {
  try {
    const raw = localStorage.getItem(IMPROVE_PROJECTS_STORAGE_KEY);
    if (!raw) return [...DEFAULT_IMPROVE_PROJECTS];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return [...DEFAULT_IMPROVE_PROJECTS];
    return parsed;
  } catch {
    return [...DEFAULT_IMPROVE_PROJECTS];
  }
}

export function saveImproveProjects(projects) {
  localStorage.setItem(IMPROVE_PROJECTS_STORAGE_KEY, JSON.stringify(projects));
}

export function findImproveProject(projects, id) {
  return projects.find((p) => p.id === id) || null;
}
