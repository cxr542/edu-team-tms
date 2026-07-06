import { TEAM_KPI_MEMBERS, findKpiMember } from '../constants/kpiMembers.js';

function memberLabel(memberCode) {
  const member = findKpiMember(memberCode);
  return member?.displayName || memberCode || '알 수 없음';
}

export function resolveAnnouncementAuthorIdentity(teamAccess) {
  const authorCode =
    teamAccess?.scopedMember ||
    teamAccess?.defaultMemberCode ||
    teamAccess?.leaderMemberCode ||
    TEAM_KPI_MEMBERS[0]?.code ||
    'A';

  return {
    authorCode,
    authorName: memberLabel(authorCode),
  };
}
