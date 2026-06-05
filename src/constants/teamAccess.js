/** URL: ?access=leader — 팀장(김윤형) · 팀 KPI·승인·리포트 */
export const URL_ACCESS_LEADER = 'leader';

/** 구성원 전용 URL: ?member=A|B|C (일지·역량만) */
export const URL_PARAM_MEMBER = 'member';

/** 팀원이 쓰는 메뉴 */
export const MEMBER_WORK_MODULES = new Set(['journal', 'competency']);

/** 팀원·팀장 공통 (장부는 구성원 조회 전용) */
export const TEAM_COMMON_MODULES = new Set(['ledger', 'lunch', 'idea-bank']);

/** 실험·베타 메뉴 */
export const EXPERIMENTAL_MODULES = new Set(['cloud-chatbot']);

/** 팀장 전용 메뉴 */
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
export const NAV_GROUP_MEMBER_WORK = '팀 구성원 업무';
export const NAV_GROUP_TEAM_COMMON = '팀 공통';
export const NAV_GROUP_EXPERIMENTAL = '실험 버전';
export const NAV_GROUP_LEADER_WORK = '팀장 업무';
export const NAV_GROUP_COMMON = '총무·공통';
export const NAV_GROUP_VIEWER = '조회';
export const NAV_GROUP_VIEWER_KPI = 'KPI 조회';
