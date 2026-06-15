import { findKpiMember } from '../constants/kpiMembers';
import { improveProjectTitleKey } from '../constants/improveProjects';
import { IMPROVE_PROJECT_BLOB_SHARE_ENABLED } from '../constants/improveProjectsShare';

export const IMPROVE_PROJECT_SOURCE = {
  MANUAL: 'manual',
  JOURNAL_CANDIDATE: 'journal-candidate',
};

export const IMPROVE_PROJECT_LOCAL_SCOPE_NOTICE = IMPROVE_PROJECT_BLOB_SHARE_ENABLED
  ? '향상 과제 운영 목록은 이 브라우저에 먼저 저장됩니다. 팀 공유가 필요할 때만 「팀 공유 저장」·「팀 공유본 가져오기」를 사용하세요. 자동 동기화는 사용하지 않습니다.'
  : '향상 과제 운영 목록은 이 브라우저에 먼저 저장됩니다. 구성원에게 전달할 때는 「구성원 전달용 JSON 다운로드」를 사용하세요. 자동 동기화는 사용하지 않습니다.';

export const IMPROVE_PROJECT_JOURNAL_SCOPE_NOTICE = IMPROVE_PROJECT_BLOB_SHARE_ENABLED
  ? '향상 과제 운영 목록은 이 브라우저에 저장됩니다. 팀장이 공유 저장한 목록은 「팀 공유본 가져오기」로 수동 반영하세요. 자동 동기화는 사용하지 않습니다.'
  : '향상 과제 운영 목록은 이 브라우저에 저장됩니다. 팀장에게 받은 JSON은 「팀장에게 받은 JSON 가져오기」로 수동 반영하세요. 자동 동기화는 사용하지 않습니다.';

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

/** 구성원 일지 — 본인 전용 + 공통(수동/owner 없음) 과제만 (업무 편집 연결용) */
export function filterImproveProjectsForMember(projects = [], memberCode) {
  if (!memberCode) {
    return projects.filter((p) => isSharedImproveProject(p));
  }
  return projects.filter(
    (p) => isSharedImproveProject(p) || p.ownerMemberId === memberCode
  );
}

/** 구성원 일지 — 일지 후보로 등록·팀장 운영 목록에 올라간 본인 담당 과제 */
export function isMemberJournalImproveProject(project, memberCode) {
  if (!project || !memberCode) return false;
  return (
    project.ownerMemberId === memberCode &&
    project.source === IMPROVE_PROJECT_SOURCE.JOURNAL_CANDIDATE
  );
}

/** 구성원 일지 패널 · 팀 공유 가져오기 — 위 조건과 동일 */
export function filterImproveProjectsOwnedByMember(projects = [], memberCode) {
  if (!memberCode) return [];
  return projects.filter((p) => isMemberJournalImproveProject(p, memberCode));
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

/** 팀 공유 가져오기 토스트 */
export function describeImproveProjectsShareImport(
  mergedProjects = [],
  memberCode,
  { ownedOnly = false } = {}
) {
  const total = mergedProjects.length;
  const visible = ownedOnly
    ? filterImproveProjectsOwnedByMember(mergedProjects, memberCode)
    : filterImproveProjectsForMember(mergedProjects, memberCode);
  if (total === 0) return '팀 공유본이 비어 있습니다';
  if (ownedOnly) {
    if (visible.length === 0) {
      return `팀 공유 ${total}건 병합 · 본인 담당 과제 없음`;
    }
    return `팀 공유 ${total}건 병합 · 본인 담당 ${visible.length}건`;
  }
  if (visible.length >= total) {
    return `팀 공유 향상 과제 ${total}건을 반영했습니다`;
  }
  const hidden = total - visible.length;
  return `팀 공유 ${total}건 병합 · 연결 가능 ${visible.length}건 (담당 타인 전용 ${hidden}건은 목록에서 제외)`;
}
