import { URL_ACCESS_ADMIN } from './teamAccess';
import { TEAM_KPI_MEMBERS } from './kpiMembers';
import { APP_ROUTE_ADMIN, buildAppScopedUrl, withAppBase } from '../utils/appRoute';

function currentLedgerPeriod() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

const { year: LEDGER_YEAR, month: LEDGER_MONTH } = currentLedgerPeriod();

function buildUserPortalLinks(memberCode) {
  return [
    {
      label: '장부 조회',
      module: 'ledger',
      mode: 'view',
      member: memberCode,
      year: LEDGER_YEAR,
      month: LEDGER_MONTH,
    },
    { label: '역량 평가', module: 'competency', mode: 'edit', member: memberCode },
  ];
}

function buildUserPortalSummary(member) {
  if (member.code === 'A') return '팀장 · 일지·역량 작성 및 장부 조회';
  if (member.code === 'B') return '일지·역량 작성, 장부 조회·점심·이것도? 참여';
  return '기획/운영 · 일지·역량 작성, 장부 조회·점심·이것도? 참여';
}

function buildUserPortal(member) {
  return {
    id: `user-${member.code.toLowerCase()}`,
    kind: 'user',
    badge: member.code,
    member,
    summary: buildUserPortalSummary(member),
    accent: 'user',
    primary: {
      label: '일지 작성',
      module: 'journal',
      mode: 'edit',
      member: member.code,
    },
    links: buildUserPortalLinks(member.code),
  };
}

/** 공개 랜딩 — 사용자(A/B/C) 진입 카드 */
export const PUBLIC_VIEWER_USER_PORTALS = TEAM_KPI_MEMBERS.map(buildUserPortal);

/** 관리자 — 랜딩 하단 별도 섹션, /admin 비밀번호 게이트 경유 */
export const PUBLIC_VIEWER_ADMIN_PORTAL = {
  id: 'admin',
  kind: 'admin',
  badge: '관리자',
  title: '관리자 화면',
  summary: '장부·KPI·승인 — /admin 접속 시 비밀번호 필요',
  accent: 'admin',
  primary: {
    label: '관리자 화면 열기',
    href: withAppBase(`/${APP_ROUTE_ADMIN}`),
  },
  links: [],
};

/** @deprecated 사용자 카드만 — admin은 PUBLIC_VIEWER_ADMIN_PORTAL */
export const PUBLIC_VIEWER_ROLE_PORTALS = PUBLIC_VIEWER_USER_PORTALS;

export function navigateToBookmarkReferenceDoc() {
  const url = buildAppScopedUrl('docs', {
    access: URL_ACCESS_ADMIN,
    mode: 'edit',
    doc: 'tms-bookmarks',
    inheritScope: false,
  });
  window.history.pushState({}, '', `${url.pathname}${url.search}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
