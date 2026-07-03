export const ANNOUNCEMENT_CATEGORY_LABELS = {
  notice: '공지',
  release: '릴리즈노트',
  incident: '장애안내',
  guide: '사용안내',
};

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

const DEFAULT_ANNOUNCEMENT_CATEGORY = 'notice';

function toTime(value) {
  const time = new Date(value || 0).getTime();
  return Number.isFinite(time) ? time : 0;
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
