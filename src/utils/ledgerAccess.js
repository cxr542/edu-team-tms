import { URL_ACCESS_ADMIN, isAdminAccessParam } from '../constants/teamAccess';
import { parseAppRoute } from './appRoute';

/** `/` 랜딩(안내) 또는 member 없는 ?mode=view — 장부·런치 등 직접 노출 안 함 */
export function isPublicViewerScope({ isViewer, isMemberScope, location }) {
  if (location && parseAppRoute(location).scope === 'public') return true;
  return Boolean(isViewer) && !Boolean(isMemberScope);
}

/** 사용자 B/C 장부 URL — mode와 무관하게 조회 전용 */
export function isMemberLedgerScope({ module, isMemberScope }) {
  return module === 'ledger' && Boolean(isMemberScope);
}

export function isLedgerReadOnly({ isViewer, module, isMemberScope }) {
  return isViewer || isMemberLedgerScope({ module, isMemberScope });
}

/** 장부 데이터는 사용자 장부 조회·(구) 공개 장부 조회에서 snapshot 기준 — 안내 화면 제외 */
export function usesPublishedLedgerData({ isViewer, isMemberScope, location }) {
  const loc =
    location ||
    (typeof window !== 'undefined'
      ? window.location
      : null);
  if (isPublicViewerScope({ isViewer, isMemberScope, location: loc })) return false;
  return isViewer || Boolean(isMemberScope);
}

/** 관리자 장부 편집 — 사용자·공개 조회 제외 */
export function canEditLedger({ isViewer, module, isMemberScope, isLeader, isAdmin, accessParam }) {
  const adminScope = isAdmin ?? isLeader;
  if (isLedgerReadOnly({ isViewer, module, isMemberScope })) return false;
  if (module !== 'ledger') return false;
  if (isMemberScope) return false;
  if (isAdminAccessParam(accessParam)) return true;
  return Boolean(adminScope && accessParam !== 'member');
}

/** 공식 사용자 장부 URL — mode=view */
export function resolveMemberLedgerViewMode({ module, member, access, location }) {
  if (module !== 'ledger') return null;
  const loc =
    location ||
    (typeof window !== 'undefined'
      ? window.location
      : { pathname: '/', search: member ? `?member=${member}` : '' });
  const route = parseAppRoute(loc);
  if (isAdminAccessParam(access)) return null;
  if (route.scope === 'admin') return null;
  if (route.scope === 'user') return 'view';
  if (member) return 'view';
  return null;
}
