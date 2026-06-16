import { isAdminAccessParam, URL_ACCESS_ADMIN, URL_PARAM_MEMBER } from '../constants/teamAccess';

/** 팀 관리(관리자) 경로 */
export const APP_ROUTE_ADMIN = 'admin';

/** 구성원 코드 → URL 슬러그 */
export const MEMBER_ROUTE_SLUG = {
  A: 'yhkim',
  B: 'wschoi',
  C: 'hwshin',
};

/** URL 슬러그 → 구성원 코드 */
export const ROUTE_SLUG_TO_MEMBER = Object.fromEntries(
  Object.entries(MEMBER_ROUTE_SLUG).map(([code, slug]) => [slug, code])
);

const APP_MODULES = new Set([
  'ledger',
  'docs',
  'academizer',
  'cloud-chatbot',
  'lunch',
  'idea-bank',
  'journal',
  'competency',
  'kpi',
  'kpi-approve',
  'kpi-report',
]);

function appBasePrefix() {
  const base = import.meta.env.BASE_URL || '/';
  if (base === '/') return '';
  return base.replace(/\/$/, '');
}

export function withAppBase(pathname) {
  const prefix = appBasePrefix();
  if (!pathname.startsWith('/')) pathname = `/${pathname}`;
  if (!prefix) return pathname;
  return `${prefix}${pathname}`;
}

export function normalizeAppPathname(pathname) {
  const prefix = appBasePrefix();
  let path = pathname || '/';
  if (prefix && path.startsWith(prefix)) {
    path = path.slice(prefix.length) || '/';
  }
  if (!path.startsWith('/')) path = `/${path}`;
  return path.replace(/\/+$/, '') || '/';
}

export function parseAppRoute(location) {
  const pathname = normalizeAppPathname(location?.pathname ?? '/');
  const searchParams = new URLSearchParams(location?.search ?? '');
  const segment = pathname.split('/').filter(Boolean)[0] ?? null;

  if (segment === APP_ROUTE_ADMIN) {
    return {
      scope: 'admin',
      slug: APP_ROUTE_ADMIN,
      memberCode: parseMemberCode(searchParams.get(URL_PARAM_MEMBER)),
      searchParams,
      pathname,
    };
  }

  if (segment && ROUTE_SLUG_TO_MEMBER[segment]) {
    return {
      scope: 'user',
      slug: segment,
      memberCode: ROUTE_SLUG_TO_MEMBER[segment],
      searchParams,
      pathname,
    };
  }

  const access = searchParams.get('access');
  const legacyMember = parseMemberCode(searchParams.get(URL_PARAM_MEMBER));
  if (isAdminAccessParam(access)) {
    return {
      scope: 'admin',
      slug: null,
      memberCode: legacyMember,
      searchParams,
      pathname,
      legacy: true,
    };
  }
  if (legacyMember && !isAdminAccessParam(access)) {
    return {
      scope: 'user',
      slug: MEMBER_ROUTE_SLUG[legacyMember] ?? null,
      memberCode: legacyMember,
      searchParams,
      pathname,
      legacy: true,
    };
  }

  return {
    scope: 'public',
    slug: null,
    memberCode: null,
    searchParams,
    pathname,
  };
}

function parseMemberCode(raw) {
  if (!raw) return null;
  if (MEMBER_ROUTE_SLUG[raw]) return raw;
  if (ROUTE_SLUG_TO_MEMBER[raw]) return ROUTE_SLUG_TO_MEMBER[raw];
  return null;
}

export function resolveScopedPathname({ access, member, memberCode, scope } = {}) {
  if (scope === 'admin' || isAdminAccessParam(access)) {
    return withAppBase(`/${APP_ROUTE_ADMIN}`);
  }
  const code = memberCode || member;
  const slug = code ? MEMBER_ROUTE_SLUG[code] : null;
  if (slug) return withAppBase(`/${slug}`);
  return withAppBase('/');
}

export function isUserScopedRoute(location) {
  return parseAppRoute(location).scope === 'user';
}

export function isAdminScopedRoute(location) {
  return parseAppRoute(location).scope === 'admin';
}

export function isScopedWorkRoute(location) {
  const scope = parseAppRoute(location).scope;
  return scope === 'admin' || scope === 'user';
}

/** legacy ?access= / ?member= 를 /admin · /yhkim 등으로 치환 */
export function migrateLegacyAppUrlIfNeeded(location = window.location) {
  if (typeof window === 'undefined') return false;
  const route = parseAppRoute(location);
  if (route.scope !== 'admin' && route.scope !== 'user') return false;

  const url = new URL(location.href);
  const nextPath = resolveScopedPathname({
    scope: route.scope,
    memberCode: route.memberCode,
  });

  if (url.pathname === nextPath && !route.legacy) return false;

  url.pathname = nextPath;
  url.searchParams.delete('access');
  if (route.scope === 'user') {
    url.searchParams.delete(URL_PARAM_MEMBER);
  }

  if (route.scope !== 'public' && !url.searchParams.get('mode')) {
    url.searchParams.set('mode', 'edit');
  }

  pruneDefaultScopedQuery(url);

  window.history.replaceState({}, '', `${url.pathname}${url.search}`);
  return true;
}

