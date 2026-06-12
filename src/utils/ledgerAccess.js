import { URL_ACCESS_LEADER } from '../constants/teamAccess';

/** 구성원 B/C 장부 URL — mode와 무관하게 조회 전용 */
export function isMemberLedgerScope({ module, isMemberScope }) {
  return module === 'ledger' && Boolean(isMemberScope);
}

export function isLedgerReadOnly({ isViewer, module, isMemberScope }) {
  return isViewer || isMemberLedgerScope({ module, isMemberScope });
}

/** 장부 데이터는 조회 URL·구성원 스코프에서 공개 snapshot 기준 */
export function usesPublishedLedgerData({ isViewer, isMemberScope }) {
  return isViewer || Boolean(isMemberScope);
}

/** 팀장 장부 편집 — 구성원·공개 조회 제외 */
export function canEditLedger({ isViewer, module, isMemberScope, isLeader, accessParam }) {
  if (isLedgerReadOnly({ isViewer, module, isMemberScope })) return false;
  if (module !== 'ledger') return false;
  if (isMemberScope) return false;
  if (accessParam === URL_ACCESS_LEADER) return true;
  return Boolean(isLeader && accessParam !== 'member');
}

/** 공식 구성원 장부 URL — mode=view */
export function resolveMemberLedgerViewMode({ module, member, access }) {
  if (module !== 'ledger' || !member || access === URL_ACCESS_LEADER) return null;
  return 'view';
}
