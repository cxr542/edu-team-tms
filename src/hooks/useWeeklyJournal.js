import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  JOURNAL_SEED_ACADEMIZER_SCENARIO,
  KPI_WEEK_MEMOS_ACADEMIZER_SCENARIO,
} from '../data/journalSeedAcademizerScenario';
import { JOURNAL_SEED_MAY_2026 } from '../data/journalSeedMay2026';
import {
  resolveWeekColumnText,
} from '../constants/journalCategories';
import {
  normalizeMemberPrefs,
  resolveMemberWeekColumnTemplate,
} from '../utils/journalMemberPrefs';
import {
  TEAM_LEADER_MEMBER_CODE,
  JOURNAL_LINKED_MEMBER_CODE,
  findKpiMember,
  formatKpiMemberLabel,
} from '../constants/kpiMembers';
import {
  fetchJournalSnapshot,
  JOURNAL_STORAGE_KEY,
  normalizeJournalSnapshot,
  parseJournalSnapshotForImport,
  saveJournalMemberSnapshot,
} from '../utils/journalSnapshot';
import {
  mergeJournalSnapshotsByMember,
  normalizeJournalCloudSnapshot,
} from '../utils/journalCloudSnapshot';
import {
  apply2026PublicHolidaysToDays,
  defaultDayForKey,
  resolveJournalDay,
} from '../utils/journalHoliday2026';
import {
  cloneMemberJournalSlice,
  createEmptyMemberJournals,
  getMemberJournal,
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

const OLD_AT = '1970-01-01T00:00:00.000Z';

function seedStore() {
  const memberJournals = createEmptyMemberJournals();
  memberJournals.A = {
    ...memberJournals.A,
    days: cloneSeed(),
    kpiWeekMemos: cloneSeedKpiWeekMemos(),
  };
  return {
    memberJournals: recalcAllMemberJournals(memberJournals),
    meta: { updatedAt: null, memberUpdatedAt: {} },
  };
}

function toStore(snapshot) {
  const normalized = normalizeJournalSnapshot(snapshot);
  return {
    memberJournals: recalcAllMemberJournals(normalized.memberJournals),
    meta: normalized.meta || { updatedAt: normalized.publishedAt || null, memberUpdatedAt: {} },
  };
}

function storeToSnapshot(store) {
  return normalizeJournalCloudSnapshot({
    publishedAt: store.meta?.updatedAt || OLD_AT,
    meta: store.meta || {},
    memberJournals: store.memberJournals || createEmptyMemberJournals(),
  });
}

function mergeRemoteIntoStore(store, remote, options) {
  return toStore(mergeJournalSnapshotsByMember(storeToSnapshot(store), remote, options));
}

function uniqueMembers(memberCodes) {
  return [...new Set([memberCodes].flat().filter(Boolean))];
}

function loadStore() {
  const fallback = seedStore();
  try {
    const raw = localStorage.getItem(JOURNAL_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return toStore(parsed);
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
  const [cloudSaveStatus, setCloudSaveStatus] = useState('idle');
  const [pendingCloudMembers, setPendingCloudMembers] = useState([]);

  const cacheStore = useCallback(
    (next) => {
      if (!readOnly) {
        localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(next));
      }
      return next;
    },
    [readOnly]
  );

  const persist = useCallback(
    (next, memberCodes) => {
      const touched = uniqueMembers(memberCodes);
      const updatedAt = new Date().toISOString();
      const memberUpdatedAt = { ...(next.meta?.memberUpdatedAt || {}) };
      touched.forEach((code) => {
        memberUpdatedAt[code] = updatedAt;
      });
      const withMeta = {
        ...next,
        meta: { ...(next.meta || {}), updatedAt, memberUpdatedAt },
      };
      if (!readOnly) {
        localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(withMeta));
      }
      if (!readOnly && autoSyncCloud && touched.length > 0) {
        setCloudSaveStatus('queued');
        setPendingCloudMembers((prev) => uniqueMembers([...prev, ...touched]));
      }
      return withMeta;
    },
    [autoSyncCloud, readOnly]
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
      return cacheStore({ ...prev, memberJournals });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly]);

  const applyRemoteSnapshot = useCallback(
    (snapshot, options = {}) => {
      let merged;
      setStore((prev) => {
        merged = cacheStore(mergeRemoteIntoStore(prev, snapshot, options));
        return merged;
      });
      setSyncStatus('synced');
      return merged;
    },
    [cacheStore]
  );

  const pullFromCloud = useCallback(
    async () => {
      setSyncStatus('checking');
      try {
        const remote = await fetchJournalSnapshot();
        if (!remote) {
          setSyncStatus('idle');
          return { ok: false, reason: 'no-remote' };
        }
        const snapshot = parseJournalSnapshotForImport(remote);
        applyRemoteSnapshot(snapshot, { importRemote: true });
        return { ok: true, remote: snapshot };
      } catch (e) {
        setSyncStatus('error');
        throw e;
      }
    },
    [applyRemoteSnapshot]
  );

  useEffect(() => {
    if (readOnly || !autoSyncCloud) return;
    let cancelled = false;
    (async () => {
      try {
        const remote = await fetchJournalSnapshot();
        if (cancelled || !remote) return;
        applyRemoteSnapshot(remote);
      } catch {
        setSyncStatus('idle');
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
      const snapshot = parseJournalSnapshotForImport(JSON.parse(text));
      applyRemoteSnapshot(snapshot, { importRemote: true });
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
        return persist(next, memberCode);
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
          })),
          memberCode
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
          })),
          memberCode
        )
      );
    },
    [readOnly, persist]
  );

  const getMemberPrefs = useCallback(
    (memberCode = JOURNAL_LINKED_MEMBER_CODE) =>
      normalizeMemberPrefs(getMemberJournal(store, memberCode).prefs),
    [store.memberJournals]
  );

  const setMemberPrefs = useCallback(
    (prefs, memberCode = JOURNAL_LINKED_MEMBER_CODE) => {
      if (readOnly) return;
      setStore((prev) =>
        persist(
          updateMemberJournal(prev, memberCode, (slice) => ({
            ...slice,
            prefs: normalizeMemberPrefs(prefs),
          })),
          memberCode
        )
      );
    },
    [readOnly, persist]
  );

  const getWeekSummaryContent = useCallback(
    (weekKey, memberCode = JOURNAL_LINKED_MEMBER_CODE) => {
      const slice = getMemberJournal(store, memberCode);
      const template = resolveMemberWeekColumnTemplate(slice.prefs);
      return resolveWeekColumnText(slice.weekSummaries[weekKey], template);
    },
    [store.memberJournals]
  );

  const getNextWeekContent = useCallback(
    (weekKey, memberCode = JOURNAL_LINKED_MEMBER_CODE) => {
      const slice = getMemberJournal(store, memberCode);
      const template = resolveMemberWeekColumnTemplate(slice.prefs);
      return resolveWeekColumnText(slice.nextWeekPlans[weekKey], template);
    },
    [store.memberJournals]
  );

  const applyWeekColumnTemplate = useCallback(
    (weekKey, field, memberCode = JOURNAL_LINKED_MEMBER_CODE) => {
      if (readOnly) return;
      const key = field === 'summary' ? 'weekSummaries' : 'nextWeekPlans';
      setStore((prev) => {
        const template = resolveMemberWeekColumnTemplate(getMemberJournal(prev, memberCode).prefs);
        return persist(
          updateMemberJournal(prev, memberCode, (slice) => ({
            ...slice,
            [key]: { ...slice[key], [weekKey]: template },
          })),
          memberCode
        );
      });
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
          })),
          memberCode
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
        return persist(next, memberCode === TEAM_LEADER_MEMBER_CODE ? ['A', 'B', 'C'] : memberCode);
      });
      return true;
    },
    [readOnly, persist]
  );

  const saveMemberToCloud = useCallback(
    async (memberCode = JOURNAL_LINKED_MEMBER_CODE) => {
      if (readOnly) return { ok: false, reason: 'read-only' };
      setCloudSaveStatus('saving');
      try {
        const latest = await saveJournalMemberSnapshot(
          memberCode,
          getMemberJournal(store, memberCode),
          store.meta?.memberUpdatedAt?.[memberCode] || store.meta?.updatedAt
        );
        applyRemoteSnapshot(latest);
        setCloudSaveStatus('saved');
        setPendingCloudMembers((prev) => prev.filter((code) => code !== memberCode));
        return { ok: true, remote: latest };
      } catch (e) {
        setCloudSaveStatus('error');
        return { ok: false, reason: 'error', error: e };
      }
    },
    [applyRemoteSnapshot, readOnly, store]
  );

  useEffect(() => {
    if (readOnly || !autoSyncCloud || pendingCloudMembers.length === 0) return undefined;
    const timer = window.setTimeout(async () => {
      const members = pendingCloudMembers;
      setPendingCloudMembers((prev) => prev.filter((code) => !members.includes(code)));
      setCloudSaveStatus('saving');
      try {
        let latest = null;
        for (const memberCode of members) {
          latest = await saveJournalMemberSnapshot(
            memberCode,
            getMemberJournal(store, memberCode),
            store.meta?.memberUpdatedAt?.[memberCode] || store.meta?.updatedAt
          );
        }
        if (latest) applyRemoteSnapshot(latest);
        setCloudSaveStatus('saved');
      } catch {
        setCloudSaveStatus('error');
      }
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [applyRemoteSnapshot, autoSyncCloud, pendingCloudMembers, readOnly, store]);

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
    cloudSaveStatus,
    getDayData,
    updateDay,
    setWeekSummary,
    setNextWeekPlan,
    getWeekSummaryContent,
    getNextWeekContent,
    applyWeekColumnTemplate,
    getMemberPrefs,
    setMemberPrefs,
    setKpiWeekMemo,
    getKpiWeekMemo,
    resetToSeed,
    pullFromCloud,
    saveMemberToCloud,
    importFromFile,
    getStore: () => store,
  };
}
