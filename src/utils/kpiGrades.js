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

export function gradeKpi3(compositeScore) {
  if (compositeScore == null || Number.isNaN(compositeScore)) return '—';
  const sorted = [...KPI3_GRADES].sort((a, b) => b.minScore - a.minScore);
  for (const row of sorted) {
    if (compositeScore >= row.minScore) return row.grade;
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
