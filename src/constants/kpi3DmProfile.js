/** KPI3 ② 다면 — 직군별 측정 프로필 (TMS 운영 규칙) */

export const DM_PROFILE = {
  INSTRUCTOR: 'instructor',
  DUAL: 'dual',
  PLANNER: 'planner',
  LEGACY: 'legacy',
};

export const DM_WEIGHT_MODE_JOURNAL = 'journal';
export const DM_WEIGHT_MODE_MANUAL = 'manual';

/** 겸업 가중: 강의 30~70% (운영·기획 70~30%까지) · 초기는 기획/운영 중심 40:60 */
export const DM_DUAL_LECTURE_WEIGHT_MIN = 0.3;
export const DM_DUAL_LECTURE_WEIGHT_MAX = 0.7;
export const DM_DUAL_DEFAULT_LECTURE_WEIGHT = 0.4;
export const DM_DUAL_DEFAULT_LECTURE_PCT = Math.round(DM_DUAL_DEFAULT_LECTURE_WEIGHT * 100);
export const DM_DUAL_LECTURE_PCT_MIN = Math.round(DM_DUAL_LECTURE_WEIGHT_MIN * 100);
export const DM_DUAL_LECTURE_PCT_MAX = Math.round(DM_DUAL_LECTURE_WEIGHT_MAX * 100);

/** @param {string} [memberRole] kpiMembers.role */
export function resolveDmProfile(memberRole) {
  if (!memberRole) return DM_PROFILE.LEGACY;
  if (memberRole.includes('강사')) return DM_PROFILE.INSTRUCTOR;
  if (memberRole.includes('겸업')) return DM_PROFILE.DUAL;
  if (memberRole.includes('기획') || memberRole.includes('운영')) return DM_PROFILE.PLANNER;
  return DM_PROFILE.PLANNER;
}

export function dmProfileHint(profile) {
  switch (profile) {
    case DM_PROFILE.INSTRUCTOR:
      return '강사: 강의 만족도 100% (운영 만족도는 참고·미반영). N·전분기 블렌드는 강의 축에만 적용.';
    case DM_PROFILE.DUAL:
      return `겸업: 강의·운영 양축. 초기 ${DM_DUAL_DEFAULT_LECTURE_PCT}:${100 - DM_DUAL_DEFAULT_LECTURE_PCT}(기획·운영 중심). 일지 자동 또는 팀장 수동(강의 ${DM_DUAL_LECTURE_PCT_MIN}~${DM_DUAL_LECTURE_PCT_MAX}%).`;
    case DM_PROFILE.PLANNER:
      return '기획/운영: 운영 만족도 중심. 강의 미수행·N 미달 시 운영 100%.';
    default:
      return '강의 70% + 운영 30% (정의서 기본). N 미달 시 축 제외·대체 규칙 적용.';
  }
}
