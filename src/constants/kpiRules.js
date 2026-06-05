/** kpi-app-new config/*.yaml 과 동기 (브라우저용 상수) */

export const KPI1_GRADES = [
  { grade: 'S', minPct: 100 },
  { grade: 'A', minPct: 99 },
  { grade: 'B', minPct: 96 },
  { grade: 'C', minPct: 90 },
  { grade: 'D', minPct: 0 },
];

export const KPI2_GRADES = [
  { grade: 'S', minPct: 170 },
  { grade: 'A', minPct: 150 },
  { grade: 'B', minPct: 130 },
  { grade: 'C', minPct: 110 },
  { grade: 'D', minPct: 0 },
];

/** v5 정의서: 5점 만점 종합, 분기 등급 컷 */
export const KPI3_GRADES = [
  { grade: 'S', minScore: 4.3 },
  { grade: 'A', minScore: 4.0 },
  { grade: 'B', minScore: 3.8 },
  { grade: 'C', minScore: 3.5 },
  { grade: 'D', minScore: 0 },
];

/** 레벨 35% · 다면 15% · 리더 25% · 실전 25% */
export const KPI3_WEIGHTS = {
  level: 0.35,
  dm: 0.15,
  leader: 0.25,
  practice: 0.25,
};

export const KPI3_MEMO_TYPES = [
  { id: 'level', label: '레벨 근거' },
  { id: 'dm', label: '다면 평가' },
  { id: 'practice', label: '실전 적용' },
  { id: 'leader', label: '리더 평가' },
  { id: 'other', label: '기타' },
];

export const MM_VALIDATION_TOLERANCE = 0.001;
