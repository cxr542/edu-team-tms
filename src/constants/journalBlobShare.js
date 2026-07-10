/**
 * J7d: journal Blob team-share POST gate.
 * GET /api/journal-snapshot stays available for disaster recovery.
 *
 * Default: demote Blob POST while Preview MANUAL_MIRROR is on (Supabase is team-share SoT).
 * Rollback: set VITE_JOURNAL_BLOB_POST_ENABLED=true (and JOURNAL_BLOB_POST_ENABLED on Functions).
 */

/**
 * @param {{ explicitEnv?: string|null, manualMirrorEnabled?: boolean }} [options]
 * @returns {boolean}
 */
export function resolveJournalBlobPostEnabled({
  explicitEnv = '',
  manualMirrorEnabled = false,
} = {}) {
  const explicit = String(explicitEnv || '').trim().toLowerCase();
  if (explicit === 'true') return true;
  if (explicit === 'false') return false;
  return !manualMirrorEnabled;
}

export const JOURNAL_BLOB_POST_ENABLED = resolveJournalBlobPostEnabled({
  explicitEnv: import.meta.env?.VITE_JOURNAL_BLOB_POST_ENABLED,
  manualMirrorEnabled:
    String(import.meta.env?.VITE_SUPABASE_MANUAL_MIRROR_ENABLED || '')
      .trim()
      .toLowerCase() === 'true',
});

export const JOURNAL_BLOB_POST_DISABLED_MESSAGE =
  '일지 Blob 팀 공유 저장은 비활성입니다. Supabase 팀 공유를 사용하세요.';
