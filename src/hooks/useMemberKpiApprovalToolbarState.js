import { useMemo } from 'react';
import { defaultMonthly01 } from '../constants/kpiOperationalStore';
import { kpiStatusLabelFor, ymKey } from '../constants/kpiApprovalPolicy';
import { canSubmitKpiRecord, canWithdrawMonthly01, KPI_STATUS } from '../constants/kpiStatuses';
import { useJournal, useTeamKpiMetrics } from '../context/JournalProvider';
import { isEditorMode } from '../utils/appMode';

export function useMemberKpiApprovalToolbarState(year, month, memberCode) {
  const journal = useJournal();
  const metrics = useTeamKpiMetrics(year, month, memberCode);
  const monthly01Stored = journal.getMonthly01(year, month, memberCode);
  const monthly01 = monthly01Stored ?? defaultMonthly01();
  const readOnly = journal.kpiOperationalReadOnly || !isEditorMode();

  return useMemo(() => {
    const effectRows = metrics.rows02Effect || [];
    const pendingKpi2 = effectRows.filter((r) => r.상태 === KPI_STATUS.SUBMITTED).length;
    const actionableKpi2 = effectRows.filter(
      (row) =>
        row.taskId &&
        !readOnly &&
        (canSubmitKpiRecord(row.상태) || row.상태 === KPI_STATUS.SUBMITTED)
    );
    const canRequestKpi1 = canSubmitKpiRecord(monthly01.status) && !readOnly;
    const canWithdrawKpi1 = canWithdrawMonthly01(monthly01.status, monthly01Stored) && !readOnly;
    const needsAttention =
      monthly01.status === KPI_STATUS.SUBMITTED ||
      monthly01.status === KPI_STATUS.REJECTED ||
      pendingKpi2 > 0;
    const actionCount =
      (canRequestKpi1 ? 1 : 0) +
      (canWithdrawKpi1 ? 1 : 0) +
      actionableKpi2.length +
      (monthly01.status === KPI_STATUS.REJECTED ? 1 : 0);

    return {
      summaryMeta: [
        `${month + 1}월 KPI1 ${kpiStatusLabelFor(monthly01.status, ymKey(year, month))}`,
        pendingKpi2 > 0
          ? `KPI2 대기 ${pendingKpi2}`
          : actionableKpi2.length > 0
            ? `KPI2 요청 가능 ${actionableKpi2.length}`
            : effectRows.length > 0
              ? `KPI2 ${effectRows.length}건`
              : 'KPI2 없음',
      ].join(' · '),
      needsAttention,
      actionCount,
      pendingKpi2,
    };
  }, [metrics.rows02Effect, monthly01, monthly01Stored, year, month, readOnly]);
}
