import React, { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { useWeeklyJournal } from '../hooks/useWeeklyJournal';
import { useImproveProjects } from '../hooks/useImproveProjects';
import { useKpiOperational } from '../hooks/useKpiOperational';
import { computeTeamKpi } from '../utils/computeTeamKpi';
import { JOURNAL_LINKED_MEMBER_CODE } from '../constants/kpiMembers';
import { mergeJournalKpiApprovalImport } from '../utils/journalKpiApprovalSlice';

const JournalContext = createContext(null);

export function JournalProvider({ children, readOnly = false, autoSyncCloud = false }) {
  const journal = useWeeklyJournal({ readOnly, autoSyncCloud });
  const kpiApi = useKpiOperational({ readOnly });
  const improveProjectsApi = useImproveProjects({ readOnly });
  const migratedMemos = useRef(false);

  /** legacy: global operational 주간메모 → A 구성원 일지 슬라이스로 1회 이전 */
  useEffect(() => {
    if (readOnly || migratedMemos.current) return;
    const globalMemos = kpiApi.kpiWeekMemos || {};
    if (!Object.keys(globalMemos).length) {
      migratedMemos.current = true;
      return;
    }
    const aMemos = journal.getMemberKpiWeekMemos(JOURNAL_LINKED_MEMBER_CODE);
    if (Object.keys(aMemos).length > 0) {
      migratedMemos.current = true;
      return;
    }
    Object.entries(globalMemos).forEach(([key, text]) => {
      journal.setKpiWeekMemo(key, text, JOURNAL_LINKED_MEMBER_CODE);
    });
    migratedMemos.current = true;
  }, [readOnly, journal, kpiApi.kpiWeekMemos]);

  const importJournalBackup = async (file) => {
    const snapshot = await journal.importFromFile(file);
    if (!readOnly) {
      kpiApi.mergeJournalKpiApproval(snapshot);
    }
    return snapshot;
  };

  const importJournalViewOnlyBackup = async (file, ownMemberCode) => {
    return journal.importViewOnlyFromFile(file, ownMemberCode);
  };

  const value = useMemo(
    () => ({
      ...journal,
      ...kpiApi,
      kpiOperationalReadOnly: readOnly,
      improveProjects: improveProjectsApi.projects,
      improveProjectsApi,
      importJournalBackup,
      importJournalViewOnlyBackup,
      downloadJournalBackup: () => journal.downloadJournalBackup(kpiApi.kpiOperational),
      saveMemberToCloud: (memberCode) => journal.saveMemberToCloud(memberCode, kpiApi.kpiOperational),
    }),
    [journal, kpiApi, improveProjectsApi, readOnly]
  );

  return <JournalContext.Provider value={value}>{children}</JournalContext.Provider>;
}

export function useJournal() {
  const ctx = useContext(JournalContext);
  if (!ctx) {
    throw new Error('useJournal must be used within JournalProvider');
  }
  return ctx;
}

export function useTeamKpiMetrics(year, monthIndex, memberCode = JOURNAL_LINKED_MEMBER_CODE) {
  const { getMemberDays, getMemberKpiWeekMemos, improveProjects, kpiOperational, getMonthly01 } =
    useJournal();
  const monthly01 = getMonthly01(year, monthIndex, memberCode);
  const days = getMemberDays(memberCode);
  const kpiWeekMemos = getMemberKpiWeekMemos(memberCode);
  return useMemo(
    () =>
      computeTeamKpi({
        year,
        monthIndex,
        days,
        kpiWeekMemos,
        improveProjects,
        memberCode,
        kpi2RowStatus: kpiOperational?.kpi2RowStatus || {},
        monthly01,
      }),
    [year, monthIndex, days, kpiWeekMemos, improveProjects, memberCode, kpiOperational, monthly01]
  );
}
