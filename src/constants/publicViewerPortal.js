import { URL_ACCESS_LEADER } from './teamAccess';
import { TEAM_KPI_MEMBERS, TEAM_LEADER_MEMBER_CODE } from './kpiMembers';

function currentLedgerPeriod() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

const { year: LEDGER_YEAR, month: LEDGER_MONTH } = currentLedgerPeriod();

const leader = TEAM_KPI_MEMBERS.find((m) => m.code === TEAM_LEADER_MEMBER_CODE);
const memberB = TEAM_KPI_MEMBERS.find((m) => m.code === 'B');
const memberC = TEAM_KPI_MEMBERS.find((m) => m.code === 'C');

/** 공개 조회(?mode=view, member 없음) 랜딩 — 역할별 진입 카드 */
export const PUBLIC_VIEWER_ROLE_PORTALS = [
  {
    id: 'leader',
    badge: '팀장 · 총무',
    member: leader,
    summary: '장부 편집, KPI·승인, 팀 일지 확인',
    accent: 'leader',
    primary: {
      label: '팀장 화면 열기',
      module: 'ledger',
      mode: 'edit',
      access: URL_ACCESS_LEADER,
    },
    links: [
      { label: '일지 (A)', module: 'journal', mode: 'edit', access: URL_ACCESS_LEADER },
      { label: 'KPI 관리', module: 'kpi', mode: 'edit', access: URL_ACCESS_LEADER },
      { label: 'KPI 승인', module: 'kpi-approve', mode: 'edit', access: URL_ACCESS_LEADER },
      { label: '참고문서', module: 'docs', mode: 'edit', access: URL_ACCESS_LEADER },
    ],
  },
  {
    id: 'member-b',
    badge: '팀원',
    member: memberB,
    summary: '본인 일지·역량 작성, 장부·점심·이것도? 참여',
    accent: 'member',
    primary: {
      label: '일지 작성',
      module: 'journal',
      mode: 'edit',
      member: 'B',
    },
    links: [
      {
        label: '장부 조회',
        module: 'ledger',
        mode: 'view',
        member: 'B',
        year: LEDGER_YEAR,
        month: LEDGER_MONTH,
      },
      { label: '역량 평가', module: 'competency', mode: 'edit', member: 'B' },
      { label: '점심 뭐 먹지', module: 'lunch', mode: 'edit', member: 'B' },
      { label: '이것도?', module: 'idea-bank', mode: 'edit', member: 'B' },
    ],
  },
  {
    id: 'member-c',
    badge: '팀원',
    member: memberC,
    summary: '본인 일지·역량 작성, 장부·점심·이것도? 참여',
    accent: 'member',
    primary: {
      label: '일지 작성',
      module: 'journal',
      mode: 'edit',
      member: 'C',
    },
    links: [
      {
        label: '장부 조회',
        module: 'ledger',
        mode: 'view',
        member: 'C',
        year: LEDGER_YEAR,
        month: LEDGER_MONTH,
      },
      { label: '역량 평가', module: 'competency', mode: 'edit', member: 'C' },
      { label: '점심 뭐 먹지', module: 'lunch', mode: 'edit', member: 'C' },
      { label: '이것도?', module: 'idea-bank', mode: 'edit', member: 'C' },
    ],
  },
];

export function navigateToBookmarkReferenceDoc() {
  const url = new URL(window.location.href);
  url.searchParams.set('mode', 'edit');
  url.searchParams.set('access', URL_ACCESS_LEADER);
  url.searchParams.set('module', 'docs');
  url.searchParams.set('doc', 'tms-bookmarks');
  window.history.pushState({}, '', `${url.pathname}${url.search}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
