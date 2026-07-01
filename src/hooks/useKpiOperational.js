import { useCallback, useEffect, useState } from 'react';
import { KPI_STATUS } from '../constants/kpiStatuses';
import { mergeJournalKpiApprovalImport } from '../utils/journalKpiApprovalSlice';
import {
  KPI_OPERATIONAL_STORAGE_KEY,
  createEmptyKpiOperationalStore,
  defaultMonthly01,
  defaultQuarterRecord,
  defaultCompetencyMonthRecord,
  defaultCompetencyQuarterRecord,
  ensureCompetencyMonthMember,
  ensureCompetencyQuarterMember,
  ensureMonthMember,
  ensureQuarterMember,
  kpi2RowId,
  kpi2LegacyRowId,
  monthKey,
  migrateLegacyKpi2RowStatus,
  normalizeKpiOperationalStore,
  quarterKey,
  readKpi2RowStatus,
} from '../constants/kpiOperationalStore';
import { KPI3_MEMO_TYPES } from '../constants/kpiRules';
import { COMPETENCY_USE_4060 } from '../constants/competencyConfig';
import { mapMemberRoleToCompetency } from '../constants/competencyRubric';
import { findKpiMember } from '../constants/kpiSchema';
import {
  computeCompetencyEval,
  isValidCompetencyIntLevel,
  mergeCompetencyEvalSidePatch,
  monthlyFinalScore,
  normalizeCompetencyEvalSide,
  rollupQuarterLevelFromMonths,
} from '../utils/competencyScore';
import {
  ACADEMIZER_DEMO_KPI2_APPROVALS,
  KPI_WEEK_MEMOS_ACADEMIZER_SCENARIO,
} from '../data/journalSeedAcademizerScenario';
import { kpi3AcademizerSeedPatch } from '../data/kpi3SeedAcademizerScenario';
import { computeKpi3Composite, gradeKpi3 } from '../utils/kpiGrades';
import { isProductionEnvironment } from '../constants/appEnv';
import {
  isCompetencyMonthRecordSaveable,
  isValidCompetencyMemberCode,
  mergeApprovedCompetencyMonthsIntoKpiStore,
} from '../utils/kpiOperationalCloudSnapshot';
import {
  mirrorKpi2RowApprovalToSupabase,
  mirrorKpiMonthlyApprovalToSupabase,
} from '../utils/kpiOperationalSupabaseMirror';
import {
  loadMemberJournalsFromStorage,
  resolveLegacyKpi2Member,
} from '../utils/kpi2LegacyMigration';

const KPI_OPERATIONAL_SNAPSHOT_API = '/api/kpi-operational-snapshot';