export function applyRouteScopeToUrl(url, { member, access, memberCode, scope } = {}) {
  const route = parseAppRoute(url);
  let targetScope = scope;
  let targetMember = memberCode ?? member ?? route.memberCode;

  if (access !== undefined) {
    if (isAdminAccessParam(access)) {
      targetScope = 'admin';
    } else if (access === null) {
      if (member !== undefined || memberCode !== undefined) {
        targetScope = 'user';
        targetMember = memberCode ?? member;
      }
    }
  }

  if (member !== undefined || memberCode !== undefined) {
    if (access === undefined || !isAdminAccessParam(access)) {
      if (member === null && memberCode === null) {
        if (targetScope !== 'admin') targetMember = route.memberCode;
      } else {
        const code = memberCode ?? member;
        if (code && isAdminAccessParam(access ?? (route.scope === 'admin' ? URL_ACCESS_ADMIN : null))) {
          targetScope = 'admin';
          targetMember = code;
        } else if (code) {
          targetScope = 'user';
          targetMember = code;
        }
      }
    }
  }

  if (!targetScope) {
    if (isAdminAccessParam(access)) targetScope = 'admin';
    else if (targetMember && !isAdminAccessParam(url.searchParams.get('access'))) targetScope = 'user';
    else targetScope = route.scope;
  }

  url.pathname = resolveScopedPathname({
    scope: targetScope,
    memberCode: targetScope === 'user' ? targetMember : null,
    access: targetScope === 'admin' ? URL_ACCESS_ADMIN : null,
  });

  url.searchParams.delete('access');
  if (targetScope === 'admin') {
    if (targetMember) url.searchParams.set(URL_PARAM_MEMBER, targetMember);
    else url.searchParams.delete(URL_PARAM_MEMBER);
  } else if (targetScope === 'user') {
    url.searchParams.delete(URL_PARAM_MEMBER);
  }
}

function applyModuleToUrl(url, module) {
  const route = parseAppRoute(url);
  if (module === 'ledger') {
    if (route.scope === 'user') {
      url.searchParams.set('module', 'ledger');
    } else {
      url.searchParams.delete('module');
    }
    return;
  }
  if (module === 'journal' && route.scope === 'user') {
    url.searchParams.delete('module');
    return;
  }
  if (module) url.searchParams.set('module', module);
  else url.searchParams.delete('module');
}

function defaultModuleForScope(scope) {
  if (scope === 'user') return 'journal';
  if (scope === 'admin') return 'ledger';
  return null;
}

/** 사용자 /yhkim · 관리자 /admin 기본 모듈일 때 module·mode=edit 등 중복 쿼리 제거 */
export function pruneDefaultScopedQuery(url, effectiveModule) {
  const route = parseAppRoute(url);
  if (!isScopedWorkRoute(url)) return url;

  const moduleName =
    effectiveModule || url.searchParams.get('module') || defaultModuleForScope(route.scope);
  const defaultModule = defaultModuleForScope(route.scope);

  if (moduleName === defaultModule) {
    url.searchParams.delete('module');
  }

  const mode = url.searchParams.get('mode');
  const memberLedgerView = moduleName === 'ledger' && route.scope === 'user';
  if (mode === 'edit' && !memberLedgerView) {
    url.searchParams.delete('mode');
  }

  return url;
}

export function buildAppScopedUrl(
  module,
  { mode, year, month, quarter, member, access, memberCode, doc, inheritScope = true } = {},
  baseHref
) {
  const url = new URL(baseHref || (typeof window !== 'undefined' ? window.location.href : 'http://local/'));

  if (inheritScope && member === undefined && access === undefined && memberCode === undefined) {
    applyRouteScopeToUrl(url, { scope: parseAppRoute(url).scope, memberCode: parseAppRoute(url).memberCode });
  } else {
    applyRouteScopeToUrl(url, { member, access, memberCode });
  }

  if (year != null) url.searchParams.set('year', String(year));
  else url.searchParams.delete('year');
  if (month != null) url.searchParams.set('month', String(month));
  else url.searchParams.delete('month');
  if (quarter != null) url.searchParams.set('quarter', String(quarter));
  else url.searchParams.delete('quarter');
  if (doc != null) url.searchParams.set('doc', String(doc));
  else if (doc === null) url.searchParams.delete('doc');

  if (module !== undefined) applyModuleToUrl(url, module);

  const route = parseAppRoute(url);
  const effectiveModule = url.searchParams.get('module') || module;
  const memberLedgerView =
    effectiveModule === 'ledger' &&
    route.scope === 'user' &&
    route.memberCode;

  if (memberLedgerView) {
    url.searchParams.set('mode', 'view');
  } else if (mode === 'view') {
    url.searchParams.set('mode', 'view');
  } else if (mode === 'edit') {
    url.searchParams.set('mode', 'edit');
  } else if (isScopedWorkRoute(url) && !url.searchParams.get('mode')) {
    url.searchParams.set('mode', 'edit');
  }

  pruneDefaultScopedQuery(url, effectiveModule || module);

  return url;
}

export function getModuleFromLocation(location = window.location) {
  const params = parseAppRoute(location).searchParams;
  const m = params.get('module');
  if (m && APP_MODULES.has(m)) return m;
  const route = parseAppRoute(location);
  if (route.scope === 'user') return 'journal';
  if (route.scope === 'admin') return 'ledger';
  const member = params.get(URL_PARAM_MEMBER);
  const access = params.get('access');
  if (member && !isAdminAccessParam(access)) return 'journal';
  return 'ledger';
}

export function memberRoutePath(memberCode) {
  const slug = MEMBER_ROUTE_SLUG[memberCode];
  return slug ? withAppBase(`/${slug}`) : withAppBase('/');
}

export function adminRoutePath() {
  return withAppBase(`/${APP_ROUTE_ADMIN}`);
}
