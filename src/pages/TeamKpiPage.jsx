import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, ClipboardCopy, Download, Import, Upload } from 'lucide-react';
import AppModuleLink from '../components/AppModuleLink';
import { buildDocsModuleUrl } from '../constants/referenceDocs';
import { useJournal, useTeamKpiMetrics } from '../context/JournalProvider';
import { useJournalPeriod } from '../hooks/useJournalPeriod';
import {
  TEAM_KPI_MEMBERS,
  TEAM_LEADER_MEMBER_CODE,
  findKpiMember,
  formatKpiMemberLabel,
  formatKpiMemberRoleLine,
} from '../constants/kpiMembers';
import { URL_ACCESS_LEADER } from '../constants/teamAccess';
import { useTeamAccess } from '../hooks/useTeamAccess';
import { isEditorMode } from '../utils/appMode';
import { uiTooltip } from '../utils/uiTooltip';
import { KPI_01C_HEADERS, KPI_02_HEADERS, copyKpiSheetToClipboard } from '../constants/kpiLinkage';
import { KPI_SHEET_01C, KPI_SHEET_02 } from '../constants/kpiSchema';
import {
  KPI_STATUS,
  canSubmitKpiRecord,
  formatKpiStatusLabel,
  isMonthly01Submitted,
} from '../constants/kpiStatuses';
import { KPI_UI, KPI_WEEKLY_MM_SUM_LABEL } from '../constants/kpiUiLabels';
import { exportKpiAnalysisWorkbook } from '../utils/kpiExcelExport';
import { findImproveProject } from '../constants/improveProjects';
import { isImproveInvestmentTask } from '../utils/computeTeamKpi';
import {
  collectImproveMmCandidates,
  formatImproveCandidateSources,
} from '../utils/improveProjectCandidates';
import {
  buildImproveProjectRegistrationFromCandidate,
  buildManualImproveProjectRegistration,
  formatCandidateMemberSummary,
  formatImproveProjectOwnerLine,
  findRegisteredProjectForCandidate,
  IMPROVE_PROJECT_LOCAL_SCOPE_NOTICE,
} from '../utils/improveProjectLink';
import {
  IMPROVE_PROJECTS_MERGE_POLICY_HINT,
  IMPROVE_PROJECTS_SHARE_HINT,
} from '../utils/improveProjectsCloudSnapshot';
import {
  IMPROVE_PROJECTS_BLOB_FALLBACK_HINT,
  IMPROVE_PROJECTS_FILE_IMPORT_FAIL,
  IMPROVE_PROJECTS_FILE_IMPORT_SUCCESS,
  IMPROVE_PROJECTS_FILE_MERGE_POLICY_HINT,
  IMPROVE_PROJECTS_FILE_SHARE_HINT,
} from '../utils/improveProjectsFileSnapshot';
import { getCloudHealthUserMessage } from '../utils/cloudHealth';
import {
  apply01cToMonthly01,
  computeUtilization,
  isMonthly01ContentUnset,
  validate01cVsMonthly,
} from '../utils/kpiMonthlyClose';
import { gradeKpi1, gradeKpi2, gradeKpi3, computeKpi3Composite } from '../utils/kpiGrades';
import { downloadTeamKpiSnapshot, fetchTeamKpiSnapshot, normalizeTeamKpiSnapshot } from '../utils/teamKpiSnapshot';
import { defaultMonthly01, quarterKey } from '../constants/kpiOperationalStore';
import { KPI1_NAME, KPI2_NAME, KPI3_NAME } from '../constants/kpiDisplayNames';
import Kpi3LeaderWorkPanel from '../components/Kpi3LeaderWorkPanel';
import TeamKpiSummarySection from '../components/TeamKpiSummarySection';
import { COMPETENCY_USE_4060 } from '../constants/competencyConfig';
import { KPI3_ELEMENTS, KPI3_FORMULA_TEXT } from '../constants/kpi3Elements';
import { KPI3_DEMO_MONTH_INDEX, KPI3_DEMO_YEAR } from '../data/kpi3SeedAcademizerScenario';
import { SHOW_BLOB_IMPROVE_PROJECT_SHARING_UI } from '../constants/improveProjectSharingConfig';
import './TeamKpiPage.css';

const TABS = [
  { id: 'overview', label: '개요', hint: '월 KPI 요약·제출 상태' },
  { id: 'kpi1', label: KPI1_NAME, hint: '주간 M/M·가동률 (01c)' },
  {
    id: 'kpi2',
    label: KPI2_NAME,
    hint: 'KPI2 · 생산성향상 도구/과제·효과 제출 관리',
    ariaLabel: `${KPI2_NAME} (KPI2 · 생산성향상 관리)`,
  },
  { id: 'kpi3', label: KPI3_NAME, hint: '역량 팀장평가·분기 KPI3 확정' },
  { id: 'close', label: '월 확정', hint: '월 M/M 확정·제출·철회' },
  { id: 'export', label: '보내기', hint: 'Excel·클립보드·스냅샷' },
];

function formatPct(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return `${n.toFixed(1)}%`;
}

function formatDate(d) {
  if (!d) return '';
  if (d instanceof Date) return d.toLocaleDateString('ko-KR');
  return String(d);
}

