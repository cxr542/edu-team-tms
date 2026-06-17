import React, { useMemo } from 'react';
import { Send, Undo2 } from 'lucide-react';
import { KPI_APPROVAL_REQUEST } from '../constants/kpiApprovalRequest';
import { KPI1_NAME, KPI2_NAME } from '../constants/kpiDisplayNames';
import { defaultMonthly01 } from '../constants/kpiOperationalStore';
import {
  canSubmitKpiRecord,
  canWithdrawMonthly01,
  formatKpiStatusLabel,
  KPI_STATUS,
} from '../constants/kpiStatuses';
import { useJournal, useTeamKpiMetrics } from '../context/JournalProvider';
import { isEditorMode } from '../utils/appMode';
import { apply01cToMonthly01 } from '../utils/kpiMonthlyClose';
import { uiTooltip } from '../utils/uiTooltip';
import MemberJournalDialog from './MemberJournalDialog';
import './MemberKpiApprovalPanel.css';

function statusClass(status) {
  if (status === KPI_STATUS.APPROVED) return 'is-approved';
  if (status === KPI_STATUS.SUBMITTED) return 'is-pending';
  if (status === KPI_STATUS.REJECTED) return 'is-rejected';
  return 'is-draft';
}

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
        `${month + 1}월 KPI1 ${formatKpiStatusLabel(monthly01.status)}`,
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
  }, [metrics.rows02Effect, monthly01, monthly01Stored, month, readOnly]);
}

function MemberKpiApprovalBody({
  year,
  month,
  memberCode,
  memberLabel,
  onToast,
  embedded = false,
}) {
  const journal = useJournal();
  const metrics = useTeamKpiMetrics(year, month, memberCode);
  const monthly01Stored = journal.getMonthly01(year, month, memberCode);
  const monthly01 = monthly01Stored ?? defaultMonthly01();
  const readOnly = journal.kpiOperationalReadOnly || !isEditorMode();

  const canRequestKpi1 = canSubmitKpiRecord(monthly01.status) && !readOnly;
  const canWithdrawKpi1 = canWithdrawMonthly01(monthly01.status, monthly01Stored) && !readOnly;

  const effectRows = metrics.rows02Effect || [];
  const actionableKpi2 = effectRows.filter(
    (row) =>
      row.taskId &&
      !readOnly &&
      (canSubmitKpiRecord(row.상태) || row.상태 === KPI_STATUS.SUBMITTED)
  );

  const requestKpi1Approval = () => {
    const mmPatch = apply01cToMonthly01(
      metrics.month01cTotals,
      monthly01,
      metrics.kpi1.available
    );
    journal.updateMonthly01(year, month, memberCode, {
      ...mmPatch,
      status: KPI_STATUS.SUBMITTED,
      submittedAt: new Date().toISOString(),
      rejectReason: '',
    });
    onToast?.(`${month + 1}월 ${KPI1_NAME} 승인 요청을 보냈습니다`);
  };

  const withdrawKpi1Approval = () => {
    if (!window.confirm('승인 대기 중인 월 확정 요청을 취소할까요?')) return;
    journal.withdrawMonthly01(year, month, memberCode);
    onToast?.('월 확정 승인 요청을 취소했습니다');
  };

  const requestKpi2Approval = (row) => {
    if (!row.taskId) return;
    journal.submitKpi2Row(memberCode, row.dayKey, row.taskId);
    onToast?.(`「${row.업무명}」 ${KPI2_NAME} 승인 요청`);
  };

  const hasAction =
    canRequestKpi1 ||
    canWithdrawKpi1 ||
    actionableKpi2.length > 0 ||
    monthly01.status === KPI_STATUS.REJECTED;

  return (
    <>
      {embedded && (
        <p className="team-kpi-hint member-kpi-approval__hint">{KPI_APPROVAL_REQUEST.sectionHint}</p>
      )}
      <div className="member-kpi-approval__compact-body">
        {!hasAction && (
          <p className="team-kpi-hint member-kpi-approval__idle">
            지금 요청할 항목이 없습니다. 일지 작성 후 필요할 때 요청하세요.
          </p>
        )}

        {(canRequestKpi1 || canWithdrawKpi1 || monthly01.status === KPI_STATUS.REJECTED) && (
          <div className="member-kpi-approval__row">
            <div className="member-kpi-approval__row-main">
              <strong>{KPI1_NAME} 월 확정</strong>
              <span className={`member-kpi-approval__status ${statusClass(monthly01.status)}`}>
                {formatKpiStatusLabel(monthly01.status)}
              </span>
            </div>
            <div className="member-kpi-approval__actions">
              {canRequestKpi1 && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={requestKpi1Approval}
                  {...uiTooltip(KPI_APPROVAL_REQUEST.requestKpi1Hint, undefined, { wrap: true })}
                >
                  <Send size={14} aria-hidden /> {KPI_APPROVAL_REQUEST.requestKpi1}
                </button>
              )}
              {canWithdrawKpi1 && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={withdrawKpi1Approval}
                >
                  <Undo2 size={14} aria-hidden /> {KPI_APPROVAL_REQUEST.withdrawKpi1}
                </button>
              )}
            </div>
            {monthly01.status === KPI_STATUS.REJECTED && monthly01.rejectReason && (
              <p className="member-kpi-approval__reject">반려: {monthly01.rejectReason}</p>
            )}
          </div>
        )}

        {actionableKpi2.map((row, i) => {
          const canRequest = canSubmitKpiRecord(row.상태) && row.taskId && !readOnly;
          const canWithdrawRow = row.상태 === KPI_STATUS.SUBMITTED && row.taskId && !readOnly;
          return (
            <div key={`${row.dayKey}-${row.taskId || i}`} className="member-kpi-approval__row">
              <div className="member-kpi-approval__row-main">
                <strong>{row.업무명}</strong>
                <span className={`member-kpi-approval__status ${statusClass(row.상태)}`}>
                  {formatKpiStatusLabel(row.상태)}
                </span>
              </div>
              <div className="member-kpi-approval__actions">
                {canRequest && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => requestKpi2Approval(row)}
                  >
                    <Send size={14} aria-hidden /> {KPI_APPROVAL_REQUEST.requestKpi2}
                  </button>
                )}
                {canWithdrawRow && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      journal.setKpi2RowStatus(memberCode, row.dayKey, row.taskId, {
                        status: KPI_STATUS.DRAFT,
                        submittedAt: null,
                        rejectReason: '',
                      });
                      onToast?.('효과 건 승인 요청을 취소했습니다');
                    }}
                  >
                    <Undo2 size={14} aria-hidden /> 요청 취소
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {embedded && memberLabel && (
        <p className="team-kpi-hint member-kpi-approval__footer">
          {memberLabel} · 승인 결과는 관리자 「KPI 승인」 및 KPI 리포트에 반영됩니다.
        </p>
      )}
    </>
  );
}

