import { KPI_STATUS } from './kpiStatuses.js';
import { TEAM_KPI_MEMBERS } from './kpiMembers.js';
import {
  defaultCompetencyDims,
  defaultCompetencyEval,
  mapMemberRoleToCompetency,
} from './competencyRubric.js';
import { computeCompetencyEval } from '../utils/competencyScore.js';
import {
  defaultDmDetail,
  defaultDmDetailForRole,
  defaultLeaderDetail,
  defaultPracticeDetail,
} from './kpi3Elements.js';

export const KPI_OPERATIONAL_STORAGE_KEY = 'tms-kpi-operational-v1';
export const KPI_OPERATIONAL_VERSION = 3;

export function monthKey(year, monthIndex) {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}

export function quarterKey(year, monthIndex) {
  const m = monthIndex + 1;
  const q = m <= 3 ? 1 : m <= 6 ? 2 : m <= 9 ? 3 : 4;
  return `${year}-${q}Q`;
}

const QUARTER_KEY_RE = /^(\d{4})-([1-4])Q$/;

/** YYYY-nQ 형식 검증 */
export function isValidQuarterKey(yq) {
  return QUARTER_KEY_RE.test(String(yq || ''));
}

/** 분기 키 → 해당 분기 3개월 YYYY-MM */
export function quarterMonthKeysFromYq(yq) {
  const match = QUARTER_KEY_RE.exec(String(yq || ''));
  if (!match) return [];
  const year = Number(match[1]);
  const q = Number(match[2]);
  const startMonth = (q - 1) * 3 + 1;
  return [0, 1, 2].map((i) => `${year}-${String(startMonth + i).padStart(2, '0')}`);
}

/** 같은 연도·월 기준 직전 분기 키 (예: 6월 → 2026-1Q) */
export function previousQuarterKey(year, monthIndex) {
  const q = Math.floor(monthIndex / 3) + 1;
  if (q === 1) return `${year - 1}-4Q`;
  return `${year}-${q - 1}Q`;
}

/** 직전 분기 마지막 달 monthIndex (0-based) */
export function previousQuarterLastMonthIndex(monthIndex) {
  const q = Math.floor(monthIndex / 3);
  if (q === 0) return 11;
  return (q - 1) * 3 + 2;
}

export function defaultMonthly01() {
  return {
    work: 0,
    improve: 0,
    leave: 0,
    available: 1,
    status: KPI_STATUS.DRAFT,
    submittedAt: null,
    approvedAt: null,
    approver: '',
    rejectReason: '',
    note: '',
  };
}

export function defaultQuarterRecord(memberCode) {
  const member = TEAM_KPI_MEMBERS.find((m) => m.code === memberCode);
  return {
    memos: [],
    quarter: {
      level: 0,
      dm: 0,
      leader: 0,
      practice: 0,
      composite: 0,
      grade: '',
      locked: false,
      confirmedAt: null,
      levelAuto: false,
    },
    dmDetail: defaultDmDetailForRole(member?.role),
    leaderDetail: defaultLeaderDetail(),
    practiceDetail: defaultPracticeDetail(),
  };
}

/** 월간·분기 역량 루브릭 레코드 공통 생성 */
export function defaultCompetencyEvalRecord(memberCode) {
  const member = TEAM_KPI_MEMBERS.find((m) => m.code === memberCode);
  const roleId = mapMemberRoleToCompetency(member?.role);
  const selfEval = defaultCompetencyEval();
  const mgrEval = defaultCompetencyEval();
  return {
    roleId,
    self: { ...selfEval, computed: computeCompetencyEval({ ...selfEval, roleId }) },
    manager: { ...mgrEval, computed: computeCompetencyEval({ ...mgrEval, roleId }) },
    selfLocked: false,
    managerLocked: false,
    selfUpdatedAt: null,
    managerUpdatedAt: null,
    updatedAt: null,
  };
}

export function defaultCompetencyMonthRecord(memberCode) {
  return defaultCompetencyEvalRecord(memberCode);
}

