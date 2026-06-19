import { isVercelDeployedEnvironment } from '../constants/appEnv';
import { canAttemptCloudWrite, recordCloudFailure, recordCloudSuccess } from './cloudHealth';
import { apply2026PublicHolidaysToDays } from './journalHoliday2026';
import { mergeJournalSnapshotsByMember, mergeJournalSnapshotsViewOnlyImport, normalizeJournalCloudSnapshot } from './journalCloudSnapshot';
import { extractMemberKpiApprovalSlice } from './journalKpiApprovalSlice';
import { recalcDayMmFromHours } from './journalMm';
import { createEmptyMemberJournals } from './journalMemberStore';

export const JOURNAL_SNAPSHOT_PATH = '/journal-snapshot.json';
export const JOURNAL_API_PATH = '/api/journal-snapshot';
export const JOURNAL_STORAGE_KEY = 'tms-weekly-journal-v1';

function recalcMemberDays(days) {
  const next = apply2026PublicHolidaysToDays({ ...days });
  Object.values(next).forEach((day) => recalcDayMmFromHours(day));
  return next;
}

function hasKpiApprovalEntries(approval) {
  return Object.keys(approval.months).length || Object.keys(approval.kpi2RowStatus).length;
}

export function buildMemberJournalSnapshot(memberCode, slice = {}, kpiOperational = null) {
  const normalized = {
    days: slice.days || {},
    weekSummaries: slice.weekSummaries || {},
    nextWeekPlans: slice.nextWeekPlans || {},
    kpiWeekMemos: slice.kpiWeekMemos || {},
    prefs: slice.prefs || null,
  };
  if (slice.kpiApproval && typeof slice.kpiApproval === 'object') {
    normalized.kpiApproval = JSON.parse(JSON.stringify(slice.kpiApproval));
  }
  if (kpiOperational) {
    const approval = extractMemberKpiApprovalSlice(kpiOperational, memberCode, slice.days || {});
    if (hasKpiApprovalEntries(approval)) {
      normalized.kpiApproval = approval;
    }
  }
  return normalized;
}

export function buildJournalSnapshot(store, kpiOperational = null) {
  const memberJournals = store.memberJournals || createEmptyMemberJournals();
  const normalized = {};
  Object.entries(memberJournals).forEach(([code, slice]) => {
    normalized[code] = buildMemberJournalSnapshot(code, slice, kpiOperational);
  });

  return normalizeJournalCloudSnapshot({
    version: 1,
    publishedAt: new Date().toISOString(),
    meta: store.meta || {},
    memberJournals: normalized,
  });
}

export function normalizeJournalSnapshot(raw) {
  const normalized = normalizeJournalCloudSnapshot(raw);
  const memberJournals = {};
  Object.entries(normalized.memberJournals).forEach(([code, slice]) => {
    memberJournals[code] = {
      ...slice,
      days: recalcMemberDays(slice.days || {}),
    };
  });

  return {
    ...normalized,
    memberJournals,
  };
}

export function downloadJournalSnapshot(store, kpiOperational = null) {
  const payload = buildJournalSnapshot(store, kpiOperational);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const ts = payload.publishedAt.replace(/[:.]/g, '-').slice(0, 19);
  a.href = url;
  a.download = `journal-snapshot-${ts}.json`;
  a.click();
  URL.revokeObjectURL(url);
  return payload;
}

export function isJsonSnapshotResponse(res) {
  const ct = res.headers.get('content-type') || '';
  return /application\/(?:[\w.+-]*\+)?json/i.test(ct);
}

function inferSnapshotSource(path, headerSource) {
  if (headerSource === 'blob' || headerSource === 'static' || headerSource === 'empty') {
    return headerSource;
  }
  return path.startsWith('/api/') ? 'api' : 'static';
}

async function fetchSnapshotFrom(path) {
  const res = await fetch(`${path}?t=${Date.now()}`, { cache: 'no-store' });
  if (res.status === 404) return null;
  if (!isJsonSnapshotResponse(res)) {
    if (!res.ok) {
      recordCloudFailure(res.status, {});
      const err = new Error(`공유 일지를 불러오지 못했습니다 (${res.status})`);
      err.status = res.status;
      err.body = {};
      throw err;
    }
    return null;
  }

  const body = await res.json().catch(() => null);
  if (!body || !isJournalSnapshotImportable(body)) {
    if (!res.ok) {
      recordCloudFailure(res.status, body || {});
      const err = new Error(
        body?.message || body?.error || `공유 일지를 불러오지 못했습니다 (${res.status})`
      );
      err.status = res.status;
      err.body = body;
      throw err;
    }
    return null;
  }

  if (!res.ok) {
    recordCloudFailure(res.status, body);
    const err = new Error(body.message || body.error || `공유 일지를 불러오지 못했습니다 (${res.status})`);
    err.status = res.status;
    err.body = body;
    throw err;
  }

  recordCloudSuccess();
  const source = inferSnapshotSource(path, res.headers.get('x-journal-source'));
  return {
    snapshot: normalizeJournalSnapshot(body),
    source,
  };
}

