import React, { useCallback, useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, X } from 'lucide-react';
import AppModuleLink from '../components/AppModuleLink';
import { useJournal } from '../context/JournalProvider';
import { useJournalPeriod } from '../hooks/useJournalPeriod';
import { listPendingApprovals, summarizePendingApprovals } from '../utils/kpiReportData';
import { KPI1_NAME, KPI2_NAME, kpiTypeLabel } from '../constants/kpiDisplayNames';
import { URL_ACCESS_ADMIN } from '../constants/teamAccess';
import { uiTooltip } from '../utils/uiTooltip';
import './TeamKpiPage.css';
import './KpiReportPage.css';

function formatRequestedAt(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return null;
  }
}

export default function KpiApprovePage({ readOnly = false }) {
  const { year, month, changeMonth } = useJournalPeriod();
  const journal = useJournal();
  const {
    getMemberDays,
    improveProjects,
    kpiOperational,
    approveKpi1,
    rejectKpi1,
    approveKpi2Row,
    rejectKpi2Row,
  } = journal;
  const [toast, setToast] = useState('');
  const [rejecting, setRejecting] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const showToast = useCallback((msg) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 3200);
  }, []);

  const pending = useMemo(
    () =>
      listPendingApprovals({
        year,
        monthIndex: month,
        getMemberDays,
        kpiOperational,
        improveProjects,
      }),
    [year, month, getMemberDays, kpiOperational, improveProjects]
  );
  const pendingSummary = useMemo(() => summarizePendingApprovals(pending), [pending]);

  const handleReject = () => {
    if (!rejecting) return;
    const reason = rejectReason.trim() || '반려';
    if (rejecting.type === 'KPI1') {
      rejectKpi1(year, month, rejecting.member.code, reason);
      showToast(`${rejecting.member.displayName} ${KPI1_NAME} 반려`);
    } else {
      rejectKpi2Row(rejecting.member.code, rejecting.dayKey, rejecting.taskId, reason);
      showToast(`${KPI2_NAME} 효과 건 반려`);
    }
    setRejecting(null);
    setRejectReason('');
  };

  return (
    <main className="team-kpi-main kpi-approve-page">
      <header className="team-kpi-header">
        <div className="kpi-report-header-row">
          <div className="team-kpi-month-nav kpi-report-month-nav">
            <button
              type="button"
              className="journal-icon-btn"
              onClick={() => changeMonth(-1)}
              aria-label="이전 달"
              {...uiTooltip('이전 달 승인 대기')}
            >
              <ChevronLeft size={18} />
            </button>
            <h1>
              KPI 승인 · {year}년 {month + 1}월
            </h1>
            <button
              type="button"
              className="journal-icon-btn"
              onClick={() => changeMonth(1)}
              aria-label="다음 달"
              {...uiTooltip('다음 달 승인 대기')}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
        <p className="team-kpi-banner">
          구성원 일지에서 요청한 <strong>KPI1 월 확정</strong> · <strong>KPI2 효과 건</strong>을 이 화면에서 일괄 승인·반려합니다.
        </p>
        <p className="kpi-approve-summary" aria-live="polite">
          승인 대기 <strong>{pendingSummary.total}</strong>건
          {pendingSummary.total > 0 ? (
            <>
              {' '}
              · KPI1 <strong>{pendingSummary.kpi1}</strong> · KPI2 <strong>{pendingSummary.kpi2}</strong>
            </>
          ) : null}
        </p>
      </header>

      <section className="team-kpi-section">
        {pending.length === 0 && (
          <p className="team-kpi-hint">이 달 승인 대기 건이 없습니다. 구성원이 일지 하단 「KPI 승인 요청」에서 내면 여기에 모입니다.</p>
        )}
        <ul className="team-kpi-approve-list">
          {pending.map((item) => {
            const requested = formatRequestedAt(item.submittedAt);
            return (
              <li
                key={
                  item.type === 'KPI2'
                    ? `kpi2-${item.member.code}-${item.dayKey}-${item.taskId}`
                    : `kpi1-${item.member.code}`
                }
                className="team-kpi-approve-item"
              >
                <div>
                  <span className="team-kpi-approve-type">{kpiTypeLabel(item.type)}</span>
                  <strong>{item.label}</strong>
                  {requested && (
                    <p className="team-kpi-hint team-kpi-approve-requested">요청 시각 {requested}</p>
                  )}
                </div>
                {!readOnly && (
                  <div className="team-kpi-approve-actions">
                    <AppModuleLink
                      module="journal"
                      access={URL_ACCESS_ADMIN}
                      member={item.member.code}
                      year={year}
                      month={month + 1}
                      className="btn btn-secondary btn-sm"
                    >
                      업무일지 보기
                    </AppModuleLink>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        if (item.type === 'KPI1') {
                          approveKpi1(year, month, item.member.code);
                          showToast(`${item.member.displayName} ${KPI1_NAME} 승인`);
                        } else {
                          approveKpi2Row(item.member.code, item.dayKey, item.taskId);
                          showToast(`${KPI2_NAME} 승인`);
                        }
                      }}
                    >
                      <Check size={14} /> 승인
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setRejecting(item)}
                    >
                      <X size={14} /> 반려
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {rejecting && (
        <div className="team-kpi-modal-backdrop" role="dialog" aria-modal="true">
          <div className="team-kpi-modal">
            <h3>반려 사유</h3>
            <p className="muted">{rejecting.label}</p>
            <textarea
              className="form-input"
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="수정 후 재요청 안내"
            />
            <div className="team-kpi-modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setRejecting(null)}>
                취소
              </button>
              <button type="button" className="btn btn-primary" onClick={handleReject}>
                반려 저장
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="journal-toast">{toast}</div>}
    </main>
  );
}
