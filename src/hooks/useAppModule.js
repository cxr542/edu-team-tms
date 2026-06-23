import { useCallback, useEffect, useState } from 'react';
import { isAdminAccessParam, URL_ACCESS_ADMIN } from '../constants/teamAccess';
import { resolveMemberLedgerViewMode } from '../utils/ledgerAccess';
import {
  buildAppScopedUrl,
  getModuleFromLocation,
  parseAppRoute,
} from '../utils/appRoute';
import { applyTeamAccessToUrl } from './useTeamAccess';

const KPI_MODULES = new Set(['journal', 'competency', 'kpi', 'kpi-approve', 'kpi-report']);

export function getModuleFromUrl() {
  if (typeof window === 'undefined') return 'ledger';
  return getModuleFromLocation(window.location);
}

export function isKpiRelatedModule(module) {
  return KPI_MODULES.has(module);
}

/** 모듈 URL — /admin · /yhkim 등 경로 기반 */
export function buildAppModuleUrl(module, { mode, year, month, quarter, member, access, doc } = {}) {
  const inheritScope = member === undefined && access === undefined;
  const url = buildAppScopedUrl(module, {
    mode,
    year,
    month,
    quarter,
    member,
    access,
    doc,
    inheritScope,
  });
  return `${url.pathname}${url.search}`;
}

/** 전체 새로고침 없이 모듈·기간 전환 (popstate로 훅 동기화) */
export function navigateAppModule(module, options = {}) {
  const url = buildAppScopedUrl(module, {
    mode: options.mode,
    year: options.year,
    month: options.month,
    quarter: options.quarter,
    member: options.member,
    access: options.access,
    doc: options.doc,
    inheritScope: options.member === undefined && options.access === undefined,
  });
  window.history.pushState({}, '', `${url.pathname}${url.search}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function useAppModule() {
  const [module, setModuleState] = useState(getModuleFromUrl);

  useEffect(() => {
    const onPop = () => setModuleState(getModuleFromUrl());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const setModule = useCallback((next) => {
    const url = buildAppScopedUrl(next, { inheritScope: true });
    if (
      resolveMemberLedgerViewMode({
        module: next,
        member: url.searchParams.get('member'),
        access: url.searchParams.get('access'),
      }) === 'view'
    ) {
      url.searchParams.set('mode', 'view');
    }
    if (next === 'competency') {
      const currentRoute = parseAppRoute(window.location);
      const routeMember = url.searchParams.get('member');
      const access = url.searchParams.get('access');
      const memberOnlyScope = currentRoute.scope === 'user' || (routeMember && !isAdminAccessParam(access));
      if (!memberOnlyScope) {
        applyTeamAccessToUrl(url, { member: null, access: URL_ACCESS_ADMIN });
      }
    }
    window.history.pushState({}, '', `${url.pathname}${url.search}`);
    setModuleState(next);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, []);

  return { module, setModule };
}
