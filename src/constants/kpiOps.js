export const KPI_REFLECTED_STORAGE_PREFIX = 'tms-kpi-reflected';

export function kpiReflectedKey(year, monthIndex) {
  return `${KPI_REFLECTED_STORAGE_PREFIX}-${year}-${monthIndex + 1}`;
}

export function loadKpiReflected(year, monthIndex) {
  try {
    return localStorage.getItem(kpiReflectedKey(year, monthIndex)) === '1';
  } catch {
    return false;
  }
}

export function saveKpiReflected(year, monthIndex, reflected) {
  const key = kpiReflectedKey(year, monthIndex);
  if (reflected) localStorage.setItem(key, '1');
  else localStorage.removeItem(key);
}

/** OneDrive 등 운영 엑셀 링크 — env 또는 팀 공지 URL로 교체 */
export const KPI_OPS_EXCEL_URL =
  import.meta.env.VITE_KPI_OPS_EXCEL_URL || '';
