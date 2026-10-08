import { COMPETENCY_USE_4060 } from '../constants/competencyConfig';
import { defaultQuarterRecord, quarterKey } from '../constants/kpiOperationalStore';
import { rollupQuarterLevelFromMonths } from './competencyScore';
import { computeKpi3Composite, gradeKpi3 } from './kpiGrades';

/**
 * 분기 레벨 자동 반영 — 분기 마지막 달(3·6·9·12월)의 월 최종 레벨을 분기 레벨(KPI3 레벨 35%)로 맞춘다.
 * - 팀장 확정 전이어도 팀장 평가 점수가 있으면 반영한다 (마지막 달에 값이 없으면 건드리지 않는다)
 * - 분기 확정(locked)된 기록과 팀장이 수동으로 조정한 레벨(levelAuto=false 이고 값>0)은 건드리지 않는다
 * - 레벨이 바뀌면 종합 점수·등급도 함께 다시 계산한다
 *
 * @returns {{ store: object, changed: boolean, updates: Array<{ yq: string, memberCode: string, level: number }> }}
 */
export function syncQuarterLevelsFromCompetencyMonths(store, { use4060 = COMPETENCY_USE_4060 } = {}) {
  const months = store?.competencyMonths || {};
  const updates = [];
  let quarters = store?.quarters || {};

  Object.keys(months)
    .sort()
    .forEach((ym) => {
      const [yearStr, monthStr] = String(ym).split('-');
      const year = Number(yearStr);
      const month = Number(monthStr);
      if (!year || ![3, 6, 9, 12].includes(month)) return;
      const monthIndex = month - 1;
      const yq = quarterKey(year, monthIndex);

      Object.keys(months[ym] || {}).forEach((memberCode) => {
        const level = rollupQuarterLevelFromMonths(months, year, monthIndex, memberCode, use4060);
        if (level == null) return;

        const rec = quarters[yq]?.[memberCode] || defaultQuarterRecord(memberCode);
        const q = rec.quarter || {};
        if (q.locked) return;
        if (Number(q.level) > 0 && !q.levelAuto) return; // 수동 조정 값 보호
        if (Number(q.level) === level && q.levelAuto) return;

        const nextQuarter = { ...q, level, levelAuto: true };
        const composite = computeKpi3Composite(nextQuarter);
        nextQuarter.composite = composite;
        nextQuarter.grade = gradeKpi3(composite);

        quarters = {
          ...quarters,
          [yq]: { ...(quarters[yq] || {}), [memberCode]: { ...rec, quarter: nextQuarter } },
        };
        updates.push({ yq, memberCode, level });
      });
    });

  if (!updates.length) return { store, changed: false, updates };
  return { store: { ...store, quarters }, changed: true, updates };
}
