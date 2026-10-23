import { hasValidAdminSession } from './adminSession.js';
import { isAllowedPublishOrigin } from './publishOrigin.js';
import { isAdminRouteReferer } from './requestScope.js';

/**
 * 관리자 전용 쓰기 가드: 허용 origin + /admin 계열 referer + 서버 관리자 세션 쿠키.
 * (Referer/Origin 만으로는 인증이 아니므로 세션 쿠키 검증이 핵심이다.)
 */
export function canUseAdminWrite(req) {
  const referer = req.headers?.referer || req.headers?.origin || '';
  if (!isAllowedPublishOrigin(referer)) return false;
  if (!isAdminRouteReferer(req)) return false;
  return hasValidAdminSession(req);
}