async function fetchCompetencyCloudSnapshot() {
  const res = await fetch(`${KPI_OPERATIONAL_SNAPSHOT_API}?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`공유 역량을 불러오지 못했습니다 (${res.status})`);
  }
  return res.json();
}

function sanitizeCompetencyMonthsInStore(store) {
  const competencyMonths = {};
  Object.entries(store.competencyMonths || {}).forEach(([ym, members]) => {
    if (!members || typeof members !== 'object') return;
    competencyMonths[ym] = {};
    Object.entries(members).forEach(([memberCode, rec]) => {
      const roleId =
        rec?.roleId ?? mapMemberRoleToCompetency(findKpiMember(memberCode)?.role);
      competencyMonths[ym][memberCode] = {
        ...rec,
        roleId,
        self: normalizeCompetencyEvalSide(rec?.self, roleId),
        manager: normalizeCompetencyEvalSide(rec?.manager, roleId),
      };
    });
  });
  return { ...store, competencyMonths };
}

function sanitizeCompetencyQuartersInStore(store) {
  const competencyQuarters = {};
  Object.entries(store.competencyQuarters || {}).forEach(([yq, members]) => {
    if (!members || typeof members !== 'object') return;
    competencyQuarters[yq] = {};
    Object.entries(members).forEach(([memberCode, rec]) => {
      const roleId =
        rec?.roleId ?? mapMemberRoleToCompetency(findKpiMember(memberCode)?.role);
      competencyQuarters[yq][memberCode] = {
        ...rec,
        roleId,
        self: normalizeCompetencyEvalSide(rec?.self, roleId),
        manager: normalizeCompetencyEvalSide(rec?.manager, roleId),
      };
    });
  });
  return { ...store, competencyQuarters };
}

function sanitizeCompetencyInStore(store) {
  return sanitizeCompetencyQuartersInStore(sanitizeCompetencyMonthsInStore(store));
}

export function readCompetencyQuarter(store, yq, memberCode) {
  const rec = store.competencyQuarters?.[yq]?.[memberCode];
  if (!rec) return defaultCompetencyQuarterRecord(memberCode);
  const roleId =
    rec.roleId ?? mapMemberRoleToCompetency(findKpiMember(memberCode)?.role);
  return {
    ...rec,
    roleId,
    self: normalizeCompetencyEvalSide(rec.self, roleId),
    manager: normalizeCompetencyEvalSide(rec.manager, roleId),
  };
}

export function patchCompetencyQuarterSelf(store, yq, memberCode, patch) {
  let next = ensureCompetencyQuarterMember(store, yq, memberCode);
  const rec = next.competencyQuarters[yq][memberCode];
  const roleId =
    patch.roleId ?? rec.roleId ?? mapMemberRoleToCompetency(findKpiMember(memberCode)?.role);
  const self = mergeCompetencyEvalSidePatch(rec.self, patch, roleId);
  const updated = {
    ...rec,
    roleId,
    self: normalizeCompetencyEvalSide(self, roleId),
    manager: normalizeCompetencyEvalSide(rec.manager, roleId),
    updatedAt: new Date().toISOString(),
  };
  return {
    ...next,
    competencyQuarters: {
      ...next.competencyQuarters,
      [yq]: { ...next.competencyQuarters[yq], [memberCode]: updated },
    },
  };
}

export function patchCompetencyQuarterManager(store, yq, memberCode, patch) {
  let next = ensureCompetencyQuarterMember(store, yq, memberCode);
  const rec = next.competencyQuarters[yq][memberCode];
  const roleId =
    patch.roleId ?? rec.roleId ?? mapMemberRoleToCompetency(findKpiMember(memberCode)?.role);
  const manager = mergeCompetencyEvalSidePatch(rec.manager, patch, roleId);
  const updated = {
    ...rec,
    roleId,
    self: normalizeCompetencyEvalSide(rec.self, roleId),
    manager: normalizeCompetencyEvalSide(manager, roleId),
    updatedAt: new Date().toISOString(),
  };
  return {
    ...next,
    competencyQuarters: {
      ...next.competencyQuarters,
      [yq]: { ...next.competencyQuarters[yq], [memberCode]: updated },
    },
  };
}

export function patchLockCompetencyQuarter(store, yq, memberCode, { side = 'manager' } = {}) {
  let next = ensureCompetencyQuarterMember(store, yq, memberCode);
  const rec = next.competencyQuarters[yq][memberCode];
  const roleId =
    rec.roleId ?? mapMemberRoleToCompetency(findKpiMember(memberCode)?.role);
  const selfSide = normalizeCompetencyEvalSide(rec.self, roleId);
  if (side === 'self' && !isValidCompetencyIntLevel(selfSide.intLevel)) {
    return { store, ok: false, reason: 'invalid-int-level' };
  }
  const updatedAt = new Date().toISOString();
  const updated =
    side === 'self'
      ? {
          ...rec,
          roleId,
          self: selfSide,
          selfLocked: true,
          selfUpdatedAt: rec.selfUpdatedAt || rec.updatedAt || updatedAt,
          updatedAt,
        }
      : {
          ...rec,
          roleId,
          manager: normalizeCompetencyEvalSide(rec.manager, roleId),
          managerLocked: true,
          managerUpdatedAt: rec.managerUpdatedAt || rec.updatedAt || updatedAt,
          updatedAt,
        };
  next = {
    ...next,
    competencyQuarters: {
      ...next.competencyQuarters,
      [yq]: { ...next.competencyQuarters[yq], [memberCode]: updated },
    },
  };
  return { store: next, ok: true };
}

/** 구성원 self 확정 해제 — managerLocked 시 거부, self 데이터 유지 */
export function patchUnlockCompetencyQuarterSelf(store, yq, memberCode) {
  let next = ensureCompetencyQuarterMember(store, yq, memberCode);
  const rec = next.competencyQuarters[yq][memberCode];
  if (rec.managerLocked) {
    return { store, ok: false, reason: 'manager-locked' };
  }
  const roleId =
    rec.roleId ?? mapMemberRoleToCompetency(findKpiMember(memberCode)?.role);
  const updatedAt = new Date().toISOString();
  const updated = {
    ...rec,
    roleId,
    self: normalizeCompetencyEvalSide(rec.self, roleId),
    selfLocked: false,
    updatedAt,
  };
  next = {
    ...next,
    competencyQuarters: {
      ...next.competencyQuarters,
      [yq]: { ...next.competencyQuarters[yq], [memberCode]: updated },
    },
  };
  return { store: next, ok: true };
}

function migrateStoreLegacyKpi2Rows(store) {
  const unresolved = [];
  const memberJournals = loadMemberJournalsFromStorage();
  const migrated = migrateLegacyKpi2RowStatus(
    store,
    (dayKey, taskId) => resolveLegacyKpi2Member(memberJournals, dayKey, taskId),
    {
      onUnresolvedLegacyRow: (row) => unresolved.push(row),
    }
  );
  if (unresolved.length > 0) {
    console.warn(
      `[kpiOperational] unresolved legacy KPI2 rows dropped: ${unresolved.length}`,
      unresolved.map((r) => r.id)
    );
  }
  return migrated;
}

function loadStore() {
  try {
    const raw = localStorage.getItem(KPI_OPERATIONAL_STORAGE_KEY);
    if (!raw) return createEmptyKpiOperationalStore();
    const normalized = normalizeKpiOperationalStore(JSON.parse(raw));
    const migrated = migrateStoreLegacyKpi2Rows(normalized);
    return sanitizeCompetencyInStore(migrated);
  } catch {
    return createEmptyKpiOperationalStore();
  }
}

export function useKpiOperational({ readOnly = false } = {}) {
  const [store, setStore] = useState(loadStore);

  const persist = useCallback(
    (next) => {
      const withMeta = {
        ...next,
        meta: { ...next.meta, updatedAt: new Date().toISOString() },
      };
      if (!readOnly) {
        localStorage.setItem(KPI_OPERATIONAL_STORAGE_KEY, JSON.stringify(withMeta));
      }
      return withMeta;
    },
    [readOnly]
  );

  useEffect(() => {
    if (readOnly) return;
    localStorage.setItem(KPI_OPERATIONAL_STORAGE_KEY, JSON.stringify(store));
  }, [store, readOnly]);

  const getKpiWeekMemo = useCallback(
    (weekKey) => String(store.kpiWeekMemos?.[weekKey] ?? ''),
    [store.kpiWeekMemos]
  );

  const setKpiWeekMemo = useCallback(
    (weekKey, text) => {
      if (readOnly) return;
      setStore((prev) =>
        persist({
          ...prev,
          kpiWeekMemos: { ...prev.kpiWeekMemos, [weekKey]: text },
        })
      );
    },
    [readOnly, persist]
  );

  /** 저장된 월확정만 반환. 없으면 null → 일지 파생 M/M 사용 */
  const getMonthly01 = useCallback(
    (year, monthIndex, memberCode) => {
      const ym = monthKey(year, monthIndex);
      const m = store.months?.[ym]?.[memberCode]?.monthly01;
      return m ? { ...m } : null;
    },
    [store.months]
  );

  const getMonthly01OrDefault = useCallback(
    (year, monthIndex, memberCode) => getMonthly01(year, monthIndex, memberCode) ?? defaultMonthly01(),
    [getMonthly01]
  );

  const updateMonthly01 = useCallback(
    (year, monthIndex, memberCode, patch) => {
      if (readOnly) return;
      const ym = monthKey(year, monthIndex);
      const shouldMirror = Boolean(patch?.status);
      let persisted = null;
      setStore((prev) => {
        let next = ensureMonthMember(prev, ym, memberCode);
        const current = next.months[ym][memberCode].monthly01;
        const nextMonthly01 = { ...current, ...patch };
        next = {
          ...next,
          months: {
            ...next.months,
            [ym]: {
              ...next.months[ym],
              [memberCode]: {
                monthly01: nextMonthly01,
              },
            },
          },
        };
        persisted = persist(next);
        return persisted;
      });
      if (shouldMirror && persisted) {
        void mirrorKpiMonthlyApprovalToSupabase({
          year,
          monthIndex,
          memberCode,
          monthly01: persisted.months[ym][memberCode].monthly01,
          updatedAt: persisted.meta?.updatedAt,
        });
      }
    },
    [readOnly, persist]
  );

  const submitMonthly01 = useCallback(
    (year, monthIndex, memberCode) => {
      updateMonthly01(year, monthIndex, memberCode, {
        status: KPI_STATUS.SUBMITTED,
        submittedAt: new Date().toISOString(),
        rejectReason: '',
      });
    },
    [updateMonthly01]
  );

  const withdrawMonthly01 = useCallback(
    (year, monthIndex, memberCode) => {
      updateMonthly01(year, monthIndex, memberCode, {
        status: KPI_STATUS.DRAFT,
        submittedAt: null,
        approvedAt: null,
        approver: '',
      });
    },
    [updateMonthly01]
  );

  const getKpi2RowStatus = useCallback(
    (memberCode, dayKey, taskId) => {
      const row = readKpi2RowStatus(store.kpi2RowStatus, memberCode, dayKey, taskId).value;
      return row ? { ...row } : { status: KPI_STATUS.DRAFT, rejectReason: '', approver: '', approvedAt: null };
    },
    [store.kpi2RowStatus]
  );

  const setKpi2RowStatus = useCallback(
    (memberCode, dayKey, taskId, patch) => {
      if (readOnly) return;
      const id = kpi2RowId(memberCode, dayKey, taskId);
      const legacyId = kpi2LegacyRowId(dayKey, taskId);
      const shouldMirror = Boolean(patch?.status);
      let persisted = null;
      setStore((prev) => {
        const current = readKpi2RowStatus(prev.kpi2RowStatus, memberCode, dayKey, taskId).value || {
          status: KPI_STATUS.DRAFT,
          rejectReason: '',
          approver: '',
          approvedAt: null,
        };
        const next = {
          ...prev,
          kpi2RowStatus: {
            ...prev.kpi2RowStatus,
            [id]: { ...current, ...patch },
            [legacyId]: undefined,
          },
        };
        delete next.kpi2RowStatus[legacyId];
        persisted = persist(next);
        return persisted;
      });
      if (shouldMirror && persisted) {
        void mirrorKpi2RowApprovalToSupabase({
          memberCode,
          dayKey,
          taskId,
          kpi2RowStatus: persisted.kpi2RowStatus[id],
          updatedAt: persisted.meta?.updatedAt,
        });
      }
    },
    [readOnly, persist]
  );

  const submitKpi2Row = useCallback(
    (memberCode, dayKey, taskId) => {
      setKpi2RowStatus(memberCode, dayKey, taskId, {
        status: KPI_STATUS.SUBMITTED,
        submittedAt: new Date().toISOString(),
        rejectReason: '',
      });
    },
    [setKpi2RowStatus]
  );

  const approveKpi1 = useCallback(
    (year, monthIndex, memberCode, approver = '팀장') => {
      if (readOnly) return;
      updateMonthly01(year, monthIndex, memberCode, {
        status: KPI_STATUS.APPROVED,
        approvedAt: new Date().toISOString(),
        approver,
        rejectReason: '',
      });
    },
    [readOnly, updateMonthly01]
  );

  const rejectKpi1 = useCallback(
    (year, monthIndex, memberCode, reason, approver = '팀장') => {
      if (readOnly) return;
      updateMonthly01(year, monthIndex, memberCode, {
        status: KPI_STATUS.REJECTED,
        rejectReason: reason || '반려',
        approver,
        approvedAt: new Date().toISOString(),
      });
    },
    [readOnly, updateMonthly01]
  );

  const approveKpi2Row = useCallback(
    (memberCode, dayKey, taskId, approver = '팀장') => {
      if (readOnly) return;
      setKpi2RowStatus(memberCode, dayKey, taskId, {
        status: KPI_STATUS.APPROVED,
        approver,
        approvedAt: new Date().toISOString(),
        rejectReason: '',
      });
    },
    [readOnly, setKpi2RowStatus]
  );

  const rejectKpi2Row = useCallback(
    (memberCode, dayKey, taskId, reason, approver = '팀장') => {
      if (readOnly) return;
      setKpi2RowStatus(memberCode, dayKey, taskId, {
        status: KPI_STATUS.REJECTED,
        rejectReason: reason || '반려',
        approver,
        approvedAt: new Date().toISOString(),
      });
    },
    [readOnly, setKpi2RowStatus]
  );

  const getQuarterRecord = useCallback(
    (year, monthIndex, memberCode) => {
      const yq = quarterKey(year, monthIndex);
      const rec = store.quarters?.[yq]?.[memberCode];
      return rec ? JSON.parse(JSON.stringify(rec)) : defaultQuarterRecord(memberCode);
    },
    [store.quarters]
  );

  const addKpi3Memo = useCallback(
    (year, monthIndex, memberCode, { month: memoMonth, type, text }) => {
      if (readOnly) return;
      const yq = quarterKey(year, monthIndex);
      const validType = KPI3_MEMO_TYPES.some((t) => t.id === type) ? type : 'other';
      setStore((prev) => {
        let next = ensureQuarterMember(prev, yq, memberCode);
        const rec = next.quarters[yq][memberCode];
        const memos = [...(rec.memos || []), { id: `m-${Date.now()}`, month: memoMonth, type: validType, text }];
        next = {
          ...next,
          quarters: {
            ...next.quarters,
            [yq]: {
              ...next.quarters[yq],
              [memberCode]: { ...rec, memos },
            },
          },
        };
        return persist(next);
      });
    },
    [readOnly, persist]
  );

  const updateKpi3Quarter = useCallback(
    (year, monthIndex, memberCode, patch) => {
      if (readOnly) return;
      const yq = quarterKey(year, monthIndex);
      setStore((prev) => {
        let next = ensureQuarterMember(prev, yq, memberCode);
        const rec = next.quarters[yq][memberCode];
        const q = { ...rec.quarter, ...patch };
        const composite = computeKpi3Composite(q);
        const grade = gradeKpi3(composite);
        next = {
          ...next,
          quarters: {
            ...next.quarters,
            [yq]: {
              ...next.quarters[yq],
              [memberCode]: {
                ...rec,
                quarter: { ...q, composite, grade },
              },
            },
          },
        };
        return persist(next);
      });
    },
    [readOnly, persist]
  );

  const updateKpi3QuarterExtras = useCallback(
    (year, monthIndex, memberCode, patch) => {
      if (readOnly) return;
      const yq = quarterKey(year, monthIndex);
      setStore((prev) => {
        let next = ensureQuarterMember(prev, yq, memberCode);
        const rec = next.quarters[yq][memberCode];
        const updated = { ...rec };
        if (patch.dmDetail) updated.dmDetail = { ...rec.dmDetail, ...patch.dmDetail };
        if (patch.leaderDetail) updated.leaderDetail = { ...rec.leaderDetail, ...patch.leaderDetail };
        if (patch.practiceDetail) updated.practiceDetail = { ...rec.practiceDetail, ...patch.practiceDetail };
        next = {
          ...next,
          quarters: {
            ...next.quarters,
            [yq]: {
              ...next.quarters[yq],
              [memberCode]: updated,
            },
          },
        };
        return persist(next);
      });
    },
    [readOnly, persist]
  );

  const lockKpi3Quarter = useCallback(
    (year, monthIndex, memberCode) => {
      updateKpi3Quarter(year, monthIndex, memberCode, {
        locked: true,
        confirmedAt: new Date().toISOString(),
      });
    },
    [updateKpi3Quarter]
  );

  const getCompetencyMonth = useCallback(
    (year, monthIndex, memberCode) => {
      const ym = monthKey(year, monthIndex);
      const rec = store.competencyMonths?.[ym]?.[memberCode];
      if (!rec) return defaultCompetencyMonthRecord(memberCode);
      const roleId =
        rec.roleId ?? mapMemberRoleToCompetency(findKpiMember(memberCode)?.role);
      return {
        ...rec,
        roleId,
        self: normalizeCompetencyEvalSide(rec.self, roleId),
        manager: normalizeCompetencyEvalSide(rec.manager, roleId),
      };
    },
    [store.competencyMonths]
  );

  const updateCompetencySelf = useCallback(
    (year, monthIndex, memberCode, patch) => {
      if (readOnly) return;
      const ym = monthKey(year, monthIndex);
      setStore((prev) => {
        let next = ensureCompetencyMonthMember(prev, ym, memberCode);
        const rec = next.competencyMonths[ym][memberCode];
        const roleId = patch.roleId ?? rec.roleId ?? mapMemberRoleToCompetency(findKpiMember(memberCode)?.role);
        const self = mergeCompetencyEvalSidePatch(rec.self, patch, roleId);
        const updated = {
          ...rec,
          roleId,
          self: normalizeCompetencyEvalSide(self, roleId),
          manager: normalizeCompetencyEvalSide(rec.manager, roleId),
          updatedAt: new Date().toISOString(),
        };
        next = {
          ...next,
          competencyMonths: {
            ...next.competencyMonths,
            [ym]: { ...next.competencyMonths[ym], [memberCode]: updated },
          },
        };
        return persist(next);
      });
    },
    [readOnly, persist]
  );

  const updateCompetencyManager = useCallback(
    (year, monthIndex, memberCode, patch) => {
      if (readOnly) return;
      const ym = monthKey(year, monthIndex);
      setStore((prev) => {
        let next = ensureCompetencyMonthMember(prev, ym, memberCode);
        const rec = next.competencyMonths[ym][memberCode];
        const roleId = patch.roleId ?? rec.roleId ?? mapMemberRoleToCompetency(findKpiMember(memberCode)?.role);
        const manager = mergeCompetencyEvalSidePatch(rec.manager, patch, roleId);
        const updated = {
          ...rec,
          roleId,
          manager: normalizeCompetencyEvalSide(manager, roleId),
          updatedAt: new Date().toISOString(),
        };
        next = {
          ...next,
          competencyMonths: {
            ...next.competencyMonths,
            [ym]: { ...next.competencyMonths[ym], [memberCode]: updated },
          },
        };
        return persist(next);
      });
    },
    [readOnly, persist]
  );

  const pullCompetencyManagerFromSelf = useCallback(
    (year, monthIndex, memberCode) => {
      if (readOnly) return;
      const ym = monthKey(year, monthIndex);
      setStore((prev) => {
        let next = ensureCompetencyMonthMember(prev, ym, memberCode);
        const rec = next.competencyMonths[ym][memberCode];
        const roleId = rec.roleId;
        const manager = {
          intLevel: rec.self.intLevel,
          dims: { ...rec.self.dims },
        };
        const updated = {
          ...rec,
          manager: normalizeCompetencyEvalSide(manager, roleId),
          updatedAt: new Date().toISOString(),
        };
        next = {
          ...next,
          competencyMonths: {
            ...next.competencyMonths,
            [ym]: { ...next.competencyMonths[ym], [memberCode]: updated },
          },
        };
        return persist(next);
      });
    },
    [readOnly, persist]
  );

  const getCompetencyQuarter = useCallback(
    (yq, memberCode) => readCompetencyQuarter(store, yq, memberCode),
    [store]
  );

  const updateCompetencyQuarterSelf = useCallback(
    (yq, memberCode, patch) => {
      if (readOnly) return;
      setStore((prev) => persist(patchCompetencyQuarterSelf(prev, yq, memberCode, patch)));
    },
    [readOnly, persist]
  );

  const updateCompetencyQuarterManager = useCallback(
    (yq, memberCode, patch) => {
      if (readOnly) return;
      setStore((prev) => persist(patchCompetencyQuarterManager(prev, yq, memberCode, patch)));
    },
    [readOnly, persist]
  );

  const lockCompetencyQuarter = useCallback(
    (yq, memberCode, { side = 'manager' } = {}) => {
      if (readOnly) return { ok: false, reason: 'read-only' };
      let result = { ok: true };
      setStore((prev) => {
        const patched = patchLockCompetencyQuarter(prev, yq, memberCode, { side });
        result = { ok: patched.ok, reason: patched.reason };
        if (!patched.ok) return prev;
        return persist(patched.store);
      });
      return result;
    },
    [readOnly, persist]
  );

  const unlockCompetencyQuarterSelf = useCallback(
    (yq, memberCode) => {
      if (readOnly) return { ok: false, reason: 'read-only' };
      let result = { ok: true };
      setStore((prev) => {
        const patched = patchUnlockCompetencyQuarterSelf(prev, yq, memberCode);
        result = { ok: patched.ok, reason: patched.reason };
        if (!patched.ok) return prev;
        return persist(patched.store);
      });
      return result;
    },
    [readOnly, persist]
  );

  const lockCompetencyMonth = useCallback(
    (year, monthIndex, memberCode, { side = 'manager' } = {}) => {
      if (readOnly) return { ok: false, reason: 'read-only' };
      const ym = monthKey(year, monthIndex);
      let blockReason = null;
      setStore((prev) => {
        let next = ensureCompetencyMonthMember(prev, ym, memberCode);
        const rec = next.competencyMonths[ym][memberCode];
        const roleId =
          rec.roleId ?? mapMemberRoleToCompetency(findKpiMember(memberCode)?.role);
        const selfSide = normalizeCompetencyEvalSide(rec.self, roleId);
        if (side === 'self' && !isValidCompetencyIntLevel(selfSide.intLevel)) {
          blockReason = 'invalid-int-level';
          return prev;
        }
        const updatedAt = new Date().toISOString();
        const updated =
          side === 'self'
            ? {
                ...rec,
                roleId,
                self: selfSide,
                selfLocked: true,
                selfUpdatedAt: rec.selfUpdatedAt || rec.updatedAt || updatedAt,
                updatedAt,
              }
            : {
                ...rec,
                roleId,
                manager: normalizeCompetencyEvalSide(rec.manager, roleId),
                managerLocked: true,
                managerUpdatedAt: rec.managerUpdatedAt || rec.updatedAt || updatedAt,
                updatedAt,
              };
        next = {
          ...next,
          competencyMonths: {
            ...next.competencyMonths,
            [ym]: { ...next.competencyMonths[ym], [memberCode]: updated },
          },
        };
        return persist(next);
      });
      if (blockReason) return { ok: false, reason: blockReason };
      return { ok: true };
    },
    [readOnly, persist]
  );

  const unlockCompetencyMonthSelf = useCallback(
    (year, monthIndex, memberCode) => {
      if (readOnly) return { ok: false, reason: 'read-only' };
      const ym = monthKey(year, monthIndex);
      let result = { ok: true };
      setStore((prev) => {
        let next = ensureCompetencyMonthMember(prev, ym, memberCode);
        const rec = next.competencyMonths[ym][memberCode];
        if (rec.managerLocked) {
          result = { ok: false, reason: 'manager-locked' };
          return prev;
        }
        const roleId =
          rec.roleId ?? mapMemberRoleToCompetency(findKpiMember(memberCode)?.role);
        const updatedAt = new Date().toISOString();
        const updated = {
          ...rec,
          roleId,
          self: normalizeCompetencyEvalSide(rec.self, roleId),
          selfLocked: false,
          updatedAt,
        };
        next = {
          ...next,
          competencyMonths: {
            ...next.competencyMonths,
            [ym]: { ...next.competencyMonths[ym], [memberCode]: updated },
          },
        };
        return persist(next);
      });
      return result;
    },
    [readOnly, persist]
  );

  const unlockCompetencyMonthManager = useCallback(
    (year, monthIndex, memberCode) => {
      if (readOnly) return { ok: false, reason: 'read-only' };
      const ym = monthKey(year, monthIndex);
      setStore((prev) => {
        let next = ensureCompetencyMonthMember(prev, ym, memberCode);
        const rec = next.competencyMonths[ym][memberCode];
        const roleId =
          rec.roleId ?? mapMemberRoleToCompetency(findKpiMember(memberCode)?.role);
        const updatedAt = new Date().toISOString();
        const updated = {
          ...rec,
          roleId,
          manager: normalizeCompetencyEvalSide(rec.manager, roleId),
          managerLocked: false,
          updatedAt,
        };
        next = {
          ...next,
          competencyMonths: {
            ...next.competencyMonths,
            [ym]: { ...next.competencyMonths[ym], [memberCode]: updated },
          },
        };
        return persist(next);
      });
      return { ok: true };
    },
    [readOnly, persist]
  );

  const rollupCompetencyToKpi3Quarter = useCallback(
    (year, monthIndex, memberCode) => {
      if (readOnly) return;
      const level = rollupQuarterLevelFromMonths(store.competencyMonths, year, monthIndex, memberCode, COMPETENCY_USE_4060);
      if (level == null) return;
      updateKpi3Quarter(year, monthIndex, memberCode, { level, levelAuto: true });
    },
    [readOnly, store.competencyMonths, updateKpi3Quarter]
  );

  const getCompetencyMonthlyFinal = useCallback(
    (year, monthIndex, memberCode) => {
      const rec = getCompetencyMonth(year, monthIndex, memberCode);
      if (!rec) return null;
      return monthlyFinalScore(rec.self?.computed?.proposed, rec.manager?.computed?.proposed, COMPETENCY_USE_4060);
    },
    [getCompetencyMonth]
  );

  const importStore = useCallback(
    (snapshot) => {
      const normalized = normalizeKpiOperationalStore(snapshot);
      const migrated = migrateStoreLegacyKpi2Rows(normalized);
      const next = persist(sanitizeCompetencyInStore(migrated));
      setStore(next);
      return next;
    },
    [persist]
  );

  const mergeKpi3SeedIntoStore = useCallback((prev, patch) => {
    const competencyMonths = { ...(prev.competencyMonths || {}) };
    Object.entries(patch.competencyMonths || {}).forEach(([ym, members]) => {
      competencyMonths[ym] = { ...(competencyMonths[ym] || {}), ...members };
    });
    const quarters = { ...(prev.quarters || {}) };
    Object.entries(patch.quarters || {}).forEach(([yq, members]) => {
      quarters[yq] = { ...(quarters[yq] || {}), ...members };
    });
    const competencyQuarters = { ...(prev.competencyQuarters || {}) };
    Object.entries(patch.competencyQuarters || {}).forEach(([yq, members]) => {
      competencyQuarters[yq] = { ...(competencyQuarters[yq] || {}), ...members };
    });
    return {
      ...prev,
      competencyMonths,
      competencyQuarters,
      quarters,
      meta: { ...prev.meta, ...patch.meta, updatedAt: new Date().toISOString() },
    };
  }, []);

  /** KPI3 4요소·월간 루브릭 샘플 (2026 2Q · A/B/C) */
  const seedKpi3AcademizerDemo = useCallback(() => {
    if (readOnly) return;
    setStore((prev) => persist(mergeKpi3SeedIntoStore(prev, kpi3AcademizerSeedPatch())));
  }, [readOnly, persist, mergeKpi3SeedIntoStore]);

  /** 일지 샘플(6월 Academizer) + KPI2 승인 + KPI3 샘플 */
  const seedAcademizerDemo = useCallback(() => {
    if (readOnly) return;
    const now = new Date().toISOString();
    setStore((prev) => {
      const kpi2RowStatus = { ...prev.kpi2RowStatus };
      ACADEMIZER_DEMO_KPI2_APPROVALS.forEach(({ memberCode, dayKey, taskId }) => {
        const id = kpi2RowId(memberCode, dayKey, taskId);
        kpi2RowStatus[id] = {
          status: KPI_STATUS.APPROVED,
          submittedAt: now,
          approvedAt: now,
          approver: '데모(시나리오)',
          rejectReason: '',
        };
      });
      let next = {
        ...prev,
        kpiWeekMemos: { ...prev.kpiWeekMemos, ...KPI_WEEK_MEMOS_ACADEMIZER_SCENARIO },
        kpi2RowStatus,
      };
      next = mergeKpi3SeedIntoStore(next, kpi3AcademizerSeedPatch());
      return persist(next);
    });
  }, [readOnly, persist, mergeKpi3SeedIntoStore]);

  const getStore = useCallback(() => store, [store]);

  const pullCompetencyCloudSnapshot = useCallback(async () => {
    if (readOnly) return { ok: false, reason: 'read-only' };
    try {
      const remote = await fetchCompetencyCloudSnapshot();
      let mergedStore = null;
      setStore((prev) => {
        mergedStore = mergeApprovedCompetencyMonthsIntoKpiStore(prev, remote);
        return persist(mergedStore);
      });
      return { ok: true, remote, store: mergedStore };
    } catch (e) {
      return { ok: false, reason: 'error', error: e };
    }
  }, [readOnly, persist]);

  const saveCompetencyMemberCloudSnapshot = useCallback(
    async (memberCode, yearMonth) => {
      if (readOnly) return { ok: false, reason: 'read-only' };
      if (!isProductionEnvironment()) {
        return { ok: false, reason: 'dev-blocked', error: new Error('개발 환경에서는 공유 저장이 차단됩니다.') };
      }
      if (!isValidCompetencyMemberCode(memberCode)) {
        return { ok: false, reason: 'invalid-member' };
      }

      const [yearStr, monthStr] = String(yearMonth).split('-');
      const year = Number(yearStr);
      const monthIndex = Number(monthStr) - 1;
      const competencyMonth = getCompetencyMonth(year, monthIndex, memberCode);

      if (!isCompetencyMonthRecordSaveable(competencyMonth, memberCode)) {
        return { ok: false, reason: 'empty' };
      }

      const updatedAt = competencyMonth.updatedAt || new Date().toISOString();
      try {
        const res = await fetch(KPI_OPERATIONAL_SNAPSHOT_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ memberCode, yearMonth, competencyMonth, updatedAt }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body.message || body.error || `공유 역량 저장 실패 (${res.status})`);
        }
        let mergedStore = null;
        setStore((prev) => {
          mergedStore = mergeApprovedCompetencyMonthsIntoKpiStore(prev, body.snapshot || body);
          return persist(mergedStore);
        });
        return { ok: true, remote: body.snapshot, store: mergedStore };
      } catch (e) {
        return { ok: false, reason: 'error', error: e };
      }
    },
    [readOnly, persist, getCompetencyMonth]
  );

  const mergeJournalKpiApproval = useCallback(
    (snapshot, options) => {
      if (readOnly) return;
      setStore((prev) => persist(mergeJournalKpiApprovalImport(prev, snapshot, options)));
    },
    [readOnly, persist]
  );

  return {
    kpiOperational: store,
    kpiWeekMemos: store.kpiWeekMemos,
    getKpiWeekMemo,
    setKpiWeekMemo,
    getMonthly01,
    getMonthly01OrDefault,
    updateMonthly01,
    submitMonthly01,
    withdrawMonthly01,
    getKpi2RowStatus,
    setKpi2RowStatus,
    submitKpi2Row,
    approveKpi1,
    rejectKpi1,
    approveKpi2Row,
    rejectKpi2Row,
    getQuarterRecord,
    addKpi3Memo,
    updateKpi3Quarter,
    updateKpi3QuarterExtras,
    lockKpi3Quarter,
    getCompetencyMonth,
    getCompetencyQuarter,
    updateCompetencySelf,
    updateCompetencyQuarterSelf,
    updateCompetencyManager,
    updateCompetencyQuarterManager,
    pullCompetencyManagerFromSelf,
    lockCompetencyMonth,
    lockCompetencyQuarter,
    unlockCompetencyMonthSelf,
    unlockCompetencyMonthManager,
    unlockCompetencyQuarterSelf,
    rollupCompetencyToKpi3Quarter,
    getCompetencyMonthlyFinal,
    importStore,
    seedAcademizerDemo,
    seedKpi3AcademizerDemo,
    mergeJournalKpiApproval,
    getStore,
    pullCompetencyCloudSnapshot,
    saveCompetencyMemberCloudSnapshot,
  };
}
