import { KPI1_NAME, KPI2_NAME, KPI3_NAME } from '../constants/kpiDisplayNames';
import { formatKpiMemberLabel } from '../constants/kpiMembers';
import { buildKpi3Coaching } from './kpi3Coaching';

const KPI1_TIPS = {
  strong: '팀 M/M이 가용 대비 충분히 채워져 본부 가동률 기준에 근접합니다.',
  weak: '팀 총 가용 M/M 대비 업무·생산향상·휴일 합산이 낮아 유휴가 큽니다.',
  action: '구성원별 일지·월 확정 M/M을 맞추고, 팀 통합 가동률 96%(B) 이상을 목표로 주간 M/M를 채우세요.',
};

const KPI2_TIPS = {
  strong: '승인된 효과 건 기준 팀 생산성이 목표 구간에 있습니다.',
  weak: '계획 대비 실작업 합산이 낮아 팀 생산성이 부진합니다.',
  action: 'KPI2 효과 건 제출·팀장 승인을 늘리고, 계획시간 대비 실적을 분기 말까지 끌어올리세요.',
};

function round2(n) {
  return Math.round(n * 100) / 100;
}

function formatPct(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return `${Number(n).toFixed(1)}%`;
}

function lowestMemberRow(monthly, pick, label) {
  let min = null;
  let row = null;
  monthly.forEach((r) => {
    const v = pick(r);
    if (v == null || Number.isNaN(v)) return;
    if (min == null || v < min) {
      min = v;
      row = r;
    }
  });
  if (!row) return null;
  return { member: formatKpiMemberLabel(row.member), value: label(min) };
}

/**
 * @param {ReturnType<import('./teamKpiAggregate').buildTeamIntegratedSummary>} team
 * @param {ReturnType<import('./kpiReportData').buildTeamMonthlyReport>} monthly
 * @param {object} ctx — yq
 */
export function buildTeamKpiCoaching(team, monthly, quarterly, ctx = {}) {
  const strengths = [];
  const weaknesses = [];
  const recommendations = [];

  const kpi1Pct = team.kpi1?.utilization;
  const kpi2Pct = team.kpi2?.displayPct ?? team.kpi2?.productivityPct;

  if (kpi1Pct != null) {
    if (kpi1Pct >= 96) {
      strengths.push({
        label: KPI1_NAME,
        score: formatPct(kpi1Pct),
        text: `${KPI1_NAME} 팀 통합 ${formatPct(kpi1Pct)} (등급 ${team.grade1}) — ${KPI1_TIPS.strong}`,
      });
    } else if (kpi1Pct < 90) {
      weaknesses.push({
        label: KPI1_NAME,
        score: formatPct(kpi1Pct),
        text: `${KPI1_NAME} 팀 통합 ${formatPct(kpi1Pct)} (등급 ${team.grade1}) — ${KPI1_TIPS.weak}`,
      });
    }
  }

  if (kpi2Pct != null) {
    if (kpi2Pct >= 130) {
      strengths.push({
        label: KPI2_NAME,
        score: formatPct(kpi2Pct),
        text: `${KPI2_NAME} 팀 통합 ${formatPct(kpi2Pct)} (등급 ${team.grade2}) — ${KPI2_TIPS.strong}`,
      });
    } else if (kpi2Pct < 110) {
      weaknesses.push({
        label: KPI2_NAME,
        score: formatPct(kpi2Pct),
        text: `${KPI2_NAME} 팀 통합 ${formatPct(kpi2Pct)} (등급 ${team.grade2}) — ${KPI2_TIPS.weak}`,
      });
    }
  }

  const kpi3Quarter = {
    level: team.kpi3.level,
    dm: team.kpi3.dm,
    leader: team.kpi3.leader,
    practice: team.kpi3.practice,
    composite: team.kpi3.composite ?? 0,
  };

  const kpi3Report = buildKpi3Coaching(kpi3Quarter, {
    yq: ctx.yq,
    memberLabel: '교육팀(통합)',
  });

  kpi3Report.strengths.forEach((s) => {
    strengths.push({
      ...s,
      label: `${KPI3_NAME} · ${s.label}`,
    });
  });
  kpi3Report.weaknesses.forEach((w) => {
    weaknesses.push({
      ...w,
      label: `${KPI3_NAME} · ${w.label}`,
    });
  });

  const lowKpi1 = lowestMemberRow(monthly, (r) => r.kpi1?.utilization, formatPct);
  const lowKpi2 = lowestMemberRow(monthly, (r) => r.kpi2DisplayPct, formatPct);
  const lowKpi3 = lowestMemberRow(
    quarterly,
    (r) => (r.quarter?.composite > 0 ? r.quarter.composite : null),
    (n) => String(n)
  );

  recommendations.push({
    type: 'headline',
    text: `**교육팀(통합)** ${ctx.yq || ''} — ${KPI1_NAME} ${formatPct(kpi1Pct)}(등급 ${team.grade1}) · ${KPI2_NAME} ${formatPct(kpi2Pct)}(등급 ${team.grade2}) · ${KPI3_NAME} ${team.kpi3.composite ?? '—'}점(등급 ${team.grade3}).`,
  });

  if (kpi3Report.headline) {
    recommendations.push({ type: 'note', text: kpi3Report.headline.replace(/^교육팀\(통합\) · /, '') });
  }

  kpi3Report.recommendations
    .filter((r) => r.type !== 'headline')
    .forEach((r) => recommendations.push(r));

  if (kpi1Pct != null && kpi1Pct < 96) {
    recommendations.push({
      type: 'action',
      priority: 10,
      label: KPI1_NAME,
      text: `**${KPI1_NAME}**: ${KPI1_TIPS.action}${lowKpi1 ? ` (상대 저조: ${lowKpi1.member} ${lowKpi1.value})` : ''}`,
    });
  }

  if (kpi2Pct != null && kpi2Pct < 130) {
    recommendations.push({
      type: 'action',
      priority: 11,
      label: KPI2_NAME,
      text: `**${KPI2_NAME}**: ${KPI2_TIPS.action}${lowKpi2 ? ` (상대 저조: ${lowKpi2.member} ${lowKpi2.value})` : ''}`,
    });
  }

  if (lowKpi3 && team.kpi3.composite != null && lowKpi3.value !== '—') {
    recommendations.push({
      type: 'note',
      text: `분기 ${KPI3_NAME} 상대 저조 구성원: **${lowKpi3.member}** (종합 ${lowKpi3.value}점) — 코칭·4요소 보완 우선 검토.`,
    });
  }

  const ready =
    (kpi1Pct != null && kpi1Pct > 0) ||
    (kpi2Pct != null && kpi2Pct > 0) ||
    kpi3Report.ready;

  return {
    ready,
    strengths,
    weaknesses,
    recommendations,
    headline: recommendations.find((r) => r.type === 'headline')?.text ?? '',
    kpi3: kpi3Report,
    team,
  };
}
