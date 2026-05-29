/** 조회용 ledger-snapshot.json 과 작성용 localStorage 동기화 비교 */

export function isPublishedNewer(publishedAt, localAt) {
  if (!publishedAt) return false;
  if (!localAt) return true;
  return new Date(publishedAt).getTime() > new Date(localAt).getTime();
}

export function isLocalNewer(localAt, publishedAt) {
  if (!localAt) return false;
  if (!publishedAt) return true;
  return new Date(localAt).getTime() > new Date(publishedAt).getTime();
}

/**
 * @returns {'in-sync' | 'remote-ahead' | 'local-ahead' | 'unknown'}
 */
export function getLedgerSyncStatus({ publishedAt, localUpdatedAt, syncedPublishedAt }) {
  if (!publishedAt && !localUpdatedAt) return 'unknown';
  if (publishedAt && syncedPublishedAt && publishedAt === syncedPublishedAt && !isLocalNewer(localUpdatedAt, publishedAt)) {
    return 'in-sync';
  }
  if (publishedAt && isPublishedNewer(publishedAt, syncedPublishedAt || localUpdatedAt)) {
    return 'remote-ahead';
  }
  if (publishedAt && isLocalNewer(localUpdatedAt, publishedAt)) {
    return 'local-ahead';
  }
  if (!publishedAt && localUpdatedAt) return 'local-ahead';
  return 'in-sync';
}
