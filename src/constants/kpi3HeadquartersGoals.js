/**
 * KPI3 본부·팀 KPI 목표 — 교육팀_KPI_정의서 §팀 KPI · §지표3 분기별 목표·결과 평가
 */

/** 분기별 본부 실행 목표 (종합 점수 하한) */
export const KPI3_HQ_QUARTERLY_TARGETS = [
  {
    quarter: 1,
    label: '1Q',
    minScore: null,
    resultGradeRef: null,
    phase: '베이스라인 측정',
    meaning: '참고치 수집 · 등급 평가 미적용',
  },
  {
    quarter: 2,
    label: '2Q',
    minScore: 3.2,
    resultGradeRef: 'C',
    phase: '독립 수행 진입',
    meaning: '교육팀 핵심 역량 레벨 평균 3.2 이상',
  },
  {
    quarter: 3,
    label: '3Q',
    minScore: 3.8,
    resultGradeRef: 'B',
    phase: '독립 수행 안정화',
    meaning: '교육팀 핵심 역량 레벨 평균 3.8 이상',
  },
  {
    quarter: 4,
    label: '4Q',
    minScore: 4.0,
    resultGradeRef: 'A',
    phase: '숙련 수준 진입',
    meaning: '교육팀 핵심 역량 레벨 평균 4.0 이상',
  },
];

/** 결과 평가 등급 (종합 점수 컷) — 정의서 §결과 평가 */
export const KPI3_RESULT_GRADE_TABLE = [
  { grade: 'S', minScore: 4.3, meaning: '숙련~전문가 수준 달성' },
  { grade: 'A', minScore: 4.0, meaning: '숙련 수준 진입 (4분기 본부 목표 연계)' },
  { grade: 'B', minScore: 3.8, meaning: '독립 수행 안정화 (3분기 본부 목표 연계)' },
  { grade: 'C', minScore: 3.5, meaning: '독립 수행 진입' },
  { grade: 'D', minScore: 0, meaning: '기본 수준 (집중 개선 필요)' },
];

/** @param {string} yq 예: 2026-2Q */
export function parseYq(yq) {
  const m = /^(\d{4})-(\d)Q$/.exec(yq || '');
  if (!m) return { year: null, quarter: null };
  return { year: parseInt(m[1], 10), quarter: parseInt(m[2], 10) };
}

/** @param {number} monthIndex 0-based */
export function quarterNumberFromMonthIndex(monthIndex) {
  return Math.floor(monthIndex / 3) + 1;
}

/** @param {string} yq */
export function getKpi3HqTargetForYq(yq) {
  const { quarter } = parseYq(yq);
  if (!quarter) return null;
  return KPI3_HQ_QUARTERLY_TARGETS.find((t) => t.quarter === quarter) ?? null;
}

/** @param {number} monthIndex 0-based */
export function getKpi3HqTargetForMonth(monthIndex) {
  return KPI3_HQ_QUARTERLY_TARGETS.find((t) => t.quarter === quarterNumberFromMonthIndex(monthIndex)) ?? null;
}
