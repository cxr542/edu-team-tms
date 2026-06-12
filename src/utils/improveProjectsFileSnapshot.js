import {
  IMPROVE_PROJECTS_SNAPSHOT_SCHEMA_VERSION,
  mergeImproveProjects,
  normalizeImproveProjectsSnapshot,
  validateImproveProjectsPayload,
} from '../../api/utils/improveProjectsSnapshotCore.js';

export const IMPROVE_PROJECTS_FILE_SNAPSHOT_SOURCE = 'team-kpi-improve-projects-file';

export const IMPROVE_PROJECTS_FILE_SHARE_HINT =
  'JSON 파일로 구성원에게 전달할 향상 과제 운영 목록을 내려받을 수 있습니다.';

export const IMPROVE_PROJECTS_FILE_IMPORT_HINT =
  '팀장에게 받은 JSON 파일을 이 브라우저로 가져옵니다. 자동 동기화는 사용하지 않습니다.';

export const IMPROVE_PROJECTS_FILE_MERGE_POLICY_HINT =
  'JSON 가져오기는 같은 id/code 항목을 갱신하고 이 브라우저에만 있는 항목은 유지합니다.';

export const IMPROVE_PROJECTS_BLOB_FALLBACK_HINT =
  'Vercel Blob 사용량 제한 시 팀 공유 저장/가져오기가 실패할 수 있습니다. 이 경우 JSON 다운로드/가져오기로 운영 목록을 전달하세요.';

export const IMPROVE_PROJECTS_FILE_IMPORT_SUCCESS = '향상 과제 JSON을 가져왔습니다.';

export const IMPROVE_PROJECTS_FILE_IMPORT_FAIL =
  '향상 과제 JSON을 가져오지 못했습니다. 파일 형식을 확인하세요.';

export function formatImproveProjectsFileName(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `edu-tms-improve-projects-${y}-${m}-${d}-${hh}${mm}.json`;
}

export function buildImproveProjectsFileSnapshot(projects = [], { publishedBy = 'leader' } = {}) {
  const validation = validateImproveProjectsPayload(projects);
  if (!validation.ok) {
    const err = new Error(validation.error);
    err.reason = 'invalid-payload';
    throw err;
  }
  return {
    schemaVersion: IMPROVE_PROJECTS_SNAPSHOT_SCHEMA_VERSION,
    publishedAt: new Date().toISOString(),
    source: IMPROVE_PROJECTS_FILE_SNAPSHOT_SOURCE,
    projects: validation.projects,
    meta: {
      projectCount: validation.projects.length,
      publishedBy,
      app: 'edu-team-tms',
      exportedBy: 'json-download',
    },
  };
}

export function parseImproveProjectsSnapshotFile(text) {
  let raw;
  try {
    raw = JSON.parse(String(text || ''));
  } catch {
    return { ok: false, error: 'invalid-json' };
  }
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.projects)) {
    return { ok: false, error: 'missing-projects' };
  }
  const snapshot = normalizeImproveProjectsSnapshot(raw);
  const validation = validateImproveProjectsPayload(snapshot.projects);
  if (!validation.ok) {
    return { ok: false, error: validation.error };
  }
  if (raw.projects.length > 0 && validation.projects.length === 0) {
    return { ok: false, error: 'invalid-projects' };
  }
  return {
    ok: true,
    snapshot: {
      ...snapshot,
      projects: validation.projects,
      meta: {
        ...snapshot.meta,
        projectCount: validation.projects.length,
      },
    },
  };
}

export function mergeImproveProjectsFromSnapshot(localProjects = [], snapshotProjects = []) {
  return mergeImproveProjects(localProjects, snapshotProjects);
}

export function downloadImproveProjectsSnapshot(projects = []) {
  const snapshot = buildImproveProjectsFileSnapshot(projects);
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = formatImproveProjectsFileName();
  a.click();
  URL.revokeObjectURL(url);
  return snapshot;
}

export function readImproveProjectsSnapshotFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve({ ok: false, error: 'no-file' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      resolve(parseImproveProjectsSnapshotFile(reader.result));
    };
    reader.onerror = () => reject(new Error('파일을 읽지 못했습니다.'));
    reader.readAsText(file);
  });
}
