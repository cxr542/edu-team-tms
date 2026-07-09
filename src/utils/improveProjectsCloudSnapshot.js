import { isVercelDeployedEnvironment } from '../constants/appEnv';
import {
  canAttemptCloudWrite,
  recordCloudFailure,
  recordCloudSuccess,
} from './cloudHealth';
import {
  buildImproveProjectsSnapshot,
  createEmptyImproveProjectsSnapshot,
  IMPROVE_PROJECTS_BLOB_KEY,
  IMPROVE_PROJECTS_SNAPSHOT_SCHEMA_VERSION,
  IMPROVE_PROJECTS_SNAPSHOT_SOURCE,
  mergeImproveProjects,
  normalizeImproveProjectEntry,
  normalizeImproveProjectsSnapshot,
  validateImproveProjectsPayload,
  improveProjectStableKey,
} from '../../server/api-utils/improveProjectsSnapshotCore.js';

export const IMPROVE_PROJECTS_API_PATH = '/api/improve-projects-snapshot';
export const IMPROVE_PROJECTS_LIVE_PATH = IMPROVE_PROJECTS_BLOB_KEY;
export { IMPROVE_PROJECTS_SNAPSHOT_SCHEMA_VERSION as IMPROVE_PROJECTS_SCHEMA_VERSION };
export { IMPROVE_PROJECTS_SNAPSHOT_SOURCE };
export {
  buildImproveProjectsSnapshot,
  createEmptyImproveProjectsSnapshot,
  mergeImproveProjects,
  normalizeImproveProjectEntry,
  normalizeImproveProjectsSnapshot,
  validateImproveProjectsPayload,
  improveProjectStableKey,
};

export const IMPROVE_PROJECTS_MERGE_POLICY_HINT =
  '팀 공유본 가져오기는 같은 id/code의 항목을 갱신하고, 이 브라우저에만 있는 항목은 유지합니다.';

export const IMPROVE_PROJECTS_SHARE_HINT =
  '향상 과제 운영 목록을 팀 공용 snapshot으로 저장하거나 가져옵니다. 자동 동기화는 사용하지 않습니다.';

export const IMPROVE_PROJECTS_IMPORT_HINT =
  '팀장이 공유 저장한 향상 과제 운영 목록을 이 브라우저로 가져옵니다. 자동 동기화는 사용하지 않습니다.';

export const IMPROVE_PROJECTS_PUBLISH_FAIL_MESSAGE =
  '팀 공유 저장에 실패했습니다. Blob 요청 한도 또는 네트워크 상태를 확인하세요.';

export const IMPROVE_PROJECTS_IMPORT_FAIL_MESSAGE =
  '팀 공유본을 가져오지 못했습니다. 기존 이 브라우저 목록은 유지됩니다.';

async function parseJsonResponse(res) {
  const body = await res.json().catch(() => ({}));
  return body;
}

export async function fetchSharedImproveProjectsSnapshot() {
  const res = await fetch(`${IMPROVE_PROJECTS_API_PATH}?t=${Date.now()}`, { cache: 'no-store' });
  const body = await parseJsonResponse(res);
  if (!res.ok) {
    recordCloudFailure(res.status, body);
    const err = new Error(
      body.message || body.error || `팀 공유 향상 과제를 불러오지 못했습니다 (${res.status})`
    );
    err.status = res.status;
    err.body = body;
    throw err;
  }
  recordCloudSuccess();
  const source = res.headers.get('x-improve-projects-source') || body.source || 'blob';
  const snapshot = normalizeImproveProjectsSnapshot(body);
  return { snapshot, source };
}

export async function publishSharedImproveProjectsSnapshot(projects, { publishedBy = 'leader' } = {}) {
  if (!isVercelDeployedEnvironment()) {
    const err = new Error('개발 환경에서는 팀 공유 저장이 차단됩니다.');
    err.reason = 'dev-blocked';
    throw err;
  }
  if (!canAttemptCloudWrite()) {
    const err = new Error('클라우드 공유가 일시 제한되었습니다. 잠시 후 다시 시도하세요.');
    err.reason = 'cloud-limited';
    throw err;
  }
  const validation = validateImproveProjectsPayload(projects);
  if (!validation.ok) {
    const err = new Error(validation.error);
    err.reason = 'invalid-payload';
    throw err;
  }
  const payload = buildImproveProjectsSnapshot(validation.projects, { publishedBy });
  const res = await fetch(IMPROVE_PROJECTS_API_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await parseJsonResponse(res);
  if (!res.ok) {
    recordCloudFailure(res.status, body);
    const err = new Error(
      body.message || body.error || IMPROVE_PROJECTS_PUBLISH_FAIL_MESSAGE
    );
    err.status = res.status;
    err.body = body;
    throw err;
  }
  recordCloudSuccess();
  return normalizeImproveProjectsSnapshot(body.snapshot || payload);
}