export default function MemberKpiApprovalPanel({
  year,
  month,
  memberCode,
  memberLabel,
  onToast,
  compact = false,
  embedded = false,
  dialogOpen = false,
  onDialogClose,
}) {
  const toolbar = useMemberKpiApprovalToolbarState(year, month, memberCode);

  if (embedded) {
    if (!dialogOpen) return null;
    return (
      <MemberJournalDialog
        open={dialogOpen}
        onClose={onDialogClose}
        title={KPI_APPROVAL_REQUEST.sectionTitle}
        titleId="member-kpi-approval-dialog-title"
        wide
      >
        <MemberKpiApprovalBody
          year={year}
          month={month}
          memberCode={memberCode}
          memberLabel={memberLabel}
          onToast={onToast}
          embedded
        />
      </MemberJournalDialog>
    );
  }

  if (compact) {
    return (
      <details
        className="member-kpi-approval member-kpi-approval--compact"
        open={toolbar.needsAttention}
      >
        <summary className="member-kpi-approval__summary">
          <span className="member-kpi-approval__summary-title">KPI 승인 요청</span>
          <span className="member-kpi-approval__summary-meta">{toolbar.summaryMeta}</span>
        </summary>
        <MemberKpiApprovalBody
          year={year}
          month={month}
          memberCode={memberCode}
          onToast={onToast}
        />
      </details>
    );
  }

  return (
    <section className="member-kpi-approval" aria-labelledby="member-kpi-approval-heading">
      <h2 id="member-kpi-approval-heading" className="member-kpi-approval__title">
        {KPI_APPROVAL_REQUEST.sectionTitle}
      </h2>
      <MemberKpiApprovalBody
        year={year}
        month={month}
        memberCode={memberCode}
        memberLabel={memberLabel}
        onToast={onToast}
        embedded
      />
    </section>
  );
}
