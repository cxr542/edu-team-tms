export const ANNOUNCEMENT_CATEGORY_LABELS = {
  notice: '공지',
  release: '릴리즈노트',
  incident: '장애안내',
  guide: '사용안내',
};

/** Fixed reaction set for announcement engagement (v1). */
export const ANNOUNCEMENT_REACTION_EMOJIS = ['👍', '❤️', '🎉', '👀', '✅'];

export const ANNOUNCEMENT_COMMENT_MAX_LENGTH = 500;

/** New posts default to release-note style updates. */
export const DEFAULT_ANNOUNCEMENT_CATEGORY = 'release';

export const ANNOUNCEMENT_CATEGORY_LIST = Object.entries(ANNOUNCEMENT_CATEGORY_LABELS).map(
  ([value, label]) => ({ value, label })
);

export const ANNOUNCEMENT_CATEGORY_COLORS = {
  notice: 'announcement-badge--notice',
  release: 'announcement-badge--release',
  incident: 'announcement-badge--incident',
  guide: 'announcement-badge--guide',
};

export const ANNOUNCEMENT_SUMMARY_WINDOW_DAYS = 7;

function toTime(value) {
  const time = new Date(value || 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

export function announcementFeedTimestamp(announcement) {
  return toTime(
    announcement?.publishedAt || announcement?.updatedAt || announcement?.createdAt
  );
}

/** YYYY-MM-DD for changelog day headers (local timezone). */
export function announcementFeedDayKey(announcement) {
  const time = announcementFeedTimestamp(announcement);
  if (!time) return '미정';
  const d = new Date(time);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Group sorted announcements by local calendar day for a release-note timeline.
 * @param {Array} items already sorted preferred
 * @returns {Array<{ dayKey: string, items: Array }>}
 */
export function groupAnnouncementsByFeedDay(items) {
  const groups = [];
  const indexByDay = new Map();
  for (const item of items || []) {
    const dayKey = announcementFeedDayKey(item);
    let group = indexByDay.get(dayKey);
    if (!group) {
      group = { dayKey, items: [] };
      indexByDay.set(dayKey, group);
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}

export function normalizeAnnouncementCategory(value) {
  const next = String(value || '').trim();
  return ANNOUNCEMENT_CATEGORY_LABELS[next] ? next : DEFAULT_ANNOUNCEMENT_CATEGORY;
}

export function formatAnnouncementCategoryLabel(category) {
  return ANNOUNCEMENT_CATEGORY_LABELS[normalizeAnnouncementCategory(category)] || ANNOUNCEMENT_CATEGORY_LABELS.notice;
}

export function formatAnnouncementPublishLabel(isPublished) {
  return isPublished ? '공개' : '비공개';
}

export function formatAnnouncementVisibilityLabel(isPublished) {
  return formatAnnouncementPublishLabel(isPublished);
}

export function isAnnouncementPublished(announcement) {
  return Boolean(announcement?.isPublished);
}

export function isAnnouncementPinned(announcement) {
  return Boolean(announcement?.isPinned);
}

export function sortAnnouncements(items) {
  return [...items].sort((a, b) => {
    const pinnedDelta = Number(isAnnouncementPinned(b)) - Number(isAnnouncementPinned(a));
    if (pinnedDelta !== 0) return pinnedDelta;
    const aTime = toTime(a?.updatedAt || a?.publishedAt || a?.createdAt);
    const bTime = toTime(b?.updatedAt || b?.publishedAt || b?.createdAt);
    if (aTime !== bTime) return bTime - aTime;
    const createdDelta = toTime(b?.createdAt) - toTime(a?.createdAt);
    if (createdDelta !== 0) return createdDelta;
    return String(a?.id || '').localeCompare(String(b?.id || ''));
  });
}

export function isAnnouncementRecentlyUpdated(announcement, now = Date.now()) {
  const updatedAt = toTime(announcement?.updatedAt || announcement?.createdAt);
  if (!updatedAt) return false;
  return now - updatedAt <= ANNOUNCEMENT_SUMMARY_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

export function countRecentAnnouncementUpdates(items, now = Date.now()) {
  return items.reduce(
    (count, item) => count + (isAnnouncementRecentlyUpdated(item, now) ? 1 : 0),
    0
  );
}
