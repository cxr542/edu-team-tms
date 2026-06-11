import React, { useCallback, useMemo, useState } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, Import } from 'lucide-react';
import AppModuleLink from '../components/AppModuleLink';
import CompetencyMemberHub from '../components/CompetencyMemberHub';
import CompetencyMemberSection from '../components/CompetencyMemberSection';
import { buildDocsModuleUrl } from '../constants/referenceDocs';
import { KPI3_FORMULA_TEXT } from '../constants/kpi3Elements';
import { KPI3_NAME } from '../constants/kpiDisplayNames';
import {
  TEAM_KPI_MEMBERS,
  TEAM_LEADER_MEMBER_CODE,
  findKpiMember,
  formatKpiMemberLabel,
  formatKpiMemberRoleLine,
} from '../constants/kpiMembers';
import { URL_ACCESS_LEADER } from '../constants/teamAccess';
import { useJournal } from '../context/JournalProvider';
import { useCompetencyPeriod } from '../hooks/useCompetencyPeriod';
import { useTeamAccess } from '../hooks/useTeamAccess';
import { isEditorMode } from '../utils/appMode';
import { quarterMonthKeysFromYq } from '../constants/kpiOperationalStore';
import { uiTooltip } from '../utils/uiTooltip';
import './TeamKpiPage.css';
import './CompetencyPage.css';

function canEditMemberForm(teamAccess, memberCode, canEdit) {
  if (!canEdit || !memberCode) return false;
  if (teamAccess.isMemberScope) return memberCode === teamAccess.scopedMember;
  if (teamAccess.isLeader) return memberCode === TEAM_LEADER_MEMBER_CODE;
  return true;
}

function resolvePageMember(teamAccess) {
  if (teamAccess.isMemberScope) return teamAccess.scopedMember;
  if (teamAccess.scopedMember) return teamAccess.scopedMember;
  return null;
}

