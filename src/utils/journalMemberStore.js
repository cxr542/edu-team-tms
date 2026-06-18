import { stripLegacyWeekColumnEntries } from '../constants/journalCategories.js';
import { normalizeMemberPrefs } from './journalMemberPrefs.js';
import { TEAM_KPI_MEMBERS } from '../constants/kpiMembers.js';

export function emptyMemberJournal() {
  return {
    days: {},
    weekSummaries: {},
    nextWeekPlans: {},
    kpiWeekMemos: {},
    prefs: null,
  };
}

export function createEmptyMemberJournals() {
  return Object.fromEntries(TEAM_KPI_MEMBERS.map((m) => [m.code, emptyMemberJournal()]));
}

export function normalizeMemberJournalSlice(raw) {
  if (!raw || typeof raw !== 'object') return emptyMemberJournal();
  const slice = {
    days: raw.days && typeof raw.days === 'object' ? { ...raw.days } : {},
    weekSummaries: stripLegacyWeekColumnEntries(raw.weekSummaries),
    nextWeekPlans: stripLegacyWeekColumnEntries(raw.nextWeekPlans),
    kpiWeekMemos: raw.kpiWeekMemos && typeof raw.kpiWeekMemos === 'object' ? { ...raw.kpiWeekMemos } : {},
    prefs: raw.prefs ? normalizeMemberPrefs(raw.prefs) : null,
  };
  if (raw.kpiApproval && typeof raw.kpiApproval === 'object') {
    slice.kpiApproval = JSON.parse(JSON.stringify(raw.kpiApproval));
  }
  return slice;
}

/** legacy flat store → memberJournals */
export function migrateJournalStore(parsed, { seedDaysForA = {}, seedKpiWeekMemosForA = {} } = {}) {
  const memberJournals = createEmptyMemberJournals();

  if (parsed?.memberJournals && typeof parsed.memberJournals === 'object') {
    TEAM_KPI_MEMBERS.forEach(({ code }) => {
      memberJournals[code] = normalizeMemberJournalSlice(parsed.memberJournals[code]);
    });
  } else {
    memberJournals.A = normalizeMemberJournalSlice({
      days: parsed?.days || seedDaysForA,
      weekSummaries: parsed?.weekSummaries,
      nextWeekPlans: parsed?.nextWeekPlans,
      kpiWeekMemos: parsed?.kpiWeekMemos || seedKpiWeekMemosForA,
    });
  }

  if (!Object.keys(memberJournals.A.days).length && seedDaysForA && Object.keys(seedDaysForA).length) {
    memberJournals.A.days = { ...seedDaysForA };
  }
  if (!Object.keys(memberJournals.A.kpiWeekMemos).length && seedKpiWeekMemosForA) {
    memberJournals.A.kpiWeekMemos = { ...seedKpiWeekMemosForA };
  }

  return {
    memberJournals: fillMemberJournalsFromA(memberJournals),
    meta: parsed?.meta || { updatedAt: parsed?.publishedAt || null },
  };
}

export function cloneMemberJournalSlice(slice) {
  return JSON.parse(JSON.stringify(slice || emptyMemberJournal()));
}

/** B·C 일지가 비어 있으면 A 샘플을 복사 (팀 KPI·리포트 데모용) */
export function fillMemberJournalsFromA(memberJournals, { force = false } = {}) {
  const source = memberJournals?.A;
  if (!source || !Object.keys(source.days || {}).length) return memberJournals;
  const next = { ...memberJournals };
  ['B', 'C'].forEach((code) => {
    const target = next[code] || emptyMemberJournal();
    if (force || !Object.keys(target.days || {}).length) {
      next[code] = cloneMemberJournalSlice(source);
    }
  });
  return next;
}

export function getMemberJournal(store, memberCode) {
  return store?.memberJournals?.[memberCode] || emptyMemberJournal();
}

export function memberJournalCodes(store) {
  return TEAM_KPI_MEMBERS.map((m) => m.code);
}
