import { URL_ACCESS_LEADER } from '../constants/teamAccess';

/** member 없는 ?mode=view — 공개 조회 랜딩(안내) 전용, 장부·런치 등 직접 노출 안 함 */
export function isPublicViewerScope({ isViewer, isMemberScope }) {
  return Boolean(isViewer) && !Boolean(isMemberScope);
}

/** 구성원 B/C 장부 URL — mode와 무관하게 조회 전용 */
export function isMemberLedgerScope({ module, isMemberScope }) {
  return module === 'ledger' && Boolean(isMemberScope);
}

export function isLedgerReadOnly({ isViewer, module, isMemberScope }) {
  return isViewer || isMemberLedgerScope({ module, isMemberScope });
}

/** 장부 데이터는 구성원 장부 조회·(구) 공개 장부 조회에서 snapshot 기준 — 안내 화면 제외 */
export function usesPublishedLedgerData({ isViewer, isMemberScope }) {
  if (isPublicViewerScope({ isViewer, isMemberScope })) return false;
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
