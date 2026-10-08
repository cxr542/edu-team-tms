import { useCallback, useEffect, useRef, useState } from 'react';
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
import { applyAppealPatch, createAppeal, isDateKey, normalizeAppeals } from '../utils/kpiAppeals';
import { PRACTICE_SCORE_NO_EVIDENCE } from '../utils/kpi3ElementScores';
import { createExecApproval } from '../utils/kpiExecApproval';
import { isProductionEnvironment } from '../constants/appEnv';
import { syncQuarterLevelsFromCompetencyMonths } from '../utils/kpiQuarterLevelSync';
import {
  isQuarterRecordSaveable,
  mergeQuartersIntoKpiStore,
  pickSharedQuarterRecord,
} from '../utils/kpiQuarterCloudSnapshot';
import {
  isCompetencyMonthRecordSaveable,
  isValidCompetencyMemberCode,
  mergeApprovedCompetencyMonthsIntoKpiStore,
  mergeCompetencyMonthsIntoKpiStore,
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
// 함수 수 한도(Vercel Hobby 12) 때문에 월간 역량 API와 같은 함수를 scope 쿼리로 구분한다
const KPI_QUARTER_SNAPSHOT_API = '/api/kpi-operational-snapshot?scope=quarters';

async function fetchQuarterCloudSnapshot() {
  const res = await fetch(`${KPI_QUARTER_SNAPSHOT_API}&t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`공유 분기 평가를 불러오지 못했습니다 (${res.status})`);
  }
  return res.json();
}

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
  // 서버 반영(mirror) 값 계산용 — 상태 갱신 함수가 늦게 실행돼도 최신 저장 상태를 참조한다
  const storeRef = useRef(store);
  storeRef.current = store;

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
      if (shouldMirror) {
        // setStore 의 갱신 함수는 즉시 실행되지 않을 수 있어(persisted 가 비어 있음) 그 경우에도
        // 서버 반영이 빠지지 않도록 현재 저장값 + patch 로 대신 계산한다.
        const base = storeRef.current?.months?.[ym]?.[memberCode]?.monthly01 ?? defaultMonthly01();
        const monthly01 = persisted?.months?.[ym]?.[memberCode]?.monthly01 ?? { ...base, ...patch };
        // 반환값: 서버 반영이 끝나면 resolve (호출한 쪽이 기다렸다가 목록을 새로 읽을 수 있다)
        return mirrorKpiMonthlyApprovalToSupabase({
          year,
          monthIndex,
          memberCode,
          monthly01,
          updatedAt: persisted?.meta?.updatedAt ?? new Date().toISOString(),
        });
      }
      return undefined;
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
        // 병합 시 옛 제출본에 철회가 덮이지 않도록 철회 시각을 남긴다.
        withdrawnAt: new Date().toISOString(),
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
      if (shouldMirror) {
        const base = readKpi2RowStatus(storeRef.current?.kpi2RowStatus, memberCode, dayKey, taskId).value || {
          status: KPI_STATUS.DRAFT,
          rejectReason: '',
          approver: '',
          approvedAt: null,
        };
        return mirrorKpi2RowApprovalToSupabase({
          memberCode,
          dayKey,
          taskId,
          kpi2RowStatus: persisted?.kpi2RowStatus?.[id] ?? { ...base, ...patch },
          updatedAt: persisted?.meta?.updatedAt ?? new Date().toISOString(),
        });
      }
      return undefined;
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
      if (readOnly) return undefined;
      return updateMonthly01(year, monthIndex, memberCode, {
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
      if (readOnly) return undefined;
      return updateMonthly01(year, monthIndex, memberCode, {
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
      if (readOnly) return undefined;
      return setKpi2RowStatus(memberCode, dayKey, taskId, {
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
      if (readOnly) return undefined;
      return setKpi2RowStatus(memberCode, dayKey, taskId, {
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

  /** 통보일·이의 기록 전용 저장 — 저장된 composite/grade 는 다시 계산하지 않는다 */
  const patchQuarterRecord = useCallback(
    (year, monthIndex, memberCode, patchFn) => {
      const yq = quarterKey(year, monthIndex);
      setStore((prev) => {
        const ensured = ensureQuarterMember(prev, yq, memberCode);
        const rec = ensured.quarters[yq][memberCode];
        const nextRec = patchFn(rec);
        if (nextRec === rec) return prev;
        return persist({
          ...ensured,
          quarters: {
            ...ensured.quarters,
            [yq]: { ...ensured.quarters[yq], [memberCode]: nextRec },
          },
        });
      });
    },
    [persist]
  );

  const setKpi3NoticeDate = useCallback(
    (year, monthIndex, memberCode, dateKey) => {
      if (readOnly) return { ok: false, reason: 'readonly' };
      if (dateKey && !isDateKey(dateKey)) return { ok: false, reason: 'invalid-date' };
      patchQuarterRecord(year, monthIndex, memberCode, (rec) => ({
        ...rec,
        quarter: { ...rec.quarter, noticedAt: dateKey || null },
      }));
      return { ok: true };
    },
    [readOnly, patchQuarterRecord]
  );

  /** 상위 승인 기록 저장/삭제 — input=null 이면 기록 삭제. composite/grade 는 건드리지 않는다 */
  const setKpi3ExecApproval = useCallback(
    (year, monthIndex, memberCode, input) => {
      if (readOnly) return { ok: false, reason: 'readonly' };
      if (input === null) {
        patchQuarterRecord(year, monthIndex, memberCode, (rec) => ({ ...rec, execApproval: null }));
        return { ok: true, cleared: true };
      }
      const record = createExecApproval(input);
      if (!record) return { ok: false, reason: 'invalid' };
      patchQuarterRecord(year, monthIndex, memberCode, (rec) => ({ ...rec, execApproval: record }));
      return { ok: true, record };
    },
    [readOnly, patchQuarterRecord]
  );

  const addKpi3Appeal = useCallback(
    (year, monthIndex, memberCode, input) => {
      if (readOnly) return { ok: false, reason: 'readonly' };
      const appeal = createAppeal(input);
      if (!appeal) return { ok: false, reason: 'invalid' };
      patchQuarterRecord(year, monthIndex, memberCode, (rec) => ({
        ...rec,
        appeals: [...normalizeAppeals(rec.appeals), appeal],
      }));
      return { ok: true, appeal };
    },
    [readOnly, patchQuarterRecord]
  );

  const updateKpi3Appeal = useCallback(
    (year, monthIndex, memberCode, appealId, patch) => {
      if (readOnly) return { ok: false, reason: 'readonly' };
      patchQuarterRecord(year, monthIndex, memberCode, (rec) => {
        const list = normalizeAppeals(rec.appeals);
        if (!list.some((a) => a.id === appealId)) return rec;
        return { ...rec, appeals: list.map((a) => (a.id === appealId ? applyAppealPatch(a, patch) : a)) };
      });
      return { ok: true };
    },
    [readOnly, patchQuarterRecord]
  );

  // 분기 마지막 달의 월 최종 레벨을 분기 레벨로 자동 반영한다 (수동 조정·확정된 분기는 건드리지 않음)
  useEffect(() => {
    if (readOnly) return;
    if (!syncQuarterLevelsFromCompetencyMonths(storeRef.current).changed) return;
    setStore((prev) => {
      const r = syncQuarterLevelsFromCompetencyMonths(prev);
      return r.changed ? persist(r.store) : prev;
    });
  }, [store.competencyMonths, readOnly, persist]);

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
    (year, monthIndex, memberCode, { practiceDefault = false } = {}) => {
      updateKpi3Quarter(year, monthIndex, memberCode, {
        locked: true,
        confirmedAt: new Date().toISOString(),
        // 증빙 미제출(사례 0건)로 확정되는 경우 실전 적용 1점 (정의서 v6 5점 척도)
        ...(practiceDefault ? { practice: PRACTICE_SCORE_NO_EVIDENCE, practiceDefaulted: true } : {}),
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
      console.log(`[TMS Debug] pullCompetencyManagerFromSelf start for ${ym} ${memberCode}`);
      setStore((prev) => {
        let next = ensureCompetencyMonthMember(prev, ym, memberCode);
        const rec = next.competencyMonths[ym][memberCode];
        const roleId = rec.roleId;
        console.log(`[TMS Debug] Current local rec:`, JSON.stringify(rec, null, 2));
        const manager = {
          intLevel: rec.self.intLevel,
          dims: { ...rec.self.dims },
          evidence: rec.self.evidence || '',
          dimEvidences: { ...(rec.self.dimEvidences || {}) },
          dimLinks: { ...(rec.self.dimLinks || {}) },
        };
        const updated = {
          ...rec,
          manager: normalizeCompetencyEvalSide(manager, roleId),
          updatedAt: new Date().toISOString(),
        };
        console.log(`[TMS Debug] Updated rec with manager:`, JSON.stringify(updated, null, 2));
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
      const roleId = mapMemberRoleToCompetency(findKpiMember(memberCode)?.role);
      const rec = store.competencyMonths?.[ym]?.[memberCode] || defaultCompetencyMonthRecord(memberCode);
      const selfSide = normalizeCompetencyEvalSide(rec.self, roleId);
      if (side === 'self' && !isValidCompetencyIntLevel(selfSide.intLevel)) {
        return { ok: false, reason: 'invalid-int-level' };
      }

      const updatedAt = new Date().toISOString();
      const updated =
        side === 'self'
          ? {
              ...rec,
              roleId,
              self: selfSide,
              selfLocked: true,
              selfUpdatedAt: updatedAt,
              updatedAt,
            }
          : {
              ...rec,
              roleId,
              manager: normalizeCompetencyEvalSide(rec.manager, roleId),
              managerLocked: true,
              managerUpdatedAt: updatedAt,
              updatedAt,
            };

      setStore((prev) => {
        let next = ensureCompetencyMonthMember(prev, ym, memberCode);
        next = {
          ...next,
          competencyMonths: {
            ...next.competencyMonths,
            [ym]: { ...next.competencyMonths[ym], [memberCode]: updated },
          },
        };
        return persist(next);
      });

      return { ok: true, record: updated };
    },
    [readOnly, persist, store]
  );

  const unlockCompetencyMonthSelf = useCallback(
    (year, monthIndex, memberCode) => {
      if (readOnly) return { ok: false, reason: 'read-only' };
      const ym = monthKey(year, monthIndex);
      const rec = store.competencyMonths?.[ym]?.[memberCode] || defaultCompetencyMonthRecord(memberCode);
      if (rec.managerLocked) {
        return { ok: false, reason: 'manager-locked' };
      }
      const roleId = rec.roleId ?? mapMemberRoleToCompetency(findKpiMember(memberCode)?.role);
      const updatedAt = new Date().toISOString();
      const updated = {
        ...rec,
        roleId,
        self: normalizeCompetencyEvalSide(rec.self, roleId),
        selfLocked: false,
        selfUpdatedAt: updatedAt,
        updatedAt,
      };

      setStore((prev) => {
        let next = ensureCompetencyMonthMember(prev, ym, memberCode);
        next = {
          ...next,
          competencyMonths: {
            ...next.competencyMonths,
            [ym]: { ...next.competencyMonths[ym], [memberCode]: updated },
          },
        };
        return persist(next);
      });

      return { ok: true, record: updated };
    },
    [readOnly, persist, store]
  );

  const unlockCompetencyMonthManager = useCallback(
    (year, monthIndex, memberCode) => {
      if (readOnly) return { ok: false, reason: 'read-only' };
      const ym = monthKey(year, monthIndex);
      // 클라우드 저장에 넘길 갱신 기록을 바로 돌려주기 위해 최신 저장 상태(ref) 기준으로 계산한다
      const base =
        storeRef.current?.competencyMonths?.[ym]?.[memberCode] || defaultCompetencyMonthRecord(memberCode);
      const roleId = base.roleId ?? mapMemberRoleToCompetency(findKpiMember(memberCode)?.role);
      const updatedAt = new Date().toISOString();
      const updated = {
        ...base,
        roleId,
        manager: normalizeCompetencyEvalSide(base.manager, roleId),
        managerLocked: false,
        managerUpdatedAt: updatedAt,
        updatedAt,
      };
      setStore((prev) => {
        const next = ensureCompetencyMonthMember(prev, ym, memberCode);
        return persist({
          ...next,
          competencyMonths: {
            ...next.competencyMonths,
            [ym]: { ...next.competencyMonths[ym], [memberCode]: updated },
          },
        });
      });
      return { ok: true, record: updated };
    },
    [readOnly, persist]
  );

  const rollupCompetencyToKpi3Quarter = useCallback(
    (year, monthIndex, memberCode) => {
      if (readOnly) return { ok: false, reason: 'readonly' };
      const level = rollupQuarterLevelFromMonths(store.competencyMonths, year, monthIndex, memberCode, COMPETENCY_USE_4060);
      if (level == null) return { ok: false, reason: 'no-confirmed-month' };
      updateKpi3Quarter(year, monthIndex, memberCode, { level, levelAuto: true });
      return { ok: true, level };
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
      // 변경 여부는 최신 저장 상태(ref)로 계산한다 — setState 업데이터는 즉시 실행되지 않을 수 있다
      const before = storeRef.current;
      const mergedStore = mergeCompetencyMonthsIntoKpiStore(before, remote);
      const changed =
        JSON.stringify(before?.competencyMonths) !== JSON.stringify(mergedStore.competencyMonths);
      setStore((prev) => persist(mergeCompetencyMonthsIntoKpiStore(prev, remote)));
      return { ok: true, remote, store: mergedStore, changed };
    } catch (e) {
      console.error(`[TMS Debug] pullCompetencyCloudSnapshot error:`, e);
      return { ok: false, reason: 'error', error: e };
    }
  }, [readOnly, persist]);

  const saveCompetencyMemberCloudSnapshot = useCallback(
    async (memberCode, yearMonth, recordOverride = null) => {
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
      const competencyMonth = recordOverride || getCompetencyMonth(year, monthIndex, memberCode);

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
          mergedStore = mergeCompetencyMonthsIntoKpiStore(prev, body.snapshot || body);
          return persist(mergedStore);
        });
        return { ok: true, remote: body.snapshot, store: mergedStore };
      } catch (e) {
        return { ok: false, reason: 'error', error: e };
      }
    },
    [readOnly, persist, getCompetencyMonth]
  );

  /** 분기 4요소 공유본 가져오기 — role: 'manager'(팀장) | 'member'(구성원) */
  const pullKpi3QuarterCloudSnapshot = useCallback(
    async (role = 'member') => {
      if (readOnly) return { ok: false, reason: 'read-only' };
      try {
        const remote = await fetchQuarterCloudSnapshot();
        let changedCount = 0;
        setStore((prev) => {
          const merged = mergeQuartersIntoKpiStore(prev, remote, role);
          changedCount = merged.changedCount;
          return changedCount > 0 ? persist(merged.store) : prev;
        });
        return { ok: true, changedCount, remote };
      } catch (e) {
        return { ok: false, reason: 'error', error: e };
      }
    },
    [readOnly, persist]
  );

  /** 분기 4요소 공유 저장 — 서버가 요청 경로(관리자 세션/본인 URL)로 작성 권한을 판단한다 */
  const saveKpi3QuarterCloudSnapshot = useCallback(
    async (memberCode, year, monthIndex) => {
      if (readOnly) return { ok: false, reason: 'read-only' };
      if (!isProductionEnvironment()) {
        return { ok: false, reason: 'dev-blocked', error: new Error('개발 환경에서는 공유 저장이 차단됩니다.') };
      }
      const yq = quarterKey(year, monthIndex);
      const rec = storeRef.current?.quarters?.[yq]?.[memberCode];
      if (!isQuarterRecordSaveable(rec)) return { ok: false, reason: 'empty' };
      try {
        const res = await fetch(KPI_QUARTER_SNAPSHOT_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ memberCode, yearQuarter: yq, quarter: pickSharedQuarterRecord(rec) }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body.message || body.error || `공유 분기 평가 저장 실패 (${res.status})`);
        }
        return { ok: true, role: body.role, applied: body.applied || [], skipped: body.skipped || [] };
      } catch (e) {
        return { ok: false, reason: 'error', error: e };
      }
    },
    [readOnly]
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
    setKpi3NoticeDate,
    setKpi3ExecApproval,
    addKpi3Appeal,
    updateKpi3Appeal,
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
    pullKpi3QuarterCloudSnapshot,
    saveKpi3QuarterCloudSnapshot,
  };
}