export default function TeamKpiPage() {
  const teamAccess = useTeamAccess();
  const { year, month, changeMonth } = useJournalPeriod();
  const journal = useJournal();
  const [memberCode, setMemberCode] = useState(TEAM_LEADER_MEMBER_CODE);
  const { improveProjects, improveProjectsApi, kpiOperational, getMemberDays } = journal;
  const cloudHealthMessage = getCloudHealthUserMessage();
  const improveProjectsFileInputRef = useRef(null);
  const days = getMemberDays(memberCode);
  const metrics = useTeamKpiMetrics(year, month, memberCode);
  const improveMmEntries = useMemo(
    () =>
      collectImproveMmCandidates({
        year,
        monthIndex: month,
        getMemberDays,
        memberCodes: TEAM_KPI_MEMBERS.map((m) => m.code),
        improveProjects,
        includeRegistered: true,
      }),
    [year, month, getMemberDays, improveProjects]
  );
  const improveMmCandidates = useMemo(
    () => improveMmEntries.filter((c) => !c.alreadyRegistered),
    [improveMmEntries]
  );
  const improveMmRegistered = useMemo(
    () => improveMmEntries.filter((c) => c.alreadyRegistered),
    [improveMmEntries]
  );
  const monthly01Stored = journal.getMonthly01(year, month, memberCode);
  const monthly01Form = monthly01Stored ?? defaultMonthly01();
  const [tab, setTab] = useState('overview');
  const [toast, setToast] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const quarterRec = journal.getQuarterRecord(year, month, memberCode);
  const competencyRec = journal.getCompetencyMonth(year, month, memberCode);
  const yq = quarterKey(year, month);

  const showToast = useCallback((msg) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 3200);
  }, []);

  useEffect(() => {
    if (!teamAccess.isLeader || journal.kpiOperationalReadOnly) return;
    const demoRec = journal.getQuarterRecord(KPI3_DEMO_YEAR, KPI3_DEMO_MONTH_INDEX, 'A');
    if ((demoRec?.quarter?.composite || 0) > 0) return;
    journal.seedKpi3AcademizerDemo?.();
  }, [teamAccess.isLeader, journal]);

  const openKpiTab = useCallback((nextTab) => {
    setTab(nextTab);
  }, []);

  const handleOverviewCardKeyDown = useCallback(
    (event, nextTab) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openKpiTab(nextTab);
      }
    },
    [openKpiTab]
  );

  const validation = validate01cVsMonthly(metrics.month01cTotals, monthly01Form);

  const journalAvailableMm = metrics.kpi1.available;

  const sync01cToMonthly = () => {
    const next = apply01cToMonthly01(metrics.month01cTotals, monthly01Form, journalAvailableMm);
    journal.updateMonthly01(year, month, memberCode, next);
    showToast(`${KPI_UI.pullWeeklyToMonthly} — ${KPI_UI.monthlyMm}에 반영했습니다`);
  };

  const submitKpi1Monthly = () => {
    const mmPatch = apply01cToMonthly01(metrics.month01cTotals, monthly01Form, journalAvailableMm);
    journal.updateMonthly01(year, month, memberCode, {
      ...mmPatch,
      status: KPI_STATUS.SUBMITTED,
      submittedAt: new Date().toISOString(),
      rejectReason: '',
    });
    showToast('제출됨 — 이제 「제출 취소 (철회)」로 다시 수정할 수 있습니다');
  };

  const clearMonthlyDraftFromJournal = () => {
    if (!window.confirm('월 확정 M/M을 비우고 작성 중으로 되돌릴까요?')) return;
    journal.updateMonthly01(year, month, memberCode, {
      work: 0,
      improve: 0,
      leave: 0,
      status: KPI_STATUS.DRAFT,
      submittedAt: null,
      approvedAt: null,
      approver: '',
    });
    showToast('가져온 M/M을 비웠습니다');
  };

  const hasMonthlyDraftValues =
    (Number(monthly01Form.work) || 0) +
      (Number(monthly01Form.improve) || 0) +
      (Number(monthly01Form.leave) || 0) >
    0.001;

  const copy01c = async () => {
    await copyKpiSheetToClipboard(KPI_01C_HEADERS, metrics.rows01c);
    showToast(`${KPI_SHEET_01C} ${metrics.rows01c.length}행 복사`);
  };

  const copy02 = async () => {
    await copyKpiSheetToClipboard(KPI_02_HEADERS, metrics.rows02Effect);
    showToast(`${KPI_SHEET_02} 효과 ${metrics.rows02Effect.length}행 복사`);
  };

  const doAnalysisExport = () => {
    try {
      const result = exportKpiAnalysisWorkbook({
        year,
        monthIndex: month,
        days: getMemberDays(memberCode),
        kpiOperational,
        improveProjects,
      });
      showToast(`분석 Excel 저장 — ${result.filename}`);
    } catch (e) {
      showToast(`저장 실패: ${e.message}`);
    }
  };

  const investmentTasks = [];
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  Object.entries(days).forEach(([key, day]) => {
    if (!key.startsWith(prefix)) return;
    (day.tasks || []).forEach((task) => {
      if (isImproveInvestmentTask(task)) investmentTasks.push({ dayKey: key, task });
    });
  });

  const { utilization } = computeUtilization(monthly01Form);
  const closeUtilizationPct = isMonthly01ContentUnset(monthly01Stored)
    ? metrics.kpi1.utilization
    : utilization;

  const kpi2ApprovedCount = metrics.rows02Effect.filter((r) => r.상태 === KPI_STATUS.APPROVED).length;
  const kpi2DisplayPct = metrics.kpi2.productivityPct ?? metrics.kpi2Preview?.productivityPct;
  const kpi2ShowsPreview =
    metrics.kpi2.productivityPct == null && metrics.kpi2Preview?.productivityPct != null;

  const showWithdrawMonthly =
    Boolean(monthly01Stored) &&
    isMonthly01Submitted(monthly01Stored) &&
    !journal.kpiOperationalReadOnly;

  const handleWithdrawMonthly = () => {
    if (typeof journal.withdrawMonthly01 !== 'function') {
      showToast('제출 취소 기능을 불러올 수 없습니다. npm run dev 로 최신 코드를 실행했는지 확인하세요.');
      return;
    }
    if (!window.confirm('월 확정 제출을 취소하고 M/M을 다시 수정할까요?')) return;
    journal.withdrawMonthly01(year, month, memberCode);
    showToast('제출을 취소했습니다 (작성 중). M/M 수정 후 다시 제출할 수 있습니다.');
  };

  if (!teamAccess.isLeader) {
    return (
      <main className="team-kpi-main">
        <p className="team-kpi-hint">팀 KPI 관리·승인·리포트는 팀장 전용입니다.</p>
        <AppModuleLink module="journal" mode="edit" member={teamAccess.scopedMember || undefined}>
          일지로 이동
        </AppModuleLink>
      </main>
    );
  }

  return (
    <main className="team-kpi-main">
      <header className="team-kpi-header">
        <div className="team-kpi-month-nav">
          <button
            type="button"
            className="journal-icon-btn"
            onClick={() => changeMonth(-1)}
            aria-label="이전 달"
            {...uiTooltip('이전 달로 이동')}
          >
            <ChevronLeft size={18} />
          </button>
          <h1>
            {year}년 {month + 1}월 · 팀 KPI 관리
          </h1>
          <button
            type="button"
            className="journal-icon-btn"
            onClick={() => changeMonth(1)}
            aria-label="다음 달"
            {...uiTooltip('다음 달로 이동')}
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <p className="team-kpi-banner">
          공식 기록 = <strong>TMS</strong> · 엑셀은 <strong>분석·백업</strong> 추출만 (
          <AppModuleLink module="kpi-report" mode="edit" access={URL_ACCESS_LEADER} year={year} month={month + 1}>
            리포트
          </AppModuleLink>{' '}
          ·{' '}
          <AppModuleLink module="kpi-approve" mode="edit" access={URL_ACCESS_LEADER} year={year} month={month + 1}>
            승인
          </AppModuleLink>)
        </p>
      </header>

      <TeamKpiSummarySection
        year={year}
        month={month}
        yq={yq}
        getMemberDays={getMemberDays}
        kpiOperational={kpiOperational}
        improveProjects={improveProjects}
        selectedMemberCode={memberCode}
        onSelectMember={setMemberCode}
      />

      <header className="team-kpi-header team-kpi-header--member">
        <h2 className="team-kpi-member-section-title">구성원별 상세 · {formatKpiMemberLabel(findKpiMember(memberCode))}</h2>
        <div className="team-kpi-member-pick">
          <span>구성원</span>
          {TEAM_KPI_MEMBERS.map((m) => (
            <button
              key={m.code}
              type="button"
              className={`team-kpi-member-btn${memberCode === m.code ? ' is-active' : ''}`}
              onClick={() => setMemberCode(m.code)}
              {...uiTooltip(`${formatKpiMemberLabel(m)} · ${formatKpiMemberRoleLine(m)}`)}
            >
              {formatKpiMemberLabel(m)}
            </button>
          ))}
        </div>
        <nav className="team-kpi-tabs" aria-label="KPI 탭">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`team-kpi-tab${tab === t.id ? ' is-active' : ''}`}
              onClick={() => setTab(t.id)}
              aria-label={t.ariaLabel || t.label}
              {...(t.hint ? uiTooltip(t.hint) : {})}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      {tab === 'overview' && (
        <section className="team-kpi-section">
          <div className="team-kpi-cards">
            <article
              className="team-kpi-card team-kpi-card--clickable kpi1"
              role="button"
              tabIndex={0}
              aria-label={`${KPI1_NAME} 상세보기`}
              onClick={() => openKpiTab('kpi1')}
              onKeyDown={(e) => handleOverviewCardKeyDown(e, 'kpi1')}
            >
              <h2>{KPI1_NAME}</h2>
              <p className="team-kpi-big">{formatPct(metrics.kpi1.utilization)}</p>
              <p className="team-kpi-grade">
                등급 {gradeKpi1(metrics.kpi1.utilization)} · {monthly01Stored?.status ?? KPI_STATUS.DRAFT}
                {!monthly01Stored && (
                  <span className="team-kpi-hint-inline"> (일지 실시간)</span>
                )}
              </p>
              <ul>
                <li>업무 M/M {metrics.kpi1.work.toFixed(2)}</li>
                <li>생산향상 M/M {metrics.kpi1.improve.toFixed(2)}</li>
                <li>휴일 M/M {metrics.kpi1.leave.toFixed(2)}</li>
                <li>가용 M/M {metrics.kpi1.available.toFixed(2)}</li>
              </ul>
              <span className="team-kpi-card-detail">상세보기 →</span>
            </article>
            <article
              className="team-kpi-card team-kpi-card--clickable kpi2"
              role="button"
              tabIndex={0}
              aria-label={`KPI2 · ${KPI2_NAME} 상세보기`}
              onClick={() => openKpiTab('kpi2')}
              onKeyDown={(e) => handleOverviewCardKeyDown(e, 'kpi2')}
            >
              <h2>{KPI2_NAME}</h2>
              <p className="team-kpi-card-kpi-tag">KPI2 · 생산성향상 관리</p>
              <p className="team-kpi-hint team-kpi-card-desc">
                생산성향상 후보와 효과 제출을 관리합니다.
              </p>
              <p className="team-kpi-big">{formatPct(kpi2DisplayPct)}</p>
              <p className="team-kpi-grade">
                등급 {gradeKpi2(kpi2DisplayPct)}
                {kpi2ShowsPreview && (
                  <span className="team-kpi-hint-inline"> (승인 전 · 일지 제출 기준)</span>
                )}
              </p>
              <ul>
                <li>효과 {metrics.kpi2.effectCount}건 · 승인 {kpi2ApprovedCount}건</li>
                {kpi2ShowsPreview && metrics.kpi2.effectCount > 0 && (
                  <li>팀장 승인 후 공식 집계에 반영됩니다</li>
                )}
                {metrics.kpi2.productivityPct != null &&
                  metrics.kpi2Preview?.productivityPct != null &&
                  Math.abs(metrics.kpi2.productivityPct - metrics.kpi2Preview.productivityPct) > 0.05 && (
                    <li>미승인 포함 {formatPct(metrics.kpi2Preview.productivityPct)}</li>
                  )}
              </ul>
              <span className="team-kpi-card-detail">KPI2 상세보기 →</span>
            </article>
            <article
              className="team-kpi-card team-kpi-card--clickable kpi3"
              role="button"
              tabIndex={0}
              aria-label={`${KPI3_NAME} 상세보기`}
              onClick={() => openKpiTab('kpi3')}
              onKeyDown={(e) => handleOverviewCardKeyDown(e, 'kpi3')}
            >
              <h2>{KPI3_NAME} · {yq}</h2>
              <p className="team-kpi-big">
                {(() => {
                  const c =
                    quarterRec.quarter.composite > 0
                      ? quarterRec.quarter.composite
                      : computeKpi3Composite(quarterRec.quarter);
                  return c > 0 ? c : '—';
                })()}
              </p>
              <p className="team-kpi-grade">
                등급{' '}
                {gradeKpi3(
                  quarterRec.quarter.composite > 0
                    ? quarterRec.quarter.composite
                    : computeKpi3Composite(quarterRec.quarter)
                )}
              </p>
              <ul className="team-kpi-kpi3-mini">
                {KPI3_ELEMENTS.map((el) => (
                  <li key={el.key}>
                    {el.label} {quarterRec.quarter[el.key] > 0 ? quarterRec.quarter[el.key] : '—'}
                  </li>
                ))}
              </ul>
              {journal.getCompetencyMonthlyFinal(year, month, memberCode) != null && (
                <p className="team-kpi-hint team-kpi-card-extra">
                  이번 달 레벨(월간) {journal.getCompetencyMonthlyFinal(year, month, memberCode)}
                  {competencyRec?.managerLocked ? ' (팀장 확정)' : ' (작성 중)'}
                </p>
              )}
              <span className="team-kpi-card-detail">상세보기 →</span>
            </article>
          </div>
          <div
            className={`team-kpi-withdraw-banner${showWithdrawMonthly ? '' : ' team-kpi-withdraw-banner--idle'}`}
            role="region"
            aria-label="월 확정 제출 취소"
          >
            <p>
              {showWithdrawMonthly ? (
                <>
                  <strong>{KPI_UI.monthlyMm}</strong>이 <strong>제출됨</strong> 상태입니다. 수정하려면 아래 버튼을
                  누르세요.
                </>
              ) : (
                <>
                  <strong>제출 취소 (철회)</strong>는 「월 확정」 탭에서 <strong>월 확정 제출</strong> 후에 활성화됩니다.
                  (지금: {formatKpiStatusLabel(monthly01Form.status)})
                </>
              )}
            </p>
            <button
              type="button"
              className="btn team-kpi-withdraw-btn"
              disabled={!showWithdrawMonthly || journal.kpiOperationalReadOnly}
              {...uiTooltip(
                showWithdrawMonthly ? KPI_UI.withdrawMonthlyHint : KPI_UI.withdrawMonthlyDisabledHint,
                undefined,
                { wrap: true }
              )}
              onClick={handleWithdrawMonthly}
            >
              {KPI_UI.withdrawMonthly}
            </button>
          </div>
          <p className="team-kpi-hint">
            구성원별 <strong>일일 업무일지</strong>에서 M/M·KPI2가 집계됩니다. 구성원 역량 자체평가는{' '}
            <strong>역량 평가</strong> 메뉴, 팀장 평가·분기 KPI3는 위 <strong>{KPI3_NAME}</strong> 탭에서
            처리합니다.
          </p>
        </section>
      )}

      {tab === 'kpi1' && (
        <section className="team-kpi-section">
          <h2>주간 메모 · {KPI_WEEKLY_MM_SUM_LABEL}</h2>
          <p className="team-kpi-hint" style={{ marginTop: 0 }}>
            주간 메모는 일지 「금주」와 별도입니다. M/M은 일지에서 주차별로 자동 계산됩니다.
          </p>
          <div className="team-kpi-table-wrap team-kpi-table-wrap--kpi1">
              <table className="team-kpi-table team-kpi-table--kpi1">
                <thead>
                  <tr>
                    <th>주시작</th>
                    <th>업무MM</th>
                    <th>생산향상MM</th>
                    <th>휴일MM</th>
                    <th className="col-memo">주간메모</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.rows01c.map((row) => (
                    <tr key={row.weekStartKey}>
                      <td>{formatDate(row.주시작일)}</td>
                      <td>{row.업무MM}</td>
                      <td>{row.생산향상MM}</td>
                      <td>{row.휴일MM}</td>
                      <td className="col-memo">
                        <input
                          type="text"
                          className="team-kpi-memo-input"
                          value={journal.getKpiWeekMemo(row.weekKey)}
                          onChange={(e) => journal.setKpiWeekMemo(row.weekKey, e.target.value)}
                          placeholder="한두 줄 (선택)"
                          maxLength={240}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th>월 합</th>
                    <td>{metrics.month01cTotals.work}</td>
                    <td>{metrics.month01cTotals.improve}</td>
                    <td>{metrics.month01cTotals.leave}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
        </section>
      )}

      {tab === 'kpi2' && (
        <section className="team-kpi-section team-kpi-section--kpi2-detail">
          <div className="team-kpi-detail-nav">
            <button
              type="button"
              className="btn btn-secondary btn-sm team-kpi-back-btn"
              onClick={() => setTab('overview')}
              aria-label={`${formatKpiMemberLabel(findKpiMember(memberCode))} 구성원 개요로 돌아가기`}
            >
              <ChevronLeft size={16} aria-hidden />
              구성원 개요로 돌아가기
            </button>
          </div>
          <h2>KPI2 · 생산성향상 도구/과제 관리</h2>
          <p className="team-kpi-section-lead">
            생산성향상 M/M 후보를 확인하고, 운영 목록에 등록한 뒤, KPI2 효과 제출 대상을 관리합니다.
          </p>
          <p className="team-kpi-hint team-kpi-local-scope-notice">{IMPROVE_PROJECT_LOCAL_SCOPE_NOTICE}</p>
          <div className="team-kpi-improve-flow" aria-label="생산성향상 관리 흐름">
            <p className="team-kpi-improve-flow__lead">
              업무일지에서 생산성향상 M/M으로 기록된 업무를 후보로 확인하고, 팀장이 운영 목록에 등록한 뒤, KPI2
              효과 제출 여부와 상태를 관리합니다.
            </p>
            <ol className="team-kpi-improve-flow__steps">
              <li>구성원이 일지에 <strong>생산성향상 M/M</strong>을 입력합니다.</li>
              <li>팀장은 <strong>후보</strong>를 확인합니다.</li>
              <li>필요한 항목을 <strong>운영 목록</strong>에 등록합니다.</li>
              <li>
                <strong>KPI2 효과</strong> 제출 대상은 일지에서 KPI2 효과로 표시합니다 (자동 제출 아님).
              </li>
            </ol>
          </div>

          <div className="team-kpi-improve-candidates">
            <h3 className="team-kpi-improve-candidates__title">업무일지에서 발견된 후보</h3>
            <p className="team-kpi-hint team-kpi-improve-candidates__hint">
              {year}년 {month + 1}월 일지의 생산성향상 M/M 또는 개선 성격 업무에서 자동으로 모입니다.{' '}
              <strong>후보 등록</strong>은 KPI2 운영 목록에 올리는 작업이며, 원본 일지를 수정하지 않습니다.
            </p>
            {improveMmCandidates.length === 0 ? (
              <p className="team-kpi-hint">이 달 등록 가능한 후보가 없습니다.</p>
            ) : (
              <ul className="team-kpi-improve-candidates__list">
                {improveMmCandidates.map((candidate) => (
                  <li key={candidate.normalizedKey} className="team-kpi-improve-candidates__item">
                    <div className="team-kpi-improve-candidates__meta">
                      <strong>{candidate.title}</strong>
                      <span className="team-kpi-improve-candidates__stats">
                        {candidate.occurrenceCount}건
                        {candidate.totalActual > 0 ? ` · 실작업 ${candidate.totalActual}h` : ''}
                      </span>
                      <span className="team-kpi-improve-candidates__sources">
                        담당/출처:{' '}
                        {formatCandidateMemberSummary(candidate.sources, (code) => {
                          const m = findKpiMember(code);
                          return m ? `${m.code}(${m.displayName})` : code;
                        })}
                      </span>
                      <span className="team-kpi-improve-candidates__source-hint">
                        출처: {year}년 {month + 1}월 업무일지 후보
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm team-kpi-improve-candidates__register"
                      disabled={journal.kpiOperationalReadOnly}
                      title="KPI2 운영 목록에 등록합니다. 일지 원본은 변경하지 않습니다."
                      aria-label={`${candidate.title} — KPI2 운영 목록에 등록`}
                      onClick={() => {
                        const added = improveProjectsApi.addProject(
                          buildImproveProjectRegistrationFromCandidate(candidate, { year, monthIndex: month })
                        );
                        if (added) {
                          showToast(`「${candidate.title}」을 KPI2 운영 목록에 등록했습니다`);
                        } else {
                          showToast('이미 운영 목록에 있거나 등록할 수 없습니다');
                        }
                      }}
                    >
                      KPI2 운영 목록에 등록
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {improveMmRegistered.length > 0 && (
              <div className="team-kpi-improve-registered">
                <h4 className="team-kpi-improve-registered__title">이미 운영 목록에 있음</h4>
                <ul className="team-kpi-improve-candidates__list team-kpi-improve-registered__list">
                  {improveMmRegistered.map((candidate) => {
                    const registered = findRegisteredProjectForCandidate(candidate, improveProjects);
                    const memberSummary = formatCandidateMemberSummary(candidate.sources, (code) => {
                      const m = findKpiMember(code);
                      return m ? `${m.code}(${m.displayName})` : code;
                    });
                    return (
                    <li
                      key={candidate.normalizedKey}
                      className="team-kpi-improve-candidates__item team-kpi-improve-registered__item"
                    >
                      <div className="team-kpi-improve-candidates__meta">
                        <strong>{candidate.title}</strong>
                        <span className="team-kpi-improve-candidates__stats">
                          {candidate.occurrenceCount}건
                          {candidate.totalActual > 0 ? ` · 실작업 ${candidate.totalActual}h` : ''}
                        </span>
                        <span className="team-kpi-improve-registered__badge">
                          운영 목록 등록됨
                          {memberSummary ? ` · ${memberSummary}` : ''}
                        </span>
                        {registered && (
                          <span className="team-kpi-improve-candidates__source-hint">
                            {formatImproveProjectOwnerLine(registered, (code) => {
                              const m = findKpiMember(code);
                              return m ? `${m.code}(${m.displayName})` : code;
                            })}
                          </span>
                        )}
                      </div>
                    </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

          <div className="team-kpi-projects team-kpi-projects-panel">
            <h3 className="team-kpi-projects-panel__title">운영 중인 생산성향상 도구/과제</h3>
            <p className="team-kpi-hint team-kpi-projects-panel__hint">
              팀에서 관리하는 생산성향상 도구/과제 목록입니다. 일지 편집 시 KPI2 효과 건의 「향상 과제」 선택에
              사용됩니다. KPI2 효과는 개선 효과로 제출할 항목에만 표시합니다 — 생산성향상 M/M 전체가 자동으로
              KPI2 효과가 되지는 않습니다.
            </p>
            <div className="team-kpi-improve-share">
              {SHOW_BLOB_IMPROVE_PROJECT_SHARING_UI && (
                <>
                  <p className="team-kpi-hint team-kpi-improve-share__hint">{IMPROVE_PROJECTS_SHARE_HINT}</p>
                  <p className="team-kpi-hint team-kpi-improve-share__policy">{IMPROVE_PROJECTS_MERGE_POLICY_HINT}</p>
                </>
              )}
              {SHOW_BLOB_IMPROVE_PROJECT_SHARING_UI && cloudHealthMessage && (
                <p className="team-kpi-hint team-kpi-improve-share__warn">{cloudHealthMessage}</p>
              )}
              {SHOW_BLOB_IMPROVE_PROJECT_SHARING_UI && (
                <>
                  <p className="team-kpi-hint team-kpi-improve-share__warn">{IMPROVE_PROJECTS_BLOB_FALLBACK_HINT}</p>
                  <div className="team-kpi-improve-share__group">
                    <p className="team-kpi-hint team-kpi-improve-share__group-label">Blob 팀 공유</p>
                    <div className="team-kpi-improve-share__actions">
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={improveProjectsApi.sharedBusy}
                        aria-label="팀 공유 저장"
                        title="수동 — 현재 운영 목록을 팀 공용 snapshot으로 저장합니다"
                        {...uiTooltip(
                          '현재 운영 목록을 팀 공용 snapshot에 수동 업로드합니다. 자동 저장은 사용하지 않습니다.',
                          undefined,
                          { wrap: true }
                        )}
                        onClick={async () => {
                          const r = await improveProjectsApi.publishSharedProjects();
                          if (r.ok) showToast('향상 과제 운영 목록을 팀 공유 저장했습니다');
                          else showToast(r.message || '팀 공유 저장에 실패했습니다');
                        }}
                      >
                        <Upload size={16} />
                        팀 공유 저장
                      </button>
                      <button
                        type="button"
                        className="btn btn-import-shared"
                        disabled={improveProjectsApi.sharedBusy}
                        aria-label="팀 공유본 가져오기"
                        title="수동 — 팀 공유 snapshot을 이 브라우저 운영 목록에 병합합니다"
                        {...uiTooltip(
                          '팀 공유 snapshot을 수동으로 가져와 이 브라우저 운영 목록에 병합합니다. 자동 동기화는 사용하지 않습니다.',
                          undefined,
                          { wrap: true }
                        )}
                        onClick={async () => {
                          const r = await improveProjectsApi.loadSharedProjects();
                          if (r.ok) showToast(`팀 공유본 ${r.snapshot?.projects?.length || 0}건을 병합했습니다`);
                          else if (r.reason === 'no-remote') showToast('팀 공유본이 아직 없습니다');
                          else showToast(r.message || '팀 공유본을 가져오지 못했습니다');
                        }}
                      >
                        <Import size={16} />
                        팀 공유본 가져오기
                      </button>
                    </div>
                  </div>
                </>
              )}
              <div className="team-kpi-improve-file">
                <p className="team-kpi-hint team-kpi-improve-file__hint">{IMPROVE_PROJECTS_FILE_SHARE_HINT}</p>
                <p className="team-kpi-hint team-kpi-improve-file__policy">{IMPROVE_PROJECTS_FILE_MERGE_POLICY_HINT}</p>
                <div className="team-kpi-improve-file__actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={improveProjectsApi.sharedBusy || improveProjects.length === 0}
                    aria-label="구성원 전달용 JSON 다운로드"
                    title="구성원에게 전달할 현재 운영 목록을 JSON 파일로 다운로드합니다"
                    {...uiTooltip(
                      '구성원에게 전달할 현재 운영 목록을 JSON 파일로 다운로드합니다. Blob/API를 사용하지 않습니다.',
                      undefined,
                      { wrap: true }
                    )}
                    onClick={() => {
                      const r = improveProjectsApi.downloadProjectsFile();
                      if (r.ok) showToast('향상 과제 JSON 파일을 다운로드했습니다');
                      else if (r.reason === 'empty') showToast('다운로드할 운영 목록이 없습니다');
                      else showToast(r.message || '향상 과제 JSON을 다운로드하지 못했습니다');
                    }}
                  >
                    <Download size={16} />
                    구성원 전달용 JSON 다운로드
                  </button>
                  <button
                    type="button"
                    className="btn btn-import-shared"
                    disabled={improveProjectsApi.sharedBusy}
                    aria-label="향상 과제 JSON 가져오기"
                    title="JSON 파일을 이 브라우저 운영 목록에 병합합니다"
                    {...uiTooltip(
                      'JSON 파일을 수동으로 가져와 이 브라우저 운영 목록에 병합합니다. 자동 동기화는 사용하지 않습니다.',
                      undefined,
                      { wrap: true }
                    )}
                    onClick={() => improveProjectsFileInputRef.current?.click()}
                  >
                    <Import size={16} />
                    향상 과제 JSON 가져오기
                  </button>
                  <input
                    ref={improveProjectsFileInputRef}
                    type="file"
                    accept="application/json,.json"
                    hidden
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const r = await improveProjectsApi.importProjectsFromFile(file);
                      if (r.ok) showToast(IMPROVE_PROJECTS_FILE_IMPORT_SUCCESS);
                      else showToast(r.message || IMPROVE_PROJECTS_FILE_IMPORT_FAIL);
                      e.target.value = '';
                    }}
                  />
                </div>
              </div>
              {SHOW_BLOB_IMPROVE_PROJECT_SHARING_UI && (improveProjectsApi.sharedMeta?.publishedAt ||
                improveProjectsApi.sharedMeta?.importedAt) && (
                <p className="team-kpi-hint team-kpi-improve-share__meta">
                  {improveProjectsApi.sharedMeta.publishedAt &&
                    `마지막 팀 공유 저장: ${new Date(improveProjectsApi.sharedMeta.publishedAt).toLocaleString('ko-KR')}`}
                  {improveProjectsApi.sharedMeta.publishedAt &&
                    improveProjectsApi.sharedMeta.importedAt &&
                    ' · '}
                  {improveProjectsApi.sharedMeta.importedAt &&
                    `마지막 가져오기: ${new Date(improveProjectsApi.sharedMeta.importedAt).toLocaleString('ko-KR')}`}
                </p>
              )}
              {!SHOW_BLOB_IMPROVE_PROJECT_SHARING_UI && improveProjectsApi.sharedMeta?.fileImportedAt && (
                <p className="team-kpi-hint team-kpi-improve-share__meta">
                  마지막 JSON 가져오기: {new Date(improveProjectsApi.sharedMeta.fileImportedAt).toLocaleString('ko-KR')}
                </p>
              )}
            </div>
            <ul>
              {improveProjects.map((p) => (
                <li key={p.id} className="team-kpi-project-row">
                  <div className="team-kpi-project-row__meta">
                    <strong>{p.name}</strong> <code>{p.code}</code>
                    <span className="team-kpi-improve-candidates__source-hint">
                      {formatImproveProjectOwnerLine(p, (code) => {
                        const m = findKpiMember(code);
                        return m ? `${m.code}(${m.displayName})` : code;
                      })}
                      {p.sourceLabel && p.source !== 'manual' ? ` · ${p.sourceLabel}` : ''}
                    </span>
                  </div>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => improveProjectsApi.removeProject(p.id)}>
                    삭제
                  </button>
                </li>
              ))}
            </ul>
            <div className="team-kpi-add-project">
              <input
                className="form-input"
                placeholder="새 생산성향상 도구/과제명"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-secondary"
                title="운영 목록에 직접 추가합니다"
                onClick={() => {
                  const added = improveProjectsApi.addProject(
                    buildManualImproveProjectRegistration(newProjectName)
                  );
                  if (added) {
                    setNewProjectName('');
                    showToast('운영 목록에 추가했습니다');
                  } else {
                    showToast('과제명을 확인하거나 중복 여부를 확인하세요');
                  }
                }}
              >
                운영 목록에 추가
              </button>
            </div>
          </div>

          <div className="team-kpi-kpi2-effects">
            <h3 className="team-kpi-kpi2-effects__title">{KPI2_NAME} 효과 제출 관리</h3>
            <p className="team-kpi-hint team-kpi-kpi2-effects__hint">
              아래 목록은 일지에서 <strong>KPI2 효과</strong>로 체크한 항목만 표시됩니다. 완료(상태)는 업무
              마감/제출 의미이며, 실제 투입 M/M 집계와는 별개입니다.
            </p>
          </div>
          <div className="team-kpi-table-wrap">
            <table className="team-kpi-table">
              <thead>
                <tr>
                  <th>완료일</th>
                  <th>업무명</th>
                  <th>기준h</th>
                  <th>실작업h</th>
                  <th>상태</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {metrics.rows02Effect.map((row, i) => {
                  const pct = row['생산성%'];
                  return (
                    <tr key={`${row.dayKey}-${i}`}>
                      <td>{formatDate(row.완료일)}</td>
                      <td>{row.업무명}</td>
                      <td>{row.계획시간}</td>
                      <td>{row.실작업시간}</td>
                      <td>{row.상태}</td>
                      <td>
                        {canSubmitKpiRecord(row.상태) && row.taskId && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => {
                              journal.submitKpi2Row(row.dayKey, row.taskId);
                              showToast(`${KPI2_NAME} 제출`);
                            }}
                          >
                            제출
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'kpi3' && (
        <section className="team-kpi-section">
          <h2>
            {KPI3_NAME} · {yq} · {formatKpiMemberLabel(findKpiMember(memberCode))}
          </h2>
          <p className="team-kpi-hint" style={{ marginTop: 0 }}>
            {KPI3_FORMULA_TEXT}
            {COMPETENCY_USE_4060 ? ' · 월간 레벨 40:60' : ' · 월간 레벨 팀장 확정'}
          </p>
          {isEditorMode() && !journal.kpiOperationalReadOnly && (
            <div className="team-kpi-excel-actions" style={{ marginBottom: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  journal.seedKpi3AcademizerDemo?.();
                  showToast('KPI3 평가 샘플 데이터를 넣었습니다');
                }}
              >
                KPI3 평가 샘플 넣기
              </button>
            </div>
          )}
          <Kpi3LeaderWorkPanel
            year={year}
            month={month}
            memberCode={memberCode}
            yq={yq}
            quarterRec={quarterRec}
            competencyRec={competencyRec}
            journal={journal}
            kpiMetrics={metrics}
            onToast={showToast}
          />
        </section>
      )}

      {tab === 'close' && (
        <section className="team-kpi-section team-kpi-section--close">
          <h2>
            {KPI_UI.monthlyMm} · {KPI1_NAME} ({metrics.member.displayName})
          </h2>
          <div
            className={`team-kpi-withdraw-banner team-kpi-withdraw-banner--close${showWithdrawMonthly ? '' : ' team-kpi-withdraw-banner--idle'}`}
          >
            <p>
              {showWithdrawMonthly
                ? KPI_UI.withdrawMonthlyHint
                : `상태가 「${formatKpiStatusLabel(monthly01Form.status)}」입니다. 제출 후에만 ${KPI_UI.withdrawMonthly}이 켜집니다.`}
            </p>
            <div className="team-kpi-close-actions team-kpi-close-actions--withdraw">
              <button
                type="button"
                className="btn team-kpi-withdraw-btn"
                disabled={!showWithdrawMonthly || journal.kpiOperationalReadOnly}
                {...uiTooltip(
                  showWithdrawMonthly ? KPI_UI.withdrawMonthlyHint : KPI_UI.withdrawMonthlyDisabledHint,
                  undefined,
                  { wrap: true }
                )}
                onClick={handleWithdrawMonthly}
              >
                {KPI_UI.withdrawMonthly}
              </button>
              {!showWithdrawMonthly &&
                canSubmitKpiRecord(monthly01Form.status) &&
                hasMonthlyDraftValues &&
                !journal.kpiOperationalReadOnly && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    {...uiTooltip(KPI_UI.clearMonthlyDraftHint)}
                    onClick={clearMonthlyDraftFromJournal}
                  >
                    {KPI_UI.clearMonthlyDraft}
                  </button>
                )}
            </div>
          </div>
          <p className="team-kpi-hint" style={{ marginTop: 0 }}>
            {formatKpiMemberLabel(metrics.member)} 일지의 {KPI_WEEKLY_MM_SUM_LABEL}가 기준입니다. 「
            {KPI_UI.pullWeeklyToMonthly}」로 아래 확정 칸을 채운 뒤 제출하세요.
          </p>
          <div className="team-kpi-close-status-bar">
            <span>
              가동률 <strong>{formatPct(closeUtilizationPct)}</strong>
            </span>
            <span>
              진행 상태 <strong>{formatKpiStatusLabel(monthly01Form.status)}</strong>
              {monthly01Stored?.submittedAt && (
                <span className="team-kpi-hint-inline">
                  {' '}
                  · {new Date(monthly01Stored.submittedAt).toLocaleString('ko-KR')}
                </span>
              )}
            </span>
          </div>
          {!validation.ok && (
            <p className="team-kpi-warn">
              {KPI_UI.mismatchWarn(
                validation.diffs,
                journalAvailableMm - (Number(monthly01Form.available) || 0)
              )}
            </p>
          )}
          {monthly01Stored &&
            isMonthly01ContentUnset(monthly01Stored) &&
            monthly01Form.status === KPI_STATUS.SUBMITTED && (
              <p className="team-kpi-warn">
                제출됐지만 M/M이 비어 있습니다. 「{KPI_UI.pullWeeklyToMonthly}」 후 다시 「{KPI_UI.submitMonthly}
                」하세요.
              </p>
            )}
          <div className="team-kpi-close-actions">
            <button
              type="button"
              className="btn btn-primary"
              {...uiTooltip(KPI_UI.pullWeeklyToMonthlyHint)}
              onClick={sync01cToMonthly}
            >
              {KPI_UI.pullWeeklyToMonthly}
            </button>
            {canSubmitKpiRecord(monthly01Form.status) && (
              <button
                type="button"
                className="btn btn-secondary"
                {...uiTooltip(KPI_UI.submitMonthlyHint)}
                onClick={submitKpi1Monthly}
              >
                {KPI_UI.submitMonthly}
              </button>
            )}
          </div>
          <p className="team-kpi-hint team-kpi-close-ref">
            {KPI_UI.weeklyRefLine(metrics.month01cTotals, journalAvailableMm.toFixed(2))}
          </p>
          <div className="team-kpi-close-grid">
            {['work', 'improve', 'leave', 'available'].map((field) => (
              <label key={field}>
                {field === 'work' ? '업무MM' : field === 'improve' ? '향상MM' : field === 'leave' ? '휴일MM' : '가용MM'}
                <input
                  type="number"
                  step="0.0001"
                  className="form-input"
                  value={monthly01Form[field]}
                  disabled={monthly01Form.status === KPI_STATUS.APPROVED}
                  onChange={(e) =>
                    journal.updateMonthly01(year, month, memberCode, { [field]: Number(e.target.value) })
                  }
                />
              </label>
            ))}
          </div>
        </section>
      )}

      {tab === 'export' && (
        <section className="team-kpi-section">
          <h2>분석·백업 보내기</h2>
          <p className="team-kpi-hint">공식 제출은 TMS에 저장된 데이터입니다. xlsx는 분석·경영 공유용입니다.</p>
          <div className="team-kpi-excel-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={doAnalysisExport}
              {...uiTooltip('분석 Excel (01c·01·02·03)')}
            >
              <Download size={16} /> 분석 Excel (01c·01·02·03)
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={copy01c}
              {...uiTooltip('주간 M/M 표를 클립보드에 복사')}
            >
              <ClipboardCopy size={16} /> 주간 표 복사
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={copy02}
              {...uiTooltip('KPI2 효과 건 표를 클립보드에 복사')}
            >
              <ClipboardCopy size={16} /> 02 복사
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              {...uiTooltip('운영 KPI JSON 백업 파일 저장')}
              onClick={() => {
                downloadTeamKpiSnapshot(kpiOperational, journal.meta);
                showToast('KPI 스냅샷 JSON 다운로드');
              }}
            >
              KPI 스냅샷 JSON
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              {...uiTooltip('배포 KPI → 이 기기 반영')}
              onClick={async () => {
                try {
                  const remote = await fetchTeamKpiSnapshot();
                  if (!remote) {
                    showToast('클라우드 KPI 스냅샷 없음');
                    return;
                  }
                  journal.importStore(normalizeTeamKpiSnapshot(remote).kpiOperational);
                  showToast('KPI 스냅샷 가져오기 완료');
                } catch (e) {
                  showToast(e.message);
                }
              }}
            >
              클라우드 KPI 가져오기
            </button>
          </div>
        </section>
      )}

      {toast && <div className="journal-toast">{toast}</div>}

      <a
        className="team-kpi-doc-fab"
        href={buildDocsModuleUrl('kpi-definition', {
          mode: isEditorMode() ? 'edit' : 'view',
          year,
          month: month + 1,
        })}
        {...uiTooltip('교육팀 KPI 정의서 (참고문서)')}
      >
        <BookOpen size={18} aria-hidden />
        <span>KPI 정의서</span>
      </a>
    </main>
  );
}
