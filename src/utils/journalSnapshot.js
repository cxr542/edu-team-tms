import { apply2026PublicHolidaysToDays } from './journalHoliday2026';
import { recalcDayMmFromHours } from './journalMm';
import { createEmptyMemberJournals, migrateJournalStore } from './journalMemberStore';

export const JOURNAL_SNAPSHOT_PATH = '/journal-snapshot.json';
export const JOURNAL_STORAGE_KEY = 'tms-weekly-journal-v1';

function recalcMemberDays(days) {
  const next = apply2026PublicHolidaysToDays({ ...days });
  Object.values(next).forEach((day) => recalcDayMmFromHours(day));
  return next;
}

export function buildJournalSnapshot(store) {
  const memberJournals = store.memberJournals || createEmptyMemberJournals();
  const normalized = {};
  Object.entries(memberJournals).forEach(([code, slice]) => {
    normalized[code] = {
      days: slice.days || {},
      weekSummaries: slice.weekSummaries || {},
      nextWeekPlans: slice.nextWeekPlans || {},
      kpiWeekMemos: slice.kpiWeekMemos || {},
    };
  });

  return {
    publishedAt: new Date().toISOString(),
    memberJournals: normalized,
  };
}

export function normalizeJournalSnapshot(raw) {
  if (!raw || (typeof raw.days !== 'object' && typeof raw.memberJournals !== 'object')) {
    throw new Error('memberJournals 또는 days 객체가 필요합니다.');
  }

  const migrated = migrateJournalStore(raw);
  const memberJournals = {};
  Object.entries(migrated.memberJournals).forEach(([code, slice]) => {
    memberJournals[code] = {
      ...slice,
      days: recalcMemberDays(slice.days || {}),
    };
  });

  return {
    publishedAt: raw.publishedAt || new Date().toISOString(),
    memberJournals,
  };
}

export function downloadJournalSnapshot(store) {
  const payload = buildJournalSnapshot(store);
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

export async function fetchJournalSnapshot() {
  const res = await fetch(`${JOURNAL_SNAPSHOT_PATH}?t=${Date.now()}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`클라우드 일지를 불러오지 못했습니다 (${res.status})`);
  }
  return normalizeJournalSnapshot(await res.json());
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
