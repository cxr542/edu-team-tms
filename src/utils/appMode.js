import { isScopedWorkRoute } from './appRoute';

/** 배포 URL 기본 = 팀 조회, ?mode=edit = 작성 · /admin /yhkim 등 경로는 편집 UI 유지 */
export function isViewerMode() {
  if (typeof window !== 'undefined' && isScopedWorkRoute(window.location)) {
    // 사용자·관리자 경로: 장부 조회(mode=view)도 사이드바·teamAccess 유지. read-only는 ledgerAccess.
    return false;
  }
  const mode = new URLSearchParams(window.location.search).get('mode');
  if (mode === 'view') return true;
  if (mode === 'edit') return false;
  return import.meta.env.PROD;
}

export function isEditorMode() {
  return !isViewerMode();
}

export const PUBLIC_SNAPSHOT_PATH = '/ledger-snapshot.json';

export function formatPublishedAt(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString('ko-KR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}
