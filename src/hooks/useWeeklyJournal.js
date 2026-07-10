import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  applyJournalSnapshotViewOnlyImport,
  downloadJournalSnapshot,
  fetchJournalSnapshot,
  JOURNAL_STORAGE_KEY,
  normalizeJournalSnapshot,
  parseJournalSnapshotForImport,
  saveJournalMemberSnapshot,
} from '../utils/journalSnapshot';
import {
  applyRemoteMemberJournalSave,
  mergeJournalSnapshotsByMember,
  normalizeJournalCloudSnapshot,
} from '../utils/journalCloudSnapshot';
import {
  buildMemberRemoteSnapshotFromSupabase,
  fetchTeamJournalSnapshotFromSupabase,
} from '../utils/supabaseJournalSnapshot';
import {
  JOURNAL_SUPABASE_AUTO_MIRROR_DEBOUNCE_MS,
  SUPABASE_MANUAL_MIRROR_ENABLED,
} from '../constants/supabaseSync';
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

const JOURNAL_CLOUD_AUTO_SYNC_DEBOUNCE_MS = 8000;

function mergeViewOnlyIntoStore(store, remote, ownMemberCode) {
  return applyJournalSnapshotViewOnlyImport(store, remote, ownMemberCode);
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

export function useWeeklyJournal({
  readOnly = false,
  autoSyncCloud = false,
  autoMirrorSupabase = false,
  mirrorMemberToSupabase = null,
} = {}) {
  const [store, setStore] = useState(loadStore);
  const [syncStatus, setSyncStatus] = useState('idle');
  const [cloudSaveStatus, setCloudSaveStatus] = useState('idle');
  const [pendingCloudMembers, setPendingCloudMembers] = useState([]);
  const [pendingSupabaseMembers, setPendingSupabaseMembers] = useState([]);
  const [supabaseMirrorSaveStatus, setSupabaseMirrorSaveStatus] = useState('idle');
  const storeRef = useRef(store);
  const mirrorFnRef = useRef(mirrorMemberToSupabase);

  useEffect(() => {
    storeRef.current = store;
  }, [store]);

  useEffect(() => {
    mirrorFnRef.current = mirrorMemberToSupabase;
  }, [mirrorMemberToSupabase]);

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
      if (!readOnly && autoMirrorSupabase && touched.length > 0) {
        setSupabaseMirrorSaveStatus('queued');
        setPendingSupabaseMembers((prev) => uniqueMembers([...prev, ...touched]));
      }
      return withMeta;
    },
    [autoMirrorSupabase, autoSyncCloud, readOnly]
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

  const applyMemberCloudSave = useCallback(
    (memberCode, snapshot, options = {}) => {
      let merged;
      let previous;
      setStore((prev) => {
        previous = prev;
        merged = cacheStore(applyRemoteMemberJournalSave(prev, snapshot, memberCode, options));
        return merged;
      });
      setSyncStatus('synced');
      const prevSlice = previous?.memberJournals?.[memberCode];
      const nextSlice = merged?.memberJournals?.[memberCode];
      const prevAt = previous?.meta?.memberUpdatedAt?.[memberCode] || null;
      const nextAt = merged?.meta?.memberUpdatedAt?.[memberCode] || null;
      const changed =
        JSON.stringify(prevSlice) !== JSON.stringify(nextSlice) || prevAt !== nextAt;
      return { merged, changed };
    },
    [cacheStore]
  );

  /**
   * Apply a Supabase journal_snapshots row onto the selected member local slice.
   * @param {{ force?: boolean }} [options]
   */
  const applyMemberFromSupabaseSnapshot = useCallback(
    (memberCode, data, options = {}) => {
      if (!data) {
        return { ok: false, reason: 'empty', changed: false, snapshot: null };
      }
      const remoteSnapshot = buildMemberRemoteSnapshotFromSupabase(memberCode, data);
      const { merged, changed } = applyMemberCloudSave(memberCode, remoteSnapshot, options);
      return {
        ok: true,
        changed,
        reason: changed ? 'applied' : 'unchanged',
        snapshot: remoteSnapshot,
        store: merged,
      };
    },
    [applyMemberCloudSave]
  );

  const applyRemoteSnapshot = useCallback(
    (snapshot, options = {}) => {
      let merged;
      let changed = false;
      setStore((prev) => {
        merged = cacheStore(mergeRemoteIntoStore(prev, snapshot, options));
        changed = JSON.stringify(prev.memberJournals) !== JSON.stringify(merged.memberJournals);
        return merged;
      });
      setSyncStatus('synced');
      return { merged, changed };
    },
    [cacheStore]
  );

  const applyViewOnlySnapshot = useCallback(
    (snapshot, ownMemberCode) => {
      let merged;
      let changed = false;
      setStore((prev) => {
        merged = cacheStore(mergeViewOnlyIntoStore(prev, snapshot, ownMemberCode));
        changed = JSON.stringify(prev.memberJournals) !== JSON.stringify(merged.memberJournals);
        return merged;
      });
      setSyncStatus('synced');
      return { merged, changed };
    },
    [cacheStore]
  );

  const pullFromCloud = useCallback(
    async ({ ownMemberCode, includeOwnMember = false } = {}) => {
      setSyncStatus('checking');
      try {
        let result = null;

        // J7c: Preview MANUAL_MIRROR → Supabase team snapshot first, Blob fallback.
        if (SUPABASE_MANUAL_MIRROR_ENABLED) {
          const supabase = await fetchTeamJournalSnapshotFromSupabase();
          if (supabase?.ok && supabase.snapshot) {
            result = { snapshot: supabase.snapshot, source: 'supabase' };
          }
        }

        if (!result?.snapshot) {
          result = await fetchJournalSnapshot();
        }

        if (!result?.snapshot) {
          setSyncStatus('idle');
          return { ok: false, reason: 'no-remote' };
        }
        const snapshot = parseJournalSnapshotForImport(result.snapshot);
        const shouldPreserveOwnMember = ownMemberCode && !includeOwnMember;
        const { changed } = shouldPreserveOwnMember
          ? applyViewOnlySnapshot(snapshot, ownMemberCode)
          : applyRemoteSnapshot(snapshot, { importRemote: true });
        return {
          ok: true,
          changed,
          source: result.source,
          publishedAt: snapshot.publishedAt,
          ownMemberCode,
          includeOwnMember,
          snapshot,
        };
      } catch (e) {
        setSyncStatus('error');
        throw e;
      }
    },
    [applyRemoteSnapshot, applyViewOnlySnapshot]
  );

  useEffect(() => {
    if (readOnly || !autoSyncCloud) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await fetchJournalSnapshot();
        if (cancelled || !result?.snapshot) return;
        applyRemoteSnapshot(result.snapshot);
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

  const importViewOnlyFromFile = useCallback(
    async (file, ownMemberCode) => {
      const text = await file.text();
      const snapshot = parseJournalSnapshotForImport(JSON.parse(text));
      applyViewOnlySnapshot(snapshot, ownMemberCode);
      return snapshot;
    },
    [applyViewOnlySnapshot]
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

  const getMemberKpiWeekMemos = useCallback(
    (memberCode = JOURNAL_LINKED_MEMBER_CODE) =>
      getMemberJournal(store, memberCode).kpiWeekMemos || {},
    [store.memberJournals]
  );

  const downloadJournalBackup = useCallback(
    (kpiOperational = null) => downloadJournalSnapshot(store, kpiOperational),
    [store]
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
    async (memberCode = JOURNAL_LINKED_MEMBER_CODE, memberJournal = getMemberJournal(store, memberCode)) => {
      if (readOnly) return { ok: false, reason: 'read-only' };
      setCloudSaveStatus('saving');
      try {
        const latest = await saveJournalMemberSnapshot(
          memberCode,
          memberJournal,
          store.meta?.memberUpdatedAt?.[memberCode] || store.meta?.updatedAt
        );
        applyMemberCloudSave(memberCode, latest);
        setCloudSaveStatus('saved');
        setPendingCloudMembers((prev) => prev.filter((code) => code !== memberCode));
        return { ok: true, remote: latest };
      } catch (e) {
        setCloudSaveStatus(e.reason === 'conflict' ? 'conflict' : 'error');
        return {
          ok: false,
          reason: e.reason || 'error',
          error: e,
          conflictSnapshot: e.snapshot || null,
        };
      }
    },
    [applyMemberCloudSave, readOnly, store]
  );

  useEffect(() => {
    if (readOnly || !autoSyncCloud || pendingCloudMembers.length === 0) return undefined;
    const timer = window.setTimeout(async () => {
      const members = pendingCloudMembers;
      setPendingCloudMembers((prev) => prev.filter((code) => !members.includes(code)));
      setCloudSaveStatus('saving');
      let hadConflict = false;
      try {
        for (const memberCode of members) {
          try {
            const latest = await saveJournalMemberSnapshot(
              memberCode,
              getMemberJournal(store, memberCode),
              store.meta?.memberUpdatedAt?.[memberCode] || store.meta?.updatedAt
            );
            applyMemberCloudSave(memberCode, latest);
          } catch (e) {
            if (e.reason === 'conflict') {
              hadConflict = true;
            } else {
              throw e;
            }
          }
        }
        setCloudSaveStatus(hadConflict ? 'conflict' : 'saved');
      } catch {
        setCloudSaveStatus('error');
      }
    }, JOURNAL_CLOUD_AUTO_SYNC_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [applyMemberCloudSave, autoSyncCloud, pendingCloudMembers, readOnly, store]);

  useEffect(() => {
    if (readOnly || !autoMirrorSupabase || pendingSupabaseMembers.length === 0) {
      return undefined;
    }
    if (typeof mirrorFnRef.current !== 'function') {
      return undefined;
    }

    const timer = window.setTimeout(async () => {
      const members = pendingSupabaseMembers;
      setPendingSupabaseMembers((prev) => prev.filter((code) => !members.includes(code)));
      setSupabaseMirrorSaveStatus('saving');
      let hadConflict = false;
      let hadError = false;
      const currentStore = storeRef.current;

      for (const memberCode of members) {
        try {
          const result = await mirrorFnRef.current(memberCode, currentStore);
          if (!result?.ok) {
            if (result?.status === 'conflict') {
              hadConflict = true;
            } else if (result?.status === 'forbidden' || result?.status === 'disabled') {
              hadError = true;
              setPendingSupabaseMembers([]);
              break;
            } else {
              hadError = true;
            }
          }
        } catch {
          hadError = true;
        }
      }

      if (hadError) {
        setSupabaseMirrorSaveStatus(hadConflict ? 'conflict' : 'error');
      } else {
        setSupabaseMirrorSaveStatus(hadConflict ? 'conflict' : 'saved');
      }
    }, JOURNAL_SUPABASE_AUTO_MIRROR_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [autoMirrorSupabase, pendingSupabaseMembers, readOnly]);

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
    supabaseMirrorSaveStatus,
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
    getMemberKpiWeekMemos,
    downloadJournalBackup,
    resetToSeed,
    pullFromCloud,
    saveMemberToCloud,
    applyMemberFromSupabaseSnapshot,
    importFromFile,
    importViewOnlyFromFile,
    getStore: () => store,
  };
}
