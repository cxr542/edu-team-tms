import { computeMonthKpi2Summary } from './computeTeamKpi';
import { resolveKpi2Display } from './kpi2Display';
import { gradeKpi1, gradeKpi2, gradeKpi3, roundScoreToTenth } from './kpiGrades';
import { buildTeamIntegratedSummary } from './teamKpiAggregate';
import { TEAM_KPI_MEMBERS } from '../constants/kpiMembers';
import { monthKey } from '../constants/kpiOperationalStore';
import { COMPETENCY_USE_4060 } from '../constants/competencyConfig';
import { monthlyFinalScore } from './competencyScore';
import { buildTeamMonthlyReport, buildTeamQuarterReport } from './kpiReportData';

/**
 * 분기·연간 KPI 리포트 집계
 * - KPI1/KPI2: 월 값을 평균하지 않고 분자·분모를 합산해 다시 계산한다
 *   KPI1 = Σ(업무+생산향상+휴일 M/D) ÷ Σ가용 M/D, KPI2 = Σ계획시간 ÷ Σ실작업시간(공식=승인, 없으면 미리보기)
 * - KPI3(연간): 연말 분기(4Q)의 확정 종합 점수를 쓴다 (평균하지 않으며, 4Q가 확정 전이면 값이 없다)
 */

function round4(n) {
  return Math.round(n * 10000) / 10000;
}

export const QUARTER_NUMBERS = [1, 2, 3, 4];

export function monthIndexesOfQuarter(quarter) {
  const q = Math.min(4, Math.max(1, Number(quarter) || 1));
  const start = (q - 1) * 3;
  return [start, start + 1, start + 2];
}

export function quarterOfMonthIndex(monthIndex) {
  return Math.floor(monthIndex / 3) + 1;
}

/**
 * 월별 레벨(역량) 평가 리포트 — 구성원마다 한 행 (기록이 없으면 값은 null)
 * 월 최종 = 구성원 자체평가·팀장 평가 제안 점수의 결합(competencyConfig 기준)
 */
export function buildMonthlyCompetencyReport({ year, monthIndex, kpiOperational }) {
  const ym = monthKey(year, monthIndex);
  const rows = TEAM_KPI_MEMBERS.map((member) => {
    const rec = kpiOperational.competencyMonths?.[ym]?.[member.code];
    const selfProposed = rec?.self?.computed?.proposed ?? null;
    const mgrProposed = rec?.manager?.computed?.proposed ?? null;
    const monthlyFinal = rec ? monthlyFinalScore(selfProposed, mgrProposed, COMPETENCY_USE_4060) : null;
    return {
      member,
      selfLevel: rec?.self?.intLevel > 0 ? rec.self.intLevel : null,
      managerLevel: rec?.manager?.intLevel > 0 ? rec.manager.intLevel : null,
      selfProposed,
      mgrProposed,
      monthlyFinal: monthlyFinal > 0 ? monthlyFinal : null,
      selfLocked: Boolean(rec?.selfLocked),
      managerLocked: Boolean(rec?.managerLocked),
    };
  });
  const finals = rows.map((r) => r.monthlyFinal).filter((v) => v != null && v > 0);
  const teamAverage = finals.length ? finals.reduce((a, b) => a + b, 0) / finals.length : null;
  return {
    monthIndex,
    ym,
    rows,
    teamAverage: teamAverage == null ? null : roundScoreToTenth(teamAverage),
    submittedCount: rows.filter((r) => r.selfLocked).length,
    confirmedCount: rows.filter((r) => r.managerLocked).length,
  };
}

/** 월별 리포트 묶음 — 월마다 구성원 행과 팀 통합 요약을 함께 만든다 */
export function buildMonthReports({ year, monthIndexes, ...ctx }) {
  return monthIndexes.map((monthIndex) => {
    const rows = buildTeamMonthlyReport({ year, monthIndex, ...ctx });
    return { monthIndex, rows, team: buildTeamIntegratedSummary(rows, []) };
  });
}

/** 여러 달의 구성원 행을 구성원별로 합산 (월간 행과 같은 모양으로 반환) */
export function aggregateMemberRows(monthReports) {
  const byMember = new Map();
  monthReports.forEach(({ rows }) => {
    rows.forEach((row) => {
      const code = row.member.code;
      if (!byMember.has(code)) byMember.set(code, { member: row.member, parts: [] });
      byMember.get(code).parts.push(row);
    });
  });

  return [...byMember.values()].map(({ member, parts }) => {
    const sum = (key) => round4(parts.reduce((s, r) => s + (Number(r.kpi1?.[key]) || 0), 0));
    const work = sum('work');
    const improve = sum('improve');
    const leave = sum('leave');
    const available = sum('available');
    const utilization = available > 0 ? round4(((work + improve + leave) / available) * 100) : null;

    const rows02 = parts.flatMap((r) => r.rows02 || []);
    const kpi2 = computeMonthKpi2Summary(rows02, true);
    const kpi2Preview = computeMonthKpi2Summary(rows02, false);
    const kpi2Disp = resolveKpi2Display(kpi2, kpi2Preview);

    return {
      member,
      kpi1: { work, improve, leave, available, utilization },
      rows02,
      kpi2,
      kpi2Preview,
      kpi2DisplayPct: kpi2Disp.displayPct,
      kpi2UsesPreview: kpi2Disp.usesPreview,
      grade1: gradeKpi1(utilization),
      grade2: gradeKpi2(kpi2Disp.displayPct),
      monthCount: parts.length,
    };
  });
}

