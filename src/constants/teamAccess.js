/** URL: ?access=admin — 관리자 · 장부·팀 KPI·승인·리포트 */
export const URL_ACCESS_ADMIN = 'admin';

/** @deprecated `access=leader` 는 admin 과 동일하게 처리 (기존 북마크 호환) */
export const URL_ACCESS_LEADER = 'leader';

/** 사용자 전용 URL: ?member=A|B|C (일지·역량) */
export const URL_PARAM_MEMBER = 'member';

export function isAdminAccessParam(access) {
  return access === URL_ACCESS_ADMIN || access === URL_ACCESS_LEADER;
}

/** 사용자가 쓰는 메뉴 */
export const MEMBER_WORK_MODULES = new Set(['journal', 'competency']);

/** 사용자·관리자 공통 (장부·점심·이것도?·참고문서) */
export const TEAM_COMMON_MODULES = new Set(['ledger', 'lunch', 'idea-bank', 'docs']);

/** 실험·베타 메뉴 */
export const EXPERIMENTAL_MODULES = new Set(['cloud-chatbot']);

/** 관리자 전용 메뉴 */
export const LEADER_ONLY_MODULES = new Set(['kpi', 'kpi-report', 'kpi-approve']);

export function isLeaderOnlyModule(module) {
  return LEADER_ONLY_MODULES.has(module);
}

export function isMemberWorkModule(module) {
  return MEMBER_WORK_MODULES.has(module);
}

export function isTeamCommonModule(module) {
  return TEAM_COMMON_MODULES.has(module);
}

export function isExperimentalModule(module) {
  return EXPERIMENTAL_MODULES.has(module);
}

/** 사이드바 메뉴 그룹 제목 */
export const NAV_GROUP_MEMBER_WORK = '사용자 업무';
export const NAV_GROUP_TEAM_COMMON = '팀 공통';
export const NAV_GROUP_EXPERIMENTAL = '실험 버전';
export const NAV_GROUP_LEADER_WORK = '관리 업무';
export const NAV_GROUP_COMMON = '관리·공통';
export const NAV_GROUP_VIEWER = '조회';
export const NAV_GROUP_VIEWER_KPI = 'KPI 조회';
