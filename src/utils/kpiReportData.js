import { TEAM_KPI_MEMBERS } from '../constants/kpiMembers';
import { KPI_STATUS } from '../constants/kpiStatuses';
import {
  monthKey,
  quarterKey,
  KPI_OPERATIONAL_STORAGE_KEY,
  normalizeKpiOperationalStore,
  readKpi2RowStatus,
} from '../constants/kpiOperationalStore';
import { loadImproveProjects } from '../constants/improveProjects';
import { COMPETENCY_USE_4060 } from '../constants/competencyConfig';
import { monthlyFinalScore } from './competencyScore';
import { buildKpi02EffectRows, computeTeamKpi } from './computeTeamKpi';
import { resolveKpi2Display } from './kpi2Display';
import { gradeKpi1, gradeKpi2, gradeKpi3 } from './kpiGrades';
import { KPI1_NAME, KPI2_NAME } from '../constants/kpiDisplayNames';
import {
  loadMemberJournalsFromStorage,
  migrateKpiOperationalStoreReadonly,
} from './kpi2LegacyMigration';

export function buildTeamMonthlyReport({
  year,
  monthIndex,
  getMemberDays,
  getMemberKpiWeekMemos,
  kpiOperational,
  improveProjects,
}) {
  const ym = monthKey(year, monthIndex);
  const kpi2RowStatus = kpiOperational.kpi2RowStatus || {};

  return TEAM_KPI_MEMBERS.map((member) => {
    const memberDays = getMemberDays(member.code);
    const memos = getMemberKpiWeekMemos
      ? getMemberKpiWeekMemos(member.code)
      : kpiOperational.kpiWeekMemos || {};
    const monthly01 = kpiOperational.months?.[ym]?.[member.code]?.monthly01;
    const metrics = computeTeamKpi({
      year,
      monthIndex,
      days: memberDays,
      kpiWeekMemos: memos,
      improveProjects,
      memberCode: member.code,
      kpi2RowStatus,
      monthly01,
    });
    const status = monthly01?.status || KPI_STATUS.DRAFT;
    const kpi2Disp = resolveKpi2Display(metrics.kpi2, metrics.kpi2Preview);

    return {
      member,
      monthly01,
      rows01c: metrics.rows01c,
      rows02: metrics.rows02Effect,
      kpi1: metrics.kpi1,
      kpi2: metrics.kpi2,
      kpi2Preview: metrics.kpi2Preview,
      kpi2DisplayPct: kpi2Disp.displayPct,
      kpi2UsesPreview: kpi2Disp.usesPreview,
      grade1: gradeKpi1(metrics.kpi1.utilization),
      grade2: gradeKpi2(kpi2Disp.displayPct),
      status,
    };
  });
}

export function buildTeamQuarterReport({ year, monthIndex, kpiOperational }) {
  const yq = quarterKey(year, monthIndex);
  return TEAM_KPI_MEMBERS.map((member) => {
    const rec = kpiOperational.quarters?.[yq]?.[member.code];
    const q = rec?.quarter || {};
    return {
      member,
      memos: rec?.memos || [],
      quarter: q,
      grade3: gradeKpi3(q.composite),
      locked: Boolean(q.locked),
      breakdown: {
        level: q.level,
        dm: q.dm,
        leader: q.leader,
        practice: q.practice,
        levelAuto: Boolean(q.levelAuto),
      },
    };
  });
}

export function buildCompetencyMonthlyRows({ year, monthIndex, kpiOperational }) {
  const ym = monthKey(year, monthIndex);
  return TEAM_KPI_MEMBERS.map((member) => {
    const rec = kpiOperational.competencyMonths?.[ym]?.[member.code];
    if (!rec) return null;
    const finalScore = monthlyFinalScore(
      rec.self?.computed?.proposed,
      rec.manager?.computed?.proposed,
      COMPETENCY_USE_4060
    );
    return {
      member,
      ym,
      roleId: rec.roleId,
      selfProposed: rec.self?.computed?.proposed ?? null,
      mgrProposed: rec.manager?.computed?.proposed ?? null,
      monthlyFinal: finalScore,
      selfLocked: rec.selfLocked,
      managerLocked: rec.managerLocked,
    };
  }).filter(Boolean);
}

