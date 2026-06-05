/** 5차원 역량 루브릭 — KPI3 ① 레벨 축 */

export const COMPETENCY_DIMS = [
  { id: 'autonomy', label: '자율성' },
  { id: 'scope', label: '범위·난이도' },
  { id: 'collaboration', label: '협업·영향' },
  { id: 'quality', label: '품질·완결성' },
  { id: 'expertise', label: '전문성·표준화' },
];

export const COMPETENCY_DIM_IDS = COMPETENCY_DIMS.map((d) => d.id);

export const COMPETENCY_ROLES = [
  { id: 'default', label: '기본' },
  { id: 'instructor', label: '전문강사' },
  { id: 'planner', label: '기획/운영' },
];

/** kpiMembers.role → competency role id */
export function mapMemberRoleToCompetency(memberRole) {
  if (!memberRole) return 'default';
  if (memberRole.includes('강사')) return 'instructor';
  if (memberRole.includes('기획') || memberRole.includes('운영')) return 'planner';
  if (memberRole.includes('겸업')) return 'default';
  return 'default';
}

/** 직군별 소수 누적 우선순위 (설계노트 §5) */
export const ACCUMULATION_ORDER_BY_ROLE = {
  default: ['autonomy', 'scope', 'collaboration', 'quality', 'expertise'],
  instructor: ['expertise', 'quality', 'collaboration', 'scope', 'autonomy'],
  planner: ['collaboration', 'autonomy', 'scope', 'quality', 'expertise'],
};

export function accumulationOrderForRole(roleId) {
  return ACCUMULATION_ORDER_BY_ROLE[roleId] || ACCUMULATION_ORDER_BY_ROLE.default;
}

export function defaultCompetencyDims() {
  return Object.fromEntries(COMPETENCY_DIM_IDS.map((id) => [id, '']));
}

export function defaultCompetencyEval() {
  return { intLevel: 0, dims: defaultCompetencyDims() };
}

/** @typedef {'met' | 'unmet' | ''} DimStatus */

export const DIM_MET = 'met';
export const DIM_UNMET = 'unmet';
