import { findKpiMember } from '../constants/kpiMembers';
import { improveProjectTitleKey } from '../constants/improveProjects';

export const IMPROVE_PROJECT_SOURCE = {
  MANUAL: 'manual',
  JOURNAL_CANDIDATE: 'journal-candidate',
};

export const IMPROVE_PROJECT_LOCAL_SCOPE_NOTICE =
  '향상 과제 운영 목록은 이 브라우저에 먼저 저장됩니다. 구성원에게 전달할 때는 JSON 파일을 다운로드하고, 받은 JSON은 수동으로 가져오세요. 자동 동기화는 사용하지 않습니다.';

export const IMPROVE_PROJECT_JOURNAL_SCOPE_NOTICE =
  '향상 과제 운영 목록은 이 브라우저에 저장됩니다. 팀장이 전달한 JSON 파일을 수동으로 가져와 반영하세요. 자동 동기화는 사용하지 않습니다.';

/** 후보 출처에서 가장 많이 등장한 구성원 코드 */
export function getPrimaryOwnerFromSources(sources = []) {
  const counts = new Map();
  sources.forEach(({ memberCode }) => {
    if (!memberCode) return;
    counts.set(memberCode, (counts.get(memberCode) || 0) + 1);
  });
  let best = null;
  let max = 0;
  counts.forEach((n, code) => {
    if (n > max) {
      max = n;
      best = code;
    }
  });
  return best;
}

export function buildImproveProjectRegistrationFromCandidate(candidate, { year, monthIndex }) {
  const ownerMemberId = getPrimaryOwnerFromSources(candidate.sources);
  const member = ownerMemberId ? findKpiMember(ownerMemberId) : null;
  return {
    name: candidate.title,
    ownerMemberId: ownerMemberId || undefined,
    ownerName: member?.displayName,
    source: IMPROVE_PROJECT_SOURCE.JOURNAL_CANDIDATE,
    sourceLabel: `${year}년 ${monthIndex + 1}월 업무일지 후보`,
    sourceJournalRefs: (candidate.sources || []).map(({ memberCode, dayKey }) => ({
      memberCode,
      dayKey,
    })),
    createdAt: new Date().toISOString(),
    status: 'active',
  };
}

export function buildManualImproveProjectRegistration(name) {
  return {
    name,
    source: IMPROVE_PROJECT_SOURCE.MANUAL,
    sourceLabel: '공통/수동 등록',
    createdAt: new Date().toISOString(),
    status: 'active',
  };
}

export function isSharedImproveProject(project) {
  if (!project) return false;
  return !project.ownerMemberId || project.source === IMPROVE_PROJECT_SOURCE.MANUAL;
}

/** 구성원 일지 — 본인 전용 + 공통(수동/owner 없음) 과제만 */
export function filterImproveProjectsForMember(projects = [], memberCode) {
  if (!memberCode) {
    return projects.filter((p) => isSharedImproveProject(p));
  }
  return projects.filter(
    (p) => isSharedImproveProject(p) || p.ownerMemberId === memberCode
  );
}

export function formatImproveProjectOwnerLine(project, formatMemberCode = (code) => code) {
  if (!project) return '';
  if (isSharedImproveProject(project)) {
    return project.sourceLabel || '공통/수동 등록';
  }
  const code = project.ownerMemberId;
  const name = project.ownerName;
  const label = formatMemberCode(code);
  return name ? `담당/출처: ${label}(${name})` : `담당/출처: ${label}`;
}

export function formatCandidateMemberSummary(sources = [], formatMemberCode = (code) => code) {
  const codes = [...new Set(sources.map((s) => s.memberCode).filter(Boolean))];
  if (!codes.length) return '';
  return codes.map((code) => formatMemberCode(code)).join(' · ');
}

export function findRegisteredProjectForCandidate(candidate, projects = []) {
  if (!candidate?.title) return null;
  const key = improveProjectTitleKey(candidate.title);
  return projects.find((p) => improveProjectTitleKey(p.name) === key) || null;
}
