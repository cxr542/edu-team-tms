import { TEAM_KPI_MEMBERS } from '../constants/kpiMembers.js';
import {
  createEmptyMemberJournals,
  emptyMemberJournal,
  normalizeMemberJournalSlice,
} from './journalMemberStore.js';
import { mergeKpiApprovalSlices } from './journalKpiApprovalSlice.js';

export const JOURNAL_CLOUD_SNAPSHOT_VERSION = 1;
export const JOURNAL_MEMBER_CODES = TEAM_KPI_MEMBERS.map((m) => m.code);

function nowIso() {
  return new Date().toISOString();
}

function isValidMemberCode(code) {
  return JOURNAL_MEMBER_CODES.includes(code);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeMemberUpdatedAt(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return Object.fromEntries(
    JOURNAL_MEMBER_CODES
      .map((code) => [code, typeof source[code] === 'string' ? source[code] : null])
      .filter(([, value]) => value)
  );
}

export function isMemberJournalEmpty(slice) {
  const normalized = normalizeMemberJournalSlice(slice);
  return (
    Object.keys(normalized.days || {}).length === 0 &&
    Object.keys(normalized.weekSummaries || {}).length === 0 &&
    Object.keys(normalized.nextWeekPlans || {}).length === 0 &&
    Object.keys(normalized.kpiWeekMemos || {}).length === 0 &&
    !normalized.prefs &&
    !normalized.kpiApproval
  );
}

/** 클라이언트 updatedAt이 서버 member slice보다 오래되었는지 */
export function isMemberJournalWriteStale(snapshot, memberCode, clientUpdatedAt) {
  if (!isValidMemberCode(memberCode)) return false;
  const current = normalizeJournalCloudSnapshot(snapshot);
  const serverAt = current.meta.memberUpdatedAt?.[memberCode] || null;
  if (!serverAt) return false;
  if (!clientUpdatedAt) return true;
  const clientTime = new Date(clientUpdatedAt).getTime();
  const serverTime = new Date(serverAt).getTime();
  if (!Number.isFinite(clientTime)) return true;
  if (!Number.isFinite(serverTime)) return false;
  return clientTime < serverTime;
}

/**
 * 단일 멤버 cloud/Supabase 응답을 로컬 store에 반영 — 다른 멤버 slice/meta는 유지.
 * @param {{ force?: boolean }} [options] force=true면 로컬이 더 최신이어도 원격으로 덮어씀 (J5 수동 가져오기)
 */
export function applyRemoteMemberJournalSave(localStore, remoteSnapshot, memberCode, options = {}) {
  if (!isValidMemberCode(memberCode)) {
    throw new Error('A/B/C 구성원 코드가 필요합니다.');
  }
  const force = Boolean(options?.force);
  const remote = normalizeJournalCloudSnapshot(remoteSnapshot);
  const remoteMemberAt = remote.meta.memberUpdatedAt?.[memberCode] || remote.meta.updatedAt || null;
  const local = normalizeJournalCloudSnapshot({
    publishedAt: localStore?.meta?.updatedAt || null,
    meta: localStore?.meta || {},
    memberJournals: localStore?.memberJournals || createEmptyMemberJournals(),
  });
  if (!force && isNewer(memberTime(local, memberCode), remoteMemberAt)) {
    return localStore;
  }
  const remoteSlice = remote.memberJournals[memberCode];
  const memberJournals = {
    ...(localStore?.memberJournals || createEmptyMemberJournals()),
    [memberCode]: clone(remoteSlice || emptyMemberJournal()),
  };
  return {
    ...localStore,
    memberJournals,
    meta: {
      ...(localStore?.meta || {}),
      updatedAt: remote.meta.updatedAt || localStore?.meta?.updatedAt || null,
      memberUpdatedAt: {
        ...(localStore?.meta?.memberUpdatedAt || {}),
        ...(remoteMemberAt ? { [memberCode]: remoteMemberAt } : {}),
      },
    },
  };
}

export function normalizeJournalCloudSnapshot(raw, { publishedAt = nowIso() } = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const snapshotAt = typeof source.publishedAt === 'string' ? source.publishedAt : publishedAt;
  const memberJournals = createEmptyMemberJournals();

  if (source.memberJournals && typeof source.memberJournals === 'object') {
    JOURNAL_MEMBER_CODES.forEach((code) => {
      memberJournals[code] = normalizeMemberJournalSlice(source.memberJournals[code]);
    });
  } else if (source.days && typeof source.days === 'object') {
    const legacyMember = isValidMemberCode(source.member) ? source.member : 'A';
    memberJournals[legacyMember] = normalizeMemberJournalSlice({
      days: source.days,
      weekSummaries: source.weekSummaries,
      nextWeekPlans: source.nextWeekPlans,
      kpiWeekMemos: source.kpiWeekMemos,
      prefs: source.prefs,
    });
  }

  const sourceMeta = source.meta && typeof source.meta === 'object' ? source.meta : {};
  const memberUpdatedAt = normalizeMemberUpdatedAt(sourceMeta.memberUpdatedAt);
  JOURNAL_MEMBER_CODES.forEach((code) => {
    if (!memberUpdatedAt[code] && !isMemberJournalEmpty(memberJournals[code])) {
      memberUpdatedAt[code] = snapshotAt;
    }
  });

  return {
    version: JOURNAL_CLOUD_SNAPSHOT_VERSION,
    publishedAt: snapshotAt,
    meta: {
      ...sourceMeta,
      updatedAt: typeof sourceMeta.updatedAt === 'string' ? sourceMeta.updatedAt : snapshotAt,
      memberUpdatedAt,
    },
    memberJournals,
  };
}

function memberTime(snapshot, code) {
  const normalized = normalizeJournalCloudSnapshot(snapshot);
  return (
    normalized.meta.memberUpdatedAt?.[code] ||
    (!isMemberJournalEmpty(normalized.memberJournals[code]) ? normalized.meta.updatedAt : null)
  );
}

function isNewer(left, right) {
  if (!left) return false;
  if (!right) return true;
  return new Date(left).getTime() > new Date(right).getTime();
}

function maxIso(left, right) {
  if (!left) return right || null;
  if (!right) return left || null;
  return isNewer(left, right) ? left : right;
}

/** 공유 일지 가져오기 — remote의 day/week 필드를 local에 병합(remote 우선), local-only 키 유지 */
export function mergeMemberJournalSlicesImport(localSlice, remoteSlice) {
  const local = normalizeMemberJournalSlice(localSlice);
  const remote = normalizeMemberJournalSlice(remoteSlice);
  if (isMemberJournalEmpty(remote)) {
    return clone(local);
  }
  const merged = {
    days: { ...local.days, ...remote.days },
    weekSummaries: { ...local.weekSummaries, ...remote.weekSummaries },
    nextWeekPlans: { ...local.nextWeekPlans, ...remote.nextWeekPlans },
    kpiWeekMemos: { ...local.kpiWeekMemos, ...remote.kpiWeekMemos },
    prefs: remote.prefs ?? local.prefs,
  };
  if (remote.kpiApproval) {
    merged.kpiApproval = clone(remote.kpiApproval);
  } else if (local.kpiApproval) {
    merged.kpiApproval = clone(local.kpiApproval);
  }
  return clone(merged);
}

export function mergeJournalSnapshotsByMember(
  localSnapshot,
  remoteSnapshot,
  { preferRemote = false, importRemote = false } = {}
) {
  const local = normalizeJournalCloudSnapshot(localSnapshot);
  const remote = normalizeJournalCloudSnapshot(remoteSnapshot);
  const memberJournals = createEmptyMemberJournals();
  const memberUpdatedAt = {};

  JOURNAL_MEMBER_CODES.forEach((code) => {
    const localSlice = local.memberJournals[code] || emptyMemberJournal();
    const remoteSlice = remote.memberJournals[code] || emptyMemberJournal();

    if (importRemote) {
      const merged = mergeMemberJournalSlicesImport(localSlice, remoteSlice);
      memberJournals[code] = merged;
      if (!isMemberJournalEmpty(merged)) {
        memberUpdatedAt[code] = maxIso(memberTime(local, code), memberTime(remote, code)) || remote.publishedAt;
      }
      return;
    }

    const localEmpty = isMemberJournalEmpty(localSlice);
    const remoteEmpty = isMemberJournalEmpty(remoteSlice);
    const useRemote =
      (!remoteEmpty && localEmpty) ||
      (!remoteEmpty &&
        (preferRemote || isNewer(memberTime(remote, code), memberTime(local, code))));
    const selected = useRemote ? remoteSlice : localSlice;
    memberJournals[code] = clone(selected);
    const selectedAt = useRemote ? memberTime(remote, code) : memberTime(local, code);
    if (selectedAt && !isMemberJournalEmpty(selected)) memberUpdatedAt[code] = selectedAt;
  });

  const publishedAt = isNewer(remote.publishedAt, local.publishedAt) ? remote.publishedAt : local.publishedAt;
  return normalizeJournalCloudSnapshot({
    version: JOURNAL_CLOUD_SNAPSHOT_VERSION,
    publishedAt,
    meta: { updatedAt: publishedAt, memberUpdatedAt },
    memberJournals,
  });
}

/** 구성원 조회용 — ownMemberCode 슬라이스는 local 유지, 나머지만 remote 병합 */
export function mergeJournalSnapshotsViewOnlyImport(localSnapshot, remoteSnapshot, ownMemberCode) {
  if (!isValidMemberCode(ownMemberCode)) {
    throw new Error('A/B/C 구성원 코드가 필요합니다.');
  }
  const local = normalizeJournalCloudSnapshot(localSnapshot);
  const remote = normalizeJournalCloudSnapshot(remoteSnapshot);
  const memberJournals = createEmptyMemberJournals();
  const memberUpdatedAt = { ...local.meta.memberUpdatedAt };

  JOURNAL_MEMBER_CODES.forEach((code) => {
    if (code === ownMemberCode) {
      memberJournals[code] = clone(local.memberJournals[code] || emptyMemberJournal());
      return;
    }
    const localSlice = local.memberJournals[code] || emptyMemberJournal();
    const remoteSlice = remote.memberJournals[code] || emptyMemberJournal();
    const merged = mergeMemberJournalSlicesImport(localSlice, remoteSlice);
    memberJournals[code] = merged;
    if (!isMemberJournalEmpty(merged)) {
      memberUpdatedAt[code] =
        maxIso(memberTime(local, code), memberTime(remote, code)) || remote.publishedAt;
    }
  });

  return normalizeJournalCloudSnapshot({
    version: JOURNAL_CLOUD_SNAPSHOT_VERSION,
    publishedAt: local.publishedAt,
    meta: {
      ...local.meta,
      memberUpdatedAt,
      viewOnlyImportedAt: remote.publishedAt,
    },
    memberJournals,
  });
}

export function isJournalMemberUpdateStale(snapshot, memberCode, updatedAt) {
  if (!isValidMemberCode(memberCode)) {
    throw new Error('A/B/C 구성원 코드가 필요합니다.');
  }
  const current = normalizeJournalCloudSnapshot(snapshot);
  return isNewer(memberTime(current, memberCode), updatedAt);
}

export function mergeMemberIntoJournalSnapshot(snapshot, memberCode, journal, { updatedAt = nowIso() } = {}) {
  if (!isValidMemberCode(memberCode)) {
    throw new Error('A/B/C 구성원 코드가 필요합니다.');
  }
  const current = normalizeJournalCloudSnapshot(snapshot, { publishedAt: updatedAt });
  const incomingSlice = normalizeMemberJournalSlice(journal);
  const mergedApproval = mergeKpiApprovalSlices(
    current.memberJournals[memberCode]?.kpiApproval,
    incomingSlice.kpiApproval,
    memberCode
  );
  const nextMemberSlice = { ...incomingSlice };
  if (mergedApproval) {
    nextMemberSlice.kpiApproval = mergedApproval;
  } else {
    delete nextMemberSlice.kpiApproval;
  }
  return normalizeJournalCloudSnapshot({
    ...current,
    publishedAt: updatedAt,
    meta: {
      ...current.meta,
      updatedAt,
      memberUpdatedAt: {
        ...current.meta.memberUpdatedAt,
        [memberCode]: updatedAt,
      },
    },
    memberJournals: {
      ...current.memberJournals,
      [memberCode]: nextMemberSlice,
    },
  });
}
