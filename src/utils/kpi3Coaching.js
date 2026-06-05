import { KPI3_ELEMENTS } from '../constants/kpi3Elements';
import { getKpi3HqTargetForYq } from '../constants/kpi3HeadquartersGoals';
import { KPI3_WEIGHTS } from '../constants/kpiRules';
import { computeKpi3Composite, gradeKpi3 } from './kpiGrades';

const ELEMENT_TIPS = {
  level: {
    strong: '월간 역량 루브릭·5차원 충족이 안정적이며, 팀장 확정 레벨이 목표 구간에 있습니다.',
    weak: '월간 자체평가·팀장 평가에서 정수 레벨과 차원 충족을 분기 말까지 끌어올려야 합니다.',
    action: '미충족 차원 코칭·증빙 보강 후 「역량 평가에서 레벨 가져오기」로 분기 반영하세요.',
  },
  dm: {
    strong: '강의·운영 만족도가 균형 있게 확보되었거나, N 기준을 충족한 상태입니다.',
    weak: '유효 응답 N·만족도 평균이 부족해 다면 축이 종합을 끌어내릴 수 있습니다.',
    action: '강의 N≥5·운영 N≥3을 맞추고, N 미달 시 전분기·운영 100% 대체 규칙을 점검하세요.',
  },
  leader: {
    strong: '팀원 자체평가와 팀장 평가가 KPI1·2 달성과 정합되게 반영되었습니다.',
    weak: '가동·생산 KPI 등급 대비 리더 평가(40:60)가 낮아 개선 여지가 큽니다.',
    action: '분기 KPI 달성 근거를 정리하고, 팀장 평가·본부 승인(L4↑) 절차를 맞추세요.',
  },
  practice: {
    strong: '실전 적용 사례가 증빙·팀장 인정으로 분기 척도에 잘 반영되었습니다.',
    weak: '인정된 실전 사례 건수가 적어 실전 축 점수가 제한됩니다.',
    action: '5차원과 연계된 분기 사례를 추가 제출하고, 팀장 인정(3건↑=5점)을 목표로 하세요.',
  },
};

function round2(n) {
  return Math.round(n * 100) / 100;
}

function hasScores(quarter) {
  return KPI3_ELEMENTS.some((el) => (Number(quarter[el.key]) || 0) > 0);
}

/**
 * @param {object} quarter
 * @param {object} [ctx]
 * @param {string} [ctx.yq]
 * @param {string} [ctx.memberLabel]
 */
