import { describe, expect, it } from 'vitest';
import {
  announcementActivityAt,
  countUnreadAnnouncements,
  markAnnouncementsSeen,
  readAnnouncementsLastSeen,
} from '../src/utils/announcementsUnreadBadge.js';

describe('announcementsUnreadBadge', () => {
  it('uses max of updatedAt, publishedAt, createdAt for activity', () => {
    expect(
      announcementActivityAt({
        createdAt: '2026-07-01T00:00:00.000Z',
        publishedAt: '2026-07-02T00:00:00.000Z',
        updatedAt: '2026-07-03T00:00:00.000Z',
      })
    ).toBe(Date.parse('2026-07-03T00:00:00.000Z'));

    expect(
      announcementActivityAt({
        createdAt: '2026-07-05T00:00:00.000Z',
        publishedAt: '2026-07-02T00:00:00.000Z',
        updatedAt: '2026-07-03T00:00:00.000Z',
      })
    ).toBe(Date.parse('2026-07-05T00:00:00.000Z'));
  });

  it('counts only published items newer than lastSeen', () => {
    const items = [
      {
        id: '1',
        isPublished: true,
        updatedAt: '2026-07-09T10:00:00.000Z',
      },
      {
        id: '2',
        isPublished: true,
        updatedAt: '2026-07-08T10:00:00.000Z',
      },
      {
        id: '3',
        isPublished: false,
        updatedAt: '2026-07-09T12:00:00.000Z',
      },
    ];

    expect(countUnreadAnnouncements(items, Date.parse('2026-07-08T12:00:00.000Z'))).toBe(1);
    expect(countUnreadAnnouncements(items, 0)).toBe(2);
    expect(countUnreadAnnouncements(items, '2026-07-09T11:00:00.000Z')).toBe(0);
  });

  it('excludes unpublished even when lastSeen is epoch', () => {
    expect(
      countUnreadAnnouncements(
        [{ id: 'draft', isPublished: false, createdAt: '2026-07-09T00:00:00.000Z' }],
        0
      )
    ).toBe(0);
  });

  it('reads and writes lastSeen via storage adapter', () => {
    const store = new Map();
    const storage = {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => {
        store.set(key, String(value));
      },
    };

    expect(readAnnouncementsLastSeen(storage)).toBe(0);
    markAnnouncementsSeen('2026-07-09T01:00:00.000Z', storage);
    expect(readAnnouncementsLastSeen(storage)).toBe(Date.parse('2026-07-09T01:00:00.000Z'));
  });
});
