/** TMS UI 표시용 KPI 지표명 (KPI1/2/3 대신) */

export const KPI1_NAME = '업무 리소스 가동률';
export const KPI2_NAME = '업무 리소스 생산성';
export const KPI3_NAME = '교육팀 핵심 역량 레벨';

export const KPI_DISPLAY_BY_ID = {
  kpi1: KPI1_NAME,
  kpi2: KPI2_NAME,
  kpi3: KPI3_NAME,
};

/** 배지·좁은 라벨 (전체 지표명은 title 툴팁) */
export const KPI1_BADGE = '가동률';
export const KPI2_BADGE = '생산성';
export const KPI3_BADGE = '핵심역량';

/** 승인 큐 등 내부 type 코드 → 표시명 */
export function kpiTypeLabel(type) {
  if (type === 'KPI1') return KPI1_NAME;
  if (type === 'KPI2') return KPI2_NAME;
  return type;
}
