import { useCallback, useEffect, useMemo, useState } from 'react';
import { findKpiMember } from '../constants/kpiMembers.js';
import {
  buildAnnouncementDraft,
  buildAnnouncementSummary,
  listAnnouncementsFromSupabase,
  normalizeAnnouncement,
  updateAnnouncementInSupabase,
  upsertAnnouncementToSupabase,
} from '../utils/announcementsSupabase.js';
import { sortAnnouncements } from '../constants/announcements.js';

function memberLabel(memberCode) {
  const member = findKpiMember(memberCode);
  return member?.displayName || memberCode || '알 수 없음';
}

function mergeById(prev, next) {
  const map = new Map(prev.map((item) => [item.id, item]));
  next.forEach((item) => map.set(item.id, item));
  return sortAnnouncements([...map.values()]);
}

export function useAnnouncements({ authorCode, authorName = null, canManage = false } = {}) {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState(null);
  const [sourceStatus, setSourceStatus] = useState('loading');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await listAnnouncementsFromSupabase({ includeUnpublished: canManage });

    if (!result.ok && result.status !== 'empty') {
      setAnnouncements([]);
      setSourceStatus(result.status);
      setError(result.message);
      setLoading(false);
      return result;
    }

    const next = Array.isArray(result.data) ? result.data.map(normalizeAnnouncement).filter(Boolean) : [];
    setAnnouncements(sortAnnouncements(next));
    setSourceStatus(result.status);
    setLoading(false);
    return result;
  }, [canManage]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createAnnouncement = useCallback(
    async (draft) => {
      const built = buildAnnouncementDraft({
        ...draft,
        author: draft?.author || authorName || memberLabel(authorCode),
        authorCode,
      });

      if (!built.ok) {
        return built;
      }

      setSavingId(built.data.id);
      const result = await upsertAnnouncementToSupabase(built.data);
      if (result.ok && result.data) {
        setAnnouncements((prev) => mergeById(prev, [result.data]));
      } else if (!result.ok && result.status !== 'disabled') {
        setError(result.message);
      }
      setSavingId(null);
      return result;
    },
    [authorCode, authorName]
  );

  const updateAnnouncement = useCallback(
    async (announcementId, patch) => {
      const current = announcements.find((item) => item.id === announcementId);
      if (!current) {
        return { ok: false, status: 'error', message: 'announcement not found.' };
      }

      const nextAnnouncement = {
        ...current,
        ...patch,
        id: current.id,
        author: current.author,
        authorCode: current.authorCode,
      };

      setSavingId(announcementId);
      const result = await updateAnnouncementInSupabase({
        announcement: nextAnnouncement,
        id: announcementId,
        patch: {
          title: patch?.title ?? current.title,
          body: patch?.body ?? current.body,
          category: patch?.category ?? current.category,
          isPinned: patch?.isPinned ?? current.isPinned,
          isPublished: patch?.isPublished ?? current.isPublished,
          publishedAt: patch?.publishedAt ?? current.publishedAt,
        },
      });
      if (result.ok && result.data) {
        setAnnouncements((prev) => mergeById(prev, [result.data]));
      } else if (!result.ok && result.status !== 'disabled') {
        setError(result.message);
      }
      setSavingId(null);
      return result;
    },
    [announcements]
  );

  const summary = useMemo(() => buildAnnouncementSummary(announcements), [announcements]);

  return {
    announcements,
    loading,
    savingId,
    error,
    sourceStatus,
    summary,
    refresh,
    createAnnouncement,
    updateAnnouncement,
    canManage,
    authorCode,
    defaultAuthorLabel: authorName || memberLabel(authorCode),
  };
}
