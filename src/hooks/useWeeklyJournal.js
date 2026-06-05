import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  JOURNAL_SEED_ACADEMIZER_SCENARIO,
  KPI_WEEK_MEMOS_ACADEMIZER_SCENARIO,
} from '../data/journalSeedAcademizerScenario';
import { JOURNAL_SEED_MAY_2026 } from '../data/journalSeedMay2026';
import {
  resolveWeekColumnText,
  WEEK_COLUMN_TEMPLATE,
} from '../constants/journalCategories';
import {
  TEAM_LEADER_MEMBER_CODE,
  JOURNAL_LINKED_MEMBER_CODE,
  findKpiMember,
  formatKpiMemberLabel,
} from '../constants/kpiMembers';
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
import {
  cloneMemberJournalSlice,
  createEmptyMemberJournals,
  fillMemberJournalsFromA,
  getMemberJournal,
  migrateJournalStore,
} from '../utils/journalMemberStore';
import { recalcDayMmFromHours } from '../utils/journalMm';

function cloneSeed() {
  return JSON.parse(
    JSON.stringify({
      ...JOURNAL_SEED_MAY_2026,
      ...JOURNAL_SEED_ACADEMIZER_SCENARIO,
    })
  );
}

function cloneSeedKpiWeekMemos() {
  return { ...KPI_WEEK_MEMOS_ACADEMIZER_SCENARIO };
}

function recalcMemberDays(days) {
  const withHolidays = apply2026PublicHolidaysToDays(days || {});
  Object.values(withHolidays).forEach((day) => recalcDayMmFromHours(day));
  return withHolidays;
}

function recalcAllMemberJournals(memberJournals) {
  const next = { ...memberJournals };
  Object.keys(next).forEach((code) => {
    next[code] = {
      ...next[code],
      days: recalcMemberDays(next[code].days),
    };
  });
  return next;
}

function toStore(snapshot) {
  const migrated = migrateJournalStore(snapshot, {
    seedDaysForA: cloneSeed(),
    seedKpiWeekMemosForA: cloneSeedKpiWeekMemos(),
  });
  return {
    memberJournals: recalcAllMemberJournals(fillMemberJournalsFromA(migrated.memberJournals)),
    meta: { updatedAt: snapshot.publishedAt || new Date().toISOString() },
  };
}

