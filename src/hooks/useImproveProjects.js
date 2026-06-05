import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_IMPROVE_PROJECTS,
  loadImproveProjects,
  saveImproveProjects,
} from '../constants/improveProjects';

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

  useEffect(() => {
    if (!readOnly) saveImproveProjects(projects);
  }, [projects, readOnly]);

  const addProject = useCallback(
    ({ name, code }) => {
      if (readOnly) return;
      const trimmed = String(name).trim();
      if (!trimmed) return;
      const id = slugId(trimmed);
      setProjects((prev) => {
        if (prev.some((p) => p.id === id)) return prev;
        return [...prev, { id, name: trimmed, code: String(code || id).trim() }];
      });
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

  return { projects, addProject, updateProject, removeProject, resetProjects };
}
