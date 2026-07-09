export const ANNOUNCEMENTS_LAST_SEEN_KEY = 'tms-announcements-last-seen-v1';
export const ANNOUNCEMENTS_LAST_SEEN_EVENT = 'tms-announcements-last-seen';

function toTime(value) {
  const time = new Date(value || 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

/** max(updatedAt, publishedAt, createdAt) */
export function announcementActivityAt(announcement) {
  if (!announcement || typeof announcement !== 'object') return 0;
  return Math.max(
    toTime(announcement.updatedAt),
    toTime(announcement.publishedAt),
    toTime(announcement.createdAt)
  );
}

export function readAnnouncementsLastSeen(storage = globalThis.localStorage) {
  if (!storage?.getItem) return 0;
  try {
    const raw = storage.getItem(ANNOUNCEMENTS_LAST_SEEN_KEY);
    if (raw == null || raw === '') return 0;
    return toTime(raw);
  } catch {
    return 0;
  }
}

export function markAnnouncementsSeen(at = new Date().toISOString(), storage = globalThis.localStorage) {
  const stamp = typeof at === 'string' ? at : new Date(at).toISOString();
  if (!storage?.setItem) return stamp;
  try {
    storage.setItem(ANNOUNCEMENTS_LAST_SEEN_KEY, stamp);
  } catch {
    /* ignore quota / private mode */
  }
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent(ANNOUNCEMENTS_LAST_SEEN_EVENT, { detail: { at: stamp } }));
  }
  return stamp;
}

/** Count published announcements newer than lastSeen (ms or ISO). Missing lastSeen → 0 → all published. */
export function countUnreadAnnouncements(items, lastSeenAt = 0) {
  const threshold = typeof lastSeenAt === 'number' ? lastSeenAt : toTime(lastSeenAt);
  if (!Array.isArray(items) || items.length === 0) return 0;
  return items.reduce((count, item) => {
    if (!item?.isPublished) return count;
    return announcementActivityAt(item) > threshold ? count + 1 : count;
  }, 0);
}
