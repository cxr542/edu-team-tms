/** KPI2 공식(승인) vs 미리보기(제출·일지) — 구성원·팀 표시 통일 */

export function resolveKpi2Display(kpi2, kpi2Preview) {
  const officialPct = kpi2?.productivityPct ?? null;
  const previewPct = kpi2Preview?.productivityPct ?? null;
  const displayPct = officialPct ?? previewPct ?? null;
  const usesPreview = officialPct == null && previewPct != null;
  return { officialPct, previewPct, displayPct, usesPreview };
}
