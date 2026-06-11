import React, { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { useWeeklyJournal } from '../hooks/useWeeklyJournal';
import { useImproveProjects } from '../hooks/useImproveProjects';
import { useKpiOperational } from '../hooks/useKpiOperational';
import { computeTeamKpi } from '../utils/computeTeamKpi';
import { JOURNAL_LINKED_MEMBER_CODE } from '../constants/kpiMembers';

const JournalContext = createContext(null);

export function JournalProvider({ children, readOnly = false, autoSyncCloud = false }) {
  const journal = useWeeklyJournal({ readOnly, autoSyncCloud });
  const kpiApi = useKpiOperational({ readOnly });
  const improveProjectsApi = useImproveProjects({ readOnly });
  const migrated = useRef(false);

  useEffect(() => {
    if (readOnly || migrated.current) return;
    const legacy = journal.kpiWeekMemos;
    if (!legacy || !Object.keys(legacy).length) return;
    const current = kpiApi.kpiWeekMemos || {};
    if (Object.keys(current).length > 0) {
      migrated.current = true;
      return;
    }
    Object.entries(legacy).forEach(([key, text]) => {
      kpiApi.setKpiWeekMemo(key, text);
    });
    migrated.current = true;
  }, [readOnly, journal.kpiWeekMemos, kpiApi]);

  const value = useMemo(
    () => ({
      ...journal,
      ...kpiApi,
      kpiOperationalReadOnly: readOnly,
      kpiWeekMemos: kpiApi.kpiWeekMemos,
      getKpiWeekMemo: kpiApi.getKpiWeekMemo,
      setKpiWeekMemo: kpiApi.setKpiWeekMemo,
      improveProjects: improveProjectsApi.projects,
      improveProjectsApi,
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
  const { getMemberDays, kpiWeekMemos, improveProjects, kpiOperational, getMonthly01 } = useJournal();
  const monthly01 = getMonthly01(year, monthIndex, memberCode);
  const days = getMemberDays(memberCode);
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