function loadStore() {
  const fallback = toStore({
    memberJournals: createEmptyMemberJournals(),
    publishedAt: null,
  });
  try {
    const raw = localStorage.getItem(JOURNAL_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    const migrated = migrateJournalStore(parsed, {
      seedDaysForA: cloneSeed(),
      seedKpiWeekMemosForA: cloneSeedKpiWeekMemos(),
    });
    return {
      memberJournals: recalcAllMemberJournals(fillMemberJournalsFromA(migrated.memberJournals)),
      meta: parsed.meta || { updatedAt: parsed.publishedAt || null },
    };
  } catch {
    return fallback;
  }
}

function updateMemberJournal(prev, memberCode, updater) {
  const current = getMemberJournal(prev, memberCode);
  const nextSlice = typeof updater === 'function' ? updater(current) : updater;
  return {
    ...prev,
    memberJournals: {
      ...prev.memberJournals,
      [memberCode]: nextSlice,
    },
  };
}

export function useWeeklyJournal({ readOnly = false, autoSyncCloud = true } = {}) {
  const [store, setStore] = useState(loadStore);
  const [syncStatus, setSyncStatus] = useState('idle');

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

  useEffect(() => {
    if (readOnly) return;
    setStore((prev) => {
      const memberJournals = recalcAllMemberJournals(prev.memberJournals || {});
      if (JSON.stringify(memberJournals) === JSON.stringify(prev.memberJournals)) return prev;
      return persist({ ...prev, memberJournals });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly]);

  const applyRemoteSnapshot = useCallback(
    (snapshot) => {
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
        applyRemoteSnapshot(remote);
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
          applyRemoteSnapshot(remote);
        }
      } catch {
        /* public/journal-snapshot.json 없음 */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly, autoSyncCloud]);

  const importFromFile = useCallback(
    async (file) => {
      const text = await file.text();
      const snapshot = normalizeJournalSnapshot(JSON.parse(text));
      applyRemoteSnapshot(snapshot);
      return snapshot;
    },
    [applyRemoteSnapshot]
  );

  const getMemberDays = useCallback(
    (memberCode = JOURNAL_LINKED_MEMBER_CODE) => getMemberJournal(store, memberCode).days || {},
    [store.memberJournals]
  );

  const getDayData = useCallback(
    (key, memberCode = JOURNAL_LINKED_MEMBER_CODE) =>
      resolveJournalDay(key, getMemberJournal(store, memberCode).days[key]),
    [store.memberJournals]
  );

  const updateDay = useCallback(
    (key, updater, memberCode = JOURNAL_LINKED_MEMBER_CODE) => {
      if (readOnly) return;
      setStore((prev) => {
        const next = updateMemberJournal(prev, memberCode, (slice) => {
          const day = slice.days[key] || defaultDayForKey(key);
          const nextDay = typeof updater === 'function' ? updater({ ...day, tasks: [...day.tasks] }) : updater;
          recalcDayMmFromHours(nextDay);
          return { ...slice, days: { ...slice.days, [key]: nextDay } };
        });
        return persist(next);
      });
    },
    [readOnly, persist]
  );

  const setWeekSummary = useCallback(
    (weekKey, text, memberCode = JOURNAL_LINKED_MEMBER_CODE) => {
      if (readOnly) return;
      setStore((prev) =>
        persist(
          updateMemberJournal(prev, memberCode, (slice) => ({
            ...slice,
            weekSummaries: { ...slice.weekSummaries, [weekKey]: text },
          }))
        )
      );
    },
    [readOnly, persist]
  );

  const setNextWeekPlan = useCallback(
    (weekKey, text, memberCode = JOURNAL_LINKED_MEMBER_CODE) => {
      if (readOnly) return;
      setStore((prev) =>
        persist(
          updateMemberJournal(prev, memberCode, (slice) => ({
            ...slice,
            nextWeekPlans: { ...slice.nextWeekPlans, [weekKey]: text },
          }))
        )
      );
    },
    [readOnly, persist]
  );

  const getWeekSummaryContent = useCallback(
    (weekKey, memberCode = JOURNAL_LINKED_MEMBER_CODE) =>
      resolveWeekColumnText(getMemberJournal(store, memberCode).weekSummaries[weekKey]),
    [store.memberJournals]
  );

  const getNextWeekContent = useCallback(
    (weekKey, memberCode = JOURNAL_LINKED_MEMBER_CODE) =>
      resolveWeekColumnText(getMemberJournal(store, memberCode).nextWeekPlans[weekKey]),
    [store.memberJournals]
  );

  const applyWeekColumnTemplate = useCallback(
    (weekKey, field, memberCode = JOURNAL_LINKED_MEMBER_CODE) => {
      if (readOnly) return;
      const key = field === 'summary' ? 'weekSummaries' : 'nextWeekPlans';
      setStore((prev) =>
        persist(
          updateMemberJournal(prev, memberCode, (slice) => ({
            ...slice,
            [key]: { ...slice[key], [weekKey]: WEEK_COLUMN_TEMPLATE },
          }))
        )
      );
    },
    [readOnly, persist]
  );

  const setKpiWeekMemo = useCallback(
    (weekKey, text, memberCode = JOURNAL_LINKED_MEMBER_CODE) => {
      if (readOnly) return;
      setStore((prev) =>
        persist(
          updateMemberJournal(prev, memberCode, (slice) => ({
            ...slice,
            kpiWeekMemos: { ...(slice.kpiWeekMemos || {}), [weekKey]: text },
          }))
        )
      );
    },
    [readOnly, persist]
  );

  const getKpiWeekMemo = useCallback(
    (weekKey, memberCode = JOURNAL_LINKED_MEMBER_CODE) =>
      String(getMemberJournal(store, memberCode).kpiWeekMemos?.[weekKey] ?? ''),
    [store.memberJournals]
  );

  const resetToSeed = useCallback(
    (memberCode = JOURNAL_LINKED_MEMBER_CODE) => {
      if (readOnly) return false;
      const member = findKpiMember(memberCode);
      const memberLabel = member ? formatKpiMemberLabel(member) : memberCode;
      if (
        !window.confirm(
          `${memberLabel} 일지를 초기화할까요? (해당 구성원의 저장된 일지·주간 메모가 사라집니다)`
        )
      ) {
        return false;
      }
      const seedSlice = {
        days: recalcMemberDays(cloneSeed()),
        weekSummaries: {},
        nextWeekPlans: {},
        kpiWeekMemos: cloneSeedKpiWeekMemos(),
      };
      setStore((prev) => {
        let next = updateMemberJournal(prev, memberCode, () => cloneMemberJournalSlice(seedSlice));
        if (memberCode === TEAM_LEADER_MEMBER_CODE) {
          ['B', 'C'].forEach((code) => {
            next = updateMemberJournal(next, code, () => cloneMemberJournalSlice(seedSlice));
          });
        }
        return persist(next);
      });
      return true;
    },
    [readOnly, persist]
  );

  const linkedDays = useMemo(
    () => getMemberDays(JOURNAL_LINKED_MEMBER_CODE),
    [getMemberDays]
  );

  return {
    memberJournals: store.memberJournals,
    days: linkedDays,
    getMemberDays,
    weekSummaries: getMemberJournal(store, JOURNAL_LINKED_MEMBER_CODE).weekSummaries,
    nextWeekPlans: getMemberJournal(store, JOURNAL_LINKED_MEMBER_CODE).nextWeekPlans,
    kpiWeekMemos: getMemberJournal(store, JOURNAL_LINKED_MEMBER_CODE).kpiWeekMemos || {},
    meta: store.meta,
    syncStatus,
    getDayData,
    updateDay,
    setWeekSummary,
    setNextWeekPlan,
    getWeekSummaryContent,
    getNextWeekContent,
    applyWeekColumnTemplate,
    setKpiWeekMemo,
    getKpiWeekMemo,
    resetToSeed,
    pullFromCloud,
    importFromFile,
    getStore: () => store,
  };
}
