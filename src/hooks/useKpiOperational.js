import { useCallback, useEffect, useState } from 'react';
import { KPI_STATUS } from '../constants/kpiStatuses';
import {
  KPI_OPERATIONAL_STORAGE_KEY,
  createEmptyKpiOperationalStore,
  defaultMonthly01,
  defaultQuarterRecord,
  defaultCompetencyMonthRecord,
  ensureCompetencyMonthMember,
  ensureMonthMember,
  ensureQuarterMember,
  kpi2RowId,
  monthKey,
  normalizeKpiOperationalStore,
  quarterKey,
} from '../constants/kpiOperationalStore';
import { KPI3_MEMO_TYPES } from '../constants/kpiRules';
import { COMPETENCY_USE_4060 } from '../constants/competencyConfig';
import { mapMemberRoleToCompetency } from '../constants/competencyRubric';
import { findKpiMember } from '../constants/kpiSchema';
import {
  computeCompetencyEval,
  monthlyFinalScore,
  rollupQuarterLevelFromMonths,
} from '../utils/competencyScore';
import {
  ACADEMIZER_DEMO_KPI2_APPROVALS,
  KPI_WEEK_MEMOS_ACADEMIZER_SCENARIO,
} from '../data/journalSeedAcademizerScenario';
import { kpi3AcademizerSeedPatch } from '../data/kpi3SeedAcademizerScenario';
import { computeKpi3Composite, gradeKpi3 } from '../utils/kpiGrades';

function loadStore() {
  try {
    const raw = localStorage.getItem(KPI_OPERATIONAL_STORAGE_KEY);
    if (!raw) return createEmptyKpiOperationalStore();
    return normalizeKpiOperationalStore(JSON.parse(raw));
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
      setStore((prev) => {
        let next = ensureMonthMember(prev, ym, memberCode);
        const current = next.months[ym][memberCode].monthly01;
        next = {
          ...next,
          months: {
            ...next.months,
            [ym]: {
              ...next.months[ym],
              [memberCode]: {
                monthly01: { ...current, ...patch },
              },
            },
          },
        };
        return persist(next);
      });
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
    (dayKey, taskId) => {
      const id = kpi2RowId(dayKey, taskId);
      const row = store.kpi2RowStatus[id];
      return row ? { ...row } : { status: KPI_STATUS.DRAFT, rejectReason: '', approver: '', approvedAt: null };
    },
    [store.kpi2RowStatus]
  );

  const setKpi2RowStatus = useCallback(
    (dayKey, taskId, patch) => {
      if (readOnly) return;
      const id = kpi2RowId(dayKey, taskId);
      setStore((prev) => {
        const current = prev.kpi2RowStatus[id] || {
          status: KPI_STATUS.DRAFT,
          rejectReason: '',
          approver: '',
          approvedAt: null,
        };
        return persist({
          ...prev,
          kpi2RowStatus: { ...prev.kpi2RowStatus, [id]: { ...current, ...patch } },
        });
      });
    },
    [readOnly, persist]
  );

  const submitKpi2Row = useCallback(
    (dayKey, taskId) => {
      setKpi2RowStatus(dayKey, taskId, {
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
    (dayKey, taskId, approver = '팀장') => {
      if (readOnly) return;
      setKpi2RowStatus(dayKey, taskId, {
        status: KPI_STATUS.APPROVED,
        approver,
        approvedAt: new Date().toISOString(),
        rejectReason: '',
      });
    },
    [readOnly, setKpi2RowStatus]
  );

  const rejectKpi2Row = useCallback(
    (dayKey, taskId, reason, approver = '팀장') => {
      if (readOnly) return;
      setKpi2RowStatus(dayKey, taskId, {
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
      if (rec) return JSON.parse(JSON.stringify(rec));
      return defaultCompetencyMonthRecord(memberCode);
    },
    [store.competencyMonths]
  );

  const recomputeCompetencySide = (side, roleId) => {
    const computed = computeCompetencyEval({
      intLevel: side.intLevel,
      dims: side.dims,
      roleId,
    });
    return { ...side, computed };
  };

  const updateCompetencySelf = useCallback(
    (year, monthIndex, memberCode, patch) => {
      if (readOnly) return;
      const ym = monthKey(year, monthIndex);
      setStore((prev) => {
        let next = ensureCompetencyMonthMember(prev, ym, memberCode);
        const rec = next.competencyMonths[ym][memberCode];
        const roleId = patch.roleId ?? rec.roleId ?? mapMemberRoleToCompetency(findKpiMember(memberCode)?.role);
        const self = {
          intLevel: patch.intLevel ?? rec.self.intLevel,
          dims: { ...rec.self.dims, ...(patch.dims || {}) },
        };
        const updated = {
          ...rec,
          roleId,
          self: recomputeCompetencySide(self, roleId),
          manager: recomputeCompetencySide(
            { intLevel: rec.manager.intLevel, dims: rec.manager.dims },
            roleId
          ),
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
        const manager = {
          intLevel: patch.intLevel ?? rec.manager.intLevel,
          dims: { ...rec.manager.dims, ...(patch.dims || {}) },
        };
        const updated = {
          ...rec,
          manager: recomputeCompetencySide(manager, roleId),
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
          manager: recomputeCompetencySide(manager, roleId),
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

  const lockCompetencyMonth = useCallback(
    (year, monthIndex, memberCode, { side = 'manager' } = {}) => {
      if (readOnly) return;
      const ym = monthKey(year, monthIndex);
      setStore((prev) => {
        let next = ensureCompetencyMonthMember(prev, ym, memberCode);
        const rec = next.competencyMonths[ym][memberCode];
        const patch = side === 'self' ? { selfLocked: true } : { managerLocked: true };
        next = {
          ...next,
          competencyMonths: {
            ...next.competencyMonths,
            [ym]: { ...next.competencyMonths[ym], [memberCode]: { ...rec, ...patch, updatedAt: new Date().toISOString() } },
          },
        };
        return persist(next);
      });
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
      const next = persist(normalizeKpiOperationalStore(snapshot));
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
    return {
      ...prev,
      competencyMonths,
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
      ACADEMIZER_DEMO_KPI2_APPROVALS.forEach(({ dayKey, taskId }) => {
        const id = kpi2RowId(dayKey, taskId);
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
    updateCompetencySelf,
    updateCompetencyManager,
    pullCompetencyManagerFromSelf,
    lockCompetencyMonth,
    rollupCompetencyToKpi3Quarter,
    getCompetencyMonthlyFinal,
    importStore,
    seedAcademizerDemo,
    seedKpi3AcademizerDemo,
    getStore,
  };
}
