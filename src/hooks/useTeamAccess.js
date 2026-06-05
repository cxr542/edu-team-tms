import { useCallback, useEffect, useMemo, useState } from 'react';
import { TEAM_KPI_MEMBERS, TEAM_LEADER_MEMBER_CODE } from '../constants/kpiMembers';
import {
  isExperimentalModule,
  isLeaderOnlyModule,
  isMemberWorkModule,
  isTeamCommonModule,
  LEADER_ONLY_MODULES,
  MEMBER_WORK_MODULES,
  URL_ACCESS_LEADER,
  URL_PARAM_MEMBER,
} from '../constants/teamAccess';

function parseMemberCode(raw) {
  if (!raw) return null;
  return TEAM_KPI_MEMBERS.some((m) => m.code === raw) ? raw : null;
}

export function getTeamAccessFromSearchParams(searchParams) {
  const access = searchParams.get('access');
  const scopedMember = parseMemberCode(searchParams.get(URL_PARAM_MEMBER));

  /** ?access=leader 또는 (구성원 스코프 없고 access≠member) → 팀장·총무 전체 메뉴 */
  const isLeader = access === URL_ACCESS_LEADER || (!scopedMember && access !== 'member');

  /** ?member=B 만 — 본인 일지·역량만 */
  const memberLocked = Boolean(scopedMember) && access !== URL_ACCESS_LEADER;

  const isMemberScope = memberLocked;

  return {
    isLeader,
    isMemberScope,
    scopedMember,
    memberLocked,
    leaderMemberCode: TEAM_LEADER_MEMBER_CODE,
  };
}

function readTeamAccess() {
  if (typeof window === 'undefined') {
    return getTeamAccessFromSearchParams(new URLSearchParams());
  }
  return getTeamAccessFromSearchParams(new URLSearchParams(window.location.search));
}

export function applyTeamAccessToUrl(url, { member, access } = {}) {
  if (member !== undefined) {
    if (member) url.searchParams.set(URL_PARAM_MEMBER, member);
    else url.searchParams.delete(URL_PARAM_MEMBER);
  }
  if (access !== undefined) {
    if (access === URL_ACCESS_LEADER) url.searchParams.set('access', URL_ACCESS_LEADER);
    else if (access === null) url.searchParams.delete('access');
    else url.searchParams.delete('access');
  }
}

export function useTeamAccess() {
  const [access, setAccess] = useState(readTeamAccess);

  useEffect(() => {
    const sync = () => setAccess(readTeamAccess());
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  const canAccessModule = useCallback(
    (module) => {
      if (!module) return true;
      if (isLeaderOnlyModule(module)) return access.isLeader;
      if (isExperimentalModule(module)) return access.isLeader;
      if (access.isMemberScope) {
        return isMemberWorkModule(module) || isTeamCommonModule(module);
      }
      return true;
    },
    [access]
  );

  const defaultMemberCode = access.memberLocked
    ? access.scopedMember
    : access.scopedMember || TEAM_LEADER_MEMBER_CODE;

  const setScopedMemberInUrl = useCallback(
    (code) => {
      const url = new URL(window.location.href);
      if (code) url.searchParams.set(URL_PARAM_MEMBER, code);
      else url.searchParams.delete(URL_PARAM_MEMBER);
      window.history.replaceState({}, '', `${url.pathname}${url.search}`);
      setAccess(readTeamAccess());
    },
    []
  );

  const memberHomeModule = 'journal';

  const redirectUrlForForbidden = useMemo(() => {
    if (access.memberLocked) {
      const url = new URL(window.location.href);
      url.searchParams.set('module', memberHomeModule);
      url.searchParams.set(URL_PARAM_MEMBER, access.scopedMember);
      url.searchParams.delete('access');
      return `${url.pathname}${url.search}`;
    }
    const url = new URL(window.location.href);
    url.searchParams.set('module', memberHomeModule);
    url.searchParams.set('access', URL_ACCESS_LEADER);
    return `${url.pathname}${url.search}`;
  }, [access.memberLocked, access.scopedMember]);

  return {
    ...access,
    defaultMemberCode,
    canAccessModule,
    setScopedMemberInUrl,
    redirectUrlForForbidden,
    memberHomeModule,
    MEMBER_WORK_MODULES,
    LEADER_ONLY_MODULES,
  };
}
