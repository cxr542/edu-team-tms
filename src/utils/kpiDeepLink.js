import { TEAM_KPI_MEMBERS, TEAM_LEADER_MEMBER_CODE } from '../constants/kpiMembers.js';

/** 팀 KPI 관리 화면 딥링크: ?kpiTab=kpi1&kpiMember=B (route 의 member/access 와 겹치지 않게 별도 이름) */
export const KPI_TAB_PARAM = 'kpiTab';
export const KPI_MEMBER_PARAM = 'kpiMember';

/**
 * @param {string} search location.search
 * @param {string[]} tabIds 팀 KPI 화면이 가진 탭 id
 * @returns {{ tab: string, member: string }} 알 수 없는 값은 기본값(개요·팀장)으로 돌린다
 */
export function parseKpiDeepLink(search, tabIds) {
  const params = new URLSearchParams(search || '');
  const tab = params.get(KPI_TAB_PARAM);
  const member = params.get(KPI_MEMBER_PARAM);
  return {
    tab: tabIds.includes(tab) ? tab : 'overview',
    member: TEAM_KPI_MEMBERS.some((m) => m.code === member) ? member : TEAM_LEADER_MEMBER_CODE,
  };
}

/** 현재 주소(location.search)에서 읽는다. SSR·테스트처럼 window 가 없으면 기본값. */
export function readKpiDeepLinkFromUrl(tabIds) {
  return parseKpiDeepLink(typeof window === 'undefined' ? '' : window.location.search, tabIds);
}
