import { isProductionEnvironment } from '../constants/appEnv';
import {
  canAttemptCloudWrite,
  recordCloudFailure,
  recordCloudSuccess,
} from './cloudHealth';

export const IMPROVE_PROJECTS_API_PATH = '/api/improve-projects-snapshot';
export const IMPROVE_PROJECTS_LIVE_PATH = 'improve-projects/live-latest.json';
export const IMPROVE_PROJECTS_SCHEMA_VERSION = 1;
export const IMPROVE_PROJECTS_SNAPSHOT_SOURCE = 'team-kpi-improve-projects';

const OPTIONAL_PROJECT_FIELDS = [
  'ownerMemberId',
  'ownerName',
  'source',
  'sourceLabel',
  'sourceJournalRefs',
  'createdAt',
  'status',
];

export function improveProjectStableKey(project) {
  if (!project || typeof project !== 'object') return '';
  return String(project.id || project.code || '').trim();
}

export function normalizeImproveProjectEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id || '').trim();
  const name = String(raw.name || '').trim();
  if (!id || !name) return null;
  const entry = {
    id,
    name,
    code: String(raw.code || id).trim(),
  };
  OPTIONAL_PROJECT_FIELDS.forEach((field) => {
    if (raw[field] !== undefined && raw[field] !== null && raw[field] !== '') {
      entry[field] = raw[field];
    }
  });
  Object.keys(raw).forEach((key) => {
    if (key in entry) return;
    if (OPTIONAL_PROJECT_FIELDS.includes(key)) return;
    entry[key] = raw[key];
  });
  return entry;
}

export function createEmptyImproveProjectsSnapshot() {
  return {
    schemaVersion: IMPROVE_PROJECTS_SCHEMA_VERSION,
    publishedAt: null,
    source: 'empty',
    projects: [],
    meta: {
      projectCount: 0,
      publishedBy: 'leader',
      app: 'edu-team-tms',
    },
  };
}

export function normalizeImproveProjectsSnapshot(raw) {
  if (!raw || typeof raw !== 'object') {
    return createEmptyImproveProjectsSnapshot();
  }
  const projects = Array.isArray(raw.projects)
    ? raw.projects.map(normalizeImproveProjectEntry).filter(Boolean)
    : [];
  return {
    schemaVersion: raw.schemaVersion || IMPROVE_PROJECTS_SCHEMA_VERSION,
    publishedAt: typeof raw.publishedAt === 'string' ? raw.publishedAt : null,
    source: raw.source || IMPROVE_PROJECTS_SNAPSHOT_SOURCE,
    projects,
    meta: {
      projectCount: projects.length,
      publishedBy: raw.meta?.publishedBy || 'leader',
      app: raw.meta?.app || 'edu-team-tms',
      ...(raw.meta && typeof raw.meta === 'object' ? raw.meta : {}),
    },
  };
}

export function buildImproveProjectsSnapshot(projects = [], { publishedBy = 'leader' } = {}) {
  const normalized = projects.map(normalizeImproveProjectEntry).filter(Boolean);
  return {
    schemaVersion: IMPROVE_PROJECTS_SCHEMA_VERSION,
    publishedAt: new Date().toISOString(),
    source: IMPROVE_PROJECTS_SNAPSHOT_SOURCE,
    projects: normalized,
    meta: {
      projectCount: normalized.length,
      publishedBy,
      app: 'edu-team-tms',
    },
  };
}

export function validateImproveProjectsPayload(projects) {
  if (!Array.isArray(projects)) {
    return { ok: false, error: 'projects 배열이 필요합니다.' };
  }
  const normalized = projects.map(normalizeImproveProjectEntry).filter(Boolean);
  if (projects.length > 0 && normalized.length === 0) {
    return { ok: false, error: '유효한 향상 과제 항목이 없습니다.' };
  }
  const keys = new Set();
  for (const project of normalized) {
    const key = improveProjectStableKey(project);
    if (!key) {
      return { ok: false, error: '각 항목에 id 또는 code가 필요합니다.' };
    }
    if (keys.has(key)) {
      return { ok: false, error: '중복된 id/code가 있습니다.' };
    }
    keys.add(key);
  }
  return { ok: true, projects: normalized };
}

/**
 * 팀 공유본 가져오기 — 같은 id/code는 remote 우선, local-only 항목 유지, unknown field 보존
 */
export function mergeImproveProjects(localProjects = [], remoteProjects = []) {
  const map = new Map();
  (Array.isArray(localProjects) ? localProjects : []).forEach((project) => {
    const key = improveProjectStableKey(project);
    if (!key) return;
    map.set(key, { ...project });
  });
  (Array.isArray(remoteProjects) ? remoteProjects : []).forEach((raw) => {
    const remote = normalizeImproveProjectEntry(raw);
    if (!remote) return;
    const key = improveProjectStableKey(remote);
    const existing = map.get(key);
    if (existing) {
      map.set(key, {
        ...existing,
        ...remote,
        id: existing.id || remote.id,
        code: remote.code || existing.code,
      });
    } else {
      map.set(key, remote);
    }
  });
  return Array.from(map.values());
}

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
  if (!isProductionEnvironment()) {
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
