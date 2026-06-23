import { useCallback, useEffect, useMemo, useState } from 'react';
import { TEAM_KPI_MEMBERS, TEAM_LEADER_MEMBER_CODE } from '../constants/kpiMembers';
import {
  isAdminAccessParam,
  isExperimentalModule,
  isLeaderOnlyModule,
  isMemberWorkModule,
  isTeamCommonModule,
  LEADER_ONLY_MODULES,
  MEMBER_WORK_MODULES,
  URL_ACCESS_ADMIN,
  URL_PARAM_MEMBER,
} from '../constants/teamAccess';
import {
  applyRouteScopeToUrl,
  buildAppScopedUrl,
  parseAppRoute,
} from '../utils/appRoute';

function parseMemberCode(raw) {
  if (!raw) return null;
  return TEAM_KPI_MEMBERS.some((m) => m.code === raw) ? raw : null;
}

export function getTeamAccessFromSearchParams(searchParams, location) {
  const route = location
    ? parseAppRoute(location)
    : parseAppRoute({
        pathname: typeof window !== 'undefined' ? window.location.pathname : '/',
        search: `?${searchParams.toString()}`,
      });
  const access = searchParams.get('access');
  const queryMember = parseMemberCode(searchParams.get(URL_PARAM_MEMBER));

  if (route.scope === 'admin') {
    return {
      isAdmin: true,
      isLeader: true,
      isMemberScope: false,
      scopedMember: queryMember,
      memberLocked: false,
      leaderMemberCode: TEAM_LEADER_MEMBER_CODE,
    };
  }

  if (route.scope === 'user') {
    return {
      isAdmin: false,
      isLeader: false,
      isMemberScope: true,
      scopedMember: route.memberCode,
      memberLocked: true,
      leaderMemberCode: TEAM_LEADER_MEMBER_CODE,
    };
  }

  if (route.scope === 'public') {
    return {
      isAdmin: false,
      isLeader: false,
      isMemberScope: false,
      scopedMember: queryMember,
      memberLocked: false,
      leaderMemberCode: TEAM_LEADER_MEMBER_CODE,
    };
  }

  const isAdmin = isAdminAccessParam(access) || (!queryMember && access !== 'member');
  const memberLocked = Boolean(queryMember) && !isAdminAccessParam(access);
  const isMemberScope = memberLocked;

  return {
    isAdmin,
    isLeader: isAdmin,
    isMemberScope,
    scopedMember: queryMember,
    memberLocked,
    leaderMemberCode: TEAM_LEADER_MEMBER_CODE,
  };
}

/** 일지에서 해당 구성원 데이터를 편집할 수 있는지 (조회는 memberLocked와 무관하게 탭 전환 가능) */
export function canEditMemberJournal(access, memberCode) {
  if (!memberCode) return false;
  if (access.isAdmin && !access.isMemberScope) return true;
  if (access.memberLocked) return memberCode === access.scopedMember;
  return memberCode === (access.scopedMember || access.leaderMemberCode);
}

export function canUseCompetencyPilot(access) {
  return Boolean(access?.isAdmin || !access?.isMemberScope || access?.scopedMember === 'A');
}

export function canAccessTeamModule(access, module) {
  if (!module) return true;
  if (isLeaderOnlyModule(module)) return Boolean(access?.isAdmin);
  if (isExperimentalModule(module)) return Boolean(access?.isAdmin);
  if (access?.isMemberScope) {
    if (module === 'competency' && !canUseCompetencyPilot(access)) return false;
    return isMemberWorkModule(module) || isTeamCommonModule(module);
  }
  return true;
}

function readTeamAccess() {
  if (typeof window === 'undefined') {
    return getTeamAccessFromSearchParams(new URLSearchParams());
  }
  return getTeamAccessFromSearchParams(new URLSearchParams(window.location.search), window.location);
}

export function applyTeamAccessToUrl(url, { member, access } = {}) {
  applyRouteScopeToUrl(url, { member, access });
}

/** 관리자가 일지에서 A/B/C 탭 전환 시 URL에 member 반영 (북마크·새로고침 유지) */
export function applyLeaderJournalMemberToUrl(memberCode) {
  if (typeof window === 'undefined' || !memberCode) return;
  const url = new URL(window.location.href);
  applyRouteScopeToUrl(url, { access: URL_ACCESS_ADMIN, member: memberCode });
  window.history.replaceState({}, '', `${url.pathname}${url.search}`);
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
      return canAccessTeamModule(access, module);
    },
    [access]
  );

  const defaultMemberCode = access.memberLocked
    ? access.scopedMember
    : access.scopedMember || TEAM_LEADER_MEMBER_CODE;

  const setScopedMemberInUrl = useCallback((code) => {
    const url = new URL(window.location.href);
    applyRouteScopeToUrl(url, { member: code || null });
    window.history.replaceState({}, '', `${url.pathname}${url.search}`);
    setAccess(readTeamAccess());
  }, []);

  const memberHomeModule = 'journal';

  const redirectUrlForForbidden = useMemo(() => {
    if (access.memberLocked) {
      const url = buildAppScopedUrl(memberHomeModule, {
        member: access.scopedMember,
        mode: 'edit',
        inheritScope: false,
      });
      return `${url.pathname}${url.search}`;
    }
    const url = buildAppScopedUrl(memberHomeModule, {
      access: URL_ACCESS_ADMIN,
      mode: 'edit',
      inheritScope: false,
    });
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
