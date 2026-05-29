/** 배포 URL 기본 = 팀 조회, ?mode=edit = 팀장 작성 */
export function isViewerMode() {
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
