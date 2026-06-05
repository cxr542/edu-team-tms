import { normalizeKpiOperationalStore } from '../constants/kpiOperationalStore';

export const TEAM_KPI_SNAPSHOT_PATH = '/team-kpi-snapshot.json';
export const TEAM_KPI_SNAPSHOT_STORAGE_KEY = 'tms-team-kpi-snapshot-meta';

export function buildTeamKpiSnapshot(kpiStore, journalMeta = {}) {
  return {
    publishedAt: new Date().toISOString(),
    kpiOperational: normalizeKpiOperationalStore(kpiStore),
    journalUpdatedAt: journalMeta.updatedAt || null,
  };
}

export function downloadTeamKpiSnapshot(kpiStore, journalMeta) {
  const payload = buildTeamKpiSnapshot(kpiStore, journalMeta);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const ts = payload.publishedAt.replace(/[:.]/g, '-').slice(0, 19);
  a.href = url;
  a.download = `team-kpi-snapshot-${ts}.json`;
  a.click();
  URL.revokeObjectURL(url);
  return payload;
}

export async function fetchTeamKpiSnapshot() {
  const res = await fetch(`${TEAM_KPI_SNAPSHOT_PATH}?t=${Date.now()}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`KPI 스냅샷 불러오기 실패 (${res.status})`);
  return res.json();
}

export function normalizeTeamKpiSnapshot(raw) {
  if (!raw?.kpiOperational) throw new Error('kpiOperational 객체가 필요합니다.');
  return {
    publishedAt: raw.publishedAt || new Date().toISOString(),
    kpiOperational: normalizeKpiOperationalStore(raw.kpiOperational),
    journalUpdatedAt: raw.journalUpdatedAt || null,
  };
}
