import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight, Printer } from 'lucide-react';
import { useJournal } from '../context/JournalProvider';
import { useJournalPeriod } from '../hooks/useJournalPeriod';
import { quarterKey } from '../constants/kpiOperationalStore';
import { buildTeamMonthlyReport, buildTeamQuarterReport } from '../utils/kpiReportData';
import { buildTeamIntegratedSummary } from '../utils/teamKpiAggregate';
import { KPI1_NAME, KPI2_NAME, KPI3_NAME } from '../constants/kpiDisplayNames';
import { KPI3_ELEMENTS } from '../constants/kpi3Elements';
import TeamKpiIntegratedSummary from '../components/TeamKpiIntegratedSummary';
import { uiTooltip } from '../utils/uiTooltip';
import './TeamKpiPage.css';
import './KpiReportPage.css';

function formatPct(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return `${Number(n).toFixed(1)}%`;
}

const MONTH_LABELS = Array.from({ length: 12 }, (_, i) => `${i + 1}월`);

export default function KpiReportPage() {
  const { year, month, changeMonth, setPeriod } = useJournalPeriod();
  const { getMemberDays, improveProjects, kpiOperational } = useJournal();

  const monthly = useMemo(
    () =>
      buildTeamMonthlyReport({
        year,
        monthIndex: month,
        getMemberDays,
        kpiOperational,
        improveProjects,
      }),
    [year, month, getMemberDays, kpiOperational, improveProjects]
  );

  const quarterly = useMemo(
    () => buildTeamQuarterReport({ year, monthIndex: month, kpiOperational }),
    [year, month, kpiOperational]
  );

  const team = useMemo(() => buildTeamIntegratedSummary(monthly, quarterly), [monthly, quarterly]);
  const yq = quarterKey(year, month);

  return (
    <main className="team-kpi-main kpi-report-page">
      <header className="team-kpi-header kpi-report-no-print">
        <div className="kpi-report-header-row">
          <div className="team-kpi-month-nav kpi-report-month-nav">
            <button
              type="button"
              className="journal-icon-btn"
              onClick={() => changeMonth(-1)}
              aria-label="이전 달"
              {...uiTooltip('이전 달 리포트')}
            >
              <ChevronLeft size={18} />
            </button>
            <h1>
              KPI 리포트 · {year}년 {month + 1}월
            </h1>
            <button
              type="button"
              className="journal-icon-btn"
              onClick={() => changeMonth(1)}
              aria-label="다음 달"
              {...uiTooltip('다음 달 리포트')}
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <button
            type="button"
            className="btn btn-secondary kpi-report-print-btn"
            onClick={() => window.print()}
            {...uiTooltip('이 화면을 인쇄하거나 PDF로 저장')}
          >
            <Printer size={16} /> 인쇄 / PDF
          </button>
        </div>
        <nav className="kpi-report-month-picker" aria-label="월별 리포트 선택">
          <div className="kpi-report-year-step">
            <button
              type="button"
              className="journal-icon-btn"
              onClick={() => setPeriod(year - 1, month)}
              aria-label="이전 연도"
              {...uiTooltip('이전 연도')}
            >
              <ChevronLeft size={16} />
            </button>
            <span className="kpi-report-month-picker__label">{year}년</span>
            <button
              type="button"
              className="journal-icon-btn"
              onClick={() => setPeriod(year + 1, month)}
              aria-label="다음 연도"
              {...uiTooltip('다음 연도')}
            >
              <ChevronRight size={16} />
            </button>
          </div>
          {MONTH_LABELS.map((label, monthIndex) => (
            <button
              key={label}
              type="button"
              className={`btn btn-secondary btn-sm${month === monthIndex ? ' is-active' : ''}`}
              onClick={() => setPeriod(year, monthIndex)}
              aria-current={month === monthIndex ? 'true' : undefined}
            >
              {label}
            </button>
          ))}
        </nav>
        <p className="team-kpi-hint kpi-report-period-hint">
          선택한 월의 월간 KPI·분기 {yq} 역량({KPI3_NAME}) 요약입니다. URL에 <code>year</code>,{' '}
          <code>month</code>가 저장됩니다.
        </p>
      </header>

      <TeamKpiIntegratedSummary
        year={year}
        month={month}
        yq={yq}
        monthly={monthly}
        quarterly={quarterly}
        variant="report"
      />

      <section className="kpi-report-block">
        <h2 className="kpi-report-member-title">구성원별 · 월간 KPI</h2>
        <table className="team-kpi-table">
          <thead>
            <tr>
              <th>구성원</th>
              <th>{KPI1_NAME}</th>
              <th>등급</th>
              <th>{KPI2_NAME}</th>
              <th>등급</th>
              <th>효과 건</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {monthly.map((row) => (
              <tr key={row.member.code}>
                <td>
                  {row.member.displayName} ({row.member.code})
                </td>
                <td>{formatPct(row.kpi1.utilization)}</td>
                <td>
                  <span className={`kpi-grade kpi-grade--${row.grade1}`}>{row.grade1}</span>
                </td>
                <td>
                  {formatPct(row.kpi2DisplayPct)}
                  {row.kpi2UsesPreview ? ' *' : ''}
                </td>
                <td>
                  <span className={`kpi-grade kpi-grade--${row.grade2}`}>{row.grade2}</span>
                </td>
                <td>{row.kpi2.effectCount}</td>
                <td>{row.status}</td>
              </tr>
            ))}
            <tr className="kpi-report-team-row">
              <td>
                <strong>팀 통합</strong>
              </td>
              <td>{formatPct(team.kpi1.utilization)}</td>
              <td>
                <span className={`kpi-grade kpi-grade--${team.grade1}`}>{team.grade1}</span>
              </td>
              <td>
                {formatPct(team.kpi2.displayPct)}
                {team.kpi2.usesPreview ? ' *' : ''}
              </td>
              <td>
                <span className={`kpi-grade kpi-grade--${team.grade2}`}>{team.grade2}</span>
              </td>
              <td>{team.kpi2.submittedCount ?? 0}</td>
              <td>—</td>
            </tr>
          </tbody>
        </table>
        <p className="team-kpi-hint">
          팀 {KPI1_NAME}: {team.kpi1.formula} · 팀 {KPI2_NAME}: {team.kpi2.formula} · KPI2 * = 승인 전
          포함
        </p>
      </section>

      <section className="kpi-report-block">
        <h2 className="kpi-report-member-title">
          구성원별 · 분기 {KPI3_NAME} · {yq}
        </h2>
        <table className="team-kpi-table">
          <thead>
            <tr>
              <th>구성원</th>
              {KPI3_ELEMENTS.map((el) => (
                <th key={el.key}>
                  {el.label}
                  <span className="team-kpi-th-weight"> ({el.weightPct}%)</span>
                </th>
              ))}
              <th>종합</th>
              <th>등급</th>
              <th>확정</th>
              <th>월 메모</th>
            </tr>
          </thead>
          <tbody>
            {quarterly.map((row) => (
              <tr key={row.member.code}>
                <td>
                  {row.member.displayName} ({row.member.code})
                </td>
                {KPI3_ELEMENTS.map((el) => (
                  <td key={el.key}>{row.breakdown?.[el.key] > 0 ? row.breakdown[el.key] : '—'}</td>
                ))}
                <td>{row.quarter.composite > 0 ? row.quarter.composite : '—'}</td>
                <td>
                  <span className={`kpi-grade kpi-grade--${row.grade3}`}>{row.grade3}</span>
                </td>
                <td>{row.locked ? '확정' : '작성중'}</td>
                <td>{row.memos.length}</td>
              </tr>
            ))}
            <tr className="kpi-report-team-row">
              <td>
                <strong>팀 통합</strong>
              </td>
              {KPI3_ELEMENTS.map((el) => (
                <td key={el.key}>{team.kpi3[el.key] > 0 ? team.kpi3[el.key] : '—'}</td>
              ))}
              <td>{team.kpi3.composite > 0 ? team.kpi3.composite : '—'}</td>
              <td>
                <span className={`kpi-grade kpi-grade--${team.grade3}`}>{team.grade3}</span>
              </td>
              <td>—</td>
              <td>—</td>
            </tr>
          </tbody>
        </table>
        <p className="team-kpi-hint">
          팀 {KPI3_NAME}: {team.kpi3.formula} · 레벨 * = 역량 평가 분기 평균 자동 반영(개인)
        </p>
      </section>
    </main>
  );
}