export function buildKpi3Coaching(quarter, ctx = {}) {
  const composite =
    (quarter?.composite > 0 ? quarter.composite : null) ?? computeKpi3Composite(quarter || {}) ?? 0;

  if (!hasScores(quarter)) {
    return {
      ready: false,
      headline: '4요소 점수가 입력되면 강점·보완·본부 목표 달성 제안을 표시합니다.',
      strengths: [],
      weaknesses: [],
      recommendations: [],
      hqTarget: null,
    };
  }

  const grade = gradeKpi3(composite);
  const hqTarget = getKpi3HqTargetForYq(ctx.yq);
  const hqMin = hqTarget?.minScore ?? null;
  const gap = hqMin != null ? round2(Math.max(0, hqMin - composite)) : 0;
  const hqMet = hqMin != null && composite >= hqMin;

  const items = KPI3_ELEMENTS.map((el) => {
    const score = Number(quarter[el.key]) || 0;
    const weight = KPI3_WEIGHTS[el.key];
    return {
      key: el.key,
      label: el.label,
      weightPct: el.weightPct,
      score,
      weight,
      contribution: round2(score * weight),
      headroom: Math.max(0, 5 - score),
    };
  });

  const active = items.filter((i) => i.score > 0);
  const byScoreDesc = [...active].sort((a, b) => b.score - a.score);
  const byScoreAsc = [...active].sort((a, b) => a.score - b.score);
  const elementBenchmark = hqMin ?? 3.5;

  const strengths = [];
  active.forEach((item) => {
    if (hqMin != null && item.score >= hqMin) {
      strengths.push({
        label: item.label,
        score: item.score,
        text: `${item.label} ${item.score}점 — 본부 분기 목표(${hqMin}점) 이상 구간입니다. ${ELEMENT_TIPS[item.key].strong}`,
      });
    } else if (item.score >= 4.0) {
      strengths.push({
        label: item.label,
        score: item.score,
        text: `${item.label} ${item.score}점 — ${ELEMENT_TIPS[item.key].strong}`,
      });
    }
  });
  if (strengths.length < 2 && byScoreDesc.length) {
    byScoreDesc.slice(0, 2).forEach((item) => {
      if (strengths.some((s) => s.label === item.label)) return;
      if (item.score >= elementBenchmark) {
        strengths.push({
          label: item.label,
          score: item.score,
          text: `${item.label} ${item.score}점 — 상대적으로 양호한 축입니다. ${ELEMENT_TIPS[item.key].strong}`,
        });
      }
    });
  }

  const weaknesses = [];
  active.forEach((item) => {
    if (hqMin != null && item.score < hqMin) {
      weaknesses.push({
        label: item.label,
        score: item.score,
        text: `${item.label} ${item.score}점 — 본부 목표(${hqMin}점) 미만입니다. ${ELEMENT_TIPS[item.key].weak}`,
      });
    } else if (item.score < 3.5) {
      weaknesses.push({
        label: item.label,
        score: item.score,
        text: `${item.label} ${item.score}점 — ${ELEMENT_TIPS[item.key].weak}`,
      });
    }
  });
  if (weaknesses.length < 1 && byScoreAsc.length) {
    const lowest = byScoreAsc[0];
    if (lowest && !weaknesses.some((w) => w.label === lowest.label)) {
      weaknesses.push({
        label: lowest.label,
        score: lowest.score,
        text: `${lowest.label} ${lowest.score}점 — 4요소 중 상대적으로 낮습니다. ${ELEMENT_TIPS[lowest.key].weak}`,
      });
    }
  }

  const recommendations = [];
  const prefix = ctx.memberLabel ? `${ctx.memberLabel} · ` : '';

  if (!hqTarget || hqTarget.minScore == null) {
    recommendations.push({
      type: 'headline',
      text: `${prefix}${ctx.yq || '1Q'} — **${hqTarget?.phase || '베이스라인'}**. ${hqTarget?.meaning || '참고치 수집·4요소 입력 정합성을 우선하세요.'} (현재 종합 ${composite}점, 결과 등급 ${grade})`,
    });
    recommendations.push({
      type: 'note',
      text: '분기 말 본부 목표 점수(2Q 3.2·3Q 3.8·4Q 4.0) 대비를 위해 4요소·증빙을 미리 쌓아 두세요.',
    });
  } else if (hqMet) {
    recommendations.push({
      type: 'headline',
      text: `${prefix}${ctx.yq} **본부 분기 목표 ${hqTarget.minScore}점 이상 달성** (현재 종합 ${composite}점 · 결과 등급 ${grade}). ${hqTarget.phase}`,
    });
    if (gap === 0 && hqTarget.resultGradeRef && grade !== hqTarget.resultGradeRef) {
      recommendations.push({
        type: 'note',
        text: `본부 실행 목표는 충족했습니다. 결과 등급 **${hqTarget.resultGradeRef}**(${hqTarget.minScore}점대) 표기와 정합을 맞추려면 종합·4요소 균형을 유지하세요.`,
      });
    }
    const impactSorted = [...active]
      .filter((item) => hqMin != null && item.score < hqMin + 0.3)
      .sort((a, b) => a.score - b.score);
    impactSorted.slice(0, 2).forEach((item) => {
      recommendations.push({
        type: 'note',
        text: `유지 관점: **${item.label}** ${item.score}점 — 목표 달성 후에도 하락 방지를 점검하세요.`,
      });
    });
  } else if (gap > 0) {
    const impactSorted = [...active]
      .map((item) => ({
        ...item,
        pointsNeeded: round2(gap / item.weight),
      }))
      .sort((a, b) => a.pointsNeeded - b.pointsNeeded);

    recommendations.push({
      type: 'headline',
      text: `${prefix}${ctx.yq} 종합 ${composite}점(결과 등급 ${grade}). **본부 분기 목표 ${hqTarget.minScore}점**(${hqTarget.phase})까지 **${gap}점** 부족합니다.`,
    });

    impactSorted.slice(0, 3).forEach((item, idx) => {
      const tip = ELEMENT_TIPS[item.key];
      const targetScore = round2(Math.min(5, item.score + item.pointsNeeded));
      recommendations.push({
        type: 'action',
        priority: idx + 1,
        label: item.label,
        text: `[${idx + 1}] **${item.label}**(비중 ${item.weightPct}%): ${item.score}→약 ${targetScore}점 (${item.pointsNeeded}점p↑ 시 종합 +${gap} 근접). ${tip.action}`,
      });
    });

    if (ctx.approvedPractice != null && ctx.approvedPractice < 3) {
      recommendations.push({
        type: 'note',
        text: `실전 적용: 팀장 인정 ${ctx.approvedPractice}건 — 3건 이상 인정 시 5점 척도로 본부 목표 달성에 유리합니다.`,
      });
    }
    if (ctx.levelAuto) {
      recommendations.push({
        type: 'note',
        text: '레벨은 월간 역량 자동 반영 중입니다. 차원·정수 레벨을 올리면 분기 레벨·종합이 함께 상승합니다.',
      });
    }
  }

  return {
    ready: true,
    composite,
    grade,
    hqTarget,
    hqMet,
    hqGap: gap,
    strengths,
    weaknesses,
    recommendations,
    headline: recommendations.find((r) => r.type === 'headline')?.text ?? '',
  };
}
