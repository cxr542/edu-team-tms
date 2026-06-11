import { useCallback, useEffect, useState } from 'react';
import { URL_ACCESS_LEADER } from '../constants/teamAccess';
import { applyTeamAccessToUrl } from './useTeamAccess';

const KPI_MODULES = new Set(['journal', 'competency', 'kpi', 'kpi-approve', 'kpi-report']);
const APP_MODULES = new Set([
  'ledger',
  'docs',
  'academizer',
  'cloud-chatbot',
  'lunch',
  'idea-bank',
  ...KPI_MODULES,
]);

/** 구성원 전용 URL(?member=B) — module 없을 때 journal, ledger는 param 필수 */
function isMemberOnlyScope(searchParams) {
  const member = searchParams.get('member');
  const access = searchParams.get('access');
  return Boolean(member) && access !== URL_ACCESS_LEADER;
}

/** ledger: 팀장은 생략(legacy), 팀원은 module=ledger 유지 */
function applyModuleToUrl(url, module) {
  if (module === 'ledger') {
    if (isMemberOnlyScope(url.searchParams)) {
      url.searchParams.set('module', 'ledger');
    } else {
      url.searchParams.delete('module');
    }
    return;
  }
  url.searchParams.set('module', module);
}

export function getModuleFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const m = params.get('module');
  if (m && APP_MODULES.has(m)) return m;
  const member = params.get('member');
  const access = params.get('access');
  if (member && access !== URL_ACCESS_LEADER) return 'journal';
  return 'ledger';
}

export function isKpiRelatedModule(module) {
  return KPI_MODULES.has(module);
}

/** 현재 앱 경로(pathname)를 유지한 모듈 URL (GitHub Pages base 대응) */
export function buildAppModuleUrl(module, { mode, year, month, quarter, member, access } = {}) {
  const url = new URL(window.location.href);
  if (mode === 'view') url.searchParams.set('mode', 'view');
  else if (mode === 'edit') url.searchParams.set('mode', 'edit');
  if (year != null) url.searchParams.set('year', String(year));
  if (quarter != null) url.searchParams.set('quarter', String(quarter));
  if (month != null) url.searchParams.set('month', String(month));

  if (member !== undefined || access !== undefined) {
    applyTeamAccessToUrl(url, { member, access });
  } else {
    const cur = new URLSearchParams(window.location.search);
    const m = cur.get('member');
    const a = cur.get('access');
    if (m) url.searchParams.set('member', m);
    if (a) url.searchParams.set('access', a);
  }

  if (module !== undefined) {
    if (!module) url.searchParams.delete('module');
    else applyModuleToUrl(url, module);
  }

  return `${url.pathname}${url.search}`;
}

/** 전체 새로고침 없이 모듈·기간 전환 (popstate로 훅 동기화) */
export function navigateAppModule(module, options = {}) {
  const href = buildAppModuleUrl(module, {
    mode: options.mode,
    year: options.year,
    month: options.month,
    quarter: options.quarter,
    member: options.member,
    access: options.access,
  });
  const url = new URL(href, window.location.origin);
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
    const url = new URL(window.location.href);
    applyModuleToUrl(url, next);
    if (next === 'competency') {
      const member = url.searchParams.get('member');
      const access = url.searchParams.get('access');
      const memberOnlyScope = member && access !== URL_ACCESS_LEADER;
      if (!memberOnlyScope) {
        url.searchParams.delete('member');
        url.searchParams.set('access', URL_ACCESS_LEADER);
      }
    }
    window.history.pushState({}, '', `${url.pathname}${url.search}`);
    setModuleState(next);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, []);

  return { module, setModule };
}