/** @returns {Promise<{ snapshot: object, source: string } | null>} */
export async function fetchJournalSnapshot() {
  const api = await fetchSnapshotFrom(JOURNAL_API_PATH);
  if (api) return api;
  return fetchSnapshotFrom(JOURNAL_SNAPSHOT_PATH);
}

export async function saveJournalMemberSnapshot(memberCode, journal, updatedAt) {
  if (!isVercelDeployedEnvironment()) {
    throw new Error('개발 환경에서는 공유 저장이 차단됩니다.');
  }
  if (!canAttemptCloudWrite()) {
    const err = new Error('클라우드 공유가 일시 제한되었습니다. 잠시 후 다시 시도하세요.');
    err.reason = 'cloud-limited';
    throw err;
  }
  const res = await fetch(JOURNAL_API_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ memberCode, journal, updatedAt }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    recordCloudFailure(res.status, body);
    const err = new Error(body.message || body.error || `공유 일지 저장 실패 (${res.status})`);
    err.status = res.status;
    err.body = body;
    if (res.status === 409) {
      err.reason = 'conflict';
      err.snapshot = body.snapshot ? normalizeJournalSnapshot(body.snapshot) : null;
    }
    throw err;
  }
  recordCloudSuccess();
  return normalizeJournalSnapshot(body.snapshot);
}

export function getLocalJournalMeta() {
  try {
    const raw = localStorage.getItem(JOURNAL_STORAGE_KEY);
    if (!raw) return { updatedAt: null };
    const parsed = JSON.parse(raw);
    return { updatedAt: parsed.meta?.updatedAt || parsed.publishedAt || null };
  } catch {
    return { updatedAt: null };
  }
}

export function isRemoteNewer(remotePublishedAt, localUpdatedAt) {
  if (!remotePublishedAt) return false;
  if (!localUpdatedAt) return true;
  return new Date(remotePublishedAt).getTime() > new Date(localUpdatedAt).getTime();
}

export function isJournalSnapshotImportable(raw) {
  if (!raw || typeof raw !== 'object') return false;
  if (raw.memberJournals && typeof raw.memberJournals === 'object') return true;
  if (raw.days && typeof raw.days === 'object') return true;
  return false;
}

export function parseJournalSnapshotForImport(raw) {
  if (!isJournalSnapshotImportable(raw)) {
    throw new Error('공유 일지 형식이 올바르지 않습니다.');
  }
  return normalizeJournalSnapshot(raw);
}

/** local store({ memberJournals, meta }) + remote snapshot → import 병합 결과 store */
export function applyJournalSnapshotImport(localStore, remoteSnapshot) {
  const localSnapshot = normalizeJournalCloudSnapshot({
    publishedAt: localStore?.meta?.updatedAt || null,
    meta: localStore?.meta || {},
    memberJournals: localStore?.memberJournals || createEmptyMemberJournals(),
  });
  const merged = mergeJournalSnapshotsByMember(localSnapshot, remoteSnapshot, { importRemote: true });
  return {
    memberJournals: merged.memberJournals,
    meta: merged.meta,
  };
}

/** 구성원 조회용 — 본인 슬라이스는 유지, 타인만 remote 병합 */
export function applyJournalSnapshotViewOnlyImport(localStore, remoteSnapshot, ownMemberCode) {
  const localSnapshot = normalizeJournalCloudSnapshot({
    publishedAt: localStore?.meta?.updatedAt || null,
    meta: localStore?.meta || {},
    memberJournals: localStore?.memberJournals || createEmptyMemberJournals(),
  });
  const merged = mergeJournalSnapshotsViewOnlyImport(localSnapshot, remoteSnapshot, ownMemberCode);
  return {
    memberJournals: merged.memberJournals,
    meta: merged.meta,
  };
}

function isIsoAfter(left, right) {
  if (!left) return false;
  if (!right) return true;
  return new Date(left).getTime() > new Date(right).getTime();
}

function maxIso(left, right) {
  return isIsoAfter(left, right) ? left : right || left || null;
}

export function applySavedJournalMemberSnapshot(localStore, remoteSnapshot, memberCode) {
  const localSnapshot = normalizeJournalCloudSnapshot({
    publishedAt: localStore?.meta?.updatedAt || null,
    meta: localStore?.meta || {},
    memberJournals: localStore?.memberJournals || createEmptyMemberJournals(),
  });
  const remote = normalizeJournalCloudSnapshot(remoteSnapshot);
  const remoteUpdatedAt =
    remote.meta.memberUpdatedAt?.[memberCode] || remote.meta.updatedAt || remote.publishedAt || null;
  const memberUpdatedAt = { ...(localSnapshot.meta.memberUpdatedAt || {}) };
  if (remoteUpdatedAt) memberUpdatedAt[memberCode] = remoteUpdatedAt;
  const updatedAt = maxIso(localSnapshot.meta.updatedAt || localSnapshot.publishedAt, remote.publishedAt);

  return {
    memberJournals: {
      ...localSnapshot.memberJournals,
      [memberCode]: remote.memberJournals[memberCode],
    },
    meta: {
      ...localSnapshot.meta,
      updatedAt,
      memberUpdatedAt,
    },
  };
}

export function persistJournalStoreToLocalStorage(store, storageKey = JOURNAL_STORAGE_KEY) {
  localStorage.setItem(storageKey, JSON.stringify(store));
}
