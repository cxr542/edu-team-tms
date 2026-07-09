import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ANNOUNCEMENT_CATEGORY,
  announcementFeedDayKey,
  groupAnnouncementsByFeedDay,
  normalizeAnnouncementCategory,
  sortAnnouncements,
} from '../src/constants/announcements.js';

describe('announcement release-style helpers', () => {
  it('defaults new/unknown categories to release', () => {
    expect(DEFAULT_ANNOUNCEMENT_CATEGORY).toBe('release');
    expect(normalizeAnnouncementCategory('')).toBe('release');
    expect(normalizeAnnouncementCategory('unknown')).toBe('release');
    expect(normalizeAnnouncementCategory('notice')).toBe('notice');
  });

  it('builds local YYYY-MM-DD feed day keys', () => {
    expect(
      announcementFeedDayKey({
        publishedAt: '2026-07-09T03:00:00.000Z',
      })
    ).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(announcementFeedDayKey({})).toBe('미정');
  });

  it('groups sorted announcements by feed day', () => {
    const items = sortAnnouncements([
      {
        id: '2',
        title: 'B',
        isPinned: false,
        publishedAt: '2026-07-08T12:00:00.000Z',
        updatedAt: '2026-07-08T12:00:00.000Z',
        createdAt: '2026-07-08T12:00:00.000Z',
      },
      {
        id: '1',
        title: 'A',
        isPinned: true,
        publishedAt: '2026-07-09T12:00:00.000Z',
        updatedAt: '2026-07-09T12:00:00.000Z',
        createdAt: '2026-07-09T12:00:00.000Z',
      },
      {
        id: '3',
        title: 'C',
        isPinned: false,
        publishedAt: '2026-07-09T08:00:00.000Z',
        updatedAt: '2026-07-09T08:00:00.000Z',
        createdAt: '2026-07-09T08:00:00.000Z',
      },
    ]);

    const groups = groupAnnouncementsByFeedDay(items);
    expect(groups.length).toBeGreaterThanOrEqual(1);
    expect(groups.every((g) => typeof g.dayKey === 'string' && Array.isArray(g.items))).toBe(true);
    expect(groups.flatMap((g) => g.items).map((i) => i.id)).toEqual(items.map((i) => i.id));
  });
});