/** 역량 평가 — 구성원별 별도 페이지(?member=) + 선택 허브 */
export default function CompetencyPage() {
  const { year, quarter, yq, monthIndex, changeQuarter } = useCompetencyPeriod();
  const journal = useJournal();
  const teamAccess = useTeamAccess();
  const [toast, setToast] = useState('');
  const [cloudBusy, setCloudBusy] = useState(false);

  const pageMemberCode = resolvePageMember(teamAccess);
  const showHub = !pageMemberCode && teamAccess.isLeader;
  const selectedMember = pageMemberCode ? findKpiMember(pageMemberCode) : null;

  const quarterMonthLabels = useMemo(() => {
    return quarterMonthKeysFromYq(yq).map((key) => {
      const m = parseInt(key.split('-')[1], 10);
      return { ym: key, monthIndex: m - 1, label: `${m}월` };
    });
  }, [yq]);

  const showToast = useCallback((msg) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 3200);
  }, []);

  const isLeaderOwnSelf = teamAccess.isLeader && !teamAccess.isMemberScope;
  const canEdit = isEditorMode();
  const canEditByCode = useCallback(
    (code) => canEditMemberForm(teamAccess, code, canEdit),
    [teamAccess, canEdit]
  );

  const showCloudPull = canEdit && Boolean(selectedMember) && teamAccess.isLeader && !teamAccess.isMemberScope;

  return (
    <main className="team-kpi-main competency-page">
      <header className="competency-page-header">
        <div className="competency-page-month-nav">
          <button
            type="button"
            className="journal-icon-btn"
            onClick={() => changeQuarter(-1)}
            aria-label="이전 분기"
            {...uiTooltip('이전 분기로 이동')}
          >
            <ChevronLeft size={18} />
          </button>
          <h1>
            {year}년 {quarter}분기 · 역량 평가
            {selectedMember ? ` · ${formatKpiMemberLabel(selectedMember)}` : ''}
          </h1>
          <button
            type="button"
            className="journal-icon-btn"
            onClick={() => changeQuarter(1)}
            aria-label="다음 분기"
            {...uiTooltip('다음 분기로 이동')}
          >
            <ChevronRight size={18} />
          </button>
        </div>
        {selectedMember && (
          <p className="competency-page-member-role">{formatKpiMemberRoleLine(selectedMember)}</p>
        )}
        <p className="team-kpi-hint" style={{ marginTop: 0 }}>
          교육팀 구성원 <strong>{TEAM_KPI_MEMBERS.length}명</strong> · 분기 키 {yq}
        </p>
        <p className="team-kpi-hint">{KPI3_FORMULA_TEXT}</p>
        {showHub && (
          <p className="team-kpi-hint competency-page-intro-hint">
            아래에서 구성원을 선택하면 해당 구성원 전용 평가 페이지로 이동합니다.
          </p>
        )}
        {teamAccess.isMemberScope && selectedMember && (
          <p className="competency-page-scope-hint">
            <strong>{formatKpiMemberLabel(selectedMember)}</strong> 본인 분기 자체평가만 작성·수정할 수
            있습니다.
          </p>
        )}
        {isLeaderOwnSelf && selectedMember && (
          <p className="competency-page-leader-note">
            팀장은 본인({formatKpiMemberLabel(findKpiMember(TEAM_LEADER_MEMBER_CODE))}) 폼만 수정하세요.
            다른 구성원 <strong>팀장 평가</strong>·분기 확정은{' '}
            <AppModuleLink
              module="kpi"
              mode="edit"
              access={URL_ACCESS_LEADER}
              year={year}
              month={monthIndex + 1}
              style={{ fontWeight: 600 }}
            >
              팀 KPI 관리
            </AppModuleLink>
            의 {KPI3_NAME} 탭에서 진행합니다.
          </p>
        )}
        {selectedMember && teamAccess.isLeader && !teamAccess.isMemberScope && (
          <p className="competency-page-back">
            <AppModuleLink
              module="competency"
              mode="edit"
              member={null}
              access={URL_ACCESS_LEADER}
              year={year}
              quarter={quarter}
            >
              ← 구성원 선택
            </AppModuleLink>
          </p>
        )}
      </header>

      {showCloudPull && (
        <div className="competency-page-actions">
          <button
            type="button"
            className="btn btn-import-shared"
            disabled={cloudBusy}
            aria-label="공유 역량 가져오기"
            {...uiTooltip(
              '공유 저장소의 월별 역량 평가를 가져와 competencyMonths에 병합합니다. 분기 자체평가는 이 기기에만 저장됩니다.',
              undefined,
              { wrap: true }
            )}
            onClick={async () => {
              setCloudBusy(true);
              try {
                const r = await journal.pullCompetencyCloudSnapshot();
                if (r.ok) showToast('공유 역량 평가(월별)를 이 기기에 병합했습니다');
                else if (r.reason === 'read-only') showToast('조회 모드에서는 가져올 수 없습니다');
                else showToast(r.error?.message || '공유 역량 가져오기에 실패했습니다');
              } finally {
                setCloudBusy(false);
              }
            }}
          >
            <Import size={16} />
            {cloudBusy ? '가져오는 중…' : '공유 역량 가져오기 (월별)'}
          </button>
          <p className="team-kpi-hint competency-page-cloud-hint">
            분기 자체평가는 로컬 <code>competencyQuarters</code>에 저장됩니다. 월별 공유 저장은 이
            화면에서 비활성화되어 있습니다.
          </p>
        </div>
      )}

      {selectedMember && quarterMonthLabels.length > 0 && (
        <aside className="competency-quarter-months competency-quarter-months--readonly" aria-label="분기 내 월별 참고">
          <span className="competency-quarter-months__label">이전 월별 평가(참고)</span>
          <ul className="competency-quarter-months__ref-list">
            {quarterMonthLabels.map(({ ym, label }) => (
              <li key={ym}>
                {label} ({ym})
              </li>
            ))}
          </ul>
        </aside>
      )}

      {showHub && (
        <CompetencyMemberHub year={year} quarter={quarter} yq={yq} canEditByCode={canEditByCode} />
      )}

      {selectedMember && (
        <section className="competency-page-group" aria-labelledby="competency-member-heading">
          <h2 id="competency-member-heading" className="visually-hidden">
            {formatKpiMemberLabel(selectedMember)} 평가
          </h2>
          <CompetencyMemberSection
            key={`${selectedMember.code}-${yq}`}
            member={selectedMember}
            year={year}
            quarter={quarter}
            yq={yq}
            monthIndex={monthIndex}
            journal={journal}
            canEditSelf={canEditByCode(selectedMember.code)}
            onToast={showToast}
            pageMode
          />
        </section>
      )}

      {!showHub && !selectedMember && (
        <p className="team-kpi-hint">구성원을 URL에 지정해 주세요. (예: ?member=A)</p>
      )}

      <p className="team-kpi-hint competency-page-footer-hint">
        <a href={buildDocsModuleUrl('tms-competency-design')} target="_blank" rel="noopener noreferrer">
          <BookOpen size={14} style={{ verticalAlign: 'middle' }} /> 평가 기준·레벨 상세 (참고문서)
        </a>
      </p>

      {toast && <div className="team-kpi-toast">{toast}</div>}
    </main>
  );
}
