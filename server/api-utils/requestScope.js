const ADMIN_ACCESS_PARAMS = new Set(['admin', 'leader']);
const MEMBER_ROUTE_SLUG_TO_CODE = {
  yhkim: 'A',
  wschoi: 'B',
  hyshin: 'C',
  hwshin: 'C', // legacy alias → same member
};
const VALID_MEMBER_CODES = new Set(Object.values(MEMBER_ROUTE_SLUG_TO_CODE));

function parseRefererUrl(req) {
  const referer = req?.headers?.referer;
  if (!referer) return null;
  try {
    return new URL(String(referer));
  } catch {
    return null;
  }
}

function firstPathSegment(url) {
  return url?.pathname?.split('/').filter(Boolean)[0] || null;
}

export function isAdminRouteReferer(req) {
  const url = parseRefererUrl(req);
  if (!url) return false;

  const segment = firstPathSegment(url);
  if (segment === 'admin') return true;
  if (MEMBER_ROUTE_SLUG_TO_CODE[segment]) return false;

  return ADMIN_ACCESS_PARAMS.has(url.searchParams.get('access'));
}

export function memberCodeFromReferer(req) {
  const url = parseRefererUrl(req);
  if (!url) return null;

  const routeMemberCode = MEMBER_ROUTE_SLUG_TO_CODE[firstPathSegment(url)];
  if (routeMemberCode) return routeMemberCode;
  if (isAdminRouteReferer(req)) return null;

  const queryMember = url.searchParams.get('member');
  return VALID_MEMBER_CODES.has(queryMember) ? queryMember : null;
}

export function isSameMemberRouteReferer(req, memberCode) {
  return memberCodeFromReferer(req) === memberCode;
}

export function isAdminOrSameMemberRouteReferer(req, memberCode) {
  return isAdminRouteReferer(req) || isSameMemberRouteReferer(req, memberCode);
}
