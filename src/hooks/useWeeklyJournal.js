import { useCallback, useEffect, useMemo, useState } from 'react';
import { JOURNAL_SEED_MAY_2026 } from '../data/journalSeedMay2026';
import {
  resolveWeekColumnText,
  stripLegacyWeekColumnEntries,
  WEEK_COLUMN_TEMPLATE,
} from '../constants/journalCategories';
import {
  fetchJournalSnapshot,
  getLocalJournalMeta,
  isRemoteNewer,
  JOURNAL_STORAGE_KEY,
  normalizeJournalSnapshot,
} from '../utils/journalSnapshot';
import {
  apply2026PublicHolidaysToDays,
  defaultDayForKey,
  resolveJournalDay,
} from '../utils/journalHoliday2026';
import { recalcDayMmFromHours } from '../utils/journalMm';

function cloneSeed() {
  return JSON.parse(JSON.stringify(JOURNAL_SEED_MAY_2026));
}

function recalcAll(days) {
  const withHolidays = apply2026PublicHolidaysToDays(days);
  Object.values(withHolidays).forEach((day) => recalcDayMmFromHours(day));
  return withHolidays;
}

function toStore(snapshot) {
  return {
    days: recalcAll(snapshot.days || {}),
    weekSummaries: stripLegacyWeekColumnEntries(snapshot.weekSummaries),
    nextWeekPlans: stripLegacyWeekColumnEntries(snapshot.nextWeekPlans),
    meta: { updatedAt: snapshot.publishedAt || new Date().toISOString() },
  };
}

function loadStore() {
  try {
    const raw = localStorage.getItem(JOURNAL_STORAGE_KEY);
    if (!raw) return toStore({ days: cloneSeed(), weekSummaries: {}, nextWeekPlans: {}, publishedAt: null });
    const parsed = JSON.parse(raw);
    return {
      days: recalcAll(parsed.days || cloneSeed()),
      weekSummaries: stripLegacyWeekColumnEntries(parsed.weekSummaries),
      nextWeekPlans: stripLegacyWeekColumnEntries(parsed.nextWeekPlans),
      meta: parsed.meta || { updatedAt: parsed.publishedAt || null },
    };
  } catch {
    return toStore({ days: cloneSeed(), weekSummaries: {}, nextWeekPlans: {}, publishedAt: null });
  }
}