export function listPendingApprovals({
  year,
  monthIndex,
  getMemberDays,
  kpiOperational,
  improveProjects,
}) {
  const ym = monthKey(year, monthIndex);
  const items = [];
  const memberJournals = Object.fromEntries(
    TEAM_KPI_MEMBERS.map((member) => [member.code, { days: getMemberDays(member.code) }])
  );
  const migratedOperational = migrateKpiOperationalStoreReadonly(kpiOperational, memberJournals);
  const kpi2RowStatus = migratedOperational.kpi2RowStatus || {};

  TEAM_KPI_MEMBERS.forEach((member) => {
    const m01 = migratedOperational.months?.[ym]?.[member.code]?.monthly01;
    if (m01?.status === KPI_STATUS.SUBMITTED) {
      items.push({
        type: 'KPI1',
        member,
        label: `${member.displayName} · ${monthIndex + 1}월 ${KPI1_NAME} · 승인 요청`,
        submittedAt: m01.submittedAt,
      });
    }

    const memberDays = getMemberDays(member.code);
    const rows02 = buildKpi02EffectRows(
      year,
      monthIndex,
      memberDays,
      improveProjects,
      member.code,
      kpi2RowStatus
    );
    rows02.forEach((row) => {
      if (row.상태 === KPI_STATUS.SUBMITTED) {
        const rowMeta = readKpi2RowStatus(kpi2RowStatus, member.code, row.dayKey, row.taskId).value;
        items.push({
          type: 'KPI2',
          member,
          dayKey: row.dayKey,
          taskId: row.taskId,
          label: `${member.displayName} · ${KPI2_NAME} · ${row.업무명} · 승인 요청`,
          row,
          submittedAt: rowMeta?.submittedAt,
        });
      }
    });
  });

  return items;
}

export function readJournalPeriodFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const now = new Date();
  const y = parseInt(params.get('year'), 10);
  const m = parseInt(params.get('month'), 10);
  return {
    year: Number.isFinite(y) ? y : now.getFullYear(),
    monthIndex: Number.isFinite(m) && m >= 1 && m <= 12 ? m - 1 : now.getMonth(),
  };
}

function loadJournalMemberDaysFromStorage() {
  const memberJournals = loadMemberJournalsFromStorage();
  return memberJournals;
}

function loadKpiOperationalFromStorage() {
  try {
    const raw = localStorage.getItem(KPI_OPERATIONAL_STORAGE_KEY);
    if (!raw) return normalizeKpiOperationalStore({});
    const parsed = normalizeKpiOperationalStore(JSON.parse(raw));
    return migrateKpiOperationalStoreReadonly(parsed, loadMemberJournalsFromStorage());
  } catch {
    return normalizeKpiOperationalStore({});
  }
}

/** 팀장 알림 뱃지 — JournalProvider 밖에서 localStorage 기준 승인 대기 집계 */
export function listPendingApprovalsFromBrowser(period = readJournalPeriodFromUrl()) {
  const memberJournals = loadJournalMemberDaysFromStorage();
  const kpiOperational = loadKpiOperationalFromStorage();
  const improveProjects = loadImproveProjects();
  const getMemberDays = (code) => memberJournals?.[code]?.days || {};
  return listPendingApprovals({
    year: period.year,
    monthIndex: period.monthIndex,
    getMemberDays,
    kpiOperational,
    improveProjects,
  });
}

export function summarizePendingApprovals(items = []) {
  const kpi1 = items.filter((item) => item.type === 'KPI1').length;
  const kpi2 = items.filter((item) => item.type === 'KPI2').length;
  return { total: items.length, kpi1, kpi2 };
}
