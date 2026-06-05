import React, { useMemo } from 'react';
import { Send, Undo2 } from 'lucide-react';
import { KPI_APPROVAL_REQUEST } from '../constants/kpiApprovalRequest';
import { KPI1_NAME, KPI2_NAME } from '../constants/kpiDisplayNames';
import { defaultMonthly01 } from '../constants/kpiOperationalStore';
import { KPI_UI } from '../constants/kpiUiLabels';
import {
  canSubmitKpiRecord,
  canWithdrawMonthly01,
  formatKpiStatusLabel,
  KPI_STATUS,
} from '../constants/kpiStatuses';
import { useJournal, useTeamKpiMetrics } from '../context/JournalProvider';
import { isEditorMode } from '../utils/appMode';
import { apply01cToMonthly01, validate01cVsMonthly } from '../utils/kpiMonthlyClose';
import { uiTooltip } from '../utils/uiTooltip';
import './MemberKpiApprovalPanel.css';

function statusClass(status) {
  if (status === KPI_STATUS.APPROVED) return 'is-approved';
  if (status === KPI_STATUS.SUBMITTED) return 'is-pending';
  if (status === KPI_STATUS.REJECTED) return 'is-rejected';
  return 'is-draft';
}

export default function MemberKpiApprovalPanel({ year, month, memberCode, memberLabel, onToast }) {
  const journal = useJournal();
  const metrics = useTeamKpiMetrics(year, month, memberCode);
  const monthly01Stored = journal.getMonthly01(year, month, memberCode);
  const monthly01 = monthly01Stored ?? defaultMonthly01();
  const readOnly = journal.kpiOperationalReadOnly || !isEditorMode();

  const validation = useMemo(
    () => validate01cVsMonthly(metrics.month01cTotals, monthly01),
    [metrics.month01cTotals, monthly01]
  );

  const canRequestKpi1 = canSubmitKpiRecord(monthly01.status) && !readOnly;
  const canWithdrawKpi1 =
    canWithdrawMonthly01(monthly01.status, monthly01Stored) && !readOnly;

  const effectRows = metrics.rows02Effect || [];

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
    journal.submitKpi2Row(row.dayKey, row.taskId);
    onToast?.(`「${row.업무명}」 ${KPI2_NAME} 승인 요청`);
  };

  return (
    <section className="member-kpi-approval" aria-labelledby="member-kpi-approval-heading">
      <h2 id="member-kpi-approval-heading" className="member-kpi-approval__title">
        {KPI_APPROVAL_REQUEST.sectionTitle}
      </h2>
      <p className="team-kpi-hint member-kpi-approval__hint">{KPI_APPROVAL_REQUEST.sectionHint}</p>

      <article className="member-kpi-approval__card">
        <header className="member-kpi-approval__card-head">
          <h3>
            {KPI1_NAME} · {month + 1}월 월 확정
          </h3>
          <span className={`member-kpi-approval__status ${statusClass(monthly01.status)}`}>
            {formatKpiStatusLabel(monthly01.status)}
          </span>
        </header>
        <p className="team-kpi-hint member-kpi-approval__meta">
          {KPI_UI.weeklyRefLine(metrics.month01cTotals, metrics.kpi1.available.toFixed(2))}
        </p>
        {!validation.ok && canRequestKpi1 && (
          <p className="member-kpi-approval__warn">
            요청 시 일지 {KPI_UI.weeklyMmSum}가 월 확정 칸에 자동 반영됩니다.
          </p>
        )}
        {monthly01.status === KPI_STATUS.REJECTED && monthly01.rejectReason && (
          <p className="member-kpi-approval__reject">반려 사유: {monthly01.rejectReason}</p>
        )}
        {monthly01.status === KPI_STATUS.SUBMITTED && (
          <p className="member-kpi-approval__pending">팀장 승인 대기 중입니다.</p>
        )}
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
              {...uiTooltip(KPI_APPROVAL_REQUEST.withdrawKpi1Hint, undefined, { wrap: true })}
            >
              <Undo2 size={14} aria-hidden /> {KPI_APPROVAL_REQUEST.withdrawKpi1}
            </button>
          )}
        </div>
      </article>

      <article className="member-kpi-approval__card">
        <header className="member-kpi-approval__card-head">
          <h3>
            {KPI2_NAME} · 효과 건 ({effectRows.length}건)
          </h3>
        </header>
        {effectRows.length === 0 ? (
          <p className="team-kpi-hint">이번 달 KPI2 효과 건이 없습니다. 업무에 「효과 건」을 켜고 완료하세요.</p>
        ) : (
          <ul className="member-kpi-approval__kpi2-list">
            {effectRows.map((row, i) => {
              const rowStatus = journal.getKpi2RowStatus(row.dayKey, row.taskId);
              const canRequest = canSubmitKpiRecord(row.상태) && row.taskId && !readOnly;
              const canWithdrawRow =
                row.상태 === KPI_STATUS.SUBMITTED && row.taskId && !readOnly;
              return (
                <li key={`${row.dayKey}-${row.taskId || i}`} className="member-kpi-approval__kpi2-item">
                  <div className="member-kpi-approval__kpi2-main">
                    <strong>{row.업무명}</strong>
                    <span className="member-kpi-approval__kpi2-meta">
                      {row.완료일 ? String(row.완료일).slice(0, 10) : '—'} · 계획 {row.계획시간}h · 실작업{' '}
                      {row.실작업시간}h
                    </span>
                  </div>
                  <span className={`member-kpi-approval__status ${statusClass(row.상태)}`}>
                    {formatKpiStatusLabel(row.상태)}
                  </span>
                  {row.상태 === KPI_STATUS.REJECTED && rowStatus.rejectReason && (
                    <p className="member-kpi-approval__reject">반려: {rowStatus.rejectReason}</p>
                  )}
                  <div className="member-kpi-approval__actions">
                    {canRequest && (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => requestKpi2Approval(row)}
                        {...uiTooltip(KPI_APPROVAL_REQUEST.requestKpi2Hint)}
                      >
                        <Send size={14} aria-hidden /> {KPI_APPROVAL_REQUEST.requestKpi2}
                      </button>
                    )}
                    {canWithdrawRow && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          journal.setKpi2RowStatus(row.dayKey, row.taskId, {
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
                </li>
              );
            })}
          </ul>
        )}
      </article>

      <p className="team-kpi-hint member-kpi-approval__footer">
        {memberLabel} · 승인 결과는 팀장 「KPI 승인」 및 KPI 리포트에 반영됩니다.
      </p>
    </section>
  );
}
