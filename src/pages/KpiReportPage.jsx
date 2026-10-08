import React, { useCallback, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Printer } from 'lucide-react';
import { useJournal } from '../context/JournalProvider';
import { useJournalPeriod } from '../hooks/useJournalPeriod';
import { quarterKey } from '../constants/kpiOperationalStore';
import { buildTeamMonthlyReport } from '../utils/kpiReportData';
import { buildTeamIntegratedSummary } from '../utils/teamKpiAggregate';
import { KPI3_NAME } from '../constants/kpiDisplayNames';
import TeamKpiIntegratedSummary from '../components/TeamKpiIntegratedSummary';
import { uiTooltip } from '../utils/uiTooltip';
import {
  KpiReportAnnualView,
  KpiReportQuarterView,
  MonthlyCompetencyCard,
  MonthlyCompetencyTable,
  MonthlyProductivityTable,
  MonthlyUtilizationTable,
} from '../components/KpiReportPeriodViews';
import {
  buildAnnualView,
  buildMonthlyCompetencyReport,
  buildQuarterView,
  monthIndexesOfQuarter,
  quarterOfMonthIndex,
} from '../utils/kpiReportPeriods';
import './TeamKpiPage.css';
import './KpiReportPage.css';

const MONTH_LABELS = Array.from({ length: 12 }, (_, i) => `${i + 1}월`);
const VIEWS = [
  ['monthly', '월간'],
  ['quarterly', '분기'],
  ['annual', '연간'],
];

function readViewFromUrl() {
  const v = new URLSearchParams(window.location.search).get('view');
  return VIEWS.some(([id]) => id === v) ? v : 'monthly';
}

