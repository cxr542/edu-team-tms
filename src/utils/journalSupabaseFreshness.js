/**
 * J4: compare local journal meta vs Supabase journal_snapshots.updated_at (read-only).
 */
import { isRemoteNewer } from './journalSnapshot.js';

export const JOURNAL_FRESHNESS_STATUS = {
  idle: 'idle',
  loading: 'loading',
  empty: 'empty',
  equal: 'equal',
  localNewer: 'local-newer',
  remoteNewer: 'remote-newer',
  error: 'error',
  disabled: 'disabled',
};

/**
 * @param {object|null|undefined} meta journal.meta
 * @param {string} memberCode
 * @returns {string|null}
 */
export function resolveLocalMemberUpdatedAt(meta, memberCode) {
  const code = String(memberCode || '').trim();
  if (!code) return meta?.updatedAt || null;
  return meta?.memberUpdatedAt?.[code] || null;
}

/**
 * @param {object|null|undefined} data API data from getJournalSnapshotFromSupabase
 * @returns {string|null}
 */
export function resolveRemoteSnapshotUpdatedAt(data) {
  if (!data || typeof data !== 'object') return null;
  return data.updated_at || data.updatedAt || null;
}

/**
 * Classify freshness for UI (no import/pull).
 * @param {{ localUpdatedAt?: string|null, remoteUpdatedAt?: string|null, remoteStatus?: string|null }} input
 * @returns {'empty'|'equal'|'local-newer'|'remote-newer'}
 */
export function classifyJournalFreshness({ localUpdatedAt = null, remoteUpdatedAt = null } = {}) {
  if (!remoteUpdatedAt) return JOURNAL_FRESHNESS_STATUS.empty;
  if (!localUpdatedAt) return JOURNAL_FRESHNESS_STATUS.remoteNewer;
  if (isRemoteNewer(remoteUpdatedAt, localUpdatedAt)) {
    return JOURNAL_FRESHNESS_STATUS.remoteNewer;
  }
  const remoteMs = new Date(remoteUpdatedAt).getTime();
  const localMs = new Date(localUpdatedAt).getTime();
  if (Number.isFinite(remoteMs) && Number.isFinite(localMs) && remoteMs === localMs) {
    return JOURNAL_FRESHNESS_STATUS.equal;
  }
  return JOURNAL_FRESHNESS_STATUS.localNewer;
}

/**
 * Map getJournalSnapshotFromSupabase result → UI freshness state (no import/pull).
 * @param {{ ok?: boolean, status?: string, message?: string, data?: object|null }} result
 * @param {string|null|undefined} localUpdatedAt
 */
export function buildJournalFreshnessState(result, localUpdatedAt = null) {
  if (!result?.ok) {
    const status =
      result?.status === 'disabled'
        ? JOURNAL_FRESHNESS_STATUS.disabled
        : JOURNAL_FRESHNESS_STATUS.error;
    return {
      status,
      remoteUpdatedAt: null,
      message: result?.message || '',
    };
  }

  if (result.status === 'empty' || !result.data) {
    return {
      status: JOURNAL_FRESHNESS_STATUS.empty,
      remoteUpdatedAt: null,
      message: '',
    };
  }

  const remoteUpdatedAt = resolveRemoteSnapshotUpdatedAt(result.data);
  return {
    status: classifyJournalFreshness({ localUpdatedAt, remoteUpdatedAt }),
    remoteUpdatedAt,
    message: '',
  };
}

/**
 * User-facing Korean label for freshness status.
 * @param {string} status
 */
export function formatJournalFreshnessLabel(status) {
  switch (status) {
    case JOURNAL_FRESHNESS_STATUS.loading:
      return '원격 신선도 확인 중…';
    case JOURNAL_FRESHNESS_STATUS.empty:
      return '원격(Supabase) 스냅샷 없음';
    case JOURNAL_FRESHNESS_STATUS.equal:
      return '로컬과 원격 시각이 같습니다';
    case JOURNAL_FRESHNESS_STATUS.localNewer:
      return '로컬이 더 최신';
    case JOURNAL_FRESHNESS_STATUS.remoteNewer:
      return '원격이 더 최신';
    case JOURNAL_FRESHNESS_STATUS.error:
      return '원격 신선도를 확인하지 못했습니다';
    case JOURNAL_FRESHNESS_STATUS.disabled:
      return '원격 신선도 확인 불가 (미설정)';
    default:
      return '';
  }
}
