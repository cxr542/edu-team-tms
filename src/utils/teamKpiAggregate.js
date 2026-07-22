import { KPI3_WEIGHTS } from '../constants/kpiRules';
import { KPI_STATUS } from '../constants/kpiStatuses';
import { computeMonthKpi2Summary } from './computeTeamKpi';
import { resolveKpi2Display } from './kpi2Display';
import { computeKpi3Composite, gradeKpi1, gradeKpi2, gradeKpi3 } from './kpiGrades';

function round2(n) {
  return Math.round(n * 100) / 100;
}

function round4(n) {
  return Math.round(n * 10000) / 10000;
}

function averagePositive(nums) {
  const vals = nums.filter((n) => n != null && !Number.isNaN(n) && n > 0);
  if (!vals.length) return null;
  return round2(vals.reduce((a, b) => a + b, 0) / vals.length);
}

/**
 * KPI 정의서 기준 팀 통합 지표
 * - KPI1: (팀 총 업무+생산향상+휴일 M/M ÷ 팀 총 가용 M/M)×100
 * - KPI2: (팀 계획시간 합 ÷ 팀 실작업 합)×100 (공식=승인 · 표시는 일지 효과 미리보기 포함)
 * - KPI3: 4요소 구성원 평균 후 가중 합산 (레벨 축 = 개인 레벨 산술평균)
 *
 * @param {ReturnType<import('./kpiReportData').buildTeamMonthlyReport>} monthly
 * @param {ReturnType<import('./kpiReportData').buildTeamQuarterReport>} quarterly
 */
export function buildTeamIntegratedSummary(monthly, quarterly) {
  let work = 0;
  let improve = 0;
  let leave = 0;
  let available = 0;

  monthly.forEach((row) => {
    work += Number(row.kpi1?.work) || 0;
    improve += Number(row.kpi1?.improve) || 0;
    leave += Number(row.kpi1?.leave) || 0;
    available += Number(row.kpi1?.available) || 0;
  });

  work = round4(work);
  improve = round4(improve);
  leave = round4(leave);
  available = round4(available);
  const totalMm = round4(work + improve + leave);
  const kpi1Util =
    available > 0 ? round4((totalMm / available) * 100) : null;

  const allEffectRows = monthly.flatMap((r) => r.rows02 || []);
  const kpi2Official = computeMonthKpi2Summary(allEffectRows, true);
  const kpi2PreviewRollup = computeMonthKpi2Summary(allEffectRows, false);
  const kpi2Display = resolveKpi2Display(kpi2Official, kpi2PreviewRollup);

  const level = averagePositive(quarterly.map((r) => Number(r.quarter?.level) || 0));
  const dm = averagePositive(quarterly.map((r) => Number(r.breakdown?.dm ?? r.quarter?.dm) || 0));
  const leader = averagePositive(
    quarterly.map((r) => Number(r.breakdown?.leader ?? r.quarter?.leader) || 0)
  );
  const practice = averagePositive(
    quarterly.map((r) => Number(r.breakdown?.practice ?? r.quarter?.practice) || 0)
  );

  const kpi3Elements = {
    level: level ?? 0,
    dm: dm ?? 0,
    leader: leader ?? 0,
    practice: practice ?? 0,
  };
  const kpi3Composite = computeKpi3Composite(kpi3Elements);

  const submittedCount = monthly.filter(
    (r) => r.status === KPI_STATUS.SUBMITTED || r.status === KPI_STATUS.APPROVED
  ).length;

  return {
    memberCount: monthly.length,
    kpi1: {
      work,
      improve,
      leave,
      available,
      totalMm,
      utilization: kpi1Util,
      formula: '(팀 총 업무+생산향상+휴일 M/M ÷ 팀 총 가용 M/M)×100',
    },
    kpi2: {
      ...kpi2Official,
      preview: kpi2PreviewRollup,
      productivityPct: kpi2Official.productivityPct,
      displayPct: kpi2Display.displayPct,
      usesPreview: kpi2Display.usesPreview,
      formula: kpi2Display.usesPreview
        ? '(팀 계획/실적 합산 · 일지 효과 건 기준 · 승인 전)'
        : '(팀 계획시간 합 ÷ 팀 실작업시간 합)×100 · 승인 효과 건만',
    },
    kpi3: {
      ...kpi3Elements,
      composite: kpi3Composite > 0 ? kpi3Composite : null,
      formula: `(레벨×${Math.round(KPI3_WEIGHTS.level * 100)}%) + (다면×${Math.round(KPI3_WEIGHTS.dm * 100)}%) + (리더×${Math.round(KPI3_WEIGHTS.leader * 100)}%) + (실전×${Math.round(KPI3_WEIGHTS.practice * 100)}%) · 요소는 구성원 평균`,
    },
    grade1: gradeKpi1(kpi1Util),
    grade2: gradeKpi2(kpi2Display.displayPct),
    grade3: gradeKpi3(kpi3Composite),
    submittedCount,
  };
}

/** @deprecated 구성원 지표 단순 평균 — 리포트·화면은 buildTeamIntegratedSummary 사용 */
export function buildTeamKpiAggregate(monthly, quarterly) {
  const integrated = buildTeamIntegratedSummary(monthly, quarterly);
  return {
    memberCount: integrated.memberCount,
    kpi1UtilAvg: integrated.kpi1.utilization,
    kpi2PctAvg: integrated.kpi2.displayPct,
    kpi3CompositeAvg: integrated.kpi3.composite,
    grade1: integrated.grade1,
    grade2: integrated.grade2,
    grade3: integrated.grade3,
    submittedCount: integrated.submittedCount,
    kpi2ApprovedTotal: integrated.kpi2.submittedCount,
    integrated,
  };
}
