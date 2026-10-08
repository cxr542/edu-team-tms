/** KPI2 공식(승인) vs 미리보기(제출·일지) — 구성원·팀 표시 통일 */

export function resolveKpi2Display(kpi2, kpi2Preview) {
  const officialPct = kpi2?.productivityPct ?? null;
  const previewPct = kpi2Preview?.productivityPct ?? null;
  const displayPct = officialPct ?? previewPct ?? null;
  const usesPreview = officialPct == null && previewPct != null;
  return { officialPct, previewPct, displayPct, usesPreview };
}

/**
 * 구성원 일지 상단 집계용 KPI2(업무 리소스 생산성) 요약.
 * 팀 KPI 화면과 같은 규칙: 공식(승인·구두 승인 간주 포함)이 있으면 공식, 없으면 일지 효과 건 미리보기.
 * 생산성은 100%를 넘는 것이 정상이므로 값을 자르지 않는다.
 * @returns {{ hasData: boolean, displayPct: number|null, usesPreview: boolean, planSum: number, actualSum: number, count: number }}
 */
export function summarizeKpi2ForDisplay(kpi2, kpi2Preview) {
  const { displayPct, usesPreview } = resolveKpi2Display(kpi2, kpi2Preview);
  const source = usesPreview ? kpi2Preview : kpi2;
  return {
    hasData: displayPct != null,
    displayPct,
    usesPreview,
    planSum: Number(source?.planSum) || 0,
    actualSum: Number(source?.actualSum) || 0,
    count: Number(source?.submittedCount) || 0,
  };
}

/** 구성원 일지 상단 KPI2 칸의 툴팁 문구 (화면에는 % 만 보이고 상세는 마우스를 올리면 표시) */
export function kpi2TileTooltip(tile) {
  const rule = 'KPI 지표 2 — 이 달 KPI2 효과 건의 계획 시간 합 ÷ 실작업 시간 합 × 100';
  if (!tile?.hasData) return `${rule}\n효과 건 없음`;
  const detail = `계획 ${tile.planSum.toFixed(1)}h ÷ 실적 ${tile.actualSum.toFixed(1)}h · ${tile.count}건`;
  return `${rule}\n${detail}${tile.usesPreview ? ' · 제출 전 건 포함' : ''}`;
}
