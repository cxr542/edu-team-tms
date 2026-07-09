import { useCallback, useEffect, useState } from 'react';
import {
  listAnnouncementsFromSupabase,
  normalizeAnnouncement,
} from '../utils/announcementsSupabase.js';
import {
  ANNOUNCEMENTS_LAST_SEEN_EVENT,
  ANNOUNCEMENTS_LAST_SEEN_KEY,
  countUnreadAnnouncements,
  readAnnouncementsLastSeen,
} from '../utils/announcementsUnreadBadge.js';

const REFRESH_MS = 30000;

/** 사이드바 공지 신규 배지 — 공개 공지 vs localStorage lastSeen */
export function useAnnouncementsUnreadBadge(enabled) {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setCount(0);
      return;
    }

    const result = await listAnnouncementsFromSupabase({ includeUnpublished: false });
    if (!result.ok && result.status !== 'empty') {
      setCount(0);
      return;
    }

    const items = Array.isArray(result.data)
      ? result.data.map(normalizeAnnouncement).filter(Boolean)
      : [];
    const lastSeen = readAnnouncementsLastSeen();
    setCount(countUnreadAnnouncements(items, lastSeen));
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setCount(0);
      return undefined;
    }

    void refresh();

    const onStorage = (event) => {
      if (!event.key || event.key === ANNOUNCEMENTS_LAST_SEEN_KEY) {
        void refresh();
      }
    };
    const onSeen = () => {
      void refresh();
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', refresh);
    window.addEventListener(ANNOUNCEMENTS_LAST_SEEN_EVENT, onSeen);
    const intervalId = window.setInterval(() => {
      void refresh();
    }, REFRESH_MS);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', refresh);
      window.removeEventListener(ANNOUNCEMENTS_LAST_SEEN_EVENT, onSeen);
      window.clearInterval(intervalId);
    };
  }, [enabled, refresh]);

  return { count };
}