export function defaultCompetencyQuarterRecord(memberCode) {
  return defaultCompetencyEvalRecord(memberCode);
}

export function createEmptyKpiOperationalStore() {
  return {
    meta: { version: KPI_OPERATIONAL_VERSION, updatedAt: null },
    kpiWeekMemos: {},
    months: {},
    quarters: {},
    competencyMonths: {},
    competencyQuarters: {},
    kpi2RowStatus: {},
  };
}

export function ensureMonthMember(store, ym, memberCode) {
  const months = { ...store.months };
  const month = { ...(months[ym] || {}) };
  if (!month[memberCode]) {
    month[memberCode] = { monthly01: defaultMonthly01() };
  }
  months[ym] = month;
  return { ...store, months };
}

export function ensureQuarterMember(store, yq, memberCode) {
  const quarters = { ...store.quarters };
  const quarter = { ...(quarters[yq] || {}) };
  if (!quarter[memberCode]) {
    quarter[memberCode] = defaultQuarterRecord(memberCode);
  }
  quarters[yq] = quarter;
  return { ...store, quarters };
}

export function ensureCompetencyMonthMember(store, ym, memberCode) {
  const competencyMonths = { ...store.competencyMonths };
  const month = { ...(competencyMonths[ym] || {}) };
  if (!month[memberCode]) {
    month[memberCode] = defaultCompetencyMonthRecord(memberCode);
  }
  competencyMonths[ym] = month;
  return { ...store, competencyMonths };
}

export function ensureCompetencyQuarterMember(store, yq, memberCode) {
  const competencyQuarters = { ...store.competencyQuarters };
  const quarter = { ...(competencyQuarters[yq] || {}) };
  if (!quarter[memberCode]) {
    quarter[memberCode] = defaultCompetencyQuarterRecord(memberCode);
  }
  competencyQuarters[yq] = quarter;
  return { ...store, competencyQuarters };
}

export function normalizeKpiOperationalStore(raw) {
  const base = createEmptyKpiOperationalStore();
  if (!raw || typeof raw !== 'object') return base;
  const quarters = raw.quarters && typeof raw.quarters === 'object' ? JSON.parse(JSON.stringify(raw.quarters)) : {};
  Object.values(quarters).forEach((q) => {
    Object.values(q).forEach((rec) => {
      if (rec?.quarter && rec.quarter.levelAuto == null) rec.quarter.levelAuto = false;
      if (!rec.dmDetail) rec.dmDetail = defaultDmDetail();
      if (!rec.leaderDetail) rec.leaderDetail = defaultLeaderDetail();
      if (!rec.practiceDetail) rec.practiceDetail = defaultPracticeDetail();
      if (!rec.practiceDetail.cases) rec.practiceDetail.cases = [];
    });
  });
  return {
    meta: { ...base.meta, ...(raw.meta || {}), version: KPI_OPERATIONAL_VERSION },
    kpiWeekMemos: raw.kpiWeekMemos && typeof raw.kpiWeekMemos === 'object' ? { ...raw.kpiWeekMemos } : {},
    months: raw.months && typeof raw.months === 'object' ? JSON.parse(JSON.stringify(raw.months)) : {},
    quarters,
    competencyMonths:
      raw.competencyMonths && typeof raw.competencyMonths === 'object'
        ? JSON.parse(JSON.stringify(raw.competencyMonths))
        : {},
    competencyQuarters:
      raw.competencyQuarters && typeof raw.competencyQuarters === 'object'
        ? JSON.parse(JSON.stringify(raw.competencyQuarters))
        : {},
    kpi2RowStatus:
      raw.kpi2RowStatus && typeof raw.kpi2RowStatus === 'object' ? { ...raw.kpi2RowStatus } : {},
  };
}

/** @param {string} dayKey @param {string} taskId */
export function kpi2RowId(dayKey, taskId) {
  return `${dayKey}|${taskId}`;
}

export function listMemberCodes() {
  return TEAM_KPI_MEMBERS.map((m) => m.code);
}

export { defaultCompetencyDims, defaultCompetencyEval };
