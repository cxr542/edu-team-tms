import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_IMPROVE_PROJECTS,
  isImproveProjectTitleRegistered,
  loadImproveProjects,
  saveImproveProjects,
} from '../constants/improveProjects';
import {
  fetchSharedImproveProjectsSnapshot,
  IMPROVE_PROJECTS_IMPORT_FAIL_MESSAGE,
  IMPROVE_PROJECTS_PUBLISH_FAIL_MESSAGE,
  mergeImproveProjects,
  publishSharedImproveProjectsSnapshot,
} from '../utils/improveProjectsCloudSnapshot';
import {
  downloadImproveProjectsSnapshot,
  IMPROVE_PROJECTS_FILE_IMPORT_FAIL,
  mergeImproveProjectsFromSnapshot,
  readImproveProjectsSnapshotFile,
} from '../utils/improveProjectsFileSnapshot';

function slugId(name) {
  const base = String(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || `project-${Date.now()}`;
}

export function useImproveProjects({ readOnly = false } = {}) {
  const [projects, setProjects] = useState(loadImproveProjects);
  const [sharedBusy, setSharedBusy] = useState(false);
  const [sharedMeta, setSharedMeta] = useState({ publishedAt: null, importedAt: null });

  useEffect(() => {
    if (!readOnly) saveImproveProjects(projects);
  }, [projects, readOnly]);

  const addProject = useCallback(
    ({
      name,
      code,
      ownerMemberId,
      ownerName,
      source,
      sourceLabel,
      sourceJournalRefs,
      createdAt,
      status,
    } = {}) => {
      if (readOnly) return null;
      const trimmed = String(name).trim();
      if (!trimmed) return null;
      const id = slugId(trimmed);
      let added = null;
      setProjects((prev) => {
        if (isImproveProjectTitleRegistered(trimmed, prev)) return prev;
        if (prev.some((p) => p.id === id)) return prev;
        added = {
          id,
          name: trimmed,
          code: String(code || id).trim(),
          ...(ownerMemberId ? { ownerMemberId } : {}),
          ...(ownerName ? { ownerName } : {}),
          ...(source ? { source } : {}),
          ...(sourceLabel ? { sourceLabel } : {}),
          ...(Array.isArray(sourceJournalRefs) && sourceJournalRefs.length
            ? { sourceJournalRefs }
            : {}),
          ...(createdAt ? { createdAt } : {}),
          ...(status ? { status } : {}),
        };
        return [...prev, added];
      });
      return added;
    },
    [readOnly]
  );

  const updateProject = useCallback(
    (id, patch) => {
      if (readOnly) return;
      setProjects((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...patch, id: p.id } : p))
      );
    },
    [readOnly]
  );

  const removeProject = useCallback(
    (id) => {
      if (readOnly) return;
      if (!window.confirm('향상 과제를 삭제할까요? (일지 KPI2 효과 건 연계 ID는 유지됩니다)')) return;
      setProjects((prev) => prev.filter((p) => p.id !== id));
    },
    [readOnly]
  );

  const resetProjects = useCallback(() => {
    if (readOnly) return;
    if (window.confirm('향상 과제 목록을 기본값으로 되돌릴까요?')) {
      setProjects([...DEFAULT_IMPROVE_PROJECTS]);
    }
  }, [readOnly]);

  const publishSharedProjects = useCallback(async () => {
    if (readOnly || sharedBusy) {
      return { ok: false, reason: readOnly ? 'read-only' : 'busy' };
    }
    setSharedBusy(true);
    try {
      const snapshot = await publishSharedImproveProjectsSnapshot(projects, { publishedBy: 'leader' });
      setSharedMeta((prev) => ({
        ...prev,
        publishedAt: snapshot.publishedAt || new Date().toISOString(),
      }));
      return { ok: true, snapshot };
    } catch (e) {
      return {
        ok: false,
        error: e,
        message: e.message || IMPROVE_PROJECTS_PUBLISH_FAIL_MESSAGE,
      };
    } finally {
      setSharedBusy(false);
    }
  }, [projects, readOnly, sharedBusy]);

  const loadSharedProjects = useCallback(async () => {
    if (readOnly || sharedBusy) {
      return { ok: false, reason: readOnly ? 'read-only' : 'busy' };
    }
    setSharedBusy(true);
    try {
      const { snapshot, source } = await fetchSharedImproveProjectsSnapshot();
      if (!snapshot.projects?.length) {
        return { ok: false, reason: 'no-remote', source };
      }
      let merged = projects;
      setProjects((prev) => {
        merged = mergeImproveProjects(prev, snapshot.projects);
        return merged;
      });
      setSharedMeta((prev) => ({
        ...prev,
        importedAt: new Date().toISOString(),
        remotePublishedAt: snapshot.publishedAt || null,
      }));
      return { ok: true, snapshot, source, mergedCount: merged.length };
    } catch (e) {
      return {
        ok: false,
        error: e,
        message: e.message || IMPROVE_PROJECTS_IMPORT_FAIL_MESSAGE,
      };
    } finally {
      setSharedBusy(false);
    }
  }, [projects, readOnly, sharedBusy]);

  const downloadProjectsFile = useCallback(() => {
    if (readOnly) {
      return { ok: false, reason: 'read-only' };
    }
    if (!projects.length) {
      return { ok: false, reason: 'empty' };
    }
    try {
      const snapshot = downloadImproveProjectsSnapshot(projects);
      return { ok: true, snapshot };
    } catch (e) {
      return {
        ok: false,
        error: e,
        message: e.message || '향상 과제 JSON을 다운로드하지 못했습니다.',
      };
    }
  }, [projects, readOnly]);

  const importProjectsFromFile = useCallback(
    async (file) => {
      if (readOnly || sharedBusy) {
        return { ok: false, reason: readOnly ? 'read-only' : 'busy' };
      }
      setSharedBusy(true);
      try {
        const parsed = await readImproveProjectsSnapshotFile(file);
        if (!parsed.ok) {
          return {
            ok: false,
            reason: parsed.error,
            message: IMPROVE_PROJECTS_FILE_IMPORT_FAIL,
          };
        }
        if (!parsed.snapshot.projects?.length) {
          return { ok: false, reason: 'no-projects', message: IMPROVE_PROJECTS_FILE_IMPORT_FAIL };
        }
        let merged = projects;
        setProjects((prev) => {
          merged = mergeImproveProjectsFromSnapshot(prev, parsed.snapshot.projects);
          return merged;
        });
        setSharedMeta((prev) => ({
          ...prev,
          importedAt: new Date().toISOString(),
          fileImportedAt: new Date().toISOString(),
          filePublishedAt: parsed.snapshot.publishedAt || null,
        }));
        return { ok: true, snapshot: parsed.snapshot, mergedCount: merged.length };
      } catch (e) {
        return {
          ok: false,
          error: e,
          message: e.message || IMPROVE_PROJECTS_FILE_IMPORT_FAIL,
        };
      } finally {
        setSharedBusy(false);
      }
    },
    [projects, readOnly, sharedBusy]
  );

  return {
    projects,
    addProject,
    updateProject,
    removeProject,
    resetProjects,
    publishSharedProjects,
    loadSharedProjects,
    downloadProjectsFile,
    importProjectsFromFile,
    sharedBusy,
    sharedMeta,
  };
}
