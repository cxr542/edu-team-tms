import { TEAM_KPI_MEMBERS } from '../constants/kpiMembers.js';
import {
  createEmptyMemberJournals,
  emptyMemberJournal,
  normalizeMemberJournalSlice,
} from './journalMemberStore.js';

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
    !normalized.prefs
  );
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

export function mergeJournalSnapshotsByMember(localSnapshot, remoteSnapshot, { preferRemote = false } = {}) {
  const local = normalizeJournalCloudSnapshot(localSnapshot);
  const remote = normalizeJournalCloudSnapshot(remoteSnapshot);
  const memberJournals = createEmptyMemberJournals();
  const memberUpdatedAt = {};

  JOURNAL_MEMBER_CODES.forEach((code) => {
    const localSlice = local.memberJournals[code] || emptyMemberJournal();
    const remoteSlice = remote.memberJournals[code] || emptyMemberJournal();
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

export function mergeMemberIntoJournalSnapshot(snapshot, memberCode, journal, { updatedAt = nowIso() } = {}) {
  if (!isValidMemberCode(memberCode)) {
    throw new Error('A/B/C 구성원 코드가 필요합니다.');
  }
  const current = normalizeJournalCloudSnapshot(snapshot, { publishedAt: updatedAt });
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
      [memberCode]: normalizeMemberJournalSlice(journal),
    },
  });
}