export default function KpiReportPage() {
  const { year, month, changeMonth, setPeriod } = useJournalPeriod();
  const { getMemberDays, getMemberKpiWeekMemos, improveProjects, kpiOperational } = useJournal();

  const [view, setViewState] = useState(readViewFromUrl);
  const setView = useCallback((next) => {
    setViewState(next);
    const url = new URL(window.location.href);
    url.searchParams.set('view', next);
    window.history.replaceState({}, '', url);
  }, []);

  const quarter = quarterOfMonthIndex(month);
  const shiftQuarter = (delta) => {
    const q = quarter + delta;
    if (q < 1) setPeriod(year - 1, 9);
    else if (q > 4) setPeriod(year + 1, 0);
    else setPeriod(year, monthIndexesOfQuarter(q)[0]);
  };

  const yq = quarterKey(year, month);
  const ym = `${year}-${String(month + 1).padStart(2, '0')}`;

  // 월간: 구성원별 가동률·생산성 + 월별 레벨(역량) 평가 / 분기 평가(KPI3 4요소)는 분기 리포트에서 본다
  const monthly = useMemo(
    () =>
      view === 'monthly'
        ? buildTeamMonthlyReport({
            year,
            monthIndex: month,
            getMemberDays,
            getMemberKpiWeekMemos,
            kpiOperational,
            improveProjects,
          })
        : [],
    [view, year, month, getMemberDays, getMemberKpiWeekMemos, kpiOperational, improveProjects]
  );
  const noQuarterly = useMemo(() => [], []);
  const team = useMemo(() => buildTeamIntegratedSummary(monthly, noQuarterly), [monthly, noQuarterly]);
  const monthlyCompetency = useMemo(
    () =>
      view === 'monthly' ? buildMonthlyCompetencyReport({ year, monthIndex: month, kpiOperational }) : null,
    [view, year, month, kpiOperational]
  );

  const quarterView = useMemo(
    () =>
      view === 'quarterly'
        ? buildQuarterView({
            year,
            quarter,
            getMemberDays,
            getMemberKpiWeekMemos,
            kpiOperational,
            improveProjects,
          })
        : null,
    [view, year, quarter, getMemberDays, getMemberKpiWeekMemos, kpiOperational, improveProjects]
  );
  const annualView = useMemo(
    () =>
      view === 'annual'
        ? buildAnnualView({ year, getMemberDays, getMemberKpiWeekMemos, kpiOperational, improveProjects })
        : null,
    [view, year, getMemberDays, getMemberKpiWeekMemos, kpiOperational, improveProjects]
  );

  const titleText =
    view === 'monthly' ? `${year}년 ${month + 1}월` : view === 'quarterly' ? `${year}년 ${quarter}분기` : `${year}년`;
  const unitLabel = view === 'monthly' ? '달' : view === 'quarterly' ? '분기' : '해';
  const goPrev = () =>
    view === 'monthly' ? changeMonth(-1) : view === 'quarterly' ? shiftQuarter(-1) : setPeriod(year - 1, month);
  const goNext = () =>
    view === 'monthly' ? changeMonth(1) : view === 'quarterly' ? shiftQuarter(1) : setPeriod(year + 1, month);

  return (
    <main className="team-kpi-main kpi-report-page">
      <header className="team-kpi-header kpi-report-no-print">
        <div className="kpi-report-header-row">
          <div className="team-kpi-month-nav kpi-report-month-nav">
            <button
              type="button"
              className="journal-icon-btn"
              onClick={goPrev}
              aria-label={`이전 ${unitLabel}`}
              {...uiTooltip(`이전 ${unitLabel} 리포트`)}
            >
              <ChevronLeft size={18} />
            </button>
            <h1>KPI 리포트 · {titleText}</h1>
            <button
              type="button"
              className="journal-icon-btn"
              onClick={goNext}
              aria-label={`다음 ${unitLabel}`}
              {...uiTooltip(`다음 ${unitLabel} 리포트`)}
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
        <nav className="kpi-report-view-tabs" aria-label="리포트 보기 선택">
          {VIEWS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`btn btn-secondary btn-sm${view === id ? ' is-active' : ''}`}
              onClick={() => setView(id)}
              aria-current={view === id ? 'true' : undefined}
            >
              {label}
            </button>
          ))}
        </nav>
        <nav className="kpi-report-month-picker" aria-label="기간 선택">
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
          {view === 'monthly' &&
            MONTH_LABELS.map((label, monthIndex) => (
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
          {view === 'quarterly' &&
            [1, 2, 3, 4].map((q) => (
              <button
                key={q}
                type="button"
                className={`btn btn-secondary btn-sm${quarter === q ? ' is-active' : ''}`}
                onClick={() => setPeriod(year, monthIndexesOfQuarter(q)[0])}
                aria-current={quarter === q ? 'true' : undefined}
              >
                {q}분기
              </button>
            ))}
        </nav>
        <p className="team-kpi-hint kpi-report-period-hint">
          {view === 'monthly' ? (
            <>선택한 월의 월간 KPI와 월별 레벨(역량) 평가 요약입니다. 분기 평가는 분기 리포트에서 확인하세요.</>
          ) : view === 'quarterly' ? (
            <>선택한 분기의 합산 KPI와 분기 {KPI3_NAME}(월별 레벨 → 분기 레벨, 다면·리더·실전)입니다.</>
          ) : (
            <>선택한 연도의 12개월 추이·합산 KPI와 확정된 분기 {KPI3_NAME}의 평균입니다.</>
          )}{' '}
          URL에 <code>view</code>, <code>year</code>, <code>month</code>가 저장됩니다.
        </p>
      </header>

      {view === 'quarterly' && quarterView && (
        <KpiReportQuarterView view={quarterView} year={year} quarter={quarter} />
      )}
      {view === 'annual' && annualView && <KpiReportAnnualView view={annualView} year={year} />}
      {view === 'monthly' && (
        <>
          <TeamKpiIntegratedSummary
            year={year}
            month={month}
            yq={yq}
            monthly={monthly}
            quarterly={noQuarterly}
            variant="report"
            showCoaching={false}
            kpi3Slot={monthlyCompetency ? <MonthlyCompetencyCard report={monthlyCompetency} /> : null}
          />
          <MonthlyUtilizationTable monthly={monthly} team={team} ym={ym} />
          <MonthlyProductivityTable monthly={monthly} team={team} ym={ym} />
          {monthlyCompetency && <MonthlyCompetencyTable report={monthlyCompetency} />}
        </>
      )}
    </main>
  );
}
