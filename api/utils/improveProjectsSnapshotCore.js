/** Server-safe improve project snapshot utilities (no browser/client deps). */

export const IMPROVE_PROJECTS_BLOB_KEY = 'improve-projects/live-latest.json';
export const IMPROVE_PROJECTS_SNAPSHOT_SCHEMA_VERSION = 1;
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
    schemaVersion: IMPROVE_PROJECTS_SNAPSHOT_SCHEMA_VERSION,
    publishedAt: null,
    source: IMPROVE_PROJECTS_SNAPSHOT_SOURCE,
    projects: [],
    meta: {
      projectCount: 0,
      publishedBy: null,
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
    schemaVersion: raw.schemaVersion || IMPROVE_PROJECTS_SNAPSHOT_SCHEMA_VERSION,
    publishedAt: typeof raw.publishedAt === 'string' ? raw.publishedAt : null,
    source: raw.source || IMPROVE_PROJECTS_SNAPSHOT_SOURCE,
    projects,
    meta: {
      projectCount: projects.length,
      publishedBy: raw.meta?.publishedBy ?? null,
      app: raw.meta?.app || 'edu-team-tms',
      ...(raw.meta && typeof raw.meta === 'object' ? raw.meta : {}),
    },
  };
}

export function buildImproveProjectsSnapshot(projects = [], { publishedBy = 'leader' } = {}) {
  const normalized = projects.map(normalizeImproveProjectEntry).filter(Boolean);
  return {
    schemaVersion: IMPROVE_PROJECTS_SNAPSHOT_SCHEMA_VERSION,
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
