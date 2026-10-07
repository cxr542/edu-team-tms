import { KPI1_GRADES, KPI2_GRADES, KPI3_GRADES, KPI3_WEIGHTS } from '../constants/kpiRules';

export function gradeFromPct(pct, gradeTable) {
  if (pct == null || Number.isNaN(pct)) return '—';
  const sorted = [...gradeTable].sort((a, b) => b.minPct - a.minPct);
  for (const row of sorted) {
    if (pct >= row.minPct) return row.grade;
  }
  return 'D';
}

export function gradeKpi1(utilizationPct) {
  return gradeFromPct(utilizationPct, KPI1_GRADES);
}

export function gradeKpi2(productivityPct) {
  return gradeFromPct(productivityPct, KPI2_GRADES);
}

/** 소수 둘째 자리에서 반올림(half-up)하여 첫째 자리까지 — 분기 목표·등급 비교용 (KPI 정의서 v6) */
export function roundScoreToTenth(score) {
  return Math.round(Number(score) * 10 + 1e-9) / 10;
}

/** 화면 표기용 — 첫째 자리 문자열 ('—' = 값 없음) */
export function formatScoreTenth(score) {
  if (score == null || Number.isNaN(Number(score))) return '—';
  return roundScoreToTenth(score).toFixed(1);
}

export function gradeKpi3(compositeScore) {
  // 점수가 없거나 0 이하(4요소 미입력)이면 등급을 매기지 않는다
  if (compositeScore == null || Number.isNaN(compositeScore) || compositeScore <= 0) return '—';
  const rounded = roundScoreToTenth(compositeScore);
  const sorted = [...KPI3_GRADES].sort((a, b) => b.minScore - a.minScore);
  for (const row of sorted) {
    if (rounded >= row.minScore) return row.grade;
  }
  return 'D';
}

export function computeKpi3Composite({ level, dm, leader, practice }) {
  const l = Number(level) || 0;
  const d = Number(dm) || 0;
  const ld = Number(leader) || 0;
  const p = Number(practice) || 0;
  const w = KPI3_WEIGHTS;
  return Math.round((l * w.level + d * w.dm + ld * w.leader + p * w.practice) * 100) / 100;
}