export function useWeeklyJournal({ readOnly = false, autoSyncCloud = true } = {}) {
  const [store, setStore] = useState(loadStore);
  const [syncStatus, setSyncStatus] = useState('idle'); // idle | checking | synced | local-newer | error

  const persist = useCallback(
    (next) => {
      const withMeta = {
        ...next,
        meta: { updatedAt: new Date().toISOString() },
      };
      if (!readOnly) {
        localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(withMeta));
      }
      return withMeta;
    },
    [readOnly]
  );

  useEffect(() => {
    if (readOnly) return;
    localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(store));
  }, [store, readOnly]);

  /** 예전 localStorage·클라우드에 공휴일 미반영 시 한 번 보정 */
  useEffect(() => {
    if (readOnly) return;
    setStore((prev) => {
      const days = recalcAll(prev.days || {});
      if (JSON.stringify(days) === JSON.stringify(prev.days)) return prev;
      return persist({ ...prev, days });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly]);

  const applyRemoteSnapshot = useCallback(
    (snapshot, { silent = false } = {}) => {
      const next = persist(toStore(snapshot));
      setStore(next);
      setSyncStatus('synced');
      return next;
    },
    [persist]
  );

  const pullFromCloud = useCallback(
    async ({ force = false, silent = false } = {}) => {
      setSyncStatus('checking');
      try {
        const remote = await fetchJournalSnapshot();
        if (!remote) {
          setSyncStatus('idle');
          return { ok: false, reason: 'no-remote' };
        }
        const localAt = store.meta?.updatedAt || getLocalJournalMeta().updatedAt;
        if (!force && !isRemoteNewer(remote.publishedAt, localAt)) {
          setSyncStatus('local-newer');
          return { ok: false, reason: 'local-newer', remote };
        }
        if (
          !force &&
          !silent &&
          localAt &&
          !window.confirm(
            `클라우드 백업(${new Date(remote.publishedAt).toLocaleString('ko-KR')})으로 이 기기 일지를 덮어쓸까요?`
          )
        ) {
          setSyncStatus('idle');
          return { ok: false, reason: 'cancelled' };
        }
        applyRemoteSnapshot(remote, { silent: true });
        return { ok: true, remote };
      } catch (e) {
        setSyncStatus('error');
        throw e;
      }
    },
    [applyRemoteSnapshot, store.meta?.updatedAt]
  );

  useEffect(() => {
    if (readOnly || !autoSyncCloud) return;
    let cancelled = false;
    (async () => {
      try {
        const remote = await fetchJournalSnapshot();
        if (cancelled || !remote) return;
        const localAt = store.meta?.updatedAt || getLocalJournalMeta().updatedAt;
        if (isRemoteNewer(remote.publishedAt, localAt)) {
          applyRemoteSnapshot(remote, { silent: true });
        }
      } catch {
        /* public/journal-snapshot.json 없음 */
      }
    })();
    return () => {
      cancelled = true;
    };
    // 최초 1회만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly, autoSyncCloud]);

  const importFromFile = useCallback(
    async (file) => {
      const text = await file.text();
      const snapshot = normalizeJournalSnapshot(JSON.parse(text));
      applyRemoteSnapshot(snapshot, { silent: true });
      return snapshot;
    },
    [applyRemoteSnapshot]
  );

  const getDayData = useCallback(
    (key) => resolveJournalDay(key, store.days[key]),
    [store.days]
  );

  const updateDay = useCallback(
    (key, updater) => {
      if (readOnly) return;
      setStore((prev) => {
        const day = prev.days[key] || defaultDayForKey(key);
        const nextDay = typeof updater === 'function' ? updater({ ...day, tasks: [...day.tasks] }) : updater;
        recalcDayMmFromHours(nextDay);
        return persist({ ...prev, days: { ...prev.days, [key]: nextDay } });
      });
    },
    [readOnly, persist]
  );

  const setWeekSummary = useCallback(
    (weekKey, text) => {
      if (readOnly) return;
      setStore((prev) => persist({ ...prev, weekSummaries: { ...prev.weekSummaries, [weekKey]: text } }));
    },
    [readOnly, persist]
  );

  const setNextWeekPlan = useCallback(
    (weekKey, text) => {
      if (readOnly) return;
      setStore((prev) => persist({ ...prev, nextWeekPlans: { ...prev.nextWeekPlans, [weekKey]: text } }));
    },
    [readOnly, persist]
  );

  const getWeekSummaryContent = useCallback(
    (weekKey) => resolveWeekColumnText(store.weekSummaries[weekKey]),
    [store.weekSummaries]
  );

  const getNextWeekContent = useCallback(
    (weekKey) => resolveWeekColumnText(store.nextWeekPlans[weekKey]),
    [store.nextWeekPlans]
  );

  const applyWeekColumnTemplate = useCallback(
    (weekKey, field) => {
      if (readOnly) return;
      const key = field === 'summary' ? 'weekSummaries' : 'nextWeekPlans';
      setStore((prev) =>
        persist({
          ...prev,
          [key]: { ...prev[key], [weekKey]: WEEK_COLUMN_TEMPLATE },
        })
      );
    },
    [readOnly, persist]
  );

  const resetToSeed = useCallback(() => {
    if (readOnly) return;
    if (window.confirm('5월 샘플 데이터로 되돌릴까요? (저장된 일지가 사라집니다)')) {
      setStore(persist({ days: recalcAll(cloneSeed()), weekSummaries: {}, nextWeekPlans: {} }));
    }
  }, [readOnly, persist]);

  return {
    days: store.days,
    weekSummaries: store.weekSummaries,
    nextWeekPlans: store.nextWeekPlans,
    meta: store.meta,
    syncStatus,
    getDayData,
    updateDay,
    setWeekSummary,
    setNextWeekPlan,
    getWeekSummaryContent,
    getNextWeekContent,
    applyWeekColumnTemplate,
    resetToSeed,
    pullFromCloud,
    importFromFile,
    getStore: () => store,
  };
}