/** 분기 리포트: 월별 추이 + 구성원별 합산 + 팀 통합(KPI3 포함) */
export function buildQuarterView({ year, quarter, kpiOperational, ...ctx }) {
  const monthIndexes = monthIndexesOfQuarter(quarter);
  const months = buildMonthReports({ year, monthIndexes, kpiOperational, ...ctx });
  const memberRows = aggregateMemberRows(months);
  const quarterly = buildTeamQuarterReport({ year, monthIndex: monthIndexes[0], kpiOperational });
  const team = buildTeamIntegratedSummary(memberRows, quarterly);
  const competencyMonths = monthIndexes.map((monthIndex) =>
    buildMonthlyCompetencyReport({ year, monthIndex, kpiOperational })
  );
  return { quarter, monthIndexes, months, memberRows, quarterly, team, competencyMonths };
}

/** 연간 리포트: 12개월 추이 + 분기별 KPI3 + 구성원별 연간 요약 */
export function buildAnnualView({ year, kpiOperational, ...ctx }) {
  const monthIndexes = Array.from({ length: 12 }, (_, i) => i);
  const months = buildMonthReports({ year, monthIndexes, kpiOperational, ...ctx });
  const memberRows = aggregateMemberRows(months);
  const team = buildTeamIntegratedSummary(memberRows, []);

  // 분기별 구성원 합산 (월 3개씩)
  const quarterRows = QUARTER_NUMBERS.map((q) => {
    const rows = aggregateMemberRows(months.filter((m) => quarterOfMonthIndex(m.monthIndex) === q));
    return { quarter: q, memberRows: rows, team: buildTeamIntegratedSummary(rows, []) };
  });

  const quarters = QUARTER_NUMBERS.map((q) => {
    const quarterly = buildTeamQuarterReport({
      year,
      monthIndex: monthIndexesOfQuarter(q)[0],
      kpiOperational,
    });
    const teamQ = buildTeamIntegratedSummary([], quarterly);
    const confirmedCount = quarterly.filter((r) => r.locked && Number(r.quarter?.composite) > 0).length;
    return {
      quarter: q,
      quarterly,
      composite: teamQ.kpi3.composite,
      grade3: teamQ.grade3,
      confirmedCount,
      teamLevel: teamQ.kpi3.level > 0 ? teamQ.kpi3.level : null,
    };
  });

  const memberKpi3 = memberRows.map((row) => {
    const perQuarter = quarters.map(({ quarter, quarterly }) => {
      const rec = quarterly.find((r) => r.member.code === row.member.code);
      const composite = Number(rec?.quarter?.composite) || 0;
      const level = Number(rec?.breakdown?.level ?? rec?.quarter?.level) || 0;
      return {
        quarter,
        composite: composite > 0 ? composite : null,
        level: level > 0 ? level : null,
        locked: Boolean(rec?.locked),
      };
    });
    const confirmed = perQuarter.filter((p) => p.locked && p.composite != null);
    // 연간 = 4Q 확정 종합 (확정 전이면 없음 · 앞선 분기로 대체하지 않는다)
    const q4 = perQuarter.find((p) => p.quarter === 4);
    const annual = q4 && q4.locked && q4.composite != null ? q4.composite : null;
    return {
      member: row.member,
      perQuarter,
      confirmedCount: confirmed.length,
      annualComposite: annual == null ? null : roundScoreToTenth(annual),
      annualLevel: annual == null ? null : q4.level,
      grade3: gradeKpi3(annual),
    };
  });

  // 팀 연간 = 4Q 팀 종합 (4Q에 확정된 구성원이 한 명도 없으면 없음)
  const q4Team = quarters.find((q) => q.quarter === 4);
  const teamAnnualRaw = q4Team && q4Team.confirmedCount > 0 && q4Team.composite > 0 ? q4Team.composite : null;
  const teamKpi3 = {
    composite: teamAnnualRaw == null ? null : roundScoreToTenth(teamAnnualRaw),
    grade3: gradeKpi3(teamAnnualRaw),
    memberCount: q4Team ? q4Team.confirmedCount : 0,
  };

  return { months, memberRows, team, quarters, quarterRows, memberKpi3, teamKpi3 };
}
