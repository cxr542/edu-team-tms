/** 교육팀 KPI 구성원 (A/B/C) */
export const TEAM_KPI_MEMBERS = [
  { code: 'A', displayName: '김윤형', role: '강사', isLeader: true },
  { code: 'B', displayName: '최우성', role: '겸업' },
  { code: 'C', displayName: '신혜윤', role: '기획/운영' },
];

/** 팀장(강사) — 팀 KPI·승인·리포트 + 본인 일지·역량 */
export const TEAM_LEADER_MEMBER_CODE = 'A';

/** @deprecated TEAM_LEADER_MEMBER_CODE 와 동일 */
export const JOURNAL_LINKED_MEMBER_CODE = TEAM_LEADER_MEMBER_CODE;

export function findKpiMember(code) {
  return TEAM_KPI_MEMBERS.find((m) => m.code === code) || null;
}

export function isTeamLeaderMember(memberOrCode) {
  const code = typeof memberOrCode === 'string' ? memberOrCode : memberOrCode?.code;
  return code === TEAM_LEADER_MEMBER_CODE;
}

/** @param {{ displayName?: string, role?: string, code?: string }} member */
export function formatKpiMemberRoleLine(member) {
  if (!member) return '';
  return member.role || member.code || '';
}

/** 김윤형(강사) 형식 */
export function formatKpiMemberLabel(member) {
  if (!member) return '';
  const roleLine = formatKpiMemberRoleLine(member);
  if (roleLine) return `${member.displayName}(${roleLine})`;
  return member.displayName || member.code || '';
}
